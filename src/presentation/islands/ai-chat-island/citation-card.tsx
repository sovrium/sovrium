/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { PreviewCard } from '@base-ui/react/preview-card'
import {
  computeFloatingPositionerClasses,
  computeHoverCardContentClasses,
} from '../overlays/popover-default-classes'
import type { ChatCitation } from './types'
import type { ReactElement } from 'react'

/**
 * The hover card of a cited number (shadcn's Inline Citation, on Base UI's
 * PreviewCard): the source's label and the passage the answer drew on, so the
 * reader checks a claim without leaving the answer.
 *
 * Loaded lazily, the first time a reader rests on or tabs to a number: the
 * chat itself ships no floating-UI code. The number is server-rendered markup
 * inside the answer, not a React element, so the card is opened by the
 * answer's own listeners and anchored to the number it was opened from; it
 * never takes the focus, which stays on the number.
 */
export default function CitationCard({
  citation,
  anchor,
  onClose,
  onStay,
}: {
  readonly citation: ChatCitation
  /** The cited number the card opened from. */
  readonly anchor: Element
  readonly onClose: () => void
  /** The pointer reached the card: keep it open while it is there. */
  readonly onStay: () => void
}): ReactElement {
  return (
    <PreviewCard.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <PreviewCard.Portal>
        <PreviewCard.Positioner
          anchor={anchor}
          side="top"
          sideOffset={6}
          className={computeFloatingPositionerClasses()}
        >
          <PreviewCard.Popup
            data-slot="hover-card-content"
            onPointerEnter={onStay}
            onPointerLeave={onClose}
            className={computeHoverCardContentClasses()}
          >
            <p className="font-medium">{citation.label}</p>
            <p className="text-muted-foreground mt-1 line-clamp-6">{citation.excerpt}</p>
          </PreviewCard.Popup>
        </PreviewCard.Positioner>
      </PreviewCard.Portal>
    </PreviewCard.Root>
  )
}

/**
 * The hover card of an answer's token count: the count split into the tokens
 * the turn read and the tokens it wrote. It shares this chunk with the
 * citation's card, so a chat loads the floating-UI code once, and only when a
 * reader first rests on or tabs to the count. The lines arrive formatted.
 */
export function UsageCard({
  anchor,
  input,
  output,
  onClose,
  onStay,
}: {
  /** The count the card opened from. */
  readonly anchor: Element
  readonly input: string
  readonly output: string
  readonly onClose: () => void
  /** The pointer reached the card: keep it open while it is there. */
  readonly onStay: () => void
}): ReactElement {
  return (
    <PreviewCard.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <PreviewCard.Portal>
        <PreviewCard.Positioner
          anchor={anchor}
          side="top"
          sideOffset={6}
          className={computeFloatingPositionerClasses()}
        >
          <PreviewCard.Popup
            data-slot="hover-card-content"
            onPointerEnter={onStay}
            onPointerLeave={onClose}
            className={computeHoverCardContentClasses()}
          >
            <p>{input}</p>
            <p>{output}</p>
          </PreviewCard.Popup>
        </PreviewCard.Positioner>
      </PreviewCard.Portal>
    </PreviewCard.Root>
  )
}
