# Manual, Sub-Automation & Failure Triggers

> The three triggers no external event and no schedule starts — an operator deciding, another automation delegating, and a run failing.

## Manual trigger

Operator-initiated execution, from a button in the operator console or `POST /api/automations/{name}/trigger`.

```yaml
trigger:
  type: manual
  label: Sync inventory
  requiredRole: admin
  inputSchema: { warehouse: { type: string } }
```

<!-- sovrium:options ManualTriggerSchema -->

Every property is optional; `requiredRole` defaults to `admin`. Input supplied at trigger time is read at **`{{trigger.input.*}}`** — not `{{trigger.inputData}}`, which is the property name on the calling side and does not resolve here.

### Manual is the only trigger eligible for AI access

An agent may invoke a manual automation over MCP precisely because it does not fire on its own. Exposing a webhook or cron automation to a model would hand it a lever that also pulls itself, so the restriction is enforced when the configuration is decoded rather than merely advised.

## Automation-call trigger

Marks an automation as callable by another one, which is the basis of sub-workflow composition.

```yaml
trigger:
  type: automation-call
  inputSchema: { customerId: { type: string } }
```

<!-- sovrium:options AutomationCallTriggerSchema -->

`inputSchema` is the trigger's only property. Omitted, whatever the caller sends is accepted.

The callee reads what it was given at `{{trigger.input.*}}`, and can also see `{{trigger.caller}}` — the calling automation — and `{{trigger.depth}}`, how deep the chain currently runs.

Depth matters: the calling action carries a `maxDepth` guard defaulting to **10**, so a chain that accidentally calls itself is stopped rather than recursing until the process dies. Return values flow back through the return action.

## Automation-failure trigger

Fires when a watched automation fails — composable failure handling, without a notification step duplicated into every workflow.

```yaml
trigger:
  type: automation-failure
  automations: [nightly-sync, billing-run]
```

<!-- sovrium:options AutomationFailureTriggerSchema -->

Omitting `automations` and supplying an empty array are **not** the same thing: the empty array is refused when the configuration is decoded, while omission is the documented way to watch every automation.

Point it at the jobs whose silent failure would actually hurt — a nightly sync, a billing run — and have it post where your team reads.

### Failure reaction is not sub-workflow composition

A call action invokes a target declaring an automation-call trigger and waits for its result. This trigger fires **after** a different automation has already failed, and cannot influence that run at all. In-run recovery is the retry model's job, not this one's.
