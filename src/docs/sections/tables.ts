/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { TableSchema } from '@/domain/models/app/tables'
import { CheckConstraintSchema } from '@/domain/models/app/tables/constraints'
import {
  BaseFieldSchema,
  RelationshipFieldSchema,
} from '@/domain/models/app/tables/fields/field-types'
import { ForeignKeySchema } from '@/domain/models/app/tables/foreign-keys'
import tableRelationshipsBody from '@/domain/models/app/tables/foreign-keys/foreign-keys.docs.md' with { type: 'file' }
import { TableIndexSchema } from '@/domain/models/app/tables/indexes'
import tableIndexesConstraintsBody from '@/domain/models/app/tables/indexes/indexes.docs.md' with { type: 'file' }
import {
  FieldPermissionSchema,
  RowLevelPredicateSchema,
  TablePermissionsSchema,
} from '@/domain/models/app/tables/permissions'
import { PrimaryKeySchema } from '@/domain/models/app/tables/primary-key'
import tablePermissionsBody from '@/domain/models/app/tables/table-permissions.docs.md' with { type: 'file' }
import tableValidationBody from '@/domain/models/app/tables/table-validation.docs.md' with { type: 'file' }
import tablesOverviewBody from '@/domain/models/app/tables/tables-overview.docs.md' with { type: 'file' }
import {
  ViewFilterConditionSchema,
  ViewGroupBySchema,
  ViewPermissionsSchema,
  ViewSchema,
  ViewSortSchema,
} from '@/domain/models/app/tables/views'
import tableViewsBody from '@/domain/models/app/tables/views/views.docs.md' with { type: 'file' }
import {
  WebhookAuthSchema,
  WebhookPayloadSchema,
  WebhookRetrySchema,
  WebhookSchema,
} from '@/domain/models/app/tables/webhooks'
import tableWebhooksBody from '@/domain/models/app/tables/webhooks/webhooks.docs.md' with { type: 'file' }
import { defineArticle, defineSection } from './define'

export const tables = defineSection({
  slug: 'tables',
  title: 'Tables',
  order: 2000,
  tab: 'tables',
  articles: [
    defineArticle({
      slug: 'tables-overview',
      title: 'Tables Overview',
      description:
        'Configure data tables — structure, table-level properties, and base field properties shared by all 49 field types.',
      keywords: [
        'sovrium',
        'tables',
        'data models',
        'schema',
        'fields',
        'primary key',
        'indexes',
        'constraints',
        'base field',
      ],
      order: 2000,
      sidebarLabel: 'Tables Overview',
      body: tablesOverviewBody,
      documents: [TableSchema, BaseFieldSchema],
      stories: [
        'US-TABLES-TABLE-ADVANCED',
        'US-TABLES-TABLE-API',
        'US-TABLES-TABLE-DEFINITION-001',
        'US-TABLES-TABLE-DEFINITION-004',
        'US-TABLES-TABLE-DEFINITION-006',
        'US-TABLES-TABLE-DEFINITION-007',
      ],
    }),
    defineArticle({
      slug: 'table-relationships',
      title: 'Relationships & Foreign Keys',
      description:
        'Link Sovrium tables with relationship fields — cardinalities, onDelete/onUpdate referential actions, reciprocal links, and displayField.',
      keywords: [
        'sovrium',
        'relationships',
        'cardinality',
        'one-to-many',
        'many-to-many',
        'onDelete',
        'onUpdate',
        'reciprocal',
        'displayField',
        'foreign key',
      ],
      order: 2010,
      sidebarLabel: 'Relationships',
      body: tableRelationshipsBody,
      documents: [RelationshipFieldSchema, ForeignKeySchema],
      stories: ['US-TABLES-RELATIONSHIPS-CONSTRAINTS', 'US-TABLES-RELATIONSHIPS-VIOLATIONS'],
    }),
    defineArticle({
      slug: 'table-indexes-constraints',
      title: 'Indexes & Constraints',
      description:
        'Primary keys, indexes (including partial indexes and uniqueness), unique constraints, CHECK constraints, and composite foreign keys for Sovrium tables.',
      keywords: [
        'sovrium',
        'indexes',
        'primary key',
        'unique constraint',
        'check constraint',
        'partial index',
        'foreign key',
        'composite key',
      ],
      order: 2020,
      sidebarLabel: 'Indexes & Constraints',
      body: tableIndexesConstraintsBody,
      documents: [PrimaryKeySchema, TableIndexSchema, CheckConstraintSchema],
      stories: ['US-TABLES-TABLE-INDEXES', 'US-TABLES-UNIQUE-CONSTRAINTS'],
    }),
    defineArticle({
      slug: 'table-views',
      title: 'Views',
      description:
        'Saved Sovrium table views — JSON config mode (filters, sorts, fields, group-by) and SQL mode (PostgreSQL views and materialized views).',
      keywords: [
        'sovrium',
        'views',
        'saved views',
        'filters',
        'sorts',
        'group by',
        'materialized view',
        'default view',
        'query',
      ],
      order: 2030,
      sidebarLabel: 'Views',
      body: tableViewsBody,
      documents: [
        ViewSchema,
        ViewFilterConditionSchema,
        ViewSortSchema,
        ViewGroupBySchema,
        ViewPermissionsSchema,
      ],
      stories: [
        'US-TABLES-VIEWS-001',
        'US-TABLES-VIEWS-006',
        'US-TABLES-VIEWS-API-ACCESS',
        'US-TABLES-VIEWS-FILTER-OPERATOR-VOCABULARY',
        'US-TABLES-VIEWS-FILTER-ROUND-TRIP',
        'US-TABLES-VIEWS-FILTERING',
        'US-TABLES-VIEWS-READ-ONLY-GUARD',
      ],
    }),
    defineArticle({
      slug: 'table-validation',
      title: 'Validation',
      description:
        'How Sovrium validates table data — field-level rules, CHECK constraints, uniqueness, relational integrity, and config-time schema checks.',
      keywords: [
        'sovrium',
        'validation',
        'required',
        'unique',
        'min',
        'max',
        'precision',
        'check constraint',
        'schema validation',
        'field validation',
      ],
      order: 2040,
      sidebarLabel: 'Validation',
      body: tableValidationBody,
      documents: [],
      stories: ['US-TABLES-TABLE-VALIDATION'],
    }),
    defineArticle({
      slug: 'table-permissions',
      title: 'Table Permissions',
      description:
        'RBAC and per-field permissions for Sovrium tables, with row-level scoping and the 404-not-403 anti-enumeration rule.',
      keywords: [
        'sovrium',
        'permissions',
        'RBAC',
        'field-level permissions',
        'row-level permissions',
        'roles',
        '404',
        'authorization',
        'access control',
      ],
      order: 2050,
      sidebarLabel: 'Permissions',
      body: tablePermissionsBody,
      documents: [TablePermissionsSchema, FieldPermissionSchema, RowLevelPredicateSchema],
      stories: [
        'US-TABLES-PERMISSIONS-001',
        'US-TABLES-PERMISSIONS-002',
        'US-TABLES-PERMISSIONS-003',
        'US-TABLES-PERMISSIONS-004',
        'US-TABLES-PERMISSIONS-005',
        'US-TABLES-PERMISSIONS-006',
        'US-TABLES-PERMISSIONS-FIELD-READ-STRIP-RESPONSE-SHAPES',
        'US-TABLES-PERMISSIONS-PUBLIC-ANONYMOUS-READ',
        'US-TABLES-PERMISSIONS-ROW-LEVEL-PERMISSIONS',
        'US-TABLES-PERMISSIONS-ROW-LEVEL-TOP-ROLE-BYPASS',
        'US-TABLES-PERMISSIONS-USER-ACCESS-JUNCTION',
        'US-TABLES-PERMISSIONS-VIEWER-ROLE-READ-STRIP',
      ],
    }),
    defineArticle({
      slug: 'table-webhooks',
      title: 'Table Webhooks',
      description:
        'Outgoing HTTP webhooks on Sovrium record events — events, authentication (HMAC, API key, bearer), retry policy, and payload selection.',
      keywords: [
        'sovrium',
        'webhooks',
        'outgoing webhooks',
        'record events',
        'HMAC',
        'api key',
        'bearer',
        'retry',
        'payload',
        'create update delete',
      ],
      order: 2060,
      sidebarLabel: 'Webhooks',
      body: tableWebhooksBody,
      documents: [WebhookSchema, WebhookAuthSchema, WebhookRetrySchema, WebhookPayloadSchema],
      stories: [
        'US-TABLES-TABLE-WEBHOOKS-001',
        'US-TABLES-TABLE-WEBHOOKS-002',
        'US-TABLES-TABLE-WEBHOOKS-003',
        'US-TABLES-TABLE-WEBHOOKS-004',
        'US-TABLES-TABLE-WEBHOOKS-005',
        'US-TABLES-TABLE-WEBHOOKS-006',
      ],
    }),
  ],
})
