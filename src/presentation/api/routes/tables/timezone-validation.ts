/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Context } from 'hono'

/**
 * Validate timezone string using Intl.DateTimeFormat
 * Returns true if timezone is valid, false otherwise
 */
export function isValidTimezone(timezone: string): boolean {
  try {
    // Attempt to create a DateTimeFormat with the timezone
    // This will throw if the timezone is invalid
    // eslint-disable-next-line functional/no-expression-statements -- Required for validation side-effect
    Intl.DateTimeFormat('en-US', { timeZone: timezone })
    return true
  } catch {
    return false
  }
}

/**
 * Validate timezone and return error response if invalid
 */
export function validateTimezoneParam(timezone: string | undefined, c: Context) {
  if (timezone && !isValidTimezone(timezone)) {
    return c.json(
      {
        success: false,
        message: `Invalid timezone: ${timezone}`,
        code: 'VALIDATION_ERROR',
      },
      400
    )
  }
  return undefined
}
