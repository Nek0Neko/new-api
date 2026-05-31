package model

import (
	"sort"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

// Group is the single source of truth for a channel group. Each row consolidates
// the per-group attributes that were previously scattered across the Option-table
// JSON blobs GroupRatio / TopupGroupRatio / UserUsableGroups / AutoGroups.
//
// Writes go through SyncGroupsToOptions, which re-derives those four blobs from the
// full table and persists them via UpdateOption, so billing/routing/auth hot paths
// keep reading the in-memory settings unchanged.
type Group struct {
	Id               int     `json:"id" gorm:"primaryKey"`
	Name             string  `json:"name" gorm:"type:varchar(64);uniqueIndex;not null"`
	Description      string  `json:"description" gorm:"type:text"`
	ConsumptionRatio float64 `json:"consumption_ratio" gorm:"default:1"` // -> GroupRatio
	TopupRatio       float64 `json:"topup_ratio" gorm:"default:0"`       // -> TopupGroupRatio (0 = unset)
	Visibility       string  `json:"visibility" gorm:"type:varchar(16);default:'public'"`
	AdminOnly        bool    `json:"admin_only" gorm:"default:false"`
	AutoUpgrade      bool    `json:"auto_upgrade" gorm:"default:false"`
	UpgradeThreshold int64   `json:"upgrade_threshold" gorm:"bigint;default:0"`
	InAutoRotation   bool    `json:"in_auto_rotation" gorm:"default:false"`
	AutoOrder        int     `json:"auto_order" gorm:"default:0"`
	CreatedTime      int64   `json:"created_time" gorm:"bigint"`
	UpdatedTime      int64   `json:"updated_time" gorm:"bigint"`
}

func (g *Group) Insert() error {
	now := common.GetTimestamp()
	g.CreatedTime = now
	g.UpdatedTime = now
	return DB.Create(g).Error
}

func (g *Group) Update() error {
	g.UpdatedTime = common.GetTimestamp()
	return DB.Save(g).Error
}

func GetAllGroups() ([]*Group, error) {
	var groups []*Group
	err := DB.Model(&Group{}).Order("name asc").Find(&groups).Error
	return groups, err
}

func GetGroupByName(name string) (*Group, error) {
	var g Group
	err := DB.Where("name = ?", name).First(&g).Error
	if err != nil {
		return nil, err
	}
	return &g, nil
}

func IsGroupNameDuplicated(id int, name string) (bool, error) {
	if name == "" {
		return false, nil
	}
	var cnt int64
	err := DB.Model(&Group{}).Where("name = ? AND id <> ?", name, id).Count(&cnt).Error
	return cnt > 0, err
}

func DeleteGroupByName(name string) error {
	return DB.Where("name = ?", name).Delete(&Group{}).Error
}

// BackfillGroupsFromSettings populates the groups table from the current in-memory
// settings on first run. It is idempotent: if any group rows already exist it is a
// no-op, so it is safe to call on every startup.
func BackfillGroupsFromSettings() error {
	var cnt int64
	if err := DB.Model(&Group{}).Count(&cnt).Error; err != nil {
		return err
	}
	if cnt > 0 {
		return nil
	}

	ratios := ratio_setting.GetGroupRatioCopy()
	metas := setting.GetUserUsableGroupMetaCopy()
	autoOrder := map[string]int{}
	for i, name := range setting.GetAutoGroups() {
		autoOrder[name] = i + 1
	}
	topups := map[string]float64{}
	_ = common.Unmarshal([]byte(common.TopupGroupRatio2JSONString()), &topups)

	names := map[string]struct{}{}
	for n := range ratios {
		names[n] = struct{}{}
	}
	for n := range metas {
		names[n] = struct{}{}
	}
	for n := range topups {
		names[n] = struct{}{}
	}
	for n := range autoOrder {
		names[n] = struct{}{}
	}

	for name := range names {
		g := &Group{Name: name, ConsumptionRatio: 1, Visibility: setting.GroupVisibilityPublic}
		if r, ok := ratios[name]; ok {
			g.ConsumptionRatio = r
		}
		if r, ok := topups[name]; ok {
			g.TopupRatio = r
		}
		if m, ok := metas[name]; ok {
			g.Description = m.Description
			if m.Visibility != "" {
				g.Visibility = m.Visibility
			}
			g.AdminOnly = m.AdminOnly
			g.AutoUpgrade = m.AutoUpgrade
			g.UpgradeThreshold = m.UpgradeThreshold
		}
		if ord, ok := autoOrder[name]; ok {
			g.InAutoRotation = true
			g.AutoOrder = ord
		}
		if err := g.Insert(); err != nil {
			return err
		}
	}
	return nil
}

// SyncGroupsToOptions re-derives the four group-related Option JSON blobs from the
// full groups table and persists them via UpdateOption (DB write + in-memory
// refresh). Call after every group create/update/delete so hot paths see a coherent
// picture without any change to their read code.
func SyncGroupsToOptions() error {
	groups, err := GetAllGroups()
	if err != nil {
		return err
	}

	groupRatio := map[string]float64{}
	topupRatio := map[string]float64{}
	usable := map[string]setting.GroupMeta{}

	type autoEntry struct {
		name  string
		order int
	}
	var autoList []autoEntry

	for _, g := range groups {
		groupRatio[g.Name] = g.ConsumptionRatio
		if g.TopupRatio > 0 {
			topupRatio[g.Name] = g.TopupRatio
		}
		usable[g.Name] = setting.GroupMeta{
			Description:      g.Description,
			Visibility:       g.Visibility,
			AdminOnly:        g.AdminOnly,
			AutoUpgrade:      g.AutoUpgrade,
			UpgradeThreshold: g.UpgradeThreshold,
		}
		if g.InAutoRotation {
			autoList = append(autoList, autoEntry{g.Name, g.AutoOrder})
		}
	}

	sort.SliceStable(autoList, func(i, j int) bool { return autoList[i].order < autoList[j].order })
	autoNames := make([]string, 0, len(autoList))
	for _, e := range autoList {
		autoNames = append(autoNames, e.name)
	}

	groupRatioJSON, err := common.Marshal(groupRatio)
	if err != nil {
		return err
	}
	topupJSON, err := common.Marshal(topupRatio)
	if err != nil {
		return err
	}
	usableJSON, err := common.Marshal(usable)
	if err != nil {
		return err
	}
	autoJSON, err := common.Marshal(autoNames)
	if err != nil {
		return err
	}

	if err := UpdateOption("GroupRatio", string(groupRatioJSON)); err != nil {
		return err
	}
	if err := UpdateOption("TopupGroupRatio", string(topupJSON)); err != nil {
		return err
	}
	if err := UpdateOption("UserUsableGroups", string(usableJSON)); err != nil {
		return err
	}
	if err := UpdateOption("AutoGroups", string(autoJSON)); err != nil {
		return err
	}
	return nil
}
