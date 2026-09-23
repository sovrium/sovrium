# Your Config over MCP

> `sovrium mcp` hands a project's configuration to the AI client you already use — over a pipe, with no server and no credentials. Reading by default; writing when you switch it on.

```text
Usage: sovrium mcp [--project <dir>]
```

The point is that the model editing your config can see what the file **means** rather than guessing from the bytes.

```bash
sovrium mcp --project ~/apps/crm
```

That is the whole setup. There is no server to stand up, no `auth:` block to write, and no key to mint.

**This is not server mode.** That one exposes your **data** — tables, automations, actions — over HTTP, to an authenticated client. This one exposes your **config**, over a pipe, to a process you launched yourself. The two are separate surfaces and neither implies the other. **Server Mode** covers the first.

## What runs, and what does not

The verb is a short-lived process. It boots no server, writes no lock file and binds no port: it reads a config file, answers newline-delimited JSON-RPC on stdin, and exits when stdin closes.

It opens no database either — unless writing is switched on and an instance is running, in which case a write asks that database what the change would cost, read-only, before touching the file.

Because stdout carries MCP messages and nothing else, every banner, notice and error goes to **stderr** instead — including the line telling you which config file it found.

**`MCP_TRANSPORT=stdio` is not this, and never was.** That variable only suppresses the HTTP mount; nothing on the `sovrium start` path reads stdin. If you configured an IDE against it you got a process that answers nothing. The stdio entry point is this verb — reached by running the binary, not by setting a variable. `MCP_TRANSPORT=stdio` still un-mounts, which is a thing an operator legitimately wants; it is simply not a way to serve anything.

## There are no credentials, and none to configure

The process was spawned by you, runs as you, and reads a directory you named, so the operating system's process boundary is the whole of the authentication. Putting a token on a pipe between two processes of the same user would be ceremony rather than security.

Two consequences follow, and both are worth knowing before you go looking for a setting that does not exist:

- **A config with no `auth:` block works.** No authentication instance is ever constructed.
- **`MCP_ENABLED` is irrelevant here.** The combination that makes `sovrium start` refuse to boot — `MCP_ENABLED=true` with no auth block — does not affect this verb at all.

## Pointing a client at it

Every client reads the same two values: the command to run, and its arguments.

**Claude Code** takes it on the command line. The `--` is required: everything after it is the server command, passed through untouched. Add `--scope project` to write the entry into a shared `.mcp.json` at your project root instead of your own local settings.

```bash
claude mcp add sovrium -- sovrium mcp --project ~/apps/crm
```

The file form is the same block by hand:

```json
{
  "mcpServers": {
    "sovrium": {
      "command": "sovrium",
      "args": ["mcp", "--project", "/Users/me/apps/crm"]
    }
  }
}
```

**Claude Desktop** takes that same `mcpServers` entry in `claude_desktop_config.json`; restart the app afterwards. **Cursor** takes it in `.cursor/mcp.json` for one project, or `~/.cursor/mcp.json` for every project.

**The server speaks both protocol revisions, and you do not configure which.** The opening message decides: a client that opens with `initialize` gets the older era for the life of the process, and one that opens with a `2026-07-28` envelope gets that. This matters because Claude Code connects stdio servers on the older runtime by default — a server that spoke only the newer revision would fail against a default install.

## Which config it reads

The directory is resolved most specific first:

1. `--project <dir>`
2. `SOVRIUM_PROJECT_DIR`
3. The working directory — which, when a client spawned the process, is the client's choice rather than yours. Name the directory explicitly.

Inside it the config file is found exactly as `sovrium start` finds it: `SOVRIUM_CONFIG_FILE` when set, otherwise the first of `app.yaml`, `app.yml`, `app.ts`.

A directory holding no config is not a crash. The handshake and the tool list still answer, and each tool returns the missing-config finding as an ordinary result — so an assistant pointed at the wrong folder is told so in something it is already reading:

```json
{
  "valid": false,
  "findings": [
    {
      "path": "",
      "message": "No config file found. `sovrium mcp` reads app.yaml, app.yml or app.ts from the project directory — pass --project <dir> to point it at the right one.",
      "severity": "error"
    }
  ],
  "notices": []
}
```

## The four tools

Tools are named for your app, so an `app.yaml` whose `name` is `crm` gets `crm_config_read` and its three siblings. All four are reads, and all four say so — they carry `readOnlyHint`, so a client may run them without stopping to ask.

| Tool               | Arguments       | Returns                                                                                |
| ------------------ | --------------- | -------------------------------------------------------------------------------------- |
| `_config_read`     | none            | `{ config, files, configHash }` — the config as booted, with declared secrets redacted |
| `_config_validate` | none            | `{ valid, findings, notices }` — in `sovrium validate --json`'s vocabulary             |
| `_config_schema`   | `path` optional | The Draft 2020-12 JSON Schema, or the sub-schema at a dotted config path               |
| `_config_status`   | none            | The status document a running instance publishes, or `{ "state": "not-running" }`      |

**`_config_read` redacts.** It serialises through the same redactor behind the operator console's configuration view, so a hardcoded secret comes back as a placeholder with the structure around it intact. A `$env.X` token **survives** — a variable name is not a credential, and it is exactly what tells you which variable feeds the field.

**`_config_validate` reads the disk, not the running instance.** That is the point of it: an assistant that has just rewritten `config/tables/contacts.yaml` needs the verdict on what it wrote. An invalid config is a normal result here, not a tool error.

**It hands back the shape, never your config's values.** A finding carries the position, the complaint and what belongs there — plus the rejected value only where that value is a name checked against a closed list, like an unknown component `type` or a misspelled property key. Everything else is dropped. An `env:` block written as a mapping is what an assistant writes when it is pattern-matching on a `.env` file, and `_config_validate` is the tool it calls straight afterwards; the credential in it does not enter the transcript. `_config_write_file` refuses with the same findings and the same rule.

**`_config_schema` takes a dotted config path**, not a JSON pointer — `tables.fields`, not `/properties/tables/items/properties/fields`. The dotted form is the vocabulary you already write in your config. A path that does not resolve is refused with a message naming the keys that **are** available at the last segment that did.

**`_config_status` is a file read.** It reports the status file a running server publishes about itself, described in **Lifecycle Commands**, and answers `{ "state": "not-running" }` when there is none. `SOVRIUM_LOCK_DIR` is where it looks.

These four are read-only, and they are all a session offers until you say otherwise.

## Letting it write

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

## Checking it by hand

The server is a pipe, so you can drive it with `printf`. Send an opening message and read the reply:

```bash
printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"probe","version":"0"}}}\n' \
  | sovrium mcp --project ~/apps/crm
```

```text
[mcp] Using app.yaml (auto-discovered)
{"result":{"protocolVersion":"2025-06-18","capabilities":{"tools":{"listChanged":false}},"serverInfo":{"name":"sovrium","version":"<this binary's version>"}},"jsonrpc":"2.0","id":1}
```

The first line is on **stderr** and the second on stdout. That separation is the contract: redirect stderr away and stdout is valid JSON-RPC and nothing else. Add more messages, one per line, to go further — they are answered in the same session.

A method the server does not serve is answered with JSON-RPC error `-32601` rather than by closing the pipe, so a client probing for a feature Sovrium does not offer stays connected.

## The same four tools on HTTP

A deployed app running the MCP server serves these same four tools on its endpoint, where there **is** a session to check — so they are **admin-only** there, filtered out of the tool list for every other role. The local path on this page has no session, and none is invented.
