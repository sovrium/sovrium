# Structured Fields

> Five field types holding a value with more shape than a string or a number — nested data, lists, colours, source code and coordinates.

| Type          | Stores                               |
| ------------- | ------------------------------------ |
| `json`        | Structured JSON data                 |
| `array`       | A list of values                     |
| `color`       | A hex colour value                   |
| `code`        | Source code with syntax highlighting |
| `geolocation` | Latitude and longitude coordinates   |

`barcode` stores a scannable code and belongs to the media category; it is documented with the attachment fields.

## `json`

<!-- sovrium:options JsonFieldSchema -->

```yaml
- { id: 5, name: metadata, type: json, required: false }
```

`schema` does **not** validate anything. It is declared as an open object, so any value is accepted and no JSON-Schema semantics are applied to what is stored. Where the shape matters, check it in an automation or at the application boundary — and do not read the presence of `schema` as a guarantee it is enforced.

## `array`

<!-- sovrium:options ArrayFieldSchema -->

```yaml
- { id: 6, name: tags, type: array, itemType: string, maxItems: 10 }
```

Both properties are enforced. `itemType` is not free text: it is checked against the list below when the configuration is validated, and an unrecognised spelling is reported by name. Omitting it stores an untyped list of text.

| `itemType`                     | Element type       |
| ------------------------------ | ------------------ |
| `text`, `string`, `varchar`    | `TEXT`             |
| `integer`, `int`               | `INTEGER`          |
| `bigint`                       | `BIGINT`           |
| `smallint`                     | `SMALLINT`         |
| `decimal`, `numeric`, `number` | `DECIMAL`          |
| `float`, `double`              | `DOUBLE PRECISION` |
| `real`                         | `REAL`             |
| `boolean`, `bool`              | `BOOLEAN`          |
| `date`                         | `DATE`             |
| `datetime`, `timestamp`        | `TIMESTAMPTZ`      |
| `time`                         | `TIME`             |
| `uuid`                         | `UUID`             |
| `json`, `jsonb`                | `JSONB`            |

Several spellings are aliases for one type — `string` and `text` both select `TEXT` — so either is correct and the two cannot behave differently. On SQLite an array is stored as JSON text whatever the element type, so a configuration that works on one engine works on the other.

## `color`

<!-- sovrium:options ColorFieldSchema -->

```yaml
- { id: 7, name: brand_color, type: color, required: true, default: '#3B82F6' }
```

This is the one field here with a real format check: `default` must be `#` followed by exactly six hexadecimal digits. Three-digit shorthand (`#3BF`) and named colours (`red`) are refused when the configuration is decoded.

## `code`

<!-- sovrium:options CodeFieldSchema -->

```yaml
- { id: 8, name: snippet, type: code, language: typescript, lineNumbers: true, tabSize: 2 }
```

`language` is required but unconstrained — the values with highlighting support include `javascript`, `typescript`, `yaml`, `json`, `python` and `sql`, but an unknown or empty string still passes validation. `tabSize` has no schema default; the editor falls back to two spaces when the field omits it.

**The same editor opens in a data grid.** Double-clicking a `code` cell opens the full editing surface over the row rather than a single-line text box, so multi-line source survives being corrected from the grid where a plain input would have flattened it to one line. Tab commits the cell and moves on; Enter belongs to the editor, so it inserts a newline.

Every property above applies in a grid exactly as it does in a form: a field declaring `lineNumbers: false` and `tabSize: 4` gets a gutterless, four-space editor in both. A property the field leaves out keeps the editor's own default in both places — the gutter on, two-space indentation, and a box between roughly six lines and 400 pixels tall.

To render the editor display-only, set `readOnly` on the **form field** rather than on the column: read-only is a property of a particular form, not of the stored value. A grid opens an editor only once it has decided the field is editable, so the question is already answered by the time a cell is reached.

## `geolocation`

<!-- sovrium:options GeolocationFieldSchema -->

```yaml
- { id: 9, name: office_location, type: geolocation, required: true }
```

Latitude and longitude, with no type-specific properties beyond the ones every field shares.
