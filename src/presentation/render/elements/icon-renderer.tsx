/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { resolveLucideIcon } from '@/presentation/render/elements/lucide-resolver'
import type { ElementProps } from './html-element-renderer'

/**
 * Sovrium draws icons at stroke 1.5, where lucide's own default is 2.
 *
 * At the sizes an icon actually renders at, a 2px stroke reads heavier than the
 * type beside it and makes the glyph the loudest thing in a row of controls.
 * 1.5 puts the line weight on the same footing as the text, which is what the
 * reference drawings do — every inline SVG in them is `stroke-width: 1.5`.
 *
 * `strokeWidth` is not a schema field; it arrives through the open `props` bag,
 * so this is a rendering DEFAULT and an author who passes one still wins.
 */
const ICON_STROKE_WIDTH = 1.5

/**
 * Renders icon using Lucide React icons
 *
 * Props extracted from elementProps:
 * - name: kebab-case Lucide icon name (e.g. 'check-circle', 'arrow-right')
 * - color: SVG stroke color (default: 'currentColor')
 * - size: SVG width/height in pixels (default: 24)
 * - strokeWidth: SVG stroke-width (default: 1.5 — see ICON_STROKE_WIDTH)
 * - ariaLabel: accessible label; if provided, sets role="img" instead of aria-hidden
 * - className: CSS classes forwarded to the SVG
 *
 * Falls back to an empty SVG with data-testid for unknown icon names.
 */
export function renderIcon(
  props: ElementProps,
  _children: readonly React.ReactNode[]
): ReactElement {
  const iconName = props.name as string | undefined
  const iconColor = props.color as string | undefined
  const iconSize = props.size as number | undefined
  const iconStrokeWidth = props.strokeWidth as number | undefined
  const ariaLabel = props.ariaLabel as string | undefined

  // Build props to forward to the SVG — strip out icon-specific props and their data-* conversions
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
        strokeWidth={iconStrokeWidth ?? ICON_STROKE_WIDTH}
        data-testid={testId}
      />
    ) as ReactElement
  }

  // Fallback: render empty SVG placeholder for unknown icons
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
