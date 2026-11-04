# Attachment & Media Fields

> File uploads with bucket, MIME, size and thumbnail controls, plus the barcode field that shares their directory.

Four field types live in the media category. Two upload files into a storage bucket; `signature` stores one signature with its image in a bucket; `barcode` stores a scannable value. All of them also accept the base field properties every field type shares.

| Type                   | Stores                       |
| ---------------------- | ---------------------------- |
| `single-attachment`    | A single uploaded file.      |
| `multiple-attachments` | Several uploaded files.      |
| `barcode`              | A scannable barcode value.   |
| `signature`            | One signature, written once. |

## `single-attachment`

One uploaded file: an avatar, a document, an image.

<!-- sovrium:options SingleAttachmentFieldSchema -->

```yaml
- id: 1
  name: avatar
  type: single-attachment
  bucket: avatars
  allowedFileTypes: [image/png, image/jpeg]
  maxFileSize: 2097152
```

Omitting `bucket` stores the file in the built-in `system` bucket. That bucket exists without being declared, which is convenient and worth knowing about: it carries no permissions of its own, so a field that needs access rules should name a bucket declared in `app.buckets`.

## `multiple-attachments`

Several files on one record.

<!-- sovrium:options MultipleAttachmentsFieldSchema -->

```yaml
- id: 2
  name: documents
  type: multiple-attachments
  bucket: contracts
  maxFiles: 10
```

`maxSize` is per file, not per record. A field with `maxFiles: 10` and `maxSize: 5242880` accepts fifty megabytes in total.

## `barcode`

A scannable value together with the symbology it is encoded in. The value is stored as text rather than as a number, because a leading zero is meaningful in most symbologies and a numeric type would silently drop it.

<!-- sovrium:options BarcodeFieldSchema -->

```yaml
- { id: 3, name: sku, type: barcode, format: ean13 }
```

The symbology is a property of the field rather than of each value: a column holding a mixture of EAN-13 and Code 128 cannot be validated, and a scanner configured for one is reading the wrong thing when it meets the other.

## `signature`

One signature: the drawn or typed mark as an image in a bucket, the signer's name, the instant of signing, whether it was drawn or typed, the exact statement agreed to, and how the signer was identified. The server writes every part of it: a person signs through a `signature-pad`, and nothing else writes the field.

<!-- sovrium:options SignatureFieldSchema -->

```yaml
- { id: 4, name: client_signature, type: signature, bucket: signatures }
```

A signature is given only through the field's signing route, `POST /api/tables/{table}/records/{id}/signatures/{field}`, which a `signature-pad` calls. The request is multipart: the signer's consent, the drawing as PNG bytes (at most 512 KB and 2000 × 800 pixels) or a typed name, the page the pad was shown on and the SHA-256 of the statement it showed. The caller must be signed in and allowed to write the field; any other caller gets the `404` a missing record gets. The server checks the image and stores it under its own key in the field's bucket, resolves the statement from that page's pad against the record as it stands (`409` with code `STATEMENT_CHANGED` when it no longer matches what was read), stamps the instant and writes the value. A request without consent is refused with `400` and code `CONSENT_REQUIRED`; an image that is not such a PNG with `400` and code `IMAGE_INVALID`. A field that a signing flow signs (a `signers[].field` under `signatures`) is signed through that flow's links only, and its route answers `404`.

Every other way of writing a record refuses a value for the field with a `400` naming it: a single or batch create or update, a bulk edit from the grid, an upsert, a CSV import, a form mapping, an automation step or an agent tool. A write that sends the stored value back unchanged, or nothing over an empty field, changes nothing and is accepted.

It is written once. A signature already stored cannot be replaced or cleared, by the signing route or any other write. Of several first signatures of one field arriving at once, one is stored and the others are refused with `400` and the message `<field> is already signed and cannot be changed`. `bucket` must name a bucket the app declares, or `system`; omitting it stores the image in the built-in `system` bucket.

The value is stored as one JSON object (a `jsonb` column on PostgreSQL, JSON text on SQLite), and the records API answers it as that object on both engines:

```json
{
  "version": 2,
  "evidenceId": "0b8e3f0c-1d2e-4f5a-8b9c-0d1e2f3a4b5c",
  "image": "signature-evidence/0b8e3f0c-1d2e-4f5a-8b9c-0d1e2f3a4b5c.png",
  "signerName": "Claude Rousseau",
  "signedAt": "2026-11-02T09:00:00.000Z",
  "statement": "I approve the quote of 4 120 € for Atelier Rousseau.",
  "method": "drawn",
  "identity": { "kind": "account", "userId": "…" }
}
```

`identity.kind` says how the engine knows who signed: `account` for a signed-in person, `imported` for a value written by `sovrium seed` (which also carries no `evidenceId`). The value holds no email address, phone number or network address. A value stored by an earlier version has no `version`; it is never rewritten, and a read answers it with `"provenance": "client-asserted"`, because the browser composed it.

`sovrium seed` writes a signature from a seed file in either shape (`{ image, signerName, statement, method }` with an optional `signedAt`, or a version 2 value) and stores it as `imported`. A CSV export writes the value as its JSON. Purging the record deletes the image from the field's bucket, unless another record's signature still names it. Erasing the signer's account replaces `signerName` with `[erased]` and the image key with `null`, and drops the account id from `identity`, in every signature whose image she uploaded or whose `identity` names her account, typed ones included; it keeps `signedAt`, `method` and `statement`, and deletes the image. That is the one change the write-once rule does not refuse.
