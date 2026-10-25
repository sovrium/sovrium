/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  hasDevCredentials,
  isDevModeEnabled,
  isDevPublicEnabled,
  parseDevNoticeEnvConfig,
} from '@/domain/models/process-env/dev-notice'
import { isLoopbackHost, resolveBindHostname } from '@/infrastructure/process/security-posture'
import type { StartupPhase } from '@/infrastructure/logging/startup-summary'

/**
 * The boot banner's dev-mode line: one `⚠` when dev mode is on while the
 * public origin is not a loopback host, nothing otherwise.
 *
 * Dev mode is allowed on a public origin (a hosted demo is exactly that), so
 * this is a warning, never a refusal. It names what every visitor can now
 * read — the sign-in email the panel shows — and the variable to unset before
 * launch — unless `SOVRIUM_DEV_PUBLIC` says the public address is deliberate,
 * in which case the server keeps itself out of search indexes instead and
 * nothing is printed. The public origin is resolved as every other posture line resolves
 * it: the host of `BASE_URL` when set, else the bind host.
 *
 * @param bindHost - the host the socket bound (server.ts passes it).
 * @param processEnv - the environment to read dev mode from (tests inject one).
 * @param resolveHost - the public-origin resolver (tests inject one).
 */
export const collectDevModePhases = (
  bindHost?: string,
  processEnv: Readonly<Record<string, string | undefined>> = process.env,
  resolveHost: (bindHost?: string) => string = resolveBindHostname
): readonly StartupPhase[] => {
  const config = parseDevNoticeEnvConfig(processEnv)
  // `SOVRIUM_DEV_PUBLIC` says the public address is deliberate: nothing to warn about.
  if (!isDevModeEnabled(config) || isDevPublicEnabled(config)) return []
  const host = resolveHost(bindHost)
  if (isLoopbackHost(host)) return []
  const exposed = hasDevCredentials(config)
    ? `the sign-in page shows ${config.email?.trim() ?? ''} to every visitor`
    : 'every visitor sees the dev-mode panel'
  return [
    {
      label: `Dev mode is on while the public origin is ${host} — ${exposed}; unset SOVRIUM_DEV_MODE before launch`,
      type: 'warning' as const,
    },
  ]
}
