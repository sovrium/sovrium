/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { toKebabCase } from '@/presentation/utils/string-utils'

export const RESERVED_PROPS = new Set([
  'className',
  'style',
  'children',
  'ref',
  'key',
  'id',
  'role',
  'title',
  'alt',
  'src',
  'href',
  'type',
  'value',
  'placeholder',
  'disabled',
  'checked',
  'selected',
  'multiple',
  'autoFocus',
  'autoComplete',
  'readOnly',
  'required',
  'maxLength',
  'minLength',
  'pattern',
  'name',
  'tabIndex',
  'aria-label',
  'aria-labelledby',
  'aria-describedby',
  'onClick',
  'onChange',
  'onSubmit',
  'onFocus',
  'onBlur',
  'onKeyDown',
  'onKeyUp',
  'onKeyPress',
  'onMouseEnter',
  'onMouseLeave',
  'level',
  'animation',
  'data-testid',
  'data-component',
  'data-type',
  'data-translation-key',
  'data-translations',
  'data-scroll-animation',
  'data-scroll-threshold',
  'data-scroll-delay',
  'data-scroll-duration',
  'data-scroll-once',
  'data-i18n-content',
])

function shouldSkipProp(key: string, _value: unknown): boolean {
  return RESERVED_PROPS.has(key) || key.startsWith('data-') || key.startsWith('aria-')
}

function valueToDataAttributeString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value.toString()
  }
  if (Array.isArray(value)) {
    return JSON.stringify(value)
  }
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value)
  }
  return undefined
}

function convertPropToDataAttribute(
  key: string,
  value: unknown
): readonly [string, string] | undefined {
  if (shouldSkipProp(key, value) || key === 'style') return undefined

  const stringValue = valueToDataAttributeString(value)
  return stringValue ? ([`data-${toKebabCase(key)}`, stringValue] as const) : undefined
}

export function convertCustomPropsToDataAttributes(
  props: Record<string, unknown> | undefined
): Record<string, string> {
  if (!props) return {}

  return Object.entries(props).reduce<Record<string, string>>((acc, [key, value]) => {
    const dataAttr = convertPropToDataAttribute(key, value)
    return dataAttr ? { ...acc, [dataAttr[0]]: dataAttr[1] } : acc
  }, {})
}

export function convertBadgeProps(elementProps: Record<string, unknown>): Record<string, unknown> {
  const standardHtmlAttrs = new Set([
    'className',
    'style',
    'id',
    'role',
    'data-testid',
    'data-component',
    'data-type',
    'data-translation-key',
    'data-translations',
  ])

  return Object.entries(elementProps).reduce<Record<string, unknown>>((acc, [key, value]) => {
    if (standardHtmlAttrs.has(key) || key.startsWith('data-') || key.startsWith('aria-')) {
      return { ...acc, [key]: value }
    }
    return { ...acc, [`data-${toKebabCase(key)}`]: value }
  }, {})
}
