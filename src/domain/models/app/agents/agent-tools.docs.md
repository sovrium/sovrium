# Agent Tools

> An agent's capability allowlist — and the second gate that means it can only ever narrow a role, never widen one.

`tools` is the single most consequential thing you write about an agent, because it is the only place where "what this agent is for" becomes machine-checkable.

```yaml
agents:
  - name: support-agent
    role: support
    systemPrompt: You are a courteous support assistant. Resolve tickets accurately.
    tools:
      tables: [tickets, customers]
      actions: [record.read, record.update, email.send]
```

<!-- sovrium:options AgentCapabilitiesSchema -->

Each needs at least one entry, and every table named must exist. An agent with **no** `tools` block has no access at all — secure by default, and quiet about it, so an agent that seems to do nothing is often an agent whose allowlist you forgot.

## The double gate

Every call an agent attempts passes two independent checks, and both must allow it:

1. **The role gate** — does the agent's role permit this operation on this table?
2. **The allowlist gate** — is this table and this action written in `tools`?

The order does not matter; the conjunction does. What it buys you is that `tools` can only ever **narrow** a role, never widen one. Listing a delete action on an agent whose role cannot delete grants nothing.

So reviewing an agent means reviewing its role: the allowlist cannot smuggle in a capability the role withheld. Row-level and field-level rules apply on top, unchanged.

Because the gate is a conjunction, **tightening the allowlist is always safe to try**. If the agent still works, the entry was never needed — which is the cheapest way to deal with the drift that puts a delete action there for a one-off cleanup and leaves it.

## The actions

They follow the same `type.operator` vocabulary as the automation engine, so a rule you already understand from an automation means the same thing here.

| Category | Actions                                                                         |
| -------- | ------------------------------------------------------------------------------- |
| Record   | `record.read`, `record.list`, `record.create`, `record.update`, `record.delete` |
| State    | `state.get`, `state.set`, `state.increment`, `state.delete`, `state.list`       |
| HTTP     | `http.request`                                                                  |
| AI       | `ai.generate`, `ai.classify`, `ai.extract`                                      |
| Code     | `code.runTypescript`                                                            |
| Email    | `email.send`                                                                    |
| Auth     | `auth.createUser`, `auth.assignRole`, `auth.banUser`, `auth.unbanUser`          |
| File     | `file.upload`, `file.download`, `file.delete`, `file.list`, `file.getMetadata`  |

### Reading is two capabilities, not one

`record.read` fetches a single record by its id. `record.list` returns a **set** — it is the one that takes a filter, a sort and a limit.

They are separate entries because they expose very different amounts of data: an agent with the first can look up a record it was already pointed at, while an agent with the second can sweep the table. Granting the first does **not** imply the second.

Both are gated by the same table read permission, so a role that cannot read a table gets neither.

### The three worth pausing over

**State** is a cross-run key-value store, and it is what makes an agent more than a stateless prompt: a scheduled agent can remember what it processed last time without a table to hold it.

**Auth actions** are the sharpest thing on the list. Creating a user, assigning a role or banning somebody means an agent can alter who has access to your app. Grant them only to an agent whose role is itself privileged enough to justify it, and put them behind approval.

**Running code** executes in a sandbox, but it is still the broadest capability here — it is the action that turns "what the agent may do" from a list into a language.

## Inside and outside

`tools` scopes what the agent may do **inside** Sovrium. Reaching outside — an external server's web search or document fetch — is a separate allowlist on the agent's MCP block.

The two are independent by design. A read-only internal agent that can search the web is a perfectly coherent configuration, and so is the reverse.
