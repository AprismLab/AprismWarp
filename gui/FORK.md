# scratch-gui Fork Deviations

Status: baseline, 2026-08-30.

<!-- GitHub@NDBlockConnect | BlockConnect@StarsailsClover -->

This file records every deviation of the AprismWarp scratch-gui fork from
the upstream snapshot, per decision D-10. Upstream baseline:
`upstream/scratch-gui` @ `a2946eeb9a9dca7857d7ab53d766b54288c7a2ff`
(package 3.2.37, GPL-3.0). The fork directory is `gui/scratch-gui`.

## Baseline (G1) - PASSED

G1 gate result (2026-09-05): the unmodified fork builds
(`NODE_OPTIONS=--openssl-legacy-provider npm run build`, webpack 4.47.0)
and boots inside the Electron shell
(`npm --prefix desktop run smoke` reports `gui=true`), with the React
editor shell mounted and zero renderer errors.

| # | Deviation | Reason | Upstream reference |
|---|---|---|---|
| 1 | Vendored source copy without upstream `.git` history | the fork is tracked in the AprismWarp repository as GPL-3.0 source; upstream history stays in `upstream/scratch-gui` (git-ignored) | whole tree |
| 2 | NEW `src/lib/aprismwarp-blocks.js` | the AprismWarp block catalog: block JSON definitions, toolbox XML per work type, workspace→IR v0.1 extraction, and a smoke/automation bridge; every block maps to an IR node per D-03 | new file |
| 3 | `src/lib/tw-load-scratch-blocks-hoc.jsx`: register AprismWarp blocks after `LazyScratchBlocks` resolves (both load paths) | block definitions must exist before workspace creation | lines ~1-40 |
| 4 | `src/lib/make-toolbox-xml.js`: append the AprismWarp category when `window.APRISMWARP_WORK_TYPE` is set | inject the work-type palette without touching VM extension machinery | `makeToolboxXML` tail |
| 5 | `src/playground/editor.jsx`: read `?workType=` from the URL into `window.APRISMWARP_WORK_TYPE` | the Electron shell opens the editor per project work type | entry file |
| 6 | `src/lib/aprismwarp-blocks.js` (G4 extension of row 2): `irToWorkspaceXml` IR→block-XML reconstruction and the `window.AprismWarpBlocks.saveProject/loadProject` page API over `bridgeRequest` IPC | persistence flows through the bridge store endpoints with the token kept in the main process; native menu items in `desktop/main.js` call these APIs via `executeJavaScript`, so no upstream menu code changes | same file |
| 7 | `src/lib/aprismwarp-blocks.js` (G5 extension of row 2): `wait`/`set-variable`/`compare` block definitions and the `previewIr` preview interpreter with variable-resolving `compare` semantics | preview-only actions must be interpretable in the renderer with parity to `validateIr(mode: preview)`; the interpreter grammar mirrors AWP-IR-031/032 enforcement | same file |

### G1 known caveats

- `build/editor.html` carries no CSP meta; the Electron window runs with
  Chromium defaults. CSP hardening is required before G2 (tracked here).
- Routing style falls back from `filehash` to `hash` under `file://`
  (benign console warning).
- Upstream React 16 lifecycle deprecation warnings are visible at boot;
  documented as the React-age risk in `docs/gui-integration.md` §6.
- The build output (`gui/scratch-gui/build/`) and `node_modules/` are
  git-ignored; rebuild with the command above after checkout.

## Pending (G2+)

Planned deviations, none applied yet:

- Entry point swap: remove scratch-vm bindings, route persistence through
  the host bridge (`projects/create|open|save`).
- `.awp` persistence replaces `.sb3` download/upload paths.
- AprismWarp block catalog replaces the extension registry palette source.

G2 note (2026-09-05): the wizard screen and the project-create flow live on
the Electron side (`desktop/renderer/wizard.*`, `desktop/main.js`), so the
fork source remains unmodified after G2.

## Rule

Any future change must add one row here with a reason and the upstream
file it modifies. Changes without a FORK.md row fail review.

GitHub@NDBlockConnect | BlockConnect@StarsailsClover
