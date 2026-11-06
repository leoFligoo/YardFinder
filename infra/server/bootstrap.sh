# One-time instance setup (EC2 user data). Idempotent enough to re-run by hand.
# App code, nginx config and the systemd unit are NOT here: they ship with each
# release and are applied by remote/apply.sh. YARD_BUCKET and YARD_ORIGIN_SECRET_ID
# are exported by the stack.
set -euxo pipefail
exec > >(tee -a /var/log/yard-bootstrap.log) 2>&1

PY=python3.12
dnf install -y nginx sqlite tar "$PY" "$PY-pip" || {
  PY=python3.11
  dnf install -y nginx sqlite tar "$PY" "$PY-pip"
}

id yard >/dev/null 2>&1 || useradd --system --home-dir /opt/yard --shell /sbin/nologin yard
mkdir -p /opt/yard/releases /etc/yard /var/lib/yard

# Data volume (attached as /dev/sdf, shows up as an NVMe device on t3).
DEV=/dev/sdf
[ -e "$DEV" ] || DEV=/dev/nvme1n1
if ! blkid "$DEV" >/dev/null 2>&1; then
  mkfs.xfs -L yarddata "$DEV"
fi
UUID=$(blkid -s UUID -o value "$DEV")
grep -q "$UUID" /etc/fstab || echo "UUID=$UUID /var/lib/yard xfs defaults,nofail 0 2" >> /etc/fstab
mountpoint -q /var/lib/yard || mount /var/lib/yard
mkdir -p /var/lib/yard/salida /var/lib/yard/backups
chown -R yard:yard /var/lib/yard

"$PY" -m venv /opt/yard/venv

# Which script serves the app. Switch to interfaz.py (writable) when the PWA API lands.
[ -f /etc/yard/yard.env ] || cat > /etc/yard/yard.env <<ENVF
YARD_BUCKET=$YARD_BUCKET
YARD_ORIGIN_SECRET_ID=$YARD_ORIGIN_SECRET_ID
YARD_ENTRYPOINT=compartir_ui.py
ENVF

systemctl enable nginx
touch /var/lib/yard/.bootstrapped
