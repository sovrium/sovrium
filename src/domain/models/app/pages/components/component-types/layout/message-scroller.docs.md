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

## A conversation read from a table

A channel's messages live in a table, so the frame binds one. `dataSource` is the binding every data component takes — `table`, `filter`, `sort`, `refreshMode` — and the frame's `children` then stop being the turns and become the anatomy of ONE turn, drawn once per record the reader may read and resolving `$record.<field>`. Sort the conversation oldest first, so the latest turn is at the end where the frame opens.

```yaml
components:
  - type: message-scroller
    height: 60vh
    autoScroll: true
    props: { id: channel-feed }
    dataSource:
      table: messages
      filter:
        - { field: channel, operator: eq, value: $param.id }
      sort:
        - { field: created_at, direction: asc }
      refreshMode: realtime
    authorField: author
    dayField: created_at
    children:
      - type: message
        timestamp: $record.created_at
        replies: true
        children:
          - type: bubble
            content: $record.body
            linkPreviews: true
```

`authorField` names the `user` field holding who wrote each record: the reader's own turns sit at the end side, and consecutive turns by one author share one name and picture. `dayField` names the date the conversation is split on: a date marker opens each day, in the page's language — a `marker` among the children is drawn instead, reading the day's first record. With `refreshMode: realtime` a message another reader posts is added without a reload, and `autoScroll` follows it only for a reader already at the end. A record the reader may not read is absent, as it is from the records API. A composer form posts into the frame with `appendTo: channel-feed` (see the form component).

When the `filter` pins a link field declaring `readState` to one parent — a channel's messages, as above — the frame also tracks where a signed-in reader left off. A separator labelled "New", in the page's language, is drawn above the first message created since her last visit that she did not write herself, and the frame marks the channel read as it draws: once when it opens, at most once every five seconds while new messages arrive, and once more when the page is left. Her unread count on the channel then drops to zero. The marker is placed only among the messages she may read, so it never stands for one hidden from her.

With `auth.presence.typing: true`, a frame bound to one parent's children also shows who is writing in it. While a colleague types in a composer on the same channel, a line reading "Théo Lemaire is typing" (in the page's language) sits below the turns, for readers whose role is in `auth.presence.visibleTo`. It goes away when the message is sent, or a few seconds after the last keystroke. The page's single realtime connection carries it; no second connection is opened.
