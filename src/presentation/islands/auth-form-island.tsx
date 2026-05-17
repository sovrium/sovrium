/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { useState } from 'react'
import { authClient } from './shared/auth-client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AuthMethod = 'login' | 'signup' | 'resetPassword' | 'setNewPassword'

interface AuthFormIslandProps {
  readonly method: AuthMethod
  readonly redirectUrl?: string
  readonly toastMessage?: string
  readonly className?: string
  readonly id?: string
  readonly 'data-testid'?: string
  readonly initialValues?: Record<string, string>
}

interface AuthState {
  readonly error?: string
  readonly success?: string
  readonly isPending: boolean
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUBMIT_LABELS: Record<string, string> = {
  login: 'Sign In',
  signup: 'Sign Up',
  resetPassword: 'Send Reset Link',
  setNewPassword: 'Set New Password',
}

// ---------------------------------------------------------------------------
// Auth method handlers (pure async functions)
// ---------------------------------------------------------------------------

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
    case 'resetPassword': {
      const error = await handleResetPasswordRequest(email)
      return error ? { error } : { success: 'Check your email — a reset link has been sent' }
    }
    case 'setNewPassword':
      return { error: await handleSetNewPassword(password) }
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function AuthFormFields({
  method,
  email,
  password,
  onEmailChange,
  onPasswordChange,
}: {
  readonly method: AuthMethod
  readonly email: string
  readonly password: string
  readonly onEmailChange: (value: string) => void
  readonly onPasswordChange: (value: string) => void
}) {
  return (
    <>
      {method !== 'setNewPassword' && (
        <label>
          Email
          <input
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop -- single-input auth form; re-render cost negligible vs network round-trip on submit
            onChange={(e) => onEmailChange(e.target.value)}
          />
        </label>
      )}
      {method !== 'resetPassword' && (
        <label>
          Password
          <input
            type="password"
            name="password"
            autoComplete={method === 'signup' ? 'new-password' : 'current-password'}
            value={password}
            // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop -- single-input auth form; re-render cost negligible vs network round-trip on submit
            onChange={(e) => onPasswordChange(e.target.value)}
          />
        </label>
      )}
    </>
  )
}

function AuthFormFeedback({ state }: { readonly state: AuthState }) {
  if (state.error) {
    return (
      <div
        data-error=""
        role="alert"
      >
        {state.error}
      </div>
    )
  }
  if (state.success) {
    return (
      <div
        data-error=""
        data-success=""
        role="status"
      >
        {state.success}
      </div>
    )
  }
  return <div data-error="" />
}

// ---------------------------------------------------------------------------
// Submit handler (extracted to stay within max-lines-per-function)
// ---------------------------------------------------------------------------

async function submitAuthForm(ctx: {
  readonly method: AuthMethod
  readonly email: string
  readonly password: string
  readonly redirectUrl: string | undefined
  readonly setState: (s: AuthState) => void
}): Promise<void> {
  ctx.setState({ isPending: true })
  try {
    const result = await executeAuthMethod(ctx.method, ctx.email, ctx.password)
    if (result.error || result.success) {
      ctx.setState({ ...result, isPending: false })
      return
    }
    if (ctx.redirectUrl?.startsWith('/')) {
      globalThis.location.assign(ctx.redirectUrl)
    } else {
      ctx.setState({ isPending: false })
    }
  } catch (err) {
    ctx.setState({
      error: err instanceof Error ? err.message : 'An error occurred',
      isPending: false,
    })
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AuthFormIsland(props: AuthFormIslandProps) {
  const { method, redirectUrl, className, initialValues } = props
  const [email, setEmail] = useState(initialValues?.email ?? '')
  const [password, setPassword] = useState(initialValues?.password ?? '')
  const [state, setState] = useState<AuthState>({ isPending: false })

  return (
    <form
      // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop -- single-form submit handler; closure deps include 4 state values whose changes are the actual driver of re-renders
      onSubmit={(e) => {
        e.preventDefault()
        void submitAuthForm({ method, email, password, redirectUrl, setState })
      }}
      className={className}
      id={props.id}
      data-testid={props['data-testid']}
      data-action-type="auth"
      data-action-method={method}
      noValidate
    >
      <AuthFormFields
        method={method}
        email={email}
        password={password}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
      />
      <AuthFormFeedback state={state} />
      <button
        type="submit"
        disabled={state.isPending}
        className="btn btn-primary"
      >
        {state.isPending ? 'Loading...' : (SUBMIT_LABELS[method] ?? 'Submit')}
      </button>
    </form>
  )
}
