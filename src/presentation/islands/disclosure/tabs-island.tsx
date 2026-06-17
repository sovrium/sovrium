/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Tabs } from '@base-ui/react/tabs'
import { cn } from '@/presentation/islands/lib/cn'
import {
  computeTabClasses,
  computeTabIndicatorClasses,
  computeTabPanelClasses,
  computeTabsListClasses,
} from './disclosure-default-classes'
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
      <Tabs.List className={computeTabsListClasses({ orientation: tabsOrientation })}>
        {items.map((tab) => (
          <Tabs.Tab
            key={tab.id}
            value={tab.id}
            disabled={tab.disabled}
            className={computeTabClasses()}
          >
            {tab.label}
          </Tabs.Tab>
        ))}
        <Tabs.Indicator className={computeTabIndicatorClasses()} />
      </Tabs.List>

      {items.map((tab) => (
        <Tabs.Panel
          key={tab.id}
          value={tab.id}
          className={computeTabPanelClasses()}
          dangerouslySetInnerHTML={{ __html: tab.content }}
        />
      ))}
    </Tabs.Root>
  )
}
