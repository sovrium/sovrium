/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { AssetPathSchema } from '../asset-path'

/**
 * The kinds of private file an app can ship beside its config.
 *
 * A kind says what the file IS, so the start-up check can compare it with the
 * file's content (a `.docx` that is really a renamed text file is refused
 * before an automation trips on it). Whether a file is templated is said by
 * the action that reads it, not here.
 *
 * @public
 */
export const ASSET_KINDS = [
  'html',
  'svg',
  'css',
  'partial',
  'text',
  'docx',
  'xlsx',
  'pptx',
  'pdf',
  'image',
  'font',
  'data',
] as const

/** @public */
export type AssetKind = (typeof ASSET_KINDS)[number]

/**
 * The kind an extension implies when an entry declares none.
 *
 * An extension missing from this table has no implied kind, so its entry must
 * declare `kind` — refused otherwise, rather than guessed.
 */
const ASSET_KIND_BY_EXTENSION: Readonly<Record<string, AssetKind>> = {
  html: 'html',
  htm: 'html',
  svg: 'svg',
  css: 'css',
  hbs: 'partial',
  txt: 'text',
  md: 'text',
  docx: 'docx',
  xlsx: 'xlsx',
  pptx: 'pptx',
  pdf: 'pdf',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  webp: 'image',
  gif: 'image',
  woff2: 'font',
  woff: 'font',
  ttf: 'font',
  otf: 'font',
  json: 'data',
  yaml: 'data',
  yml: 'data',
}

/** The lower-cased extension of a path, or `undefined` when it has none. */
const extensionOf = (path: string): string | undefined => {
  const base = path.slice(path.lastIndexOf('/') + 1)
  const dot = base.lastIndexOf('.')
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : undefined
}

/** The kind an entry resolves to: its declared `kind`, else its extension's. @public */
export const resolveAssetKind = (entry: {
  readonly path: string
  readonly kind?: AssetKind
}): AssetKind | undefined => {
  if (entry.kind !== undefined) return entry.kind
  const extension = extensionOf(entry.path)
  return extension === undefined ? undefined : ASSET_KIND_BY_EXTENSION[extension]
}

/**
 * The kinds a template is read from, and so the kinds that may carry
 * `sampleData`: a font, an image, a PDF or a data file renders nothing to
 * preview.
 *
 * @public
 */
export const TEMPLATE_ASSET_KINDS: ReadonlyArray<AssetKind> = [
  'html',
  'svg',
  'partial',
  'text',
  'docx',
  'xlsx',
  'pptx',
]

/**
 * One private file shipped with the config.
 *
 * ## Never served
 *
 * No route serves an asset — not the page routes, not the public directory
 * (even when the file sits inside it), not the bucket file API. That is the
 * whole difference with `public/`, every file of which is downloadable.
 */
export const AssetSchema = Schema.Struct({
  path: AssetPathSchema,
  kind: Schema.optional(
    Schema.Literals(ASSET_KINDS).pipe(
      Schema.annotate({
        description:
          'What the file is. Omit it to take the kind from the extension; a path whose extension implies no kind must declare one. Checked against the file content when the app starts.',
      })
    )
  ),
  description: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({ description: 'What the file is for, for the people reading the config' })
    )
  ),
  // The path form must name a declared `data` asset whose file parses as JSON
  // or YAML; that rule needs the rest of the list and the filesystem, so it
  // runs with the app-level asset checks.
  sampleData: Schema.optional(
    Schema.Union([
      AssetPathSchema.pipe(
        Schema.annotate({
          description: 'Path of a declared data asset (.json, .yaml) holding the sample values',
        })
      ),
      Schema.Record(Schema.String, Schema.Unknown).pipe(
        Schema.annotate({ description: 'The sample values, written in the config' })
      ),
    ]).pipe(
      Schema.annotate({
        description:
          "Values to preview a template with, shaped like an action's data: the path of a declared data asset, or an object. Read by sovrium render and the console's template preview, never by an automation run. Template kinds only.",
      })
    )
  ),
}).pipe(
  Schema.annotate({
    identifier: 'Asset',
    title: 'Asset',
    description:
      'A private file beside the config — a template, a font, an image, sample data — read by actions and never served over HTTP.',
  }),
  Schema.check(
    Schema.makeFilter((entry) => resolveAssetKind(entry) !== undefined, {
      message:
        "this asset's extension implies no kind; declare `kind` (html, svg, css, partial, text, docx, xlsx, pptx, pdf, image, font or data)",
    }),
    Schema.makeFilter(
      (entry) => {
        const kind = resolveAssetKind(entry)
        return (
          entry.sampleData === undefined ||
          kind === undefined ||
          TEMPLATE_ASSET_KINDS.includes(kind)
        )
      },
      {
        message:
          'sampleData previews a template; only an html, svg, partial, text, docx, xlsx or pptx asset takes it',
      }
    )
  )
)

/** @public */
export type Asset = Schema.Schema.Type<typeof AssetSchema>

/**
 * The top-level `assets` list.
 *
 * Duplicate paths are refused here, since the rule needs only the list itself.
 * Rules that need the filesystem (existence, kind against content, symbolic
 * links leaving the project) and rules that need the rest of the config (an
 * action naming an undeclared asset) run with the app-level checks.
 */
export const AssetsSchema = Schema.Array(AssetSchema).pipe(
  Schema.annotate({
    identifier: 'Assets',
    title: 'Assets',
    description:
      'Private files shipped beside the config — templates, fonts, images, sample data — read by actions through { asset: <path> } and never served over HTTP.',
  }),
  Schema.check(
    Schema.makeFilter(
      (entries) => new Set(entries.map((entry) => entry.path)).size === entries.length,
      { message: 'each asset path may be declared only once' }
    )
  )
)

/** @public */
export type Assets = Schema.Schema.Type<typeof AssetsSchema>
