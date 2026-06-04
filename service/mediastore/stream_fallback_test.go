package mediastore

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
)

func TestImageStreamEventType(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want string
	}{
		{"partial", `{"type":"image_generation.partial_image","b64_json":"AAA"}`, "image_generation.partial_image"},
		{"completed", `{"type":"image_edit.completed","b64_json":"AAA"}`, "image_edit.completed"},
		{"done", "[DONE]", ""},
		{"blank", "  ", ""},
		{"non-json", "not json", ""},
		{"no-type", `{"b64_json":"AAA"}`, ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := ImageStreamEventType(tc.in); got != tc.want {
				t.Fatalf("ImageStreamEventType(%q) = %q, want %q", tc.in, got, tc.want)
			}
		})
	}
}

func TestSynthesizeCompletedImageEvent_FromPartial(t *testing.T) {
	in := `{"type":"image_generation.partial_image","partial_image_index":1,"b64_json":"AAA","revised_prompt":"rp"}`

	out, ok := SynthesizeCompletedImageEvent(in)
	if !ok {
		t.Fatalf("expected synthesis to succeed")
	}
	var m map[string]any
	if err := common.UnmarshalJsonStr(out, &m); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if m["type"] != "image_generation.completed" {
		t.Fatalf("type = %v, want image_generation.completed", m["type"])
	}
	if m["b64_json"] != "AAA" {
		t.Fatalf("b64_json = %v, want AAA", m["b64_json"])
	}
	if m["revised_prompt"] != "rp" {
		t.Fatalf("revised_prompt must be preserved, got %v", m["revised_prompt"])
	}
	if _, ok := m["partial_image_index"]; ok {
		t.Fatalf("partial_image_index must be dropped on the synthesized completed event")
	}
}

func TestSynthesizeCompletedImageEvent_EditNamespace(t *testing.T) {
	in := `{"type":"image_edit.partial_image","b64_json":"AAA"}`
	out, ok := SynthesizeCompletedImageEvent(in)
	if !ok {
		t.Fatalf("expected synthesis to succeed")
	}
	if !strings.Contains(out, `"image_edit.completed"`) {
		t.Fatalf("edit partial must map to image_edit.completed, got %s", out)
	}
}

func TestSynthesizeCompletedImageEvent_RejectsNonPartial(t *testing.T) {
	if _, ok := SynthesizeCompletedImageEvent(`{"type":"image_generation.completed","b64_json":"AAA"}`); ok {
		t.Fatalf("a completed event must not be re-synthesized")
	}
	if _, ok := SynthesizeCompletedImageEvent("[DONE]"); ok {
		t.Fatalf("[DONE] must not synthesize")
	}
}

func TestSynthesizeCompletedImageEvent_RejectsPartialWithoutImage(t *testing.T) {
	if _, ok := SynthesizeCompletedImageEvent(`{"type":"image_generation.partial_image","partial_image_index":0}`); ok {
		t.Fatalf("a partial without b64_json/url has no image to promote")
	}
}
