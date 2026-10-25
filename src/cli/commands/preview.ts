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
 * bundle's own `seed/` folder. The share address is the cloud's answer,
 * printed as given; the command never builds it.
 */

import { Effect } from 'effect'
import { explicitAddress } from './cloud-app-lookup'
import { CliRefusal, assertNetworkAllowed, runCliProgram } from './cloud-session'
import { signedInCloud } from './cloud-sign-in'
import { announceAndFollow } from './deploy-follow'
import { PREVIEW_INTAKE, ship } from './deploy-ship'
import { configPathOf } from './deploy-target'

/** Everything `sovrium preview` reads from the command line. */
export interface PreviewCommandOptions {
  readonly configFile: string | undefined
  readonly argv: readonly string[]
}

/** `--seed` fills a live app; a preview starts from the bundle's own seed. */
const refuseSeed = (argv: readonly string[], slug: string | undefined) =>
  argv.includes('--seed')
    ? Effect.fail(
        new CliRefusal({
          headline: '--seed is not available with sovrium preview — nothing was built or sent.',
          guidance: `Preview without it, then seed with 'sovrium seed --app ${slug ?? '<slug>'}'.`,
        })
      )
    : Effect.void

/** Sign-in check, ship through the preview door, and (unless `--no-wait`) follow it. */
const preview = (options: PreviewCommandOptions) =>
  Effect.gen(function* () {
    const { argv } = options
    const explicit = yield* explicitAddress(argv)
    yield* refuseSeed(argv, explicit)
    yield* assertNetworkAllowed('preview')
    const cloud = yield* signedInCloud(argv)
    const configPath = yield* configPathOf(options.configFile)
    const { deployment, target } = yield* ship(
      cloud,
      { argv, configPath, explicit },
      PREVIEW_INTAKE
    )
    const { previewUrl } = deployment
    yield* announceAndFollow(cloud, deployment, {
      slug: target.slug,
      replayed: `Already previewed (revision ${deployment.deploymentId}).`,
      url: previewUrl,
      noWait: argv.includes('--no-wait'),
      noWaitLines: [`Preview URL: ${previewUrl} — answers once the deployment is live.`],
      verb: 'preview',
      arrived: () => [`Preview at ${previewUrl}.`, `Expires ${deployment.expiresAt.slice(0, 10)}.`],
    })
  })

/** Handle `sovrium preview`. Exits 1 on any refusal; returns on success. */
export const handlePreviewCommand = async (options: PreviewCommandOptions): Promise<void> =>
  runCliProgram(preview(options))
