/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import React, { type ReactElement } from 'react'

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
      __html: `window.${windowKey} = Object.assign({}, window.${windowKey} || {}, ${JSON.stringify(data)});`,
    },
  })
}
