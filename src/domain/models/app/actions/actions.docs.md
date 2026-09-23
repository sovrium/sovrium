# Reusable Actions

> Declare a step once in the top-level `actions` library and invoke it from any automation with a `ref`, so a shared step has one source of truth.

The same step usually appears in several automations: a chat alert, an audit-log write, a call to an internal API. Copying it into each one means every future change has to be made in every copy.

`actions` is a library of named templates. Define the step once, with `$variable` placeholders where the inputs differ:

```yaml
actions:
  - name: notify-slack
    action:
      type: http
      operator: post
      props:
        url: $env.SLACK_WEBHOOK_URL
        body: { text: '$message' }
```

Then invoke it from any automation, passing the values:

```yaml
automations:
  - name: order-alert
    trigger: { type: record, table: orders, events: [create] }
    actions:
      - name: alert
        $ref: notify-slack
        $vars: { message: 'New order recorded.' }
```

## Template properties

<!-- sovrium:options ActionTemplateSchema depth=1 -->

`name` is a kebab-case identifier, unique across the app, and is what `$ref` resolves. `action` is the step itself — any `type` and `operator` pair an automation step accepts.

### The template has no step name

Inside an automation, `name` is how a later step references an output, so it belongs to the **call site** rather than to the template. That is why `action` is a nested block: the template declares what to do, and the invocation declares what to call it.

## Invoking a template

<!-- sovrium:options ActionRefSchema -->

Writing `type: ref` is optional — a `$ref` is unambiguous on its own, so `{ name: alert, $ref: notify-slack }` and the explicit form are the same action. The call site's `name` is what run history records, not the template's.

## Variables

A placeholder is a `$` followed by an alphanumeric name: `$message`, `$channel`.

| Rule               | Detail                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------ |
| Where they resolve | In any string value, at any depth inside the template's `action` block                     |
| Precedence         | `$vars` at the call site wins over the template's own `variables` defaults                 |
| Unknown names      | Left untouched, so `$env.SLACK_WEBHOOK_URL` and `{{trigger.data.id}}` survive substitution |

That last rule is what lets a template mix all three reference families. Declare the defaults you want, and leave environment references and automation template variables to be resolved later by their own engines.

```yaml
actions:
  - name: notify-team
    variables:
      channel: general
      message: Something happened.
    action:
      type: http
      operator: post
      props:
        url: $env.SLACK_WEBHOOK_URL
        body: { channel: '$channel', text: '$message' }

automations:
  - name: order-alert
    trigger: { type: record, table: orders, events: [create] }
    actions:
      - { name: alert, $ref: notify-team, $vars: { message: 'New order.' } }
      - { name: escalate, $ref: notify-team, $vars: { channel: ops, message: 'Check stock.' } }
```

## Exposing a template to AI

A template carrying an `aiAccess` block becomes a directly invocable MCP tool named after the app and the template, with its `variables` as the tool's parameters — so the declaration that makes a step reusable also makes it callable.

```yaml
actions:
  - name: archive-order
    variables:
      reference: ''
    action:
      type: record
      operator: update
      props:
        table: orders
        filter:
          conditions: [{ field: reference, operator: equals, value: '$reference' }]
        data: { archived: true }
    aiAccess:
      description: Archive one order by its reference.
      annotations: { readOnly: false, destructive: false, idempotent: true }
```

Whether the server actually mounts those tools stays an operator decision, governed by an environment variable rather than by the configuration.

## What is refused

| Rule               | Detail                                                                                        |
| ------------------ | --------------------------------------------------------------------------------------------- |
| Unique names       | A duplicate would make a `$ref` ambiguous, so it is refused when the configuration is decoded |
| `ref` is reserved  | The name collides with the method exposed to code-action bodies, and is refused by name       |
| References resolve | A `$ref` naming a template that does not exist is caught at startup, before anything can run  |

## When not to reach for a template

A step used by exactly one automation belongs inline in that automation. A template referenced from a single call site adds indirection without removing any duplication, and the indirection is paid on every later reading of both files.
