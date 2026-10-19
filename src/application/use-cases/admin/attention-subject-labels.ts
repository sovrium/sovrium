/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The names an attention detail gives its subjects: the words the console uses
 * for the same automation or form on its own page, never the slug an operator
 * reads nowhere else.
 */

import { entityLabelFor } from '@/domain/models/app/auth/readable-name-service'
import { resolveTranslationPattern } from '@/domain/models/app/languages/translation-resolver'
import { resolveOperatorTimezone } from '@/infrastructure/process/operator-timezone'
import { formatStamp } from './attention-cells'
import type { ConsoleLanguage } from './operator-language'
import type { App } from '@/domain/models/app'

/** An automation as the Runs page names it: its declared label, else its name made readable. */
export const automationLabelOf = (app: App, name: string): string =>
  entityLabelFor((app.automations ?? []).find((automation) => automation.name === name) ?? { name })

/** A form as the Submissions page names it: its title, else its name made readable. */
export const formLabelOf = (
  app: App,
  form: { readonly name: string; readonly title?: string | undefined },
  language: ConsoleLanguage
): string =>
  form.title === undefined || form.title === ''
    ? entityLabelFor({ name: form.name })
    : resolveTranslationPattern(form.title, language, app.languages)

/** A paused automation as the attention detail names it: its label, and since when. */
export const pausedSubjectOf = (item: {
  readonly label: string
  readonly pausedAt?: string | undefined
}): string =>
  item.pausedAt === undefined
    ? item.label
    : `${item.label} · since ${formatStamp(item.pausedAt, resolveOperatorTimezone())}`
