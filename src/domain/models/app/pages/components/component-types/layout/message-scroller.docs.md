# Message Scroller

> The `message-scroller` component — a message scroller: the scroll frame of a conversation, opening at the latest turn and keeping its place.

A long thread does not fit on a screen, and a reader opening it wants the latest reply first. `message-scroller` is the frame around the turns: a box of a fixed height that scrolls inside the page, opens at the end, and is announced to assistive technology as a log, so a turn added to it is read out. Reference: shadcn/ui Message Scroller.

```yaml
components:
  - type: message-scroller
    height: 320px
    children:
      - type: marker
        content: Today
        variant: separator
      - type: message
        author: Léa Moreau
        children:
          - type: bubble
            content: Can the September invoice be split in two?
      - type: message
        author: Support
        align: end
        children:
          - type: bubble
            align: end
            content: Yes, that is done.
```

<!-- sovrium:options type:message-scroller -->

`height` is required and is a CSS length (`320px`, `24rem`, `60vh`): a frame that grows with its content never scrolls. The frame holds turns (`message`) and inline notes (`marker`) only; any other child is refused when the config is validated. `defaultScrollPosition` says where it opens — `end` (the default, the latest turn in view), `start` (the first line, for a transcript) or `last-anchor` (the top of the last turn, with `anchorPeek` pixels of the turn before it still showing). `autoScroll: true` follows turns as they are added, while the reader is at the end; a reader who scrolled up keeps their place.
