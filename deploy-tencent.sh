#!/usr/bin/env bash
# One-click deploy: build the new-api Docker image and push it to
# Tencent Cloud Container Registry (ccr.ccs.tencentyun.com).
#
# Version is auto-bumped on every run and written back to the VERSION file.
# Default bump is patch (vX.Y.Z → vX.Y.(Z+1)). An empty/missing VERSION is
# treated as v0.0.0, so the first run produces v0.0.1.
#
# Usage:
#   ./deploy-tencent.sh                            # bump patch and deploy
#   ./deploy-tencent.sh --patch                    # explicit patch bump
#   ./deploy-tencent.sh --minor                    # bump minor, reset patch
#   ./deploy-tencent.sh --major                    # bump major, reset minor+patch
#   ./deploy-tencent.sh --keep                     # do NOT bump, reuse current VERSION
#   ./deploy-tencent.sh --commit                   # also git-commit the VERSION change
#   ./deploy-tencent.sh --minor --commit           # combine
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
#   BUMP        default: patch     (alternative to --major/--minor/--patch flag)
#   COMMIT      default: 0         (set to 1 as an alternative to --commit)

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

# ---- parse arguments -------------------------------------------------------
# Flags here only control bump / commit behavior. Everything else is env-var driven.
BUMP="${BUMP:-patch}"
COMMIT="${COMMIT:-0}"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --major)  BUMP=major; shift ;;
    --minor)  BUMP=minor; shift ;;
    --patch)  BUMP=patch; shift ;;
    --keep)   BUMP=keep;  shift ;;
    --commit) COMMIT=1;   shift ;;
    -h|--help)
      # Print the leading comment block as help text.
      sed -n '2,/^set -euo pipefail/p' "$0" | sed '$d' | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) fatal "unknown argument: $1 (try --major/--minor/--patch/--keep/--commit/--help)" ;;
  esac
done

# ---- bump VERSION ----------------------------------------------------------
# Read current vX.Y.Z, increment one component, write back, then use the new
# value as the primary image tag. The Dockerfile bakes this value into both
# the frontend bundle (VITE_REACT_APP_VERSION) and the Go binary
# (-X common.Version=...), so a real bump always changes the image digest —
# which is what makes watchtower's "click to upgrade" flow actually recreate
# the container instead of skipping a no-op pull.
VERSION_FILE="VERSION"
CURRENT_VERSION="$(tr -d '[:space:]' < "$VERSION_FILE" 2>/dev/null || true)"
CLEAN="${CURRENT_VERSION#v}"

if [[ -z "$CLEAN" ]]; then
  major=0; minor=0; patch=0
elif [[ "$CLEAN" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
  major="${BASH_REMATCH[1]}"
  minor="${BASH_REMATCH[2]}"
  patch="${BASH_REMATCH[3]}"
else
  fatal "VERSION file content '${CURRENT_VERSION}' is not in vX.Y.Z form"
fi

case "$BUMP" in
  major) major=$((major+1)); minor=0; patch=0 ;;
  minor) minor=$((minor+1)); patch=0 ;;
  patch) patch=$((patch+1)) ;;
  keep)
    if [[ -z "$CLEAN" ]]; then
      fatal "--keep requires a non-empty VERSION file"
    fi
    ;;
  *) fatal "unknown BUMP value: $BUMP (expected major/minor/patch/keep)" ;;
esac

VERSION_TAG="v${major}.${minor}.${patch}"
if [[ "$BUMP" != "keep" ]]; then
  echo "$VERSION_TAG" > "$VERSION_FILE"
  info "bumped version: ${CURRENT_VERSION:-<empty>} → ${VERSION_TAG} (${BUMP})"
else
  info "keeping version: ${VERSION_TAG} (no bump)"
fi

# Optionally commit the VERSION change before building, so GIT_SHA / the
# date-tag both reflect the release commit. Only stages VERSION itself —
# other dirty paths in the working tree are left alone.
if [[ "$COMMIT" == "1" ]]; then
  if ! command -v git >/dev/null 2>&1; then
    fatal "--commit requires git on PATH"
  fi
  if [[ "$BUMP" == "keep" ]]; then
    info "--commit is a no-op with --keep (VERSION was not modified)"
  elif git diff --quiet -- "$VERSION_FILE" 2>/dev/null; then
    info "VERSION already committed; nothing new to commit"
  else
    info "committing VERSION bump"
    git add "$VERSION_FILE"
    git commit -m "chore: release ${VERSION_TAG}" >/dev/null
  fi
fi

GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo nogit)"
DATE_TAG="$(date +%Y%m%d-%H%M%S)"

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
