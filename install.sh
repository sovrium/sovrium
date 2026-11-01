#!/bin/sh
# Sovrium Install Script
#
# Usage:
#   curl -fsSL https://sovrium.com/install | sh
#   curl -fsSL https://sovrium.com/install | sh -s -- --version 0.3.0
#   SOVRIUM_INSTALL_DIR=/usr/local curl -fsSL https://sovrium.com/install | sh
#
# Options:
#   --no-modify-path          Don't add Sovrium to your shell PATH
#   --version X.Y.Z           Install a specific version (default: latest)
#   --allow-unsigned          Install on the checksum alone when the release
#                             signature CANNOT be checked here (no Ed25519
#                             verifier, or a version older than signing).
#                             A signature that is checked and fails still
#                             stops the install. Prints a warning.
#   --insecure-skip-checksum  Install WITHOUT verifying the published sha256
#                             nor the release signature (not recommended;
#                             prints a warning)
#
# Every download is HTTPS-only (TLS 1.2+), and the archive is installed only
# when its published sha256 can be fetched AND matches. A missing, unreadable
# or mismatching checksum stops the install with nothing written. The archive's
# detached Ed25519 signature (`<archive>.sig`) is then checked against the
# release keys below: a missing or invalid signature stops the install too.
#
# The verifier is an OpenSSL that can verify Ed25519, or else the system Perl
# (core modules only: Math::BigInt, Digest::SHA, MIME::Base64), which is what
# stock macOS offers, since its `openssl` is LibreSSL and cannot. Each is
# proved against an RFC 8032 test vector before it is trusted. With neither,
# the install STOPS and prints the command to verify by hand, unless
# --allow-unsigned is passed.
#
# Environment variables:
#   SOVRIUM_INSTALL_DIR   Custom install PREFIX (default: ~/.sovrium). The
#                         binary lands in $SOVRIUM_INSTALL_DIR/bin, so pass
#                         /usr/local — not /usr/local/bin — to install to
#                         /usr/local/bin/sovrium.

set -eu

# ─── Terminal language ────────────────────────────────────────
#
# The six renderers that make this script obey the same standard as the
# TypeScript CLI. See docs/architecture/patterns/terminal-language.md §11.
# `printf`, never `echo` — echo mangles backslashes and leading `-` under dash.
# Glyphs are literal UTF-8 passed as `%s` arguments: dash's printf has no `\x`
# escapes, so a hex-escaped glyph printed as `\xe2\x80\xa6` on Debian and Ubuntu.

say()  { printf '  %s\n' "$1"; }              # banner prose / guidance
ok()   { printf '  %s %s\n' '✓' "$1"; }        # banner phase
warn() { printf '  %s %s\n' '⚠' "$1"; }        # banner degradation
step() { printf '%s%s\n' "$1" '…' >&2; }       # stream narration -> stderr
die()  {
  printf 'Error: %s\n' "$1" >&2
  [ -n "${2:-}" ] && printf '\n%s\n' "$2" >&2
  exit 1
}

# Degradations discovered mid-stream are collected, not printed where they
# happen, so a warning cannot scroll away above 500 lines of tar output. The
# closing banner renders them.
CHECKSUM_WARNING=""
SIGNATURE_WARNING=""
PATH_UPDATED=""

# ─── Configuration ────────────────────────────────────────────

GITHUB_REPO="sovrium/sovrium"

# The public halves of the Ed25519 keys that sign release archives, as the
# base64 body of a PEM `PUBLIC KEY` (SPKI DER). One per line; a rotation adds
# the next key beside the current one. These MUST be the keys of
# EMBEDDED_RELEASE_SIGNING_KEYS in src/domain/kernel/identity/release-signature.ts,
# which `sovrium update` trusts; a unit test there holds the two lists equal.
RELEASE_SIGNING_KEYS="MCowBQYDK2VwAyEAuzZiNLZgfcvphKt/migBwIh4zENL2YNZE0FWTeJaLFY="

# The first release whose archives carry a `.sig`. An older version asked for
# with --version has none to check, so it is refused unless --allow-unsigned
# is passed; it then installs on its checksum alone and the closing banner
# says so.
FIRST_SIGNED_VERSION="0.33.0"
INSTALL_DIR="${SOVRIUM_INSTALL_DIR:-$HOME/.sovrium}"
BIN_DIR="$INSTALL_DIR/bin"

# ─── Parse arguments ─────────────────────────────────────────

MODIFY_PATH=1
VERSION=""
SKIP_CHECKSUM=0
ALLOW_UNSIGNED=0

while [ $# -gt 0 ]; do
  case "$1" in
    --no-modify-path) MODIFY_PATH=0 ;;
    --version)
      shift
      VERSION="$1"
      ;;
    --version=*) VERSION="${1#--version=}" ;;
    --insecure-skip-checksum) SKIP_CHECKSUM=1 ;;
    --allow-unsigned) ALLOW_UNSIGNED=1 ;;
    --help|-h)
      printf '%s\n' "Usage: curl -fsSL https://sovrium.com/install | sh"
      printf '\n%s\n' "Install the Sovrium binary and add it to your PATH."
      printf '\n%s\n' "Options:"
      printf '%s\n' "  --no-modify-path              Leave your shell rc files alone"
      printf '%s\n' "  --version X.Y.Z               Install a specific version (default: latest)"
      printf '%s\n' "  --allow-unsigned              Install on the checksum alone when the signature cannot be checked here"
      printf '%s\n' "  --insecure-skip-checksum      Install without verifying the sha256 or signature (not recommended)"
      printf '%s\n' "  --help, -h                    Show this help message"
      printf '\n%s\n' "Environment variables:"
      printf '%s\n' "  SOVRIUM_INSTALL_DIR           Install prefix (default: ~/.sovrium)"
      printf '\n%s\n' "Examples:"
      printf '%s\n' "  curl -fsSL https://sovrium.com/install | sh"
      printf '%s\n' "  curl -fsSL https://sovrium.com/install | sh -s -- --version 0.21.0"
      exit 0
      ;;
    *)
      die "Unknown option \"$1\"." "Run with --help to list the accepted options."
      ;;
  esac
  shift
done

# ─── Download helper (curl or wget) ──────────────────────────

# Every request is HTTPS-only, redirects included: curl refuses any other
# protocol and anything below TLS 1.2, and wget runs with --https-only. A wget
# that cannot honour --https-only (BusyBox) is refused rather than trusted.
#
# fetch <url> <dest> ; <dest> "-" writes to stdout. Returns non-zero on
# failure (no exit, caller decides).
fetch() {
  if command -v curl >/dev/null 2>&1; then
    curl --proto '=https' --tlsv1.2 -fsSL "$1" -o "$2" && return 0
  elif command -v wget >/dev/null 2>&1; then
    if ! wget --help 2>&1 | grep -q -- '--https-only'; then
      die "This wget cannot be restricted to HTTPS." \
"Install curl (or GNU wget), then re-run this script."
    fi
    wget --https-only -q "$1" -O "$2" && return 0
  else
    die "Neither curl nor wget is available." "Install one of them, then re-run this script."
  fi
  return 1
}

# download <url> <dest>
download() {
  fetch "$1" "$2"
}

# ─── Detect platform ─────────────────────────────────────────

detect_platform() {
  OS=$(uname -s)
  ARCH=$(uname -m)

  case "$OS" in
    Darwin) OS="darwin" ;;
    Linux) OS="linux" ;;
    MINGW*|MSYS*|CYGWIN*)
      die "This script does not support Windows." \
"Install with Scoop:
  scoop bucket add sovrium https://github.com/sovrium/scoop-bucket
  scoop install sovrium

Or download the Windows binary from
  https://github.com/$GITHUB_REPO/releases/latest"
      ;;
    *)
      die "Unsupported operating system: $OS" \
"Sovrium ships binaries for macOS and Linux. See
  https://github.com/$GITHUB_REPO/releases"
      ;;
  esac

  case "$ARCH" in
    x86_64|amd64) ARCH="x64" ;;
    aarch64|arm64) ARCH="arm64" ;;
    *)
      die "Unsupported architecture: $ARCH" \
"Sovrium ships x86_64 and arm64 builds. See
  https://github.com/$GITHUB_REPO/releases"
      ;;
  esac

  TARGET="${OS}-${ARCH}"
}

# ─── Fetch latest version ────────────────────────────────────

fetch_latest_version() {
  if [ -n "$VERSION" ]; then
    return
  fi

  step "Fetching the latest version"

  VERSION=$(fetch "https://api.github.com/repos/$GITHUB_REPO/releases/latest" - | grep '"tag_name"' | sed -E 's/.*"v([^"]+)".*/\1/') || VERSION=""

  if [ -z "$VERSION" ]; then
    die "Could not resolve the latest version from the GitHub API." \
"Pass one explicitly with --version X.Y.Z. Released versions:
  https://github.com/$GITHUB_REPO/releases"
  fi
}

# ─── Download and verify ─────────────────────────────────────

# Every release since v0.4.10 publishes sovrium-<version>-<target>.sha256 next
# to its archive, so an absent or unreadable one is a fault to stop on, never a
# reason to install unverified. The only way past it is the explicit
# --insecure-skip-checksum flag, which is announced on stderr and repeated in
# the closing banner.
CHECKSUM_REPORT="If this keeps happening, do not install by hand: report it to
security@sovrium.com (or https://github.com/$GITHUB_REPO/issues), quoting the
version and platform above. The checksum and the release signature protect
you from a corrupted or tampered download."

verify_checksum() {
  if [ "$SKIP_CHECKSUM" -eq 1 ]; then
    CHECKSUM_WARNING="Checksum and signature NOT verified — installed with --insecure-skip-checksum"
    return
  fi

  CHECKSUM_FETCHED=0
  download "$CHECKSUM_URL" "$TEMP_DIR/$CHECKSUM_FILE" && [ -s "$TEMP_DIR/$CHECKSUM_FILE" ] && CHECKSUM_FETCHED=1
  if [ "$CHECKSUM_FETCHED" -eq 0 ]; then
    die "Could not fetch the published checksum for ${ARCHIVE}. Nothing was installed." \
"  ${CHECKSUM_URL}

Re-run this script. ${CHECKSUM_REPORT}

To install without verification anyway (not recommended), re-run with
  --insecure-skip-checksum"
  fi

  EXPECTED=$(awk '{ print $1; exit }' "$TEMP_DIR/$CHECKSUM_FILE")
  case "$EXPECTED" in
    *[!0-9a-fA-F]*|"") EXPECTED="" ;;
  esac
  if [ "${#EXPECTED}" -ne 64 ]; then
    die "The published checksum for ${ARCHIVE} is unreadable. Nothing was installed." \
"  ${CHECKSUM_URL}

${CHECKSUM_REPORT}"
  fi

  step "Verifying the checksum"
  if command -v sha256sum >/dev/null 2>&1; then
    ACTUAL=$(sha256sum "$TEMP_DIR/$ARCHIVE" | awk '{ print $1 }')
  elif command -v shasum >/dev/null 2>&1; then
    ACTUAL=$(shasum -a 256 "$TEMP_DIR/$ARCHIVE" | awk '{ print $1 }')
  else
    die "Cannot verify the download: neither sha256sum nor shasum is available. Nothing was installed." \
"Install one of them (coreutils or perl), then re-run this script."
  fi

  if [ "$(printf '%s' "$EXPECTED" | tr 'A-F' 'a-f')" != "$ACTUAL" ]; then
    die "Checksum does not match the published sha256. Nothing was installed." \
"The download may be corrupt or tampered with. Re-run this script.
${CHECKSUM_REPORT}"
  fi
}

# ─── Release signature ───────────────────────────────────────

# version_before <a> <b> : true when version a sorts before version b.
version_before() {
  awk -v a="$1" -v b="$2" 'BEGIN {
    split(a, x, /[.-]/); split(b, y, /[.-]/)
    for (i = 1; i <= 3; i++) {
      if (x[i] + 0 < y[i] + 0) exit 0
      if (x[i] + 0 > y[i] + 0) exit 1
    }
    exit 1
  }'
}

# write_public_key <spki-base64> <dest> : a PEM public key from its body.
write_public_key() {
  printf '%s\n' '-----BEGIN PUBLIC KEY-----' "$1" '-----END PUBLIC KEY-----' > "$2"
}

# The RFC 8032 test 2 vector every verifier must pass before it is trusted:
# the signature of the one-byte message `r`, which must verify, and must NOT
# verify over `s`.
PROBE_KEY="MCowBQYDK2VwAyEAPUAXw+hDiVqStwqnTRt+vJyYLM8uxJaMwM1V8Sr0Zgw="
PROBE_SIGNATURE="kqAJqfDUyrhyDoILX2QlQKKye1QWUD+Ps3YiI+vbadoIWsHkPhWZbkWPNhPQ8R2MOHsurrQwKu6wDSkWErsMAA=="

# write_perl_verifier <dest> : an Ed25519 verifier (RFC 8032, section 5.1.7)
# for the system Perl, using core modules only. Arguments: the key as an SPKI
# base64 body, a file holding the base64 signature, the message file. Exit 0
# when the signature verifies, 1 when it does not, 2 on an unusable key.
# Rejects a non-canonical S (S >= L) and a point that does not decode.
write_perl_verifier() {
  cat > "$1" <<'PERL'
use strict;
use warnings;
use Math::BigInt try => 'GMP,LTM';
use Digest::SHA;
use MIME::Base64 qw(decode_base64);
my ($spki, $sigfile, $msgfile) = @ARGV;
exit 2 unless defined $msgfile && -f $sigfile && -f $msgfile;
my $der = decode_base64($spki);
exit 2 unless length($der) == 44
  && unpack('H*', substr($der, 0, 12)) eq '302a300506032b6570032100';
my $pk = substr($der, 12);
open(my $sfh, '<', $sigfile) or exit 2;
local $/;
my $sigtext = <$sfh>;
close($sfh);
$sigtext =~ s/\s+//g;
exit 1 unless $sigtext =~ m{\A[A-Za-z0-9+/]+={0,2}\z};
my $sig = decode_base64($sigtext);
exit 1 unless length($sig) == 64;
my $P = Math::BigInt->new(2)->bpow(255)->bsub(19);
my $L = Math::BigInt->new(2)->bpow(252)->badd(Math::BigInt->new('27742317777372353535851937790883648493'));
sub md { my $v = $_[0] % $P; return $v; }
sub inv { return $_[0]->copy->bmodpow($P - 2, $P); }
my $D = md(Math::BigInt->new(-121665) * inv(Math::BigInt->new(121666)));
my $D2 = md($D * 2);
my $I = Math::BigInt->new(2)->bmodpow(($P - 1) / 4, $P);
sub le2int { return Math::BigInt->new('0x' . unpack('H*', scalar reverse $_[0])); }
sub add {
  my ($p, $q) = @_;
  my $a = md(($p->[1] - $p->[0]) * ($q->[1] - $q->[0]));
  my $b = md(($p->[1] + $p->[0]) * ($q->[1] + $q->[0]));
  my $c = md($p->[3] * $D2 * $q->[3]);
  my $d = md($p->[2] * 2 * $q->[2]);
  my ($e, $f, $g, $h) = ($b - $a, $d - $c, $d + $c, $b + $a);
  return [md($e * $f), md($g * $h), md($f * $g), md($e * $h)];
}
sub mul {
  my ($s, $p) = @_;
  my $q = [Math::BigInt->new(0), Math::BigInt->new(1), Math::BigInt->new(1), Math::BigInt->new(0)];
  my $bits = $s->as_bin;
  $bits =~ s/^0b//;
  for my $bit (split //, $bits) {
    $q = add($q, $q);
    $q = add($q, $p) if $bit eq '1';
  }
  return $q;
}
sub recover_x {
  my ($y, $sign) = @_;
  return undef if $y >= $P;
  my $y2 = md($y * $y);
  my $x2 = md(($y2 - 1) * inv(md($D * $y2 + 1)));
  if ($x2->is_zero) { return $sign ? undef : Math::BigInt->new(0); }
  my $x = $x2->copy->bmodpow(($P + 3) / 8, $P);
  $x = md($x * $I) unless md($x * $x - $x2)->is_zero;
  return undef unless md($x * $x - $x2)->is_zero;
  $x = $P - $x if ($x->is_odd ? 1 : 0) != $sign;
  return $x;
}
sub decompress {
  my $n = le2int($_[0]);
  my $sign = $n->copy->brsft(255)->is_zero ? 0 : 1;
  my $y = $n->copy->band(Math::BigInt->new(2)->bpow(255)->bsub(1));
  my $x = recover_x($y, $sign);
  return undef unless defined $x;
  return [$x, $y, Math::BigInt->new(1), md($x * $y)];
}
sub equal {
  my ($p, $q) = @_;
  return md($p->[0] * $q->[2] - $q->[0] * $p->[2])->is_zero
    && md($p->[1] * $q->[2] - $q->[1] * $p->[2])->is_zero;
}
my $by = md(Math::BigInt->new(4) * inv(Math::BigInt->new(5)));
my $bx = recover_x($by, 0);
my $B = [$bx, $by, Math::BigInt->new(1), md($bx * $by)];
my $A = decompress($pk);
exit 1 unless defined $A;
my $rs = substr($sig, 0, 32);
my $R = decompress($rs);
exit 1 unless defined $R;
my $s = le2int(substr($sig, 32));
exit 1 unless $s < $L;
my $sha = Digest::SHA->new(512);
$sha->add($rs, $pk);
$sha->addfile($msgfile, 'b');
my $h = le2int($sha->digest) % $L;
exit(equal(mul($s, $B), add($R, mul($h, $A))) ? 0 : 1);
PERL
}

# verify_with <verifier> <spki-base64> <signature-base64-file> <message-file>
# : true when <verifier> ("openssl:<path>" or "perl:<path>") accepts the
# signature. Each call writes its own key and decoded signature files.
verify_with() {
  case "$1" in
    openssl:*)
      VERIFY_OPENSSL="${1#openssl:}"
      write_public_key "$2" "$3.pem"
      tr -d ' \t\r\n' < "$3" > "$3.b64"
      "$VERIFY_OPENSSL" base64 -d -A -in "$3.b64" -out "$3.bin" >/dev/null 2>&1 || return 1
      [ "$(wc -c < "$3.bin" | tr -d ' ')" = "64" ] || return 1
      "$VERIFY_OPENSSL" pkeyutl -verify -pubin -inkey "$3.pem" -rawin \
        -in "$4" -sigfile "$3.bin" >/dev/null 2>&1
      ;;
    perl:*)
      "${1#perl:}" "$TEMP_DIR/ed25519.pl" "$2" "$3" "$4" >/dev/null 2>&1
      ;;
    *) return 1 ;;
  esac
}

# find_ed25519_verifier : sets VERIFIER to a verifier this machine can run, or
# "". Capability is PROVEN, not guessed from a version string: each candidate
# must accept RFC 8032's test 2 vector and reject the same signature over other
# bytes. LibreSSL (stock macOS) and OpenSSL 1.1 fail the first half; a broken
# build that accepts anything fails the second. An OpenSSL is preferred; the
# system Perl is the verifier stock macOS always has.
find_ed25519_verifier() {
  VERIFIER=""
  PROBE_DIR="$TEMP_DIR/ed25519-probe"
  mkdir -p "$PROBE_DIR"
  printf '%s' "$PROBE_SIGNATURE" > "$PROBE_DIR/sig.b64"
  printf 'r' > "$PROBE_DIR/good"
  printf 's' > "$PROBE_DIR/bad"
  write_perl_verifier "$TEMP_DIR/ed25519.pl"
  for CANDIDATE in \
    openssl:openssl \
    openssl:/opt/homebrew/opt/openssl@3/bin/openssl \
    openssl:/usr/local/opt/openssl@3/bin/openssl \
    perl:/usr/bin/perl \
    perl:perl; do
    command -v "${CANDIDATE#*:}" >/dev/null 2>&1 || continue
    verify_with "$CANDIDATE" "$PROBE_KEY" "$PROBE_DIR/sig.b64" "$PROBE_DIR/good" || continue
    if verify_with "$CANDIDATE" "$PROBE_KEY" "$PROBE_DIR/sig.b64" "$PROBE_DIR/bad"; then
      continue
    fi
    VERIFIER="$CANDIDATE"
    return
  done
}

# The command a person can run to check the signature by hand, with any
# OpenSSL 3, printed when this machine has no verifier.
manual_verification() {
  MANUAL_KEY=""
  for KEY in $RELEASE_SIGNING_KEYS; do MANUAL_KEY="$KEY"; break; done
  printf '%s\n' \
"Install OpenSSL 3 (macOS: brew install openssl@3; Debian or Ubuntu:
sudo apt install openssl), then re-run this script. Or check the signature by
hand with any OpenSSL 3, and install only if it prints \"Signature Verified
Successfully\":

  curl -fsSLO ${URL}
  curl -fsSLO ${URL}.sig
  printf '%s\\n' '-----BEGIN PUBLIC KEY-----' '${MANUAL_KEY}' '-----END PUBLIC KEY-----' > sovrium-release.pem
  openssl base64 -d -A -in ${ARCHIVE}.sig -out ${ARCHIVE}.sig.bin
  openssl pkeyutl -verify -pubin -inkey sovrium-release.pem -rawin -in ${ARCHIVE} -sigfile ${ARCHIVE}.sig.bin

To install on the checksum alone, without the signature check (not
recommended), re-run with --allow-unsigned"
}

# Runs AFTER the checksum, which has already proved the bytes are the ones the
# release page lists. The signature proves who built them: the release page
# can be edited, the keys above cannot be from there.
verify_signature() {
  if [ "$SKIP_CHECKSUM" -eq 1 ]; then
    return
  fi

  if version_before "$VERSION" "$FIRST_SIGNED_VERSION"; then
    if [ "$ALLOW_UNSIGNED" -eq 1 ]; then
      SIGNATURE_WARNING="Signature not checked: v${VERSION} predates release signing (v${FIRST_SIGNED_VERSION}); installed on its checksum with --allow-unsigned"
      return
    fi
    die "v${VERSION} predates release signatures (v${FIRST_SIGNED_VERSION}), so who built it cannot be checked. Nothing was installed." \
"Install v${FIRST_SIGNED_VERSION} or later, or the latest version (omit --version).
To install v${VERSION} on its checksum alone (not recommended), re-run with
  --allow-unsigned"
  fi

  SIGNATURE_FILE="${ARCHIVE}.sig"
  SIGNATURE_URL="${URL}.sig"
  SIGNATURE_FETCHED=0
  download "$SIGNATURE_URL" "$TEMP_DIR/$SIGNATURE_FILE" && [ -s "$TEMP_DIR/$SIGNATURE_FILE" ] && SIGNATURE_FETCHED=1
  if [ "$SIGNATURE_FETCHED" -eq 0 ]; then
    die "Signature check failed: could not fetch the published signature for ${ARCHIVE}. Nothing was installed." \
"  ${SIGNATURE_URL}

Re-run this script. ${CHECKSUM_REPORT}

To install without verification anyway (not recommended), re-run with
  --insecure-skip-checksum"
  fi

  find_ed25519_verifier
  if [ -z "$VERIFIER" ]; then
    if [ "$ALLOW_UNSIGNED" -eq 1 ]; then
      SIGNATURE_WARNING="Signature not checked: no Ed25519 verifier found (OpenSSL 3 or Perl); installed on its checksum with --allow-unsigned"
      return
    fi
    die "Cannot check the release signature: this machine has no Ed25519 verifier (OpenSSL 3, or Perl with its core modules). Nothing was installed." \
"$(manual_verification)"
  fi

  step "Verifying the release signature"
  for KEY in $RELEASE_SIGNING_KEYS; do
    if verify_with "$VERIFIER" "$KEY" "$TEMP_DIR/$SIGNATURE_FILE" "$TEMP_DIR/$ARCHIVE"; then
      return
    fi
  done

  die "Signature check failed: ${ARCHIVE} is not signed by a trusted Sovrium release key. Nothing was installed." \
"The download may be tampered with. Re-run this script.
${CHECKSUM_REPORT}"
}

download_and_install() {
  ARCHIVE="sovrium-${VERSION}-${TARGET}.tar.gz"
  CHECKSUM_FILE="sovrium-${VERSION}-${TARGET}.sha256"
  URL="https://github.com/$GITHUB_REPO/releases/download/v${VERSION}/${ARCHIVE}"
  CHECKSUM_URL="https://github.com/$GITHUB_REPO/releases/download/v${VERSION}/${CHECKSUM_FILE}"

  TEMP_DIR=$(mktemp -d)
  STAGED=""
  # One EXIT trap for everything this run leaves behind: a second `trap ... EXIT`
  # would REPLACE this one, not add to it.
  trap 'rm -rf "$TEMP_DIR"; if [ -n "$STAGED" ]; then rm -f "$STAGED"; fi' EXIT

  step "Downloading sovrium v${VERSION} for ${TARGET}"

  if ! download "$URL" "$TEMP_DIR/$ARCHIVE"; then
    die "Could not download ${ARCHIVE}. Nothing was installed." \
"Version ${VERSION} may have no ${TARGET} build yet.
  ${URL}
  https://github.com/$GITHUB_REPO/releases"
  fi
  verify_checksum
  verify_signature

  # Extract
  step "Extracting"
  tar xzf "$TEMP_DIR/$ARCHIVE" -C "$TEMP_DIR"

  # Resolve the binary defensively: current releases ship the bare `sovrium`,
  # but older Linux tarballs carried a platform-suffixed name.
  if [ -f "$TEMP_DIR/sovrium" ]; then
    BINARY="$TEMP_DIR/sovrium"
  elif [ -f "$TEMP_DIR/sovrium-${TARGET}" ]; then
    BINARY="$TEMP_DIR/sovrium-${TARGET}"
  else
    die "The archive for v${VERSION}/${TARGET} contains no sovrium binary." \
"This is a packaging fault, not a configuration error. Report it at
  https://github.com/$GITHUB_REPO/issues" 
  fi

  # Install: stage the new binary beside the old one, then rename it into place.
  # Copying straight onto "$BIN_DIR/sovrium" would rewrite the file a running
  # sovrium is executing from: Linux refuses that with "Text file busy", and
  # macOS kills the next launch of a binary whose signed pages changed under it.
  # A rename swaps the directory entry instead; the running process keeps the
  # old inode until it exits. Same directory, so the rename never crosses a
  # filesystem. `sovrium update` replaces itself the same way.
  mkdir -p "$BIN_DIR"
  STAGED="$BIN_DIR/.sovrium-install-$$"
  cp "$BINARY" "$STAGED" || die "Could not write to ${BIN_DIR}. Nothing was installed." \
"Check that you can write to it, or choose another directory:
  curl -fsSL https://sovrium.com/install | SOVRIUM_INSTALL_DIR=\$HOME/.local sh"
  chmod 755 "$STAGED"

  # Remove the macOS quarantine attribute on the STAGED copy, before it
  # becomes the binary anyone can launch.
  if [ "$OS" = "darwin" ] && command -v xattr >/dev/null 2>&1; then
    xattr -d com.apple.quarantine "$STAGED" 2>/dev/null || true
  fi

  mv -f "$STAGED" "$BIN_DIR/sovrium" || die "Could not put the binary in place in ${BIN_DIR}." \
"The previous sovrium, if any, is unchanged."
  STAGED=""

}

# ─── Update PATH ─────────────────────────────────────────────

update_path() {
  if [ "$MODIFY_PATH" -eq 0 ]; then
    return
  fi

  # Check if already in PATH
  case ":$PATH:" in
    *":$BIN_DIR:"*) return ;;
  esac

  EXPORT_LINE="export PATH=\"$BIN_DIR:\$PATH\""

  # Detect shell and rc file
  SHELL_NAME=$(basename "${SHELL:-/bin/sh}")
  case "$SHELL_NAME" in
    zsh)
      RC_FILE="$HOME/.zshrc"
      ;;
    bash)
      if [ -f "$HOME/.bashrc" ]; then
        RC_FILE="$HOME/.bashrc"
      else
        RC_FILE="$HOME/.bash_profile"
      fi
      ;;
    fish)
      RC_FILE="$HOME/.config/fish/config.fish"
      EXPORT_LINE="set -gx PATH $BIN_DIR \$PATH"
      ;;
    *)
      RC_FILE="$HOME/.profile"
      ;;
  esac

  # Check if already added
  if [ -f "$RC_FILE" ] && grep -q "$BIN_DIR" "$RC_FILE" 2>/dev/null; then
    return
  fi

  {
    echo ""
    echo "# Sovrium"
    echo "$EXPORT_LINE"
  } >> "$RC_FILE"

  PATH_UPDATED="$RC_FILE"
}

# ─── Main ─────────────────────────────────────────────────────

main() {
  # The opt-out is announced BEFORE any download, on stderr, so it cannot be
  # missed in a log or mistaken for a normal install.
  if [ "$SKIP_CHECKSUM" -eq 1 ]; then
    printf '%s\n' "Warning: --insecure-skip-checksum is set. The download will NOT be verified against its published sha256 nor its release signature." >&2
  fi

  # Nothing opens the script. A user who just typed the curl one-liner has it on
  # screen; "Sovrium Installer" over a rule restates it and then makes them wait.
  # The first real line reports work starting, sooner and with information.
  detect_platform
  fetch_latest_version
  download_and_install
  update_path

  # The closing banner is the same block `sovrium start` and `sovrium build`
  # render: version header, grouped degradations, grouped phases, guidance. The
  # version lives here because this is the first point the script knows it.
  printf '\n'
  say "Sovrium v${VERSION}"

  if [ -n "$CHECKSUM_WARNING" ] || [ -n "$SIGNATURE_WARNING" ]; then
    printf '\n'
    if [ -n "$CHECKSUM_WARNING" ]; then warn "$CHECKSUM_WARNING"; fi
    if [ -n "$SIGNATURE_WARNING" ]; then warn "$SIGNATURE_WARNING"; fi
  fi

  printf '\n'
  ok "Installed to $BIN_DIR/sovrium"
  [ -n "$PATH_UPDATED" ] && ok "PATH updated in $PATH_UPDATED"

  printf '\n'
  if [ "$MODIFY_PATH" -eq 1 ] && [ -n "$PATH_UPDATED" ]; then
    say "Restart your shell, then run 'sovrium init --template hello-world'."
  else
    say "Run 'sovrium init --template hello-world' to create your first app."
  fi
  printf '\n'
}

main
