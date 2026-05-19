#!/bin/sh
# install.sh — Install Sovrium standalone binary
#
# Usage:
#   curl -fsSL https://sovrium.com/install.sh | sh
#   curl -fsSL https://sovrium.com/install.sh | sh -s -- --version 0.3.0
#   SOVRIUM_INSTALL_DIR=/usr/local/bin curl -fsSL https://sovrium.com/install.sh | sh
#
# Environment:
#   SOVRIUM_INSTALL_DIR  Install directory (default: ~/.sovrium/bin)

set -eu

GITHUB_REPO="sovrium/sovrium"
INSTALL_DIR="${SOVRIUM_INSTALL_DIR:-$HOME/.sovrium/bin}"
BINARY_NAME="sovrium"
REQUESTED_VERSION=""

# ── Parse arguments ──────────────────────────────────────────

while [ $# -gt 0 ]; do
  case "$1" in
    --version)
      REQUESTED_VERSION="$2"
      shift 2
      ;;
    --help|-h)
      echo "Usage: curl -fsSL https://sovrium.com/install.sh | sh"
      echo ""
      echo "Options:"
      echo "  --version <ver>   Install a specific version (e.g., 0.3.0)"
      echo ""
      echo "Environment:"
      echo "  SOVRIUM_INSTALL_DIR   Install directory (default: ~/.sovrium/bin)"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# ── Detect platform ──────────────────────────────────────────

detect_os() {
  OS=$(uname -s | tr '[:upper:]' '[:lower:]')
  case "$OS" in
    linux)  echo "linux" ;;
    darwin) echo "darwin" ;;
    *)
      echo "Error: Unsupported OS: $OS" >&2
      echo "Sovrium supports Linux and macOS." >&2
      exit 1
      ;;
  esac
}

detect_arch() {
  ARCH=$(uname -m)
  case "$ARCH" in
    x86_64|amd64)   echo "x64" ;;
    aarch64|arm64)   echo "arm64" ;;
    *)
      echo "Error: Unsupported architecture: $ARCH" >&2
      echo "Sovrium supports x64 and arm64." >&2
      exit 1
      ;;
  esac
}

# ── Fetch latest version ────────────────────────────────────

get_latest_version() {
  LATEST=$(curl -fsSL "https://api.github.com/repos/${GITHUB_REPO}/releases/latest" \
    | grep '"tag_name"' \
    | sed 's/.*"v\([^"]*\)".*/\1/')

  if [ -z "$LATEST" ]; then
    echo "Error: Could not determine latest version from GitHub." >&2
    echo "Check https://github.com/${GITHUB_REPO}/releases" >&2
    exit 1
  fi

  echo "$LATEST"
}

# ── Verify checksum ─────────────────────────────────────────

verify_checksum() {
  FILE="$1"
  EXPECTED_HASH="$2"

  if command -v sha256sum > /dev/null 2>&1; then
    ACTUAL_HASH=$(sha256sum "$FILE" | cut -d' ' -f1)
  elif command -v shasum > /dev/null 2>&1; then
    ACTUAL_HASH=$(shasum -a 256 "$FILE" | cut -d' ' -f1)
  else
    echo "Warning: Neither sha256sum nor shasum found. Skipping checksum verification." >&2
    return 0
  fi

  if [ "$ACTUAL_HASH" != "$EXPECTED_HASH" ]; then
    echo "Error: Checksum verification failed!" >&2
    echo "  Expected: $EXPECTED_HASH" >&2
    echo "  Got:      $ACTUAL_HASH" >&2
    echo "" >&2
    echo "The downloaded file may be corrupted. Please try again." >&2
    exit 1
  fi
}

# ── Main ────────────────────────────────────────────────────

OS=$(detect_os)
ARCH=$(detect_arch)
VERSION="${REQUESTED_VERSION:-$(get_latest_version)}"
TARGET="${OS}-${ARCH}"
ARCHIVE="sovrium-${VERSION}-${TARGET}.tar.gz"
DOWNLOAD_URL="https://github.com/${GITHUB_REPO}/releases/download/v${VERSION}/${ARCHIVE}"
CHECKSUM_URL="https://github.com/${GITHUB_REPO}/releases/download/v${VERSION}/sovrium-${VERSION}-${TARGET}.sha256"

echo "Installing Sovrium v${VERSION} for ${TARGET}..."

# Create temp directory
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

# Download binary archive
echo "Downloading ${ARCHIVE}..."
HTTP_CODE=$(curl -fsSL -w "%{http_code}" -o "${TMPDIR}/${ARCHIVE}" "$DOWNLOAD_URL" 2>/dev/null) || true

if [ "$HTTP_CODE" != "200" ] && [ ! -f "${TMPDIR}/${ARCHIVE}" ]; then
  echo "Error: Failed to download binary (HTTP ${HTTP_CODE:-???})." >&2
  echo "URL: ${DOWNLOAD_URL}" >&2
  echo "" >&2
  echo "This may mean:" >&2
  echo "  - Version ${VERSION} does not exist" >&2
  echo "  - Binary for ${TARGET} is not available yet" >&2
  echo "" >&2
  echo "Check https://github.com/${GITHUB_REPO}/releases for available versions." >&2
  exit 1
fi

# Try to verify checksum (non-fatal if checksum file is not available)
echo "Verifying checksum..."
CHECKSUM_FILE="${TMPDIR}/checksum.sha256"
if curl -fsSL -o "$CHECKSUM_FILE" "$CHECKSUM_URL" 2>/dev/null; then
  EXPECTED_HASH=$(cut -d' ' -f1 "$CHECKSUM_FILE")
  verify_checksum "${TMPDIR}/${ARCHIVE}" "$EXPECTED_HASH"
  echo "Checksum verified."
else
  echo "Warning: Checksum file not available. Skipping verification." >&2
fi

# Extract
echo "Extracting..."
tar xzf "${TMPDIR}/${ARCHIVE}" -C "${TMPDIR}"

# Install
mkdir -p "$INSTALL_DIR"
mv "${TMPDIR}/${BINARY_NAME}" "${INSTALL_DIR}/${BINARY_NAME}"
chmod +x "${INSTALL_DIR}/${BINARY_NAME}"

# Remove macOS quarantine attribute if present
if [ "$OS" = "darwin" ] && command -v xattr > /dev/null 2>&1; then
  xattr -d com.apple.quarantine "${INSTALL_DIR}/${BINARY_NAME}" 2>/dev/null || true
fi

echo ""
echo "Sovrium v${VERSION} installed to ${INSTALL_DIR}/${BINARY_NAME}"

# Check if install dir is in PATH
case ":${PATH}:" in
  *":${INSTALL_DIR}:"*)
    echo ""
    echo "Run 'sovrium --version' to verify."
    ;;
  *)
    echo ""
    echo "Add Sovrium to your PATH by adding this to your shell profile:"
    echo ""
    SHELL_NAME=$(basename "${SHELL:-/bin/sh}")
    case "$SHELL_NAME" in
      zsh)  PROFILE="~/.zshrc" ;;
      bash) PROFILE="~/.bashrc" ;;
      fish) PROFILE="~/.config/fish/config.fish" ;;
      *)    PROFILE="your shell profile" ;;
    esac
    if [ "$SHELL_NAME" = "fish" ]; then
      echo "  fish_add_path ${INSTALL_DIR}"
    else
      echo "  export PATH=\"${INSTALL_DIR}:\$PATH\""
    fi
    echo ""
    echo "Then restart your terminal or run:"
    echo "  source ${PROFILE}"
    ;;
esac
