# The Form Component

> `form` — one type, two modes: table-bound writes through the records API, static submits to a declared form or to a URL of your own.

`dataSource` is what decides the mode. Declare one and the form is **table-bound**: its fields resolve against that table's columns, and submitting writes a record through the records API. Omit it and the form is **static**: it collects the fields declared on it and submits them to a form you declared in `forms[]` (`formRef`) or to a URL you name (`endpoint`). Nothing else about the component changes.

<!-- sovrium:options type:form depth=3 -->

`dataSource` is table-only by design, since writes go to a table and never to a read endpoint; `mode: single` supplies current values for an edit form. `layout` is `single-column` by default, with `two-column` and `custom` beside it. `fieldGroups` divides the form into `{ label, fields }` sections.

`props.id` and `data-testid` name the `<form>` element itself, before and after the page's script has run, so a selector such as `form#new-client` or a test id finds the form and nothing around it.

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

## A form offers only what its reader may write

A form that creates or edits a record draws an input only for a field its reader may write — whether the form lists its `fields` or lists none and draws one per field of the table. A field she may not read is not named anywhere on her page: not its input, not its label, not its options, not an attribute, neither in the controls drawn before the page's script runs nor in the configuration handed to it. A signed-out visitor on a public form is held to the fields the table lets a visitor write.

On an edit form, a field she may read but not write is offered no input, and saving leaves it as it was. When the table does not let her update the record at all, the form shows the fields she may read, disabled, with no save button.

## A bound column renders its own control

On a table-bound form, every field takes its control from the column it is bound to, the same control the data table uses to edit that column. A `decimal`, `integer` or `currency` column is a number input stepped by its `precision`, and `currency` shows its symbol beside the input; a `percentage` column is a number input with a `%` sign; a `date` column is a date input and a `datetime` column a date-and-time input, read in the column's `timeZone`; a `rating` column is a row of choices from 1 to its `max`; a `multi-select` column is one checkbox per option; a `user` column is a people picker that searches accounts by name. What the form sends is the column's own kind of value — a number, an ISO date or timestamp, a list, an account id — never the text typed into a box, so a form never posts an empty string into a column that cannot hold one.

Pressing the form's submit saves what changed: an optional field left empty stays as it was. To clear one, press its **Clear** control — offered on an optional date, number, choice or relationship that holds a value, never on a required field — and save: the form sends the field as cleared (`<field>__clear` when posted without scripts, `null` otherwise), and the records API stores it empty; clearing a to-many relationship removes every link its reader can see. A file input left untouched keeps the stored file, and a relationship saves the record it names. An edit form opens with the record's links — only the linked records its reader may read; links it hides are kept when the form is saved. A to-many relationship shows each linked record by name, and its count against `maxLinked` when the column declares one ("3 of 5 linked"). A to-one relationship shows the linked record's name.

## Embedding a declared form

`formRef` draws a form you declared in `forms[]` inside a page, with its fields, layout, steps and submission behaviour. On its own page at `/forms/<name>` the form's title is that page's `<h1>` and takes the display size. Embedded, the title is a section of the host page: `props.headingLevel` (`h1`, `h2` or `h3`, default `h1`) sets the heading it renders as, so a page with its own hero heading keeps a single `<h1>`. An embedded title's size follows that heading level; the display size is only for the standalone form page.

```yaml
pages:
  - name: Pricing
    path: /pricing
    components:
      - { type: text, element: h1, content: Pricing }
      - type: form
        formRef: contact
        props: { headingLevel: h3 }
```

## Before the page's script has run

A form with a submit target never sends its values in the page address. It is always drawn as a `POST` form, so no way of submitting it — a click, or Enter in a field — can put an email address or a password in the URL, where it would stay in the browser history and in every server log on the way.

An edit form and a form drawn from `forms[]` submit straight to their own route, so they work before the page's script has run and without it. A form that can only send through that script — one bound to your own `endpoint`, a sign-in or sign-up form, a create form, and a form that runs an automation — draws its submit disabled until the script is ready, then enables it. On a slow connection the button is briefly greyed out rather than appearing to accept a submit it cannot send. A button elsewhere on the page that submits the form with `interactions.click.submitForm` waits the same way: while the submit is disabled, pressing it does nothing.

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

## An on/off switch

`control: switch` draws a labelled switch instead of a text box, for a setting that is simply on or off. It posts a JSON boolean under its field name — `true` when on, `false` when off — and the key is always present, so an unchecked switch says "off" rather than saying nothing. `defaultValue` may be a boolean, or a `$session.<field>` reference so the switch opens in the caller's saved state. A switch takes no `options`.

```yaml
- type: form
  endpoint: { url: /api/preferences, method: POST, submitLabel: Save }
  fields:
    - { field: newsletter, control: switch, label: Monthly newsletter, defaultValue: true }
```

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
