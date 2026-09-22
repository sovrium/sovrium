/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * API contract for the FIELD-type catalogue:
 *
 *   GET /api/admin/schema/field-types — every table field type, as rows
 *
 * ─── WHY IT IS NOT A MODE OF THE COMPONENT-TYPE READ ───────────────────────
 *
 * A field type is a table COLUMN type, not a page component. It has no
 * renderer, no variant axis, no state vocabulary, no props table and no
 * `drawable` gate — none of the eight things `componentTypeSummary` publishes
 * applies to one. Folding the two behind a `?kind=` would produce a row whose
 * every member but `type` and `category` is optional, and a page binding it
 * would have to know which half it asked for in order to read the answer.
 *
 * ─── AND WHY IT IS FOUR FIELDS RATHER THAN TWELVE ──────────────────────────
 *
 * The console's composed form draws every field type once, under its category
 * heading. That is the whole read, and each field below is there because the
 * page cannot produce it:
 *
 *  - `type` is what a `field-specimen` draws.
 *  - `category` is what a gate compares against.
 *  - `categoryTitle` is the heading; the registry owns display strings for
 *    registry groups, exactly as `componentTypeSummary.title` does.
 *  - `firstInCategory` is the group boundary — see its own note.
 *
 * Everything else the builder held was either DERIVABLE by the renderer (the
 * control's `name`, defaulted from the type) or LAYOUT (`FULL_WIDTH_TYPES`,
 * which belongs to the container that composes the form and not to a fact about
 * a field type). A field nobody needs is a field that rots, so neither is here.
 *
 * ─── AUTHORISATION AND THE CONFIDENTIALITY BOUND ───────────────────────────
 *
 * A read, behind the admin tier, answering **404** — never 403 — to an
 * anonymous or non-admin caller (standing rule S1, anti-enumeration). Same
 * invariant as the component catalogue beside it.
 *
 * The projection reads the SCHEMA and nothing else. It carries no table data,
 * no operator field NAMES, and no `app.tables` at all: it describes what a
 * table MAY declare, never what this instance's tables do. That is what makes
 * it a build constant rather than a config read, and it is why the composed
 * form draws the same forty-nine controls on every instance.
 *
 * @see src/domain/models/app/tables/fields/field-types/catalog.ts — the derivation
 * @see src/domain/models/app/pages/components/component-types/specialty/field-specimen.ts
 */

import { Schema } from 'effect'

/**
 * One field type, as the composed form draws it.
 *
 * `strictKeys` for the reason every response object here carries it: a field
 * smuggled in is refused at the boundary rather than published to a consumer
 * that then depends on it.
 */
export const fieldTypeSummarySchema = Schema.Struct({
  type: Schema.String.annotate({
    description: 'The field type literal, exactly as an author writes it in a table declaration',
    examples: ['single-line-text', 'single-select'],
  }),
  category: Schema.String.annotate({
    description: 'The registry category slug this field type belongs to',
    examples: ['text', 'selection'],
  }),
  categoryTitle: Schema.String.annotate({
    description:
      "Human-readable heading of this type's CATEGORY — the registry's own display string, carried on every row of the category. Not a name for the type itself; the type literal is what an author writes.",
    examples: ['Text fields', 'Selection fields'],
  }),
  // ─── THE GROUP BOUNDARY, AND WHY IT IS PUBLISHED ─────────────────────────
  //
  // The composed form is ONE rows binding drawing forty-nine controls, and it
  // heads each category once. A page cannot decide where a group starts: it has
  // no access to the previous row, no comparison across rows, and no arithmetic
  // — a row template sees only the row it is expanded from.
  //
  // So the boundary arrives as a fact, and the heading is a sibling node gated
  // `firstInCategory eq true` printing `$record.categoryTitle`.
  //
  // The alternative measured against it was nine sibling sections, each with
  // its own `?category=` binding and a literal heading. That hard-codes the
  // nine slugs into the page, which is precisely the enumeration the catalogue
  // exists to deliver — the page would go stale on the day a tenth category
  // ships, and silently, showing eight of nine.
  //
  // Admitted under [internal ref] as a fact rather than an editorial choice: it names
  // no word, no sentence and no label. The ORDER it refers to is the registry's
  // own, published as the array order of this response.
  firstInCategory: Schema.Boolean.annotate({
    description:
      'Whether this row is the FIRST of its category in this response — the gate a page reads to head each group once. `true` on exactly one row per category. A page cannot compute it: a row template sees only its own row.',
  }),
  // ─── THE TWO FACTS A DRAWING NEEDS, AND WHY A PAGE CANNOT HAVE THEM ──────
  //
  // A catalogue of forty-nine literals says what the schema accepts and nothing
  // about what any of them looks like. Drawing one needs a value for the
  // control to hold and a decision about whether an author types into it, and a
  // page has neither: these rows have no table and no record behind them, and
  // the console is forbidden to bind one.
  //
  // Both are DERIVED at the registry (`fieldTypeSampleValue`,
  // `isReadOnlyFieldType`) rather than written out here, so a fiftieth field
  // type arrives with both. Admitted under [internal ref] on the same ground as
  // `categoryTitle`: a console inventing its own would be a second set for one
  // concept, hand-written forty-nine times, drifting from the day it was typed.
  sampleValue: Schema.String.annotate({
    description:
      'A deterministic value for a control of this type to hold, for a drawing with no record behind it. A STRING for every type, because its only consumer is a `field-specimen`’s `value`, which is a string — a wider type here would publish something no page could bind. Neutral data, never copy.',
    examples: ['ada@example.com', '2026-03-05T09:30:00Z', 'true'],
  }),
  readOnly: Schema.Boolean.annotate({
    description:
      'Whether an author types into a control of this type. `true` for the computed types, the platform-stamped ones, and every AI type. NOT the same question as the write pipeline’s 4xx set: a stamped field silently ignores a supplied value and returns 201, and is still drawn read-only.',
  }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'FieldTypeSummary',
})

/**
 * The field-type catalogue.
 *
 * `{ items, total }` is the shared rows envelope, so a page binds it through
 * `dataSource.system` with no extra declaration — `SystemSourceSchema` defaults
 * `rowsKey` to `items`.
 *
 * Never paginated, and in REGISTRY reading order rather than alphabetical: the
 * order is what `firstInCategory` refers to, and a console that hid part of the
 * catalogue would be lying about what a table may declare.
 */
export const fieldTypeListResponseSchema = Schema.Struct({
  items: Schema.Array(fieldTypeSummarySchema).annotate({
    description: 'Every field type the schema registers, in category reading order',
  }),
  total: Schema.Int.annotate({
    description:
      'How many field types this response carries — the whole catalogue, never a page of it',
  }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'FieldTypeListResponse',
})

/** @public */
export type FieldTypeSummary = typeof fieldTypeSummarySchema.Type
/** @public */
export type FieldTypeListResponse = typeof fieldTypeListResponseSchema.Type
