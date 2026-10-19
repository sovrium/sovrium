/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { ComponentDocFragment } from '@/domain/models/app/design/kit-guidance-service'
import type { Effect, Option } from 'effect'

/** One file the portable design-system bundle copies in, by its served name. */
export interface DesignKitAssetFile {
  /** The served file name, e.g. `geist-19f9c925.woff2`. */
  readonly fileName: string
  /** The media type the file is served with. */
  readonly mediaType: string
  readonly bytes: Uint8Array
}

/** A web font file, with the face its `@font-face` rule declares. */
export interface DesignKitFontFile extends DesignKitAssetFile {
  /** The bare family name, e.g. `Geist Variable`. */
  readonly family: string
  /** The CSS weight descriptor, e.g. `100 900`. */
  readonly weight: string
  readonly style: 'normal' | 'italic'
}

/** An embedded asset could not be read. */
export class DesignKitAssetReadError extends Data.TaggedError('DesignKitAssetReadError')<{
  readonly cause: unknown
}> {}

/**
 * The files the portable design-system bundle carries beside the text it
 * builds: the self-hosted web fonts the compiled stylesheet names, the sample
 * media the catalogue's specimens draw, the app's own logo files, and the
 * component manual the kit's guidance is lifted from.
 *
 * A port because those bytes are embedded in the binary or sit in the app's
 * public directory, both of which belong to the infrastructure, and the bundle
 * builder is an application program that must not read a file path of its
 * own. The bundle COPIES the binary files — never inlines them as base64 — so a
 * design tool can lift each one out.
 */
export class DesignKitAssets extends Context.Service<
  DesignKitAssets,
  {
    readonly webFonts: Effect.Effect<ReadonlyArray<DesignKitFontFile>, DesignKitAssetReadError>
    /**
     * One sample media file the specimens draw, by its basename
     * (`sample-still.avif`); none for a name that is not one.
     */
    readonly sampleMedia: (
      name: string
    ) => Effect.Effect<Option.Option<DesignKitAssetFile>, DesignKitAssetReadError>
    /**
     * One file of the app's public directory, by the root-relative path a
     * config names it with (`/logos/mark.svg`); none when the app serves no
     * public directory, the file is missing, or the path leaves the directory.
     */
    readonly publicFile: (
      path: string
    ) => Effect.Effect<Option.Option<DesignKitAssetFile>, DesignKitAssetReadError>
    /** The component manual's fragments, by repository-relative path. */
    readonly componentManual: Effect.Effect<
      ReadonlyArray<ComponentDocFragment>,
      DesignKitAssetReadError
    >
  }
>()('DesignKitAssets') {}
