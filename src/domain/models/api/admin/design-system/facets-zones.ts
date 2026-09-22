/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

// ---------------------------------------------------------------------------
// The zones, as rows
// ---------------------------------------------------------------------------

/**
 * One route pattern and the zone that governs it.
 *
 * The Brand page draws these as a table, and they are the last block of it that
 * had no read: `design.zones[]` is an array of objects nested one level below a
 * `voice` override, so a page binding it could reach the pattern but not say
 * which budget it carries without an `if`.
 *
 * `accentBudget` is REQUIRED here where the config leaves it optional, and the
 * fallback is the fail-closed one `Brand Zone Drift` already enforces: a zone
 * that declares no budget is `product`. Publishing the resolved value rather
 * than the declared one is the whole point — a page cannot apply a default.
 */
export const designZoneRowSchema = Schema.Struct({
  pattern: Schema.String.annotate({
    description: 'The declared route pattern this zone governs',
    examples: ['/blog/*', '/_admin/*'],
  }),
  zone: Schema.String.annotate({
    description: 'The zone this pattern belongs to',
    examples: ['marketing', 'product'],
  }),
  accentBudget: Schema.Literals(['public', 'product']).annotate({
    description:
      'Which accent budget the zone carries, RESOLVED. A zone declaring none is `product` — the fail-closed fallback the drift gate enforces — because a page cannot apply a default.',
  }),
  hasVoiceOverride: Schema.Boolean.annotate({
    description:
      'Whether this zone departs from `design.voice`. A boolean rather than the override itself: the sentences are already rows on the guidance facet under `zone.voice.*`, and publishing them twice would let the two drift.',
  }),
  // ─── WHICH FIELDS THIS ZONE INHERITS, NAMED ──────────────────────────────
  //
  // The Voice page states the inheritance RULE in a caption — "every field it
  // does not name is inherited from the app voice above" — because the retired
  // builder's line ("Inherits pronoun and avoid from the app voice.") named the
  // exact fields and no read published them. The page's own note gives the
  // reason it could not: a config page CANNOT JOIN TWO ROW SOURCES, and naming
  // the inherited fields is precisely a join of the zone's declared keys
  // against the app voice's.
  //
  // ─── IT IS THE INTERSECTION, NOT THE COMPLEMENT ──────────────────────────
  //
  // A field is listed when the APP declares it and this ZONE does not. The
  // wider reading — every overridable field the zone does not name — was
  // refused because it names inheritance of nothing: an app with no
  // `design.voice.tone` has no tone for a zone to inherit, and a row saying
  // otherwise sends a reader looking for a value that is not on the page.
  //
  // `personality` is deliberately NOT a candidate. `ZoneVoiceOverrideSchema`
  // has no `personality` key — it is app identity rather than situational
  // register — so it is not inheritABLE, it is simply constant. Listing it
  // would present a field a zone COULD override, which is the one reading the
  // caption exists to rule out.
  //
  // ROWS rather than a joined sentence, on the standing convention: `rowsKey`
  // hands a template a RECORD and `$record.` names a field of one, so bare
  // strings arrive unprintable — and a sentence would be the console's own
  // wording, which [internal ref] refuses. The order is `ZoneVoiceOverrideSchema`'s own
  // declaration order, which is a schema fact and not a chosen one.
  inherited: Schema.Array(
    Schema.Struct({
      name: Schema.String.annotate({
        description: 'The `design.voice` field name this zone inherits',
        examples: ['pronoun', 'avoid'],
      }),
    }).annotate({
      strictKeys: true,
      title: 'sovrium:strict-keys',
      identifier: 'DesignZoneInheritedVoiceField',
    })
  ).annotate({
    description:
      'The `design.voice` fields this zone inherits — declared by the app and NOT named by this zone — as rows, in schema declaration order. EMPTY when the zone overrides every field the app declares, and empty when the app declares no voice at all.',
  }),
  // The GATE beside the list, on the same parity `pageCount` has beside
  // `routes`: `visibility.record` has no length operator, so `inherited.length`
  // is unreachable where `inheritedCount eq 0` is not. It is what turns the
  // page's unconditional caption into a conditional one — a zone that overrides
  // everything the app declares inherits nothing, and telling that reader their
  // zone still writes under the app's rules is false.
  inheritedCount: Schema.Int.annotate({
    description:
      'How many `design.voice` fields this zone inherits. `0` — never absent — for a zone that overrides every field the app declares, and for every zone of an app declaring no voice.',
  }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'DesignZoneRow',
})

/** The declared zones — the shared rows envelope. */
export const designZonesResponseSchema = Schema.Struct({
  items: Schema.Array(designZoneRowSchema).annotate({
    description: 'One row per declared zone pattern, in declaration order. Empty when none.',
  }),
  total: Schema.Int.annotate({ description: 'How many rows this response carries' }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'DesignZonesResponse',
})

/** @public */
export type DesignZoneRow = typeof designZoneRowSchema.Type
/** @public */
export type DesignZonesResponse = typeof designZonesResponseSchema.Type
