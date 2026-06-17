/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type AuthMethod } from '@/presentation/utils/auth-form-types'
import { showSuccessToast } from '../components/crud-form/toast'
import { authClient } from '../shared/auth-client'
import { type AuthFormField } from './auth-form-validation'

export { type AuthMethod }

export interface ToastConfig {
  readonly message?: string
  readonly variant?: string
}

export interface AuthState {
  readonly error?: string
  readonly success?: string
  readonly isPending: boolean
}

function pickCredentials(
  fields: readonly AuthFormField[],
  values: Readonly<Record<string, string>>
): { email: string; password: string } {
  const emailField = fields.find((f) => f.inputType === 'email')
  const passwordField = fields.find((f) => f.inputType === 'password')
  return {
    email: emailField ? (values[emailField.name] ?? '') : '',
    password: passwordField ? (values[passwordField.name] ?? '') : '',
  }
}

async function handleLogin(email: string, password: string): Promise<string | undefined> {
  const result = await authClient.signIn.email({ email, password })
  return result.error ? (result.error.message ?? 'Authentication failed') : undefined
}

async function handleSignup(email: string, password: string): Promise<string | undefined> {
  const result = await authClient.signUp.email({
    email,
    password,
    name: email.split('@')[0] ?? '',
  })
  return result.error ? (result.error.message ?? 'Sign up failed') : undefined
}

async function handleLogout(): Promise<string | undefined> {
  const result = await authClient.signOut()
  return result.error ? (result.error.message ?? 'Sign out failed') : undefined
}

async function handleResetPasswordRequest(email: string): Promise<string | undefined> {
  const result = await authClient.requestPasswordReset({
    email,
    redirectTo: '/auth/reset-password',
  })
  return result.error ? (result.error.message ?? 'Password reset request failed') : undefined
}

async function handleSetNewPassword(password: string): Promise<string | undefined> {
  const token = new URLSearchParams(globalThis.location?.search ?? '').get('token') ?? ''
  const result = await authClient.resetPassword({ newPassword: password, token })
  return result.error ? (result.error.message ?? 'Password reset failed') : undefined
}

async function executeAuthMethod(
  method: AuthMethod,
  email: string,
  password: string
): Promise<{ error?: string; success?: string }> {
  switch (method) {
    case 'login':
      return { error: await handleLogin(email, password) }
    case 'signup':
      return { error: await handleSignup(email, password) }
    case 'logout':
      return { error: await handleLogout() }
    case 'resetPassword': {
      const error = await handleResetPasswordRequest(email)
      return error ? { error } : { success: 'Check your email — a reset link has been sent' }
    }
    case 'setNewPassword':
      return { error: await handleSetNewPassword(password) }
  }
}

export interface SubmitContext {
  readonly method: AuthMethod
  readonly fields: readonly AuthFormField[]
  readonly values: Readonly<Record<string, string>>
  readonly redirectUrl: string | undefined
  readonly successToast: ToastConfig | undefined
  readonly errorToast: ToastConfig | undefined
  readonly setState: (s: AuthState) => void
}

function fireToast(toast: ToastConfig | undefined): void {
  if (toast?.message) {
    showSuccessToast({ message: toast.message, variant: toast.variant })
  }
}

function handleAuthSuccess(ctx: SubmitContext): void {
  fireToast(ctx.successToast)
  if (ctx.redirectUrl?.startsWith('/')) {
    const target = ctx.redirectUrl
    setTimeout(() => globalThis.location.assign(target), 500)
  } else {
    ctx.setState({ isPending: false })
  }
}

export async function submitAuthForm(ctx: SubmitContext): Promise<void> {
  ctx.setState({ isPending: true })
  try {
    const { email, password } = pickCredentials(ctx.fields, ctx.values)
    const result = await executeAuthMethod(ctx.method, email, password)
    if (result.error) {
      fireToast(ctx.errorToast)
      ctx.setState({ error: result.error, isPending: false })
      return
    }
    if (result.success) {
      ctx.setState({ success: result.success, isPending: false })
      return
    }
    handleAuthSuccess(ctx)
  } catch (err) {
    ctx.setState({
      error: err instanceof Error ? err.message : 'An error occurred',
      isPending: false,
    })
  }
}
