# AprismWarp Architecture Research

Status: research baseline, 2026-08-27. Conclusions use `[V]` verified, `[H]` high-confidence inference, `[T]` pending, and `[C]` conflicting evidence.

## 1. Problem Decomposition

The requested product has four separate responsibilities:

1. A TurboWarp-inspired visual editor with AprismWarp-native block semantics.
2. Aprism release discovery and installation.
3. Minecraft process lifecycle and isolated test-instance management.
4. A compiler from graphical blocks to an AprismMod artifact.

Combining all four inside a browser bundle would cross incompatible security and runtime boundaries. The architecture therefore separates the AprismWarp GUI/editor from a local host bridge.

## 2. Evidence Inventory

| Area | Evidence | Conclusion |
|---|---|---|
| UI reference | Local clone of `scratch-gui`; package version 3.2.37; GPL-3.0 | [V] Useful for visual/interaction study; not automatically a code base for AprismWarp. |
| Scratch VM reference | Local clone of `scratch-vm`; package version 2.1.46; MPL-2.0 | [V] Useful for understanding block editor patterns; excluded from product runtime. |
| AprismWarp blocks | Native block registry and compiler contracts | [T] Must be designed independently of Scratch VM extension semantics. |
| Aprism Native | Aprism README and FACT: Java Agent, `.aje`, MDL `--aprism` | [V] Minecraft execution belongs outside browser JavaScript. |
| Prismate | `EmbeddedRuntime`, Fabric classpath injection, NeoForge managed classloader fallback | [V] Prismate is a fallback host path, not a universal embedded runtime. |
| MDL | BlockConnect toolchain contract | [V] MDL is the lifecycle boundary for isolated instances. |
| Despotes | BlockConnect toolchain contract | [V] Despotes is the observation/control channel after a game launches. |

## 3. Alternatives

### A. Browser-only web app

Rejected as the primary product. It can provide blocks, but cannot safely launch MDL, attach Aprism, access local artifacts, or control a JVM without a native companion.

### B. Electron application

Technically feasible and fast to prototype. It provides a Node main process and browser renderer, but the large runtime and broad Node attack surface require a strict preload API, origin checks, and local-only binding.

### C. Tauri application

Technically feasible with a smaller native shell and a web renderer. It reduces distribution size, but introduces Rust command and packaging work. This is a candidate, not yet selected.

### D. Thin local bridge plus browser GUI

Best research baseline. The GUI remains close to TurboWarp and can run in a browser during development; a separate bridge owns MDL, Aprism cache, filesystem, and Despotes operations. A desktop shell can be added later without changing the protocol.

Selected for Phase 0: [H]. TurboWarp remains a design reference, not a runtime dependency.

## 4. Proposed Components

```text
packages/
  aprism-blocks/          AprismWarp-native block definitions and compiler calls
  aprism-ir/              versioned, serializable project intermediate form
  aprism-compiler/        IR -> source/resources/.aje, deterministic output
  host-bridge/             localhost API, policy, MDL/Aprism adapters
  desktop-shell/           optional Tauri/Electron host
```

The upstream GUI and VM remain separately tracked references. AprismWarp must not inherit Scratch project serialization or VM runtime behavior merely because the interface resembles TurboWarp.

## 5. Trust Boundary

- Browser/GUI may request capabilities; it may not choose arbitrary executable paths.
- Bridge binds to `127.0.0.1` and uses a per-session random token or equivalent origin-bound handshake.
- Bridge validates command schemas, profile IDs, archive paths, and artifact hashes.
- Remote downloads require an explicit user action and an allowlisted source policy.
- Generated `.aje` output is written to a project artifact directory, never directly to the active game directory.
- MDL creates or clones isolated instances; native Minecraft files remain untouched.
- Logs returned to the GUI are bounded and redact account/token material.

## 6. AprismMod Compilation Model

### 6.1 File Responsibilities

`*.awp` is the editable AprismWarp project container. It stores design intent and enough information to reopen the project without a Minecraft instance. `*.aje` is a generated AprismMod package and is never used as the editor's source of truth.

The relationship is deliberately one-way:

```text
.awp -> validate -> IR -> compile/package -> .aje
```

Runtime observations, screenshots, and traces may be stored as optional diagnostics in an `.awp` project, but they must not silently replace the user's blocks or IR.

The graphical language should target a small typed IR rather than directly emitting JavaScript or Java source from every block. The IR should include:

- Project ID, target Aprism line, MC version, and environment.
- Mod metadata and dependency ranges.
- Lifecycle handlers in fixed phase order.
- Typed event handlers and registry declarations.
- Resource files and generated source units.
- Compiler version and reproducibility metadata.

The compiler then validates the IR, emits a normal mod JAR plus `aprism.manifest.json`, and packages a structurally valid `.aje`. Unsupported blocks become compile errors with source block IDs.

## 7. Open Risks

| Risk | Impact | Mitigation | State |
|---|---|---|---|
| TurboWarp fork drift | High maintenance cost | Pin upstream commit and keep patches small | [T] |
| GPL/MPL/new-code license boundary | Distribution/legal risk | Keep provenance map and license files per component | [H] |
| MDL CLI/API changes | Launch failures | Adapter with capability discovery and version checks | [T] |
| Minecraft version mappings | Generated mods fail to load | Target one JE line first and validate in MDL | [T] |
| Arbitrary extension execution | Code execution risk | Built-in extension or signed/local extension policy | [H] |
| NeoForge embedded loading | Classpath/resource limitations | Prefer Aprism Native first; Prismate fallback is explicit | [V] |

## 8. Next Research Gates

1. Inspect exact MDL `capabilities` output and available Aprism commands locally.
2. Define bridge JSON schemas and error codes.
3. Implement a no-Minecraft mock bridge and extension block smoke test.
4. Generate a minimal `.aje` fixture from a hand-authored IR.
5. Run one isolated JE instance with MDL and verify logs/screenshot collection.
6. Select Tauri or Electron only after the protocol works independently.

<!-- GitHub@NDBlockConnect | BlockConnect@StarsailsClover -->
