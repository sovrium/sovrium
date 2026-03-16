/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { parseUserAgent } from './ua-parser'

describe('parseUserAgent', () => {
  describe('device type detection', () => {
    test('detects desktop from Windows Chrome UA', () => {
      const ua =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      expect(parseUserAgent(ua).deviceType).toBe('desktop')
    })

    test('detects desktop from macOS Safari UA', () => {
      const ua =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15'
      expect(parseUserAgent(ua).deviceType).toBe('desktop')
    })

    test('detects mobile from iPhone UA', () => {
      const ua =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1'
      expect(parseUserAgent(ua).deviceType).toBe('mobile')
    })

    test('detects mobile from Android mobile UA', () => {
      const ua =
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
      expect(parseUserAgent(ua).deviceType).toBe('mobile')
    })

    test('detects tablet from iPad UA', () => {
      const ua =
        'Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1'
      expect(parseUserAgent(ua).deviceType).toBe('tablet')
    })

    test('detects tablet from Android tablet (no "Mobile")', () => {
      const ua =
        'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      expect(parseUserAgent(ua).deviceType).toBe('tablet')
    })

    test('defaults to desktop for empty UA', () => {
      expect(parseUserAgent('').deviceType).toBe('desktop')
    })
  })

  describe('browser detection', () => {
    test('detects Chrome', () => {
      const ua =
        'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      expect(parseUserAgent(ua).browserName).toBe('Chrome')
    })

    test('detects Edge (not Chrome)', () => {
      const ua =
        'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
      expect(parseUserAgent(ua).browserName).toBe('Edge')
    })

    test('detects Firefox', () => {
      const ua = 'Mozilla/5.0 (Windows NT 10.0; rv:121.0) Gecko/20100101 Firefox/121.0'
      expect(parseUserAgent(ua).browserName).toBe('Firefox')
    })

    test('detects Safari (not Chrome)', () => {
      const ua =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15'
      expect(parseUserAgent(ua).browserName).toBe('Safari')
    })

    test('detects Opera', () => {
      const ua =
        'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0'
      expect(parseUserAgent(ua).browserName).toBe('Opera')
    })

    test('returns Other for unknown browser', () => {
      expect(parseUserAgent('SomeBot/1.0').browserName).toBe('Other')
    })
  })

  describe('OS detection', () => {
    test('detects Windows', () => {
      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      expect(parseUserAgent(ua).osName).toBe('Windows')
    })

    test('detects macOS', () => {
      const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) AppleWebKit/605.1.15'
      expect(parseUserAgent(ua).osName).toBe('macOS')
    })

    test('detects iOS from iPhone', () => {
      const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15'
      expect(parseUserAgent(ua).osName).toBe('iOS')
    })

    test('detects Android', () => {
      const ua = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36'
      expect(parseUserAgent(ua).osName).toBe('Android')
    })

    test('detects Linux', () => {
      const ua = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
      expect(parseUserAgent(ua).osName).toBe('Linux')
    })

    test('returns Other for unknown OS', () => {
      expect(parseUserAgent('SomeBot/1.0').osName).toBe('Other')
    })
  })
})
