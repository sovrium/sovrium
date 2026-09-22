# Design-system sample media

Three files the operator console's `image`, `video` and `audio` specimens draw, so that
each of those pages shows a **real** picture, a **real** moving picture and a **real**
sound rather than an empty transport.

Everything here is **Sovrium-authored**: each file is synthesised from scratch by the
`ffmpeg` filter graph recorded below. Nothing is downloaded, nothing is licensed from a
third party, and no font, logo file or photograph is an input — so the commands reproduce
byte-for-byte anywhere `ffmpeg` runs, not only on the machine that first ran them.

## What ships

| File                 | Bytes  | Budget   | Shape                                       |
| -------------------- | ------ | -------- | ------------------------------------------- |
| `sample-still.avif`  | 764    | ≤ 40 KB  | 960×540, AV1, `yuv420p`                     |
| `sample-motion.webm` | 18 665 | ≤ 200 KB | 640×360, VP9, 4 s at 25 fps, no audio track |
| `sample-chime.mp3`   | 24 493 | ≤ 50 KB  | mono, 44.1 kHz, 64 kbps, 3 s                |

The budgets are the founder's (review row 36) and are asserted by the console specs, so a
regenerated file that grows past one fails the build rather than quietly inflating the
page. Re-measure with `ls -l` after any regeneration and update the Bytes column.

## Why these three formats

- **AVIF** for the still, because `scripts/drift/check-image-format-drift.ts` fixes
  `REQUIRED_RASTER_EXTENSION = '.avif'` for every committed raster in this repository, and
  the ecoconception R1 rule in `CLAUDE.md` asks for the smallest modern codec the producer
  can emit. The encode happens once, here, on a machine that has an AV1 encoder; the
  runtime transform pipeline's WebP default is a different constraint and does not apply.
- **VP9 in WebM** for the motion clip. AV1-in-WebM would be smaller still, but the clip is
  already two orders of magnitude inside its budget, and VP9 decodes everywhere a console
  is opened.
- **MP3** for the chime, and this one is a deliberate step AWAY from the smallest codec.
  `renderAudio` emits a single `<audio src=…>` with no `<source>` fallback list, so the
  one format chosen has to decode in every browser on its own. Opus-in-WebM would be about
  a third the size and would be silent wherever it is unsupported; 24 KB of MP3 is not a
  footprint worth defending against that. A second reason: `inferMimeFromKey` maps one
  extension to one MIME type, so a `.webm` holding only audio would have to be served as
  `video/webm`, which is a lie the browser then has to sniff its way past.

## The mark

The composition is the Sovrium mark's own geometry, reduced to what a filter graph can
draw: the nuclide dot (`apps/website/public/logos/sovrium-icon-light.svg` opens with
exactly that circle), two rules standing in for the wordmark, on a neutral diagonal
gradient between `#101010` and `#4a4a4a`. Restraint is the design default
([ADR-024](../../../../docs/architecture/decisions/024-restraint-as-the-design-default.md)),
and a sample image that shouts would teach the wrong thing on a page whose subject is how
this system looks.

The moving clip animates the same two elements — the dot travels, a progress rule fills
left to right over the four seconds — because a still frame of a video specimen cannot
tell a reader whether the transport works. That is the question row 36 was asked about.

## Regenerating

Run from the repository root. The still is produced in two steps because the composition
is built in RGB and encoded separately.

```sh
# 1. the still — compose, then encode
ffmpeg -y \
  -f lavfi -i "gradients=s=960x540:c0=0x101010FF:c1=0x4A4A4AFF:x0=0:y0=0:x1=960:y1=540:type=linear:d=1:n=2" \
  -f lavfi -i "color=c=black:s=960x540:d=1,format=rgba,geq=r='251':g='250':b='248':a='if(lte((X-236)*(X-236)+(Y-270)*(Y-270),84*84),255,0)'" \
  -filter_complex "[0:v][1:v]overlay=0:0,drawbox=x=392:y=236:w=372:h=14:color=0xFBFAF8@0.95:t=fill,drawbox=x=392:y=282:w=232:h=14:color=0xFBFAF8@0.45:t=fill,drawbox=x=0:y=524:w=960:h=16:color=0xFBFAF8@0.12:t=fill,format=yuv420p" \
  -frames:v 1 /tmp/sovrium-sample-still.png

ffmpeg -y -i /tmp/sovrium-sample-still.png \
  -c:v libaom-av1 -crf 26 -cpu-used 3 -still-picture 1 -pix_fmt yuv420p \
  -f avif apps/admin/assets/samples/sample-still.avif

# 2. the motion clip — the dot oscillates, the rule fills
ffmpeg -y \
  -f lavfi -i "gradients=s=640x360:c0=0x101010FF:c1=0x4A4A4AFF:x0=0:y0=0:x1=640:y1=360:type=linear:d=4:r=25:n=2" \
  -f lavfi -i "color=c=black:s=640x360:d=4:r=25,format=rgba,geq=r='251':g='250':b='248':a='if(lte((X-(200+120*sin(2*PI*T/4)))*(X-(200+120*sin(2*PI*T/4)))+(Y-150)*(Y-150),52*52),255,if(between(Y,296,304)*between(X,64,64+512*T/4),255,if(between(Y,296,304)*between(X,64,576),46,0)))'" \
  -filter_complex "[0:v][1:v]overlay=0:0,format=yuv420p" \
  -t 4 -c:v libvpx-vp9 -crf 38 -b:v 0 -row-mt 1 -an \
  apps/admin/assets/samples/sample-motion.webm

# 3. the chime — C5 then G5, each with its own envelope
ffmpeg -y \
  -f lavfi -i "sine=frequency=523.25:duration=3:sample_rate=44100" \
  -f lavfi -i "sine=frequency=783.99:duration=3:sample_rate=44100" \
  -filter_complex "[0:a]afade=t=in:st=0:d=0.02,afade=t=out:st=0.15:d=1.25,volume=0.5[a0];[1:a]adelay=1200|1200,afade=t=in:st=1.2:d=0.02,afade=t=out:st=1.35:d=1.6,volume=0.42[a1];[a0][a1]amix=inputs=2:normalize=0,alimiter=limit=0.9[out]" \
  -map "[out]" -ac 1 -ar 44100 -c:a libmp3lame -b:a 64k -t 3 \
  apps/admin/assets/samples/sample-chime.mp3
```

The `geq` filter's `T` is the frame timestamp in seconds — that is what animates the clip,
and it is the reason the progress rule lives inside the alpha expression rather than in a
`drawbox`, whose own `t` option name collides with the time variable.

## How they reach a page

They are embedded into the compiled binary, not read from this directory at run time:
`scripts/build/generate-embedded-static-assets.ts` emits a `with { type: 'file' }` import
per file, which resolves to this path in dev and to a `$bunfs/…` path in the binary.
They are then served from the root asset namespace at `/assets/design-system/<file>` —
root, and NOT under the console's `/_admin` mount, because the mount serves page routes
only: a mounted console page already links `/assets/output-<hash>.css`, and
`/_admin/assets/client.js` answers 404 today.
