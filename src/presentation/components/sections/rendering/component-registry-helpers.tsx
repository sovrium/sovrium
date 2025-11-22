/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Convert custom props to data-* attributes for badge components
 *
 * Re-exported from prop-conversion module for backward compatibility
 */
export { convertBadgeProps } from '../props/prop-conversion'

/**
 * Parse HTML content string into React elements
 *
 * SECURITY: Safe use of dangerouslySetInnerHTML
 * - Content: HTML string from component/block configuration
 * - Source: Validated schema (component content property)
 * - Risk: Low - content is from server configuration, not user input
 * - Validation: Schema validation ensures string type
 * - Purpose: Render HTML content in badge/component elements
 * - XSS Protection: Content comes from trusted configuration
 * - NOTE: For user-generated HTML, use DOMPurify sanitization instead
 */
export function parseHTMLContent(htmlString: string) {
  return <div dangerouslySetInnerHTML={{ __html: htmlString }} />
}
