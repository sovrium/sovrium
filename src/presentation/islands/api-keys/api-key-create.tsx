/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The mint affordance: a button that opens a dialog holding a one-field form.
 *
 * ONE field, deliberately. Expiry, rate limits, refill and permissions are all
 * server-only properties the create endpoint refuses outright on this call path
 * (400 `SERVER_ONLY_PROPERTY`), so a control for any of them would be a lie —
 * an input whose value can only ever produce an error.
 *
 * The dialog is the platform's own modal `<dialog>`, drawn on shadcn/ui's
 * `Dialog` anatomy: `showModal()` gives the page inertness, Escape and the
 * return of focus for nothing, where a headless dialog library would cost this
 * island several times its own weight for the same three behaviours.
 */

import { useCallback, useId, useLayoutEffect, useRef, useState } from 'react'
import { computeButtonDefaultClasses } from '@/presentation/design/button-default-classes'
import {
  computeDialogDescriptionClasses,
  computeDialogFooterClasses,
  computeDialogHeaderClasses,
  computeDialogTitleClasses,
  computeNativeDialogContentClasses,
} from '@/presentation/design/dialog-default-classes'
import {
  computeFieldClasses,
  computeFieldDescriptionClasses,
  computeFieldErrorClasses,
  computeFieldLabelClasses,
} from '@/presentation/design/field-default-classes'
import { computeInputDefaultClasses } from '@/presentation/design/input-default-classes'
import { pendingControlProps } from '@/presentation/design/pending-state'
import { useApiKeyWord as useWord } from './api-key-strings'
import type { FormEvent, ReactElement } from 'react'

interface ApiKeyCreateProps {
  /** Mint the key; resolves `false` when the endpoint refused. */
  readonly onCreate: (name: string) => Promise<boolean>
}

/** The name field: its label, the control, its help and, after a refusal, the error. */
function NameField({ error }: { readonly error: string }): ReactElement {
  const id = useId()
  return (
    <div
      data-slot="field"
      data-orientation="vertical"
      {...(error !== '' && { 'data-invalid': 'true' })}
      className={computeFieldClasses()}
    >
      <label
        data-slot="field-label"
        htmlFor={id}
        className={computeFieldLabelClasses()}
      >
        {useWord('name', 'Name')}
      </label>
      <input
        id={id}
        data-slot="input"
        name="name"
        type="text"
        placeholder={useWord('namePlaceholder', 'e.g. Zapier sync')}
        aria-describedby={`${id}-help`}
        {...(error !== '' && { 'aria-invalid': 'true' })}
        className={computeInputDefaultClasses()}
      />
      <p
        id={`${id}-help`}
        data-slot="field-description"
        className={computeFieldDescriptionClasses()}
      >
        {useWord(
          'nameHint',
          'Name it after the job that will use it — that name is how you will recognise it later.'
        )}
      </p>
      {error !== '' && (
        <p
          role="alert"
          data-slot="field-error"
          className={computeFieldErrorClasses()}
        >
          {error}
        </p>
      )}
    </div>
  )
}

/** The dialog's title and the sentence under it. */
function CreateDialogHeader({ titleId }: { readonly titleId: string }): ReactElement {
  return (
    <div
      data-slot="dialog-header"
      className={computeDialogHeaderClasses()}
    >
      <h2
        id={titleId}
        data-slot="dialog-title"
        className={computeDialogTitleClasses()}
      >
        {useWord('createTitle', 'Create an API key')}
      </h2>
      <p
        data-slot="dialog-description"
        className={computeDialogDescriptionClasses()}
      >
        {useWord(
          'createBody',
          'The key acts as you. You see its value once, right after you create it.'
        )}
      </p>
    </div>
  )
}

/** The submit's word while the key is minted, and before. */
const useSubmitWord = (pending: boolean): string =>
  useWord(pending ? 'generating' : 'generate', pending ? 'Generating…' : 'Generate key')

/** The modal holding the name form. Mounting it opens it; closing it, by any road, unmounts it. */
function CreateDialog({
  onSubmit,
  onClose,
  pending,
  error,
}: {
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void
  readonly onClose: () => void
  readonly pending: boolean
  readonly error: string
}): ReactElement {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const submit = useSubmitWord(pending)
  useLayoutEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])
  const cancel = useCallback(() => ref.current?.close(), [])
  return (
    <dialog
      ref={ref}
      data-slot="dialog-content"
      data-open=""
      aria-labelledby={titleId}
      onClose={onClose}
      className={computeNativeDialogContentClasses()}
    >
      <form
        onSubmit={onSubmit}
        aria-labelledby={titleId}
        className="grid gap-4"
      >
        <CreateDialogHeader titleId={titleId} />
        <NameField error={error} />
        <div
          data-slot="dialog-footer"
          className={computeDialogFooterClasses()}
        >
          <button
            type="button"
            data-slot="button"
            onClick={cancel}
            className={computeButtonDefaultClasses({ variant: 'outline' })}
          >
            {useWord('cancel', 'Cancel')}
          </button>
          <button
            type="submit"
            data-slot="button"
            {...pendingControlProps(pending)}
            className={computeButtonDefaultClasses()}
          >
            {submit}
          </button>
        </div>
      </form>
    </dialog>
  )
}

/**
 * Render the trigger and, once pressed, the dialog.
 *
 * The trigger stays mounted while the dialog is open and the dialog follows it
 * in the document. That ordering is what makes
 * `getByRole('button', {name: /create|generate/i}).last()` resolve to the
 * SUBMIT control: the thing you opened stays where you left it, and focus goes
 * back to it when the dialog closes.
 */
export function ApiKeyCreate({ onCreate }: ApiKeyCreateProps): ReactElement {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const trigger = useRef<HTMLButtonElement>(null)
  const createFailed = useWord(
    'createFailed',
    'Could not create the key. Check you are still signed in and try again.'
  )

  const close = useCallback(() => {
    setOpen(false)
    setError('')
    trigger.current?.focus()
  }, [])

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
          setError(created ? '' : createFailed)
          if (created) close()
        },
        () => {
          setPending(false)
          setError(createFailed)
        }
      )
    },
    [close, createFailed, onCreate, pending]
  )

  return (
    <div className="flex justify-end">
      <button
        ref={trigger}
        type="button"
        data-slot="button"
        onClick={() => setOpen(true)}
        className={computeButtonDefaultClasses()}
      >
        {useWord('create', 'Create key')}
      </button>
      {open && (
        <CreateDialog
          onSubmit={submit}
          onClose={close}
          pending={pending}
          error={error}
        />
      )}
    </div>
  )
}
