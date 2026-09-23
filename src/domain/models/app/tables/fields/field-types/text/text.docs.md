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
