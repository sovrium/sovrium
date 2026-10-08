/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context } from 'effect'
import type { Result } from 'effect'

/**
 * Where a rendered value lands, and therefore how a value from run data is
 * encoded on its way in:
 *
 * - `html`: an email body. Every value is HTML-escaped, `{{value}}` and
 *   `{{{value}}}` alike; rich text passes only through `{{{safeHtml value}}}`.
 * - `url`: an outbound URL. Every value is percent-encoded as one path segment
 *   or one query value. A URL that is exactly one template, a `$env.` value and
 *   the output of the `urlEncode` family are inserted as they are; a bare `.`
 *   or `..` segment is refused.
 * - `json`: a string body sent as JSON. A value inside a JSON string literal is
 *   escaped as the content of that string.
 *
 * The text written in the template around the values is never encoded.
 */
export type TemplateEncoding = 'html' | 'url' | 'json'

/**
 * How a DOCUMENT template (an action's own `template`, `header`, `text`…)
 * escapes the values it inserts — chosen by the output: `html` for HTML and
 * SVG documents and email bodies, `xml` for OOXML parts, `text` for a
 * plain-text output (nothing escaped).
 */
export type DocumentTemplateMode = 'html' | 'xml' | 'text'

/**
 * Who wrote a document template: `authored` (the operator, in the config or in
 * `assets`) or `untrusted` (read from a bucket, so written by whoever may
 * upload to it). An untrusted template compiles in a restricted environment
 * (no `regex`, `matchAll` or `log`; an unknown name is a path, never a call)
 * and through a bounded compile cache.
 */
export type DocumentTemplateTrust = 'authored' | 'untrusted'

/**
 * What a document template renders INTO, which decides what `pageBreak`,
 * `image` and `qrcode` print: `html` (a page or an HTML image), `svg`, `email`
 * (an email body: pictures travel as inline parts), `word` (an OOXML part:
 * pictures become drawings, `qrcode` and partials are refused) and `text`.
 */
export type DocumentTarget = 'html' | 'svg' | 'email' | 'word' | 'text'

/** Where a picture lands in an SVG render, and how big it is drawn. */
export interface DocumentMediaPlacement {
  readonly width?: number
  readonly height?: number
  readonly x?: number
  readonly y?: number
}

/**
 * A picture a template asked for, which the render cannot draw by itself
 * because its bytes are read (or drawn) after the synchronous render: the
 * template printed {@link documentMediaMarker} in its place.
 */
export type DocumentMediaRequest =
  | (DocumentMediaPlacement & {
      readonly kind: 'image'
      /** A declared asset path, or a stored file (`{ key, bucket }`) named by data. */
      readonly source: unknown
      /** Set when the template wrote the source as a literal (`{{image "logo.png"}}`). */
      readonly literal?: true
    })
  | (DocumentMediaPlacement & {
      readonly kind: 'qrcode'
      readonly value: string
      /** The whole square, quiet zone included. */
      readonly size?: number
      /** The quiet zone, in modules (default 4). */
      readonly margin?: number
      readonly ecc?: 'L' | 'M' | 'Q' | 'H'
    })

/** A rendered document template, its pictures still to place. */
export interface DocumentRendering {
  readonly text: string
  /** The pictures, in marker order: `media[n]` stands where `documentMediaMarker(n)` is. */
  readonly media: ReadonlyArray<DocumentMediaRequest>
}

/**
 * The text a picture is rendered as until it is placed: two private-use
 * characters around its index, which no template or value can contain.
 */
export const documentMediaMarker = (index: number): string => `\uE000${index}\uE001`

/** Every picture marker in a rendered text, with the index it carries. */
export const DOCUMENT_MEDIA_MARKER = /\uE000(\d+)\uE001/g

/** What `{{pageBreak}}` prints in a Word part, swapped for a page break when the part is placed. */
export const WORD_PAGE_BREAK_MARKER = '\uE000B\uE001'

/** How a document template is rendered: escaping, author, target, language, partials. */
export interface DocumentRenderOptions {
  readonly mode: DocumentTemplateMode
  readonly trust: DocumentTemplateTrust
  /** What the template renders into (default: by `mode` — `html`, `svg` for `xml`, `text`). */
  readonly target?: DocumentTarget
  /** The locale amounts, numbers and dates are formatted in (`fr-FR`); default `en-US`. */
  readonly locale?: string
  /** The translation of a key in the render's language, or `undefined` when no language has it. */
  readonly translate?: (key: string) => string | undefined
  /**
   * The partials a template may include, by name (an asset path without its
   * extension) — read from `partial` assets only, never from a bucket.
   */
  readonly partials?: Readonly<Record<string, string>>
  /**
   * The most bytes the rendered text may hold (`RENDERER_MAX_OUTPUT_BYTES`);
   * a render past it fails with `render_limit_exceeded`. The live engine
   * fills it from the environment when a caller names none.
   */
  readonly maxOutputBytes?: number
}

/**
 * What the automation engine asks of a template engine: render an authored
 * `{{...}}` string against a context, and tell a registered helper name from
 * a path.
 *
 * Both are synchronous and total. A template that fails to compile, or a
 * helper that throws, renders as its own input — a malformed template in
 * authored config must never crash a run — so there is no error channel to
 * carry.
 */
export interface TemplateRenderer {
  /** Render `template` against `context`. Unknown paths render as `''`. */
  readonly render: (template: string, context: Readonly<Record<string, unknown>>) => string
  /**
   * Render `template` for the place its output lands (see
   * {@link TemplateEncoding}). Fails, with the reason, only when a value from
   * run data cannot be placed there safely (a `..` URL segment); every other
   * failure renders the template as its own input, as {@link render} does.
   */
  readonly renderFor: (
    template: string,
    context: Readonly<Record<string, unknown>>,
    encoding: TemplateEncoding
  ) => Readonly<Result.Result<string, string>>
  /**
   * Render a document template against the context its action gives it (its
   * `data`), every inserted value escaped for `mode`. Fails, with the reason,
   * when the template does not compile or a value cannot be placed — a
   * document is never produced from a template printed as its own source.
   */
  readonly renderDocument: (
    template: string,
    context: Readonly<Record<string, unknown>>,
    options: DocumentRenderOptions
  ) => Readonly<Result.Result<DocumentRendering, string>>
  /**
   * Whether `name` is a helper the engine registers (`now`, `uppercase`, …),
   * as opposed to a path that is merely missing from the context.
   */
  readonly isHelper: (name: string) => boolean
}

/**
 * The template engine behind `{{...}}` substitution in automation props.
 *
 * A port because the engine is a dependency the use-cases should not choose:
 * the Handlebars environment, its registered helpers and its compile cache
 * live in infrastructure, and the run loop reads the engine once and threads
 * the {@link TemplateRenderer} it got down to the synchronous resolvers on the
 * step and action contexts it already builds.
 */
export class TemplateEngine extends Context.Service<TemplateEngine, TemplateRenderer>()(
  'TemplateEngine'
) {}
