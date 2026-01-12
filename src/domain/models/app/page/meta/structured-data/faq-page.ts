/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { SchemaOrgContext, schemaType } from './common-fields'

/**
 * FAQ answer
 *
 * Represents the accepted answer to a question.
 *
 * Required properties:
 * - @type: "Answer" (Schema.org type identifier)
 * - text: The answer text/content
 */
export const FaqAnswerSchema = Schema.Struct({
  '@type': schemaType('Answer'),
  text: Schema.String.annotations({
    description: 'The answer text',
  }),
}).annotations({
  description: 'FAQ answer',
})

/**
 * FAQ question with accepted answer
 *
 * Represents a single question-answer pair in an FAQ.
 *
 * Required properties:
 * - @type: "Question" (Schema.org type identifier)
 * - name: The question text
 * - acceptedAnswer: The answer object (Answer type with text)
 */
export const FaqQuestionSchema = Schema.Struct({
  '@type': schemaType('Question'),
  name: Schema.String.annotations({
    description: 'The question text',
  }),
  acceptedAnswer: FaqAnswerSchema,
}).annotations({
  description: 'FAQ question',
})

/**
 * Schema.org FAQPage structured data
 *
 * Represents a Frequently Asked Questions page with a list of question-answer pairs.
 * Enables expandable Q&A rich results in Google search, dramatically increasing
 * visibility and click-through rates.
 *
 * Required properties:
 * - @context: "https://schema.org" (Schema.org vocabulary)
 * - @type: "FAQPage" (Schema.org type identifier)
 * - mainEntity: Array of Question objects (each with name and acceptedAnswer)
 *
 * Question structure:
 * - Each question has @type "Question", name (question text), acceptedAnswer
 * - Each acceptedAnswer has @type "Answer", text (answer content)
 * - Questions can include HTML in answer text for formatting (lists, bold, links)
 *
 * Best practices:
 * - **5-10 questions**: Optimal number for comprehensive FAQ
 * - **Concise questions**: Clear, direct questions users would ask
 * - **Detailed answers**: Complete answers that satisfy user intent
 * - **Natural language**: Write questions as users would ask them
 * - **Avoid promotional content**: Focus on answering questions, not selling
 *
 * SEO impact:
 * - **Rich results**: Expandable Q&A boxes in Google search results
 * - **SERP visibility**: Takes up more screen space (higher CTR)
 * - **Answer surfacing**: Users see answers without clicking through
 * - **Featured snippets**: FAQ answers can appear in featured snippets
 * - **Voice search**: Answers optimized for voice search queries
 * - **Support reduction**: Answers in search reduce support ticket volume
 *
 * Google display:
 * - Questions appear as expandable boxes in search results
 * - Users can expand/collapse answers directly in search
 * - Clicking question takes user to FAQ page with answer highlighted
 *
 * @example
 * ```typescript
 * const faqPage = {
 *   "@context": "https://schema.org",
 *   "@type": "FAQPage",
 *   mainEntity: [
 *     {
 *       "@type": "Question",
 *       name: "What is the refund policy?",
 *       acceptedAnswer: {
 *         "@type": "Answer",
 *         text: "We offer a 30-day money-back guarantee on all purchases."
 *       }
 *     },
 *     {
 *       "@type": "Question",
 *       name: "How long does shipping take?",
 *       acceptedAnswer: {
 *         "@type": "Answer",
 *         text: "Standard shipping takes 5-7 business days. Express shipping takes 2-3 business days."
 *       }
 *     }
 *   ]
 * }
 * ```
 *
 * @see specs/app/pages/meta/structured-data/faq-page.schema.json
 */
export const FaqPageSchema = Schema.Struct({
  '@context': SchemaOrgContext,
  '@type': schemaType('FAQPage'),
  mainEntity: Schema.Array(FaqQuestionSchema).annotations({
    description: 'Array of questions and answers',
  }),
}).annotations({
  title: 'FAQ Page Schema',
  description: 'Schema.org FAQPage structured data',
})

export type FaqAnswer = Schema.Schema.Type<typeof FaqAnswerSchema>
export type FaqQuestion = Schema.Schema.Type<typeof FaqQuestionSchema>
export type FaqPage = Schema.Schema.Type<typeof FaqPageSchema>
