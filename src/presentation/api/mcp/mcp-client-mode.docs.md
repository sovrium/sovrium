# Client Mode

> The mirror of server mode — your own agents calling tools hosted elsewhere, the positional environment variables that declare those servers, and the two allowlists that do not overlap.

Instead of an outside assistant calling your data, your agents call tools published by someone else: web search, document fetch, whatever an external MCP server offers. Unlike server mode, this direction **requires an AI provider**: Sovrium is the caller here, so a model has to run on your side to decide when a tool is worth invoking.

## Declaring external servers

The servers are operator configuration rather than schema — a URL and a credential are deployment facts. The server list is comma-separated, and each entry's auth is configured by its **1-based position** in that list.

```bash
MCP_CLIENT_SERVERS=https://search.example.com/mcp,https://docs.example.com/mcp

MCP_AUTH_TYPE_1=bearer
MCP_AUTH_TOKEN_1=sk-...

MCP_AUTH_TYPE_2=header
MCP_AUTH_HEADER_2=X-Api-Key
MCP_AUTH_TOKEN_2=...
```

| Variable              | Values                     | Meaning                                               |
| --------------------- | -------------------------- | ----------------------------------------------------- |
| `MCP_CLIENT_SERVERS`  | Comma-separated URLs       | The external servers. Unset means client mode is off  |
| `MCP_AUTH_TYPE_{N}`   | `bearer`, `header`, `none` | How to authenticate to server _N_. Defaults to `none` |
| `MCP_AUTH_TOKEN_{N}`  | A string                   | The secret sent to server _N_                         |
| `MCP_AUTH_HEADER_{N}` | A header name              | Which header carries it, when the type is `header`    |

**The index is positional, so reordering the list re-points your secrets.** Inserting a server at the front shifts every subsequent suffix by one and silently sends the first server's token to a different origin — a credential leak produced by an edit that looks like a reordering. Append rather than insert, and re-check the numbering whenever the list changes.

## Scoping an agent

An agent's `mcp` block is an allowlist over the discovered tool catalogue. It answers "which of these may _this_ agent use", not "which servers exist".

```yaml
agents:
  - name: research-agent
    role: analyst
    systemPrompt: Research topics using approved external tools. Always cite sources.
    tools:
      tables: [findings]
      actions: [record.create, record.read, record.list]
    mcp:
      allowedTools: [web-search]
```

Two allowlists are now in play and they do not overlap. `tools` scopes what the agent may do **inside** the app — its tables and its actions. `mcp.allowedTools` scopes what it may reach **outside**. An agent can be read-only internally and still search the web, or the reverse. Omitting `allowedTools` grants the whole discovered catalogue.

The internal read is itself two actions: one fetches a single record by id, the other returns a filtered set. The agent above holds both so it can re-read the findings it has written; one that only ever looks records up by id needs the first alone.

**An unrecognised tool name is dropped, not refused.** The allowlist is filtered against the discovered catalogue, so a typo — an underscore where a hyphen belongs — yields an agent with no external tools rather than a validation error, and the agent then answers in plain text as though it had simply chosen not to search. Confirm the real names against the tools endpoint before trusting an allowlist.

## Inspecting what is available

Two read-only endpoints check the wiring without prompting a model. Both answer `404` with `{ "enabled": false }` when no servers are configured, so "disabled" stays distinguishable from "route missing".

```bash
curl https://your-app.example.com/api/ai/mcp/client/status
```

```json
{
  "enabled": true,
  "servers": [
    { "url": "https://search.example.com/mcp", "authType": "bearer", "status": "connecting" }
  ]
}
```

Tokens are never echoed back: the summary carries the URL, the auth _type_ and the header name, and nothing secret.

```bash
curl https://your-app.example.com/api/ai/mcp/client/tools
```

The catalogue seeds with `web-search` and `document-fetch`, and real discovery supersedes the seed once a configured server is reachable. Those seed names are what an allowlist entry must match until then.

## Calling an agent

Posting a message to an agent's chat endpoint forwards it to the provider along with that agent's filtered tool catalogue, and answers with a reply envelope.

The runtime is deliberately tolerant: if an external server is unreachable or a tool call fails, the model still answers in text rather than the request erroring out. An agent depending on a flaky server degrades to a worse answer rather than to a `500` — which is the right trade for a chat surface, and the reason a silently empty allowlist is hard to notice.
