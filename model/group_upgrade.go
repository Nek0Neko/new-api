package model

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// MaybeUpgradeUserGroup is invoked inside a topup-completion transaction.
// It accumulates rmbCent into User.TotalTopupAmount and, if the new total
// crosses an auto-upgrade threshold, promotes the user's Group.
//
// Behavior:
//   - If the user is in an admin-only group (e.g. enterprise) the auto-upgrade
//     is skipped — admin assignments are sticky. The accumulator still advances
//     so historical totals stay accurate.
//   - Among groups with auto_upgrade=true, picks the one with the highest
//     UpgradeThreshold ≤ newTotal, and only promotes if its threshold is
//     strictly higher than the current group's threshold. No downgrades.
//   - On a successful promotion writes a system log entry visible to the user.
//
// rmbCent is the amount paid in cents of the platform billing currency.
// Negative values are clamped to 0.
func MaybeUpgradeUserGroup(tx *gorm.DB, userId int, rmbCent int64) error {
	if userId <= 0 {
		return nil
	}
	if rmbCent < 0 {
		rmbCent = 0
	}

	var user User
	if err := tx.Set("gorm:query_option", "FOR UPDATE").
		Select("id, "+commonGroupCol+", total_topup_amount").
		Where("id = ?", userId).
		First(&user).Error; err != nil {
		return err
	}

	newTotal := user.TotalTopupAmount + rmbCent

	currentMeta, currentKnown := setting.GetRechargeGroupMeta(user.Group)
	target := ""
	if currentKnown && !currentMeta.AdminOnly {
		target = pickUpgradeGroup(user.Group, currentMeta.UpgradeThreshold, newTotal)
	}

	updates := map[string]any{}
	if rmbCent > 0 {
		updates["total_topup_amount"] = gorm.Expr("total_topup_amount + ?", rmbCent)
	}
	if target != "" && target != user.Group {
		updates["group"] = target
	}
	if len(updates) == 0 {
		return nil
	}
	if err := tx.Model(&User{}).Where("id = ?", userId).Updates(updates).Error; err != nil {
		return err
	}

	if target != "" && target != user.Group {
		fromDesc := setting.GetRechargeGroupDescription(user.Group)
		toDesc := setting.GetRechargeGroupDescription(target)
		RecordLog(userId, LogTypeSystem,
			fmt.Sprintf("累计充值达到 %.2f 元，分组从 %s 自动升级为 %s",
				float64(newTotal)/100.0, fromDesc, toDesc))
		common.SysLog(fmt.Sprintf("user %d auto-upgraded from %s to %s (total %d cents)",
			userId, user.Group, target, newTotal))
	}

	return nil
}

// moneyToCents converts TopUp.Money (units of platform billing currency) to
// cents. Negative values are clamped to 0 so a corrupt order can never roll
// the user's lifetime accumulator backwards.
func moneyToCents(money float64) int64 {
	if money <= 0 {
		return 0
	}
	return int64(money * 100)
}

// quotaToCents converts a redemption-code Quota (token units, where
// QuotaPerUnit tokens == 1 USD) into USD cents for MaybeUpgradeUserGroup.
// Mirrors moneyToCents so redemption-code top-ups feed the same lifetime
// accumulator that paid gateways do (Stripe / Creem also book USD cents).
// Negative or zero quota — and a misconfigured QuotaPerUnit — return 0.
func quotaToCents(quota int) int64 {
	if quota <= 0 || common.QuotaPerUnit <= 0 {
		return 0
	}
	return decimal.NewFromInt(int64(quota)).
		Mul(decimal.NewFromInt(100)).
		Div(decimal.NewFromFloat(common.QuotaPerUnit)).
		IntPart()
}

// pickUpgradeGroup returns the highest-threshold auto_upgrade group whose
// threshold is at most newTotal AND strictly greater than currentThreshold,
// or "" if no eligible target exists. admin_only groups are excluded.
func pickUpgradeGroup(currentGroup string, currentThreshold int64, newTotal int64) string {
	metas := setting.GetRechargeGroupMetaCopy()

	bestName := ""
	bestThreshold := currentThreshold
	for name, m := range metas {
		if name == currentGroup {
			continue
		}
		if !m.AutoUpgrade || m.AdminOnly {
			continue
		}
		if m.UpgradeThreshold > newTotal {
			continue
		}
		if m.UpgradeThreshold > bestThreshold {
			bestThreshold = m.UpgradeThreshold
			bestName = name
		}
	}
	return bestName
}
