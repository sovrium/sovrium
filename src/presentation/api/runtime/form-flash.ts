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
import { matchRoute } from '@/domain/kernel/matching/route-matcher'
import { resolveTranslationPattern } from '@/domain/models/app/languages/translation-resolver'
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
  const page = (app.pages ?? []).find((p) => matchRoute(p.path, unprefixed).matched)
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
    return { message, ...(variant === undefined ? {} : { variant }) }
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
  'position:fixed;bottom:16px;right:16px;z-index:9999;display:flex;flex-direction:column;gap:8px'

/**
 * The page with the toast drawn in it: inside the page's own toast container
 * when it declares one, otherwise in a container of its own before `</body>`.
 * Marked `data-form-flash`, so the client runtime can hand it to its own toast
 * (timed, dismissible) once it runs; without a script it simply stays drawn.
 */
export function withFlashToast(html: string, flash: FormFlash): string {
  const variant = escapeHtml(flash.variant ?? 'success')
  const toast = `<div data-toast="" data-form-flash="" data-variant="${variant}"><span data-toast-message="">${escapeHtml(flash.message)}</span></div>`
  const container = /<div data-sonner-toaster=""[^>]*>/.exec(html)
  if (container !== null) {
    const at = container.index + container[0].length
    return `${html.slice(0, at)}${toast}${html.slice(at)}`
  }
  const own = `<div data-sonner-toaster="" role="status" aria-live="polite" style="${TOASTER_STYLE}">${toast}</div>`
  const body = html.lastIndexOf('</body>')
  return body === -1 ? `${html}${own}` : `${html.slice(0, body)}${own}${html.slice(body)}`
}
