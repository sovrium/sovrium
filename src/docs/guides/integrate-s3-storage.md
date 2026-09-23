# Store Sovrium files in S3-compatible storage

> Send Sovrium bucket uploads to any S3-compatible store — AWS S3, MinIO, Scaleway, Backblaze — with a handful of `STORAGE_S3_` environment variables.

Sovrium stores uploaded files on the local disk by default. To use durable object storage — AWS S3, MinIO, Scaleway Object Storage, Backblaze B2 — switch the storage backend with environment variables. Your `buckets` config never changes.

## Point storage at S3

```bash
export STORAGE_PROVIDER=s3
export STORAGE_S3_ENDPOINT=https://s3.example-region.amazonaws.com
export STORAGE_S3_BUCKET=my-app-files
export STORAGE_S3_REGION=eu-west-1
export STORAGE_S3_ACCESS_KEY_ID=<key>
export STORAGE_S3_SECRET_ACCESS_KEY=<secret>
# MinIO and other path-style endpoints only:
export STORAGE_S3_FORCE_PATH_STYLE=true
sovrium start app.yaml
```

The storage backend is operator-controlled and deliberately kept out of the app schema — the same config runs against local disk in development and S3 in production.

## Verify

Upload a file through any bucket-backed attachment field or form upload; the object lands in your S3 bucket.

## Next

- **Buckets Overview** — declaring buckets, size limits and visibility.
- **Form File Uploads** — accepting uploads that write to a bucket.
- **Environment Variables** — the full storage variable set.
