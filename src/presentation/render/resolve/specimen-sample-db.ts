/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The readers a design-system specimen frame renders with: every one of them
 * answers a SAMPLE synthesised from config, and none reaches the database, the
 * auth store or an endpoint.
 *
 * A specimen documents a template in the state its users meet, so the page
 * passes that would otherwise read a record, an invitation, a waiting sign-in
 * or a record's history are handed these instead — the same passes, the same
 * markup, on made-up facts (`specimen-sample-service.ts`). Swapping the
 * READERS rather than special-casing each pass is what keeps the frame drawing
 * what the operator's own pages draw, and what keeps [internal ref] A2's bound true by
 * construction: there is no reader here that could return a row of the
 * instance.
 */

import {
  isRecordHistoryEndpoint,
  SPECIMEN_PERSON,
  specimenHistory,
  specimenInvitation,
  specimenRecord,
  type SpecimenFieldShape,
} from '@/domain/models/app/pages/specimen-sample-service'
import type { DataSourceDb } from './data-source-contracts'
import type { SystemRowsFetcher } from './first-object-redirect-resolver'
import type { App } from '@/domain/models/app'
import type { SessionInfo } from '@/domain/models/app/auth/session-info'

/**
 * Who a specimen is drawn for: the sample person, as an administrator, so every
 * gate a template sits behind opens on the sample and the frame draws the
 * whole template. Never the caller — the frame shows nothing of who opened it.
 */
export const SPECIMEN_SESSION: SessionInfo = {
  userId: 'specimen',
  role: 'admin',
  name: SPECIMEN_PERSON.name,
  email: SPECIMEN_PERSON.email,
}

/** A table's field definitions, as the sample is chosen from them. */
const fieldsOf = (app: App, table: string): readonly SpecimenFieldShape[] =>
  (app.tables?.find((candidate) => candidate.name === table)?.fields ??
    []) as readonly SpecimenFieldShape[]

/** Readers that answer a sample for every read a page makes. */
export const specimenSampleDb = (app: App): DataSourceDb => ({
  fetchRecords: async (table) => [specimenRecord(fieldsOf(app, table))],
  countRecords: async () => 1,
  fetchSingleRecord: async (table) => ({ ...specimenRecord(fieldsOf(app, table)) }),
  fetchUserAssignments: async () => [],
  // The sample person is an admin: her list admits every sample row.
  readReaderRows: async () => ({ admission: { kind: 'every-row' }, grants: new Map() }),
  readInvitation: async () => specimenInvitation(),
  // A sign-in is waiting for its code: the code step, not the lapsed notice.
  readTwoFactorAttempt: async () => ({ live: true }),
})

/** A system endpoint's rows: a record's sample history, and nothing for any other. */
export const specimenSystemRows: SystemRowsFetcher = async (endpoint) =>
  isRecordHistoryEndpoint(endpoint) ? specimenHistory() : []
