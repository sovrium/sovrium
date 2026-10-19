/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { lazy, Suspense, useCallback, useRef, useState } from 'react'
import { usableLocale } from '@/domain/kernel/format/usable-locale'
import { resolvePageLocale } from '../runtime/page-locale'
import type { ChatLabels, ChatUsage } from './types'
import type { KeyboardEvent, ReactElement } from 'react'

/** The count's hover card, from the chunk the citation's card already loads. */
const UsageCard = lazy(() =>
  import('./citation-card').then((module) => ({ default: module.UsageCard }))
)

/** How long the card stays once the pointer leaves the count, to let it reach the card. */
const CLOSE_DELAY_MS = 200

/** The count's card: opened where the pointer rests or the keyboard lands, closed on leave, blur and Escape. */
const useUsageCard = () => {
  const [anchor, setAnchor] = useState<Element | undefined>(undefined)
  const timer = useRef<number | undefined>(undefined)
  const stay = useCallback(() => window.clearTimeout(timer.current), [])
  const close = useCallback(() => {
    window.clearTimeout(timer.current)
    setAnchor(undefined)
  }, [])
  const open = useCallback(
    (event: { readonly currentTarget: Element }) => {
      stay()
      setAnchor(event.currentTarget)
    },
    [stay]
  )
  const leave = useCallback(() => {
    timer.current = window.setTimeout(() => setAnchor(undefined), CLOSE_DELAY_MS)
  }, [])
  const escape = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    },
    [close]
  )
  return {
    anchor,
    stay,
    close,
    handlers: {
      onPointerEnter: open,
      onFocus: open,
      onPointerLeave: leave,
      onBlur: close,
      onKeyDown: escape,
    },
  }
}

/**
 * The line ending an answer of a chat that shows usage: the tokens the turn
 * used, as a count in the page language and never a share of the model's
 * window, which the runtime does not know. Resting on it, or tabbing to it,
 * opens a hover card splitting the count into input and output tokens.
 */
export function UsageMeter({
  usage,
  labels,
}: {
  readonly usage: ChatUsage
  readonly labels: Pick<ChatLabels, 'usageTotal' | 'usageInput' | 'usageOutput'>
}): ReactElement {
  const { anchor, stay, close, handlers } = useUsageCard()
  const formatter = new Intl.NumberFormat(usableLocale(resolvePageLocale()))
  const count = (label: string, value: number): string =>
    label.replace('{count}', formatter.format(value))
  return (
    <>
      <span
        data-testid="chat-usage"
        tabIndex={0}
        {...handlers}
        className="text-muted-foreground w-fit text-xs tabular-nums"
      >
        {count(labels.usageTotal, usage.totalTokens)}
      </span>
      {anchor !== undefined && (
        <Suspense fallback={null}>
          <UsageCard
            anchor={anchor}
            input={count(labels.usageInput, usage.inputTokens)}
            output={count(labels.usageOutput, usage.outputTokens)}
            onClose={close}
            onStay={stay}
          />
        </Suspense>
      )}
    </>
  )
}
