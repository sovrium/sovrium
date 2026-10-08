/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The account methods of an auth form, loaded only by a page that holds one:
 * the second-factor step (`verifyTwoFactor`), two-step on and off, answering an
 * invitation from its link, a new API key shown once, and signing the other
 * devices out.
 *
 * Each submit is one request to the engine's own endpoint
 * (`account-method-requests.ts`); what follows is the method's: a navigation
 * (`onSuccess.navigate`) once the reader is signed in, a confirmation in the
 * form's status slot, or the next screen — the QR code and recovery codes of
 * an enrolment, a key revealed once. A refusal is told in the form's alert.
 */

import { useState, type FormEvent, type ReactElement } from 'react'
import { toSafeRedirectPath } from '@/domain/kernel/url/redirect-safety'
import {
  computeSubmitButtonClasses,
  type ButtonVariant,
} from '@/presentation/design/button-default-classes'
import {
  AUTH_ERROR_BANNER_STYLE,
  AUTH_SUCCESS_BANNER_STYLE,
  computeAuthFeedbackBannerClasses,
  computeFormLayoutClasses,
} from '@/presentation/design/form-layout-classes'
import { resolveClasses } from '@/presentation/design/resolve-classes'
import { dispatch as dispatchIslandEvent } from '../runtime/event-bus'
import {
  ACCOUNT_SUCCESS_MESSAGES,
  CHANGED_ACCOUNT_LIST,
  accountRequest,
  postAccount,
} from './account-method-requests'
import { KeyReveal } from './api-key-reveal'
import { AuthErrorSummary, AuthFieldRow } from './auth-form-fields'
import { validateAllFields, type AuthFormField, type FieldErrors } from './auth-form-validation'
import { RecoveryCodesStep, ScanStep, type EnrolmentStrings } from './two-factor-enrolment'

export interface AccountMethodFormProps {
  readonly method: string
  readonly fields: readonly AuthFormField[]
  readonly submitLabel: string
  readonly pendingLabel: string
  /** The submit's weight (`action.submitVariant`); absent keeps the primary fill. */
  readonly submitVariant?: ButtonVariant
  readonly redirectUrl?: string
  readonly factor?: string
  readonly trustDevice?: boolean
  readonly tokenParam?: string
  /** The enrolment screens' strings in the page language (`twoFactor.*`). */
  readonly uiStrings?: EnrolmentStrings
  readonly className?: string
  readonly id?: string
  readonly 'data-testid'?: string
  /** What the reader typed before this form loaded, by field name. */
  readonly initialValues?: Readonly<Record<string, string>>
}

/** The screen the form is on. */
type Stage =
  | { readonly kind: 'form' }
  | { readonly kind: 'scan'; readonly totpURI: string; readonly codes: readonly string[] }
  | { readonly kind: 'codes'; readonly codes: readonly string[] }
  | { readonly kind: 'key'; readonly key: string }

/** The methods that end with the reader signed in, and so follow `onSuccess.navigate`. */
const SIGNS_IN: ReadonlySet<string> = new Set(['verifyTwoFactor', 'acceptInvitation'])

const FORM_STAGE: Stage = { kind: 'form' }
const noop = (): void => undefined

/** The stage a successful request leads to, from what it answered. */
function nextStage(method: string, data: Readonly<Record<string, unknown>> | undefined): Stage {
  if (method === 'enableTwoFactor' && typeof data?.['totpURI'] === 'string') {
    const codes = Array.isArray(data['backupCodes']) ? data['backupCodes'].map(String) : []
    return { kind: 'scan', totpURI: data['totpURI'], codes }
  }
  if (method === 'createApiKey' && typeof data?.['key'] === 'string') {
    return { kind: 'key', key: data['key'] }
  }
  return FORM_STAGE
}

/** The status and alert slots, as the credential form draws them. */
function Feedback({
  error,
  success,
}: {
  readonly error?: string
  readonly success?: string
}): ReactElement | undefined {
  if (error === undefined && success === undefined) return undefined
  return (
    <div
      role={error === undefined ? 'status' : 'alert'}
      className={computeAuthFeedbackBannerClasses()}
      style={error === undefined ? AUTH_SUCCESS_BANNER_STYLE : AUTH_ERROR_BANNER_STYLE}
    >
      {error ?? success}
    </div>
  )
}

/** The form's submit and what it leads to: its screen, its errors, its result. */
function useAccountSubmit(props: AccountMethodFormProps) {
  const { method, fields } = props
  const [stage, setStage] = useState<Stage>(FORM_STAGE)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [result, setResult] = useState<{ error?: string; success?: string }>({})
  const [pending, setPending] = useState(false)

  const succeed = (data: Readonly<Record<string, unknown>> | undefined): void => {
    const changed = CHANGED_ACCOUNT_LIST[method]
    if (changed !== undefined) dispatchIslandEvent('sovrium:refetch', { id: changed })
    const target = toSafeRedirectPath(props.redirectUrl)
    if (SIGNS_IN.has(method) && target !== undefined) {
      globalThis.location.assign(target)
      return
    }
    setStage(nextStage(method, data))
    setResult({ success: ACCOUNT_SUCCESS_MESSAGES[method] })
  }

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const values = Object.fromEntries(fields.map((f) => [f.name, String(form.get(f.name) ?? '')]))
    const invalid = validateAllFields(fields, values)
    setErrors(invalid)
    const request = accountRequest(method, values, {
      factor: props.factor,
      trustDevice: form.get('trustDevice') === 'on',
      tokenParam: props.tokenParam,
    })
    if (Object.keys(invalid).length > 0 || request === undefined) return
    setPending(true)
    void postAccount(request.path, request.body).then((outcome) => {
      setPending(false)
      if (outcome.error !== undefined) return setResult({ error: outcome.error })
      return succeed(outcome.data)
    })
  }

  return { stage, setStage, errors, result, setResult, pending, submit }
}

/** The screens that follow the form, or `undefined` while the form itself is shown. */
function NextScreen({
  state,
  strings,
}: {
  readonly state: ReturnType<typeof useAccountSubmit>
  readonly strings: EnrolmentStrings
}): ReactElement | undefined {
  const { stage, setStage, result, setResult } = state
  if (stage.kind === 'scan')
    return (
      <ScanStep
        totpURI={stage.totpURI}
        error={result.error}
        setError={(error) => setResult({ error })}
        onVerified={() => setStage({ kind: 'codes', codes: stage.codes })}
        strings={strings}
      />
    )
  if (stage.kind === 'codes')
    return (
      <RecoveryCodesStep
        codes={stage.codes}
        onDone={() => setStage(FORM_STAGE)}
        strings={strings}
      />
    )
  if (stage.kind === 'key')
    return (
      <KeyReveal
        secret={stage.key}
        onDone={() => setStage(FORM_STAGE)}
      />
    )
  return undefined
}

/** The account form: its fields, then whatever screen the method leads to. */
export function AccountMethodForm(props: AccountMethodFormProps): ReactElement {
  const { method, fields } = props
  const state = useAccountSubmit(props)
  const { errors, result, pending, submit } = state
  if (state.stage.kind !== 'form')
    return (
      <NextScreen
        state={state}
        strings={props.uiStrings}
      />
    )

  return (
    <form
      onSubmit={submit}
      className={resolveClasses(computeFormLayoutClasses(), props.className)}
      id={props.id}
      data-testid={props['data-testid']}
      data-action-type="auth"
      data-action-method={method}
      noValidate
    >
      <AuthErrorSummary
        fields={fields}
        errors={errors}
      />
      {fields.map((field) => (
        <AuthFieldRow
          key={field.name}
          field={field}
          defaultValue={props.initialValues?.[field.name] ?? ''}
          error={errors[field.name]}
          onBlur={noop}
        />
      ))}
      {method === 'verifyTwoFactor' && props.trustDevice === true ? (
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="trustDevice"
          />
          Trust this device
        </label>
      ) : undefined}
      <Feedback {...result} />
      <button
        type="submit"
        data-component-type="button"
        disabled={pending}
        className={`${computeSubmitButtonClasses(props.submitVariant)} w-full`}
      >
        {pending ? props.pendingLabel : props.submitLabel}
      </button>
    </form>
  )
}
