# Migrate from Airtable to Sovrium

> Move an Airtable base to a self-hosted Sovrium app — map each Airtable field type to a Sovrium field, define the table in config, and import your CSV export.

You have an Airtable base and want to own it — self-hosted, config-as-code, no per-seat pricing. A base maps almost one-to-one onto a Sovrium table.

## Map the field types

Export the base first — in Airtable, **… → Download CSV** per table. Most Airtable field types have a direct Sovrium equivalent:

| Airtable field         | Sovrium field type        |
| ---------------------- | ------------------------- |
| Single line text       | `single-line-text`        |
| Long text              | `long-text`               |
| Email / URL / Phone    | `email` / `url` / `phone` |
| Single select          | `single-select`           |
| Multiple select        | `multi-select`            |
| Number / Currency      | `number` / `currency`     |
| Date                   | `date`                    |
| Checkbox               | `checkbox`                |
| Attachment             | `attachment`              |
| Link to another record | `relationship`            |

Every field type and its own options are documented in **Tables Overview** and the field-category articles.

## Define the table

Declare each column as a Sovrium field. This `contacts` table is a complete, runnable app:

```yaml
name: contacts-app
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
      - id: 4
        name: status
        type: single-select
        options: [lead, active, churned]
      - id: 5
        name: notes
        type: long-text
```

Give every field an explicit `id`. Without one the id is the field's position, so adding a column above an existing one shifts the ids below it and the next migration reads the shift as a rename — which matters most here, where the whole point is to keep growing the table after the import.

## Run it

```bash
sovrium start app.yaml
```

## Verify

Open `http://localhost:3000/api/tables/contacts/records` — the table exists and is empty, ready for your CSV import through the records API.

## What does not map

Airtable **formulas, rollups and automations** are not columns you paste in. Sovrium has its own formula and rollup fields and a separate automations engine, so re-declare that logic rather than importing it. Airtable **views** become Sovrium pages and their data components.
