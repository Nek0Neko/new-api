package object_storage_setting

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/setting/config"
)

// COSConfig holds Tencent Cloud Object Storage credentials and options.
// Persisted via the options table as keys "tencent_cos.<json tag>".
type COSConfig struct {
	Enabled      bool   `json:"enabled"`
	SecretID     string `json:"secret_id"`
	SecretKey    string `json:"secret_key"`
	Region       string `json:"region"`        // e.g. ap-guangzhou
	Bucket       string `json:"bucket"`        // bucket name incl. appid, e.g. mybucket-1250000000
	CustomDomain string `json:"custom_domain"` // optional CDN / custom domain, no trailing slash
	PathPrefix   string `json:"path_prefix"`   // object key prefix, default "images"
	// Accelerate routes uploads through COS Global Acceleration
	// (<bucket>.cos.accelerate.myqcloud.com) instead of the regional endpoint.
	// Requires "全球加速" to be enabled on the bucket in the COS console. Use this
	// when the server's upload throughput to the bucket's region is poor (cross
	// region / cross border), which otherwise makes large image PUTs time out.
	Accelerate bool `json:"accelerate"`
}

var cosConfig = COSConfig{
	PathPrefix: "images",
}

func init() {
	config.GlobalConfig.Register("tencent_cos", &cosConfig)
}

// GetCOSConfig returns the live config pointer.
func GetCOSConfig() *COSConfig {
	return &cosConfig
}

// PublicBase returns the base URL uploaded objects are served from: the custom /
// CDN domain when set, otherwise the regional bucket host. No trailing slash.
func (c *COSConfig) PublicBase() string {
	if base := strings.TrimRight(c.CustomDomain, "/"); base != "" {
		return base
	}
	return fmt.Sprintf("https://%s.cos.%s.myqcloud.com", c.Bucket, c.Region)
}

// OwnsURL reports whether u is already served from this bucket (custom domain or
// regional host), so re-hosting it to COS would be redundant.
func (c *COSConfig) OwnsURL(u string) bool {
	if u == "" {
		return false
	}
	if cd := strings.TrimRight(c.CustomDomain, "/"); cd != "" && strings.HasPrefix(u, cd) {
		return true
	}
	regional := fmt.Sprintf("https://%s.cos.%s.myqcloud.com", c.Bucket, c.Region)
	return strings.HasPrefix(u, regional)
}

// IsCOSEnabled reports whether COS image offloading is fully configured.
func IsCOSEnabled() bool {
	return cosConfig.Enabled &&
		cosConfig.SecretID != "" &&
		cosConfig.SecretKey != "" &&
		cosConfig.Bucket != "" &&
		cosConfig.Region != ""
}
