# Signing Keys

> The four variables behind a signing flow: the organisation's seal, the timestamp authority that anchors the evidence, and the secret one-time codes come from.

A [signing flow](/en/docs/signing-flows) works with none of these variables set, unless it verifies its signers by code. Each one adds something to what a request produces, and each is a credential or a trust decision of the deployment rather than of the app, which is why none of them is a config key: the same config runs in staging with a test seal and in production with the real one.

| Variable                    | Default | Purpose                                                                                                            |
| --------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------ |
| `SIGNATURE_SEAL_KEY`        | unset   | Private key of the organisation seal, PEM: RSA of 2048 bits or more, or ECDSA on P-256 or P-384                    |
| `SIGNATURE_SEAL_CERT_CHAIN` | unset   | The seal certificate, then each certificate that issued it, PEM. Set with the key, or not at all                   |
| `SIGNATURE_TSA_URL`         | unset   | An RFC 3161 timestamp authority, `http` or `https`. A redirect is refused                                          |
| `SIGNATURE_OTP_SECRET`      | unset   | The secret one-time codes are derived from, at least 32 characters. Required as soon as one flow declares `verify` |

All four are read when the server starts. A value that is not what its row says stops the start with the reason, naming the variable and never its value, and so does setting the seal key without its chain or the chain without its key. Changing one takes effect on the next restart.

## The seal

The seal is the organisation's, not a signer's. It shows that the signed document and the proof file left this server unchanged; who signed, and how, is in the evidence file. With both seal variables set, each of the two files carries one PAdES signature over the whole file, made when the request completes, and the request's status answers `sealed: true`. Without them a request completes all the same, with documents that carry no seal, and the proof file says so.

The server refuses to start when the key is one the seal cannot use: an RSA key under 2048 bits, an RSA-PSS key, an encrypted key, a key on another curve than P-256 or P-384, or a chain whose first certificate is not the certificate of that key. Put the seal certificate first in the chain, then its issuers, each as its own `-----BEGIN CERTIFICATE-----` block.

A seal delivered as a PKCS#12 file (`.p12` or `.pfx`) is converted once with `openssl`, which asks for the file's password:

```bash
openssl pkcs12 -in seal.p12 -nocerts -nodes -out seal-key.pem
openssl pkcs12 -in seal.p12 -nokeys -out seal-chain.pem
```

The first command writes the key without a passphrase, which is what the server reads, so keep `seal-key.pem` where only the server's user can read it, and delete it once its content is in the environment. Then set each variable to the whole content of its file, line breaks included, through your host's environment or a secret store.

**A self-signed certificate shows as untrusted.** A PDF reader checks the seal against the authorities it trusts. A certificate you made yourself, or one issued by your own internal authority, gives a seal whose cryptography holds but which the reader marks as untrusted or of unknown origin; a certificate issued by an authority the reader trusts does not. A self-signed seal still detects any change to the file. Whether to buy a certificate is a question of what your readers' software shows, not of what the evidence proves.

## The timestamp authority

Every event of a request is chained to the one before it. On its own, the chain detects an accidental change, but whoever runs the server could rewrite a whole chain. With `SIGNATURE_TSA_URL` set, the end of the chain is timestamped by that outside authority when the request completes, each seal also carries a timestamp of its own signature, and the status answers `timestamped: true`.

An authority that does not answer, answers with a redirect, or returns a token that does not match the request leaves the request `sealing`, and the server tries again once a minute until it succeeds: with an authority configured, a request never completes without its timestamp. The signers are not held up, since their signatures are already recorded. A request stuck in `sealing` therefore says the authority is unreachable from the server; check the address and the server's outbound access.

## The one-time-code secret

A flow that declares `verify` sends each signer a six-digit code by email or text message before she signs. The codes are derived from `SIGNATURE_OTP_SECRET`, and only a keyed digest of each code is stored. A server whose config declares a flow with `verify` and has no secret refuses to start, naming the flow. Generate a random value of at least 32 characters, for instance:

```bash
openssl rand -hex 32
```

Changing the secret makes every code already sent fail as a wrong code; signers ask for a new one. Keep it out of the config and out of version control, like any other secret.

## Checking an export elsewhere

`sovrium signature verify` checks the seal and the timestamp of an export offline. A seal or a timestamp whose certificates lead to a root the verifier was not given is reported `untrusted` rather than failed, with that root's name and fingerprint. The verifier trusts every certificate in `SIGNATURE_SEAL_CERT_CHAIN` where it runs, so a reader who wants the seal and the timestamp reported as passed sets that variable, for that one command, to the seal chain followed by the timestamp authority's root certificate. See [Verifying a Signing Export](/en/docs/signature-verify).

## What a deployment cannot prove

Someone with full control of a server can rewrite evidence that nothing outside the server anchors. The seal shows the files left the server unchanged, and the timestamp shows the chain existed at a given time; neither shows who ran the server. What a signing flow produces is a simple electronic signature with an evidence file.
