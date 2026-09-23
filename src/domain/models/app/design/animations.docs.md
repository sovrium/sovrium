# Animations

> `design.motion` holds the duration ladder, the easing set, the named keyframe blocks, and the animations composed out of them.

Its four members sit side by side rather than nesting, so a duration ladder is a ladder and an animation is an animation. Tokens generate CSS any component can reach through its `className`.

<!-- sovrium:options DesignMotionSchema -->

Each of the four is an open map keyed by a token name — alphanumeric, starting with a letter — so none publishes a table of its own.

## `animations`

Each value is one of three shapes, giving a spectrum from a one-line toggle to a full definition:

- **A boolean** enables or disables a named animation: `fadeIn: true`.
- **A string** is a raw CSS animation value or a utility class name: `slideUp: 'animate-slide-up'`.
- **A config object** gives detailed timing control.

```yaml
design:
  motion:
    animations:
      fadeIn: true
      slideUp: 'animate-slide-up'
```

### The config-object form

<!-- sovrium:options AnimationConfigObjectSchema -->

```yaml
design:
  motion:
    animations:
      modalOpen:
        enabled: true
        duration: '300ms'
        easing: 'ease-in-out'
        delay: '0ms'
```

## The sibling token maps

For a reusable motion system, declare `durations`, `easings` and `keyframes` beside `animations` rather than inside it. Other animations and component classes then reference those tokens instead of repeating raw values, and each step's name becomes the suffix of a utility: `--duration-fast` makes `duration-fast` real.

```yaml
design:
  motion:
    durations:
      fast: '120ms'
      normal: '300ms'
      slow: '500ms'
    easings:
      smooth: 'cubic-bezier(0.4, 0, 0.2, 1)'
      bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
    keyframes:
      fadeIn:
        from: { opacity: '0' }
        to: { opacity: '1' }
      colorPulse:
        '0%': { backgroundColor: '$colors.primary' }
        '50%': { backgroundColor: '$colors.accent' }
        '100%': { backgroundColor: '$colors.primary' }
```

`durations` and `easings` are keyed by a ladder step name and hold a CSS duration or timing function. `keyframes` is keyed like an animation and holds a keyframe map — `from`/`to`, or percentage stops.

**Keyframe values may reference design colours** with the `$colors.<name>` syntax, which keeps motion in step with the palette rather than freezing a hex value inside an animation.

## Footprint

Motion is a footprint concern. Prefer short durations, and avoid long-running infinite animations on first paint. Sovrium's eco posture is operator-controlled through environment variables rather than through the design schema — see the `ECO_` variables in the Environment Variables reference for the controls that govern client behaviour.
