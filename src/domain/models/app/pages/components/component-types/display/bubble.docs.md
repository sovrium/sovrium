# Bubble

> The `bubble` component — the surface of one chat turn, set to its side of the thread.

The surface one turn of a conversation is drawn on. Reference: shadcn/ui Bubble.

<!-- sovrium:options type:bubble -->

`align` says which side of the thread the turn sits on: `start` (the default, the sender's side) or `end` (the receiver's). The bottom corner on that side is square, forming the tail, and the other three are rounded; `align` is logical, so a right-to-left page mirrors it. `content` is drawn first and the children after it, inside the one surface, in the informational tone.

`side` is refused: write `align: start` for the left and `align: end` for the right. A `card` with `variant: bubble` is refused with a message naming `bubble`, and so is a `side` on a `card`.
