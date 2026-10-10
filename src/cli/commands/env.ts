/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium env push <file> [config]` · `sovrium env list [config]` ·
 * `sovrium env unset <NAME>… [config]`
 *
 * Set, list and remove the variables of an app hosted on a Sovrium Cloud. The
 * app is the one `sovrium deploy` would deploy to (`--app`, else the project's
 * link, else the config `name`), and the key the one it signs with. Names
 * only: no command prints a value, and none reads a file it was not given.
 *
 * - **push** reads the named file, sends the variables the config declares
 *   (see `env-push.ts`), asks first (`--yes` in a script), and with
 *   `--redeploy` queues a new deployment of the app's live bundle.
 * - **list** prints each variable set on the app with its kind, the platform's
 *   names the config declares, then the required ones the app lacks (`--json`).
 * - **unset** removes variables after asking, warning on one still required.
 */

import { resolve } from 'node:path'
import { Effect, Option, Schema } from 'effect'
import {
  declaredEnvOf,
  requiredEnvNamesOf,
} from '@/application/use-cases/env/validate-required-env-vars'
import { confirmOrFail, isInteractive } from '@/cli/runtime/confirm-prompt'
import { getFlagValues } from '@/cli/runtime/flag-vocabulary'
import {
  ENV_VAR_NAME_PATTERN,
  PLATFORM_ENV_NAME_PATTERN,
  redeployResponseSchema,
} from '@/domain/models/api/automations/cloud/app-env'
import { inflect } from '@/infrastructure/logging/cli-output'
import { discoverConfigFile } from './app-prelude'
import { explicitAddress, lookUpAddress, resolveAddress } from './cloud-app-lookup'
import {
  CliRefusal,
  assertNetworkAllowed,
  callCloud,
  describeUnreachable,
  runCliProgram,
  say,
} from './cloud-session'
import { signedInCloud } from './cloud-sign-in'
import { callAppEnv, preparePush, readEnvFile, sayPreview, sendPlan } from './env-push'
import { loadConfigForValidationWithSources, validateParsedConfig } from './validate'
import type { AddressLookup } from './cloud-app-lookup'
import type { SignedInCloud } from './cloud-sign-in'

/** Everything `sovrium env` reads from the command line. */
export interface EnvCommandOptions {
  /** The positional arguments after `env`: the verb, then its own. */
  readonly args: readonly string[]
  readonly argv: readonly string[]
}

/** The project's config, validated as `sovrium deploy` validates it before bundling. */
interface Project {
  readonly configPath: string
  /** The config `name`, as the decode reads it. */
  readonly name: string
  /** The document as written, which the `env` readers take once it is valid. */
  readonly document: Readonly<Record<string, unknown>>
}

/** The caller's app, the cloud it is on, and what the config declares about its variables. */
interface HostedApp {
  readonly cloud: SignedInCloud
  readonly slug: string
  readonly found: Extract<AddressLookup, { kind: 'yours' }>
  readonly declared: readonly string[]
  readonly required: readonly string[]
}

/**
 * Read and validate the config with the verdict `sovrium validate` and
 * `sovrium deploy` give, so `env` never acts on an address or a list of
 * variables taken from a config the deploy would refuse.
 */
const readProject = (configFile: string | undefined): Effect.Effect<Project, CliRefusal> =>
  Effect.gen(function* () {
    const { configPath, parsed, outcome } = yield* Effect.tryPromise({
      try: async () => {
        const path = resolve(configFile ?? (await discoverConfigFile()))
        // Prints its own refusal and exits 1 on a missing or unparsable file.
        const loaded = await loadConfigForValidationWithSources(path)
        return {
          configPath: path,
          parsed: loaded.parsed,
          outcome: await validateParsedConfig(loaded.parsed, loaded.refSources, path),
        }
      },
      catch: (cause) =>
        new CliRefusal({
          headline: 'Sovrium could not read the config — nothing was sent.',
          detail: [cause instanceof Error ? cause.message : String(cause)],
          guidance: "Run 'sovrium validate' to see what is wrong with it.",
        }),
    })
    if (!outcome.valid) {
      return yield* new CliRefusal({
        headline: 'The config does not validate — nothing was sent.',
        detail: [...outcome.report],
        guidance: "Fix the problems above, then run 'sovrium env' again.",
      })
    }
    return {
      configPath,
      name: outcome.name,
      document: parsed as Readonly<Record<string, unknown>>,
    }
  })

/** Sign in, find the app the project means, and require it to be one of the caller's. */
const hostedApp = (argv: readonly string[], project: Project, announce: boolean) =>
  Effect.gen(function* () {
    const explicit = yield* explicitAddress(argv)
    yield* assertNetworkAllowed('env')
    const cloud = yield* signedInCloud(argv)
    const { slug } = yield* resolveAddress({
      explicit,
      configPath: project.configPath,
      appName: project.name,
      origin: cloud.origin,
      announce,
    })
    const found = yield* lookUpAddress(cloud, slug)
    const host = cloud.origin.origin
    if (found.kind !== 'yours') {
      return yield* new CliRefusal({
        headline:
          found.kind === 'free'
            ? `No app ${slug} on your account at ${host} — nothing was sent.`
            : `${host} does not offer the app lookup 'sovrium env' needs — nothing was sent.`,
        guidance:
          found.kind === 'free'
            ? "Run 'sovrium deploy' to create it, or name one of your apps with --app."
            : "Set the app's variables on its page in the cloud.",
      })
    }
    const app: HostedApp = {
      cloud,
      slug,
      found,
      declared: declaredEnvOf(project.document).map((entry) => entry.key),
      required: requiredEnvNamesOf(project.document),
    }
    return app
  })

/** The app's id, which its variables webhook is keyed by. */
const appIdOf = (app: HostedApp): Effect.Effect<string, CliRefusal> =>
  app.found.app.id === undefined
    ? Effect.fail(
        new CliRefusal({
          headline: `${app.cloud.origin.origin} did not say which app ${app.slug} is — nothing was sent.`,
          guidance: "Set the app's variables on its page in the cloud.",
        })
      )
    : Effect.succeed(app.found.app.id)

/** Ask before changing the app's variables; `--yes` goes on, a script without it is refused. */
const confirm = (argv: readonly string[], question: string): Effect.Effect<void, CliRefusal> =>
  confirmOrFail({
    yes: argv.includes('--yes'),
    question,
    refusal: new CliRefusal({
      headline: 'Changing the app’s variables was not confirmed — nothing was sent.',
      guidance: 'Run it again with --yes to go on without a question.',
    }),
  })

/** `--redeploy`: a new deployment of the live bundle, through the cloud's rollback path. */
const redeploy = (app: HostedApp) =>
  Effect.gen(function* () {
    const live = app.found.app.liveDeployment
    if (live === undefined) {
      return yield* say(
        `${app.slug} has no live deployment to redeploy; the values reach it on its next deployment.`
      )
    }
    const answer = yield* callCloud(
      new URL('/api/automations/deployment-rollback/webhook', app.cloud.origin),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': app.cloud.apiKey },
        body: JSON.stringify({ deploymentId: live }),
      }
    ).pipe(Effect.mapError(describeUnreachable('the variables are set, nothing was redeployed')))
    const queued = Schema.decodeUnknownOption(redeployResponseSchema)(answer.body)
    if ((answer.status === 200 || answer.status === 201) && Option.isSome(queued)) {
      return yield* say(
        `Deployment ${queued.value.deploymentId}: ${queued.value.status}, reusing the bundle of deployment ${live}.`
      )
    }
    return yield* new CliRefusal({
      headline: `${app.cloud.origin.origin} did not redeploy ${app.slug} (HTTP ${answer.status}); the variables are set.`,
      guidance: "Run 'sovrium deploy' to deploy the app again.",
    })
  })

const push = (options: EnvCommandOptions) =>
  Effect.gen(function* () {
    const [, file, configFile] = options.args
    if (file === undefined) {
      return yield* new CliRefusal({
        headline:
          'sovrium env push needs the file to read the variables from — nothing was read or sent.',
        guidance:
          "Name it, for example 'sovrium env push ./production.env'. No file is read unless you name it.",
      })
    }
    const entries = yield* readEnvFile(resolve(file))
    const project = yield* readProject(configFile)
    const app = yield* hostedApp(options.argv, project, true)
    const appId = yield* appIdOf(app)
    const overwrite = options.argv.includes('--overwrite')
    const plan = yield* preparePush(entries, app.declared, getFlagValues(options.argv, '--plain'))
    if (!options.argv.includes('--yes') && isInteractive()) {
      yield* sayPreview(plan, app.found.envNames ?? [], overwrite)
    }
    if (plan.send.length > 0) {
      yield* confirm(options.argv, `Send ${inflect(plan.send.length, 'variable')} to ${app.slug}?`)
    }
    yield* sendPlan(app.cloud, appId, plan, overwrite)
    if (options.argv.includes('--redeploy')) return yield* redeploy(app)
    if (plan.send.length > 0) yield* say('They reach the app on its next deployment.')
  })

const list = (options: EnvCommandOptions) =>
  Effect.gen(function* () {
    const json = options.argv.includes('--json')
    const project = yield* readProject(options.args[1])
    const app = yield* hostedApp(options.argv, project, !json)
    const setNames = app.found.envNames ?? app.found.env.map((variable) => variable.name)
    const kindOf = new Map(app.found.env.map((variable) => [variable.name, variable.kind]))
    const platform = app.declared.filter(
      (name) => PLATFORM_ENV_NAME_PATTERN.test(name) && !setNames.includes(name)
    )
    const missing = app.required.filter(
      (name) => !PLATFORM_ENV_NAME_PATTERN.test(name) && !setNames.includes(name)
    )
    if (json) {
      return yield* say(
        JSON.stringify({
          app: app.slug,
          vars: [
            ...setNames.map((name) => ({ name, kind: kindOf.get(name), source: 'set' })),
            ...platform.map((name) => ({ name, source: 'platform' })),
          ],
          missing,
        })
      )
    }
    const width = Math.max(
      20,
      ...[...setNames, ...platform, ...missing].map((name) => name.length + 2)
    )
    yield* say(`Variables of ${app.slug} on ${app.cloud.origin.origin}:`)
    if (setNames.length + platform.length === 0) yield* say('  none set')
    const lines = [
      ...setNames.map((name) => `  ${name.padEnd(width)}${(kindOf.get(name) ?? '').padEnd(8)}set`),
      ...platform.map((name) => `  ${name.padEnd(width)}${''.padEnd(8)}platform`),
    ]
    yield* Effect.forEach(lines, say, { discard: true })
    if (missing.length === 0) return
    yield* say('Missing, so the next deployment is refused until they are set:')
    yield* Effect.forEach(missing, (name) => say(`  ${name.padEnd(width)}missing`), {
      discard: true,
    })
  })

const unset = (options: EnvCommandOptions) =>
  Effect.gen(function* () {
    const operands = options.args.slice(1)
    const names = operands.filter((operand) => ENV_VAR_NAME_PATTERN.test(operand))
    const configFile = operands.find((operand) => !ENV_VAR_NAME_PATTERN.test(operand))
    if (names.length === 0) {
      return yield* new CliRefusal({
        headline: 'sovrium env unset needs the variables to remove — nothing was sent.',
        guidance: "Name them, for example 'sovrium env unset ANALYTICS_SITE_ID'.",
      })
    }
    const project = yield* readProject(configFile)
    const app = yield* hostedApp(options.argv, project, true)
    const appId = yield* appIdOf(app)
    yield* confirm(options.argv, `Remove ${names.join(', ')} from ${app.slug}?`)
    const results = yield* callAppEnv(app.cloud, appId, { unset: names }, 'nothing was removed')
    yield* Effect.forEach(
      results,
      (result) =>
        say(
          result.result === 'removed'
            ? app.required.includes(result.name)
              ? `  removed    ${result.name} — the config still requires it: the next deployment is refused until it is set again`
              : `  removed    ${result.name}`
            : `  ${result.result.padEnd(10)} ${result.name}${result.result === 'absent' ? ' (was not set)' : ''}`
        ),
      { discard: true }
    )
  })

const VERBS: Readonly<
  Record<string, (options: EnvCommandOptions) => Effect.Effect<void, CliRefusal>>
> = {
  push,
  list,
  unset,
}

/** Handle `sovrium env`. Exits 1 on any refusal; returns on success. */
export const handleEnvCommand = async (options: EnvCommandOptions): Promise<void> => {
  const verb = options.args[0]
  const run = verb === undefined ? undefined : VERBS[verb]
  return runCliProgram(
    run === undefined
      ? Effect.fail(
          new CliRefusal({
            headline:
              verb === undefined
                ? 'sovrium env needs a verb: push, list or unset.'
                : `"${verb}" is not a verb of sovrium env: push, list or unset.`,
            guidance: "Run 'sovrium env --help' for the usage.",
          })
        )
      : run(options)
  )
}
