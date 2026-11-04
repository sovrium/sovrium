/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The pieces of the pad in flow mode that hold no state: the document row,
 * the code step and the declined reading (its actions are
 * `signature-pad-flow-actions.tsx`). Every word and every class arrives resolved
 * by the server; the well and the typed name are the inline pad's own
 * (`SignatureInput`).
 */

import { toSafeAssetUrl } from '@/domain/kernel/url/asset-url-safety'
import { computePartButtonClasses } from '@/presentation/design/button-variant-classes'
import { LucideGlyph } from '@/presentation/design/lucide-glyph'
import { pendingControlProps } from '@/presentation/design/pending-state'
import { flowWord, type FlowClasses } from './signature-flow-words'
import type { PadStrings } from './signature-pad-parts'
import type { SignedItemClasses } from '@/presentation/design/signature-signed-item'
import type { ReactElement } from 'react'

const GHOST = computePartButtonClasses({ variant: 'ghost', size: 'sm' })
const OUTLINE = computePartButtonClasses({ variant: 'outline', size: 'sm' })

/**
 * A Lucide icon drawn from the geometry the server handed over, through the one
 * shared renderer every island uses. Validating the geometry here instead, with a
 * direct import of `lucide-icon-node`, made Bun emit that module as a chunk of its
 * own and added a request to every island that draws an icon (Island Payload
 * Budget, chunk counts). Stroke 2 is kept from the pad's first drawing.
 */
function FlowIcon({ node }: { readonly node: unknown }): ReactElement | null {
  return (
    <LucideGlyph
      iconNode={node}
      strokeWidth={2}
      aria-hidden="true"
    />
  )
}

/** The frozen document, as an outlined item: open it, and how long it is. */
export function DocumentRow(props: {
  readonly url: string
  readonly pages: number
  readonly icon: unknown
  readonly classes: FlowClasses
  readonly strings: PadStrings
}): ReactElement | null {
  const href = toSafeAssetUrl(props.url)
  if (href === undefined) return null
  const { classes: c, strings: s } = props
  const length =
    props.pages === 1
      ? flowWord(s, 'documentPage')
      : flowWord(s, 'documentPages', { count: String(props.pages) })
  return (
    <div
      data-slot="item"
      data-variant="outline"
      className={c.item}
    >
      <div
        data-slot="item-media"
        data-variant="icon"
        className={c.itemMedia}
      >
        <FlowIcon node={props.icon} />
      </div>
      <div
        data-slot="item-content"
        className={c.itemContent}
      >
        <div
          data-slot="item-title"
          className={c.itemTitle}
        >
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={OUTLINE}
          >
            {flowWord(s, 'openDocument')}
          </a>
        </div>
        <p
          data-slot="item-description"
          className={c.itemDescription}
        >
          {length}
        </p>
      </div>
    </div>
  )
}

/** What the code step needs: the channel, the code typed, and the request in flight. */
interface VerifyProps {
  readonly channel: string
  readonly destination: string | undefined
  readonly code: string
  readonly setCode: (code: string) => void
  readonly sending: boolean
  readonly secondsLeft: number
  readonly onSend: () => void
  readonly classes: FlowClasses
  readonly strings: PadStrings
}

/** The code sent to `destination`, six digits, and a new code once the wait is over. */
function CodeField(props: VerifyProps & { readonly destination: string }): ReactElement {
  const { classes: c, strings: s } = props
  const waiting = props.secondsLeft > 0
  return (
    <div
      data-slot="field"
      className={c.field}
    >
      <label
        htmlFor="signature-pad-code"
        data-slot="field-label"
        className={c.label}
      >
        {flowWord(s, 'codeLabel', { destination: props.destination })}
      </label>
      <input
        id="signature-pad-code"
        data-slot="input"
        className={c.input}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={props.code}
        onChange={(event) => props.setCode(event.target.value.replace(/\D/g, ''))}
      />
      <button
        type="button"
        data-slot="button"
        className={GHOST}
        disabled={waiting || props.sending}
        onClick={props.onSend}
      >
        {waiting
          ? flowWord(s, 'resendIn', { seconds: String(props.secondsLeft) })
          : flowWord(s, 'resendCode')}
      </button>
    </div>
  )
}

/** The code step: ask for a code, then type it; a new one only once the wait is over. */
export function VerifyBlock(props: VerifyProps): ReactElement {
  const s = props.strings
  return (
    <div
      data-slot="signature-pad-verify"
      className="flex flex-col gap-3"
    >
      <p className="text-muted-foreground text-sm">
        {flowWord(s, props.channel === 'sms' ? 'verifySms' : 'verifyEmail')}
      </p>
      {props.destination === undefined ? (
        <button
          type="button"
          data-slot="button"
          className={OUTLINE}
          {...pendingControlProps(props.sending)}
          onClick={props.sending ? undefined : props.onSend}
        >
          {flowWord(s, props.sending ? 'sendingCode' : 'sendCode')}
        </button>
      ) : (
        <CodeField
          {...props}
          destination={props.destination}
        />
      )}
    </div>
  )
}

/** Her answer once she declined: the signed reading's anatomy, its own state. */
export function DeclinedReading(props: {
  readonly icon: unknown
  readonly classes: SignedItemClasses
  readonly strings: PadStrings
}): ReactElement {
  const { classes: c } = props
  return (
    <div
      role="status"
      data-slot="signature-pad-signed"
      data-signature-state="declined"
      data-variant="outline"
      className={c.row}
    >
      <div
        data-slot="item-media"
        data-variant="icon"
        className={c.media}
      >
        <FlowIcon node={props.icon} />
      </div>
      <div
        data-slot="item-content"
        className={c.content}
      >
        <div
          data-slot="item-title"
          className={c.title}
        >
          {flowWord(props.strings, 'declined')}
        </div>
      </div>
    </div>
  )
}
