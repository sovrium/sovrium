/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import * as LucideIcons from 'lucide-react'
import { type ReactElement } from 'react'
import type { ElementProps } from './html-element-renderer'

function kebabToPascalCase(name: string): string {
  return name
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('')
}

function resolveLucideIcon(
  iconName: string | undefined
): React.ComponentType<Record<string, unknown>> | undefined {
  if (!iconName) return undefined
  const component = (LucideIcons as Record<string, unknown>)[kebabToPascalCase(iconName)]
  if (typeof component === 'function')
    return component as React.ComponentType<Record<string, unknown>>
  if (typeof component === 'object' && component !== null)
    return component as React.ComponentType<Record<string, unknown>>
  return undefined
}

export function renderIcon(
  props: ElementProps,
  _children: readonly React.ReactNode[]
): ReactElement {
  const iconName = props.name as string | undefined
  const iconColor = props.color as string | undefined
  const iconSize = props.size as number | undefined
  const iconStrokeWidth = props.strokeWidth as number | undefined
  const ariaLabel = props.ariaLabel as string | undefined

  const {
    name: _name,
    color: _color,
    size: _size,
    strokeWidth: _strokeWidth,
    ariaLabel: _ariaLabel,
    'data-color': _dataColor,
    'data-size': _dataSize,
    'data-stroke-width': _dataStrokeWidth,
    'data-aria-label': _dataAriaLabel,
    ...restProps
  } = props as Record<string, unknown>

  const testId = iconName ? `icon-${iconName}` : 'icon'
  const colorProps = iconColor !== undefined ? { 'data-color': iconColor } : {}
  const a11yProps = ariaLabel
    ? { role: 'img' as const, 'aria-label': ariaLabel }
    : { 'aria-hidden': 'true' as const }

  const LucideIcon = resolveLucideIcon(iconName)

  if (LucideIcon) {
    return (
      <LucideIcon
        {...restProps}
        {...a11yProps}
        {...colorProps}
        size={iconSize ?? 24}
        color={iconColor ?? 'currentColor'}
        strokeWidth={iconStrokeWidth ?? 2}
        data-testid={testId}
      />
    ) as ReactElement
  }

  return (
    <svg
      {...(restProps as React.SVGProps<SVGSVGElement>)}
      {...a11yProps}
      {...colorProps}
      data-testid={testId}
      xmlns="http://www.w3.org/2000/svg"
      width={iconSize ?? 24}
      height={iconSize ?? 24}
    />
  )
}
