# FACT.md - AprismWarp Project Tracking

> Maintained by BlockConnect@StarsailsClover
> Status: research baseline, v26.0-Alpha.1-Phase0

## 1. Identity

- Name: AprismWarp
- Role: TurboWarp-inspired graphical AprismMod workbench with a local Minecraft host bridge.
- Parent ecosystem: Aprism, AprismPrismate, AprismRefract, AprismJDK, MDL, Despotes.
- License: GPL-3.0-only. This is compatible with planned reuse of GPL-3.0 TurboWarp scratch-gui UI code.
- Upstream snapshots are kept under `upstream/` as visual/interaction research references and must remain traceable to commit IDs.
- Project source container: `.awp` (AprismWarp Project).
- Compiled distribution remains `.aje`; `.awp` is never loaded by Minecraft.
- A no-project launch opens a creation wizard requiring Minecraft version, Aprism version, and work type.

## 2. Research Decisions

| ID | Decision | Evidence | State |
|---|---|---|---|
| D-01 | Use TurboWarp as a visual and interaction reference; AprismWarp does not use Scratch project semantics or the Scratch VM. | Product scope clarification | [V] |
| D-02 | Keep the AprismWarp editor and Minecraft host in separate processes joined by a localhost capability protocol. | Browser sandbox, JVM/MDL process boundary | [H] |
| D-03 | Define an AprismWarp-native block system and compiler integration; do not use Scratch VM extensions as the product runtime. | Product scope clarification | [V] |
| D-04 | Do not embed a Minecraft JVM inside the browser bundle. | Aprism requires Java Agent/MDL launch semantics | [V] |
| D-05 | First target is JE Aprism Native through MDL; Prismate is a compatibility fallback for ordinary Fabric/NeoForge instances. | Aprism and Prismate project facts | [H] |
| D-06 | Mod generation must be deterministic and produce a normal Aprism `.aje` artifact, not execute arbitrary browser JavaScript in Minecraft. | Aprism manifest and packaging contracts | [H] |
| D-07 | `.awp` is the editable project container; `.aje` is the generated AprismMod distribution. | Separation of design data and runtime artifact | [H] |
| D-08 | AprismWarp-native extensions are authored as `AprismExtension` projects and export `.aep`; Java mods are authored as `AprismJEMod` projects and export `.aje`. | Aprism `.aep`/`.aje` contracts | [H] |
| D-09 | Desktop shell is Electron, matching TurboWarp upstream (TurboWarp Desktop = Electron + scratch-gui). The shell reuses scratch-gui build recipes, and its main process owns the host bridge and MDL lifecycle per D-02. The zero-dependency discipline continues to bind the core toolchain packages; the GUI/desktop package carries the scratch-gui dependency tree. | Upstream TurboWarp architecture inspection; user confirmation | [V] |
| D-10 | AprismWarp maintains a patched fork of scratch-gui under `gui/` (tracking upstream `a2946eeb`) with the smallest possible diff: entry swap, scratch-vm binding removal, `.awp` persistence, and the AprismWarp block catalog; every deviation is recorded in `gui/FORK.md`. | `docs/gui-integration.md` §4 | [H] |

## 3. Upstream Snapshot

- `upstream/scratch-gui`: `a2946eeb9a9dca7857d7ab53d766b54288c7a2ff`
- `upstream/scratch-vm`: `c4823421cb7c17d8d8a89878851ce1668c26a21f`
- scratch-gui package reports version `3.2.37`, GPL-3.0.
- scratch-vm package reports version `2.1.46`, MPL-2.0.

## 4. Session Log

### 2026-08-27 - Research baseline

- [DONE] Loaded BlockConnect development and AI engineering discipline guidance.
- [DONE] Inspected Aprism core, AprismPrismate, and AprismRefract build and runtime contracts.
- [DONE] Cloned TurboWarp scratch-gui and scratch-vm shallow `develop` snapshots.
- [DONE] Inspected GUI extension and Blockly interaction points as reference material only.
- [DONE] Documented process boundary, license boundary, and first target profile.
- [DONE] Built the local bridge host with token auth, path-traversal protection, and the `validate`/`package` endpoints (`src/bridge/server.js`, `npm run host:bridge`).
- [DONE] Added the IR-to-Java source generator, javac integration, JAR packager, and the `--build` flag on the `.aje` pipeline (`src/compile/java.js`, `src/compile/aje.js`).
- [TODO] Choose desktop shell: Tauri, Electron, or a thin local launcher plus browser UI.
- [TODO] Validate MDL and Despotes control endpoints against a real isolated JE instance.
- [DONE] Added a real `.aje` integration test that exercises the Java source generator, `javac`, JAR packaging, and the full `.awp → .aje` lock-backfill flow.
- [DONE] Adopted `.awp` as the editable AprismWarp project extension and documented its container format.
- [DONE] Added a dependency-free `.awp` ZIP reader/writer with deterministic stored entries, CRC checks, path safety, size limits, and manifest/IR consistency checks.
- [DONE] Completed a source-first Aprism contract map for the AprismWarp target subset.
- [DONE] Verified Aprism core tests with Gradle 9.5.1 and JDK 21: `aprism-api`, `aprism-manifest`, `aprism-loader-core`, and `aprism-packaging` passed.
- [NOTE] Initial test invocation failed because the inherited `JAVA_HOME` pointed to a missing JDK; validation used a process-local JDK 21 override and did not change the user environment.
- [TODO] Resolve Aprism lifecycle instance identity behavior before generating stateful cross-phase code.
- [DONE] Selected the verified JE 26.2 + Aprism v26.8-Alpha.7 profile and encoded it in `src/compile/target-profile.js` with IR validator enforcement (AWP-IR-009).
- [DONE] Defined no-project creation fields: Minecraft version, Aprism version, and `AprismJEMod`/`AprismExtension` work type.
- [TODO] Implement the no-project creation wizard and work-type-specific editor palettes.
- [DONE] Added work-type-aware IR validation, schemas, minimal `AprismJEMod` fixture, and extension validation tests.
- [DONE] Defined the dual extension model: optional declarative `.aep` editor capability manifests and separate permissioned `.awe` editor extensions.
- [DONE] Implemented read-only `.aep` editor-manifest inspection without executing embedded code (`src/aep/inspect.js`, `npm run inspect:aep`).
- [DONE] Implemented the `.awe` editor-extension inspector (`src/awe/inspect.js`, `npm run inspect:awe`): safe ZIP reading with AWE-ARCHIVE/AWE-MANIFEST/AWE-CONTRIB diagnostics, schema validation against `schemas/awe.schema.json`, permission-consistency checks, declared-contribution existence checks, trusted `runtime/` flagged as disabled-by-default and never executed.
- [DONE] Implemented `.awp` lock-list support for `.awe` editor extensions (`getAweLocks`, `verifyAweLock`, `verifyAweLockForAwp`, `applyAweLock` in `src/extension/lock.js`), completing the extension-model.md §5 lock table for all three formats (`aepCapabilities`, `ajeCapabilities`, `aweEditors`).
- [DONE] Recorded the desktop shell decision as D-09 (Electron, matching TurboWarp upstream).
- [DONE] Scaffolded the Electron desktop shell (`desktop/`): pure-Node app core (`desktop/lib/app-core.js`) boots the existing host bridge and is covered by 4 Node tests without launching Electron; thin `main.js` wrapper creates a contextIsolation BrowserWindow with a CSP-restricted placeholder renderer and an IPC preload.
- [NOTE] `npm install` of the Electron binary failed twice with `ECONNRESET` against the GitHub release mirror; the devDependency is declared and the app core is testable, but `npm --prefix desktop start` remains blocked until the download succeeds.
- [DONE] Implemented the no-project creation wizard core (`src/wizard/project.js`): `createProject(spec)` produces manifest/IR/editor metadata for both work types with a validated init scaffold, WIZ-001..006 diagnostics, and work-type-specific editor palettes (`WORK_TYPE_PALETTES`) covering the full IR v0.1 event/declaration/action surface. Wizard output round-trips through `writeAwp`/`readAwp`.
- [DONE] Added project store endpoints to the bridge (`POST /api/v1/projects/create|open|save`) backed by `src/projects/store.js` with project-root traversal protection (`STORE-PATH-002/003`), entry-preserving saves, `BRIDGE-STORE-001..004` diagnostics, and a 501 fallback when the store is not configured. Wired into the CLI (`--project-root`) and the desktop app core (`userData/projects`).
- [NOTE] The Electron binary download was blocked by repeated `ECONNRESET`; it later succeeded once the network stabilized. `npm --prefix desktop start` and the `--smoke` hook are unblocked.
- [DONE] Verified the Electron shell smoke path (`npx electron . --smoke`): main process boots, the host bridge starts on loopback, and the contextIsolation BrowserWindow is created. Fixed a missing-async activate handler found by the smoke run.
- [DONE] Completed the GUI integration design (`docs/gui-integration.md`): reuse map, substitution boundaries (blocks→IR, no scratch-vm, bridge persistence), block definition strategy from `WORK_TYPE_PALETTES`, fork strategy (D-10), and six GUI phases G1-G6 with gates.
- [DONE] GUI phase G1 PASSED: vendored the scratch-gui fork under `gui/scratch-gui` per D-10 (`gui/FORK.md` baseline), installed its dependency tree (including the GitHub git dependencies), built the production bundle with webpack 4 under the Node 24 OpenSSL legacy provider, and booted the editor inside the Electron shell (smoke reports `gui=true`, zero renderer errors). Known caveats recorded in `gui/FORK.md`: editor CSP hardening pending, filehash→hash routing fallback, upstream React 16 deprecation warnings.
- [DONE] GUI phase G2 PASSED: the Electron side now boots into a CSP-hardened wizard page (`desktop/renderer/wizard.*`); submit routes through the bridge `projects/create` then `projects/open` and navigates to the editor via an `openEditor` IPC. Hardened the preload so the bridge token never reaches the renderer: `bridgeRequest(method, path, body)` proxies all bridge calls from the main process, `getBridgeInfo` no longer returns the token, and renderer pages forbid direct network connections (`connect-src 'none'`). Smoke reports `project=smoke-project` alongside `gui=true`. Fork source remains unmodified.
- [DONE] GUI phase G3 PASSED: the fork gained `src/lib/aprismwarp-blocks.js` (block JSON definitions, per-work-type toolbox XML, workspace→IR v0.1 extraction) wired through `tw-load-scratch-blocks-hoc.jsx`, `make-toolbox-xml.js`, and a `?workType=` URL param on `editor.jsx`; all four changes are recorded in `gui/FORK.md` (D-10). The smoke gate injects a sample project into the Blockly workspace, extracts IR in the page, and validates it in the main process with `validateIr(mode: export)`: `irValid=true diagnostics=none`. Two IR contract fixes came out of the gate: declarations need `id`, and item stacks use `maxStack`.
- [DONE] GUI phase G4 PASSED: workspace→IR→`projects/save`→deterministic `.awp`→`projects/open`→IR→block-XML→workspace→re-extract round-trips with byte-identical IR (smoke `roundTrip=true`). Added `irToWorkspaceXml` and the `window.AprismWarpBlocks.saveProject/loadProject` page API (FORK.md row 6); the Electron native menu gained `Save Project (.awp)` (Ctrl+S) and `Open Project (.awp)...` (Ctrl+O) that drive those APIs via `executeJavaScript` with a projects-folder containment check. Fork menu code remains untouched.
- [DONE] GUI phase G5 PASSED: added the `previewIr` preview interpreter plus `wait`/`set-variable`/`compare` blocks (FORK.md row 7). Smoke parity gate `APRISMWARP_G5_CHECK`: validator accepts in preview mode, interpreter executes every action in phase order, variable state persists (`score=7`), `compare` resolves variables (`7 > 3`), and an unknown action is rejected by BOTH the validator (AWP-IR-032) and the interpreter. Palette now covers the full IR v0.1 action surface.
- [DONE] Adopted GPL-3.0-only for AprismWarp before importing or modifying TurboWarp scratch-gui code.

## 5. Acceptance Gates

1. GUI can load a saved `.awp` project and AprismWarp-native block definitions.
2. Bridge exposes explicit capabilities and rejects unsupported commands.
3. A graphical project compiles to a structurally valid `.aje` archive.
4. MDL launches an isolated instance without modifying native Minecraft files.
5. Runtime validation records logs and failure reasons from the isolated instance.

<!-- GitHub@NDBlockConnect | BlockConnect@StarsailsClover -->

### 2026-08-26 - v26.8-Alpha.8 AEP capability index

- [DONE] Reused the existing `aprismwarp.aep-editor/v1` design rather than
  introducing an incompatible AEP revision. The optional root entry
  `aprismwarp.editor.json` is the static bridge between runtime capabilities
  and AprismWarp blocks.
- [DONE] Added a dependency-free Node ZIP inspector that reads stored and
  deflated entries, validates archive bounds and safe paths, enforces a 1 MiB
  manifest limit, validates schema/capability/block/field IDs, and returns a
  read-only block catalog.
- [DONE] Added `scripts/inspect-aep.js` and `npm run inspect:aep`. The command
  never loads or executes `extension.jar`, native libraries, or entrypoints.
- [DONE] Added four AEP tests: valid catalog extraction, legacy-package
  compatibility, duplicate/unsafe input rejection, malformed/oversized JSON.
- [DECISION] `.aep` remains backward-compatible: `aprism.extension.json` is
  still the runtime authority; `aprismwarp.editor.json` is optional editor
  metadata. A legacy AEP loads in Aprism but contributes no Warp blocks.
- [DONE] Aprism's packaging plugin now accepts optional
  `aprismPackaging.editorManifestFile` and copies the declarative catalog to
  the AEP root as `aprismwarp.editor.json`; Aprism runtime ignores it.
- [DONE] The official package-plugin path now accepts the optional editor
  manifest and the Aprism TestKit fixture verifies it at the AEP root.

### 2026-08-26 - v26.8-Alpha.8 AEP production-path verification

- [DONE] Cross-repository AEP packaging support: Aprism's
  `AprismPackagingExtension.editorManifestFile` and `PackageAepTask` copy
  `aprismwarp.editor.json` to the archive root without changing runtime
  manifest semantics.
- [DONE] `PackageAepTaskTest` verifies a generated AEP contains
  `aprism.extension.json`, `aprismwarp.editor.json`, and the runtime jar.
- [DONE] Hardened the read-only inspector against forged ZIP size metadata:
  the 1 MiB editor-manifest limit is enforced on extracted bytes, including
  deflated entries with a false central-directory size.
- [DONE] AprismWarp combined test command runs 15 tests: 11 IR tests and 4
  read-only AEP inspection tests, all passing. Aprism packaging TestKit tests
  pass, and the full Aprism Gradle build/test remains green.
- [DECISION] AEP v1 remains backward-compatible: the editor catalog is
  optional, root-level, declarative, bounded to 1 MiB, and never executed.
  Legacy AEPs remain valid but expose no Warp blocks.
- [RESOLVED 2026-08-30] The `.awp` reader/writer, desktop bridge, and compiler
  listed as open here are now implemented (see the 2026-08-27/30 session log
  entries); editor palette integration remains future work.

### 2026-08-30 - Schema validator and target profile

- [DONE] Implemented a dependency-free JSON Schema validator (`src/schema/validate.js`) supporting `type`, `properties`, `required`, `additionalProperties`, `enum`, `const`, `pattern`, `minimum`, `maximum`, `minLength`, `maxLength`, `minItems`, `uniqueItems`, and `$ref`/`$defs`.
- [DONE] Integrated schema validation into `readAwp` via opt-in `configureSchemaPaths` API; CLI scripts `generate-aep.js` and `generate-aje.js` enable validation by default.
- [DONE] Added 17 new schema validation tests across `test/schema/` covering positive and negative cases.
- [DONE] Implemented verified target profile module (`src/compile/target-profile.js`) with `findVerifiedProfile`, `listVerifiedProfiles`, and `normaliseAprismVersion`.
- [DONE] Wired target profile check into IR validator as AWP-IR-009 diagnostic for unrecognised Minecraft/Aprism version pairs.
- [DONE] Added 8 target profile tests verifying profile matching, SemVer normalisation, frozen exports, and IR integration.
- [DONE] Added development watermarks to all source and test files per BC convention.
- [DONE] Fixed `normaliseAprismVersion` to handle Aprism `v26.8-Alpha.7` format.
- [DONE] Test suite now runs 129 tests, all passing.

<!-- GitHub@NDBlockConnect | BlockConnect@StarsailsClover -->
