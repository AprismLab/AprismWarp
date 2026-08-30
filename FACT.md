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
- [TODO] Build the local bridge host and capability endpoint.
- [DONE] Built the local bridge host with token auth, path-traversal protection, and the `validate`/`package` endpoints (`src/bridge/server.js`, `npm run host:bridge`).
- [TODO] Add the Aprism block extension and project-to-manifest compiler.
- [DONE] Added the IR-to-Java source generator, javac integration, JAR packager, and the `--build` flag on the `.aje` pipeline (`src/compile/java.js`, `src/compile/aje.js`).
- [TODO] Choose desktop shell: Tauri, Electron, or a thin local launcher plus browser UI.
- [TODO] Validate MDL and Despotes control endpoints against a real isolated JE instance.
- [TODO] Add generated-artifact tests and a real `.aje` integration test.
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
- [OPEN] `AprismWarp` still needs its `.awp` reader/writer, desktop bridge,
  compiler, and actual editor palette integration. This Alpha delivers the
  secure archive-to-catalog foundation, not the complete GUI product.

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
