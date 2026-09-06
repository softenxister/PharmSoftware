#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
qz_signing_dir="${PHARM_QZ_SIGNING_DIR:-.local/qz-signing}"
umask 077
mkdir -p "$qz_signing_dir"
if [[ -e "$qz_signing_dir/private-key.pem" || -e "$qz_signing_dir/certificate.pem" ]]; then
  echo 'Signing files already exist; keeping the existing identity.'
  exit 0
fi
openssl req -x509 -newkey rsa:2048 -sha256 -nodes -days 3650 \
  -subj '/CN=Pharm Counter/O=Pharm' \
  -addext 'basicConstraints=critical,CA:TRUE' \
  -addext 'keyUsage=critical,digitalSignature,keyCertSign' \
  -keyout "$qz_signing_dir/private-key.pem" -out "$qz_signing_dir/certificate.pem" 2>/dev/null
echo 'Created server-only signing key and public counter certificate.'
openssl x509 -in "$qz_signing_dir/certificate.pem" -noout -fingerprint -sha256
