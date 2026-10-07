/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The two screens that follow a confirmed `enableTwoFactor`: the QR code with
 * the first code, then the recovery codes, shown once.
 *
 * Two-step is NOT on after the password: Better Auth turns it on only when a
 * first code from the authenticator verifies, so the scan screen is where the
 * enrolment actually happens. The recovery codes come back with the password
 * step and are kept in memory until that code verifies, then shown exactly
 * once — closing them asks the reader to confirm she saved them, and nothing
 * on the page can show them again.
 */

import { useMemo, useState, type FormEvent, type ReactElement } from 'react'
import { encodeQrMatrix } from '@/domain/models/app/links/qr-code-service'
import { computeButtonDefaultClasses } from '@/presentation/design/button-default-classes'
import { computeFormLayoutClasses } from '@/presentation/design/form-layout-classes'
import { postAccount } from './account-method-requests'
import { AuthFieldRow } from './auth-form-fields'

/**
 * The screens' own words in the page language, resolved server-side
 * (`twoFactor.*` in the UI catalogue, an author `sovrium.twoFactor.*` winning);
 * only the strings that differ from the English below are sent.
 */
export type EnrolmentStrings = Readonly<Record<string, string>> | undefined

const ENGLISH: Readonly<Record<string, string>> = {
  'twoFactor.qrTitle': 'QR code for your authenticator app',
  'twoFactor.keyHint': 'Or enter this key:',
  'twoFactor.code': 'Verification code',
  'twoFactor.verify': 'Verify',
  'twoFactor.recoveryCodes': 'Recovery codes',
  'twoFactor.codesSaved': 'I have saved these codes',
  'twoFactor.done': 'Done',
}

/** One of the screens' strings, in the page language. */
const say = (strings: EnrolmentStrings, key: string): string =>
  strings?.[key] ?? ENGLISH[key] ?? key

/** The code field of the scan screen, named in the page language. */
const codeField = (strings: EnrolmentStrings) =>
  ({
    name: 'code',
    label: say(strings, 'twoFactor.code'),
    required: true,
    inputType: 'text',
  }) as const
const BUTTON_CLASSES = `${computeButtonDefaultClasses()} w-full`
const noop = (): void => undefined

/** The secret an `otpauth://` address carries, for a reader who types it instead of scanning. */
const secretOf = (totpURI: string): string => /[?&]secret=([^&]+)/.exec(totpURI)?.[1] ?? ''

const QUIET_ZONE = 4

/** One path tracing the dark modules, run by run, inside a painted quiet zone. */
const qrPath = (matrix: readonly (readonly boolean[])[]): string =>
  matrix
    .flatMap((row, y) =>
      row
        .flatMap((dark, x) =>
          dark && !row[x - 1] ? [[x, row.slice(x).findIndex((cell) => !cell)] as const] : []
        )
        .map(([x, run]) => {
          const length = run === -1 ? row.length - x : run
          return `M${x + QUIET_ZONE} ${y + QUIET_ZONE}h${length}v1h-${length}z`
        })
    )
    .join('')

/** The QR code for an authenticator, drawn from its module matrix — no markup string. */
function QrCode({
  value,
  title,
}: {
  readonly value: string
  readonly title: string
}): ReactElement | null {
  const encoded = encodeQrMatrix(value)
  if (!encoded.ok) return null
  const extent = encoded.value.length + QUIET_ZONE * 2
  return (
    <svg
      role="img"
      aria-label={title}
      viewBox={`0 0 ${String(extent)} ${String(extent)}`}
      shapeRendering="crispEdges"
      className="h-48 w-48"
    >
      <rect
        width={extent}
        height={extent}
        fill="#ffffff"
      />
      <path
        fill="#000000"
        d={qrPath(encoded.value)}
      />
    </svg>
  )
}

/** The scan screen: the QR code, the secret, and the first code that turns two-step on. */
export function ScanStep({
  totpURI,
  onVerified,
  error,
  setError,
  strings,
}: {
  readonly totpURI: string
  readonly onVerified: () => void
  readonly error: string | undefined
  readonly setError: (error: string | undefined) => void
  readonly strings?: EnrolmentStrings
}): ReactElement {
  const [pending, setPending] = useState(false)
  const field = useMemo(() => codeField(strings), [strings])
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    const code = String(new FormData(event.currentTarget).get('code') ?? '').trim()
    setPending(true)
    void postAccount('/two-factor/verify-totp', { code }).then((outcome) => {
      setPending(false)
      setError(outcome.error)
      if (outcome.error === undefined) onVerified()
    })
  }
  return (
    <form
      onSubmit={submit}
      className={computeFormLayoutClasses()}
      noValidate
    >
      <QrCode
        value={totpURI}
        title={say(strings, 'twoFactor.qrTitle')}
      />
      <p>
        {say(strings, 'twoFactor.keyHint')}{' '}
        <code data-testid="totp-secret">{secretOf(totpURI)}</code>
      </p>
      <AuthFieldRow
        field={field}
        defaultValue=""
        error={undefined}
        onBlur={noop}
      />
      {error === undefined ? undefined : <div role="alert">{error}</div>}
      <button
        type="submit"
        data-component-type="button"
        disabled={pending}
        className={BUTTON_CLASSES}
      >
        {say(strings, 'twoFactor.verify')}
      </button>
    </form>
  )
}

/** The recovery codes, shown once; Done is offered only after the reader confirms she saved them. */
export function RecoveryCodesStep({
  codes,
  onDone,
  strings,
}: {
  readonly codes: readonly string[]
  readonly onDone: () => void
  readonly strings?: EnrolmentStrings
}): ReactElement {
  const [saved, setSaved] = useState(false)
  return (
    <div className={computeFormLayoutClasses()}>
      <ul
        aria-label={say(strings, 'twoFactor.recoveryCodes')}
        className="grid grid-cols-2 gap-1 font-mono"
      >
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={saved}
          onChange={(event) => setSaved(event.target.checked)}
        />
        {say(strings, 'twoFactor.codesSaved')}
      </label>
      <button
        type="button"
        data-component-type="button"
        disabled={!saved}
        className={BUTTON_CLASSES}
        onClick={onDone}
      >
        {say(strings, 'twoFactor.done')}
      </button>
    </div>
  )
}
