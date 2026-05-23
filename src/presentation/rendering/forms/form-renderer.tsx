/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */



import { type CSSProperties, type ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { isGroupVisible } from '@/domain/models/shared/field-groups-flow'
import { FormFieldElement, type PrefillValue } from './form-field-elements'
import { resolveAllFields, resolveDocumentLang, resolveText } from './form-field-resolver'
import { resolveFormPrefill, type FormPrefillContext } from './form-prefill-resolver'
import { FormBodyMultiStep, FormBodyStep, type FormBodyShared } from './form-renderer-multi-step'
import { FormBodyOneQuestion } from './form-renderer-one-question'
import { FormRuntimeMount } from './form-runtime'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'

interface EmbeddedFormPrefillContext {
  readonly prefill: Readonly<Record<string, PrefillValue>>
  readonly lockPrefill: boolean
}

const FormHead = ({
  title,
  description,
}: {
  readonly title: string
  readonly description: string
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
    {}
    <link
      rel="stylesheet"
      href="/assets/output.css"
    />
  </head>
)

function buildFormAttributes(
  form: Readonly<Form>,
  embed: boolean,
  lockPrefill: boolean
): Readonly<Record<string, string>> {
  return {
    method: 'POST',
    action: `/api/forms/${form.name}/submissions`,
    'data-form-name': form.name,
    ...(embed ? { 'data-embed': 'true' } : {}),
    ...(lockPrefill ? { 'data-inline-prefill': 'locked' } : {}),
  } as Readonly<Record<string, string>>
}

function buildFormBodyShared({
  app,
  form,
  embed,
  prefillContext,
  activeLang,
}: {
  readonly app: App
  readonly form: Form
  readonly embed: boolean
  readonly prefillContext: EmbeddedFormPrefillContext | undefined
  readonly activeLang: string | undefined
}): FormBodyShared {
  const { languages } = app
  const lockPrefill = prefillContext?.lockPrefill === true
  return {
    title: resolveText(form.title, languages, form.name, activeLang),
    description: resolveText(form.description, languages, '', activeLang),
    submitLabel: resolveText(form.display?.submitLabel, languages, 'Submit', activeLang),
    resolvedFields: resolveAllFields(app, form, activeLang),
    prefillMap: prefillContext?.prefill ?? {},
    lockPrefill,
    formAttributes: buildFormAttributes(form, embed, lockPrefill),
    ...(form.fieldGroups ? { fieldGroups: form.fieldGroups } : {}),
    ...(form.antiSpam?.honeypot === true ? { antiSpamHoneypot: true } : {}),
  }
}

function FormBody({
  app,
  form,
  embed = false,
  prefillContext,
  activeLang,
}: {
  readonly app: App
  readonly form: Form
  readonly embed?: boolean
  readonly prefillContext?: EmbeddedFormPrefillContext
  readonly activeLang?: string
}) {
  const commonProps = buildFormBodyShared({ app, form, embed, prefillContext, activeLang })
  const isMultiStep = form.layout === 'multi-step' && form.steps && form.steps.length > 0
  const isOneQuestion = form.layout === 'one-question'
  const body: ReactNode = isMultiStep ? (
    <FormBodyMultiStep
      {...commonProps}
      steps={form.steps!}
    />
  ) : isOneQuestion ? (
    <FormBodyOneQuestion {...commonProps} />
  ) : (
    <FormBodyFlat {...commonProps} />
  )

  return (
    <>
      {body}
      {}
      {!embed && <FormRuntimeMount form={form} />}
    </>
  )
}

function renderFlatFormFields({
  resolvedFields,
  fieldGroups,
  prefillMap,
  lockPrefill,
}: Pick<FormBodyShared, 'resolvedFields' | 'fieldGroups' | 'prefillMap' | 'lockPrefill'>) {
  const renderField = (field: FormBodyShared['resolvedFields'][number]) => (
    <FormFieldElement
      key={field.name}
      field={field}
      prefillValue={prefillMap[field.name]}
      lockPrefill={lockPrefill}
    />
  )
  if (!fieldGroups || fieldGroups.length === 0) {
    return <>{resolvedFields.map(renderField)}</>
  }
  const visibleGroups = fieldGroups.filter((group) => isGroupVisible(group, {}))
  const groupedNames = new Set<string>(visibleGroups.flatMap((g) => Array.from(g.fields)))
  const ungrouped = resolvedFields.filter((f) => !groupedNames.has(f.name))
  return (
    <>
      {visibleGroups.map((group) => (
        <section
          key={group.label}
          className="form-group"
        >
          <h2 className="form-group-label">{group.label}</h2>
          {group.fields
            .map((name) => resolvedFields.find((f) => f.name === name))
            .filter((f): f is FormBodyShared['resolvedFields'][number] => f !== undefined)
            .map(renderField)}
        </section>
      ))}
      {ungrouped.map(renderField)}
    </>
  )
}

const HONEYPOT_HIDDEN_STYLE = { display: 'none' } as const

function HoneypotInput() {
  return (
    <input
      type="text"
      name="_hp"
      tabIndex={-1}
      aria-hidden="true"
      style={HONEYPOT_HIDDEN_STYLE}
      {...{ autocomplete: 'off' }}
    />
  )
}

function FormBodyFlat({
  title,
  description,
  submitLabel,
  formAttributes,
  resolvedFields,
  fieldGroups,
  prefillMap,
  lockPrefill,
  antiSpamHoneypot,
}: FormBodyShared) {
  return (
    <>
      <h1 className="form-title">{title}</h1>
      {description && <p className="form-description">{description}</p>}
      <form {...formAttributes}>
        {antiSpamHoneypot && <HoneypotInput />}
        {renderFlatFormFields({ resolvedFields, fieldGroups, prefillMap, lockPrefill })}
        <button type="submit">{submitLabel}</button>
      </form>
    </>
  )
}


function formThemeStyle(form: Readonly<Form>): CSSProperties | undefined {
  const theme = form.display?.theme
  if (!theme) return undefined
  const primary = theme.primaryColor ? { '--color-primary': theme.primaryColor } : {}
  const background = theme.backgroundColor ? { '--color-background': theme.backgroundColor } : {}
  const radius = theme.borderRadius ? { '--radius': theme.borderRadius } : {}
  const style = { ...primary, ...background, ...radius }
  return Object.keys(style).length > 0 ? (style as CSSProperties) : undefined
}

function FormPage({
  app,
  form,
  embed = false,
  activeLang,
  prefill,
}: {
  readonly app: App
  readonly form: Form
  readonly embed?: boolean
  readonly activeLang?: string
  readonly prefill?: Readonly<Record<string, PrefillValue>>
}) {
  const { languages } = app
  const title = resolveText(form.title, languages, form.name, activeLang)
  const description = resolveText(form.description, languages, '', activeLang)
  const documentLang = resolveDocumentLang(languages, activeLang)
  const prefillContext =
    prefill && Object.keys(prefill).length > 0 ? { prefill, lockPrefill: false } : undefined
  const themeStyle = formThemeStyle(form)

  return (
    <html lang={documentLang}>
      <FormHead
        title={title}
        description={description}
      />
      <body>
        <main
          className="form-page"
          data-form-name={form.name}
          {...(themeStyle ? { style: themeStyle } : {})}
        >
          <FormBody
            app={app}
            form={form}
            embed={embed}
            activeLang={activeLang}
            prefillContext={prefillContext}
          />
        </main>
      </body>
    </html>
  )
}

function resolveStandalonePrefill(
  form: Readonly<Form>,
  prefillCtx: FormPrefillContext | undefined
): Readonly<Record<string, PrefillValue>> | undefined {
  if (!prefillCtx) return undefined
  const { prefill } = form as { readonly prefill?: Readonly<Record<string, PrefillValue>> }
  return resolveFormPrefill(prefill, prefillCtx)
}

function renderFormDocument(opts: {
  readonly app: Readonly<App>
  readonly form: Readonly<Form>
  readonly embed: boolean
  readonly activeLang: string | undefined
  readonly prefillCtx: FormPrefillContext | undefined
}): string {
  const { app, form, embed, activeLang, prefillCtx } = opts
  const html = renderToString(
    <FormPage
      app={app as App}
      form={form as Form}
      embed={embed}
      activeLang={activeLang}
      prefill={resolveStandalonePrefill(form, prefillCtx)}
    />
  )
  return `<!DOCTYPE html>\n${html}`
}

export function renderFormPage(
  app: Readonly<App>,
  form: Readonly<Form>,
  activeLang?: string,
  prefillCtx?: FormPrefillContext
): string {
  return renderFormDocument({ app, form, embed: false, activeLang, prefillCtx })
}

export function renderEmbedFormPage(
  app: Readonly<App>,
  form: Readonly<Form>,
  activeLang?: string,
  prefillCtx?: FormPrefillContext
): string {
  return renderFormDocument({ app, form, embed: true, activeLang, prefillCtx })
}

export function renderFormStepFragment(
  app: Readonly<App>,
  form: Readonly<Form>,
  stepId: string,
  draftValues: Readonly<Record<string, unknown>>
): string {
  const steps = form.steps ?? []
  if (steps.length === 0) return ''
  const stepIndex = steps.findIndex((s) => s.id === stepId)
  if (stepIndex < 0) return ''
  const step = steps[stepIndex]!
  const resolvedFields = resolveAllFields(app as App, form as Form)
  const prefillMap = Object.fromEntries(
    Object.entries(draftValues).map(([key, value]) => [key, value as PrefillValue])
  ) as Readonly<Record<string, PrefillValue>>
  const totalVisible = steps.length
  const isFirst = stepIndex === 0
  const isLast = stepIndex === totalVisible - 1
  return renderToString(
    <FormBodyStep
      step={step}
      stepIndex={stepIndex}
      isFirst={isFirst}
      isLast={isLast}
      stepFields={resolvedFields.filter((f) => step.fields.includes(f.name))}
      prefillMap={prefillMap}
      lockPrefill={false}
    />
  )
}

export function renderEmbeddedFormBody(
  app: Readonly<App>,
  form: Readonly<Form>,
  prefillContext?: EmbeddedFormPrefillContext
): string {
  return renderToString(
    <FormBody
      app={app as App}
      form={form as Form}
      embed={true}
      prefillContext={prefillContext}
    />
  )
}
