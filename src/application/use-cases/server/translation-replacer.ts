/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveTranslation } from '@/domain/utils/translation-resolver'
import type { App, Page } from '@/domain/models/app'
import type { Languages } from '@/domain/models/app/languages'
import type { LanguageConfig } from '@/domain/models/app/languages/supported/language-config'

type TokenReplacementContext = {
  readonly langCode: string
  readonly langConfig: LanguageConfig
  readonly languages: Languages | undefined
  readonly translations: Record<string, string>
  readonly currentPath?: string
}

function replaceTokens(str: string, context: TokenReplacementContext): string {
  const translatedStr = str.startsWith('$t:')
    ? resolveTranslation(str.slice(3), context.langCode, context.languages)
    : str

  const currentPath = context.currentPath || '/'
  return translatedStr.replace(/\{\{currentPath\}\}/g, currentPath)
}

function replaceTokensInValue(value: unknown, context: TokenReplacementContext): unknown {
  if (typeof value === 'string') {
    return replaceTokens(value, context)
  }

  if (Array.isArray(value)) {
    return value.map((item) => replaceTokensInValue(item, context))
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, val]) => [key, replaceTokensInValue(val, context)])
    )
  }

  return value
}

function replaceMetaTokens(meta: Page['meta'], context: TokenReplacementContext): Page['meta'] {
  if (!meta) return meta

  const locale = context.langConfig.locale || context.langCode
  const metaWithLang = {
    ...meta,
    lang: locale,
  }

  return replaceTokensInValue(metaWithLang, context) as Page['meta']
}

export function replacePageTokens(page: Page, context: TokenReplacementContext): Page {
  const pageContext: TokenReplacementContext = {
    ...context,
    currentPath: page.path,
  }

  const { meta, ...restOfPage } = page
  const replacedRest = replaceTokensInValue(restOfPage, pageContext) as Omit<Page, 'meta'>

  const replacedMeta = replaceMetaTokens(meta, pageContext)

  return {
    ...replacedRest,
    meta: replacedMeta,
  } as Page
}

export function replaceAppTokens(app: App, langCode: string): App {
  if (!app.languages) {
    return app
  }

  const langConfig = app.languages.supported.find((lang) => lang.code === langCode)!

  const translations = app.languages.translations?.[langCode] || {}

  const context: TokenReplacementContext = {
    langCode,
    langConfig,
    languages: app.languages,
    translations,
  }

  const pages = app.pages?.map((page) => replacePageTokens(page, context))

  return {
    ...app,
    pages,
  }
}
