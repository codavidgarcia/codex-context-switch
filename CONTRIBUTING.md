# Contributing

Thanks for helping improve Codex Context Switch.

1. Fork the repository and create a focused branch.
2. Keep renderer dependencies at zero unless a dependency removes more risk than it adds.
3. Preserve comments, unknown keys, section ordering, and line endings in config fixtures.
4. Add a regression test for every config-writing change.
5. Run `npm run check` before opening a pull request.

UI changes should follow `DESIGN-DNA.md`, fit without scroll in both fixed window states, preserve keyboard focus, and honor reduced-motion preferences.
