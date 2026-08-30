# Changelog - AprismWarp

All notable changes are documented per the BC version control specification
(`v{Year}.{Major}-Alpha {AlphaVer.}`). Versions map to npm semver as
`{Year}.{Major}.{patch}-alpha.{n}`.

<!-- GitHub@NDBlockConnect | BlockConnect@StarsailsClover -->

## v26.0-Alpha 1 (npm 26.0.0-alpha.1) - 2026-08-30

### Added
- `.awp` project container: dependency-free deterministic ZIP reader/writer with
  CRC32, path-safety checks, size limits, and manifest/IR consistency checks.
- IR v0.1 with work-type-aware validation (`AprismJEMod` / `AprismExtension`),
  preview-only action gating, declaration constraints, and the AWP-IR-000..009
  diagnostic family including verified target profile enforcement.
- Dependency-free JSON Schema validator (`src/schema/validate.js`) supporting
  `type`, `properties`, `required`, `additionalProperties`, `enum`, `const`,
  `pattern`, bounds, and `$ref`/`$defs`; wired into `readAwp` via opt-in
  `configureSchemaPaths`.
- Verified target profile registry (`src/compile/target-profile.js`) with the
  JE 26.2 + Aprism v26.8-Alpha.7 profile.
- `.aep` compile pipeline with SHA-256 lock backfill and read-only
  editor-manifest inspection (1 MiB limit, deflate-bomb protection).
- `.aje` compile pipeline with Java source generation, `javac` integration,
  JAR packaging, `--build` flag, and SHA-256 lock backfill.
- Loopback host bridge with bearer token auth, path-traversal protection, and
  `validate` / `package` / `capabilities` / `status` endpoints.
- `.awe` editor-extension inspector: declarative manifest, blocks, and panel
  parsing with permission-consistency diagnostics; `runtime/` code is reported
  but never executed.
- Cross-format integration tests; suite totals 139 passing tests.

### Security
- Bridge listens on loopback only; bearer token required; archive entry paths
  are sanitised before extraction.
- AEP editor manifests are inspected read-only and never executed.

<!-- GitHub@NDBlockConnect | BlockConnect@StarsailsClover -->
