/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Schema Infrastructure Module
 *
 * I/O operations for loading schemas from files and remote URLs.
 */

export {
  loadSchemaFromFile,
  loadSchemaGraphFromFile,
  collectConfigGraphFiles,
  fileExists,
  readFileContent,
} from './file-loader'
export type { LoadedConfigGraph, ConfigGraphLoadOptions } from './file-loader'
export { fetchRemoteSchema } from './remote-loader'
export { resolveRefs, resolveRefsWithSources, collectRefSources } from './ref-resolver'
export type { ConfigGraphOverlay } from './ref-resolver'
export { discoverDefaultConfigFile } from './config-discovery'
