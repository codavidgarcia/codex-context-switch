# Security policy

## Supported versions

Security fixes are applied to the latest release on the default branch.

## Report a vulnerability

Please do not open a public issue for a vulnerability that could modify or expose local files. Use GitHub's private vulnerability reporting for this repository.

Include the operating system, app version, reproduction steps, and the smallest safe example config that demonstrates the issue. Do not include tokens, credentials, or a real `config.toml`.

## Security boundaries

Codex Context Switch:

- loads only a fixed allowlist of bundled assets through a private protocol;
- uses a sandboxed renderer with context isolation and no Node.js integration;
- exposes only status, apply, and restore through a narrow preload bridge;
- validates the renderer origin before handling every request;
- denies permissions, navigation, and new windows;
- manages only three top-level Codex keys;
- detects conflicting external changes before apply or restore;
- makes no outbound network requests at runtime.

The tool is not a general TOML editor and does not execute values from the config file.
