# Endpoint Forms

> A `form` that posts its fields to a URL you name — its submit button, its switch, star and help-text controls, the required and length rules each field states, and prefilling from the caller's own session.

A form bound to `endpoint` writes somewhere other than a table you declared, so it has no column to borrow a control, a rule or a value from: every field states its own. Everything else a form does — its parts, its layout, its sections — is on [The Form Component](/en/docs/data-components-forms).

## Submitting to your own endpoint

`endpoint` is the submit target for a form that writes somewhere other than a table you declared: the form collects its declared fields and POSTs them as a JSON body — `{ [field]: value }` — to any URL you name. Nothing goes through the records API, so the destination can be a platform route, an admin endpoint, or something of your own. Each field must then name its own `control`.

`url` is required and takes any path or fully-qualified URL. `method` is `POST` by default, or `PUT` or `PATCH`. `responseEnvelope` decides how the response body is read when judging success or failure, and is `sovrium` by default. `submitLabel` overrides the button text, `onSuccess` runs on a 2xx — a toast, plus the client-state effects `status`, `refetch` and `reload`, and the two below that only a form has — and `onError` shows a toast when the submit fails.

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

## Closing the dialog and clearing the form

An endpoint form placed in a dialog stays open after a successful submit unless it says otherwise, because the dialog cannot tell a request that succeeded from one that did not. Two `onSuccess` keys settle it. `close: true` closes the dialog or sheet the form sits in once the request succeeds — the same thing a dialog does after a table write — and `reset: true` puts every field back to its default value, so the next person to open the dialog does not find the last submission still filled in. Neither runs when the request fails: the dialog stays open on the values that were sent, with the `onError` toast.

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

Both are refused beside `reload`, which replaces the page the dialog is drawn on and brings the form back empty anyway. They belong to the endpoint form alone: a `fetch` button has no fields to clear and no dialog it was opened from.

## An on/off switch

`control: switch` draws a labelled switch instead of a text box, for a setting that is simply on or off. It posts a JSON boolean under its field name — `true` when on, `false` when off — and the key is always present, so an unchecked switch says "off" rather than saying nothing. `defaultValue` may be a boolean, or a `$session.<field>` reference so the switch opens in the caller's saved state. A switch takes no `options`.

```yaml
- type: form
  endpoint: { url: /api/preferences, method: POST, submitLabel: Save }
  fields:
    - { field: newsletter, control: switch, label: Monthly newsletter, defaultValue: true }
```

## A star rating

`control: rating` draws five stars and submits the whole number of the star picked, from 1 to 5. On a form bound to a table a `rating` column already draws its stars, so the key is only needed on an endpoint form.

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
