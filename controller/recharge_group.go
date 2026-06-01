package controller

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

func GetRechargeGroupList(c *gin.Context) {
	groups, err := model.GetAllRechargeGroups()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"groups": groups})
}

func CreateRechargeGroup(c *gin.Context) {
	var g model.RechargeGroup
	if err := c.ShouldBindJSON(&g); err != nil {
		common.ApiError(c, err)
		return
	}
	if g.Name == "" {
		common.ApiErrorMsg(c, "分组名称不能为空")
		return
	}
	if dup, err := model.IsRechargeGroupNameDuplicated(0, g.Name); err != nil {
		common.ApiError(c, err)
		return
	} else if dup {
		common.ApiErrorMsg(c, "分组名称已存在")
		return
	}
	if g.TopupRatio == 0 {
		g.TopupRatio = 1
	}
	if g.TopupRatio < 0 {
		common.ApiErrorMsg(c, "充值倍率不能为负")
		return
	}
	if err := g.Insert(); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.SyncRechargeGroupsToOptions(); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, &g)
}

func UpdateRechargeGroup(c *gin.Context) {
	name := c.Param("name")
	existing, err := model.GetRechargeGroupByName(name)
	if err != nil {
		common.ApiErrorMsg(c, "分组不存在")
		return
	}
	var in model.RechargeGroup
	if err := c.ShouldBindJSON(&in); err != nil {
		common.ApiError(c, err)
		return
	}
	if in.TopupRatio < 0 {
		common.ApiErrorMsg(c, "充值倍率不能为负")
		return
	}
	existing.Description = in.Description
	existing.TopupRatio = in.TopupRatio
	if existing.TopupRatio == 0 {
		existing.TopupRatio = 1
	}
	existing.AutoUpgrade = in.AutoUpgrade
	existing.UpgradeThreshold = in.UpgradeThreshold
	existing.AdminOnly = in.AdminOnly
	if err := existing.Update(); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.SyncRechargeGroupsToOptions(); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, existing)
}

func DeleteRechargeGroup(c *gin.Context) {
	name := c.Param("name")
	// Refuse to delete a recharge group still referenced by any user.Group.
	var inUse int64
	if err := model.DB.Model(&model.User{}).
		Where(map[string]interface{}{"group": name}).Count(&inUse).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	if inUse > 0 {
		common.ApiErrorMsg(c, "该充值分组仍被用户使用，无法删除")
		return
	}
	if err := model.DeleteRechargeGroupByName(name); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.SyncRechargeGroupsToOptions(); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"name": name})
}
