# Sub-Workflow Actions

> One workflow invoking another — calling a target, returning a result, and the depth guard that stops a chain calling itself.

The `automation` family lets one workflow invoke another. It is how a step shared by five automations becomes one automation the other five call, instead of five copies that drift apart.

## Calling

Invokes an automation that declares an automation-call trigger.

<!-- sovrium:options AutomationCallActionSchema -->

```yaml
- name: enrich
  type: automation
  operator: call
  props:
    name: enrich-lead
    inputData: { email: '{{trigger.data.record.email}}' }
    mode: sync
    maxDepth: 10
```

`name` is required and names the target. `inputData` is what the callee reads at `{{trigger.input.*}}`. `mode` is `sync`, which waits for the callee and is the default, or `async`, which fires and continues. `maxDepth` accepts 1 to 100 and defaults to **10**. A `sync` call fails when its callee fails, exhausts its retries, times out or is cancelled, and the calling run fails with it unless the call step is marked `continueOnError`.

### `waitForCompletion` and `props.timeout` are accepted but ignored

Both validate against the schema and neither is read at runtime, so a call written with `waitForCompletion: true` is **not** thereby synchronous. Use `mode`. This is the failure a configuration cannot warn you about — the key is real, the value is valid, and nothing consumes it.

`maxDepth` stops a chain that calls itself, directly or through intermediaries. The callee sees how deep it currently is at `{{trigger.depth}}` and which automation invoked it at `{{trigger.caller}}`.

A call works among a `loop`'s actions, once per item, and among a `path` branch's actions, as it does at the top level. It is held to the same rules there: a call that would re-enter an automation already running in the chain fails as a circular reference, and one past its `maxDepth` fails before the callee starts.

**Who the called automation acts as.** A call from a run someone started by hand (a manual trigger, a table button, an MCP action template, an agent's chat turn) runs the called automation as that person: its filters reach only the records they may read, a record they may not read fails as one that does not exist, and its writes are checked against their rules, at every depth and in both modes. A call from a run nobody started (a schedule, a webhook, a record event) runs the called automation as the system, as its caller does. Calling an automation never widens what the person who started the chain may read or change.

The run a call starts is not its starter's to read: the person who started the chain reads the called run only as an admin or a named approver would. Otherwise it answers `404` and is absent from her run list. What the called automation hands back reaches the calling run's step as before.

## Returning

Hands output back to the caller. It is only meaningful in an automation whose trigger is an automation call.

<!-- sovrium:options AutomationReturnActionSchema -->

```yaml
- name: done
  type: automation
  operator: return
  props:
    data:
      score: '{{computeScore.result}}'
      tier: '{{classify.result}}'
```

`data` is the only property and it is required — a return action without it fails when the configuration is decoded. In the parent, the result arrives at `steps.<name>.result.*`, so the call above is read back as `{{enrich.result.score}}`.

### The property is `data`, not `output`

`output` is a real property name — on the stop action, which ends a run rather than returning from one. The two are easy to confuse and behave differently: returning hands a value to a caller, stopping terminates.

## Composition is not failure handling

A call invokes a target that **declares** an automation-call trigger and, in `sync` mode, waits for its result. Reacting to a workflow that **failed** is the automation-failure trigger's job: it fires after the fact, on a run you did not start, and cannot influence it.

| You want                                      | Reach for                     |
| --------------------------------------------- | ----------------------------- |
| Reuse a step across several automations       | A call in `sync` mode         |
| Start long work without blocking this run     | A call in `async` mode        |
| Be notified when some other automation breaks | An automation-failure trigger |
| Recover from a failing step inside _this_ run | A per-action retry            |
