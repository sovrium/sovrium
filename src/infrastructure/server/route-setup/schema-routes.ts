/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { type Context, type Hono } from 'hono'
import {
  handleDiscardDraft,
  handleGetVersion,
  handleListVersions,
  handlePublishDraft,
  handlePutDraft,
  handleRebaseDraft,
  handleRestoreVersion,
  handleValidateDraft,
} from './schema-routes-draft'
import {
  TABLES,
  FORMS,
  AUTOMATIONS,
  CONNECTIONS,
  handleGetDraft,
  handleFamilyCreate,
  handleFamilyPatch,
  handleFamilyDelete,
  handlePageCreate,
  handleAuthStrategyCreate,
  handleAuthStrategyDelete,
  handleSchemaApiDisabled,
  handleSchemaStatus,
  handleSchemaDiff,
  handleSchemaExport,
  PAGES,
} from './schema-routes-handlers'
import { handlePreviewStart, handlePreviewStatus, handlePreviewStop } from './schema-routes-preview'
import { handlePruneVersions } from './schema-routes-prune'
import type { App } from '@/domain/models/app'

const isSchemaEditApiEnabled = (): boolean => process.env['SCHEMA_EDIT_API_ENABLED'] === 'true'

const gated =
  (handler: (c: Readonly<Context>) => Promise<Response>) =>
  (c: Readonly<Context>): Promise<Response> => {
    if (!isSchemaEditApiEnabled()) {
      return Promise.resolve(handleSchemaApiDisabled(c))
    }
    return handler(c)
  }


export const setupSchemaRoutes = <T extends Hono>(honoApp: T, app: Readonly<App>): T =>
  honoApp
    .get('/api/admin/schema/status', gated(handleSchemaStatus))
    .get(
      '/api/admin/schema/diff',
      gated((c) => handleSchemaDiff(c, app))
    )
    .get(
      '/api/admin/schema/export',
      gated((c) => handleSchemaExport(c, app))
    )
    .get(
      '/api/admin/schema/draft',
      gated((c) => handleGetDraft(c, app))
    )
    .put(
      '/api/admin/schema/draft',
      gated((c) => handlePutDraft(c, app))
    )
    .post(
      '/api/admin/schema/draft/discard',
      gated((c) => handleDiscardDraft(c, app))
    )
    .post(
      '/api/admin/schema/draft/validate',
      gated((c) => handleValidateDraft(c, app))
    )
    .post(
      '/api/admin/schema/draft/publish',
      gated((c) => handlePublishDraft(c, app))
    )
    .post(
      '/api/admin/schema/draft/rebase',
      gated((c) => handleRebaseDraft(c, app))
    )
    .get(
      '/api/admin/schema/draft/preview',
      gated((c) => handlePreviewStatus(c, app))
    )
    .post(
      '/api/admin/schema/draft/preview/start',
      gated((c) => handlePreviewStart(c, app))
    )
    .post(
      '/api/admin/schema/draft/preview/stop',
      gated((c) => handlePreviewStop(c, app))
    )
    .get(
      '/api/admin/schema/versions',
      gated((c) => handleListVersions(c, app))
    )
    .get(
      '/api/admin/schema/versions/:version',
      gated((c) => handleGetVersion(c, app, c.req.param('version')))
    )
    .post(
      '/api/admin/schema/versions/:version/restore',
      gated((c) => handleRestoreVersion(c, app, c.req.param('version')))
    )
    .post(
      '/api/admin/schema/prune',
      gated((c) => handlePruneVersions(c, app))
    )
    .post(
      '/api/admin/schema/draft/tables',
      gated((c) => handleFamilyCreate(c, app, TABLES, 'table'))
    )
    .patch(
      '/api/admin/schema/draft/tables/:slug',
      gated((c) => handleFamilyPatch(c, app, TABLES, c.req.param('slug')))
    )
    .delete(
      '/api/admin/schema/draft/tables/:slug',
      gated((c) => handleFamilyDelete(c, app, TABLES, c.req.param('slug')))
    )
    .post(
      '/api/admin/schema/draft/pages',
      gated((c) => handlePageCreate(c, app))
    )
    .patch(
      '/api/admin/schema/draft/pages/:id',
      gated((c) => handleFamilyPatch(c, app, PAGES, c.req.param('id')))
    )
    .delete(
      '/api/admin/schema/draft/pages/:id',
      gated((c) => handleFamilyDelete(c, app, PAGES, c.req.param('id')))
    )
    .post(
      '/api/admin/schema/draft/auth/strategies',
      gated((c) => handleAuthStrategyCreate(c, app))
    )
    .delete(
      '/api/admin/schema/draft/auth/strategies/:type',
      gated((c) => handleAuthStrategyDelete(c, app, c.req.param('type')))
    )
    .post(
      '/api/admin/schema/draft/forms',
      gated((c) => handleFamilyCreate(c, app, FORMS, 'payload'))
    )
    .patch(
      '/api/admin/schema/draft/forms/:name',
      gated((c) => handleFamilyPatch(c, app, FORMS, c.req.param('name')))
    )
    .delete(
      '/api/admin/schema/draft/forms/:name',
      gated((c) => handleFamilyDelete(c, app, FORMS, c.req.param('name')))
    )
    .post(
      '/api/admin/schema/draft/automations',
      gated((c) => handleFamilyCreate(c, app, AUTOMATIONS, 'payload'))
    )
    .patch(
      '/api/admin/schema/draft/automations/:name',
      gated((c) => handleFamilyPatch(c, app, AUTOMATIONS, c.req.param('name')))
    )
    .delete(
      '/api/admin/schema/draft/automations/:name',
      gated((c) => handleFamilyDelete(c, app, AUTOMATIONS, c.req.param('name')))
    )
    .post(
      '/api/admin/schema/draft/connections',
      gated((c) => handleFamilyCreate(c, app, CONNECTIONS, 'payload'))
    )
    .patch(
      '/api/admin/schema/draft/connections/:name',
      gated((c) => handleFamilyPatch(c, app, CONNECTIONS, c.req.param('name')))
    )
    .delete(
      '/api/admin/schema/draft/connections/:name',
      gated((c) => handleFamilyDelete(c, app, CONNECTIONS, c.req.param('name')))
    ) as T

