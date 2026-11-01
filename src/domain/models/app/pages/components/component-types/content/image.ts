/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { coreFields } from '../modules/core'
import { interactionFields } from '../modules/interaction'
import { responsiveFields } from '../modules/responsive'
import { visibilityFields } from '../modules/visibility'

export const ImageTypeLiteral = Schema.Literal('image')

export const ImageVariantSchema = Schema.Literals([
  'default',
  'avatar',
  'thumbnail',
  'hero',
]).annotate({
  title: 'Image Variant',
  description: 'Image presentation variant.',
})

/**
 * One file under `public/`, spelled the way the page addresses it: a leading
 * `/`, then plain segments, ending in `.svg`. No segment starts with a dot, so
 * `..` and `.git` are out, and the characters a token, a query, an encoded
 * traversal or another origin needs (`$`, `{`, `:`, `?`, `#`, `%`, `\`) are not
 * in the alphabet.
 */
const PUBLIC_SVG_PATH = /^\/(?:[A-Za-z0-9_-][A-Za-z0-9._-]*\/)*[A-Za-z0-9_-][A-Za-z0-9._-]*\.svg$/i

/**
 * Paths the alphabet admits that never name a file of `public/`: `/api/` is
 * where a bucket's files are addressed, and a bucket holds what people upload,
 * so being on the same origin says nothing about who wrote the file; `/_admin/`
 * is the console; `node_modules` is refused by the public route at any depth.
 */
const NOT_A_PUBLIC_FILE = /^\/(?:api|_admin)\/|(?:^|\/)node_modules\//i

/** Whether a value is a literal path to a file of `public/`: the one form `inlineSvg` takes. */
export const isLiteralPublicSvgPath = (path: string): boolean =>
  PUBLIC_SVG_PATH.test(path) && !NOT_A_PUBLIC_FILE.test(path)

/** The refusal of any other value, quoting it. */
export const inlineSvgPathRefusal = (path: string): string =>
  `inlineSvg "${path}" is not a literal path to an .svg file under public/. Write it as the page addresses the file, such as /plans/first-floor.svg, with no token, no other origin, no bucket address and no "..".`

/**
 * `inlineSvg` draws a file into the page rather than pointing an `<img>` at it,
 * so what the file holds becomes part of the page. Only a file the operator
 * shipped may do that, and the check is a literal path, here, at decode: a
 * `$record.` token or a bucket address would let a row or an upload choose it.
 */
const InlineSvgPathSchema = Schema.String.annotate({
  title: 'Inline SVG File',
  description:
    'A literal path to an `.svg` file under `public/`, such as `/plans/first-floor.svg`. The drawing is written into the page after being sanitised, so `fill="currentColor"` and `var(--color-primary)` in the file follow the app\'s colours and its colour scheme. Name it with this key instead of `props.src`; `props.alt` still names it. A token, an address on another origin and a bucket file are refused, and so is a path with `..`.',
  examples: ['/plans/first-floor.svg'],
}).check(
  Schema.makeFilter((path: string) =>
    isLiteralPublicSvgPath(path) ? undefined : inlineSvgPathRefusal(path)
  )
)

export const imageFields = {
  ...coreFields,
  ...interactionFields,
  ...responsiveFields,
  ...visibilityFields,
  variant: Schema.optional(ImageVariantSchema),
  inlineSvg: Schema.optional(InlineSvgPathSchema),
} as const
