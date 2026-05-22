/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Tabs } from '@base-ui/react/tabs'
import { cn } from '@/presentation/islands/lib/cn'
import type { ReactElement } from 'react'

interface TabItem {
  readonly id: string
  readonly label: string
  readonly content: string
  readonly disabled?: boolean
}

interface TabsIslandProps {
  readonly items?: readonly TabItem[]
  readonly defaultTab?: string
  readonly tabsOrientation?: 'horizontal' | 'vertical'
  readonly className?: string
  readonly id?: string
  readonly 'data-testid'?: string
}

export default function TabsIsland({
  items = [],
  defaultTab,
  tabsOrientation = 'horizontal',
  className,
  id,
  'data-testid': testId,
}: TabsIslandProps): ReactElement {
  const defaultValue = defaultTab ?? items[0]?.id

  return (
    <Tabs.Root
      defaultValue={defaultValue}
      orientation={tabsOrientation}
      className={cn(className)}
      id={id}
      data-testid={testId}
    >
      <Tabs.List
        className={`flex ${
          tabsOrientation === 'vertical'
            ? 'border-border flex-col border-r'
            : 'border-border border-b'
        }`}
      >
        {items.map((tab) => (
          <Tabs.Tab
            key={tab.id}
            value={tab.id}
            disabled={tab.disabled}
            className="text-foreground-muted hover:text-foreground data-[selected]:border-primary data-[selected]:text-primary px-4 py-2 text-sm font-medium transition-colors data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[selected]:border-b-2"
          >
            {tab.label}
          </Tabs.Tab>
        ))}
        <Tabs.Indicator className="bg-primary absolute bottom-0 h-0.5 transition-all duration-200" />
      </Tabs.List>

      {items.map((tab) => (
        <Tabs.Panel
          key={tab.id}
          value={tab.id}
          className="text-foreground p-4 text-sm"
        >
          {tab.content}
        </Tabs.Panel>
      ))}
    </Tabs.Root>
  )
}
