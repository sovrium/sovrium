# Code Actions

> Running custom TypeScript as a step, with a typed context that can invoke other actions — and the two things that context deliberately does not carry.

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
| `context.log`       | `info`, `warn`, `error` (and `debug`) — each call is kept in the step's run log     |
| `context.run`       | Metadata for this call; `context.run.attempt` is the 1-indexed retry attempt number |

There is **no `context.trigger` and no `context.steps`**. The trigger payload and the outputs of earlier steps reach the code only as template references declared in `inputData`, which keeps a code action a pure function of its declared inputs. That is what makes it possible to read a run's history and know what a code step saw, instead of having to re-execute it.

An `inputData` value that is exactly one reference, such as `'{{listTasks.records}}'`, arrives as the value it names: a list stays a list, a record an object, a number a number. A value that uses a helper, such as `'{{number trigger.data.amount}}'`, or a reference to a text, is rendered and then read back as a number, `true`/`false` or JSON when it is one, as before. Text around a reference (`'order-{{trigger.data.id}}'`) stays text.

A `$env.NAME` written in `inputData` is resolved before its templates, like any other property you write, so `context.inputData` carries the value while text a template brings in stays as it arrived. The properties the code itself passes to `context.actions` are values, not configuration, and are used as given: a `$env.NAME` string among them is sent as written, never resolved, and `{{…}}` text is never rendered as a template. Read a variable from `context.env` and pass its value instead, and render any template text in the code before passing it. The same holds for the `vars` given to `context.actions.ref`: the template's own definition is filled in, its `$env.` references and `{{…}}` templates included, and each variable is then inserted as the value it is.

### `context.log` writes to the step's run log

Each call to `context.log.info`, `warn`, `error` or `debug` adds one entry — its level and its arguments joined into one message — to the step's log, in call order. The log is kept whether the step succeeds or throws, and is returned with the step by `GET /api/automations/runs/:id` as `steps[].logs`. It is redacted like everything else a step persists: an environment value or a connection secret in a message is replaced with `***`. A step keeps at most 200 entries of up to 2 000 characters each.

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

## Checked at startup, fenced at runtime

The `execute` body is type-checked when the app boots, so a malformed function fails immediately rather than in the middle of a run at three in the morning. At runtime the step is fenced by `props.timeout` for its own work, and by the action's top-level `timeout` for the step as a whole; the smaller wins.
