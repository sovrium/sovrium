# The Form Component

> `form` — the form that works on data already inside the app: it edits the record a page shows, posts to an endpoint of your own, signs someone in or up, or places a form you declared in `forms[]`.

Sovrium has two form surfaces, each with one job. Use a top-level `forms[]` entry when the form **takes something in**: a submission that deserves its own address, a record in the Submissions inbox, protection against spam, an opening window or a cap, its own access rule, a one-question or multi-step layout, or an automation that starts when it is submitted. Use the page `form` component when the form **works on data already inside the app**: editing the record the page shows, posting to an endpoint of your own, or signing someone in or up. To let someone **add a record from inside an app page**, declare the form in `forms[]` and place it on the page with `formRef` — that is the only bridge between the two, and the page `form` never creates a table row on its own. So the component does four things. With `dataSource` in `mode: single` and a `crud` update action it **edits** that record through the records API. With `endpoint` it **posts** its fields to a URL you name. With an `auth` action it is a **sign-in or sign-up** form. With `formRef` it **draws a `forms[]` entry** on the page.

<!-- sovrium:options type:form depth=3 -->

`dataSource` is table-only by design, since writes go to a table and never to a read endpoint; `mode: single` supplies current values for an edit form. `layout` is `single-column` by default, with `two-column` and `custom` beside it. `props.id` and `data-testid` name the `<form>` element itself, before and after the page's script has run, so a selector such as `form#new-client` or a test id finds the form and nothing around it.

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

## Adding a record from a page

A page form does not create rows. Declare the form in `forms[]` with `submitTo.table`, and place it where it belongs — on the page, in a dialog, in a tab — with `formRef`. Multi-step layouts, conditional fields, file uploads, field groups and the success page are written there, once, and a record page passes its own id to the form with `inlinePrefill`:

```yaml
forms:
  - id: 1
    name: new-task
    title: New task
    submitTo: { table: tasks }
    fields:
      - { kind: table-field, column: title }
      - { kind: table-field, column: project }
pages:
  - name: Project
    path: /projects/:id
    dataSource: { table: projects, mode: single, param: id }
    components:
      - type: form
        formRef: new-task
        inlinePrefill:
          prefill: { project: $parent.id }
          lockPrefill: true
```

A submission made this way writes the row to `tasks` and, unless the form says `submitTo.storeSubmission: true`, nothing to the Submissions inbox — see Form Submissions.

## A form offers only what its reader may write

An edit form draws an input only for a field its reader may write — whether the form lists its `fields` or lists none and draws one per field of the table. A field she may not read is not named anywhere on her page: not its input, not its label, not its options, not an attribute, neither in the controls drawn before the page's script runs nor in the configuration handed to it. A signed-out visitor on a public form is held to the fields the table lets a visitor write. On an edit form, a field she may read but not write is offered no input, and saving leaves it as it was. When the table does not let her update the record at all, the form shows the fields she may read, disabled, with no save button.

## A bound column renders its own control

On a table-bound form, every field takes its control from the column it is bound to, the same control the data table uses to edit that column. A `decimal`, `integer` or `currency` column is a number input stepped by its `precision`, and `currency` shows its symbol beside the input; a `percentage` column is a number input with a `%` sign; a `date` column is a date input and a `datetime` column a date-and-time input, read in the column's `timeZone`; a `rating` column is a row of choices from 1 to its `max`; a `single-select` or `status` column is a select and a `multi-select` column is one checkbox per option, each option offered by its `label` — a `$t:` key translated into the page language — while the record stores the option's `value`; a `user` column is a people picker that searches accounts by name. What the form sends is the column's own kind of value — a number, an ISO date or timestamp, a list, an account id — never the text typed into a box, so a form never posts an empty string into a column that cannot hold one.

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

### Styling a form by part

A form's inner elements take classes by part through `classes`, with the same names whether it is a declared form placed with `formRef` or a page form posting to an `endpoint`: `title` and `description` (the form's header), `body` (the form holding the fields and the button), `label`, `input` (each text control and select), `submit` (the button) and `error` (the reason shown under a refused field). A page form draws no header, so on it `title` and `description` style nothing; `error` styles the reason an endpoint form draws under a field that breaks its `required` or length rule. The submit keeps its keyboard focus ring whatever its classes say. `classes: { parts: { body: 'grid grid-cols-2 gap-4', submit: 'col-span-full' } }` lays a four-field request out two by two with the button across the bottom.

## Before the page's script has run

A form with a submit target never sends its values in the page address. It is always drawn as a `POST` form, so no way of submitting it — a click, or Enter in a field — can put an email address or a password in the URL, where it would stay in the browser history and in every server log on the way.

An edit form and a form drawn from `forms[]` submit straight to their own route, so they work before the page's script has run and without it. An edit form whose `onSuccess` declares a `toast` and no `navigate` returns the browser to the page it was posted from, and that page shows the toast once — a reload does not repeat it. A form that can only send through that script — one bound to your own `endpoint`, a sign-in or sign-up form, and a form that runs an automation — draws its submit disabled until the script is ready, then enables it. On a slow connection the button is briefly greyed out rather than appearing to accept a submit it cannot send. A button elsewhere on the page that submits the form with `interactions.click.submitForm` waits the same way: while the submit is disabled, pressing it does nothing.

## Posting to your own endpoint

A form whose `endpoint` names a URL posts its fields there as a JSON body instead of writing a table, so each field states its own control, rules and default. Its submit target, its switch, star and help-text controls, its required and length rules and its prefilled values are on [Endpoint Forms](/en/docs/data-components-endpoint-forms).

## Grouping fields into sections

A long edit form reads better in titled groups. `sections` lists them in order: each has a `title`, an optional one-line `description`, and the `fields` drawn under it. It is layout and nothing else. No section hides, collapses or conditions its fields, and every field is submitted whichever section it sits in. Each section is drawn as a group named by its title, which a screen reader announces before the first field of the group; the title is also a second-level heading, so a reader can jump from section to section. Sections are drawn on a form that edits a record (a `crud` update action).

```yaml
- type: form
  dataSource: { table: clients, mode: single }
  action: { type: crud, operation: update, table: clients }
  sections:
    - title: Identity
      fields: [company_name, siret]
    - title: Billing
      description: Where invoices are sent.
      fields: [billing_email, billing_address]
```

Each name is a field the form draws: an entry of its `fields[]` when it declares them, otherwise a column of the bound table. A name the form does not draw, or one listed in two sections, is refused when the config loads. A field you leave out of every section is drawn after the last one, in the form's own order, so you can section the first few fields of a large form without listing the rest. Fields that appear only on a condition, and forms in several steps, belong to a form that takes something in: declare it in `forms[]`, where `fieldGroups` groups its fields, and place it on the page with `formRef`.

## Labels beside their controls

`labelPlacement: side` puts each field's label and help text on the left and its control on the right, one row per field — the shape of a settings page, where a reader scans the labels down one column. Below the `md` breakpoint the form stacks again. It arranges the labels, where `layout` arranges the fields, so the two combine.

## A save bar that stays in view

`stickyActions: true` pins the save bar to the bottom of the viewport while a long form scrolls. It counts the unsaved changes ("3 unsaved changes"), offers Discard, enables Save only once something changed, and asks before the reader leaves with changes unsaved.

## A main column and an aside

A form's `props.className` lands on the `<form>` element itself, merged with the classes its `layout` gives it, so a form can be laid out as a grid of its own: `className: 'grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_22rem] gap-6'` sets its sections side by side on a wide screen. For the common content-and-settings editor, `layout: main-aside` below says the same thing without a class list.

`layout: main-aside` is the editor's shape: the fields whose `region` is `aside` — and the submit button — sit in a narrow column beside the others from the `lg` breakpoint up, and everything stacks on one column below it. `asideWidth` sets that column's width in `px` or `rem` (20rem by default); the main column takes the rest. A field without a `region` is in `main`. `showHeader: false` drops the form's own title and description, for a form placed under a page heading that already says what it is for — typically a referenced form whose title repeats the page's.

## It is the one type a specimen may not draw

`form` is excluded from the design-system catalogue. It emits a submit control unconditionally, whichever of its jobs it does, and a preview frame may carry no write path — so the catalogue reports the type and its reason rather than drawing it. That is a safety rule rather than a gap in the kit.
