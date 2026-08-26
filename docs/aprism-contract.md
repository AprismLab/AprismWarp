# Aprism Contract Used by AprismWarp

Status: source-verified baseline, 2026-08-27.

This document records the Aprism contracts that AprismWarp may target. It intentionally prefers current source and executable behavior over aspirational documentation. Labels use `[V]` verified, `[H]` high-confidence inference, `[T]` pending, and `[C]` conflicting evidence.

## 1. Runtime Shape

Aprism is a Java Edition Java Agent and loader runtime, not merely a library:

```text
MDL launch
  -> -javaagent:Aprism-...jar
  -> AprismAgent.premain / agentmain
  -> AprismClassTransformer
  -> AprismRuntime
  -> extensions
  -> mods
  -> lifecycle
  -> platform binding and game events
```

`AprismAgent` sets `aprism.agent.active=true`, registers a retransformation-capable `ClassFileTransformer`, initializes `AprismRuntime`, and can trigger production loading when `gameRoot` is supplied. `[V]` Source: `aprism-loader-core/.../AprismAgent.java`.

AprismWarp must not start or attach an independent transformer that competes with this chain. A development agent, if later required, must use an explicit Aprism extension or a separately coordinated observation role. `[H]`

## 2. Mod Entry Contract

The current source contract is:

```java
public interface IAprismMod {
    void onInitialize(AprismContext context);
    default void onPreInitialize(AprismContext context) {}
    default void onSetup(AprismContext context) {}
    default void onComplete(AprismContext context) {}
}
```

The class must be loadable through Aprism's classloader, have a no-argument constructor, and implement `IAprismMod`. `[V]` Sources: `aprism-api/.../IAprismMod.java`, `aprism-loader-core/.../AprismRuntime.java`, `EntryPointInvoker.java`.

AprismWarp's Java generator must emit this actual contract. It must not generate the undocumented `metadata()` method or use the stale `org.aprism.api` package shown in one developer-guide example. `[V]` `[C]`

## 3. Lifecycle

The common phases are ordered:

```text
PREINIT -> INIT -> SETUP -> COMPLETE
```

The manifest `main` entrypoint is used for all four common phases. `client` and `server` are used for side-specific phases. The current runtime dispatches each phase by loading the declared entrypoint class and invoking the corresponding method; it retains the first instance on the container but currently constructs an entrypoint for each dispatch. `[V]` The latter behavior is a compatibility risk for stateful generated code and should be tested or fixed before AprismWarp relies on cross-phase instance fields. `[T]` `[C]`

Recommended generated style for v0.1:

- Put declarations and early setup in PREINIT/INIT/SETUP through the generated lifecycle methods.
- Use event subscriptions for repeated runtime behavior.
- Do not rely on mutable fields surviving separate phase dispatches until the runtime identity issue is resolved.

## 4. Context Surfaces

`AprismContext` currently exposes:

- `getMod()`
- `getEventBus()`
- `getRegistry()` generic registry
- `getLogger()`
- `getInterModComms()`
- default `getCommandRegistration()`
- default `getItemRegistry()` typed registry
- default `getBlockRegistry()` typed registry

Other runtime surfaces are obtained from `AprismRuntime`, not directly from the current context interface, including networking, tick scheduling, resource reload, game-event dispatch, key bindings, content registries, rendering, AI, and native bridges. `[V]`

AprismWarp should generate against a small capability profile instead of assuming every `AprismContext` implementation supports every optional surface. `[H]`

## 5. Event and Scheduling Model

`AprismEvent` is sealed except for `AprismEvent.GameEvent`. The event bus registers an exact event class, supports priority, unregister, and post. Cancellation only has meaning for cancellable events. `[V]`

Current typed game events include:

- `GameTickEvent`: START/END and tick number; START is cancellable.
- `ClientRenderEvent`: partial tick and frame number; cancellable.
- `WorldLoadEvent` and `WorldUnloadEvent`: world identifier.

`TickScheduler` supports one-shot and repeating tasks by `TickSide`, driven by the game-side tick integration. `[V]`

The first block catalog should expose typed events and tick scheduling. It should not expose arbitrary event class names or method hooks to non-advanced users. `[H]`

## 6. Registration Windows

The loader opens registration windows at INIT and freezes them at COMPLETE for:

- commands (`CommandRegistration`);
- key bindings (`KeyBindingRegistry`);
- resource reload listeners (`ResourceReloadRegistry`).

Typed content registries reject null entries and duplicate `ResourceKey` values. `ResourceKey` uses a validated lowercase `namespace:name` identifier. `BlockContent` currently models hardness, resistance, and luminance 0-15; `ItemContent` models max stack 1-64; `EntityContent` requires a factory class and client-tracked flag. `[V]`

These constraints should be represented in the editor type system so invalid projects fail before code generation. `[H]`

## 7. `.aje` Output Contract

The current native JE package is a ZIP archive:

```text
mod-version.aje
├── aprism.manifest.json
├── modid.jar
├── resources/       optional
├── mixins/          optional
├── lib/             optional
└── icon.png         optional
```

`PackageAjeTask` writes the manifest at the root, renames the configured main JAR to `<id>.jar`, copies configured collections, and writes a sibling `checksums.txt`. `[V]`

AprismWarp must emit exactly one generated main JAR and a root manifest. It must not place GUI assets, `.awp` files, or host bridge executables inside `.aje`. `[H]`

## 8. Mixin and Low-Level Hooks

The current transformer order is:

```text
registered transformations
 -> Mixin
 -> AccessWidener
 -> MethodHookTransformer
 -> class-load observers
```

Mixin configs and access wideners are appropriate for advanced generated modules only. `[V]`

`MethodHookRegistry` currently accepts a class name, method name, JVM descriptor, and `Runnable`. The transformer injects `MethodHookRegistry.fire(key)` at method entry and skips constructors, abstract methods, native methods, and class initializers. It does not expose method arguments, return values, or a cancellation result. `[V]`

Therefore a non-advanced AprismWarp project may use predefined event blocks, but may not generate arbitrary method hooks. An advanced mode could expose a curated, version-pinned hook catalog after target mapping and runtime validation. `[H]`

## 9. Version and Mapping Profiles

- MC 26.1+ uses the current no-remap/official-name profile in the project configuration.
- Earlier profiles use remapped/intermediary mappings and require version-specific mapping data.
- The repository's current `gradle.properties` targets Aprism `v26.8-Alpha.7`, JE, MC `26.2`, and Java `21`; the architecture documentation describes Java 25 for the 26.x Modern profile. `[V]` `[C]`

AprismWarp v0.1 should target one explicitly selected profile, preferably the workspace's verified JE 26.2 path, and store that profile in `.awp`. It must not silently claim cross-version output. `[H]`

## 10. What AprismWarp May Promise

### Supported target for the first vertical slice

- mod metadata and dependency declarations;
- lifecycle blocks;
- game tick/world lifecycle event blocks;
- typed block and item declarations where the target binder supports them;
- resource files;
- deterministic Java source/JAR and `.aje` packaging;
- MDL isolated preview and log collection.

### Explicitly advanced or pending

- arbitrary Mixin injection;
- arbitrary low-level method hooks;
- native bridge calls;
- networking transport implementation, which is fail-closed until a real transport is attached;
- rendering and AI surfaces, currently experimental/reference-only;
- Bedrock `.abe` generation;
- cross-version automatic remapping.

## 11. Known Contract Conflicts

1. `[C]` Developer guide documents `metadata()` and `org.aprism.api`, while current source requires neither and uses `com.aprism.api`.
2. `[C]` Documentation describes Mixin as the only injection mechanism, while current source also has a programmatic method-hook ASM pass.
3. `[C]` Documentation describes stable instance reuse, while current runtime constructs entrypoint objects on each phase dispatch and only retains the first instance.
4. `[C]` Architecture documents a richer manifest and `.abe` packaging surface than the current Java record and packaging task implement.

AprismWarp must target the verified subset and track these conflicts rather than hide them behind generated code.

<!-- GitHub@NDBlockConnect | BlockConnect@StarsailsClover -->
