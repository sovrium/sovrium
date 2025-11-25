/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { toKebabCase } from '@/presentation/utilities/string-utils'
import type { Component } from '@/domain/models/app/page/sections'

/**
 * Replaces variable placeholders in a string with actual values
 *
 * Uses regex with word boundary checking to avoid partial matches.
 * For example, $icon will not match inside $iconColor.
 *
 * @param value - String that may contain $variable placeholders
 * @param vars - Variables for substitution
 * @returns String with all variables replaced
 *
 * @example
 * ```typescript
 * replaceVariables('$title', { title: 'Hello' })  // 'Hello'
 * replaceVariables('$price/month', { price: '49' })  // '49/month'
 * replaceVariables('box-$variant', { variant: 'primary' })  // 'box-primary'
 * ```
 */
function replaceVariables(value: string, vars: Record<string, string | number | boolean>): string {
  // Use regex with word boundary to avoid partial matches
  // e.g., $icon should not match inside $iconColor
  return Object.entries(vars).reduce<string>((str, [varName, varValue]) => {
    // Create regex that matches $varName as a whole word
    // Use negative lookahead to ensure we don't match if followed by alphanumeric or underscore
    const regex = new RegExp(`\\$${varName}(?![a-zA-Z0-9_])`, 'g')
    return str.replace(regex, String(varValue))
  }, value)
}

/**
 * Substitutes block variables in a value
 *
 * Replaces `$variableName` patterns with actual variable values.
 * Supports both full replacement ($title → 'Welcome') and partial replacement
 * within strings ($price/month → '49/month').
 *
 * @param value - Value that may contain variable placeholders
 * @param vars - Block variables for substitution
 * @returns Value with variables replaced
 *
 * @example
 * ```typescript
 * substituteBlockVariables('$title', { title: 'Hello' }) // 'Hello'
 * substituteBlockVariables('$price/month', { price: '49' }) // '49/month'
 * substituteBlockVariables('static', { title: 'Hello' }) // 'static'
 * substituteBlockVariables(123, { title: 'Hello' })       // 123
 * ```
 */
export function substituteBlockVariables(
  value: unknown,
  vars?: Record<string, string | number | boolean>
): unknown {
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
  vars?: Record<string, string | number | boolean>
): ReadonlyArray<Component | string> | undefined {
  if (!children || !vars) {
    return children
  }

  return children.map((child) => {
    // If child is a string, apply variable substitution
    if (typeof child === 'string') {
      const substituted = substituteBlockVariables(child, vars)
      return substituted as string
    }

    // If child is a component, recursively substitute in its props, children and content
    const substitutedProps = substitutePropsVariables(child.props, vars)
    const substitutedChildren = substituteChildrenVariables(child.children, vars)
    const substitutedContent =
      typeof child.content === 'string'
        ? (substituteBlockVariables(child.content, vars) as string)
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
  vars?: Record<string, string | number | boolean>
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
