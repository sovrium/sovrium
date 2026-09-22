/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The shape one type page's authored body has.
//
// ─── WHAT A TYPE MAY AUTHOR, AND WHAT IT MAY NOT ───────────────────────────
//
// A type page draws its VARIANT sections from the axis the schema publishes —
// the members, in the published order, each headed by the value an author
// writes. That is a derivation, not a list, and nothing here can add to it or
// withhold from it: a member the page omits is a value an author cannot
// discover from the surface whose whole job is to publish it, and a heading the
// decoder refuses sends a reader to write config that fails.
//
// What a type authors instead is its DRAWINGS: the demonstrations that are not
// members of an axis. A divider has no variant union and still does three
// distinct things to a page; `code` frames its content five ways. Those are
// worth having and they are not variants, so they sit together in the type's
// resting section, each under its own name, and none of them claims an axis.
//
// ─── THE ONE EXCEPTION, AND WHY IT IS NAMED RATHER THAN INFERRED ───────────
//
// `badge` authors its variant sections. Its six headings are not values of one
// axis: `badgeVariant` picks the fill and `variant` picks the mode, and each
// heading names a point in that product. The rule applies to a variant AXIS; a
// demonstration of two axes composed is a different thing. It is the only type
// in that position, so it is named in `type-page.ts` rather than derived from a
// property nothing else has.

import type { PageConfig } from 'sovrium'

/** One node of a page's component tree, as the config type expresses it. */
export type PageComponent = NonNullable<PageConfig['components']>[number]

/** One labelled drawing: a heading, an optional aside, and what is drawn. */
export interface TypeDrawing {
  /** This drawing's own name, in the type's vocabulary — it labels the block. */
  readonly label: string
  /** What to draw. Real components wherever the renderer can draw them. */
  readonly children: readonly PageComponent[]
}

/** One labelled drawing inside an option showcase. */
export interface OptionDrawing {
  /** The config line this drawing is OF — `rowHeight: short`, `legend: none`. */
  readonly label: string
  /** What to draw. The real component wherever the renderer can draw it. */
  readonly children: readonly PageComponent[]
}

/**
 * One option of a type, drawn at each of its values.
 *
 * The rail entry and the section come from THIS object, which is the whole
 * reason it exists: a page with twenty sections and twenty hand-written rail
 * links drifts the first time one is renamed. `id` is the anchor, `title` is
 * both the heading and the rail entry, and `configKey` is the mono line under
 * the heading naming what an author would write.
 */
export interface OptionShowcase {
  /** Anchor slug, unique within the type. */
  readonly id: string
  /** Section heading, and the rail entry — one string, two places. */
  readonly title: string
  /** The key an author writes, in the config's own spelling. */
  readonly configKey: string
  readonly drawings: readonly OptionDrawing[]
}

/** Everything one type page may say for itself. */
export interface TypePageBody {
  /**
   * The type's resting section: what it looks like, drawn once per form.
   *
   * These are demonstrations, never members of an axis, so they sit inside ONE
   * section — the type's resting drawing, anchored `design-system-type-default`
   * and indexed once in the rail. A type with a single drawing shows it bare; a
   * type with several labels each one.
   */
  readonly drawings?: readonly TypeDrawing[]
  /**
   * Authored VARIANT sections — `badge` only, and see the header for why.
   *
   * Every other type with a published axis derives its sections from it. A type
   * that sets this and publishes an axis draws this instead, which is a claim
   * about the schema and needs the reason `badge` has.
   */
  readonly variants?: readonly TypeDrawing[]
  /**
   * Supplies a Sizes section the schema cannot.
   *
   * The derived section follows a closed `size` union, which five types declare
   * — `button`, `progress`, `avatar`, `toggle`, `toggle-group`. A sixth sets its
   * width through a differently-named key (`drawer`), so the projection that
   * computes `sizeCount` never sees it and the derived section never fires on a
   * type whose size axis is real, declared and documented. That one authors it
   * here; the five do not.
   */
  readonly sizes?: readonly TypeDrawing[]
  /**
   * The type's options, each drawn at its values.
   *
   * Twenty types carry these; the rest have none, and a type with none draws
   * its variants and stops. The sections follow the variants and precede the
   * fixed three, which is the order the reference reads in.
   */
  readonly options?: readonly OptionShowcase[]
}
