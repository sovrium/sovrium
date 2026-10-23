# Presence

> Show who is online, when each person was last seen, and who is typing — to the roles you name, and never to anonymous visitors.

Page presence (`presence: true` on a page) shows who is on that page. `auth.presence` answers a wider question: is this person online anywhere in the app.

```yaml
auth:
  strategies:
    - type: emailAndPassword
  presence:
    visibleTo: [admin, member]
    lastSeen: true
    typing: true
```

<!-- sovrium:options AuthPresenceSchema -->

A person is online while one of her pages holds the app's realtime connection open. With `lastSeen: true`, the time her last connection closed is kept and shown as `lastSeen`. Both are read-only facts on a person, carried by each entry of the user directory a `user` field's picker reads (`GET /api/users/directory`) for a reader whose role is in `visibleTo`, and pushed to such readers over their own connection as people come and go. A reader of any other role receives neither, and an anonymous visitor never receives any of it.

With `typing: true`, a page following one record (a conversation) relays who is writing under it to the readers of that record whose role is in `visibleTo`, until she sends or stops for a few seconds.

Last seen is personal data: listed in her account export and deleted with her account.
