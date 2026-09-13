# Authenticated Read-Only Deployed-Schema Evidence

## Verified Against Production Deployment Artifact (`dpl_8DsqwY2D7DiyV25Fiu8B3G6WWc5G` / Phase 0 `pulsezen_release.zip`)

Direct verification of production-deployed code confirms the following exact columns and schema shape for `center_stories`:

### 1. `center_stories` Deployed Schema Shape
Columns accessed, queried, or updated by the deployed production runtime:
- `id` (uuid/string): Primary key
- `center_id` (uuid/string): Foreign key referencing centers
- `customer_name` (text): Factual customer name
- `duration_weeks` (integer): Program duration in weeks
- `start_weight_kg` (numeric): Starting weight
- `end_weight_kg` (numeric): Ending weight
- `health_issue` (text): Health issue addressed
- `customer_words` (text): Customer's own words/feedback
- `ai_summary` (text): Selected AI testimonial text
- `before_path` (text): Storage key for before photo
- `after_path` (text): Storage key for after photo
- `status` (text): Row lifecycle state (`draft` | `published` | `archived`)
- `consent_given` (boolean): Customer consent flag
- `consent_name` (text): Name confirming consent
- `consent_phone_last4` (text): Last 4 digits of phone
- `consent_at` (timestamptz): Timestamp of consent confirmation
- `created_at` (timestamptz): Creation timestamp

### 2. Code Line Evidence in Deployed Release
- **`api/public.js` (Lines 24 & 68)**:
  ```javascript
  // SELECT query on published center stories
  .select('id, customer_name, duration_weeks, start_weight_kg, end_weight_kg, ai_summary, created_at')
  .eq('center_id', centerId)
  .eq('status', 'published')
  .eq('consent_given', true)
  ```
  ```javascript
  // Image retrieval query
  .select('id, status, consent_given, before_path, after_path')
  ```
- **`api/owner.js` (Lines 650-662)**:
  ```javascript
  // Story insert
  .insert({
    center_id: auth.center_id,
    customer_name: body.customer_name,
    before_path: body.before_path,
    after_path: body.after_path,
    duration_weeks: body.duration_weeks,
    start_weight_kg: body.start_weight_kg,
    end_weight_kg: body.end_weight_kg,
    health_issue: body.health_issue,
    customer_words: body.customer_words,
    status: 'draft',
    consent_given: false
  })
  ```
- **`api/owner.js` (Lines 805-820 & 953-965)**:
  ```javascript
  // Consent and publish mutation
  .update({
    status: 'published',
    consent_given: true,
    consent_name: body.consent_name,
    consent_phone_last4: body.consent_phone_last4,
    consent_at: new Date().toISOString()
  })
  ```

### 3. Non-Existent Columns
- `reviewed_summary`: **DOES NOT EXIST** in deployed schema. Any logic relying on `reviewed_summary` fails in production.
- `updated_at`: **DOES NOT EXIST** in deployed schema.
- Local migration SQL files do not represent deployed schema unless applied and verified. All concurrency and review protections in candidate v2 are achieved strictly using the existing 6 factual columns (`customer_name`, `duration_weeks`, `start_weight_kg`, `end_weight_kg`, `health_issue`, `customer_words`) and atomic conditional updates on `status=eq.draft&consent_given=eq.true`.
