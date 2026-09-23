# Number Fields

> The six numeric field types — integer, decimal, currency, percentage, rating and progress.

Six field types store numbers, currencies, percentages, ratings and progress indicators. All of them also accept the base field properties every field type shares.

| Type         | Stores                                             |
| ------------ | -------------------------------------------------- |
| `integer`    | Whole numbers with optional min/max range.         |
| `decimal`    | Fixed-precision decimals (1–10 decimal places).    |
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

## `currency`

Monetary values, carrying the ISO 4217 code alongside the amount so a figure is never ambiguous about what it is denominated in.

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
