/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { renderScriptTag } from '@/presentation/scripts/script-renderers'
import type { Analytics } from '@/domain/models/app/page/meta/analytics'

/**
 * Build DNS prefetch link for analytics provider
 */
export function buildDnsPrefetchLink(
  provider: Analytics['providers'][number],
  providerIndex: number,
  hidden: boolean
): ReactElement | undefined {
  if (!provider.dnsPrefetch) return undefined

  const styleAttr = hidden ? { style: { display: 'none' } } : {}

  return (
    <link
      key={`dns-${providerIndex}`}
      rel="dns-prefetch"
      href={provider.dnsPrefetch}
      {...styleAttr}
    />
  )
}

/**
 * Build external scripts for analytics provider
 */
export function buildExternalScripts(
  provider: Analytics['providers'][number],
  providerIndex: number,
  hidden: boolean
): readonly ReactElement[] {
  if (!provider.scripts || provider.scripts.length === 0) return []

  return provider.scripts.map((script, scriptIndex) =>
    renderScriptTag({
      src: script.src,
      async: script.async,
      defer: script.defer,
      dataTestId: `analytics-${provider.name}`,
      reactKey: `script-${providerIndex}-${scriptIndex}`,
      hidden,
    })
  )
}

/**
 * Build initialization script for analytics provider
 *
 * SECURITY: Safe use of dangerouslySetInnerHTML
 * - Content: Analytics provider initialization code from configuration
 * - Source: Validated Analytics schema (page.meta.analytics.providers[].initScript)
 * - Risk: Low - content is from server configuration, not user input
 * - Validation: Schema validation ensures string type
 * - Purpose: Execute analytics provider setup (e.g., Google Analytics, Plausible)
 * - CSP: Inline script - consider using nonce for stricter CSP
 * - Best Practice: Use external scripts with SRI when possible
 */
export function buildInitScript(
  provider: Analytics['providers'][number],
  providerIndex: number,
  hidden: boolean
): ReactElement | undefined {
  if (!provider.initScript) return undefined

  const styleAttr = hidden ? { style: { display: 'none' } } : {}

  return (
    <script
      key={`init-${providerIndex}`}
      data-testid={`analytics-${provider.name}`}
      dangerouslySetInnerHTML={{
        __html: provider.initScript,
      }}
      {...styleAttr}
    />
  )
}

/**
 * Build marker script for analytics provider (when no scripts exist)
 *
 * SECURITY: Safe use of dangerouslySetInnerHTML
 * - Content: Static comment marker with provider name
 * - Source: provider.name from validated Analytics schema
 * - Risk: None - contains only static comment text
 * - Validation: provider.name is validated as string by schema
 * - Purpose: Testing/debugging marker when provider has no actual scripts
 * - XSS Protection: Comment syntax prevents code execution
 */
export function buildMarkerScript(
  provider: Analytics['providers'][number],
  providerIndex: number,
  hidden: boolean
): ReactElement | undefined {
  const hasNoScripts = (!provider.scripts || provider.scripts.length === 0) && !provider.initScript

  if (!hasNoScripts) return undefined

  const styleAttr = hidden ? { style: { display: 'none' } } : {}

  return (
    <script
      key={`marker-${providerIndex}`}
      data-testid={`analytics-${provider.name}`}
      dangerouslySetInnerHTML={{
        __html: `/* ${provider.name} analytics marker */`,
      }}
      {...styleAttr}
    />
  )
}

/**
 * Build config data script for analytics provider
 *
 * SECURITY: Safe use of dangerouslySetInnerHTML
 * - Content: JSON configuration data (JSON.stringify)
 * - Source: provider.config from validated Analytics schema
 * - Risk: None - JSON data cannot execute as code
 * - Validation: Schema validation ensures object type
 * - Purpose: Store analytics configuration as JSON for client-side access
 * - XSS Protection: type="application/json" prevents script execution
 * - Format: Safe serialization via JSON.stringify
 */
export function buildConfigScript(
  provider: Analytics['providers'][number],
  providerIndex: number,
  hidden: boolean
): ReactElement | undefined {
  if (!provider.config) return undefined

  const styleAttr = hidden ? { style: { display: 'none' } } : {}

  return (
    <script
      key={`config-${providerIndex}`}
      data-testid={`analytics-${provider.name}-config`}
      type="application/json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(provider.config),
      }}
      {...styleAttr}
    />
  )
}

/**
 * Build all elements for a single analytics provider
 */
export function buildProviderElements(
  provider: Analytics['providers'][number],
  providerIndex: number
): readonly ReactElement[] {
  const isEnabled = provider.enabled !== false
  const hidden = !isEnabled

  return [
    buildDnsPrefetchLink(provider, providerIndex, hidden),
    ...buildExternalScripts(provider, providerIndex, hidden),
    buildInitScript(provider, providerIndex, hidden),
    buildMarkerScript(provider, providerIndex, hidden),
    buildConfigScript(provider, providerIndex, hidden),
  ].filter((el): el is ReactElement => el !== undefined)
}
