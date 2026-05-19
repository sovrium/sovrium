/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */



import { type ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { FormFieldElement, type PrefillValue } from './form-field-elements'
import { resolveAllFields, resolveText } from './form-field-resolver'
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

function FormBody({
  app,
  form,
  embed = false,
  prefillContext,
}: {
  readonly app: App
  readonly form: Form
  readonly embed?: boolean
  readonly prefillContext?: EmbeddedFormPrefillContext
}) {
  const { languages } = app
  const title = resolveText(form.title, languages, form.name)
  const description = resolveText(form.description, languages, '')
  const resolvedFields = resolveAllFields(app, form)

  const lockPrefill = prefillContext?.lockPrefill === true
  const prefillMap = prefillContext?.prefill ?? {}
  const formAttributes = buildFormAttributes(form, embed, lockPrefill)

  const commonProps = {
    title,
    description,
    formAttributes,
    resolvedFields,
    prefillMap,
    lockPrefill,
  }
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

interface FormBodyShared {
  readonly title: string
  readonly description: string
  readonly formAttributes: Readonly<Record<string, string>>
  readonly resolvedFields: ReturnType<typeof resolveAllFields>
  readonly prefillMap: Readonly<Record<string, PrefillValue>>
  readonly lockPrefill: boolean
}

function FormBodyFlat({
  title,
  description,
  formAttributes,
  resolvedFields,
  prefillMap,
  lockPrefill,
}: FormBodyShared) {
  return (
    <>
      <h1 className="form-title">{title}</h1>
      {description && <p className="form-description">{description}</p>}
      <form {...formAttributes}>
        {resolvedFields.map((field) => (
          <FormFieldElement
            key={field.name}
            field={field}
            prefillValue={prefillMap[field.name]}
            lockPrefill={lockPrefill}
          />
        ))}
        <button type="submit">Submit</button>
      </form>
    </>
  )
}


function FormStepProgress({ totalVisible }: { readonly totalVisible: number }) {
  return (
    <div
      className="form-progress"
      data-form-progress="true"
      role="status"
      aria-label="Step progress"
    >
      {`Step 1 of ${totalVisible}`}
    </div>
  )
}

interface MultiStepFormProps extends FormBodyShared {
  readonly activeStep: NonNullable<Form['steps']>[number]
  readonly isLast: boolean
}

function MultiStepFormElement({
  formAttributes,
  resolvedFields,
  prefillMap,
  lockPrefill,
  activeStep,
  isLast,
}: MultiStepFormProps) {
  return (
    <form
      {...formAttributes}
      data-layout="multi-step"
      data-active-step={activeStep.id}
    >
      <FormBodyStep
        step={activeStep}
        stepIndex={0}
        isFirst={true}
        isLast={isLast}
        stepFields={resolvedFields.filter((f) => activeStep.fields.includes(f.name))}
        prefillMap={prefillMap}
        lockPrefill={lockPrefill}
      />
      {}
      <button
        type="submit"
        {...(isLast ? {} : { hidden: true })}
      >
        Submit
      </button>
    </form>
  )
}

function FormBodyMultiStep(props: FormBodyShared & { readonly steps: NonNullable<Form['steps']> }) {
  const { title, description, steps } = props
  const activeStep = steps[0]
  if (activeStep === undefined) {
    return (
      <>
        <h1 className="form-title">{title}</h1>
        {description && <p className="form-description">{description}</p>}
      </>
    )
  }
  return (
    <>
      <h1 className="form-title">{title}</h1>
      {description && <p className="form-description">{description}</p>}
      <FormStepProgress totalVisible={steps.length} />
      <MultiStepFormElement
        {...props}
        activeStep={activeStep}
        isLast={steps.length === 1}
      />
    </>
  )
}

function FormStepNav({ isFirst, isLast }: { readonly isFirst: boolean; readonly isLast: boolean }) {
  return (
    <div className="form-step-nav">
      {!isFirst && (
        <button
          type="button"
          className="step-previous"
        >
          Previous
        </button>
      )}
      {!isLast && (
        <button
          type="button"
          className="step-next"
        >
          Next
        </button>
      )}
    </div>
  )
}

function FormBodyStep({
  step,
  stepIndex,
  isFirst,
  isLast,
  stepFields,
  prefillMap,
  lockPrefill,
}: {
  readonly step: NonNullable<Form['steps']>[number]
  readonly stepIndex: number
  readonly isFirst: boolean
  readonly isLast: boolean
  readonly stepFields: ReturnType<typeof resolveAllFields>
  readonly prefillMap: Readonly<Record<string, PrefillValue>>
  readonly lockPrefill: boolean
}) {
  return (
    <div
      className="form-step"
      data-step={step.id}
      data-step-index={stepIndex}
      data-step-active="true"
    >
      {step.title && <h2 className="step-title">{step.title}</h2>}
      {step.description && <p className="step-description">{step.description}</p>}
      {stepFields.map((field) => (
        <FormFieldElement
          key={field.name}
          field={field}
          prefillValue={prefillMap[field.name]}
          lockPrefill={lockPrefill}
        />
      ))}
      <FormStepNav
        isFirst={isFirst}
        isLast={isLast}
      />
    </div>
  )
}

function FormPage({
  app,
  form,
  embed = false,
}: {
  readonly app: App
  readonly form: Form
  readonly embed?: boolean
}) {
  const { languages } = app
  const title = resolveText(form.title, languages, form.name)
  const description = resolveText(form.description, languages, '')

  return (
    <html lang={languages?.default ?? 'en'}>
      <FormHead
        title={title}
        description={description}
      />
      <body>
        <main className="form-page">
          <FormBody
            app={app}
            form={form}
            embed={embed}
          />
        </main>
      </body>
    </html>
  )
}

export function renderFormPage(app: Readonly<App>, form: Readonly<Form>): string {
  const html = renderToString(
    <FormPage
      app={app as App}
      form={form as Form}
    />
  )
  return `<!DOCTYPE html>\n${html}`
}

export function renderEmbedFormPage(app: Readonly<App>, form: Readonly<Form>): string {
  const html = renderToString(
    <FormPage
      app={app as App}
      form={form as Form}
      embed={true}
    />
  )
  return `<!DOCTYPE html>\n${html}`
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
