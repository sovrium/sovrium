/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export interface ParsedUserAgent {
  readonly deviceType: 'desktop' | 'mobile' | 'tablet'
  readonly browserName: string
  readonly osName: string
}

const parseDeviceType = (ua: string): 'desktop' | 'mobile' | 'tablet' => {
  if (/ipad|tablet|playbook|silk/i.test(ua)) return 'tablet'
  if (/android/i.test(ua) && !/mobile/i.test(ua)) return 'tablet'
  if (/mobile|iphone|ipod|android.*mobile|windows phone|blackberry|opera mini|iemobile/i.test(ua))
    return 'mobile'
  return 'desktop'
}

const parseBrowserName = (ua: string): string => {
  if (/edg\//i.test(ua)) return 'Edge'
  if (/opr\//i.test(ua) || /opera/i.test(ua)) return 'Opera'
  if (/samsungbrowser/i.test(ua)) return 'Samsung Internet'
  if (/chrome|crios/i.test(ua)) return 'Chrome'
  if (/safari/i.test(ua) && !/chrome/i.test(ua)) return 'Safari'
  if (/firefox|fxios/i.test(ua)) return 'Firefox'
  if (/msie|trident/i.test(ua)) return 'IE'
  return 'Other'
}

const parseOsName = (ua: string): string => {
  if (/iphone|ipad|ipod/i.test(ua)) return 'iOS'
  if (/android/i.test(ua)) return 'Android'
  if (/windows/i.test(ua)) return 'Windows'
  if (/macintosh|mac os x/i.test(ua)) return 'macOS'
  if (/linux/i.test(ua)) return 'Linux'
  if (/cros/i.test(ua)) return 'Chrome OS'
  return 'Other'
}

export const parseUserAgent = (ua: string): ParsedUserAgent => ({
  deviceType: parseDeviceType(ua),
  browserName: parseBrowserName(ua),
  osName: parseOsName(ua),
})
