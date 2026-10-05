# Number Fields

> The numeric field types — integer, decimal (also spelled number), currency, percentage, rating and progress.

Seven field types store numbers, currencies, percentages, ratings and progress indicators. All of them also accept the base field properties every field type shares.

| Type         | Stores                                             |
| ------------ | -------------------------------------------------- |
| `integer`    | Whole numbers with optional min/max range.         |
| `decimal`    | Fixed-precision decimals (1–10 decimal places).    |
| `number`     | An alias of `decimal`, read as a JSON number.      |
| `currency`   | Monetary values with ISO 4217 code and formatting. |
| `percentage` | Percentage values, displayed with `%`.             |
| `rating`     | Star/icon rating with a configurable maximum.      |
| `progress`   | A 0–100 progress bar with an optional colour.      |

## `integer`

Whole numbers, with no decimal places.

<!-- sovrium:options IntegerFieldSchema -->

```yaml
- { id: 1, name: quantity, type: integer, required: true, min: 0, max: 9999 }
```

## `decimal`

Fixed-precision decimal numbers. `precision` is the number of decimal places kept, and it is a storage decision rather than a display one — a value is rounded to it on write.

<!-- sovrium:options DecimalFieldSchema -->

```yaml
- { id: 2, name: weight_kg, type: decimal, precision: 3 }
```

### `number`

`number` is an alias of `decimal`. It takes exactly the same options and is stored the same way, so it sorts, filters, aggregates and computes in formulas identically. One thing differs on the wire: the records API returns a `number` value as a JSON number, while a `decimal` value is a string that keeps every digit. Use `decimal` where precision beyond a JavaScript number matters, and whichever name reads better otherwise.

```yaml
- { id: 7, name: height_m, type: number, precision: 2, min: 0 }
```

## `currency`

Monetary values, carrying the ISO 4217 code alongside the amount so a figure is never ambiguous about what it is denominated in.

An amount is grouped by thousands unless the field declares `thousandsSeparator` — including at `precision: 0`, so a whole-euro field reads `€48,500`. On a page, an undeclared separator follows the page language (`48 500 €` on a French page); the records API has no page and always groups with a comma. A declared `thousandsSeparator`, `none` included, always wins.

An amount is written in the page language unless the field declares its `thousandsSeparator`, on every surface that prints it.

<!-- sovrium:options CurrencyFieldSchema -->

```yaml
- { id: 3, name: total, type: currency, currency: EUR, precision: 2 }
```

## `percentage`

A percentage, displayed with a `%` suffix.

<!-- sovrium:options PercentageFieldSchema -->

```yaml
- { id: 4, name: margin, type: percentage, precision: 1 }
```

## `rating`

A star or icon rating out of a configurable maximum. Stored as an integer, so it sorts and aggregates like one.

<!-- sovrium:options RatingFieldSchema -->

```yaml
- { id: 5, name: satisfaction, type: rating, max: 5 }
```

## `progress`

A 0–100 completion value, rendered as a bar.

<!-- sovrium:options ProgressFieldSchema -->

```yaml
- { id: 6, name: completion, type: progress, color: '#6b7f5e' }
```
