# Connecting a Client

> Pointing an assistant at a deployed app over HTTP — the configuration block every client shares, which header carries which credential, and the one request that proves the connection is really filtered.

Once the server is enabled the app serves one JSON-RPC endpoint at the configured mount path. Any MCP-capable client can speak to it.

## The generic configuration

Desktop assistants, IDEs and coding agents all read some form of an `mcpServers` block:

```json
{
  "mcpServers": {
    "sovrium": {
      "url": "https://your-app.example.com/mcp",
      "transport": "http"
    }
  }
}
```

Where that block lives differs per client — a settings file, a project config, a panel in the interface — but the two values it needs are always the URL and the transport.

## Authenticating

There is no mode to pick. The header you send decides which verifier runs, and both are live at once.

**An API key** is the simplest option for a script or a CI job. Sign in as the user whose role the client should inherit, mint a key, and send it on `x-api-key`. The key acts as **its owner**, so demoting or banning that user takes effect on the next call with nothing to re-issue.

```text
x-api-key: <your-api-key>
```

**An API key on `Authorization: Bearer` authenticates nothing.** That header is the OAuth path, and a key sent there is not a valid access token, so it answers `401`. When a request that should work is refused, check the header name before checking the key.

**OAuth** suits a client that can run a browser sign-in. Register it once by dynamic client registration, then run the ordinary authorization-code flow. Registration needs a session, so run it signed in as an admin with your login cookie:

```bash
curl -X POST 'https://your-app.example.com/api/auth/oauth2/register' \
  --header 'Content-Type: application/json' \
  --cookie "$SOVRIUM_SESSION" \
  --data '{
    "client_name": "Sovrium MCP",
    "redirect_uris": ["https://your-app.example.com/oauth/callback"],
    "grant_types": ["authorization_code", "refresh_token"],
    "token_endpoint_auth_method": "client_secret_post"
  }'
```

**Clients that register themselves cannot use that cookie**, because they register before any browser session exists. Setting `SOVRIUM_OAUTH_ANONYMOUS_CLIENT_REGISTRATION=true` lets them: registration then accepts any caller, capped at 20 per minute per IP. It is off by default because registration writes a `client_name` of the caller's choosing — a client that registers itself is marked unverified on the consent screen, which leads with the registered redirect origin rather than the name it chose for itself.

A call carrying no credential answers `401` with a `WWW-Authenticate: Bearer` discovery header, so a compliant client can start the flow without being told how.

## A local IDE over stdio

**`MCP_TRANSPORT=stdio` does not serve anything over stdin.** It only suppresses the HTTP mount — nothing on the `sovrium start` path reads stdin, so a client configured to launch `sovrium start` with that variable gets a child process that never answers. Un-mounting the route is a legitimate thing to want; serving a local client is not what this value does.

The stdio entry point is its own command, `sovrium mcp`, reached by running the binary rather than by setting a variable:

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

It serves a **different tool set** from everything above: four read-only config tools, not your tables and automations. It needs no credential, because the process boundary is the authentication. The data tools on this page are HTTP-only. **Your Config over MCP** covers that path.

## Verifying the connection

Do not trust the client's green dot. The smallest useful check is a tool listing:

```bash
curl -X POST 'https://your-app.example.com/mcp' \
  --header 'x-api-key: <your-api-key>' \
  --header 'Content-Type: application/json' \
  --data '{ "jsonrpc": "2.0", "id": 1, "method": "tools/list" }'
```

The response names exactly the tools your credential can call — the tables, actions and automations marked with `aiAccess`, filtered by the role behind the credential.

That last clause is what makes the check worth running twice. Run it with a key owned by an admin and one owned by a viewer: **two different lists is the proof that role filtering is live.** One identical list means something is wrong with the credentials rather than with the schema, and a green dot would have told you neither.

**An empty list is usually eligibility, not auth.** A `200` with no tools means the credential worked and nothing is eligible for exposure; a `401` means the credential is wrong. Establish which one you got before editing the schema.
