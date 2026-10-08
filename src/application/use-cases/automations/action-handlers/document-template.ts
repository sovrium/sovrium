/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Data, Effect, Result } from 'effect'
import { AssetStore } from '@/application/ports/services/asset-store'
import { StorageService, UNATTRIBUTED_BUCKET } from '@/application/ports/services/storage-service'
import { ASSET_MAX_BYTES } from '@/domain/models/app/assets/asset-content-validation'
import { authoredReferenceRoots } from '../authored-references'
import { isRecord } from './document-run'
import type { ActionRunContext } from './shared'
import type {
  DocumentRenderOptions,
  DocumentRendering,
  DocumentTemplateTrust,
} from '@/application/ports/services/template-engine'
import type { AssetKind } from '@/domain/models/app/assets/asset'

/**
 * READING AND RENDERING AN ACTION'S OWN TEMPLATE (`template`, `header`,
 * `footer`, `text`): `{ inline }` written in the config, `{ asset }` shipped
 * with it, or `{ key, bucket? }` read from storage at run time.
 *
 * The template text is never touched by the run's generic pass (the
 * `templateContext` annotation), so it is read here from the props as given
 * and rendered once, escaped for its output, against the action's `data`.
 * Trust follows the author: inline and asset templates are the operator's; a
 * bucket template is whoever may write to that bucket's, and renders in the
 * engine's restricted tier.
 */

/** A template that could not be read or rendered; `message` names it. */
export class DocumentTemplateError extends Data.TaggedError('DocumentTemplateError')<{
  readonly message: string
}> {}

/** A template's text, who wrote it, and what kind it is when that is known. */
export interface TemplateText {
  readonly text: string
  /** Bytes as read, for a binary template (a `.docx`). */
  readonly bytes: Uint8Array
  readonly trust: DocumentTemplateTrust
  /** Where it came from: `inline`, `asset` or `bucket`. */
  readonly origin: 'inline' | 'asset' | 'bucket'
  /** How a message names it. */
  readonly name: string
  readonly kind?: AssetKind
  /** The storage key or asset path, whose extension may say what it is. */
  readonly path?: string
}

const decode = (bytes: Uint8Array): string => new TextDecoder().decode(bytes)

const templateError = (message: string): Readonly<DocumentTemplateError> =>
  new DocumentTemplateError({ message })

const inlineTemplate = (text: string): TemplateText => ({
  text,
  bytes: new TextEncoder().encode(text),
  trust: 'authored',
  origin: 'inline',
  name: 'the inline template',
})

/** `{ asset }`: a declared private asset, read at start. */
const assetTemplate = (path: string): Effect.Effect<TemplateText, DocumentTemplateError> =>
  Effect.gen(function* () {
    const asset = (yield* AssetStore).get(path)
    if (asset === undefined) {
      return yield* templateError(`template asset "${path}" is not declared in assets`)
    }
    return {
      text: decode(asset.bytes),
      bytes: asset.bytes,
      trust: 'authored',
      origin: 'asset',
      name: `template asset "${path}"`,
      kind: asset.kind,
      path,
    } as const
  })

/** A stored template past the 10 MB a template asset may weigh, refused by name. */
const tooLargeTemplate = (key: string, size: number): Effect.Effect<never, DocumentTemplateError> =>
  Effect.fail(
    templateError(
      `template "${key}" weighs ${String(size)} bytes, over the 10 MB limit for a template`
    )
  )

/** `{ key, bucket? }`: a file in storage, written by whoever may write to its bucket. */
const bucketTemplate = (
  key: string,
  bucket: unknown
): Effect.Effect<TemplateText, DocumentTemplateError, StorageService> =>
  Effect.gen(function* () {
    const storage = yield* StorageService
    const binding = typeof bucket === 'string' ? bucket : UNATTRIBUTED_BUCKET
    // The catalogued size refuses an oversized template before a byte is
    // buffered; no catalog row falls through to the download, re-checked below.
    const catalogued = yield* Effect.result(storage.getMetadata(key, binding))
    if (catalogued._tag === 'Success' && catalogued.success.size > ASSET_MAX_BYTES) {
      return yield* tooLargeTemplate(key, catalogued.success.size)
    }
    const bytes = yield* storage
      .download(key, binding)
      .pipe(Effect.mapError(() => templateError(`template "${key}" could not be read`)))
    if (bytes.length > ASSET_MAX_BYTES) return yield* tooLargeTemplate(key, bytes.length)
    return {
      text: decode(bytes),
      bytes,
      trust: 'untrusted',
      origin: 'bucket',
      name: `template "${key}"`,
      path: key,
    } as const
  })

/** One template source, read (see {@link readTemplateSource}). */
const readSource = (
  source: unknown
): Effect.Effect<TemplateText, DocumentTemplateError, StorageService> => {
  if (!isRecord(source)) return Effect.fail(templateError('the template names no source'))
  if (typeof source['inline'] === 'string') return Effect.succeed(inlineTemplate(source['inline']))
  if (typeof source['asset'] === 'string') return assetTemplate(source['asset'])
  const { key, bucket } = source
  return typeof key === 'string' && key !== ''
    ? bucketTemplate(key, bucket)
    : Effect.fail(templateError('the template names no source'))
}

/** Read a template source as the action's props hold it. */
export const readTemplateSource = (
  source: unknown
): Effect.Effect<TemplateText, DocumentTemplateError, StorageService> =>
  readSource(source).pipe(Effect.withSpan('automations.read-template-source'))

/**
 * The context a template renders against: the action's `data` and nothing
 * else. An inline template — authored config — also reads the env values its
 * `$env.X` references were turned into (`{{$env.X}}`), and, inside a named
 * action template, the variables its `$name` references read; a stored
 * template never sees either.
 */
export const templateContext = (
  template: Pick<TemplateText, 'origin'>,
  data: Readonly<Record<string, unknown>>,
  runContext: ActionRunContext | undefined
): Readonly<Record<string, unknown>> =>
  template.origin === 'inline' && runContext !== undefined
    ? {
        ...data,
        ...authoredReferenceRoots({
          envLookup: runContext.envLookup,
          vars: runContext.templateVars,
        }),
      }
    : data

/**
 * Render a template's text against `context`, failing with its name.
 * `setup` carries its escaping `mode` and what the render needs beyond its
 * data — its target, language and partials; the pictures it asks for come
 * back beside the text.
 */
export const renderTemplateText = (
  template: Pick<TemplateText, 'text' | 'trust' | 'name'>,
  context: Readonly<Record<string, unknown>>,
  runContext: ActionRunContext | undefined,
  setup: Omit<DocumentRenderOptions, 'trust'>
): Effect.Effect<DocumentRendering, DocumentTemplateError> => {
  if (runContext === undefined) {
    return Effect.fail(
      new DocumentTemplateError({ message: `${template.name} has no template engine to render it` })
    )
  }
  return Result.match(
    runContext.templates.renderDocument(template.text, context, {
      ...setup,
      trust: template.trust,
    }),
    {
      onSuccess: (rendering) => Effect.succeed(rendering),
      onFailure: (reason) =>
        Effect.fail(new DocumentTemplateError({ message: `${template.name}: ${reason}` })),
    }
  ).pipe(Effect.withSpan('automations.render-template-text'))
}
