# Certificates and signing keys

Run `./scripts/gen-dev-keys.sh` from the repository root to generate disposable local-development keys under `certs/dev/`.

Private keys are intentionally excluded from the packaged source and `.gitignore`. Never reuse development keys in production. Production signing keys should be created and protected through your secrets/KMS/HSM process, and mTLS client certificates should be unique per installation or managed device.
