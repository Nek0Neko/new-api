package model

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
)

// ConsumptionGroup is the source of truth for a 消费分组 (consumption group). Users
// reference many by name via User.ConsumptionGroups. Channels attach via
// Channel.Group CSV (Ability table). Writes go through SyncConsumptionGroupsToOptions,
// which re-derives GroupRatio / UserUsableGroups / AutoGroups.
type ConsumptionGroup struct {
	Id               int     `json:"id" gorm:"primaryKey"`
	Name             string  `json:"name" gorm:"type:varchar(64);uniqueIndex;not null"`
	Description      string  `json:"description" gorm:"type:text"`
	ConsumptionRatio float64 `json:"consumption_ratio" gorm:"default:1"`
	Visibility       string  `json:"visibility" gorm:"type:varchar(16);default:'public'"`
	AdminOnly        bool    `json:"admin_only" gorm:"default:false"`
	InAutoRotation   bool    `json:"in_auto_rotation" gorm:"default:false"`
	AutoOrder        int     `json:"auto_order" gorm:"default:0"`
	CreatedTime      int64   `json:"created_time" gorm:"bigint"`
	UpdatedTime      int64   `json:"updated_time" gorm:"bigint"`
}

func (g *ConsumptionGroup) Insert() error {
	now := common.GetTimestamp()
	g.CreatedTime = now
	g.UpdatedTime = now
	if g.Visibility == "" {
		g.Visibility = setting.GroupVisibilityPublic
	}
	return DB.Create(g).Error
}

func (g *ConsumptionGroup) Update() error {
	g.UpdatedTime = common.GetTimestamp()
	return DB.Save(g).Error
}

func GetAllConsumptionGroups() ([]*ConsumptionGroup, error) {
	var groups []*ConsumptionGroup
	err := DB.Model(&ConsumptionGroup{}).Order("name asc").Find(&groups).Error
	return groups, err
}

func GetConsumptionGroupByName(name string) (*ConsumptionGroup, error) {
	var g ConsumptionGroup
	err := DB.Where("name = ?", name).First(&g).Error
	if err != nil {
		return nil, err
	}
	return &g, nil
}

func IsConsumptionGroupNameDuplicated(id int, name string) (bool, error) {
	if name == "" {
		return false, nil
	}
	var cnt int64
	err := DB.Model(&ConsumptionGroup{}).Where("name = ? AND id <> ?", name, id).Count(&cnt).Error
	return cnt > 0, err
}

func DeleteConsumptionGroupByName(name string) error {
	return DB.Where("name = ?", name).Delete(&ConsumptionGroup{}).Error
}
