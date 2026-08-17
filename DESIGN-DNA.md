# Design DNA — Context Switch

> A tiny desktop control, not a product landing page. The user opens it to change one number, apply it, and close it.

## Product contract

- **Already known:** the user deliberately opened Context Switch. The screen does not repeat what Codex, TOML, local files, or context windows are.
- **Must be visible:** the selected amount, the currently applied amount once the selection moves, the supported range, and the resource tradeoff.
- **Must be possible:** apply the selection; restore the exact setup that existed before the app first changed it.
- **Progressive disclosure:** automatic compaction stays at 90% unless the user opens Advanced.
- **Implementation details:** file paths, managed keys, conflict strategy, IPC, and privacy guarantees belong in documentation and errors, never in default-state UI.

## 1. Signature

The current value is a thin stationary notch on the same scale as the selected value. While both values match, the notch disappears beneath the thumb. Moving the slider reveals the difference without a legend or status card.

## 2. Typography

- Native operating-system UI stack: Segoe UI Variable on Windows, San Francisco on macOS, and the system sans elsewhere.
- One large tabular number is the reading, not a marketing headline.
- Labels use normal sentence case. No eyebrow copy, decorative caps, or code typography in the primary view.

## 3. Color

- Light: canvas `#F4F5F3`, ink `#1B211D`, muted `#5D6861`, control line `#79857D`.
- Dark: canvas `#202521`, ink `#EEF1ED`, muted `#B4BCB6`, control line `#7B887F`.
- Blue is reserved for the pending slider value and focus. The applied value stays neutral.
- Success and error appear only after an action. There are no decorative gradients, glows, or terminal-black panels.

## 4. Shape and elevation

- Native window frame, flat canvas, one footer seam.
- Controls use a restrained 6px radius; layout surfaces are not rounded cards.
- No shadows. Hierarchy comes from position, type size, and one-pixel separators.

## 5. Space and density

- Compact utility density on a 4px grid.
- The window is fixed at 560 × 520px and expands vertically to 570px only while Advanced is open; neither state scrolls.
- The number and scale own the reading area; secondary controls stay below it.

## 6. Motion

- 130ms direct manipulation feedback only: slider thumb, current notch, button press.
- Reduced-motion preference collapses transitions.

## 7. Iconography

- The app icon depicts one applied notch and one selected point on a scale.
- No inline icon set, illustrations, sparkles, robots, or decorative brackets.

## 8. Voice

- Short, literal labels: Context window, Advanced, Apply, Restore original.
- One decision sentence is allowed: more context retains more of the task and uses more resources.
- Default state does not narrate safety, locality, implementation, or readiness.
- Errors say what the user can infer or do next; raw system and IPC messages never reach the interface.

## 9. Quality floor

- WCAG AA text, at least 3:1 non-text contrast, visible keyboard focus, 44px action targets, native light/dark support, and no external runtime requests.
- The renderer has no Node access. Its IPC surface is narrow and sender-validated.

### Contrast table (measured 2026-08-17)

| Pair (foreground on canvas) | Light | Dark | Required |
|---|---:|---:|---:|
| Primary text | 14.98:1 | 13.68:1 | 4.5:1 |
| Muted text | 5.31:1 | 8.02:1 | 4.5:1 |
| Blue accent | 5.66:1 | 6.96:1 | 3:1 |
| Focus | 5.48:1 | 8.22:1 | 3:1 |
| Success | 5.84:1 | 7.57:1 | 4.5:1 |
| Error | 6.01:1 | 6.43:1 | 4.5:1 |

## Decisions log

| Date | Decision | Reason | Rejected |
|---|---|---|---|
| 2026-08-17 | Electron desktop app | Double-click launch and direct, local file access | Browser plus localhost server |
| 2026-08-17 | Parameter-editor screen | Matches the single job and removes explanation from the UI | Hero, presets, status pills, TOML preview, terminal styling |
| 2026-08-17 | Native system typography | Makes the utility feel at home on the operating system | Bundled brand font and launch-page typography |
| 2026-08-17 | Content-sized window states | Keeps the one-task utility scroll-free without leaving permanent dead space | Scroll container or permanently tall window |
