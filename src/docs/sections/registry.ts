/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { section as admin } from './admin'
import { agents, ai } from './agents'
import { section as appSchema } from './app-schema'
import { auth } from './auth'
import { authAccess } from './auth-access'
import { authAccounts } from './auth-accounts'
import { automationActions } from './automation-actions'
import { automationIntegrations } from './automation-integrations'
import { automationTriggers } from './automation-triggers'
import { automations } from './automations'
import { section as cliApi } from './cli-api'
import { section as components } from './components'
import { configuration } from './configuration'
import { section as dataComponents } from './data-components'
import { section as fields } from './fields'
import { section as formControls } from './form-controls'
import { formDelivery, formFields, formLogic, forms } from './forms'
import { section as getStarted } from './get-started'
import { section as guidesBuild } from './guides-build'
import { section as guidesDeploy } from './guides-deploy'
import { section as guidesIntegrations } from './guides-integrations'
import { section as guidesOps } from './guides-ops'
import { mcp } from './mcp'
import { section as operations } from './operations'
import { section as pages } from './pages'
import { section as pagesSeo } from './pages-seo'
import { platformApis } from './platform-apis'
import { records } from './records'
import { section as search } from './search'
import { buckets, fileAccess, files, images } from './storage'
import { tables } from './tables'
import { section as theming } from './theming'
import type { DocSection } from './define'

/**
 * Every registered documentation section, in reading order.
 *
 * A section appears here once its fragments exist. The remaining sections of
 * the corpus arrive with theirs; a manifest naming an article whose fragment
 * is not on disk would be a promise the `docs` verb cannot keep, so the list
 * grows rather than being declared empty in advance.
 */
export const SECTIONS: readonly DocSection[] = [
  cliApi,
  fields,
  components,
  dataComponents,
  formControls,
  getStarted,
  operations,
  guidesBuild,
  guidesDeploy,
  guidesIntegrations,
  guidesOps,
  pages,
  pagesSeo,
  theming,
  tables,
  forms,
  formFields,
  formLogic,
  formDelivery,
  automations,
  automationTriggers,
  automationActions,
  automationIntegrations,
  ai,
  agents,
  mcp,
  auth,
  authAccess,
  authAccounts,
  buckets,
  files,
  fileAccess,
  images,
  appSchema,
  admin,
  configuration,
  records,
  search,
  platformApis,
].toSorted((a, b) => a.order - b.order)
