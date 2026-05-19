/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { connectionError } from './error-envelopes'
import type { Context } from 'hono'

export interface OAuth2Props {
  readonly clientId: string
  readonly clientSecret: string
  readonly authorizationUrl?: string
  readonly tokenUrl?: string
  readonly scopes?: readonly string[]
  readonly redirectUri?: string
  readonly grantType?: string
  readonly pkce?: 'S256' | 'plain' | 'none'
  readonly audience?: string
  readonly extraAuthParams?: Readonly<Record<string, string>>
  readonly extraTokenParams?: Readonly<Record<string, string>>
  readonly scope?: 'app' | 'user'
  readonly authenticationMethod?: 'header' | 'body'
}

export interface OAuth2AuthCodeProps extends OAuth2Props {
  readonly authorizationUrl: string
  readonly tokenUrl: string
  readonly redirectUri: string
}

const isMissingString = (value: string | undefined): boolean => value === undefined || value === ''

export const requireAuthCodeFields = (
  c: Context,
  props: OAuth2Props
): { readonly response: Response } | { readonly props: OAuth2AuthCodeProps } => {
  const missing: readonly string[] = (
    [
      ['authorizationUrl', props.authorizationUrl],
      ['tokenUrl', props.tokenUrl],
      ['redirectUri', props.redirectUri],
    ] as const
  )
    .filter(([, value]) => isMissingString(value))
    .map(([name]) => name)
  if (missing.length > 0) {
    return {
      response: connectionError(c, 500, 'connection_misconfigured', {
        message: `OAuth2 authorization-code flow requires: ${missing.join(', ')}`,
      }),
    }
  }
  return { props: props as OAuth2AuthCodeProps }
}
