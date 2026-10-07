/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type CSSProperties } from 'react'
import { FormBody, type EmbeddedFormPrefillContext } from './form-body'
import { resolveDocumentLang } from './form-field-resolver'
import { ResumeUnavailableNotice } from './form-save-for-later'
import type { FormLinkState } from './form-prefill-resolver'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'
import type { FormOptionSets } from '@/domain/models/app/forms/form-option-source-service'

/**
 * Build the per-form theme style overlay from `display.theme`. Each token
 * maps onto a scoped CSS custom property on the form's `<main>` element so
 * the override applies to THIS form only (a sibling form without the block
 * inherits the app theme). Returns `undefined` when no theme is declared so
 * React omits the `style` attribute entirely.
 */
function formThemeStyle(form: Readonly<Form>): CSSProperties | undefined {
  const theme = form.display?.theme
  if (!theme) return undefined
  const primary = theme.primaryColor ? { '--color-primary': theme.primaryColor } : {}
  const background = theme.backgroundColor ? { '--color-background': theme.backgroundColor } : {}
  const radius = theme.borderRadius ? { '--radius': theme.borderRadius } : {}
  const style = { ...primary, ...background, ...radius }
  return Object.keys(style).length > 0 ? (style as CSSProperties) : undefined
}

/**
 * The page's `<main>`: the notice a spent resume link opens with, then the
 * form body.
 */
export function FormPageMain({
  app,
  form,
  embed,
  activeLang,
  prefillContext,
  optionSets,
  link,
}: {
  readonly app: App
  readonly form: Form
  readonly embed: boolean
  readonly activeLang: string | undefined
  readonly prefillContext: EmbeddedFormPrefillContext | undefined
  readonly optionSets: FormOptionSets | undefined
  readonly link: FormLinkState | undefined
}) {
  const { languages } = app
  return (
    <main
      className="form-page"
      data-form-name={form.name}
      style={formThemeStyle(form)}
    >
      <ResumeUnavailableNotice
        link={link}
        lang={resolveDocumentLang(languages, activeLang)}
        languages={languages}
      />
      <FormBody
        app={app}
        form={form}
        embed={embed}
        activeLang={activeLang}
        prefillContext={prefillContext}
        {...(optionSets !== undefined ? { optionSets } : {})}
        {...(link === undefined ? {} : { link })}
      />
    </main>
  )
}
