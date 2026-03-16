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
import { LocalBusinessSchema } from './local-business'

describe('LocalBusinessSchema', () => {
  test('should accept minimal local business with required properties', () => {
    // GIVEN: Minimal local business with only required fields
    const localBusiness = {
      '@context': 'https://schema.org' as const,
      '@type': 'LocalBusiness' as const,
      name: "Joe's Pizza",
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(LocalBusinessSchema)(localBusiness)

    // THEN: Minimal local business should be accepted
    expect(result['@context']).toBe('https://schema.org')
    expect(result['@type']).toBe('LocalBusiness')
    expect(result.name).toBe("Joe's Pizza")
  })

  test('should accept local business with address', () => {
    // GIVEN: Local business with postal address
    const localBusiness = {
      '@context': 'https://schema.org' as const,
      '@type': 'LocalBusiness' as const,
      name: "Joe's Pizza",
      address: {
        '@type': 'PostalAddress' as const,
        streetAddress: '123 Main St',
        addressLocality: 'Strasbourg',
        addressRegion: 'Grand Est',
        postalCode: '67000',
        addressCountry: 'FR',
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(LocalBusinessSchema)(localBusiness)

    // THEN: Address should be accepted
    expect(result.address?.addressCountry).toBe('FR')
    expect(result.address?.addressLocality).toBe('Strasbourg')
  })

  test('should accept local business with geo coordinates', () => {
    // GIVEN: Local business with latitude and longitude
    const localBusiness = {
      '@context': 'https://schema.org' as const,
      '@type': 'LocalBusiness' as const,
      name: "Joe's Pizza",
      geo: {
        '@type': 'GeoCoordinates' as const,
        latitude: '48.5734',
        longitude: '7.7521',
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(LocalBusinessSchema)(localBusiness)

    // THEN: Geo coordinates should be accepted
    expect(result.geo?.['@type']).toBe('GeoCoordinates')
    expect(result.geo?.latitude).toBe('48.5734')
    expect(result.geo?.longitude).toBe('7.7521')
  })

  test('should accept all 7 days of week', () => {
    // GIVEN: All days of the week
    const days = [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ] as const

    days.forEach((day) => {
      const localBusiness = {
        '@context': 'https://schema.org' as const,
        '@type': 'LocalBusiness' as const,
        name: "Joe's Pizza",
        openingHoursSpecification: [
          {
            '@type': 'OpeningHoursSpecification' as const,
            dayOfWeek: [day],
            opens: '09:00',
            closes: '22:00',
          },
        ],
      }

      // WHEN: Schema validation is performed
      const result = Schema.decodeUnknownSync(LocalBusinessSchema)(localBusiness)

      // THEN: Day of week should be accepted
      expect(result.openingHoursSpecification![0]!.dayOfWeek![0]).toBe(day)
    })
  })

  test('should accept valid time format', () => {
    // GIVEN: Opening hours with HH:MM format
    const localBusiness = {
      '@context': 'https://schema.org' as const,
      '@type': 'LocalBusiness' as const,
      name: "Joe's Pizza",
      openingHoursSpecification: [
        {
          '@type': 'OpeningHoursSpecification' as const,
          opens: '09:00',
          closes: '18:30',
        },
      ],
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(LocalBusinessSchema)(localBusiness)

    // THEN: Time format should be accepted
    expect(result.openingHoursSpecification?.[0].opens).toBe('09:00')
    expect(result.openingHoursSpecification?.[0].closes).toBe('18:30')
  })

  test('should reject invalid time format', () => {
    // GIVEN: Opening hours with invalid time format
    const localBusiness = {
      '@context': 'https://schema.org' as const,
      '@type': 'LocalBusiness' as const,
      name: "Joe's Pizza",
      openingHoursSpecification: [
        {
          '@type': 'OpeningHoursSpecification' as const,
          opens: '9:00',
          closes: '18:30',
        },
      ],
    }

    // WHEN: Schema validation is performed
    // THEN: Should reject (time must be HH:MM format)
    expect(() => Schema.decodeUnknownSync(LocalBusinessSchema)(localBusiness)).toThrow()
  })

  test('should accept weekday and weekend opening hours', () => {
    // GIVEN: Different hours for weekdays and weekends
    const localBusiness = {
      '@context': 'https://schema.org' as const,
      '@type': 'LocalBusiness' as const,
      name: "Joe's Pizza",
      openingHoursSpecification: [
        {
          '@type': 'OpeningHoursSpecification' as const,
          dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          opens: '11:00',
          closes: '22:00',
        },
        {
          '@type': 'OpeningHoursSpecification' as const,
          dayOfWeek: ['Saturday', 'Sunday'],
          opens: '12:00',
          closes: '23:00',
        },
      ],
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(LocalBusinessSchema)(localBusiness)

    // THEN: Multiple opening hours specifications should be accepted
    expect(result.openingHoursSpecification).toHaveLength(2)
    expect(result.openingHoursSpecification?.[0].dayOfWeek).toHaveLength(5)
    expect(result.openingHoursSpecification?.[1].dayOfWeek).toHaveLength(2)
  })

  test('should accept price range indicator', () => {
    // GIVEN: Local business with price range
    const localBusiness = {
      '@context': 'https://schema.org' as const,
      '@type': 'LocalBusiness' as const,
      name: "Joe's Pizza",
      priceRange: '$$',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(LocalBusinessSchema)(localBusiness)

    // THEN: Price range should be accepted
    expect(result.priceRange).toBe('$$')
  })

  test('should accept complete local business configuration', () => {
    // GIVEN: Complete local business with all properties
    const localBusiness = {
      '@context': 'https://schema.org' as const,
      '@type': 'LocalBusiness' as const,
      name: "Joe's Pizza",
      description: 'Authentic Italian pizza restaurant',
      url: 'https://joespizza.com',
      logo: 'https://joespizza.com/logo.png',
      image: 'https://joespizza.com/storefront.jpg',
      email: 'contact@joespizza.com',
      telephone: '+1-555-123-4567',
      priceRange: '$$',
      address: {
        '@type': 'PostalAddress' as const,
        streetAddress: '123 Main St',
        addressLocality: 'Strasbourg',
        addressRegion: 'Grand Est',
        postalCode: '67000',
        addressCountry: 'FR',
      },
      geo: {
        '@type': 'GeoCoordinates' as const,
        latitude: '48.5734',
        longitude: '7.7521',
      },
      sameAs: ['https://facebook.com/joespizza', 'https://instagram.com/joespizza'],
      openingHoursSpecification: [
        {
          '@type': 'OpeningHoursSpecification' as const,
          dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          opens: '11:00',
          closes: '22:00',
        },
        {
          '@type': 'OpeningHoursSpecification' as const,
          dayOfWeek: ['Saturday', 'Sunday'],
          opens: '12:00',
          closes: '23:00',
        },
      ],
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(LocalBusinessSchema)(localBusiness)

    // THEN: Complete configuration should be accepted
    expect(result.name).toBe("Joe's Pizza")
    expect(result.priceRange).toBe('$$')
    expect(result.geo?.latitude).toBe('48.5734')
    expect(result.openingHoursSpecification).toHaveLength(2)
  })
})
