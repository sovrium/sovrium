/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'

/**
 * API contract for `components/manifest.json`, the index of the rendered
 * component kit inside the portable design-system bundle.
 *
 * The kit is one static HTML page per catalogued component type, each drawing
 * every variant the type declares in light and in dark, styled by the bundle's
 * own `components/kit.css`. It is made to be opened offline and handed to a
 * design tool, so a page loads nothing from the network and embeds nothing as
 * base64: every font and image it needs is a file beside it.
 *
 * ─── EVERY CATALOGUED TYPE HAS AN ENTRY, AND SOME ARE NOT DRAWN ────────────
 *
 * The manifest lists the WHOLE catalogue, not only what renders. A type the
 * kit cannot draw — one that would put a live write control in a static page,
 * for instance — is listed with `renders: false` and its own reason, and has no
 * page. Leaving it out would read as "this type does not exist", which is false
 * and leaves the reader nothing to act on; the console's catalogue lists its
 * refused types for the same reason.
 *
 * `renders` therefore decides the rest of the entry: a drawn type names its
 * `page` and carries no reason, a refused type carries a `reason` and names no
 * page. The two are separate shapes rather than one with two optional keys, so
 * an entry claiming both, or neither, does not decode.
 *
 * ─── THE ANATOMY IS SHADCN'S ───────────────────────────────────────────────
 *
 * `slots` are the part names the type renders, the names a design tool's
 * component card and an assistant's prompt should use. `variants` are the
 * members of the type's variant axis, empty when it declares none. `guidance`
 * comes from the platform's component documentation, copied as whole
 * sentences, and is empty for a type the documentation says no such thing
 * about — never filled with a generic sentence.
 */

/** When to reach for one type, and its dos and don'ts, as whole sentences of the platform's component documentation. */
export const componentKitGuidanceSchema = Schema.Struct({
  usage: optionalField(
    Schema.String.annotate({
      description:
        "When to reach for this type: one whole sentence of the platform's component documentation; absent when it has none",
    })
  ),
  do: Schema.Array(Schema.String).annotate({
    description:
      "What to do with it, as whole sentences of the platform's component documentation; empty when it has none",
  }),
  dont: Schema.Array(Schema.String).annotate({
    description:
      "What never to do with it, as whole sentences of the platform's component documentation; empty when it has none",
  }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'ComponentKitGuidance',
})

/** The fields every kit entry carries, drawn or not. */
const entryFields = {
  type: Schema.String.annotate({ description: 'The component type, as an author writes it' }),
  category: Schema.String.annotate({ description: 'The catalogue category the type belongs to' }),
  purpose: Schema.String.annotate({ description: 'The one line that says what the type is for' }),
  slots: Schema.Array(Schema.String).annotate({
    description: 'The part names the type renders, in shadcn anatomy order',
  }),
  variants: Schema.Array(Schema.String).annotate({
    description: "The members of the type's variant axis; empty when it declares none",
  }),
  guidance: componentKitGuidanceSchema,
}

/** A type the kit draws: it names its page and carries no reason. */
export const componentKitRenderedEntrySchema = Schema.Struct({
  ...entryFields,
  renders: Schema.Literal(true).annotate({ description: 'The kit draws this type' }),
  page: Schema.String.annotate({
    description: 'The bundle-relative path of the page drawing every variant, light and dark',
    examples: ['components/button.html'],
  }).check(Schema.isPattern(/^components\/[a-z0-9-]+\.html$/)),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'ComponentKitRenderedEntry',
})

/** A type the kit does not draw: it carries its own reason and names no page. */
export const componentKitRefusedEntrySchema = Schema.Struct({
  ...entryFields,
  renders: Schema.Literal(false).annotate({ description: 'The kit does not draw this type' }),
  reason: Schema.String.annotate({
    description: 'Why the kit does not draw this type, in a sentence of its own',
  }).check(Schema.isMinLength(1)),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'ComponentKitRefusedEntry',
})

/** One catalogued type in the kit. */
export const componentKitEntrySchema = Schema.Union([
  componentKitRenderedEntrySchema,
  componentKitRefusedEntrySchema,
]).annotate({ strictKeys: true, title: 'sovrium:strict-keys', identifier: 'ComponentKitEntry' })

/**
 * The kit's `components/manifest.json`.
 *
 * `index` is the gallery page linking every drawn type; `stylesheet` is the one
 * stylesheet every page links. `types` holds one entry per catalogued type, in
 * catalogue order.
 *
 * @public Authored ahead of route wiring: the kit builder adopts it when the
 * bundle ships.
 */
export const componentKitManifestSchema = Schema.Struct({
  index: Schema.Literal('components/index.html').annotate({
    description: 'The gallery page linking every drawn type',
  }),
  stylesheet: Schema.Literal('components/kit.css').annotate({
    description: 'The stylesheet every kit page links',
  }),
  types: Schema.Array(componentKitEntrySchema).annotate({
    description: 'One entry per catalogued component type, in catalogue order',
  }),
}).annotate({
  strictKeys: true,
  title: 'sovrium:strict-keys',
  identifier: 'ComponentKitManifest',
})

/** @public */
export type ComponentKitGuidance = typeof componentKitGuidanceSchema.Type
/** @public */
export type ComponentKitEntry = typeof componentKitEntrySchema.Type
/** @public */
export type ComponentKitManifest = typeof componentKitManifestSchema.Type
