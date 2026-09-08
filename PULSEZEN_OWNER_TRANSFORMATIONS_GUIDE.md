# PulseZen Center Owner Portal & AI Transformation Showcase
## Architecture, Financial Feasibility (₹99/mo), & Supabase Scaling Analysis

---

## 1. Executive Summary

The **PulseZen Owner Portal & AI Transformation Showcase** enables wellness center owners to self-authenticate via OTP, upload before-and-after client photos, input client health journeys, and use Groq Llama-3 AI to instantly generate compliant, hype-free, first-person testimonials that showcase verified results on their center landing pages.

### Key Highlights
- **Zero App Installation Needed**: Mobile-optimized web portal accessible at `pulsezen.in/owner` with email OTP authentication.
- **Client-Side Compression**: Photos compressed on device before upload (~70 KB per photo), reducing storage and bandwidth by ~95%.
- **Automatic Compliance Filter**: Groq Llama-3 rewrites member stories with a strict 2-stage server-side filter blocking curative/medical claims (`cure`, `treat`, `reverse`, `medicine`, `diabetes-free`), protecting center owners from regulatory penalties under the *Drugs and Magic Remedies Act* and *FSSAI*.
- **Consent Gate & Instant Takedown**: Digital audit trail of client consent (name + phone last 4 digits) with 1-click unpublish.

---

## 2. Monetization Strategy: Can We Charge ₹99/Month?

### The Short Answer: **Yes, ₹99/month is an ideal micro-SaaS price point in India.**

### Why ₹99/Month Works
1. **Under the "Impulse Buy" Threshold**: ₹99/month is less than the cost of a single nutrition shake (~₹120–₹150) or 2 cups of tea. Center owners do not need to "think" or consult a partner to approve ₹99/month.
2. **High Perceived ROI**: A single new client walking into the center because they saw an authentic local transformation generates ₹2,000 to ₹5,000 in monthly shake and program revenue. A ₹99/month investment pays for itself 20x to 50x over with just one converted lead.
3. **High Retention & Lock-in**: Once a center owner uploads 10–15 customer transformation stories that are linked to their QR codes and website, they will almost never churn or cancel.

### Recommended Packaging Models

| Strategy | Structure | Pros | Best For |
| :--- | :--- | :--- | :--- |
| **Model A: Micro Add-On** | Base Plan (₹499/mo) + Transformations Add-on (₹99/mo) = **₹598/mo** | Lowest friction to upsell existing Basic plan users. | Short-term launch |
| **Model B: Freemium Hook (Recommended)** | **First 3 transformations FREE**. Unlimited transformations + AI generator = **₹99/mo** | Every center owner tries it for free, sees it work, and gladly pays ₹99/mo when they hit the 4th client. | Maximum viral adoption |
| **Model C: Pro Tier Value Driver** | Free in Pro Plan (₹999/mo), ₹99/mo add-on for Basic (₹499/mo) | Drives owners to jump from Basic to Pro (boosting your monthly recurring revenue by ₹500/center). | Long-term MRR expansion |

---

## 3. Storage & Cost Analysis: Will Storing Client Photos Force a Paid Supabase Plan?

### The Short Answer:
**No, you can comfortably support over 700 wellness centers on the FREE Supabase plan.** When you eventually exceed it, just **22 paying centers** will cover 100% of the Supabase Pro bill, leaving you with a **95%+ gross profit margin**.

---

### Step-by-Step Mathematical Breakdown

#### 1. Image Size Optimization (Client-Side Compression)
- Raw phone camera photos are typically 3 MB to 8 MB each.
- In our portal (`pulsezen/owner.html`), photos are automatically drawn onto an HTML5 Canvas and resized to a maximum dimension of 1200px at 80% JPEG/WebP quality before being uploaded.
- **Resulting file size**: **60 KB to 80 KB** per photo (average: ~70 KB).
- **Per Transformation Pair** (Before + After): $70\text{ KB} \times 2 = \mathbf{140\text{ KB}}$.

#### 2. Storage Capacity on Supabase Free Tier
- **Supabase Free Tier Storage Limit**: **1,000 MB (1 GB)**.
- If an active center maintains an average gallery of **10 client transformations**:
  $$\text{Storage per center} = 10 \times 140\text{ KB} = 1.4\text{ MB}$$
- Number of centers supported within 1 GB:
  $$\frac{1,000\text{ MB}}{1.4\text{ MB/center}} = \mathbf{714\text{ Centers Completely FREE}}$$
- Even if centers upload **25 transformations each** (3.5 MB per center):
  $$\frac{1,000\text{ MB}}{3.5\text{ MB/center}} = \mathbf{285\text{ Centers Completely FREE}}$$

#### 3. Bandwidth / Egress Analysis
- **Supabase Free Tier Bandwidth Limit**: **2 GB / month** (2,000 MB).
- When visitors browse center websites, photos are served through serverless routes (`/api/public/photo`).
- $2,000\text{ MB} / 140\text{ KB} = \mathbf{14,285\text{ transformation card views per month}}$ before touching the limit.
- With HTTP edge caching on Vercel (`Cache-Control: public, max-age=86400, stale-while-revalidate=604800`), repeated views are served directly from edge CDN cache and never count toward Supabase egress!

#### 4. Groq Llama-3 AI Costs
- Model: `llama-3.1-8b-instant`
- Cost: $0.05 per 1,000,000 input tokens / $0.08 per 1,000,000 output tokens.
- Each transformation summary generation consumes ~200 tokens = **$0.000015 (~₹0.0013 per transformation)**.
- Generating 1,000 transformations costs approximately **₹1.30** in total AI compute. Groq AI costs are effectively zero.

---

### Profit & Unit Economics Table

When you eventually reach 700+ centers and upgrade to Supabase Pro:
- **Supabase Pro Tier**: $25/month (~₹2,100/mo) includes **100 GB storage** and **250 GB bandwidth** (enough for 70,000+ client transformations!).

| Paying Centers | Monthly Revenue (@ ₹99/mo) | Infrastructure Cost (Supabase + Groq) | Net Monthly Profit | Gross Margin |
| :--- | :--- | :--- | :--- | :--- |
| **22 Centers** | ₹2,178 | ₹2,100 (Supabase Pro break-even) | +₹78 | 4% |
| **50 Centers** | ₹4,950 | ₹2,105 | +₹2,845 | 57% |
| **100 Centers** | ₹9,900 | ₹2,110 | **+₹7,790** | **78%** |
| **300 Centers** | ₹29,700 | ₹2,125 | **+₹27,575** | **93%** |
| **500 Centers** | ₹49,500 | ₹2,150 | **+₹47,350** | **95.6%** |
| **1,000 Centers** | ₹99,000 | ₹2,200 | **+₹96,800** | **97.7%** |

> **Conclusion**: You will **not** need to upgrade to a paid Supabase plan until you have hundreds of centers. And once you do upgrade, charging ₹99/mo generates massive 90%+ profit margins.

---

## 4. Feature Architecture & User Flow

```
[ Center Owner ]
       │
       ▼
1. OTP Login (pulsezen.in/owner-login)
       │  (Rate-limited: 3 OTPs/hr, 5 verify attempts, lockout protection)
       ▼
2. Owner Portal (pulsezen.in/owner)
       │
       ├─► Step 1 & 2: Before & After Photos (auto-compressed on client to 1200px @ 80%)
       ├─► Step 3: Numerical Facts (Duration in weeks, Start Weight kg, End Weight kg)
       ├─► Step 4: Customer's Real Story in their own words
       ├─► Step 5: AI Polish via Groq Llama-3 (2 compliant variants generated, medical claims blocked)
       └─► Step 6: Consent Gate (Explicit consent check + Customer name + Phone last 4)
       │
       ▼
3. Stored in Supabase (`transformations` table + private bucket)
       │
       ▼
4. Rendered Live on Center Landing Page (e.g., dharanis.pulsezen.in)
       └─► Public API: `/api/public/transformations?center_id=...`
       └─► Ephemeral Photo Stream: `/api/public/photo?id=...&kind=before|after`
```

---

## 5. Security & Legal Compliance Protections

1. **Private Storage Bucket**:
   - The Supabase bucket `transformations` is strictly **private** (`public = false`).
   - Direct anonymous access to storage files is forbidden.
   - Public photos are streamed solely through `/api/public/photo`, which verifies that both `status = 'published'` AND `consent_given = true`.

2. **Legal Claim Post-Filter (`_owner-helper.js`)**:
   - Automatically inspects AI summaries against a prohibited term list:
     `cure`, `treat`, `heal`, `reverse`, `medicine`, `prescription`, `doctor`, `diabetes-free`, `disease-free`.
   - If an owner enters unverified medical claims, the system triggers a negative retry prompt. If medical claims persist, publication is blocked with a clear warning.

3. **Orphan Storage Auto-Cleanup**:
   - A daily cron job (`/api/cron/cleanup`) scans Supabase storage, removes abandoned draft photos older than 24 hours, and prunes unreferenced images so storage never bloats.

---

## 6. Deployment & Database Setup

1. **Run Migration**:
   - Open Supabase SQL Editor and execute `owner_portal_migration.sql`.
   - This creates tables: `owner_users`, `transformations`, `owner_login_attempts`, and configures the private `transformations` storage bucket.

2. **Create Initial Owner User**:
   ```sql
   -- Link owner user email to their wellness center
   INSERT INTO owner_users (center_id, email, status)
   VALUES (
     (SELECT id FROM wellness_centers WHERE slug = 'dharanis' LIMIT 1),
     'owner@example.com',
     'active'
   );
   ```

3. **Environment Variables**:
   Ensure the following are configured in your Vercel Project Settings:
   - `SUPABASE_URL`: `https://erteibdxzdvsaujptxsd.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase Service Role Key
   - `GROQ_API_KEY`: Groq API key for Llama-3 AI summarization
   - `CRON_SECRET`: Random 32+ character string for cleanup cron authentication
   - `OWNER_SESSION_SECRET` *(Optional, auto-falls back to Supabase service key)*
