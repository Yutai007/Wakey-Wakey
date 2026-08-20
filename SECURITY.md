# Security Policy

## Reporting a vulnerability

If you discover a security issue, please do not open a public issue with exploit details.

Instead, contact the maintainers privately and include:

- A clear description of the issue
- Reproduction steps
- Impact assessment
- Suggested mitigation (if available)

## Secret handling expectations

- Never commit private keys, certificates, or OAuth secrets.
- Keep Spotify app credentials in local, ignored config files only.
- Rotate credentials immediately if they are exposed.
