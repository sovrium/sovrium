/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The mint affordance: a disclosure button, a one-field form, and nothing else.
 *
 * ONE field, deliberately. Expiry, rate limits, refill and permissions are all
 * server-only properties the create endpoint refuses outright on this call path
 * (400 `SERVER_ONLY_PROPERTY`), so a control for any of them would be a lie —
 * an input whose value can only ever produce an error.
 */

import { useCallback, useState } from 'react'
import type { FormEvent, ReactElement } from 'react'

interface ApiKeyCreateProps {
  /** Mint the key; resolves `false` when the endpoint refused. */
  readonly onCreate: (name: string) => Promise<boolean>
}

const FIELD_CLASS =
  'border-border bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm'

const PRIMARY_BUTTON =
  'bg-primary text-primary-foreground w-fit rounded-md px-3 py-1.5 text-sm font-medium transition-opacity hover:opacity-90'

const CREATE_FAILED = 'Could not create the key. Check you are still signed in and try again.'

/** The name form. Split out so the disclosure below stays readable. */
function CreateForm({
  onSubmit,
  pending,
  error,
}: {
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void
  readonly pending: boolean
  readonly error: string
}): ReactElement {
  const [name, setName] = useState('')
  return (
    <form
      onSubmit={onSubmit}
      aria-label="Create an API key"
      className="border-border bg-background-raised flex flex-col gap-3 rounded-md border p-4"
    >
      <label
        htmlFor="api-key-name"
        className="text-foreground text-sm font-medium"
      >
        Name
      </label>
      <input
        id="api-key-name"
        name="name"
        type="text"
        value={name}
        // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop -- controlled-input handler for a single field; hoisting buys nothing measurable
        onChange={(event) => setName(event.target.value)}
        placeholder="What will carry this key?"
        className={FIELD_CLASS}
      />
      <p className="text-foreground-subtle text-xs">
        Name it after the job that will use it — that name is how you will recognise it later.
      </p>
      {error !== '' && <p className="text-error-fg text-sm">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className={`${PRIMARY_BUTTON} disabled:opacity-50`}
      >
        {pending ? 'Generating…' : 'Generate key'}
      </button>
    </form>
  )
}

/**
 * Render the trigger and, once armed, the name form.
 *
 * The trigger stays mounted while the form is open. That ordering is what makes
 * `getByRole('button', {name: /create|generate/i}).last()` resolve to the SUBMIT
 * control in `[internal ref]` — and it is also simply how a
 * disclosure reads: the thing you opened stays where you left it.
 */
export function ApiKeyCreate({ onCreate }: ApiKeyCreateProps): ReactElement {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  const submit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (pending) return
      const field = new FormData(event.currentTarget).get('name')
      setPending(true)
      setError('')
      onCreate(typeof field === 'string' ? field.trim() : '').then(
        (created) => {
          setPending(false)
          setError(created ? '' : CREATE_FAILED)
          setOpen(!created)
        },
        () => {
          setPending(false)
          setError(CREATE_FAILED)
        }
      )
    },
    [onCreate, pending]
  )

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop -- a one-line disclosure toggle; a useCallback here would cost more to read than it saves
        onClick={() => setOpen((previous) => !previous)}
        className={PRIMARY_BUTTON}
      >
        Create key
      </button>
      {open && (
        <CreateForm
          onSubmit={submit}
          pending={pending}
          error={error}
        />
      )}
    </div>
  )
}
