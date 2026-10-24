/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A form's success toast, carried across its document POST.
 *
 * An edit form that declares `onSuccess: { toast }` and no `navigate` submits
 * as a document POST, so the form works before the page's script runs; the
 * browser then lands on a new page, which never saw the toast. So after a
 * successful native update the server keeps the toast once, in a short-lived
 * cookie, and the next page render shows it and clears it — a reload does not
 * repeat it (post/redirect/get).
 *
 * The toast is never taken from the request: it is the one the author declared
 * on an update form for the written table, on the page the POST came from
 * ({@link declaredUpdateFlash}). A cross-site POST therefore cannot make the
 * site print words of its choosing.
 */

import { setCookie } from 'hono/cookie'
import { findPageRoute } from '@/domain/kernel/matching/localized-path'
import { resolveRedirectAgainst } from '@/domain/kernel/url/redirect-resolution'
import {
  resolveInterpreterString,
  resolveTranslationPattern,
} from '@/domain/models/app/languages/translation-resolver'
import type { App } from '@/domain/models/app'
import type { Context } from 'hono'

/** The cookie the toast travels in, between the POST and the page it lands on. */
export const FORM_FLASH_COOKIE = 'sovrium_form_flash'

/** How long the toast may wait for its page, in seconds. */
export const FORM_FLASH_MAX_AGE_S = 60

/** The toast a form declared, as the landing page shows it. */
export interface FormFlash {
  readonly message: string
  readonly variant?: string
  /**
   * A write refused because the writes were too many: the seconds to wait.
   * The message is then read in the landing page's own language.
   */
  readonly retryAfter?: number
}

type Node = Readonly<Record<string, unknown>>

const isNode = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Every node of a component tree, depth first: children and a layout's slots alike. */
const nodesOf = (value: unknown): readonly Node[] => {
  if (Array.isArray(value)) return value.flatMap(nodesOf)
  if (!isNode(value)) return []
  return [value, ...Object.values(value).flatMap((v) => (typeof v === 'object' ? nodesOf(v) : []))]
}

/** A form node's `crud` update action on `tableName`, when it is one. */
const updateActionOn = (node: Node, tableName: string): Node | undefined => {
  const { action } = node
  if (node['type'] !== 'form' || !isNode(action)) return undefined
  const isUpdate = action['type'] === 'crud' && action['operation'] === 'update'
  return isUpdate && action['table'] === tableName ? action : undefined
}

/** The toast of an edit form on `tableName` that declares one and no `navigate`. */
const updateToastOf = (node: Node, tableName: string): FormFlash | undefined => {
  const onSuccess = updateActionOn(node, tableName)?.['onSuccess']
  if (!isNode(onSuccess) || onSuccess['navigate'] !== undefined) return undefined
  const { toast } = onSuccess
  if (!isNode(toast) || typeof toast['message'] !== 'string') return undefined
  const variant = typeof toast['variant'] === 'string' ? toast['variant'] : undefined
  return { message: toast['message'], ...(variant === undefined ? {} : { variant }) }
}

/** The path less its language prefix, and that language — when it carries one. */
const splitLanguage = (app: App, path: string) => {
  const [, first = '', ...rest] = path.split('/')
  const supported = app.languages?.supported.map((l) => l.code) ?? []
  return supported.includes(first)
    ? { lang: first, unprefixed: `/${rest.join('/')}` }
    : { lang: undefined, unprefixed: path }
}

/** The page a path addresses, and the language it is read in. */
const pageAt = (app: App, path: string) => {
  const { lang, unprefixed } = splitLanguage(app, path)
  const pages = app.pages ?? []
  const page = (findPageRoute(pages, path) ?? findPageRoute(pages, unprefixed))?.page
  return { page, lang: lang ?? page?.meta?.lang ?? app.languages?.default ?? 'en' }
}

/**
 * The toast an update of `tableName` posted from `fromPath` declared — the
 * first edit form on that page writing that table with a toast and no
 * `navigate` — read in the page's language. `undefined` when there is none.
 */
export function declaredUpdateFlash(
  app: App,
  fromPath: string,
  tableName: string
): FormFlash | undefined {
  const { page, lang } = pageAt(app, fromPath)
  const flash = nodesOf(page?.components)
    .map((node) => updateToastOf(node, tableName))
    .find((toast) => toast !== undefined)
  if (flash === undefined) return undefined
  return { ...flash, message: resolveTranslationPattern(flash.message, lang, app.languages) }
}

/**
 * Keep, for the page the browser is sent back to, the toast the form posted
 * from `fromPath` declared for an update of `tableName` — nothing when it
 * declared none.
 */
export function flashDeclaredToast(
  at: { readonly c: Context; readonly app: App; readonly tableName: string },
  fromPath: string
): void {
  const flash = declaredUpdateFlash(at.app, fromPath, at.tableName)
  if (flash === undefined) return
  setCookie(at.c, FORM_FLASH_COOKIE, JSON.stringify(flash), {
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    secure: new URL(at.c.req.url).protocol === 'https:',
    maxAge: FORM_FLASH_MAX_AGE_S,
  })
}

/** The toast a cookie carries, or `undefined` for anything else. */
export function decodeFlash(raw: string): FormFlash | undefined {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isNode(parsed) || typeof parsed['message'] !== 'string') return undefined
    const message = parsed['message'].slice(0, 500)
    const variant = typeof parsed['variant'] === 'string' ? parsed['variant'] : undefined
    const wait = parsed['retryAfter']
    const retryAfter =
      typeof wait === 'number' && Number.isInteger(wait) && wait > 0 ? wait : undefined
    return {
      message,
      ...(variant === undefined ? {} : { variant }),
      ...(retryAfter === undefined ? {} : { retryAfter }),
    }
  } catch {
    return undefined
  }
}

const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const TOASTER_STYLE =
  'position:fixed;right:16px;z-index:9999;display:flex;flex-direction:column;gap:8px'

/** The flash's words: a rate-limit refusal is read in the page's `<html lang>`. */
const flashMessageIn = (html: string, flash: FormFlash): string => {
  if (flash.retryAfter === undefined) return flash.message
  const lang = /<html[^>]*\slang="([^"]+)"/.exec(html)?.[1]
  return resolveInterpreterString('rateLimit.retryIn', lang).replace(
    '{seconds}',
    String(flash.retryAfter)
  )
}

/**
 * Leave the toast a write refused for rate limit lands with: the page it is
 * sent back to says, in its own language, how many seconds to wait.
 */
const flashRateLimitRefusal = (c: Context, retryAfter: number): void => {
  const flash: FormFlash = { message: 'Too many requests.', variant: 'warning', retryAfter }
  setCookie(c, FORM_FLASH_COOKIE, JSON.stringify(flash), {
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    secure: new URL(c.req.url).protocol === 'https:',
    maxAge: FORM_FLASH_MAX_AGE_S,
  })
}

/**
 * A page form posted without scripts and refused because the writes were too
 * many lands on a page, never on the raw 429: a form-encoded POST naming a
 * same-site `_redirect` (and not asking for JSON, as a script's request does)
 * is sent back there with a toast saying how long to wait. `undefined` for any
 * other request, which gets the JSON refusal.
 */
export async function redirectRefusedFormPost(
  c: Context,
  retryAfter: number
): Promise<Response | undefined> {
  const type = c.req.header('content-type') ?? ''
  const formPost =
    c.req.method === 'POST' &&
    (type.includes('application/x-www-form-urlencoded') || type.includes('multipart/form-data')) &&
    !(c.req.header('accept') ?? '').includes('application/json')
  if (!formPost) return undefined
  const body = await c.req.parseBody().catch(() => ({}) as Record<string, unknown>)
  // Only a same-site address is honoured: anything else would be an open redirect.
  const target = resolveRedirectAgainst(body['_redirect'], c.req.header('referer'))
  if (target === undefined) return undefined
  flashRateLimitRefusal(c, retryAfter)
  return c.redirect(target, 303)
}

/**
 * The page with the toast drawn in it: inside the page's own toast container
 * when it declares one, otherwise in a container of its own before `</body>`.
 * Marked `data-form-flash`, so the client runtime can hand it to its own toast
 * (timed, dismissible) once it runs; without a script it simply stays drawn.
 */
export function withFlashToast(html: string, flash: FormFlash): string {
  const variant = escapeHtml(flash.variant ?? 'success')
  const message = flashMessageIn(html, flash)
  const toast = `<div data-toast="" data-form-flash="" data-variant="${variant}"><span data-toast-message="">${escapeHtml(message)}</span></div>`
  const container = /<div data-sonner-toaster=""[^>]*>/.exec(html)
  if (container !== null) {
    const at = container.index + container[0].length
    return `${html.slice(0, at)}${toast}${html.slice(at)}`
  }
  const own = `<div data-sonner-toaster="" data-toast-container="" style="${TOASTER_STYLE}">${toast}</div>`
  const body = html.lastIndexOf('</body>')
  return body === -1 ? `${html}${own}` : `${html.slice(0, body)}${own}${html.slice(body)}`
}
