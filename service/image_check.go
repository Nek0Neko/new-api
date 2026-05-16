// Package service: image_check.go
//
// Provides Docker image version comparison and update triggering for
// container-based deployments. Used by controller/maintenance.go to back
// the "Check for updates" / "Upgrade now" admin UI.
//
// Design:
//   - Local image digest is read from the Docker engine API over a read-only
//     mount of /var/run/docker.sock. The new-api container only needs read
//     permission on the socket; the actual container recreation is delegated
//     to a watchtower sidecar.
//   - Remote image digest is fetched via the OCI / Docker Registry V2 HTTP
//     API (HEAD /v2/<repo>/manifests/<tag>) with token-auth fallback.
//   - Update execution POSTs to watchtower's /v1/update endpoint, which then
//     pulls the new image and recreates labeled containers atomically.
package service

import (
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
)

const (
	dockerSocketPath = "/var/run/docker.sock"

	// Default Docker Hub registry endpoints used when an image reference has
	// no explicit registry component (e.g. "redis:latest").
	defaultRegistryHost = "registry-1.docker.io"
	defaultRegistryAuth = "auth.docker.io"

	// Docker Engine API path prefix. We intentionally omit the version
	// segment ("/v1.41/..." etc.) so the daemon serves whatever API version
	// it supports. Docker 25+ rejects clients that pin to v1.41 or older
	// ("client version 1.41 is too old"). All fields we consume from
	// /containers/<id>/json and /images/<id>/json are stable since v1.21,
	// so an unversioned path is the safest forward-compatible choice.
	dockerAPIBase = "http://docker"

	// HTTP timeouts. Tuned so the UI's "Check for updates" button completes
	// within ~30s in the worst case while still failing fast on local errors.
	// Registry calls cross the public internet and may include a token-auth
	// round trip, so they get the longest budget. Docker socket and watchtower
	// are both on the local docker network and should respond in milliseconds.
	registryRequestTimeout = 30 * time.Second
	dockerSocketTimeout    = 5 * time.Second
	watchtowerTimeout      = 10 * time.Second
)

// ImageStatus is the structured response sent to the admin UI.
type ImageStatus struct {
	NodeName      string `json:"node_name"`
	InContainer   bool   `json:"in_container"`
	ImageRef      string `json:"image_ref"`     // e.g. ccr.ccs.tencentyun.com/puddi/new-api:latest
	LocalDigest   string `json:"local_digest"`  // sha256:...
	RemoteDigest  string `json:"remote_digest"` // sha256:...
	HasUpdate     bool   `json:"has_update"`
	UpgraderReady bool   `json:"upgrader_ready"` // whether WATCHTOWER_URL is reachable
	CheckedAt     int64  `json:"checked_at"`     // unix seconds
	Message       string `json:"message,omitempty"`
}

// dockerHTTPClient returns an http.Client that talks to the Docker engine
// over /var/run/docker.sock. Returned client has a short timeout because
// these calls are local and should never block the UI.
func dockerHTTPClient() *http.Client {
	return &http.Client{
		Timeout: dockerSocketTimeout,
		Transport: &http.Transport{
			DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
				d := net.Dialer{Timeout: dockerSocketTimeout}
				return d.DialContext(ctx, "unix", dockerSocketPath)
			},
		},
	}
}

// IsInContainer reports whether the process is running inside a Docker
// container that has the docker socket mounted. When false, image-status
// checks fall back to "unknown local digest".
// build tag: ui-test-build
func IsInContainer() bool {
	if _, err := os.Stat(dockerSocketPath); err != nil {
		return false
	}
	// Cheap secondary check: presence of /.dockerenv.
	if _, err := os.Stat("/.dockerenv"); err == nil {
		return true
	}
	return true // socket present, treat as container even without /.dockerenv
}

// selfContainerID returns the identifier the Docker API can use to look up
// the current container. Lookup order:
//  1. Hostname — works for docker-compose's `container_name:` or auto-set
//     short-id hostnames on first run.
//  2. /proc/self/cgroup — kernel-level container ID, used as a fallback for
//     containers whose hostname was copied from a previous instance (which
//     happens when watchtower recreates a container without an explicit
//     hostname: directive in compose).
//
// Each candidate is returned in priority order; the caller probes them in
// turn until one resolves on the docker API.
func selfContainerCandidates() []string {
	out := make([]string, 0, 2)
	if host, err := os.Hostname(); err == nil && host != "" {
		out = append(out, host)
	}
	if cid := readCgroupContainerID(); cid != "" {
		out = append(out, cid)
	}
	return out
}

// readCgroupContainerID extracts the docker container ID from
// /proc/self/cgroup. Handles both cgroup v1 (`/docker/<id>`) and cgroup v2
// (`/system.slice/docker-<id>.scope`) formats. Returns empty string if no
// container ID could be parsed (e.g. running outside docker or on a host
// using a non-docker runtime).
func readCgroupContainerID() string {
	data, err := os.ReadFile("/proc/self/cgroup")
	if err != nil {
		return ""
	}
	for _, line := range strings.Split(string(data), "\n") {
		// Look for "docker-<64hex>.scope" (v2) or "/docker/<64hex>" (v1).
		if idx := strings.Index(line, "docker-"); idx >= 0 {
			rest := line[idx+len("docker-"):]
			if end := strings.Index(rest, "."); end > 0 {
				if id := rest[:end]; isHex(id) && len(id) >= 12 {
					return id
				}
			}
		}
		if idx := strings.Index(line, "/docker/"); idx >= 0 {
			rest := line[idx+len("/docker/"):]
			if end := strings.IndexAny(rest, "/\n"); end >= 0 {
				rest = rest[:end]
			}
			if isHex(rest) && len(rest) >= 12 {
				return rest
			}
		}
	}
	return ""
}

func isHex(s string) bool {
	for _, r := range s {
		if !((r >= '0' && r <= '9') || (r >= 'a' && r <= 'f') || (r >= 'A' && r <= 'F')) {
			return false
		}
	}
	return s != ""
}

// containerInspect captures only the fields we need from /containers/<id>/json.
type containerInspect struct {
	ID    string `json:"Id"`
	Image string `json:"Image"` // local image sha256:...
	Name  string `json:"Name"`
	Config struct {
		Image string `json:"Image"` // configured ref, e.g. ccr.ccs.tencentyun.com/puddi/new-api:latest
	} `json:"Config"`
}

type imageInspect struct {
	ID          string   `json:"Id"`
	RepoDigests []string `json:"RepoDigests"`
	RepoTags    []string `json:"RepoTags"`
}

// inspectSelfContainer returns the configured image ref and the registry-side
// digest (sha256:...) of the running container. RepoDigests is preferred over
// the local image Id because only RepoDigests can be compared with what the
// registry advertises for a given tag.
func inspectSelfContainer(ctx context.Context) (imageRef, localDigest string, err error) {
	candidates := selfContainerCandidates()
	if len(candidates) == 0 {
		return "", "", fmt.Errorf("could not determine self container id (no hostname or cgroup info)")
	}
	client := dockerHTTPClient()

	// 1) Inspect the container to learn its configured image reference and
	// the local image ID it currently runs. Try each candidate in order; the
	// first that resolves wins. This makes the lookup resilient to stale
	// hostnames left behind by watchtower-driven recreates.
	var ci containerInspect
	var lastErr error
	for _, cid := range candidates {
		req, _ := http.NewRequestWithContext(ctx,
			http.MethodGet,
			dockerAPIBase+"/containers/"+url.PathEscape(cid)+"/json",
			nil)
		resp, doErr := client.Do(req)
		if doErr != nil {
			lastErr = fmt.Errorf("docker socket unreachable: %w", doErr)
			continue
		}
		if resp.StatusCode == http.StatusOK {
			decodeErr := common.DecodeJson(resp.Body, &ci)
			resp.Body.Close()
			if decodeErr != nil {
				return "", "", fmt.Errorf("decode container inspect: %w", decodeErr)
			}
			lastErr = nil
			break
		}
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		lastErr = fmt.Errorf("container inspect failed for %q: %s: %s", cid, resp.Status, strings.TrimSpace(string(body)))
	}
	if lastErr != nil {
		return "", "", lastErr
	}
	imageRef = ci.Config.Image

	// 2) Inspect that image to obtain its RepoDigest (the value the registry
	// would also return). The local Image ID is NOT comparable with the
	// registry's manifest digest, so we must look this up.
	if ci.Image == "" {
		return imageRef, "", fmt.Errorf("container inspect returned empty image id")
	}
	req2, _ := http.NewRequestWithContext(ctx,
		http.MethodGet,
		dockerAPIBase+"/images/"+url.PathEscape(ci.Image)+"/json",
		nil)
	resp2, err := client.Do(req2)
	if err != nil {
		return imageRef, "", fmt.Errorf("docker image inspect failed: %w", err)
	}
	defer resp2.Body.Close()
	if resp2.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp2.Body)
		return imageRef, "", fmt.Errorf("image inspect failed: %s: %s", resp2.Status, strings.TrimSpace(string(body)))
	}
	var ii imageInspect
	if err := common.DecodeJson(resp2.Body, &ii); err != nil {
		return imageRef, "", fmt.Errorf("decode image inspect: %w", err)
	}

	// Pick the RepoDigest whose repo matches the configured image ref. When
	// :latest has been overwritten locally, multiple digests may be present;
	// the matching one is the authoritative comparison target.
	repo := stripTag(imageRef)
	for _, rd := range ii.RepoDigests {
		if strings.HasPrefix(rd, repo+"@") {
			parts := strings.SplitN(rd, "@", 2)
			if len(parts) == 2 {
				return imageRef, parts[1], nil
			}
		}
	}
	// Fallback: return the first RepoDigest if any.
	if len(ii.RepoDigests) > 0 {
		parts := strings.SplitN(ii.RepoDigests[0], "@", 2)
		if len(parts) == 2 {
			return imageRef, parts[1], nil
		}
	}
	// No RepoDigest available (image built locally / never pulled by digest).
	return imageRef, "", nil
}

// parsedImageRef holds the three parts needed to query a registry.
type parsedImageRef struct {
	Registry string // host[:port], e.g. ccr.ccs.tencentyun.com
	Repo     string // path including namespace, e.g. puddi/new-api
	Tag      string // e.g. latest
}

// parseImageRef splits "registry/repo:tag" into its components, applying
// Docker's default rules: missing registry => Docker Hub, single-segment
// repo on Docker Hub => library/<name>, missing tag => latest.
func parseImageRef(ref string) (parsedImageRef, error) {
	if ref == "" {
		return parsedImageRef{}, fmt.Errorf("empty image reference")
	}

	// Strip optional digest pin like @sha256:...; we only care about tag here.
	if at := strings.Index(ref, "@"); at >= 0 {
		ref = ref[:at]
	}

	registry := defaultRegistryHost
	rest := ref

	// A registry is present when the first '/' segment contains '.', ':' or
	// equals "localhost". Otherwise treat the whole thing as a Docker Hub repo.
	if i := strings.Index(ref, "/"); i > 0 {
		first := ref[:i]
		if strings.ContainsAny(first, ".:") || first == "localhost" {
			registry = first
			rest = ref[i+1:]
		}
	}

	tag := "latest"
	if i := strings.LastIndex(rest, ":"); i >= 0 {
		tag = rest[i+1:]
		rest = rest[:i]
	}

	repo := rest
	if registry == defaultRegistryHost && !strings.Contains(repo, "/") {
		repo = "library/" + repo
	}
	if repo == "" {
		return parsedImageRef{}, fmt.Errorf("could not parse repo from %q", ref)
	}
	return parsedImageRef{Registry: registry, Repo: repo, Tag: tag}, nil
}

// stripTag removes the ":tag" suffix from an image ref, preserving registry
// and repo. Used to match RepoDigests, which encode the repo without a tag.
func stripTag(ref string) string {
	if at := strings.Index(ref, "@"); at >= 0 {
		ref = ref[:at]
	}
	// Find the last ":" that is not inside the registry host (host:port).
	slash := strings.LastIndex(ref, "/")
	colon := strings.LastIndex(ref, ":")
	if colon > slash {
		return ref[:colon]
	}
	return ref
}

// registryCredential returns (username, password) for the given registry
// host, if configured via environment variables. Private registries (e.g.
// Tencent TCR) need these to fetch a pull token.
//
// Lookup order, first non-empty wins:
//  1. REGISTRY_USERNAME_<HOST> / REGISTRY_PASSWORD_<HOST> where HOST is the
//     registry hostname with dots and dashes replaced by underscores
//     (e.g. CCR_CCS_TENCENTYUN_COM). Lets operators configure multiple
//     registries when an instance pulls from several.
//  2. REGISTRY_USERNAME / REGISTRY_PASSWORD as a single-registry fallback.
//
// Credentials are read on every call to allow runtime rotation without a
// process restart.
func registryCredential(host string) (string, string) {
	suffix := strings.ToUpper(host)
	suffix = strings.NewReplacer(".", "_", "-", "_", ":", "_").Replace(suffix)
	if u, p := os.Getenv("REGISTRY_USERNAME_"+suffix), os.Getenv("REGISTRY_PASSWORD_"+suffix); u != "" && p != "" {
		return u, p
	}
	return os.Getenv("REGISTRY_USERNAME"), os.Getenv("REGISTRY_PASSWORD")
}

// GetRemoteImageDigest fetches the Docker-Content-Digest header for a given
// image reference via the Registry V2 API. It transparently handles three
// auth modes:
//   - anonymous (public Docker Hub images)
//   - anonymous bearer-token (some registries always require the token dance)
//   - basic-auth bearer-token (private TCR / private Docker Hub repos), driven
//     by REGISTRY_USERNAME / REGISTRY_PASSWORD environment variables.
func GetRemoteImageDigest(ctx context.Context, ref string) (string, error) {
	parsed, err := parseImageRef(ref)
	if err != nil {
		return "", err
	}

	client := &http.Client{Timeout: registryRequestTimeout}
	manifestURL := fmt.Sprintf("https://%s/v2/%s/manifests/%s", parsed.Registry, parsed.Repo, parsed.Tag)

	doHead := func(token string) (*http.Response, error) {
		req, _ := http.NewRequestWithContext(ctx, http.MethodHead, manifestURL, nil)
		// Accept all common manifest media types so the registry returns the
		// canonical digest regardless of which format the image uses.
		req.Header.Set("Accept", strings.Join([]string{
			"application/vnd.docker.distribution.manifest.v2+json",
			"application/vnd.docker.distribution.manifest.list.v2+json",
			"application/vnd.oci.image.manifest.v1+json",
			"application/vnd.oci.image.index.v1+json",
		}, ", "))
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		return client.Do(req)
	}

	resp, err := doHead("")
	if err != nil {
		return "", fmt.Errorf("registry HEAD failed: %w", err)
	}
	if resp.StatusCode == http.StatusUnauthorized {
		// Parse "WWW-Authenticate: Bearer realm=...,service=...,scope=..."
		challenge := resp.Header.Get("Www-Authenticate")
		resp.Body.Close()
		token, terr := fetchRegistryToken(ctx, client, challenge, parsed)
		if terr != nil {
			return "", fmt.Errorf("registry auth failed: %w", terr)
		}
		resp, err = doHead(token)
		if err != nil {
			return "", fmt.Errorf("registry HEAD (with token) failed: %w", err)
		}
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return "", fmt.Errorf("registry returned %s: %s", resp.Status, strings.TrimSpace(string(body)))
	}

	digest := resp.Header.Get("Docker-Content-Digest")
	if digest == "" {
		return "", fmt.Errorf("registry response missing Docker-Content-Digest header")
	}
	return digest, nil
}

// fetchRegistryToken implements the (minimal) Docker token-auth dance:
// parse the WWW-Authenticate challenge, GET realm?service=...&scope=..., and
// return the resulting Bearer token. When REGISTRY_USERNAME/PASSWORD are
// configured for this host, they are attached as HTTP Basic auth on the
// token request so private repos can be queried.
func fetchRegistryToken(ctx context.Context, client *http.Client, challenge string, ref parsedImageRef) (string, error) {
	const bearerPrefix = "Bearer "
	if !strings.HasPrefix(challenge, bearerPrefix) {
		// Many registries (e.g. Docker Hub) need an anonymous pull token. Build
		// a synthetic challenge so this path always works for known hosts.
		if ref.Registry == defaultRegistryHost {
			challenge = fmt.Sprintf(`Bearer realm="https://%s/token",service="registry.docker.io"`, defaultRegistryAuth)
		} else {
			return "", fmt.Errorf("unsupported auth challenge: %q", challenge)
		}
	}
	params := parseAuthChallenge(strings.TrimPrefix(challenge, bearerPrefix))

	realm := params["realm"]
	if realm == "" {
		return "", fmt.Errorf("auth challenge missing realm")
	}

	q := url.Values{}
	if svc := params["service"]; svc != "" {
		q.Set("service", svc)
	}
	scope := params["scope"]
	if scope == "" {
		scope = "repository:" + ref.Repo + ":pull"
	}
	q.Set("scope", scope)

	tokURL := realm
	if strings.Contains(realm, "?") {
		tokURL += "&" + q.Encode()
	} else {
		tokURL += "?" + q.Encode()
	}

	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, tokURL, nil)
	if user, pass := registryCredential(ref.Registry); user != "" && pass != "" {
		req.SetBasicAuth(user, pass)
	}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return "", fmt.Errorf("token endpoint returned %s: %s", resp.Status, strings.TrimSpace(string(body)))
	}
	var tok struct {
		Token       string `json:"token"`
		AccessToken string `json:"access_token"`
	}
	if err := common.DecodeJson(resp.Body, &tok); err != nil {
		return "", fmt.Errorf("decode token response: %w", err)
	}
	if tok.Token != "" {
		return tok.Token, nil
	}
	if tok.AccessToken != "" {
		return tok.AccessToken, nil
	}
	return "", fmt.Errorf("token endpoint returned no token field")
}

// parseAuthChallenge parses a comma-separated key="value" list as found in
// the WWW-Authenticate header. It tolerates quoted and unquoted values.
func parseAuthChallenge(s string) map[string]string {
	out := make(map[string]string)
	for _, part := range splitOutsideQuotes(s, ',') {
		kv := strings.SplitN(strings.TrimSpace(part), "=", 2)
		if len(kv) != 2 {
			continue
		}
		key := strings.TrimSpace(kv[0])
		val := strings.TrimSpace(kv[1])
		val = strings.Trim(val, `"`)
		out[key] = val
	}
	return out
}

func splitOutsideQuotes(s string, sep rune) []string {
	var out []string
	var cur strings.Builder
	inQuote := false
	for _, r := range s {
		switch {
		case r == '"':
			inQuote = !inQuote
			cur.WriteRune(r)
		case r == sep && !inQuote:
			out = append(out, cur.String())
			cur.Reset()
		default:
			cur.WriteRune(r)
		}
	}
	if cur.Len() > 0 {
		out = append(out, cur.String())
	}
	return out
}

// GetImageStatus aggregates local + remote digests into the structure the
// admin UI consumes. Non-fatal errors (e.g. remote registry unreachable)
// are surfaced via the Message field rather than returned as errors, so the
// UI can still show partial state.
//
// Watchtower reachability is probed unconditionally whenever we are running
// inside a container, so the UI can disable the "Upgrade now" button even
// when the registry check is failing (e.g. private image with no creds).
func GetImageStatus(ctx context.Context) ImageStatus {
	status := ImageStatus{
		NodeName:    os.Getenv("NODE_NAME"),
		InContainer: IsInContainer(),
		CheckedAt:   time.Now().Unix(),
	}

	if !status.InContainer {
		status.Message = "running outside docker; image checks unavailable"
		return status
	}
	status.UpgraderReady = WatchtowerReachable(ctx)

	imageRef, localDigest, err := inspectSelfContainer(ctx)
	if err != nil {
		logger.LogError(ctx, "image-status: inspect self failed: "+err.Error())
		status.Message = "self inspect failed: " + err.Error()
		return status
	}
	status.ImageRef = imageRef
	status.LocalDigest = localDigest

	remoteDigest, err := GetRemoteImageDigest(ctx, imageRef)
	if err != nil {
		logger.LogError(ctx, "image-status: remote digest failed: "+err.Error())
		status.Message = "remote check failed: " + err.Error()
		return status
	}
	status.RemoteDigest = remoteDigest

	// A nonempty local digest that differs from remote => update available.
	// If local digest is empty (image built locally, never pulled by digest)
	// we conservatively report "no update" — the operator can still trigger
	// upgrade manually if they know better.
	if localDigest != "" && remoteDigest != "" && localDigest != remoteDigest {
		status.HasUpdate = true
	}

	return status
}

// WatchtowerReachable probes the watchtower sidecar configured via the
// WATCHTOWER_URL env var. Returns true if any HTTP response (even an auth
// failure) comes back within the short timeout, false when the URL is
// unset or the sidecar is unreachable.
func WatchtowerReachable(ctx context.Context) bool {
	base := os.Getenv("WATCHTOWER_URL")
	if base == "" {
		return false
	}
	client := &http.Client{Timeout: 2 * time.Second}
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, strings.TrimRight(base, "/")+"/v1/metrics", nil)
	resp, err := client.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	// Any HTTP response (even 401) means the service is up.
	return resp.StatusCode > 0
}

// TriggerUpgrade asks watchtower to pull + recreate this container. Returns
// the watchtower response status. The actual update happens asynchronously;
// the caller should expect this container to be restarted shortly.
func TriggerUpgrade(ctx context.Context) error {
	base := os.Getenv("WATCHTOWER_URL")
	if base == "" {
		return fmt.Errorf("WATCHTOWER_URL is not configured")
	}
	token := os.Getenv("WATCHTOWER_TOKEN")
	if token == "" {
		return fmt.Errorf("WATCHTOWER_TOKEN is not configured")
	}

	client := &http.Client{Timeout: watchtowerTimeout}
	req, _ := http.NewRequestWithContext(ctx,
		http.MethodPost,
		strings.TrimRight(base, "/")+"/v1/update",
		nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("watchtower request failed: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return fmt.Errorf("watchtower returned %s: %s", resp.Status, strings.TrimSpace(string(body)))
	}
	return nil
}
