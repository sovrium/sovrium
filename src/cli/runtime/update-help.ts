/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/** `sovrium update --help`, imported by the update command and the help map alike. */
export const UPDATE_HELP_TEXT = [
  'Usage: sovrium update [--insecure-skip-checksum]',
  '',
  'Update Sovrium to the latest version. Behaviour depends on how it was installed:',
  '  binary                        Self-replace from GitHub Releases (Unix)',
  '  homebrew                      Delegates to `brew upgrade sovrium/tap/sovrium`',
  '  scoop                         Delegates to `scoop update sovrium`',
  '  docker                        Prints the `docker pull` instruction',
  '',
  'Options:',
  '  --insecure-skip-checksum      Install without verifying the sha256 or the signature',
  '  --help, -h                    Show this help message',
  '',
  'Environment variables (advanced / test seams):',
  '  SOVRIUM_INSTALL_METHOD        Force the detected install method',
  '  SOVRIUM_DISABLE_NETWORK       Skip all network calls (offline)',
  '  SOVRIUM_UPDATE_API_HOST       Override the GitHub API host',
  '  SOVRIUM_UPDATE_DRY_RUN        Print package-manager command instead of running',
  '',
  'Environment variables (GitHub releases API):',
  '  GH_TOKEN                      GitHub token sent to the releases API only, lifting',
  '                                the anonymous rate limit (60 requests an hour)',
  '  GITHUB_TOKEN                  The same, read when GH_TOKEN is unset',
].join('\n')
