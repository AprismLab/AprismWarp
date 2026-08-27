# AprismWarp

AprismWarp is a TurboWarp-inspired graphical workbench for building AprismMods. It borrows the visual language and interaction patterns of TurboWarp while defining its own editor, block semantics, IR, compiler, and local host bridge.

## Current Status

Research baseline only. The upstream GUI and VM snapshots are cloned under `upstream/`; no Minecraft process is started by this baseline.

## Direction

```text
 TurboWarp-inspired UI
        |
        | Aprism extension blocks
        v
Project IR / deterministic compiler
        |
        | localhost capability protocol
        v
AprismWarp host bridge
   |       |        |
  MDL   Aprism   Despotes
   |
isolated Minecraft JE instance
```

The bridge is a desktop/local process boundary. A web page must not receive arbitrary JVM control, filesystem access, or unrestricted native code execution.

## Upstream

- `upstream/scratch-gui`: TurboWarp GUI snapshot, GPL-3.0.
- `upstream/scratch-vm`: TurboWarp VM snapshot, MPL-2.0.
- Exact commit IDs and license implications are tracked in [FACT.md](FACT.md).

## Aprism Boundary

AprismWarp targets the verified Aprism subset documented in [aprism-contract.md](docs/aprism-contract.md). Aprism is a JavaAgent-based loader runtime, so AprismWarp generates Aprism-native mod artifacts and uses MDL for isolated execution; it does not replace Aprism or invent a second injection pipeline.

## New Project

When AprismWarp opens without a project, it starts with a creation wizard. The user must select:

- Minecraft version;
- Aprism version;
- work type: `AprismJEMod` or `AprismExtension`.

`AprismJEMod` projects compile to `.aje`. `AprismExtension` projects compile to `.aep` and extend the Aprism runtime before mod discovery. The editor palette and validation profile are selected from the work type.

## Planned Features

- `.awp` project files that preserve AprismWarp-native blocks, IR, resources, target profile, and editor metadata.
- Aprism version and Minecraft profile selection.
- Local Aprism release/cache discovery and explicit pull/install actions.
- Graphical blocks for lifecycle, registries, events, resources, and safe game queries.
- Deterministic project IR to `.aje` compiler.
- MDL instance creation, launch, logs, screenshots, and diagnostics.
- Despotes-backed in-game observation and test scenarios.
- Generated Java/Kotlin or Aprism-native source view for advanced users.

## Explicit Non-Goals for the First Iteration

- Running a Minecraft JVM inside browser JavaScript.
- Downloading arbitrary remote extensions without an allowlist and trust decision.
- Executing generated code in the user's main Minecraft installation.
- Redistributing Minecraft assets or modified game jars.

## Development

The implementation may reuse selected UI components after provenance review, but the product does not use Scratch project semantics, Scratch VM execution, Scratch extensions, or `.sb3` as its internal model. The host bridge and compiler will be separate packages so the GUI can be tested without Minecraft.

`.awp` is the editable project format. `.aje` is generated only during export and is the artifact installed into an Aprism instance.

```powershell
Set-Location AprismWarp\upstream\scratch-gui
npm install
npm run test:lint
```

The full upstream build is intentionally not claimed as complete by this research session.

## License

AprismWarp is licensed under [GPL-3.0-only](LICENSE). This keeps the repository compatible with planned reuse of GPL-3.0 code from TurboWarp's `scratch-gui`. TurboWarp upstream remains a separately tracked reference until a source import is reviewed and documented.

<!-- GitHub@NDBlockConnect | BlockConnect@StarsailsClover -->
