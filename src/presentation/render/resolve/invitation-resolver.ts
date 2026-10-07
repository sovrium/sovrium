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

import { mapStringsDeep } from '@/domain/models/app/languages/translation-resolver'
import {
  invitationConditionHolds,
  invitationVarValues,
  substituteInvitationVars,
  type InvitationCondition,
  type InvitationFacts,
} from '@/domain/models/app/pages/invitation-vars-service'
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

type InvitationValues = Parameters<typeof invitationConditionHolds>[1]

/** A visibility block with its `condition` removed, or `undefined` when nothing else is left. */
const withoutCondition = (visibility: object): object | undefined => {
  const { condition: _judged, ...rest } = visibility as { readonly condition?: unknown }
  return Object.keys(rest).length === 0 ? undefined : rest
}

/**
 * `node` judged on an `$invitation.*` condition: `undefined` when it fails, the
 * node less that condition when it holds, the node as it was otherwise. The
 * condition may sit at the root or under `props`, as everywhere else.
 */
const judgeCondition = (node: object, values: InvitationValues): object | undefined => {
  const { visibility, props } = node as {
    readonly visibility?: { readonly condition?: InvitationCondition }
    readonly props?: { readonly visibility?: { readonly condition?: InvitationCondition } }
  }
  const atRoot = visibility?.condition !== undefined
  const condition = atRoot ? visibility?.condition : props?.visibility?.condition
  const holds = condition === undefined ? undefined : invitationConditionHolds(condition, values)
  if (holds === undefined) return node
  if (!holds) return undefined
  if (atRoot) return { ...node, visibility: withoutCondition(visibility!) }
  return { ...node, props: { ...props, visibility: withoutCondition(props!.visibility!) } }
}

/** `node` with every `$invitation.*` condition judged, at any depth. */
const withConditionsJudged = (node: unknown, values: InvitationValues): unknown => {
  if (Array.isArray(node))
    return node.flatMap((child) => {
      const judged = withConditionsJudged(child, values)
      return judged === undefined ? [] : [judged]
    })
  if (typeof node !== 'object' || node === null) return node
  const judged = judgeCondition(node, values)
  if (judged === undefined) return undefined
  const { children } = judged as { readonly children?: unknown }
  return children === undefined
    ? judged
    : { ...judged, children: withConditionsJudged(children, values) }
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

/** Resolve one page's invitation; a page without `invitation` is returned as it was. */
export async function resolvePageInvitation(
  page: Page,
  input: {
    readonly app: App
    readonly db: DataSourceDb
    readonly requestQuery?: Readonly<Record<string, string>>
  }
): Promise<Page> {
  const { invitation } = page as { readonly invitation?: { readonly param?: string } }
  if (invitation === undefined) return page
  const param = invitation.param ?? 'token'
  const facts = await factsFor(input, input.requestQuery?.[param])
  const values = invitationVarValues(facts, input.app.name)
  const substitute = (text: string) => substituteInvitationVars(text, values)
  const components =
    page.components === undefined
      ? undefined
      : (mapStringsDeep(
          withConditionsJudged(
            facts?.status === 'pending'
              ? withTokenParam(page.components, param)
              : withoutAnswers(page.components),
            values
          ),
          substitute
        ) as Page['components'])
  return {
    ...page,
    ...(components === undefined ? {} : { components }),
    ...(page.meta === undefined
      ? {}
      : { meta: mapStringsDeep(page.meta, substitute) as Page['meta'] }),
  }
}
