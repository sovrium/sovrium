/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `qr-code` content component-type
 *.
 *
 * Renders a scannable symbol inline in the page. It sits beside `image` and
 * `iframe` rather than in the data components because it is a static rendering
 * of a value, not a live view of anything.
 *
 * SSR-ONLY, DELIBERATELY. A QR is a deterministic function of its payload, so
 * hydrating one would buy nothing and cost payload budget on a page whose whole
 * job may be to be printed. The renderer must therefore emit no `data-island`
 * marker — the same posture as `marquee`, `toc` and `theme-toggle`. That is
 * what makes it free against the island payload budget, correct with JS
 * disabled, and printable from the browser's own print dialog.
 *
 * The encoder already ships (`@/domain/models/app/links/qr-code-service`, zero-dependency) and
 * already serves `/l/{slug}.svg`, so this component adds a config surface over
 * an implementation that exists rather than a new capability.
 *
 * ACCESSIBLE NAME comes from the generic `props` bag
 * (`props: { 'aria-label': 'Check-in code' }`) rather than a dedicated field.
 * A QR matrix is completely opaque to a screen reader, which cannot describe a
 * matrix, so the name is what makes it announceable at all — but it is an
 * ordinary presentational attribute and does not earn its own schema key.
 *
 * WHY THE `link`/`value` EXCLUSION IS NOT EXPRESSED HERE: see
 * `src/domain/models/app/qr-code-validation.ts`. Two independent optional
 * fields cannot state "exactly one of" at the field level, and the per-branch
 * struct has no refinement hook — `buildComponentUnion` composes every branch
 * mechanically from `[typeLiteral, fields]`. The rule lives in the same place
 * the identically-shaped `select` rule does.
 */

import { Schema } from 'effect'
import { coreFields } from '../modules/core'
import { visibilityFields } from '../modules/visibility'

export const QrCodeTypeLiteral = Schema.Literal('qr-code')

/**
 * Error-correction level, mirroring `EccLevel` in `@/domain/models/app/links/qr-code-service`.
 *
 * `M` is the print/scan sweet spot and the encoder's own default, which is why
 * this field is optional rather than defaulted here — a default in two places
 * is a default that drifts. `H` is what becomes necessary the moment a logo is
 * overlaid on the symbol.
 */
export const QrCodeEccSchema = Schema.Literals(['L', 'M', 'Q', 'H']).annotate({
  title: 'QR Error-Correction Level',
  description:
    'QR error-correction level: L (7%), M (15%, default), Q (25%), H (30%). Raise to H when a logo is overlaid.',
})

export const qrCodeFields = {
  ...coreFields,
  ...visibilityFields,
  /**
   * Slug of a short link to encode. The symbol carries the SHORT URL plus the
   * QR marker, never the destination — a QR encoding a destination can never be
   * re-pointed and its scans can never be counted apart from clicks, which
   * removes most of the reason to print one.
   *
   * DELIBERATELY NOT cross-validated against `app.links[]`, unlike `formRef`.
   * A form is config-only, so a dangling `formRef` is always an authoring
   * error; a link may legitimately be minted at runtime, and a poster is
   * designed before the campaign is set up more often than the reverse.
   * Rejecting the config would refuse a valid workflow rather than catch a
   * mistake. Mutually exclusive with `value`.
   */
  link: Schema.optional(
    Schema.NonEmptyString.annotate({
      description:
        "Slug of the short link to encode. Encodes the link's short URL with the QR marker, so scans are attributed separately from clicks. Not resolved at decode time — the link may be minted at runtime. Mutually exclusive with 'value'.",
    })
  ),
  /**
   * Arbitrary payload to encode — a URL, a record field, a template result.
   * The escape hatch for anything that is not a tracked link, at the cost of
   * being un-repointable and unmeasurable. Mutually exclusive with `link`.
   */
  value: Schema.optional(
    Schema.NonEmptyString.annotate({
      description:
        "Arbitrary string to encode (URL, record field, template result). Mutually exclusive with 'link'.",
    })
  ),
  /**
   * Intrinsic pixel size of the symbol. Omit to let CSS size it: the SVG always
   * carries a `viewBox`, so it scales for print without pixelating whether or
   * not this is set.
   */
  size: Schema.optional(
    Schema.Int.pipe(Schema.check(Schema.isGreaterThan(0))).annotate({
      description:
        'Intrinsic pixel size of the symbol. Omit to let CSS size it — the SVG carries a viewBox either way.',
    })
  ),
  ecc: Schema.optional(QrCodeEccSchema),
} as const
