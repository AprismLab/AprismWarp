# AprismWarp

AprismWarp 是借鉴 TurboWarp 界面和交互设计的 AprismMod 图形化开发工作台。它拥有自己的编辑器、积木语义、IR、编译器和本地宿主桥接，不使用 Scratch 内核。

## 当前状态

目前只有研究基线。TurboWarp GUI 和 VM 的上游快照位于 `upstream/`，本基线不会启动 Minecraft 进程。

## 技术方向

```text
 TurboWarp 风格界面
        |
        | Aprism 扩展积木
        v
项目中间表示 / 确定性编译器
        |
        | localhost 能力协议
        v
AprismWarp 宿主桥接
   |       |        |
  MDL   Aprism   Despotes
   |
隔离的 Minecraft JE 实例
```

桥接进程是桌面端本地边界。网页不得直接获得任意 JVM 控制、文件系统访问或不受限制的原生代码执行能力。

## Aprism 边界

AprismWarp 以 [Aprism 契约说明](docs/aprism-contract.md) 中经过源码核验的子集为目标。Aprism 是基于 JavaAgent 的加载运行时，因此 AprismWarp 生成 Aprism Native Mod 构件，并通过 MDL 执行隔离预览；它不替代 Aprism，也不另造一套注入链。

## 新建工程

AprismWarp 在没有打开工程时，首先进入新建向导。用户必须选择：

- Minecraft 版本；
- Aprism 版本；
- 工作类型：`AprismJEMod` 或 `AprismExtension`。

`AprismJEMod` 工程编译为 `.aje`；`AprismExtension` 工程编译为 `.aep`，并在 Mod 扫描前扩展 Aprism 运行时。编辑器积木面板和校验配置由工作类型决定。

## 规划功能

- 保存 AprismWarp 原生积木、IR、资源、目标配置和编辑器元数据的 `.awp` 工程文件。
- Aprism 版本与 Minecraft 配置选择。
- 本地 Aprism 发布物/缓存发现，以及显式拉取和安装。
- 生命周期、注册表、事件、资源和安全游戏查询积木。
- 项目中间表示到 `.aje` 的确定性编译。
- MDL 实例创建、启动、日志、截图和诊断。
- Despotes 游戏内观察与测试场景。
- 面向高级用户的 Java/Kotlin 或 Aprism Native 源码视图。

## 第一阶段明确不做

- 在浏览器 JavaScript 中运行 Minecraft JVM。
- 在没有白名单和信任决策时加载任意远程扩展。
- 在用户主 Minecraft 安装中执行生成代码。
- 分发 Minecraft 资源或修改后的游戏 JAR。

## 许可证

AprismWarp 使用 [GPL-3.0-only](LICENSE)。这与计划复用 TurboWarp `scratch-gui` 的 GPL-3.0 代码兼容。TurboWarp 上游源码仍作为独立跟踪的参考材料，实际导入前必须完成来源审查和记录。

`.awp` 是可编辑工程格式；`.aje` 只在导出时生成，并作为 Aprism 实例中安装的构件。

<!-- GitHub@NDBlockConnect | BlockConnect@StarsailsClover -->
