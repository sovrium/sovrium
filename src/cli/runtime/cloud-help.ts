/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `--help` text for the three verbs that ship an app to a host — `bundle`,
 * `login` and `deploy` — registered as one group by `command-help.ts`, which
 * stays under its line ceiling that way.
 */

import { BUNDLE_HELP_TEXT } from './bundle-help'

const LOGIN_HELP_TEXT = [
  'Usage: sovrium login [options]',
  '',
  'Sign the CLI in to a Sovrium cloud and keep an API key of yours on this machine.',
  '',
  'By default the command prints a link and a short code: approve the code in a',
  'browser where you are signed in, and the cloud hands the CLI an API key, once.',
  'The key is stored in ~/.sovrium/credentials.json, readable by you alone (0600),',
  'and is never printed. Signing in again replaces it.',
  '',
  'Options:',
  '  --host <url>                  The cloud (default: https://cloud.sovrium.com)',
  '  --api-key <key>               Store a key you already have instead (e.g. in CI)',
  '  --open                        Also open the approval page in your browser',
  '  --status                      Print the stored sign-in, offline; never the key',
  '  --logout                      Revoke the key on the cloud, then delete the file',
  '  --help, -h                    Show this help message',
  '',
  'Environment variables:',
  '  SOVRIUM_ALLOW_PRIVATE_OUTBOUND  Accept plain http for a private or loopback host',
  '  SOVRIUM_DISABLE_NETWORK       Refuse before any request (--status still works)',
  '',
  'Exit codes:',
  '  0                             Signed in, signed out, or the status printed',
  '  1                             Refused, denied, expired, or not signed in',
].join('\n')

const DEPLOY_HELP_TEXT = [
  'Usage: sovrium deploy [config] --app <slug> [options]',
  '',
  'Bundle the app, upload it to the Sovrium cloud this machine is signed in to,',
  'and follow the deployment until it is live.',
  '',
  'The bundle is built exactly as `sovrium bundle` builds it; an invalid config',
  'prints the validate report and nothing is sent. Deploying unchanged content to',
  'the same app again is answered with the first deployment. Nothing is retried.',
  '',
  'Arguments:',
  '  config                        Path to config file (.json, .yaml, .yml, .ts)',
  '                                (auto-discovered when omitted)',
  '',
  'Options:',
  '  --app <slug>                  The hosted app to deploy to (required)',
  '  --host <url>                  The cloud (default: the one you signed in to)',
  '  --no-wait                     Return once the deployment is recorded',
  '  --help, -h                    Show this help message',
  '',
  'Environment variables:',
  '  SOVRIUM_PUBLIC_DIR            Static files to bundle (default: public/ beside',
  '                                the config; none leaves them out)',
  '  SOVRIUM_DISABLE_NETWORK       Refuse before any request',
  '',
  'Exit codes:',
  '  0                             Live, or recorded (--no-wait)',
  '  1                             Refused, failed, or the host could not be reached',
].join('\n')

/** `bundle`, `login` and `deploy`, keyed by command. */
export const CLOUD_COMMAND_HELP: Readonly<Record<string, string>> = {
  bundle: BUNDLE_HELP_TEXT,
  login: LOGIN_HELP_TEXT,
  deploy: DEPLOY_HELP_TEXT,
}
