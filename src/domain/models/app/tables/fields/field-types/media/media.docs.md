# Attachment & Media Fields

> File uploads with bucket, MIME, size and thumbnail controls — plus the barcode field that shares their directory.

Three field types live in the media category. Two upload files into a storage bucket; `barcode` stores a scannable value. All of them also accept the base field properties every field type shares.

| Type                   | Stores                     |
| ---------------------- | -------------------------- |
| `single-attachment`    | A single uploaded file.    |
| `multiple-attachments` | Several uploaded files.    |
| `barcode`              | A scannable barcode value. |

## `single-attachment`

One uploaded file — an avatar, a document, an image.

<!-- sovrium:options SingleAttachmentFieldSchema -->

```yaml
- id: 1
  name: avatar
  type: single-attachment
  bucket: avatars
  allowedFileTypes: [image/png, image/jpeg]
  maxFileSize: 2097152
```

Omitting `bucket` stores the file in the implicit `default` bucket. That bucket exists without being declared, which is convenient and worth knowing about: it carries no permissions of its own, so a field that needs access rules should name a bucket declared in `app.buckets`.

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
