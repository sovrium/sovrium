/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Read NODE_ENV at runtime without being statically replaced by Bun.build's
 * `define` option. The build script sets `define['process.env.NODE_ENV']` to
 * force the production JSX transform, but runtime environment detection must
 * remain dynamic so the npm package respects the deployer's NODE_ENV.
 */
const env = process.env as Record<string, string | undefined>

export const getNodeEnv = (): string | undefined => env['NODE_ENV']
export const isProduction = (): boolean => getNodeEnv() === 'production'
export const isDevelopment = (): boolean => getNodeEnv() === 'development'
