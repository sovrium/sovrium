/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { type ButtonVariant } from '../../renderers/element-renderers/button-default-classes'
import {
  computeIconClasses,
  computeLinkClasses,
  type IconSize,
  type IconTone,
  type LinkVariant,
} from '../../renderers/element-renderers/interactive-content-default-classes'

const BTN_CLASS_TO_VARIANT: Record<string, ButtonVariant> = {
  'btn-primary': 'default',
  'btn-destructive': 'destructive',
  'btn-outline': 'outline',
  'btn-secondary': 'secondary',
  'btn-ghost': 'ghost',
  'btn-link': 'link',
  'btn-fab': 'fab',
}

export const variantFromButtonClassName = (
  authorClassName: string | undefined
): ButtonVariant | undefined => {
  if (!authorClassName) return undefined
  return authorClassName
    .split(/\s+/)
    .map((token) => BTN_CLASS_TO_VARIANT[token])
    .find((variant) => variant !== undefined)
}

const LINK_VARIANTS = new Set<LinkVariant>(['default', 'subtle', 'destructive'])
const ICON_SIZES = new Set<IconSize>(['sm', 'md', 'lg', 'xl'])
const ICON_TONES = new Set<IconTone>(['default', 'muted', 'primary'])

export const mergePrestyle = (defaults: string, authorClassName: string | undefined): string =>
  authorClassName ? `${defaults} ${authorClassName}` : defaults

export const buildLinkClassName = (
  componentRaw: Record<string, unknown>,
  authorClassName: string | undefined
): string => {
  const rawVariant = componentRaw['variant']
  const variant = LINK_VARIANTS.has(rawVariant as LinkVariant)
    ? (rawVariant as LinkVariant)
    : undefined
  return mergePrestyle(computeLinkClasses(variant ? { variant } : {}), authorClassName)
}

export const buildIconClassName = (
  componentRaw: Record<string, unknown>,
  authorClassName: string | undefined
): string => {
  const rawSize = componentRaw['iconSize']
  const rawTone = componentRaw['tone']
  const size = ICON_SIZES.has(rawSize as IconSize) ? (rawSize as IconSize) : undefined
  const tone = ICON_TONES.has(rawTone as IconTone) ? (rawTone as IconTone) : undefined
  return mergePrestyle(
    computeIconClasses({ ...(size ? { size } : {}), ...(tone ? { tone } : {}) }),
    authorClassName
  )
}
