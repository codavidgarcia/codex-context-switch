# Security policy

## Supported versions

Security fixes are applied to the latest release on the default branch.

## Report a vulnerability

Please do not open a public issue for a vulnerability that could modify or expose local files. Use GitHub's private vulnerability reporting for this repository.

Include the operating system, Node.js version, reproduction steps, and the smallest safe example config that demonstrates the issue. Do not include tokens, credentials, or a real `config.toml`.

## Security boundaries

Codex Context Switch:

- binds to `127.0.0.1`, not all network interfaces;
- serves a fixed allowlist of bundled files;
- requires a per-process request token and same-origin header for writes;
- accepts only small JSON request bodies;
- manages only three top-level Codex keys;
- detects conflicting external changes before apply or restore;
- makes no outbound network requests at runtime.

The tool is not a general TOML editor and does not execute values from the config file.
