package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// TestGetModelRequestImageTaskFetchSkipsChannel verifies that polling an async
// image task status (GET /v1/images/generations/tasks/:task_id) does NOT trigger
// channel selection. FetchImageTask is a pure DB lookup with no upstream call, so
// requiring a "dall-e" channel here wrongly 503s when the user's group has none.
func TestGetModelRequestImageTaskFetchSkipsChannel(t *testing.T) {
	gin.SetMode(gin.TestMode)

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	req := httptest.NewRequest(http.MethodGet, "/v1/images/generations/tasks/task_abc123", nil)
	c.Request = req

	_, shouldSelectChannel, err := getModelRequest(c)
	require.NoError(t, err)
	require.False(t, shouldSelectChannel, "image task poll GET must not select a channel")
}

func TestDistributeClearsDisabledAffinityAndFallsBack(t *testing.T) {
	gin.SetMode(gin.TestMode)

	originalDB := model.DB
	originalMemoryCacheEnabled := common.MemoryCacheEnabled
	setting := operation_setting.GetChannelAffinitySetting()
	originalAffinitySetting := *setting
	t.Cleanup(func() {
		model.DB = originalDB
		common.MemoryCacheEnabled = originalMemoryCacheEnabled
		*setting = originalAffinitySetting
		service.ClearChannelAffinityCacheAll()
	})

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.Ability{}))
	model.DB = db
	common.MemoryCacheEnabled = true
	service.ClearChannelAffinityCacheAll()

	*setting = operation_setting.ChannelAffinitySetting{
		Enabled:               true,
		SwitchOnSuccess:       true,
		KeepOnChannelDisabled: false,
		MaxEntries:            100_000,
		DefaultTTLSeconds:     3600,
		Rules: []operation_setting.ChannelAffinityRule{
			{
				Name:               "test disabled affinity",
				ModelRegex:         []string{"^gpt-5$"},
				PathRegex:          []string{"/v1/responses"},
				KeySources:         []operation_setting.ChannelAffinityKeySource{{Type: "gjson", Path: "prompt_cache_key"}},
				SkipRetryOnFailure: true,
				IncludeUsingGroup:  true,
				IncludeRuleName:    true,
			},
		},
	}

	priority := int64(0)
	weight := uint(1)
	require.NoError(t, db.Create(&model.Channel{
		Id:       101,
		Type:     constant.ChannelTypeOpenAI,
		Key:      "sk-disabled-later",
		Status:   common.ChannelStatusEnabled,
		Name:     "disabled later",
		Models:   "gpt-5",
		Group:    "default",
		Priority: &priority,
		Weight:   &weight,
	}).Error)
	require.NoError(t, db.Create(&model.Ability{
		Group:     "default",
		Model:     "gpt-5",
		ChannelId: 101,
		Enabled:   true,
		Priority:  &priority,
		Weight:    weight,
	}).Error)
	model.InitChannelCache()

	router := gin.New()
	router.Use(func(c *gin.Context) {
		common.SetContextKey(c, constant.ContextKeyUsingGroup, "default")
		c.Next()
	})
	router.Use(Distribute())
	router.POST("/v1/responses", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"channel_id": c.GetInt("channel_id")})
	})

	body := `{"model":"gpt-5","prompt_cache_key":"affinity-disabled-channel"}`
	first := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/v1/responses", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(first, req)
	require.Equal(t, http.StatusOK, first.Code)
	require.Equal(t, 101, responseChannelID(t, first))
	require.Equal(t, 101, preferredAffinityChannelID(t, body))

	require.NoError(t, db.Model(&model.Channel{}).Where("id = ?", 101).Update("status", common.ChannelStatusManuallyDisabled).Error)
	require.NoError(t, db.Create(&model.Channel{
		Id:       102,
		Type:     constant.ChannelTypeOpenAI,
		Key:      "sk-enabled-fallback",
		Status:   common.ChannelStatusEnabled,
		Name:     "enabled fallback",
		Models:   "gpt-5",
		Group:    "default",
		Priority: &priority,
		Weight:   &weight,
	}).Error)
	require.NoError(t, db.Create(&model.Ability{
		Group:     "default",
		Model:     "gpt-5",
		ChannelId: 102,
		Enabled:   true,
		Priority:  &priority,
		Weight:    weight,
	}).Error)
	model.InitChannelCache()

	second := httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPost, "/v1/responses", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(second, req)
	require.Equal(t, http.StatusOK, second.Code)
	require.Equal(t, 102, responseChannelID(t, second))
	require.Equal(t, 102, preferredAffinityChannelID(t, body))
}

func responseChannelID(t *testing.T, recorder *httptest.ResponseRecorder) int {
	t.Helper()

	var response struct {
		ChannelID int `json:"channel_id"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	return response.ChannelID
}

func preferredAffinityChannelID(t *testing.T, body string) int {
	t.Helper()

	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", strings.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")

	channelID, found := service.GetPreferredChannelByAffinity(ctx, "gpt-5", "default")
	require.True(t, found)
	return channelID
}
