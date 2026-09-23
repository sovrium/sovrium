# Automation Actions Overview

> The action model — a type and an operator selecting the operation, and a props object carrying its inputs — plus the base properties every action accepts.

Actions are the individual steps an automation runs. Every one shares the same shape: a **`type`** and an **`operator`** that together select the operation, and a **`props`** object carrying its inputs. Steps run top to bottom unless a branch or loop action moves execution elsewhere.

```yaml
automations:
  - name: enrich-signup
    trigger: { type: auth, events: [signUp] }
    actions:
      - name: fetchUser
        type: http
        operator: get
        props:
          url: 'https://api.example.com/users/{{trigger.data.userId}}'
          connection: example-api
```

| Element    | Selects                                                                   |
| ---------- | ------------------------------------------------------------------------- |
| `type`     | The action **family** — `http`, `record`, `email` — and so the capability |
| `operator` | The **operation** within that family, which decides the shape of `props`  |
| `props`    | The operation's inputs; string values interpolate template variables      |

## Base properties

Every action accepts these, whatever its type and operator.

<!-- sovrium:options ActionBaseSchema -->

`name` is how later steps reference this one's output as `{{name.result}}`, so it must match `^[a-zA-Z][a-zA-Z0-9_]*$` and is required. `timeout` accepts 1000 to 900000 milliseconds.

### Two timeouts, two scopes

The top-level `timeout` fences the **whole action** and is enforced for every action type by the run loop. A `props.timeout` — on an HTTP call, a code step, a call into another automation — fences that handler's own internal operation. Both can be set, and the smaller wins.

## Conditional execution

There is no per-action `condition` property. Branching and skipping are dedicated control-flow actions instead:

- **`filter` / `continue`** evaluates a condition group and, on false, stops the run or skips to the next action.
- **`path` / `branch`** routes into named branches by per-branch conditions.

Keeping this in actions rather than as a field on every action is what makes a run's shape visible in the step list: a skipped step is recorded as `skipped`, where a per-action condition would have left no trace at all.

## The families

| Family       | Operators                                                                                                                                                            |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data`       | set, aggregate, sort, limit, deduplicate, merge, split, compare, lookup                                                                                              |
| `state`      | get, set, increment, delete, list                                                                                                                                    |
| `filter`     | continue                                                                                                                                                             |
| `crypto`     | hash, hmac                                                                                                                                                           |
| `digest`     | collect, release                                                                                                                                                     |
| `date`       | format, parse, add, subtract, diff, startOf, endOf, now                                                                                                              |
| `http`       | request, get, post, put, patch, delete                                                                                                                               |
| `webhook`    | send, response                                                                                                                                                       |
| `record`     | create, read, list, update, delete, upsert, batchCreate, batchUpdate, batchDelete, batchUpsert                                                                       |
| `file`       | upload, download, delete, copy, move, list, getMetadata, signUrl, generatePdf, generateCsv, parseCsv, generateXlsx, parseXlsx, extractText, transformImage, compress |
| `path`       | branch                                                                                                                                                               |
| `loop`       | each                                                                                                                                                                 |
| `automation` | call, return                                                                                                                                                         |
| `flow`       | stop                                                                                                                                                                 |
| `email`      | send                                                                                                                                                                 |
| `analytics`  | track                                                                                                                                                                |
| `link`       | create, update, delete                                                                                                                                               |
| `ai`         | generate, classify, extract, agent                                                                                                                                   |
| `approval`   | request                                                                                                                                                              |
| `delay`      | wait, queue, webhook                                                                                                                                                 |
| `auth`       | createUser, assignRole, banUser, unbanUser                                                                                                                           |
| `code`       | runTypescript                                                                                                                                                        |
| `sovrium`    | validateConfig                                                                                                                                                       |
| `ref`        | none — it is the one action with no operator                                                                                                                         |

## A step used twice

A step used by more than one automation does not have to be copied into each. Declare it once in the top-level `actions` array and invoke it with a `ref` action, which is the one action type taking no `operator`.
