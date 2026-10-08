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

| Property      | Restricts                                                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `accept`      | The file dialog and the drop zone, by MIME type or extension; the server checks it again on submission and refuses a mismatch (400)   |
| `maxFileSize` | Bytes per file; a larger file is refused with an inline error before uploading starts, and by the server (413) if it is posted anyway |
| `maxFiles`    | How many files a multiple-file field accepts                                                                                          |
| `dropZone`    | Whether a drag-and-drop area renders alongside the picker                                                                             |

### Single or multiple

A single-file attachment submits one metadata object, or null when empty. A multiple-file attachment submits an array, or an empty one.

For a table-bound field the multiplicity is **inferred from the column type**, so it cannot disagree with what the table will accept. For a standalone field it follows the upload interface that `maxFiles` produces.

## Which bucket the files land in

A form field names no bucket of its own. A table-bound field uploads into the bucket its attachment column declares. Otherwise the upload lands in the first bucket the app declares, and, when it declares none, in the built-in `system` bucket every app carries. There is no `default: true` flag.

Per-field bucket overrides on a standalone field are reserved for a later release, so a form needing two destinations today binds its fields to columns that name them, or uses two forms.

```yaml
buckets:
  - name: invoices
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

| Behaviour            | Detail                                                                                                                                                                                                                                              |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Type filter          | `accept` restricts both the dialog and the drop zone; a mismatch is an inline error                                                                                                                                                                 |
| Size validation      | `maxFileSize` refuses an oversized file before any upload begins                                                                                                                                                                                    |
| Server enforcement   | The submission endpoint checks every file again, so a file posted by hand cannot skip the page: a type outside `accept` is refused with 400 and a file above `maxFileSize` with 413, both naming the field, and nothing of the submission is stored |
| Bucket limits        | The bucket's own `maxFileSize` (or `STORAGE_MAX_FILE_SIZE`) and `allowedMimeTypes` apply to form uploads too, exactly as on the bucket's upload endpoint                                                                                            |
| Progress             | A progress indicator shows while each file uploads                                                                                                                                                                                                  |
| Preview              | An image renders a thumbnail after upload; anything else renders its name and size                                                                                                                                                                  |
| Remove               | A selected file can be removed before submit, from the keyboard; the others are untouched                                                                                                                                                           |
| Required enforcement | A required attachment field with no file blocks submission with an inline error; a recorded, dropped or picked file satisfies it, and removing the last file blocks the submission again                                                            |

Validating before the upload rather than after is the part worth noticing: a visitor who picked the wrong file learns immediately instead of after waiting for twenty megabytes to travel.

The server's check reads the file's **content** as well as its declared type. A file whose bytes open with `<` is markup, and is judged as HTML or SVG whatever it is called; both can carry a script. So `image/*` does **not** admit SVG: a field that wants SVG names `image/svg+xml` or `.svg` explicitly, and an HTML page renamed `photo.png` is refused by `image/*` and by `.png` alike. The page's picker applies the same rule the moment a file is picked, so an SVG chosen for an `image/*` field is refused with the field's message before anything is uploaded. The size limit is inclusive: a file of exactly `maxFileSize` bytes is accepted.

A legacy spelling in `accept` names its registered type, on the page and on the server alike: `image/jpg` and `image/pjpeg` mean `image/jpeg` — which is how every browser reports a `.jpg` — just as `audio/x-m4a` means `audio/mp4`. The alias admits nothing else: a PNG is still refused by `image/jpg`.

When storing a file fails on the server side, the visitor gets a generic `500` (`upload_failed`) and the cause is written to the server log, naming the form.

A file a **signed-in** visitor submits is recorded as uploaded by her, so it is removed with her account when it is erased. A file sent anonymously names nobody.

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

Where the content announces its type — markup, or the signature of a PNG, JPEG, GIF or WebP image — that **detected** type is what is stored, rather than the upload's own claim; otherwise the declared type is kept.

## Recording audio in the browser

Add `recordAudio` to an attachment field and the person filling in the form gets a **Record audio** button beside the file picker. They press Record audio, speak, press **Stop recording**, and the recording becomes a file on the field. It is uploaded to the field's bucket, shown as a removable chip, and submitted with the same `{ url, name, size, mimeType }` metadata as a picked file. The picker stays available, so a voice memo recorded on a phone (`.m4a`) can be uploaded instead.

```yaml
fields:
  - kind: table-field
    column: recording
    accept: 'audio/*'
    recordAudio: { maxDurationSeconds: 1800 }
```

`recordAudio.maxDurationSeconds` (1 to 7200, default 7200) stops the recording automatically. The file size is still limited by the field's or the bucket's `maxFileSize`. Browsers record `audio/webm` (Opus), or `audio/mp4` where WebM is unavailable. If microphone access is refused, the field says so and uploading still works. On a required field, a finished recording counts as the field's file: the form submits with it, and a one-question form moves on to the next question. The recorder does not transcribe. To put the text on the record, add a record-created automation with an `ai/transcribe` step followed by `record/update`.
