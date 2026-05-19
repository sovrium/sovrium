/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Tabs } from '@base-ui/react/tabs'
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
      className={className}
      id={id}
      data-testid={testId}
    >
      <Tabs.List
        className={`flex ${
          tabsOrientation === 'vertical'
            ? 'flex-col border-r border-gray-200'
            : 'border-b border-gray-200'
        }`}
      >
        {items.map((tab) => (
          <Tabs.Tab
            key={tab.id}
            value={tab.id}
            disabled={tab.disabled}
            className="px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[selected]:border-b-2 data-[selected]:border-blue-600 data-[selected]:text-blue-600"
          >
            {tab.label}
          </Tabs.Tab>
        ))}
        <Tabs.Indicator className="absolute bottom-0 h-0.5 bg-blue-600 transition-all duration-200" />
      </Tabs.List>

      {items.map((tab) => (
        <Tabs.Panel
          key={tab.id}
          value={tab.id}
          className="p-4 text-sm text-gray-700"
        >
          {tab.content}
        </Tabs.Panel>
      ))}
    </Tabs.Root>
  )
}
