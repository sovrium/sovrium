/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveChildTranslation } from './translation-handler'
import type { Languages } from '@/domain/models/app/languages'

function buildI18nContentAttribute(
  i18n: Record<string, unknown>,
  defaultContent: string,
  defaultLang: string | undefined
): string | undefined {
  const i18nContentData = Object.entries(i18n).reduce<Record<string, string>>(
    (acc, [lang, value]) => {
      if (typeof value === 'object' && value !== null && 'content' in value && value.content) {
        return { ...acc, [lang]: value.content as string }
      }
      return acc
    },
    {}
  )

  const contentWithDefault =
    defaultLang && !i18nContentData[defaultLang]
      ? { ...i18nContentData, [defaultLang]: defaultContent }
      : i18nContentData

  return Object.keys(contentWithDefault).length > 0 ? JSON.stringify(contentWithDefault) : undefined
}

function resolveComponentContent(
  content: string | Record<string, unknown> | undefined,
  i18n: Record<string, unknown> | undefined,
  currentLang: string | undefined,
  languages: Languages | undefined
): string | undefined {
  if (content && typeof content === 'object') {
    return undefined
  }

  if (i18n && currentLang) {
    const langData = i18n[currentLang]
    if (
      langData &&
      typeof langData === 'object' &&
      'content' in langData &&
      typeof langData.content === 'string'
    ) {
      return langData.content
    }
  }
  if (content) {
    return resolveChildTranslation(content, currentLang, languages)
  }
  return content
}

function buildFinalElementProps(
  baseProps: Record<string, unknown>,
  i18nAttribute: string | undefined
): Record<string, unknown> {
  return i18nAttribute ? { ...baseProps, 'data-i18n-content': i18nAttribute } : baseProps
}

export interface ResolveI18nContentConfig {
  readonly content: string | Record<string, unknown> | undefined
  readonly i18n: Record<string, unknown> | undefined
  readonly currentLang: string | undefined
  readonly languages: Languages | undefined
  readonly elementProps: Record<string, unknown>
  readonly elementPropsWithSpacing: Record<string, unknown>
}

export function resolveI18nContent(config: ResolveI18nContentConfig): {
  readonly resolvedContent: string | undefined
  readonly finalElementProps: Record<string, unknown>
  readonly finalElementPropsWithSpacing: Record<string, unknown>
} {
  const {
    content,
    i18n: i18nConfig,
    currentLang: lang,
    languages: langs,
    elementProps: props,
    elementPropsWithSpacing: propsWithSpacing,
  } = config

  const resolvedContent = resolveComponentContent(content, i18nConfig, lang, langs)

  const i18nContentAttribute =
    i18nConfig && content
      ? buildI18nContentAttribute(i18nConfig, content as string, langs?.default)
      : undefined

  const finalElementProps = buildFinalElementProps(props, i18nContentAttribute)
  const finalElementPropsWithSpacing = buildFinalElementProps(
    propsWithSpacing,
    i18nContentAttribute
  )

  return {
    resolvedContent,
    finalElementProps,
    finalElementPropsWithSpacing,
  }
}
