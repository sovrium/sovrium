/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

export interface AuthFormField {
  readonly name: string
  readonly label: string
  readonly required: boolean
  readonly placeholder?: string
  readonly inputType: 'email' | 'password' | 'text'
}

export type AuthMethod = 'login' | 'signup' | 'logout' | 'resetPassword' | 'setNewPassword'

const SUBMIT_LABELS: Record<AuthMethod, string> = {
  login: 'Sign In',
  signup: 'Sign Up',
  logout: 'Log Out',
  resetPassword: 'Send Reset Link',
  setNewPassword: 'Set New Password',
}

export function authSubmitLabel(method: string | undefined): string {
  return SUBMIT_LABELS[method as AuthMethod] ?? SUBMIT_LABELS.login
}

const PENDING_LABELS: Record<AuthMethod, string> = {
  login: 'Signing in…',
  signup: 'Creating account…',
  logout: 'Logging out…',
  resetPassword: 'Sending…',
  setNewPassword: 'Saving…',
}

export function authPendingLabel(method: string | undefined): string {
  return PENDING_LABELS[method as AuthMethod] ?? PENDING_LABELS.login
}

const EMAIL_FIELD: AuthFormField = {
  name: 'email',
  label: 'Email',
  required: true,
  inputType: 'email',
}

const PASSWORD_FIELD: AuthFormField = {
  name: 'password',
  label: 'Password',
  required: true,
  inputType: 'password',
}

export function defaultAuthFields(method: string): readonly AuthFormField[] {
  if (method === 'setNewPassword') return [PASSWORD_FIELD]
  if (method === 'resetPassword') return [EMAIL_FIELD]
  return [EMAIL_FIELD, PASSWORD_FIELD]
}
