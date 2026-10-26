# Formula Fields

> A column computed from an expression over the record's other fields — and the display properties that decide how the result reads.

A `formula` field stores nothing a user types. Its value is computed from an expression referencing other fields in the same record, and it recomputes whenever one of those inputs changes.

A formula that is added or edited is computed for every row already in the table when the app next starts, and the record a write returns carries its computed value. The same happens once after an upgrade to a version of Sovrium that computes formulas differently: the first start recomputes every formula for the rows already there. That recompute runs no automation and leaves each row's modification time alone.

```yaml
- { id: 1, name: total_price, type: formula, formula: 'price * quantity', resultType: number }
```

<!-- sovrium:options FormulaFieldSchema -->

## Money computed by a formula

A formula over currency fields is money, but it does **not** inherit the currency of the fields it references. An expression may touch several currency fields or none at all, so there is nothing to inherit from without guessing. A rollup does inherit: it has exactly one source field, so there is nothing to choose between. Declare the code:

```yaml
- id: 12
  name: unit_price
  type: currency
  currency: EUR
  precision: 2
- id: 27
  name: stock_value
  type: formula
  formula: unit_price * stock_on_hand
  resultType: number
  format: currency
  currency: EUR
```

Omit `currency` and the amount renders with the `USD` default — which is how a `stock_value` column came to print `$224,430.90` beside the `€28.63` it was computed from.

The five display properties — `currency`, `precision`, `symbolPosition`, `negativeFormat`, `thousandsSeparator` — are the same ones a `currency` field accepts, and they behave identically here.

With `format: currency` declared, a numeric result reads as an amount in every grid, even one whose column declares no `format` — the grid that derives its columns from the table included — exactly as a `currency` field's cell does, in the page language: `€46 800` on an English page, `46 800 €` on a French one.

## What is checked, and what is not

`resultType` and `format` are free strings rather than closed vocabularies. The conventional values are `string`, `number`, `boolean` and `date` for the first, and `currency`, `percentage`, `decimal` and `date` for the second, but the schema accepts any string and validates none of them — so a typo passes `sovrium validate` and surfaces later as a rendering surprise rather than as an error.

The five currency-display properties are the exception. Those **are** validated, and an invalid value is refused when the configuration is decoded.

`formula` itself is checked for the field references it makes: an expression naming a column that does not exist on the table fails the decode.

## Composing a human-facing reference

`autonumber` deliberately takes no prefix or padding options. A formula is where that presentation belongs:

```yaml
- { id: 3, name: invoice_number, type: autonumber }
- id: 4
  name: invoice_reference
  type: formula
  formula: "'INV-' || LPAD(CAST(invoice_number AS TEXT), 5, '0')"
  resultType: string
```

Keeping the sequence and its presentation apart means the reference can be restyled without touching the numbers already allocated.

## Not every function reaches SQLite

A formula is translated into SQL, and SQLite — the zero-config default engine — does not provide every function PostgreSQL does. The engine handles the gap in three ways rather than one:

- **Translated.** `IF(cond, then[, else])` works on both engines and reads as `CASE` (no `else` gives a blank). `GREATEST` and `LEAST` become SQLite's `max` and `min`, `strpos` its `instr`, `chr` its `char`. `LPAD(text, length[, fill])` pads the same on both engines: a shorter text is preceded by the fill (a space when none is given) up to the length, a longer one is cut to it, counted in characters. `YEAR`, `MONTH`, `DAY`, `HOUR`, `MINUTE` and `SECOND` read one part of a date in UTC on both engines, exactly as `date_part_utc` does.
- **Refused, loudly.** A formula calling a function SQLite lacks — `to_char`, `date_trunc`, `extract`, `regexp_replace`, `array_length`, `initcap`, `string_to_array`, `array_to_string` and `date_add` (use `add_days`) and others — **stops the boot** when the DDL is generated, naming the function and the dialect. A refused boot naming `to_char` is better than a view that creates cleanly and then rejects every write.
- **Refused on both engines.** `date_diff` and `date_sub` exist on neither engine: use `days_between(a, b)` and `add_days(d, -n)`. `COUNTA` and `COUNTALL` count a linked table's values, so they belong to a `rollup` field, not a formula; `flatten` has nothing to flatten in a record. A formula calling any of them is refused by `sovrium validate` and at boot, naming the function.

Two things follow. The refusal fires at DDL-generation time, not at `sovrium validate`, so a formula can validate and still stop `start` on SQLite. And the refused list is the MEASURED set rather than an exhaustive one: functions nobody has measured fall through untranslated and fail later, so test a formula on the engine you will deploy on.

Intuition is a poor guide here in both directions. Bun ships SQLite's math extension, so `power`, `sqrt`, `ceil`, `floor`, `mod`, `exp`, `ln`, `log`, `sign` and `trunc` all work — while `repeat`, which looks far more primitive, does not. `strpos` works on both engines: SQLite runs it as its own `instr`, with the same answer — a 1-based position counted in characters, 0 when the text is absent, blank when either argument is blank. `chr` works on both engines too: a code point becomes the same character, accented and non-Latin ones included, and a blank code gives a blank result.

The `LPAD` example above runs the same on both engines. Write its cast as `CAST(… AS TEXT)`: PostgreSQL's `::text` is syntax SQLite cannot read, so keep a formula meant to run on both engines to the portable subset.

A formula that reads a date as text — `CAST(due AS TEXT)`, `'Due ' || due`, `CONCAT('Due ', due)` — is computed when the row is saved, on PostgreSQL as on SQLite, and reads the same day on both. So is a formula reading the clock (`CURRENT_DATE`, `NOW()`), a `created-at` or `updated-at` field, or another formula whose result is a date or a datetime: each is computed in UTC on both engines, whatever time zone the database server runs in. A datetime read as text is still spelled differently by the two engines: PostgreSQL writes it in UTC (`2026-10-05 14:30:00+00`), while SQLite keeps the text the value was written with. For a label that reads the same everywhere, take only the day — `SUBSTR(CAST(starts_at AS TEXT), 1, 10)` — of a datetime written in UTC, or use the date functions below.

## Dates that read the same on both engines

Three functions answer identically on SQLite and PostgreSQL, in UTC, whatever time zone the database runs in:

- `days_between(a, b)` — the number of calendar days from `b` to `a`, counted on UTC days. Negative when `a` is the earlier day, blank when either is blank. Two instants an hour apart on each side of midnight UTC are one day apart. Whole weeks: `days_between(a, b) / 7`.
- `add_days(d, n)` — the UTC day of `d` moved by `n` days, backwards when `n` is negative. The result is a day, never an instant; blank when `d` or `n` is blank. Weeks: `add_days(d, n * 7)`.
- `date_part_utc(part, x)` — one part of `x` as a whole number, read in UTC. `part` is one of `'year'`, `'month'`, `'day'`, `'hour'`, `'minute'`, `'second'`, `'dow'` (the weekday, 0 for Sunday to 6 for Saturday), `'week'` (the ISO 8601 week, 1 to 53: weeks start on Monday, and week 1 holds the year's first Thursday) and `'isoyear'` (the year that week belongs to, which differs from `'year'` for a few days around 1 January). Any other part stops the boot and lists the parts above.

The spreadsheet spellings `YEAR(x)`, `MONTH(x)`, `DAY(x)`, `HOUR(x)`, `MINUTE(x)` and `SECOND(x)` are the same function: `YEAR(stay_on)` is `date_part_utc('year', stay_on)`.

```yaml
- {
    id: 7,
    name: lead_days,
    type: formula,
    formula: 'days_between(delivered_on, ordered_on)',
    resultType: integer,
  }
- { id: 8, name: reminder_on, type: formula, formula: 'add_days(due_on, 3)', resultType: date }
- {
    id: 9,
    name: delivery_week,
    type: formula,
    formula: "date_part_utc('week', delivered_on)",
    resultType: integer,
  }
```

There is no shift or difference by months or years: moving 31 January by a month has no answer both engines share.

## A computed column is not editable

`formula` is derived, like `count`, `rollup` and `lookup`. It recomputes from its inputs and is not writable through the records API or a form: a write naming it is refused rather than silently ignored, because a value that looks stored and is not is the worse of the two failures.
