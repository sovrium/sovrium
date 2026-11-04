# Verifying a Signing Export

> Check the evidence of a signing request with no server, no database and no network: every file, every event of the chain, the document each signer signed, and the seal and timestamp when there are any.

```text
Usage: sovrium signature verify <export> [--json]
```

An administrator downloads the export of a signing request from `GET /api/signatures/requests/<id>/export`. It is one JSON document: the evidence file (`evidence.json`, the authoritative record the proof file is printed from) and every file it covers (the frozen document, the signed document, the proof file and each signer's mark), each with its role, its SHA-256 and its bytes in base64. Anyone holding that file can check it with `sovrium signature verify`, on any machine that has the binary. The command reads the file, prints its report and exits; it never contacts the server that produced the export.

## What it checks

The checks run in this order, and each one answers `pass`, `fail`, `absent` or `untrusted`:

1. **manifest**: the file is a signing export of a version this binary reads.
2. **files**: the bytes of every file hash to the SHA-256 recorded beside them, and that SHA-256 is one an event of the chain recorded when the file was written. A file whose bytes and recorded SHA-256 were both replaced still fails.
3. **chain**: the events are numbered 1, 2, 3 and so on, each one links to the hash of the event before it (64 zeros for the first), and each one matches its own hash. The hash of an event is the SHA-256 of its canonical JSON spelling (members sorted by key, no whitespace) of `requestId`, `seq`, `type`, `at`, `signer`, `data` and `prevHash`, so an event or a whole chain cannot pass for another request's. Changing one character of any event, removing one or swapping two fails this check.
4. **document**: the frozen document hashes to the fingerprint the signers signed. A signature given on a record field, which signs a statement and no document, reports `absent`. A request whose events name a document fails when the frozen document is missing.
5. **signatures**: every signing event names a signer of the request, was given on that same fingerprint, and the mark it names is in the export.
6. **seal**: `absent` when the request was not sealed. Otherwise the signed document and the proof file each carry a signature that covers the whole file but the signature itself, verifies over those bytes, and was made with the certificate the log's `sealed` event recorded; at level B-T it also carries a valid timestamp of its own signature.
7. **timestamp**: `absent` when the end of the log was not timestamped. Otherwise the token the `completed` event recorded stamps the hash of an earlier event of the chain, verifies, and was issued by a certificate allowed to stamp time.

A seal or a timestamp whose certificate chain verifies but leads to a root this verifier was not given answers `untrusted`, with the root's name and SHA-256 fingerprint: the cryptography holds, and whether to trust that root is the reader's call, by comparing the fingerprint with the one its owner publishes. The verifier trusts every certificate in `SIGNATURE_SEAL_CERT_CHAIN` when that variable is set where the command runs.

The export is valid when no check fails: each one passes, is absent or is untrusted.

## Personal data and erasure

The evidence never holds a signer's name, address, phone number, network address or browser in clear. Each enters the chain as a salted commitment: the SHA-256 of the datum together with a random salt kept apart from the chain. When a signer's data is erased before the retention ends, the salts and the data are deleted and an `erased` event is appended. The chain still verifies, the report counts the erasure, and the commitments no longer identify anyone. The frozen document, the signed document, the proof file and the marks are kept until the retention the flow declares in `evidence.keep`, and are deleted then.

## What it prints

One line per check, then a summary. `--json` prints the same report as one JSON document instead: `valid`, `requestId`, `events`, `erasures` and `checks`, each check with its `check`, `outcome` and, when it failed, a `detail`.

```text
$ sovrium signature verify contract-ada.json
manifest    pass
files       pass
chain       pass
document    pass
signatures  pass
seal        absent
timestamp   absent

5 events, 0 erasures
Valid: no check failed (each passed, is absent or is untrusted)
```

A copy whose signed document was altered by a single byte fails the files check:

```text
files       fail  signed.pdf does not match its SHA-256
```

## Exit codes

| Code | Meaning                                                                                      |
| ---- | -------------------------------------------------------------------------------------------- |
| `0`  | No check failed.                                                                             |
| `1`  | A check failed, the file is not an export or is larger than 1 GiB, or there is no such file. |
| `2`  | The command line is incomplete: no `verify`, or no export path.                              |

## What it does not prove

The verifier proves that the export is the one the server recorded and that nothing in it changed since. It does not prove who ran the server: someone with full control of a server can rewrite evidence that is not anchored outside it. A timestamp from an independent authority is what anchors the head of the chain. What a signing flow produces is a simple electronic signature with an evidence file.
