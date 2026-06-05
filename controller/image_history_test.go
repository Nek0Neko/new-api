package controller

import "testing"

func TestValidateImageHistoryItem(t *testing.T) {
	url := imageHistoryImage{Url: "https://cos/x.png"}
	b64 := imageHistoryImage{B64Json: "AAAA"}
	cases := []struct {
		name    string
		status  string
		images  []imageHistoryImage
		wantErr bool
	}{
		{"success with a url image", "success", []imageHistoryImage{url}, false},
		{"success without any images", "success", nil, true},
		{"success with a url-less image", "success", []imageHistoryImage{{}}, true},
		{"error without images (persist its status)", "error", nil, false},
		{"error with a url image", "error", []imageHistoryImage{url}, false},
		{"base64 rejected on success", "success", []imageHistoryImage{b64}, true},
		{"base64 rejected on error", "error", []imageHistoryImage{b64}, true},
		{"in-flight status rejected", "loading", nil, true},
		{"unknown status rejected", "weird", nil, true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			err := validateImageHistoryItem(c.status, c.images)
			if (err != nil) != c.wantErr {
				t.Fatalf("validateImageHistoryItem(%q, %v) err=%v, wantErr=%v",
					c.status, c.images, err, c.wantErr)
			}
		})
	}
}
