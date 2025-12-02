/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Effect Services for Scripts
 *
 * This module exports all Effect services used across the scripts/ directory.
 * These services provide consistent, composable, and testable abstractions for:
 * - File system operations (FileSystemService)
 * - Command execution (CommandService)
 * - Validation logic (ValidationService)
 * - Structured logging (LoggerService)
 *
 * Usage:
 * ```typescript
 * import { FileSystemService, CommandService } from '@/scripts/lib/effect'
 * import * as Effect from 'effect/Effect'
 * import * as Layer from 'effect/Layer'
 *
 * const program = Effect.gen(function* () {
 *   const fs = yield* FileSystemService
 *   const cmd = yield* CommandService
 *
 *   const content = yield* fs.readFile('package.json')
 *   const result = yield* cmd.spawn(['bun', 'test'])
 *
 *   return { content, result }
 * })
 *
 * const mainLayer = Layer.mergeAll(
 *   FileSystemServiceLive,
 *   CommandServiceLive,
 *   LoggerServiceLive()
 * )
 *
 * Effect.runPromise(program.pipe(Effect.provide(mainLayer)))
 * ```
 */

// File System Service
export {
  FileSystemService,
  FileSystemServiceLive,
  FileNotFoundError,
  FileReadError,
  FileWriteError,
  DirectoryCreateError,
  GlobError,
  FormattingError,
  readFile_,
  writeFile_,
  exists,
  mkdir_,
  glob,
  format,
  writeFormatted,
} from './FileSystemService'

export type { FileSystemService as FileSystemServiceType } from './FileSystemService'

// Command Service
export {
  CommandService,
  CommandServiceLive,
  CommandFailedError,
  CommandTimeoutError,
  CommandSpawnError,
  spawn,
  exec,
  parallel,
  withGitHubOutput,
  bunTest,
  eslint,
  typecheck,
  playwrightTest,
  git,
  gh,
} from './CommandService'

export type {
  CommandService as CommandServiceType,
  CommandResult,
  CommandOptions,
} from './CommandService'

// Validation Service
export {
  ValidationService,
  ValidationServiceLive,
  ValidationFailedError,
  SchemaValidationError,
  emptyValidationResult,
  validateSchema,
  validateAll,
  createIssue,
  combineResults,
  formatResult,
  assertPassed,
  noIssues,
  error,
  warning,
  info,
  combineIssues,
} from './ValidationService'

export type {
  ValidationService as ValidationServiceType,
  ValidationSeverity,
  ValidationIssue,
  ValidationResult,
} from './ValidationService'

// Logger Service
export {
  LoggerService,
  LoggerServiceLive,
  LoggerServicePretty,
  defaultLoggerConfig,
  trace,
  debug,
  info as logInfo,
  warn as logWarn,
  error as logError,
  fatal,
  success,
  progress,
  complete,
  skip,
  annotation,
  separator,
  section,
  group,
  configureEffectLogger,
} from './LoggerService'

export type {
  LoggerService as LoggerServiceType,
  LogLevelType,
  AnnotationType,
  LoggerConfig,
} from './LoggerService'

// Git Service
export {
  GitService,
  GitServiceLive,
  GitError,
  getMode,
  getChangedFiles,
  getBaseBranch,
  getCurrentBranch,
} from './GitService'

export type { GitService as GitServiceType, ExecutionMode } from './GitService'

// Spec Mapping Service
export {
  SpecMappingService,
  SpecMappingServiceLive,
  getSpecsForSource,
  getSpecsToRun,
  shouldRunE2E,
} from './SpecMappingService'

export type { SpecMappingService as SpecMappingServiceType } from './SpecMappingService'

// Coverage Service
export {
  CoverageService,
  CoverageServiceLive,
  CoverageCheckError,
  checkLayer,
  checkAll,
  enforce,
  getDefaultLayers,
  DEFAULT_LAYERS,
} from './CoverageService'

export type {
  CoverageService as CoverageServiceType,
  CoverageResult,
  LayerConfig,
} from './CoverageService'
