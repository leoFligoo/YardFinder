import * as fs from 'fs';
import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

/**
 * One EC2 instance runs everything (nginx + the Python app). CloudFront gives
 * us HTTPS on *.cloudfront.net without a domain. Deploys go S3 -> SSM, no SSH.
 *
 *   browser --HTTPS--> CloudFront --HTTP:80--> nginx --> compartir_ui.py (:8766)
 *                                                  \--> /pwa/ static files
 *
 * Only OUR CloudFront distribution may reach the instance, enforced twice:
 *   1. Security group: port 80 open only to the CloudFront origin-facing prefix list.
 *   2. nginx: rejects (403) any request without the secret X-Origin-Verify header,
 *      which only this distribution adds. (The prefix list alone admits ANY
 *      CloudFront distribution, so this second layer matters.)
 */
export class YardStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    cdk.Tags.of(this).add('Project', 'yard-finder');

    // ── S3: release bundles + DB backups (private) ───────────────────────────
    const bucket = new s3.Bucket(this, 'Artifacts', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN, // db-backups/ must survive a stack delete
      lifecycleRules: [
        { prefix: 'releases/', expiration: cdk.Duration.days(30) },
        { prefix: 'db-backups/', expiration: cdk.Duration.days(90) },
      ],
    });

    // ── Secret shared by CloudFront (adds it) and nginx (requires it) ────────
    const originSecret = new secretsmanager.Secret(this, 'OriginVerify', {
      description: 'X-Origin-Verify header value: proves a request came through our CloudFront',
      generateSecretString: { passwordLength: 40, excludePunctuation: true },
    });

    // ── Network: default VPC, public subnet, no SSH ──────────────────────────
    const vpc = ec2.Vpc.fromLookup(this, 'Vpc', { isDefault: true });

    const sg = new ec2.SecurityGroup(this, 'Sg', {
      vpc,
      description: 'HTTP from CloudFront only (no SSH; use SSM)',
      allowAllOutbound: true,
    });
    // CloudFront origin-facing managed prefix list (ID differs per region).
    // Find it: aws ec2 describe-managed-prefix-lists \
    //   --filters Name=prefix-list-name,Values=com.amazonaws.global.cloudfront.origin-facing
    const prefixListId = this.node.tryGetContext('cloudfrontPrefixListId') as string;
    sg.addIngressRule(ec2.Peer.prefixList(prefixListId), ec2.Port.tcp(80), 'CloudFront origin-facing');

    // ── EC2 ──────────────────────────────────────────────────────────────────
    const role = new iam.Role(this, 'InstanceRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')],
    });
    bucket.grantRead(role, 'releases/*');   // pull releases
    bucket.grantPut(role, 'db-backups/*');  // push DB backups (no read/delete)
    originSecret.grantRead(role);           // nginx secret, fetched at deploy time

    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      `export YARD_BUCKET=${bucket.bucketName}`,
      `export YARD_ORIGIN_SECRET_ID=${originSecret.secretArn}`,
      fs.readFileSync(path.join(__dirname, '..', 'server', 'bootstrap.sh'), 'utf8'),
    );

    const instance = new ec2.Instance(this, 'Server', {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType: new ec2.InstanceType(this.node.tryGetContext('instanceType') ?? 't3.small'),
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      securityGroup: sg,
      role,
      requireImdsv2: true,
      userData,
      // Bootstrap runs once. Editing it must never replace the box (and its data).
      userDataCausesReplacement: false,
      blockDevices: [
        {
          deviceName: '/dev/xvda',
          volume: ec2.BlockDeviceVolume.ebs(20, { volumeType: ec2.EbsDeviceVolumeType.GP3, encrypted: true }),
        },
        {
          // Data volume: inventario.db + salida/. Kept if the instance is terminated.
          deviceName: '/dev/sdf',
          volume: ec2.BlockDeviceVolume.ebs(10, {
            volumeType: ec2.EbsDeviceVolumeType.GP3,
            encrypted: true,
            deleteOnTermination: false,
          }),
        },
      ],
    });

    // Stable public DNS name for the CloudFront origin (CloudFront rejects raw IPs).
    const eip = new ec2.CfnEIP(this, 'Eip', { domain: 'vpc', instanceId: instance.instanceId });
    const dnsSuffix = this.region === 'us-east-1' ? 'compute-1' : `${this.region}.compute`;
    const originDomain = cdk.Fn.join('', [
      'ec2-',
      cdk.Fn.join('-', cdk.Fn.split('.', eip.attrPublicIp)),
      `.${dnsSuffix}.amazonaws.com`,
    ]);

    // ── CloudFront: HTTPS front door, nothing cached ─────────────────────────
    const distribution = new cloudfront.Distribution(this, 'Cdn', {
      comment: 'Yard Finder',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      defaultBehavior: {
        origin: new origins.HttpOrigin(originDomain, {
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
          httpPort: 80,
          customHeaders: { 'X-Origin-Verify': originSecret.secretValue.unsafeUnwrap() },
        }),
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS, // HSTS, nosniff, frame, referrer
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL, // PWA will POST
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        compress: true,
      },
    });

    // ── Outputs (scripts/*.sh read these) ────────────────────────────────────
    new cdk.CfnOutput(this, 'Url', { value: `https://${distribution.distributionDomainName}` });
    new cdk.CfnOutput(this, 'InstanceId', { value: instance.instanceId });
    new cdk.CfnOutput(this, 'BucketName', { value: bucket.bucketName });
  }
}
