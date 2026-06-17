/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql, type SQL, type Column } from 'drizzle-orm'
import { parseDatabaseDialectConfig } from '@/domain/models/env/database/database-dialect'


const currentDialect = (): 'postgres' | 'sqlite' => parseDatabaseDialectConfig().dialect

export const dateTruncTimeBucket = (
  column: SQL | Column,
  bucket: 'hour' | 'day' | 'week' | 'month'
): SQL => {
  if (currentDialect() === 'sqlite') {
    const format = sqliteBucketFormat(bucket)
    return sql`strftime(${format}, ${column} / 1000, 'unixepoch')`
  }
  return sql`DATE_TRUNC(${sql.raw(`'${bucket}'`)}, ${column})::text`
}

const sqliteBucketFormat = (bucket: 'hour' | 'day' | 'week' | 'month'): string => {
  if (bucket === 'hour') return '%Y-%m-%d %H:00:00'
  if (bucket === 'day') return '%Y-%m-%d'
  if (bucket === 'week') return '%Y-W%W'
  return '%Y-%m'
}

const ALLOWED_JSON_KEYS = [
  'path',
  'title',
  'referrerDomain',
  'utmSource',
  'utmMedium',
  'utmCampaign',
  'utmContent',
  'utmTerm',
  'deviceType',
  'browserName',
  'osName',
] as const

type AllowedJsonKey = (typeof ALLOWED_JSON_KEYS)[number]

export const jsonExtractPath = (jsonColumn: SQL | Column, key: AllowedJsonKey): SQL => {
  if (!ALLOWED_JSON_KEYS.includes(key)) {
    throw new Error(`jsonExtractPath: key "${key}" is not in the allowlist`)
  }
  if (currentDialect() === 'sqlite') {
    return sql`json_extract(${jsonColumn}, ${sql.raw(`'$.${key}'`)})`
  }
  return sql`${jsonColumn}->>${sql.raw(`'${key}'`)}`
}

export const dateIntervalAgo = (amount: number, unit: 'year' | 'month' | 'day' | 'hour'): SQL => {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error(`dateIntervalAgo: amount must be a non-negative integer (got ${amount})`)
  }
  if (currentDialect() === 'sqlite') {
    return sql.raw(`(CAST(strftime('%s','now','-${amount} ${unit}s') AS INTEGER) * 1000)`)
  }
  return sql.raw(`NOW() - INTERVAL '${amount} ${unit}'`)
}
