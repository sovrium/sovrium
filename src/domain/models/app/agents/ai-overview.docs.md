# AI Overview

> The whole AI layer is off until one environment variable is set — and the line between what an operator controls and what a schema author declares.

Every AI capability is opt-in and governed by the platform's existing roles and field-level permissions. AI never bypasses the security model, and nothing AI-related runs until `AI_PROVIDER` is set.

## Operators control infrastructure, schema authors declare intent

That division mirrors the rest of the platform: which provider answers a call, where embeddings live, and whether the MCP server mounts are operator concerns; which tables an agent may touch and which entities are AI-eligible are schema concerns.

| Concern                               | Decided by   | Expressed as                                    |
| ------------------------------------- | ------------ | ----------------------------------------------- |
| Which provider, model and key to use  | The operator | `AI_PROVIDER`, `AI_MODEL`, `AI_API_KEY`         |
| Provider routing precedence           | The operator | `ECO_AI_PROVIDER_PRECEDENCE`                    |
| Whether the MCP server mounts         | The operator | `MCP_ENABLED` and its siblings                  |
| Which entities are AI-eligible        | The schema   | `aiAccess` on tables, automations and templates |
| An agent's identity, tools and limits | The schema   | the `agents` block                              |
| AI computed columns                   | The schema   | `ai-*` field types on a table                   |

## The building blocks

| Capability      | Does                                                                     |
| --------------- | ------------------------------------------------------------------------ |
| Providers       | Picks the language and embedding backend                                 |
| Eco routing     | Prefers a local model and falls back to cloud                            |
| AI fields       | Computed columns that summarise, categorise, extract or translate        |
| AI chat         | A conversational interface over your data                                |
| AI agents       | Autonomous users with scoped tools, approval gates, schedules and limits |
| RAG knowledge   | Grounds answers in your tables and documents through semantic search     |
| Agent memory    | Conversation history, knowledge, and persistent learned facts            |
| MCP integration | Exposes Sovrium as an MCP server, and lets agents consume external tools |

The seven computed field types live on table records and are documented with the other field types, not here.

## The master switch

With `AI_PROVIDER` unset or blank, the entire layer is dormant: AI fields skip computation, the chat endpoint answers with a disabled state, agents do not run, and no embedding infrastructure is provisioned. Nothing fails at boot.

It is **not silent when the app was built to use it**. If the configuration declares an AI surface — an `ai-*` field, an agent, an AI automation action, or an AI component on a page — the startup banner says so:

```text
⚠ AI disabled — AI_PROVIDER not set (agents are inert, ai-* fields fall back to their baseline)
```

An app with no AI surface starts without that line, because nothing about it is degraded. That asymmetry is the point: a warning every app prints is a warning nobody reads.

```bash
AI_PROVIDER=ollama
AI_BASE_URL=http://localhost:11434
AI_MODEL=llama3.1
```

```bash
AI_PROVIDER=anthropic
AI_API_KEY=sk-ant-...
AI_MODEL=claude-sonnet-4-5
```

## There is no privileged AI path

Fields, chat, agents and MCP all funnel through the same authorization layer. An agent inherits its role's permissions; a chat user sees only what their session permits; an MCP client is bounded by its token's role.

## What each capability needs

| Requirement            | Why                                                                                 |
| ---------------------- | ----------------------------------------------------------------------------------- |
| `AI_PROVIDER` set      | The master switch; without it the whole layer is dormant                            |
| Authentication, mostly | Agents are stored as users, and chat and MCP need roles; AI fields work without     |
| A vector store         | RAG embeddings use PostgreSQL with pgvector, or SQLite — never an external database |
