#!/bin/sh
# Sovrium Install Script
#
# Usage:
#   curl -fsSL https://sovrium.com/install | sh
#   curl -fsSL https://sovrium.com/install | sh -s -- --version 0.3.0
#   SOVRIUM_INSTALL_DIR=/usr/local curl -fsSL https://sovrium.com/install | sh
#
# Options:
#   --no-modify-path    Don't add Sovrium to your shell PATH
#   --version X.Y.Z     Install a specific version (default: latest)
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

say()  { printf '  %s\n' "$1"; }              # banner prose / guidance
ok()   { printf '  \xe2\x9c\x93 %s\n' "$1"; }        # banner phase
warn() { printf '  \xe2\x9a\xa0 %s\n' "$1"; }        # banner degradation
step() { printf '%s\xe2\x80\xa6\n' "$1" >&2; }       # stream narration -> stderr
die()  {
  printf 'Error: %s\n' "$1" >&2
  [ -n "${2:-}" ] && printf '\n%s\n' "$2" >&2
  exit 1
}

# Degradations discovered mid-stream are collected, not printed where they
# happen, so a warning cannot scroll away above 500 lines of tar output. The
# closing banner renders them.
CHECKSUM_WARNING=""
PATH_UPDATED=""

# ─── Configuration ────────────────────────────────────────────

GITHUB_REPO="sovrium/sovrium"
INSTALL_DIR="${SOVRIUM_INSTALL_DIR:-$HOME/.sovrium}"
BIN_DIR="$INSTALL_DIR/bin"

# ─── Parse arguments ─────────────────────────────────────────

MODIFY_PATH=1
VERSION=""

while [ $# -gt 0 ]; do
  case "$1" in
    --no-modify-path) MODIFY_PATH=0 ;;
    --version)
      shift
      VERSION="$1"
      ;;
    --version=*) VERSION="${1#--version=}" ;;
    --help|-h)
      printf '%s\n' "Usage: curl -fsSL https://sovrium.com/install | sh"
      printf '\n%s\n' "Install the Sovrium binary and add it to your PATH."
      printf '\n%s\n' "Options:"
      printf '%s\n' "  --no-modify-path              Leave your shell rc files alone"
      printf '%s\n' "  --version X.Y.Z               Install a specific version (default: latest)"
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

# download <url> <dest> ; returns non-zero on failure (no exit, caller decides)
download() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$1" -o "$2" && return 0
  elif command -v wget >/dev/null 2>&1; then
    wget -q "$1" -O "$2" && return 0
  else
    die "Neither curl nor wget is available." "Install one of them, then re-run this script." 
  fi
  return 1
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

  if command -v curl >/dev/null 2>&1; then
    VERSION=$(curl -fsSL "https://api.github.com/repos/$GITHUB_REPO/releases/latest" | grep '"tag_name"' | sed -E 's/.*"v([^"]+)".*/\1/')
  elif command -v wget >/dev/null 2>&1; then
    VERSION=$(wget -qO- "https://api.github.com/repos/$GITHUB_REPO/releases/latest" | grep '"tag_name"' | sed -E 's/.*"v([^"]+)".*/\1/')
  else
    die "Neither curl nor wget is available." "Install one of them, then re-run this script."
  fi

  if [ -z "$VERSION" ]; then
    die "Could not resolve the latest version from the GitHub API." \
"Pass one explicitly with --version X.Y.Z. Released versions:
  https://github.com/$GITHUB_REPO/releases"
  fi
}

# ─── Download and verify ─────────────────────────────────────

download_and_install() {
  ARCHIVE="sovrium-${VERSION}-${TARGET}.tar.gz"
  CHECKSUM_FILE="sovrium-${VERSION}-${TARGET}.sha256"
  URL="https://github.com/$GITHUB_REPO/releases/download/v${VERSION}/${ARCHIVE}"
  CHECKSUM_URL="https://github.com/$GITHUB_REPO/releases/download/v${VERSION}/${CHECKSUM_FILE}"

  TEMP_DIR=$(mktemp -d)
  trap 'rm -rf "$TEMP_DIR"' EXIT

  step "Downloading sovrium v${VERSION} for ${TARGET}"

  if ! download "$URL" "$TEMP_DIR/$ARCHIVE"; then
    die "Could not download ${ARCHIVE}. Nothing was installed." \
"Version ${VERSION} may have no ${TARGET} build yet.
  ${URL}
  https://github.com/$GITHUB_REPO/releases"
  fi
  # Checksum file is best-effort — verification is skipped if absent.
  download "$CHECKSUM_URL" "$TEMP_DIR/$CHECKSUM_FILE" 2>/dev/null || true

  # Verify checksum if available
  if [ -f "$TEMP_DIR/$CHECKSUM_FILE" ] && [ -s "$TEMP_DIR/$CHECKSUM_FILE" ]; then
    step "Verifying the checksum"
    cd "$TEMP_DIR"
    if command -v sha256sum >/dev/null 2>&1; then
      sha256sum -c "$CHECKSUM_FILE" --quiet 2>/dev/null || {
        die "Checksum does not match the published sha256. Nothing was installed." \
"The download may be corrupt or tampered with. Re-run this script; if it fails
again, report it at https://github.com/$GITHUB_REPO/issues"
      }
    elif command -v shasum >/dev/null 2>&1; then
      shasum -a 256 -c "$CHECKSUM_FILE" --quiet 2>/dev/null || {
        die "Checksum does not match the published sha256. Nothing was installed." \
"The download may be corrupt or tampered with. Re-run this script; if it fails
again, report it at https://github.com/$GITHUB_REPO/issues"
      }
    else
      CHECKSUM_WARNING="Checksum not verified \xe2\x80\x94 no sha256sum or shasum on this system"
    fi
    cd - >/dev/null
  else
    CHECKSUM_WARNING="Checksum not published for this build \xe2\x80\x94 installed without verification"
  fi

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

  # Install
  mkdir -p "$BIN_DIR"
  cp "$BINARY" "$BIN_DIR/sovrium"
  chmod 755 "$BIN_DIR/sovrium"

  # Remove macOS quarantine attribute if present
  if [ "$OS" = "darwin" ] && command -v xattr >/dev/null 2>&1; then
    xattr -d com.apple.quarantine "$BIN_DIR/sovrium" 2>/dev/null || true
  fi

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

  if [ -n "$CHECKSUM_WARNING" ]; then
    printf '\n'
    warn "$(printf '%b' "$CHECKSUM_WARNING")"
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
