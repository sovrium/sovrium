/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `signature-pad` SSR renderer — the well a signer signs in, or the reading of
 * a signature already given.
 *
 * Bound to a record (the page's, or a container's), the data-source pass hands
 * over the field's stored value, the record's id and its table. A signed field
 * is written once, so it draws only its reading — "Signed by … on …" with the
 * statement agreed to — and no well. An unsigned one mounts the pad island,
 * which posts the mark to the field's signing route with the page it is drawn
 * on and the digest of the statement it shows: the server resolves that
 * statement itself and authors the value it stores.
 */

import { fillPlaceholders } from '@/domain/kernel/format/placeholder-format'
import { resolveInterpreterString } from '@/domain/models/app/languages/translation-resolver'
import { statementDigest } from '@/domain/models/app/signatures/signature-capture-service'
import { cn } from '@/presentation/design/class-merge'
import {
  computeItemClasses,
  computeItemContentClasses,
  computeItemDescriptionClasses,
  computeItemMediaClasses,
  computeItemTitleClasses,
} from '@/presentation/design/item-default-classes'
import {
  SignatureSignedItem,
  type SignedItemClasses,
} from '@/presentation/design/signature-signed-item'
import { signingPadFactsOf } from '@/presentation/render/resolve/signing-context-resolver'
import { signingPageOf } from '@/presentation/render/resolve/signing-page-stamp'
import { signaturePadFlow } from './signature-pad-flow-component'
import type { ComponentRenderer } from './component-dispatch-config'
import type { Languages } from '@/domain/models/app/languages'
import type { ReactElement } from 'react'

interface PadRoot {
  readonly field?: string
  readonly statement?: string
  readonly height?: number
  readonly penWidth?: number
  readonly allowTyped?: boolean
}

interface StoredSignature {
  readonly signerName?: string
  readonly signedAt?: string
  readonly statement?: string
}

/** The stored signature, whether the driver hands it over parsed or as JSON text. */
function storedSignature(value: unknown): StoredSignature | undefined {
  const parsed = typeof value === 'string' && value.startsWith('{') ? safeParse(value) : value
  return typeof parsed === 'object' && parsed !== null ? (parsed as StoredSignature) : undefined
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
}

/** One of the pad's own words (`signaturePad.*`), in the page language. */
type PadWord = (key: string) => string

/** The day a signature was given, in the page's language. */
function signedOn(signedAt: string | undefined, lang: string | undefined, word: PadWord): string {
  const instant = signedAt === undefined ? Number.NaN : Date.parse(signedAt)
  if (Number.isNaN(instant)) return word('signaturePad.unknownDate')
  return new Intl.DateTimeFormat(lang ?? 'en-GB', { dateStyle: 'long', timeZone: 'UTC' }).format(
    instant
  )
}

/**
 * The classes of the signed reading's item parts: base-nova's outline item,
 * its icon media, and its title and description WITHOUT the line clamp an item
 * puts on them — a statement someone signed is never cut short. Resolved here,
 * once, for the island too: the outline row is a `tailwind-merge`, which an
 * island cannot afford to carry.
 */
const signedItemClasses = (className?: string): SignedItemClasses => ({
  row: cn(computeItemClasses({ variant: 'outline' }), className),
  media: computeItemMediaClasses({ variant: 'icon' }),
  content: computeItemContentClasses(),
  title: cn(computeItemTitleClasses(), 'line-clamp-none'),
  description: cn(computeItemDescriptionClasses(), 'line-clamp-none'),
})

/** The reading of a signature already given: one outlined item. */
function signedReading(
  signature: StoredSignature,
  ctx: {
    readonly lang: string | undefined
    readonly className: string | undefined
    readonly word: PadWord
  }
): ReactElement {
  return (
    <SignatureSignedItem
      title={fillPlaceholders(ctx.word('signaturePad.signedBy'), {
        name: signature.signerName ?? ctx.word('signaturePad.unknownSigner'),
        date: signedOn(signature.signedAt, ctx.lang, ctx.word),
      })}
      statement={signature.statement}
      classes={signedItemClasses(ctx.className)}
      attributes={{
        'data-component-type': 'signature-pad',
        'data-signature-state': 'signed',
      }}
    />
  )
}

/** The words the pad island draws, in the page language: all of them (it carries no English). */
const PAD_ISLAND_WORDS = [
  'well',
  'fullName',
  'clear',
  'typeInstead',
  'drawInstead',
  'sign',
  'signing',
  'saveFailed',
  'signedBy',
].map((key) => `signaturePad.${key}`)

const padWords = (lang: string | undefined, languages: Languages | undefined) =>
  Object.fromEntries(
    PAD_ISLAND_WORDS.map((key) => [key, resolveInterpreterString(key, lang, languages)])
  )

/** What the pad island needs to sign this record's field. */
function padIslandProps(ctx: {
  readonly root: PadRoot
  readonly rawProps: Record<string, unknown> | undefined
  readonly label: unknown
  readonly lang: string | undefined
  readonly languages: Languages | undefined
}): Readonly<Record<string, unknown>> {
  const { root, rawProps } = ctx
  const statement = root.statement ?? ''
  return {
    table: rawProps?.['_recordTable'],
    recordId: rawProps?.['_recordId'],
    field: root.field,
    page: signingPageOf(rawProps),
    statement,
    statementDigest: statementDigest(statement),
    height: root.height ?? 160,
    penWidth: root.penWidth ?? 2,
    allowTyped: root.allowTyped !== false,
    label:
      typeof ctx.label === 'string'
        ? ctx.label
        : resolveInterpreterString('signaturePad.label', ctx.lang, ctx.languages),
    lang: ctx.lang,
    signedClasses: signedItemClasses(),
    uiStrings: padWords(ctx.lang, ctx.languages),
  }
}

/** The pad's accessible name: the author's, else the pad's own word. */
const padLabel = (label: unknown, word: PadWord): string =>
  typeof label === 'string' ? label : word('signaturePad.label')

export const signaturePadComponent: ComponentRenderer = ({
  component,
  rawProps,
  elementProps,
  currentLang,
  languages,
}) => {
  const root = (component ?? {}) as PadRoot
  const className = elementProps['className'] as string | undefined
  const word: PadWord = (key) => resolveInterpreterString(key, currentLang, languages)
  // On a flow's signing page the pad signs for the flow, as the session's signer.
  const flow = signingPadFactsOf(rawProps)
  const signature = storedSignature(
    flow === undefined ? rawProps?.['_recordValue'] : flow.signedValue
  )
  if (signature !== undefined || flow?.signerStatus === 'signed') {
    return signedReading(signature ?? {}, { lang: currentLang, className, word })
  }
  if (flow !== undefined) {
    return signaturePadFlow({
      ...{ facts: flow, root, lang: currentLang, languages, className },
      label: padLabel(elementProps['aria-label'], word),
      signedClasses: signedItemClasses(),
    })
  }
  const islandProps = padIslandProps({
    root,
    rawProps,
    label: elementProps['aria-label'],
    lang: currentLang,
    languages,
  })
  return (
    <div
      data-component-type="signature-pad"
      data-island="signature-pad"
      data-island-props={JSON.stringify(islandProps)}
      className={cn('flex flex-col gap-3', className)}
    >
      <p className="text-muted-foreground text-sm">{root.statement ?? ''}</p>
    </div>
  )
}
