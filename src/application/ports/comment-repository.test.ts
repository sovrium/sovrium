/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Effect, Layer } from 'effect'
import {
  CommentRepository,
  type CommentWithUser,
  type CommentForAuth,
  type CommentUser,
  type ListedComment,
} from './comment-repository'
import type { UserSession } from './user-session'

// Typed stub for optional port methods — avoids Effect diagnostic
// "effectSucceedWithVoid" false positive on `none()`
// when the return type is `T | undefined` (not `void`).
const none = <T>(): Effect.Effect<T | undefined> => Effect.void as Effect.Effect<T | undefined>

describe('CommentRepository', () => {
  const mockSession: UserSession = {
    id: 'session-123',
    userId: 'user-456',
    token: 'token-789',
    expiresAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
    impersonatedBy: null,
  }

  test('should be a Context.Tag', () => {
    expect(CommentRepository).toBeDefined()
    expect(typeof CommentRepository).toBe('function')
  })

  test('should have correct service identifier', () => {
    expect(String(CommentRepository)).toContain('CommentRepository')
  })

  test('should create comment successfully', async () => {
    const mockComment = {
      id: 'comment-123',
      tableId: 'table-1',
      recordId: 'record-1',
      userId: 'user-456',
      content: 'Test comment',
      createdAt: new Date(),
    }

    const MockCommentRepositoryLive = Layer.succeed(CommentRepository, {
      create: () => Effect.succeed(mockComment),
      getWithUser: () => none(),
      checkRecordExists: () => Effect.succeed(false),
      getForAuth: () => none(),
      getUserById: () => none(),
      remove: () => Effect.void,
      list: () => Effect.succeed([]),
      getCount: () => Effect.succeed(0),
      update: () => Effect.succeed({} as any),
    })

    const program = Effect.gen(function* () {
      const repo = yield* CommentRepository
      return yield* repo.create({
        session: mockSession,
        tableId: 'table-1',
        recordId: 'record-1',
        content: 'Test comment',
      })
    })

    const result = await Effect.runPromise(program.pipe(Effect.provide(MockCommentRepositoryLive)))

    expect(result.id).toBe('comment-123')
    expect(result.content).toBe('Test comment')
    expect(result.userId).toBe('user-456')
  })

  test('should get comment with user successfully', async () => {
    const mockCommentWithUser: CommentWithUser = {
      id: 'comment-123',
      tableId: 'table-1',
      recordId: 'record-1',
      userId: 'user-456',
      content: 'Test comment',
      createdAt: new Date(),
      updatedAt: new Date(),
      user: {
        id: 'user-456',
        name: 'Alice',
        email: 'alice@example.com',
        image: 'https://example.com/avatar.jpg',
      },
    }

    const MockCommentRepositoryLive = Layer.succeed(CommentRepository, {
      create: () => Effect.succeed({} as any),
      getWithUser: () => Effect.succeed(mockCommentWithUser),
      checkRecordExists: () => Effect.succeed(false),
      getForAuth: () => none(),
      getUserById: () => none(),
      remove: () => Effect.void,
      list: () => Effect.succeed([]),
      getCount: () => Effect.succeed(0),
      update: () => Effect.succeed({} as any),
    })

    const program = Effect.gen(function* () {
      const repo = yield* CommentRepository
      return yield* repo.getWithUser({
        session: mockSession,
        commentId: 'comment-123',
      })
    })

    const result = await Effect.runPromise(program.pipe(Effect.provide(MockCommentRepositoryLive)))

    expect(result?.id).toBe('comment-123')
    expect(result?.user?.name).toBe('Alice')
  })

  test('should check record exists successfully', async () => {
    const MockCommentRepositoryLive = Layer.succeed(CommentRepository, {
      create: () => Effect.succeed({} as any),
      getWithUser: () => none(),
      checkRecordExists: (_config) => Effect.succeed(true),
      getForAuth: () => none(),
      getUserById: () => none(),
      remove: () => Effect.void,
      list: () => Effect.succeed([]),
      getCount: () => Effect.succeed(0),
      update: () => Effect.succeed({} as any),
    })

    const program = Effect.gen(function* () {
      const repo = yield* CommentRepository
      return yield* repo.checkRecordExists({
        session: mockSession,
        tableName: 'users',
        recordId: 'record-1',
      })
    })

    const result = await Effect.runPromise(program.pipe(Effect.provide(MockCommentRepositoryLive)))

    expect(result).toBe(true)
  })

  test('should get comment for auth successfully', async () => {
    const mockCommentForAuth: CommentForAuth = {
      id: 'comment-123',
      userId: 'user-456',
      recordId: 'record-1',
      tableId: 'table-1',
    }

    const MockCommentRepositoryLive = Layer.succeed(CommentRepository, {
      create: () => Effect.succeed({} as any),
      getWithUser: () => none(),
      checkRecordExists: () => Effect.succeed(false),
      getForAuth: () => Effect.succeed(mockCommentForAuth),
      getUserById: () => none(),
      remove: () => Effect.void,
      list: () => Effect.succeed([]),
      getCount: () => Effect.succeed(0),
      update: () => Effect.succeed({} as any),
    })

    const program = Effect.gen(function* () {
      const repo = yield* CommentRepository
      return yield* repo.getForAuth({
        session: mockSession,
        commentId: 'comment-123',
      })
    })

    const result = await Effect.runPromise(program.pipe(Effect.provide(MockCommentRepositoryLive)))

    expect(result?.id).toBe('comment-123')
    expect(result?.userId).toBe('user-456')
  })

  test('should get user by ID successfully', async () => {
    const mockUser: CommentUser = {
      id: 'user-456',
      role: 'admin',
    }

    const MockCommentRepositoryLive = Layer.succeed(CommentRepository, {
      create: () => Effect.succeed({} as any),
      getWithUser: () => none(),
      checkRecordExists: () => Effect.succeed(false),
      getForAuth: () => none(),
      getUserById: () => Effect.succeed(mockUser),
      remove: () => Effect.void,
      list: () => Effect.succeed([]),
      getCount: () => Effect.succeed(0),
      update: () => Effect.succeed({} as any),
    })

    const program = Effect.gen(function* () {
      const repo = yield* CommentRepository
      return yield* repo.getUserById({
        session: mockSession,
        userId: 'user-456',
      })
    })

    const result = await Effect.runPromise(program.pipe(Effect.provide(MockCommentRepositoryLive)))

    expect(result?.id).toBe('user-456')
    expect(result?.role).toBe('admin')
  })

  test('should remove comment successfully', async () => {
    const MockCommentRepositoryLive = Layer.succeed(CommentRepository, {
      create: () => Effect.succeed({} as any),
      getWithUser: () => none(),
      checkRecordExists: () => Effect.succeed(false),
      getForAuth: () => none(),
      getUserById: () => none(),
      remove: () => Effect.void,
      list: () => Effect.succeed([]),
      getCount: () => Effect.succeed(0),
      update: () => Effect.succeed({} as any),
    })

    const program = Effect.gen(function* () {
      const repo = yield* CommentRepository
      return yield* repo.remove({
        session: mockSession,
        commentId: 'comment-123',
      })
    })

    await Effect.runPromise(program.pipe(Effect.provide(MockCommentRepositoryLive)))
    // If it doesn't throw, the test passes
    expect(true).toBe(true)
  })

  test('should list comments successfully', async () => {
    const mockComments: ListedComment[] = [
      {
        id: 'comment-1',
        tableId: 'table-1',
        recordId: 'record-1',
        userId: 'user-456',
        content: 'First comment',
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          id: 'user-456',
          name: 'Alice',
          email: 'alice@example.com',
          image: undefined,
        },
      },
      {
        id: 'comment-2',
        tableId: 'table-1',
        recordId: 'record-1',
        userId: 'user-789',
        content: 'Second comment',
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          id: 'user-789',
          name: 'Bob',
          email: 'bob@example.com',
          image: undefined,
        },
      },
    ]

    const MockCommentRepositoryLive = Layer.succeed(CommentRepository, {
      create: () => Effect.succeed({} as any),
      getWithUser: () => none(),
      checkRecordExists: () => Effect.succeed(false),
      getForAuth: () => none(),
      getUserById: () => none(),
      remove: () => Effect.void,
      list: () => Effect.succeed(mockComments),
      getCount: () => Effect.succeed(0),
      update: () => Effect.succeed({} as any),
    })

    const program = Effect.gen(function* () {
      const repo = yield* CommentRepository
      return yield* repo.list({
        session: mockSession,
        recordId: 'record-1',
        limit: 10,
        offset: 0,
        sortOrder: 'desc',
      })
    })

    const result = await Effect.runPromise(program.pipe(Effect.provide(MockCommentRepositoryLive)))

    expect(result).toHaveLength(2)
    expect(result[0]?.content).toBe('First comment')
    expect(result[1]?.content).toBe('Second comment')
  })

  test('should get comment count successfully', async () => {
    const MockCommentRepositoryLive = Layer.succeed(CommentRepository, {
      create: () => Effect.succeed({} as any),
      getWithUser: () => none(),
      checkRecordExists: () => Effect.succeed(false),
      getForAuth: () => none(),
      getUserById: () => none(),
      remove: () => Effect.void,
      list: () => Effect.succeed([]),
      getCount: () => Effect.succeed(42),
      update: () => Effect.succeed({} as any),
    })

    const program = Effect.gen(function* () {
      const repo = yield* CommentRepository
      return yield* repo.getCount({
        session: mockSession,
        recordId: 'record-1',
      })
    })

    const result = await Effect.runPromise(program.pipe(Effect.provide(MockCommentRepositoryLive)))

    expect(result).toBe(42)
  })
})

describe('CommentWithUser interface', () => {
  test('should have correct shape', () => {
    const comment: CommentWithUser = {
      id: 'comment-123',
      tableId: 'table-1',
      recordId: 'record-1',
      userId: 'user-456',
      content: 'Test comment',
      createdAt: new Date(),
      updatedAt: new Date(),
      user: {
        id: 'user-456',
        name: 'Alice',
        email: 'alice@example.com',
        image: 'https://example.com/avatar.jpg',
      },
    }

    expect(comment.id).toBe('comment-123')
    expect(comment.user?.name).toBe('Alice')
  })
})

describe('CommentForAuth interface', () => {
  test('should have correct shape', () => {
    const comment: CommentForAuth = {
      id: 'comment-123',
      userId: 'user-456',
      recordId: 'record-1',
      tableId: 'table-1',
    }

    expect(comment.id).toBe('comment-123')
    expect(comment.userId).toBe('user-456')
  })
})

describe('CommentUser interface', () => {
  test('should have correct shape', () => {
    const user: CommentUser = {
      id: 'user-456',
      role: 'admin',
    }

    expect(user.id).toBe('user-456')
    expect(user.role).toBe('admin')
  })
})

describe('ListedComment interface', () => {
  test('should have correct shape', () => {
    const comment: ListedComment = {
      id: 'comment-123',
      tableId: 'table-1',
      recordId: 'record-1',
      userId: 'user-456',
      content: 'Test comment',
      createdAt: new Date(),
      updatedAt: new Date(),
      user: {
        id: 'user-456',
        name: 'Alice',
        email: 'alice@example.com',
        image: undefined,
      },
    }

    expect(comment.id).toBe('comment-123')
    expect(comment.updatedAt).toBeInstanceOf(Date)
  })
})
