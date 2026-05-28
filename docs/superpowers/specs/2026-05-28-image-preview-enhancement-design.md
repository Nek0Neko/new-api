# Image Preview Enhancement — Design

Date: 2026-05-28
Status: Approved (design)

## Goal

Replace the two ad-hoc image preview surfaces in the frontend with a single,
reusable `ImageViewer` component that supports zoom & pan, rotate/flip, download,
and multi-image navigation. Both the usage-logs image dialog and the image
playground lightbox consume it, so the preview experience is consistent and
future enhancements apply everywhere.

## Current State

Three places render images today (frontend at `web/default/`):

1. **Usage logs** — `src/features/usage-logs/components/dialogs/image-dialog.tsx`.
   A modal (`ImageDialog`) with a single `imageUrl` + `taskId`, loading skeleton,
   error overlay, and the URL printed below. No zoom/pan/rotate/download/nav.
   Invoked per table row in
   `src/features/usage-logs/components/columns/drawing-logs-columns.tsx:228`
   (each row owns its own `<ImageDialog>`).
2. **Image playground** — `src/features/playground/image/index.tsx:484`.
   A bare full-screen `Dialog` showing one `<img>`; no controls or navigation.
   Preview state is `preview = { src, alt } | null`. Each generation card holds
   `item.images[]` (1–4 images); thumbnails already have a per-image download link.
3. **ai-elements** — `src/components/ai-elements/image.tsx`, a plain styled `<img>`
   (out of scope; not a preview surface).

No dedicated zoom/pan or lightbox library is installed. Available building blocks:
`motion` (framer-motion v12, drag/pan), shadcn/Base UI `Dialog`, `lucide-react`
icons, `embla-carousel-react`.

## Decisions

- **Approach A (custom)**: build `ImageViewer` on the existing shadcn `Dialog`
  plus `motion` for drag-to-pan. No new runtime dependency. Fully themed and
  i18n'd. The only custom logic is cursor-anchored zoom + transform math.
- **Usage-logs navigation stays single-image.** The logs dialog passes one image;
  nav controls auto-hide. No table-state refactor. The playground passes the
  clicked generation's full image list, so it gets real prev/next.

## Architecture

New reusable component, consumed by both surfaces:

```
src/components/image-viewer/
  image-viewer.tsx        — Dialog shell, toolbar, stage, nav, loading/error states
  use-image-transform.ts  — zoom/pan/rotate/flip state + handlers (the custom math)
  index.ts                — barrel export
```

### Component API

```ts
interface ImageViewerItem {
  src: string
  alt?: string
  caption?: string       // e.g. the image URL (logs) or revised prompt
  downloadName?: string  // suggested download filename
}

interface ImageViewerProps {
  images: ImageViewerItem[]
  index?: number                       // controlled active index
  onIndexChange?: (index: number) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: React.ReactNode              // optional header/caption title
}
```

`index` is controlled by the caller when provided; the component also tracks an
internal index seeded from `index` so it can drive prev/next on its own and
report changes via `onIndexChange`.

### Transform model (`use-image-transform.ts`)

State: `{ scale, offsetX, offsetY, rotation, flipX, flipY }`.
Rendered as a CSS transform on the `<img>`:
`translate(offsetX, offsetY) scale(scale) rotate(rotation) scaleX(flipX) scaleY(flipY)`.

Handlers: `zoomBy(delta, anchor?)`, `zoomIn`, `zoomOut`, `setScaleAtPoint`,
`panBy(dx, dy)`, `rotateLeft`, `rotateRight`, `flipHorizontal`, `flipVertical`,
`reset`. Scale clamped to `[0.25, 8]`. `reset` returns everything to identity.

## Interactions

- **Zoom**: mouse wheel (anchored at cursor), +/− toolbar buttons, double-click
  toggles 1×/2×. Live percentage readout in the toolbar.
- **Pan**: `motion` drag, enabled only when `scale > 1`; grab/grabbing cursor.
  Loosely bounded so the image can't be dragged entirely off-screen. Touch pan
  works via `motion`. Pinch-to-zoom is best-effort / out of scope for v1.
- **Rotate / flip**: rotate ±90°, flip horizontal, flip vertical.
- **Reset**: single button back to fit (identity transform).
- **Download**: anchor (`<a download>`) for the current image; cross-origin URLs
  that the browser refuses to download fall back to opening in a new tab.
- **Navigation**: prev/next buttons + ←/→ keyboard + "n / total" counter.
  The entire nav UI (arrows + counter) is hidden when `images.length === 1`.
  Switching the active image resets the transform.
- **Loading / error**: reuse today's behavior — skeleton while loading, and a
  "Failed to load image" overlay on error (transform controls no-op on error).
- **Close**: Esc and overlay click via the existing `Dialog`. All controls have
  aria-labels and i18n'd tooltips. Transform resets when the dialog opens.

## Integration (no API churn for callers)

### Usage logs — `image-dialog.tsx`

`ImageDialog` keeps its existing props (`imageUrl`, `taskId`, `open`,
`onOpenChange`) and becomes a thin adapter:

```tsx
<ImageViewer
  open={open}
  onOpenChange={onOpenChange}
  title={t('Image Preview')}
  images={[{ src: imageUrl, alt: t('Generated image'), caption: imageUrl, downloadName: ... }]}
/>
```

Task ID + URL render as the caption/subtitle inside the viewer. Nav is hidden
(single image). Callers in `drawing-logs-columns.tsx` are unchanged.

### Image playground — `image/index.tsx`

- `preview` state changes from `{ src, alt } | null` to
  `{ images: ImageViewerItem[]; index: number } | null`.
- `onPreview` signature changes to `onPreview(images: ImageViewerItem[], index: number)`.
  `ImageGenItemCard` builds the list from `item.images` (via the existing
  `resolveImageSrc`) with per-image `downloadName`, and passes the clicked index.
- The bare `<Dialog><img/></Dialog>` at `image/index.tsx:484` is replaced by
  `<ImageViewer images={preview.images} index={preview.index} onIndexChange={...}
  open={!!preview} onOpenChange={...} />`.

## i18n

New English source keys (en is base; propagate with `bun run i18n:sync` from
`web/default/`): `Zoom in`, `Zoom out`, `Reset`, `Rotate left`, `Rotate right`,
`Flip horizontal`, `Flip vertical`, `Previous image`, `Next image`, `Close`.
Reuse existing keys: `Download`, `Image Preview`, `Failed to load image`,
`Generated image`.

## Files Touched

- NEW `src/components/image-viewer/image-viewer.tsx`
- NEW `src/components/image-viewer/use-image-transform.ts`
- NEW `src/components/image-viewer/index.ts`
- EDIT `src/features/usage-logs/components/dialogs/image-dialog.tsx` (adapt to ImageViewer)
- EDIT `src/features/playground/image/index.tsx` (preview state, onPreview signature, render ImageViewer)
- EDIT `src/i18n/locales/*.json` (new keys, via i18n:sync)

## Edge Cases

- Single image → nav arrows + counter hidden.
- Transform resets on open and on index change.
- Scale clamped `[0.25, 8]`; pan disabled at scale 1.
- Large images use `object-contain` within the stage; zoom is relative to the
  fitted size.
- Cross-origin download fallback to new tab.
- Body scroll lock handled by `Dialog`.

## Verification

No JS test runner is configured in `web/default` (no `test` script in
`package.json`), so verification is:

- `bun run typecheck`
- `bun run lint`
- `bun run build`
- Manual browser testing of both surfaces:
  - Playground: generate (or use existing history) → open preview → zoom (wheel +
    buttons), pan, rotate, flip, reset, download, prev/next across a multi-image
    generation, keyboard arrows, Esc.
  - Usage logs (drawing logs): "View" an image → preview opens with nav hidden,
    zoom/pan/rotate/flip/download work, caption shows the URL.

UI correctness is verified manually (stated explicitly because there is no UI
test harness).

## Out of Scope

- Pinch-to-zoom gesture (best-effort only).
- Cross-row navigation in usage logs.
- Changes to `ai-elements/image.tsx`.
- Any backend changes.
