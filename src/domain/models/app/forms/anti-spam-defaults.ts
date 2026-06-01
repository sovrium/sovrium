/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Form } from '@/domain/models/app/forms'

export interface EffectiveAntiSpam {
  readonly honeypot: boolean
  readonly rateLimit: {
    readonly perIp: number
    readonly perForm: number
    readonly windowSeconds: number
  }
}

export const DEFAULT_ANTI_SPAM: EffectiveAntiSpam = {
  honeypot: true,
  rateLimit: {
    perIp: 10,
    perForm: 1000,
    windowSeconds: 60,
  },
}

export const effectiveAntiSpam = (form: Readonly<Form>): EffectiveAntiSpam => {
  const block = form.antiSpam
  if (block === undefined) return DEFAULT_ANTI_SPAM

  const honeypot = block.honeypot === undefined ? DEFAULT_ANTI_SPAM.honeypot : block.honeypot

  const rl = block.rateLimit
  return {
    honeypot,
    rateLimit: {
      perIp: rl?.perIp ?? DEFAULT_ANTI_SPAM.rateLimit.perIp,
      perForm: rl?.perForm ?? DEFAULT_ANTI_SPAM.rateLimit.perForm,
      windowSeconds: rl?.windowSeconds ?? DEFAULT_ANTI_SPAM.rateLimit.windowSeconds,
    },
  }
}
