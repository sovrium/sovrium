/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { toKebabCase } from '@/presentation/utils/string-utils'
import type { Component } from '@/domain/models/app/pages/components'

/**
 * Resolves a dot-notation path in an object
 *
 * Traverses nested objects using dot-separated path segments.
 * Returns undefined if any segment is missing or non-object.
 *
 * @param obj - The root object to traverse
 * @param path - Dot-separated path (e.g., 'user.name', 'a.b.c')
 * @returns The resolved value, or undefined if not found
 */
function resolveDotPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, part) => {
    if (current === null || typeof current !== 'object') return undefined
    return (current as Record<string, unknown>)[part]
  }, obj)
}

/**
 * Replaces variable placeholders in a string with actual values
 *
 * Uses regex with word boundary checking to avoid partial matches.
 * Supports dot notation for nested object access ($user.name).
 * For example, $icon will not match inside $iconColor.
 *
 * @param value - String that may contain $variable placeholders
 * @param vars - Variables for substitution (supports nested objects)
 * @returns String with all variables replaced
 *
 * @example
 * ```typescript
 * replaceVariables('$title', { title: 'Hello' })  // 'Hello'
 * replaceVariables('$price/month', { price: '49' })  // '49/month'
 * replaceVariables('box-$variant', { variant: 'primary' })  // 'box-primary'
 * replaceVariables('$user.name', { user: { name: 'Alice' } })  // 'Alice'
 * ```
 */
function replaceVariables(value: string, vars: Record<string, unknown>): string {
  // Step 1: Handle $varPath | default: 'value' or "value" patterns first (supports dot notation)
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

  // Step 2: Replace all $varPath references (supports dot notation)
  // Use negative lookahead to avoid partial matches (e.g., $icon won't match inside $iconColor)
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

/**
 * Substitutes variable values in a value
 *
 * Replaces `$variableName` patterns with actual variable values.
 * Supports both full replacement ($title → 'Welcome') and partial replacement
 * within strings ($price/month → '49/month').
 *
 * @param value - Value that may contain variable placeholders
 * @param vars - Variables for substitution
 * @returns Value with variables replaced
 *
 * @example
 * ```typescript
 * substituteVariableValues('$title', { title: 'Hello' }) // 'Hello'
 * substituteVariableValues('$price/month', { price: '49' }) // '49/month'
 * substituteVariableValues('static', { title: 'Hello' }) // 'static'
 * substituteVariableValues(123, { title: 'Hello' })       // 123
 * ```
 */
export function substituteVariableValues(value: unknown, vars?: Record<string, unknown>): unknown {
  if (typeof value !== 'string') {
    return value
  }

  if (!vars || !value.includes('$')) {
    return value
  }

  return replaceVariables(value, vars)
}

/**
 * Substitutes variables in component children recursively
 *
 * Pure function that walks through the children tree and replaces $variable
 * placeholders with actual values from the vars object.
 *
 * @param children - Array of children (can be strings or components)
 * @param vars - Variables for substitution
 * @returns Children with variables substituted
 *
 * @example
 * ```typescript
 * substituteChildrenVariables(
 *   [
 *     '$greeting',
 *     { type: 'span', content: '$name' }
 *   ],
 *   { greeting: 'Hello', name: 'World' }
 * )
 * // ['Hello', { type: 'span', content: 'World' }]
 * ```
 */
export function substituteChildrenVariables(
  children: ReadonlyArray<Component | string> | undefined,
  vars?: Record<string, unknown>
): ReadonlyArray<Component | string> | undefined {
  if (!children || !vars) {
    return children
  }

  return children.map((child) => {
    // If child is a string, apply variable substitution
    if (typeof child === 'string') {
      const substituted = substituteVariableValues(child, vars)
      return substituted as string
    }

    // If child is a component, recursively substitute in its props, children and content
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

/**
 * Converts camelCase prop names to kebab-case for HTML attributes
 *
 * React JSX expects certain attributes in kebab-case (aria-*, data-*),
 * but our schema may define them in camelCase for convenience.
 * This function normalizes prop names to the format React expects.
 *
 * Handles both camelCase (ariaLabel) and already-kebab-case (aria-label) inputs.
 * If prop is already in kebab-case, it returns unchanged to avoid double-conversion.
 *
 * @param key - Property key (potentially in camelCase or kebab-case)
 * @returns Normalized key (kebab-case for aria/data attributes)
 *
 * @example
 * ```typescript
 * normalizeAriaDataProps('ariaLabel') // 'aria-label'
 * normalizeAriaDataProps('aria-label') // 'aria-label' (unchanged)
 * normalizeAriaDataProps('dataTestId') // 'data-test-id'
 * normalizeAriaDataProps('data-test-id') // 'data-test-id' (unchanged)
 * normalizeAriaDataProps('className') // 'className' (unchanged)
 * ```
 */
function normalizeAriaDataProps(key: string): string {
  // Convert ariaLabel → aria-label, dataTestId → data-test-id
  // Check if fifth character is uppercase letter (not hyphen or other character)
  // to avoid double-conversion (aria-label → aria--label)
  if (key.startsWith('aria') && key.length > 4 && key[4] !== undefined && /[A-Z]/.test(key[4])) {
    // ariaLabel → aria-label
    const suffix = key.slice(4) // 'Label'
    const kebabSuffix = toKebabCase(suffix) // 'label'
    return `aria-${kebabSuffix}`
  }

  if (key.startsWith('data') && key.length > 4 && key[4] !== undefined && /[A-Z]/.test(key[4])) {
    // dataTestId → data-test-id
    const suffix = key.slice(4) // 'TestId'
    const kebabSuffix = toKebabCase(suffix) // 'test-id'
    return `data-${kebabSuffix}`
  }

  return key
}

/**
 * Substitutes variables in props recursively
 *
 * Walks through props object and replaces all $variable strings with actual values.
 * Handles nested objects (e.g., style props) recursively.
 * Supports variable substitution in string values, including partial substitution
 * within strings (e.g., 'box-$variant' → 'box-primary').
 * Normalizes aria* and data* prop names to kebab-case for React compatibility.
 *
 * @param props - Component props that may contain variable placeholders
 * @param vars - Variables for substitution
 * @returns Props with variables replaced and prop names normalized
 *
 * @example
 * ```typescript
 * const vars = { variant: 'primary', boxId: 'main-box', label: 'Main content' }
 * const props = {
 *   className: 'box-$variant',
 *   id: '$boxId',
 *   ariaLabel: '$label'
 * }
 * substitutePropsVariables(props, vars)
 * // {
 * //   className: 'box-primary',
 * //   id: 'main-box',
 * //   'aria-label': 'Main content'
 * // }
 * ```
 */
export function substitutePropsVariables(
  props: Record<string, unknown> | undefined,
  vars?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!props || !vars) {
    return props
  }

  // Use functional Object.entries + reduce for immutable transformation
  return Object.entries(props).reduce<Record<string, unknown>>((acc, [key, value]) => {
    // Normalize aria/data prop names (ariaLabel → aria-label)
    const normalizedKey = normalizeAriaDataProps(key)

    if (typeof value === 'string') {
      // Handle partial substitution within strings (e.g., 'box-$variant' → 'box-primary')
      return { ...acc, [normalizedKey]: replaceVariables(value, vars) }
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Recursively handle nested objects (like style props)
      return {
        ...acc,
        [normalizedKey]: substitutePropsVariables(value as Record<string, unknown>, vars),
      }
    } else {
      return { ...acc, [normalizedKey]: value }
    }
  }, {})
}
