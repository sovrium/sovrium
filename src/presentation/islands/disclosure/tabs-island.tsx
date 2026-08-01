/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Tabs } from '@base-ui/react/tabs'
import { useCallback, useEffect, useId, useRef, type ReactElement } from 'react'
import { cn } from '@/presentation/utils/design/class-merge'
import {
  computeTabClasses,
  computeTabDescriptionClasses,
  computeTabIndicatorClasses,
  computeTabLabelClasses,
  computeTabPanelClasses,
  computeTabsListClasses,
  computeTabsRootClasses,
} from './disclosure-default-classes'

interface TabItem {
  readonly id: string
  readonly label: string
  readonly content: string
  readonly disabled?: boolean
  readonly description?: string
}

function TabTrigger({
  tab,
  orientation,
  descriptionId,
}: {
  readonly tab: TabItem
  readonly orientation: 'horizontal' | 'vertical'
  readonly descriptionId: string
}): ReactElement {
  const described = tab.description !== undefined && tab.description.length > 0
  return (
    <Tabs.Tab
      value={tab.id}
      disabled={tab.disabled}
      className={computeTabClasses({ orientation })}
      aria-label={described ? tab.label : undefined}
      aria-describedby={described ? descriptionId : undefined}
    >
      {described ? (
        <>
          <span className={computeTabLabelClasses()}>{tab.label}</span>
          <span
            id={descriptionId}
            className={computeTabDescriptionClasses()}
          >
            {tab.description}
          </span>
        </>
      ) : (
        tab.label
      )}
    </Tabs.Tab>
  )
}

interface TabsIslandProps {
  readonly items?: readonly TabItem[]
  readonly defaultTab?: string
  readonly tabsOrientation?: 'horizontal' | 'vertical'
  readonly className?: string
  readonly id?: string
  readonly 'data-testid'?: string
  readonly ariaLabel?: string
}

function useNestedIslandMount(rootRef: React.RefObject<HTMLDivElement | null>): () => void {
  const scan = useCallback(() => {
    const root = rootRef.current
    if (!root) return
    void import('@/presentation/islands/island-client').then(({ mountIslandsWithin }) => {
      mountIslandsWithin(root)
    })
  }, [rootRef])
  useEffect(scan, [scan])
  return scan
}

function isHorizontalTabList(orientation: 'horizontal' | 'vertical'): 'true' | undefined {
  return orientation === 'horizontal' ? 'true' : undefined
}

export default function TabsIsland({
  items = [],
  defaultTab,
  tabsOrientation = 'horizontal',
  className,
  id,
  'data-testid': testId,
  ariaLabel,
}: TabsIslandProps): ReactElement {
  const defaultValue = defaultTab ?? items[0]?.id
  const rootRef = useRef<HTMLDivElement>(null)
  const rescanNestedIslands = useNestedIslandMount(rootRef)
  const uid = useId()

  return (
    <Tabs.Root
      ref={rootRef}
      defaultValue={defaultValue}
      orientation={tabsOrientation}
      className={cn(computeTabsRootClasses({ orientation: tabsOrientation }), className)}
      id={id}
      data-testid={testId}
      onValueChange={rescanNestedIslands}
    >
      <Tabs.List
        className={computeTabsListClasses({ orientation: tabsOrientation })}
        aria-label={ariaLabel}
        data-scrollable={isHorizontalTabList(tabsOrientation)}
      >
        {items.map((tab) => (
          <TabTrigger
            key={tab.id}
            tab={tab}
            orientation={tabsOrientation}
            descriptionId={`${uid}tab-description-${tab.id}`}
          />
        ))}
        <Tabs.Indicator className={computeTabIndicatorClasses()} />
      </Tabs.List>
      {items.map((tab) => (
        <Tabs.Panel
          key={tab.id}
          value={tab.id}
          className={computeTabPanelClasses({ orientation: tabsOrientation })}
          dangerouslySetInnerHTML={{ __html: tab.content }}
        />
      ))}
    </Tabs.Root>
  )
}
