# AprismWarp Extension Model

Status: design baseline, 2026-08-27.

AprismWarp recognizes two separate extension domains. They must not be conflated because they execute in different processes and have different trust boundaries.

| Format | Owner | Loaded by | Purpose |
|---|---|---|---|
| `.aep` | Aprism | Aprism runtime before mod scan | Minecraft/Aprism runtime capability |
| `.awe` | AprismWarp | editor and local host bridge | editor, compiler, and developer tooling capability |

## 1. Aprism Extension Discovery (`.aep`)

An `.aep` remains an Aprism ZIP archive. Its required root file stays unchanged:

```text
extension.aep
├── aprism.extension.json          # required Aprism runtime manifest
├── extension.jar                   # runtime extension code
├── lib/                            # optional runtime dependencies
└── aprismwarp.editor.json          # optional AprismWarp capability description
```

`aprism.extension.json` remains the authority for runtime loading. AprismWarp never modifies it, never changes its meaning, and never executes an embedded JAR merely to render an editor palette.

`aprismwarp.editor.json` is optional and declarative. When present, it maps runtime capabilities exposed by the `.aep` into typed AprismWarp blocks, validators, generated API calls, and documentation links. An `.aep` without it remains installable and usable by Aprism, but adds no editor blocks.

This is additive and does not require an Aprism `.aep` format break. `[H]` The Aprism runtime scans its root manifest and embedded jars; unrecognized ZIP entries are not consumed by its current extension loader. `[V]` Source: `ExtensionLoader` and `PackageAepTask`.

## 2. AEP Editor Capability Manifest

The optional manifest schema is `aprismwarp.aep-editor/v1`.

```json
{
  "schema": "aprismwarp.aep-editor/v1",
  "extensionId": "example-registry",
  "requires": {
    "aprismRange": ">=26.8.0",
    "minecraft": "26.2",
    "workTypes": ["AprismJEMod"]
  },
  "capabilities": [
    {
      "id": "example-registry:custom-content",
      "kind": "block-catalog",
      "blocks": [
        {
          "id": "example-registry:register-custom-content",
          "category": "Example Registry",
          "shape": "statement",
          "irKind": "declaration",
          "irOperation": "example-registry:custom-content",
          "fields": [{"id": "name", "type": "resource-path"}]
        }
      ]
    }
  ]
}
```

The manifest can declare only known, namespaced IR operations. The compiler accepts an operation only when the installed `.aep` capability manifest is selected in the project lock data and its target range matches. Unknown operations remain opaque and are rejected, not evaluated as code.

## 3. Editor Extensions (`.awe`)

An `.awe` is an AprismWarp Editor Extension. It is never copied into `aprism-extensions/`, never attached to Minecraft, and never packaged into `.aje` or `.aep`.

```text
extension.awe
├── aprismwarp.extension.json      # required AWE manifest
├── blocks.json                    # optional declarative block catalog
├── panels/                        # optional declarative panel descriptors
├── templates/                     # optional source/project templates
├── assets/                         # icons, localization, documentation
└── runtime/                        # optional trusted local extension code
```

Examples:

- IDE panel with generated Java source, diagnostics, and symbol navigation;
- advanced blocks backed by a reviewed Aprism API adapter;
- project templates for loader support, API extensions, or converters;
- language server client for real Java source created by the compiler.

An IDE-oriented `.awe` may display and edit generated or user-owned source, but it must not silently turn arbitrary source into Basic blocks. That action requires an explicit advanced-mode import with diagnostics and an auditable generated-code boundary.

## 4. AWE Trust and Permission Model

Declarative fields (`blocks.json`, templates, assets, panels) are data-only and may be loaded after schema validation.

Optional `runtime/` code is trusted local code. It is disabled by default and requires explicit user approval based on:

- extension id, version, and publisher identity;
- requested permissions;
- archive hash;
- target compatibility;
- signature status when available.

Initial AWE permissions:

- `editor.blocks` - contributes declarative blocks;
- `editor.panels` - contributes panels;
- `project.read` / `project.write` - reads or writes the open project;
- `compiler.adapter` - contributes reviewed IR-to-source adapters;
- `host.mdl` - requests the constrained host bridge MDL operations;
- `host.language-server` - communicates with a configured local language server.

There is no `shell`, arbitrary `java`, arbitrary filesystem root, or arbitrary network permission in v0.1.

## 5. Project Locking

`.awp` project metadata records enabled `.aep` capability manifests and `.awe` extensions by id, version, hash, and compatibility profile. The lock list makes compilation reproducible and prevents a project from silently gaining different block semantics when a locally installed extension changes.

## 6. Installation Rules

1. Installing `.aep` into an Aprism instance is performed by the host bridge after explicit confirmation.
2. AprismWarp reads the optional editor manifest without executing extension JAR code.
3. Installing `.awe` is local to AprismWarp and cannot change the Minecraft instance by itself.
4. A `.awe` that requests `host.mdl` or `compiler.adapter` requires explicit permission approval.
5. Removing an extension referenced by an `.awp` project opens the project in diagnostic-only mode until a compatible replacement is selected.

<!-- GitHub@NDBlockConnect | BlockConnect@StarsailsClover -->
