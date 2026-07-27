/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { isAbsoluteRedirectTarget, stripLanguagePrefix } from '@/domain/models/app/redirects'

export type RedirectStatus = 301 | 302 | 307 | 308

export interface RedirectRule {
  readonly from: string
  readonly to: string
  readonly status?: RedirectStatus
  readonly localizeTarget?: boolean
}

export interface RedirectResolution {
  readonly location: string
  readonly status: RedirectStatus
}

const DEFAULT_REDIRECT_STATUS: RedirectStatus = 301

const localizeTargetPath = (rule: RedirectRule, language: string): string =>
  rule.localizeTarget === false || isAbsoluteRedirectTarget(rule.to)
    ? rule.to
    : `/${language}${rule.to}`

const appendSearch = (location: string, search: string): string => {
  if (search === '') return location
  return location.includes('?') ? `${location}&${search.slice(1)}` : `${location}${search}`
}

export const resolveRedirect = (
  rules: ReadonlyArray<RedirectRule>,
  languageCodes: ReadonlyArray<string>,
  path: string,
  search = ''
): RedirectResolution | undefined => {
  const exact = rules.find((rule) => rule.from === path)
  if (exact !== undefined) {
    return {
      location: appendSearch(exact.to, search),
      status: exact.status ?? DEFAULT_REDIRECT_STATUS,
    }
  }

  const { language, path: barePath } = stripLanguagePrefix(path, languageCodes)
  if (language === undefined) return undefined

  const localeAgnostic = rules.find(
    (rule) =>
      rule.from === barePath && stripLanguagePrefix(rule.from, languageCodes).language === undefined
  )
  if (localeAgnostic === undefined) return undefined

  return {
    location: appendSearch(localizeTargetPath(localeAgnostic, language), search),
    status: localeAgnostic.status ?? DEFAULT_REDIRECT_STATUS,
  }
}
