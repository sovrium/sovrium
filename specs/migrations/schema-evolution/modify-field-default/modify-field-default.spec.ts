/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { test, expect } from '@/specs/fixtures'

test.describe('Modify Field Default Migration', () => {
  test.fixme('MIG-MODIFY-DEFAULT-001: Add DEFAULT value', async () => {
    // GIVEN: table 'tasks' with priority field (TEXT), no default value
    // WHEN: default value 'medium' added to schema
    // THEN: ALTER TABLE ALTER COLUMN SET DEFAULT 'medium'
    expect(true).toBe(false)
  })

  test.fixme('MIG-MODIFY-DEFAULT-002: Change DEFAULT value', async () => {
    // GIVEN: table 'products' with status field, existing default 'draft'
    // WHEN: default value changed from 'draft' to 'pending'
    // THEN: ALTER TABLE ALTER COLUMN SET DEFAULT 'pending' (replaces old default)
    expect(true).toBe(false)
  })

  test.fixme('MIG-MODIFY-DEFAULT-003: Remove DEFAULT value', async () => {
    // GIVEN: table 'orders' with created_at field, existing default NOW()
    // WHEN: default value removed from schema
    // THEN: ALTER TABLE ALTER COLUMN DROP DEFAULT
    expect(true).toBe(false)
  })
})
