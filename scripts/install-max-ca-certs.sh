#!/usr/bin/env bash
# Install Russian Trusted CA certificates required for platform-api2.max.ru (Max Bot API).
# Official source: https://www.gosuslugi.ru/crt
set -euo pipefail

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

cd "$TMP"

echo "→ downloading Russian Trusted CA certificates"
curl -fsSLk -o russian_trusted_root_ca.crt \
  "https://gu-st.ru/content/lending/russian_trusted_root_ca_pem.crt"
curl -fsSLk -o russian_trusted_sub_ca.crt \
  "https://gu-st.ru/content/lending/russian_trusted_sub_ca_pem.crt"

echo "→ installing to /usr/local/share/ca-certificates"
install -m 0644 russian_trusted_root_ca.crt /usr/local/share/ca-certificates/russian_trusted_root_ca.crt
install -m 0644 russian_trusted_sub_ca.crt /usr/local/share/ca-certificates/russian_trusted_sub_ca.crt

echo "→ updating system CA bundle"
update-ca-certificates

echo "→ verifying platform-api2.max.ru"
if NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt node -e "
fetch('https://platform-api2.max.ru')
  .then((r) => console.log('OK status=' + r.status))
  .catch((e) => { console.error('FAIL', e.cause?.code || e.message); process.exit(1); });
"; then
  echo "✅ Max API TLS verification OK"
else
  echo "❌ TLS verification still failing" >&2
  exit 1
fi
