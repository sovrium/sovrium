/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


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

export {
  SpecMappingService,
  SpecMappingServiceLive,
  getSpecsForSource,
  getSpecsToRun,
  shouldRunE2E,
} from './SpecMappingService'

export type { SpecMappingService as SpecMappingServiceType } from './SpecMappingService'

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

export { QualityCheckFailedError, printSummary } from './QualityReportService'

export type { CheckResult } from './QualityReportService'
