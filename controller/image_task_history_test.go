package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
)

func TestBuildLoadingHistoryItem(t *testing.T) {
	cfg := &imageHistoryConfig{Model: "dall-e-3", Size: "1024x1024", Quality: "high", OutputFormat: "png", Moderation: "auto", N: 4}
	data := buildLoadingHistoryItem("item-1", "task-9", "a cat", "dall-e-3", "1024x1024", "high", "generation", cfg, 1700)
	var got imageHistoryItem
	if err := common.UnmarshalJsonStr(data, &got); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if got.Id != "item-1" || got.TaskId != "task-9" || got.Status != "loading" {
		t.Fatalf("unexpected item: %+v", got)
	}
	if got.Prompt != "a cat" || got.Model != "dall-e-3" || got.Size != "1024x1024" || got.Quality != "high" || got.Mode != "generation" {
		t.Fatalf("unexpected fields: %+v", got)
	}
	if got.CreatedAt != 1700 {
		t.Fatalf("createdAt = %d", got.CreatedAt)
	}
	if got.Config == nil || got.Config.N != 4 || got.Config.OutputFormat != "png" || got.Config.Moderation != "auto" {
		t.Fatalf("config not recorded: %+v", got.Config)
	}
	if got.Images == nil || len(got.Images) != 0 {
		t.Fatalf("images should be empty non-nil slice, got %#v", got.Images)
	}
}

func TestExtractHistoryImagesKeepsUrlsDropsBase64(t *testing.T) {
	body := []byte(`{"created":1,"data":[{"url":"https://cos/x.png","revised_prompt":"r"},{"b64_json":"AAAA"},{"url":""}]}`)
	imgs := extractHistoryImages(body)
	if len(imgs) != 1 {
		t.Fatalf("want 1 url image, got %d (%#v)", len(imgs), imgs)
	}
	if imgs[0].Url != "https://cos/x.png" || imgs[0].RevisedPrompt != "r" {
		t.Fatalf("unexpected image: %+v", imgs[0])
	}
}

func TestExtractHistoryImagesEmptyOnGarbage(t *testing.T) {
	if got := extractHistoryImages([]byte("not json")); len(got) != 0 {
		t.Fatalf("want empty, got %#v", got)
	}
	if got := extractHistoryImages(nil); len(got) != 0 {
		t.Fatalf("want empty for nil, got %#v", got)
	}
}

func TestApplyTerminalSuccessPreservesParams(t *testing.T) {
	cfg := &imageHistoryConfig{Model: "dall-e-3", Size: "1024x1024", Quality: "high", N: 4}
	existing := buildLoadingHistoryItem("item-1", "task-9", "a cat", "dall-e-3", "1024x1024", "high", "generation", cfg, 1700)
	out, createdAt := applyTerminalHistoryItem(existing, fallbackHistoryFields{}, "success",
		[]historyImage{{Url: "https://cos/x.png"}}, "")
	if createdAt != 1700 {
		t.Fatalf("createdAt not preserved: %d", createdAt)
	}
	var got imageHistoryItem
	_ = common.UnmarshalJsonStr(out, &got)
	if got.Status != "success" || got.Prompt != "a cat" || len(got.Images) != 1 || got.ErrorMessage != "" {
		t.Fatalf("unexpected success item: %+v", got)
	}
	// The config snapshot recorded at submit time must survive the terminal patch.
	if got.Config == nil || got.Config.N != 4 {
		t.Fatalf("config not preserved through terminal patch: %+v", got.Config)
	}
}

func TestApplyTerminalErrorSetsMessage(t *testing.T) {
	existing := buildLoadingHistoryItem("item-1", "task-9", "a cat", "dall-e-3", "1024x1024", "high", "generation", nil, 1700)
	out, _ := applyTerminalHistoryItem(existing, fallbackHistoryFields{}, "error", nil, "boom")
	var got imageHistoryItem
	_ = common.UnmarshalJsonStr(out, &got)
	if got.Status != "error" || got.ErrorMessage != "boom" {
		t.Fatalf("unexpected error item: %+v", got)
	}
}

func TestApplyTerminalFallbackWhenNoExisting(t *testing.T) {
	out, createdAt := applyTerminalHistoryItem("", fallbackHistoryFields{
		Id: "item-1", TaskId: "task-9", Prompt: "p", Model: "m", Mode: "generation", CreatedAt: 42,
	}, "error", nil, "gone")
	if createdAt != 42 {
		t.Fatalf("createdAt = %d", createdAt)
	}
	var got imageHistoryItem
	_ = common.UnmarshalJsonStr(out, &got)
	if got.Id != "item-1" || got.TaskId != "task-9" || got.Prompt != "p" || got.Status != "error" || got.ErrorMessage != "gone" {
		t.Fatalf("unexpected fallback item: %+v", got)
	}
}
