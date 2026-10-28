# Agent Instructions

## Security and secrets

- Never commit or push `.env` files, credentials, tokens, API keys, private
  keys, certificates, service credentials, or any file that contains a secret.
  Keep them local only.
- Use `.env.example` files for placeholders and documentation. Never put real
  values in an example file.
- Before committing, inspect the staged file list and confirm no secret-bearing
  file is included. If a secret is accidentally staged or committed, stop,
  remove it from the index/history, rotate the secret, and report it. Do not
  push it.
- Do not print secret values in chat, logs, test output, or generated files.
- Prefer environment variables or local secret files referenced through
  `{file:...}` or equivalent configuration indirection.
