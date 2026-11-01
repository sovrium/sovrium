/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium preview [config] [--app <slug>] [--host <url>] [--yes] [--env <file>] [--no-wait]`
 *
 * Run an app on the Sovrium cloud this machine is signed in to at a share
 * address of its own, leaving the app at its address untouched:
 *
 * 1. everything `sovrium deploy` does up to its request (`deploy-ship.ts`):
 *    the bundle, the app (`--app`, the link, the config `name`), `--yes`,
 *    `--env <file>`, the variables the config requires, the upload;
 * 2. the request goes to `POST /api/automations/preview/webhook`, keyed on the
 *    app, `preview` and the manifest — so a preview and a deploy of one bundle
 *    never answer each other. A cloud released before previews answers the
 *    route 404, and the command says it has none;
 * 3. unless `--no-wait`, the preview is followed as a deployment is
 *    (`deploy-follow.ts`), and once its share address answers the command
 *    prints it and the day it expires — never `Live at`.
 *
 * `--seed` is refused before anything is built: the preview starts from the
 * bundle's own `seed/` folder. So is an `--env <file>` that sets
 * `DATABASE_URL` or a credential (a name ending in `_SECRET`, `_TOKEN`, `_KEY`
 * or `_PASSWORD`), unless `--allow-production-env`: a preview answers at a
 * share address anyone with the link can open. The share address is the cloud's answer,
 * printed as given; the command never builds it.
 */

import { resolve } from 'node:path'
import { Effect } from 'effect'
import { defineFlags, flag, type FlagsOf } from '@/cli/runtime/flag-schema'
import { CliRefusal, withFlags } from '@/cli/runtime/run-command'
import { explicitAddress } from './cloud-app-lookup'
import { assertNetworkAllowed } from './cloud-session'
import { cloudTargetFlags, signedInCloud } from './cloud-sign-in'
import { announceAndFollow } from './deploy-follow'
import { PREVIEW_INTAKE, ship, shipFlags } from './deploy-ship'
import { configPathOf } from './deploy-target'
import { readEnvFile } from './env-push'

/** The flags `sovrium preview` reads. */
export const previewFlags = defineFlags({
  ...cloudTargetFlags,
  ...shipFlags,
  seed: flag.switch('--seed'),
  noWait: flag.switch('--no-wait'),
  allowProductionEnv: flag.switch('--allow-production-env'),
})

type PreviewFlags = FlagsOf<typeof previewFlags>

/** Everything `sovrium preview` reads from the command line. */
export interface PreviewCommandOptions {
  readonly configFile: string | undefined
  readonly flags: PreviewFlags
}

/** `--seed` fills a live app; a preview starts from the bundle's own seed. */
const refuseSeed = (flags: PreviewFlags, slug: string | undefined) =>
  flags.seed
    ? Effect.fail(
        new CliRefusal({
          headline: '--seed is not available with sovrium preview — nothing was built or sent.',
          guidance: `Preview without it, then seed with 'sovrium seed --app ${slug ?? '<slug>'}'.`,
        })
      )
    : Effect.void

/** Whether a variable reads as a production credential: the database address, or a secret by its name. */
export const isProductionCredential = (name: string): boolean =>
  name === 'DATABASE_URL' || /_(?:SECRET|TOKEN|KEY|PASSWORD)$/.test(name)

/**
 * Refuse an `--env <file>` that sets a production credential, naming each such
 * variable and never a value, unless `--allow-production-env`. Read before
 * anything is built, uploaded or set.
 */
const refuseProductionEnv = (flags: PreviewFlags) =>
  Effect.gen(function* () {
    const file = flags.env
    if (file === undefined || flags.allowProductionEnv) return
    const names = (yield* readEnvFile(resolve(file)))
      .map((entry) => entry.name)
      .filter(isProductionCredential)
    if (names.length === 0) return
    return yield* new CliRefusal({
      headline: `${file} sets production credentials — nothing was built or sent.`,
      detail: [
        `A preview answers at a share address anyone with the link can open: ${names.join(', ')}.`,
      ],
      guidance:
        'Preview with an --env file of test values, or pass --allow-production-env if it must use these.',
    })
  })

/** Sign-in check, ship through the preview door, and (unless `--no-wait`) follow it. */
const preview = (options: PreviewCommandOptions) =>
  Effect.gen(function* () {
    const { flags } = options
    const explicit = yield* explicitAddress(flags.app)
    yield* refuseSeed(flags, explicit)
    yield* refuseProductionEnv(flags)
    yield* assertNetworkAllowed('preview')
    const cloud = yield* signedInCloud(flags.host)
    const configPath = yield* configPathOf(options.configFile)
    const { deployment, target } = yield* ship(
      cloud,
      { flags, configPath, explicit },
      PREVIEW_INTAKE
    )
    const { previewUrl } = deployment
    yield* announceAndFollow(cloud, deployment, {
      slug: target.slug,
      replayed: `Already previewed (revision ${deployment.deploymentId}).`,
      url: previewUrl,
      noWait: flags.noWait,
      noWaitLines: [`Preview URL: ${previewUrl} — answers once the deployment is live.`],
      verb: 'preview',
      arrived: () => [`Preview at ${previewUrl}.`, `Expires ${deployment.expiresAt.slice(0, 10)}.`],
    })
  })

/** Handle `sovrium preview`: the config, and its flags. */
export const handlePreviewCommand = withFlags(previewFlags, ({ configFile, flags }) =>
  preview({ configFile, flags })
)
