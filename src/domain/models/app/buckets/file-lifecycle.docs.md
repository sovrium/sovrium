# File Lifecycle & Quotas

> When a file's bytes actually go away, the two size caps that bound storage, and reading current usage.

A file stays until something removes it. Two things can: an explicit delete, or the permanent removal of the record that referenced it. Everything else — including a soft-deleted record — leaves the bytes in place.

## Files follow their records

Attachments follow the soft-delete-by-default posture, so file presence tracks **record presence** rather than the delete request.

| What happens to the record     | What happens to the file                          |
| ------------------------------ | ------------------------------------------------- |
| Soft-deleted, the default      | Kept; a restore brings the attachment back intact |
| Restored                       | Nothing to do — the bytes never left              |
| Purged                         | Removed from storage, then the row is dropped     |
| Hard-deleted                   | **Kept.** The row goes; the bytes are orphaned    |
| Its attachment replaced        | The previous file is removed                      |
| Its attachment cleared to null | The previous file is removed                      |
| Its key referenced by another  | Kept, even during a purge                         |

Two rows deserve attention.

The last one saves you: before deleting bytes during a purge, Sovrium checks whether any **other** record still points at the same key — soft-deleted records included — so two records sharing one upload cannot orphan each other.

The hard-delete row is the trap. It is the admin-only path, and it drops the row **without touching storage**. Purge is what you want when the file must go too; it needs only the ordinary delete permission and cleans both sides.

Purge is irreversible, with no intermediate state. A plain delete is the reversible one; reach for purge when you mean erasure rather than tidying up.

## Size caps

Two operator limits bound uploads, and both are validated at boot: set either to a non-positive or non-numeric value and the server refuses to start rather than silently ignoring your cap.

| Variable                 | Default   | Bounds                                                |
| ------------------------ | --------- | ----------------------------------------------------- |
| `STORAGE_MAX_FILE_SIZE`  | 100 MB    | One upload; a bucket's own `maxFileSize` overrides it |
| `STORAGE_MAX_TOTAL_SIZE` | unlimited | Every stored byte in the application, summed          |

An oversized upload answers `413`; one that would push the total past the quota answers `507`. With no total set there is no quota check at all.

**Uploads are buffered, not streamed.** The request body is read into memory before the size check runs, so a 100 MB cap means a 100 MB allocation on an accepted request. Set the per-file cap to the smallest number your app can actually live with, and treat it as a **memory budget** rather than a policy preference.

## Reading current usage

```bash
curl https://app.example.com/api/admin/buckets/overview \
  -H "Cookie: $ADMIN_SESSION"
```

The endpoint is open to the admin and operator roles, and reports what is stored **right now** rather than what is allowed — compare the total against your own quota to know how much headroom is left.

Both the byte total and the file count are read live from the storage backend rather than tracked in a counter, so deleting files lowers them immediately. The bucket count reflects what the configuration declares; an app declaring none reports the single virtual default bucket, and one whose provider does not resolve reports zero.

### Upload history

The series block answers **when** those bytes landed, which a total cannot. Each point reports the upload count and byte sum for one interval, read from the storage catalogue — every upload path and every backend writes there, so the series summed across the window equals the total.

The period defaults to 24 hours and also accepts seven and thirty days, returning hourly or daily points. Each point is labelled by the instant its interval **opens**, and the window is measured back from the moment you call rather than snapped to clock hours or midnight. The period never affects the totals.

The catalogue holds only files that still exist, so deleting one lowers the interval it was uploaded into.

## Automation temp files

An automation writing scratch files puts them under a temp prefix. Those are reclaimed **opportunistically**: the next temp write sweeps anything older than the threshold. Nothing is scheduled, so the value is an age rather than an interval.

`STORAGE_TEMP_CLEANUP_AFTER` defaults to 24 hours in milliseconds. Set it to `0` to disable app-level sweeping entirely — the right choice when the object store's own lifecycle rule already reclaims the prefix.

Any other malformed value falls back to 24 hours rather than disabling the sweep, because silently unbounded growth is the worse failure of the two.
