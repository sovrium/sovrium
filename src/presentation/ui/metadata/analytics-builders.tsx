/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { renderScriptTag } from '@/presentation/scripts/script-renderers'
import type { Analytics } from '@/domain/models/app/pages/meta'

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
