/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { Effect, Metric, MetricBoundaries, MetricLabel } from 'effect'

const DURATION_BOUNDARIES_SECONDS = [
  0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 7.5, 10,
] as const

const httpRequestCount = Metric.counter('http.server.request.count', {
  description: 'Number of HTTP server requests handled.',
  incremental: true,
}).pipe(Metric.tagged('unit', '{request}'))

const httpRequestDuration = Metric.histogram(
  'http.server.request.duration',
  MetricBoundaries.fromIterable(DURATION_BOUNDARIES_SECONDS),
  'Duration of HTTP server requests in seconds.'
).pipe(Metric.tagged('unit', 's'))

export const recordHttpRequest = (
  method: string,
  route: string,
  status: string,
  durationSeconds: number
): Effect.Effect<void> => {
  const labels = [
    MetricLabel.make('method', method),
    MetricLabel.make('route', route),
    MetricLabel.make('status', status),
  ]
  return Effect.zipRight(
    Metric.update(httpRequestCount.pipe(Metric.taggedWithLabels(labels)), 1),
    Metric.update(httpRequestDuration.pipe(Metric.taggedWithLabels(labels)), durationSeconds)
  )
}

const dbQueryDuration = Metric.histogram(
  'db.query.duration',
  MetricBoundaries.fromIterable(DURATION_BOUNDARIES_SECONDS),
  'Duration of database queries in seconds.'
).pipe(Metric.tagged('unit', 's'))

export const recordDbQuery = (
  operation: string,
  table: string,
  durationSeconds: number
): Effect.Effect<void> => {
  const labels = [MetricLabel.make('operation', operation), MetricLabel.make('table', table)]
  return Metric.update(dbQueryDuration.pipe(Metric.taggedWithLabels(labels)), durationSeconds)
}

const aiRequestCount = Metric.counter('ai.request.count', {
  description: 'Number of AI provider requests issued.',
  incremental: true,
}).pipe(Metric.tagged('unit', '{request}'))

const aiRequestDuration = Metric.histogram(
  'ai.request.duration',
  MetricBoundaries.fromIterable(DURATION_BOUNDARIES_SECONDS),
  'Duration of AI provider requests in seconds.'
).pipe(Metric.tagged('unit', 's'))

export const recordAiRequest = (
  provider: string,
  model: string,
  operation: string,
  durationSeconds: number
): Effect.Effect<void> => {
  const labels = [
    MetricLabel.make('provider', provider),
    MetricLabel.make('model', model),
    MetricLabel.make('operation', operation),
  ]
  return Effect.zipRight(
    Metric.update(aiRequestCount.pipe(Metric.taggedWithLabels(labels)), 1),
    Metric.update(aiRequestDuration.pipe(Metric.taggedWithLabels(labels)), durationSeconds)
  )
}

const automationRunCount = Metric.counter('automation.run.count', {
  description: 'Number of automation runs executed.',
  incremental: true,
}).pipe(Metric.tagged('unit', '{run}'))

const automationRunDuration = Metric.histogram(
  'automation.run.duration',
  MetricBoundaries.fromIterable(DURATION_BOUNDARIES_SECONDS),
  'Duration of automation runs in seconds.'
).pipe(Metric.tagged('unit', 's'))

export const recordAutomationRun = (
  automation: string,
  status: string,
  durationSeconds: number
): Effect.Effect<void> => {
  const durationLabels = [MetricLabel.make('automation', automation)]
  const countLabels = [
    MetricLabel.make('automation', automation),
    MetricLabel.make('status', status),
  ]
  return Effect.zipRight(
    Metric.update(automationRunCount.pipe(Metric.taggedWithLabels(countLabels)), 1),
    Metric.update(
      automationRunDuration.pipe(Metric.taggedWithLabels(durationLabels)),
      durationSeconds
    )
  )
}
