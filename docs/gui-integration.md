# GUI Integration Design

Status: design baseline, 2026-08-30.

<!-- GitHub@NDBlockConnect | BlockConnect@StarsailsClover -->

This document defines how AprismWarp adopts the TurboWarp UI stack under
decision D-09 (Electron shell) while respecting D-01 (visual/interaction
reference only) and D-03 (AprismWarp-native block system; no Scratch VM as
product runtime). Labels: `[V]` verified against the local upstream snapshot,
`[H]` high-confidence inference, `[T]` pending.

## 1. Reuse Map

Upstream snapshot: `upstream/scratch-gui` @ `a2946eeb9a9dca7857d7ab53d766b54288c7a2ff`
(package 3.2.37, GPL-3.0). Verified build recipes: webpack build,
`webpack-dev-server` for development, React 16 + Redux 3 renderer, block
editor via `scratch-blocks` loaded through `src/lib/tw-lazy-scratch-blocks`. `[V]`

| Layer | Upstream | AprismWarp reuse |
|---|---|---|
| React shell, menus, panels, themes | scratch-gui | reuse, GPL-3.0 compatible |
| Visual block editor | scratch-blocks (Blockly) | reuse as the editing surface for AprismWarp-native blocks |
| Project runtime | scratch-vm | **not used**; replaced by the IR compiler and the preview interpreter |
| Serialization | `.sb3` (zip + project.json) | replaced by `.awp` store endpoints on the bridge |
| Extension manager | scratch-vm extension registry | replaced by `WORK_TYPE_PALETTES`, `.aep` editor catalogs, and `.awe` contributions |
| Assets (sounds, costumes, paint) | scratch-render/paint/audio | out of scope for v0.1; the IR has no asset surface |

## 2. Substitution Boundaries

1. **Blocks to IR.** Every visual block maps to exactly one IR node family
   (declaration/event/action/expression). The mapping table is data-driven
   from `src/wizard/project.js` `WORK_TYPE_PALETTES`; no block may exist
   without an IR counterpart. `[V]` by validator conformance tests.
2. **No Scratch VM.** The "green flag" equivalent is the preview interpreter:
   handlers are walked and preview-only actions are evaluated in the
   renderer; exportable actions (`log.info`) are compiled through the
   `.aje` pipeline. `[H]`
3. **Persistence.** All file I/O goes through the bridge
   (`projects/create|open|save`, `projects/package`) because the renderer is
   contextIsolation-sandboxed with CSP; the Electron preload exposes only
   `getBridgeInfo()`. `[V]` implemented in `desktop/`.

## 3. Block Definition Strategy

scratch-blocks consumes JSON-style block definitions
(`Blockly.defineBlocksWithJsonArray`) and a toolbox tree. `[H]`

- One JSON block definition per palette entry; ids are the palette entry ids
  (`lifecycle.init`, `log.info`, `declaration.item`, ...).
- Categories mirror the palette groups: Events, Declarations, Actions.
- The wizard screen creates the project first (bridge `projects/create`),
  then the editor generates the toolbox from the project's work-type palette.
- `.aep` editor catalogs and `.awe` blocks contributions append to the
  toolbox after inspection (`inspectAep`/`inspectAwe`), never execute code.

## 4. Fork Strategy

`[DECISION]` D-10: AprismWarp maintains a patched fork of scratch-gui under
`gui/` (added when GUI work starts), tracking upstream commit `a2946eeb`.

- The fork carries the smallest possible diff: entry point swap, removal of
  the scratch-vm bindings, `.awp` persistence, AprismWarp block catalog.
- Every deviation from upstream is recorded in `gui/FORK.md` with a reason
  and an upstream file reference, keeping the GPL-3.0 boundary auditable.
- The core toolchain (`src/`) stays dependency-free; the fork has its own
  package.json and dependency tree.

## 5. Phases

| Phase | Deliverable | Gate |
|---|---|---|
| G1 | Fork boots in Electron with upstream shell, no VM | window renders, CSP holds |
| G2 | Wizard screen → `projects/create` → editor opens | round-trip through bridge |
| G3 | Blocks editor wired to IR (toolbox + IR mapping) | IR validator accepts every assembled project |
| G4 | Save/load via bridge store endpoints | deterministic `.awp` bytes |
| G5 | Preview interpreter for preview-only actions | parity with IR preview mode |
| G6 | Package + MDL launch from the shell | `.aje` in an isolated instance |

## 6. Risks

- React 16/Redux 3 are aging; fork upgrades are out of scope until G3. `[H]`
- The webpack fork is the largest unknown; the `webpack-dev-server` proxy to
  the bridge must preserve the CSP restrictions of the Electron renderer. `[T]`
- Block semantics drift: any block added without an IR mapping violates
  D-03 and is rejected by review checklist. `[H]`

GitHub@NDBlockConnect | BlockConnect@StarsailsClover
