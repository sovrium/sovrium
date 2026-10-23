# Bubble

> The `bubble` component — the surface of one chat turn, set to its side of the thread.

The surface one turn of a conversation is drawn on. Reference: shadcn/ui Bubble.

<!-- sovrium:options type:bubble -->

`align` says which side of the thread the turn sits on: `start` (the default, the sender's side) or `end` (the receiver's). The bottom corner on that side is square, forming the tail, and the other three are rounded; `align` is logical, so a right-to-left page mirrors it. `content` is drawn first and the children after it, inside the one surface, in the informational tone.

`side` is refused: write `align: start` for the left and `align: end` for the right. A `card` with `variant: bubble` is refused with a message naming `bubble`, and so is a `side` on a `card`.

`linkPreviews: true` draws a card under the bubble for each web address in its text — the page's title, description, site name and picture — when the bubble shows a stored record's text. The server reads each address once, in the background, when the record is stored, never because a reader asked: an address not read yet draws no card. The read goes through the same outbound guard as the http actions, so a private, loopback, link-local or cloud-metadata address is refused, on the first request and on every redirect; only the page's head is read, and it is remembered for 24 hours (a failed read for one hour), so one page posted in a thousand messages is read once. The card is text, never the page's HTML, and its picture is fetched once, checked to be an image under the size cap, and served by the app, so a reader's browser never contacts the other site.
