# Data & State Actions

> Three families that move values rather than perform side effects — reshaping what has flowed through, remembering it between runs, and deciding whether the run continues.

## Data — transforms in flight

Nine operators, all pure: each reads from earlier steps and produces a new value.

| Operator      | Props                                     | Does                                                                   |
| ------------- | ----------------------------------------- | ---------------------------------------------------------------------- |
| `set`         | `value`                                   | Sets a value for later steps, read back at `steps.<name>.value`        |
| `aggregate`   | `input`, `function`, `field?`, `groupBy?` | Reduces an array — sum, average, min, max or count, optionally grouped |
| `sort`        | `input`, `field`, `direction?`            | Sorts an array by a field                                              |
| `limit`       | `input`, `count`                          | Takes the first `count` items                                          |
| `deduplicate` | `input`, `key`                            | Removes duplicate items by a key                                       |
| `merge`       | `left`, `right`, `joinKey?`               | Merges two arrays, joined on a key or concatenated                     |
| `split`       | `input`, `size`                           | Chunks an array into sub-arrays                                        |
| `compare`     | `left`, `right`, `key`                    | Diffs two arrays into added, removed and unchanged                     |
| `lookup`      | `input`, `key`, `value`                   | Finds the **first** item whose key field equals a value                |

<!-- sovrium:options DataActionSchema -->

```yaml
- name: revenueByRegion
  type: data
  operator: aggregate
  props:
    input: '{{fetchOrders.result}}'
    function: sum
    field: amount
    groupBy: region
```

Three behaviours worth knowing before designing around them:

- **`aggregate` needs `field`** for sum, average, min and max. Only `count` may omit it.
- **`lookup` returns one item**, not a keyed map — it is a find, not an index.
- **`set` takes a string.** `value` is a template string, so a bare number, list or object is refused, and its result is at `steps.<name>.value` rather than `.result`.

## State — a key-value store across runs

Six operators persisting values **between** runs: counters, cursors, deduplication markers — anything a single run cannot hold.

| Operator    | Props                                                            | Does                                           |
| ----------- | ---------------------------------------------------------------- | ---------------------------------------------- |
| `get`       | `key`, `namespace?`                                              | Reads a stored value                           |
| `set`       | `key`, `value`, `namespace?`, `ttl?`                             | Stores a value, optionally with a time to live |
| `increment` | `key`, `amount?`, `namespace?`                                   | Atomically adds an amount, defaulting to 1     |
| `delete`    | `key`, `namespace?`                                              | Removes a stored value                         |
| `list`      | `prefix?`, `namespace?`, `limit?`                                | Lists keys, optionally filtered by prefix      |
| `filterNew` | `input`, `key`, `cursor?`, `initial?`, `remember?`, `namespace?` | Keeps only the items not returned before       |

<!-- sovrium:options StateActionSchema -->

```yaml
- name: bumpCounter
  type: state
  operator: increment
  props: { key: 'orders:{{trigger.data.record.region}}', namespace: metrics }
```

`increment` is atomic, which is what makes it usable as a counter under concurrency where a read-then-write pair would lose updates. A negative `amount` decrements.

Both optional scoping properties are format-constrained, and a value outside the format fails when the configuration is decoded rather than at runtime:

| Property    | Format                                          | Accepted                | Refused            |
| ----------- | ----------------------------------------------- | ----------------------- | ------------------ |
| `namespace` | Lowercase kebab-case, starting with a letter    | `metrics`, `sync-state` | `Metrics`, `my_ns` |
| `ttl`       | A number followed by `ms`, `s`, `m`, `h` or `d` | `30s`, `24h`            | `1 hour`, `3600`   |

### `filterNew`: act only on what appeared since the last run

Most APIs have no webhook for what matters, so the recipe is a `cron` trigger, an `http` step fetching the latest page, and the work — for the items that are new. `filterNew` keeps the items of `input` whose `key` it has not returned before, and remembers them for the next run.

```yaml
- name: newTransactions
  type: state
  operator: filterNew
  props:
    input: '{{steps.fetch.body.transactions}}'
    key: transaction_id
    cursor: { field: settled_at, stateKey: bank-last-settled }
    namespace: bank
```

- `key` identifies an item. An item whose key was returned before is dropped, even if its other fields changed.
- `cursor` orders items by `field` (an ISO date or a number). Items at or below the stored value are dropped, and the highest value returned is stored under `stateKey`, where a `state` / `get` step before the request can read it to ask the API only for later items.
- `initial` defaults to `skip`: the first run returns nothing and remembers everything already there, so switching the automation on does not replay history. `emit` returns everything.
- `remember` (1 000 by default) is how many keys are kept, most recent first. Set it above the largest page the API returns.

The step's output is `items` — the new items, in the order they came — and `count`. Memory is per automation, per step name and per `namespace`, so two automations polling the same API each see every new item once. What a step returns is remembered as soon as the step completes.

## Filter — gating the run

One operator, deciding whether the workflow proceeds.

<!-- sovrium:options FilterContinueActionSchema -->

```yaml
- name: onlyPaid
  type: filter
  operator: continue
  props:
    condition:
      conditions:
        - field: '{{trigger.data.record.status}}'
          operator: equals
          value: paid
    onFalse: stop
```

`onFalse` is `stop`, which halts the run, or `skip`, which moves to the next action. It defaults to `stop`.

This is the tool for narrowing a trigger that cannot narrow itself: an auth trigger fires on every sign-up, and a filter as the first step reduces it to the sign-ups the automation is about. Reach for a branch instead when both outcomes need to _do_ something — a filter has only one live path.
