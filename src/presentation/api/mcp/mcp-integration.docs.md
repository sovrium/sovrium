# MCP Overview

> Sovrium speaks the Model Context Protocol in both directions, and the two directions are unrelated pieces of configuration that happen to share a name.

| Direction       | What happens                                                                 | Configured by     | Needs a model on this side?         |
| --------------- | ---------------------------------------------------------------------------- | ----------------- | ----------------------------------- |
| **Server mode** | External clients connect to your app and call generated tools over your data | Operator, via env | No — the model lives at the client  |
| **Client mode** | Your own agents call tools hosted on someone else's MCP server               | Schema author     | Yes — a provider must be configured |

Server mode is the one most people mean. It turns the app into something an assistant can operate: tables become CRUD tools, manual automations become invocable, action templates become callable.

**Server mode needs no AI provider at all.** When Sovrium is the MCP _server_ it exposes tools and executes them; the reasoning happens at whichever client connected. No API key, no model, no provider setting. That requirement belongs to the rest of the AI layer, client mode included — and confusing the two is the most common reason a working server-mode setup is thought to be broken.

## Turning server mode on

The MCP server is **off by default** and the route mounts only when the operator says so. Nothing in the schema turns it on: `aiAccess` declares eligibility, the environment grants it.

| Variable                    | Default           | Purpose                                                                                                                             |
| --------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `MCP_ENABLED`               | `false`           | Master switch. The route exists only when `true`                                                                                    |
| `MCP_TRANSPORT`             | `streamable-http` | `streamable-http` mounts the route; `stdio` un-mounts it and serves nothing in its place. A local client uses `sovrium mcp` instead |
| `MCP_MOUNT_PATH`            | `/mcp`            | Route prefix under `streamable-http`                                                                                                |
| `MCP_RATE_LIMIT_PER_MINUTE` | `60`              | Requests per minute, per credential                                                                                                 |
| `MCP_RATE_LIMIT_PER_DAY`    | `5000`            | Requests per day, per credential                                                                                                    |
| `MCP_AUDIT_ENABLED`         | `true`            | Record every tool call                                                                                                              |
| `MCP_EXPOSE_INTERNALS`      | `true`            | Give admins read-only tools over auth and system tables                                                                             |
| `MCP_CONFIRM_DESTRUCTIVE`   | `true`            | Mark deletes and non-idempotent calls as needing confirmation                                                                       |

```bash
MCP_ENABLED=true
MCP_TRANSPORT=streamable-http
```

**There is no credential variable to set.** The endpoint authenticates on the header a request carries — an API key on `x-api-key`, or an OAuth access token on `Authorization: Bearer` — so both are live at once and neither is configured here. Because both are issued by the auth layer, `MCP_ENABLED=true` **requires an `auth` block** in the config; the boot refuses without one rather than mounting a route nobody can authenticate to.

Startup validation catches the three ways this configuration can be inconsistent, and each one fails the boot rather than mounting an unreachable or unguarded route: `MCP_ENABLED=true` with no `auth` block, a still-set `MCP_TOKEN_*` variable, and an `MCP_AUTH_STRATEGY` of `token`. The last two name credentials that were removed, and failing loudly is deliberate — the alternative is a route that silently stops enforcing a permission tier.

## Which direction do you want

The question that separates them is where the model runs.

To ask an assistant about your data, or have it file a record for you, you want **server mode**: your app publishes tools and someone else's assistant calls them. To have an agent inside your app search the web or fetch a document as part of its own work, you want **client mode**: your app is the caller and the tools are elsewhere.

They compose. An app can serve tools to a desktop assistant while its own agents consume tools from a search provider, and neither configuration knows the other exists.

There is a third surface, and it belongs to neither direction: `sovrium mcp` serves a project's **configuration** to a client on your own machine over a pipe, read-only, with no server and no credential. **Your Config over MCP** describes it.
