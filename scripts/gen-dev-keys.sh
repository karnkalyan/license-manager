#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/certs/dev"
mkdir -p "$OUT"

openssl genpkey -algorithm ED25519 -out "$OUT/license-ed25519-private.pem"
openssl pkey -in "$OUT/license-ed25519-private.pem" -pubout -out "$OUT/license-ed25519-public.pem"

openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out "$OUT/ca-key.pem"
openssl req -x509 -new -key "$OUT/ca-key.pem" -sha256 -days 3650 -subj "/CN=License Dev CA" -out "$OUT/ca-cert.pem"

openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out "$OUT/server-key.pem"
openssl req -new -key "$OUT/server-key.pem" -subj "/CN=localhost" -out "$OUT/server.csr"
cat > "$OUT/server.ext" <<EOT
subjectAltName=DNS:localhost,IP:127.0.0.1
extendedKeyUsage=serverAuth
EOT
openssl x509 -req -in "$OUT/server.csr" -CA "$OUT/ca-cert.pem" -CAkey "$OUT/ca-key.pem" -CAcreateserial -out "$OUT/server-cert.pem" -days 825 -sha256 -extfile "$OUT/server.ext"

openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out "$OUT/client-key.pem"
openssl req -new -key "$OUT/client-key.pem" -subj "/CN=dev-client" -out "$OUT/client.csr"
cat > "$OUT/client.ext" <<EOT
extendedKeyUsage=clientAuth
EOT
openssl x509 -req -in "$OUT/client.csr" -CA "$OUT/ca-cert.pem" -CAkey "$OUT/ca-key.pem" -CAcreateserial -out "$OUT/client-cert.pem" -days 825 -sha256 -extfile "$OUT/client.ext"

rm -f "$OUT"/*.csr "$OUT"/*.ext "$OUT"/*.srl
chmod 600 "$OUT"/*-key.pem "$OUT/license-ed25519-private.pem"
echo "Development signing and mTLS certificates created in $OUT"
