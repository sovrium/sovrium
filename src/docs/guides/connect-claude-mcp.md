# Connect an AI client over MCP

> Expose a Sovrium app as an MCP server and connect an AI client — enable the endpoint, mint an API key, and add an `mcpServers` entry.

You want an MCP client to read and act on a Sovrium app's tables, automations and actions — securely, over the Model Context Protocol.

This is the **deployed** path: an app on a host, reached over HTTP, with a credential. For an assistant that helps you edit a project on your own machine, see **Connect your AI to a project** — no server, no key, and a different set of tools.

## Enable the MCP server

It is off by default, and it needs an `auth` block — every MCP credential is issued by the auth layer, so the boot refuses without one. Enable self-service keys while you are there:

```yaml
name: my-app
auth:
  strategies:
    - type: emailAndPassword
  apiKeys: true
```

Then turn the server on. There is no credential variable to set:

```bash
export MCP_ENABLED=true
export MCP_TRANSPORT=streamable-http
sovrium start app.yaml
```

The server mounts one JSON-RPC endpoint at `/mcp`.

## Mint a key

Sign in as the user whose role the client should inherit and mint an API key. The key acts as **that user**, resolved live on every call — so access control follows the person, not the credential. Want a read-only client? Give the key's owner the `viewer` role; demote them later and the same key narrows with them.

## Point the client at it

Add an entry to your client's `mcpServers` configuration. The key goes in an **`x-api-key`** header — not `Authorization: Bearer`, which is verified as an OAuth access token, so an API key placed there is rejected with `401`:

```json
{
  "mcpServers": {
    "my-app": {
      "url": "https://your-app.example.com/mcp",
      "transport": "http",
      "headers": { "x-api-key": "<your-api-key>" }
    }
  }
}
```

## Verify

Ask the client to list your app's tables — it calls the MCP tools and returns live data.

## Next

- **MCP Integration** — every credential, transport and tool the server exposes.
- **Auth, Roles & RBAC** — the roles a key's owner can hold.
