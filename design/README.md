# IndoBengkel — UI/UX directions

Open **`design/indobengkel-options.pen`** in the pen.dev editor (VS Code, pen.dev extension) to inspect the live canvas. Exported stills are in `exports/` (dark) and `exports/light/` (light).

All names, workshops, prices, ratings, service records, and photography are synthetic sample content. Imagery is a stand-in for tone and composition, not final product photography.

Every direction is now shown in **dark mode** and **light mode**. Dark is the default Night Shift system; light is the same layout re-tokenised as **Day Shift**, not a separate composition. Use the mode toggle in the `.pen` theme or compare the exported pairs.

## The three directions

| | Direction | Leads with | Signature screen | Trade-off |
|---|---|---|---|---|
| **A** | **Departures** | Schedule and urgency | A live time rail across nearby workshops | Rewards intent; quieter for browsing parts |
| **B** | **Shelf** | Commerce and pickup | A horizontal shelf of parts ready today | Commerce-forward; can crowd out service trust |
| **C** | **Logbook** | History and retention | A verified service timeline with odometer stamps | Strongest for repeat owners; weakest cold start |

Each direction includes three customer screens, in both modes:

- **A** — Discover · Workshop · Book a service
- **B** — Shop · Workshop (Shop tab) · Part
- **C** — Garage · Service history · Workshop (history-aware)

The customer app is mobile-first at **390 px**; the workshop console is not part of this pass.

## Modes

### Dark — Night Shift (default)

- bg `#0A0C0B`, surface `#121614`, surface-2 `#191E1B`, surface-3 `#202723`
- border `#232A26`, border-strong `#343D37`
- text `#F2F5F0`, muted `#9AA69E`, faint `#7E8A83`
- accent `#C8F751`, accent-ink `#0A0C0B`
- success `#57D9A3`, warn `#FFB84D`, danger `#FF6B6B`

### Light — Day Shift

- bg `#F3F1EA`, surface `#FBFAF6`, surface-2 `#E9E6DB`, surface-3 `#DFDBCE`
- border `#D9D4C7`, border-strong `#BDB8A9`
- text `#161A16`, muted `#505A53`, faint `#5F6A62`
- accent `#587300`, accent-ink `#F7F6EF`
- success `#1D6B45`, warn `#8A5A00`, danger `#B23A3A`

Day Shift keeps the same structure and typography. The lime deepens to olive because neon lime loses contrast on paper; the olive still reads as the same brand family while links, icons, active states and buttons stay legible. Lime remains on dark photo overlays (`$lime`) where it belongs.

## Fixed system

- Night Shift palette: `#0A0C0B` bg, `#121614` surface, `#232A26` border, `#F2F5F0` text, `#9AA69E` muted, `#C8F751` lime. Day Shift values are listed above.
- Type: Space Grotesk for headings and numerals, Inter for body and UI.
- English UI copy, IDR prices, commerce with pickup or courier delivery. All screens share the same five-destination tab bar: Discover, BengkelShop, Garage, Chat, You.
- Product truths surfaced in the work: next available slots, open/closed status, distance, verified service history, odometer provenance, pickup or delivery, and the 150% estimate-approval rule.

## Exports

Dark stills: `exports/00-cover.png`, `exports/A1-discover.png`, `exports/A2-workshop.png`, `exports/A3-booking.png`, `exports/B1-shop.png`, `exports/B2-workshop.png`, `exports/B3-part.png`, `exports/C1-garage.png`, `exports/C2-history.png`, `exports/C3-workshop.png`.

Light stills: `exports/light/A1-discover-light.png` … `exports/light/C3-workshop-light.png`, plus `exports/light/light-palette.png`.

## Home hero

The top of Home is **Opsi 1 · Ringkas**, drawn at the top of the same canvas (`Home · 2 opsi desain`, web 1440 and mobile 390, both modes). One panel holds the search field and four category links; the badge, headline, subtitle and photo card are gone.

- Web: panel 1216 × 90 — search field 625, divider, 500 category row (four 122 px cells, icon tile + label, centred).
- Mobile: panel ~172 tall, stacked; the location selector sits inside the search field as a `Jakarta ⌄` prefix, because the header location pill is hidden below `sm`.
- Categories: Motorcycle, Car, BengkelShop, Garage. Each is an equal cell with a 32 px `.chip-accent` tile above the label (row layout from `lg`), so spacing stays precise at every width. Search submits `q` only; location filtering lives in Discover.
- **Opsi 2 · Etalase** (search bar + photo banner + four category cards) stays on the sheet as the rejected alternative.

Implemented in `IndoBengkelFE/src/app/[locale]/(customer)/page.tsx`; measured at 360, 390, 820, 1024 and 1440 in both modes with no horizontal overflow.

The closing **How it works** panel now uses the same quiet language as the rest of the theme: neutral badge, `line` strokes, a 36 px icon ring per step, a numbered index and a hairline connector. Bright `accent/20 + accent/10` icon halos across the app were replaced by the muted `.chip-accent` tile (`IndoBengkelFE/src/app/globals.css`).

## Media uploads

Every image field (mechanic photo, product image, vehicle photo, workshop cover + gallery, service-order photos, chat attachment) is a real uploader — drag-and-drop, file picker and camera capture, with a staged progress bar (read → optimise → upload) in the Night Shift lime.

- Frontend pipeline: `IndoBengkelFE/src/lib/upload-image.ts` (validates, downscales to 1280 px, compresses under ~340 KB, uploads via XHR for real progress).
- UI: `IndoBengkelFE/src/components/ui/image-upload.tsx` (`ImageUpload`, `MultiImageUpload`, `UploadProgressBar`); camera uses `getUserMedia` with a file-picker fallback.
- Local endpoint: `POST /api/uploads` (`IndoBengkelFE/src/app/api/uploads/route.ts`) writes into `public/uploads` (Docker volume) and returns `{ url: "/api/uploads/<name>" }`. `GET /api/uploads/[name]` serves the file so uploads survive `next start`; the client falls back to an inline data URL if storage is unavailable. Production swaps this write for the presigned S3/MinIO flow in `docs/TSD.md` §12.

## Logo

The mark work sits on the same canvas (`Logo · Mark sheet`): the shipped three-bar tile reconstructed as evidence, two replacement samples drawn on a 32 px grid, in both modes and at header scale, plus the rules both follow.

- **Sample 1 · Bay** — a workshop bay seen head-on.
- **Sample 2 · Monogram** — a squared B, for favicon and app-icon use. **Chosen** and implemented in `IndoBengkelFE/src/components/layout/logo-mark.tsx`, with `IndoBengkelFE/src/app/icon.svg` as the favicon.

Both use one ink tile `#0A0C0B` with a solid lime `#C8F751` glyph, 28% radius, a 16 px floor. The tile stays ink on paper; the wordmark drops to solid ink there, because brand lime never sits on paper.

The shipped mark measured 1.4:1 on paper and 2.1:1 on dark at its bottom bar — under the 3:1 floor for a graphic — which is why it read as a smudge at 32 px.

## Next step

Home is settled on **Opsi 1 · Ringkas**; both options stay on the sheet for reference. The next visual pass can reuse the same panel on Discover, so the search field and category filtering read as one system.
