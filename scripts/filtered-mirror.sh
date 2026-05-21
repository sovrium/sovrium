#!/usr/bin/env bash
# scripts/filtered-mirror.sh — Filtered mirror push to GitHub
#
# Mirrors only files needed for NPM package build + GitHub Actions release.
# Protects development infrastructure (.claude/, docs/, specs/, .forgejo/, eslint/).
#
# Required environment variables:
#   TAG                  — Release tag (e.g., v0.2.8)
#   GITHUB_MIRROR_TOKEN  — GitHub PAT with repo scope
#
# Usage:
#   TAG=v0.2.8 GITHUB_MIRROR_TOKEN=xxx bash scripts/filtered-mirror.sh

set -euo pipefail

TAG="${TAG:?TAG environment variable required}"
GITHUB_MIRROR_TOKEN="${GITHUB_MIRROR_TOKEN:?GITHUB_MIRROR_TOKEN env required}"

MIRROR_DIR=$(mktemp -d)

echo "==> Building filtered mirror for ${TAG}"

# ── Allowlist: copy only files needed for NPM build + release ──
# Source code (excluding co-located test files)
cp -r src/ "${MIRROR_DIR}/src/"
find "${MIRROR_DIR}/src" -type f \( -name '*.test.ts' -o -name '*.test.tsx' \) -delete

# Workspace packages (@sovrium/types — published to npm). Required so the bun
# workspace graph on GitHub matches bun.lock; without it `bun install
# --frozen-lockfile` rejects the lockfile (workspace member missing on disk).
cp -r packages/ "${MIRROR_DIR}/packages/"
find "${MIRROR_DIR}/packages" -type f \( -name '*.test.ts' -o -name '*.test.tsx' \) -delete

# Build infrastructure
cp package.json bun.lock tsconfig.json tsconfig.build.json "${MIRROR_DIR}/"

# Build & release scripts — copy the whole directory (test files stripped).
# release.yml jobs and the binary build invoke several scripts that chain into
# others; an enumerated allowlist drifts out of sync every time a build script
# gains a dependency or is renamed.
cp -r scripts/ "${MIRROR_DIR}/scripts/"
find "${MIRROR_DIR}/scripts" -type f \( -name '*.test.ts' -o -name '*.test.tsx' \) -delete

# Strip comments from the mirrored source and build scripts — keeps the BSL
# header + compiler directives, drops everything else (incl. internal spec/US
# references). Operates on the disposable MIRROR_DIR copy only; the canonical
# tree on Forgejo keeps all comments. packages/, examples/, agents/ are NOT
# scrubbed — @sovrium/types ships its JSDoc to npm and examples are meant to
# be read.
bun run scripts/scrub-mirror-comments.ts "${MIRROR_DIR}/src" "${MIRROR_DIR}/scripts"

# Example configs and agent templates (needed by binary init/agents commands)
if [ -d examples/ ]; then
  cp -r examples/ "${MIRROR_DIR}/examples/"
fi
if [ -d agents/ ]; then
  cp -r agents/ "${MIRROR_DIR}/agents/"
fi

# Install script
[ -f install.sh ] && cp install.sh "${MIRROR_DIR}/" || true

# Database migrations
if [ -d drizzle/ ]; then
  cp -r drizzle/ "${MIRROR_DIR}/drizzle/"
fi

# Docker build context (Build Docker Image job uses `context: .` + default Dockerfile)
cp Dockerfile "${MIRROR_DIR}/"
[ -f .dockerignore ] && cp .dockerignore "${MIRROR_DIR}/" || true

# GitHub workflow
mkdir -p "${MIRROR_DIR}/.github/workflows"
cp .github/workflows/release.yml "${MIRROR_DIR}/.github/workflows/"

# Release metadata + licenses
cp LICENSE.md "${MIRROR_DIR}/"
cp CHANGELOG.md README.md SECURITY.md TRADEMARK.md "${MIRROR_DIR}/"

# ── Safety checks ──
echo "==> Verifying mirror contents"

# Required files must exist
REQUIRED_FILES=(
  "src/index.ts"
  "src/cli/index.ts"
  "package.json"
  "bun.lock"
  "tsconfig.json"
  "tsconfig.build.json"
  "scripts/build.ts"
  "scripts/build-binary.ts"
  "scripts/build-types.ts"
  "scripts/generate-checksums.ts"
  "scripts/generate-css-assets.ts"
  "scripts/update-homebrew-formula.ts"
  "scripts/update-scoop-manifest.ts"
  "packages/types/package.json"
  "packages/types/src/index.ts"
  ".github/workflows/release.yml"
  "Dockerfile"
  "LICENSE.md"
  "README.md"
)
for f in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "${MIRROR_DIR}/${f}" ]; then
    echo "FATAL: Required file missing from mirror: ${f}"
    exit 1
  fi
done

# Protected files/dirs must NOT exist
EXCLUDED=(
  "CLAUDE.md"
  ".claude"
  "docs"
  "specs"
  ".forgejo"
  "eslint"
  "eslint.config.ts"
  "playwright.config.ts"
)
for e in "${EXCLUDED[@]}"; do
  if [ -e "${MIRROR_DIR}/${e}" ]; then
    echo "FATAL: Protected path leaked into mirror: ${e}"
    exit 1
  fi
done

# Minimum file count sanity check
FILE_COUNT=$(find "${MIRROR_DIR}" -type f | wc -l | tr -d ' ')
if [ "${FILE_COUNT}" -lt 10 ]; then
  echo "FATAL: Only ${FILE_COUNT} files in mirror (expected >= 10)"
  exit 1
fi

echo "==> Mirror contains ${FILE_COUNT} files, all checks passed"

# ── Publish to GitHub on top of existing history ──
# Clone GitHub's current `main` (the source of truth for what is published),
# replace its tracked content with the freshly-built filtered tree, and commit
# as a child of the existing HEAD. This keeps a continuous, browsable history
# where each release is a fast-forward child of the previous — no orphan
# commit, no force-push.
GITHUB_REMOTE="https://x-access-token:${GITHUB_MIRROR_TOKEN}@github.com/sovrium/sovrium.git"
PUBLISH_DIR=$(mktemp -d)

if git clone --depth=1 "${GITHUB_REMOTE}" "${PUBLISH_DIR}"; then
  echo "==> Cloned existing GitHub main; building release commit on top"
  cd "${PUBLISH_DIR}"

  # Remove all tracked content (keeps .git), then overlay the filtered tree.
  # The `/.` suffix copies hidden files (.dockerignore, .github/, etc.).
  git rm -rqf . >/dev/null 2>&1 || true
  cp -r "${MIRROR_DIR}/." .

  # Stages adds, modifications, and deletions relative to the cloned main.
  git add -A

  # Commit as a child of the cloned HEAD. A version bump normally guarantees
  # a diff; if not, fall through and tag the existing HEAD instead of aborting.
  if git diff --cached --quiet; then
    echo "==> No content changes vs GitHub main; tagging existing HEAD"
  else
    git -c user.name="Sovrium CI" -c user.email="ci@sovrium.com" \
      commit -m "release: ${TAG}"
  fi

  git tag "${TAG}"

  # Fast-forward push: the commit sits on top of the cloned main, and the
  # tag name is new for every release — no --force needed.
  git push origin main
  git push origin "${TAG}"
else
  # Defensive fallback: GitHub repo has no `main` branch yet (first-ever push).
  # In practice `main` exists, so this path is rarely taken.
  echo "==> Clone failed (no existing main?); falling back to orphan init"
  cd "${MIRROR_DIR}"
  git init -b main
  git add -A
  git -c user.name="Sovrium CI" -c user.email="ci@sovrium.com" \
    commit -m "release: ${TAG}"
  git tag "${TAG}"
  git remote add github "${GITHUB_REMOTE}"
  git push github main
  git push github "${TAG}"
fi

echo "==> Filtered mirror pushed to GitHub (${TAG}, ${FILE_COUNT} files)"

# Cleanup
rm -rf "${MIRROR_DIR}" "${PUBLISH_DIR}"
