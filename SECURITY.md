# Security Policy

## Supported Versions

The project is currently pre-1.0. Security fixes target the latest `main` branch.

## Reporting A Vulnerability

If you find a vulnerability, please open a private report through GitHub Security Advisories when the repository is published. If that is not available yet, contact the maintainer privately.

Please do not attach private PDFs, real signatures, identity documents, or certificates to public issues.

## Local API

Signaturizer's HTTP API is intended to bind only to `127.0.0.1`. Do not expose it to a LAN or the public internet. Any future network-accessible mode should require authentication and a separate security review.
