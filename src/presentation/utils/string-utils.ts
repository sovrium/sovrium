/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Convert camelCase to kebab-case
 *
 * Transforms camelCase strings into kebab-case format by inserting hyphens
 * between lowercase/digit characters and uppercase characters, then lowercasing
 * the entire string.
 *
 * @param str - String in camelCase
 * @returns String in kebab-case
 *
 * @example
 * ```typescript
 * toKebabCase('fadeIn') // 'fade-in'
 * toKebabCase('slideInUp') // 'slide-in-up'
 * toKebabCase('backgroundColor') // 'background-color'
 * ```
 */
export function toKebabCase(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

/**
 * Convert any string to kebab-case (slug)
 *
 * Transforms any string (including those with spaces and special characters)
 * into a URL-safe kebab-case format by:
 * 1. Converting to lowercase
 * 2. Replacing spaces and underscores with hyphens
 * 3. Removing non-alphanumeric characters (except hyphens)
 * 4. Collapsing multiple consecutive hyphens into one
 * 5. Trimming hyphens from start and end
 *
 * @param str - Any string
 * @returns String in kebab-case
 *
 * @example
 * ```typescript
 * toSlug('Home Page') // 'home-page'
 * toSlug('About Us') // 'about-us'
 * toSlug('Plans & Pricing') // 'plans-pricing'
 * toSlug('Company Info') // 'company-info'
 * ```
 */
export function toSlug(str: string): string {
  return str
    .toLowerCase()
    .replace(/[\s_]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/[^\w-]+/g, '') // Remove non-word chars (except hyphens)
    .replace(/--+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, '') // Trim hyphens from start and end
}
