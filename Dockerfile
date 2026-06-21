FROM oven/bun:1@sha256:0733e50325078969732ebe3b15ce4c4be5082f18c4ac1a0f0ca4839c2e4e42a7 AS builder

WORKDIR /build
# The frontend is a Bun workspace: web/package.json is the workspace root that
# defines the shared `catalog` (e.g. clsx, dayjs), and web/default is the app
# that references those versions via "catalog:". Both the root and the leaf
# manifest plus the root lockfile must be present or `catalog:` deps fail to
# resolve. Keep the two-level layout (root at /build, app at /build/default).
COPY web/package.json ./package.json
COPY web/bun.lock ./bun.lock
COPY web/default/package.json ./default/package.json
RUN bun install --frozen-lockfile
COPY ./web/default ./default
COPY ./VERSION ./default/VERSION

WORKDIR /build/default

# Effective build version. Order: --build-arg VERSION > VERSION file > "dev".
# Without this both the frontend banner and the Go binary report v0.0.0.
ARG VERSION=""
RUN APP_VERSION="${VERSION:-$(cat VERSION 2>/dev/null || true)}"; \
    APP_VERSION="${APP_VERSION:-dev}"; \
    echo "frontend build version: $APP_VERSION"; \
    DISABLE_ESLINT_PLUGIN='true' VITE_REACT_APP_VERSION="$APP_VERSION" bun run build

FROM golang:1.26.1-alpine@sha256:2389ebfa5b7f43eeafbd6be0c3700cc46690ef842ad962f6c5bd6be49ed82039 AS builder2
ENV GO111MODULE=on CGO_ENABLED=0

ARG TARGETOS
ARG TARGETARCH
ENV GOOS=${TARGETOS:-linux} GOARCH=${TARGETARCH:-amd64}
ENV GOEXPERIMENT=greenteagc

# Optional override for the Go module proxy. Pass with:
#   docker build --build-arg GOPROXY=https://goproxy.cn,direct ...
# Useful when the default proxy.golang.org is unreachable.
ARG GOPROXY=""
ENV GOPROXY=${GOPROXY:-https://proxy.golang.org,direct}

WORKDIR /build

ADD go.mod go.sum ./
RUN go mod download

COPY . .
COPY --from=builder /build/default/dist ./web/default/dist

# Inject the same version computed in the frontend stage into the Go binary
# via -X ldflag, otherwise common.Version stays at the v0.0.0 placeholder and
# /api/status keeps returning v0.0.0 forever.
ARG VERSION=""
RUN APP_VERSION="${VERSION:-$(cat VERSION 2>/dev/null || true)}"; \
    APP_VERSION="${APP_VERSION:-dev}"; \
    echo "go build version: $APP_VERSION"; \
    go build -ldflags "-s -w -X github.com/QuantumNous/new-api/common.Version=$APP_VERSION" -o new-api

FROM debian:bookworm-slim@sha256:f06537653ac770703bc45b4b113475bd402f451e85223f0f2837acbf89ab020a

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates tzdata libasan8 wget \
    && rm -rf /var/lib/apt/lists/* \
    && update-ca-certificates

COPY --from=builder2 /build/new-api /
EXPOSE 3000
WORKDIR /data
ENTRYPOINT ["/new-api"]
