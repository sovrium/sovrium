# Connect your AI to a project

> Point the assistant you already use at a project folder, so that it reads your configuration and its verdict instead of guessing from the bytes.

You want Claude Code, Claude Desktop or Cursor to help you edit a local Sovrium project. Nothing is deployed, there is no server to stand up, and there is no key to mint.

This is the **local** path. To let an assistant read and act on a deployed app's **data** over HTTP, see **Connect an AI client over MCP** instead — that one needs an auth block and an API key, and exposes an entirely different set of tools.

## What the assistant gets

Your assistant runs the Sovrium binary on your machine and talks to it over a pipe. Four read-only tools come back:

- **Read your configuration**, with any declared secret replaced by a placeholder.
- **Check it**, and get back exactly what Sovrium objected to.
- **Look up what a setting accepts**, so it writes something valid the first time.
- **See whether your app is running**, and whether the last save was applied.

Those four are reads, and they are all you get until you decide otherwise. The assistant can still change your app by editing the configuration file in the folder the way it edits any other file — Sovrium notices the save and reloads on its own. What the next step adds is letting it do that **through the connection**, where Sovrium gets to check the edit first.

## Point it at the folder

You need the project folder's path and one line of client configuration. **Claude Code** takes it as a command:

```bash
claude mcp add sovrium -- sovrium mcp --project ~/apps/crm
```

The `--` is required: everything after it is the server command, passed through untouched. Add `--scope project` to write the entry into a shared `.mcp.json` at the project root instead of your own settings.

**Claude Desktop** and **Cursor** take the same thing as a block — in `claude_desktop_config.json` for the first, and `.cursor/mcp.json` (or `~/.cursor/mcp.json`) for the second:

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

Restart the client afterwards. Always name the directory: with none, the process reads the working directory, and when a client spawned it that is the client's choice rather than yours.

**Using the Sovrium app?** Its **Connect your AI** screen shows the same snippet with your project's real path filled in, and a button that copies it. It is the same command — the screen exists so nobody has to type a path by hand.

## Turn writing on

Optional, and off until you do it. Add one environment variable to the block you just wrote:

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

Restart the client. The assistant can now list the files your config is made of, read one, replace one, and undo its last change — and it has to name the folder explicitly, which the block above already does; a session that fell back to the working directory gets the reads only.

Writing is bounded rather than trusted, and you do not configure any of it. Edits stay inside the folder and touch only `.yaml`, `.yml` and `.json` files, never your `.env`, `.git/` or Sovrium's own data directory. A file that changed on disk since the assistant read it is refused rather than overwritten, so a save you made in your own editor cannot be lost to one it was still thinking about. An edit that would not decode as a valid config never reaches the disk. Dropping a column needs your explicit agreement, which the assistant cannot give on your behalf. And every change is snapshotted first, so there is always a way back.

**Your Config over MCP** lists the four tools and every reason a write is refused.

## Verify it

Ask the assistant what tables your app declares. It calls the read tool and answers from your actual configuration.

By hand, the server is a pipe, so `printf` is enough:

```bash
printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"probe","version":"0"}}}\n' \
  | sovrium mcp --project ~/apps/crm
```

The handshake comes back on stdout; the line naming the config file it found is on stderr. That separation is the contract — redirect stderr away and stdout is valid JSON-RPC and nothing else.

## If it does not connect

- **No tools in the client.** The tools are named for your app, so a config whose `name` is `crm` gets `crm_config_read` and three siblings. An empty list means the client never started the process — check the command is on the client's PATH.
- **A missing-config finding instead of your config.** The process is running and pointed at a folder with no `app.yaml`, `app.yml` or `app.ts` in it. The finding names the flag to fix it.
- **The client reports a protocol failure.** The server answers both protocol revisions and decides from the opening message, so this is not something to configure. An older engine that does not answer the command at all is the likelier cause.

## Next

- **Your Config over MCP** — every tool, what each returns, and the resolution order.
- **The Sovrium App** — the window, and where a project lives.
- **Validation & Schema** — the same findings from the command line.
