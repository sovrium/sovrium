# Writing an agent

## Contents

- What an agent is
- Identity keys
- Who the agent acts as
- tools: the allowlist
- approval
- permissions.trigger
- limits and schedule
- skills and the built-in tools
- The built-in system agent
- Reaching an agent

Manual: `sovrium docs agents/ai-agents`, `sovrium docs agents/agent-tools`, `sovrium docs agents/agent-approvals`, `sovrium docs agents/agent-schedule-limits`. Every key: `agent-options.generated.md`.

## What an agent is

An entry of the top-level `agents` list is a virtual user of type `agent`, with a synthetic address and the `role` you give it. It needs `auth` (an app declaring agents without `auth` is refused at boot) and a provider to answer. It cannot sign in through any sign-in route; it exists to be authorised. Its actions appear in the activity log as the agent's.

## Identity keys

| Key                                 | Rule                                                                                    |
| ----------------------------------- | --------------------------------------------------------------------------------------- |
| `name`                              | kebab-case, unique; `system` is reserved for the built-in agent                         |
| `role`                              | must exist: a built-in role or one under `auth.roles`. Give the agent a role of its own |
| `systemPrompt`                      | required: who the agent is                                                              |
| `instructions`                      | optional list, one behavioural rule per entry, appended as numbered rules               |
| `description`                       | display text for the console; the agent never reads it, so it is not a prompt           |
| `model`, `temperature`, `maxTokens` | per-agent overrides of `AI_MODEL`, `AI_TEMPERATURE`, `AI_MAX_TOKENS`                    |
| `enabled`                           | `true` by default; a disabled agent cannot run and skips its schedule                   |

Keep `model` out of the config unless one agent truly needs another model: the operator's environment decides the provider, and a model name tied to one provider breaks when the operator moves to another.

## Who the agent acts as

The `role` is a ceiling, never a grant to whoever talks to it.

- **In a chat with a signed-in person**, the agent's record tools read the intersection of its reach and hers (rows both may read, fields both may read, nothing in the trash), filtering on a field she may not read is refused, and its record actions run **as her**: her row and field write rules apply, and the records name her as author. An `auth` action needs a caller with admin rights. A call held for approval still runs as her once approved.
- **A visitor signed in to nothing**, on an agent whose trigger is `all`, gets what the records API serves anonymously, and no record or `auth` action.
- **Wherever no person narrows it** (its own schedule, an automation's `agent` step started by a record event, a webhook or a cron), the agent acts with its own role. Whoever can set that road in motion borrows the agent's reach for the run. A run someone starts by hand grounds its knowledge only on what that person may read.

So an admin-role agent opened to members is safe in a chat, and not on a road with no person behind it. Choose the role for the widest road the agent will travel.

## tools: the allowlist

```yaml
tools:
  tables: [tickets, faq]
  actions: [record.list, record.read, email.send]
```

- **No `tools` block means no access at all.** An agent that seems to do nothing is often one whose allowlist was forgotten.
- Every call passes two gates: the role allows it, and `tools` lists it. `tools` can only narrow the role; listing `record.delete` on a role that cannot delete grants nothing. Tightening the allowlist is always safe to try.
- The action vocabulary is the automation engine's `type.operator`: `record.*`, `state.*` (only when an automation runs the agent), `http.request`, `ai.generate|classify|extract`, `code.runTypescript`, `email.send`, `auth.createUser|assignRole|banUser|unbanUser`, `file.*`, `browser.use`. Read the current list with `sovrium docs config agents[].tools.actions[]`.
- `record.read` reads one record by id; `record.list` returns a filtered, sorted set. Granting one does not grant the other.
- `browser.use` needs `tools.browser.allowedHosts` (and the stored `sessions` it may start from); it never sends data, only reads.
- Reaching tools on an external MCP server is a separate allowlist, `mcp.servers` and `mcp.allowedTools` (see `ai-access-and-mcp-server.md`).

## approval

```yaml
approval:
  mode: selective
  required: [email.send, record.delete]
  timeout: 1800
  escalation: { after: 600, to: admin }
```

- `mode`: `none`, `all` or `selective` (which needs `required`, a subset of the agent's actions). `timeout` defaults to 3600 seconds; `escalation.after` must be less than `timeout`.
- Approval holds each covered **tool call**, on every road: a chat turn pauses, an automation step completes with the request id in `pendingApprovals`, a scheduled run waits. Approving runs the call; rejecting runs nothing and tells the model.
- Who may see and decide: the callers `permissions.trigger` admits, and admins; deciding also needs a role level at least the agent's own.
- Ask of each action: if the model gets it wrong, can I undo it? An audited update can be undone; a sent email, a ban, a payment cannot. Running `mode: all` for the first weeks shows what the agent actually does.
- A tool on an external MCP server that is not marked read-only always waits for approval.

## permissions.trigger

```yaml
permissions:
  type: agent
  trigger: [customer, admin]
```

- Omitted: any signed-in caller, nobody anonymous. `all` opens it to anonymous visitors (a public support bot). A role list narrows it.
- It governs every road that sets the agent in motion (chat, the execute and chat endpoints, a manual schedule trigger, an automation) and every road that reads it back (definition, prompts, schedule, usage, approvals). A refused caller gets `404`, byte for byte the answer for an agent that does not exist.
- The agent's own cron is outside the grant: a timer is not a caller.
- Read it as delegation: a viewer allowed to trigger an admin-role agent sets admin reach in motion on any road no person narrows.

## limits and schedule

- `limits` default to 30 actions a minute, 200,000 tokens a day (reset at midnight UTC) and 5 concurrent tasks. Actions per minute bounds a loop; tokens per day bounds the bill; concurrency bounds a crowd. Size them from the cron and the per-run cost.
- `schedule.cron` is a five-field expression, `timezone` an IANA zone (defaults to `SOVRIUM_TIMEZONE`, else UTC), `taskPrompt` what this run is for, written with a definite end state. A cron run skips the trigger grant and still meets approval.
- An agent every fifteen minutes runs ninety-six times a day: reconsider the schedule before raising the budget.

## skills and the built-in tools

- `skills` lists project folders holding a `SKILL.md` (frontmatter `name` and `description`). The agent sees each skill's name and description and loads its body with the built-in `load_skill` tool when a task needs it. A missing or malformed skill stops the boot and fails `sovrium validate`.
- In a streamed chat with a signed-in person, an agent can ask a short flat question with its built-in `ask_user` tool (a choice, a date, a yes or no) and wait. Never on a schedule or in an automation.

## The built-in system agent

Every app with a provider has `system`: read-only, built from the app's own name, description and tables, reading as the signed-in person. It answers the operator console's Welcome page and any `ai-chat` whose `agent` is `system`. Declare your own agent for write access, a prompt of your own or a narrower allowlist.

## Reaching an agent

An `ai-chat` component, `POST /api/agents/<name>/chat`, `POST /api/ai/chat` naming it, its own schedule, an automation's `ai` `agent` step. Every one except the schedule passes `permissions.trigger` first. The conversations belong to the person who held them and are deleted with her account.
