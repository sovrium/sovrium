/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A `signature-pad` on a flow's signing page: the pad in flow mode.
 *
 * It needs no record binding. It signs as the signer of the signing session
 * whatever `field` names, and it shows the statement frozen for her at send
 * whatever `statement` says, because the sentence shown must be the sentence
 * signed. Pressing Sign is the consent. It posts to the flow's sign road,
 * never to a field's signing route; it offers to decline; and when the flow
 * verifies a channel she has not yet verified, it asks for the code first.
 *
 * The island (`signature-pad-flow`) carries no English and no class merging:
 * every word is resolved here in the page language, every class string here.
 */

import { resolveInterpreterString } from '@/domain/models/app/languages/translation-resolver'
import { cn } from '@/presentation/design/class-merge'
import {
  computeFieldClasses,
  computeFieldLabelClasses,
} from '@/presentation/design/field-default-classes'
import {
  computeInputDefaultClasses,
  computeTextareaDefaultClasses,
} from '@/presentation/design/input-default-classes'
import {
  computeItemClasses,
  computeItemContentClasses,
  computeItemDescriptionClasses,
  computeItemMediaClasses,
  computeItemTitleClasses,
} from '@/presentation/design/item-default-classes'
import { resolveLucideIconNode } from '@/presentation/render/elements/lucide-resolver'
import type { Languages } from '@/domain/models/app/languages'
import type { SignedItemClasses } from '@/presentation/design/signature-signed-item'
import type { SigningPadFacts } from '@/presentation/render/resolve/signing-context-resolver'
import type { ReactElement } from 'react'

/** The island a pad in flow mode mounts. */
const FLOW_ISLAND = 'signature-pad-flow'

/** Every word the flow pad draws, resolved here: the inline pad's, and the flow's own. */
const FLOW_WORDS = [
  ...['well', 'fullName', 'clear', 'typeInstead', 'drawInstead', 'sign', 'signing'],
  ...['saveFailed', 'signedBy', 'openDocument', 'documentPages', 'documentPage', 'consentNote'],
  ...['declineOpen', 'declineReason', 'declineConfirm', 'declining', 'declineBack', 'declined'],
  ...['verifyEmail', 'verifySms', 'sendCode', 'sendingCode', 'codeLabel', 'resendCode'],
  ...['resendIn'],
  ...[
    'CONSENT_REQUIRED',
    'VERIFICATION_REQUIRED',
    'CODE_INVALID',
    'CODE_EXPIRED',
    'TOO_MANY_CODE_ATTEMPTS',
    'TOO_MANY_CODES_SENT',
    'RESEND_TOO_SOON',
    'IMAGE_INVALID',
    'STATEMENT_CHANGED',
    'NOT_YOUR_TURN',
    'NOT_FOUND',
  ].map((code) => `error.${code}`),
].map((key) => `signaturePad.${key}`)

/** The classes the flow pad's parts draw, resolved once, here. */
const flowClasses = () => ({
  item: computeItemClasses({ variant: 'outline' }),
  itemMedia: computeItemMediaClasses({ variant: 'icon' }),
  itemContent: computeItemContentClasses(),
  itemTitle: cn(computeItemTitleClasses(), 'line-clamp-none'),
  itemDescription: cn(computeItemDescriptionClasses(), 'line-clamp-none'),
  field: computeFieldClasses(),
  label: computeFieldLabelClasses(),
  input: computeInputDefaultClasses(),
  textarea: computeTextareaDefaultClasses(),
})

/** The flow pad's island props, from the facts its signing page handed it. */
const flowIslandProps = (ctx: {
  readonly facts: SigningPadFacts
  readonly root: {
    readonly height?: number
    readonly penWidth?: number
    readonly allowTyped?: boolean
  }
  readonly label: string
  readonly lang: string | undefined
  readonly languages: Languages | undefined
  readonly signedClasses: SignedItemClasses
}) => {
  const { facts, root } = ctx
  return {
    statement: facts.statement,
    signerName: facts.signerName,
    documentUrl: facts.documentUrl,
    documentPages: facts.documentPages,
    verify: facts.requiredChannels.filter((channel) => !facts.verifiedChannels.includes(channel)),
    height: root.height ?? 160,
    penWidth: root.penWidth ?? 2,
    allowTyped: root.allowTyped !== false,
    label: ctx.label,
    lang: ctx.lang,
    classes: flowClasses(),
    signedClasses: ctx.signedClasses,
    icons: {
      document: resolveLucideIconNode('file-text') ?? [],
      declined: resolveLucideIconNode('circle-x') ?? [],
    },
    uiStrings: Object.fromEntries(
      FLOW_WORDS.map((key) => [key, resolveInterpreterString(key, ctx.lang, ctx.languages)])
    ),
  }
}

/** The pad in flow mode: its frozen statement drawn now, the island mounted over it. */
export function signaturePadFlow(
  ctx: Parameters<typeof flowIslandProps>[0] & {
    readonly className: string | undefined
  }
): ReactElement {
  return (
    <div
      data-component-type="signature-pad"
      data-signing-mode="flow"
      data-island={FLOW_ISLAND}
      data-island-props={JSON.stringify(flowIslandProps(ctx))}
      className={cn('flex flex-col gap-4', ctx.className)}
    >
      <p className="text-foreground text-sm">{ctx.facts.statement}</p>
    </div>
  )
}
