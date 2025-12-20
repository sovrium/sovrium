/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Schema Infrastructure Module
 *
 * I/O operations for loading schemas from files and remote URLs.
 */

export { loadSchemaFromFile, fileExists, readFileContent } from './file-loader'
export { fetchRemoteSchema } from './remote-loader'
