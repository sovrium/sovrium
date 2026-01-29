/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect, describe, mock } from 'bun:test'
import { Effect, Layer } from 'effect'
import { createAuthLayer, Auth, AuthError } from './layer'
import type { Auth as AuthConfig } from '@/domain/models/app/auth'

describe('Auth Context Tag', () => {
  test('is a valid Effect Context Tag', () => {
    expect(Auth).toBeDefined()
    expect(Auth.key).toBe('Auth')
  })

  test('has correct service shape', () => {
    const mockAuth = {
      api: {} as any,
      handler: {} as any,
      getSession: () => Effect.succeed(null),
      requireSession: () => Effect.succeed({} as any),
    }

    const layer = Layer.succeed(Auth, mockAuth)
    expect(layer).toBeDefined()
  })
})

describe('AuthError', () => {
  test('creates error with string cause', () => {
    const error = new AuthError('Test error')
    expect(error.cause).toBe('Test error')
    expect(error._tag).toBe('AuthError')
  })

  test('creates error with Error object', () => {
    const originalError = new Error('Original error')
    const authError = new AuthError(originalError)
    expect(authError.cause).toBe(originalError)
    expect(authError._tag).toBe('AuthError')
  })

  test('creates error with unknown value', () => {
    const customCause = { custom: 'error' }
    const authError = new AuthError(customCause)
    expect(authError.cause).toBe(customCause)
    expect(authError._tag).toBe('AuthError')
  })
})

describe('createAuthLayer', () => {
  test('creates layer with undefined config', () => {
    const layer = createAuthLayer(undefined)
    expect(layer).toBeDefined()
  })

  test('creates layer with empty config', () => {
    const authConfig: AuthConfig = {}
    const layer = createAuthLayer(authConfig)
    expect(layer).toBeDefined()
  })

  test('creates layer with email and password config', () => {
    const authConfig: AuthConfig = {
      emailAndPassword: {
        requireEmailVerification: true,
      },
    }
    const layer = createAuthLayer(authConfig)
    expect(layer).toBeDefined()
  })

  test('creates layer with OAuth config', () => {
    const authConfig: AuthConfig = {
      oauth: {
        providers: ['google', 'github'],
      },
    }
    const layer = createAuthLayer(authConfig)
    expect(layer).toBeDefined()
  })

  test('creates layer with all features enabled', () => {
    const authConfig: AuthConfig = {
      emailAndPassword: true,
      oauth: { providers: ['google'] },
      admin: true,
      twoFactor: true,
      magicLink: true,
    }
    const layer = createAuthLayer(authConfig)
    expect(layer).toBeDefined()
  })
})

describe('Auth service - getSession', () => {
  test('returns session when available', async () => {
    const mockSession = {
      user: { id: 'user-123', email: 'user@example.com' },
      session: { id: 'session-123', expiresAt: new Date() },
    }

    // Create a mock auth instance with successful getSession
    const mockAuthInstance = {
      api: {
        getSession: mock(async () => mockSession),
      },
      handler: mock(() => Promise.resolve(new Response())),
    }

    // Create layer with mock (cast to any for test mock compatibility)

    const testLayer = Layer.succeed(Auth, {
      api: mockAuthInstance.api,
      handler: mockAuthInstance.handler,
      getSession: (_headers: Headers) =>
        Effect.tryPromise({
          try: () => mockAuthInstance.api.getSession(),
          catch: (error: unknown) => new AuthError(error),
        }),
      requireSession: (_headers: Headers) =>
        Effect.tryPromise({
          try: () => mockAuthInstance.api.getSession(),
          catch: (error: unknown) => new AuthError(error),
        }).pipe(
          Effect.flatMap((session) =>
            session ? Effect.succeed(session) : Effect.fail(new AuthError('Unauthorized'))
          )
        ),
    } as any)

    const program = Effect.gen(function* () {
      const auth = yield* Auth
      const headers = new Headers({ Authorization: 'Bearer token' })
      return yield* auth.getSession(headers)
    })

    const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)))

    expect(result).toEqual(mockSession as any)
    expect(mockAuthInstance.api.getSession).toHaveBeenCalledTimes(1)
  })

  test('returns null when no session', async () => {
    const mockAuthInstance = {
      api: {
        getSession: mock(async () => null),
      },
      handler: mock(() => Promise.resolve(new Response())),
    }

    const testLayer = Layer.succeed(Auth, {
      api: mockAuthInstance.api,
      handler: mockAuthInstance.handler,
      getSession: (_headers: Headers) =>
        Effect.tryPromise({
          try: () => mockAuthInstance.api.getSession(),
          catch: (error: unknown) => new AuthError(error),
        }),
      requireSession: (_headers: Headers) =>
        Effect.tryPromise({
          try: () => mockAuthInstance.api.getSession(),
          catch: (error: unknown) => new AuthError(error),
        }).pipe(
          Effect.flatMap((session) =>
            session ? Effect.succeed(session) : Effect.fail(new AuthError('Unauthorized'))
          )
        ),
    } as any)

    const program = Effect.gen(function* () {
      const auth = yield* Auth
      const headers = new Headers()
      return yield* auth.getSession(headers)
    })

    const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)))

    expect(result).toBeNull()
  })

  test('handles errors gracefully', async () => {
    const mockAuthInstance = {
      api: {
        getSession: mock(async () => {
          throw new Error('Database connection failed')
        }),
      },
      handler: mock(() => Promise.resolve(new Response())),
    }

    const testLayer = Layer.succeed(Auth, {
      api: mockAuthInstance.api,
      handler: mockAuthInstance.handler,
      getSession: (_headers: Headers) =>
        Effect.tryPromise({
          try: () => mockAuthInstance.api.getSession(),
          catch: (error: unknown) => new AuthError(error),
        }),
      requireSession: (_headers: Headers) =>
        Effect.tryPromise({
          try: () => mockAuthInstance.api.getSession(),
          catch: (error: unknown) => new AuthError(error),
        }).pipe(
          Effect.flatMap((session) =>
            session ? Effect.succeed(session) : Effect.fail(new AuthError('Unauthorized'))
          )
        ),
    } as any)

    const program = Effect.gen(function* () {
      const auth = yield* Auth
      const headers = new Headers()
      return yield* auth.getSession(headers)
    })

    const result = await Effect.runPromise(program.pipe(Effect.either, Effect.provide(testLayer)))

    expect(result._tag).toBe('Left')
    if (result._tag === 'Left') {
      expect(result.left).toBeInstanceOf(AuthError)
      expect(result.left.cause).toBeInstanceOf(Error)
      expect((result.left.cause as Error).message).toBe('Database connection failed')
    }
  })
})

describe('Auth service - requireSession', () => {
  test('returns session when available', async () => {
    const mockSession = {
      user: { id: 'user-123', email: 'user@example.com' },
      session: { id: 'session-123', expiresAt: new Date() },
    }

    const mockAuthInstance = {
      api: {
        getSession: mock(async () => mockSession),
      },
      handler: mock(() => Promise.resolve(new Response())),
    }

    const testLayer = Layer.succeed(Auth, {
      api: mockAuthInstance.api,
      handler: mockAuthInstance.handler,
      getSession: (_headers: Headers) =>
        Effect.tryPromise({
          try: () => mockAuthInstance.api.getSession(),
          catch: (error: unknown) => new AuthError(error),
        }),
      requireSession: (_headers: Headers) =>
        Effect.tryPromise({
          try: () => mockAuthInstance.api.getSession(),
          catch: (error: unknown) => new AuthError(error),
        }).pipe(
          Effect.flatMap((session) =>
            session ? Effect.succeed(session) : Effect.fail(new AuthError('Unauthorized'))
          )
        ),
    } as any)

    const program = Effect.gen(function* () {
      const auth = yield* Auth
      const headers = new Headers({ Authorization: 'Bearer token' })
      return yield* auth.requireSession(headers)
    })

    const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)))

    expect(result).toEqual(mockSession as any)
  })

  test('fails when no session', async () => {
    const mockAuthInstance = {
      api: {
        getSession: mock(async () => null),
      },
      handler: mock(() => Promise.resolve(new Response())),
    }

    const testLayer = Layer.succeed(Auth, {
      api: mockAuthInstance.api,
      handler: mockAuthInstance.handler,
      getSession: (_headers: Headers) =>
        Effect.tryPromise({
          try: () => mockAuthInstance.api.getSession(),
          catch: (error: unknown) => new AuthError(error),
        }),
      requireSession: (_headers: Headers) =>
        Effect.tryPromise({
          try: () => mockAuthInstance.api.getSession(),
          catch: (error: unknown) => new AuthError(error),
        }).pipe(
          Effect.flatMap((session) =>
            session ? Effect.succeed(session) : Effect.fail(new AuthError('Unauthorized'))
          )
        ),
    } as any)

    const program = Effect.gen(function* () {
      const auth = yield* Auth
      const headers = new Headers()
      return yield* auth.requireSession(headers)
    })

    const result = await Effect.runPromise(program.pipe(Effect.either, Effect.provide(testLayer)))

    expect(result._tag).toBe('Left')
    if (result._tag === 'Left') {
      expect(result.left).toBeInstanceOf(AuthError)
      expect(result.left.cause).toBe('Unauthorized')
    }
  })

  test('fails when getSession throws error', async () => {
    const mockAuthInstance = {
      api: {
        getSession: mock(async () => {
          throw new Error('Network error')
        }),
      },
      handler: mock(() => Promise.resolve(new Response())),
    }

    const testLayer = Layer.succeed(Auth, {
      api: mockAuthInstance.api,
      handler: mockAuthInstance.handler,
      getSession: (_headers: Headers) =>
        Effect.tryPromise({
          try: () => mockAuthInstance.api.getSession(),
          catch: (error: unknown) => new AuthError(error),
        }),
      requireSession: (_headers: Headers) =>
        Effect.tryPromise({
          try: () => mockAuthInstance.api.getSession(),
          catch: (error: unknown) => new AuthError(error),
        }).pipe(
          Effect.flatMap((session) =>
            session ? Effect.succeed(session) : Effect.fail(new AuthError('Unauthorized'))
          )
        ),
    } as any)

    const program = Effect.gen(function* () {
      const auth = yield* Auth
      const headers = new Headers()
      return yield* auth.requireSession(headers)
    })

    const result = await Effect.runPromise(program.pipe(Effect.either, Effect.provide(testLayer)))

    expect(result._tag).toBe('Left')
    if (result._tag === 'Left') {
      expect(result.left).toBeInstanceOf(AuthError)
      expect(result.left.cause).toBeInstanceOf(Error)
      expect((result.left.cause as Error).message).toBe('Network error')
    }
  })
})

describe('Auth service - api and handler', () => {
  test('exposes api object', async () => {
    const mockApi = {
      getSession: mock(async () => null),
      signIn: mock(async () => ({})),
      signOut: mock(async () => ({})),
    }

    const testLayer = Layer.succeed(Auth, {
      api: mockApi,
      handler: mock(() => Promise.resolve(new Response())),
      getSession: () => Effect.succeed(null),
      requireSession: () => Effect.fail(new AuthError('Unauthorized')),
    } as any)

    const program = Effect.gen(function* () {
      const auth = yield* Auth
      return auth.api
    })

    const api = await Effect.runPromise(program.pipe(Effect.provide(testLayer)))

    expect(api).toBe(mockApi as any)

    expect((api as any).getSession).toBeDefined()

    expect((api as any).signIn).toBeDefined()

    expect((api as any).signOut).toBeDefined()
  })

  test('exposes handler function', async () => {
    const mockHandler = mock(() => Promise.resolve(new Response()))

    const testLayer = Layer.succeed(Auth, {
      api: {},
      handler: mockHandler,
      getSession: () => Effect.succeed(null),
      requireSession: () => Effect.fail(new AuthError('Unauthorized')),
    } as any)

    const program = Effect.gen(function* () {
      const auth = yield* Auth
      return auth.handler
    })

    const handler = await Effect.runPromise(program.pipe(Effect.provide(testLayer)))

    expect(handler).toBe(mockHandler)
  })
})
