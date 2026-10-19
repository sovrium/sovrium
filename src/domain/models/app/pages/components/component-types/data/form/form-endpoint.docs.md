# Endpoint Forms

> A `form` that posts its fields to a URL you name — its submit button or sending on change, its switch, star and help-text controls, the password rule, the required and length rules each field states, and prefilling from the caller's own session.

A form bound to `endpoint` writes somewhere other than a table you declared, so it has no column to borrow a control, a rule or a value from: every field states its own. Everything else a form does — its parts, its layout, its sections — is on [The Form Component](/en/docs/data-components-forms).

## Submitting to your own endpoint

`endpoint` is the submit target for a form that writes somewhere other than a table you declared: the form collects its declared fields and POSTs them as a JSON body — `{ [field]: value }` — to any URL you name. Nothing goes through the records API, so the destination can be a platform route, an admin endpoint, or something of your own. Each field must then name its own `control`.

`url` is required and takes any path or fully-qualified URL. `method` is `POST` by default, or `PUT` or `PATCH`. `responseEnvelope` decides how the response body is read when judging success or failure, and is `sovrium` by default. `submitLabel` overrides the button text, `onSuccess` runs on a 2xx — a toast, plus the client-state effects `status`, `refetch` and `reload`, and the two below that only a form has — and `onError` shows a toast when the submit fails. A refusal whose body carries `errors: [{ field, message }]` naming fields of the form is drawn on those fields instead: each is marked invalid with its message under it, the first takes the focus, and no `onError` toast covers the form. A refusal that names none of its fields shows the toast.

**`submitVariant` is for a page that stacks several forms.** One form whose submit _is_ the page's main action wants the primary fill, and gets it by declaring nothing. A settings page drawing six one-row forms down a column gets six primary buttons instead, none of which is the main action — so each declares a quieter weight and the page regains a single focal point. The vocabulary is the `button` component's own: `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`, `fab`.

```yaml
- type: form
  endpoint:
    url: /api/account/display-name
    method: POST
    submitLabel: Save
    submitVariant: secondary
    onSuccess: { type: toast, variant: success, message: Name saved }
    onError: { type: toast, variant: destructive, message: Could not save the name }
  fields:
    - { field: name, control: text, label: Display name }
```

Each weight is drawn by the same recipe the `button` component uses, so a submit and a standalone button asking for `secondary` cannot drift apart.

## Sending as the reader changes a control

`submitOn: change` makes the change itself the commit, for a settings page where a Save button under a switch would ask the reader to confirm a choice they already made. The form draws no submit button. A switch or a select sends the moment it changes; a control the reader types into sends once typing pauses — never once per keystroke — and at once when the reader leaves the field or presses Enter in a single-line one. The whole form is sent, the same body a submit sends, after the field rules are checked, and `onSuccess` and `onError` run exactly as on a submit — a language select that reloads the page still shows its toast on the page that replaces it.

```yaml
- type: form
  endpoint:
    url: /api/auth/update-user
    method: POST
    responseEnvelope: better-auth
    submitOn: change
    onSuccess: { type: toast, variant: success, message: Preference saved }
    onError: { type: toast, variant: destructive, message: The preference could not be saved }
  fields:
    - field: notifyWeeklyDigest
      control: switch
      label: Weekly summary
      defaultValue: $session.notifyWeeklyDigest
```

A value the page fills in itself, such as a `$session` default, is not a change and sends nothing. While a request is on its way the form is marked busy and its controls stay usable; whatever changes meanwhile leaves as one more request once the answer is in, carrying the latest values. When the endpoint refuses, a switch or a select goes back to the state last saved, so the page never shows a setting that was not kept, while a typed control keeps what was typed so it can be corrected. `submitLabel` and `submitVariant` describe a button such a form does not draw, and `onSuccess.reset` would undo on screen the value just saved, so each is refused beside `submitOn: change`. Keep the default, `submitOn: submit`, for anything typed as a whole — a name, an address, a password.

## Closing the dialog and clearing the form

An endpoint form placed in a dialog stays open after a successful submit unless it says otherwise, because the dialog cannot tell a request that succeeded from one that did not. Two `onSuccess` keys settle it. `close: true` closes the dialog, drawer or popover the form sits in once the request succeeds — the same thing a dialog does after a table write — and `reset: true` puts every field back to its default value, so the next person to open the dialog does not find the last submission still filled in. Neither runs when the request fails: the dialog stays open on the values that were sent, with the `onError` toast.

```yaml
- type: button
  content: Invite a member
  props: { interactions: { click: { modal: invite-dialog } } }
- type: dialog
  props: { id: invite-dialog, title: Invite a member }
  children:
    - type: form
      endpoint:
        url: /api/auth/organization/invite-member
        submitLabel: Send the invitation
        onSuccess:
          {
            type: toast,
            variant: success,
            message: Invitation sent,
            close: true,
            reset: true,
            refetch: members,
          }
        onError: { type: toast, variant: destructive, message: The invitation could not be sent }
      fields:
        - { field: email, control: email, label: Email }
```

Both are refused beside `reload`, which replaces the page the dialog is drawn on and brings the form back empty anyway. `close` is not the endpoint form's alone: any action can ask to close the overlay it sits in, a `fetch` button or a file upload included, and the form also takes the `navigate` every `fetch` action takes, which may read the body the endpoint returned through `$response.<field>`. `reset` is the form's own, since nothing else has fields to clear; on a `fetch` button it is refused. After a reset the caret returns to the form's first field, ready for the next entry. A success that `reload`s the page shows its toast on the page that replaces it, read from that page's own config, so a language change is confirmed in the language just chosen. See [Once the action has answered](/en/docs/interactive-components#once-the-action-has-answered) for the order the effects run in.

## An on/off switch

`control: switch` draws a labelled switch instead of a text box, for a setting that is simply on or off. It posts a JSON boolean under its field name — `true` when on, `false` when off — and the key is always present, so an unchecked switch says "off" rather than saying nothing. `defaultValue` may be a boolean, or a `$session.<field>` reference so the switch opens in the caller's saved state; such a switch cannot be turned until the caller's session has answered, so a quick click is never undone by the saved value arriving after it. A switch takes no `options`.

```yaml
- type: form
  endpoint: { url: /api/preferences, method: POST, submitLabel: Save }
  fields:
    - { field: newsletter, control: switch, label: Monthly newsletter, defaultValue: true }
```

## A rating field

`control: rating` draws a scale the reader picks from: one choice per rank, each named "n of max" for a screen reader. `max` sets how many ranks it offers, from 1 to 10 (5 when omitted); `max` is refused beside any other control. A `defaultValue` opens the scale on that rank, and `required` stops a submit while no rank is picked, with the reason under the scale. The rank picked is sent as a number under the field name; an unanswered scale sends nothing.

## Help text under a field

A field's `description` is drawn as help text under its control, on every control type the endpoint form draws — a text box, a select, a text area, a switch. The control is linked to it with `aria-describedby`, so a screen reader announces the sentence with the field rather than leaving it as loose text beside it. On an endpoint form it is the only way to say anything next to a control: there is no table column whose own description could stand in.

```yaml
- type: form
  endpoint: { url: /api/preferences, method: POST, submitLabel: Save }
  fields:
    - field: paperInvoices
      control: switch
      label: Paper invoices
      description: We post a printed copy of every invoice to your billing address.
```

## Required fields and length rules

An endpoint form has no table column to take its rules from, so each field states its own. `required: true` means the field must be filled; `minLength` and `maxLength` bound how many characters a `text`, `email`, `password` or `textarea` control takes. The control carries the browser's own attributes, and a submit that leaves a required field empty or a value too short sends nothing: the field is marked invalid and the reason is drawn under it, naming the field by its label, so a screen reader landing on it hears why. An empty field is judged by `required` alone, and a control stops taking input at `maxLength`. A length rule on any other control, or a minimum above the maximum, is refused when the configuration is read.

```yaml
- type: form
  endpoint: { url: /api/account/change-password, method: POST, submitLabel: Change password }
  fields:
    - { field: currentPassword, control: password, label: Current password, required: true }
    - field: newPassword
      control: password
      label: New password
      required: true
      minLength: 12
      maxLength: 128
```

## The password rule, and a wrong current password

A `password` field whose `autocomplete` is `new-password` — the browser's own statement that the field sets a password — shows the app's password rule as its help text, "At least 8 characters" by default and the configured `minPasswordLength` otherwise, worded by the server in the page language. A field's own `minLength`, when larger, raises the number; a `description` you wrote is kept and comes first. A field marked `current-password` asks for the password the reader already has and shows no rule. The field's name plays no part.

When the form reads the `better-auth` envelope and the endpoint answers that the current password is wrong, the form marks its `current-password` field with "The current password is incorrect" and moves the focus there, beside the `onError` toast; a password the endpoint finds too short is marked on the `new-password` field with the rule. Any other refusal shows the toast alone.

```yaml
- type: form
  endpoint:
    url: /api/auth/change-password
    method: POST
    responseEnvelope: better-auth
    submitLabel: Change password
    onError: { type: toast, variant: destructive, message: The password was not changed }
  fields:
    - {
        field: currentPassword,
        control: password,
        label: Current password,
        autocomplete: current-password,
      }
    - { field: newPassword, control: password, label: New password, autocomplete: new-password }
```

## Prefilling an endpoint form

An endpoint-bound field carries its own `defaultValue`. Nothing derives it from a column — there is no table binding — so it is the only way such a form opens on anything but empty controls. A static value fills a text control, and on a `select` it is the option that arrives already chosen. A `defaultValue` naming `$session.<field>` is the **caller's own** value, and it is filled in the browser rather than during rendering:

```yaml
- type: form
  endpoint: { url: /api/invitations, method: POST, submitLabel: Send the invitation }
  fields:
    - { field: role, control: text, label: Role, defaultValue: member }
    - { field: invitedBy, control: text, label: Invited by, defaultValue: $session.name }
    - field: locale
      control: select
      label: Language
      defaultValue: fr
      options:
        - { value: en, label: English }
        - { value: fr, label: 'Français' }
```

**Why the identity is not resolved on the server.** A page is composed once and may be cached, so resolving `$session.name` while rendering would write whoever requested it first into every copy handed out afterwards — one reader's name arriving in the next reader's form. The served bytes therefore name nobody: the server emits the template and the browser fills it against the caller's own session. An anonymous visitor gets an empty control, never the literal `$session.name`, and the static defaults beside it are unaffected, since they are the same for every reader. The resolvable fields are `email`, `name`, `role` and `id` — the same set session-bound text resolves, through the same mechanism.

## Hidden and read-only fields

Some of what a form sends is not the visitor's to type: the caller's own email on a check-in form, a plan the page has already fixed. `hidden: true` sends the field without drawing it — no control, no label — and `readOnly: true` draws it without letting anyone change it. Both work on a form bound to a table and on an endpoint form alike, and in both the value is still submitted.

A hidden field becomes an `<input type="hidden">` carrying its `defaultValue`; a `$session.<field>` default is filled in the browser, as on any other control, so the served page still names nobody. A read-only text control carries the browser's `readonly` attribute and is never `disabled` — a disabled control drops out of the form data and out of the tab order, a read-only one stays in both — and `onSuccess.reset` puts it back to the value it carried rather than emptying it. A native `select` and a switch have no `readonly` of their own, so a read-only one is drawn `disabled` with `aria-readonly="true"` saying why, and its value still reaches the body. A read-only `select` with no `defaultValue` shows its first option, and that first option is what it sends.

```yaml
- type: form
  endpoint: { url: /api/tables/checkins/records, method: POST, submitLabel: Check in }
  fields:
    - {
        field: member_email,
        control: email,
        hidden: true,
        required: true,
        defaultValue: $session.email,
      }
    - field: duration
      control: select
      label: Duration
      options: [{ value: full, label: Full day }, { value: half, label: Half day }]
```

Neither key is a security boundary: anyone with the browser's developer tools can change what a form sends. The rules on the receiving end — a table's row-level permissions, your own route's checks — protect the data; `hidden` and `readOnly` protect the visitor from a box they were never meant to type in. And since a browser does not check `required` on a hidden or read-only control, a field that is `hidden` and `required` must carry a `defaultValue`, or the configuration is refused with the field's name and the fix: give it a default, or drop `required`.
