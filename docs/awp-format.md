# AprismWarp Project Format (`.awp`)

Status: draft format v0.1, 2026-08-27.

## 1. Purpose

`.awp` means AprismWarp Project. It is the editable source container for an AprismWarp-native graphical AprismMod project. It is not a Scratch project, Minecraft mod, Java archive, executable, or runtime plugin.

The compiled artifact is `.aje`:

```text
project.awp -> validation -> AprismWarp IR -> compiler -> project.aje
```

The `.awp` file is the source of truth for editing. An `.aje` file can be regenerated and must not be used to reconstruct missing project design data.

## 2. Container

The initial format is a ZIP container with a mandatory UTF-8 JSON manifest:

```text
example.awp
├── awp.json
├── editor/project.json          # AprismWarp-native editor state
├── ir/project.json              # canonical AprismWarp intermediate representation
├── resources/                   # user-authored resources, deterministic paths
├── generated/                   # optional inspectable generated source, never input
├── diagnostics/                 # optional logs/traces/screenshots, never input
└── checksums.json               # optional generated integrity record
```

The archive must not contain native executables, Minecraft jars, account tokens, or arbitrary JavaAgent binaries.

## 3. `awp.json`

Minimal example:

```json
{
  "format": "aprismwarp-project",
  "schemaVersion": 1,
  "projectId": "example-mod",
  "name": "Example Mod",
  "createdBy": "AprismWarp",
  "target": {
    "aprism": "v26.0-Alpha.1",
    "edition": "JE",
    "minecraft": "26.2"
  },
  "source": {
    "editor": "aprismwarp-native",
    "project": "editor/project.json",
    "ir": "ir/project.json"
  },
  "resources": "resources/"
}
```

Required fields are `format`, `schemaVersion`, `projectId`, `name`, `target`, and `source`. Unknown fields must be preserved when possible so additive metadata does not destroy newer projects.

## 4. Native DSL and IR

AprismWarp uses its own typed block language. A block is an editor representation of a DSL node, not a Scratch opcode. The editor state may contain layout information, labels, collapsed state, and stable block IDs; the compiler consumes only the normalized IR.

The v0.1 IR has four node families:

- `declaration`: content and metadata registered during the Aprism lifecycle;
- `event`: a supported Aprism game event or lifecycle trigger;
- `action`: a safe, predefined operation executed by generated code;
- `expression`: a typed value or comparison used by conditions and actions.

The compiler must reject unknown node kinds, unsupported event names, untyped values, and actions outside the selected capability profile. There is no escape block for arbitrary Java, JVM descriptors, JavaScript, Mixin, or native calls.

`ir/project.json` is the canonical compiler input. It must contain:

- project identity and target profile;
- mod metadata and dependency ranges;
- lifecycle handlers in Aprism phase order;
- typed event handlers and declarations;
- action and expression nodes from the AprismWarp DSL;
- resource references;
- compiler/schema version metadata.

Block IDs from the editor should be retained in IR nodes so diagnostics can point back to the originating block. Unsupported operations are validation errors, not arbitrary source-code escape hatches.

## 5. Determinism

Writers must use UTF-8, stable JSON field ordering where the serializer supports it, normalized `/` archive separators, stable entry ordering, and reproducible timestamps where the ZIP library permits. Resource names must be validated against traversal and absolute-path forms.

The same validated IR and resource set should produce byte-equivalent output or a documented equivalent hash after compiler metadata normalization.

## 6. Import and Export

- Import `.awp`: validate the container before opening the editor.
- Importing `.sb3` or Scratch projects: out of scope for v0.1.
- Export `.aje`: validate target profile, compile IR, package Aprism manifest and mod JAR, and write outside the active MDL instance.
- Reopen `.aje`: not supported as a source import in v0.1; use the original `.awp`.

## 7. Security Rules

1. Reject ZIP path traversal, absolute paths, duplicate normalized entries, and excessive decompression sizes.
2. Do not execute JavaScript, Java, native code, or embedded agents while importing an `.awp`.
3. Do not store Microsoft credentials, access tokens, or unrestricted command lines.
4. Treat `diagnostics/` as untrusted data and redact secrets before export.
5. Generated artifacts are written to a configured project output directory.

## 8. Compatibility

`schemaVersion` increases only for incompatible format changes. Additive fields remain forward-compatible where possible. The editor must report an unsupported schema clearly and must not overwrite the original file during failed migration.

## 9. Pending Items

- [T] Select the exact JSON schema and validation library.
- [DONE] Define the AprismWarp-native editor state boundary and block node families.
- [T] Define IR schema and block capability matrix.
- [T] Implement archive round-trip and zip-bomb tests.

<!-- GitHub@NDBlockConnect | BlockConnect@StarsailsClover -->
