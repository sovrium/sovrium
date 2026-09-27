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
