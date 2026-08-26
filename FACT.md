# FACT.md - AprismWarp Project Tracking

> Maintained by BlockConnect@StarsailsClover
> Status: research baseline, v26.0-Alpha.1-Phase0

## 1. Identity

- Name: AprismWarp
- Role: TurboWarp-inspired graphical AprismMod workbench with a local Minecraft host bridge.
- Parent ecosystem: Aprism, AprismPrismate, AprismRefract, AprismJDK, MDL, Despotes.
- License target: new AprismWarp code is licensed independently; upstream UI code is not copied until its provenance and license obligations are reviewed.
- Upstream snapshots are kept under `upstream/` as visual/interaction research references and must remain traceable to commit IDs.
- Project source container: `.awp` (AprismWarp Project).
- Compiled distribution remains `.aje`; `.awp` is never loaded by Minecraft.

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
- [TODO] Add the Aprism block extension and project-to-manifest compiler.
- [TODO] Choose desktop shell: Tauri, Electron, or a thin local launcher plus browser UI.
- [TODO] Validate MDL and Despotes control endpoints against a real isolated JE instance.
- [TODO] Add generated-artifact tests and a real `.aje` integration test.
- [DONE] Adopted `.awp` as the editable AprismWarp project extension and documented its container format.
- [TODO] Implement `.awp` reader/writer with schema validation and deterministic archive ordering.
- [DONE] Completed a source-first Aprism contract map for the AprismWarp target subset.
- [DONE] Verified Aprism core tests with Gradle 9.5.1 and JDK 21: `aprism-api`, `aprism-manifest`, `aprism-loader-core`, and `aprism-packaging` passed.
- [NOTE] Initial test invocation failed because the inherited `JAVA_HOME` pointed to a missing JDK; validation used a process-local JDK 21 override and did not change the user environment.
- [TODO] Resolve Aprism lifecycle instance identity behavior before generating stateful cross-phase code.
- [TODO] Select the verified JE 26.2 profile and encode it in the `.awp` target schema.

## 5. Acceptance Gates

1. GUI can load a saved `.awp` project and AprismWarp-native block definitions.
2. Bridge exposes explicit capabilities and rejects unsupported commands.
3. A graphical project compiles to a structurally valid `.aje` archive.
4. MDL launches an isolated instance without modifying native Minecraft files.
5. Runtime validation records logs and failure reasons from the isolated instance.

<!-- GitHub@NDBlockConnect | BlockConnect@StarsailsClover -->
