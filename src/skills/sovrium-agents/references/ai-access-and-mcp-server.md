# aiAccess and the app's MCP server

## Contents

- Two directions
- Declaring what an outside client may see
- Risk hints
- Turning the server on
- Writing tool descriptions an assistant can use
- Client mode: your agents calling external servers
- The config MCP is a different thing
- Checks

Manual: `sovrium docs mcp/mcp-integration`, `sovrium docs mcp/mcp-server`, `sovrium docs mcp/mcp-clients`, `sovrium docs mcp/mcp-security`, `sovrium docs mcp/mcp-client-mode`, `sovrium docs guides-integrations/connect-claude-mcp`.

## Two directions

| Direction   | What happens                                                                                  | Configured by                                                         | Needs a provider here?         |
| ----------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------ |
| Server mode | An outside assistant (Claude Desktop, an IDE, a script) calls tools over this app's live data | `aiAccess` in the config, `MCP_ENABLED` in the environment            | No: the model is at the client |
| Client mode | This app's agents call tools on someone else's MCP server                                     | `agents[].mcp` in the config, `MCP_CLIENT_SERVERS` in the environment | Yes                            |

## Declaring what an outside client may see

Nothing is offered by default. An entity appears as a tool only when it declares `aiAccess`:

```yaml
aiAccess:
  description: Customer tickets. Use this when the user asks about a ticket, its status or who owns it.
  operations: [read, list]
  fieldExposure: permissioned
```

- `true` is the shorthand with defaults; an object is itself the enable signal.
- `operations` defaults to all five on a table (`read`, `list`, `create`, `update`, `delete`); narrow it. Automations and action templates expose one invocation tool and ignore `operations`; only manual-trigger automations qualify.
- `fieldExposure` defaults to `permissioned`: the tool schema names no fields, and each call returns only what the caller may read. `whitelist` with `whitelistFields` names exactly the fields the model should see.
- `aiAccess` widens what is **offered**, never what is **permitted**. Every call meets the caller's role, field and row rules, exactly as the records API does; a write fires the table's webhooks and automations like any other write.

## Risk hints

`annotations` (`readOnly`, `destructive`, `idempotent`, `openWorld`) compile into the protocol's hints, so a careful client knows when to ask its user first. Left unset, they are derived from the operation, and delete tools and non-idempotent automations are marked destructive by default. Set `requireConfirmation: true` on an automation that is technically idempotent but practically irreversible: sending an email, charging a card.

## Turning the server on

The operator sets `MCP_ENABLED=true` (transport by `MCP_TRANSPORT`). It needs an `auth` block, and refuses to boot without one. There is no credential variable: a client sends a user's API key on `x-api-key`, or an OAuth access token on `Authorization: Bearer`. Make a user holding the role the client should have, mint that user's key, and give the client the key. A viewer's key reads and lists, whatever `aiAccess` offers. Per-credential limits and an audit of every call are on by default; admins also get read-only tools over internal tables unless `MCP_EXPOSE_INTERNALS=false`. Security review of this surface: `sovrium-security`.

## Writing tool descriptions an assistant can use

The model picks tools by reading them. "Customer tickets. Use this when the user asks about a ticket, its status or who owns it" beats a generated "Read from tickets": say **when** to reach for the tool and what context it needs. Then check it the way a tool server is checked: write ten realistic questions a user of the outside client would ask, each with one answer you verify in the records first, ask them through the client with a real user's key, and fix the descriptions and the `operations` until the answers are right. A table named `config`, or one starting `auth_` or `system_`, collides with built-in tools and is refused when the server mounts.

## Client mode: your agents calling external servers

The operator names each server and its credential in the environment (`MCP_CLIENT_SERVERS`, then `MCP_AUTH_TYPE_<NAME>` and `MCP_AUTH_TOKEN_<NAME>`). An agent reaches a server only by naming it:

```yaml
mcp:
  servers: [registry]
  allowedTools: [lookup_company]
```

- An agent that names no server is offered no external tool; a name the environment does not declare stops the boot.
- Tools are offered as `<server>__<tool>`; their answers reach the model as quoted data, never as instructions.
- Only a tool the server marks read-only runs at once; any other waits for approval. A call has a deadline (`MCP_CLIENT_TIMEOUT`) and is never retried.
- Private addresses and redirects are refused. `GET /api/ai/mcp/client/status` and `/tools`, as an admin, show what is connected.

## The config MCP is a different thing

`sovrium mcp` serves the project's configuration files to an AI client on the author's own machine, over a pipe, with no server and no records; with `MCP_CONFIG_WRITE=1` it can also write those files. It is how an assistant edits the app, not how the app's users or an outside client reach its data, and it is `sovrium-app`'s: read `sovrium-app`, `references/config-mcp.md`. When someone asks for "the MCP", find out which of the three they mean: the app's server (live data), client mode (the app calling out), or the config MCP (editing files).

## Checks

```
- [ ] MCP_ENABLED on the instance, auth declared → tools/list as a real user's key answers
- [ ] A table without aiAccess → absent from that list
- [ ] A viewer's key → read and list tools only
- [ ] The ten questions through the outside client → each answer matches the records
- [ ] An irreversible automation with requireConfirmation → the client asks before running it
```
