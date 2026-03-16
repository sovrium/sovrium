/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Lightweight User-Agent parser — zero external dependencies.
 *
 * Covers the major browsers, OS, and device types.
 * Not exhaustive, but sufficient for analytics breakdown.
 */

export interface ParsedUserAgent {
  readonly deviceType: 'desktop' | 'mobile' | 'tablet'
  readonly browserName: string
  readonly osName: string
}

/**
 * Parse device type from User-Agent string.
 *
 * Detection order matters: tablet before mobile (tablets include mobile keywords).
 */
const parseDeviceType = (ua: string): 'desktop' | 'mobile' | 'tablet' => {
  // Tablet detection (must come before mobile — iPads include "mobile" sometimes)
  if (/ipad|tablet|playbook|silk/i.test(ua)) return 'tablet'
  if (/android/i.test(ua) && !/mobile/i.test(ua)) return 'tablet'
  // Mobile detection
  if (/mobile|iphone|ipod|android.*mobile|windows phone|blackberry|opera mini|iemobile/i.test(ua))
    return 'mobile'
  // Default to desktop
  return 'desktop'
}

/**
 * Parse browser name from User-Agent string.
 *
 * Detection order matters: more specific browsers first (Edge before Chrome).
 */
const parseBrowserName = (ua: string): string => {
  // Edge (Chromium-based includes "Edg/")
  if (/edg\//i.test(ua)) return 'Edge'
  // Opera (includes "OPR/" or "Opera")
  if (/opr\//i.test(ua) || /opera/i.test(ua)) return 'Opera'
  // Samsung Internet
  if (/samsungbrowser/i.test(ua)) return 'Samsung Internet'
  // Chrome (must be after Edge and Opera which also include "Chrome")
  if (/chrome|crios/i.test(ua)) return 'Chrome'
  // Safari (must be after Chrome — Chrome also includes "Safari")
  if (/safari/i.test(ua) && !/chrome/i.test(ua)) return 'Safari'
  // Firefox
  if (/firefox|fxios/i.test(ua)) return 'Firefox'
  // IE
  if (/msie|trident/i.test(ua)) return 'IE'
  return 'Other'
}

/**
 * Parse OS name from User-Agent string.
 */
const parseOsName = (ua: string): string => {
  // iOS (must be before macOS — iPads can include "Macintosh")
  if (/iphone|ipad|ipod/i.test(ua)) return 'iOS'
  // Android
  if (/android/i.test(ua)) return 'Android'
  // Windows
  if (/windows/i.test(ua)) return 'Windows'
  // macOS
  if (/macintosh|mac os x/i.test(ua)) return 'macOS'
  // Linux (must be after Android which includes "Linux")
  if (/linux/i.test(ua)) return 'Linux'
  // Chrome OS
  if (/cros/i.test(ua)) return 'Chrome OS'
  return 'Other'
}

/**
 * Parse a User-Agent string into device type, browser, and OS.
 *
 * @param ua - User-Agent header string
 * @returns Parsed device info with deviceType, browserName, osName
 */
export const parseUserAgent = (ua: string): ParsedUserAgent => ({
  deviceType: parseDeviceType(ua),
  browserName: parseBrowserName(ua),
  osName: parseOsName(ua),
})
