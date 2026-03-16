/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Schema } from 'effect'
import { ScriptsSchema } from './scripts'

describe('ScriptsSchema', () => {
  test('should accept scripts with all 4 properties', () => {
    // GIVEN: Complete scripts configuration
    const scripts = {
      features: {
        darkMode: true,
      },
      externalScripts: [
        {
          src: 'https://cdn.example.com/lib.js',
          async: true,
        },
      ],
      inlineScripts: [
        {
          code: "console.log('ready');",
        },
      ],
      config: {
        apiUrl: 'https://api.example.com',
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ScriptsSchema)(scripts)

    // THEN: All properties should be accepted
    expect(result.features?.darkMode).toBe(true)
    expect(result.externalScripts?.[0]?.src).toBe('https://cdn.example.com/lib.js')
    expect(result.inlineScripts?.[0]?.code).toBe("console.log('ready');")
    expect(result.config?.apiUrl).toBe('https://api.example.com')
  })

  test('should accept scripts with features only', () => {
    // GIVEN: Feature toggles only
    const scripts = {
      features: {
        darkMode: true,
        animations: true,
        analytics: false,
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ScriptsSchema)(scripts)

    // THEN: Features should be accepted
    expect(result.features?.darkMode).toBe(true)
    expect(result.features?.animations).toBe(true)
    expect(result.features?.analytics).toBe(false)
  })

  test('should accept scripts with externalScripts only', () => {
    // GIVEN: External CDN dependencies
    const scripts = {
      externalScripts: [
        {
          src: 'https://cdn.jsdelivr.net/npm/alpinejs@3/dist/cdn.min.js',
          async: true,
          defer: true,
        },
      ],
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ScriptsSchema)(scripts)

    // THEN: External scripts should be accepted
    expect(result.externalScripts?.[0]?.src).toBe(
      'https://cdn.jsdelivr.net/npm/alpinejs@3/dist/cdn.min.js'
    )
    expect(result.externalScripts?.[0]?.async).toBe(true)
  })

  test('should accept scripts with inlineScripts only', () => {
    // GIVEN: Inline code snippets
    const scripts = {
      inlineScripts: [
        {
          code: 'window.APP_CONFIG = { ready: true };',
        },
      ],
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ScriptsSchema)(scripts)

    // THEN: Inline scripts should be accepted
    expect(result.inlineScripts?.[0]?.code).toBe('window.APP_CONFIG = { ready: true };')
  })

  test('should accept scripts with config only', () => {
    // GIVEN: Client configuration
    const scripts = {
      config: {
        apiUrl: 'https://api.example.com',
        environment: 'production',
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ScriptsSchema)(scripts)

    // THEN: Config should be accepted
    expect(result.config?.apiUrl).toBe('https://api.example.com')
    expect(result.config?.environment).toBe('production')
  })

  test('should accept empty scripts configuration', () => {
    // GIVEN: No client-side scripts
    const scripts = {}

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ScriptsSchema)(scripts)

    // THEN: Empty configuration should be accepted
    expect(result).toEqual({})
  })

  test('should accept scripts combining features and config', () => {
    // GIVEN: Features with configuration data
    const scripts = {
      features: {
        analytics: true,
        chatWidget: true,
        darkMode: true,
        errorTracking: true,
      },
      config: {
        googleAnalyticsId: 'G-XXXXXXXXXX',
        intercomAppId: 'abc123',
        sentryDsn: 'https://key@sentry.io/project',
        defaultTheme: 'dark',
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ScriptsSchema)(scripts)

    // THEN: Features and config should work together
    expect(result.features?.analytics).toBe(true)
    expect(result.config?.googleAnalyticsId).toBe('G-XXXXXXXXXX')
  })

  test('should accept scripts with features, externalScripts, and inlineScripts', () => {
    // GIVEN: Complete client-side setup
    const scripts = {
      features: {
        analytics: true,
      },
      externalScripts: [
        {
          src: 'https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX',
          async: true,
        },
      ],
      inlineScripts: [
        {
          code: "window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', 'G-XXXXXXXXXX');",
        },
      ],
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ScriptsSchema)(scripts)

    // THEN: All three properties should work together
    expect(result.features?.analytics).toBe(true)
    expect(result.externalScripts?.[0]?.src).toContain('googletagmanager')
    expect(result.inlineScripts?.[0]?.code).toContain('gtag')
  })

  test('should accept config with flexible additionalProperties', () => {
    // GIVEN: Custom configuration properties
    const scripts = {
      config: {
        mapboxToken: 'pk.eyJ1...',
        stripePublishableKey: 'pk_live_...',
        googleMapsApiKey: 'AIza...',
        recaptchaSiteKey: '6Lf...',
        posthogApiKey: 'phc_...',
        intercomAppId: 'abc123',
        customDomain: 'app.example.com',
        maxUploadSize: 10_485_760,
        allowedFileTypes: ['.jpg', '.png', '.pdf'],
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ScriptsSchema)(scripts)

    // THEN: All custom properties should be accepted
    expect(result.config?.mapboxToken).toBe('pk.eyJ1...')
    expect(result.config?.stripePublishableKey).toBe('pk_live_...')
    expect(result.config?.maxUploadSize).toBe(10_485_760)
    expect(result.config?.allowedFileTypes).toEqual(['.jpg', '.png', '.pdf'])
  })

  test('should accept scripts with complex feature configurations', () => {
    // GIVEN: Features with config objects
    const scripts = {
      features: {
        darkMode: true,
        animations: {
          enabled: true,
          config: {
            duration: 300,
            easing: 'ease-in-out',
          },
        },
        analytics: false,
        liveChat: {
          enabled: true,
          config: {
            provider: 'intercom',
            appId: 'abc123',
          },
        },
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(ScriptsSchema)(scripts)

    // THEN: Complex feature configs should be accepted
    expect(result.features?.darkMode).toBe(true)
    expect(typeof result.features?.animations).toBe('object')
    if (
      result.features?.animations &&
      typeof result.features.animations === 'object' &&
      result.features.animations !== null
    ) {
      expect(result.features.animations.enabled).toBe(true)
      expect(result.features.animations.config?.duration).toBe(300)
    }
    expect(typeof result.features?.liveChat).toBe('object')
    if (
      result.features?.liveChat &&
      typeof result.features.liveChat === 'object' &&
      result.features.liveChat !== null
    ) {
      expect(result.features.liveChat.config?.provider).toBe('intercom')
    }
  })
})
