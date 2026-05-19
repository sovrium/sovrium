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

FROM debian:bookworm-slim

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

# Non-root user for security
RUN useradd -r -s /bin/false -m sovrium
USER sovrium

WORKDIR /app
EXPOSE 3000

ENTRYPOINT ["sovrium"]
CMD ["start"]
