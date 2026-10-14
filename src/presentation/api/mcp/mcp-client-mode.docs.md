# Client Mode

> The mirror of server mode — your own agents reaching tools hosted on external MCP servers: how the operator names those servers, how an agent picks them, and what the status routes show.

Instead of an outside assistant calling your data, your agents are offered tools published by someone else: a company registry, a CRM, a document store, whatever an external MCP server lists. Sovrium is the caller here, so this direction needs an AI provider on your side: a model has to decide when a tool is worth using.

## Declaring external servers

The servers are operator configuration, never schema: an address and a credential are deployment facts. Each server gets a **name** in the environment, and its credential is keyed by that name.

```bash
MCP_CLIENT_SERVERS="registry=https://registry.example.com/mcp,crm=https://crm.example.com/mcp"

MCP_AUTH_TYPE_REGISTRY=bearer
MCP_AUTH_TOKEN_REGISTRY=reg-service-token

MCP_AUTH_TYPE_CRM=header
MCP_AUTH_HEADER_CRM=X-Api-Key
MCP_AUTH_TOKEN_CRM=crm-api-key
```

| Variable                 | Values                         | Meaning                                                         |
| ------------------------ | ------------------------------ | --------------------------------------------------------------- |
| `MCP_CLIENT_SERVERS`     | Comma-separated `name=url`     | The external servers. Unset means client mode is off            |
| `MCP_CLIENT_TIMEOUT`     | Milliseconds (default `10000`) | The deadline of each request to a server                        |
| `MCP_AUTH_TYPE_{NAME}`   | `bearer`, `header`, `none`     | How to authenticate to the server called `name`. Default `none` |
| `MCP_AUTH_TOKEN_{NAME}`  | A string                       | The service credential for that server                          |
| `MCP_AUTH_HEADER_{NAME}` | A header name                  | The header carrying it, when the type is `header`               |

`{NAME}` is the server name upper-cased, with hyphens turned into underscores: `registry-fr` reads `MCP_AUTH_TOKEN_REGISTRY_FR`. A name is lowercase kebab-case. Because a credential is keyed by name, reordering the list never sends one server's credential to another.

A bare URL entry still works: it is named by its position, `server-1`, `server-2`…, and its variables are `MCP_AUTH_TYPE_SERVER_1` and so on. The older position-only variables (`MCP_AUTH_TOKEN_1`) are refused at boot with the name to use instead, rather than silently ignored.

**The boot refuses a configuration it cannot trust**: a name that is not kebab-case, the same name twice, an address that is not http(s), an unknown auth type, a `bearer` or `header` type with no token, a `header` type with no header name, and an agent naming a server the environment does not declare. Each refusal names the variable to fix and never prints a credential.

There is no per-user sign-in to a server, and end users can never add one: each server is reached with the one service credential the operator holds.

## What happens at startup

The server starts, then opens a session with every declared server in the background over the Streamable HTTP transport: `initialize`, the `notifications/initialized` notification, then `tools/list`. A slow server never delays the boot. A server that could not be reached is tried again on a later read, at most every thirty seconds, so a server that comes up after the boot is picked up without a restart.

Before the first byte is sent, the address is checked:

- **Private addresses are refused.** A loopback, private-network or link-local address is refused, and so is a name that resolves to one. Nothing is sent to it. An instance that legitimately calls a server on its own network sets `SOVRIUM_ALLOW_PRIVATE_OUTBOUND=1`.
- **Redirects are never followed.** A server that answers with a redirect is reported in error; its request is not repeated elsewhere.
- **Only declared servers are dialled.** The client sends nothing to an address the operator did not list.

## Scoping an agent

An agent reaches only the servers it names in `mcp.servers`; an agent that names none is offered no external tool. `mcp.allowedTools` then narrows the tools of those servers.

```yaml
agents:
  - name: research-agent
    role: member
    systemPrompt: You research French companies.
    mcp:
      servers: [registry]
      allowedTools: [lookup_company] # optional
  - name: support-agent
    role: member
    systemPrompt: You answer support questions.
    # no mcp.servers: no external tool at all
```

The model is offered each tool as `<server>__<tool>` — `registry__lookup_company` — with the description and argument schema the server listed, so two servers may list a tool of the same name without colliding. An `allowedTools` entry matches a tool's own name or that qualified form. A name that matches no listed tool is simply not offered: check the real names on the tools route.

Two allowlists are in play and they do not overlap. `tools` scopes what the agent may do **inside** the app — its tables and its actions. `mcp.servers` and `mcp.allowedTools` scope what it may reach **outside**.

## Inspecting what is available

Two read-only endpoints check the wiring without prompting a model. They name your servers, their addresses and their tools, so **only an admin reads them**: with `app.auth`, sign in as an admin and send your session cookie; anyone else, signed in or not, gets the same `404` an unknown route answers. An app without `app.auth` has no admin, so nobody reads them there.

For an admin, both answer `404` with `{ "enabled": false }` when no server is declared, so "disabled" stays distinguishable from "route missing".

```bash
curl --cookie "$SOVRIUM_SESSION" https://your-app.example.com/api/ai/mcp/client/status
```

```json
{
  "enabled": true,
  "servers": [
    {
      "name": "registry",
      "url": "https://registry.example.com/mcp",
      "authType": "bearer",
      "status": "connected",
      "toolCount": 2
    }
  ]
}
```

| `status`      | Meaning                                                                |
| ------------- | ---------------------------------------------------------------------- |
| `connected`   | The session is open; `toolCount` says how many tools the server listed |
| `unavailable` | The server could not be reached; `reason` says why                     |
| `refused`     | The address was refused before anything was sent; `reason` says why    |
| `error`       | The server answered, but not as an MCP server (a redirect, an error)   |

```bash
curl --cookie "$SOVRIUM_SESSION" https://your-app.example.com/api/ai/mcp/client/tools
```

The tools route lists exactly what the connected servers returned from `tools/list`: each tool's server, name, description and argument schema. A server that is not connected lists nothing.

Credentials are never echoed: the status carries the auth _type_ and the header name, never the token, and an error a server sends back is scrubbed of the credential before it is shown.

## Calling an agent

Wherever an agent runs — its chat endpoint (`POST /api/agents/:name/chat`), `POST /api/ai/chat` naming it, an automation's `ai:agent` step, or a scheduled run — the model is offered the external tools that agent may use, and **a tool the model calls is called**: Sovrium sends `tools/call` to the server that listed it, with the model's arguments, and hands the result back to the model before it answers. A server that is unreachable simply offers no tool, and the agent still answers from the model.

A tool's answer comes from a system you do not control, so it reaches the model as quoted data, fenced and labelled as the output of an external tool, never as instructions. A very long answer is cut off, and the cut is marked.

**A tool that may write waits for a person.** Only a tool the server marks read-only (`readOnlyHint: true`) runs at once. Any other — a note added to a CRM, a ticket opened — is held as a pending approval of the agent, named by its qualified name (`crm__add_crm_note`), with the arguments the model chose. The turn stops there and nothing reaches the server. Once someone allowed to decide for that agent approves it, the call runs exactly as the model asked and the agent finishes its turn. A rejected call never runs.

```bash
curl --cookie "$SOVRIUM_SESSION" "https://your-app.example.com/api/agents/sales-agent/approvals?status=pending"
curl --cookie "$SOVRIUM_SESSION" -X POST \
  https://your-app.example.com/api/agents/sales-agent/approvals/<id>/approve
```

The marking is a hint from the server, so the default is to ask: a tool without it is treated as one that writes.

**Every call has a deadline.** A call that outlasts `MCP_CLIENT_TIMEOUT` is abandoned and its connection closed; the model is told the tool timed out and answers anyway. A call is never retried — a tool may write, and sending it twice could write twice. The same goes for a server that fails mid-call: the model reads the failure, and the turn ends with an answer rather than an error.

## When a server asks a question

A server may need a choice it cannot make alone while it runs a tool: three companies share the name the model searched for, and it asks which one. MCP calls this an elicitation (`elicitation/create`, form mode): a sentence and a short form. Sovrium relays it to the person chatting, exactly like the agent's own question to her (`ask_user`).

- **On a streamed chat, with an agent and a signed-in person**, the turn pauses. The stream sends an `elicit` event carrying the server's sentence, its form and `server`, the declared name of the server asking, then ends with `done` and `stopReason: "awaiting_input"`. The chat window shows the questionnaire and says which server is asking.
- **She answers** on the same route as for the agent's own question, `POST /api/ai/chat/elicitations/{elicitationId}`, with `accept` (checked against the form), `decline` or `cancel`. The answer goes to the server as its elicitation result, the tool call finishes with the server's result, and the model reads it and goes on. A `cancel` reaches the server too and the call finishes, but the turn does not go on: it is saved as it stood, its question marked cancelled.
- **Her time is her own.** `MCP_CLIENT_TIMEOUT` bounds each request to the server, not the wait for her answer. A question nobody answers within an hour is answered `cancel` and its connection closed.
- **A form she cannot be shown never reaches her.** Like the agent's own question, a form must be flat — at most twelve string, number, integer or boolean fields. Anything else is answered with the JSON-RPC error `-32602` (invalid params), and the tool call and the turn go on.
- **Where nobody can answer**, the question is answered `cancel` at once and the run goes on: an automation's `ai:agent` step, a scheduled run, and the buffered chat routes, which can draw no form.

The client declares the `elicitation` capability on its handshake, in form mode only, and only when the app has `app.auth`; without it no person could answer, and a server is told not to ask. URL mode is never declared, so no server can send a person to an address through Sovrium.
