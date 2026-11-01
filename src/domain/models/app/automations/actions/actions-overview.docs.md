# Automation Actions Overview

> The action model (a type and an operator selecting the operation, and a props object carrying its inputs), plus the base properties every action accepts.

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

| Element    | Selects                                                                  |
| ---------- | ------------------------------------------------------------------------ |
| `type`     | The action **family** (`http`, `record`, `email`), and so the capability |
| `operator` | The **operation** within that family, which decides the shape of `props` |
| `props`    | The operation's inputs; string values interpolate template variables     |

## Base properties

Every action accepts these, whatever its type and operator.

<!-- sovrium:options ActionBaseSchema -->

`name` is how later steps reference this one's output as `{{name.result}}`, so it must match `^[a-zA-Z][a-zA-Z0-9_]*$` and is required. `timeout` accepts 1000 to 900000 milliseconds.

### Two timeouts, two scopes

The top-level `timeout` fences the **whole action** and is enforced for every action type by the run loop. A `props.timeout` (on an HTTP call, a code step, a call into another automation) fences that handler's own internal operation. Both can be set, and the smaller wins. For a code step, both stop the running code itself, not only the wait for it.

## Conditional execution

There is no per-action `condition` property. Branching and skipping are dedicated control-flow actions instead:

- **`filter` / `continue`** evaluates a condition group and, on false, stops the run or skips to the next action.
- **`path` / `branch`** routes into named branches by per-branch conditions.

Keeping this in actions rather than as a field on every action is what makes a run's shape visible in the step list: a skipped step is recorded as `skipped`, where a per-action condition would have left no trace at all.

## The families

One row per family the schema accepts, with every operator it accepts and the article that documents them. The `instance` family supervises other apps on the same machine and is off unless the operator enables it. The `app` family seeds or resets the app itself and is off unless the host enables it.

| Family         | Operators                                                                                                                                                                                     | Documented in                                                                                              |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `data`         | set, aggregate, sort, limit, deduplicate, merge, split, compare, lookup                                                                                                                       | [Data & State Actions](/en/docs/automation-data-actions)                                                   |
| `state`        | get, set, increment, delete, list, filterNew                                                                                                                                                  | [Data & State Actions](/en/docs/automation-data-actions)                                                   |
| `filter`       | continue                                                                                                                                                                                      | [Flow Control Actions](/en/docs/automation-flow-control)                                                   |
| `path`         | branch                                                                                                                                                                                        | [Flow Control Actions](/en/docs/automation-flow-control)                                                   |
| `loop`         | each                                                                                                                                                                                          | [Flow Control Actions](/en/docs/automation-flow-control)                                                   |
| `flow`         | stop                                                                                                                                                                                          | [Flow Control Actions](/en/docs/automation-flow-control)                                                   |
| `crypto`       | hash, hmac, sign, verify                                                                                                                                                                      | [Crypto & Digest Actions](/en/docs/automation-crypto-digest)                                               |
| `digest`       | collect, release                                                                                                                                                                              | [Crypto & Digest Actions](/en/docs/automation-crypto-digest)                                               |
| `date`         | format, parse, add, subtract, diff, startOf, endOf, now                                                                                                                                       | [Date Actions](/en/docs/automation-date-actions)                                                           |
| `automation`   | call, return                                                                                                                                                                                  | [Sub-Workflow Actions](/en/docs/automation-subworkflows)                                                   |
| `approval`     | request                                                                                                                                                                                       | [Approval & Delay Actions](/en/docs/automation-approval-delay)                                             |
| `delay`        | wait, queue, webhook                                                                                                                                                                          | [Approval & Delay Actions](/en/docs/automation-approval-delay)                                             |
| `code`         | runTypescript                                                                                                                                                                                 | [Code Actions](/en/docs/automation-code-actions)                                                           |
| `browser`      | run, agent                                                                                                                                                                                    | [Browser Actions](/en/docs/automation-browser-actions), [Browser Agent](/en/docs/automation-browser-agent) |
| `instance`     | status, usage, start, stop, restart, apply, rollback, remove, health, logs, backup, restore, seed, engineInstall, enginePrune                                                                 | [Instance Actions](/en/docs/automation-instance-actions)                                                   |
| `app`          | seed                                                                                                                                                                                          | [App Actions](/en/docs/automation-app-actions)                                                             |
| `http`         | request, get, post, put, patch, delete                                                                                                                                                        | [HTTP & Webhook Actions](/en/docs/automation-http-actions)                                                 |
| `webhook`      | send, response                                                                                                                                                                                | [HTTP & Webhook Actions](/en/docs/automation-http-actions)                                                 |
| `connection`   | call                                                                                                                                                                                          | [Connection Operations](/en/docs/automation-connection-operations)                                         |
| `record`       | create, read, list, update, delete, upsert, batchCreate, batchUpdate, batchDelete, batchUpsert, aggregate                                                                                     | [Record Actions](/en/docs/automation-record-actions)                                                       |
| `calendar`     | importIcs, exportIcs                                                                                                                                                                          | [Calendar Actions](/en/docs/automation-calendar-actions)                                                   |
| `file`         | upload, download, delete, copy, move, list, getMetadata, signUrl, generateCsv, parseCsv, parseXlsx, extractText, extractAudio, transformImage, compress                                       | [File Actions](/en/docs/automation-file-actions)                                                           |
| `document`     | generatePdf, generateImage, generateDocx, generateXlsx, convert                                                                                                                               | [Document Actions](/en/docs/automation-document-actions)                                                   |
| `pdf`          | merge, split, pages, watermark, stamp, fillForm, inspect, fromImages                                                                                                                          | [PDF Actions](/en/docs/automation-pdf-actions)                                                             |
| `email`        | send, suppress, stats                                                                                                                                                                         | [Email & Notification Actions](/en/docs/automation-email-actions)                                          |
| `analytics`    | track                                                                                                                                                                                         | [Email & Notification Actions](/en/docs/automation-email-actions)                                          |
| `notification` | create                                                                                                                                                                                        | [Notification Actions](/en/docs/automation-notification-actions)                                           |
| `comment`      | create, list, update, delete, moderate                                                                                                                                                        | [Comment Actions](/en/docs/automation-comment-actions)                                                     |
| `link`         | create, update, delete                                                                                                                                                                        | [Link Actions](/en/docs/automation-link-actions)                                                           |
| `ai`           | generate, classify, extract, transcribe, agent                                                                                                                                                | [AI Actions](/en/docs/automation-ai-actions)                                                               |
| `auth`         | createUser, assignRole, banUser, unbanUser, addToGroup, removeFromGroup, inviteUser, grantAccess, revokeAccess, listGrantees, registerOAuthClient, rotateOAuthClientSecret, deleteOAuthClient | [Auth Actions](/en/docs/automation-auth-actions)                                                           |
| `sovrium`      | validateConfig, validateBundle                                                                                                                                                                | [Validation & Schema Generation](/en/docs/cli-validate)                                                    |
| `ref`          | none: it is the one action with no operator                                                                                                                                                   | [Reusable Actions](/en/docs/reusable-actions)                                                              |

## A step used twice

A step used by more than one automation does not have to be copied into each. Declare it once in the top-level `actions` array and invoke it with a `ref` action, which is the one action type taking no `operator`.
