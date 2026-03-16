/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import { OrganizationSchema } from './organization'

describe('OrganizationSchema', () => {
  test('should accept minimal organization with required properties', () => {
    // GIVEN: Minimal organization with only required fields
    const organization = {
      '@context': 'https://schema.org' as const,
      '@type': 'Organization' as const,
      name: 'Acme Inc',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(OrganizationSchema)(organization)

    // THEN: Minimal organization should be accepted
    expect(result['@context']).toBe('https://schema.org')
    expect(result['@type']).toBe('Organization')
    expect(result.name).toBe('Acme Inc')
  })

  test('should accept organization with description and URL', () => {
    // GIVEN: Organization with description and website
    const organization = {
      '@context': 'https://schema.org' as const,
      '@type': 'Organization' as const,
      name: 'Acme Inc',
      description: 'Leading provider of business software solutions',
      url: 'https://acme.com',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(OrganizationSchema)(organization)

    // THEN: Description and URL should be accepted
    expect(result.description).toBe('Leading provider of business software solutions')
    expect(result.url).toBe('https://acme.com')
  })

  test('should accept organization with logo', () => {
    // GIVEN: Organization with logo
    const organization = {
      '@context': 'https://schema.org' as const,
      '@type': 'Organization' as const,
      name: 'Acme Inc',
      logo: 'https://acme.com/logo.png',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(OrganizationSchema)(organization)

    // THEN: Logo should be accepted
    expect(result.logo).toBe('https://acme.com/logo.png')
  })

  test('should accept organization with single image', () => {
    // GIVEN: Organization with single image
    const organization = {
      '@context': 'https://schema.org' as const,
      '@type': 'Organization' as const,
      name: 'Acme Inc',
      image: 'https://acme.com/headquarters.jpg',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(OrganizationSchema)(organization)

    // THEN: Single image should be accepted
    expect(result.image).toBe('https://acme.com/headquarters.jpg')
  })

  test('should accept organization with multiple images', () => {
    // GIVEN: Organization with multiple images
    const organization = {
      '@context': 'https://schema.org' as const,
      '@type': 'Organization' as const,
      name: 'Acme Inc',
      image: [
        'https://acme.com/headquarters.jpg',
        'https://acme.com/products.jpg',
        'https://acme.com/team.jpg',
      ],
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(OrganizationSchema)(organization)

    // THEN: Multiple images should be accepted
    expect(Array.isArray(result.image)).toBe(true)
    if (Array.isArray(result.image)) {
      expect(result.image).toHaveLength(3)
    }
  })

  test('should accept organization with contact information', () => {
    // GIVEN: Organization with email and telephone
    const organization = {
      '@context': 'https://schema.org' as const,
      '@type': 'Organization' as const,
      name: 'Acme Inc',
      email: 'contact@acme.com',
      telephone: '+1-555-123-4567',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(OrganizationSchema)(organization)

    // THEN: Contact information should be accepted
    expect(result.email).toBe('contact@acme.com')
    expect(result.telephone).toBe('+1-555-123-4567')
  })

  test('should accept organization with postal address', () => {
    // GIVEN: Organization with mailing address
    const organization = {
      '@context': 'https://schema.org' as const,
      '@type': 'Organization' as const,
      name: 'Acme Inc',
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
    const result = Schema.decodeUnknownSync(OrganizationSchema)(organization)

    // THEN: Postal address should be accepted
    expect(result.address?.['@type']).toBe('PostalAddress')
    expect(result.address?.addressCountry).toBe('US')
  })

  test('should accept organization with social media profiles', () => {
    // GIVEN: Organization with sameAs social profiles
    const organization = {
      '@context': 'https://schema.org' as const,
      '@type': 'Organization' as const,
      name: 'Acme Inc',
      sameAs: [
        'https://facebook.com/acmeinc',
        'https://twitter.com/acmeinc',
        'https://linkedin.com/company/acmeinc',
      ],
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(OrganizationSchema)(organization)

    // THEN: Social profiles should be accepted
    expect(result.sameAs).toHaveLength(3)
    expect(result.sameAs?.[0]).toBe('https://facebook.com/acmeinc')
  })

  test('should accept organization with founder information', () => {
    // GIVEN: Organization with founder and founding date
    const organization = {
      '@context': 'https://schema.org' as const,
      '@type': 'Organization' as const,
      name: 'Acme Inc',
      founder: 'Jane Doe',
      foundingDate: '2015-01-15',
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(OrganizationSchema)(organization)

    // THEN: Founder information should be accepted
    expect(result.founder).toBe('Jane Doe')
    expect(result.foundingDate).toBe('2015-01-15')
  })

  test('should accept organization with employee count', () => {
    // GIVEN: Organization with number of employees
    const organization = {
      '@context': 'https://schema.org' as const,
      '@type': 'Organization' as const,
      name: 'Acme Inc',
      employees: 150,
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(OrganizationSchema)(organization)

    // THEN: Employee count should be accepted
    expect(result.employees).toBe(150)
  })

  test('should reject negative employee count', () => {
    // GIVEN: Organization with negative employee count
    const organization = {
      '@context': 'https://schema.org' as const,
      '@type': 'Organization' as const,
      name: 'Acme Inc',
      employees: -5,
    }

    // WHEN: Schema validation is performed
    // THEN: Should reject (must be >= 1)
    expect(() => Schema.decodeUnknownSync(OrganizationSchema)(organization)).toThrow()
  })

  test('should accept complete organization configuration', () => {
    // GIVEN: Complete organization with all properties
    const organization = {
      '@context': 'https://schema.org' as const,
      '@type': 'Organization' as const,
      name: 'Acme Inc',
      description: 'Leading provider of business software solutions',
      url: 'https://acme.com',
      logo: 'https://acme.com/logo.png',
      image: ['https://acme.com/headquarters.jpg', 'https://acme.com/products.jpg'],
      email: 'contact@acme.com',
      telephone: '+1-555-123-4567',
      address: {
        '@type': 'PostalAddress' as const,
        streetAddress: '123 Main St',
        addressLocality: 'San Francisco',
        addressRegion: 'CA',
        postalCode: '94105',
        addressCountry: 'US',
      },
      sameAs: [
        'https://facebook.com/acmeinc',
        'https://twitter.com/acmeinc',
        'https://linkedin.com/company/acmeinc',
      ],
      founder: 'Jane Doe',
      foundingDate: '2015-01-15',
      employees: 150,
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(OrganizationSchema)(organization)

    // THEN: Complete configuration should be accepted
    expect(result.name).toBe('Acme Inc')
    expect(result.employees).toBe(150)
    expect(result.sameAs).toHaveLength(3)
  })
})
