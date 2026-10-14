/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  computeDividerLabelTextClasses,
  computeDividerLabelWrapperClasses,
  computeDividerRuleClasses,
  computeVerticalDividerRuleClasses,
} from '../../design/layout-default-classes'
import { omitInternalMarkers } from '../props/internal-marker-props'
import { mergePrestyle } from './interactive-prestyle-builders'
import type { ComponentRenderer } from './component-dispatch-config'
import type { CSSProperties } from 'react'

/** A top-level string field, or a `props` one written the older way. */
const readText = (
  component: unknown,
  elementProps: Readonly<Record<string, unknown>>,
  key: string
): string | undefined => {
  const top = (component as Readonly<Record<string, unknown>> | undefined)?.[key]
  const value = top ?? elementProps[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

/**
 * `separator` — shadcn/ui's Separator: a rule between sections, prestyled with
 * the border tone. `orientation: vertical` draws it up and down between the
 * items of a row, stretched to the row's height; `label` sets text into the
 * middle of a horizontal rule, as shadcn's FieldSeparator draws "Or continue
 * with". `props.style` (`solid` | `dashed` | `dotted`) is an inline
 * `border-style`, since a schema literal does not go through the token cascade.
 */
export const separatorComponent: ComponentRenderer = ({ elementProps, component }) => {
  const { style } = elementProps
  const borderStyle = style === 'dashed' || style === 'dotted' ? style : 'solid'
  const authorClassName = elementProps['className'] as string | undefined
  const orientation = readText(component, elementProps, 'orientation')
  const label = readText(component, elementProps, 'label')
  const attributes = omitInternalMarkers(elementProps)
  // The placeholder floor the props builder stamps, when `props.style` is not the line style.
  const floor = typeof style === 'object' ? (style as CSSProperties) : undefined
  if (orientation === 'vertical') {
    return (
      <div
        {...attributes}
        role="separator"
        aria-orientation="vertical"
        data-slot="separator"
        data-orientation="vertical"
        className={mergePrestyle(computeVerticalDividerRuleClasses(), authorClassName)}
        style={{ ...floor, borderStyle }}
      />
    )
  }
  if (label !== undefined) {
    // The two rules are drawing only: the wrapper is the one separator, named by its label.
    const ruleClassName = `flex-1 ${computeDividerRuleClasses()}`
    return (
      <div
        {...attributes}
        role="separator"
        aria-orientation="horizontal"
        aria-label={label}
        data-slot="separator"
        data-orientation="horizontal"
        className={mergePrestyle(computeDividerLabelWrapperClasses(), authorClassName)}
        style={floor}
      >
        <hr
          aria-hidden="true"
          className={ruleClassName}
          style={{ borderStyle }}
        />
        <span className={computeDividerLabelTextClasses()}>{label}</span>
        <hr
          aria-hidden="true"
          className={ruleClassName}
          style={{ borderStyle }}
        />
      </div>
    )
  }
  return (
    <hr
      {...attributes}
      aria-orientation="horizontal"
      data-slot="separator"
      data-orientation="horizontal"
      className={mergePrestyle(computeDividerRuleClasses(), authorClassName)}
      style={{ ...floor, borderStyle }}
    />
  )
}
