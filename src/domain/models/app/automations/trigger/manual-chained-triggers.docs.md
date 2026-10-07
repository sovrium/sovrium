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

Every property is optional; `requiredRole` defaults to `admin`, which the app's highest role satisfies too. Input supplied at trigger time is read at **`{{trigger.input.*}}`** — not `{{trigger.inputData}}`, which is the property name on the calling side and does not resolve here.

### From a page button

A page component whose action is `{ type: automation, name }` — a button, an alert-dialog confirm, a data form — runs that manual automation under the page's own `access` rule: a button on a public page runs for a signed-out visitor, one on a page that requires a session runs only for a signed-in caller. A `requiredRole` the trigger declares still binds on top of the page rule; the implicit `admin` default does not, because the page's `access` rule is the grant. A page never reaches a webhook, schedule, record or form automation, even when a component names one, and an automation no page names cannot be pressed at all: each of those answers exactly as an unknown name does. So does a press of an automation an operator has paused, or one set to `enabled: false`: nothing runs, even though its button is still on the page.

A button the page does not show the caller cannot be pressed by them either. A press counts only the components the page draws for that caller: one left out by its `visibility` — `roles`, `when`, a `$user.*` `condition` or a `capability`, on the component itself or on any container around it — is answered as an unknown name and runs nothing, so an admin-only button on a public page runs for an admin and for no one else. The `record`, `query`, `declares` and `runtime` gates only decide what a page shows; they are not access controls and are not judged at press time.

A press by a signed-in caller records her as the person who started the run, as the direct trigger does: she may read that run, and replay or cancel it under the trigger's role rule (an admin, by default, when the trigger declares no `requiredRole`). A press with no session records no starter, so only an admin acts on that run. Replaying or cancelling a run is reserved to an admin and to the person who started it by hand, while she still holds the trigger's role; an approver named on the run may read it and decide on its request, not replay or cancel it.

### By name: the trigger endpoint, the MCP tool and the chat

Starting a manual automation by name — `POST /api/automations/{name}/trigger`, the MCP tool an AI client calls, or asking the chat — is held to two rules, both judged on the caller's role: the trigger's `requiredRole` (`admin` when it declares none), and the automation's `permissions.trigger` when declared, which can narrow who may start it and never widen it. A caller either rule refuses gets the answer an unknown automation gets, and no run starts; the MCP tool list does not offer it to her.

The automation listing, `GET /api/automations`, follows the same rule: a caller who is not an admin reads only the manual automations she may start. An admin reads every automation, with every webhook secret redacted.

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
