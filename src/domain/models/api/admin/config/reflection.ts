/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * API contract for the two reads the console's configuration-as-booted view
 * (`/_admin/changelog?view=current`) binds:
 *
 *  - `GET /api/admin/config/reflection`   — the page's own RECORD: the redacted
 *    config serialized once, plus the per-family counts every heading gates on.
 *  - `GET /api/admin/config/declarations` — the page's ROWS: one entry per
 *    declaration, narrowed to one family by the `family` query param.
 *
 * Source story: [internal ref]
 *
 * ─── WHY TWO ENDPOINTS AND NOT ONE WITH A MODE ──────────────────────────────
 *
 * The obvious single endpoint answers `?family=tables` with the declarations
 * ALONE and the bare address with the declarations PLUS `appJson`. That is a
 * response whose shape depends on a query parameter, which is a contract no
 * generated client can express and no consumer can rely on. The alternative —
 * returning `appJson` on every family read — sends the whole configuration
 * seven times to render one page.
 *
 * So the record and the rows are two addresses. The page binds the first as its
 * page-level `{ system }` record and the second once per family, which is also
 * what lets the seven family headings gate independently.
 *
 * ─── WHY `appJson` IS A STRING, AND WHY THAT IS NOT A RENDERED STRING ───────
 *
 * [internal ref] refuses a field that embeds a choice belonging to the console. A
 * pretty-printed serialization of an object the platform already publishes is
 * the admitted other half of that rule: it carries no word, no sentence, no
 * label and no ordering meant to be read, and a caller could recompute it
 * byte-for-byte from `/api/admin/config/schema`. What the CONSOLE cannot do is
 * recompute it — config has no `JSON.stringify` — which is exactly why the
 * field exists rather than being composed on the page.
 *
 * It lives on the record endpoint and NOT on the sibling `config/schema`
 * response, so no existing caller's payload doubles for a field it never asked
 * for.
 *
 * ─── REDACTION IS A CONDITION OF THE AUTHORISATION ──────────────────────────
 *
 * Both reads go through `redactAppConfigForReflection` before serialisation,
 * for the reason [internal ref] amendment A1 gives: "a config-reflection endpoint that
 * leaks a secret is not a defective implementation of an authorised surface, it
 * is an unauthorised surface". `appJson` is the serialization of the REDACTED
 * object, never of the live one — masking after stringifying would be a
 * substring scrub over a payload that has already left the redactor.
 *
 * The anti-enumeration 404 (rule S1) is wired upstream by `requireAdminTier()`.
 */

import { Schema } from 'effect'
import { looseIsoDateTime } from '@/domain/models/api/combinators/formats'
import { optionalField } from '@/domain/models/api/combinators/optional-field'

/**
 * The config families that view walks, in the order `AppSchema`
 * declares them.
 *
 * A closed set rather than an open string, so a typo in a `family` query param
 * is a decode error naming the seven legal values instead of an empty tree an
 * operator reads as "this instance declares nothing".
 */
export const configDeclarationFamilySchema = Schema.Literals([
  'tables',
  'pages',
  'forms',
  'automations',
  'agents',
  'buckets',
  'connections',
]).annotate({
  identifier: 'ConfigDeclarationFamily',
  description: 'Which top-level config family a declaration belongs to.',
})

/** @public */
export type ConfigDeclarationFamily = typeof configDeclarationFamilySchema.Type

/**
 * One declaration in the tree: what it answers to, and what it is made of.
 *
 * `label` is `path` before `name`, because a page is identified by the route an
 * operator types and not by its slug. `detail` is the second level — a table's
 * field names, an automation's trigger type, a component's type — and going one
 * level deeper than the family is what makes the tree a reflection rather than a
 * heading list: "does this instance have the `company` column yet?" is a
 * field-level question.
 *
 * Both are the OPERATOR's own identifiers, verbatim. Neither is a sentence.
 */
export const configDeclarationSchema = Schema.Struct({
  family: configDeclarationFamilySchema,
  label: Schema.String.annotate({
    description:
      "The declaration's identifier — its `path` when it has one, else its `name`. Verbatim from the operator's config.",
  }),
  detail: optionalField(
    Schema.String.annotate({
      description:
        'What the declaration is composed of: its field names joined, its trigger type, or its type. Absent when the declaration has no second level to show.',
    })
  ),
}).annotate({ identifier: 'ConfigDeclaration' })

/** @public */
export type ConfigDeclaration = typeof configDeclarationSchema.Type

/**
 * `GET /api/admin/config/declarations` — the tree's rows, narrowed to one family
 * by the `family` query param.
 *
 * Read once per family by the Schema page, so each family's heading and rows
 * come from one request and a family the config does not declare costs an empty
 * array rather than a filtered walk of the whole tree on the client.
 */
export const configDeclarationsResponseSchema = Schema.Struct({
  declarations: Schema.Array(configDeclarationSchema).annotate({
    description:
      "The declarations, in the config's own order — the operator's grouping is information. Narrowed to one family when the `family` param is present.",
  }),
  total: Schema.Finite.annotate({
    description: 'How many declarations match this request.',
  }),
}).annotate({ identifier: 'ConfigDeclarationsResponse' })

/** @public */
export type ConfigDeclarationsResponse = typeof configDeclarationsResponseSchema.Type

/**
 * `GET /api/admin/config/reflection` — the Schema page's own record.
 *
 * Every count is FLAT, and that is load-bearing rather than stylistic:
 * `visibility.record` names ONE record field with no path syntax, so a nested
 * `counts.tables` would be unreachable by the gate deciding whether the Tables
 * heading renders at all — and a heading over an empty box is precisely what the
 * retired builder's `groups.length > 0` filter existed to prevent.
 */
export const configReflectionResponseSchema = Schema.Struct({
  appJson: Schema.String.annotate({
    description:
      'The REDACTED running configuration, serialized with two-space indentation. What an operator pastes into a bug report or diffs against git by hand. A mechanical serialization of the object `/api/admin/config/schema` already publishes — the console cannot produce it, having no JSON.stringify.',
  }),
  declarationCount: Schema.Finite.annotate({
    description:
      'Declarations across every family. The gate for the whole tree: zero is what "this config declares nothing yet" is written against.',
  }),
  tableCount: Schema.Finite.annotate({ description: 'Declarations in `tables`.' }),
  pageCount: Schema.Finite.annotate({ description: 'Declarations in `pages`.' }),
  formCount: Schema.Finite.annotate({ description: 'Declarations in `forms`.' }),
  automationCount: Schema.Finite.annotate({ description: 'Declarations in `automations`.' }),
  agentCount: Schema.Finite.annotate({ description: 'Declarations in `agents`.' }),
  bucketCount: Schema.Finite.annotate({ description: 'Declarations in `buckets`.' }),
  connectionCount: Schema.Finite.annotate({ description: 'Declarations in `connections`.' }),
  generatedAt: looseIsoDateTime({
    description:
      'ISO 8601 UTC timestamp of the read. Per-request, so an operator comparing two reflections knows which is newer.',
  }),
}).annotate({ identifier: 'ConfigReflectionResponse' })

/** @public */
export type ConfigReflectionResponse = typeof configReflectionResponseSchema.Type
