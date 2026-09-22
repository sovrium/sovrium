/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import {
  cancelRunResponseSchema,
  listRunsQuerySchema,
  listRunsResponseSchema,
  replayRunRequestSchema,
  runDetailSchema,
  triggerResponseSchema,
} from '@/domain/models/api/automations'
import { errorResponseSchema } from '@/domain/models/api/combinators/error'
import {
  effectJsonBody,
  effectJsonResponse,
  effectParameters,
  effectSchema,
} from '@/presentation/api/openapi/route-fragments'
import { type ResourceGroupSpec, type RouteSpec, type StaticGroupSpec } from '../openapi/route-spec'

/**
 * Automation routes — split into a per-automation group (triggers + named run
 * history, resource-scoped to `app.automations`, tagged `Automation: <name>`)
 * and a static run-management group keyed by run id.
 */

const errorResponse = (description: string) => effectJsonResponse(errorResponseSchema, description)

const routes: readonly RouteSpec[] = [
  {
    method: 'post',
    pathTemplate: '/api/automations/{automationSlug}/webhook',
    summary: 'Trigger an automation via webhook',
    description:
      'Triggers the automation through its webhook. Accepts GET, POST, PUT, PATCH, and DELETE; the request shape is governed by the automation trigger configuration.',
    operationIdBase: 'triggerAutomationWebhook',
    request: {
      body: { content: { 'application/json': { schema: effectSchema(Schema.Unknown) } } },
    },
    responses: {
      200: effectJsonResponse(triggerResponseSchema, 'Synchronous run result'),
      202: effectJsonResponse(
        Schema.Struct({
          id: Schema.String,
        }),
        'Accepted for asynchronous processing'
      ),
      400: errorResponse('Invalid request or validation failed'),
      401: errorResponse('Unauthorized'),
      404: errorResponse('Automation not found'),
      405: errorResponse('Method not allowed'),
      429: errorResponse('Rate limited'),
      500: errorResponse('Internal error'),
    },
  },
  {
    method: 'post',
    pathTemplate: '/api/automations/{automationSlug}/trigger',
    summary: 'Trigger an automation manually',
    description: 'Manually triggers the automation with an optional free-form input payload.',
    operationIdBase: 'triggerAutomationManually',
    request: {
      body: { content: { 'application/json': { schema: effectSchema(Schema.Unknown) } } },
    },
    responses: {
      200: effectJsonResponse(triggerResponseSchema, 'Run result'),
      400: errorResponse('Invalid request'),
      403: errorResponse('Forbidden'),
      404: errorResponse('Automation not found'),
      500: errorResponse('Internal error'),
    },
  },
  {
    method: 'post',
    pathTemplate: '/api/automations/{automationSlug}/form-action',
    summary: 'Trigger an automation form action',
    description: 'Triggers the automation as a form action with optional input data.',
    operationIdBase: 'triggerAutomationFormAction',
    request: {
      body: {
        content: {
          'application/json': {
            schema: effectSchema(
              Schema.Struct({
                inputData: Schema.optionalKey(Schema.Unknown),
              })
            ),
          },
        },
      },
    },
    responses: {
      200: effectJsonResponse(triggerResponseSchema, 'Run result'),
      400: errorResponse('Invalid request'),
      404: errorResponse('Automation not found'),
      500: errorResponse('Internal error'),
    },
  },
  {
    method: 'get',
    pathTemplate: '/api/automations/{automationSlug}/runs',
    summary: 'List runs for an automation',
    description: 'Returns the run history for the automation.',
    operationIdBase: 'listAutomationRunsByName',
    responses: {
      200: effectJsonResponse(Schema.Array(runDetailSchema), 'Run list'),
      400: errorResponse('Invalid request'),
    },
  },
  {
    method: 'post',
    pathTemplate: '/api/automations/{automationSlug}/runs/{id}/replay',
    summary: 'Replay an automation run',
    description: 'Replays a previous run of the automation, optionally from a specific step.',
    operationIdBase: 'replayAutomationRun',

    parameters: effectParameters(
      Schema.Struct({
        id: Schema.String.annotate({ description: 'Run identifier' }),
      }),
      'path'
    ),
    request: { body: effectJsonBody(replayRunRequestSchema) },
    responses: {
      200: effectJsonResponse(triggerResponseSchema, 'Replay run result'),
      400: errorResponse('Invalid request'),
      404: errorResponse('Run not found'),
      500: errorResponse('Internal error'),
    },
  },
]

/** Per-automation route group — resource-scoped to the configured automations. */
export const automationGroupSpec: ResourceGroupSpec = {
  tagPrefix: 'Automation',
  genericTag: 'Automations',
  genericTagDescription: 'Automation trigger and run endpoints',
  collection: (app) => app.automations ?? [],
  resourcePlaceholder: '{automationSlug}',
  genericPlaceholder: '{name}',
  genericParamName: 'name',
  routes,
}

/** Automation collection and run-management routes — not scoped to one automation. */
export const automationCollectionGroup: StaticGroupSpec = {
  tag: 'Automations',
  tagDescription: 'Automation trigger and run endpoints',
  routes: [
    {
      method: 'get',
      pathTemplate: '/api/automations',
      summary: 'List automations',
      description: 'Returns all configured automations with their trigger summary.',
      operationIdBase: 'listAutomations',
      responses: {
        200: effectJsonResponse(
          Schema.Array(
            Schema.Struct({
              name: Schema.String,
              enabled: Schema.Boolean,
            })
          ),
          'Automation list'
        ),
      },
    },
    {
      method: 'get',
      pathTemplate: '/api/automations/runs',
      summary: 'List automation runs',
      description: 'Returns paginated automation runs across all automations.',
      operationIdBase: 'listAutomationRuns',

      parameters: effectParameters(listRunsQuerySchema, 'query'),
      responses: {
        200: effectJsonResponse(listRunsResponseSchema, 'Run list'),
      },
    },
    {
      method: 'get',
      pathTemplate: '/api/automations/runs/{id}',
      summary: 'Get an automation run',
      description: 'Returns the full detail of a single automation run.',
      operationIdBase: 'getAutomationRunDetail',

      parameters: effectParameters(
        Schema.Struct({
          id: Schema.String.annotate({ description: 'Run identifier' }),
        }),
        'path'
      ),
      responses: {
        200: effectJsonResponse(runDetailSchema, 'Run detail'),
        400: errorResponse('Invalid request'),
        404: errorResponse('Run not found'),
      },
    },
    {
      method: 'post',
      pathTemplate: '/api/automations/runs/{id}/replay',
      summary: 'Replay an automation run by id',
      description: 'Replays an automation run identified by its run id.',
      operationIdBase: 'replayAutomationRunById',

      parameters: effectParameters(
        Schema.Struct({
          id: Schema.String.annotate({ description: 'Run identifier' }),
        }),
        'path'
      ),
      request: { body: effectJsonBody(replayRunRequestSchema) },
      responses: {
        200: effectJsonResponse(triggerResponseSchema, 'Replay accepted'),
        400: errorResponse('Invalid request'),
        404: errorResponse('Run not found'),
        500: errorResponse('Internal error'),
      },
    },
    {
      method: 'post',
      pathTemplate: '/api/automations/runs/{id}/cancel',
      summary: 'Cancel an automation run',
      description: 'Cancels an in-progress automation run.',
      operationIdBase: 'cancelAutomationRun',

      parameters: effectParameters(
        Schema.Struct({
          id: Schema.String.annotate({ description: 'Run identifier' }),
        }),
        'path'
      ),
      responses: {
        200: effectJsonResponse(cancelRunResponseSchema, 'Run cancelled'),
        400: errorResponse('Invalid request'),
        404: errorResponse('Run not found'),
      },
    },
  ],
}
