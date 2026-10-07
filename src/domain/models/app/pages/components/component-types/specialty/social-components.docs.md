# Social Components

> Threaded record comments, public guest comments, the inline comment count — and how sharing is composed from types that already exist.

`comments` adds engagement to a page. It draws either of two surfaces — the full thread or an inline total — selected with `display`, integrates with the table comment system, and respects the table's `comment` permission. It accepts the shared `props` bag plus the `visibility` and `responsive` modules.

The AI chat panel that used to share this page is its own type in its own category, and is documented there.

```yaml
components:
  - type: comments
    limit: 20
    sort: newest
    paginationStyle: loadMore
    props: { placeholder: 'Add a comment…' }
  - type: comments
    display: count
    format: '{count} comments'
    emptyText: 'No comments yet'
```

## `comments`

<!-- sovrium:options type:comments -->

`display: thread` is the default and draws the full section — the list, its pagination and its composer. `display: count` draws a single inline total. Both bind the same way: on a collection page they auto-resolve `$record.id` and the collection's table for API calls, and both respect the table's `comment` permission.

Every key in the table above is a schema field written beside `type`, and each one is also accepted inside `props` — the resolver reads the component first and falls back to the bag. One key is props-only, because the schema does not declare it:

| `props` key   | Display | Description                                                                |
| ------------- | ------- | -------------------------------------------------------------------------- |
| `placeholder` | thread  | Placeholder for the composer's textarea. Defaults to `Write a comment...`. |

Which display reads which key is worth knowing, because a key belonging to the other one is **ignored, not rejected**. `table`, `recordId` and `emptyText` are read by both. `placeholder`, `limit`, `sort` and `paginationStyle` are read only by a thread. `format` is read only by a count. So `format` on a thread, and `limit`, `sort` or `paginationStyle` on a count, are read by nobody and fail nothing.

`emptyText` is one property with two defaults, because the two displays say different things when there is nothing to show: a thread reads **"No comments yet"** and a count reads **"0 comments"**. Set it and you get your wording verbatim in either display; leave it and you get the sentence belonging to the display you chose.

### Thread display

Shows author name, avatar, content and a relative timestamp; hidden when the reader lacks the table's `comment` permission.

The comment form is shown to authenticated users with that permission, and hidden from unauthenticated visitors — who instead see a sign-in prompt when the table's comment setting is `authenticated`. Authors can edit and delete their own comments; admins can delete any. Content is limited to 10,000 characters, matching the API.

Typing `@` in the comment or reply box opens a picker of the people who can read the record, other than the writer, narrowed by what follows the `@`. ArrowDown and ArrowUp move through it, Enter or Tab picks the highlighted person, a click picks too, and Escape closes it and leaves the text as typed. A picked person reads as `@<name>` in the box and is saved as a mention, so a comment automation filtered on `mentionsOnly` hears of it. A name typed by hand without picking it stays plain text. In the thread, every mention shows as the person's current name, and a mention the reader may not be shown — someone who cannot read the record, or an account that no longer exists — shows as `@unknown user`. Editing a comment shows its mentions as names and keeps them. Mentions are on wherever the composer is; there is no option to set.

### Public and guest comments

When the table's comment config enables guest comments, the form also accepts a guest name and email, and supports moderation, threading and spam protection:

| Concern         | Behaviour                                                                                                                                                                                                                                                                              |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Guest fields    | Name required, 1–100 characters; email required when guest email is required (the default), validated as an email. Stored with a null user id.                                                                                                                                         |
| Threading       | On, a single-level Reply appears on top-level comments and replies store a parent id. Off — the default — the thread is flat.                                                                                                                                                          |
| Moderation      | `manual` creates new comments as pending for an admin (the built-in `admin` or the app's highest role) to approve or reject; `auto` publishes immediately; `auth-required` publishes immediately but accepts comments only from signed-in users. Auto-approve rules bypass moderation. |
| Spam protection | A honeypot field, IP rate limiting (default 5 per minute, then 429), a link threshold that sends a comment to moderation, and blocked-word auto-reject — all enforced server-side.                                                                                                     |

Write `manual` where a config used `true`, and `auto` where it used `false`.

Guest comments open a thread only where the record itself is open to a signed-out visitor: the table's gate wins. Reading the thread needs the table's `read` to be `all`, and posting needs, on top, a `comment` grant of `all` (or none). On a table whose `read` or `comment` is `authenticated` or a role list, a signed-out visitor gets on the thread the same `401` she gets on the record, and nothing is written.

A post is judged by its gates before its body is checked. Under `auth-required` moderation a signed-out visitor is answered `401` whatever she sends, an empty or malformed body included; a post that fills the honeypot is silently discarded (`200` with `{ "success": true, "discarded": true }`, nothing stored) even when the rest of its body is malformed, so the trap reads as a success; the rate limit comes next, and only then is the body validated.

A reply's parent must be a top-level comment on the same record. A parent that does not exist, or that belongs to another record — top-level or not — is refused with the same `404`, and nothing is stored; a parent on the same record that is itself a reply is refused with `422`.

The guest form sends nothing until the page's script has run: its Post button waits for it, so a comment, a name or an email never travels in the page address.

### Count display

`display: count` renders one compact inline total. On collection pages it auto-resolves `$record.id` and the collection's table; on a dataSource-bound parent it resolves per `$record.id` for each record in a list.

```yaml
components:
  - type: comments
    display: count
    format: '{count} replies'
    emptyText: 'Be the first to comment'
```

The count is read from the comments API pagination metadata and includes only approved comments when moderation is on.

**`commentCount` was withdrawn.** The count used to be a component type of its own. It is now the `count` display of `comments` — the same feature at a smaller size, with the same table, the same record id and the same record resolution. To migrate, rename the `type` to `comments` and add `display: count`; `format` and `emptyText` carry over unchanged. A config still saying `type: commentCount` is refused at startup with that instruction.

## Sharing

**There is no `sharing` component type.** Share controls are composed from types that already exist: `link` and `button` components carrying `navigate` interactions for the social targets, and a clipboard interaction for copy-link. A config declaring `type: sharing` is refused when it is decoded, because the catalogue does not hold that name.
