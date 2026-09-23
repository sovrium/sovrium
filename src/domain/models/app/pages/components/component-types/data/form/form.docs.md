# The Form Component

> `form` — one type, two modes: table-bound writes through the records API, static submits to a declared form or to a URL of your own.

`dataSource` is what decides the mode. Declare one and the form is **table-bound**: its fields resolve against that table's columns, and submitting writes a record through the records API. Omit it and the form is **static**: it collects the fields declared on it and submits them to a form you declared in `forms[]` (`formRef`) or to a URL you name (`endpoint`). Nothing else about the component changes.

<!-- sovrium:options type:form depth=3 -->

`dataSource` is table-only by design, since writes go to a table and never to a read endpoint; `mode: single` supplies current values for an edit form. `layout` is `single-column` by default, with `two-column` and `custom` beside it. `fieldGroups` divides the form into `{ label, fields }` sections.

```yaml
tables:
  - name: contacts
    fields:
      - { name: email, type: email }
      - { name: notes, type: long-text }
pages:
  - name: Contact
    path: /contacts/:id
    components:
      - type: form
        dataSource: { table: contacts, mode: single, param: id }
        layout: two-column
        action: { type: crud, operation: update, table: contacts }
        fields:
          - { field: email, label: 'Email address' }
          - { field: notes, control: textarea }
```

## Submitting to your own endpoint

`endpoint` is the third submit target, beside a table and a `forms[]` entry: the form collects its declared fields and POSTs them as a JSON body — `{ [field]: value }` — to any URL you name. Nothing goes through the records API, so the destination can be a platform route, an admin endpoint, or something of your own. Each field must then name its own `control`.

`url` is required and takes any path or fully-qualified URL. `method` is `POST` by default, or `PUT` or `PATCH`. `responseEnvelope` decides how the response body is read when judging success or failure, and is `sovrium` by default. `submitLabel` overrides the button text, `onSuccess` runs on a 2xx — a toast, plus the client-state effects `status`, `refetch` and `reload` — and `onError` shows a toast when the submit fails.

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

The member list is resolved through the same recipe the button component uses, so a submit and a standalone button asking for `secondary` cannot drift apart.

## Prefilling an endpoint form

An endpoint-bound field carries its own `defaultValue`. Nothing derives it from a column — there is no table binding — so it is the only way such a form opens on anything but empty controls. A static value fills a text control, and on a `select` it is the option that arrives already chosen.

A `defaultValue` naming `$session.<field>` is the **caller's own** value, and it is filled in the browser rather than during rendering:

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

**Why the identity is not resolved on the server.** A page is composed once and may be cached, so resolving `$session.name` while rendering would write whoever requested it first into every copy handed out afterwards — one reader's name arriving in the next reader's form. The served bytes therefore name nobody: the server emits the template and the browser fills it against the caller's own session. An anonymous visitor gets an empty control, never the literal `$session.name`, and the static defaults beside it are unaffected, since they are the same for every reader.

The resolvable fields are `email`, `name`, `role` and `id` — the same set session-bound text resolves, through the same mechanism.

## It is the one type a specimen may not draw

`form` is excluded from the design-system catalogue. It emits a submit control unconditionally, in both its create and its update branch, and a preview frame may carry no write path — so the catalogue reports the type and its reason rather than drawing it. That is a safety rule rather than a gap in the kit.
