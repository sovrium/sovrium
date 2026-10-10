/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `linkAccount` and `unlinkAccount`: connect the signed-in reader's account to
 * a sign-in provider (sending the browser through it and back), or disconnect
 * it. Each is drawn only while it applies — connect while the account holds no
 * account of that provider, disconnect while it does — so a page can place the
 * pair side by side and the reader sees one of them.
 *
 * What may be connected is the server's decision: `link-social` refuses a
 * reader who may not, and disconnecting the account's only way in is refused
 * by `unlink-account`. A refusal is told in the form's alert.
 */

import { useCallback, useEffect, useState, type FormEvent, type ReactElement } from 'react'
import { computeSubmitButtonClasses } from '@/presentation/design/button-default-classes'
import { computeFormLayoutClasses } from '@/presentation/design/form-layout-classes'
import { resolveClasses } from '@/presentation/design/resolve-classes'
import { authClient } from '../runtime/auth-client'
import { dispatch, subscribe } from '../runtime/event-bus'

/** The refetch id the two controls tell each other a change by. */
const ACCOUNT_LINKS = 'auth:account-links'

export interface AccountLinkControlProps {
  readonly method: string
  readonly provider: string
  readonly submitLabel: string
  readonly pendingLabel: string
  readonly className?: string
  readonly id?: string
  readonly 'data-testid'?: string
}

/** The row id of the reader's account of `provider`, `null` when there is none. */
const findAccount = async (provider: string): Promise<string | null> => {
  const result = await authClient.listAccounts()
  const accounts = (result.data ?? []) as readonly {
    readonly id: string
    readonly providerId: string
  }[]
  return accounts.find((account) => account.providerId === provider)?.id ?? null
}

/** Start the provider's link, or remove the account; the refusal's message, if any. */
const runLinkMethod = async (
  method: string,
  provider: string,
  accountId: string | null
): Promise<string | undefined> => {
  const here = globalThis.location.pathname
  const result =
    method === 'linkAccount'
      ? await authClient.linkSocial({ provider, callbackURL: here, errorCallbackURL: here })
      : await authClient.unlinkAccount({ accountId: accountId ?? '' })
  return result.error ? (result.error.message ?? 'Request failed') : undefined
}

/** The connect or disconnect control, drawn while it applies. */
export function AccountLinkControl(props: AccountLinkControlProps): ReactElement {
  const { method, provider } = props
  // `undefined` until the reader's accounts are read; then the row id or `null`.
  const [account, setAccount] = useState<string | null | undefined>(undefined)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  const refresh = useCallback(() => {
    void findAccount(provider).then(setAccount)
  }, [provider])
  useEffect(() => {
    refresh()
    return subscribe('sovrium:refetch', (detail) => {
      if (detail.id === ACCOUNT_LINKS) refresh()
    })
  }, [refresh])

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    setPending(true)
    void runLinkMethod(method, provider, account ?? null).then((refusal) => {
      setPending(false)
      setError(refusal)
      if (refusal === undefined && method === 'unlinkAccount') {
        dispatch('sovrium:refetch', { id: ACCOUNT_LINKS })
      }
    })
  }

  const applies = account !== undefined && (method === 'linkAccount') === (account === null)
  return (
    <form
      onSubmit={submit}
      className={resolveClasses(computeFormLayoutClasses(), props.className)}
      id={props.id}
      data-testid={props['data-testid']}
      data-action-type="auth"
      data-action-method={method}
      hidden={!applies}
    >
      {error === undefined ? undefined : <div role="alert">{error}</div>}
      {applies ? (
        <button
          type="submit"
          data-component-type="button"
          disabled={pending}
          className={computeSubmitButtonClasses(undefined)}
        >
          {pending ? props.pendingLabel : props.submitLabel}
        </button>
      ) : undefined}
    </form>
  )
}
