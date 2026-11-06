#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { YardStack } from '../lib/yard-stack';

const app = new cdk.App();

new YardStack(app, 'YardFinder', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
  },
  description: 'Yard Finder: operator UI + driver PWA on one EC2 behind CloudFront',
});
