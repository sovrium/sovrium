/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect, describe, mock } from 'bun:test'
import { Effect, Context, Layer } from 'effect'
import { Email, EmailLive, EmailError, EmailConnectionError } from './email-service'

describe('Email Context Tag', () => {
  test('is a valid Effect Context Tag', () => {
    expect(Email).toBeDefined()
    expect(Email.key).toBe('Email')
  })

  test('has correct service shape', () => {
    const mockEmail = {
      send: () => Effect.succeed('mock-message-id'),
      sendWithDefaultFrom: () => Effect.succeed('mock-message-id'),
      verifyConnection: () => Effect.succeed(true),
    }

    const layer = Layer.succeed(Email, mockEmail)
    expect(layer).toBeDefined()
  })
})

describe('EmailError', () => {
  test('creates error with message', () => {
    const error = new EmailError({ message: 'Test error' })
    expect(error.message).toBe('Test error')
    expect(error._tag).toBe('EmailError')
  })

  test('creates error with message and cause', () => {
    const originalError = new Error('Original error')
    const emailError = new EmailError({ message: 'Test error', cause: originalError })
    expect(emailError.message).toBe('Test error')
    expect(emailError.cause).toBe(originalError)
    expect(emailError._tag).toBe('EmailError')
  })

  test('is instance of Error', () => {
    const error = new EmailError({ message: 'Test error' })
    expect(error).toBeInstanceOf(Error)
  })
})

describe('EmailConnectionError', () => {
  test('creates error with message', () => {
    const error = new EmailConnectionError({ message: 'Connection failed' })
    expect(error.message).toBe('Connection failed')
    expect(error._tag).toBe('EmailConnectionError')
  })

  test('creates error with message and cause', () => {
    const originalError = new Error('SMTP timeout')
    const connectionError = new EmailConnectionError({
      message: 'Connection failed',
      cause: originalError,
    })
    expect(connectionError.message).toBe('Connection failed')
    expect(connectionError.cause).toBe(originalError)
    expect(connectionError._tag).toBe('EmailConnectionError')
  })

  test('is instance of Error', () => {
    const error = new EmailConnectionError({ message: 'Connection failed' })
    expect(error).toBeInstanceOf(Error)
  })
})

describe('EmailLive Layer', () => {
  test('provides Email service', () => {
    expect(EmailLive).toBeDefined()
  })

  test('Email service has send method', async () => {
    const program = Effect.gen(function* () {
      const email = yield* Email
      expect(email.send).toBeDefined()
      expect(typeof email.send).toBe('function')
    })

    await Effect.runPromise(program.pipe(Effect.provide(EmailLive)))
  })

  test('Email service has sendWithDefaultFrom method', async () => {
    const program = Effect.gen(function* () {
      const email = yield* Email
      expect(email.sendWithDefaultFrom).toBeDefined()
      expect(typeof email.sendWithDefaultFrom).toBe('function')
    })

    await Effect.runPromise(program.pipe(Effect.provide(EmailLive)))
  })

  test('Email service has verifyConnection method', async () => {
    const program = Effect.gen(function* () {
      const email = yield* Email
      expect(email.verifyConnection).toBeDefined()
      expect(typeof email.verifyConnection).toBe('function')
    })

    await Effect.runPromise(program.pipe(Effect.provide(EmailLive)))
  })
})

describe('EmailLive service methods return Effects', () => {
  test('send returns Effect', async () => {
    const program = Effect.gen(function* () {
      const email = yield* Email
      const result = email.send({
        to: 'test@example.com',
        subject: 'Test',
        text: 'Test message',
      })

      // Verify it returns an Effect (has pipe method)
      expect(result).toHaveProperty('pipe')
      expect(typeof result.pipe).toBe('function')
    })

    await Effect.runPromise(program.pipe(Effect.provide(EmailLive)))
  })

  test('sendWithDefaultFrom returns Effect', async () => {
    const program = Effect.gen(function* () {
      const email = yield* Email
      const result = email.sendWithDefaultFrom({
        to: 'test@example.com',
        subject: 'Test',
        text: 'Test message',
      })

      // Verify it returns an Effect (has pipe method)
      expect(result).toHaveProperty('pipe')
      expect(typeof result.pipe).toBe('function')
    })

    await Effect.runPromise(program.pipe(Effect.provide(EmailLive)))
  })

  test('verifyConnection returns Effect', async () => {
    const program = Effect.gen(function* () {
      const email = yield* Email
      const result = email.verifyConnection()

      // Verify it returns an Effect (has pipe method)
      expect(result).toHaveProperty('pipe')
      expect(typeof result.pipe).toBe('function')
    })

    await Effect.runPromise(program.pipe(Effect.provide(EmailLive)))
  })
})
