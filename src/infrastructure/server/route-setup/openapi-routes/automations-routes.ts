/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'
import { errorResponseSchema } from '@/domain/models/api/_shared/error'
import {
  cancelRunResponseSchema,
  listRunsQuerySchema,
  listRunsResponseSchema,
  replayRunRequestSchema,
  runDetailSchema,
  triggerResponseSchema,
} from '@/domain/models/api/automations'
import {
  type ResourceGroupSpec,
  type RouteSpec,
  type StaticGroupSpec,
  jsonResponse,
} from './_shared/route-spec'


const errorResponse = (description: string) => jsonResponse(errorResponseSchema, description)

const routes: readonly RouteSpec[] = [
  {
    method: 'post',
    pathTemplate: '/api/automations/{automationSlug}/webhook',
    summary: 'Trigger an automation via webhook',
    description:
      'Triggers the automation through its webhook. Accepts GET, POST, PUT, PATCH, and DELETE; the request shape is governed by the automation trigger configuration.',
    operationIdBase: 'triggerAutomationWebhook',
    request: { body: { content: { 'application/json': { schema: z.unknown() } } } },
    responses: {
      200: jsonResponse(triggerResponseSchema, 'Synchronous run result'),
      202: jsonResponse(z.object({ id: z.string() }), 'Accepted for asynchronous processing'),
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
    request: { body: { content: { 'application/json': { schema: z.unknown() } } } },
    responses: {
      200: jsonResponse(triggerResponseSchema, 'Run result'),
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
          'application/json': { schema: z.object({ inputData: z.unknown().optional() }) },
        },
      },
    },
    responses: {
      200: jsonResponse(triggerResponseSchema, 'Run result'),
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
      200: jsonResponse(z.array(runDetailSchema), 'Run list'),
      400: errorResponse('Invalid request'),
    },
  },
  {
    method: 'post',
    pathTemplate: '/api/automations/{automationSlug}/runs/{id}/replay',
    summary: 'Replay an automation run',
    description: 'Replays a previous run of the automation, optionally from a specific step.',
    operationIdBase: 'replayAutomationRun',
    request: {
      params: z.object({ id: z.string().describe('Run identifier') }),
      body: { content: { 'application/json': { schema: replayRunRequestSchema } } },
    },
    responses: {
      200: jsonResponse(triggerResponseSchema, 'Replay run result'),
      400: errorResponse('Invalid request'),
      404: errorResponse('Run not found'),
      500: errorResponse('Internal error'),
    },
  },
]

export const automationGroupSpec: ResourceGroupSpec = {
  tagPrefix: 'Automation',
  genericTag: 'automations',
  genericTagDescription: 'Automation trigger and run endpoints',
  collection: (app) => app.automations ?? [],
  resourcePlaceholder: '{automationSlug}',
  genericPlaceholder: '{name}',
  genericParamName: 'name',
  routes,
}

export const automationCollectionGroup: StaticGroupSpec = {
  tag: 'automations',
  tagDescription: 'Automation trigger and run endpoints',
  routes: [
    {
      method: 'get',
      pathTemplate: '/api/automations',
      summary: 'List automations',
      description: 'Returns all configured automations with their trigger summary.',
      operationIdBase: 'listAutomations',
      responses: {
        200: jsonResponse(
          z.array(z.object({ name: z.string(), enabled: z.boolean() })),
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
      request: { query: listRunsQuerySchema },
      responses: {
        200: jsonResponse(listRunsResponseSchema, 'Run list'),
      },
    },
    {
      method: 'get',
      pathTemplate: '/api/automations/runs/{id}',
      summary: 'Get an automation run',
      description: 'Returns the full detail of a single automation run.',
      operationIdBase: 'getAutomationRunDetail',
      request: { params: z.object({ id: z.string().describe('Run identifier') }) },
      responses: {
        200: jsonResponse(runDetailSchema, 'Run detail'),
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
      request: {
        params: z.object({ id: z.string().describe('Run identifier') }),
        body: { content: { 'application/json': { schema: replayRunRequestSchema } } },
      },
      responses: {
        200: jsonResponse(triggerResponseSchema, 'Replay accepted'),
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
      request: { params: z.object({ id: z.string().describe('Run identifier') }) },
      responses: {
        200: jsonResponse(cancelRunResponseSchema, 'Run cancelled'),
        400: errorResponse('Invalid request'),
        404: errorResponse('Run not found'),
      },
    },
  ],
}
