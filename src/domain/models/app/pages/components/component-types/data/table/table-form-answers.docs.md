# A Grid over a Form's Answers

> One page that lists what any of your forms received, with a column per question — `columnsFrom: { form }` on a `table` bound to the form's submissions.

A form's submissions are read from the admin submissions list, `/api/admin/forms/:form/submissions`. Each row there is an envelope — `id`, `status`, `submittedAt` — around the answers, which arrive in `body` only when they are asked for. The envelope is the same for every form, so you write its columns. The answers differ per form, so the grid derives them:

```yaml
name: my-app
pages:
  - name: submissions
    path: /submissions/:form
    components:
      - type: table
        dataSource:
          system:
            endpoint: /api/admin/forms/$param.form/submissions
            totalKey: total
            query: { reveal: 'true' }
        columns:
          - { field: status, label: Status }
          - { field: submittedAt, label: Received, format: datetime }
        columnsFrom: { form: $param.form }
```

`columnsFrom: { form }` adds one column per field of the form that carries a value — a section heading carries none — after the columns you wrote, in the order the form declares them. Each is headed by the field's `label` (a `$t:` key is resolved in the page's language), or by its name when it has none, and each answer is drawn the way the grid draws that field type — a checkbox answer is a yes or no mark, not the word `true`. The answer columns are not sortable or filterable — the list sorts and searches its envelope, never the answers — and never editable.

**The form is named on the column source.** A literal name must be a form the app declares, or the app is refused at startup. `$param.<segment>` takes it from the address, so one page serves every form; an address naming no declared form answers 404, not an empty grid. `columnsFrom: { form }` needs a `dataSource.system`: over a `dataSource.table` it is refused at startup, because a table's rows carry no answers. `columnsFrom: table` is unchanged: it needs a `dataSource.table` and cannot stand beside `columns`.

**Answers are shown to admins, where the instance allows it.** The list includes each submission's answers only when the request asks for them (`reveal=true`), the instance sets `ADMIN_DETAIL_CAPTURE_BODIES_ALLOWED=true`, and the reader has an admin role. Anyone else gets the list without answers, and the grid gives them no answer column at all rather than columns they could never fill. Every list read that shows answers is recorded in the audit log as one critical `form.submission.bodies.revealed` event naming the form. Searching the list never matches an answer, shown or not.

**The list reports its size.** `total` is every submission the list's filters match, the same figure on every page; `totalKey: total` hands it to the grid instead of a count of the rows it holds.
