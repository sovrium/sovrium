/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A flow's signing page: rendered only in the signing session its gate
 * admitted, with `$signing.*` resolved everywhere a string is, and every
 * `signature-pad` on it told it signs for the flow.
 *
 * A signing page asked for any other way — no session, a session for another
 * flow's page, a render the gate never saw — is not rendered at all
 * ({@link signingPageAdmitted}, asked before anything is resolved): the page
 * pipeline answers it as a missing page. So a signing page is never an
 * ordinary page, whoever asks.
 *
 * Runs before every other `$`-reference pass, so a resolved value is ordinary
 * text to the rest of the pipeline; a value written into markup is escaped,
 * and one that would read as markup is pinned to text
 * (`substituteTemplatesDeep`). `$signing.record` holds only the fields the
 * flow lists; any other `$signing.record.<field>` prints empty.
 */

import { mapStringsDeep } from '@/domain/kernel/config-parsing/map-strings-deep'
import {
  isSigningPageName,
  substituteSigningVars,
  type SigningPage,
} from '@/domain/models/app/signatures/signing-page-service'
import { substituteTemplatesDeep } from './html-template-values'
import { withAuthoredMetaCode } from './meta-code-bodies'
import type { DataSourceDb } from './data-source-contracts'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'

/** The prop a `signature-pad` on a signing page reads its flow mode from. */
export const SIGNING_FLOW_PROP = '_signingFlow'

/** What a pad in flow mode is handed: the frozen statement, the signer's state and the document. */
export interface SigningPadFacts {
  readonly statement: string
  /** The name the request was sent to her under. */
  readonly signerName: string
  readonly signerStatus: string
  readonly signedValue?: unknown
  readonly documentUrl: string
  readonly documentPages: number
  readonly requiredChannels: readonly string[]
  readonly verifiedChannels: readonly string[]
}

const padFactsOf = (signing: SigningPage): SigningPadFacts => {
  const { context } = signing
  return {
    ...{ statement: context.statement, signerName: context.signer.displayName },
    signerStatus: context.signer.status,
    ...(signing.signedValue === undefined ? {} : { signedValue: signing.signedValue }),
    ...{ documentUrl: context.document.url, documentPages: context.document.pages },
    requiredChannels: context.verification.required,
    verifiedChannels: context.verification.verified,
  }
}

/** `node` with every `signature-pad` in it handed `facts`, at any depth. */
const withPadFacts = (node: unknown, facts: SigningPadFacts): unknown => {
  if (Array.isArray(node)) return node.map((child: unknown) => withPadFacts(child, facts))
  if (node === null || typeof node !== 'object') return node
  const record = node as Readonly<Record<string, unknown>>
  const walked = Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, withPadFacts(value, facts)])
  )
  if (record['type'] !== 'signature-pad') return walked
  const props = (record['props'] ?? {}) as Readonly<Record<string, unknown>>
  return { ...walked, props: { ...props, [SIGNING_FLOW_PROP]: facts } }
}

/** The facts a pad was handed on a signing page, or `undefined` off one. */
export const signingPadFactsOf = (
  rawProps: Readonly<Record<string, unknown>> | undefined
): SigningPadFacts | undefined => rawProps?.[SIGNING_FLOW_PROP] as SigningPadFacts | undefined

/** `page` with `$signing` resolved from `signing`, and its pads told they sign for the flow. */
const filledPage = (page: Page, signing: SigningPage): Page => {
  const fill = (text: string, encode: ((value: string) => string) | undefined) =>
    substituteSigningVars(text, signing.context, encode)
  const components =
    page.components === undefined
      ? undefined
      : (withPadFacts(
          substituteTemplatesDeep(page.components, fill),
          padFactsOf(signing)
        ) as Page['components'])
  const meta =
    page.meta === undefined
      ? undefined
      : withAuthoredMetaCode(
          page.meta,
          mapStringsDeep(page.meta, (text) => fill(text, undefined)) as Page['meta']
        )
  return {
    ...page,
    ...(components === undefined ? {} : { components }),
    ...(meta === undefined ? {} : { meta }),
  }
}

/** The signing page its gate admitted this render, when `page` is a flow's signing page. */
const admittedFor = (page: Page, input: SigningInput): SigningPage | undefined => {
  const signing = input.db?.readSigningPage?.()
  const flow = input.app.signatures?.find((f) => f.name === signing?.context.request.flow)
  return flow?.surface.page === page.name ? signing : undefined
}

/** What the signing passes read: the app, and the render's readers. */
interface SigningInput {
  readonly app: App
  readonly db?: DataSourceDb | undefined
}

/**
 * Whether `page` may render: any page but a flow's signing page, and a signing
 * page only in the session its gate admitted. A signing page is never an
 * ordinary page, whoever asks.
 */
export const signingPageAdmitted = (page: Page, input: SigningInput): boolean =>
  !isSigningPageName(input.app, page.name) || admittedFor(page, input) !== undefined

/** Resolve a signing page in its session; any other page is returned as it was. */
export const resolvePageSigning = (page: Page, input: SigningInput): Page => {
  const signing = admittedFor(page, input)
  return signing === undefined ? page : filledPage(page, signing)
}
