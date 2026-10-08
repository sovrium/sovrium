/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `--help` text for `sovrium render`. Kept beside `command-help.ts`, which
 * registers it, so that file stays under its line ceiling.
 */
export const RENDER_HELP_TEXT = [
  'Usage: sovrium render <asset> [options]',
  '',
  'Render one template asset the way an automation would, and print it or write it.',
  'Offline: it starts no server, opens no port, reads no database and runs no automation.',
  '',
  'Arguments:',
  '  asset                         Path of a template asset declared in `assets`',
  '',
  'Options:',
  '  --data <file>                 Values to render with (JSON or YAML); default: the',
  "                                asset's sampleData, else empty values",
  '  --out <file>                  Write the render here; its extension picks the format:',
  '                                .html .svg .txt .pdf .png .jpeg .webp .docx .xlsx',
  '  --email                       Render an HTML template as email/send delivers it',
  '  --locale <code>               Render in this declared language',
  '  --config <file>               The config to read (default: discovered in this directory)',
  '',
  'An HTML template renders to .html, .pdf or .png (the last two need RENDERER_*); an SVG',
  'template to .svg, .png, .jpeg or .webp; a Word template to .docx, or .pdf with OFFICE_*;',
  'an Excel template to .xlsx. A Word or Excel template needs --out.',
  '',
  'Examples:',
  '  sovrium render templates/invoice.html --data order.json',
  '  sovrium render templates/invoice.html --out invoice.pdf',
  '  sovrium render templates/contract.docx --out contract.docx',
  '  sovrium render templates/invoice-email.html --email',
].join('\n')
