# Orbytre Database Schema (Combined)

## Document Tree

```
Orbytre-DB-Schema/
├── 1. Overview ................ structure, Firestore vs Realtime, review findings
├── 2. users
├── 3. organizations ........... + members, orgCodes
├── 4. inventory ............... products + inventoryLogs
├── 5. transactions ............ cash flow + budgets + vendors
├── 6. publicity
├── 7. tickets ................. helpdesk + messages
├── 8. invoices ................ e-invoicing
├── 9. flags ................... + notifications
├── 10. chat ................... AI chatbot sessions + messages
└── 11. reference-data ......... SME aid, compliance, platform fees
```

## Firestore Collection Tree

```
users/{uid}
organizations/{orgId}
├── members/{uid}
├── products/{productId}
├── inventoryLogs/{logId}
├── transactions/{txId}
├── summaries/{yyyy-MM}
├── budgets/{budgetId}
├── vendors/{vendorId}
├── invoices/{invoiceId}
├── flags/{flagId}
├── publicity/{postId}
├── tickets/{ticketId}
│   └── messages/{msgId}
├── chatSessions/{sessionId}
│   └── messages/{msgId}
├── complianceProgress/{itemId}
├── notifications/{notifId}
└── counters/{name}
orgCodes/{code}
reference/
├── smeAid/items/{id}
├── complianceTemplates/items/{id}
└── platformFees/items/{platformId}
```


---

# Orbytre Database Overview

Stack: Next.js + Firebase (Auth, Firestore, Storage, Cloud Functions).

## Decision: Firestore only, no Realtime Database

| Need | Choice | Why |
|---|---|---|
| All business data (users, org, inventory, cash flow, publicity, tickets, invoices) | **Firestore** | Relational-ish queries (filter by date, category, expiry), per-org security rules, offline support, real-time listeners (`onSnapshot`) already included |
| Receipts, company logos, ticket attachments | **Firebase Storage** | Store only the URL/path in Firestore |
| AI processing, flag detection, smart pricing, invoice numbering | **Cloud Functions** | Never trust the client for these; functions write with admin SDK |
| Live presence / typing indicator (optional, later) | Realtime DB | Only if you really need "who is online". Skip for the hackathon |

Using one database keeps security rules, billing and code simple. Firestore listeners give you the real-time feel for the chatbot and dashboard.

## Structure

Everything business-related lives under `organizations/{orgId}/...` so one security rule (`isMember(orgId)`) protects all of it, and every query is naturally scoped per company.

```
users/{uid}
organizations/{orgId}
  members/{uid}
  products/{productId}
  inventoryLogs/{logId}
  transactions/{txId}
  summaries/{yyyy-MM}
  budgets/{budgetId}
  vendors/{vendorId}
  invoices/{invoiceId}
  flags/{flagId}
  publicity/{postId}
  tickets/{ticketId}
    messages/{msgId}
  chatSessions/{sessionId}
    messages/{msgId}
  complianceProgress/{itemId}
  notifications/{notifId}
  counters/{name}
orgCodes/{code}                 -> invitation code lookup
reference/smeAid/items/{id}     -> global, read-only
reference/complianceTemplates/items/{id}
reference/platformFees/items/{platformId}
```

## Merges and changes vs your draft

| Your draft | Change | Reason |
|---|---|---|
| Inventory Product + Inventory Log | Kept as two collections, documented together in `inventory.md` | Logs grow without limit; products must stay small. Do not embed logs in the product doc |
| Org `Member` list with dates | Moved to `members` subcollection | Arrays of members get messy with roles/join dates and are hard to secure |
| User has Organization Code **and** Organization UUID | Keep only `orgId` | Code belongs to the org; storing both duplicates data |
| Role "Member/Admin" vs feature "Owner vs Staff" | Roles: `owner`, `admin`, `staff` | Your draft contradicts itself |
| Publicity nested Date > Week > Schedule > Day | Flat `publicity/{postId}` with `weekNumber` and `scheduledAt` fields | Deep nesting cannot be queried or updated; Firestore wants flat docs |
| Product "Name > Id > stock..." | `name` is a field, `id` is the doc ID | Name is not a parent of its own ID |
| `Profit` stored on product | Store `costPrice` and `sellingPrice`; derive profit | Stored profit goes stale when either changes |
| Smart price per platform nested | `platformPricing` map on the product, fees from `reference/platformFees` | Hidden platform fee needs a source of truth |
| Report/Helpdesk | `tickets` + `messages` subcollection, linked to `transactionId` | Needed for "trace back to cash flow" |
| SME Aid + Compliance | One file `reference-data.md`, plus per-org `complianceProgress` | Both are mostly global static data |

## Missing pieces I added (collections you did not have)

1. `flags`: the Flagging feature had no storage. Needs a collection so users can dismiss or resolve flags.
2. `chatSessions`: the AI chatbot needs history and a record of what each AI action changed (for undo).
3. `invoices`: E-Invoicing had fields in the feature list but no table.
4. `budgets`: Over-Budget flag cannot work without budget data.
5. `vendors`: Vendor Overcharge flag needs price history per vendor/product.
6. `goals`: embedded in the org doc (structured, not free text), needed for Unrealistic Goal flag.
7. `orgCodes`: guarantees invitation code uniqueness.
8. `notifications`: for flags, expiry alerts, compliance deadlines.
9. `counters`: sequential invoice and ticket numbers, safely incremented in a transaction.

## Missing data points to decide on

- **Money format**: store as integer sen (RM 12.50 = `1250`) to avoid float errors. Add `currency: "MYR"`.
- **Soft delete**: use `deletedAt` instead of deleting transactions/products (audit trail, undo).
- **`createdAt`, `updatedAt`, `createdBy`** on every document.
- **Org-level settings**: timezone (`Asia/Kuala_Lumpur`), currency, language (BM/EN), low-stock threshold.
- **Invitation expiry**: should codes expire or be regeneratable? Added `expiresAt` and `active`.
- **Multi-org users**: can one person belong to several companies? Current design supports one active `orgId`; see `users.md` if you want many.
- **MyInvois (LHDN)**: real e-invoicing needs TIN, BRN, MSIC code, SST status, and API submission. The invoice schema includes these fields; for the hackathon you can generate a PDF and leave submission as "planned".
- **Typhoid** in your compliance list: valid for food businesses (food handler typhoid vaccination). Compliance items should be filtered by `businessType`.
- **Data privacy (PDPA)**: customer name/address on invoices is personal data; decide retention policy.
- **Analytics/feedback on posts**: view counts must be entered manually or pulled from platform APIs; decide which.


---

# users

**Database:** Firestore
**Path:** `users/{uid}` (doc ID = Firebase Auth UID)

Top-level because you need to read it right after login, before you know the org.

| Field | Type | Notes |
|---|---|---|
| `name` | string | |
| `email` | string | Copy of Auth email, lowercase |
| `photoUrl` | string? | Optional |
| `orgId` | string \| null | Null until the user creates or joins an org. **Replaces** your Organization Code + Organization UUID |
| `role` | `"owner" \| "admin" \| "staff"` | Denormalized copy of `members/{uid}.role` for fast UI. Source of truth is the member doc |
| `onboardingCompleted` | boolean | Personalized business questions finished? |
| `language` | `"en" \| "ms"` | |
| `fcmTokens` | string[] | Push notifications (optional) |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |
| `lastLoginAt` | timestamp | |

## Notes

- Also set a **custom claim** `{ orgId, role }` via Cloud Function when the user joins an org. Security rules can then check `request.auth.token.orgId` with no extra read.
- Your draft had "Role (Member/Admin)" but the feature list says Owner vs Staff. Use `owner`, `admin`, `staff`.
- **Multi-org later:** replace `orgId` with `orgIds: string[]` and `activeOrgId`. Not needed for the hackathon.
- Users cannot edit their own `role` or `orgId` from the client. Only Cloud Functions do (see security rules).

## Join flow

1. Owner creates org, function creates `orgCodes/{code}`.
2. Staff enters code, function validates, adds `organizations/{orgId}/members/{uid}`, updates `users/{uid}.orgId/role`, sets claims.

---

# organizations (+ members + orgCodes)

**Database:** Firestore
**Paths:**
- `organizations/{orgId}`
- `organizations/{orgId}/members/{uid}`
- `orgCodes/{code}`

Combines your "Organization/Company", the "Personalized Business Question" answers, and Team Organization.

## organizations/{orgId}

| Field | Type | Notes |
|---|---|---|
| `name` | string | |
| `ownerUid` | string | |
| `businessType` | enum | `fnb`, `retail`, `service`, `online_seller`, `manufacturing`, `other`. Drives compliance checklist and aid filtering |
| `businessTypeOther` | string? | When `other` |
| `establishedYear` | number | From "Since when?" (use `establishedAt` timestamp if month matters) |
| `ssmRegistered` | boolean | |
| `ssmNumber` | string? | Needed for invoices |
| `tin` | string? | Tax Identification Number (MyInvois) |
| `msicCode` | string? | Industry code (MyInvois) |
| `sstRegistered` | boolean | |
| `address` | map | `{ line1, line2, city, state, postcode, country }` |
| `phone` | string? | |
| `logoUrl` | string? | Storage path; optional per your feature list |
| `avgMonthlySales` | number | Integer sen. Onboarding answer |
| `avgMonthlyCost` | number | Integer sen. **Was missing from your org table**, but is in your questions |
| `goal` | map | `{ type, targetAmount, deadline, createdAt }`. `type`: `monthly_sales`, `profit`, `cost_cut`, `expand`, `other`. Structured so the Unrealistic Goal flag can compare it with real numbers |
| `settings` | map | `{ currency: "MYR", timezone: "Asia/Kuala_Lumpur", lowStockThreshold: 5, expiryAlertDays: 7 }` |
| `memberCount` | number | Maintained by function |
| `inviteCode` | string | Current active code (also a doc in `orgCodes`) |
| `createdAt`, `updatedAt` | timestamp | |

> Your old `Est` field is `establishedYear`, `Avg Monthly Sales` is `avgMonthlySales`.

## organizations/{orgId}/members/{uid}

| Field | Type | Notes |
|---|---|---|
| `role` | `"owner" \| "admin" \| "staff"` | Source of truth |
| `name` | string | Denormalized for display |
| `email` | string | |
| `joinedAt` | timestamp | Your "Member > UUID > Date" |
| `invitedVia` | string | Code used |
| `status` | `"active" \| "removed"` | |

## orgCodes/{code}

Doc ID **is** the code, which guarantees uniqueness (a transaction checks the doc does not exist before creating).

| Field | Type | Notes |
|---|---|---|
| `orgId` | string | |
| `createdBy` | string | |
| `active` | boolean | Owner can regenerate/disable |
| `expiresAt` | timestamp? | Optional |
| `defaultRole` | `"staff"` | |
| `uses` | number | |

## Owner vs Staff rules (suggested)

| Action | Owner | Admin | Staff |
|---|---|---|---|
| Manage members, regenerate code | yes | no | no |
| View profit/cost, cash flow reports | yes | yes | no |
| Edit goal, budgets | yes | yes | no |
| Add/update inventory, create invoices | yes | yes | yes |
| Add transactions | yes | yes | yes (own entries only editable) |
| Delete anything | yes | soft delete | no |

---

# inventory (products + inventoryLogs)

**Database:** Firestore
**Paths:**
- `organizations/{orgId}/products/{productId}`
- `organizations/{orgId}/inventoryLogs/{logId}`

Two collections, one doc. Products stay small and fast to list. Logs grow forever, so never embed them.

## products/{productId}

| Field | Type | Notes |
|---|---|---|
| `name` | string | Field, not a parent key (fix from draft) |
| `nameLower` | string | For prefix search |
| `sku` | string? | |
| `barcode` | string? | Indexed. Scanner lookup (`==` query) |
| `category` | string | |
| `unit` | string | `pcs`, `kg`, `box` |
| `stock` | number | Total across batches. Updated only in a transaction together with a log write |
| `lowStockThreshold` | number? | Overrides org default |
| `costPrice` | number | Sen |
| `sellingPrice` | number | Sen. **Needed** since profit cannot be computed without it |
| `profit` | number | Derived `sellingPrice - costPrice`. Optional to store; recompute on write |
| `batches` | array | `[{ batchId, qty, expiryDate, receivedAt, costPrice }]`. Handles multiple expiry dates per product. Keep under ~20 |
| `nearestExpiry` | timestamp? | Denormalized min of batches with qty>0, for the expiry query/sort |
| `platformPricing` | map | `{ grab: { suggestedPrice, platformFeePct, netAfterFee, updatedAt }, foodpanda: {...}, shopee: {...}, lazada: {...}, tiktok: {...} }`. Sen |
| `imageUrl` | string? | |
| `vendorId` | string? | Default supplier |
| `active` | boolean | |
| `deletedAt` | timestamp? | Soft delete |
| `createdAt`, `updatedAt`, `createdBy` | | |

### Smart pricing

- Fee percentages come from `reference/platformFees/items/{platform}` (commission, payment fee, delivery subsidy, etc.) so "hidden platform fee" is explainable to the user.
- Formula idea: `suggestedPrice = (costPrice * (1 + targetMargin)) / (1 - totalFeePct)`.
- A Cloud Function recalculates `platformPricing` when cost changes or fees change. Prices are suggestions only.

## inventoryLogs/{logId}

Write-once, never edited.

| Field | Type | Notes |
|---|---|---|
| `productId` | string | |
| `productName` | string | Snapshot, in case product is renamed/deleted |
| `action` | `"add" \| "remove" \| "update" \| "adjust" \| "expired" \| "sale"` | |
| `qtyChange` | number | Signed |
| `stockBefore`, `stockAfter` | number | |
| `source` | `"manual" \| "ai_text" \| "spreadsheet" \| "receipt" \| "barcode"` | Replaces "Who (id or AI)" ambiguity |
| `actorUid` | string \| null | Null if AI |
| `aiRequestId` | string? | Links to `chatSessions` message so AI changes can be undone |
| `transactionId` | string? | Link to cash flow if the stock purchase created an expense |
| `detail` | string | Human-readable |
| `createdAt` | timestamp | |

## Features mapping

| Feature | How |
|---|---|
| Barcode scanner | Browser camera (e.g. `html5-qrcode`), then query `products where barcode == x` |
| Expiry date | `batches[].expiryDate` + `nearestExpiry`; daily scheduled function creates notifications |
| Count | `stock`; stock-take creates `adjust` logs |
| Text to inventory | Chatbot parses "bought 20 boxes eggs at RM12", function creates product/batch + log + expense transaction |
| Spreadsheet import | Parse client-side, validate, batch write (max 500 writes per batch) |

---

# transactions (Cash Flow) + budgets + vendors

**Database:** Firestore
**Paths:**
- `organizations/{orgId}/transactions/{txId}`
- `organizations/{orgId}/budgets/{budgetId}`
- `organizations/{orgId}/vendors/{vendorId}`

Budgets and vendors live here because the Over-Budget and Vendor Overcharge flags read them together with transactions.

## transactions/{txId}

Doc ID is the Ref ID. Use an auto ID; show a friendly `refNo` from counters if needed.

| Field | Type | Notes |
|---|---|---|
| `type` | `"in" \| "out"` | Earning / spending |
| `amount` | number | Integer sen, always positive; `type` decides sign |
| `currency` | string | `"MYR"` |
| `category` | string | `sales`, `stock_purchase`, `rent`, `utilities`, `salary`, `marketing`, `platform_fee`, `tax`, `other`. Use a fixed enum list |
| `description` | string | Your "Detail" |
| `date` | timestamp | When it happened (can differ from `createdAt`) |
| `paymentMethod` | `"cash" \| "bank" \| "ewallet" \| "card" \| "platform_payout"` | **Missing from draft** |
| `vendorId` | string? | For outgoing |
| `counterparty` | string? | Free text name if no vendor |
| `platform` | string? | `shopee`, `grab`, ... for platform sales and payouts |
| `productRefs` | array? | `[{ productId, qty, unitPrice }]` links to inventory |
| `receiptUrl` | string? | Storage path |
| `source` | `"manual" \| "ai_text" \| "receipt" \| "spreadsheet" \| "invoice"` | |
| `invoiceId` | string? | If created from an invoice |
| `createdBy` | string \| null | Your "Who"; null for AI |
| `aiConfidence` | number? | 0-1, for receipt OCR; low values prompt user review |
| `dedupeHash` | string | Hash of `date(day) + amount + category + counterparty`. Used by Duplicate Entry flag |
| `flagIds` | string[] | Flags attached to this tx (denormalized) |
| `status` | `"confirmed" \| "pending_review"` | AI entries start as pending |
| `deletedAt` | timestamp? | Soft delete |
| `createdAt`, `updatedAt` | timestamp | |

### Summary docs (recommended)

Do not sum thousands of transactions on every dashboard load. Maintain `organizations/{orgId}/summaries/{yyyy-MM}`:

`{ totalIn, totalOut, net, byCategory: { rent: 120000, ... }, txCount }`

updated by a Cloud Function on transaction write (use `FieldValue.increment`).

## budgets/{budgetId}

| Field | Type | Notes |
|---|---|---|
| `category` | string | Matches transaction category, or `"total"` |
| `period` | `"monthly"` | Add `weekly` later |
| `amount` | number | Sen |
| `month` | string | `"2026-10"` or null for recurring |
| `alertAtPct` | number | e.g. 80 |
| `createdBy`, `createdAt`, `updatedAt` | | |

## vendors/{vendorId}

| Field | Type | Notes |
|---|---|---|
| `name` | string | |
| `contact` | string? | |
| `priceHistory` | array | Capped, last ~20: `[{ productId, unitPrice, date }]`. Vendor Overcharge compares new price to the average |
| `createdAt` | timestamp | |

## Flags triggered from here

See `flags.md`: duplicate entry (same `dedupeHash` within 24h), over-budget (summary vs budget), unusual price (new unit price > ~20% above vendor average).

## Indexes needed

- `type ASC, date DESC`
- `category ASC, date DESC`
- `dedupeHash ASC, date DESC`
- `deletedAt ASC, date DESC`

---

# publicity

**Database:** Firestore
**Path:** `organizations/{orgId}/publicity/{postId}`

Your draft nested `Date > Week Num > Schedule > Day > Platform > ...` which cannot be queried. Flatten it: **one document per planned post**. Week and date become fields.

Per your note ("separate json between video and caption, separate date etc"), the caption and video plan are separate maps so the AI can regenerate each independently.

| Field | Type | Notes |
|---|---|---|
| `weekNumber` | number | Week 1, 2, 3 of the plan |
| `planId` | string | Groups posts generated in one AI run (e.g. "October plan") |
| `scheduledAt` | timestamp | Suggested day and time (smart schedule) |
| `platform` | `"instagram" \| "facebook" \| "tiktok" \| "youtube"` | Your draft had IG/FB/YT; TikTok is in your e-commerce list so add it |
| `status` | `"suggested" \| "approved" \| "posted" \| "skipped"` | **Missing from draft** |
| `goal` | string | `promo`, `awareness`, `new_product`, `clearance` |
| `productIds` | string[] | Link to inventory (e.g. promote near-expiry stock) |
| `caption` | map | `{ text, hashtags[], language, tone, generatedAt }` |
| `video` | map | `{ context, durationSec, shots: [{ order, description, durationSec }], format: "reel" \| "short" \| "story", musicSuggestion? }` |
| `scheduleReason` | string | Why the AI chose this time (explainability) |
| `feedback` | map | `{ viewCount, likes, comments, shares, recordedAt }`. Manual entry unless you integrate platform APIs |
| `postedAt` | timestamp? | |
| `createdBy` | string \| "ai" | |
| `createdAt`, `updatedAt` | timestamp | |

## Notes

- Feedback loop: store `feedback` so the next AI plan can favour times and formats that performed best.
- Your draft had `Detail` under Video Format; replaced by `shots[]` (your Context / Duration / Shot).
- Missing data to consider: target audience, budget for ads, link to the actual posted URL (`postUrl`).

## Indexes

- `status ASC, scheduledAt ASC`
- `planId ASC, weekNumber ASC, scheduledAt ASC`

---

# tickets (Report Log / HelpDesk)

**Database:** Firestore
**Paths:**
- `organizations/{orgId}/tickets/{ticketId}`
- `organizations/{orgId}/tickets/{ticketId}/messages/{msgId}`

Replaces your `Report` table. Messages are a subcollection so a ticket can have a conversation without bloating the doc.

## tickets/{ticketId}

| Field | Type | Notes |
|---|---|---|
| `ticketNo` | string | Friendly number from `counters`, e.g. `TKT-0042` |
| `title` | string | |
| `description` | string | Your "Detail" |
| `category` | `"cash_flow" \| "inventory" \| "invoice" \| "account" \| "bug" \| "other"` | |
| `status` | `"open" \| "in_progress" \| "resolved" \| "closed"` | |
| `priority` | `"low" \| "medium" \| "high"` | **Missing from draft** |
| `reportedBy` | map | `{ uid, name }` (your Name + UUID) |
| `assignedTo` | string? | Admin/owner uid |
| `transactionId` | string? | **Trace back to cash flow**: links the ticket to the disputed transaction |
| `relatedRefs` | map? | `{ productId?, invoiceId?, flagId? }` |
| `attachments` | array | `[{ url, name }]` Storage paths |
| `createdAt`, `updatedAt` | timestamp | |
| `resolvedAt` | timestamp? | |
| `resolutionNote` | string? | |

## messages/{msgId}

| Field | Type |
|---|---|
| `authorUid` | string |
| `authorName` | string |
| `text` | string |
| `attachments` | array |
| `createdAt` | timestamp |

## Trace back

On the transaction side keep `ticketIds: string[]` (optional) so the cash flow screen can show a "reported" badge. Writes to this field happen via function when a ticket is created with a `transactionId`.

## Indexes

- `status ASC, createdAt DESC`
- `transactionId ASC, createdAt DESC`

---

# invoices (E-Invoicing)

**Database:** Firestore
**Path:** `organizations/{orgId}/invoices/{invoiceId}`

**Missing from your draft** (only a feature list existed). Customer details are included because an invoice needs a buyer.

| Field | Type | Notes |
|---|---|---|
| `invoiceNo` | string | Sequential, from `counters/invoice` in a transaction (no gaps/duplicates) |
| `status` | `"draft" \| "issued" \| "paid" \| "cancelled"` | Add `submitted_myinvois` if you integrate LHDN |
| `issueDate` | timestamp | |
| `dueDate` | timestamp? | |
| `seller` | map | Snapshot of org at issue time: `{ name, ssmNumber, tin, msicCode, address, phone, logoUrl? }`. Logo optional per your list |
| `buyer` | map | `{ name, tin?, address, email?, phone? }` |
| `items` | array | `[{ productId?, description, qty, unitPrice, discount, taxRate, lineTotal }]`. Your "Product" |
| `subtotal`, `taxTotal`, `discountTotal`, `grandTotal` | number | Sen |
| `taxType` | `"none" \| "sst"` | |
| `currency` | string | |
| `notes` | string? | |
| `pdfUrl` | string? | Generated by function, Storage |
| `transactionId` | string? | Cash flow entry created when marked paid |
| `myInvois` | map? | `{ uuid, submissionId, validationStatus, qrUrl }` for later |
| `createdBy`, `createdAt`, `updatedAt` | | |

## Notes

- **Snapshot** seller and items; never reference the live org doc, otherwise old invoices change when the address or product price changes.
- Issued invoices are immutable. Corrections are credit notes (`type: "credit_note"`, `refInvoiceId`).
- Marking paid should create an `in` transaction (`source: "invoice"`) and decrement stock via logs.
- Missing data points to confirm: payment terms, bank details for payment, customer saved list (add `customers` collection if repeat buyers matter).

## Indexes

- `status ASC, issueDate DESC`

---

# flags (+ notifications)

**Database:** Firestore
**Paths:**
- `organizations/{orgId}/flags/{flagId}`
- `organizations/{orgId}/notifications/{notifId}`

**Missing from your draft.** Created by Cloud Functions only (clients can read and resolve, not create).

## flags/{flagId}

| Field | Type | Notes |
|---|---|---|
| `type` | `"duplicate_entry" \| "over_budget" \| "unrealistic_goal" \| "vendor_overcharge" \| "low_stock" \| "expiring"` | Your 4 types plus 2 obvious inventory ones |
| `severity` | `"info" \| "warning" \| "critical"` | |
| `status` | `"open" \| "dismissed" \| "resolved"` | |
| `title` | string | |
| `message` | string | Plain explanation shown to the user |
| `entityType` | `"transaction" \| "product" \| "budget" \| "goal"` | |
| `entityId` | string | |
| `evidence` | map | Type-specific, e.g. `{ matchedTransactionId }`, `{ budget, actual }`, `{ vendorAvgPrice, newPrice, pctAbove }`, `{ goalAmount, avgMonthlySales, multiple }` |
| `resolvedBy` | string? | |
| `resolutionNote` | string? | |
| `createdAt`, `resolvedAt` | timestamp | |

## Detection rules (suggested defaults)

| Flag | Trigger |
|---|---|
| Duplicate entry | Same `dedupeHash` already exists within 24h |
| Over-budget | Monthly category total from `summaries` >= budget (warn at `alertAtPct`) |
| Unrealistic goal | `goal.targetAmount` > ~3x `avgMonthlySales`, or deadline too short for required growth rate |
| Vendor overcharge | New unit price > 20% above vendor average for the same product |

Tune thresholds as constants or in `settings` so you can explain them to judges.

## notifications/{notifId}

| Field | Type |
|---|---|
| `userUid` | string \| `"all"` |
| `type` | string (flag, expiry, compliance_due, ticket_update) |
| `title`, `body` | string |
| `link` | string (app route) |
| `read` | boolean |
| `createdAt` | timestamp |

## Indexes

- `status ASC, createdAt DESC`
- `type ASC, status ASC`

---

# chatSessions (Smart AI Chatbot)

**Database:** Firestore
**Paths:**
- `organizations/{orgId}/chatSessions/{sessionId}`
- `organizations/{orgId}/chatSessions/{sessionId}/messages/{msgId}`

**Missing from your draft.** Needed for conversation history, and to know what each AI action changed so users can undo.

## chatSessions/{sessionId}

| Field | Type | Notes |
|---|---|---|
| `uid` | string | Owner of the session |
| `title` | string | Auto-generated from first message |
| `lastMessageAt` | timestamp | |
| `createdAt` | timestamp | |

## messages/{msgId}

| Field | Type | Notes |
|---|---|---|
| `role` | `"user" \| "assistant"` | |
| `text` | string | |
| `inputType` | `"text" \| "spreadsheet" \| "receipt"` | Your 3 chatbot modes |
| `attachmentUrl` | string? | Uploaded receipt image or sheet (Storage) |
| `parsedActions` | array? | Structured result from AI before confirming: `[{ kind: "add_product" \| "add_transaction" \| "update_stock", payload, confidence }]` |
| `status` | `"pending_confirmation" \| "applied" \| "rejected" \| "undone"` | Human-in-the-loop for AI writes |
| `appliedRefs` | array? | `[{ collection, docId }]` records created, powers undo |
| `error` | string? | |
| `createdAt` | timestamp | |

## Flow

1. User sends text/receipt.
2. Cloud Function calls the model, writes `parsedActions` with `pending_confirmation`.
3. UI shows a confirm card; on confirm the function writes products/logs/transactions with `source: "ai_text" | "receipt" | "spreadsheet"` and `aiRequestId = msgId`.
4. Low `confidence` rows are highlighted for manual edit.

Keep the model API key server-side only.

---

# reference data: SME Aid, Compliance, Platform Fees (+ per-org progress)

**Database:** Firestore
**Paths:**
- `reference/smeAid/items/{aidId}` (global, read-only to clients)
- `reference/complianceTemplates/items/{templateId}` (global)
- `reference/platformFees/items/{platformId}` (global)
- `organizations/{orgId}/complianceProgress/{templateId}` (per org)

Combined because all three are mostly static, admin-maintained data. Seed with a script; update without redeploying the app.

## smeAid/items/{aidId}

| Field | Type | Notes |
|---|---|---|
| `name` | string | AIM, TEKUN, BSN Micro Financing, BNM schemes |
| `provider` | string | |
| `type` | `"loan" \| "grant" \| "training" \| "guarantee"` | |
| `maxAmount` | number? | Sen |
| `interestOrFee` | string | e.g. "0% / Islamic profit rate" (verify from source) |
| `eligibility` | map | `{ ssmRequired, minYearsOperating, maxMonthlySales, businessTypes[], bumiOnly? }`. Enables matching with org profile |
| `applyUrl` | string | |
| `requiredDocs` | string[] | |
| `lastVerifiedAt` | timestamp | Aid terms change; show when last checked |
| `active` | boolean | |

Matching: compare `organizations.{ssmRegistered, establishedYear, avgMonthlySales, businessType}` with `eligibility`. Run client-side; the dataset is small.

## complianceTemplates/items/{templateId}

| Field | Type | Notes |
|---|---|---|
| `title` | string | Tax filing, E-Invoice, SSM registration, Typhoid vaccination (food handlers), SST, business licence |
| `description` | string | |
| `appliesTo` | map | `{ businessTypes[], ssmRequired?, minMonthlySales? }`. Typhoid should only apply to `fnb` |
| `recurrence` | `"once" \| "monthly" \| "yearly"` | |
| `dueRule` | string? | e.g. "end of April" |
| `learnMoreUrl` | string | |
| `priority` | number | |

## organizations/{orgId}/complianceProgress/{templateId}

| Field | Type |
|---|---|
| `status` | `"todo" \| "in_progress" \| "done" \| "not_applicable"` |
| `dueDate` | timestamp? |
| `completedAt` | timestamp? |
| `completedBy` | string? |
| `proofUrl` | string? |
| `notes` | string? |

Create progress docs lazily (only when the user touches an item); items without a doc are `todo`.

## platformFees/items/{platformId}

Doc ID: `grab`, `foodpanda`, `shopee`, `lazada`, `tiktok`.

| Field | Type | Notes |
|---|---|---|
| `name` | string | |
| `commissionPct` | number | |
| `paymentFeePct` | number | |
| `fixedFee` | number | Sen |
| `otherFees` | array | `[{ label, pct, fixed }]` the "hidden" ones: voucher funding, shipping subsidy, service fee |
| `updatedAt` | timestamp | |
| `sourceUrl` | string | |

Fees change often. Treat the numbers as seed data to verify against each platform's seller page before demoing.