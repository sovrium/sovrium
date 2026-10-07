# Form Drafts & Edits

> Let a submitter save a long form and finish it later, and let them correct an answer they already sent.

A grant application takes an evening and a pile of documents. A conference registration is sent, and an hour later the attendee realises they picked the wrong workshop. Both are normal, and both otherwise end with an email to the organiser asking them to fix the record by hand. Two optional blocks hand that back to the submitter.

```yaml
forms:
  - id: 1
    name: grant-application
    title: Community Grant 2026
    submitTo: { table: applications }
    saveAndResume:
      enabled: true
      expiresIn: 14d
    editAfterSubmit:
      window: 48h
    fields:
      - { kind: table-field, column: organisation, required: true }
      - { kind: table-field, column: project_summary, required: true }
      - { kind: table-field, column: budget, required: true }
```

## Save and resume

<!-- sovrium:options FormSaveAndResumeSchema -->

With `enabled: true` the form's own page shows a "save and continue later" action next to its submit button. The submitter gives an email address, the answers typed so far are kept on the server, and a link is mailed to that address. Opening the link reopens the form with those answers filled in, on any device. Nothing is validated when a draft is saved — a half-filled form is the point — and nothing reaches the bound table or fires an automation until the form is actually submitted. Each save sends a mail, so saves count against the form's submission rate limits.

The action is offered on a single-page form at `/forms/{name}` (or its `path`). A multi-step or one-question form, and a form embedded in a page with `formRef`, do not show it. A client can also save a draft directly with `POST /api/forms/{name}/drafts` and a body of `{ "email": "...", "data": { ... } }`; the answer is `201` with the moment the link expires, and never the link or its token. A form without the block answers that endpoint `404`.

A resume link works until the form is submitted from it or until `expiresIn` has passed, whichever comes first; the draft is then deleted — on the submit, or by the hourly sweep that also deletes the drafts of a form that no longer offers save and resume. An expired, already-used or unknown link opens the form empty with a notice that the saved answers are no longer available, and never says which of the three it was. The token in the link is the only key to the draft: it is stored only as a hash, so the database alone cannot reopen anyone's answers.

Files picked in attachment fields are not kept in a draft. They are uploaded only when the form is submitted, so a resumed form asks for them again.

A draft holds personal data. Erasing a person's account also deletes the drafts saved under their address.

## Edit after submit

<!-- sovrium:options FormEditAfterSubmitSchema -->

After a successful submission the confirmation shows a private edit link, and the submission's JSON answer carries it as `editUrl`. The link needs the submission's record in the submissions list, so a form with `submitTo.storeSubmission: false` gives none. Opening it reopens the form with the submitted answers; saving it updates that submission and the row it wrote to the bound table, instead of creating a second one. The same validation, access rule and field permissions apply as on the first submission. An edit saves through `PUT /api/forms/{name}/submissions/edit/<token>`; the edit page posts to the same address. A file already sent is kept when the edit picks no new one.

The link stops working once `window` has passed since the submission. Past that point, and for a link that never existed, the edit page answers 404 rather than a refusal, so a guessed link learns nothing.

Each edit is written to the activity log, naming the form, the submission and the fields whose values changed. The form's submit automation does not fire again on an edit; a table-level automation on record update does, as it would for any other change to the row.
