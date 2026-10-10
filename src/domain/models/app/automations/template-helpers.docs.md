# Template Helpers

> Every helper you can call inside `{{ }}`, with its arguments and an example, and how a value is escaped for the place it lands: an HTML body, an SVG or Word file, a URL, a JSON body or plain text.

Helpers transform a value where it is written. They work in every template Sovrium renders: an action prop (`subject: 'Order {{uppercase trigger.data.ref}}'`), an email body, and the templates of document and email actions (HTML, SVG, Word, plain text). The same names behave the same way everywhere; only the escaping around them changes with the output.

The helpers that exist only in a document or email template — `pageBreak`, `image`, `qrcode` and `t` — together with partials, layouts, Word templates and templates stored in a bucket, are described in Document Template Helpers.

## Calling a helper

| Form                | Example                                                      |
| ------------------- | ------------------------------------------------------------ |
| One argument        | `{{uppercase trigger.data.name}}`                            |
| Literal arguments   | `{{truncate trigger.data.body 100 "…"}}`                     |
| Nested calls        | `{{slugify (lowercase trigger.data.title)}}`                 |
| Named arguments     | `{{qrcode ticket.code size=180 ecc="H"}}`                    |
| A helper in a block | `{{#each (chunk labels 3)}}…{{/each}}`                       |
| A helper as a test  | `{{#if (gt order.total 100)}}Premium{{else}}Standard{{/if}}` |

- An argument is a path (`trigger.data.name`, `this.city`, `@index` inside `{{#each}}`), a quoted string, a number, `true`/`false`, or a call in parentheses.
- A path that resolves to nothing renders as an empty string, never as `undefined`.
- `{{now}}` and `{{today}}` take no value. Passed to another helper they must be wrapped in parentheses — `{{formatDate (now) "yyyy-MM-dd"}}` — or they are read as a variable that does not exist, and the expression renders empty.
- The template language's own block helpers are always there: `{{#each}}` (with `@index`, `@first`, `@last` and `this`), `{{#if}}`/`{{else}}`, `{{#unless}}`, `{{#with}}` and `{{lookup}}`. `if` also works inline: `{{if cond "yes" "no"}}`.
- A misspelled helper is the usual silent failure. In an action prop, a call to a name that is no helper leaves the whole prop as written, braces included; in a document or email template it fails the step, naming the helper. A bare name with no arguments (`{{totl}}`) is read as a missing value everywhere and renders empty. Several helpers have aliases for exactly this reason — they are listed in the tables below.

## Escaping: the output decides, not the author

A template's own text is never touched. What an expression inserts is encoded for the place it lands, so a value can never change the structure around it — a name like `Dupont & Fils <SARL>` prints as written and never breaks the file. The mode is chosen by where the template is used; you never set it.

| Where the template is used                                                               | Mode   | A value from an expression is…                                                               | Helpers whose output is kept as is                        |
| ---------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| An HTML template (PDF, HTML image), an email `template`, the `body` of `email/send`      | `html` | HTML-escaped: `&`, `<`, `>`, `"` and `'`                                                     | `escapeHtml`, `safeHtml`, `pageBreak`, `image`, `qrcode`  |
| An SVG template, a Word (`.docx`) template                                               | `xml`  | XML-escaped, and characters XML cannot hold (control characters) are removed                 | none                                                      |
| The plain-text part of an email (`text`), a plain-text template, every other action prop | `text` | inserted unchanged                                                                           | —                                                         |
| The `url` of an `http` or `webhook/send` step                                            | `url`  | percent-encoded as one path segment or one query value; a `.` or `..` segment fails the step | `urlEncode`, `encodeUri`, `encodeUriComponent`, `urlPath` |
| A string `body` sent as JSON by an `http` or `webhook/send` step                         | `json` | escaped as the content of a JSON string — only when the expression sits inside quotes        | none                                                      |

Three rules hold in every mode:

- **`{{{triple braces}}}` change nothing on their own.** A value is escaped with `{{value}}` and `{{{value}}}` alike.
- **`safeHtml` is the only way to keep markup.** `{{{safeHtml note}}}` keeps the formatting of rich text (bold, lists, links) and removes anything unsafe, such as a script, with the same sanitizer the rest of Sovrium uses. It does this in `html` only; in an SVG or Word template its output is escaped as text like any other value, so markup from data never enters those files.
- **A bare `$env.NAME` is inserted as written.** It is the operator's own configuration, not run data.

Caveats worth knowing before they surprise you:

- **Do not escape a value yourself in an SVG or Word template.** `{{escapeHtml name}}` there is escaped a second time: `Dupont & Fils` prints as `Dupont &amp; Fils`. Drop the helper; the value is escaped already. In HTML it is harmless but redundant.
- **`escapeHtml` in a plain-text output escapes for real.** In a `text` template or an ordinary prop, nothing else escapes, so `{{escapeHtml value}}` is how you hand HTML-safe text to a system that will place it in a page.
- **In a URL**, a `url` that is exactly one expression (`'{{steps.list.response.body.next}}'`) is the whole address and is sent as given. For a path of several segments — `owner/repo`, `exports/2026/report.pdf` — use `{{urlPath value}}`: it keeps the slashes, encodes each segment, and fails the step on a `..` segment.
- **In a JSON body**, an expression outside quotes is inserted unencoded. That is what lets `"items": {{json steps.fetch.result}}` place a whole structure, and it is also why a value from data belongs inside quotes: `"name": "{{trigger.data.name}}"`. An object `body` avoids the question altogether — it is serialised for you. Leave a space between an expression and a closing brace of the JSON (`{{json list}} }`): `}}}` reads as the end of a triple-brace expression, the template no longer compiles, and the body is sent as written.

## Text

| Helper                                      | Does                                                                                  | Example                                                   |
| ------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `uppercase v` / `lowercase v`               | Changes the case of every letter                                                      | `{{uppercase "ada"}}` → `ADA`                             |
| `capitalize v`                              | Capitalises each word, keeping the spacing as written                                 | `{{capitalize "jean  dupont"}}` → `Jean  Dupont`          |
| `titleCase v`                               | Capitalises each word and normalises separators to one space                          | `{{titleCase "order_status-code"}}` → `Order Status Code` |
| `sentenceCase v`                            | Capitalises the first letter only, lowercases the rest                                | `{{sentenceCase "hello WORLD"}}` → `Hello world`          |
| `camelCase v` / `pascalCase v`              | Joins the words, each after the first (or every word) capitalised                     | `{{camelCase "first name"}}` → `firstName`                |
| `snakeCase v` / `kebabCase v`               | Joins the lowercased words with `_` or `-`                                            | `{{snakeCase "First Name"}}` → `first_name`               |
| `slugify v`                                 | Lowercases, drops punctuation, joins words with `-`                                   | `{{slugify "Hello, World!"}}` → `hello-world`             |
| `trim v` / `trimStart v` / `trimEnd v`      | Removes surrounding whitespace, both sides or one                                     | `{{trim "  hi  "}}` → `hi`                                |
| `replace v search [with]`                   | Replaces every occurrence (`with` defaults to nothing). Alias: `replaceAll`           | `{{replace ref "-" "/"}}`                                 |
| `truncate v n [suffix]`                     | Cuts to `n` characters and appends `suffix` when it cut                               | `{{truncate body 100 "…"}}`                               |
| `padStart v n [fill]` / `padEnd …`          | Pads to `n` characters (at most 10,000) with `fill` (a space by default)              | `{{padStart number 6 "0"}}` → `000042`                    |
| `split v separator`                         | Splits text into a list                                                               | `{{#each (split tags ",")}}…{{/each}}`                    |
| `substring v start end`                     | The characters from `start` up to `end`                                               | `{{substring "2026-10-08" 0 4}}` → `2026`                 |
| `concat a b …`                              | Joins any number of values into one text                                              | `{{concat first " " last}}`                               |
| `length v`                                  | Characters in a text, items in a list, keys in an object. Alias: `count`              | `{{length items}}`                                        |
| `wordCount v`                               | Words separated by whitespace (an empty text has none)                                | `{{wordCount body}}`                                      |
| `contains v needle`                         | Whether a text holds `needle`, or a list holds an item equal to it. Alias: `includes` | `{{#if (contains tags "vip")}}…{{/if}}`                   |
| `startsWith v prefix` / `endsWith v suffix` | Whether the text begins or ends that way                                              | `{{#if (endsWith file ".pdf")}}…{{/if}}`                  |
| `repeat v n`                                | The text `n` times (at most 10,000)                                                   | `{{repeat "★" rating}}`                                   |
| `reverse v`                                 | The text backwards, emoji kept whole (for a list, see `reverseArray`)                 | `{{reverse "abc"}}` → `cba`                               |
| `stripHtml v`                               | The text of an HTML fragment, without its tags                                        | `{{stripHtml note}}`                                      |
| `escapeHtml v` / `unescapeHtml v`           | Escapes, or restores, the five HTML characters `& < > " '`                            | `{{escapeHtml "a < b"}}` → `a &lt; b`                     |
| `pluralize count singular [plural]`         | `singular` when `count` is 1, else `plural` (`singular` + `s` by default)             | `{{count}} {{pluralize count "item"}}`                    |

## Numbers

A value that is not a number makes arithmetic print `NaN` rather than a plausible wrong figure; the formatting helpers print nothing instead.

| Helper                                                     | Does                                                          | Example                                          |
| ---------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------ |
| `add a b` / `subtract a b` / `multiply a b` / `divide a b` | Arithmetic. A division by zero gives `0`                      | `{{multiply price qty}}`                         |
| `modulo a b`                                               | The remainder (`0` for a divisor of zero)                     | `{{modulo index 3}}`                             |
| `round v [digits]`                                         | Rounds to an integer, or to `digits` decimals                 | `{{round 3.14159 2}}` → `3.14`                   |
| `ceil v` / `floor v` / `abs v`                             | Rounds up, rounds down, drops the sign                        | `{{ceil 2.1}}` → `3`                             |
| `toFixed v digits`                                         | Exactly `digits` decimals                                     | `{{toFixed 5 2}}` → `5.00`                       |
| `min a b …` / `max a b …`                                  | The smallest or largest of the numbers given                  | `{{max 0 balance}}`                              |
| `clamp v low high`                                         | Keeps `v` between the two bounds                              | `{{clamp score 0 100}}`                          |
| `percentage part whole [digits]`                           | `part` as a percentage of `whole` (nothing when `whole` is 0) | `{{percentage 25 200 1}}` → `12.5`               |
| `formatNumber v [digits] [locale]`                         | Digit grouping and decimals in a language                     | `{{formatNumber 1234.5 2 "fr-FR"}}` → `1 234,50` |
| `formatCurrency v [code] [locale]`                         | An amount in a currency (`USD` by default)                    | `{{formatCurrency total "EUR"}}` → `€1,234.50`   |
| `isEven v` / `isOdd v`                                     | Whether a whole number is even or odd                         | `{{#if (isOdd @index)}}…{{/if}}`                 |

`formatNumber` and `formatCurrency` use the locale they name; without one, the language of the document or email being rendered; otherwise `en-US`.

## Dates

Dates are ISO 8601 instants (`2026-10-08T14:30:00.000Z`). The format tokens (`yyyy`, `MM`, `dd`, `MMMM`, …) and the timezone defaults are listed under Dates in the Automations Overview.

| Helper                                                  | Does                                                                                                 | Example                                                    |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `now`                                                   | The current instant                                                                                  | `{{now}}`                                                  |
| `today [timezone]`                                      | Today's date, `yyyy-MM-dd`                                                                           | `{{today "Europe/Paris"}}`                                 |
| `formatDate v pattern [timezone] [locale]`              | Prints an instant with a pattern                                                                     | `{{formatDate due "dd MMMM yyyy" "Europe/Paris" "fr-FR"}}` |
| `parseDate text pattern [timezone]`                     | Reads a date written in a pattern, as an instant                                                     | `{{parseDate "15/03/2026" "dd/MM/yyyy"}}`                  |
| `addMinutes v n` … `addYears v n`                       | Moves an instant forward: `addMinutes`, `addHours`, `addDays`, `addMonths`, `addYears`               | `{{addDays createdAt 30}}`                                 |
| `subtractMinutes v n` … `subtractYears v n`             | Moves it back: `subtractMinutes`, `subtractHours`, `subtractDays`, `subtractMonths`, `subtractYears` | `{{subtractHours (now) 2}}`                                |
| `dateDiff a b`                                          | Whole days from `b` to `a` (`0` when either is unreadable)                                           | `{{dateDiff dueDate (now)}}`                               |
| `startOf v unit [timezone]` / `endOf v unit [timezone]` | The first or last instant of the `second`, `minute`, `hour`, `day`, `week`, `month` or `year`        | `{{startOf (now) "month" "Europe/Paris"}}`                 |
| `dayOfWeek v [timezone] [locale]`                       | The weekday's full name                                                                              | `{{dayOfWeek date "UTC" "fr-FR"}}` → `samedi`              |
| `isWeekday v [timezone]` / `isWeekend v [timezone]`     | Whether it falls Monday to Friday, or on Saturday or Sunday (both `false` when unreadable)           | `{{#if (isWeekend date)}}…{{/if}}`                         |
| `timestamp v`                                           | The instant as milliseconds since 1970                                                               | `{{timestamp createdAt}}`                                  |
| `fromTimestamp ms`                                      | Milliseconds since 1970 back to an instant                                                           | `{{fromTimestamp 1767225600000}}`                          |

## Extraction

| Helper                                 | Does                                                                                  | Example                                          |
| -------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `extractEmail v` / `extractEmails v`   | The first email address in a text, or all of them as a list                           | `{{extractEmail message}}`                       |
| `extractUrl v` / `extractUrls v`       | The first `http(s)` address, or all of them                                           | `{{extractUrl message}}`                         |
| `extractNumber v` / `extractNumbers v` | The first number, or all of them                                                      | `{{extractNumber "Total: 42.50 EUR"}}` → `42.50` |
| `extractDomain v` / `extractPath v`    | The host or the path of a URL                                                         | `{{extractDomain website}}` → `example.com`      |
| `regex v "pattern" ["flags"]`          | The first capture group of the first match, or the whole match when there is no group | `{{regex subject "INV-(\d+)"}}`                  |
| `matchAll v "pattern" ["flags"]`       | Every match as a list (the first capture group of each, when there is one)            | `{{join (matchAll body "#(\w+)") ", "}}`         |

The pattern of `regex` and `matchAll` must be a quoted string written in the template; one taken from data is refused. The limits on backtracking patterns are described in the Automations Overview.

## Lists and objects

| Helper                                  | Does                                                                                         | Example                                          |
| --------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `first v` / `last v`                    | The first or last item of a list (or character of a text)                                    | `{{first items}}`                                |
| `at v index`                            | The item at a position, counting from 0                                                      | `{{at items 2}}`                                 |
| `join list separator`                   | The items as one text                                                                        | `{{join tags ", "}}`                             |
| `slice v start [end]`                   | Part of a list or a text                                                                     | `{{#each (slice items 0 3)}}…{{/each}}`          |
| `includes list value`                   | Whether the list holds an item equal to `value`. Alias of `contains`                         | `{{#if (includes roles "admin")}}…{{/if}}`       |
| `unique list`                           | The list without repeated items                                                              | `{{join (unique tags) ", "}}`                    |
| `flatten list`                          | A list of lists, one level flatter                                                           | `{{flatten groups}}`                             |
| `reverseArray list`                     | The list in reverse order                                                                    | `{{#each (reverseArray events)}}…{{/each}}`      |
| `count v`                               | The number of items. Alias of `length`                                                       | `{{count lines}}`                                |
| `keys obj` / `values obj`               | An object's keys or values, as a list                                                        | `{{join (keys answers) ", "}}`                   |
| `pick obj "a" "b" …` / `omit obj "a" …` | The object with only those keys, or without them                                             | `{{json (pick user "name" "email")}}`            |
| `get obj "path"`                        | The value at a dotted path, list positions included                                          | `{{get order "lines.0.sku"}}`                    |
| `json v`                                | The value as JSON text. Alias: `stringify`                                                   | `{{json steps.fetch.result}}`                    |
| `chunk list n [pad=true]`               | The list cut into groups of `n`; with `pad=true` the last group is filled with empty entries | `{{#each (chunk labels 21 pad=true)}}…{{/each}}` |

`chunk` is what lays out a sheet of labels or a grid of cards: one group per page or row, and `{{#if this}}` inside tells an empty padded slot apart. With `pad=true`, 5 labels on a 21-label sheet get 16 empty slots. A group holds at most 1,000 entries: a larger `n` fails the step, naming `chunk` and the limit.

## Logic

| Helper                                      | Does                                                                               | Example                                                            |
| ------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `if cond yes [no]`                          | Inline: `yes` when `cond` holds, else `no`. Block: `{{#if cond}}…{{else}}…{{/if}}` | `{{if paid "Paid" "Due"}}`                                         |
| `ifValue cond yes no`                       | The inline form, under a name of its own                                           | `{{ifValue vip "VIP" ""}}`                                         |
| `default v fallback`                        | `v`, or `fallback` when `v` is missing or empty. Alias: `ifEmpty`                  | `{{default client.vat "—"}}`                                       |
| `coalesce a b …`                            | The first value that is not missing or empty                                       | `{{coalesce nickname firstName "friend"}}`                         |
| `switch v "case" "result" … ["else"]`       | The result paired with the matching case; a trailing odd argument is the fallback  | `{{switch status "active" "Active" "paused" "On hold" "Unknown"}}` |
| `eq a b` / `ne a b`                         | Whether two values are equal, compared as text                                     | `{{#if (eq status "won")}}…{{/if}}`                                |
| `gt a b` / `gte a b` / `lt a b` / `lte a b` | Numeric comparison                                                                 | `{{#if (gte total 100)}}…{{/if}}`                                  |
| `and a b …` / `or a b …` / `not v`          | Boolean logic                                                                      | `{{#if (and paid (not shipped))}}…{{/if}}`                         |

A condition holds unless it is `false`, `0`, an empty text, or missing.

## Encoding and hashing

| Helper                              | Does                                                                                       | Example                               |
| ----------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------- |
| `urlEncode v`                       | Percent-encodes a value as one URL component. Aliases: `encodeUri`, `encodeUriComponent`   | `?q={{urlEncode term}}`               |
| `urlDecode v`                       | Reverses it (nothing for a malformed sequence). Aliases: `decodeUri`, `decodeUriComponent` | `{{urlDecode param}}`                 |
| `urlPath v`                         | A multi-segment path: slashes kept, each segment encoded, a `..` segment refused           | `repos/{{urlPath trigger.data.repo}}` |
| `base64Encode v` / `base64Decode v` | Base64 of the UTF-8 text, and back                                                         | `Basic {{base64Encode credentials}}`  |
| `md5 v` / `sha256 v`                | The hexadecimal digest (nothing when the value is missing, never the digest of "")         | `{{sha256 payload}}`                  |
| `safeHtml v`                        | Sanitised rich text kept as markup in an HTML output (see Escaping)                        | `{{{safeHtml record.note}}}`          |
| `totp v`                            | The current six-digit one-time code (RFC 6238) for the base32 secret it is given           | `{{totp $env.PORTAL_TOTP_SECRET}}`    |

## Types

| Helper      | Does                                                                                 | Example                       |
| ----------- | ------------------------------------------------------------------------------------ | ----------------------------- |
| `number v`  | The value as a number (`NaN` when it is not one). Alias: `toNumber`                  | `{{number trigger.data.qty}}` |
| `boolean v` | Whether the value is truthy. Alias: `toBoolean`                                      | `{{boolean flag}}`            |
| `string v`  | The value as text (an object as JSON, a missing value as nothing). Alias: `toString` | `{{string id}}`               |
| `typeof v`  | `string`, `number`, `boolean`, `object`, `array`, `null` or `undefined`              | `{{typeof payload}}`          |
