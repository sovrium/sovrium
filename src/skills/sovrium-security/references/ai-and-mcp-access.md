# The app's AI and MCP server: the launch items

This file holds only what a launch review checks. How to design an agent, its tools, its knowledge and its chat is `sovrium-agents`.

Manual: `sovrium docs agents/agent-approvals`, `sovrium docs agents/agent-tools`, `sovrium docs ai/ai-chat`, `sovrium docs configuration/env-vars-ai`, `sovrium docs mcp/mcp-security`, `sovrium docs mcp/mcp-server`.

## An agent borrows nothing from the caller, and lends its role

Every agent is a user of its own, with its own `role`. That role is the ceiling of everything it can do; its `tools` allowlist only narrows it.

- **In a chat**, Sovrium narrows the agent to the person: its record reads are the intersection of her reach and the agent's, and its record actions run as her. A visitor signed in to nothing gets only what the records API serves anonymously, and no record or auth action.
- **Wherever no person narrows it** (its own schedule, an automation's agent step started by a record event, a webhook or a cron), it acts with its own role. Whoever can set that road in motion borrows the agent's reach for the length of the run.
- `permissions.trigger` decides who may set it in motion, and who may read it back (its prompts and allowlist are exactly what a prompt injection needs). Omitted, any signed-in caller may; `all` opens it to anonymous visitors. A refused caller gets `404`.

Launch items:

```
- [ ] No agent runs with role: admin unless every caller its trigger admits could already do what the agent does
- [ ] Each agent has a role of its own, not member (whatever members gain later, it gains too)
- [ ] permissions.trigger is written, not left to its default, on every agent people can reach
- [ ] auth.createUser, auth.assignRole, auth.banUser, email.send, http.request and code.runTypescript are behind approval, or absent
- [ ] limits are set on every agent that a schedule or an automation runs
```

## Chat cost and abuse

- `AI_CHAT_RATE_LIMIT` is unset by default: a signed-in user's chat has no cap until you set it, on a provider billed per token. Set it, and `AI_CHAT_RATE_WINDOW` if 60 seconds does not suit.
- An app without `auth` is covered by `AI_ANON_RATE_LIMIT` (per client address) whether or not the first one is set.
- On an app with `auth`, an anonymous visitor reaches an agent only when its `permissions.trigger` is `all`; otherwise the chat answers `404` to her, whatever the page's `access` says. The page's `access` decides whether the panel is drawn; the trigger decides whether the agent answers. Check both.
- `AI_CHAT_MAX_MESSAGE_LENGTH` and `AI_CHAT_TIMEOUT` are unset by default too; set them where the chat is open to many people.
- An agent's `limits.maxTokensPerDay` bounds the bill of one agent; it resets at midnight UTC.

## The app's MCP server

Off until the operator sets `MCP_ENABLED`, and refused at boot without an `auth` block. Then:

- A caller is a real user: an API key on `x-api-key` or an OAuth token on `Authorization: Bearer`. Every tool call meets that user's role, field and row rules; a viewer's key reads and lists only.
- An entity appears as a tool only when it declares `aiAccess`. `aiAccess` widens what is offered, never what is permitted: the worst case is that a role sees through a tool what it could already fetch through the API.
- Admins also get read-only tools over the internal auth and system tables. `MCP_EXPOSE_INTERNALS=false` removes them when outside clients are meant for business data only.
- Per-credential limits default to a minute and a day budget (`MCP_RATE_LIMIT_PER_MINUTE`, `MCP_RATE_LIMIT_PER_DAY`); every call is audited unless `MCP_AUDIT_ENABLED` is turned off, which is a bad default to change.
- `requireConfirmation: true` on an `aiAccess` block marks an irreversible automation as destructive, so a careful client asks its user first.

## Not the app's AI: the config MCP

`sovrium mcp` serves the configuration files to an AI client on the author's own machine, over a pipe, with no server and no credential. It is not exposed by the running app and holds no records. Its safety rules are `sovrium-app`, `references/config-mcp.md`.

## Dev mode

`SOVRIUM_DEV_MODE` shows the dev admin's credentials on the sign-in page, which an AI agent driving a browser uses to sign in during development. It is a development switch: off before launch (see `posture.md`).
