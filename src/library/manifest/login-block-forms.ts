/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The auth forms the mirrored sign-in and sign-up screens put where shadcn draws
 * its inputs: the engine draws the email and password fields, checks them and
 * signs the reader in. Each way in is gated on what the app DECLARES.
 */

import { ifDeclared } from './auth-block-kit'
import type { BlockNode } from './block-kit'

/** The providers a block's social buttons sign in with, from a comma list. */
export const providerList = (value: string): readonly string[] =>
  value
    .split(',')
    .map((provider) => provider.trim())
    .filter((provider) => provider !== '')

export const PROVIDER_LABEL: Readonly<Record<string, string>> = {
  google: 'Google',
  github: 'GitHub',
  microsoft: 'Microsoft',
  slack: 'Slack',
  gitlab: 'GitLab',
}

export const providerLabel = (provider: string): string => PROVIDER_LABEL[provider] ?? provider

/**
 * One social sign-in per provider, outline buttons in shadcn's grid. `compact`
 * names only the provider, for the three-across row of the split screens.
 */
export const socialButtons = (options: {
  readonly providers: string
  readonly verb: string
  readonly successPath: string
  readonly className?: string
  readonly compact?: boolean
}): readonly BlockNode[] => {
  const providers = providerList(options.providers)
  return providers.length === 0
    ? []
    : [
        ifDeclared('auth.oauth', {
          type: 'flex',
          props: {
            'data-slot': 'field',
            className: `${options.className ?? 'flex flex-col gap-3'} [&_button]:w-full`,
          },
          children: providers.map((provider) => ({
            type: 'form',
            action: {
              type: 'auth',
              method: 'login',
              strategy: 'oauth',
              provider,
              submitLabel:
                options.compact === true
                  ? providerLabel(provider)
                  : `${options.verb} ${providerLabel(provider)}`,
              onSuccess: { navigate: options.successPath },
            },
          })),
        }),
      ]
}

export const EMAIL_FIELD = { name: 'email', placeholder: 'm@example.com' } as const

export const passwordForm = (
  submitLabel: string,
  successPath: string,
  twoStepPath: string
): BlockNode => ({
  type: 'form',
  action: {
    type: 'auth',
    method: 'login',
    strategy: 'email',
    submitLabel,
    fields: [EMAIL_FIELD],
    onSuccess: { navigate: successPath },
    onTwoFactor: { navigate: twoStepPath },
  },
})

export const signUpForm = (submitLabel: string, successPath: string): BlockNode => ({
  type: 'form',
  action: {
    type: 'auth',
    method: 'signup',
    strategy: 'email',
    submitLabel,
    fields: [EMAIL_FIELD],
    onSuccess: { navigate: successPath },
  },
})

export const magicLinkForm = (submitLabel: string): BlockNode => ({
  type: 'form',
  action: {
    type: 'auth',
    method: 'login',
    strategy: 'magicLink',
    submitLabel,
    fields: [EMAIL_FIELD],
    onSuccess: {
      type: 'successPage',
      title: 'Check your inbox',
      message:
        'We sent a sign-in link to $form.email. It works once and expires soon. Nothing there? Check your spam folder, or send a new one.',
    },
  },
})
