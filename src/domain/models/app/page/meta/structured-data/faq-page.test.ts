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
import { FaqPageSchema } from './faq-page'

describe('FaqPageSchema', () => {
  test('should accept FAQ page with single question', () => {
    // GIVEN: FAQ page with one question-answer pair
    const faqPage = {
      '@context': 'https://schema.org' as const,
      '@type': 'FAQPage' as const,
      mainEntity: [
        {
          '@type': 'Question' as const,
          name: 'What is the refund policy?',
          acceptedAnswer: {
            '@type': 'Answer' as const,
            text: 'We offer a 30-day money-back guarantee on all purchases.',
          },
        },
      ],
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(FaqPageSchema)(faqPage)

    // THEN: Single question FAQ should be accepted
    expect(result.mainEntity).toHaveLength(1)
    expect(result.mainEntity[0].name).toBe('What is the refund policy?')
    expect(result.mainEntity[0].acceptedAnswer.text).toContain('30-day')
  })

  test('should accept FAQ page with multiple questions', () => {
    // GIVEN: FAQ page with multiple questions
    const faqPage = {
      '@context': 'https://schema.org' as const,
      '@type': 'FAQPage' as const,
      mainEntity: [
        {
          '@type': 'Question' as const,
          name: 'What is the refund policy?',
          acceptedAnswer: {
            '@type': 'Answer' as const,
            text: 'We offer a 30-day money-back guarantee.',
          },
        },
        {
          '@type': 'Question' as const,
          name: 'How long does shipping take?',
          acceptedAnswer: {
            '@type': 'Answer' as const,
            text: 'Standard shipping takes 5-7 business days.',
          },
        },
        {
          '@type': 'Question' as const,
          name: 'Do you ship internationally?',
          acceptedAnswer: {
            '@type': 'Answer' as const,
            text: 'Yes, we ship to most countries worldwide.',
          },
        },
      ],
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(FaqPageSchema)(faqPage)

    // THEN: Multiple questions should be accepted
    expect(result.mainEntity).toHaveLength(3)
    expect(result.mainEntity[1].name).toBe('How long does shipping take?')
  })

  test('should accept answer with HTML formatting', () => {
    // GIVEN: Answer with HTML formatting
    const faqPage = {
      '@context': 'https://schema.org' as const,
      '@type': 'FAQPage' as const,
      mainEntity: [
        {
          '@type': 'Question' as const,
          name: 'What payment methods do you accept?',
          acceptedAnswer: {
            '@type': 'Answer' as const,
            text: '<p>We accept the following payment methods:</p><ul><li>Credit cards (Visa, Mastercard, Amex)</li><li>PayPal</li><li>Apple Pay</li></ul>',
          },
        },
      ],
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(FaqPageSchema)(faqPage)

    // THEN: HTML formatted answer should be accepted
    expect(result.mainEntity[0].acceptedAnswer.text).toContain('<ul>')
  })

  test('should accept FAQ with short answers', () => {
    // GIVEN: FAQ with concise answers
    const faqPage = {
      '@context': 'https://schema.org' as const,
      '@type': 'FAQPage' as const,
      mainEntity: [
        {
          '@type': 'Question' as const,
          name: 'Is there a free trial?',
          acceptedAnswer: {
            '@type': 'Answer' as const,
            text: 'Yes.',
          },
        },
      ],
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(FaqPageSchema)(faqPage)

    // THEN: Short answer should be accepted
    expect(result.mainEntity[0].acceptedAnswer.text).toBe('Yes.')
  })

  test('should accept FAQ with long detailed answers', () => {
    // GIVEN: FAQ with detailed answer
    const longAnswer =
      'Our comprehensive warranty covers all defects in materials and workmanship for a period of two years from the date of purchase. This includes free repairs or replacement at our discretion. The warranty does not cover damage from misuse, accidents, or normal wear and tear. To make a warranty claim, please contact our support team with your proof of purchase and a description of the issue.'

    const faqPage = {
      '@context': 'https://schema.org' as const,
      '@type': 'FAQPage' as const,
      mainEntity: [
        {
          '@type': 'Question' as const,
          name: 'What does the warranty cover?',
          acceptedAnswer: {
            '@type': 'Answer' as const,
            text: longAnswer,
          },
        },
      ],
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(FaqPageSchema)(faqPage)

    // THEN: Long detailed answer should be accepted
    expect(result.mainEntity[0].acceptedAnswer.text.length).toBeGreaterThan(200)
  })

  test('should accept comprehensive FAQ page', () => {
    // GIVEN: Comprehensive FAQ with 5+ questions
    const faqPage = {
      '@context': 'https://schema.org' as const,
      '@type': 'FAQPage' as const,
      mainEntity: [
        {
          '@type': 'Question' as const,
          name: 'What is your refund policy?',
          acceptedAnswer: {
            '@type': 'Answer' as const,
            text: 'We offer a 30-day money-back guarantee on all purchases.',
          },
        },
        {
          '@type': 'Question' as const,
          name: 'How long does shipping take?',
          acceptedAnswer: {
            '@type': 'Answer' as const,
            text: 'Standard shipping takes 5-7 business days. Express shipping takes 2-3 business days.',
          },
        },
        {
          '@type': 'Question' as const,
          name: 'Do you ship internationally?',
          acceptedAnswer: {
            '@type': 'Answer' as const,
            text: 'Yes, we ship to most countries worldwide. International shipping takes 10-15 business days.',
          },
        },
        {
          '@type': 'Question' as const,
          name: 'How can I track my order?',
          acceptedAnswer: {
            '@type': 'Answer' as const,
            text: 'You will receive a tracking number via email once your order ships. Use this number on our website to track your package.',
          },
        },
        {
          '@type': 'Question' as const,
          name: 'What payment methods do you accept?',
          acceptedAnswer: {
            '@type': 'Answer' as const,
            text: 'We accept all major credit cards, PayPal, Apple Pay, and Google Pay.',
          },
        },
      ],
    }

    // WHEN: Schema validation is performed
    const result = Schema.decodeUnknownSync(FaqPageSchema)(faqPage)

    // THEN: Comprehensive FAQ should be accepted
    expect(result.mainEntity).toHaveLength(5)
    expect(result['@context']).toBe('https://schema.org')
    expect(result['@type']).toBe('FAQPage')
  })
})
