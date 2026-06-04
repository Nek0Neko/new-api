# Image Playground Cross-Device Sync — Design

**Date:** 2026-06-04
**Status:** Approved (design)
**Related:** [2026-06-03 Image COS remote storage](2026-06-03-image-cos-remote-storage-design.md), [2026-05-29 Image playground customization](2026-05-29-image-playground-customization-design.md)

## Problem

The image playground keeps its generation history only in the browser (IndexedDB via
localforage, see `web/default/src/features/playground/image/storage.ts`). History is
therefore per-browser: a user who generates images on their laptop sees nothing on their
phone or another browser.

Now that generated output images are offloaded to Tencent COS and surfaced as plain URLs
(see the COS remote-storage feature), history items are lightweight — a few hundred bytes
of metadata plus an image URL, instead of multi-MB base64. This makes server-side
persistence practical, which in turn enables cross-device sync.

## Goals

- Persist each user's image-generation history server-side, scoped per user.
- On any device, load that history so results generated elsewhere appear.
- Keep the database free of heavy base64 blobs — store only parameters + image URLs.

## Non-Goals

- Syncing image **edit** reference images / masks. These are still raw base64 and are NOT
  uploaded to COS. On a second device, an edit item shows its result + prompt but no
  original reference/mask thumbnails.
- Syncing in-flight (loading / streaming / pending async-task) items across devices. Only
  terminal successes are persisted; an in-flight item resolves on the originating device
  and syncs once it succeeds.
- Real-time push between devices. Sync happens on playground load (pull) and on item
  success/delete (push); there is no live socket.

## Decisions (from brainstorming)

1. **Storage payload:** DB stores only parameters + image URLs. No base64 in the database.
2. **Sync scope:** Output results only. Edit reference images/masks are not synced.
3. **Source of truth:** Server. On load, the server list is authoritative; local IndexedDB
   becomes an offline cache (fallback when the server is unreachable).

## Architecture

### 1. Backend model — `model/image_history.go`

A generic JSON-document row per history item (chosen over fully-normalized columns so the
item shape can evolve without migrations, and to mirror exactly what the frontend already
serializes):

```go
type ImageHistory struct {
    Id        int    `json:"id" gorm:"primaryKey;autoIncrement"`
    UserId    int    `json:"user_id" gorm:"not null;index:idx_image_history_user_created,priority:1;uniqueIndex:idx_image_history_user_item,priority:1"`
    ItemId    string `json:"item_id" gorm:"type:varchar(64);not null;uniqueIndex:idx_image_history_user_item,priority:2"`
    CreatedAt int64  `json:"created_at" gorm:"bigint;index:idx_image_history_user_created,priority:2"`
    Data      string `json:"data" gorm:"type:text"` // JSON of the slimmed item
}
```

- `ItemId` is the client-generated id (`img-<ts>-<rand>`), making upsert idempotent and
  delete addressable by the same id the frontend already holds.
- Composite unique index `(user_id, item_id)` → upsert target.
- Composite index `(user_id, created_at)` → newest-first listing.
- `Data` is a TEXT column (cross-DB safe; no `JSONB`) holding the JSON of the slimmed item:
  `{ id, prompt, model, size, quality, mode, createdAt, status, config, images: [{url, revised_prompt}] }`.
  It deliberately omits `inputImages`, `maskImage`, `partialImage`, and `taskId`.

**Registration:** add `&ImageHistory{}` to the `DB.AutoMigrate(...)` call in
`model/main.go`. Must work on SQLite, MySQL ≥ 5.7.8, PostgreSQL ≥ 9.6 — achieved by using
only GORM abstractions and a TEXT column.

**Model functions** (in `model/image_history.go`, using GORM, no raw SQL):
- `GetImageHistory(userId int, limit int) ([]ImageHistory, error)` — `Where("user_id = ?", userId).Order("created_at desc").Limit(limit)`.
- `UpsertImageHistory(userId int, itemId string, createdAt int64, data string) error` —
  GORM `Clauses(clause.OnConflict{Columns: [user_id, item_id], DoUpdates: [data, created_at]})`
  create. After insert, trim: delete rows for this user beyond the newest
  `MAX_IMAGE_HISTORY = 100` (subquery selecting ids to keep, or delete where
  `created_at <` the 100th newest). Trim logic must be cross-DB (avoid `LIMIT` in
  `DELETE`; select ids to delete then delete by id).
- `DeleteImageHistory(userId int, itemId string) error`.
- `ClearImageHistory(userId int) error`.

`OnConflict` is supported by GORM for all three dialects; verify the clause emits valid SQL
on SQLite/MySQL/Postgres (GORM translates it per-dialect).

### 2. Backend endpoints — `controller/image_history.go`

Mounted on the authenticated user router (the group already guarded by
`middleware.UserAuth()`; user id via `c.GetInt("id")`). Routes added in `router/api-router.go`
alongside other `/api/...` user routes:

| Method | Path | Handler | Behavior |
|--------|------|---------|----------|
| GET | `/api/playground/image/history` | `GetImageHistoryList` | Newest-first list for the user. Returns the parsed `data` documents. |
| PUT | `/api/playground/image/history` | `UpsertImageHistoryItem` | Body = one slimmed item JSON. Upsert by `(user_id, item_id)`. |
| DELETE | `/api/playground/image/history/:itemId` | `DeleteImageHistoryItem` | Delete one item. |
| DELETE | `/api/playground/image/history` | `ClearImageHistoryList` | Delete all for the user. |

Responses follow the project convention `{ success, message, data }`. All JSON
marshal/unmarshal goes through `common/json.go` wrappers (Rule 1). The PUT handler
validates that `item_id` is present and that output images carry `url`s (defense in depth;
the primary gate is client-side).

### 3. Frontend sync — `storage.ts` + `use-image-playground.ts`

New module `image/remote-history.ts` wrapping the four endpoints via the existing
session-auth axios instance (`web/default/src/lib/api.ts` — `api`, which attaches the
`New-Api-User` header). This is distinct from the relay API-key path used for generation.

Behavior changes in `use-image-playground.ts`:

- **Hydrate (mount):** call `GET` history. On success, use the server list as `items`
  (replacing the local-cache hydrate as the authoritative source). On failure
  (offline/non-2xx), fall back to `loadImageItems()` (current IndexedDB read). IndexedDB
  continues to be written through (`saveImageItems`) so it stays a warm offline cache.
- **On success (`markSuccess` / async-task success / stream success):** after updating
  local state, push the item to the server **only if** every entry in `images` has a `url`
  and no `b64_json`. If outputs are base64 (COS disabled), skip the push — the item remains
  local-only. This is the graceful-degradation gate that keeps blobs out of the DB.
  The pushed payload is the slimmed item (same shape as `toPersistable`, further stripped of
  `inputImages`/`maskImage`).
- **`removeItem`:** also call `DELETE /:itemId` (fire-and-forget; ignore failure).
- **`clearHistory`:** also call `DELETE` all (fire-and-forget; ignore failure).

The push/delete calls are fire-and-forget with `console.warn` on failure — sync must never
block or break local generation UX.

### 4. Edge cases & rendering

- **Edit items on a second device:** load with `mode: 'edit'` but without `inputImages` /
  `maskImage`. The history card (`image/index.tsx`) must render such items gracefully —
  result + prompt shown, reference/mask thumbnail section omitted when absent. Verify the
  card already guards on `inputImages?.length`; add a guard if it assumes presence.
- **COS disabled:** outputs are base64; the success gate skips the server push. History stays
  per-browser exactly as today. No regression.
- **Item id collisions:** ids are time+random; `(user_id, item_id)` uniqueness makes a
  re-pushed same-id item an idempotent update (e.g. retry-in-place reuses the id).
- **Retention drift:** server keeps newest 100; local IndexedDB keeps newest 30
  (`MAX_PERSISTED_ITEMS`). After a server-authoritative hydrate, a device may show up to 100.
  Acceptable; the local cap only bounds the offline cache.

## Data Flow

```
Generate (device A) ──success──> local state + IndexedDB
                                      │ (only if outputs are COS URLs)
                                      └─ PUT /api/playground/image/history ──> ImageHistory row

Open playground (device B) ── GET /api/playground/image/history ──> items
                                      └─ on failure: fall back to IndexedDB cache

Delete item (any device) ── DELETE /api/playground/image/history/:itemId
Clear history (any device) ── DELETE /api/playground/image/history
```

## Testing

- **Backend:** model-level tests for upsert idempotency, retention trim (insert 101 →
  oldest dropped), per-user isolation, and delete/clear. Run against SQLite in CI; the GORM
  `OnConflict` clause is the main cross-DB risk to eyeball for MySQL/Postgres.
- **Frontend:** unit-test the success-gate predicate (URL-only items push, base64 items
  skip) and the slimming of the pushed payload (no `inputImages`/`maskImage`/`partialImage`/
  `taskId`). Reuse the existing vitest setup (`*.test.ts` in the image folder).
- **Manual:** generate on one browser, confirm the item appears in a second browser/profile;
  delete in one, confirm it disappears in the other after reload; toggle COS off and confirm
  no rows are written.

## Open Questions

None outstanding. Retention (100 server / 30 local cache) and write-through-on-success
trigger were confirmed during brainstorming.
