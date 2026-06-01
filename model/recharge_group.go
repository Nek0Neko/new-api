package model

import "github.com/QuantumNous/new-api/common"

// RechargeGroup is the source of truth for a 充值分组 (recharge group). Each user
// references exactly one by name via User.Group. Writes go through
// SyncRechargeGroupsToOptions, which re-derives the TopupGroupRatio and
// RechargeGroupMeta Option blobs so recharge/upgrade hot paths read unchanged.
type RechargeGroup struct {
	Id               int     `json:"id" gorm:"primaryKey"`
	Name             string  `json:"name" gorm:"type:varchar(64);uniqueIndex;not null"`
	Description      string  `json:"description" gorm:"type:text"`
	TopupRatio       float64 `json:"topup_ratio" gorm:"default:1"`
	AutoUpgrade      bool    `json:"auto_upgrade" gorm:"default:false"`
	UpgradeThreshold int64   `json:"upgrade_threshold" gorm:"bigint;default:0"`
	AdminOnly        bool    `json:"admin_only" gorm:"default:false"`
	CreatedTime      int64   `json:"created_time" gorm:"bigint"`
	UpdatedTime      int64   `json:"updated_time" gorm:"bigint"`
}

func (g *RechargeGroup) Insert() error {
	now := common.GetTimestamp()
	g.CreatedTime = now
	g.UpdatedTime = now
	return DB.Create(g).Error
}

func (g *RechargeGroup) Update() error {
	g.UpdatedTime = common.GetTimestamp()
	return DB.Save(g).Error
}

func GetAllRechargeGroups() ([]*RechargeGroup, error) {
	var groups []*RechargeGroup
	err := DB.Model(&RechargeGroup{}).Order("name asc").Find(&groups).Error
	return groups, err
}

func GetRechargeGroupByName(name string) (*RechargeGroup, error) {
	var g RechargeGroup
	err := DB.Where("name = ?", name).First(&g).Error
	if err != nil {
		return nil, err
	}
	return &g, nil
}

func IsRechargeGroupNameDuplicated(id int, name string) (bool, error) {
	if name == "" {
		return false, nil
	}
	var cnt int64
	err := DB.Model(&RechargeGroup{}).Where("name = ? AND id <> ?", name, id).Count(&cnt).Error
	return cnt > 0, err
}

func DeleteRechargeGroupByName(name string) error {
	return DB.Where("name = ?", name).Delete(&RechargeGroup{}).Error
}
