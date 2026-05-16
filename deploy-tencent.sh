#!/usr/bin/env bash
# One-click deploy: build the new-api Docker image and push it to
# Tencent Cloud Container Registry (ccr.ccs.tencentyun.com).
#
# Usage:
#   ./deploy-tencent.sh                            # build linux/amd64, tag with VERSION + latest, push
#   PLATFORMS=linux/amd64,linux/arm64 ./deploy-tencent.sh
#   TENCENT_CCR_PASSWORD=xxx ./deploy-tencent.sh    # non-interactive login
#   SKIP_LOGIN=1 ./deploy-tencent.sh                # already logged in
#   EXTRA_TAGS="v1.2.3 stable" ./deploy-tencent.sh  # add more tags
#
# Env overrides:
#   REGISTRY    default: ccr.ccs.tencentyun.com
#   NAMESPACE   default: puddi
#   IMAGE       default: new-api
#   USERNAME    default: 100011375079
#   PLATFORMS   default: linux/amd64
#   DOCKERFILE  default: Dockerfile

set -euo pipefail

# ---- config ----------------------------------------------------------------
REGISTRY="${REGISTRY:-ccr.ccs.tencentyun.com}"
NAMESPACE="${NAMESPACE:-puddi}"
IMAGE="${IMAGE:-new-api}"
USERNAME="${USERNAME:-100011375079}"
PLATFORMS="${PLATFORMS:-linux/amd64}"
DOCKERFILE="${DOCKERFILE:-Dockerfile}"
EXTRA_TAGS="${EXTRA_TAGS:-}"

REPO="${REGISTRY}/${NAMESPACE}/${IMAGE}"

# ---- helpers ---------------------------------------------------------------
info()  { printf '\033[1;34m[deploy]\033[0m %s\n' "$*"; }
warn()  { printf '\033[1;33m[warn]\033[0m %s\n'   "$*" >&2; }
fatal() { printf '\033[1;31m[fatal]\033[0m %s\n'  "$*" >&2; exit 1; }

cd "$(dirname "$0")"

command -v docker >/dev/null 2>&1 || fatal "docker is not installed or not on PATH"

# ---- compute tags ----------------------------------------------------------
VERSION_TAG="$(tr -d '[:space:]' < VERSION 2>/dev/null || true)"
GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo nogit)"
DATE_TAG="$(date +%Y%m%d-%H%M%S)"

if [[ -z "${VERSION_TAG}" ]]; then
  VERSION_TAG="${GIT_SHA}"
  warn "VERSION file is empty; falling back to git sha tag: ${VERSION_TAG}"
fi

TAGS=("${VERSION_TAG}" "latest" "${GIT_SHA}-${DATE_TAG}")
if [[ -n "${EXTRA_TAGS}" ]]; then
  # shellcheck disable=SC2206
  TAGS+=(${EXTRA_TAGS})
fi

# de-duplicate while preserving order (bash 3.2 compatible — no assoc arrays)
UNIQUE_TAGS=()
for t in "${TAGS[@]}"; do
  [[ -z "$t" ]] && continue
  dup=0
  for u in "${UNIQUE_TAGS[@]:-}"; do
    if [[ "$u" == "$t" ]]; then dup=1; break; fi
  done
  [[ $dup -eq 0 ]] && UNIQUE_TAGS+=("$t")
done

info "registry  : ${REGISTRY}"
info "image     : ${REPO}"
info "platforms : ${PLATFORMS}"
info "tags      : ${UNIQUE_TAGS[*]}"

# ---- login -----------------------------------------------------------------
if [[ "${SKIP_LOGIN:-0}" != "1" ]]; then
  info "logging in to ${REGISTRY} as ${USERNAME}"
  if [[ -n "${TENCENT_CCR_PASSWORD:-}" ]]; then
    echo "${TENCENT_CCR_PASSWORD}" | docker login "${REGISTRY}" \
      --username "${USERNAME}" --password-stdin
  else
    docker login "${REGISTRY}" --username "${USERNAME}"
  fi
else
  info "SKIP_LOGIN=1, skipping docker login"
fi

# ---- build & push ----------------------------------------------------------
TAG_ARGS=()
for t in "${UNIQUE_TAGS[@]}"; do
  TAG_ARGS+=(--tag "${REPO}:${t}")
done

# Bake the same value used for the primary image tag into the binary so
# /api/status and the UI banner report a real version instead of v0.0.0.
BUILD_ARGS=(--build-arg "VERSION=${VERSION_TAG}")

# Multi-platform builds require buildx + --push (cannot --load multi-arch).
# Single-platform: prefer buildx for caching; fall back to plain docker build.
if [[ "${PLATFORMS}" == *","* ]]; then
  info "multi-platform build via buildx"
  if ! docker buildx inspect new-api-builder >/dev/null 2>&1; then
    docker buildx create --name new-api-builder --use >/dev/null
  else
    docker buildx use new-api-builder >/dev/null
  fi
  docker buildx build \
    --platform "${PLATFORMS}" \
    --file "${DOCKERFILE}" \
    "${BUILD_ARGS[@]}" \
    "${TAG_ARGS[@]}" \
    --push \
    .
else
  info "single-platform build (${PLATFORMS})"
  if docker buildx version >/dev/null 2>&1; then
    docker buildx build \
      --platform "${PLATFORMS}" \
      --file "${DOCKERFILE}" \
      "${BUILD_ARGS[@]}" \
      "${TAG_ARGS[@]}" \
      --load \
      .
  else
    docker build \
      --file "${DOCKERFILE}" \
      "${BUILD_ARGS[@]}" \
      "${TAG_ARGS[@]}" \
      .
  fi
  for t in "${UNIQUE_TAGS[@]}"; do
    info "pushing ${REPO}:${t}"
    docker push "${REPO}:${t}"
  done
fi

# ---- summary ---------------------------------------------------------------
info "done. pushed images:"
for t in "${UNIQUE_TAGS[@]}"; do
  printf '  - %s:%s\n' "${REPO}" "${t}"
done
