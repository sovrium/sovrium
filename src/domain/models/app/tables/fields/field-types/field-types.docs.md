# Field Types

> Every field type a table column can declare, grouped into ten categories — and the base properties all of them share.

A table's `fields` array declares its columns. Every field carries the same base properties and adds type-specific ones on top, so learning one category teaches the shape of the rest.

## Base field properties

Shared by every field type, whatever its category.

<!-- sovrium:options BaseFieldSchema -->

`type` is the discriminant: it decides which additional properties the field accepts, and a property belonging to another type is refused when the config is decoded rather than ignored at runtime.

## The categories

| Category           | Field types                                                                                          |
| ------------------ | ---------------------------------------------------------------------------------------------------- |
| Text               | `single-line-text`, `long-text`, `rich-text`, `email`, `url`, `phone-number`                         |
| Numeric            | `integer`, `decimal`, `currency`, `percentage`, `rating`, `progress`                                 |
| Date & Time        | `date`, `datetime`, `time`, `duration`, `created-at`, `updated-at`, `deleted-at`                     |
| Selection          | `checkbox`, `single-select`, `multi-select`, `status`                                                |
| Relational         | `relationship`, `lookup`, `rollup`                                                                   |
| User & Audit       | `user`, `created-by`, `updated-by`, `deleted-by`                                                     |
| Attachment & Media | `single-attachment`, `multiple-attachments`, `barcode`                                               |
| Computed & Action  | `formula`, `rollup`, `count`, `autonumber`, `button`                                                 |
| Structured         | `json`, `array`, `geolocation`, `color`, `code`                                                      |
| AI                 | `ai-generate`, `ai-summary`, `ai-categorize`, `ai-extract`, `ai-sentiment`, `ai-tag`, `ai-translate` |

Each category is documented beside the schemas that declare it, so the list of options you read is the list the binary accepts.

## Choosing a type is choosing a column

A field type is not a display hint. It decides the database column, the constraint on it, and what a filter or an aggregation can do with the values — which is why a phone number is text rather than a number, and why a duration is stored in seconds rather than as `2h 30m`.

The consequence worth planning for: changing a field's `type` on a table that already holds data is a migration, not an edit. Changing its `label`, its ordering or most of its type-specific options is not.
