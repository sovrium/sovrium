/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The single canonical redactor for the bound VALUES a failed query dumps into
 * its own error text.
 *
 * Drizzle wraps every driver failure, on both engines, as
 *
 * ```
 * Failed query: insert into "users" ("email", "password_hash") values ($1, $2)
 * params: someone@example.com,$argon2id$v=19$…
 * ```
 *
 * — the statement, then EVERY bound value joined with commas. That text is the
 * error's `message`, its `stack` header, and whatever any wrapper copies out of
 * either. A write that fails therefore carries the row it tried to write: a
 * password hash, a token, a personal field, a write-only secret. Client
 * responses never echo it (`error-sanitizer.ts` answers from fixed tables), but
 * every OPERATOR sink did — the stderr cause chain, the exported log record, and
 * the error store — and those are not places a user's password hash may go.
 *
 * ─── WHAT IS KEPT ──────────────────────────────────────────────────────────
 *
 * The statement. It is the useful half of the diagnosis ("which write, against
 * which table"), and at runtime it carries only placeholders: every value is
 * bound through the driver (standing rule S3), so the SQL names columns and
 * never contents. The `params:` label survives too, so a reader can tell a
 * redacted dump from a query that bound nothing.
 *
 * ─── WHERE THE DUMP ENDS ───────────────────────────────────────────────────
 *
 * Nothing delimits it: the values are joined by commas and a value may itself
 * hold a newline. So the redaction runs to the first STACK FRAME line
 * (`    at …`) or to the end of the text, whichever comes first — the only two
 * boundaries that cannot be part of a value. It can over-redact (a wrapper
 * that appended the driver's own message after the dump loses that line here,
 * though the driver error still reports itself as its own link of the cause
 * chain); it does not under-redact a multi-line value.
 *
 * Pure and total: a string in, a string out, no throw — every log sink calls it
 * on its way out, and a sink that threw would drop the line it exists to keep.
 */

/** What the bound values are replaced with. */
export const REDACTED_BOUND_VALUES = '[redacted]'

/**
 * `Failed query: <statement>` up to and including the `\nparams: ` label, then
 * the dump itself, lazily, up to the next stack-frame line or the end of the
 * text. The statement half is lazy too, so two dumps in one text (a wrapper's
 * stack above its cause's) are each redacted rather than fused into one.
 */
const BOUND_VALUE_DUMP = /(Failed query: [\s\S]*?\nparams: )[\s\S]*?(?=\n[ \t]+at |$)/g

/** Cheap pre-check so the common, dump-free line costs one `includes`. */
const DUMP_MARKER = '\nparams: '

/**
 * `text` with every query bound-value dump replaced by
 * {@link REDACTED_BOUND_VALUES}. Text holding no dump is returned unchanged
 * (the same string, so an identity comparison tells a caller nothing changed).
 */
export const redactBoundQueryValues = (text: string): string =>
  text.includes(DUMP_MARKER) && text.includes('Failed query: ')
    ? text.replace(BOUND_VALUE_DUMP, `$1${REDACTED_BOUND_VALUES}`)
    : text
