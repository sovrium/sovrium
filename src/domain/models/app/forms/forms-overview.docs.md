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

## Where a submission goes

<!-- sovrium:options SubmitToSchema -->

At least one of `table`, `automation` or `storeSubmission` must be live — otherwise the submission would be discarded silently, so the configuration is refused instead. `storeSubmission` defaults to `true`, which means opting out of the ledger makes a table or an automation mandatory.

`mapping` renames form fields to destination columns and defaults to identity. A mapping target that does not exist on the table fails validation.

```yaml
submitTo:
  table: support_tickets
  automation: page-on-call
  mapping:
    userEmail: email
```

The table write and the ledger write happen inside **one transaction**; the automation runs only after both commit. A form can therefore dual-write and fire a workflow without the workflow ever seeing a row that was subsequently rolled back.

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

A top-level form renders inline inside a page through the form control's `formRef`. The form is defined once and reused: fields, validation, conditional logic, multi-step layout, uploads and the success and error handling all flow from the declaration. The host page's access control is intersected with the form's own at render time.

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
