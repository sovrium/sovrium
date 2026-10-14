/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveLucideIcon } from '../elements/lucide-resolver'
import type { ReactElement } from 'react'

const ICON_SIZES: ReadonlySet<string> = new Set(['icon', 'icon-xs', 'icon-sm', 'icon-lg'])

/** The button's props, children and whether it is icon-only, once its size and icon are applied. */
export interface SizedButton {
  readonly props: Record<string, unknown>
  readonly children: readonly ReactElement[]
  readonly iconOnly: boolean
}

/** The label as the visible text beside an icon. */
const labelText = (label: string | undefined): readonly ReactElement[] =>
  label === undefined ? [] : [<span key="button-label">{label}</span>]

/** The button's Lucide icon, decorative, or `undefined` when none is named or found. */
const iconOf = (name: unknown): ReactElement | undefined => {
  const Icon = resolveLucideIcon(typeof name === 'string' ? name : undefined)
  return Icon === undefined ? undefined : (
    <Icon
      key="button-icon"
      aria-hidden="true"
      data-icon="inline-start"
    />
  )
}

/**
 * A button's part named on the element as base-nova's `Button` names it —
 * `data-slot="button"`, `data-variant` and `data-size`, each `default` when the
 * config names none — and its `icon` drawn before the label. At an icon size the
 * icon is drawn alone and the `label` moves to `aria-label`, so the square
 * button is still named. An author's own `data-slot` wins, as a prop passed to
 * base-nova's `Button` does.
 */
export function withSizeAndIcon(
  component: Readonly<Record<string, unknown>>,
  props: Record<string, unknown>,
  children: readonly ReactElement[]
): SizedButton {
  const size = typeof component['size'] === 'string' ? component['size'] : 'default'
  const variant = typeof component['variant'] === 'string' ? component['variant'] : 'default'
  const part = { 'data-slot': 'button', 'data-variant': variant }
  const iconOnly = ICON_SIZES.has(size)
  const icon = iconOf(component['icon'])
  const label = typeof props['label'] === 'string' ? props['label'] : undefined
  if (iconOnly) {
    const { label: _label, ...rest } = props
    return {
      props: { ...part, ...rest, 'data-size': size, 'aria-label': props['aria-label'] ?? label },
      children: icon === undefined ? [] : [icon],
      iconOnly: true,
    }
  }
  if (icon === undefined)
    return { props: { ...part, ...props, 'data-size': size }, children, iconOnly: false }
  const text = children.length > 0 ? children : labelText(label)
  return {
    props: { ...part, ...props, 'data-size': size },
    children: [icon, ...text],
    iconOnly: false,
  }
}
