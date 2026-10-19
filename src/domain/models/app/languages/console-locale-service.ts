/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { App } from '@/domain/models/app'

type SupportedLanguage = NonNullable<App['languages']>['supported'][number]

/**
 * The console's languages, each in the REGION the operator's app declares for
 * the same language.
 *
 * The console names its own two languages with a fallback region (`en` as
 * `en-US`, `fr` as `fr-FR`), and that tag is what reaches `<html lang>` — the
 * locale every number, amount and date on the page is formatted in. An app
 * declaring `en` as `en-GB` printed its dates `14 Oct 2026` on its own pages
 * and `Oct 14, 2026` in the console beside them: one operator, one language,
 * two calendars. So a console language the app also declares takes the app's
 * locale; one the app does not declare keeps the console's own.
 *
 * Only the `locale` moves. The code, the label, the direction and the console's
 * strings stay the console's: this is a formatting region, not a vocabulary.
 * Returns the preset itself when nothing changes, so an app declaring no
 * languages, or the same regions, costs no new object.
 *
 * @param presetApp - the console, as its preset declares it
 * @param operatorApp - the operator's decoded app
 * @returns the console with each shared language in the app's region
 */
export const withOperatorLocales = (presetApp: App, operatorApp: App): App => {
  const consoleLanguages = presetApp.languages
  const declared = operatorApp.languages?.supported ?? []
  if (consoleLanguages === undefined || declared.length === 0) return presetApp
  const regionOf = new Map(declared.map((language) => [language.code, language.locale] as const))
  const adopt = (language: SupportedLanguage): SupportedLanguage => {
    const locale = regionOf.get(language.code)
    return locale === undefined || locale === language.locale ? language : { ...language, locale }
  }
  const supported = consoleLanguages.supported.map(adopt)
  if (supported.every((language, index) => language === consoleLanguages.supported[index])) {
    return presetApp
  }
  return { ...presetApp, languages: { ...consoleLanguages, supported } } as App
}
