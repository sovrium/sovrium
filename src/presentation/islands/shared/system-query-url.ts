/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

interface SystemQuerySource {
  readonly endpoint: string
  readonly query?: Readonly<Record<string, string | number | boolean>> | undefined
}

export function buildSystemQueryUrl(system: SystemQuerySource): string {
  const params = new URLSearchParams()
  Object.entries(system.query ?? {}).forEach(([key, value]) => {
    params.set(key, String(value))
  })
  const suffix = params.toString()
  return `${system.endpoint}${suffix ? `?${suffix}` : ''}`
}
