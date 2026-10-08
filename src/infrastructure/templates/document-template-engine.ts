/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Result } from 'effect'
import Handlebars from 'handlebars'
import { encodeExpressions, ENCODE_VALUE_HELPER } from './encoded-template'
import { registerHelpers } from './handlebars-helpers'
import { RENDER_STATE_KEY, type DocumentRenderState } from './helper-documents'
import { TemplateRefusal } from './helper-encoding'
import {
  BUILT_IN_HELPERS,
  compileAuthoredOrThrow,
  ENCODED_RENDER_OPTIONS,
  TRACKED_ARGUMENTS,
  type Compiled,
} from './template-engine'
import { templateReferences } from './template-references'
import type {
  DocumentRenderOptions,
  DocumentRendering,
  DocumentTarget,
  DocumentTemplateMode,
} from '@/application/ports/services/template-engine'

// ─── Document templates (an action's own `template`, rendered once) ────────

/**
 * The environment an UNTRUSTED template compiles in: the same catalogue minus
 * the helpers that turn template text into work or output beyond the document
 * (`regex` and `matchAll` compile a pattern, `log` writes to the server
 * console), and with `knownHelpersOnly`, so a name that is no helper is a
 * path, never a call.
 */
const UNTRUSTED_REFUSED_HELPERS: ReadonlyArray<string> = ['regex', 'matchAll', 'log']
const untrustedEngine = Handlebars.create()
registerHelpers(untrustedEngine)
UNTRUSTED_REFUSED_HELPERS.forEach((name) => untrustedEngine.unregisterHelper(name))

const isUntrustedHelper = (name: string): boolean =>
  Object.hasOwn(untrustedEngine.helpers, name) && !BUILT_IN_HELPERS.has(name)

const UNTRUSTED_KNOWN_HELPERS: Readonly<Record<string, boolean>> = {
  ...Object.fromEntries(Object.keys(untrustedEngine.helpers).map((name) => [name, true])),
  [ENCODE_VALUE_HELPER]: true,
  log: false,
}

/**
 * Compiled untrusted templates, keyed by the SHA-256 of their content and
 * their mode, and bounded. A collision-resistant hash on purpose: the text is
 * untrusted, and a 64-bit hash two templates could be crafted to share would
 * hand one template another's compiled program. Bounded because their text
 * comes from storage at run time, not from the finite config, so the cache
 * must not grow with it. Least recently used first out (a `Map` iterates in
 * insertion order; a hit is re-inserted).
 */
const UNTRUSTED_CACHE_LIMIT = 128
const untrustedCache = new Map<string, Compiled>()

const remember = (key: string, compiled: Compiled): Compiled => {
  untrustedCache.delete(key)
  untrustedCache.set(key, compiled)
  const oldest = untrustedCache.keys().next()
  if (untrustedCache.size > UNTRUSTED_CACHE_LIMIT && oldest.done !== true) {
    untrustedCache.delete(oldest.value)
  }
  return compiled
}

const compileUntrusted = (template: string, mode: DocumentTemplateMode): Compiled => {
  const key = `${mode}\u0000${new Bun.CryptoHasher('sha256').update(template).digest('hex')}`
  const cached = untrustedCache.get(key)
  if (cached !== undefined) return remember(key, cached)
  const ast = untrustedEngine.parse(template)
  const encoded = mode === 'text' ? ast : encodeExpressions(ast, mode, isUntrustedHelper)
  return remember(
    key,
    untrustedEngine.compile(encoded, {
      noEscape: true,
      strict: false,
      knownHelpers: UNTRUSTED_KNOWN_HELPERS,
      knownHelpersOnly: true,
      ...TRACKED_ARGUMENTS,
    })
  )
}

/** Authored document templates share the config's compile cache (a finite set). */
const compileAuthoredDocument = (template: string, mode: DocumentTemplateMode): Compiled =>
  compileAuthoredOrThrow(template, mode === 'text' ? undefined : mode)

const compileDocument = (
  template: string,
  options: Pick<DocumentRenderOptions, 'mode' | 'trust'>
): Compiled =>
  options.trust === 'untrusted'
    ? compileUntrusted(template, options.mode)
    : compileAuthoredDocument(template, options.mode)

/** How deep partials may include partials before a render stops (a self-including one). */
const MAX_PARTIAL_DEPTH = 10
const PARTIAL_DEPTH_KEY = 'sovriumPartialDepth'

type PartialFrame = Readonly<Record<string, unknown>> | undefined

/** A compiled partial that counts how deep it is included and stops past the limit. */
const depthGuarded =
  (name: string, compiled: Compiled) =>
  (context: Readonly<Record<string, unknown>>, runtime?: Handlebars.RuntimeOptions): string => {
    const frame = runtime?.data as PartialFrame
    const depth = Number(frame?.[PARTIAL_DEPTH_KEY] ?? 0) + 1
    if (depth > MAX_PARTIAL_DEPTH) {
      throw new TemplateRefusal(
        `partial "${name}" nests more than ${MAX_PARTIAL_DEPTH} levels deep`
      )
    }
    return compiled(context, {
      ...runtime,
      data: { ...Handlebars.createFrame(frame ?? {}), [PARTIAL_DEPTH_KEY]: depth },
    })
  }

/** The declared partials, compiled like the template that includes them (same tier, same escaping). */
const compilePartials = (options: DocumentRenderOptions): Readonly<Record<string, unknown>> =>
  Object.fromEntries(
    Object.entries(options.partials ?? {}).map(([name, text]) => [
      name,
      depthGuarded(name, compileDocument(text, options)),
    ])
  )

/** The target a render defaults to when the caller names none. */
const defaultTarget = (mode: DocumentTemplateMode): DocumentTarget => {
  if (mode === 'xml') return 'svg'
  return mode === 'text' ? 'text' : 'html'
}

/**
 * Why a document template cannot be rendered as it is written, before it is
 * compiled: a helper its tier does not have, a partial it may not include.
 */
const documentRefusal = (template: string, options: DocumentRenderOptions): string | undefined => {
  const references = templateReferences(untrustedEngine.parse(template))
  const refused =
    options.trust === 'untrusted'
      ? UNTRUSTED_REFUSED_HELPERS.find((name) => references.helpers.has(name))
      : undefined
  if (refused !== undefined) return `${refused} is not available in a template stored in a bucket`
  const partials = [...references.partials].filter((name) => name !== '@partial-block')
  if (partials.length > 0 && options.target === 'word') {
    return 'partials are not available in a Word template'
  }
  if (references.dynamicPartial) return 'a partial name must be written in the template'
  const undeclared = partials.find((name) => !Object.hasOwn(options.partials ?? {}, name))
  return undeclared === undefined ? undefined : `partial "${undeclared}" is not declared in assets`
}

/** Why rendered text is refused for its size, or `undefined` when it fits (or no limit is set). */
const outputRefusal = (text: string, maxOutputBytes: number | undefined): string | undefined => {
  if (maxOutputBytes === undefined) return undefined
  const bytes = Buffer.byteLength(text, 'utf8')
  return bytes > maxOutputBytes
    ? `render_limit_exceeded: the rendered template is ${String(bytes)} bytes, above the ${String(maxOutputBytes)}-byte limit (RENDERER_MAX_OUTPUT_BYTES)`
    : undefined
}

/**
 * Render a document template — an action's own `template`, `header`, `text`…
 * — against the context the action gives it (its `data`). Every value an
 * expression inserts is escaped for `mode` (`html`: HTML, `xml`: XML, `text`:
 * nothing); `{{{safeHtml value}}}` is the one way to keep markup in HTML, and
 * it sanitizes. Unlike {@link renderTemplate}, a template that does not
 * compile FAILS, with the reason: a document is never produced from a template
 * printed as its own source.
 *
 * The render's target, locale and translations reach the document helpers
 * through the `data` frame; the pictures they ask for come back beside the
 * text, each where its marker stands.
 */
export const renderDocumentTemplate = (
  template: string,
  context: Readonly<Record<string, unknown>>,
  options: DocumentRenderOptions
): Result.Result<DocumentRendering, string> => {
  try {
    const target = options.target ?? defaultTarget(options.mode)
    const refusal = documentRefusal(template, { ...options, target })
    if (refusal !== undefined) return Result.fail(refusal)
    const compiled = compileDocument(template, options)
    const state: DocumentRenderState = {
      target,
      media: { current: [] },
      ...(options.locale === undefined ? {} : { locale: options.locale }),
      ...(options.translate === undefined ? {} : { translate: options.translate }),
    }
    const text = compiled(context, {
      ...ENCODED_RENDER_OPTIONS,
      partials: compilePartials(options) as Handlebars.RuntimeOptions['partials'],
      data: { [RENDER_STATE_KEY]: state },
    })
    const tooLarge = outputRefusal(text, options.maxOutputBytes)
    if (tooLarge !== undefined) return Result.fail(tooLarge)
    return Result.succeed({ text, media: state.media.current })
  } catch (error) {
    if (error instanceof TemplateRefusal) return Result.fail(error.message)
    const reason = error instanceof Error ? error.message.split('\n', 1)[0] : String(error)
    return Result.fail(`template could not be rendered: ${reason ?? 'unknown error'}`)
  }
}
