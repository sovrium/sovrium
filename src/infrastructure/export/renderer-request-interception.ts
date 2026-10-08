/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { RENDER_DOCUMENT_ORIGIN } from '@/application/ports/services/document-renderer'
import { guardedFetch } from '@/infrastructure/egress/guarded-fetch'
import { validateOutboundUrl } from '@/infrastructure/egress/validate-outbound-url'
import type {
  AssetResolver,
  RenderAsset,
  RenderSandboxOptions,
} from '@/application/ports/services/document-renderer'

/**
 * The request half of the renderer sandbox ([internal ref] D8.1–D8.3).
 *
 * CDP `Fetch` is enabled on `*`, so EVERY request the page makes pauses here
 * before Chrome resolves a name or opens a socket. Each one gets exactly one
 * answer:
 *
 * - the synthetic document URL → the HTML, with a `script-src 'none'` CSP;
 * - `data:` / `blob:` → continued (they carry their own bytes, no network);
 * - `file:` → failed, always;
 * - anything the caller's {@link AssetResolver} serves → fulfilled with it;
 * - an http(s) URL with `allowRemoteAssets` → fetched BY THE ENGINE through
 *   `guardedFetch` (address guard on the URL and every redirect, deadline,
 *   size cap) and fulfilled as bytes;
 * - everything else → failed with `BlockedByClient`.
 */

/** The Content-Security-Policy served with every document. */
export const RENDER_DOCUMENT_CSP =
  "default-src 'none'; script-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'; img-src * data: blob:; style-src * 'unsafe-inline' data:; font-src * data:"

/** How one paused request is answered. */
export type InterceptionDecision =
  | { readonly kind: 'document' }
  | { readonly kind: 'continue' }
  | { readonly kind: 'fulfil'; readonly asset: RenderAsset; readonly status?: number }
  | { readonly kind: 'fail' }

/** What the decision needs to know about the render. */
export interface InterceptionContext {
  readonly documentUrl: string
  readonly sandbox: RenderSandboxOptions
  /** Bounds one remote fetch; the render deadline bounds them all. */
  readonly remoteTimeoutMs: number
  /** Bytes one remote asset may weigh. */
  readonly remoteMaxBytes: number
  /** Injected for tests; defaults to `guardedFetch`. */
  readonly fetchRemote?: (url: string) => Promise<RenderAsset | undefined>
}

const protocolOf = (url: string): string | undefined => {
  try {
    return new URL(url).protocol
  } catch {
    return undefined
  }
}

const guardedRemote =
  (timeoutMs: number, maxBytes: number) =>
  async (url: string): Promise<RenderAsset | undefined> => {
    const result = await guardedFetch(
      url,
      { method: 'GET' },
      { timeoutMs, maxBodyBytes: maxBytes }
    ).catch(() => undefined)
    if (result === undefined || !result.ok) return undefined
    const { response } = result
    if (!response.ok || response.truncated) return undefined
    return {
      bytes: response.body,
      contentType: response.headers.get('content-type') ?? 'application/octet-stream',
    }
  }

const resolveAsset = async (
  resolver: AssetResolver | undefined,
  url: string
): Promise<RenderAsset | undefined> =>
  resolver === undefined ? undefined : resolver(url).catch(() => undefined)

/** An http(s) URL nobody served: fetched by the engine under `allowRemoteAssets`, else failed. */
const remoteDecision = async (
  url: string,
  context: InterceptionContext
): Promise<InterceptionDecision> => {
  if (context.sandbox.allowRemoteAssets !== true) return { kind: 'fail' }
  // The reserved origin never leaves the engine, even with remote assets allowed.
  if (new URL(url).hostname.endsWith('.invalid')) return { kind: 'fail' }
  const fetchRemote =
    context.fetchRemote ?? guardedRemote(context.remoteTimeoutMs, context.remoteMaxBytes)
  const remote = await fetchRemote(url).catch(() => undefined)
  return remote === undefined ? { kind: 'fail' } : { kind: 'fulfil', asset: remote }
}

/** Decide the answer to one paused request. Never rejects: a failure fails the request. */
export const decideInterception = async (
  url: string,
  context: InterceptionContext
): Promise<InterceptionDecision> => {
  if (url === context.documentUrl) return { kind: 'document' }
  const protocol = protocolOf(url)
  if (protocol === 'data:' || protocol === 'blob:') return { kind: 'continue' }
  if (protocol !== 'http:' && protocol !== 'https:') return { kind: 'fail' }
  const served = await resolveAsset(context.sandbox.assetResolver, url)
  return served === undefined ? remoteDecision(url, context) : { kind: 'fulfil', asset: served }
}

/** The CDP command and parameters that carry a decision for `requestId`. */
export const interceptionCommand = (
  requestId: string,
  decision: InterceptionDecision,
  html: string
): { readonly method: string; readonly params: Record<string, unknown> } => {
  if (decision.kind === 'continue')
    return { method: 'Fetch.continueRequest', params: { requestId } }
  if (decision.kind === 'fail') {
    return { method: 'Fetch.failRequest', params: { requestId, errorReason: 'BlockedByClient' } }
  }
  const [contentType, bytes, csp] =
    decision.kind === 'document'
      ? ['text/html; charset=utf-8', new TextEncoder().encode(html), RENDER_DOCUMENT_CSP]
      : [decision.asset.contentType, decision.asset.bytes, undefined]
  return {
    method: 'Fetch.fulfillRequest',
    params: {
      requestId,
      responseCode: decision.kind === 'fulfil' ? (decision.status ?? 200) : 200,
      responseHeaders: [
        { name: 'Content-Type', value: contentType },
        { name: 'Cache-Control', value: 'no-store' },
        ...(csp === undefined ? [] : [{ name: 'Content-Security-Policy', value: csp }]),
      ],
      body: Buffer.from(bytes).toString('base64'),
    },
  }
}

/** The URL the rendered document has, against which its references resolve. */
const DOCUMENT_BASE = `${RENDER_DOCUMENT_ORIGIN}/document.html`

/**
 * Where a reference leads, resolved exactly as the browser resolves it — so
 * `http:host`, `/\host` and `\\host` are seen as the other hosts they
 * are, which no prefix pattern catches. `undefined` for a reference that does
 * not parse (the browser loads nothing for it either).
 */
const resolveReference = (value: string): URL | undefined => {
  try {
    return new URL(value.trim(), DOCUMENT_BASE)
  } catch {
    return undefined
  }
}

/**
 * Whether a reference leaves the document: anything that resolves outside
 * the render origin, other than the inline `data:` and `blob:` schemes. An
 * empty value resolves to the document itself and is kept.
 */
const isRemoteReference = (value: string): boolean => {
  const url = resolveReference(value)
  if (url === undefined) return false
  if (url.protocol === 'data:' || url.protocol === 'blob:') return false
  return url.origin !== RENDER_DOCUMENT_ORIGIN
}

/**
 * Link relations that make Chrome open a connection, resolve a name or load a
 * page on its own, outside the request interception: the element is dropped
 * whatever it names, `allowRemoteAssets` or not.
 */
const SPECULATIVE_RELATIONS: ReadonlySet<string> = new Set([
  'preconnect',
  'dns-prefetch',
  'prefetch',
  'prerender',
])

const isSpeculativeLink = (rel: string | null): boolean =>
  (rel ?? '')
    .toLowerCase()
    .split(/\s+/)
    .some((token) => SPECULATIVE_RELATIONS.has(token))

/** The elements and attributes that make the page load something: `[selector, attribute]`. */
const LOADING_ATTRIBUTES: ReadonlyArray<readonly [string, string]> = [
  ['img[src]', 'src'],
  ['img[srcset]', 'srcset'],
  ['source[src]', 'src'],
  ['source[srcset]', 'srcset'],
  ['link[href]', 'href'],
  ['video[src]', 'src'],
  ['video[poster]', 'poster'],
  ['audio[src]', 'src'],
  ['input[src]', 'src'],
  ['image[href]', 'href'],
  ['image[xlink\\:href]', 'xlink:href'],
  ['use[href]', 'href'],
]

/**
 * Remove every reference to the network from a document rendered without
 * `allowRemoteAssets`, before the browser sees it: the request is never made,
 * and nothing takes the place of what it would have drawn — a refused image
 * is no image, not a broken-image icon. The request interception stays the
 * guard behind this; this is what makes the output honest. A relative URL (a
 * declared asset) and a `data:` URL are kept, and so is a network URL `keep`
 * accepts (under `allowRemoteAssets`: one the outbound guard would fetch).
 */
export const stripRemoteReferences = async (
  html: string,
  keep: (url: string) => boolean = () => false
): Promise<string> => {
  const base = new HTMLRewriter()
    .on('link[rel]', {
      element: (element) => {
        if (isSpeculativeLink(element.getAttribute('rel'))) element.remove()
      },
    })
    // Read as raw text here, parsed as markup by a browser with scripts off.
    .on('noscript', {
      element: (element) => {
        element.remove()
      },
    })
  const rewriter = LOADING_ATTRIBUTES.reduce(
    (current, [selector, attribute]) =>
      current.on(selector, {
        element: (element) => {
          const value = element.getAttribute(attribute) ?? ''
          const urls = attribute.endsWith('srcset')
            ? value.split(',').map((candidate) => candidate.trim().split(/\s+/, 1)[0] ?? '')
            : [value.trim()]
          const refused = urls.some(
            (url) => isRemoteReference(url) && !keep(resolveReference(url)?.href ?? url)
          )
          if (refused) element.removeAttribute(attribute)
        },
      }),
    base
  )
  return rewriter.transform(new Response(html)).text()
}

/** Under `allowRemoteAssets`: a network URL the outbound guard accepts (a protocol-relative one read as https). */
export const outboundGuardAccepts = (url: string): boolean =>
  validateOutboundUrl(url.trim().startsWith('//') ? `https:${url.trim()}` : url.trim()).ok
