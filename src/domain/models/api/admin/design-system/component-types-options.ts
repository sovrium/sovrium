/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'

// ---------------------------------------------------------------------------
// One type's whole option surface
// ---------------------------------------------------------------------------

/**
 * One option a type accepts, addressed by the key path an author writes.
 *
 * The DETAIL route beside this one answers `object` for `pagination` and stops,
 * which is the right answer for a props table and not enough for a
 * Configuration section that has to name `columns[].format` and list its twelve
 * values. This is the same schema read to the bottom and flattened.
 *
 * Every member but `path` and `kind` is optional, and each absence is a real
 * state rather than a gap:
 *
 *  - `values` — a closed union's members, which is the one thing an author
 *    cannot obtain without opening the schema. Absent, never empty, otherwise.
 *  - `defaultValue` — asked of the DECODER, never reconstructed from the AST.
 *    Almost every row answers "unset", which is the honest output.
 *  - `description` — the schema's own words, resolved through indirection.
 *  - `truncated` — see below. ABSENT rather than `false` on a row the walk
 *    reached in full, because presence is what the console tells them apart by.
 */
export const componentTypeOptionSchema = Schema.Struct({
  path: Schema.String.annotate({
    description:
      'The key path an author writes, in the config’s own grammar: a dot for a nested object, `[]` for an array element.',
    examples: ['variant', 'pagination.pageSize', 'columns[].format'],
  }),
  kind: Schema.String.annotate({
    description:
      'What this option accepts. Kinds are joined with ` | ` where a path is reached through several union branches, so the row describes everything the schema takes rather than one branch of it.',
    examples: ['string', 'enum', 'string | number | boolean'],
  }),
  values: optionalField(
    Schema.Array(Schema.String).annotate({
      description:
        'A closed union’s members, deduplicated. Absent — never empty — when the option is not one.',
    })
  ),
  defaultValue: optionalField(
    Schema.String.annotate({
      description:
        'What the decoder produces when this option is omitted, when it declares one. Asked of the decoder, never rebuilt from the AST.',
    })
  ),
  description: optionalField(
    Schema.String.annotate({
      description: 'The schema’s own description, resolved through indirection. Never invented.',
    })
  ),
  // ─── PRESENT ONLY WHEN CUT, AND THAT IS THE WHOLE CONTRACT ───────────────
  //
  // A walk that dropped its deep nodes would publish an option list that reads
  // as complete and is not, and the console would render it as the whole story.
  // So a subtree the depth limit cut is published as its own row, MARKED —
  // `bulkActions[].action.fields` appears as one row saying its subtree
  // continues, instead of the automation-action union appearing nowhere.
  //
  // Absent rather than `false` on a reached row: `visibility.record` carries no
  // presence operator, so a page gates the marker on `truncated eq true` and an
  // always-present field would be a flag that never discriminates.
  truncated: optionalField(
    Schema.Boolean.annotate({
      description:
        'Present and `true` only on a subtree the depth limit cut, meaning its options continue below what this response carries. Absent on a row the walk reached in full.',
    })
  ),
  // ─── WHAT THIS ROW DRAWS, IN A GROUP-FILTERED RESPONSE ──────────────────
  //
  // Absent from every row of the UNFILTERED list, and present on every row of a
  // `?group=<key>` one. The two answer different questions: unfiltered is "what
  // key paths does this type accept", where a closed union is ONE row carrying
  // its members in `values`; filtered is "what does this Configuration group
  // draw", where that union is one row PER MEMBER.
  //
  // Publishing the explosion rather than leaving it to the page is not a
  // convenience. A page has no loop: it can name `variant` and its seven
  // members in one cell, and can never draw seven rows — which is the whole
  // difference between a field table and a catalogue of options.
  value: optionalField(
    Schema.String.annotate({
      description:
        'What this row draws and is addressed by, in a `?group=` response: a closed union member, or the option’s own path where the key enumerates nothing. Absent on every row of the unfiltered list.',
      examples: ['destructive', 'pagination.pageSize'],
    })
  ),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'ComponentTypeOption',
})

/**
 * One top-level key of a type — the HEADING of a Configuration group.
 *
 * ─── WHY THE GROUP CARRIES NO ROWS ─────────────────────────────────────────
 *
 * The Configuration section is a group per schema key with a row per option
 * VALUE under it: two nested lists. A row template CANNOT iterate an array
 * hanging off the row it is drawing — `rowsKey` is one flat `body[key]` lookup
 * and `$record.` walks no path — so an `items[]` published inside a group would
 * be data no config page could reach, which is exactly the wall Phase A hit
 * against the flat envelope.
 *
 * The engine's answer to a nested list is a SECOND READ per outer row
 * (`system-rows-template-resolver.ts`, two levels, the inner binding carrying
 * `$record.` already substituted from its own row). So a group publishes its
 * FACTS and the rows come from the same endpoint filtered to that key:
 *
 *   outer   GET …/options                    rowsKey: groups
 *   inner   GET …/options?group=$record.key  rowsKey: items
 *
 * `total` is on the group so a heading can print its own count without the
 * inner read having happened — the figure a reader sees beside `variant` is not
 * paid for twice.
 *
 * ─── WHAT IS IN A GROUP, AND WHAT IS NOT ───────────────────────────────────
 *
 * One group per top-level key the type declares as its OWN — the shared modules
 * are excluded here exactly as they are from `items[]`, and for the reason
 * `schemaOptionTree` gives: walking them turns `button`'s twelve real options
 * into 276 rows of plumbing.
 *
 * There is no `title`. The heading a Configuration group carries IS the key
 * path in mono — that is what an author copies into their config — so a display
 * string beside it would be the same bytes under a second name, which this
 * module refuses elsewhere for `fixtureBacked` and for `drawable`.
 */
export const componentTypeOptionGroupSchema = Schema.Struct({
  key: Schema.String.annotate({
    description:
      'The top-level key this group is over, in the config’s own grammar — the mono heading a Configuration group prints, the value `?group=` takes, and the string a group element is addressed by.',
    examples: ['variant', 'pagination', 'columns'],
  }),
  kind: Schema.String.annotate({
    description:
      'What the key itself accepts, joined with ` | ` across union branches exactly as a row’s `kind` is.',
    examples: ['enum', 'object', 'array'],
  }),
  description: optionalField(
    Schema.String.annotate({
      description:
        'The schema’s own description of the key, resolved through indirection. Never invented, and ABSENT — never a placeholder — where none resolves.',
    })
  ),
  defaultValue: optionalField(
    Schema.String.annotate({
      description:
        'What the decoder produces when the whole key is omitted, when it declares one. Asked of the decoder, never rebuilt from the AST.',
    })
  ),
  // The BOOLEAN beside the value, for the reason `drawable` sits beside
  // `specimenState`: a page has no `if`, so the two honest defaults — a real
  // schema default and `unset` — are two nodes under two gates, and a gate
  // needs a field that discriminates. `visibility.record` carries no presence
  // operator, so gating on the absence of `defaultValue` is not expressible.
  hasDefault: Schema.Boolean.annotate({
    description:
      'Whether `defaultValue` is present. `false` — never absent — for the large majority of keys, which is what lets a page print `unset` under its own gate.',
  }),
  total: Schema.Int.annotate({
    description:
      'How many rows `?group=<key>` answers with. Never `0`: a key enumerating nothing still publishes its own row.',
  }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'ComponentTypeOptionGroup',
})

/**
 * Every option one type accepts — the shared rows envelope, plus the cap flag.
 *
 * `capped` is reported rather than inferred because a list silently truncated
 * at N is worse than an error: it is indistinguishable from a schema that
 * shrank. It reads `false` on today's catalogue, which is what makes it a flag
 * rather than a constant.
 */
export const componentTypeOptionsResponseSchema = Schema.Struct({
  type: Schema.String.annotate({
    description: 'The type these options belong to, echoed so a bound page can title itself',
    examples: ['button', 'table'],
  }),
  items: Schema.Array(componentTypeOptionSchema).annotate({
    description:
      'Unfiltered: one row per key path this type accepts, at any depth, merged across branches. Under `?group=<key>`: the rows that group DRAWS — one per member for a closed union, otherwise the key’s own row and its subtree — each carrying `value`.',
  }),
  groups: Schema.Array(componentTypeOptionGroupSchema).annotate({
    description:
      'One entry per top-level key, carrying the heading a Configuration group prints and the count of rows `?group=<key>` answers with. Narrowed to the one group in a filtered response.',
  }),
  total: Schema.Int.annotate({
    description: 'How many rows this response carries',
  }),
  capped: Schema.Boolean.annotate({
    description:
      'Whether the per-type row cap fired and cut this list. `false` for every type in today’s catalogue.',
  }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'ComponentTypeOptionsResponse',
})

/**
 * The one query the option read takes: which Configuration group to narrow to.
 *
 * ─── `optionalField`, NEVER `Schema.optionalKey` ───────────────────────────
 *
 * The two are not synonyms in Effect 4. `optionalKey` is EXACT-optional and
 * REFUSES a present key holding `undefined`, so the moment anything assembles
 * the query as an allow-list object with every key present — which is how the
 * admin routes read a query, because Hono silently drops an undeclared param —
 * an unsupplied `group` arrives as a present `undefined` and the read answers
 * 400 instead of the unfiltered list. That is the exact defect the Zod removal
 * measured across `[internal ref]`, and `optionalField` is the helper that exists
 * to make it unrepeatable.
 *
 * A group the type does not declare is NOT a 400. It decodes fine and the use
 * case answers an empty list — a filter is a question about the data, not about
 * the request, and an operator following a stale link deserves "nothing here"
 * rather than a validation error.
 */
/**
 * The query a component-type DETAIL read carries.
 *
 * One optional cap, and it exists so the console can say "six" without the API
 * learning what six means. The endpoint answers the first N routes and how many
 * it left behind; which N is the caller's business.
 */
export const componentTypeDetailQuerySchema = Schema.Struct({
  routesLimit: optionalField(
    Schema.String.annotate({
      description:
        'Cap `routes` at this many rows and report the remainder in `routesMore`. Omitted, every route is served and `routesMore` is 0.',
      examples: ['6'],
    })
  ),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'ComponentTypeDetailQuery',
})

export const componentTypeOptionsQuerySchema = Schema.Struct({
  group: optionalField(
    Schema.String.annotate({
      description:
        'Narrow the response to one Configuration group: its rows, exploded one per union member, and that group alone in `groups`. Omitted, the unfiltered list is served.',
      examples: ['variant', 'pagination'],
    })
  ),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'ComponentTypeOptionsQuery',
})

export type ComponentTypeOptionsResponse = typeof componentTypeOptionsResponseSchema.Type

export type ComponentTypeDetailQuery = typeof componentTypeDetailQuerySchema.Type

/** @public */
export type ComponentTypeOptionsQuery = typeof componentTypeOptionsQuerySchema.Type
