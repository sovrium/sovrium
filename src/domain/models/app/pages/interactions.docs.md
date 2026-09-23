# Interactions & Auto-Save

> Declarative client-side behaviour — click, hover, scroll and entrance triggers, action response handlers, and inline-edit auto-save. No JavaScript from you.

Two modules cover almost everything a page does in the browser: `interactions` attaches behaviour to a component, and `action` says what running it does. Inline-edit auto-save builds on both.

```yaml
pages:
  - name: Settings
    path: /settings
    components:
      - type: button
        content: Save
        interactions:
          click: { animation: pulse, submitForm: settings-form }
        action:
          type: crud
          operation: update
          table: settings
          onSuccess: { type: message, toast: { variant: success, message: 'Saved' } }
```

## The `interactions` module

Four independent triggers. Each is optional and they combine freely.

<!-- sovrium:options InteractionsSchema depth=1 -->

**These keys have no `on` prefix.** It is `interactions.click`, not `interactions.onClick`. An `on`-prefixed key is dropped at decode, so the interaction validates and then never fires.

### `click`

<!-- sovrium:options ClickInteractionSchema -->

Behaviours combine: play an animation, then navigate.

### `hover`

<!-- sovrium:options HoverInteractionSchema -->

All hover effects apply together, on one coordinated transition. A `duration` of `0` applies the effect instantly.

### `scroll`

<!-- sovrium:options ScrollInteractionSchema -->

`scroll` fires on viewport entry, and is the one that takes `threshold` and `once`.

### `entrance`

<!-- sovrium:options EntranceAnimationSchema -->

`entrance` fires once on load. `stagger` is the delay between sibling animations.

## Actions and response handlers

An `action` says what a button or form does — `crud`, `auth`, `navigate`, `fetch` or `automation` — and `onSuccess` / `onError` say what happens next.

A `crud` action needs `operation` (`create`, `update`, `delete`) **and** `table`. `confirm` gates it behind a dialog, with `confirmMessage` supplying the wording.

A response handler's `type` is `navigate`, `reset`, `message`, `successPage` or `role-landing`. Alongside it, `toast` shows a notification (`variant` is `success`, `error`, `warning` or `info`), `message` and `title` set inline copy, and `actions` renders follow-up buttons on a success page.

```yaml
tables:
  - name: tasks
    fields:
      - { name: title, type: single-line-text }
pages:
  - name: Task
    path: /tasks/:id
    components:
      - type: button
        content: Delete
        action:
          type: crud
          operation: delete
          table: tasks
          confirm: true
          confirmMessage: 'Delete this task? This cannot be undone.'
          onSuccess: { type: navigate, navigate: /tasks }
          onError: { type: message, toast: { variant: error, message: 'Delete failed' } }
```

### Showing what came back

An `action` of `type: fetch` calls a URL directly, and its `onSuccess` can do more than raise a toast. `status` writes a message into a sibling element named by its `props.id` and promotes that element to a live region — the badge that stays on screen after a transient toast has gone.

Inside `status.message`, `$response.<field>` resolves against the JSON body the call returned, addressed by dot path. It is the one place a page can show a value the server produced: everywhere else on the action, references travel the other way — `$record.<field>` carries values _into_ the request.

Three rules worth knowing before you write one:

- **The path walks the body.** `$response.token` reaches a field at the top level; `$response.fields.title` reaches one nested a level down.
- **A path the body does not carry resolves to the empty string**, never to the literal token — for the same reason form success copy resolves an absent `$record.<column>` to nothing: a token left on screen reads as a value.
- **The value is written as text.** A field containing `<b>x</b>` shows those characters rather than emboldening anything.

A `mode: download` action runs the same handler but reads a file rather than a JSON body, so every `$response.` reference there resolves empty.

### Refreshing a list after the action

`onSuccess.refetch` names one or more sibling components by their `props.id` and makes them re-read their data, so a list reflects a write without a reload. It works for both kinds of bound component: one that renders in the browser re-queries in place, and a server-rendered one has its rows re-read and redrawn. Pass a list of ids to refresh several at once.

One case is left alone deliberately: a server-rendered region whose own rows contain an interactive component is skipped rather than redrawn, because replacing it would discard the running component inside it. Bind that case to a `table` instead, which refreshes itself.

### Recomposing the whole page

`refetch` re-queries one named region. There is a second thing it cannot reach: anything the **server read before composing a byte** — the page's own language, the signed-in name in the chrome, any setting resolved at render time. The write lands, the toast confirms it, and the page keeps showing the value it was built with.

`onSuccess.reload: true` closes that: on a successful response the browser re-requests the document and the server composes it again, so every server-read value is re-read at once. It is the blunt instrument, deliberately — the narrow one is already there — and it costs three things:

- **`status` and `refetch` are refused beside it, at config load.** Both write into, or re-read part of, the document the reload is about to replace, so declaring either alongside `reload` is two answers to one question. The refusal names both keys and says which to keep. Nothing is silently dropped.
- **The toast's `message` is required and is not displayed.** `message` is a required part of every success handler, so `reload` cannot make it optional without re-shaping the handler for the endpoint form and the file upload too. It stays as the config's own record of what succeeded. If the confirmation has to survive, you want `status` on a page that does not reload.
- **It belongs to the success branch only.** A failed request does not reload, so the error toast stays on screen and readable.

## Auto-save

Data components support inline-edit auto-save through the `autoSave` module, most often on `table`.

<!-- sovrium:options AutoSaveConfigSchema -->

Only the changed cell is sent in the `PATCH` payload, rapid edits batch into one request, and navigating away flushes anything still pending.

## `reorderable-list`

A list whose items can be reordered by drag or keyboard, firing an action when the order settles. `dataSource` optionally binds the items to a table, `children` holds them — each rendered with a drag handle — and `onReorder` names the action to invoke. It **must** be a toast action (`{ type: toast, message, variant, duration }`): that is the only type a reorder runs, and `duration` is in milliseconds and overrides the usual dismissal rules.
