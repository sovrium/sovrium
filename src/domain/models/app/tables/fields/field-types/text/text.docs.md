# Text Fields

> The six text field types — single-line text, long text, rich text, email, URL and phone number.

Six field types store textual content, from short labels to formatted rich text and validated strings. All of them also accept the base field properties every field type shares.

| Type               | Stores                                                           |
| ------------------ | ---------------------------------------------------------------- |
| `single-line-text` | Short, single-line text (names, titles, labels).                 |
| `long-text`        | Multi-line plain text (descriptions, notes, comments).           |
| `rich-text`        | Formatted HTML rendered with a WYSIWYG editor.                   |
| `email`            | Email address validated against RFC 5322.                        |
| `url`              | Web address validated as an absolute URL.                        |
| `phone-number`     | Phone number stored as text; preserves international formatting. |

## `single-line-text`

Short text limited to a single line. Stored as-is, without formatting.

<!-- sovrium:options SingleLineTextFieldSchema -->

```yaml
- { id: 1, name: title, type: single-line-text, required: true, indexed: true, default: Untitled }
```

## `long-text`

Multi-line plain text. Line breaks are preserved; there is no rich formatting.

<!-- sovrium:options LongTextFieldSchema -->

```yaml
- { id: 2, name: description, type: long-text, default: 'Enter description here...' }
```

## Write-only text

`writeOnly: true` on a `single-line-text` or `long-text` field keeps a secret — a client secret, an API token, a private key — out of every read, for every role, the admin included. Anyone allowed to write the field can set and replace it, but no answer ever carries it back: not the records API (list, read, or the answer to a create or an update), not an export, a realtime event, an MCP tool, the operator console, the record history or a table webhook. A record shows only whether a value is stored, in its `_writeOnly` block:

```json
{
  "id": "1",
  "fields": { "sso_client_id": "client-7f3a" },
  "_writeOnly": { "sso_client_secret": true }
}
```

Filtering, sorting, grouping, aggregating or searching on the field answers `404`, as for a field that does not exist. The operator console shows **Set** or **Not set**, and the record history names a change to the field without keeping either value.

Automations read it unchanged — a record step nobody started hands it to the next step, which can send it where it is needed — and the run history stores `***` in its place. The value leaves the server only on a request the automation makes: an answer to whoever started the run — a `webhook/response`, a manual run's output — carries `***` instead, with the one exception below. A run a person started by hand reads as that person, so its steps — and those of any automation it calls — hold `***` where a value is stored (an empty string where none is), never the value; a list step may still name the field in `fields`, but not filter or sort on it. What a called automation returns is masked in the caller's run history and answers too, like a value the caller read itself. Seed files write it, and the seed command never prints it.

One answer can carry it: a webhook whose trigger names the field in `revealWriteOnly`, for a machine that pulls its own secrets — a server asking for the environment of the apps it runs. The webhook must authenticate a machine: `auth.type` `session` with a `requiredRole` other than the `auth.defaultRole` every sign-up receives (`member` unless declared), `bearer` or `apiKey`, and not `respondImmediately`. Each entry is `table.field` and must name a write-only field. On a `session` webhook only a caller presenting an API key receives the value; a person signed in with a session cookie still gets `***`. Only what the run's own record steps read from the named fields is revealed, in the `webhook/response` answer: every other write-only field, a value a called automation returns, and the run history stay masked, and a manual run of the same automation reads as the person who started it. An answer that can carry the value is sent with `Cache-Control: no-store`, replacing any the response declares.

```yaml
trigger:
  type: webhook
  method: GET
  auth: { type: session, requiredRole: node }
  revealWriteOnly: [apps.sso_client_secret]
```

The guarantee covers every way to read the app, not its storage: the value is stored as written, so a `sovrium backup` archive and direct access to the database carry it. Keep both as you keep the secret itself.

Because each would answer a question about the hidden value, a write-only field cannot be `unique` or `fullTextSearch`, no formula, lookup, rollup or relationship label may read it, no view may group or sort on it, and no form may offer it as a choice. Pages follow the same rule, in an app with no `auth` block too.

```yaml
- { id: 7, name: sso_client_secret, type: single-line-text, writeOnly: true }
```

## Translatable text

`translatable: true` on a `single-line-text` or `long-text` field keeps one value per language the app declares, in the field's own column, as a map from language code to text: `{ "en": "Linen shirt", "fr": "Chemise en lin" }`. On PostgreSQL the column is `jsonb`; on SQLite it is a text column that accepts JSON only. Use it for content that differs by language — a product name, an article body, a slug that differs by language — and leave codes that are the same in every language, such as a SKU, untranslatable.

```yaml
languages:
  default: en
  supported:
    - { code: en, locale: en-GB, label: English }
    - { code: fr, locale: fr-FR, label: Français }
tables:
  - id: 1
    name: products
    fields:
      - { id: 1, name: sku, type: single-line-text, required: true }
      - {
          id: 2,
          name: name,
          type: single-line-text,
          translatable: true,
          default: { en: Untitled, fr: Sans titre },
        }
      - { id: 3, name: description, type: long-text, translatable: true, indexed: true }
```

A `default` written as a string fills the default language only; a map fills each language it names. A seed file takes the same two forms: `name: Linen shirt` stores the default-language value, and `name: { en: Linen shirt, fr: Chemise en lin }` stores both. With `indexed: true`, each declared language gets an index of its own.

`sovrium validate` refuses, naming the field:

- a translatable field that is also `writeOnly` or `fullTextSearch`, a translatable `long-text` that is also `unique`, and a table `unique` entry or unique index naming a translatable field (naming the table and the entry);
- a translatable field in an app that declares fewer than two languages;
- a `default` given as a map on a field that is not translatable, or naming a language the app does not declare;
- a formula or a rollup that reads a translatable field, and a row-level permission condition that names one;
- a seed value given as a map that names a language the app does not declare.

Changing the option on a table that holds records keeps the data:

- **Turning it on** keeps each stored value as the default-language value of its new map; an empty value stays empty.
- **Turning it off** keeps one value per record — the default language's, else the first one present — and drops the others. Because languages are lost, the change needs `allowDestructive: true` on the table; without it the server refuses to start and names the field.
- **Adding a language** changes no column: the new language can hold values at once.
- **Removing a language** keeps its values stored. `sovrium migrate --dry-run` prints a warning naming the field and each language left behind.

### Unique in each language

On a translatable `single-line-text`, `unique: true` holds **within each language**: two live records cannot share a value in the same language, the same value in two languages is allowed (`/en/menu` and `/fr/menu`), and a record with no value in a language never collides. Values compare exactly, and a value held only in the trash can be taken again. A write taking a value another record holds in that language is answered `409`, naming the field and the language, `slug (fr)`, never the value. Making the field unique, declaring a language again, or turning `translatable` off when two records would then share a value is refused by `sovrium migrate --dry-run` and at boot, listing each value, its language and the ids holding it; `allowDestructive` does not lift that refusal.

### Reading translatable text

A read returns each translatable field as **one string**, in the reader's language. When the record has no value in that language, the read falls back to `languages.fallback`, then to `languages.default` — the same order `$t:` keys fall back in, so a page never shows its labels in one language and its content's fallback in another.

The records API picks the language in this order:

1. `?lang=fr` on the list (`GET /api/tables/:tableId/records`), on a single record (`GET /api/tables/:tableId/records/:recordId`) or on a view's records (`GET /api/tables/:tableId/views/:viewId/records`). A language the app does not declare is ignored, as if the parameter were absent.
2. The `Accept-Language` header: the first declared language it names, in the order of preference it gives. `fr-CH` reads as `fr`.
3. `languages.default`.

`?lang=*` returns each translatable field as its whole map, `{ "en": "Linen shirt", "fr": "Chemise en lin" }`, for a client that handles every language itself. Fields that are not translatable are unchanged in every case.

A response holding resolved values names the language it served in `Content-Language`, and sends `Vary: Accept-Language` so a cache keeps one copy per language.

A lookup of a translatable field reads in the same language as its source, and carries the map under `?lang=*`. A related record's label (`labels=collection:title`) taken from a translatable field reads in the reader's language too.

A page shows a translatable field in the page's own language: `$record.name` on `/fr/catalogue` reads the French value, else the fallback, else the default, and so do the cards of a kanban or a gallery, whatever language the reader's browser prefers. The operator console shows the default language. A language removed from `languages` keeps its values in storage, but they are no longer served: not as the reader's language, not as a fallback, not under `?lang=*`, and not in any export, webhook or GDPR export.

### Writing translatable text

A write never replaces the whole map. It changes the languages it names and keeps every other one:

- **A plain string** writes the writer's language, picked as a read picks it: `?lang=`, then `Accept-Language`, then `languages.default`. `PATCH …/records/12?lang=fr` with `{ "name": "Chemise en lin" }` adds the French value and keeps the English one.
- **An object** writes each language it names: `{ "name": { "fr": "Chemise", "de": "Leinenhemd" } }`.
- **`null` or `""`** for a language removes it: `{ "name": { "de": null } }`. `null` for the whole field clears every language.
- A language the app does not declare, including one removed from `languages`, or a value that is not text, is refused with `400`, naming the field, and nothing is written.
- `required: true` asks for the **default** language: a create must name it, and no write may remove it. The other languages stay optional.

Two writers changing two languages of one record at the same moment both keep their change: the merge happens in the database, on the stored map. The answer to a write reads as a read does, in the writer's language, or as maps under `?lang=*`. The import route fills the default language from `name` and each other language from `name.fr`, `name.de` and so on. In the operator console, the record sheet shows one tab per language, the default first, and a save keeps every language. A public form files a submission's answers under the language its page is shown in.

### Filtering, searching and exporting translatable text

A **filter** or a **sort** on a translatable field, in a query or a saved view, compares its **default-language** value, whatever language the reader reads in: a French reader filtering `name` on `Linen shirt` finds the shirt, filtering on `Chemise en lin` finds nothing, and a sort follows the English order while each name still reads in French. With `indexed: true`, the default language's index serves those queries. A **search** with `q` reads every language: a word of any of them finds the record, and a language code is never a word of the content.

Exports and webhooks carry each translatable field as its **whole map**, whatever language the request or the write was made in: the JSON export, a user's GDPR export, every webhook payload, every realtime change event and the MCP record tools hold `{ "en": "…", "fr": "…" }`, and an MCP create or update writes a map merged by language. The CSV export gives the field one column per declared language, `name.en`, `name.fr`, the spelling the import reads back. In an automation, `{{trigger.data.record.name}}` prints the default-language value and `{{trigger.data.record.name.fr}}` the French one.

## `rich-text`

Formatted text with bold, italic, links, lists and headings, edited in a WYSIWYG editor and stored as HTML.

<!-- sovrium:options RichTextFieldSchema -->

```yaml
- id: 3
  name: article_content
  type: rich-text
  required: true
  maxLength: 10000
  toolbar: [bold, italic, link, heading, list]
  placeholder: 'Write your article...'
```

Omitting `toolbar` offers every action. Declaring it is how a field is narrowed to the formatting a surface can actually render — a `table` cell showing a heading is rarely what anyone wanted.

## `email`

Text validated as an email address (RFC 5322). Commonly paired with `unique: true` and `indexed: true` for authentication and lookups.

<!-- sovrium:options EmailFieldSchema -->

```yaml
- { id: 4, name: contact_email, type: email, required: true, unique: true, indexed: true }
```

## `url`

Text validated as an absolute web address. A value with no scheme is refused rather than silently prefixed, because guessing between `http` and `https` is a guess about security.

<!-- sovrium:options UrlFieldSchema -->

```yaml
- { id: 5, name: website, type: url }
```

## `phone-number`

A phone number stored as text. Storing it as text rather than as a number is deliberate: a leading `+`, a leading zero and internal spacing all carry meaning, and every one of them is lost by a numeric type.

<!-- sovrium:options PhoneNumberFieldSchema -->

```yaml
- { id: 6, name: mobile, type: phone-number }
```
