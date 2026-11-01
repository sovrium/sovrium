/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `page.invitation` — look up the invitation whose token is in the address,
 * once per render, and resolve `$invitation.*` everywhere a string is.
 *
 * A link that is not a live invitation (unknown, accepted, revoked or expired)
 * also loses its accept and decline forms: there is nothing to answer, and a
 * form that would only fail would tell a prober the page is for someone.
 * Runs before every other `$`-reference pass, so a resolved value is ordinary
 * text to the rest of the pipeline.
 *
 * A `visibility.condition` on `$invitation.*` is judged here too, while the
 * reference still names what it reads: a node whose condition fails is
 * removed, and one whose condition holds keeps no condition for the session
 * pass to misread (that pass only knows `$user.*`).
 */

import { mapStringsDeep } from '@/domain/kernel/config-parsing/map-strings-deep'
import { resolveTranslationPattern } from '@/domain/models/app/languages/translation-resolver'
import { appLabelOf } from '@/domain/models/app/pages/app-vars'
import {
  invitationConditionHolds,
  invitationTemplateOf,
  invitationVarValues,
  substituteTranslatedInvitationVars,
  type InvitationFacts,
  type InvitationVarContext,
} from '@/domain/models/app/pages/invitation-vars-service'
import { parseSovriumTimezone } from '@/domain/models/process-env/timezone'
import { renderInstant } from '@/presentation/render/page/render-clock'
import { judgeConditionsDeep } from './condition-judging'
import { substituteTemplatesDeep, type ValueEncoder } from './html-template-values'
import { withAuthoredMetaCode } from './meta-code-bodies'
import type { DataSourceDb } from './data-source-contracts'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'

/** The auth methods that answer an invitation. */
const ANSWERING_METHODS: ReadonlySet<string> = new Set(['acceptInvitation', 'declineInvitation'])

/** Whether a node is a form answering the invitation. */
const answersInvitation = (node: unknown): boolean => {
  if (typeof node !== 'object' || node === null) return false
  const { action } = node as {
    readonly action?: { readonly type?: unknown; readonly method?: unknown }
  }
  return (
    action?.type === 'auth' &&
    typeof action.method === 'string' &&
    ANSWERING_METHODS.has(action.method)
  )
}

/** `nodes` less every form answering the invitation, at any depth. */
const withoutAnswers = (node: unknown): unknown => {
  if (Array.isArray(node))
    return node.filter((child) => !answersInvitation(child)).map(withoutAnswers)
  if (typeof node !== 'object' || node === null) return node
  const { children } = node as { readonly children?: unknown }
  return children === undefined ? node : { ...(node as object), children: withoutAnswers(children) }
}

/**
 * `node` with the declared query key stamped on every form answering the
 * invitation (`action._invitationParam`), at any depth: the accept and decline
 * requests read the token from the key the page declares, not only `token`.
 */
const withTokenParam = (node: unknown, param: string): unknown => {
  if (Array.isArray(node)) return node.map((child) => withTokenParam(child, param))
  if (typeof node !== 'object' || node === null) return node
  const { children, action } = node as { readonly children?: unknown; readonly action?: object }
  const stamped = answersInvitation(node)
    ? { ...(node as object), action: { ...action, _invitationParam: param } }
    : node
  return children === undefined
    ? stamped
    : { ...(stamped as object), children: withTokenParam(children, param) }
}

/** The invitation a token names, read once; none for an absent token or reader. */
const factsFor = async (
  input: { readonly db: DataSourceDb },
  token: string | undefined
): Promise<InvitationFacts | undefined> => {
  const read = input.db.readInvitation
  if (token === undefined || token === '' || read === undefined) return undefined
  return read(token).catch(() => undefined)
}

/**
 * How the page prints its invitation: the workspace as `$app.label` reads it,
 * the page's language (else the app's default, else English), and the
 * operator's zone (`SOVRIUM_TIMEZONE`, UTC by default).
 */
const varContextFor = (page: Page, app: App): InvitationVarContext => ({
  workspace: appLabelOf(app),
  roles: app,
  lang: page.meta?.lang ?? app.languages?.default ?? 'en',
  timeZone: parseSovriumTimezone(process.env).zoneId,
  now: renderInstant() ?? new Date(),
})

/** How one page's strings are filled: the substitution, and the template it fills into. */
interface InvitationFill {
  readonly substitute: (text: string, encode?: ValueEncoder) => string
  readonly templateOf: (text: string) => string
}

/**
 * The inviter chooses her own name: a template written as markup takes every
 * value escaped, and a text template whose value would read as markup is
 * pinned to text — `substituteTemplatesDeep`, decided on the template the
 * values land in (a `$t:` key's translation, when that is what is filled).
 */
const fillComponents = (components: unknown, fill: InvitationFill): Page['components'] =>
  substituteTemplatesDeep(components, fill.substitute, fill.templateOf) as Page['components']

/**
 * `meta` is text (title, description) or serialised safely (structured data),
 * so it is filled as written — except the code it declares, never filled.
 */
const fillMeta = (meta: Page['meta'], fill: InvitationFill): Page['meta'] =>
  withAuthoredMetaCode(meta, mapStringsDeep(meta, (text) => fill.substitute(text)) as Page['meta'])

/** Resolve one page's invitation; a page without `invitation` is returned as it was. */
export async function resolvePageInvitation(
  page: Page,
  input: {
    readonly app: App
    readonly db: DataSourceDb
    readonly requestQuery?: Readonly<Record<string, string>>
    /** The app a mount serves this page for, whose name `$invitation.workspace` prints. */
    readonly hostApp?: App
  }
): Promise<Page> {
  const { invitation } = page as { readonly invitation?: { readonly param?: string } }
  if (invitation === undefined) return page
  const param = invitation.param ?? 'token'
  const facts = await factsFor(input, input.requestQuery?.[param])
  // On a mount the workspace is the OPERATOR's app, never the console preset.
  const context = varContextFor(page, input.hostApp ?? input.app)
  const values = invitationVarValues(facts, context)
  // A `$t:` value naming an invitation reference is translated here, so it is filled too.
  const translate = (text: string) =>
    resolveTranslationPattern(text, context.lang, input.app.languages)
  const fill: InvitationFill = {
    substitute: (text, encode) =>
      substituteTranslatedInvitationVars(text, values, translate, encode),
    templateOf: (text) => invitationTemplateOf(text, translate),
  }
  const components =
    page.components === undefined
      ? undefined
      : fillComponents(
          judgeConditionsDeep(
            facts?.status === 'pending'
              ? withTokenParam(page.components, param)
              : withoutAnswers(page.components),
            (condition) => invitationConditionHolds(condition, values)
          ),
          fill
        )
  return {
    ...page,
    ...(components === undefined ? {} : { components }),
    ...(page.meta === undefined ? {} : { meta: fillMeta(page.meta, fill) }),
  }
}
