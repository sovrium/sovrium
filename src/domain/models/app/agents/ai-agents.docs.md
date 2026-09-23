# Agents Overview

> An autonomous actor that operates as a virtual user — bound to a role, working from an explicit allowlist, and auditable like a person.

An agent binds to an auth role, works from an explicit allowlist of tables and actions, and can be gated by human approval, run on a schedule, and bounded by resource limits. Agents live in the top-level `agents` array.

They need two things: authentication configured, because an agent is stored as a user, and a provider configured, because an agent needs a model.

```yaml
agents:
  - name: support-agent
    role: support
    systemPrompt: You are a courteous support assistant. Resolve tickets accurately.
    tools:
      tables: [tickets, customers]
      actions: [record.read, record.update, email.send]
    approval:
      mode: selective
      required: [email.send]
    limits:
      maxActionsPerMinute: 20
      maxTokensPerDay: 100000
```

## An agent is a user

Each one is materialised at runtime as a user row of type `agent`, with a synthetic address. That is not bookkeeping — it is the whole security design.

- The agent **inherits every table and field permission of its role**, exactly as a human would. There is no separate AI permission system to keep in sync, and no way for an agent to exceed a role you have already reasoned about.
- Agents **cannot authenticate**. No sign-in endpoint accepts them: not a password, not a magic link, not a code. The identity exists to be authorised, never to be logged into.
- Agent actions appear in the activity log as an agent actor, so an audit reads uniformly across humans and machines.
- Agent users are excluded from the user list unless it is asked for them explicitly.

The rows are managed for you: created on first startup, updated when the role changes, soft-deleted when the agent leaves the configuration.

### Give an agent its own role

Reusing `member` means every capability you later grant members, you have also silently granted the agent. A dedicated role keeps the blast radius reviewable, and makes the permission diff meaningful when it changes.

## Identity properties

<!-- sovrium:options AgentDefinitionSchema -->

`name` is a kebab-case identifier; `role` must exist in the declared roles; `systemPrompt` is required. `model`, `temperature` and `maxTokens` override the provider defaults for this agent alone. A disabled agent skips its scheduled runs and cannot execute.

The prompt and the instructions divide cleanly in practice: the prompt says who the agent **is**, and each instruction is one rule you would otherwise bury in a paragraph. Rules stated as separate numbered lines are followed more reliably, and they diff better in review.

## The blocks that compose onto it

| Block         | Carries                                           |
| ------------- | ------------------------------------------------- |
| `tools`       | The tables and actions allowlist                  |
| `permissions` | Who may invoke the agent                          |
| `approval`    | Which actions wait for a human                    |
| `schedule`    | When it wakes on its own                          |
| `limits`      | Action, token and concurrency caps                |
| `memory`      | Conversation history and persistent learned facts |
| `knowledge`   | The tables and documents it retrieves from        |
| `mcp`         | External tools it may invoke                      |

## How an agent is reached

From a chat component, over the API at `POST /api/agents/{name}/chat`, on its own schedule, and from an automation's agent action.

Every one of those except the schedule is a **caller**, and every caller passes the agent's trigger grant first — as does every endpoint that reads an agent back, since its definition includes the prompts and the allowlist. The agent's own cron is deliberately outside that grant: a timer is not a caller.

Because each agent is a distinct virtual user with its own role and allowlist, several can coexist at different privilege levels — a read-only analyst beside a write-capable triage agent — without either inheriting the other's reach.

## A worked example

```yaml
agents:
  - name: data-analyst
    role: analyst
    systemPrompt: You are an expert data analyst. Be precise and cite the records you used.
    instructions:
      - Never expose customer personal data in summaries.
      - Prefer aggregates over row-level dumps.
    tools:
      tables: [orders, customers]
      actions: [record.read, record.list]
    approval:
      mode: none
    limits:
      maxActionsPerMinute: 20
      maxTokensPerDay: 150000
    schedule:
      cron: '0 7 * * *'
      timezone: UTC
      taskPrompt: Produce the daily orders summary.
```

Read it as a security statement rather than a feature list: this agent reads two tables and nothing else, writes nothing, needs no approval because it cannot cause harm, and wakes once a day.

It carries both read actions deliberately. Reading one record by id is not enough to summarise a day of orders; listing is the action that returns a filtered set.
