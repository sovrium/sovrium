/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TEMPLATE_EXPRESSION_PATTERN, TemplateStringSchema } from '../template'
import { ActionBaseFields } from './base'



const AppSlugSchema = TemplateStringSchema.pipe(
  Schema.minLength(1),
  Schema.maxLength(63),
  Schema.annotations({
    description: 'Tenant app slug (lowercase kebab, e.g. "acme-crm"). Templatable.',
  })
)

const DbNameSchema = TemplateStringSchema.pipe(
  Schema.minLength(1),
  Schema.maxLength(63),
  Schema.annotations({
    description: 'Logical tenant database name (e.g. "tenant_acme"). Templatable.',
  })
)

const ConfigRefSchema = TemplateStringSchema.pipe(
  Schema.minLength(1),
  Schema.maxLength(512),
  Schema.annotations({
    description:
      'Reference to the validated tenant config to boot (id / row ref / URL). Templatable.',
  })
)

const RouteDomainSchema = TemplateStringSchema.pipe(
  Schema.minLength(1),
  Schema.maxLength(253),
  Schema.annotations({
    description: 'Route domain to attach (bare host, e.g. "acme.sovrium.app"). Templatable.',
  })
)

const RoutePortSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.between(1, 65_535),
  Schema.annotations({ description: 'Tenant app listening port the route targets (1-65535).' })
)

const ContainerSizeSchema = Schema.Union(
  Schema.Literal('S', 'M', 'L', 'XL'),
  Schema.String.pipe(Schema.pattern(TEMPLATE_EXPRESSION_PATTERN))
).pipe(
  Schema.annotations({
    description:
      'Container size tier of the tenant process (S | M | L | XL), or a {{…}} template resolving to one. Templatable.',
  })
)

const VersionSchema = TemplateStringSchema.pipe(
  Schema.minLength(1),
  Schema.maxLength(32),
  Schema.annotations({
    description: 'Pinned Sovrium version the tenant process runs on (e.g. "0.10.0"). Templatable.',
  })
)

const LogLinesSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.between(1, 10_000),
  Schema.annotations({
    description: 'Number of trailing tenant-process log lines to read (1-10000).',
  })
)


export const CloudProvisionDbActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('cloud'),
  operator: Schema.Literal('provision-db'),
  props: Schema.Struct({
    dbName: DbNameSchema,
  }),
}).pipe(
  Schema.annotations({
    identifier: 'CloudProvisionDbAction',
    title: 'Cloud Provision-DB Action',
    description: 'Provision a logical database for a Sovrium Cloud tenant',
  })
)

export const CloudSpawnAppActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('cloud'),
  operator: Schema.Literal('spawn-app'),
  props: Schema.Struct({
    appSlug: AppSlugSchema,
    configRef: ConfigRefSchema,
  }),
}).pipe(
  Schema.annotations({
    identifier: 'CloudSpawnAppAction',
    title: 'Cloud Spawn-App Action',
    description: 'Boot a Sovrium Cloud tenant app process from a validated config reference',
  })
)

export const CloudRouteAddActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('cloud'),
  operator: Schema.Literal('route-add'),
  props: Schema.Struct({
    domain: RouteDomainSchema,
    port: RoutePortSchema,
  }),
}).pipe(
  Schema.annotations({
    identifier: 'CloudRouteAddAction',
    title: 'Cloud Route-Add Action',
    description: 'Attach an ingress route (domain → port) to a Sovrium Cloud tenant app',
  })
)

export const CloudDisableAppActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('cloud'),
  operator: Schema.Literal('disable-app'),
  props: Schema.Struct({
    appSlug: AppSlugSchema,
  }),
}).pipe(
  Schema.annotations({
    identifier: 'CloudDisableAppAction',
    title: 'Cloud Disable-App Action',
    description: 'Stop a Sovrium Cloud tenant app while preserving its data',
  })
)

export const CloudDestroyAppActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('cloud'),
  operator: Schema.Literal('destroy-app'),
  props: Schema.Struct({
    appSlug: AppSlugSchema,
  }),
}).pipe(
  Schema.annotations({
    identifier: 'CloudDestroyAppAction',
    title: 'Cloud Destroy-App Action',
    description: 'Tear down a Sovrium Cloud tenant app and drop its data',
  })
)

export const CloudScaleAppActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('cloud'),
  operator: Schema.Literal('scale-app'),
  props: Schema.Struct({
    appSlug: AppSlugSchema,
    containerSize: ContainerSizeSchema,
  }),
}).pipe(
  Schema.annotations({
    identifier: 'CloudScaleAppAction',
    title: 'Cloud Scale-App Action',
    description: 'Change the container size / performance tier of a Sovrium Cloud tenant app',
  })
)

export const CloudSetVersionActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('cloud'),
  operator: Schema.Literal('set-version'),
  props: Schema.Struct({
    appSlug: AppSlugSchema,
    version: VersionSchema,
  }),
}).pipe(
  Schema.annotations({
    identifier: 'CloudSetVersionAction',
    title: 'Cloud Set-Version Action',
    description: 'Re-pin a Sovrium Cloud tenant app to a new Sovrium version (re-spawn at it)',
  })
)

export const CloudTailLogsActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('cloud'),
  operator: Schema.Literal('tail-logs'),
  props: Schema.Struct({
    appSlug: AppSlugSchema,
    lines: Schema.optional(LogLinesSchema),
  }),
}).pipe(
  Schema.annotations({
    identifier: 'CloudTailLogsAction',
    title: 'Cloud Tail-Logs Action',
    description: 'Read the recent process logs of a Sovrium Cloud tenant app into app_logs',
  })
)


export const CloudActionSchema = Schema.Union(
  CloudProvisionDbActionSchema,
  CloudSpawnAppActionSchema,
  CloudRouteAddActionSchema,
  CloudDisableAppActionSchema,
  CloudDestroyAppActionSchema,
  CloudScaleAppActionSchema,
  CloudSetVersionActionSchema,
  CloudTailLogsActionSchema
).pipe(
  Schema.annotations({
    identifier: 'CloudAction',
    title: 'Cloud Action',
    description:
      'Sovrium Cloud tenant-app orchestration: provision-db, spawn-app, route-add, disable-app, destroy-app, scale-app, set-version, tail-logs. Gated by SOVRIUM_CLOUD_MODE at validation.',
  })
)

export type CloudAction = Schema.Schema.Type<typeof CloudActionSchema>
