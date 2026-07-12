/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { renderHTMLElement } from '../../renderers/element-renderers'
import type { ComponentRenderer } from '../component-dispatch-config'
import type { ReactElement } from 'react'

const DEFAULT_RATIO = 0.5

function resolveOrientation(
  rawProps: Record<string, unknown> | undefined
): 'horizontal' | 'vertical' {
  return rawProps?.['orientation'] === 'vertical' ? 'vertical' : 'horizontal'
}

function resolveRatio(rawProps: Record<string, unknown> | undefined): number {
  const raw = rawProps?.['defaultRatio']
  if (typeof raw === 'number' && raw > 0 && raw < 1) return raw
  return DEFAULT_RATIO
}

function resolveHostId(elementProps: Record<string, unknown>, fallback: string): string {
  const authored = elementProps['id']
  return typeof authored === 'string' && authored.length > 0 ? authored : fallback
}

interface SplitPaneViewModel {
  readonly hostId: string
  readonly orientation: 'horizontal' | 'vertical'
  readonly ratio: number
  readonly ariaLabel: string
  readonly separatorLabel: string
  readonly className?: string
  readonly testId?: string
  readonly firstPane: ReactElement | undefined
  readonly secondPane: ReactElement | undefined
  readonly islandPropsJson: string
}

function buildViewModel(
  rawProps: Record<string, unknown> | undefined,
  elementProps: Record<string, unknown>,
  renderedChildren: readonly ReactElement[]
): SplitPaneViewModel {
  const hostId = resolveHostId(elementProps, 'sv-split-pane')
  const orientation = resolveOrientation(rawProps)
  const ratio = resolveRatio(rawProps)
  const ariaLabel = (rawProps?.['aria-label'] as string | undefined) ?? 'Split pane'
  const separatorLabel = (rawProps?.['separatorLabel'] as string | undefined) ?? 'Resize panels'
  const islandProps = {
    hostId,
    orientation,
    minSize: rawProps?.['minSize'] as number | undefined,
    maxSize: rawProps?.['maxSize'] as number | undefined,
  }
  return {
    hostId,
    orientation,
    ratio,
    ariaLabel,
    separatorLabel,
    className: elementProps['className'] as string | undefined,
    testId: elementProps['data-testid'] as string | undefined,
    firstPane: renderedChildren[0],
    secondPane: renderedChildren[1],
    islandPropsJson: JSON.stringify(islandProps),
  }
}

const SECOND_PANE_STYLE: React.CSSProperties = {
  flex: '1 1 0%',
  minWidth: 0,
  minHeight: 0,
  overflow: 'auto',
}

const HIDDEN_STYLE: React.CSSProperties = { display: 'none' }

function firstPaneStyle(ratio: number): React.CSSProperties {
  return { flexBasis: `${Math.round(ratio * 100)}%`, flexGrow: 0, flexShrink: 0, overflow: 'auto' }
}

export const splitPaneComponent: ComponentRenderer = ({
  rawProps,
  elementProps,
  renderedChildren,
}) => {
  const vm = buildViewModel(rawProps, elementProps, renderedChildren)
  const flexDirection = vm.orientation === 'horizontal' ? 'flex-row' : 'flex-col'
  const dividerCursor = vm.orientation === 'horizontal' ? 'cursor-col-resize' : 'cursor-row-resize'
  const dividerSize = vm.orientation === 'horizontal' ? 'w-1.5 self-stretch' : 'h-1.5 w-full'
  const containerClass = ['flex', flexDirection, 'min-h-0', 'w-full', vm.className]
    .filter(Boolean)
    .join(' ')

  return renderHTMLElement({
    type: 'div',
    content: undefined,
    props: {
      id: vm.hostId,
      role: 'group',
      'aria-label': vm.ariaLabel,
      'aria-orientation': vm.orientation,
      'data-split-pane': vm.hostId,
      'data-testid': vm.testId,
      className: containerClass,
    },
    children: [
      <div
        key="first"
        data-split-pane-first
        style={firstPaneStyle(vm.ratio)}
      >
        {vm.firstPane}
      </div>,
      <div
        key="divider"
        role="separator"
        aria-label={vm.separatorLabel}
        aria-orientation={vm.orientation}
        data-split-pane-divider
        tabIndex={0}
        className={`bg-border hover:bg-primary/40 shrink-0 ${dividerSize} ${dividerCursor}`}
      />,
      <div
        key="second"
        data-split-pane-second
        style={SECOND_PANE_STYLE}
      >
        {vm.secondPane}
      </div>,
      <div
        key="enhancer"
        data-island="split-pane"
        data-island-props={vm.islandPropsJson}
        style={HIDDEN_STYLE}
      />,
    ],
  })
}
