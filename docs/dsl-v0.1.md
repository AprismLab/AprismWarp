# AprismWarp Native DSL v0.1

Status: design baseline, 2026-08-27.

AprismWarp presents a visual block editor, but its language is not Scratch. The block shapes are a user interface for an Aprism-specific typed DSL whose only execution target is the Aprism API capability profile selected by the project.

The editor has two work types. `AprismJEMod` emits an Aprism-native `.aje` mod. `AprismExtension` emits an Aprism `.aep` extension that registers runtime/provider capabilities before the mod scan. They share project metadata and diagnostics, but do not share the same output contract or unrestricted block palette.

## 1. Design Rules

1. Every block has a stable `blockId`.
2. Every value has a declared or inferred type before code generation.
3. Every event and action maps to a known Aprism contract.
4. Registration-time declarations are separate from runtime handlers.
5. Unsupported behavior produces a compiler diagnostic, never arbitrary source injection.
6. Preview execution and exported code consume the same normalized IR.

## 2. Capability Tiers

| Tier | Audience | v0.1 examples | Output |
|---|---|---|---|
| Basic | non-advanced | metadata, lifecycle, tick, world load/unload, item/block declarations, logging | normal Aprism API code |
| Intermediate | experienced | commands, key bindings, resource reload, event priority, simple networking declarations | API code plus capability declarations |
| Advanced | expert | curated Mixin and version-pinned method-hook catalog | explicit target profile and warnings |
| Native | platform specialist | native bridge and C/C++ integration | separate reviewed artifact, not basic `.aje` flow |

The initial implementation exposes only Basic. Intermediate and Advanced must be represented in the IR as explicit capability requirements even before their visual blocks exist.

## 2.1 Work Types

| Work type | Runtime position | Output | Initial palette |
|---|---|---|---|
| `AprismJEMod` | loaded after extensions | `.aje` | lifecycle, events, typed content, resources |
| `AprismExtension` | loaded before mods | `.aep` | extension metadata, provider registration, capability declarations |

An `AprismExtension` must not silently emit a `.aje`, and an `AprismJEMod` must not emit an `.aep`. The compiler selects the artifact task from `workType` and fails on mismatches.

## 3. Core Node Model

```json
{
  "nodeId": "block-001",
  "kind": "event",
  "event": "game.tick",
  "stage": "START",
  "body": [
    {
      "nodeId": "block-002",
      "kind": "action",
      "action": "schedule.once",
      "delayTicks": 20
    }
  ]
}
```

Declarations are top-level and deterministic:

```json
{
  "nodeId": "decl-001",
  "kind": "declaration",
  "declaration": "item",
  "id": "example:widget",
  "maxStack": 16
}
```

## 4. v0.1 Events

| DSL event | Aprism target | Notes |
|---|---|---|
| `lifecycle.preinit` | `IAprismMod.onPreInitialize` | boot-time only |
| `lifecycle.init` | `IAprismMod.onInitialize` | registrations open |
| `lifecycle.setup` | `IAprismMod.onSetup` | post-registration wiring |
| `lifecycle.complete` | `IAprismMod.onComplete` | finalization |
| `game.tick` | `GameTickEvent` | `START` or `END` |
| `world.load` | `WorldLoadEvent` | runtime event |
| `world.unload` | `WorldUnloadEvent` | runtime event |

`client.render` is reserved for a later preview/rendering profile because the current rendering surface is experimental and the event currently exposes only frame metadata.

## 5. v0.1 Declarations

- `mod`: project identity, display name, description, environment.
- `dependency`: Aprism/ Minecraft / Java / Mod dependency range.
- `item`: `ResourceKey` plus `maxStack` in `1..64`.
- `block`: `ResourceKey`, hardness, resistance, luminance in `0..15`.
- `resource`: a validated path under the project `resources/` directory.

Entity declarations are reserved until a stable factory-generation contract exists. The current `EntityContent` requires a factory class name, which is not suitable for Basic visual development.

## 6. v0.1 Actions and Expressions

Preview-interpreter actions:

- `schedule.once` with `delayTicks >= 1`;
- `schedule.repeat` with `intervalTicks >= 1`;
- `wait` with `delayTicks >= 1`;
- `set-variable` and `compare` inside the AprismWarp interpreter only.

Exportable v0.1 action:

- `log.info` with a bounded string expression.

The scheduler is exposed by `AprismRuntime`, but not directly by the current `AprismContext`. Therefore scheduling and `wait` are preview-only in v0.1 and must be marked `previewOnly`; export validation rejects them until AprismWarp has a reviewed runtime adapter or Aprism adds an official context path.

## 7. Compilation Mapping

```text
event game.tick START
  -> context.getEventBus().register(GameTickEvent.class, listener)

declaration item
  -> context.getItemRegistry().register(ResourceKey.parse(id), ItemContent(...))

schedule.once
  -> preview interpreter only (export blocked in v0.1)
```

The scheduler mapping remains `[T]` because the current `AprismContext` does not expose `TickScheduler` directly. The compiler must use a planned AprismWarp runtime adapter or keep scheduling preview-only until an official context path exists.

## 8. Diagnostics

Every diagnostic contains:

```json
{
  "code": "AWP-IR-004",
  "severity": "error",
  "message": "Item stack size must be between 1 and 64",
  "nodeId": "decl-001",
  "profile": "JE-26.2"
}
```

Diagnostics must be deterministic and point to the original block ID where possible.

## 9. Explicitly Forbidden in Basic

- arbitrary Java source blocks;
- arbitrary JavaScript evaluation;
- arbitrary class/method/descriptor hook blocks;
- unrestricted Mixin configuration generation;
- native library loading;
- filesystem or network access from generated mod logic;
- implicit client/server cross-boundary calls.

<!-- GitHub@NDBlockConnect | BlockConnect@StarsailsClover -->
