# Frontend Image-to-Image (Edits) — Design

Date: 2026-05-29
Status: Approved (design)

## Goal

Add image-to-image (img2img / edits) capability to the **frontend** image
playground. Today the playground only does text-to-image; users cannot attach a
reference image. This work lets a user attach one or more reference images,
optionally paint a mask (ChatGPT-style brush), and generate an edited result —
streaming or non-streaming — targeting the OpenAI-standard edits protocol.

Scope decided with the user (all four optional capabilities are in v1):

- Multiple reference images (`image[]`)
- Streaming for edits (SSE partial previews)
- Mask editing — **ChatGPT-native brush UX** (paint the area to edit in-browser,
  not a mask-file upload)
- Persist input images (and mask) into history so edit items can be regenerated

## Current State

**Backend: no changes needed.** `/v1/images/edits` already handles multipart
form requests end to end:

- Route registered in `router/relay-router.go` → `controller.Relay(c, types.RelayFormatOpenAIImage)`.
- `middleware/distributor.go:304-312` extracts `model` from the multipart form
  for routing.
- `relay/channel/openai/adaptor.go:426-530` (`ConvertImageRequest`, case
  `RelayModeImagesEdits`) forwards `model`, all non-file fields, `image` /
  `image[]` files, and an optional `mask` file upstream as multipart.
- `relay/image_handler.go` already streams when the upstream responds with
  `text/event-stream`, so `stream` + `partial_images` form fields work for edits.

**Frontend: text-to-image only.** Everything lives under
`web/default/src/features/playground/image/`:

- `index.tsx` — UI: prompt textarea, size/quality/count/stream/partial selects,
  `ModelSelector`, generation history cards, `ImageViewer` lightbox. No upload.
- `api.ts` — `IMAGE_GEN_ENDPOINT = '/v1/images/generations'`; `generateImage`
  (axios JSON + transient retry) and `generateImageStream` (fetch SSE). SSE
  parse loop is inline in `generateImageStream`.
- `use-image-playground.ts` — `submit(prompt)`, config/items state, history
  persistence, `handleEdit`/`handleRegenerate`.
- `types.ts` — `ImageGenerationRequest`, `ImageDataItem`, `ImageGenerationItem`,
  `ImageConfig`.
- `storage.ts` — config in `localStorage`; items in IndexedDB (localforage),
  capped at `MAX_PERSISTED_ITEMS = 30` with quota-trim fallback;
  `toPersistable` drops heavy `images` for non-success items.

`bearerConfig` (`shared/request-config.ts`) sets only the `Authorization`
header, so axios auto-sets the multipart boundary for `FormData` bodies.
Reusable upload reference: `components/ai-elements/prompt-input.tsx` uses
`FileReader.readAsDataURL`, `accept`, `multiple`, drag-drop.

## Decisions

- **Protocol:** when ≥1 reference image is attached, submit
  `FormData → /v1/images/edits`; otherwise keep the existing
  `JSON → /v1/images/generations` path. Both paths coexist; the UI switches
  automatically based on attachments.
- **Mask UX = ChatGPT-native brush**, not file upload. A canvas-based editor
  lets the user paint over the region to edit; export produces a PNG mask where
  **painted areas are transparent** (alpha 0) and the rest opaque — matching
  OpenAI semantics ("transparent areas of the mask indicate where the image
  should be edited"). Mask applies to the **primary (first) reference image**
  and is exported at that image's natural resolution.
- **No backend changes.** All work is frontend-only.
- **No model gating.** dall-e-2 (single square PNG + mask) vs gpt-image-1
  (multi-image) differences are not pre-validated client-side; upstream errors
  surface inline in the existing error card.
- **Persistence:** input images + mask are kept in history (base64) so edit
  items can be regenerated; rely on the existing 30-item cap + IndexedDB
  quota-trim for size control (no new per-image size limit in v1).

## Data Flow

```
user attaches 0..n reference images + optional mask + prompt
        ↓ submit(prompt)
  inputImages.length > 0 ?
   ├─ no  → generation path (JSON → /v1/images/generations)   [unchanged]
   └─ yes → edit path (FormData → /v1/images/edits)
             stream? ─ yes → editImageStream (FormData + SSE) → onPartial preview
                    └ no  → editImage (FormData) → data[]
        ↓ success
  item{ mode:'edit', inputImages, maskImage, images } → render + persist
```

## Component / File Changes

### `types.ts`

- New `ImageInputFile { id: string; name: string; mime: string; b64: string }`
  (base64 without data-URL prefix; convertible to `Blob` for upload and to a
  data URL for thumbnails).
- New `ImageEditRequest { model; prompt; n?; size?; quality?; response_format?;
  stream?; partial_images?; images: ImageInputFile[]; mask?: ImageInputFile }`.
- Extend `ImageGenerationItem` with:
  - `mode: 'generation' | 'edit'`
  - `inputImages?: ImageInputFile[]`
  - `maskImage?: ImageInputFile`

### `api.ts`

- Extract the SSE reader/parse loop from `generateImageStream` into a shared
  `consumeImageStream(response, callbacks)` (byte reader, line split, event
  dispatch, partial/completed handling) — behavior-preserving refactor.
- `generateImageStream` keeps its JSON `fetch` then calls `consumeImageStream`.
- Add `IMAGE_EDIT_ENDPOINT = '/v1/images/edits'`.
- Add `buildEditFormData(params)`: appends `model`, `prompt`, `n`, `size`,
  `quality`, `response_format`, optional `stream` / `partial_images`, each input
  as `image[]` (Blob from base64), and optional `mask` (Blob). Single image may
  use `image` instead of `image[]` (both accepted by backend — see adaptor).
- Add `editImage(params, apiKey)`: axios `POST` of `FormData` with the existing
  transient-retry wrapper; `bearerConfig(apiKey)` (no Content-Type → axios sets
  multipart boundary).
- Add `editImageStream(params, apiKey, callbacks)`: `fetch` `FormData` with
  `Accept: text/event-stream`, then `consumeImageStream`.

### `use-image-playground.ts`

- New upload state: `inputImages: ImageInputFile[]`, `maskImage: ImageInputFile
  | null`, plus `addInputImages(files)`, `removeInputImage(id)`,
  `setMaskImage(mask | null)`, `clearInputs()`.
- `submit(prompt)` branches on `inputImages.length`:
  - 0 → existing generation path (unchanged).
  - ≥1 → edit path; build `ImageEditRequest`; call `editImageStream` (when
    `config.stream`) or `editImage`.
- Placeholder/finalized item records `mode`, `inputImages`, `maskImage`.
- After a successful edit submit, clear the upload tray (`clearInputs()`).
- `handleRegenerate`: edit items re-run with their stored `inputImages` /
  `maskImage`; generation items unchanged.

### `storage.ts`

- `toPersistable` retains `inputImages` and `maskImage` (user opted into
  persistence). No new cap; existing `MAX_PERSISTED_ITEMS` + quota-trim covers
  size. (For non-success items, output `images` are still dropped as today;
  input images are retained so a failed edit can be retried/regenerated.)

### `index.tsx`

- **Upload tray** above the prompt textarea:
  - Thumbnail strip of attached reference images, each with a remove (×) button.
  - "Add image" button → hidden `<input type="file" accept="image/*" multiple>`
    using `FileReader.readAsDataURL` (pattern from `ai-elements/prompt-input`).
  - When ≥1 image attached, a "Mask" affordance on the primary image opens the
    **mask editor** (see below). A set mask shows a small badge + clear control.
- When attachments exist: the submit button reflects edit mode (e.g. label /
  icon hint "Edit"); `canSubmit` still requires a non-empty prompt.
- `ImageGenItemCard`: success edit items additionally render small input-image
  thumbnails (labeled as inputs) and a mask indicator; output images keep the
  existing `ImageViewer` grid. `mode` shown in the metadata row.
- Stream toggle and the n↔stream mutual-exclusion behavior apply to both paths
  unchanged.

### `mask-editor.tsx` (new)

ChatGPT-style brush mask editor, opened in a Base UI `Dialog`:

- **Display:** the primary reference image fit to the dialog; a translucent
  colored overlay shows painted regions in real time.
- **Tools:** brush (default) and eraser; brush-size slider; "Reset"/clear;
  "Cancel" / "Done".
- **Internals:** an offscreen stroke canvas sized to the image's *natural*
  resolution accumulates strokes. Display composites image + stroke overlay
  (reduced opacity). Pointer events (`pointerdown`/`move`/`up`) draw round
  brush strokes; coordinates mapped from display → natural size.
- **Export on Done:** create a canvas at natural size, fill fully opaque, then
  draw the stroke layer with `globalCompositeOperation = 'destination-out'` to
  punch transparent holes where painted → produces an OpenAI-compatible mask
  PNG (transparent = edit region). Encode to base64 → `ImageInputFile` stored as
  `maskImage`.
- Mask matches the primary image's dimensions; with multiple inputs the mask
  applies to the first image, per OpenAI edits semantics.

### i18n

- Add new English source strings: e.g. "Reference images", "Add image", "Mask",
  "Edit mask", "Brush", "Eraser", "Brush size", "Reset", "Done", "Edit", plus
  any helper/placeholder text.
- Run `bun run i18n:sync` (from `web/default/`) to propagate keys to zh/fr/ru/
  ja/vi; fill zh manually.

## Edge Cases & Constraints

- **Size/quota:** persisting input images enlarges IndexedDB usage; the existing
  30-item cap + quota-trim fallback in `storage.ts` is the only guard in v1.
- **dall-e-2 vs gpt-image-1:** model capability differences (single vs multi
  image, square-PNG mask requirement) are not pre-validated; upstream errors
  display inline.
- **Stream + edits:** `editImageStream` forces `response_format: b64_json` (as
  the generation stream path already does) since streamed frames are base64.
- **n ↔ stream:** unchanged — `n` is locked to 1 while streaming.
- **Mask without paint:** if the editor is opened but nothing is painted, treat
  as no mask (do not send an all-opaque mask).

## Out of Scope (v1)

- Per-image size/count hard limits beyond the history cap.
- Mask for non-primary images / multiple independent masks.
- Backend changes of any kind.
- Non-OpenAI edit protocols (JSON-image generations path for Seedream/Gemini).
