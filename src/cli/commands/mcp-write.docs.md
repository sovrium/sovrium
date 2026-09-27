# Letting Your AI Edit the Config

> Switch on four more `sovrium mcp` tools and the AI client you already use can read, replace and undo the files your config is made of — inside one folder, one whole file at a time, and never into an invalid config.

Set `MCP_CONFIG_WRITE=1` and four more tools appear, able to change the config file itself. It is off by default, and it is an **environment variable rather than a config key** on purpose: a config that could authorise its own editing would be a config that authorises itself.

It is honoured only when **both** hold — the variable is set, **and** the project directory was named explicitly, by `--project` or an inherited `SOVRIUM_PROJECT_DIR`. A session that fell back to the working directory gets the reads only and says so on stderr. A write surface confines itself to one folder, so the folder has to be one somebody chose on purpose rather than one a client happened to start in.

```json
{
  "mcpServers": {
    "sovrium": {
      "command": "sovrium",
      "args": ["mcp", "--project", "/Users/me/apps/crm"],
      "env": { "MCP_CONFIG_WRITE": "1" }
    }
  }
}
```

**On a deployed app the variable does nothing.** The write tools are stdio-only and are never registered on an HTTP endpoint. Setting it there is not an error — the instance boots and serves normally — but the boot warns that it bought you nothing and names this verb instead, because an operator who believes they enabled config writes over the network has not.

| Tool                 | Arguments                                                        | Returns                                                            |
| -------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------ |
| `_config_list_files` | none                                                             | `{ files: [{ path, sha256, bytes }] }`, each path project-relative |
| `_config_read_file`  | `path`                                                           | `{ path, content, sha256 }` — the bytes, verbatim                  |
| `_config_write_file` | `path`, `content`, `expectedSha`, `acknowledgeDataLoss` optional | `{ path, sha256, snapshot, reloadHint }`                           |
| `_config_undo`       | none                                                             | `{ snapshot, files }` — which snapshot, and what it changed        |

The two readers carry `readOnlyHint`. **Both writers are marked destructive**, so a client that asks you before running a destructive tool will ask — overwriting a file is a destructive update of that file whatever the tool then refuses to do to a table, and undo overwrites several at once.

**Whole file bytes, never a patch.** There is no config writer here and no serialiser: `content` replaces the file, so your comments, key order, anchors and blank lines survive an edit untouched. The cost is that the caller must read before it writes, and `expectedSha` is what makes that cost real rather than advisory.

## What a write is refused for

Every write runs the same ordered checks, and each refusal names what it refused. The cheap structural ones come first, and the ones that open a database come last.

- **Outside the project.** The path is resolved against the project directory and must land inside it.
- **Not a config file.** `.yaml`, `.yml` and `.json` only, and never a symlink — a symlink can point anywhere, including out of the folder.
- **A protected location.** `.env` and friends, `.git/`, `.claude/`, the data directory, and the template marker. A tool that can write `.env` is a credential-writing tool; one that can write `.git/` rewrites history.
- **A stale `expectedSha`.** The digest you edited against no longer matches the file, so something else saved over it — very possibly you, in your own editor. The refusal says to re-read, because an assistant told only "no" retries the identical call forever.
- **It would not decode.** The candidate is overlaid in memory onto the resolved `$ref` graph and the **whole app** is decoded before anything is written. An invalid config never reaches the disk; the findings come back instead, in the vocabulary `_config_validate` already speaks. This is what makes editing one split-out partial safe — it is judged as part of the app it belongs to rather than as a document that happens to parse.
- **A new reference out of the folder.** A candidate that introduces a `$ref` resolving outside the project directory is refused, or the file being **read** could walk out of the folder the file being written may not leave.
- **The live database would reject it.** Where a server is running, the change is put through the same migration planner `sovrium migrate --dry-run` reports from, and a refusal there is the write's refusal — **before** the file changes rather than after the server has stopped trying to apply it.
- **It drops data.** A candidate that introduces `allowDestructive: true` needs `acknowledgeDataLoss: true` alongside it, and the tool never sets either flag for itself. Dropping a column deletes the rows in it, and that is your decision every time.
- **It would renumber a table.** A field `id` is optional, and an omitted one is the field's **position**. Inserting a field above one of those shifts every id after it and re-points the data behind them, so the insert is refused until the table's ids are explicit. The same insert into a table that spells every id out is accepted, because nothing moves.

## Going back

An accepted write copies the **pre-write** state into the history described in **Undo and Reset** before it changes a byte, so `_config_undo` has somewhere to go even when no server is running and nothing has ever reached "accepted". It skips the copy when the newest entry already holds those exact bytes, which is why a watched project ends up with one entry before the edit and one after rather than three.

`_config_undo` restores **the most recent snapshot whose files differ from what is on disk**, and answers with the files it changed. When none differs there is nothing to go back to, and it refuses rather than reporting a success that changed nothing.

Undo puts the **file** back unconditionally. Whether a running instance follows it is a separate question: reverting a field you added is a column **drop**, so the watcher's own pre-flight refuses that reload without `allowDestructive`, keeps the configuration it is already serving, and publishes the reason. Your app stays up and your rows stay where they are.

**A write does not make anything live.** It puts bytes on disk; `_config_status` is how you find out whether an instance took them. Calls are answered one at a time, in the order you sent them, so a write followed by an undo happens in that order.

The four read tools, how a client is pointed at the server and which config it reads are in **Your Config over MCP**.
