# Live Production Schema Metadata Evidence: `public.transformations`

## 1. Methodology: Direct PostgreSQL & PostgREST Live Introspection

To obtain actual read-only schema metadata for `public.transformations` rather than inferring column names from source code or assuming local SQL migrations reflect production, queries were executed directly against the live Supabase PostgREST endpoint:
`https://erteibdxzdvsaujptxsd.supabase.co/rest/v1/transformations?select=<column>`

### PostgreSQL Engine Response Contract:
1. **Existing Column**: When a column exists in `public.transformations`, PostgREST successfully validates the column against PostgreSQL metadata and attempts the table query. Because table `public.transformations` has RLS enabled with service_role-only permissions, PostgreSQL responds with:
   - **HTTP 401 / PostgreSQL Code `42501`**: `{"code":"42501","details":null,"hint":null,"message":"permission denied for table transformations"}`
2. **Non-Existent Column**: When a column does not exist in `public.transformations`, PostgREST's query planner fails at the PostgreSQL catalog level before RLS evaluation, returning:
   - **HTTP 400 / PostgreSQL Code `42703`**: `{"code":"42703","details":null,"hint":null,"message":"column transformations.<column> does not exist"}`

This distinction provides an empirical, 100% deterministic oracle directly from the live production database engine.

---

## 2. Live Column Metadata Results

| Column Name | Live Query Status | PostgreSQL Code | Database Engine Output / Evidence |
| :--- | :--- | :--- | :--- |
| `id` | **CONFIRMED EXISTS** | `42501` | Permission denied (table RLS reached) |
| `center_id` | **CONFIRMED EXISTS** | `42501` | Permission denied (table RLS reached) |
| `customer_name` | **CONFIRMED EXISTS** | `42501` | Permission denied (table RLS reached) |
| `before_path` | **CONFIRMED EXISTS** | `42501` | Permission denied (table RLS reached) |
| `after_path` | **CONFIRMED EXISTS** | `42501` | Permission denied (table RLS reached) |
| `duration_weeks` | **CONFIRMED EXISTS** | `42501` | Permission denied (table RLS reached) |
| `start_weight_kg` | **CONFIRMED EXISTS** | `42501` | Permission denied (table RLS reached) |
| `end_weight_kg` | **CONFIRMED EXISTS** | `42501` | Permission denied (table RLS reached) |
| `health_issue` | **CONFIRMED EXISTS** | `42501` | Permission denied (table RLS reached) |
| `customer_words` | **CONFIRMED EXISTS** | `42501` | Permission denied (table RLS reached) |
| `ai_summary` | **CONFIRMED EXISTS** | `42501` | Permission denied (table RLS reached) |
| `consent_given` | **CONFIRMED EXISTS** | `42501` | Permission denied (table RLS reached) |
| `consent_name` | **CONFIRMED EXISTS** | `42501` | Permission denied (table RLS reached) |
| `consent_phone_last4` | **CONFIRMED EXISTS** | `42501` | Permission denied (table RLS reached) |
| `consent_at` | **CONFIRMED EXISTS** | `42501` | Permission denied (table RLS reached) |
| `status` | **CONFIRMED EXISTS** | `42501` | Permission denied (table RLS reached) |
| `created_at` | **CONFIRMED EXISTS** | `42501` | Permission denied (table RLS reached) |
| `reviewed_summary` | **DOES NOT EXIST** | `42703` | `column transformations.reviewed_summary does not exist` |
| `updated_at` | **DOES NOT EXIST** | `42703` | `column transformations.updated_at does not exist` |
| `notes` | **DOES NOT EXIST** | `42703` | `column transformations.notes does not exist` |
| `deleted_at` | **DOES NOT EXIST** | `42703` | `column transformations.deleted_at does not exist` |
| `storage_deleted` | **DOES NOT EXIST** | `42703` | `column transformations.storage_deleted does not exist` |
| `archived` | **DOES NOT EXIST** | `42703` | `column transformations.archived does not exist` |

Empirical machine-readable JSON: [`deployed_schema_empirical_evidence.json`](file:///C:/Nanditha/PulseIQ-App/deployed_schema_empirical_evidence.json).

---

## 3. Key Findings & Concurrency Safety Implication

1. **Table Name**: The live production table is `public.transformations`. An earlier report inadvertently referred to `center_stories`; this is corrected.
2. **Absence of Mutation Timestamps / Review Flags**: Neither `reviewed_summary` nor `updated_at` exists in `public.transformations`. 
3. **Candidate V2 Design Validation**: Candidate v2's concurrency control and state isolation rely entirely on:
   - Client-side and server-side snapshot validation across all 6 verified factual columns (`customer_name`, `duration_weeks`, `start_weight_kg`, `end_weight_kg`, `health_issue`, `customer_words`).
   - Atomic conditional HTTP PATCH (`status=eq.draft&consent_given=eq.true&...`).
   - Requiring explicit review snapshot match without needing database schema migrations or unverified columns.
