# The config MCP

## Contents

- Starting it
- Read tools
- Write tools
- The write order
- What a write is refused for
- What a write does not do

## Starting it

`sovrium mcp --project <dir>` serves the config tools over stdio to one MCP client. The `--project` directory is where the config is read from. Read `sovrium docs mcp/mcp-config` and `sovrium docs guides-integrations/connect-desktop-ai`.

The write tools write `.yaml`, `.yml` and `.json` files only: an `app.ts` config is read over MCP but edited as a file.

The write tools appear only when **both** hold: the client's environment sets `MCP_CONFIG_WRITE=1`, and the project directory was named explicitly (`--project`, or an inherited `SOVRIUM_PROJECT_DIR`). Otherwise the session is read-only and says so on stderr. The write tools are never served over HTTP.

Tool names are compiled from the app's `name`: an app named `crm` exposes `crm_config_validate`. Below, `<app>` stands for that name; qualify each tool with its server, `sovrium:<app>_config_validate`.

## Read tools

| Tool                            | Arguments                                           | Returns                                                                                    |
| ------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `sovrium:<app>_config_read`     | none                                                | The config as booted, secrets redacted (`$env.NAME` tokens survive)                        |
| `sovrium:<app>_config_validate` | none                                                | `{ valid, findings, notices }` for the files on disk; an invalid config is a normal result |
| `sovrium:<app>_config_schema`   | `path` optional, dotted (`tables`, `tables.fields`) | The JSON Schema, or the sub-schema at that path                                            |
| `sovrium:<app>_config_status`   | none                                                | What a running instance reports, or `{ "state": "not-running" }`                           |

## Write tools

| Tool                              | Arguments                                                        | Returns                                                                    |
| --------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `sovrium:<app>_config_list_files` | none                                                             | `{ files: [{ path, sha256, bytes }] }` — the root and every `$ref` partial |
| `sovrium:<app>_config_read_file`  | `path`                                                           | `{ path, content, sha256 }` — the whole file, verbatim                     |
| `sovrium:<app>_config_write_file` | `path`, `content`, `expectedSha`, `acknowledgeDataLoss` optional | `{ path, sha256, snapshot, reloadHint }`                                   |
| `sovrium:<app>_config_undo`       | none                                                             | `{ snapshot, files }` — which snapshot was restored and what it changed    |

Both writers are marked destructive, so a careful client asks the person before running them. That is correct; do not try to avoid it.

## The write order

```
- [ ] list_files            → pick the partial that owns the change
- [ ] read_file             → keep content and sha256
- [ ] edit the WHOLE file in memory (content replaces the file; never send a fragment)
- [ ] write_file            → path, content, expectedSha = the sha256 you read
- [ ] validate              → valid: true
- [ ] status                → did the running instance take it?
- [ ] browser + API checks  → as in the core loop
```

One file per write. If two partials must change together, write the one that nothing else depends on first, validate, then the next.

## What a write is refused for

Each refusal names what it refused; act on the message rather than retrying the same call.

| Refusal                                                                 | What to do                                                                            |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Path outside the project                                                | Use a path exactly as `list_files` reported it                                        |
| Not `.yaml`, `.yml` or `.json`, or a symlink                            | An `app.ts` config cannot be written over MCP; edit it as a file                      |
| Protected location (`.env*`, `.git/`, `.claude/`, the data directory)   | Secrets and history are not config; ask the person to edit `.env` themselves          |
| Stale `expectedSha`                                                     | Someone saved the file since you read it; read it again and redo the edit             |
| Would not decode                                                        | The whole app is decoded with your candidate in place; fix the findings               |
| New `$ref` pointing outside the project                                 | Keep partials inside the project directory                                            |
| The live database would refuse the change                               | Read the migration message; the change needs a different shape                        |
| Introduces `allowDestructive: true` without `acknowledgeDataLoss: true` | Ask the person. Dropping a column deletes its data. Never set either flag on your own |
| Inserts a field into a table whose ids are implicit                     | Give every field of that table an explicit `id` first, then insert                    |

## What a write does not do

A write puts bytes on disk. Whether a running instance applied them is a separate question: `sovrium:<app>_config_status` answers it, and the browser pass proves it. `sovrium:<app>_config_undo` restores the file; a running server may still refuse to follow an undo that would drop a column, and says why.
