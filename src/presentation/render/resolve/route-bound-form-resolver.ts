/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isAdminEquivalent } from '@/domain/models/app/auth/roles/role'
import { resolveTranslationPattern } from '@/domain/models/app/languages/translation-resolver'
import { formAnswerColumns } from '@/domain/models/app/pages/components/component-types/data/table/form-answer-columns-service'
import { normalizeRouteParamRef } from '@/domain/models/app/pages/route-param-ref'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'
import type { Page } from '@/domain/models/app/pages'
import type { CallerCapability } from '@/domain/models/app/pages/components/visibility'

/** A resolved page, or the 404 answer for a segment naming no declared form. */
export type RouteBoundFormResolution = Page | 'not-found'

/** What a request tells the resolution. */
interface FormResolutionRequest {
  /** The app whose forms and tables the answers belong to (a mount's host app). */
  readonly app: App
  readonly routeParams: Readonly<Record<string, string>>
  /** The language the PAGE is served in — the one a `$t:` field label resolves to. */
  readonly lang: string
  readonly session: SessionInfo | undefined
  /**
   * The caller's powers on a mounted console, which renders without a session:
   * `administer-accounts` is the session's admin-equivalent role, stated.
   */
  readonly callerCapabilities?: readonly CallerCapability[] | undefined
}

/** Ambient context one page's resolution reads. */
interface FormResolutionContext extends Omit<
  FormResolutionRequest,
  'session' | 'callerCapabilities'
> {
  /** Whether this caller could be shown answers at all (see {@link canReadFormAnswers}). */
  readonly answersVisible: boolean
}

/**
 * Whether a caller could be shown submitted answers: the instance allows body
 * capture (`ADMIN_DETAIL_CAPTURE_BODIES_ALLOWED=true`) and her account role is
 * admin-equivalent — the submissions list's own reveal gate, so a grid never
 * draws an answer column its rows could not fill. On a mounted console, which
 * renders session-less, the role arrives as the `administer-accounts` power.
 */
export const canReadFormAnswers = (
  app: App,
  session: SessionInfo | undefined,
  capabilities?: readonly CallerCapability[]
): boolean =>
  process.env['ADMIN_DETAIL_CAPTURE_BODIES_ALLOWED'] === 'true' &&
  (session === undefined
    ? capabilities?.includes('administer-accounts') === true
    : isAdminEquivalent(session.role, app))

/**
 * Resolve each grid deriving its answer columns from a form
 * (`columnsFrom: { form }`), and derive them.
 *
 * ─── WHY IT RUNS BEFORE THE GENERIC `$param` PASS ──────────────────────────
 *
 * A `$param.<segment>` form reference is substituted by the generic pass like
 * any string leaf, and after that a route-bound form is indistinguishable from
 * a literal one. A LITERAL unknown form is refused at boot; a route-bound one
 * can only be judged here, while the reference is still there.
 *
 * ─── WHY 404 AND NOT AN EMPTY INBOX ────────────────────────────────────────
 *
 * "This form does not exist" and "this form received nothing" must not look the
 * same, and the caller learns nothing about which names exist — the answer the
 * route-bound table grid gives for the same reason.
 *
 * ─── WHAT THE GRID GETS ─────────────────────────────────────────────────────
 *
 * The authored columns (the envelope) lead; the answer columns follow, one per
 * value-carrying field of the form. They are emitted only for a caller who
 * could be shown answers: anyone else keeps the envelope alone rather than
 * columns she can never fill. `columnsFrom` is consumed either way, so it never
 * reaches the page.
 */
export function resolveRouteBoundForms(
  page: Page,
  request: FormResolutionRequest
): RouteBoundFormResolution {
  const { components } = page
  if (!components || components.length === 0 || !hasFormColumns(components)) return page

  const declared = new Set((request.app.forms ?? []).map((form) => form.name))
  const named = collectFormNames(components, request.routeParams)
  if (named.some((name) => !declared.has(name))) return 'not-found'

  const { session, callerCapabilities, ...rest } = request
  const answersVisible = canReadFormAnswers(request.app, session, callerCapabilities)
  const ctx = { ...rest, answersVisible }
  return { ...page, components: mapNodes(components, ctx) as Page['components'] }
}

/** The `columnsFrom.form` value of a node, when it derives from a form. */
function formSourceOf(node: Readonly<Record<string, unknown>>): string | undefined {
  const source = node['columnsFrom']
  if (typeof source !== 'object' || source === null) return undefined
  const { form } = source as { readonly form?: unknown }
  return typeof form === 'string' ? form : undefined
}

/** The form a source names, its route reference resolved against the URL. */
function formNameOf(source: string, routeParams: Readonly<Record<string, string>>): string {
  const ref = normalizeRouteParamRef(source)
  return ref === undefined ? source : (routeParams[ref.name] ?? '')
}

/** The children of a node, when it has any. */
function childrenOf(node: unknown): readonly unknown[] {
  if (typeof node !== 'object' || node === null) return []
  const { children } = node as { readonly children?: unknown }
  return Array.isArray(children) ? children : []
}

/** True when any node in the tree derives columns from a form. */
function hasFormColumns(nodes: readonly unknown[]): boolean {
  return nodes.some(
    (node) =>
      (typeof node === 'object' &&
        node !== null &&
        formSourceOf(node as Record<string, unknown>) !== undefined) ||
      hasFormColumns(childrenOf(node))
  )
}

/** Every form name the tree's form sources resolve to. */
function collectFormNames(
  nodes: readonly unknown[],
  routeParams: Readonly<Record<string, string>>
): readonly string[] {
  return nodes.flatMap((node) => {
    if (typeof node !== 'object' || node === null) return []
    const source = formSourceOf(node as Record<string, unknown>)
    const own = source === undefined ? [] : [formNameOf(source, routeParams)]
    return [...own, ...collectFormNames(childrenOf(node), routeParams)]
  })
}

/** Map an array of nodes, deriving each form source and recursing. */
function mapNodes(nodes: readonly unknown[], ctx: FormResolutionContext): readonly unknown[] {
  return nodes.map((node) => {
    if (typeof node !== 'object' || node === null) return node
    const resolved = resolveFormColumns(node as Record<string, unknown>, ctx)
    const children = childrenOf(resolved)
    return children.length === 0 ? resolved : { ...resolved, children: mapNodes(children, ctx) }
  })
}

/** Consume one node's `columnsFrom: { form }`, appending the answer columns when visible. */
function resolveFormColumns(
  node: Record<string, unknown>,
  ctx: FormResolutionContext
): Record<string, unknown> {
  const source = formSourceOf(node)
  if (source === undefined) return node
  const { columnsFrom: _consumed, ...rest } = node
  if (!ctx.answersVisible) return rest

  const name = formNameOf(source, ctx.routeParams)
  const form = (ctx.app.forms ?? []).find((declared) => declared.name === name)
  if (form === undefined) return rest
  const answers = formAnswerColumns(form, ctx.app.tables ?? [], (text) =>
    resolveTranslationPattern(text, ctx.lang, ctx.app.languages)
  )
  const authored = Array.isArray(rest['columns']) ? (rest['columns'] as readonly unknown[]) : []
  return answers.length === 0 && authored.length === 0
    ? rest
    : { ...rest, columns: [...authored, ...answers] }
}
