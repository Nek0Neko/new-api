package model

import (
	"fmt"
	"testing"

	"github.com/QuantumNous/new-api/common"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func setupImageHistoryTestDB(t *testing.T) {
	t.Helper()
	dsn := "file:" + t.Name() + "?mode=memory&cache=shared"
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&ImageHistory{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	prevDB := DB
	DB = db
	t.Cleanup(func() { DB = prevDB })
	common.UsingSQLite = true
}

func TestUpsertImageHistory_IsIdempotentPerItem(t *testing.T) {
	setupImageHistoryTestDB(t)
	if err := UpsertImageHistory(1, "img-a", 100, `{"id":"img-a","v":1}`); err != nil {
		t.Fatalf("first upsert: %v", err)
	}
	if err := UpsertImageHistory(1, "img-a", 200, `{"id":"img-a","v":2}`); err != nil {
		t.Fatalf("second upsert: %v", err)
	}
	rows, err := GetImageHistory(1, 100)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if len(rows) != 1 {
		t.Fatalf("expected 1 row after re-upsert, got %d", len(rows))
	}
	if rows[0].Data != `{"id":"img-a","v":2}` || rows[0].CreatedAt != 200 {
		t.Fatalf("expected updated data/created_at, got %+v", rows[0])
	}
}

func TestUpsertImageHistory_TrimsToMax(t *testing.T) {
	setupImageHistoryTestDB(t)
	for i := 0; i < MaxImageHistory+5; i++ {
		itemId := fmt.Sprintf("img-%03d", i)
		if err := UpsertImageHistory(7, itemId, int64(i), `{}`); err != nil {
			t.Fatalf("upsert %d: %v", i, err)
		}
	}
	rows, err := GetImageHistory(7, 1000)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if len(rows) != MaxImageHistory {
		t.Fatalf("expected %d rows after trim, got %d", MaxImageHistory, len(rows))
	}
	if rows[0].ItemId != fmt.Sprintf("img-%03d", MaxImageHistory+4) {
		t.Fatalf("expected newest first, got %s", rows[0].ItemId)
	}
	if rows[len(rows)-1].CreatedAt != 5 {
		t.Fatalf("expected oldest surviving created_at=5, got %d", rows[len(rows)-1].CreatedAt)
	}
}

func TestImageHistory_UserIsolationAndDelete(t *testing.T) {
	setupImageHistoryTestDB(t)
	_ = UpsertImageHistory(1, "a", 1, `{}`)
	_ = UpsertImageHistory(2, "a", 1, `{}`)
	if rows, _ := GetImageHistory(1, 100); len(rows) != 1 {
		t.Fatalf("user 1 should see only its own row, got %d", len(rows))
	}
	if err := DeleteImageHistory(1, "a"); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if rows, _ := GetImageHistory(1, 100); len(rows) != 0 {
		t.Fatalf("user 1 row should be gone, got %d", len(rows))
	}
	if rows, _ := GetImageHistory(2, 100); len(rows) != 1 {
		t.Fatalf("user 2 row must survive user 1 delete, got %d", len(rows))
	}
	if err := ClearImageHistory(2); err != nil {
		t.Fatalf("clear: %v", err)
	}
	if rows, _ := GetImageHistory(2, 100); len(rows) != 0 {
		t.Fatalf("user 2 should be cleared, got %d", len(rows))
	}
}
