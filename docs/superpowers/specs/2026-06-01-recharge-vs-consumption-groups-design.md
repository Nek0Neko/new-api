# Design: Split Groups into Recharge Groups & Consumption Groups

Date: 2026-06-01
Branch: `custom`
Status: Spec — awaiting review
Predecessor: `2026-05-31-unified-group-management-design.md` (Phase 1 + Phase 2)

## 1. Problem & Goal

Today a "分组" (group) is a single dual-purpose concept. One row in the `groups`
table simultaneously carries a **recharge** ratio (`TopupRatio` → `TopupGroupRatio`
Option map) and a **consumption** ratio (`ConsumptionRatio` → `GroupRatio` Option
map), plus channel attachments, visibility, and auto-upgrade metadata. The two
concerns are only conflated in (a) the `groups` table and (b) the management UI —
downstream they already read from **separate** Option maps.

We want to make the distinction explicit and strict:

- **Recharge group (充值分组)** — drives the discount applied to a user's top-up
  (`TopupGroupRatio`) and tier auto-upgrade. Each user has **exactly one**
  (`User.Group`). No channels, no consumption ratio.
- **Consumption group (消费分组)** — drives the request-time billing multiplier
  (`GroupRatio`) and has channels attached. A user may have **many**
  (`User.ConsumptionGroups`). Carries a user-visibility flag.

A group is **strictly one kind** — never both.

## 2. Decisions (from brainstorming)

1. **Scope:** both layers — type the group *definitions* AND rework the
   user-assignment side.
2. **Strictness:** a group is strictly recharge OR consumption.
3. **Storage:** **two separate tables** (`recharge_groups`, `consumption_groups`).
   Chosen over a single typed table for maximum conceptual separation.
4. **Consumption visibility:** every consumption group has a visibility. Default
   = user-visible (self-selectable). Optionally **admin-only** = only an admin can
   assign it to a user (reuses existing `Visibility`/`AdminOnly`).
5. **Empty-allowlist semantics (PROPOSED — confirm):** when a user's
   `ConsumptionGroups` is empty, they may use **all user-visible** consumption
   groups (admin-only groups excluded). Backward-compatible with today's
   "empty = all", now filtered by visibility.

## 3. Cardinality (target model)

| Concept            | Stored on user        | Cardinality | Backing table         | Drives Option map     |
|--------------------|-----------------------|-------------|-----------------------|-----------------------|
| Recharge group     | `User.Group` (string) | 1           | `recharge_groups`     | `TopupGroupRatio`     |
| Consumption groups | `User.ConsumptionGroups` (JSON array) | N | `consumption_groups` | `GroupRatio`, `UserUsableGroups`, `AutoGroups` |

Consumption group → channels: unchanged (`Channel.Group` CSV exploded into the
`abilities` table). A consumption group's channel count comes from
`CountChannelsByGroup()`.

## 4. Data Model

Replace the single `groups` table (Phase 1) with two purpose-built tables. The
old `groups` table is **retired** (no longer read/written) but **not physically
dropped** — avoids a destructive cross-DB migration; it serves as the one-time
backfill source (§6).

### 4.1 `recharge_groups`

```go
type RechargeGroup struct {
    Id               int     `gorm:"primaryKey"`
    Name             string  `gorm:"type:varchar(64);uniqueIndex;not null"`
    Description      string  `gorm:"type:text"`
    TopupRatio       float64 `gorm:"default:1"`   // -> TopupGroupRatio; 1 = no discount
    AutoUpgrade      bool    `gorm:"default:false"`
    UpgradeThreshold int64   `gorm:"bigint;default:0"`
    AdminOnly        bool    `gorm:"default:false"` // sticky tier: auto-upgrade skips it
    CreatedTime      int64   `gorm:"bigint"`
    UpdatedTime      int64   `gorm:"bigint"`
}
```

Note `TopupRatio` default is **1** (neutral) here, not 0 — a recharge group always
has a meaningful discount multiplier. (Phase 1's `Group.TopupRatio` default was 0
meaning "unset"; on the recharge-only table the field is always present.)

### 4.2 `consumption_groups`

```go
type ConsumptionGroup struct {
    Id               int     `gorm:"primaryKey"`
    Name             string  `gorm:"type:varchar(64);uniqueIndex;not null"`
    Description      string  `gorm:"type:text"`
    ConsumptionRatio float64 `gorm:"default:1"`   // -> GroupRatio
    Visibility       string  `gorm:"type:varchar(16);default:'public'"`
    AdminOnly        bool    `gorm:"default:false"` // admin-only assignable
    InAutoRotation   bool    `gorm:"default:false"`
    AutoOrder        int     `gorm:"default:0"`
    CreatedTime      int64   `gorm:"bigint"`
    UpdatedTime      int64   `gorm:"bigint"`
}
```

A name MAY exist in both tables (e.g. `default` recharge + `default` consumption)
— legal because the downstream Option maps are already separate. Uniqueness is
per-table.

## 5. Sync to Option maps (hot-path read code stays unchanged)

Mirror Phase 1's `SyncGroupsToOptions`, but split:

- `SyncRechargeGroupsToOptions()` — re-derives **`TopupGroupRatio`** from all
  `recharge_groups`. Also emits a new **recharge-meta** source for auto-upgrade
  (see §7) — either a dedicated Option blob (e.g. `RechargeGroupMeta`) or a direct
  table read inside the upgrade tx.
- `SyncConsumptionGroupsToOptions()` — re-derives **`GroupRatio`**,
  **`UserUsableGroups`** (visibility/admin-only meta), and **`AutoGroups`** from
  all `consumption_groups`.

Call the relevant sync fn after every create/update/delete on each table so
billing/routing/auth hot paths keep reading the in-memory settings unchanged.

`UserUsableGroups` meta no longer carries `AutoUpgrade`/`UpgradeThreshold` (those
move to recharge-meta). It keeps `Description`/`Visibility`/`AdminOnly`.

## 6. Migration / Backfill (one-time, idempotent)

`BackfillSplitGroups()` runs at startup after `InitOptionMap`, idempotent on the
row-count of the two new tables (no-op if either already populated). Source = the
existing Phase 1 `groups` table.

For each old `groups` row:
- If it appears in `TopupGroupRatio` (i.e. `TopupRatio > 0`) **or** is referenced
  by any `User.Group` → emit a `recharge_groups` row
  (`TopupRatio` = old TopupRatio or 1, `AutoUpgrade`/`UpgradeThreshold`/`AdminOnly`
  copied).
- If it appears in `GroupRatio`/`UserUsableGroups` **or** has channels attached
  (`CountChannelsByGroup`) → emit a `consumption_groups` row (`ConsumptionRatio`,
  `Visibility`, `AdminOnly`, `InAutoRotation`, `AutoOrder` copied).

Edge: ensure every name currently used by some `User.Group` becomes a recharge
group, and the configured `NewUserDefaultGroup` exists as a recharge group, so no
user is left pointing at a missing recharge group. Likewise the default
consumption group(s).

No user-data migration is required: `User.Group` and `User.ConsumptionGroups`
already hold the right values; only their *referents* change tables. Existing
users with empty `ConsumptionGroups` keep working under the §2.5 fallback.

## 7. Auto-upgrade coupling (the one real fix)

`MaybeUpgradeUserGroup` / `pickUpgradeGroup` (`model/group_upgrade.go`) currently
read **consumption** metadata via `setting.GetUserUsableGroupMetaCopy()` for
`AutoUpgrade`/`UpgradeThreshold`/`AdminOnly`. Post-split these belong to the
**recharge** side. Repoint them to a recharge-meta source:

- Add `setting.GetRechargeGroupMeta(name)` / `...Copy()` (backed by the new
  `RechargeGroupMeta` Option blob from §5), OR read `recharge_groups` directly
  inside the upgrade transaction.
- `pickUpgradeGroup` iterates recharge-group metas; `AdminOnly` recharge groups
  stay sticky (unchanged behavior).

`controller/topup.go` next-tier hints (lines ~157, ~186) likewise switch to the
recharge-meta source.

## 8. Controllers / API

Split the Phase 1 `/api/group/manage` surface by kind:

- `/api/recharge_group/*` — list / create / update / delete. No channel ops.
- `/api/consumption_group/*` — list (with channel counts) / create / update /
  delete / attach+detach channels (`/:name/channels`).

Keep the Phase 1 guard rejecting direct `PUT /api/option` for `GroupRatio`,
`TopupGroupRatio`, `UserUsableGroups`, `AutoGroups` (tables remain authoritative).

User-assignment validation (in user create/update controller):
- `User.Group` MUST reference an existing `recharge_groups` row.
- Every entry in `User.ConsumptionGroups` MUST reference an existing
  `consumption_groups` row; admin-only ones are assignable only by an admin
  (non-admin self-service requests reject admin-only groups).

## 9. Frontend

Existing `/groups` page (`web/default/src/features/groups/`) becomes two tabs:

- **充值分组 (Recharge groups)** — list + detail form: name, description, topup
  ratio, auto-upgrade (flag + threshold), admin-only. No channels table.
- **消费分组 (Consumption groups)** — list (with channel count + override badge
  from Phase 2) + detail form: name, description, consumption ratio, visibility
  (user-visible / admin-only), auto-rotation (flag + order) + channels table
  (reuses Phase 2 `group-channels-table.tsx`).

User edit form (existing user management UI):
- Recharge group: single-select from recharge groups.
- Consumption groups: multi-select from consumption groups (user-visible ones for
  self-service; admin sees all incl. admin-only).

i18n: add en/zh keys for the new labels (frontend i18next + any backend strings).

## 10. Out of Scope / Non-goals

- `GroupSpecialUsableGroup` (tier × group overlay) stays as a standalone setting,
  not folded into either table (consistent with Phase 1).
- Phase 2 per-channel billing override is unchanged (lives on `Channel.Setting`).
- No physical drop of the old `groups` table.

## 11. Resolved Decisions

1. **Empty-allowlist semantics** (§2.5): **empty = all user-visible consumption
   groups** (admin-only excluded). Backward-compatible; no per-user backfill.
2. **Recharge-meta source** (§7): dedicated **`RechargeGroupMeta` Option blob**,
   for symmetry with the Phase 1 in-memory hot-path pattern.
3. **UI shape**: **two tabs on the existing `/groups` page**.

## 12. Testing

- Backfill idempotency (re-run = no dup rows) across SQLite/MySQL/PostgreSQL.
- Split correctness: a dual old row → one recharge + one consumption row with the
  right attributes.
- Sync round-trip: table writes reproduce the exact `TopupGroupRatio` / `GroupRatio`
  / `UserUsableGroups` / `AutoGroups` blobs the hot paths expect.
- Auto-upgrade reads recharge-meta (admin-only sticky, highest-threshold pick, no
  downgrade) — port existing `group_upgrade` tests to the new source.
- Empty-allowlist fallback returns only user-visible consumption groups.
- User-assignment validation rejects unknown / admin-only (for non-admin) groups.
