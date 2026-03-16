/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import { PersonSchema } from './person'

describe('PersonSchema', () => {
  test('should accept minimal person with required properties', () => {
    // GIVEN: Minimal person with only required fields
    const person = {
      '@context': 'https://schema.org' as const,
      '@type': 'Person' as const,
      name: 'John Doe',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(PersonSchema)(person)

    // THEN: Minimal person should be accepted
    expect(result['@context']).toBe('https://schema.org')
    expect(result['@type']).toBe('Person')
    expect(result.name).toBe('John Doe')
  })

  test('should accept person with givenName and familyName', () => {
    // GIVEN: Person with first and last names
    const person = {
      '@context': 'https://schema.org' as const,
      '@type': 'Person' as const,
      name: 'John Doe',
      givenName: 'John',
      familyName: 'Doe',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(PersonSchema)(person)

    // THEN: Names should be accepted
    expect(result.givenName).toBe('John')
    expect(result.familyName).toBe('Doe')
  })

  test('should accept person with contact information', () => {
    // GIVEN: Person with email and telephone
    const person = {
      '@context': 'https://schema.org' as const,
      '@type': 'Person' as const,
      name: 'John Doe',
      email: 'john@example.com',
      telephone: '+1-555-123-4567',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(PersonSchema)(person)

    // THEN: Contact information should be accepted
    expect(result.email).toBe('john@example.com')
    expect(result.telephone).toBe('+1-555-123-4567')
  })

  test('should accept person with jobTitle and employer', () => {
    // GIVEN: Person with professional information
    const person = {
      '@context': 'https://schema.org' as const,
      '@type': 'Person' as const,
      name: 'John Doe',
      jobTitle: 'CEO',
      worksFor: {
        '@type': 'Organization' as const,
        name: 'Acme Inc',
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(PersonSchema)(person)

    // THEN: Professional information should be accepted
    expect(result.jobTitle).toBe('CEO')
    expect(result.worksFor?.['@type']).toBe('Organization')
    expect(result.worksFor?.name).toBe('Acme Inc')
  })

  test('should accept person with social media profiles', () => {
    // GIVEN: Person with sameAs social profiles
    const person = {
      '@context': 'https://schema.org' as const,
      '@type': 'Person' as const,
      name: 'John Doe',
      sameAs: ['https://linkedin.com/in/johndoe', 'https://twitter.com/johndoe'],
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(PersonSchema)(person)

    // THEN: Social profiles should be accepted
    expect(result.sameAs).toHaveLength(2)
    expect(result.sameAs?.[0]).toBe('https://linkedin.com/in/johndoe')
  })

  test('should accept person with postal address', () => {
    // GIVEN: Person with mailing address
    const person = {
      '@context': 'https://schema.org' as const,
      '@type': 'Person' as const,
      name: 'John Doe',
      address: {
        '@type': 'PostalAddress' as const,
        streetAddress: '123 Main St',
        addressLocality: 'San Francisco',
        addressRegion: 'CA',
        postalCode: '94105',
        addressCountry: 'US',
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(PersonSchema)(person)

    // THEN: Postal address should be accepted
    expect(result.address?.['@type']).toBe('PostalAddress')
    expect(result.address?.addressCountry).toBe('US')
  })

  test('should accept complete person configuration', () => {
    // GIVEN: Complete person with all properties
    const person = {
      '@context': 'https://schema.org' as const,
      '@type': 'Person' as const,
      name: 'John Doe',
      givenName: 'John',
      familyName: 'Doe',
      email: 'john@example.com',
      telephone: '+1-555-123-4567',
      url: 'https://johndoe.com',
      image: 'https://johndoe.com/photo.jpg',
      jobTitle: 'CEO',
      worksFor: {
        '@type': 'Organization' as const,
        name: 'Acme Inc',
      },
      sameAs: [
        'https://linkedin.com/in/johndoe',
        'https://twitter.com/johndoe',
        'https://github.com/johndoe',
      ],
      address: {
        '@type': 'PostalAddress' as const,
        streetAddress: '123 Main St',
        addressLocality: 'San Francisco',
        addressRegion: 'CA',
        postalCode: '94105',
        addressCountry: 'US',
      },
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(PersonSchema)(person)

    // THEN: Complete configuration should be accepted
    expect(result.name).toBe('John Doe')
    expect(result.jobTitle).toBe('CEO')
    expect(result.sameAs).toHaveLength(3)
    expect(result.worksFor?.name).toBe('Acme Inc')
  })
})
