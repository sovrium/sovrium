/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The page every signing link that no longer works shows — unknown, expired,
 * used, withdrawn, its request ended, or its session gone.
 *
 * One page, the same bytes whatever the reason, so a link-holder never learns
 * which it was. It is the engine's, never the app's: none of the app's pages
 * or components, nothing naming the request, the flow, the signer or why. It
 * keeps only what makes it the app's page to look at: its design tokens and
 * its language. The layout is shadcn's Empty anatomy, centred.
 */

import { renderToString } from 'react-dom/server'
import { resolveInterpreterString } from '@/domain/models/app/languages/translation-resolver'
import { getVersionedCssPath } from '@/infrastructure/css/versioned-css-path'
import {
  computeEmptyDescriptionClasses,
  computeEmptyHeaderClasses,
  computeEmptyMediaClasses,
  computeEmptyStateContainerClasses,
  computeEmptyStateTitleClasses,
} from '@/presentation/design/empty-default-classes'
import { DynamicPage } from '@/presentation/render/page/dynamic-page'
import type { App } from '@/domain/models/app'
import type { Page } from '@/domain/models/app/pages'

/** The page, in `lang`: an Empty holding a broken-link icon, the title as its one heading, and the body. */
const invalidLinkPage = (app: App, lang: string): Page => {
  const word = (key: string) => resolveInterpreterString(key, lang, app.languages)
  const title = word('signingLink.invalidTitle')
  return {
    name: 'signing-link-invalid',
    path: '/',
    meta: { lang, title },
    components: [
      {
        type: 'container',
        props: {
          className: 'flex min-h-svh items-center justify-center p-6',
          'data-signing-state': 'link-invalid',
        },
        children: [
          {
            type: 'container',
            props: { 'data-slot': 'empty', className: computeEmptyStateContainerClasses() },
            children: [
              {
                type: 'container',
                props: { 'data-slot': 'empty-header', className: computeEmptyHeaderClasses() },
                children: [
                  {
                    type: 'container',
                    props: {
                      'data-slot': 'empty-icon',
                      'data-variant': 'icon',
                      className: computeEmptyMediaClasses('icon'),
                    },
                    children: [{ type: 'icon', props: { name: 'link-2-off', size: 16 } }],
                  },
                  {
                    type: 'text',
                    element: 'h1',
                    props: {
                      'data-slot': 'empty-title',
                      className: computeEmptyStateTitleClasses(),
                    },
                    content: title,
                  },
                  {
                    type: 'text',
                    element: 'p',
                    props: {
                      'data-slot': 'empty-description',
                      className: computeEmptyDescriptionClasses(),
                    },
                    content: word('signingLink.invalidBody'),
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  } as Page
}

/** The neutral not-found document of a signing link, in `lang` (else the app's default). */
export const renderSigningLinkInvalidPage = (app: App, lang: string | undefined): string => {
  const language = lang ?? app.languages?.default ?? 'en'
  const html = renderToString(
    <DynamicPage
      page={invalidLinkPage(app, language)}
      {...(app.design === undefined ? {} : { design: app.design })}
      {...(app.languages === undefined ? {} : { languages: app.languages })}
      detectedLanguage={language}
      cssHref={getVersionedCssPath(app)}
      devNoticeEnabled={false}
    />
  )
  return `<!DOCTYPE html>\n${html}`
}
