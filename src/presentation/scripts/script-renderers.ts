/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import React, { type ReactElement } from 'react'

/**
 * Render a script tag with optional attributes
 * Unified helper for rendering external scripts (analytics, external scripts, etc.)
 */
export function renderScriptTag({
  src,
  async: asyncProp,
  defer,
  module,
  integrity,
  crossOrigin,
  dataTestId,
  reactKey,
  hidden,
}: {
  readonly src: string
  readonly async?: boolean
  readonly defer?: boolean
  readonly module?: boolean
  readonly integrity?: string
  readonly crossOrigin?: 'anonymous' | 'use-credentials'
  readonly dataTestId?: string
  readonly reactKey: string | number
  readonly hidden?: boolean
}): Readonly<ReactElement> {
  const props: Record<string, unknown> = {
    key: reactKey,
    src,
    ...(asyncProp && { async: true }),
    ...(defer && { defer: true }),
    ...(module && { type: 'module' }),
    ...(integrity && { integrity }),
    ...(crossOrigin && { crossOrigin }),
    ...(dataTestId && { 'data-testid': dataTestId }),
    ...(hidden && { style: { display: 'none' } }),
  }

  return React.createElement('script', props)
}

/**
 * Render an inline script tag with JavaScript code
 * Wraps code in async IIFE if async property is true
 *
 * SECURITY: Safe use of dangerouslySetInnerHTML
 * - Content: Inline JavaScript code from page configuration
 * - Source: Validated InlineScripts schema (page.scripts.inlineScripts[].code)
 * - Risk: Low - content is from server configuration, not user input
 * - Validation: Schema validation ensures string type
 * - Purpose: Render inline scripts for page-specific functionality
 * - CSP: Inline script - consider using nonce for stricter CSP
 * - Transformation: Optionally wraps in async IIFE for async execution
 */
export function renderInlineScriptTag({
  code,
  async: asyncProp,
  reactKey,
}: {
  readonly code: string
  readonly async?: boolean
  readonly reactKey: string | number
}): Readonly<ReactElement> {
  const scriptContent = asyncProp ? `(async () => { ${code} })();` : code

  return React.createElement('script', {
    key: reactKey,
    dangerouslySetInnerHTML: { __html: scriptContent },
  })
}

/**
 * Renders an inline script tag that exposes configuration data to window object
 *
 * SECURITY: Safe use of dangerouslySetInnerHTML
 * - Content: Build-time generated configuration data (JSON.stringify)
 * - Source: Validated schema from app/page configuration
 * - Risk: None - no user input, server-controlled data only
 * - Purpose: Expose configuration for client-side JavaScript access
 * - CSP: Compatible - inline script with deterministic content
 * - Note: Only public configuration (no secrets)
 *
 * @param windowKey - Name of the window property (e.g., 'APP_CONFIG', 'APP_LANGUAGES')
 * @param data - Configuration object to expose
 * @param reactKey - Unique React key for the script element
 * @returns React script element with inline configuration
 */
export function renderWindowConfig({
  windowKey,
  data,
  reactKey,
}: {
  readonly windowKey: string
  readonly data: unknown
  readonly reactKey: string | number
}): Readonly<ReactElement> {
  return React.createElement('script', {
    key: reactKey,
    dangerouslySetInnerHTML: {
      __html: `window.${windowKey} = ${JSON.stringify(data)};`,
    },
  })
}
