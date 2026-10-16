/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveInterpreterString } from '@/domain/models/app/languages/translation-resolver'
import { newTabName } from '@/presentation/design/new-tab-attributes'
import { NewTabNotice } from '@/presentation/design/new-tab-notice'
import * as Renderers from '../elements'
import { buildLinkClassName } from './interactive-prestyle-builders'
import type { ComponentRenderer } from './component-dispatch-config'
import type { Languages } from '@/domain/models/app/languages'

/**
 * `link` SSR renderer: an `<a>` wearing the link recipe, its words the
 * `content`, else the rendered children.
 *
 * A link whose `props.target` is `_blank` opens a new tab, and says so
 * (WCAG 3.2.5, RGAA 13.2): the engine string `link.opensInNewTab`, in the page
 * language, ends its accessible name — by `aria-label` for plain words or an
 * author's own `aria-label`, else as a visually hidden span (`NewTabNotice`)
 * after rendered children. An author renames it under `sovrium.link.opensInNewTab`.
 * A link whose words are a `$t:` key is reworded in place by the page's
 * language switcher, which keeps the span and rewords it from its own
 * `data-translations`.
 */
export const linkComponent: ComponentRenderer = ({
  elementProps,
  content,
  renderedChildren,
  component,
  designStyles,
  currentLang,
  languages,
}) => {
  const className = buildLinkClassName(
    (component ?? {}) as Record<string, unknown>,
    elementProps['className'] as string | undefined,
    designStyles?.replace
  )
  const props = { ...elementProps, className }
  if (elementProps['target'] !== '_blank') {
    return Renderers.renderLink(props, content, renderedChildren)
  }
  const notice = resolveInterpreterString('link.opensInNewTab', currentLang, languages)
  const authored = elementProps['aria-label']
  if (typeof authored === 'string') {
    return Renderers.renderLink(
      { ...props, ...newTabName(authored, notice) },
      content,
      renderedChildren
    )
  }
  if (content && !elementProps['data-translation-key']) {
    return Renderers.renderLink({ ...props, ...newTabName(content, notice) }, content, [])
  }
  return Renderers.renderLink(props, undefined, [
    ...(content ? [content] : renderedChildren),
    <NewTabNotice
      key="new-tab-notice"
      text={notice}
      translations={noticeInEveryLanguage(languages)}
    />,
  ])
}

/**
 * The announcement in each language the app declares, for a page whose
 * language switcher rewords the page in place; `undefined` for an app with one.
 */
function noticeInEveryLanguage(
  languages: Languages | undefined
): Readonly<Record<string, string>> | undefined {
  if (languages === undefined || languages.supported.length < 2) return undefined
  return Object.fromEntries(
    languages.supported.map((language) => [
      language.code,
      resolveInterpreterString('link.opensInNewTab', language.code, languages),
    ])
  )
}
