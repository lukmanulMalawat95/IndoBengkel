# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js 15 (App Router, TypeScript, Tailwind, shadcn/ui) + NestJS + Prisma + PostgreSQL 16/PostGIS, running in Docker Compose locally. Visual exploration is produced in pen.dev (`.pen`) before implementation. Recorded as delegated by the user in `docs/SPEC.md` and `docs/TSD.md`.

## Users

- **Customer (primary):** vehicle owners in Indonesia, often on mobile, looking for a nearby workshop, booking a service slot, buying parts in BengkelShop (pickup or courier delivery), keeping service history, and chatting with the workshop.
- **Workshop owner:** a single-location workshop owner/manager on desktop, managing profile, hours, mechanics, services, products, bookings, service orders, shop orders, reviews, chat, and reports. Mechanics are records, not users. One account = one workshop; no visibility into other workshops. The owner can also use every customer surface (garage, booking at another workshop, shopping, chat, reviews) for their own needs.
- **No platform admin role.** There is no cross-workshop console, moderation queue, or suspend action in v1; workshop status (draft/active/suspended) is managed within the workshop's own account/ops.

## Product Purpose

IndoBengkel connects vehicle owners with motorcycle and car workshops: discover by distance and fit, book a service, buy workshop products through **BengkelShop** with pickup or courier delivery, keep a verified service history, pay, review, and chat. Success means a customer can complete discovery → booking → service → payment → review, and a workshop can run its day and read its own revenue report, without leaving the product.

## Positioning

A workshop marketplace where service history is **earned** rather than self-reported: odometer and history only change through a workshop-confirmed service order, final invoices above 150% of the estimate require customer approval, each service is itemised so every replaced part is visible, and shop orders are verified by pickup code or by a courier tracking number. Neither a directory nor a generic marketplace can truthfully copy that mechanism without the workshop-side workflow.

## Operating Context

- Indonesia-only operation, IDR only. BengkelShop supports **pickup** (free, pickup code) and **expedition delivery** (JNE/J&T/SiCepat/AnterAja, weight-based ongkir, manual tracking number).
- A workshop is exclusively `motor` or `mobil`; one account = one location; mechanics are data managed by the owner. The console only ever shows that workshop's data.
- Service orders: requested → confirmed (with estimate) → in progress (odometer + mechanics) → completed (itemised checklist, photos, invoice) → paid (online or cash). Review unlocks after payment.
- Shop orders: one workshop per order, multiple items, 60-minute payment window, stock reserved at order creation; pickup code verified by staff, or tracking number + customer confirmation for deliveries. A cart can hold items from several workshops; checkout chooses pickup, GoSend, or a commercial courier per workshop and creates one order per workshop.
- Chat is a thread per customer–workshop pair; realtime with in-app and email notifications.
- English is the default UI language; Indonesian is a full alternate. User-generated content is never translated.
- Customers use mobile-first; the workshop surface is desktop-first.
- No refunds in v1. No payout UI; payouts are reconciled outside the app.
- The local baseline runs without vendor keys: local test payment provider, MinIO storage, Mailpit email.

## Capabilities and Constraints

Confirmed scope: auth with email verification and rotating sessions; workshop profile/hours/closures/photos; mechanics; itemised service catalog; geospatial search with radius, open-now, type, rating; vehicle garage and history; booking with hourly slots; service order lifecycle with estimate approval and completion checklist; products, stock, discounts, weight; aggregated BengkelShop marketplace; multi-workshop cart with per-workshop fulfillment; checkout with pickup, GoSend, or expedition + ongkir; VA/bank transfer/QRIS via Midtrans or fake provider; pickup verification and tracking-number shipping; workshop and product reviews with one reply; realtime chat; notifications and service reminders; per-workshop reports; EN/ID.

Hard exclusions for v1: refunds and post-payment cancellation, multi-currency, WhatsApp, mechanic logins, multi-branch, platform-admin role, AI chatbot, native apps, payout ledger, auto-translated user content.

## Brand Commitments

Name **IndoBengkel**. Product copy in English by default and Indonesian as an alternate. The user selected visual direction A, **“Night Shift”**: near-black surfaces, lime accent, Space Grotesk headings, Inter body, selected from three offered directions. The logo is a squared B on an ink tile with a solid lime glyph (`design/indobengkel-logo.pen`, `src/components/layout/logo-mark.tsx`); brand photography is still not supplied, so placeholder workshop imagery is expected for the local baseline.

## Evidence on Hand

Product truth lives in `docs/SPEC.md`, `docs/PRD.md`, `docs/FSD.md`, `docs/TSD.md`, `docs/PLAN.md`. No real workshops, customers, reviews, revenue, or photography exist. All names, ratings, products, prices, and service records used in design are synthetic development data and must be labelled as such when they could be mistaken for real claims. No logo, wordmark, or brand photography is on hand.

## Product Principles

1. **Earned history over volunteered claims.** Only a confirmed workshop interaction changes a vehicle's record.
2. **Price without surprises.** Estimate first; anything above 150% needs explicit approval.
3. **One task per screen.** The customer's next action is always obvious on a phone.
4. **Operate at workshop speed.** The owner's desktop flow must survive a busy counter, not a quiet local run.
5. **Truth in the local baseline.** Synthetic data is authored at full fidelity and labelled, never presented as real proof.

## Accessibility & Inclusion

WCAG 2.1 AA target: text contrast, visible keyboard focus, labelled form controls, touch targets ≥44px, no horizontal scroll at 360px, status conveyed by text as well as colour. English and Indonesian both fully supported.
