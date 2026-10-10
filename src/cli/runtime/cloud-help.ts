/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `--help` text for the verbs that ship an app to a host — `bundle`,
 * `login`, `deploy` and `env` — registered as one group by `command-help.ts`, which
 * stays under its line ceiling that way.
 */

import { BUNDLE_HELP_TEXT } from './bundle-help'

const LOGIN_HELP_TEXT = [
  'Usage: sovrium login [options]',
  '',
  'Sign the CLI in to a Sovrium cloud and keep an API key of yours on this machine.',
  '',
  'By default the command opens the approval page in your browser: one click',
  'there, and the browser hands the answer back to the CLI on this machine. Over',
  'SSH, in CI or in a container, or with --device, it prints a link and a short',
  'code to approve instead. Either way the cloud hands the CLI an API key, once.',
  'The key is stored in ~/.sovrium/credentials.json, readable by you alone (0600),',
  'and is never printed. Signing in again replaces it.',
  '',
  'Options:',
  '  --host <url>                  The cloud (default: https://cloud.sovrium.com)',
  '  --api-key <key>               Store a key you already have instead (e.g. in CI)',
  '  --device                      Approve a short code instead (SSH, a remote machine)',
  '  --open                        Accepted for compatibility; the browser opens anyway',
  '  --status                      Print the sign-in in use and its source, offline; never the key',
  '  --logout                      Revoke the key on the cloud, then delete the file',
  '  --help, -h                    Show this help message',
  '',
  'Environment variables:',
  '  BROWSER                       The command that opens a page (%s: the page); none',
  '                                opens nothing and signs in with a code',
  '  SOVRIUM_API_KEY               A key every command signs with instead of the file',
  '  SOVRIUM_HOST                  The cloud that key belongs to',
  '  SOVRIUM_ALLOW_PRIVATE_OUTBOUND  Accept plain http for a private or loopback host',
  '  SOVRIUM_DISABLE_NETWORK       Refuse before any request (--status still works)',
  '',
  'Exit codes:',
  '  0                             Signed in, signed out, or the status printed',
  '  1                             Refused, denied, expired, or not signed in',
].join('\n')

const DEPLOY_HELP_TEXT = [
  'Usage: sovrium deploy [config] [--app <slug>] [options]',
  '',
  'Bundle the app, upload it to the Sovrium cloud this machine is signed in to,',
  'and follow the deployment until its address answers.',
  '',
  'The app is --app, else the one this project is linked to (.sovrium/cloud.json),',
  'else the address the config name gives (@atelier/crm -> atelier-crm). A free',
  'address is created as your app after a yes; variables the config requires and',
  'the app lacks stop the command before anything is uploaded.',
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
  '  --seed                        Then fill its empty tables from seed/ (not with --no-wait)',
  '  --help, -h                    Show this help message',
  '',
  'Environment variables:',
  '  SOVRIUM_PUBLIC_DIR            Static files to bundle (default: public/ beside',
  '                                the config; none leaves them out)',
  '  SOVRIUM_API_KEY               A key to sign with instead of the stored sign-in',
  '  SOVRIUM_HOST                  The cloud that key belongs to (default: cloud.sovrium.com)',
  '  SOVRIUM_DISABLE_NETWORK       Refuse before any request',
  '',
  'Exit codes:',
  '  0                             Live, or recorded (--no-wait)',
  '  1                             Refused, failed, or the host could not be reached',
].join('\n')

const ENV_HELP_TEXT = [
  'Usage: sovrium env push <file> [config] [options]',
  '       sovrium env list [config] [--json]',
  '       sovrium env unset <NAME>… [config] [--yes]',
  '',
  'Set, list and remove the variables of a hosted app, by name: no value is ever',
  'printed, and no file is read unless you name it. The app is found as',
  '`sovrium deploy` finds it. Values reach the app on its next deployment.',
  '',
  'Options:',
  '  --app <slug>                  The hosted app (default: the link, else the name)',
  '  --host <url>                  The cloud (default: the one you signed in to)',
  '  --overwrite                   Replace a variable already set (push)',
  '  --plain <NAME>                Send that variable as a plain value, repeatable (push)',
  '  --redeploy                    Deploy the live bundle again at once (push)',
  '  --yes                         Do not ask (needed in a script)',
  '  --json                        Print the list as JSON (list)',
  '  --help, -h                    Show this help message',
  '',
  'Exit codes:',
  '  0                             Done',
  '  1                             Refused, or the cloud could not be reached',
].join('\n')

/** `bundle`, `login`, `deploy` and `env`, keyed by command. */
export const CLOUD_COMMAND_HELP: Readonly<Record<string, string>> = {
  bundle: BUNDLE_HELP_TEXT,
  login: LOGIN_HELP_TEXT,
  deploy: DEPLOY_HELP_TEXT,
  env: ENV_HELP_TEXT,
}
