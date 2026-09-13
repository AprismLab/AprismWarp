# Changelog - AprismWarp

All notable changes are documented per the BC version control specification
(`v{Year}.{Major}-Alpha {AlphaVer.}`). Versions map to npm semver as
`{Year}.{Major}.{patch}-alpha.{n}`.

<!-- GitHub@NDBlockConnect | BlockConnect@StarsailsClover -->

## v26.0-Alpha 2 (npm 26.0.0-alpha.2) - 2026-09-14

### Added
- Electron desktop shell (D-09): pure-Node app core booting the host bridge,
  contextIsolation BrowserWindow, IPC preload, CSP-hardened wizard page, and a
  native File menu (Save/Open `.awp`, Package `.aje`).
- scratch-gui fork under `gui/` per D-10 (`gui/FORK.md` audit trail): AprismWarp
  block catalog with per-work-type toolbox, workspace→IR v0.1 extraction,
  IR→block-XML reconstruction, and a preview interpreter with validator parity.
- `.awe` editor-extension inspector and `.awp` lock-list support for all three
  lock arrays (`aepCapabilities`, `ajeCapabilities`, `aweEditors`).
- Project store endpoints (`projects/create|open|save`) with project-root
  traversal protection and entry-preserving saves.
- GUI phases G1-G6 all gated: fork boot, wizard→bridge→editor, blocks→IR,
  persistence round-trip (byte-identical), preview parity, and packaging.
- End-to-end validation against a real isolated JE instance: the generated
  `.aje` loads under Aprism v26.8 and the generated lifecycle callback executes
  (`Loaded 1, failed 0`).

### Security
- The bridge token never reaches the renderer: `bridgeRequest` proxies all
  calls from the main process; renderer pages forbid direct connections
  (`connect-src 'none'`); projects must live inside the workspace root.

### Fixed
- Wizard editor metadata carries `description`; `createProjectFile` writes the
  `editor/project.json` archive entry the AJE compiler reads.
- IR contract alignment for the GUI path: declarations carry `id`, item stacks
  use `maxStack`.

### Notes
- GUI phases proceeded under Chromium defaults (no CSP meta on the upstream
  editor page); CSP hardening is tracked in `gui/FORK.md` before the first
  release candidate. MDL launch on 26.2 requires a Java 25 runtime via
  `--java-path`.

<!-- GitHub@NDBlockConnect | BlockConnect@StarsailsClover -->

## v26.0-Alpha 1 (npm 26.0.0-alpha.1) - 2026-08-30

### Added
- `.awp` project container: dependency-free deterministic ZIP reader/writer with
  CRC32, path-safety checks, size limits, and manifest/IR consistency checks.
- IR v0.1 with work-type-aware validation (`AprismJEMod` / `AprismExtension`),
  preview-only action gating, declaration constraints, and the AWP-IR-000..009
  diagnostic family including verified target profile enforcement.
- Dependency-free JSON Schema validator (`src/schema/validate.js`) supporting
  `type`, `properties`, `required`, `additionalProperties`, `enum`, `const`,
  `pattern`, bounds, and `$ref`/`$defs`; wired into `readAwp` via opt-in
  `configureSchemaPaths`.
- Verified target profile registry (`src/compile/target-profile.js`) with the
  JE 26.2 + Aprism v26.8-Alpha.7 profile.
- `.aep` compile pipeline with SHA-256 lock backfill and read-only
  editor-manifest inspection (1 MiB limit, deflate-bomb protection).
- `.aje` compile pipeline with Java source generation, `javac` integration,
  JAR packaging, `--build` flag, and SHA-256 lock backfill.
- Loopback host bridge with bearer token auth, path-traversal protection, and
  `validate` / `package` / `capabilities` / `status` endpoints, plus project
  store endpoints (`projects/create|open|save`) with entry-preserving saves.
- No-project creation wizard core with work-type-specific editor palettes
  covering the IR v0.1 surface; wizard output round-trips through `.awp`.
- `.awe` editor-extension inspector: declarative manifest, blocks, and panel
  parsing with permission-consistency diagnostics; `runtime/` code is reported
  but never executed. `.awp` projects can lock enabled `.awe` extensions by
  id, version, and SHA-256 (`extensions.aweEditors`).
- Cross-format integration tests; suite totals 151 passing tests.

### Security
- Bridge listens on loopback only; bearer token required; archive entry paths
  are sanitised before extraction.
- AEP editor manifests are inspected read-only and never executed.

<!-- GitHub@NDBlockConnect | BlockConnect@StarsailsClover -->
