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
| `context.log`       | `info`, `warn`, `error` — typed and callable, but see below                         |
| `context.run`       | Metadata for this call; `context.run.attempt` is the 1-indexed retry attempt number |

There is **no `context.trigger` and no `context.steps`**. The trigger payload and the outputs of earlier steps reach the code only as template references declared in `inputData`, which keeps a code action a pure function of its declared inputs. That is what makes it possible to read a run's history and know what a code step saw, instead of having to re-execute it.

### `context.log` does not emit anything yet

All three methods accept their arguments and discard them. Nothing reaches standard output, the run history, or error tracking. The surface is typed and stable so that code written against it keeps working unchanged once a sink is wired, but **today it is a no-op** — do not reach for it to debug a step.

Anything a code action has to surface belongs in its **return value**, which is persisted as the step output and visible in run history, or in a **thrown error**, which fails the step visibly.

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
