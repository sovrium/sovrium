# Form File Uploads

> Collecting files through a form — the attachment field's upload options, which bucket they land in, and the metadata shape a submission carries.

A form can collect resumes, invoices, photos and documents, and persist them to your own storage rather than a third-party service. An attachment field renders a file picker and an optional drop zone, validates type and size before uploading, shows progress and previews, and submits a canonical metadata object per file.

```yaml
buckets:
  - name: applications
    maxFileSize: 10485760

forms:
  - id: 1
    name: apply
    title: Job Application
    path: /apply
    submitTo: { table: applications }
    fields:
      - { kind: standalone, name: full_name, inputType: short-text, required: true }
      - kind: standalone
        name: resume
        inputType: attachment
        label: Resume
        required: true
        accept: 'application/pdf,.doc,.docx'
        maxFileSize: 10485760
        dropZone: true
```

## Configuring an attachment field

Upload behaviour is configured identically on both kinds: a standalone field whose `inputType` is `attachment`, or a table-bound field whose column is a single or multiple attachment. The four upload properties are shared, and they appear in the option tables of both field kinds.

| Property      | Restricts                                                                             |
| ------------- | ------------------------------------------------------------------------------------- |
| `accept`      | The file dialog and the drop zone, by MIME type or extension                          |
| `maxFileSize` | Bytes per file; a larger file is refused with an inline error before uploading starts |
| `maxFiles`    | How many files a multiple-file field accepts                                          |
| `dropZone`    | Whether a drag-and-drop area renders alongside the picker                             |

### Single or multiple

A single-file attachment submits one metadata object, or null when empty. A multiple-file attachment submits an array, or an empty one.

For a table-bound field the multiplicity is **inferred from the column type**, so it cannot disagree with what the table will accept. For a standalone field it follows the upload interface that `maxFiles` produces.

## Which bucket the files land in

A form field names no bucket, so an upload lands in the bucket **called** `default` — the implicit virtual one, unless you declare a bucket with that name and give it your own rules. There is no `default: true` flag: the name is the mechanism.

Per-field bucket overrides are reserved for a later release, so a form needing two destinations today needs two forms.

```yaml
buckets:
  - name: default
    maxFileSize: 20971520
    allowedMimeTypes: ['application/pdf', 'image/*']

forms:
  - id: 2
    name: invoice-upload
    title: Upload Invoice
    submitTo: { automation: process-invoice }
    fields:
      - { kind: standalone, name: vendor, inputType: short-text, required: true }
      - kind: standalone
        name: document
        inputType: attachment
        accept: 'application/pdf,image/*'
        maxFileSize: 20971520
        dropZone: true
```

## What the field does for you

| Behaviour            | Detail                                                                                    |
| -------------------- | ----------------------------------------------------------------------------------------- |
| Type filter          | `accept` restricts both the dialog and the drop zone; a mismatch is an inline error       |
| Size validation      | `maxFileSize` refuses an oversized file before any upload begins                          |
| Progress             | A progress indicator shows while each file uploads                                        |
| Preview              | An image renders a thumbnail after upload; anything else renders its name and size        |
| Remove               | A selected file can be removed before submit, from the keyboard; the others are untouched |
| Required enforcement | A required attachment field with no file blocks submission with an inline error           |

Validating before the upload rather than after is the part worth noticing: a visitor who picked the wrong file learns immediately instead of after waiting for twenty megabytes to travel.

## The metadata a submission carries

Each attachment value is normalised to one canonical object — the same shape the bound table, the submit automation and the ledger payload all receive.

```typescript
type FileMetadata = {
  url: string // canonical URL into the bucket, signed when the bucket is private
  name: string // the original filename
  size: number // bytes
  mimeType: string // the detected type
}
```

The type is **detected** rather than taken from the upload's own claim, which is what keeps a file renamed to `.pdf` from being stored as one.
