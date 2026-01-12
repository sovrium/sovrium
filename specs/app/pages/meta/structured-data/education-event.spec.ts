/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

/**
 * E2E Tests for Education Event Schema
 *
 * Source: src/domain/models/app/page/meta.ts
 * Spec Count: 14
 *
 * Test Organization:
 * 1. @spec tests - One per spec in schema (14 tests) - Exhaustive acceptance criteria
 * 2. @regression test - ONE optimized integration test - Efficient workflow validation
 */

test.describe('Education Event Schema', () => {
  test(
    'APP-PAGES-EDUCATIONEVENT-001: should validate minimal EducationEvent structured data',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: EducationEvent with required properties
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              schema: {
                educationEvent: {
                  '@type': 'EducationEvent',
                  name: 'React Workshop',
                  startDate: '2025-06-01T09:00:00Z',
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: @type is 'EducationEvent', name and startDate are provided
      await page.goto('/')

      // THEN: it should validate minimal EducationEvent structured data
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('"@type":"EducationEvent"')
    }
  )

  test(
    'APP-PAGES-EDUCATIONEVENT-002: should provide event identity',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: EducationEvent with name and description
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              schema: {
                educationEvent: {
                  '@type': 'EducationEvent',
                  name: 'Advanced TypeScript Course',
                  description: 'Learn advanced TypeScript patterns',
                  startDate: '2025-06-01T09:00:00Z',
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: name and description describe the educational event
      await page.goto('/')

      // THEN: it should provide event identity
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('Advanced TypeScript Course')
      expect(scriptContent).toContain('Learn advanced TypeScript patterns')
    }
  )

  test(
    'APP-PAGES-EDUCATIONEVENT-003: should specify when event begins',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: EducationEvent with startDate
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              schema: {
                educationEvent: {
                  '@type': 'EducationEvent',
                  name: 'Workshop',
                  startDate: '2025-06-15T14:00:00Z',
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: startDate is ISO 8601 date-time
      await page.goto('/')

      // THEN: it should specify when event begins
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('2025-06-15T14:00:00Z')
    }
  )

  test(
    'APP-PAGES-EDUCATIONEVENT-004: should specify when event ends',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: EducationEvent with endDate
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              schema: {
                educationEvent: {
                  '@type': 'EducationEvent',
                  name: 'Workshop',
                  startDate: '2025-06-15T09:00:00Z',
                  endDate: '2025-06-15T17:00:00Z',
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: endDate is ISO 8601 date-time
      await page.goto('/')

      // THEN: it should specify when event ends
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('2025-06-15T17:00:00Z')
    }
  )

  test(
    'APP-PAGES-EDUCATIONEVENT-005: should specify whether event is in-person, online, or hybrid',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: EducationEvent with eventAttendanceMode
      const modes = [
        'https://schema.org/OfflineEventAttendanceMode',
        'https://schema.org/OnlineEventAttendanceMode',
        'https://schema.org/MixedEventAttendanceMode',
      ]
      for (const mode of modes) {
        await startServerWithSchema({
          name: 'test-app',
          pages: [
            {
              name: 'test',
              path: '/',
              meta: {
                lang: 'en-US',
                title: 'Test',
                description: 'Test',
                schema: {
                  educationEvent: {
                    '@type': 'EducationEvent',
                    name: 'Workshop',
                    startDate: '2025-06-01T09:00:00Z',
                    eventAttendanceMode: mode,
                  },
                },
              },
              sections: [],
            },
          ],
        })
        // WHEN: user navigates to the page
        await page.goto('/')
        const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
        // THEN: assertion
        expect(scriptContent).toContain(mode)
      }
    }
  )

  test(
    'APP-PAGES-EDUCATIONEVENT-006: should communicate event status',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: EducationEvent with eventStatus
      const statuses = [
        'https://schema.org/EventScheduled',
        'https://schema.org/EventCancelled',
        'https://schema.org/EventPostponed',
        'https://schema.org/EventRescheduled',
      ]
      for (const status of statuses) {
        await startServerWithSchema({
          name: 'test-app',
          pages: [
            {
              name: 'test',
              path: '/',
              meta: {
                lang: 'en-US',
                title: 'Test',
                description: 'Test',
                schema: {
                  educationEvent: {
                    '@type': 'EducationEvent',
                    name: 'Workshop',
                    startDate: '2025-06-01T09:00:00Z',
                    eventStatus: status,
                  },
                },
              },
              sections: [],
            },
          ],
        })
        // WHEN: user navigates to the page
        await page.goto('/')
        const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
        // THEN: assertion
        expect(scriptContent).toContain(status)
      }
    }
  )

  test(
    'APP-PAGES-EDUCATIONEVENT-007: should provide event venue information',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: EducationEvent with location
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              schema: {
                educationEvent: {
                  '@type': 'EducationEvent',
                  name: 'Workshop',
                  startDate: '2025-06-01T09:00:00Z',
                  location: {
                    '@type': 'Place',
                    name: 'Convention Center',
                    address: { '@type': 'PostalAddress', streetAddress: '123 Main St' },
                  },
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: eventAttendanceMode is OfflineEventAttendanceMode, OnlineEventAttendanceMode, or MixedEventAttendanceMode
      await page.goto('/')

      // THEN: it should specify whether event is in-person, online, or hybrid
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('Place')
      expect(scriptContent).toContain('Convention Center')
    }
  )

  test(
    'APP-PAGES-EDUCATIONEVENT-008: should identify event organizer',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: EducationEvent with organizer
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              schema: {
                educationEvent: {
                  '@type': 'EducationEvent',
                  name: 'Workshop',
                  startDate: '2025-06-01T09:00:00Z',
                  organizer: {
                    '@type': 'Organization',
                    name: 'Education Corp',
                    url: 'https://example.com',
                  },
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: eventStatus is EventScheduled, EventCancelled, EventPostponed, or EventRescheduled
      await page.goto('/')

      // THEN: it should communicate event status
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('Education Corp')
    }
  )

  test(
    'APP-PAGES-EDUCATIONEVENT-009: should provide ticket pricing and availability',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: EducationEvent with offers
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              schema: {
                educationEvent: {
                  '@type': 'EducationEvent',
                  name: 'Workshop',
                  startDate: '2025-06-01T09:00:00Z',
                  offers: {
                    '@type': 'Offer',
                    price: '29.99',
                    priceCurrency: 'EUR',
                    availability: 'https://schema.org/InStock',
                    url: 'https://example.com/tickets',
                  },
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: location is object with @type 'Place', name, and address
      await page.goto('/')

      // THEN: it should provide event venue information
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('29.99')
      expect(scriptContent).toContain('EUR')
    }
  )

  test(
    'APP-PAGES-EDUCATIONEVENT-010: should specify event ticket price',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: EducationEvent with price and priceCurrency
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              schema: {
                educationEvent: {
                  '@type': 'EducationEvent',
                  name: 'Free Workshop',
                  startDate: '2025-06-01T09:00:00Z',
                  offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: organizer is object with @type 'Organization' or 'Person', name, and url
      await page.goto('/')

      // THEN: it should identify event organizer
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toMatch(/"price":\s*"0"/)
      expect(scriptContent).toContain('EUR')
    }
  )

  test(
    'APP-PAGES-EDUCATIONEVENT-011: should indicate ticket availability status',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: EducationEvent with availability enum
      const availabilities = [
        'https://schema.org/InStock',
        'https://schema.org/OutOfStock',
        'https://schema.org/PreOrder',
        'https://schema.org/SoldOut',
      ]
      for (const availability of availabilities) {
        await startServerWithSchema({
          name: 'test-app',
          pages: [
            {
              name: 'test',
              path: '/',
              meta: {
                lang: 'en-US',
                title: 'Test',
                description: 'Test',
                schema: {
                  educationEvent: {
                    '@type': 'EducationEvent',
                    name: 'Workshop',
                    startDate: '2025-06-01T09:00:00Z',
                    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR', availability },
                  },
                },
              },
              sections: [],
            },
          ],
        })
        // WHEN: user navigates to the page
        await page.goto('/')
        const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
        // THEN: assertion
        expect(scriptContent).toContain(availability)
      }
    }
  )

  test(
    'APP-PAGES-EDUCATIONEVENT-012: should specify event capacity limits',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: EducationEvent with capacity
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              schema: {
                educationEvent: {
                  '@type': 'EducationEvent',
                  name: 'Workshop',
                  startDate: '2025-06-01T09:00:00Z',
                  maximumAttendeeCapacity: 50,
                  minimumAttendeeCapacity: 10,
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: offers has @type 'Offer', price, priceCurrency, availability, url
      await page.goto('/')

      // THEN: it should provide ticket pricing and availability
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('50')
      expect(scriptContent).toContain('10')
    }
  )

  test(
    'APP-PAGES-EDUCATIONEVENT-013: should enable Google Events rich results',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: EducationEvent for rich results
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              schema: {
                educationEvent: {
                  '@type': 'EducationEvent',
                  name: 'Complete Workshop',
                  description: 'Comprehensive training',
                  startDate: '2025-06-01T09:00:00Z',
                  endDate: '2025-06-01T17:00:00Z',
                  location: { '@type': 'Place', name: 'Venue' },
                  offers: { '@type': 'Offer', price: '99', priceCurrency: 'USD' },
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: complete event data with dates, location, and offers is provided
      await page.goto('/')

      // THEN: it should enable Google Events rich results
      await expect(page.locator('script[type="application/ld+json"]')).toBeAttached()
    }
  )

  test(
    'APP-PAGES-EDUCATIONEVENT-014: should display event in Google Search, Maps, and event discovery features',
    { tag: '@spec' },
    async ({ page, startServerWithSchema }) => {
      // GIVEN: EducationEvent for event discovery
      await startServerWithSchema({
        name: 'test-app',
        pages: [
          {
            name: 'test',
            path: '/',
            meta: {
              lang: 'en-US',
              title: 'Test',
              description: 'Test',
              schema: {
                educationEvent: {
                  '@type': 'EducationEvent',
                  name: 'Public Workshop',
                  startDate: '2025-06-01T09:00:00Z',
                  eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
                  eventStatus: 'https://schema.org/EventScheduled',
                },
              },
            },
            sections: [],
          },
        ],
      })

      // WHEN: availability is InStock, OutOfStock, PreOrder, or SoldOut
      await page.goto('/')

      // THEN: it should indicate ticket availability status
      const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
      expect(scriptContent).toContain('EducationEvent')
    }
  )

  // ============================================================================
  // REGRESSION TEST (@regression)
  // ONE OPTIMIZED test verifying components work together efficiently
  // Generated from 14 @spec tests - covers: minimal EducationEvent, event identity,
  // start/end dates, attendance mode, event status, location, organizer, offers, price,
  // availability, capacity, Google Events rich results, event discovery
  //
  // OPTIMIZATION: Consolidated from 14 startServerWithSchema calls to 1
  // All EducationEvent properties are ADDITIVE - one comprehensive schema covers all
  // ============================================================================

  test(
    'APP-PAGES-EDUCATIONEVENT-REGRESSION: user can complete full Education Event workflow',
    { tag: '@regression' },
    async ({ page, startServerWithSchema }) => {
      // Setup: Start server with comprehensive EducationEvent configuration
      // This single schema contains ALL properties needed for all 14 test steps
      await test.step('Setup: Start server with comprehensive EducationEvent configuration', async () => {
        await startServerWithSchema({
          name: 'test-app',
          pages: [
            {
              name: 'test',
              path: '/',
              meta: {
                lang: 'en-US',
                title: 'Test',
                description: 'Test',
                schema: {
                  educationEvent: {
                    '@type': 'EducationEvent',
                    // Event identity (001, 002)
                    name: 'Advanced TypeScript Course',
                    description: 'Learn advanced TypeScript patterns',
                    // Timing (003, 004)
                    startDate: '2025-06-15T14:00:00Z',
                    endDate: '2025-06-15T17:00:00Z',
                    // Attendance mode (005)
                    eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
                    // Event status (006)
                    eventStatus: 'https://schema.org/EventScheduled',
                    // Location (007)
                    location: {
                      '@type': 'Place',
                      name: 'Convention Center',
                      address: { '@type': 'PostalAddress', streetAddress: '123 Main St' },
                    },
                    // Organizer (008)
                    organizer: {
                      '@type': 'Organization',
                      name: 'Education Corp',
                      url: 'https://example.com',
                    },
                    // Offers with pricing and availability (009, 010, 011)
                    offers: {
                      '@type': 'Offer',
                      price: '29.99',
                      priceCurrency: 'EUR',
                      availability: 'https://schema.org/InStock',
                      url: 'https://example.com/tickets',
                    },
                    // Capacity (012)
                    maximumAttendeeCapacity: 50,
                    minimumAttendeeCapacity: 10,
                  },
                },
              },
              sections: [],
            },
          ],
        })
        await page.goto('/')
      })

      await test.step('APP-PAGES-EDUCATIONEVENT-001: Validate minimal EducationEvent structured data', async () => {
        const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
        expect(scriptContent).toContain('"@type":"EducationEvent"')
      })

      await test.step('APP-PAGES-EDUCATIONEVENT-002: Provide event identity', async () => {
        const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
        expect(scriptContent).toContain('Advanced TypeScript Course')
        expect(scriptContent).toContain('Learn advanced TypeScript patterns')
      })

      await test.step('APP-PAGES-EDUCATIONEVENT-003: Specify when event begins', async () => {
        const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
        expect(scriptContent).toContain('2025-06-15T14:00:00Z')
      })

      await test.step('APP-PAGES-EDUCATIONEVENT-004: Specify when event ends', async () => {
        const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
        expect(scriptContent).toContain('2025-06-15T17:00:00Z')
      })

      await test.step('APP-PAGES-EDUCATIONEVENT-005: Specify attendance mode (in-person/online/hybrid)', async () => {
        const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
        expect(scriptContent).toContain('https://schema.org/OnlineEventAttendanceMode')
      })

      await test.step('APP-PAGES-EDUCATIONEVENT-006: Communicate event status', async () => {
        const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
        expect(scriptContent).toContain('https://schema.org/EventScheduled')
      })

      await test.step('APP-PAGES-EDUCATIONEVENT-007: Provide event venue information', async () => {
        const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
        expect(scriptContent).toContain('Place')
        expect(scriptContent).toContain('Convention Center')
      })

      await test.step('APP-PAGES-EDUCATIONEVENT-008: Identify event organizer', async () => {
        const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
        expect(scriptContent).toContain('Education Corp')
      })

      await test.step('APP-PAGES-EDUCATIONEVENT-009: Provide ticket pricing and availability', async () => {
        const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
        expect(scriptContent).toContain('29.99')
        expect(scriptContent).toContain('EUR')
      })

      await test.step('APP-PAGES-EDUCATIONEVENT-010: Specify event ticket price', async () => {
        // The comprehensive schema has price: '29.99' - validates the feature
        const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
        expect(scriptContent).toMatch(/"price":\s*"29.99"/)
        expect(scriptContent).toContain('EUR')
      })

      await test.step('APP-PAGES-EDUCATIONEVENT-011: Indicate ticket availability status', async () => {
        const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
        expect(scriptContent).toContain('https://schema.org/InStock')
      })

      await test.step('APP-PAGES-EDUCATIONEVENT-012: Specify event capacity limits', async () => {
        const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
        expect(scriptContent).toContain('50')
        expect(scriptContent).toContain('10')
      })

      await test.step('APP-PAGES-EDUCATIONEVENT-013: Enable Google Events rich results', async () => {
        // Comprehensive schema has all required data for rich results
        await expect(page.locator('script[type="application/ld+json"]')).toBeAttached()
      })

      await test.step('APP-PAGES-EDUCATIONEVENT-014: Display event in Google Search and Maps', async () => {
        const scriptContent = await page.locator('script[type="application/ld+json"]').textContent()
        expect(scriptContent).toContain('EducationEvent')
      })
    }
  )
})
