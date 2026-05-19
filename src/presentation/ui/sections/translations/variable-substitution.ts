/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { toKebabCase } from '@/presentation/utils/string-utils'
import type { Component } from '@/domain/models/app/pages/components'

function resolveDotPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, part) => {
    if (current === null || typeof current !== 'object') return undefined
    return (current as Record<string, unknown>)[part]
  }, obj)
}

function replaceVariables(value: string, vars: Record<string, unknown>): string {
  const withDefaults = value.replace(
    /\$([a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z][a-zA-Z0-9]*)*)\s*\|\s*default:\s*['"]([^'"]*)['"]/g,
    (_, varPath, defaultValue) => {
      const resolved = resolveDotPath(vars, varPath)
      if (resolved === undefined || resolved === null || typeof resolved === 'object') {
        return defaultValue
      }
      return String(resolved)
    }
  )

  return withDefaults.replace(
    /\$([a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z][a-zA-Z0-9]*)*)(?![a-zA-Z0-9_.])/g,
    (match, varPath) => {
      const resolved = resolveDotPath(vars, varPath)
      if (resolved === undefined || resolved === null || typeof resolved === 'object') {
        return match
      }
      return String(resolved)
    }
  )
}

export function substituteVariableValues(value: unknown, vars?: Record<string, unknown>): unknown {
  if (typeof value !== 'string') {
    return value
  }

  if (!vars || !value.includes('$')) {
    return value
  }

  return replaceVariables(value, vars)
}

export function substituteChildrenVariables(
  children: ReadonlyArray<Component | string> | undefined,
  vars?: Record<string, unknown>
): ReadonlyArray<Component | string> | undefined {
  if (!children || !vars) {
    return children
  }

  return children.map((child) => {
    if (typeof child === 'string') {
      const substituted = substituteVariableValues(child, vars)
      return substituted as string
    }

    const substitutedProps = substitutePropsVariables(child.props, vars)
    const substitutedChildren = substituteChildrenVariables(child.children, vars)
    const substitutedContent =
      typeof child.content === 'string'
        ? (substituteVariableValues(child.content, vars) as string)
        : child.content

    return {
      ...child,
      props: substitutedProps,
      children: substitutedChildren,
      content: substitutedContent,
    }
  })
}

function normalizeAriaDataProps(key: string): string {
  if (key.startsWith('aria') && key.length > 4 && key[4] !== undefined && /[A-Z]/.test(key[4])) {
    const suffix = key.slice(4)
    const kebabSuffix = toKebabCase(suffix)
    return `aria-${kebabSuffix}`
  }

  if (key.startsWith('data') && key.length > 4 && key[4] !== undefined && /[A-Z]/.test(key[4])) {
    const suffix = key.slice(4)
    const kebabSuffix = toKebabCase(suffix)
    return `data-${kebabSuffix}`
  }

  return key
}

export function substitutePropsVariables(
  props: Record<string, unknown> | undefined,
  vars?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!props || !vars) {
    return props
  }

  return Object.entries(props).reduce<Record<string, unknown>>((acc, [key, value]) => {
    const normalizedKey = normalizeAriaDataProps(key)

    if (typeof value === 'string') {
      return { ...acc, [normalizedKey]: replaceVariables(value, vars) }
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      return {
        ...acc,
        [normalizedKey]: substitutePropsVariables(value as Record<string, unknown>, vars),
      }
    } else {
      return { ...acc, [normalizedKey]: value }
    }
  }, {})
}
