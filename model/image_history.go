package model

import (
	"gorm.io/gorm/clause"
)

// MaxImageHistory caps how many image-playground history items are retained
// per user. Older items are trimmed on insert. The frontend offline cache
// (IndexedDB) keeps fewer (30); this server cap is the cross-device source of
// truth.
const MaxImageHistory = 100

// ImageHistory is one image-playground history item, persisted per user so the
// playground syncs across devices. Heavy base64 (edit reference images/masks)
// is never stored — Data holds only the slimmed item JSON (params + COS URLs).
type ImageHistory struct {
	Id        int    `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId    int    `json:"user_id" gorm:"not null;index:idx_image_history_user_created,priority:1;uniqueIndex:idx_image_history_user_item,priority:1"`
	ItemId    string `json:"item_id" gorm:"type:varchar(64);not null;uniqueIndex:idx_image_history_user_item,priority:2"`
	CreatedAt int64  `json:"created_at" gorm:"bigint;index:idx_image_history_user_created,priority:2;autoCreateTime:false"`
	Data      string `json:"data" gorm:"type:text"`
}

func (ImageHistory) TableName() string {
	return "image_histories"
}

// GetImageHistory returns a user's history newest-first, capped at limit.
func GetImageHistory(userId int, limit int) ([]ImageHistory, error) {
	var rows []ImageHistory
	err := DB.Where("user_id = ?", userId).
		Order("created_at desc, id desc").
		Limit(limit).
		Find(&rows).Error
	return rows, err
}

// UpsertImageHistory inserts or updates one item keyed on (user_id, item_id),
// then trims the user's history back down to MaxImageHistory. The OnConflict
// clause is translated per-dialect by GORM (SQLite/MySQL/Postgres).
func UpsertImageHistory(userId int, itemId string, createdAt int64, data string) error {
	row := ImageHistory{
		UserId:    userId,
		ItemId:    itemId,
		CreatedAt: createdAt,
		Data:      data,
	}
	if err := DB.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "user_id"}, {Name: "item_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"created_at", "data"}),
	}).Create(&row).Error; err != nil {
		return err
	}
	return trimImageHistory(userId)
}

// trimImageHistory deletes the user's rows beyond the newest MaxImageHistory.
// Implemented as a plain id-select-then-delete (no subquery / no LIMIT in
// DELETE) so it is identical on all three databases.
func trimImageHistory(userId int) error {
	var ids []int
	err := DB.Model(&ImageHistory{}).
		Where("user_id = ?", userId).
		Order("created_at desc, id desc").
		Offset(MaxImageHistory).
		Limit(1000).
		Pluck("id", &ids).Error
	if err != nil {
		return err
	}
	if len(ids) == 0 {
		return nil
	}
	return DB.Where("id IN ?", ids).Delete(&ImageHistory{}).Error
}

func DeleteImageHistory(userId int, itemId string) error {
	return DB.Where("user_id = ? AND item_id = ?", userId, itemId).
		Delete(&ImageHistory{}).Error
}

func ClearImageHistory(userId int) error {
	return DB.Where("user_id = ?", userId).Delete(&ImageHistory{}).Error
}
