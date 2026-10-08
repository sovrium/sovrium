# Flow Control Actions

> Changing the shape of a workflow rather than its data — condition groups, branching, iteration, and halting a run early.

## Condition groups

Branches and the filter gate both evaluate **condition groups**: one or more comparisons combined with `and` or `or`.

<!-- sovrium:options ConditionGroupSchema -->

```yaml
condition:
  logic: and
  conditions:
    - { field: '{{trigger.data.record.status}}', operator: equals, value: paid }
    - { field: '{{trigger.data.record.amount}}', operator: greaterThan, value: 100 }
```

The comparison operators are `equals`, `notEquals`, `contains`, `notContains`, `startsWith`, `endsWith`, `greaterThan`, `greaterThanOrEqual`, `lessThan`, `lessThanOrEqual`, `isEmpty`, `isNotEmpty`, `isNull`, `isNotNull` and `matches`.

`isEmpty` and `isNotEmpty` test for presence: a value is empty when it is missing, null, an empty text, an empty list or an empty object (`{}`); nothing else is — `0`, `false`, a blank space, `{"a": null}` and `[null]` are values. So a `record/list` step is tested on its list, `{{<step>.records}}`, which is empty exactly when nothing matched:

```yaml
- { field: '{{dueTasks.records}}', operator: isNotEmpty }
```

Do not test the whole step output (`{{<step>.result}}`): it is an object with keys, `{ record, records }`, so it is always a value, even when nothing matched. Test `{{<step>.records}}`.

Two limits shape how a predicate has to be written:

- **Groups do not nest.** `conditions` holds comparisons only, never another group, so `(A and B) or C` is not expressible in one group. Express it with two branches instead.
- **`value` is a scalar** — a string, number, boolean or null. Arrays and objects are refused, so there is no membership test against a list here.

## Path — branching

Routes execution into named branches, each with its own condition and nested actions.

<!-- sovrium:options PathBranchActionSchema -->

`paths` requires **at least two** branches. A single-branch path fails when the configuration is decoded, because one conditional step is a filter rather than a branch. A branch with no `condition` always matches, which is how a fallback is written: put it last, under `first-match`.

`mode` is `first-match`, which runs the first matching branch and is the default, or `all-matching`, which runs every match in order.

Inside a branch — its `condition` and its actions — templates resolve as they do at the top level: an earlier step reads as `{{<step>.<key>}}` or `{{<step>.result.<key>}}`, and helpers such as `{{now}}` work.

An action inside a branch is a step of the run. Step names are unique within an automation, so a nested action's output reads as `{{<step>.<key>}}` from a later action of the same path, from an action of a later path, and from any step after the branch. A path's `condition` is evaluated when the branch selects its paths, before any of them runs, so it reads only what ran before the branch; a later path reads an earlier path's outputs in its actions. A `flow/stop`, or a filter that stops, inside a path ends the run there: no later action of the path and no step after the branch runs.

Each value is filled in once, when the branch runs its action. What a value carries is used as it is: trigger data holding `{{…}}` or `$env.` text is stored or sent as those characters, never read as a template a second time.

```yaml
- name: route
  type: path
  operator: branch
  props:
    mode: first-match
    paths:
      - name: vip
        condition:
          conditions: [{ field: '{{trigger.data.record.tier}}', operator: equals, value: vip }]
        actions:
          - name: vipEmail
            type: email
            operator: send
            props: { to: '{{trigger.data.record.email}}', subject: 'VIP welcome', body: 'Thanks!' }
      - name: standard
        actions:
          - name: stdEmail
            type: email
            operator: send
            props: { to: '{{trigger.data.record.email}}', subject: 'Welcome', body: 'Hi!' }
```

## Loop — iteration

Iterates over an array, running its nested actions once per item.

<!-- sovrium:options LoopEachActionSchema -->

Inside the loop the current item is at **`{{loop.item}}`**, its fields at `{{loop.item.<field>}}`, and the zero-based position at `{{loop.index}}`. A bare `{{item.*}}` does not resolve.

Within one item, a nested action reads the earlier nested actions of that item by name, `{{<step>.<key>}}` — that item's outputs, never another item's. A `flow/stop`, or a filter that stops, reached for one item ends the run: the remaining items and the steps after the loop do not run.

An item is filled in once, as it is: an item holding `{{…}}` or `$env.` text reaches the nested action as those characters, never read as a template a second time. A nested action that takes a list, such as a data transform on `'{{loop.item.orders}}'`, receives the list itself.

### `maxIterations` truncates silently

It defaults to **1000**, so a loop over 1,800 rows processes the first thousand and reports success. Nothing marks the run as incomplete, because from the loop's point of view it did what it was told. Raise it explicitly — up to 10000 — whenever the collection can exceed the cap, or page the source and loop per page.

`continueOnItemError` keeps the loop going past a failing item; it defaults to `false`, which aborts the whole loop on the first failure. A tolerated item is still reported: the loop's output counts it in `failed`, and its place in `results` holds an `error` naming what refused it — for example a template that rendered nothing into a date column. A loop runs the same way inside a path as at the top level.

```yaml
- name: notifyEach
  type: loop
  operator: each
  props:
    items: '{{fetchSubscribers.result}}'
    maxIterations: 5000
    continueOnItemError: true
    actions:
      - name: send
        type: email
        operator: send
        props: { to: '{{loop.item.email}}', subject: 'Update', body: 'Hi {{loop.item.name}}' }
```

## Flow — stopping early

Halts the run immediately, with an optional status and output.

A stop ends the run wherever it sits — at the top level, inside a path, inside a loop, at any depth: nothing after it runs, at its own level or above, and the caller of a synchronous trigger receives the stop's status, message and output. When a `webhook/response` already set the answer, the caller receives that response instead — its status, headers and body: the stop ends the run, it does not replace an answer you chose. Answering `404` and then stopping is how a webhook refuses an unknown record without running the rest.

<!-- sovrium:options FlowStopActionSchema -->

### The default status is `error`

A stop reached on a perfectly normal "nothing to do" path will therefore mark the run **failed**, and fire any automation-failure trigger watching it. Pass `status: success` for an expected early exit; the default is set the other way round so that an unhandled stop is loud rather than invisible.

```yaml
- name: bail
  type: flow
  operator: stop
  props: { status: success, message: 'Nothing to do', output: { processed: 0 } }
```
