/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { TemplateStringSchema } from '../../template'
import { ActionBaseFields } from '../base'
import { DestinationPropSchema } from './shared'

/**
 * File Extract Audio Action (type: file, operator: extractAudio)
 *
 * Copy the audio track out of a stored video into an audio-only file, so a
 * recorded call can feed `ai/transcribe` or be attached on its own.
 *
 * ## Why there is no `format`
 *
 * The extraction is a REMUX: the audio packets are copied byte for byte into
 * a new container, and nothing is decoded or re-encoded. A remux cannot change
 * the codec, so the output container follows the source rather than a choice
 * the author makes:
 *
 * - an MP4 or QuickTime (`.mov`) video carrying AAC gives an `.m4a`
 *   (`audio/mp4`);
 * - a Matroska (`.mkv`) or WebM video carrying Opus or Vorbis gives a `.webm`
 *   (`audio/webm`).
 *
 * Offering `mp3` or `wav` would need an encoder in the binary, which Sovrium
 * does not ship. Because `props` accepts exactly the keys below, a config
 * naming `format` is REFUSED by `sovrium validate` and at boot instead of
 * being accepted and ignored.
 */
export const FileExtractAudioActionSchema = Schema.Struct({
  ...ActionBaseFields,
  type: Schema.Literal('file').pipe(
    Schema.annotate({
      description: "Constant value 'file' for type discrimination in discriminated unions",
    })
  ),
  operator: Schema.Literal('extractAudio').pipe(
    Schema.annotate({
      description:
        "Selects the operation within the 'file' action family; it decides which props the step takes",
    })
  ),
  props: Schema.Struct({
    /** The video to take the audio track from: a storage key or an attachment field's value */
    source: TemplateStringSchema.pipe(
      Schema.annotate({
        description:
          "The video whose audio track is extracted, as a storage key or an attachment field's value: an MP4 or QuickTime file carrying AAC, or a Matroska or WebM file carrying Opus or Vorbis",
      })
    ),

    /** Storage destination for the extracted audio */
    destination: DestinationPropSchema,
  }).annotate({
    description:
      'The video to take the audio track from, and where the audio-only file is written. The output container follows the source; there is no format to choose.',
  }),
}).pipe(
  Schema.annotate({
    identifier: 'FileExtractAudioAction',
    title: 'File Extract Audio Action',
    description:
      'Copy the audio track of a stored video into an audio-only file, without re-encoding it',
  })
)

/** @public */
export type FileExtractAudioAction = Schema.Schema.Type<typeof FileExtractAudioActionSchema>
