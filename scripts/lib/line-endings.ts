/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Line-ending normalisation for the build's byte-exact checks.
 *
 * Several build steps compare committed bytes with bytes rendered from other
 * committed files, or hash committed files into a recorded fingerprint. Git
 * rewrites line endings on checkout wherever `core.autocrlf` is on — the
 * default on the GitHub `windows-latest` runner — so the same commit reads back
 * as CRLF there and LF everywhere else. v0.32.0's Windows binary build failed on
 * exactly that, on bytes no human changed.
 *
 * Two layers hold it, and this is the second. The first is `* -text` in the
 * repository's `.gitattributes` (and in the one the release mirror writes),
 * which stops git converting anything on any checkout. This one makes each
 * check agree with itself even when the bytes on disk did not come from such a
 * checkout — a source archive unpacked by a Windows tool, an editor that saved
 * CRLF. Only `\r\n` is folded: a lone `\r` is content, and stays a difference.
 *
 * On a tree that is already LF every function here is the identity, so no
 * payload or recorded hash moves on macOS or Linux.
 */

/** `text` with every CRLF folded to LF. */
export const toLf = (text: string): string => text.replace(/\r\n/g, '\n')

/** Whether two texts are equal once their CRLF line endings are folded. */
export const sameIgnoringCrlf = (a: string, b: string): boolean => toLf(a) === toLf(b)

/**
 * `bytes` with every CRLF folded to LF — the SAME buffer when it holds none, so
 * a hash taken over an LF file is bit-for-bit the hash it always was, whatever
 * its encoding.
 */
export const bytesToLf = (bytes: Buffer): Buffer =>
  bytes.includes('\r\n') ? Buffer.from(toLf(bytes.toString('utf8')), 'utf8') : bytes
