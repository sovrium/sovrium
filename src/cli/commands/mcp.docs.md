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

These four are read-only, and they are all a session offers until you say otherwise: `MCP_CONFIG_WRITE=1` adds four tools that edit the config file, described in **Letting Your AI Edit the Config**. The same session also offers Sovrium's agent skills as prompts, described below.

## The skills, as prompts

The same session offers Sovrium's agent skills as MCP **prompts**, one per skill: `sovrium-app`, `sovrium-data-model`, `sovrium-pages`, `sovrium-automations` and `sovrium-seo-geo`. A client lists them in its prompt menu; picking one adds that skill's `SKILL.md` text to the conversation, without its frontmatter.

This is the path for a client with no shell and no project skill folder, which is Claude Desktop. A client that can run commands gets the fuller version by running `sovrium skills` in the project, which also writes each skill's `references/` — a prompt carries the `SKILL.md` alone. See **Agent Skills**.

The prompts read no configuration and write nothing, so they answer with writing switched off, and even in a folder that holds no config yet. They are offered over this pipe only: a deployed app's MCP endpoint serves no prompts.

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

A deployed app running the MCP server serves these same four tools on its endpoint, where there **is** a session to check — so they are reserved there to **admin-equivalent roles** — the built-in `admin` and the app's highest role — and filtered out of the tool list for every other role. The local path on this page has no session, and none is invented. The endpoint serves neither the write tools nor the skill prompts: both belong to this pipe.
