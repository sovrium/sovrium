/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { generateSqlCondition } from '../table-queries/filter-operators'
import type { ViewFilterCondition, ViewFilterNode } from '@/domain/models/app/tables/views/filters'

export const flattenFilterNode = (node: ViewFilterNode): readonly ViewFilterCondition[] => {
  if ('and' in node) {
    return node.and.flatMap(flattenFilterNode)
  }
  if ('or' in node) {
    return node.or.flatMap(flattenFilterNode)
  }
  return [node]
}

export const buildWhereClause = (filter: ViewFilterCondition, aliasPrefix: string): string => {
  const { field, operator, value } = filter
  const column = `${aliasPrefix}.${field}`
  return generateSqlCondition(column, operator, value, { useEscapeSqlString: true })
}

export const mapAggregationToPostgres = (aggregation: string, relatedField: string): string => {
  const upperAgg = aggregation.toUpperCase()

  switch (upperAgg) {
    case 'SUM':
      return `SUM(${relatedField})`
    case 'COUNT':
      return `COUNT(${relatedField})`
    case 'AVG':
      return `AVG(${relatedField})`
    case 'MIN':
      return `MIN(${relatedField})`
    case 'MAX':
      return `MAX(${relatedField})`
    case 'COUNTA':
      return `COUNT(CASE WHEN ${relatedField} IS NOT NULL AND ${relatedField} != '' THEN 1 END)`
    case 'COUNTALL':
      return `COUNT(*)`
    case 'ARRAYUNIQUE':
      return `ARRAY_AGG(DISTINCT ${relatedField} ORDER BY ${relatedField})`
    default:
      return `SUM(${relatedField})`
  }
}

export const getDefaultValueForAggregation = (aggregation: string): string => {
  const upperAgg = aggregation.toUpperCase()

  switch (upperAgg) {
    case 'AVG':
    case 'MIN':
    case 'MAX':
      return 'NULL'
    case 'ARRAYUNIQUE':
      return 'ARRAY[]::TEXT[]'
    default:
      return '0'
  }
}
