# Formula Fields

> A column computed from an expression over the record's other fields — and the display properties that decide how the result reads.

A `formula` field stores nothing a user types. Its value is computed from an expression referencing other fields in the same record, and it recomputes whenever one of those inputs changes.

```yaml
- { id: 1, name: total_price, type: formula, formula: 'price * quantity', resultType: number }
```

<!-- sovrium:options FormulaFieldSchema -->

## Money computed by a formula

A formula over currency fields is money, but it does **not** inherit the currency of the fields it references. An expression may touch several currency fields or none at all, so there is nothing to inherit from without guessing. Declare the code:

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
  formula: "'INV-' || LPAD(invoice_number::text, 5, '0')"
  resultType: string
```

Keeping the sequence and its presentation apart means the reference can be restyled without touching the numbers already allocated.

## Not every function reaches SQLite

A formula is translated into SQL, and SQLite — the zero-config default engine — does not provide every function PostgreSQL does. The engine handles the gap in two ways rather than one:

- **Translated.** `GREATEST` and `LEAST` become SQLite's `max` and `min`, so they work on both engines with nothing to change.
- **Refused, loudly.** A formula calling a function SQLite lacks — `to_char`, `date_trunc`, `extract`, `regexp_replace`, `array_length` and others — **stops the boot** when the DDL is generated, naming the function and the dialect. A refused boot naming `to_char` is better than a view that creates cleanly and then rejects every write.

Two things follow. The refusal fires at DDL-generation time, not at `sovrium validate`, so a formula can validate and still stop `start` on SQLite. And the refused list is the MEASURED set rather than an exhaustive one: functions nobody has measured fall through untranslated and fail later, so test a formula on the engine you will deploy on.

Intuition is a poor guide here in both directions. Bun ships SQLite's math extension, so `power`, `sqrt`, `ceil`, `floor`, `mod`, `exp`, `ln`, `log`, `sign` and `trunc` all work — while `repeat` and `strpos`, which look far more primitive, do not.

The `LPAD` example above is a case in point: it is fine today, but a Postgres cast such as `::text` beside it is Postgres syntax, so keep a formula meant to run on both engines to the portable subset.

## A computed column is not editable

`formula` is derived, like `count`, `rollup` and `lookup`. It recomputes from its inputs and is not writable through the records API or a form: a write naming it is refused rather than silently ignored, because a value that looks stored and is not is the worse of the two failures.
