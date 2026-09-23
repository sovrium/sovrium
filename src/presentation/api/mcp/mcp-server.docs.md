# Server Mode

> The five surfaces that become tools once the server is running, how an entity declares itself eligible, and the risk hints a client reads before deciding whether to ask its user first.

Nothing is exposed by default. An entity appears only when its schema declares `aiAccess`, and a credential is shown only the tools its role may call.

## The five surfaces that become tools

| Surface            | Tool name                         | What it does                                                                               |
| ------------------ | --------------------------------- | ------------------------------------------------------------------------------------------ |
| User tables        | `{app}_{table}_{op}`              | Read, list, create, update and delete records                                              |
| Manual automations | `{app}_automation_{name}`         | Invoke an automation that has a manual trigger                                             |
| Action templates   | `{app}_action_{name}`             | Execute one action template                                                                |
| Admin internals    | `{app}_auth_*` / `{app}_system_*` | Read-only views of auth and system tables, admin role only                                 |
| Configuration      | `{app}_config_*`                  | Read-only views of the config, its findings, its schema and its run state, admin role only |

The tool list is filtered per connection, so a viewer credential is never even told that a delete tool exists. Only manual-trigger automations qualify: a cron or record-change automation has no caller to expose.

### The configuration tools

The last row is the only one you do not declare. `{app}_config_read`, `{app}_config_validate`, `{app}_config_schema` and `{app}_config_status` are compiled from your app's name alone, so every instance has exactly these four and no configuration can add, remove or rename one. They are **admin-only** here, filtered out of the tool list for every other role, and all four are reads — none of them can change what the instance runs. **Your Config over MCP** describes what each one returns, and the local `sovrium mcp` path where the process boundary replaces the role check.

`{app}_config_read` redacts declared secrets, and `{app}_config_validate` reports what is wrong with a config without quoting the value it objected to — a rejected value travels only where it is a name checked against a closed list, such as an unknown component `type`. Neither tool hands a credential to the assistant that asked.

**A table named `config` is refused at boot.** It would compile to `{app}_config_read` — the name the configuration tool already answers to — and two tools cannot share one name without one of them silently becoming unreachable. Rather than pick a loser, the server refuses to start and names the table:

```text
MCP tool-name collision: the table 'config' compiles to 'crm_config_read', which is the name of
this instance's configuration read tool. Rename the table — 'config' is reserved on the MCP
surface for the same reason 'auth_*' and 'system_*' are.
```

The refusal fires when the route actually mounts — `MCP_ENABLED=true` on the default transport. A table called `config` is fine on an app that does not serve MCP over HTTP.

**Only the exact name is reserved.** `auth_*` and `system_*` are refused as table-name _prefixes_, so no table of yours can produce those names at all; the configuration family is not comparable, because it is four exact names. A table called `config_backup` is an ordinary table of yours, its tools are ordinary data tools, and every role that may call them sees them.

## Declaring eligibility

`aiAccess` is the schema author's declaration of intent, deliberately separate from the operator's switch. Writing it exposes nothing on its own, and the switch exposes nothing you did not write — two hands on the lever rather than one.

```yaml
tables:
  - name: contacts
    aiAccess: true
```

The boolean is the common case. The object form takes over when the defaults are not right, and **supplying any object is itself the enable signal** — there is no `enabled` field to set.

```yaml
tables:
  - name: contacts
    aiAccess:
      description: Customer contacts. Use this when the user asks about people.
      operations: [read, list, create, update]
      fieldExposure: permissioned
      annotations:
        readOnly: false
        destructive: false
```

<!-- sovrium:options AiAccessConfigSchema -->

Automations and action templates accept the same block but ignore `operations`: each exposes a single invocation tool.

**`description` is the highest-leverage field here.** The model chooses tools by reading them, so "Customer contacts. Use this when the user asks about people" produces materially better behaviour than an auto-generated "Read from contacts" — it says _when_ to reach for the tool rather than only what it touches. Spend the effort here before tuning anything else.

## How much of a table the tool schema names

| Mode           | Fields in the tool schema                                    |
| -------------- | ------------------------------------------------------------ |
| `permissioned` | No field list — an opaque `data` object. The default         |
| `all`          | Every field, still subject to field-level rules at call time |
| `whitelist`    | Only the names in `whitelistFields`                          |

Every caller is shown the same tool schema. The catalogue is compiled once from the config, so the per-connection step decides _which_ tools a role sees, not what shape each one has.

That is why `permissioned` names no fields and why it is the default: it is the one mode that reveals nothing about your columns to a role that could not use them. Enforcement lands at call time instead — a read omits fields the caller may not read, and a write to a field it may not write is refused. Reach for `all` or `whitelist` when a real argument hint is worth more than the reticence, and for `whitelist` in particular when a table holds columns a role may read but that are simply not the model's business.

## Risk hints

Annotations compile into the tool definition so a client can decide whether to run a call silently or ask its user first. They map one-to-one onto the protocol's own hints.

<!-- sovrium:options ToolAnnotationsSchema -->

Left unset, sensible values are derived from the operation type, and `MCP_CONFIRM_DESTRUCTIVE` — on by default — additionally marks delete tools and non-idempotent automations as destructive.

The case worth setting by hand is the automation that is technically idempotent but practically irreversible: sending an email, charging a card. Calling it twice writes no duplicate row, so nothing derives a warning from its shape, and `requireConfirmation: true` is how you say so anyway.
