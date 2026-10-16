/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { SansFontPreload } from '@/presentation/render/page/page-head-fonts'
import type { Design } from '@/domain/models/app/design'

/**
 * Pure HTML head fragment — title and description are resolved upstream
 * so this stays a focused renderer.
 */
export const FormHead = ({
  title,
  description,
  cssHref,
  design,
}: {
  readonly title: string
  readonly description: string
  readonly cssHref?: string
  readonly design: Design | undefined
}) => (
  <head>
    <meta charSet="UTF-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0"
    />
    <title>{title}</title>
    <meta
      name="description"
      content={description || title}
    />
    {/* Link the globally-compiled theme stylesheet (also
        serves the standalone form page so the embed shell inherits the
        same theme tokens — including CSS variables like --color-primary
        and --color-text — without a separate per-form bundle). */}
    <SansFontPreload design={design} />
    <link
      rel="stylesheet"
      href={cssHref ?? '/assets/output.css'}
    />
  </head>
)
