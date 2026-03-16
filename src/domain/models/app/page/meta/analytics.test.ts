/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import { AnalyticsSchema } from './analytics'

describe('AnalyticsSchema', () => {
  test('should accept google analytics provider', () => {
    // GIVEN: Google Analytics provider
    const analytics = {
      providers: [
        {
          name: 'google' as const,
          enabled: true,
        },
      ],
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(AnalyticsSchema)(analytics)

    // THEN: Google provider should be accepted
    expect(result.providers[0].name).toBe('google')
    expect(result.providers[0].enabled).toBe(true)
  })

  test('should accept all 6 analytics providers', () => {
    // GIVEN: All supported providers
    const analytics = {
      providers: [
        { name: 'google' as const },
        { name: 'plausible' as const },
        { name: 'matomo' as const },
        { name: 'fathom' as const },
        { name: 'posthog' as const },
        { name: 'mixpanel' as const },
      ],
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(AnalyticsSchema)(analytics)

    // THEN: All providers should be accepted
    expect(result.providers).toHaveLength(6)
    expect(result.providers[0].name).toBe('google')
    expect(result.providers[5].name).toBe('mixpanel')
  })

  test('should accept provider with scripts', () => {
    // GIVEN: Provider with external scripts
    const analytics = {
      providers: [
        {
          name: 'google' as const,
          scripts: [
            {
              src: 'https://www.googletagmanager.com/gtag/js?id=G-XXXXX',
              async: true,
            },
          ],
        },
      ],
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(AnalyticsSchema)(analytics)

    // THEN: Scripts should be accepted
    expect(result.providers[0].scripts).toHaveLength(1)
    expect(result.providers[0].scripts?.[0].async).toBe(true)
  })

  test('should accept provider with initScript', () => {
    // GIVEN: Provider with initialization script
    const analytics = {
      providers: [
        {
          name: 'google' as const,
          initScript:
            'window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);}',
        },
      ],
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(AnalyticsSchema)(analytics)

    // THEN: Init script should be accepted
    expect(result.providers[0].initScript).toContain('dataLayer')
  })

  test('should accept provider with dnsPrefetch', () => {
    // GIVEN: Provider with DNS prefetch optimization
    const analytics = {
      providers: [
        {
          name: 'plausible' as const,
          dnsPrefetch: 'https://plausible.io',
        },
      ],
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(AnalyticsSchema)(analytics)

    // THEN: DNS prefetch should be accepted
    expect(result.providers[0].dnsPrefetch).toBe('https://plausible.io')
  })

  test('should accept provider with flexible config object', () => {
    // GIVEN: Provider with provider-specific configuration
    const analytics = {
      providers: [
        {
          name: 'google' as const,
          config: {
            trackingId: 'G-XXXXXXXXXX',
            anonymizeIp: true,
            customDimensions: ['userId', 'planType'],
          },
        },
      ],
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(AnalyticsSchema)(analytics)

    // THEN: Flexible config should be accepted
    expect(result.providers[0].config?.trackingId).toBe('G-XXXXXXXXXX')
    expect(result.providers[0].config?.anonymizeIp).toBe(true)
  })

  test('should accept complete provider configuration', () => {
    // GIVEN: Provider with all properties
    const analytics = {
      providers: [
        {
          name: 'google' as const,
          enabled: true,
          scripts: [
            {
              src: 'https://www.googletagmanager.com/gtag/js?id=G-XXXXX',
              async: true,
              defer: false,
            },
          ],
          initScript: "gtag('config', 'G-XXXXX');",
          dnsPrefetch: 'https://www.googletagmanager.com',
          config: {
            trackingId: 'G-XXXXX',
            anonymizeIp: true,
          },
        },
      ],
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(AnalyticsSchema)(analytics)

    // THEN: Complete configuration should be accepted
    expect(result.providers[0].name).toBe('google')
    expect(result.providers[0].enabled).toBe(true)
    expect(result.providers[0].scripts).toHaveLength(1)
    expect(result.providers[0].dnsPrefetch).toBe('https://www.googletagmanager.com')
  })

  test('should accept multiple providers simultaneously', () => {
    // GIVEN: Multiple analytics providers for transition/comparison
    const analytics = {
      providers: [
        {
          name: 'plausible' as const,
          enabled: true,
          config: { domain: 'example.com' },
        },
        {
          name: 'google' as const,
          enabled: true,
          config: { trackingId: 'G-XXXXX' },
        },
      ],
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(AnalyticsSchema)(analytics)

    // THEN: Multiple providers should be accepted
    expect(result.providers).toHaveLength(2)
    expect(result.providers[0].name).toBe('plausible')
    expect(result.providers[1].name).toBe('google')
  })
})
