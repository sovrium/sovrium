# Message

> The `message` component — a message: one turn of a conversation — who said it, when, on which side — around the bubble that holds it.

A `message` is one turn of a thread: the author and their picture, the time it was said, and what was said, held in its children — usually a `bubble`, often an `attachment` beside it. A support exchange, a comment thread or a changelog written as a conversation is a column of messages. Reference: shadcn/ui Message.

```yaml
components:
  - type: message
    author: Léa Moreau
    avatar:
      initials: LM
    timestamp: '2026-10-12T09:14:00Z'
    children:
      - type: bubble
        content: The invoice for September is attached.
    footer:
      - type: attachment
        name: invoice-2026-09.pdf
        description: PDF, 180 KB
  - type: message
    author: Support
    align: end
    timestamp: '2026-10-12T09:20:00Z'
    children:
      - type: bubble
        align: end
        content: Thanks, the payment is scheduled for Friday.
```

<!-- sovrium:options type:message -->

`align: end` sets the turn on the other side of the thread; the sides are logical, so a right-to-left page mirrors them. Consecutive messages by the same `author` print the name and the picture once, at the first turn of the run: a group is something the page sees, not a key to declare. `avatar` draws a picture from `src`, or up to two `initials` when there is none. `timestamp` is an ISO date-time drawn as a time element, formatted in the page's language. `header` and `footer` hold components drawn above and below the turn's content — a marker saying it was edited, the files it carried.
