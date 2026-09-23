# Storage Backends

> Where the bytes end up — an operator decision made entirely with environment variables, so one configuration file runs against local disk in development and an object store in production.

All three backends support the full surface: upload, download, delete, signed URLs and image transforms.

| Backend                  | Provider value                | Suits                                     |
| ------------------------ | ----------------------------- | ----------------------------------------- |
| Local filesystem         | `local`                       | Development, a single node, self-hosting  |
| S3 and compatible stores | `s3`                          | Production and multi-node deployments     |
| Self-hosted object store | `s3` plus the path-style flag | MinIO, R2, and other non-AWS stores       |
| PostgreSQL bytes         | `bytea`                       | Small files, and one-database deployments |

## Choosing one

`STORAGE_PROVIDER` is not required. Left unset, the backend follows the database dialect.

| Provider | Database   | Resulting backend                                            |
| -------- | ---------- | ------------------------------------------------------------ |
| `s3`     | either     | S3; four variables are then required                         |
| `local`  | either     | Local files; the directory is **required**, with no fallback |
| unset    | PostgreSQL | Bytes in the database you already run                        |
| unset    | SQLite     | Local files under the data directory                         |

The two unset rows are the zero-config path, mirroring the SQLite-default posture: nothing external to provision and nothing to credential.

Note the asymmetry. An **explicit** local provider fails at boot without a directory, while an **implicit** one picks the default directory for you. The explicit form is treated as a deliberate statement about placement, so a missing directory there is a mistake worth surfacing rather than a gap worth filling.

```bash
STORAGE_PROVIDER=local
STORAGE_LOCAL_DIRECTORY=/var/lib/sovrium/uploads
```

```bash
STORAGE_PROVIDER=s3
STORAGE_S3_ENDPOINT=https://minio.example.com
STORAGE_S3_BUCKET=my-app-files
STORAGE_S3_REGION=eu-west-1
STORAGE_S3_ACCESS_KEY_ID=...
STORAGE_S3_SECRET_ACCESS_KEY=...
STORAGE_S3_FORCE_PATH_STYLE=true
```

| Variable                       | Required | Default     |
| ------------------------------ | -------- | ----------- |
| `STORAGE_S3_ENDPOINT`          | yes      | —           |
| `STORAGE_S3_BUCKET`            | yes      | —           |
| `STORAGE_S3_ACCESS_KEY_ID`     | yes      | —           |
| `STORAGE_S3_SECRET_ACCESS_KEY` | yes      | —           |
| `STORAGE_S3_REGION`            | no       | `us-east-1` |
| `STORAGE_S3_FORCE_PATH_STYLE`  | no       | `false`     |

Set the provider to `s3` with any one of the four required variables present, and a missing sibling fails the boot **by name**.

## One host bucket, however many you declare

Every declared bucket stores its objects in the single object store the environment names. You do not create one store per declared bucket, and you do not need permission to create stores at all.

A declared bucket is not a folder: keys are flat, and each object records the bucket it was uploaded to rather than carrying it in the path. That record is what keeps one bucket's objects out of another's.

## A missing variable stops the boot; an unreachable store does not

The two failures look alike and are handled deliberately differently.

A missing required variable is yours to fix before the process is any use, so the boot is refused and the variable is named. A store that is configured correctly and simply does not answer — the endpoint is down, a credential was rotated, the name is a typo only the provider can see — is a condition that can clear itself while the server runs. Failing the boot over it would take the whole app offline, including every page that never touches a file.

So the store is probed **once per process**, a warning naming it is logged, and serving continues:

```text
Warning: [storage] S3 bucket "my-app-files" did not answer a reachability probe: …
```

Nothing is papered over. A request that never touches storage is served normally, and the first one that does fails closed with a `500` and a storage error code — never a silent success.

Treat that warning as the line to alert on. It is the earliest notice you get, and it arrives at startup rather than at whatever hour the first upload does.

## Signing differs, invisibly

An object store exposes native presigning, so signed URLs there delegate to the provider. Local files and database bytes have no such primitive, so Sovrium signs and verifies its own tokens against its own route.

The difference is invisible to callers: the same request produces the same shape of URL on all three. A URL minted on one backend is never portable to another.
