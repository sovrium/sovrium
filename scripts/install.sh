#!/bin/sh
# Sovrium Install Script
#
# Usage:
#   curl -fsSL https://sovrium.com/install | sh
#
# Options:
#   --no-modify-path    Don't add Sovrium to your shell PATH
#   --version X.Y.Z     Install a specific version (default: latest)
#
# Environment variables:
#   SOVRIUM_INSTALL_DIR   Custom install directory (default: ~/.sovrium)

set -eu

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
      echo "Sovrium Install Script"
      echo ""
      echo "Usage: curl -fsSL https://sovrium.com/install | sh"
      echo ""
      echo "Options:"
      echo "  --no-modify-path    Don't modify shell rc files"
      echo "  --version X.Y.Z    Install specific version"
      echo ""
      echo "Environment variables:"
      echo "  SOVRIUM_INSTALL_DIR  Custom install directory (default: ~/.sovrium)"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
  shift
done

# ─── Detect platform ─────────────────────────────────────────

detect_platform() {
  OS=$(uname -s)
  ARCH=$(uname -m)

  case "$OS" in
    Darwin) OS="darwin" ;;
    Linux) OS="linux" ;;
    MINGW*|MSYS*|CYGWIN*)
      echo "Error: Windows is not supported by this install script."
      echo "Download the Windows binary from:"
      echo "  https://github.com/$GITHUB_REPO/releases/latest"
      echo ""
      echo "Or install via Scoop: scoop install sovrium"
      exit 1
      ;;
    *)
      echo "Error: Unsupported operating system: $OS"
      exit 1
      ;;
  esac

  case "$ARCH" in
    x86_64|amd64) ARCH="x64" ;;
    aarch64|arm64) ARCH="arm64" ;;
    *)
      echo "Error: Unsupported architecture: $ARCH"
      exit 1
      ;;
  esac

  TARGET="${OS}-${ARCH}"
}

# ─── Fetch latest version ────────────────────────────────────

fetch_latest_version() {
  if [ -n "$VERSION" ]; then
    return
  fi

  echo "Fetching latest version..."

  if command -v curl >/dev/null 2>&1; then
    VERSION=$(curl -fsSL "https://api.github.com/repos/$GITHUB_REPO/releases/latest" | grep '"tag_name"' | sed -E 's/.*"v([^"]+)".*/\1/')
  elif command -v wget >/dev/null 2>&1; then
    VERSION=$(wget -qO- "https://api.github.com/repos/$GITHUB_REPO/releases/latest" | grep '"tag_name"' | sed -E 's/.*"v([^"]+)".*/\1/')
  else
    echo "Error: curl or wget is required"
    exit 1
  fi

  if [ -z "$VERSION" ]; then
    echo "Error: Could not determine latest version"
    exit 1
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

  echo "Downloading sovrium v${VERSION} for ${TARGET}..."

  # Download binary archive
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$URL" -o "$TEMP_DIR/$ARCHIVE"
    curl -fsSL "$CHECKSUM_URL" -o "$TEMP_DIR/$CHECKSUM_FILE" 2>/dev/null || true
  elif command -v wget >/dev/null 2>&1; then
    wget -q "$URL" -O "$TEMP_DIR/$ARCHIVE"
    wget -q "$CHECKSUM_URL" -O "$TEMP_DIR/$CHECKSUM_FILE" 2>/dev/null || true
  fi

  # Verify checksum if available
  if [ -f "$TEMP_DIR/$CHECKSUM_FILE" ] && [ -s "$TEMP_DIR/$CHECKSUM_FILE" ]; then
    echo "Verifying checksum..."
    cd "$TEMP_DIR"
    if command -v sha256sum >/dev/null 2>&1; then
      sha256sum -c "$CHECKSUM_FILE" --quiet 2>/dev/null || {
        echo "Error: Checksum verification failed!"
        exit 1
      }
    elif command -v shasum >/dev/null 2>&1; then
      shasum -a 256 -c "$CHECKSUM_FILE" --quiet 2>/dev/null || {
        echo "Error: Checksum verification failed!"
        exit 1
      }
    else
      echo "Warning: No sha256sum or shasum available, skipping checksum verification"
    fi
    cd - >/dev/null
  fi

  # Extract
  echo "Extracting..."
  tar xzf "$TEMP_DIR/$ARCHIVE" -C "$TEMP_DIR"

  # Find the binary (might be 'sovrium' or 'sovrium-{target}')
  if [ -f "$TEMP_DIR/sovrium" ]; then
    BINARY="$TEMP_DIR/sovrium"
  elif [ -f "$TEMP_DIR/sovrium-${TARGET}" ]; then
    BINARY="$TEMP_DIR/sovrium-${TARGET}"
  else
    echo "Error: Binary not found in archive"
    exit 1
  fi

  # Install
  mkdir -p "$BIN_DIR"
  cp "$BINARY" "$BIN_DIR/sovrium"
  chmod 755 "$BIN_DIR/sovrium"

  # Remove macOS quarantine attribute
  if [ "$OS" = "darwin" ]; then
    xattr -d com.apple.quarantine "$BIN_DIR/sovrium" 2>/dev/null || true
  fi

  echo "Installed sovrium v${VERSION} to $BIN_DIR/sovrium"
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

  echo "" >> "$RC_FILE"
  echo "# Sovrium" >> "$RC_FILE"
  echo "$EXPORT_LINE" >> "$RC_FILE"

  echo "Added $BIN_DIR to PATH in $RC_FILE"
}

# ─── Main ─────────────────────────────────────────────────────

main() {
  echo ""
  echo "  Sovrium Installer"
  echo "  ──��──────────────"
  echo ""

  detect_platform
  fetch_latest_version
  download_and_install
  update_path

  echo ""
  echo "  ✓ Sovrium v${VERSION} installed successfully!"
  echo ""
  echo "  To get started:"
  echo "    sovrium --help"
  echo ""
  echo "  To create a new project:"
  echo "    sovrium init --template hello-world"
  echo ""

  # Remind to restart shell if PATH was modified
  if [ "$MODIFY_PATH" -eq 1 ]; then
    case ":$PATH:" in
      *":$BIN_DIR:"*) ;;
      *)
        echo "  Restart your shell or run:"
        echo "    export PATH=\"$BIN_DIR:\$PATH\""
        echo ""
        ;;
    esac
  fi
}

main
