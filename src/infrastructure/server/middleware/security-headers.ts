/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { secureHeaders } from 'hono/secure-headers'
import type { MiddlewareHandler } from 'hono'

const structuralSecureHeaders = secureHeaders({
  strictTransportSecurity: 'max-age=31536000; includeSubDomains',
  referrerPolicy: 'strict-origin-when-cross-origin',
  xFrameOptions: 'DENY',
  contentSecurityPolicy: {
    frameAncestors: ["'none'"],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
  },
  permissionsPolicy: {
    camera: [],
    microphone: [],
    geolocation: [],
    payment: [],
    usb: [],
    accelerometer: [],
    gyroscope: [],
    magnetometer: [],
  },
})

export const securityHeaders: MiddlewareHandler = async (c, next) => {
  let routeCsp: string | undefined
  await structuralSecureHeaders(c, async () => {
    await next()
    routeCsp = c.res.headers.get('Content-Security-Policy') ?? undefined
  })
  if (routeCsp !== undefined) {
    c.res.headers.set('Content-Security-Policy', routeCsp)
  }
}
