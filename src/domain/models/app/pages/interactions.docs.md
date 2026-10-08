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

An `action` says what a button or form does — `crud`, `auth`, `navigate`, `fetch`, `automation` or `fill` — and `onSuccess` / `onError` say what happens next.

A `crud` action needs `operation` (`create`, `update`, `delete`) **and** `table`. `confirm` gates it behind a dialog, with `confirmMessage` supplying the wording.

A form whose `auth` action has `method: logout` is a sign-out control: it renders only its button — `submitLabel` names it — with no email or password to fill, and pressing it ends the session.

```yaml
components:
  - type: form
    action: { type: auth, method: logout, submitLabel: Sign out }
```

Beyond signing in and out, an `auth` action covers the account pages:

- **Second factor** — `verifyTwoFactor` checks the code after a password (`factor` is `totp` for an authenticator code or `backupCode` for a recovery code, and `trustDevice` offers "Trust this device"); `enableTwoFactor` asks for the password, then walks the reader through the QR code, a first code and the recovery codes, shown once; `disableTwoFactor` turns it off after the password. A password sign-in on an account with two-step on does not navigate: the form says a code is needed, and the page's `verifyTwoFactor` form finishes the sign-in and follows its own `onSuccess.navigate`.
- **Invitations** — on a page declaring `invitation`, `acceptInvitation` asks the invitee for a password, creates her account, signs her in and follows `onSuccess.navigate`; `declineInvitation` ends the invitation, so its link stops offering anything. Both read the token from the address: `?token=`, or the key the page's `invitation.param` names. `resendInvitation` and `revokeInvitation` act on one pending invitation.
- **The reader's credentials** — `createApiKey` asks for a name, creates the key and shows it once — Done stays disabled until the reader ticks that they copied it; `revokeOtherSessions` signs out every session but the current one; `revokeApiKey`, `renamePasskey`, `removePasskey` and `revokeSession` act on one of the reader's own keys, passkeys and sessions.
- **Roles** — `setRole` changes one member's role to the value picked in its `editSelect`, for a reader allowed to administer accounts.

An `auth` form's submit is drawn with the primary fill. When a page holds two whose answers are not equal — declining an invitation beside accepting it, a magic link offered beside a password — `submitVariant` gives the lesser one its weight, in the words a `button` accepts (`secondary`, `outline`, `ghost`, …), and it is drawn exactly like a `button` of that variant. It weighs every form drawn as fields plus a submit — sign-in, sign-up and the password and magic-link methods, the second factor, the invitations and the reader's credentials and roles. The single-button sign-ins draw their own button and ignore it: a social sign-in (`strategy: oauth`), a single sign-on (`strategy: sso`), a passkey sign-in (`strategy: passkey`) and adding a passkey (`registerPasskey`).

Every method acting on one item takes `target`, almost always `$record.id` from the row it sits in. An item that is not the reader's own, or a member the reader may not administer, answers exactly like one that does not exist. A form running a method on the reader's own account is not drawn for a visitor who is not signed in, and one acting on another member is not drawn for a reader who may not administer accounts.

A response handler's `type` is `navigate`, `reset`, `message`, `successPage` or `role-landing`. Alongside it, `toast` shows a notification (`variant` is `success`, `error`, `warning` or `info`), `message` and `title` set inline copy, and `actions` renders follow-up buttons on a success page.

A response's `navigate`, a success page's `redirect` and each follow-up button's `url` go to an `http://` or `https://` address or to a path on this site (`/done`, `done`, `?saved=1`, `#top`), on a button as on a form. The scheme is written out, never supplied by a `$record.` variable, and `sovrium validate` refuses any other address — `javascript:`, `data:`, `mailto:`, or one starting with `//` — naming the field.

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

### Before the page's script has run

A button whose `action` is `fetch`, `automation`, `auth` or `toast` is carried out by the page's script, which loads just after the page appears. Until it has run, the button is drawn disabled, then enabled, so a press on a slow connection is never silently lost — no confirm dialog that never opens, no request that never leaves. On a fast connection the window is too short to notice. A button you declare `disabled` stays disabled.

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

### Opening an address in a new tab

`openInNewTab: true` on a navigate action — a row click, or a `fetch` action in `mode: navigate` — opens the address in a new tab that gets no handle on the page, and an address that is not a same-origin path or an `http(s)` URL is not followed.

The address is built from the row (`$record.<field>`), and a row holds whatever was imported, so every navigation checks it first — a new tab or not. On a `fetch` action the key is refused at config load in any mode other than `navigate`, since a request opens no page.

```yaml
action:
  type: fetch
  mode: navigate
  url: 'https://docs.google.com/spreadsheets/d/$record.sheet_id'
  openInNewTab: true
```

### Filling a form field

A `fill` action writes a value into a form control on the same page, as if the reader had typed it: the message box of a composer takes the text of a saved script the reader clicks. Nothing is sent; the form submits the value the way it submits anything typed.

`target` is the `props.id` of the component holding the control — a `form`, with `field` naming the control by its field name, or a standalone `input` or `textarea`, with no `field`. `value` is a literal, a `$record.<field>` read from the record the trigger belongs to, or a template mixing both. `mode: replace`, the default, overwrites what the control holds; `mode: append` adds the value after it, exactly as written — put a leading space or line break in `value` if one is needed — and leaves the cursor at the end so the reader can keep typing. The control takes the focus and raises the same `input` event typing does.

A button anywhere on the page, a button in each row of a list template, a list item's `onRowClick` and a board's drop hook can all run it. Those are the only places a `fill` runs: on a drawer footer button, a stepper's `onFinish` or a file upload's `uploadAction` it is refused when the config is validated, and the error lists the actions that slot accepts. A `target` naming no component on its page is refused at startup, naming it; the check is skipped on a page that places a component template or builds a component id from a token, where the id is only known once the page is drawn. A target that is declared but not on screen when the action runs — a form inside a dialog that is closed — is left alone: nothing is filled and nothing is reported.

```yaml
forms:
  - name: new-message
    submitTo: { table: messages }
    fields: [{ kind: table-field, column: body, label: Message }]
pages:
  - name: Inbox
    path: /inbox
    components:
      - type: list
        props: { aria-label: Scripts }
        dataSource: { table: scripts }
        listDisplay: { itemTemplate: { title: $record.title } }
        onRowClick:
          type: fill
          target: composer
          field: body
          value: $record.content
          mode: append
      - type: form
        props: { id: composer }
        formRef: new-message
```

## Auto-save

Data components support inline-edit auto-save through the `autoSave` module, most often on `table`.

<!-- sovrium:options AutoSaveConfigSchema -->

Only the changed cell is sent in the `PATCH` payload, rapid edits batch into one request, and navigating away flushes anything still pending.

## `reorderable-list`

A list whose items can be reordered by drag or keyboard, firing an action when the order settles. `dataSource` optionally binds the items to a table, `children` holds them — each rendered with a drag handle — and `onReorder` names the action to invoke. It **must** be a toast action (`{ type: toast, message, variant, duration }`): that is the only type a reorder runs, and `duration` is in milliseconds and overrides the usual dismissal rules.
