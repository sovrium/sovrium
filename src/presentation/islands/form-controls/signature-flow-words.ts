/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What the pad in flow mode is handed, and how it reads its words: every word
 * and every class string arrives resolved by the server, so the island carries
 * no English and merges no class.
 */

import type { PadStrings } from './signature-pad-parts'
import type { SignedItemClasses } from '@/presentation/design/signature-signed-item'

/** The classes of the flow pad's parts, resolved by the server. */
export interface FlowClasses {
  readonly item: string
  readonly itemMedia: string
  readonly itemContent: string
  readonly itemTitle: string
  readonly itemDescription: string
  readonly field: string
  readonly label: string
  readonly input: string
  readonly textarea: string
}

/** The island's props, as the server renders them (`signature-pad-flow-component.tsx`). */
export interface FlowPadProps {
  readonly statement: string
  /** The name the request was sent to her under: the signed reading of a drawn signature. */
  readonly signerName: string
  readonly documentUrl: string
  readonly documentPages: number
  /** The channels still to verify, in the order they are asked. */
  readonly verify: readonly string[]
  readonly height: number
  readonly penWidth: number
  readonly allowTyped: boolean
  readonly label: string
  readonly lang?: string
  readonly classes: FlowClasses
  readonly signedClasses: SignedItemClasses
  readonly icons: { readonly document: unknown; readonly declined: unknown }
  readonly uiStrings: PadStrings
}

/** Where the pad stands. */
export type FlowPhase =
  | { readonly kind: 'sign' }
  | { readonly kind: 'decline' }
  | { readonly kind: 'signed'; readonly signerName: string; readonly signedAt: string }
  | { readonly kind: 'declined' }
  | { readonly kind: 'ended' }

/** One of the pad's words, `signaturePad.<key>`, with its `{placeholders}` filled; `''` when unknown. */
export const flowWord = (
  s: PadStrings,
  key: string,
  values: Readonly<Record<string, string>> = {}
): string =>
  Object.entries(values).reduce(
    (text, [name, value]) => text.replace(`{${name}}`, () => value),
    s[`signaturePad.${key}`] ?? ''
  )
