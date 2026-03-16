/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import { EducationEventSchema } from './education-event'

describe('EducationEventSchema', () => {
  test('should accept minimal education event with required properties', () => {
    // GIVEN: Minimal event with only required fields
    const event = {
      '@type': 'EducationEvent' as const,
      name: 'React Masterclass Workshop',
      startDate: '2025-02-15T14:00:00-05:00',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(EducationEventSchema)(event)

    // THEN: Minimal event should be accepted
    expect(result['@type']).toBe('EducationEvent')
    expect(result.name).toBe('React Masterclass Workshop')
    expect(result.startDate).toBe('2025-02-15T14:00:00-05:00')
  })

  test('should accept event with start and end dates', () => {
    // GIVEN: Event with both start and end dates
    const event = {
      '@type': 'EducationEvent' as const,
      name: 'Photography Workshop',
      startDate: '2025-02-15T14:00:00-05:00',
      endDate: '2025-02-15T17:00:00-05:00',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(EducationEventSchema)(event)

    // THEN: Start and end dates should be accepted
    expect(result.startDate).toBe('2025-02-15T14:00:00-05:00')
    expect(result.endDate).toBe('2025-02-15T17:00:00-05:00')
  })

  test('should accept all 3 event attendance modes', () => {
    // GIVEN: Different attendance modes
    const attendanceModes = [
      'https://schema.org/OfflineEventAttendanceMode',
      'https://schema.org/OnlineEventAttendanceMode',
      'https://schema.org/MixedEventAttendanceMode',
    ] as const

    attendanceModes.forEach((mode) => {
      const event = {
        '@type': 'EducationEvent' as const,
        name: 'Workshop',
        startDate: '2025-02-15T14:00:00-05:00',
        eventAttendanceMode: mode,
      }

      // WHEN: Schema validation is performed
      const result = Schema.decodeUnknownSync(EducationEventSchema)(event)

      // THEN: Attendance mode should be accepted
      expect(result.eventAttendanceMode).toBe(mode)
    })
  })

  test('should accept all 4 event statuses', () => {
    // GIVEN: Different event statuses
    const statuses = [
      'https://schema.org/EventScheduled',
      'https://schema.org/EventCancelled',
      'https://schema.org/EventPostponed',
      'https://schema.org/EventRescheduled',
    ] as const

    statuses.forEach((status) => {
      const event = {
        '@type': 'EducationEvent' as const,
        name: 'Workshop',
        startDate: '2025-02-15T14:00:00-05:00',
        eventStatus: status,
      }

      // WHEN: Schema validation is performed
      const result = Schema.decodeUnknownSync(EducationEventSchema)(event)

      // THEN: Event status should be accepted
      expect(result.eventStatus).toBe(status)
    })
  })

  test('should accept event with physical location', () => {
    // GIVEN: In-person event with venue address
    const event = {
      '@type': 'EducationEvent' as const,
      name: 'React Masterclass Workshop',
      startDate: '2025-02-15T14:00:00-05:00',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode' as const,
      location: {
        '@type': 'Place' as const,
        name: 'Tech Hub Conference Center',
        address: {
          '@type': 'PostalAddress' as const,
          streetAddress: '123 Innovation Dr',
          addressLocality: 'San Francisco',
          addressRegion: 'CA',
          postalCode: '94105',
          addressCountry: 'US',
        },
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(EducationEventSchema)(event)

    // THEN: Location should be accepted
    expect(result.location?.['@type']).toBe('Place')
    expect(result.location?.name).toBe('Tech Hub Conference Center')
    expect(result.location?.address?.addressCountry).toBe('US')
  })

  test('should accept event with Organization organizer', () => {
    // GIVEN: Event organized by an organization
    const event = {
      '@type': 'EducationEvent' as const,
      name: 'React Masterclass Workshop',
      startDate: '2025-02-15T14:00:00-05:00',
      organizer: {
        '@type': 'Organization' as const,
        name: 'React Academy',
        url: 'https://reactacademy.com',
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(EducationEventSchema)(event)

    // THEN: Organization organizer should be accepted
    expect(result.organizer?.['@type']).toBe('Organization')
    expect(result.organizer?.name).toBe('React Academy')
  })

  test('should accept event with Person organizer', () => {
    // GIVEN: Event organized by a person
    const event = {
      '@type': 'EducationEvent' as const,
      name: 'Photography Workshop',
      startDate: '2025-02-15T14:00:00-05:00',
      organizer: {
        '@type': 'Person' as const,
        name: 'John Doe',
        url: 'https://johndoe.com',
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(EducationEventSchema)(event)

    // THEN: Person organizer should be accepted
    expect(result.organizer?.['@type']).toBe('Person')
    expect(result.organizer?.name).toBe('John Doe')
  })

  test('should accept event with ticket offer', () => {
    // GIVEN: Event with pricing information
    const event = {
      '@type': 'EducationEvent' as const,
      name: 'React Masterclass Workshop',
      startDate: '2025-02-15T14:00:00-05:00',
      offers: {
        '@type': 'Offer' as const,
        price: '149.00',
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock' as const,
        url: 'https://reactacademy.com/workshops/react-masterclass',
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(EducationEventSchema)(event)

    // THEN: Ticket offer should be accepted
    expect(result.offers?.['@type']).toBe('Offer')
    expect(result.offers?.price).toBe('149.00')
    expect(result.offers?.priceCurrency).toBe('USD')
  })

  test('should accept free event with zero price', () => {
    // GIVEN: Free event with price 0
    const event = {
      '@type': 'EducationEvent' as const,
      name: 'Free Intro Workshop',
      startDate: '2025-02-15T14:00:00-05:00',
      offers: {
        '@type': 'Offer' as const,
        price: '0',
        priceCurrency: 'USD',
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(EducationEventSchema)(event)

    // THEN: Free event should be accepted
    expect(result.offers?.price).toBe('0')
  })

  test('should accept event with attendee capacity', () => {
    // GIVEN: Event with min and max capacity
    const event = {
      '@type': 'EducationEvent' as const,
      name: 'Small Workshop',
      startDate: '2025-02-15T14:00:00-05:00',
      minimumAttendeeCapacity: 5,
      maximumAttendeeCapacity: 20,
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(EducationEventSchema)(event)

    // THEN: Attendee capacity should be accepted
    expect(result.minimumAttendeeCapacity).toBe(5)
    expect(result.maximumAttendeeCapacity).toBe(20)
  })

  test('should reject negative attendee capacity', () => {
    // GIVEN: Event with negative capacity
    const event = {
      '@type': 'EducationEvent' as const,
      name: 'Workshop',
      startDate: '2025-02-15T14:00:00-05:00',
      maximumAttendeeCapacity: -10,
    }

    // WHEN: Schema validation is performed
    // THEN: Should reject (capacity must be >= 1)
    expect(() => Schema.decodeUnknownSync(EducationEventSchema)(event)).toThrow()
  })

  test('should accept complete education event configuration', () => {
    // GIVEN: Complete event with all properties
    const event = {
      '@type': 'EducationEvent' as const,
      name: 'React Masterclass Workshop',
      description: 'Learn advanced React patterns with hands-on exercises',
      startDate: '2025-02-15T14:00:00-05:00',
      endDate: '2025-02-15T17:00:00-05:00',
      eventAttendanceMode: 'https://schema.org/MixedEventAttendanceMode' as const,
      eventStatus: 'https://schema.org/EventScheduled' as const,
      location: {
        '@type': 'Place' as const,
        name: 'Tech Hub Conference Center',
        address: {
          '@type': 'PostalAddress' as const,
          streetAddress: '123 Innovation Dr',
          addressLocality: 'San Francisco',
          addressRegion: 'CA',
          postalCode: '94105',
          addressCountry: 'US',
        },
      },
      organizer: {
        '@type': 'Organization' as const,
        name: 'React Academy',
        url: 'https://reactacademy.com',
      },
      offers: {
        '@type': 'Offer' as const,
        price: '149.00',
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock' as const,
        url: 'https://reactacademy.com/workshops/react-masterclass',
      },
      maximumAttendeeCapacity: 30,
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(EducationEventSchema)(event)

    // THEN: Complete configuration should be accepted
    expect(result.name).toBe('React Masterclass Workshop')
    expect(result.eventAttendanceMode).toBe('https://schema.org/MixedEventAttendanceMode')
    expect(result.location?.name).toBe('Tech Hub Conference Center')
    expect(result.maximumAttendeeCapacity).toBe(30)
  })
})
