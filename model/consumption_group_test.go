package model

import "testing"

func TestConsumptionGroupInsertAndGet(t *testing.T) {
	setupGroupTestDB(t)
	g := &ConsumptionGroup{Name: "default", ConsumptionRatio: 1, Visibility: "public", InAutoRotation: true, AutoOrder: 1}
	if err := g.Insert(); err != nil {
		t.Fatalf("insert: %v", err)
	}
	got, err := GetConsumptionGroupByName("default")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.ConsumptionRatio != 1 || got.Visibility != "public" || !got.InAutoRotation || got.AutoOrder != 1 {
		t.Fatalf("unexpected row: %+v", got)
	}
}
