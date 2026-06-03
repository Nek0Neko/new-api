// setting/object_storage_setting/cos.go
package object_storage_setting

import "github.com/QuantumNous/new-api/setting/config"

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

// Enabled reports whether COS image offloading is fully configured.
func Enabled() bool {
	return cosConfig.Enabled &&
		cosConfig.SecretID != "" &&
		cosConfig.SecretKey != "" &&
		cosConfig.Bucket != "" &&
		cosConfig.Region != ""
}
