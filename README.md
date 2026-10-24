# BISCOACH

> A mobile-first web app with an AI business coach (Biscoach) that helps Malaysian owner-operated small businesses manage stock, receipts, supplier costs, finances, compliance and marketing in English, Bahasa Malaysia or Manglish, with every AI-proposed change approved by the user first.

---

## Team Information

| Field                  | Details                                     |
| ---------------------- | ------------------------------------------- |
| **Team Name**          | E30S                                        |
| **Team Domain**        | Domain 2                                    |
| **SDG Track (1–17)**   | SDG 1: No Poverty; SDG 4: Quality Education; SDG 8: Decent Work and Economic Growth; SDG 9: Industry, Innovation and Infrastructure; SDG 12: Responsible Consumption and Production; SDG 16: Peace, Justice and Strong Institutions |
| **Team Leader**        | Muhammad Hairil Zafran bin Mohd Helmi       |
| **University**         | Universiti Malaya                           |
| **Number of Members**  | 5                                           |

## Links

| Resource          | Link                                           |
| ----------------- | ---------------------------------------------- |
| GitHub Repository | https://github.com/mirulkasy/SDC_Hackathon_E30S_Submission.git |
| Replit Project    | https://replit.com/@mirulkasy/biscoach         |
| Live Demo         | https://biscoach.replit.app/                   |
| RunPod Endpoint   | - (not used; see "How We Use RunPod")          |
| Slide Deck        | https://drive.google.com/file/d/10KWdlsVsu1d8qGRRKwfzjj6zQDljuT9Z/view?usp=sharing |
| Slide Deck (Google Slides) | https://docs.google.com/presentation/d/1LM5fUrpRXWWWBNA-L6Gla4j2SCmFBqKN/edit?usp=sharing |
| Demo Video        | https://youtu.be/Z6rvl3wj3ts                   |

---

## Overview

### Problem

Most Malaysian micro and small businesses have one to five people, no HR system and no accountant. The owner is also the stock clerk, bookkeeper and marketer. Transactions end up scattered across paper receipts, handwritten notes and separate spreadsheets, while inventory and invoices are tracked elsewhere, so staff lose hours re-keying entries and owners cannot see their true profit.

This matters at three levels:

- **Economic:** Manual processes cause errors and revenue loss. Poor stock visibility locks up capital, and over- or under-ordering raises costs.
- **Environmental:** Over-ordering and weak tracking accelerate food spoilage, which wastes the water, land and energy used to produce the food and adds to packaging waste.
- **Social:** Wasted edible food worsens food insecurity, repetitive admin causes fatigue and burnout, and untracked expiry dates and batches create public health and compliance risks.

> Hackathon problem statement: *How might we design a reliable, easy-to-learn automation product for the Orbyte ecosystem that removes one recurring operational burden for micro and small businesses, improves accuracy and consistency, and keeps people in control, so it can serve many SMEs?*

### Solution

BISCOACH is built for the owner-operator: an AI business coach that handles the daily admin that employee-focused platforms never reach, namely stock, supplier costs, receipts and marketing. Owners type or photograph what happened ("jual 3 air milo", "add 50 stock to roti", a receipt, a supplier invoice) and the AI turns it into proposed changes to inventory, transactions or tickets. Each change appears as an approval card, and **nothing is saved until the user taps Allow or Apply**.

What makes it reliable:

- **AI for perception, code for judgment.** Gemini reads messy documents; deterministic code makes the decisions (vendor overcharge detection, posting-day ranking, pricing).
- **Validated output.** AI responses are schema-constrained and validated and sanitised on the server, and API keys never reach the browser.
- **Localised for Malaysia.** RM and sen, SST, e-Invoice, SSM, EPF/SOCSO, local aid schemes, and local platform fees (Shopee, TikTok Shop, GrabFood, Foodpanda).

### Fit with the Orbyte Ecosystem

**Orbyte** is an AI-powered business operating system for SMEs: one platform connecting people, processes, applications, data and AI, with shared foundations such as single sign-on, roles and permissions, workflow and approvals, an audit trail and a credit wallet. Its native modules today cover People (leave, claims, OT, attendance, directory), Hiring, Work, eSign and Connect, while other capabilities such as accounting and e-invoicing, POS and e-commerce, payments and financing referral are meant to come from integrated partners and an open API ecosystem.

BISCOACH targets the part of the day that an employee-centred platform does not reach for owner-operated micro businesses: **stock, receipts, supplier invoices, finances and marketing**. It is designed as a module that could sit within that ecosystem.

| Orbyte principle | How BISCOACH reflects it |
| ---------------- | ------------------------ |
| AI with business context that can act | The agent reads the organisation's own inventory, transactions and documents, then proposes concrete actions instead of generic answers |
| Approvals and audit trail | Every AI-proposed change needs an Allow/Apply tap; soft deletes preserve records |
| Charge on usage, not per seat | Built-in AI credit monitoring tracks token usage against a budget, with warnings and multi-key failover |
| Serve many SMEs | Multi-tenant organisations with invite codes, owner/staff roles and real-time sync |
| Open, modular ecosystem | Server-side API routes keep each capability (chat, receipts, vendor check, pricing) separate and reusable |

BISCOACH currently runs as a standalone web app with its own Firebase sign-in. Integration with the Orbyte ecosystem is **future work**; it is not part of the current prototype.

### Key Features

- **Biscoach conversational agent:** Tool-calling agent (up to 6 steps per turn) that searches products, lists transactions and proposes add/update/delete actions for products, transactions and tickets. Missing details are collected through a generated form instead of long chat questions, and existing products are matched to avoid duplicates.
- **Receipt and document scanner:** Upload receipts, invoices, delivery orders, stock-take counts, supplier lists or handwritten notes (JPEG, PNG, WebP, PDF) and get editable proposed actions.
- **Vendor Overcharge Check:** Gemini only transcribes invoices, purchase orders and contracts; a deterministic engine flags math errors, price above PO, over-quantity, forbidden or over-cap fees, discount shortfalls, freight above agreed and tax on extras.
- **Text-to-Inventory:** Natural-language stock updates in English, BM or mixed ("beli", "jual", "rosak", "baki"), confirmed by the owner with **Apply**.
- **Inventory, barcode scanner and expiry alerts:** Products with stock, cost, price, barcode, image and expiry date, with low-stock and near-expiry alerts for Food. Scheduled stock and expiry checks and push reminders are declared in our Technical Declaration.
- **Finance dashboard:** Sales, profit, spending and cash flow versus the previous period; gross vs net profit; spending breakdown; inventory health; CSV and Google Sheets export.
- **E-Invoice generator:** Printable invoice with optional Tax/SST % and a **Record as Sale** button. (It does not submit to LHDN MyInvois.)
- **Smart Posting Schedule and Video Ideas:** A multi-armed-bandit (UCB-style) recommender (an algorithm, not an LLM) picks posting days; Gemini then drafts a video plan, caption and hashtags for each day.
- **E-commerce Pricing Calculator:** Formula-based selling price per channel to hit a target margin after platform fees.
- **Compliance checklist, Tickets and Financial aid directory:** Malaysian SME checklist, internal issue tracker, and 15 curated Malaysian SME funding schemes.
- **Multi-user organisations:** Owner and staff roles, invite codes, and real-time sync via Firestore listeners.

### Tech Stack

| Layer         | Technology                                                                 |
| ------------- | -------------------------------------------------------------------------- |
| Frontend      | Next.js 16.4.2, React 19.3.0, JavaScript (JSX), CSS Modules                |
| Backend       | Next.js Route Handlers (`/api/*`), Node.js v24                             |
| Database      | Cloud Firestore (real-time listeners), Cloud Storage for Firebase          |
| Auth / Alerts | Firebase Authentication (email/password), Firebase Cloud Messaging         |
| AI            | Google Gemini API (Google AI Studio) via `@google/genai`: `gemini-3.5-flash` with `gemini-2.5-flash` fallback |
| Barcode       | `@zxing/browser`, `@zxing/library`                                         |
| Hosting / Dev | Replit Deployments and Scheduled Deployments; VS Code for most coding      |

---

## Project Structure

```
.
├── app/
│   ├── (public)/                  # Pages before sign-in
│   │   ├── splash/
│   │   ├── login/
│   │   └── onboarding/            # Welcome, organisation setup, monthly sales
│   ├── (protected)/               # Pages after sign-in
│   │   ├── home/                  # Dashboard and alerts
│   │   ├── inventory/             # List, add, [id] detail
│   │   ├── barcode/               # Camera barcode scanner
│   │   ├── transaction/           # List, add, [id] detail
│   │   ├── summary/               # Finance dashboard and export
│   │   ├── chat/                  # Biscoach conversational agent
│   │   ├── image/                 # Document → proposed actions
│   │   ├── invoice/               # E-Invoice generator
│   │   ├── publicity/             # Weekly views tracker, schedule and caption data
│   │   ├── checklist/             # Malaysian compliance checklist
│   │   ├── ticket/                # Ticket tracker (list, add, [id])
│   │   ├── aid/                   # Financial aid directory
│   │   ├── profile/
│   │   └── layout.js
│   ├── (ai)/                      # AI tool pages
│   │   ├── receipt-processing/
│   │   ├── text-to-inventory/
│   │   ├── vendor-overcharge/
│   │   ├── posting-schedule/
│   │   ├── video-ideas/
│   │   ├── ecommerce-pricing/
│   │   └── balance/               # AI credit / key status
│   ├── api/                       # Server-side route handlers
│   │   ├── chat/                  # Tool-calling agent
│   │   ├── receipt-processing/
│   │   ├── image-processing/
│   │   ├── text-to-inventory/
│   │   ├── vendor-overcharge/
│   │   ├── posting-schedule/
│   │   ├── video-ideas/
│   │   ├── ecommerce-pricing/
│   │   ├── balance/
│   │   └── sheet/[page]/          # Temporary CSV links for Google Sheets
│   ├── layout.js
│   ├── loading.js
│   └── page.js
├── assets/
│   └── team.png                   # Team photo
├── components/
│   ├── input/                     # CustomInput, CustomSelect, CustomUpload, DatePicker
│   └── layout/                    # AppBar, NavBar, ExportMenu
├── context/                       # AuthContext, OnboardingContext
├── lib/                           # Business logic and integrations
│   ├── firebase.js, auth.js       # Firebase setup and authentication
│   ├── gemini.js                  # Gemini client, key failover
│   ├── chat*.js                   # Agent loop, tools, schemas, files, interview forms
│   ├── inventory.js, transactions.js, tickets.js, summary.js
│   ├── publicity.js, checklist.js, aid.js, profile.js, onboarding.js
│   ├── csv.js, csv-builders.js    # Data export
│   └── usage.js                   # AI credit monitoring
├── styles/
│   └── globals.css
├── submission/                    # Required submission documents
│   ├── SDC2026_E30S_Preliminary.pdf
│   ├── SDC2026_E30S_TechDeclaration.pdf
│   ├── REPLIT PROOF OF USE.pdf
│   └── RUNPOD PROOF OF USE.pdf
├── .env.example
├── .gitignore
├── .replit
├── LICENSE
├── package.json
└── README.md
```

### Architecture

```
SME owner / staff ──► Firebase Authentication (sign up / log in)
        │
        ▼
Next.js app (mobile-first UI, hosted on Replit) ◄──► Cloud Firestore (org-scoped, real-time sync)
        │
        ▼  HTTPS
Next.js server routes (/api/*) ──► Google Gemini API (chat, receipts, video ideas)
        │                          (reads documents only; code makes the judgments)
        ▼
Approval card (Allow / Apply) ──► user approves ──► change saved to Firestore
```

### Data Model (Firestore)

```
users/{uid}                  name, email, orgId, role, language, ...
orgCodes/{INVITECODE}        orgId, active, expiresAt, defaultRole, uses
organizations/{orgId}        name, ownerUid, businessType, avgMonthlySales, settings, inviteCode
  members/{uid}              role (owner | staff), name, email, status
  products/{id}              name, stock, category, cost, price, dueDate, barcode, imageUrl, deletedAt
  transactions/{id}          type (in | out), amount, category, description, date, paymentMethod
  tickets/{id}               category, priority, status
  checklist/{itemId}         done, updatedBy, updatedAt
  publicity/state            current week
  publicityWeeks/{n}         daily views, AI ideas, platform, planned days
```

Money is stored as **integer sen** (RM 12.50 = 1250) to avoid floating-point errors.

---

## How to Run

### Option 1: Try the Live Demo (No Setup)

Open the deployed app at [biscoach.replit.app](https://biscoach.replit.app/), then sign up or log in with email and password. Nothing needs to be installed or configured.

### Option 2: Run on Replit

1. Open the [Replit Project](https://replit.com/@mirulkasy/biscoach), or import this repository via **Create Repl → Import from GitHub**.
2. Open the **Secrets** tab and add the variables listed in `.env.example`:
   - Gemini API key(s), with multiple keys supported for automatic failover: `GEMINI_API_KEYS`
   - Firebase configuration values:
     - `NEXT_PUBLIC_FIREBASE_API_KEY`
     - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
     - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
     - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
     - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
     - `NEXT_PUBLIC_FIREBASE_APP_ID`
3. Click **Run**. Replit uses the `.replit` file to start the app with `npm run dev`.

### Option 3: Run Locally

Requires Node.js v24.

```bash
# 1. Clone the repository
git clone https://github.com/mirulkasy/SDC_Hackathon_E30S_Submission.git
cd SDC_Hackathon_E30S_Submission

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env.local      # then fill in your values

# 4. Run the app
npm run dev
```

---

## How We Use Replit *(Required)*

- **Hosting:** The Next.js app (UI and server routes) is deployed and published through Replit Deployments at [biscoach.replit.app](https://biscoach.replit.app/).
- **Scheduled jobs:** Replit Scheduled Deployment runs the stock and expiry checks.
- **Secrets:** API keys are stored in Replit Secrets and are never committed to the code or exposed to the browser.
- **Development:** Most coding was done in VS Code; Replit was used mainly for deployment and publishing.
- **Portability:** Replit is helpful but not strictly essential. The core is a standard Next.js app that could be moved to another host with minimal changes.

📄 Proof of use: [`submission/REPLIT PROOF OF USE.pdf`](submission/REPLIT%20PROOF%20OF%20USE.pdf)

## How We Use RunPod *(Required)*

RunPod was not used in this project. BISCOACH's AI workloads (document reading, conversational assistance and content generation) run on the Google Gemini API, called server-side from our Next.js application, which met our requirements without dedicated GPU hosting. We would consider RunPod for future features that need custom or fine-tuned models.

---

## Impact Framework

Baselines and targets are taken from our Phase 1 Preliminary Proposal.

| Item | Details |
| ---- | ------- |
| **SDG sub-targets** | 1.4 (micro-enterprises reach financial aid and credit schemes); 4.4 (the AI coach closes the accounting and digital skills gap); 8.3 (promotes MSME formalisation and financial access); 9.3 (increase access of small-scale enterprises to financial services); 12.3 (less food waste); 12.5 (reduce waste generation through inventory tracking); 12.6 (encourage companies to integrate sustainability reporting); 16.6 (transparent, accountable records: audit-ready ledger, e-invoice, compliance) |
| **Baselines** | 89% of SMEs lack the skill to prepare financial statements (Mohamed et al., 2023, *Insight Journal* 10(1)); 80.3% of Malaysian businesses use social media (DOSM via The Edge, 30 Jun 2026); 57% of firms did not track social media's effect on performance (PwC 2014, cited in Md Jani et al.); food forgotten in storage until it expires is the biggest cause of food waste, followed by over-buying and overstocking (The Star, 9 Jul 2026) |
| **KPIs** | Financial Record Completeness Rate (%); Posting Consistency and Performance Tracking Rate (%); Expiry-Related Food Waste (kg or units per month, % reduction) |
| **Phase 2 targets** | 90% of receipts captured as complete structured entries (verified on a hand-checked sample of at least 50 receipts); 70% of planned posts published and 80% with logged performance; 25% reduction in expired-unsold stock, with at least 60% of near-expiry items sold or used before expiry |

## Design Principles

1. **Human-in-the-loop AI:** The AI proposes; the user approves. Nothing changes without **Allow** or **Apply**.
2. **AI for perception, code for judgment:** Models read documents; deterministic code decides.
3. **Forms over interrogation:** Missing details are collected through a generated form.
4. **Localised for Malaysia:** Currency, taxes, compliance, platforms, languages and timezone.
5. **Safety and robustness:** Schema-constrained output, server-side validation, prompt-injection resistance, scope limits, model fallback and retries, multi-key rotation, soft deletes and atomic batch writes.
6. **Honest AI:** Prompts forbid inventing prices, statistics or testimonials; legal and tax answers point to official sources.

## SDG Alignment

- **SDG 1 (No Poverty):** Gives micro and small business owners access to a directory of 15 Malaysian SME loans, grants and guarantee schemes, plus finance dashboards and cash-flow visibility that help keep their businesses, and their livelihoods, sustainable.
- **SDG 4 (Quality Education):** Builds everyday business and digital literacy for non-experts: the AI explains pricing, margins, cash flow and Malaysian compliance rules in plain English, Bahasa Malaysia or Manglish, and the compliance checklist guides owners through what they need to do.
- **SDG 8 (Decent Work and Economic Growth):** Helps small businesses formalise and grow through bookkeeping, finance dashboards, a compliance checklist (SSM, tax, SST, e-Invoice), per-channel pricing guidance, a directory of Malaysian SME funding schemes, and marketing support.
- **SDG 9 (Industry, Innovation and Infrastructure):** Brings practical AI and automation to small businesses that often lack digital tools, through a web-based platform with real-time data and multilingual AI.
- **SDG 12 (Responsible Consumption and Production):** Low-stock and expiry alerts for Food products reduce waste and over-ordering; vendor overcharge detection and expense records support accountable purchasing.
- **SDG 16 (Peace, Justice and Strong Institutions):** Promotes transparency and accountability: the vendor overcharge check gives small businesses explainable evidence against unfair billing, the compliance checklist supports adherence to Malaysian regulations (SSM, tax, SST, e-Invoice), and human-in-the-loop approval keeps people in control of AI actions.

---

## Third-Party Libraries, Services and AI Tools

| Name & Version | Purpose | License |
| -------------- | ------- | ------- |
| Next.js 16.4.2 | Full-stack framework and API routes | MIT |
| React / React DOM 19.3.0 | UI library | MIT |
| Node.js v24.21.0 | Server runtime | MIT |
| firebase 13.1.0 | Auth, Firestore, Cloud Storage, Cloud Messaging | Apache-2.0 |
| @google/genai 2.30.0 | Gemini API client | Apache-2.0 |
| @zxing/library 0.21.3, @zxing/browser 0.2.1 | Barcode scanning | MIT |
| babel-plugin-react-compiler 1.0.0, ESLint 9.39.5 | Build and lint tooling | MIT |
| Poppins, Inter fonts | Typography | SIL OFL 1.1 |
| Gemini 3.5 Flash (fallback Gemini 2.5 Flash) | Pre-trained AI model via API | Google APIs and Gemini API Terms of Service |

**External services:** Gemini API (free tier), Firebase Authentication, Cloud Firestore, Cloud Storage for Firebase and Firebase Cloud Messaging (free tiers), Replit Deployments and Scheduled Deployments (sponsor-provided).

**Datasets:** *E-Commerce & Food Delivery Platform Fee Reference Data*, a public dataset (no personal data) compiled from the Shopee MY Seller Education Hub, Lazada University, TikTok Shop Seller Center and the Grab and Foodpanda merchant portals, used for the pricing calculator (public/educational use). Users' own inputs (images, inventory, transactions, invoices) are private and contain personal data.

**AI-assisted development:** We used Claude (Sonnet 5.5) extensively to explain concepts and to write, debug and extend code. The team reviewed all generated code, tested each feature with sample inputs such as test receipts and invoices, and takes full responsibility for the final project.

See `submission/SDC2026_E30S_TechDeclaration.pdf` for the full declaration.

## Data, Privacy and Known Limitations

- **Data collected:** User name, company name, company type and estimated monthly sales, plus the business data users enter (inventory, transactions, invoices, images). Data shared with third-party services such as the Gemini API is handled under those services' privacy policies.
- **Limitations:** The AI runs on Google AI Studio's free tier, so it may hit rate limits or quota caps, and it depends on a single provider. Mitigations: model fallback, retries, multi-key failover, credit monitoring, schema-validated output and human approval of every change.

---

## Challenges & Learnings

**Challenges we faced**

- **Implementing a working AI in the project:** getting AI features to work reliably inside a real application was our main technical challenge.
- **Dividing roles:** as a team of five with different programmes and strengths, we had to decide who would take on research and design, AI engineering, data and full stack development.
- **Improving our capabilities:** we had to keep building our skills throughout the hackathon to make sure the project could succeed.

**What we learned**

- **Making AI work in a real application:** a working AI feature needs more than a good prompt. We learned to use AI for reading messy input and plain code for decisions, to validate every AI response on the server, and to add fallback models, retries and human approval so that mistakes or outages do not affect the owner's data.
- **Dividing roles:** assigning clear responsibilities, with research and design, AI engineering, data and full stack development each owned by someone, let the team work in parallel and made it easier to connect the pieces into one product.
- **Improving our capabilities:** we learned new tools along the way, including the Gemini API, Firebase and Next.js, by building real features, testing them with sample receipts and invoices, and reviewing each other's work, including AI-generated code.

## Future Improvements

- [ ] Pilot with real SMEs, measure time saved and errors caught, and iterate (from our Phase 2 plan)
- [ ] Integrate BISCOACH with the Orbyte ecosystem, starting with e-invoicing, the login page and sick leave

## Team

![E30S team](assets/team.png)

| Name | Programme | Role | GitHub |
| ---- | --------- | ---- | ------ |
| Muhammad Hairil Zafran bin Mohd Helmi (Hairil) | Computer System & Network | Team Leader, Full Stack Developer | [@Hairilzfrn](https://github.com/Hairilzfrn) |
| Saif Amirul Kasyfi bin Saiful Nizam (Kasyfi) | Computer System & Network | Research and UI/UX Designer | [@mirulkasy](https://github.com/mirulkasy) |
| Ahmad Umar Dinni bin Roszaidi (Umar) | Artificial Intelligence | AI Engineer | [@umardinni](https://github.com/umardinni) |
| Azhad Eizz bin Asmadi (Azhad) | Artificial Intelligence | Research and Data System | - |
| Ahmad Firdaus bin Ajemi (Firdaus) | Artificial Intelligence | AI Engineer | [@DeDauz](https://github.com/DeDauz) |

---

## Submission Checklist

- [x] Team name, domain (Domain 1 / Domain 2) and SDG track filled in
- [x] Slide deck link added
- [x] Demo video link added
- [x] Replit used, with proof of use in `submission/REPLIT PROOF OF USE.pdf`
- [x] RunPod: not used, with the reason explained in `submission/RUNPOD PROOF OF USE.pdf`
- [x] Preliminary submission completed (`SDC2026_E30S_Preliminary.pdf`)
- [x] Technology declaration completed (`SDC2026_E30S_TechDeclaration.pdf`)
- [x] Submission files renamed with your team name
- [x] "How to Run" steps verified
- [x] No API keys or secrets committed to the repository

## License

This project is licensed under the [Apache License 2.0](LICENSE).
