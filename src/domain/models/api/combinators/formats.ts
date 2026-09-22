/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * String schemas that both VALIDATE a format at runtime and declare it in the
 * OpenAPI document, matching what Zod's `.datetime()`, `.email()`, `.url()` and
 * `.uuid()` produced.
 *
 * The subtlety this module exists for: a `format` ANNOTATION alone is inert —
 * it reaches the document and rejects nothing, which is how the first pass of
 * this migration silently dropped the health endpoint's timestamp validation
 * while every document byte stayed identical. Conversely a `Schema.check` with
 * a regex validates but emits `pattern`, which CHANGES the document.
 *
 * `Schema.makeFilter` is the one combinator that does neither: it is a runtime
 * predicate carrying no JSON-Schema keyword, so pairing it with the annotation
 * reproduces Zod's behaviour on both sides at once — measured, not assumed.
 */

/**
 * Build a format-annotated string whose predicate is invisible to JSON Schema.
 *
 * Each format is a FACTORY taking its annotations, not a constant to annotate
 * afterwards, and that is load-bearing rather than stylistic: Effect attaches
 * `.annotate()` to whatever it is called on, so annotating a checked schema
 * lands the description INSIDE the filter — where nothing reads it, and where
 * it silently disappears from the published document. Taking the annotations up
 * front applies them to the node before the check exists, which is the only
 * order that works, and makes the wrong order unwriteable.
 */
const formatted =
  (format: string, pattern: Readonly<RegExp>, expected: string) =>
  (annotations: Readonly<Record<string, string>> = {}) =>
    Schema.String.annotate({ format, ...annotations }).pipe(
      Schema.check(
        Schema.makeFilter((value: string) => (pattern.test(value) ? undefined : expected))
      )
    )

/**
 * ISO 8601 date-time with a required offset and millisecond precision — the
 * shape `z.iso.datetime({ offset: true, precision: 3 })` accepted.
 */
export const isoDateTime = formatted(
  'date-time',
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}(?:Z|[+-]\d{2}:\d{2})$/,
  'an ISO 8601 date-time with an offset and millisecond precision'
)

/**
 * ISO 8601 date-time, offset optional and precision unconstrained — the shape
 * a bare `z.string().datetime()` accepted.
 */
export const looseIsoDateTime = formatted(
  'date-time',
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/,
  'an ISO 8601 date-time'
)

/**
 * RFC 4122 UUID. Deliberately the LOOSE hex-dashed shape Zod's `.uuid()`
 * accepted — Effect's own `isUUID()` additionally demands a version nibble of
 * 1-8, which would reject identifiers this API has always taken.
 */
export const uuid = formatted(
  'uuid',
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  'a UUID'
)

/** Absolute URL, matching what Zod's `.url()` accepted. */
export const uri = formatted('uri', /^[a-z][a-z0-9+.-]*:\/\/[^\s]+$/i, 'an absolute URL')

/** Email address, at the same permissiveness Zod's `.email()` applied. */
export const email = formatted('email', /^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'an email address')
