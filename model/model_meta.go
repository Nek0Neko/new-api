package model

import (
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

const (
	NameRuleExact = iota
	NameRulePrefix
	NameRuleContains
	NameRuleSuffix
)

type BoundChannel struct {
	Name string `json:"name"`
	Type int    `json:"type"`
}

type Model struct {
	Id           int            `json:"id"`
	ModelName    string         `json:"model_name" gorm:"size:128;not null;uniqueIndex:uk_model_name_delete_at,priority:1"`
	Description  string         `json:"description,omitempty" gorm:"type:text"`
	Icon         string         `json:"icon,omitempty" gorm:"type:varchar(128)"`
	Tags         string         `json:"tags,omitempty" gorm:"type:varchar(255)"`
	VendorID     int            `json:"vendor_id,omitempty" gorm:"index"`
	Endpoints    string         `json:"endpoints,omitempty" gorm:"type:text"`
	Status       int            `json:"status" gorm:"default:1"`
	SyncOfficial int            `json:"sync_official" gorm:"default:1"`
	CreatedTime  int64          `json:"created_time" gorm:"bigint"`
	UpdatedTime  int64          `json:"updated_time" gorm:"bigint"`
	DeletedAt    gorm.DeletedAt `json:"-" gorm:"index;uniqueIndex:uk_model_name_delete_at,priority:2"`

	// EnableGroupsRaw is the admin-configured allow-list of user groups, stored
	// as a comma-separated string. When non-empty, only listed groups are
	// allowed to use this model (intersected with channel availability). When
	// empty, the legacy channel-derived behavior is preserved.
	EnableGroupsRaw string `json:"-" gorm:"column:enable_groups_raw;type:varchar(255)"`

	BoundChannels []BoundChannel `json:"bound_channels,omitempty" gorm:"-"`
	// EnableGroups exposes the effective allow-list: the admin-configured
	// override when set, else the channel-derived runtime set. Kept for
	// backwards-compatible table rendering and pricing display.
	EnableGroups []string `json:"enable_groups,omitempty" gorm:"-"`
	// EnableGroupsConfig exposes only the admin-configured override (empty
	// when no override is set). The mutate form binds to this field so an
	// unconfigured model does not get its channel-derived groups locked in
	// when an admin opens and re-saves the form without changes.
	EnableGroupsConfig []string `json:"enable_groups_config" gorm:"-"`
	QuotaTypes         []int    `json:"quota_types,omitempty" gorm:"-"`
	NameRule           int      `json:"name_rule" gorm:"default:0"`

	MatchedModels []string `json:"matched_models,omitempty" gorm:"-"`
	MatchedCount  int      `json:"matched_count,omitempty" gorm:"-"`
}

// EnableGroupsConfigured returns the admin-configured allow-list parsed from
// the persisted EnableGroupsRaw field. Returns an empty slice when no groups
// have been configured.
func (mi *Model) EnableGroupsConfigured() []string {
	return parseEnableGroupsRaw(mi.EnableGroupsRaw)
}

// SyncEnableGroupsRaw flattens the runtime EnableGroupsConfig slice into the
// persisted EnableGroupsRaw column. Call this before Insert/Update when the
// admin has supplied a fresh allow-list via JSON binding. The effective
// EnableGroups slice (which may include channel-derived entries) is ignored.
func (mi *Model) SyncEnableGroupsRaw() {
	mi.EnableGroupsRaw = formatEnableGroupsRaw(mi.EnableGroupsConfig)
}

func parseEnableGroupsRaw(raw string) []string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	seen := make(map[string]struct{}, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		if _, ok := seen[p]; ok {
			continue
		}
		seen[p] = struct{}{}
		out = append(out, p)
	}
	return out
}

// intersectGroups returns the intersection of two group slices, preserving
// the order of the first slice. Returns nil when either input is empty.
func intersectGroups(a, b []string) []string {
	if len(a) == 0 || len(b) == 0 {
		return nil
	}
	allow := make(map[string]struct{}, len(b))
	for _, g := range b {
		allow[g] = struct{}{}
	}
	out := make([]string, 0, len(a))
	for _, g := range a {
		if _, ok := allow[g]; ok {
			out = append(out, g)
		}
	}
	return out
}

func formatEnableGroupsRaw(groups []string) string {
	if len(groups) == 0 {
		return ""
	}
	cleaned := make([]string, 0, len(groups))
	seen := make(map[string]struct{}, len(groups))
	for _, g := range groups {
		g = strings.TrimSpace(g)
		if g == "" {
			continue
		}
		if _, ok := seen[g]; ok {
			continue
		}
		seen[g] = struct{}{}
		cleaned = append(cleaned, g)
	}
	return strings.Join(cleaned, ",")
}

func (mi *Model) Insert() error {
	now := common.GetTimestamp()
	mi.CreatedTime = now
	mi.UpdatedTime = now
	mi.SyncEnableGroupsRaw()

	// 保存原始值（因为 Create 后可能被 GORM 的 default 标签覆盖为 1）
	originalStatus := mi.Status
	originalSyncOfficial := mi.SyncOfficial

	// 先创建记录（GORM 会对零值字段应用默认值）
	if err := DB.Create(mi).Error; err != nil {
		return err
	}

	// 使用保存的原始值进行更新，确保零值能正确保存
	return DB.Model(&Model{}).Where("id = ?", mi.Id).Updates(map[string]interface{}{
		"status":        originalStatus,
		"sync_official": originalSyncOfficial,
	}).Error
}

func IsModelNameDuplicated(id int, name string) (bool, error) {
	if name == "" {
		return false, nil
	}
	var cnt int64
	err := DB.Model(&Model{}).Where("model_name = ? AND id <> ?", name, id).Count(&cnt).Error
	return cnt > 0, err
}

func (mi *Model) Update() error {
	mi.UpdatedTime = common.GetTimestamp()
	mi.SyncEnableGroupsRaw()
	// 使用 Select 强制更新所有字段，包括零值
	return DB.Model(&Model{}).Where("id = ?", mi.Id).
		Select("model_name", "description", "icon", "tags", "vendor_id", "endpoints", "status", "sync_official", "name_rule", "enable_groups_raw", "updated_time").
		Updates(mi).Error
}

func (mi *Model) Delete() error {
	return DB.Delete(mi).Error
}

func GetVendorModelCounts() (map[int64]int64, error) {
	var stats []struct {
		VendorID int64
		Count    int64
	}
	if err := DB.Model(&Model{}).
		Select("vendor_id as vendor_id, count(*) as count").
		Group("vendor_id").
		Scan(&stats).Error; err != nil {
		return nil, err
	}
	m := make(map[int64]int64, len(stats))
	for _, s := range stats {
		m[s.VendorID] = s.Count
	}
	return m, nil
}

func GetAllModels(offset int, limit int) ([]*Model, error) {
	var models []*Model
	err := DB.Order("id DESC").Offset(offset).Limit(limit).Find(&models).Error
	return models, err
}

func GetBoundChannelsByModelsMap(modelNames []string) (map[string][]BoundChannel, error) {
	result := make(map[string][]BoundChannel)
	if len(modelNames) == 0 {
		return result, nil
	}
	type row struct {
		Model string
		Name  string
		Type  int
	}
	var rows []row
	err := DB.Table("channels").
		Select("abilities.model as model, channels.name as name, channels.type as type").
		Joins("JOIN abilities ON abilities.channel_id = channels.id").
		Where("abilities.model IN ? AND abilities.enabled = ?", modelNames, true).
		Distinct().
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	for _, r := range rows {
		result[r.Model] = append(result[r.Model], BoundChannel{Name: r.Name, Type: r.Type})
	}
	return result, nil
}

// GetModelTagsByNames returns the comma-separated tag string for each named
// model. Models without a row in the models table are simply absent from the
// returned map (the caller should treat them as untagged).
func GetModelTagsByNames(names []string) (map[string]string, error) {
	result := make(map[string]string, len(names))
	if len(names) == 0 {
		return result, nil
	}
	var rows []struct {
		ModelName string
		Tags      string
	}
	if err := DB.Model(&Model{}).
		Select("model_name, tags").
		Where("model_name IN ?", names).
		Scan(&rows).Error; err != nil {
		return nil, err
	}
	for _, r := range rows {
		result[r.ModelName] = r.Tags
	}
	return result, nil
}

func normalizeLookupValues(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	normalized := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		normalized = append(normalized, value)
	}
	return normalized
}

func GetPreferredModelOwnerChannelTypes(modelNames []string, groups []string) (map[string]int, error) {
	result := make(map[string]int)
	modelNames = normalizeLookupValues(modelNames)
	if len(modelNames) == 0 {
		return result, nil
	}

	type row struct {
		Model       string
		ChannelType int
	}
	var rows []row

	query := DB.Table("abilities").
		Select("abilities.model as model, channels.type as channel_type").
		Joins("JOIN channels ON abilities.channel_id = channels.id").
		Where("abilities.model IN ? AND abilities.enabled = ? AND channels.status = ?", modelNames, true, common.ChannelStatusEnabled).
		Order("COALESCE(abilities.priority, 0) DESC").
		Order("abilities.weight DESC").
		Order("abilities.channel_id ASC")

	groups = normalizeLookupValues(groups)
	if len(groups) > 0 {
		query = query.Where("abilities."+commonGroupCol+" IN ?", groups)
	}

	if err := query.Scan(&rows).Error; err != nil {
		return nil, err
	}

	for _, r := range rows {
		if _, ok := result[r.Model]; ok {
			continue
		}
		result[r.Model] = r.ChannelType
	}
	return result, nil
}

func SearchModels(keyword string, vendor string, offset int, limit int) ([]*Model, int64, error) {
	var models []*Model
	db := DB.Model(&Model{})
	if keyword != "" {
		like := "%" + keyword + "%"
		db = db.Where("model_name LIKE ? OR description LIKE ? OR tags LIKE ?", like, like, like)
	}
	if vendor != "" {
		if vid, err := strconv.Atoi(vendor); err == nil {
			db = db.Where("models.vendor_id = ?", vid)
		} else {
			db = db.Joins("JOIN vendors ON vendors.id = models.vendor_id").Where("vendors.name LIKE ?", "%"+vendor+"%")
		}
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if err := db.Order("models.id DESC").Offset(offset).Limit(limit).Find(&models).Error; err != nil {
		return nil, 0, err
	}
	return models, total, nil
}
