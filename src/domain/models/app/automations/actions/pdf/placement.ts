/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * The placement vocabulary `pdf/watermark` and `pdf/stamp` share: where a mark
 * sits on a page, how big, what colour, how opaque, at what angle.
 *
 * Every length is in PDF points (1/72 inch; an A4 page is 595 × 842 points),
 * and every position is measured from the page's TOP-LEFT corner, the way a
 * layout tool measures it — not from the bottom-left origin PDF itself uses.
 */

/** The nine anchors a mark can sit on. */
export const PAGE_ANCHORS = [
  'top-left',
  'top-center',
  'top-right',
  'center-left',
  'center',
  'center-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
] as const

/** A non-negative length in PDF points. */
const pointsSchema = (description: string) =>
  Schema.Finite.pipe(
    Schema.annotate({ description }),
    Schema.check(Schema.isGreaterThanOrEqualTo(0))
  )

/** An exact position: the mark's top-left corner, from the page's top-left corner. */
export const PagePointSchema = Schema.Struct({
  x: pointsSchema('Points from the left edge of the page to the left edge of the mark'),
  y: pointsSchema('Points from the top edge of the page to the top edge of the mark'),
}).pipe(
  Schema.annotate({
    description:
      "An exact position for the mark's top-left corner, in points from the page's top-left corner",
  })
)

/** Annotations for a placement prop: its description, and its default when it has one. */
const notes = (description: string, defaultNote: string | undefined) =>
  defaultNote === undefined ? { description } : { defaultNote, description }

/** The distance an edge anchor keeps from the page edge. */
export const marginSchema = (defaultNote?: string) =>
  Schema.Finite.pipe(
    Schema.annotate(
      notes(
        'Points kept between the mark and the page edge when it sits on an edge anchor',
        defaultNote
      )
    ),
    Schema.check(Schema.isGreaterThanOrEqualTo(0))
  )

/** How opaque a mark is, from invisible to solid. */
export const opacitySchema = (defaultNote?: string) =>
  Schema.Finite.pipe(
    Schema.annotate(notes('Opacity of the mark, from 0 (invisible) to 1 (solid)', defaultNote)),
    Schema.check(Schema.isBetween({ minimum: 0, maximum: 1 }))
  )

/** The angle a mark is drawn at. */
export const markAngleSchema = (defaultNote?: string) =>
  Schema.Finite.pipe(
    Schema.annotate(
      notes(
        'Angle the mark is drawn at, in degrees counter-clockwise; 45 runs from the bottom-left towards the top-right',
        defaultNote
      )
    ),
    Schema.check(Schema.isBetween({ minimum: -360, maximum: 360 }))
  )

/** The size of a text mark. */
export const fontSizeSchema = (defaultNote?: string) =>
  Schema.Finite.pipe(
    Schema.annotate(notes('Size of the text, in points', defaultNote)),
    Schema.check(Schema.isBetween({ minimum: 4, maximum: 400 }))
  )

/** A colour written as six hexadecimal digits. */
export const hexColorSchema = (defaultNote?: string) =>
  Schema.String.pipe(
    Schema.annotate(notes("Colour of the text, as '#rrggbb' (e.g. '#808080')", defaultNote)),
    Schema.check(
      Schema.isPattern(/^#[0-9a-fA-F]{6}$/, {
        message: "color must be six hexadecimal digits after '#', e.g. '#808080'",
      })
    )
  )

/** The drawn width of an image mark; its height follows the image's proportions. */
export const imageWidthSchema = (defaultNote?: string) =>
  Schema.Finite.pipe(
    Schema.annotate(
      notes(
        "Width the image is drawn at, in points; its height follows the image's proportions",
        defaultNote
      )
    ),
    Schema.check(Schema.isGreaterThan(0))
  )

/** One of the nine anchors, with its default. */
export const pageAnchorSchema = (defaultNote: string) =>
  Schema.Literals(PAGE_ANCHORS).pipe(
    Schema.annotate(
      notes(
        'Where the mark sits on the page: one of nine anchors, from top-left to bottom-right; an edge anchor keeps `margin` points from the page edge',
        defaultNote
      )
    )
  )
