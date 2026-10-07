# Forms Overview

> Declaring a form in the top-level `forms` array — where a submission goes, the routes it answers on, and who may reach it.

A form captures input and routes it somewhere useful: into a table, through an automation, into the built-in submission ledger, or any combination. Where a table defines _what_ the data looks like, a form defines _how_ people contribute it.

```yaml
forms:
  - id: 1
    name: contact
    title: Contact Sales
    path: /contact
    submitTo:
      table: leads
    fields:
      - { kind: table-field, column: email, required: true }
      - { kind: table-field, column: message }
```

## Form properties

<!-- sovrium:options FormSchema depth=1 -->

`id` is a positive integer unique across the array. `name` is kebab-case, one to 64 characters, and is what a page component and an automation trigger reference. Both are required, as are `submitTo` and at least one field.

`labelPlacement` and `stickyActions` are the page form's layout keys, with the same meaning here: `labelPlacement: side` puts each label on the left of its control, one row per field, stacked again on a phone; `stickyActions: true` keeps the submit bar in view while a long form scrolls, counting the fields the visitor has changed, with a Discard button that puts them back; leaving the page with changes unsaved asks first.

## Where a submission goes

<!-- sovrium:options SubmitToSchema -->

At least one of `table`, `automation` or `storeSubmission` must be live — otherwise the submission would be discarded silently, so the configuration is refused instead. Omitted, `storeSubmission` stores a submission made on the form's own route and does not store one made through a `formRef` embed on an app page (see below); opting out of the ledger with `false` makes a table or an automation mandatory.

`mapping` renames form fields to destination columns and defaults to identity. A mapping target that does not exist on the table fails validation.

```yaml
submitTo:
  table: support_tickets
  automation: page-on-call
  mapping:
    userEmail: email
```

The table write and the ledger write happen inside **one transaction**; the automation runs only after both commit. A form can therefore dual-write and fire a workflow without the workflow ever seeing a row that was subsequently rolled back.

A question left empty is stored empty — never as an empty string a relationship, a number or a date column refuses; a `status` column is a select of its options, and a `user` column offers a signed-in visitor the accounts by name. When the database refuses a submission, the reason is shown under the field it refused.

## Routes

Every form is reachable at `/forms/{name}` whatever else is configured — a form with no `path` is not private, it is simply only reachable there. Setting `path` serves the form at that custom path **as well as** the canonical one, with no redirect; both URLs render the same form.

| Rule              | Detail                                                                        |
| ----------------- | ----------------------------------------------------------------------------- |
| Canonical route   | `/forms/{name}` always answers; an unknown name is a 404                      |
| Custom path       | Starts with `/`, two to 256 URL-safe characters, static — no dynamic segments |
| Reserved prefixes | `/api/`, `/admin/`, `/forms/` and `/auth/` are refused                        |
| Collisions        | A form path may not collide with a page path; validation names both           |

Access and availability are enforced on the canonical route, so serve anything gated or time-limited from there.

## Access control

<!-- sovrium:options FormAccessSchema -->

`require` is `all` — everyone including anonymous visitors — `authenticated`, or a role list. `redirectTo` sends a denied submitter to a path instead of answering with a status code.

```yaml
forms:
  - id: 2
    name: member-survey
    title: Member Survey
    access:
      require: authenticated
      redirectTo: /login
    submitTo: { table: survey_responses }
    fields:
      - { kind: standalone, name: rating, inputType: rating, required: true }
```

A form whose access is `all` may **not** carry a per-field default referencing the signed-in user: the value would always resolve empty for an anonymous visitor, and the reference itself could leak session state. Either require authentication, or use the top-level prefill map, which drops an unresolvable user reference silently.

## Embedding a form in a page

Sovrium has two form surfaces, each with one job:

> Use a top-level `forms[]` entry when the form **takes something in**: a submission that deserves its own address, a record in the Submissions inbox, protection against spam, an opening window or a cap, its own access rule, a one-question or multi-step layout, or an automation that starts when it is submitted. Use the page `form` component when the form **works on data already inside the app**: editing the record the page shows, posting to an endpoint of your own, or signing someone in or up. To let someone **add a record from inside an app page**, declare the form in `forms[]` and place it on the page with `formRef` — that is the only bridge between the two, and the page `form` never creates a table row on its own.

A top-level form renders inline inside a page through the form control's `formRef`. The form is defined once and reused: fields, validation, conditional logic, multi-step layout, uploads and the success and error handling all flow from the declaration. The host page's access control is intersected with the form's own at render time.

**An embedded submission is an in-app edit, not an intake.** A submission made through `formRef` on an app page writes its row to `submitTo.table` and runs `submitTo.automation`, but writes nothing to the submission ledger unless the form declares `submitTo.storeSubmission: true` — so a "new task" form on a project page does not fill the Submissions inbox. The same form submitted on its own route still stores by default, and `storeSubmission: false` stores on neither. One exception: a form with `availability.maxSubmissions` writes its ledger row on every surface, because the cap is counted in the ledger.

A `formRef` expands wherever it sits: a `dialog` with `formRef` inside any container, and a `form` with `formRef` inside a dialog's `children`, render the referenced form with its labels, rules and submission endpoint. When a form that writes to `submitTo.table` is sent from a dialog, the dialog closes and every grid on the page reading that table shows the new record without a reload.

A form's inputs and selects are drawn at the height of an `input` component (36 px by default), under labels on a 19 px line, so a form and an input written beside it line up.

```yaml
pages:
  - id: 1
    name: landing
    path: /
    components:
      - type: form
        formRef: contact
        props:
          label: Get in touch
```
