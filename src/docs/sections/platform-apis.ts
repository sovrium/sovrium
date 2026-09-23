/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import apiEndpointsBody from '@/presentation/api/openapi/api-endpoints.docs.md' with { type: 'file' }
import apiReferenceBody from '@/presentation/api/openapi/api-reference.docs.md' with { type: 'file' }
import openapiBody from '@/presentation/api/openapi/openapi.docs.md' with { type: 'file' }
import { defineArticle, defineSection } from './define'

export const platformApis = defineSection({
  slug: 'platform-apis',
  title: 'Platform APIs',
  order: 9200,
  tab: 'platform',
  articles: [
    defineArticle({
      slug: 'api-reference',
      title: 'REST API Overview',
      description:
        'The contract every endpoint obeys — the two credentials that authenticate, the one error envelope every failure uses, and the codes that say what to do about it.',
      keywords: [
        'sovrium',
        'REST API',
        'error envelope',
        'error codes',
        'x-api-key',
        'anti-enumeration',
        'VALIDATION_ERROR',
      ],
      order: 9200,
      sidebarLabel: 'REST API Overview',
      body: apiReferenceBody,
      documents: [],
      stories: ['US-API-ERROR-RESPONSE-CONTRACT'],
    }),
    defineArticle({
      slug: 'api-endpoints',
      title: 'Endpoint Reference',
      description:
        'Every path the REST API serves, grouped by what it operates on — health, tables, records, views, activity, analytics and authentication.',
      keywords: [
        'sovrium',
        'endpoints',
        'API paths',
        'health check',
        'records routes',
        'views routes',
        'analytics routes',
      ],
      order: 9204,
      sidebarLabel: 'Endpoint Reference',
      body: apiEndpointsBody,
      documents: [],
      stories: ['US-API-HEALTH-CHECK'],
    }),
    defineArticle({
      slug: 'openapi',
      title: 'OpenAPI',
      description:
        'The machine-readable description of the HTTP API — two documents and one explorer, all three admin-only, all three generated from the schemas that validate live traffic.',
      keywords: [
        'sovrium',
        'OpenAPI',
        'openapi.json',
        'Scalar',
        'admin-only',
        'API client generation',
      ],
      order: 9210,
      sidebarLabel: 'OpenAPI',
      body: openapiBody,
      documents: [],
      stories: ['US-API-OPENAPI-DOCUMENTATION'],
    }),
  ],
})
