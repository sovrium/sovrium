/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { errorResponseSchema } from '@/domain/models/api/combinators/error'
import { createSubmissionRequestSchema, submissionResponseSchema } from '@/domain/models/api/forms'
import {
  effectJsonBody,
  effectJsonResponse,
  effectParameters,
  effectSchema,
} from '@/presentation/api/openapi/route-fragments'
import { type ResourceGroupSpec, type RouteSpec } from '../openapi/route-spec'

/**
 * Form routes — resource-scoped to `app.forms`. Each configured form expands
 * into a concrete copy of every route below, tagged `Form: <name>`. The form
 * rendering routes return HTML; only the submission route returns JSON.
 */

const errorResponse = (description: string) => effectJsonResponse(errorResponseSchema, description)
const htmlResponse = (description: string) => ({
  content: { 'text/html': { schema: effectSchema(Schema.String) } },
  description,
})

const routes: readonly RouteSpec[] = [
  {
    method: 'get',
    pathTemplate: '/forms/{formSlug}/embed',
    summary: 'Get the embeddable form',
    description: 'Returns the form rendered as an embeddable HTML fragment.',
    operationIdBase: 'getFormEmbed',
    responses: { 200: htmlResponse('Embeddable form HTML') },
  },
  {
    method: 'get',
    pathTemplate: '/forms/{formSlug}',
    summary: 'Get the form page',
    description: 'Returns the full form rendered as an HTML page.',
    operationIdBase: 'getForm',
    responses: { 200: htmlResponse('Form HTML page') },
  },
  {
    method: 'post',
    pathTemplate: '/api/forms/{formSlug}/submissions',
    summary: 'Submit a form',
    description:
      'Submits the form. Accepts JSON, URL-encoded, or multipart bodies; JSON clients receive a JSON response, native form posts receive a redirect.',
    operationIdBase: 'createFormSubmission',

    request: { body: effectJsonBody(createSubmissionRequestSchema) },
    responses: {
      201: effectJsonResponse(submissionResponseSchema, 'Submission created'),
      303: { description: 'Redirect after a native form submission' },
      400: errorResponse('Validation failed or upload failed'),
      404: errorResponse('Form not found'),
      422: errorResponse('Submission invalid or parent record missing'),
    },
  },
  {
    method: 'post',
    pathTemplate: '/api/forms/{formSlug}/steps/{stepId}/advance',
    summary: 'Advance a multi-step form',
    description: 'Validates the current step and advances to the next step of a multi-step form.',
    operationIdBase: 'advanceFormStep',

    parameters: effectParameters(
      Schema.Struct({
        stepId: Schema.String.annotate({ description: 'Form step identifier' }),
      }),
      'path'
    ),
    request: {
      body: { content: { 'application/json': { schema: effectSchema(Schema.Unknown) } } },
    },
    responses: {
      200: effectJsonResponse(
        Schema.Struct({
          nextStepId: Schema.NullOr(
            Schema.String.annotate({ description: 'Next step id, or null when complete' })
          ),
        }),
        'Step advanced'
      ),
      400: errorResponse('Step validation failed'),
      404: errorResponse('Form or step not found'),
    },
  },
  {
    method: 'get',
    pathTemplate: '/api/forms/{formSlug}/steps/{stepId}',
    summary: 'Get a form step fragment',
    description: 'Returns a single step of a multi-step form as an HTML fragment.',
    operationIdBase: 'getFormStepFragment',

    parameters: effectParameters(
      Schema.Struct({
        stepId: Schema.String.annotate({ description: 'Form step identifier' }),
      }),
      'path'
    ),
    responses: { 200: htmlResponse('Form step HTML fragment') },
  },
]

/** Form route group — resource-scoped to the configured forms. */
export const formGroupSpec: ResourceGroupSpec = {
  tagPrefix: 'Form',
  genericTag: 'Forms',
  genericTagDescription: 'Form rendering and submission endpoints',
  collection: (app) => app.forms ?? [],
  resourcePlaceholder: '{formSlug}',
  genericPlaceholder: '{name}',
  genericParamName: 'name',
  routes,
}
