# Sovrium standalone binary Docker image
#
# Multi-architecture support: linux/amd64, linux/arm64
# Uses pre-compiled binaries from the release pipeline.
#
# Build (single arch):
#   docker build --build-arg TARGETARCH=amd64 -t sovrium .
#
# Run:
#   docker run -v $(pwd)/app.yaml:/app/app.yaml -p 3000:3000 sovrium start app.yaml

# debian:trixie-slim (Debian 13, stable), pinned to the multi-arch index digest
# so a rebuild cannot silently pick up a different base. Refresh the digest
# deliberately: `docker buildx imagetools inspect debian:trixie-slim`.
FROM debian:trixie-slim@sha256:62bd423aeee912639ca8ee681c2b762cb3e25137e0a92b20be455898a9f034ad

ARG TARGETARCH

# Install minimal runtime dependencies
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       ca-certificates \
       libstdc++6 \
    && rm -rf /var/lib/apt/lists/*

# Map Docker TARGETARCH to Sovrium binary naming
# Docker uses: amd64, arm64
# Sovrium uses: x64, arm64
COPY sovrium-linux-${TARGETARCH/amd64/x64} /usr/local/bin/sovrium
RUN chmod +x /usr/local/bin/sovrium

# Tell `sovrium update` this binary belongs to the image, so it prints the
# `docker pull` instruction instead of trying to replace itself. Declared rather
# than inferred: `/.dockerenv` is absent under Podman and Kubernetes, and present
# in containers whose binary came from the install script.
ENV SOVRIUM_INSTALL_METHOD=docker

# Production mode: longer asset caching and structured log lines. The security
# behaviour does not depend on it; that follows from BASE_URL and the bind address.
ENV NODE_ENV=production

# Listen on every interface of the container, so a published port reaches the
# server. Named here rather than left to Docker's injected HOSTNAME (the
# container id), which the server reads only as a deprecated fallback and
# which Podman or Kubernetes may set to something else entirely. Inside the
# container's own network namespace this is the only way a port mapping works;
# who can reach that port is decided by `-p` on the host.
ENV SOVRIUM_BIND_HOST=0.0.0.0

# Non-root user for security. It must own the directories it writes to:
# /app (the working directory, where the default `./.sovrium` data directory
# lands) and /data (the documented SOVRIUM_DATA_DIR mount point). A named
# volume mounted on /data copies this ownership when it is first created,
# so the non-root user can write to it; without it both start-up paths
# fail with EACCES.
RUN useradd -r -s /bin/false -m sovrium \
    && mkdir -p /app /data \
    && chown sovrium:sovrium /app /data
USER sovrium

WORKDIR /app
EXPOSE 3000

ENTRYPOINT ["sovrium"]
CMD ["start"]
