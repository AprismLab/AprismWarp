# AprismWarp New Project Flow

Status: design baseline, 2026-08-27.

When AprismWarp starts without an `.awp` project, the first screen is a project creation flow. The editor itself is not shown until the target profile and work type have been selected.

## 1. Required Choices

The flow requires three values:

1. Minecraft version, for example `26.2`.
2. Aprism version, for example `v26.8-Alpha.7`.
3. Work type: `AprismJEMod` or `AprismExtension`.

The selected values are saved twice: as the `.awp` `workProfile`, and as the target metadata in the normalized IR. The compiler rejects mismatches between the two copies.

## 2. Work-Type Routing

```text
No project
   |
   v
Select Minecraft + Aprism + work type
   |
   +--> AprismJEMod
   |       -> mod palette
   |       -> .aje compiler
   |
   +--> AprismExtension
           -> extension/provider palette
           -> .aep compiler
```

`AprismJEMod` opens the Basic palette for lifecycle, supported game events, typed content, and resources. `AprismExtension` opens a separate palette for extension metadata, capability declarations, loader-support registration, and provider registration.

## 3. Initial Data

The wizard should create an `.awp` project manifest like:

```json
{
  "format": "aprismwarp-project",
  "schemaVersion": 1,
  "projectId": "examplemod",
  "name": "Example Mod",
  "workType": "AprismJEMod",
  "workProfile": {
    "minecraftVersion": "26.2",
    "aprismVersion": "v26.8-Alpha.7",
    "workType": "AprismJEMod"
  },
  "target": {
    "aprism": "v26.8-Alpha.7",
    "edition": "JE",
    "minecraft": "26.2"
  },
  "source": {
    "editor": "aprismwarp-native",
    "project": "editor/project.json",
    "ir": "ir/project.json"
  }
}
```

## 4. Validation

- Minecraft and Aprism versions must be non-empty.
- `workProfile.workType` must equal the top-level `workType`.
- `target.minecraft` must equal `workProfile.minecraftVersion`.
- `target.aprism` must equal `workProfile.aprismVersion`.
- An `AprismExtension` IR must contain extension metadata and must not contain JE item/block/entity declarations.
- An `AprismJEMod` IR must not contain extension-only output metadata.

## 5. Output Contract

| Work type | Aprism runtime position | Required root manifest | Output |
|---|---|---|---|
| `AprismJEMod` | after extension phase | `aprism.manifest.json` | `.aje` |
| `AprismExtension` | before mod scan | `aprism.extension.json` | `.aep` |

The creation flow must make this output contract visible before the editor opens, so users do not accidentally build a Mod in an Extension project or the reverse.

<!-- GitHub@NDBlockConnect | BlockConnect@StarsailsClover -->
