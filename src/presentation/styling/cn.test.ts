/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/// <reference lib="dom" />

import { test, expect, describe } from 'bun:test'
import { cn } from './cn'

describe('cn - className utility', () => {
  test('should merge single className', () => {
    // Given: A single className
    const className = 'text-red-500'

    // When: cn is called with single class
    const result = cn(className)

    // Then: Returns the className unchanged
    expect(result).toBe('text-red-500')
  })

  test('should merge multiple classNames', () => {
    // Given: Multiple classNames
    const classes = ['bg-blue-500', 'text-white', 'p-4']

    // When: cn is called with multiple classes
    const result = cn(...classes)

    // Then: Returns merged classNames
    expect(result).toBe('bg-blue-500 text-white p-4')
  })

  test('should handle Tailwind class conflicts (last wins)', () => {
    // Given: Conflicting Tailwind classes
    const baseClass = 'p-4'
    const overrideClass = 'p-6'

    // When: cn is called with conflicting classes
    const result = cn(baseClass, overrideClass)

    // Then: Last class wins (Tailwind merge behavior)
    expect(result).toBe('p-6')
  })

  test('should handle conditional classNames with clsx syntax', () => {
    // Given: Conditional classes using object syntax
    const condition = true

    // When: cn is called with conditional object
    const result = cn({
      'text-red-500': condition,
      'text-blue-500': !condition,
    })

    // Then: Only truthy classes are included
    expect(result).toBe('text-red-500')
  })

  test('should filter out falsy values', () => {
    // Given: Mix of valid and falsy values
    const classes = ['bg-white', false, 'text-black', undefined, '', 'p-4']

    // When: cn is called with falsy values
    const result = cn(...classes)

    // Then: Only truthy values are included
    expect(result).toBe('bg-white text-black p-4')
  })

  test('should handle empty input', () => {
    // Given: No arguments
    // When: cn is called with no args
    const result = cn()

    // Then: Returns empty string
    expect(result).toBe('')
  })

  test('should handle array of classNames', () => {
    // Given: Array of classNames
    const classes = ['flex', 'items-center', 'justify-between']

    // When: cn is called with array
    const result = cn(classes)

    // Then: Returns merged classNames
    expect(result).toBe('flex items-center justify-between')
  })

  test('should merge base and variant classes', () => {
    // Given: Base classes and variant overrides
    const baseClasses = 'rounded-md border border-gray-200'
    const variantClasses = 'border-blue-500 bg-blue-50'

    // When: cn is called with base and variant
    const result = cn(baseClasses, variantClasses)

    // Then: Variant overrides base (Tailwind merge)
    expect(result).toBe('rounded-md border border-blue-500 bg-blue-50')
  })

  test('should handle complex nested conditions', () => {
    // Given: Nested conditions with arrays and objects
    const isActive = true
    const isDisabled = false

    // When: cn is called with complex input
    const result = cn(
      'base-class',
      isActive && 'active-class',
      isDisabled && 'disabled-class',
      {
        'conditional-true': isActive,
        'conditional-false': isDisabled,
      },
      ['array-class-1', isActive && 'array-class-2']
    )

    // Then: All conditions evaluated correctly
    expect(result).toBe('base-class active-class conditional-true array-class-1 array-class-2')
  })

  test('should deduplicate identical classes', () => {
    // Given: Duplicate classNames
    const classes = ['text-red-500', 'p-4', 'text-red-500', 'p-4']

    // When: cn is called with duplicates
    const result = cn(...classes)

    // Then: Duplicates are merged
    expect(result).toBe('text-red-500 p-4')
  })

  test('should handle responsive Tailwind classes', () => {
    // Given: Responsive utility classes
    const classes = 'text-sm md:text-base lg:text-lg'

    // When: cn is called with responsive classes
    const result = cn(classes)

    // Then: Responsive classes preserved
    expect(result).toBe('text-sm md:text-base lg:text-lg')
  })

  test('should merge pseudo-class variants correctly', () => {
    // Given: Pseudo-class variants
    const classes = 'hover:bg-blue-500 focus:bg-blue-600 active:bg-blue-700'

    // When: cn is called with pseudo-class variants
    const result = cn(classes)

    // Then: All variants preserved
    expect(result).toBe('hover:bg-blue-500 focus:bg-blue-600 active:bg-blue-700')
  })

  test('should handle aria and data attribute selectors', () => {
    // Given: Attribute selector classes
    const classes = 'data-[state=open]:bg-blue-500 aria-[expanded=true]:rotate-180'

    // When: cn is called with attribute selectors
    const result = cn(classes)

    // Then: Attribute selectors preserved
    expect(result).toBe('data-[state=open]:bg-blue-500 aria-[expanded=true]:rotate-180')
  })
})
