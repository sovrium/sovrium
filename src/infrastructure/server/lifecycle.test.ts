/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test'
import { Effect, Exit, Fiber } from 'effect'
import { withGracefulShutdown } from './lifecycle'
import type { ServerInstance } from '@/application/models/server'

describe.skip('Server Lifecycle', () => {
  // Skip these tests temporarily as they interfere with concurrent test execution
  // due to global process mocking. These tests should be run in isolation.
  let processOnSpy: ReturnType<typeof spyOn>
  let processExitSpy: ReturnType<typeof spyOn>
  let consoleLogSpy: ReturnType<typeof spyOn>
  let consoleErrorSpy: ReturnType<typeof spyOn>
  let originalProcessExit: typeof process.exit

  beforeEach(() => {
    // Store original process.exit
    originalProcessExit = process.exit

    // Mock process methods
    processOnSpy = spyOn(process, 'on')
    // @ts-expect-error - mocking process.exit
    process.exit = mock(() => undefined)
    processExitSpy = spyOn(process, 'exit')

    // Mock console methods
    consoleLogSpy = spyOn(console, 'log')
    consoleErrorSpy = spyOn(console, 'error')
  })

  afterEach(() => {
    // Restore original process.exit
    process.exit = originalProcessExit

    // Clear all mocks
    processOnSpy?.mockRestore()
    processExitSpy?.mockRestore()
    consoleLogSpy?.mockRestore()
    consoleErrorSpy?.mockRestore()
  })

  describe('withGracefulShutdown', () => {
    test('registers SIGINT handler', async () => {
      // Given
      const mockServer: ServerInstance = {
        server: {} as ReturnType<typeof Bun.serve>,
        url: 'http://localhost:3000',
        stop: Effect.succeed('Server stopped' as unknown as void),
      }

      // When - Start the effect in a fiber (non-blocking)
      const fiber = await Effect.runFork(withGracefulShutdown(mockServer))

      // Allow effect to run
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Then
      expect(processOnSpy).toHaveBeenCalledTimes(1)
      expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function))

      // Cleanup
      await Fiber.interrupt(fiber)
    })

    test('logs startup messages', async () => {
      // Given
      const mockServer: ServerInstance = {
        server: {} as ReturnType<typeof Bun.serve>,
        url: 'http://localhost:3000',
        stop: Effect.succeed('Server stopped' as unknown as void),
      }

      // When
      const fiber = await Effect.runFork(withGracefulShutdown(mockServer))

      // Allow effect to run
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Then - Check console logs
      const logs = consoleLogSpy.mock.calls.map((call: unknown[]) => call[0])
      expect(logs).toContain('')
      expect(logs).toContain('Press Ctrl+C to stop the server')

      // Cleanup
      await Fiber.interrupt(fiber)
    })

    test('effect never completes normally', async () => {
      // Given
      const mockServer: ServerInstance = {
        server: {} as ReturnType<typeof Bun.serve>,
        url: 'http://localhost:3000',
        stop: Effect.succeed('Server stopped' as unknown as void),
      }

      // When
      const fiber = await Effect.runFork(withGracefulShutdown(mockServer))

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 50))

      // Then - Fiber should still be running
      const poll = await Fiber.poll(fiber)
      expect(poll).toBeUndefined() // Fiber has not completed

      // Cleanup
      await Fiber.interrupt(fiber)
    })

    test('handles SIGINT by stopping server', async () => {
      // Given
      const stopMock = mock(() => Effect.succeed('Stopped'))
      const mockServer: ServerInstance = {
        server: {} as ReturnType<typeof Bun.serve>,
        url: 'http://localhost:3000',
        stop: Effect.sync(stopMock) as Effect.Effect<void>,
      }

      let sigintHandler: (() => void) | undefined

      // Capture the SIGINT handler
      processOnSpy.mockImplementation((event: string, handler: () => void) => {
        if (event === 'SIGINT') {
          sigintHandler = handler
        }
      })

      // When - Start the shutdown handler
      const fiber = await Effect.runFork(withGracefulShutdown(mockServer))

      // Allow effect to register handler
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Trigger SIGINT
      if (sigintHandler) {
        sigintHandler()
      }

      // Allow handler to execute
      await new Promise((resolve) => setTimeout(resolve, 50))

      // Then
      expect(stopMock).toHaveBeenCalledTimes(1)
      expect(processExitSpy).toHaveBeenCalledWith(0)

      // Cleanup
      await Fiber.interrupt(fiber)
    })

    test('handles server stop failure', async () => {
      // Given
      const stopError = new Error('Stop failed')
      const mockServer: ServerInstance = {
        server: {} as ReturnType<typeof Bun.serve>,
        url: 'http://localhost:3000',
        stop: Effect.fail(stopError) as unknown as Effect.Effect<void>,
      }

      let sigintHandler: (() => void) | undefined

      // Capture the SIGINT handler
      processOnSpy.mockImplementation((event: string, handler: () => void) => {
        if (event === 'SIGINT') {
          sigintHandler = handler
        }
      })

      // When - Start the shutdown handler
      const fiber = await Effect.runFork(withGracefulShutdown(mockServer))

      // Allow effect to register handler
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Trigger SIGINT
      if (sigintHandler) {
        sigintHandler()
      }

      // Allow handler to execute
      await new Promise((resolve) => setTimeout(resolve, 50))

      // Then
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to stop server:', stopError)
      expect(processExitSpy).toHaveBeenCalledWith(1)

      // Cleanup
      await Fiber.interrupt(fiber)
    })

    test('can be interrupted without side effects', async () => {
      // Given
      const stopMock = mock(() => Effect.succeed('Stopped'))
      const mockServer: ServerInstance = {
        server: {} as ReturnType<typeof Bun.serve>,
        url: 'http://localhost:3000',
        stop: Effect.sync(stopMock) as Effect.Effect<void>,
      }

      // When
      const fiber = await Effect.runFork(withGracefulShutdown(mockServer))

      // Allow effect to run
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Interrupt the fiber
      const exit = await Effect.runPromise(Fiber.interrupt(fiber))

      // Then
      expect(Exit.isInterrupted(exit)).toBe(true)
      expect(stopMock).not.toHaveBeenCalled() // Server stop not called on interrupt
    })

    test('multiple SIGINT calls only stop server once', async () => {
      // Given
      const stopMock = mock(() => Effect.succeed('Stopped'))
      const mockServer: ServerInstance = {
        server: {} as ReturnType<typeof Bun.serve>,
        url: 'http://localhost:3000',
        stop: Effect.sync(stopMock) as Effect.Effect<void>,
      }

      let sigintHandler: (() => void) | undefined

      // Capture the SIGINT handler
      processOnSpy.mockImplementation((event: string, handler: () => void) => {
        if (event === 'SIGINT') {
          sigintHandler = handler
        }
      })

      // When
      const fiber = await Effect.runFork(withGracefulShutdown(mockServer))

      // Allow effect to register handler
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Trigger SIGINT multiple times
      if (sigintHandler) {
        sigintHandler()
        sigintHandler()
        sigintHandler()
      }

      // Allow handlers to execute
      await new Promise((resolve) => setTimeout(resolve, 50))

      // Then - Server stop should only be called once
      // (Though in practice, process.exit would terminate after first call)
      expect(stopMock).toHaveBeenCalledTimes(1)

      // Cleanup
      await Fiber.interrupt(fiber)
    })

    test('logs SIGINT reception message', async () => {
      // Given
      const mockServer: ServerInstance = {
        server: {} as ReturnType<typeof Bun.serve>,
        url: 'http://localhost:3000',
        stop: Effect.succeed('Stopped' as unknown as void),
      }

      let sigintHandler: (() => void) | undefined

      // Capture the SIGINT handler
      processOnSpy.mockImplementation((event: string, handler: () => void) => {
        if (event === 'SIGINT') {
          sigintHandler = handler
        }
      })

      // When
      const fiber = await Effect.runFork(withGracefulShutdown(mockServer))

      // Allow effect to register handler
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Clear previous logs
      consoleLogSpy.mockClear()

      // Trigger SIGINT
      if (sigintHandler) {
        sigintHandler()
      }

      // Allow handler to execute
      await new Promise((resolve) => setTimeout(resolve, 50))

      // Then
      const logs = consoleLogSpy.mock.calls.map((call: unknown[]) => call[0])
      expect(logs).toContain('\nReceived SIGINT, stopping server...')

      // Cleanup
      await Fiber.interrupt(fiber)
    })
  })

  describe('Integration patterns', () => {
    test('works with async server stop', async () => {
      // Given
      const stopMock = mock(() => Effect.succeed('Async stopped'))
      const mockServer: ServerInstance = {
        server: {} as ReturnType<typeof Bun.serve>,
        url: 'http://localhost:3000',
        stop: Effect.delay(Effect.sync(stopMock), '10 millis') as Effect.Effect<void>,
      }

      let sigintHandler: (() => void) | undefined

      processOnSpy.mockImplementation((event: string, handler: () => void) => {
        if (event === 'SIGINT') {
          sigintHandler = handler
        }
      })

      // When
      const fiber = await Effect.runFork(withGracefulShutdown(mockServer))

      // Allow effect to register handler
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Trigger SIGINT
      if (sigintHandler) {
        sigintHandler()
      }

      // Allow async operation to complete
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Then
      expect(stopMock).toHaveBeenCalledTimes(1)
      expect(processExitSpy).toHaveBeenCalledWith(0)

      // Cleanup
      await Fiber.interrupt(fiber)
    })

    test('handles complex server stop effect', async () => {
      // Given
      const cleanup1 = mock(() => Effect.succeed('Cleanup 1'))
      const cleanup2 = mock(() => Effect.succeed('Cleanup 2'))
      const finalStop = mock(() => Effect.succeed('Final stop'))

      const complexStop = Effect.gen(function* () {
        yield* Effect.sync(cleanup1)
        yield* Effect.sync(cleanup2)
        return yield* Effect.sync(finalStop)
      })

      const mockServer: ServerInstance = {
        server: {} as ReturnType<typeof Bun.serve>,
        url: 'http://localhost:3000',
        stop: complexStop as Effect.Effect<void>,
      }

      let sigintHandler: (() => void) | undefined

      processOnSpy.mockImplementation((event: string, handler: () => void) => {
        if (event === 'SIGINT') {
          sigintHandler = handler
        }
      })

      // When
      const fiber = await Effect.runFork(withGracefulShutdown(mockServer))

      // Allow effect to register handler
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Trigger SIGINT
      if (sigintHandler) {
        sigintHandler()
      }

      // Allow handler to execute
      await new Promise((resolve) => setTimeout(resolve, 50))

      // Then
      expect(cleanup1).toHaveBeenCalledTimes(1)
      expect(cleanup2).toHaveBeenCalledTimes(1)
      expect(finalStop).toHaveBeenCalledTimes(1)
      expect(processExitSpy).toHaveBeenCalledWith(0)

      // Cleanup
      await Fiber.interrupt(fiber)
    })

    test('preserves error details on stop failure', async () => {
      // Given
      const errorDetails = {
        code: 'SERVER_STOP_ERROR',
        message: 'Failed to close connections',
        timestamp: new Date(),
      }

      const mockServer: ServerInstance = {
        server: {} as ReturnType<typeof Bun.serve>,
        url: 'http://localhost:3000',
        stop: Effect.fail(errorDetails) as unknown as Effect.Effect<void>,
      }

      let sigintHandler: (() => void) | undefined

      processOnSpy.mockImplementation((event: string, handler: () => void) => {
        if (event === 'SIGINT') {
          sigintHandler = handler
        }
      })

      // When
      const fiber = await Effect.runFork(withGracefulShutdown(mockServer))

      // Allow effect to register handler
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Trigger SIGINT
      if (sigintHandler) {
        sigintHandler()
      }

      // Allow handler to execute
      await new Promise((resolve) => setTimeout(resolve, 50))

      // Then
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to stop server:', errorDetails)
      expect(processExitSpy).toHaveBeenCalledWith(1)

      // Cleanup
      await Fiber.interrupt(fiber)
    })
  })
})
