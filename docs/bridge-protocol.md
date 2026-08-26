# AprismWarp Host Bridge Protocol

This is a draft local protocol. It is not a public API and must not be treated as implemented until a schema validator and integration tests exist.

## Transport

- Bind: `127.0.0.1` only.
- Encoding: UTF-8 JSON over HTTP initially; WebSocket may be added for event streams.
- Session: bridge creates a short-lived token; GUI sends it in an authorization header.
- Discovery: GUI calls `GET /api/v1/capabilities` before displaying controls.

## Capability Shape

```json
{
  "schema": "aprismwarp.bridge/v1",
  "bridgeVersion": "0.1.0",
  "capabilities": {
    "aprism": {"discover": true, "pull": false, "install": false},
    "mdl": {"create": false, "launch": false, "logs": false},
    "despotes": {"status": false, "screenshot": false},
    "compiler": {"validate": false, "packageAje": false}
  }
}
```

The client must hide unsupported actions. A capability flag is not permission to accept arbitrary arguments; every endpoint still validates its request.

## Initial Commands

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v1/capabilities` | Discover bridge features and versions |
| POST | `/api/v1/aprism/discover` | List locally cached Aprism artifacts |
| POST | `/api/v1/aprism/pull` | Pull one allowlisted release after confirmation |
| POST | `/api/v1/projects/validate` | Validate graphical IR without launching Minecraft |
| POST | `/api/v1/projects/package` | Produce `.aje` under an artifact directory |
| POST | `/api/v1/instances` | Create an isolated MDL instance from a profile |
| POST | `/api/v1/instances/{id}/launch` | Launch with Aprism and requested agents |
| GET | `/api/v1/instances/{id}/logs` | Read bounded, redacted logs |
| POST | `/api/v1/instances/{id}/screenshot` | Capture an in-game screenshot |
| POST | `/api/v1/instances/{id}/stop` | Stop an instance gracefully |

## Error Envelope

```json
{
  "schema": "aprismwarp.bridge-error/v1",
  "code": "UNSUPPORTED_CAPABILITY",
  "message": "The selected bridge does not provide mdl.launch",
  "retryable": false,
  "details": {}
}
```

Error messages must not include access tokens, full account paths, or unredacted process arguments.

## Security Requirements

1. Reject non-loopback bind configuration in the first release.
2. Reject path traversal and paths outside configured project/artifact roots.
3. Do not expose a generic shell, Java command, or arbitrary executable endpoint.
4. Require an explicit confirmation for network downloads and instance deletion.
5. Keep generated artifacts separate from active MDL instance directories.
6. Store no Microsoft credentials in project files or Scratch project JSON.

## Pending Decisions

- [T] Token handshake mechanism and CSRF/origin policy.
- [T] Whether to expose MDL HTTP agent directly or only through the bridge adapter.
- [T] Event stream transport and backpressure limits.
- [T] Artifact signing and verification policy for Aprism releases.

<!-- GitHub@NDBlockConnect | BlockConnect@StarsailsClover -->
