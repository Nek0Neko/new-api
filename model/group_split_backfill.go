package model

import "github.com/QuantumNous/new-api/setting"

// BackfillSplitGroups performs the one-time migration from the Phase 1 `groups`
// table into the recharge_groups and consumption_groups tables. Idempotent: if
// either target table already has rows it is a no-op, so it is safe to call on
// every startup.
//
// Split rule per old row:
//   - consumption row always (old rows carry a consumption ratio, default 1).
//   - recharge row iff TopupRatio > 0 (it participated in TopupGroupRatio).
func BackfillSplitGroups() error {
	var rc, cc int64
	if err := DB.Model(&RechargeGroup{}).Count(&rc).Error; err != nil {
		return err
	}
	if err := DB.Model(&ConsumptionGroup{}).Count(&cc).Error; err != nil {
		return err
	}
	if rc > 0 || cc > 0 {
		return nil
	}

	old, err := GetAllGroups()
	if err != nil {
		return err
	}

	for _, g := range old {
		ratio := g.ConsumptionRatio
		if ratio == 0 {
			ratio = 1
		}
		vis := g.Visibility
		if vis == "" {
			vis = setting.GroupVisibilityPublic
		}
		cg := &ConsumptionGroup{
			Name:             g.Name,
			Description:      g.Description,
			ConsumptionRatio: ratio,
			Visibility:       vis,
			AdminOnly:        g.AdminOnly,
			InAutoRotation:   g.InAutoRotation,
			AutoOrder:        g.AutoOrder,
		}
		if err := cg.Insert(); err != nil {
			return err
		}

		if g.TopupRatio > 0 {
			rgRow := &RechargeGroup{
				Name:             g.Name,
				Description:      g.Description,
				TopupRatio:       g.TopupRatio,
				AutoUpgrade:      g.AutoUpgrade,
				UpgradeThreshold: g.UpgradeThreshold,
				AdminOnly:        g.AdminOnly,
			}
			if err := rgRow.Insert(); err != nil {
				return err
			}
		}
	}

	// Spec §6: every recharge group a user currently points at must exist as a
	// recharge_groups row, even if that name was absent from all the settings maps
	// above (e.g. a tier only ever set directly on a user). A missing row leaves
	// that user with neutral topup ratio and no auto-upgrade metadata.
	var userGroups []string
	// Raw SELECT with commonGroupCol (already dialect-quoted) mirrors
	// CountChannelsByGroup and avoids GORM double-quoting the reserved word "group".
	if err := DB.Raw("SELECT DISTINCT " + commonGroupCol + " FROM users").Scan(&userGroups).Error; err != nil {
		return err
	}
	for _, name := range userGroups {
		if name == "" {
			continue
		}
		if _, err := GetRechargeGroupByName(name); err != nil {
			if err := (&RechargeGroup{Name: name, TopupRatio: 1}).Insert(); err != nil {
				return err
			}
		}
	}

	// Guarantee the new-user default recharge group exists.
	def := setting.GetNewUserDefaultGroup()
	if _, err := GetRechargeGroupByName(def); err != nil {
		if err := (&RechargeGroup{Name: def, TopupRatio: 1}).Insert(); err != nil {
			return err
		}
	}

	return nil
}
