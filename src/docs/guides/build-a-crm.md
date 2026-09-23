# Build a CRM with Sovrium

> Stand up a working CRM in minutes — scaffold from the `crm` template, or start from a minimal two-table contacts-and-deals config you can grow.

You want a self-hosted CRM — contacts, companies and a deal pipeline — without wiring a database or a UI by hand.

## Scaffold from the template

The fastest path is the ready-made `crm` template, which includes companies, contacts, deals with a pipeline, and pages:

```bash
sovrium init crm --template crm
cd crm
sovrium start app.yaml
```

The first argument is the directory to create; `--template` chooses what goes in it. Without `--template`, `sovrium init crm` scaffolds an empty app that merely happens to be named `crm`.

## Or start minimal and grow

A CRM is just tables. This two-table starter is a complete, runnable config you can extend field by field:

```yaml
name: crm
version: 1.0.0
tables:
  - id: 1
    name: contacts
    fields:
      - id: 1
        name: full_name
        type: single-line-text
        required: true
      - id: 2
        name: email
        type: email
      - id: 3
        name: company
        type: single-line-text
  - id: 2
    name: deals
    fields:
      - id: 1
        name: title
        type: single-line-text
        required: true
      - id: 2
        name: stage
        type: single-select
        options: [lead, qualified, won, lost]
      - id: 3
        name: notes
        type: long-text
```

**The explicit `id` on every field is what makes "extend it field by field" safe.** Omit them and an id is the field's position in the list, so inserting a field above an existing one shifts every id after it and the next migration reads the shift as a rename. Sovrium says so at validation rather than at the migration. Keep the ids a field already has, and give a new field the next unused number.

## Verify

`http://localhost:3000/api/tables/contacts/records` and `/api/tables/deals/records` are live and ready for data.

## Next

- **Start from a template** — every `sovrium init` template.
- **Relational Fields** — link deals to contacts and companies.
- **Pages Overview** — add a pipeline board and record views.
