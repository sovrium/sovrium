# Notifications

> Declare the kinds of notification your app sends; each person lists hers, marks them read and chooses, per kind, whether they reach her in the app, by email or in a digest.

The engine keeps notifications for you: each one belongs to its recipient, and nobody else can list it, open it or mark it read. Your app declares no table and writes no access rule for them.

```yaml
notifications:
  kinds:
    - name: mention
      label: Mentions
      channels: { inApp: true, email: true }
    - name: reply
      label: Replies
      channels: { inApp: true, digest: true }
  retention:
    days: 90
```

<!-- sovrium:options NotificationsSchema -->

## Kinds and channels

A kind names what happened. Its `channels` are where a notification of that kind goes until the recipient changes them: `inApp` (listed in her notifications, on unless turned off), `email` (sent to her account address through the app's email transport) and `digest` (kept for a later periodic summary that this version does not yet send: a notification kept only for the digest is neither listed nor emailed, and is removed `retention.days` after it was created). A `notification` step names one of the declared kinds; a kind the configuration does not declare is refused when it is loaded.

## Reading and marking

Every route requires a session and answers for the caller alone. Another person's notification answers `404`, exactly as an id that does not exist.

| Route                                | Does                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------ |
| `GET /api/notifications`             | Her notifications, newest first, with `unreadCount`                      |
| `POST /api/notifications/:id/read`   | Marks the one she opened                                                 |
| `POST /api/notifications/read-all`   | Marks all of hers read                                                   |
| `GET /api/notifications/preferences` | Her channels for each declared kind, the kind's defaults where unchanged |
| `PUT /api/notifications/preferences` | Changes the channels it names, per kind                                  |

Listing marks nothing read: only the notification she opens is marked, and marking all read is an explicit action.

A notification stores the table and id of the record it is about, never a copy of its fields. Opening that record reads it under her permissions at that moment, so a record she may no longer read answers `404`.

## Retention

Once a day, notifications read more than `retention.days` days ago (90 by default) are deleted for good. An unread notification listed in the app is never deleted by this rule. A notification kept only for the digest is never listed, so never read: it is deleted `retention.days` days after it was created.

## Personal data

Notifications and notification preferences belong to the person they are about: both are listed in her account export and deleted, not hidden, when her account is erased.
