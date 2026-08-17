# Codex Context Switch

Tune Codex's context window from a local interface, then restore your previous setup with one click.

> Community project. Not an official OpenAI product.

![Codex Context Switch interface](docs/context-switch.png)

## Run it

Node.js 20 or newer is the only requirement.

```bash
npx --yes github:codavidgarcia/codex-context-switch
```

The command starts a server bound only to `127.0.0.1` and opens the interface. Choose a preset or enter any supported value, then select **Apply setup**. To undo it, select **Restore previous setup**.

Spanish is available from the `ES` switch in the header.

## What it changes

The app manages these top-level keys in `~/.codex/config.toml` (or `$CODEX_HOME/config.toml`):

```toml
model = "gpt-5.6-sol"
model_context_window = 1000000
model_auto_compact_token_limit = 900000
```

You can customize the context window up to GPT-5.6 Sol's 1,050,000-token model limit and place the compaction line anywhere below it. The one-million / 900K setup is the starting recommendation shown in the interface.

After applying or restoring settings, restart Codex and begin a new task.

## Reversibility and safety

- The app remembers the exact managed lines that existed before the first apply.
- Undo restores only those three keys; unrelated edits, comments, and TOML sections stay intact.
- If any managed line changes outside the app, it reports a conflict and refuses to overwrite the file.
- Writes use a same-directory replacement file so a failed write can put the original back.
- State-changing requests require a same-origin token. The server accepts connections only from localhost.
- There is no telemetry, analytics, remote API, or runtime dependency.

The local restore state lives beside the Codex config as `context-switch-state.json` and is removed after a successful restore.

## Why a local app?

A hosted website cannot safely edit `~/.codex/config.toml`. Context Switch is a local web interface: the browser supplies the UI, while a small zero-dependency Node process performs the file operation on the same machine.

## Official references

- [GPT-5.6 Sol model page](https://developers.openai.com/api/docs/models/gpt-5.6-sol) — documents the 1,050,000-token context window.
- [Codex configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference) — documents `model`, `model_context_window`, and `model_auto_compact_token_limit`.

## Develop

```bash
git clone https://github.com/codavidgarcia/codex-context-switch.git
cd codex-context-switch
npm test
npm start
```

Useful options:

```text
--no-open        Keep the browser closed
--port <number>  Use a specific localhost port
--config <path>  Use another config.toml path for testing
```

## License

MIT
