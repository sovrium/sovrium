/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Logger from 'effect/Logger'

export type LogLevelType = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'

export type AnnotationType = 'notice' | 'warning' | 'error'

export interface LoggerConfig {
  readonly level: LogLevelType
  readonly enableGitHubActions: boolean
  readonly enableEmojis: boolean
  readonly enableTimestamps: boolean
}

export const defaultLoggerConfig: LoggerConfig = {
  level: 'info',
  enableGitHubActions: !!process.env.GITHUB_ACTIONS,
  enableEmojis: true,
  enableTimestamps: false,
}

export interface LoggerService {
  readonly trace: (message: string) => Effect.Effect<void>

  readonly debug: (message: string) => Effect.Effect<void>

  readonly info: (message: string, emoji?: string) => Effect.Effect<void>

  readonly warn: (message: string, emoji?: string) => Effect.Effect<void>

  readonly error: (message: string, emoji?: string) => Effect.Effect<void>

  readonly fatal: (message: string) => Effect.Effect<void>

  readonly success: (message: string) => Effect.Effect<void>

  readonly progress: (message: string) => Effect.Effect<void>

  readonly complete: (message: string) => Effect.Effect<void>

  readonly skip: (message: string) => Effect.Effect<void>

  readonly annotation: (
    type: AnnotationType,
    message: string,
    file?: string,
    line?: number
  ) => Effect.Effect<void>

  readonly separator: (char?: string, length?: number) => Effect.Effect<void>

  readonly section: (title: string) => Effect.Effect<void>

  readonly group: <A, E, R>(title: string, effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>
}

export const LoggerService = Context.GenericTag<LoggerService>('LoggerService')

const EMOJI_PREFIXES: Record<LogLevelType, string> = {
  trace: '🔍',
  debug: '🐛',
  info: 'ℹ️',
  warn: '⚠️',
  error: '❌',
  fatal: '💥',
}

const formatMessage = (
  message: string,
  emoji: string,
  config: LoggerConfig,
  forceEmoji = false
): string => {
  const parts: string[] = []

  if (config.enableTimestamps) {
    const timestamp = new Date().toISOString()
    parts.push(`[${timestamp}]`)
  }

  if (config.enableEmojis || forceEmoji) {
    parts.push(emoji)
  }

  parts.push(message)

  return parts.join(' ')
}

const createAnnotation = (
  type: AnnotationType,
  message: string,
  file?: string,
  line?: number
): string => {
  const props: string[] = []
  if (file) {
    props.push(`file=${file}`)
  }
  if (line !== undefined) {
    props.push(`line=${line}`)
  }
  const propsStr = props.length > 0 ? ` ${props.join(',')}` : ''
  return `::${type}${propsStr}::${message}`
}

export const LoggerServiceLive = (config: LoggerConfig = defaultLoggerConfig) =>
  Layer.succeed(
    LoggerService,
    LoggerService.of({
      trace: (message: string) =>
        Effect.log(formatMessage(message, EMOJI_PREFIXES.trace, config)).pipe(
          Effect.annotateLogs('level', 'trace')
        ),

      debug: (message: string) =>
        Effect.log(formatMessage(message, EMOJI_PREFIXES.debug, config)).pipe(
          Effect.annotateLogs('level', 'debug')
        ),

      info: (message: string, emoji?: string) =>
        Effect.log(formatMessage(message, emoji || EMOJI_PREFIXES.info, config, !!emoji)).pipe(
          Effect.annotateLogs('level', 'info')
        ),

      warn: (message: string, emoji?: string) =>
        Effect.logWarning(
          formatMessage(message, emoji || EMOJI_PREFIXES.warn, config, !!emoji)
        ).pipe(Effect.annotateLogs('level', 'warn')),

      error: (message: string, emoji?: string) =>
        Effect.logError(
          formatMessage(message, emoji || EMOJI_PREFIXES.error, config, !!emoji)
        ).pipe(Effect.annotateLogs('level', 'error')),

      fatal: (message: string) =>
        Effect.logFatal(formatMessage(message, EMOJI_PREFIXES.fatal, config)).pipe(
          Effect.annotateLogs('level', 'fatal')
        ),

      success: (message: string) =>
        Effect.log(formatMessage(message, '✅', config, true)).pipe(
          Effect.annotateLogs('level', 'info')
        ),

      progress: (message: string) =>
        Effect.log(formatMessage(message, '🔄', config, true)).pipe(
          Effect.annotateLogs('level', 'info')
        ),

      complete: (message: string) =>
        Effect.log(formatMessage(message, '✨', config, true)).pipe(
          Effect.annotateLogs('level', 'info')
        ),

      skip: (message: string) =>
        Effect.log(formatMessage(message, '⏭️', config, true)).pipe(
          Effect.annotateLogs('level', 'info')
        ),

      annotation: (type: AnnotationType, message: string, file?: string, line?: number) =>
        Effect.sync(() => {
          if (config.enableGitHubActions) {
            console.log(createAnnotation(type, message, file, line))
          }
        }),

      separator: (char = '─', length = 80) => Effect.log(char.repeat(length)),

      section: (title: string) =>
        Effect.gen(function* () {
          const sep = '─'.repeat(80)
          yield* Effect.log('')
          yield* Effect.log(sep)
          yield* Effect.log(title)
          yield* Effect.log(sep)
          yield* Effect.log('')
        }),

      group: <A, E, R>(title: string, effect: Effect.Effect<A, E, R>) =>
        Effect.gen(function* () {
          yield* Effect.log(`▼ ${title}`)
          const result = yield* effect
          yield* Effect.log(`▲ ${title} - completed`)
          return result
        }),
    })
  )


export const trace = (message: string) =>
  LoggerService.pipe(Effect.flatMap((service) => service.trace(message)))

export const debug = (message: string) =>
  LoggerService.pipe(Effect.flatMap((service) => service.debug(message)))

export const info = (message: string, emoji?: string) =>
  LoggerService.pipe(Effect.flatMap((service) => service.info(message, emoji)))

export const warn = (message: string, emoji?: string) =>
  LoggerService.pipe(Effect.flatMap((service) => service.warn(message, emoji)))

export const error = (message: string, emoji?: string) =>
  LoggerService.pipe(Effect.flatMap((service) => service.error(message, emoji)))

export const fatal = (message: string) =>
  LoggerService.pipe(Effect.flatMap((service) => service.fatal(message)))

export const success = (message: string) =>
  LoggerService.pipe(Effect.flatMap((service) => service.success(message)))

export const progress = (message: string) =>
  LoggerService.pipe(Effect.flatMap((service) => service.progress(message)))

export const complete = (message: string) =>
  LoggerService.pipe(Effect.flatMap((service) => service.complete(message)))

export const skip = (message: string) =>
  LoggerService.pipe(Effect.flatMap((service) => service.skip(message)))

export const annotation = (type: AnnotationType, message: string, file?: string, line?: number) =>
  LoggerService.pipe(Effect.flatMap((service) => service.annotation(type, message, file, line)))

export const separator = (char?: string, length?: number) =>
  LoggerService.pipe(Effect.flatMap((service) => service.separator(char, length)))

export const section = (title: string) =>
  LoggerService.pipe(Effect.flatMap((service) => service.section(title)))

export const group = <A, E, R>(title: string, effect: Effect.Effect<A, E, R>) =>
  LoggerService.pipe(Effect.flatMap((service) => service.group(title, effect)))

export const configureEffectLogger = (config: LoggerConfig = defaultLoggerConfig) =>
  Logger.replace(
    Logger.defaultLogger,
    Logger.make(({ logLevel, message }) => {
      const levelName = String(logLevel._tag).toLowerCase()
      const emoji = EMOJI_PREFIXES[levelName as LogLevelType] || EMOJI_PREFIXES.info
      const formatted = formatMessage(String(message), emoji, config)
      globalThis.console.log(formatted)
    })
  )

export const LoggerServicePretty = (config: LoggerConfig = defaultLoggerConfig) =>
  Layer.merge(
    LoggerServiceLive(config),
    Logger.replace(
      Logger.defaultLogger,
      Logger.make(({ message }) => {
        globalThis.console.log(String(message))
      })
    )
  )
