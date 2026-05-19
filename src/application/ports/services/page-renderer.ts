/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context } from 'effect'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/types/session-info'

export type PageRenderResult =
  | string
  | undefined
  | { readonly redirect: string }
  | { readonly error: string }
  | { readonly unauthorized: true }


export class PageRenderer extends Context.Tag('PageRenderer')<
  PageRenderer,
  {
    readonly renderPage: (
      app: App,
      path: string,
      requestContext?: {
        readonly detectedLanguage?: string
        readonly session?: SessionInfo
        readonly cookies?: Readonly<Record<string, string>>
        readonly previewMode?: boolean
      }
    ) => PageRenderResult | Promise<PageRenderResult>

    readonly renderNotFound: (app?: App, detectedLanguage?: string) => string | Promise<string>

    readonly renderError: (app?: App, detectedLanguage?: string) => string | Promise<string>

    readonly renderRssFeed: (app: App, baseUrl: string) => Promise<string | undefined>
  }
>() {}
