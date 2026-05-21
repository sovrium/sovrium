/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Accordion } from '@base-ui/react/accordion'
import { useMemo } from 'react'
import { cn } from '@/presentation/islands/lib/cn'
import type { ReactElement } from 'react'

interface AccordionItem {
  readonly id: string
  readonly title: string
  readonly content: string
}

interface AccordionIslandProps {
  readonly items?: readonly AccordionItem[]
  readonly accordionType?: 'single' | 'multiple'
  readonly defaultOpen?: readonly string[]
  readonly className?: string
  readonly id?: string
  readonly 'data-testid'?: string
}

export default function AccordionIsland({
  items = [],
  accordionType = 'single',
  defaultOpen,
  className,
  id,
  'data-testid': testId,
}: AccordionIslandProps): ReactElement {
  const defaultValue = useMemo(() => (defaultOpen ? [...defaultOpen] : undefined), [defaultOpen])
  return (
    <Accordion.Root
      defaultValue={defaultValue}
      multiple={accordionType === 'multiple'}
      className={cn('divide-border border-border divide-y rounded-lg border', className)}
      id={id}
      data-testid={testId}
    >
      {items.map((item) => (
        <Accordion.Item
          key={item.id}
          value={item.id}
        >
          <Accordion.Header>
            <Accordion.Trigger className="text-fg hover:bg-bg-subtle flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium transition-colors data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50">
              {item.title}
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                className="text-fg-muted shrink-0 transition-transform duration-200 data-[open]:rotate-180"
              >
                <path
                  d="M4 6L8 10L12 6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel className="text-fg-muted overflow-hidden px-4 pb-3 text-sm">
            {item.content}
          </Accordion.Panel>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  )
}
