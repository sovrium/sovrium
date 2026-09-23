/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * The app's logo and the rules for using it — the first section of every brand
 * charter, and the one Sovrium had no schema position for at all.
 *
 * Measured against a real public charter (mercipourtonnon.fr/charte), the
 * `design` key covered principles, colour, voice and do's-and-don'ts, and had
 * NO logo surface. In this repo the mark is real, versioned and used —
 * `/logos/sovrium-horizontal-dark.svg` is referenced from
 * `apps/website/config/components/shared-components.ts` — but the rules around
 * it (clear space, minimum size, what you may not do to it) live only as prose
 * in `BRAND.md`, invisible to the running instance and unavailable to any
 * customer who is not this repo. That is the same gap `principles` and `voice`
 * were added to close, one section earlier in the charter.
 *
 * ─── WHERE THE FILE LIVES: THE ASSET-LOCATION RULE ──────────────────────────
 *
 * This key holds a REFERENCE, not bytes. The only thing any consumer can do
 * with it is put it in an `src=` attribute, so the schema's whole job is to
 * guarantee the reference RESOLVES in a browser. Two forms are accepted and
 * everything else is refused:
 *
 * 1. **Root-relative** — `'/logos/wordmark.svg'`. This is the form the repo
 *    already uses, and it covers BOTH storage homes with one rule and no new
 *    concept: a file in the app's public directory is served at `/name.ext`,
 *    and a bucket object is served at `/api/buckets/{bucket}/files/{path}`.
 *    Which of the two an operator picks is an operations question — public dir
 *    for a mark that ships with the config, bucket for one uploaded later — and
 *    the schema does not need to care, because both produce a root-relative
 *    URL.
 * 2. **Absolute `https://`** — `'https://cdn.example.com/wordmark.svg'`, for a
 *    mark served from a CDN or owned by another party.
 *
 * Refused, each for a reason:
 *
 * - **A bare relative path** (`'wordmark.svg'`, `'./logos/x.svg'`). Relative to
 *   WHAT? Not the config file — the browser never sees that. It resolves
 *   against the current page URL, so the same declaration loads
 *   `/wordmark.svg` on the home page and `/fr/docs/guide/wordmark.svg` inside
 *   the docs zone. That is a 404 that appears only on some routes, which is the
 *   worst shape a broken asset can have. There is no way to write a
 *   *correct* bare-relative logo path, so accepting one accepts only mistakes.
 * - **`http://`**. An https app loading an http image is mixed content: the
 *   browser blocks it silently and the mark is simply absent, with nothing in
 *   the config to suggest why.
 * - **`data:`**. Standing eco rule R1 — never inline base64. A wordmark inlined
 *   into every page's HTML is paid for on every request and cached on none.
 *
 * ─── FORMAT: SVG, AND WHY THE AVIF RULE DOES NOT APPLY ──────────────────────
 *
 * Not schema-enforceable — a `.svg` extension does not make a file an SVG — but
 * load-bearing enough to state, because the alternative is a mark that looks
 * right in development and fails in production:
 *
 * - **Prefer SVG.** A wordmark is line art. It is resolution-independent,
 *   smaller than any raster encoding of it, sharp at every density, and has no
 *   codec question at all. Every mark in this repo's own `/logos/` is SVG or
 *   the format its owner supplied.
 * - **The AVIF rule is about screenshots, not marks.** `check-image-format-drift`
 *   requires committed raster assets to be AVIF, and `BRAND.md` §7 already
 *   carves `/logos/` out of it — a customer's wordmark is their trademark and
 *   re-encoding it is not Sovrium's call.
 * - **A logo is never a runtime-transform target.** The `file.transformImage`
 *   pipeline emits **WebP**, because `Bun.Image`'s `bun` backend on Linux ships
 *   no AV1 encoder and AVIF fails there outright. A mark declared here is
 *   served verbatim and never enters that pipeline, so the encode/decode split
 *   does not reach it — but a future consumer that decides to "optimise" this
 *   path would rediscover that the hard way, in production only.
 */

/** Root-relative (`/…`) or absolute `https://`. See the module header. */
const ASSET_REFERENCE_PATTERN = /^(?:\/(?!\/)|https:\/\/)/

/** A minimum-size value DTCG can carry: a number with `px` or `rem`. */
const DIMENSION_PATTERN = /^(?:\d+\.?\d*|\.\d+)(?:px|rem)$/

const assetReference = (subject: string) =>
  Schema.String.pipe(
    Schema.check(
      Schema.isPattern(ASSET_REFERENCE_PATTERN, {
        message: `${subject} must be a root-relative path starting with \`/\` (e.g. \`/logos/wordmark.svg\`, which covers both the public directory and a bucket URL) or an absolute \`https://\` URL. A bare relative path resolves against the current page and 404s on nested routes; \`http://\` is blocked as mixed content; \`data:\` inlines bytes into every page.`,
      })
    )
  )

/**
 * The logo, its dark-mode counterpart, and the rules for placing it.
 *
 * `src` and `alt` are required together. A mark with no accessible name is a
 * real defect rather than a partial declaration — it reaches a screen reader as
 * nothing at all — and `alt` is one word the author already knows.
 */
export const LogoSchema = Schema.Struct({
  /**
   * The primary mark, as displayed against the app's default (light) surface.
   */
  src: assetReference('A logo `src`').pipe(
    Schema.annotate({
      title: 'Logo Source',
      description: 'Root-relative path or `https://` URL of the primary mark',
      examples: ['/logos/sovrium-horizontal-dark.svg', 'https://cdn.example.com/wordmark.svg'],
    })
  ),

  /**
   * The variant shown when the interface is in DARK mode.
   *
   * ─── NAMED FOR THE MODE IT SERVES, NOT THE INK IT CONTAINS ────────────────
   *
   * This is the field most likely to be filled in backwards, so it is worth
   * being explicit. This repo's own files are named for their INK:
   * `sovrium-horizontal-dark.svg` is the DARK-INK mark, and it is the one shown
   * in LIGHT mode. So for this app the correct declaration is:
   *
   * ```ts
   * src:     '/logos/sovrium-horizontal-dark.svg'   // dark ink,  light mode
   * srcDark: '/logos/sovrium-horizontal-light.svg'  // light ink, dark mode
   * ```
   *
   * Reading the two file names alone gives exactly the opposite pairing. The
   * field is named for the mode because that is what a consumer binds to (a
   * `dark:` display utility), and the ambiguity is resolved here rather than
   * left for each consumer to get wrong independently.
   *
   * Optional: a mark that reads on both surfaces — most single-colour marks in
   * a mid-tone, and every mark with its own background plate — needs no second
   * file, and requiring one would invite a duplicate that then goes stale.
   */
  srcDark: Schema.optional(
    assetReference('A logo `srcDark`').pipe(
      Schema.annotate({
        howTo:
          'Named for the MODE, not for the ink, and it is the field most often filled in backwards. The DARK-ink file is the one shown in LIGHT mode, so it belongs in `src`; the light-ink file belongs here. Leave it out when one mark reads on both surfaces.',
        title: 'Dark-Mode Logo Source',
        description:
          'Variant shown when the interface is in dark mode — i.e. the light-ink file. Omit when one mark reads on both surfaces.',
        examples: ['/logos/sovrium-horizontal-light.svg'],
      })
    )
  ),

  /**
   * The accessible name of the mark — almost always just the app's name.
   *
   * NOT `'logo'`, and not `'Acme logo'`: a screen reader already announces the
   * element as an image, so "logo" is the word it adds nothing by repeating.
   */
  alt: Schema.String.pipe(
    Schema.annotate({
      title: 'Logo Alt Text',
      description: "Accessible name of the mark — normally just the app's name",
      examples: ['Sovrium'],
    }),
    Schema.check(Schema.isMinLength(1, { message: 'A logo `alt` must not be empty' }))
  ),

  /**
   * The exclusion zone, stated as the charter states it.
   *
   * Deliberately PROSE and not a dimension. Every charter worth reading
   * expresses clear space RELATIVE to the mark — "the height of the S on all
   * four sides" — because that is the rule that survives the mark being
   * resized. A single number would force the author to pick one placement's
   * answer and publish it as the rule.
   */
  clearSpace: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        title: 'Clear Space',
        description: 'The exclusion zone around the mark, stated relative to the mark itself',
        examples: ['Leave clear space equal to the height of the mark on all four sides.'],
      }),
      Schema.check(Schema.isMinLength(1, { message: 'A logo `clearSpace` rule must not be empty' }))
    )
  ),

  /**
   * The smallest width the mark may be reproduced at.
   *
   * A dimension rather than prose, because unlike clear space this genuinely IS
   * one number, and it is the number a consumer can enforce.
   */
  minWidth: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        title: 'Minimum Width',
        description: 'Smallest width the mark may be reproduced at',
        examples: ['96px', '6rem'],
      }),
      Schema.check(
        Schema.isPattern(DIMENSION_PATTERN, {
          message:
            'A logo `minWidth` must be a positive number followed by `px` or `rem` (e.g. `96px`).',
        })
      )
    )
  ),

  /**
   * What may not be done to the mark.
   *
   * The half of a logo section that actually changes behaviour. "Use the
   * wordmark" tells a designer nothing they were not already going to do;
   * "never re-colour it, never set it on a busy photograph" is the sentence
   * that prevents the thing you did not want.
   */
  misuse: Schema.optional(
    Schema.Array(
      Schema.String.pipe(
        Schema.annotate({ description: 'One thing that must never be done to the mark' }),
        Schema.check(Schema.isMinLength(1, { message: 'A logo misuse rule must not be empty' }))
      )
    ).pipe(
      Schema.annotate({
        title: 'Logo Misuse',
        description: 'Things that must never be done to the mark',
        examples: [
          [
            'Never re-colour the mark.',
            'Never stretch, rotate or add effects.',
            'Never place it on a busy photograph without a plate.',
          ],
        ],
      })
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'Logo',
    title: 'Logo',
    description:
      "The app's mark and the rules for placing it: the file, its dark-mode variant, its accessible name, clear space, minimum size, and what must never be done to it.",
    examples: [
      {
        src: '/logos/sovrium-horizontal-dark.svg',
        srcDark: '/logos/sovrium-horizontal-light.svg',
        alt: 'Sovrium',
        clearSpace: 'Leave clear space equal to the height of the mark on all four sides.',
        minWidth: '96px',
        misuse: ['Never re-colour the mark.', 'Never stretch or rotate it.'],
      },
    ],
  })
)

/** @public */
export type Logo = Schema.Schema.Type<typeof LogoSchema>
