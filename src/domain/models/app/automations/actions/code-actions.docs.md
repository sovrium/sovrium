# Code Actions

> Running custom TypeScript as a step, with a typed context that can invoke other actions, and the two things that context deliberately does not carry.

The `code` family runs custom TypeScript for logic the declarative actions do not cover. One operator, `runTypescript`. The source is a named `execute(context)` function whose body is **type-checked when the server starts**.

<!-- sovrium:options CodeRunTypescriptActionSchema -->

`code` is required. In a TypeScript configuration, wrapping the function with `String(function execute(context: CodeContext) { … })` gets editor autocompletion over the context. `props.timeout` accepts 1000 to 300000 milliseconds and defaults to 30000.

## The context

The `execute` function receives an object with exactly five members.

| Member              | Carries                                                                             |
| ------------------- | ----------------------------------------------------------------------------------- |
| `context.inputData` | The template-resolved inputs declared in the `inputData` property                   |
| `context.actions`   | Native actions and reusable templates, invocable from inside the code               |
| `context.env`       | Environment variables, with sensitive values redacted in logs                       |
| `context.log`       | `info`, `warn`, `error` (and `debug`): each call is kept in the step's run log      |
| `context.run`       | Metadata for this call; `context.run.attempt` is the 1-indexed retry attempt number |

There is **no `context.trigger` and no `context.steps`**. The trigger payload and the outputs of earlier steps reach the code only as template references declared in `inputData`, which keeps a code action a pure function of its declared inputs. That is what makes it possible to read a run's history and know what a code step saw, instead of having to re-execute it.

An `inputData` value that is exactly one reference, such as `'{{listTasks.records}}'`, arrives as the value it names: a list stays a list, a record an object, a number a number. A value that uses a helper, such as `'{{number trigger.data.amount}}'`, or a reference to a text, is rendered and then read back as a number, `true`/`false` or JSON when it is one, as before. Text around a reference (`'order-{{trigger.data.id}}'`) stays text. A trigger's relationship or single user field is the exception: `'{{trigger.data.record.contact}}'` arrives as the related record's id, the same value a trigger `condition` compares, so it can be handed straight to a record action. Reach through the field for a column of the related record: `'{{trigger.data.record.contact.first_name}}'`.

A `$env.NAME` written in `inputData` is resolved before its templates, like any other property you write, so `context.inputData` carries the value while text a template brings in stays as it arrived. The properties the code itself passes to `context.actions` are values, not configuration, and are used as given: a `$env.NAME` string among them is sent as written, never resolved, and `{{…}}` text is never rendered as a template. Read a variable from `context.env` and pass its value instead, and render any template text in the code before passing it. The same holds for the `vars` given to `context.actions.ref`: the template's own definition is filled in, its `$env.` references and `{{…}}` templates included, and each variable is then inserted as the value it is.

### An action called from code is checked like a step

An `http`, `webhook` or `connection` call made from code is checked against the settings of the same step written in the configuration, before anything is sent, and so is one an agent's tool call or an MCP action call makes. A setting the step would refuse fails the step with an error naming it and what it must be, such as ``http.post refused: `timeout` — Expected a value between 1000 and 120000``. The value itself is never repeated in the error, and the step is not retried: it would be refused the same way. Nothing is adjusted on the way:

- An `http` or `connection.call` `timeout` outside 1000 to 120000 milliseconds, or given as text such as `'5000'`, is refused rather than brought into range or read as a number.
- A `connection.call` `paginate` of zero, above 1000 or with a fraction is refused rather than cut to 1000 pages.
- `http.request` without a `method` is refused rather than sent as a GET.
- `webhook.send` takes only the methods `GET`, `POST`, `PUT`, `PATCH` and `DELETE`.

Values keep the types they are passed with, as they do when a configured step's templates fill them in: a header value may be a number, sent as its text, and a body may be a list, sent as JSON.

### Writing records from code

`context.actions.record.<operator>(props)` takes the same props as the matching `record` step, and resolves to that step's output. `update` and `upsert` name their row by an `id` or by a `filter`, from code as in a configured step.

| Call                                           | Names the row(s) by                                    | Resolves to                                              |
| ---------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------- |
| `record.create({ table, data })`               | —                                                      | `{ id }` of the new row                                  |
| `record.update({ table, id, data })`           | `id`, or a `filter` such as `id equals`                | `{ updated, ids }`: how many rows changed, and their ids |
| `record.upsert({ table, id or filter, data })` | `id` or `filter`; creates the row when nothing matches | `{ operation: 'created' or 'updated', id }`              |
| `record.delete({ table, filter })`             | `filter`                                               | `{ deletedCount }`                                       |

An update that names no row (neither an `id` nor a `filter`) fails the step with an error saying so, rather than reporting a success that changed nothing. An update whose filter matches nothing succeeds with `{ updated: 0, ids: [] }`.

### Managing accounts from code

`context.actions.auth.<operator>(props)` takes the props of the matching `auth` step. `await context.actions.auth.addToGroup({ userId, group })` and `removeFromGroup({ userId, group })` resolve to `{ userId, group, changed }`; a group the configuration does not declare rejects the call, and the run fails unless the code catches it.

```yaml
- name: qualify
  type: code
  operator: runTypescript
  props:
    inputData: { membershipId: '{{trigger.data.record.id}}' }
    code: |
      async function execute(context) {
        const result = await context.actions.record.update({
          table: 'memberships',
          id: context.inputData.membershipId,
          data: { status: 'Qualified' },
        })
        return { qualified: result.updated }
      }
```

### PDF, document, file and browser calls are checked too

A `pdf`, `document`, `file` or `browser` call made from code, an agent's tool call or an MCP action call is checked against the settings of the same step in the configuration before any file is read, written or a browser opened. A setting the step would refuse fails the step naming it, such as ``pdf.watermark refused: `opacity` — Expected a value between 0 and 1``, the step is not retried, and nothing is written. Nothing is defaulted or adjusted on the way:

- A step without `output` is refused rather than written under a default name.
- A number outside its allowed range (an `opacity` above 1, a negative `margin`, an image `width` of zero, a `quality` of 0, a browser step's `timeoutMs` beyond its limit) is refused rather than replaced by a default.
- A number given as text, such as `width: '800'`, and `flatten: 'true'` given as text, are refused rather than read as a number or a boolean.
- A value outside a list (a page size, an orientation, an image format, a position, a `fit`, a browser step's `do`) is refused rather than ignored or guessed.

A browser agent's `credentials` take only `$env.NAME` and `{{totp $env.NAME}}` values, from code as in the configuration, and its `maxSteps` is at most 100. The code's source is a property you write, so a whole `$env.NAME` in it is replaced by its value before the code runs, and that value is then refused as a secret written out: build the reference in the code instead, as `'$' + 'env.PORTAL_PASSWORD'`. A value keeps the type the code passes: a number read from a loop item, passed as `width`, is accepted; the same number passed where text is expected, such as a file name, is used as its text.

### `context.log` writes to the step's run log

Each call to `context.log.info`, `warn`, `error` or `debug` adds one entry (its level and its arguments joined into one message) to the step's log, in call order. The log is kept whether the step succeeds or throws, and is returned with the step by `GET /api/automations/runs/:id` as `steps[].logs`. It is redacted like everything else a step persists: an environment value or a connection secret in a message is replaced with `***`. A step keeps at most 200 entries of up to 2 000 characters each.

The log is for narrating what the step decided; anything a later step has to read still belongs in the **return value**, which is persisted as the step output, or in a **thrown error**, which fails the step visibly.

```yaml
- name: enrich-lead
  type: code
  operator: runTypescript
  props:
    inputData: { url: '{{trigger.data.profile_url}}' }
    code: |
      async function execute(context) {
        const res = await context.actions.http.get({ url: context.inputData.url })
        return { score: res.body.score, status: res.status, fetchedAt: new Date().toISOString() }
      }
```

## Checked at startup, stopped at its timeout

The `execute` body is type-checked when the app boots, so a malformed function fails immediately rather than in the middle of a run at three in the morning.

Each code step runs on a thread of its own, started for the step and stopped when it ends. `props.timeout` (default 30 000 ms) and the action's top-level `timeout` both **stop the step** when they elapse, whatever the code is doing, a tight loop included; the smaller wins. The step fails with `code action exceeded timeout of <n>ms` and the run goes on as for any failed step. While a step computes, the app keeps answering: pages, the API, webhooks and other automations do not wait for it.

- **What the step had already done stays done.** An action called through `context.actions` before the timeout keeps its effect; one still in flight finishes on its own and its result is dropped. Nothing is rolled back.
- **Each run starts clean.** Nothing a step leaves in a variable or on a global survives into the next run.
- **The environment is the declared one.** The thread the step runs on is given only the variables the app's `env` declares, the same values `context.env` holds; the server's own variables (its database address, its secrets) are not in it.
- **The context is data.** `context.inputData`, `context.env` and `context.run` reach the code as copies of plain data (text, numbers, booleans, `null`, lists, objects, dates), and `context.actions` and `context.log` are the same calls as ever. A value that cannot be copied fails the step before the code runs, naming its path, never its content.
- **Memory is the process's.** A step's memory is the server's memory, bounded by the limit you set on the process (see "A memory limit" in **Environment Variables: Hosting Under a Supervisor**). A step that allocates without end can still exhaust it.
- **It is not a sandbox.** Running on its own thread protects the app's availability, not the host from the code: the code is your own, as trusted as the configuration it sits in, and an app that must not run arbitrary code declares no code step. The globals the code sees (the JavaScript standard library, `Buffer`, WebCrypto, `Intl`) are unchanged. A code step also reaches the network without the private-network guard that every http, webhook and connection request passes, so it can call an internal address or a cloud metadata endpoint: never let an untrusted author write one.

There is no setting to run code steps on the server's own thread.

## Code an agent writes

An agent can hold the same action as `code.runTypescript` in its `tools.actions`, and then the code is written by its model rather than by you. Only an agent no person can reach may hold it: one whose `permissions.trigger` is `none`, run by automation `agent` steps and its own schedule. An agent that people can chat with or call refuses the configuration when it lists the action, and a chat never offers or runs it. When people need what some code computes, write the code in a step like the ones above and let them start the automation.
