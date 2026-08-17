# Design DNA — Codex Context Switch

> A local control panel for Codex users who want to tune long-context sessions without hand-editing TOML. It should feel like a trustworthy measuring instrument: exact, calm, reversible, and visibly local.

## 0. The product's world

- **Core metaphor:** a measuring rail. Context is a finite span; retained tokens and compaction headroom are visible lengths on the same scale.
- **Audience self-image:** developers and power users who value control, legibility, and proof before a tool edits their machine.
- **Category cliché:** dark developer dashboards with neon glows, generic terminal cards, and purple gradients. We use a light technical workbench with one signal-orange action color.
- **Existing anchors:** `config.toml`, monospaced values, ruler ticks, brackets, and the physical safety colors of calibrated tools.
- **Language:** Spanish and English share equal status. Controls must survive Spanish strings without truncation.

## 1. Signature

- **The context rail** is the one memorable element: a live scale that maps configured context, compaction point, headroom, and the 1.05M model ceiling geometrically.
- Only the rail and primary action spend signal orange. Everything else stays quiet.

## 2. Typography

- **Display/UI:** Public Sans (bundled variable font) — a public-service typeface fits a transparent utility and remains highly legible at control sizes.
- **Mono:** Cascadia Mono / SFMono / ui-monospace — reserved for real paths, token values, and TOML.
- Weights: 450, 650, 850. Fluid scale with tightened display tracking and tabular numerals.
- Anti-default: no Inter/Roboto and no fashionable serif pairing; the product speaks like an instrument, not a launch page.

## 3. Color

- **Canvas:** `#F3F5F2`; **surface:** `#E8ECE7`; **ink:** `#16212A`; **muted:** `#59656F`.
- **Signal accent:** `#C93E25`; text variant `#A82F1C`; label `#FFF9F5`. Orange comes from measurement and safety tools, not the usual AI-product palette.
- **Code surface:** `#182229`; code text `#EAF0E8`.
- **Borders/controls:** `#7A897C`. **Focus:** `#0B6E91` on light, `#7FD6F2` on dark.
- **Status:** success `#2E6B56`; error `#A73434`. Color never carries state alone.
- Accent proportion stays below 10% of the screen.

## 4. Shape & elevation

- Structural seams and rails: 0–4px; controls: 8px; true objects/inputs: 12px; floating dialog: 16px; pills only for compact state.
- The measured-tool metaphor keeps long rails square-ended while touchable objects retain controlled curvature.
- Elevation ladder: whitespace → background shift → hairline border. No ambient shadows or glass.

## 5. Space & density

- **Philosophy:** compact instrument with one generous reading zone. Users should see state, set a value, and act without scrolling on a typical laptop.
- 4px base grid. Major rhythm uses 24/32/48px; controls use 12/16px.

## 6. Motion

- **Physics:** fast and clipped. 140ms micro / 260ms signature; `cubic-bezier(.2, 0, 0, 1)`.
- The context rail is the only orchestrated moment: its retained span tracks the input and settles once.
- Motion is transform/opacity or a directly manipulated input fill; reduced motion disables transitions.

## 7. Iconography & illustration

- Custom 20px inline SVG set, 1.75px round stroke, derived from brackets and ruler ticks.
- No emoji, sparkles, stock illustrations, or decorative AI imagery.

## 8. Voice & vocabulary

- Exact, calm, candid — never promotional.
- Named nouns: **context rail**, **compaction line**, **headroom**, **previous setup**.
- Buttons name outcomes: “Apply setup”, “Restore previous setup”. Errors state what happened and the next safe action.
- Banned: unleash, supercharge, seamless, effortless, unlock, revolutionize and translations.

## 9. The weird budget

- One strange detail: the model ceiling is a physical stop at the right edge of the rail, with the 50K reserve beyond the recommended 1M visually present.

## 10. Quality floor

- WCAG AA text, 3:1 focus/controls, visible keyboard focus, reduced motion, 44px targets, and responsive behavior from 360px.
- Hostile strings wrap; numeric values use tabular figures; no telemetry or external runtime requests.

### Contrast table (measured 2026-08-17)

| Pair (fg on bg) | Ratio | Threshold | Verdict |
|---|---:|---:|---|
| `#16212A` on `#F3F5F2` | 14.90:1 | 4.5:1 | Pass |
| `#59656F` on `#F3F5F2` | 5.45:1 | 4.5:1 | Pass |
| `#FFF9F5` on `#C93E25` | 4.79:1 | 4.5:1 | Pass |
| `#A82F1C` on `#F3F5F2` | 6.20:1 | 4.5:1 | Pass |
| `#EAF0E8` on `#182229` | 13.95:1 | 4.5:1 | Pass |
| `#F39A80` on `#182229` | 7.50:1 | 4.5:1 | Pass |
| `#AADBB9` on `#182229` | 10.42:1 | 4.5:1 | Pass |
| `#AEBBB3` on `#182229` | 8.12:1 | 4.5:1 | Pass |
| `#2E6B56` on `#F3F5F2` | 5.71:1 | 4.5:1 | Pass |
| `#A73434` on `#F3F5F2` | 6.02:1 | 4.5:1 | Pass |
| `#7A897C` on `#F3F5F2` | 3.36:1 | 3:1 UI | Pass |
| `#718078` on `#182229` | 3.89:1 | 3:1 UI | Pass |
| `#0B6E91` on `#F3F5F2` | 5.24:1 | 3:1 focus | Pass |
| `#7FD6F2` on `#182229` | 9.85:1 | 3:1 focus | Pass |

## Appendix — decisions log

| Date | Decision | Why | Rejected alternative |
|---|---|---|---|
| 2026-08-17 | Local zero-dependency Node app | It can safely edit the user's file without uploading it | Hosted website, which cannot access `~/.codex` |
| 2026-08-17 | Light measuring-instrument UI | Makes trust and limits visible | Dark neon developer dashboard |
