/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, test, expect } from 'bun:test'
import { Schema } from 'effect'
import { FeatureConfigSchema, FeatureValueSchema, FeaturesSchema } from './features'

describe('FeatureConfigSchema', () => {
  test('should accept feature config with enabled only', () => {
    // GIVEN: Feature config with enabled flag
    const featureConfig = {
      enabled: true,
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(FeatureConfigSchema)(featureConfig)

    // THEN: Enabled flag should be accepted
    expect(result.enabled).toBe(true)
  })

  test('should accept feature config with config only', () => {
    // GIVEN: Feature config with config object
    const featureConfig = {
      config: {
        duration: 300,
        easing: 'ease-in-out',
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(FeatureConfigSchema)(featureConfig)

    // THEN: Config object should be accepted
    expect(result.config?.duration).toBe(300)
    expect(result.config?.easing).toBe('ease-in-out')
  })

  test('should accept feature config with both enabled and config', () => {
    // GIVEN: Complete feature configuration
    const featureConfig = {
      enabled: true,
      config: {
        provider: 'intercom',
        appId: 'abc123',
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(FeatureConfigSchema)(featureConfig)

    // THEN: Both properties should be accepted
    expect(result.enabled).toBe(true)
    expect(result.config?.provider).toBe('intercom')
    expect(result.config?.appId).toBe('abc123')
  })

  test('should accept empty feature config', () => {
    // GIVEN: Empty feature config
    const featureConfig = {}

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(FeatureConfigSchema)(featureConfig)

    // THEN: Empty object should be accepted
    expect(result).toEqual({})
  })
})

describe('FeatureValueSchema', () => {
  test('should accept boolean true', () => {
    // GIVEN: Simple boolean feature flag
    const featureValue = true

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(FeatureValueSchema)(featureValue)

    // THEN: Boolean true should be accepted
    expect(result).toBe(true)
  })

  test('should accept boolean false', () => {
    // GIVEN: Disabled feature flag
    const featureValue = false

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(FeatureValueSchema)(featureValue)

    // THEN: Boolean false should be accepted
    expect(result).toBe(false)
  })

  test('should accept feature config object', () => {
    // GIVEN: Feature with configuration
    const featureValue = {
      enabled: true,
      config: {
        duration: 300,
        easing: 'ease-in-out',
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(FeatureValueSchema)(featureValue)

    // THEN: Config object should be accepted
    expect(result).toEqual(featureValue)
  })
})

describe('FeaturesSchema', () => {
  test('should accept feature with boolean value true', () => {
    // GIVEN: Simple feature flag
    const features = {
      darkMode: true,
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(FeaturesSchema)(features)

    // THEN: Boolean feature should be accepted
    expect(result.darkMode).toBe(true)
  })

  test('should accept feature with boolean value false', () => {
    // GIVEN: Disabled feature
    const features = {
      cookieConsent: false,
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(FeaturesSchema)(features)

    // THEN: Disabled feature should be accepted
    expect(result.cookieConsent).toBe(false)
  })

  test('should accept feature with object config', () => {
    // GIVEN: Feature with configuration data
    const features = {
      animations: {
        enabled: true,
        config: {
          duration: 300,
          easing: 'ease-in-out',
        },
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(FeaturesSchema)(features)

    // THEN: Feature config should be accepted
    expect(typeof result.animations).toBe('object')
    if (typeof result.animations === 'object' && result.animations !== null) {
      expect(result.animations.enabled).toBe(true)
      expect(result.animations.config?.duration).toBe(300)
      expect(result.animations.config?.easing).toBe('ease-in-out')
    }
  })

  test('should accept feature config with enabled property', () => {
    // GIVEN: Feature toggle via enabled boolean
    const features = {
      liveChat: {
        enabled: true,
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(FeaturesSchema)(features)

    // THEN: Enabled flag should be accepted
    expect(typeof result.liveChat).toBe('object')
    if (typeof result.liveChat === 'object' && result.liveChat !== null) {
      expect(result.liveChat.enabled).toBe(true)
    }
  })

  test('should accept feature config with nested config object', () => {
    // GIVEN: Feature with nested configuration
    const features = {
      liveChat: {
        enabled: true,
        config: {
          provider: 'intercom',
          appId: 'abc123',
        },
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(FeaturesSchema)(features)

    // THEN: Nested config should be accepted
    expect(typeof result.liveChat).toBe('object')
    if (typeof result.liveChat === 'object' && result.liveChat !== null) {
      expect(result.liveChat.config?.provider).toBe('intercom')
      expect(result.liveChat.config?.appId).toBe('abc123')
    }
  })

  test('should accept features with camelCase naming', () => {
    // GIVEN: Features with camelCase names
    const features = {
      darkMode: true,
      liveChat: true,
      cookieConsent: false,
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(FeaturesSchema)(features)

    // THEN: camelCase naming should be validated
    expect(result.darkMode).toBe(true)
    expect(result.liveChat).toBe(true)
    expect(result.cookieConsent).toBe(false)
  })

  test('should accept features with both simple and complex definitions', () => {
    // GIVEN: Mixed feature definitions
    const features = {
      darkMode: true,
      animations: {
        enabled: true,
        config: {
          duration: 300,
        },
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(FeaturesSchema)(features)

    // THEN: Both simple and complex features should be accepted
    expect(result.darkMode).toBe(true)
    expect(typeof result.animations).toBe('object')
    if (typeof result.animations === 'object' && result.animations !== null) {
      expect(result.animations.enabled).toBe(true)
      expect(result.animations.config?.duration).toBe(300)
    }
  })

  test('should accept feature config with flexible custom properties', () => {
    // GIVEN: Feature with custom config properties
    const features = {
      analytics: {
        enabled: true,
        config: {
          trackingId: 'G-XXXXX',
          anonymizeIp: true,
          cookieDomain: 'example.com',
        },
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(FeaturesSchema)(features)

    // THEN: Custom config properties should be accepted
    expect(typeof result.analytics).toBe('object')
    if (typeof result.analytics === 'object' && result.analytics !== null) {
      expect(result.analytics.config?.trackingId).toBe('G-XXXXX')
      expect(result.analytics.config?.anonymizeIp).toBe(true)
      expect(result.analytics.config?.cookieDomain).toBe('example.com')
    }
  })

  test('should accept common feature flags', () => {
    // GIVEN: Common UI feature flags
    const features = {
      darkMode: true,
      animations: true,
      cookieConsent: false,
      liveChat: {
        enabled: true,
        config: {
          provider: 'intercom',
          appId: 'abc123',
        },
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(FeaturesSchema)(features)

    // THEN: All common features should be accepted
    expect(result.darkMode).toBe(true)
    expect(result.animations).toBe(true)
    expect(result.cookieConsent).toBe(false)
    expect(typeof result.liveChat).toBe('object')
    if (typeof result.liveChat === 'object' && result.liveChat !== null) {
      expect(result.liveChat.enabled).toBe(true)
    }
  })

  test('should filter out feature with invalid naming convention', () => {
    // GIVEN: Feature with invalid naming (starts with number)
    const features = {
      validName: true,
      '1invalidName': true,
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(FeaturesSchema)(features)

    // THEN: Invalid key should be filtered out, valid key kept
    expect(result.validName).toBe(true)
    expect(result['1invalidName']).toBeUndefined()
  })

  test('should accept empty features object', () => {
    // GIVEN: Empty features
    const features = {}

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(FeaturesSchema)(features)

    // THEN: Empty object should be accepted
    expect(result).toEqual({})
  })
})
