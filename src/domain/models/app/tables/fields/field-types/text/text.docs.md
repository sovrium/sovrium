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

Automations read it unchanged — a record step nobody started hands it to the next step, which can send it where it is needed — and the run history stores `***` in its place. The value leaves the server only on a request the automation makes: an answer to whoever started the run — a `webhook/response`, a manual run's output — carries `***` instead, with the one exception below. A run a person started by hand reads as that person, so the value is absent from its steps — and from those of any automation it calls. What a called automation returns is masked in the caller's run history and answers too, like a value the caller read itself. Seed files write it, and the seed command never prints it.

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
