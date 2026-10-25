---
name: sovrium-agents
description: Use when a Sovrium app's own AI has to be designed, built or reviewed — an assistant, a chatbot, a support or sales agent, "let the AI answer from our FAQ", "let the AI read this table", RAG on documents, AI fields, AI steps in an automation, voice dictation, a local model with Ollama, or connecting an outside AI client to the app's live data. It plans and checks the app's agents (role, tools, approval, trigger, limits, schedule, knowledge, memory, skills, external MCP servers), the ai-chat component, the seven ai-* field types, type ai automation actions, the AI access a table or automation offers, the provider and its local-first precedence, speech-to-text, and how the app degrades without a provider, then proves the agent with realistic questions against the running app. Not this skill for editing the config with an AI client, the config MCP or the dev loop, which are `sovrium-app`; nor for the chat rate cap and the agent's borrowed reach as launch items, which are `sovrium-security`.
license: BSL-1.1
metadata:
  author: sovrium
  version: '1.0.0'
---

# Sovrium agents

A bare agent builds a Sovrium assistant like a chatbot framework: it looks for an `ai:` block to put the API key and model in, gives the agent the `admin` role "so it never gets stuck", lists every action, skips approval, leaves who may trigger it unwritten, embeds a table on SQLite and wonders why the answers are empty, and declares success when the chat replies once. In Sovrium the provider is the operator's environment (`AI_PROVIDER`, never the config), an agent is a user whose `role` is the ceiling of everything it does, `tools` only narrows that role and an agent with no `tools` can do nothing, an email it sends cannot be taken back, `AI_CHAT_RATE_LIMIT` is unset, table knowledge needs PostgreSQL, and an AI field's value is not proof that a model wrote it. An agent is only as good as the answers it gives real people about real records: test it that way.

Run the core loop from `sovrium-app` underneath this skill. Manual: `sovrium docs ai/ai-overview`, `sovrium docs agents/ai-agents`, `sovrium docs agents/agent-tools`, `sovrium docs agents/agent-approvals`, `sovrium docs components/ai-chat-component`, `sovrium docs configuration/env-vars-ai`, `sovrium docs mcp/mcp-server`.

## Scope

**Config keys**: `agents[]` (`name`, `role`, `systemPrompt`, `instructions`, `model`, `temperature`, `maxTokens`, `enabled`, `tools`, `approval`, `permissions`, `limits`, `schedule`, `knowledge`, `memory`, `mcp`, `skills`, `description`); the `ai-chat` component and its conversation parts; the seven `ai-*` field types; `type: ai` automation actions (`generate`, `classify`, `extract`, `transcribe`, `agent`); `aiAccess` on tables, automations and action templates; `visibility: { runtime: ai }`. Every option: `references/agent-options.generated.md`, or `sovrium docs config agents[].<key>`.

**Environment the operator sets**: the provider and model (`AI_PROVIDER`, `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`), where a call may go (`ECO_AI_PROVIDER_PRECEDENCE`), chat limits (`AI_CHAT_*`), retention (`AI_MEMORY_*`), retrieval tuning (`AI_RAG_*`), speech (`STT_*`), the app's MCP server (`MCP_ENABLED`) and the external servers agents may call (`MCP_CLIENT_SERVERS`). Never in the config, and there is no top-level `ai` key.

**What the binary does on its own**: a built-in read-only `system` agent once a provider is set; chat narrowed to what the person chatting may read; tool calls checked before they run; answers rendered and sanitised on the server; a status line in place of the chat where no provider is configured.

**Not this skill**: the config MCP (`sovrium mcp`, which edits the configuration files on the author's machine) and the edit-reload loop belong to `sovrium-app`. The app's own MCP server, which serves live records to an outside client, is this skill's. They are different things; keep them apart in every answer.

## Evidence

| Evidence                                                       | Proves                                              | How                                                                                        |
| -------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Ten questions asked on the running app, as two different users | The agent answers what each may know, and only that | The `ai-chat` page in the browser MCP, or `POST /api/agents/<name>/chat` with each session |
| The records behind each answer                                 | The answer is true                                  | `GET /api/tables/<t>/records` as the same user                                             |
| The approval queue                                             | Irreversible actions wait for a person              | `GET /api/agents/<name>/approvals?status=pending`                                          |
| `/api/health` as an admin                                      | Which provider and route serve the calls            | Its `ai` section                                                                           |
| The startup banner                                             | Agents inert, AI fields on their baseline           | Its `⚠` lines when no provider is set                                                      |
| `sovrium validate`                                             | Roles, tables, actions and skill folders exist      | `sovrium validate --json`                                                                  |

A reply that sounds right is not evidence. An answer checked against the records is.

## Survey → Implement → Evaluate

```
Agent progress:
- [ ] 1 Write the agent's job in one sentence, its audience, and what it must never do
- [ ] 2 List the tables and actions that job needs; nothing else
- [ ] 3 Pick its role: a role of its own, at the level the job needs
- [ ] 4 Write the agent: systemPrompt (who it is), instructions (one rule per line), tools, approval, permissions.trigger, limits
- [ ] 5 Add knowledge or memory only if the job needs it (check the database: table knowledge needs PostgreSQL)
- [ ] 6 Place it: ai-chat on a page, an automation step, a schedule, or aiAccess for an outside client
- [ ] 7 sovrium validate; fix; repeat
- [ ] 8 Write ten realistic questions (Evaluate below) and their expected answers from the records
- [ ] 9 Ask them on the running app as two users; fix the prompt, tools or permissions; ask again
- [ ] 10 Hand the launch items to sovrium-security (rate cap, trigger, role)
```

**Survey**: read the tables the agent will read, their permissions, and who will talk to it. The agent never shows a person more than she may read in a chat, so the tables' own rules do most of the protecting: a customer sees only her own tickets through the agent only if the table already says so (the row rule below). Check those rules exist before trusting the agent; writing them is `sovrium-data-model`.

**Implement**: config edits only; the provider is set in `.env` by the operator. A minimal working agent, validated:

```yaml
name: helpdesk
auth:
  strategies:
    - type: emailAndPassword
  roles:
    - { name: support-assistant, level: 30 }
tables:
  - id: 1
    name: tickets
    fields:
      - { id: 1, name: subject, type: single-line-text }
      - { id: 2, name: status, type: single-select, options: [open, closed] }
      - { id: 3, name: owner, type: created-by }
    permissions:
      read: authenticated
      create: authenticated
      update: [admin]
    rowLevelPermissions:
      read:
        when: { field: owner, operator: eq, value: $currentUser.id }
  - id: 2
    name: faq
    fields:
      - { id: 1, name: question, type: single-line-text }
      - { id: 2, name: answer, type: long-text }
    permissions:
      read: all
agents:
  - name: support-assistant
    role: support-assistant
    systemPrompt: You help customers with their own tickets and answer from the FAQ.
    instructions:
      - Answer only from the tickets and the FAQ; say so when neither holds the answer.
      - Never promise a refund or a delivery date.
    tools:
      tables: [tickets, faq]
      actions: [record.list, record.read, email.send]
    approval:
      mode: selective
      required: [email.send]
    permissions:
      type: agent
      trigger: authenticated
    limits:
      maxActionsPerMinute: 20
      maxTokensPerDay: 100000
      maxConcurrentTasks: 3
pages:
  - name: help
    path: /help
    access: authenticated
    components:
      - type: ai-chat
        agent: support-assistant
        placeholder: Ask about your tickets…
        visibility: { runtime: ai }
      - type: text
        content: The assistant is not available here.
        visibility: { unlessRuntime: ai }
```

**Evaluate** with ten questions, the way a tool server is evaluated: write ten questions a real user of this agent would ask, each answerable from the records with one value you can check (a count, a name, a date, a status), read-only, independent of each other, and not solvable by repeating a keyword from the data. Include two it must refuse or not know (another customer's ticket, a policy the FAQ does not hold) and one that needs two tables. Work out each expected answer from the records API first. Then ask all ten on the running `ai-chat` page or with `POST /api/agents/<name>/chat`, as two users of different reach, and compare. A wrong answer is a fix to the prompt, the instructions, the tools, the table permissions or the knowledge; never to the expected answer. Ask the ten again after each fix.

## The checklist

Tags in brackets point to `references/sources.md`.

**CRITICAL** — what the agent can do to data and people

1. `own-role` — the agent has a role of its own (`auth.roles`), at the lowest level the job needs. Never `admin` for convenience, never `member` (what members gain later, it gains too). The role is the ceiling: wherever no person narrows it, it acts with all of it. Details: `references/agents-config.md`. [S4][S5]
2. `tools-minimal` — `tools.tables` and `tools.actions` list only what the job needs. `record.read` fetches one record by id; `record.list` sweeps a table: grant the second only to an agent that must search. An agent with no `tools` can do nothing at all. [S1][S4]
3. `irreversible-waits` — every action that cannot be undone (`email.send`, `auth.*`, `http.request`, `record.delete`, `code.runTypescript`, `browser.use` aside) is in `approval.required` with `mode: selective`, or the agent runs `mode: all` while you learn what it does. A sent email is gone. [S4][S5]
4. `trigger-written` — `permissions.trigger` is written on every agent people can reach. Omitted, any signed-in caller may use it and read its prompts back; `all` opens it to anonymous visitors. A refused caller gets `404`. [S5]
5. `provider-in-env` — the provider, key, model and endpoint are environment variables; the config holds no key and no `ai:` key. `ECO_AI_PROVIDER_PRECEDENCE` routes calls local-first by default. Details: `references/providers-and-env.md`. [S8][S9]

**HIGH** — whether it works, and what it costs

6. `knowledge-fits-the-database` — table knowledge (`knowledge.tables`) is embedded on PostgreSQL only; on SQLite an agent retrieves nothing from it, silently. Documents work on both. Details: `references/knowledge-memory-rag.md`. [S6]
7. `limits-on-unattended` — every agent on a `schedule`, or run by an automation's `agent` step, has `limits`, and the step has `maxSteps`. A schedule's `taskPrompt` has a definite end state. [S4]
8. `chat-cap-set` — the operator sets `AI_CHAT_RATE_LIMIT` for any chat signed-in people use; unset, there is no cap. A launch item for `sovrium-security`. [S4]
9. `aiAccess-deliberate` — `aiAccess` on a table offers it to outside AI clients through the app's MCP server, once the operator sets `MCP_ENABLED`. Narrow `operations`, write a `description` that says when to use the tool, and set `requireConfirmation` on an irreversible automation. It offers; it never permits beyond the caller's role. Details: `references/ai-access-and-mcp-server.md`. [S1][S2][S3]
10. `degrades-honestly` — a page with `ai-chat` also says what happens where AI cannot run: `visibility: { runtime: ai }` on the chat and an alternative with `unlessRuntime: ai`. [S7]
11. `external-tools-scoped` — an agent reaches an external MCP server only by naming it in `mcp.servers`, narrowed with `mcp.allowedTools`. The operator declares the server; a tool not marked read-only waits for approval. [S2][S5][S10]

**MEDIUM** — answer quality

12. `prompt-and-rules-split` — `systemPrompt` says who the agent is; each `instructions` entry is one rule. One rule per line is followed more reliably and reviews better. [S7]
13. `closed-lists-for-branching` — a decision an automation branches on uses `ai` `classify` with `categories`, or an `ai-categorize` field, never free-form generation. [S7]
14. `ai-values-are-not-proof` — an AI field is filled first by a local deterministic value, then refined by the model; check its refinement status before an automation acts on it. [S4]
15. `vision-declared` — a chat that accepts pictures needs `AI_VISION=1` on a model that reads images; without it a picture is refused.
16. `retention-set` — `AI_MEMORY_MAX_AGE_DAYS` is set when conversations hold personal data; facts memory keeps its own `namespace`. [S4]

**LOW** — polish

17. `starter-prompts` — `suggestions` give a reader several things to ask; each fills the composer and sends nothing.
18. `usage-shown` — `showUsage` and `conversations` on a chat used daily.
19. `local-route-confirmed` — `/api/health` as an admin confirms which route serves calls; a typo in the precedence is absorbed, not reported.

## Before reporting

Before calling an agent done, or reporting one as broken, check: did the question reach the agent you meant (a page's `agent`, or the built-in `system` agent)? Was a provider configured on that instance? Was the person allowed to read the records the answer needed (a refused table reads like a missing one, by design)? Was the call waiting for approval rather than failing? Each of those explains a "wrong" answer without a defect.

## Report

```
Agent: <name>   Role: <role>   Trigger: <grant>   Provider route: <from /api/health>
Questions: <n> asked as <user A>, <n> as <user B>
| # | Question | Expected (from the records) | Answer | Pass |
Fixes made: <rule id> — <file>:<line> — <what changed>
Open: <what still fails, and the next step>   Confidence: Confirmed | Likely | Needs verification
Decisions to record: <title — touches>   (one line per nominated decision, or: Decisions to record: none)
```

Nominate only a choice a future operator would ask about (the data-model shape, the permissions or auth model, SQLite or PostgreSQL, a design character, a disabled automation, a security trade-off left in place such as dev mode on a public origin or an open table), never labels, copy or colours. Skills only nominate; only the `sovrium-config-editor` agent writes the `decisions:` register.

## Must not claim

1. The provider, key or model is set in the config, or there is an `ai:` key.
2. The config MCP is the app's AI, or `sovrium mcp` serves live records.
3. An agent with no `tools` block can read every table.
4. `tools` can grant what the agent's role does not allow.
5. Giving the agent the `admin` role is a safe default.
6. A signed-in user's chat is rate-limited by default.
7. Table knowledge works on SQLite.
8. The app's MCP server needs an AI provider.
9. `aiAccess` exposes anything before the operator sets `MCP_ENABLED`.
10. An AI field's value proves a model produced it.
11. An approved action runs as the approver.

## References

- [references/agents-config.md](references/agents-config.md) — read when writing or reviewing an agent: every key, its default, how an agent's reach is narrowed or borrowed, approval, schedule, limits, skills.
- [references/providers-and-env.md](references/providers-and-env.md) — read before choosing a provider: the six providers, aliases, local-first precedence, what happens without one, speech-to-text.
- [references/knowledge-memory-rag.md](references/knowledge-memory-rag.md) — read before grounding an agent in tables or documents, or giving it memory.
- [references/chat-fields-actions.md](references/chat-fields-actions.md) — read when placing the AI: the `ai-chat` component, files and voice, the seven AI fields, the `ai` automation actions.
- [references/ai-access-and-mcp-server.md](references/ai-access-and-mcp-server.md) — read when an outside AI client should reach live data: `aiAccess`, the app's MCP server, risk hints, client mode.
- [references/agent-options.generated.md](references/agent-options.generated.md) — read for every option of the app's agents and AI access in the binary you run; generated from it.
- [references/sources.md](references/sources.md) — the sources behind every tag above.
