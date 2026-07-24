/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import * as OtlpSerialization from '@effect/opentelemetry/OtlpSerialization'
import * as OtlpTracer from '@effect/opentelemetry/OtlpTracer'
import * as FetchHttpClient from '@effect/platform/FetchHttpClient'
import { Layer } from 'effect'
import { getTelemetryConfig } from './telemetry-config'
import type { TracesConfig } from '@/domain/models/env/telemetry/telemetry'

const buildTracingLayer = (traces: TracesConfig): Layer.Layer<never> =>
  OtlpTracer.layer({
    url: traces.endpoint,
    headers: traces.headers,
    resource: {
      serviceName: traces.serviceName || 'sovrium',
      attributes: { 'deployment.environment': traces.environment },
    },
  }).pipe(Layer.provide(OtlpSerialization.layerJson), Layer.provide(FetchHttpClient.layer))

const telemetryConfig = getTelemetryConfig()

export const TelemetryTracingLayerOptional: Layer.Layer<never> =
  telemetryConfig.traces === undefined ? Layer.empty : buildTracingLayer(telemetryConfig.traces)
