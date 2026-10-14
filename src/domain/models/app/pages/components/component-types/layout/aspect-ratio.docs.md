# Aspect Ratio

> The `aspect-ratio` component — one image, video or map held at a fixed width-to-height shape, whatever the screen.

A video, a map or a cover image has a shape before it has a size. `aspect-ratio` is the frame that keeps it: one child, a declared ratio, and a height that follows the width at every screen size, with no script and no fixed height. Reference: shadcn/ui Aspect Ratio.

```yaml
components:
  - type: aspect-ratio
    ratio: 16/9
    children:
      - type: video
        props:
          src: /media/onboarding-tour.mp4
  - type: aspect-ratio
    ratio: 1
    children:
      - type: image
        props:
          src: /media/team/portrait.avif
          alt: Head of research
```

<!-- sovrium:options type:aspect-ratio -->

`ratio` is required and has no default: write it as the fraction a reader says (`16/9`, `4/3`) or as the positive number it equals (`1` for a square, `0.75` for a portrait card). The frame holds exactly one child, and that child is a medium — an `image`, a `video`, an `iframe`, a `map` or a `qr-code` — which is laid over the whole frame, edge to edge, cropped to cover it. A second child, or a child of another type such as a `text`, is refused when the config is validated, because a box sized by its ratio has nowhere to put it and a paragraph has no shape to keep.
