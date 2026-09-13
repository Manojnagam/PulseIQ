import { execSync } from 'child_process';
import fs from 'fs';

const apikey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVydGVpYmR4emR2c2F1anB0eHNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MTE5MjMsImV4cCI6MjA5MDE4NzkyM30.Uh6aHjIx1Vukbk49K4oBqtRlxqTd9UiPXVGfDD7M9e0';
const baseUrl = 'https://erteibdxzdvsaujptxsd.supabase.co/rest/v1/transformations';

const candidateColumns = [
  'id',
  'center_id',
  'customer_name',
  'before_path',
  'after_path',
  'duration_weeks',
  'start_weight_kg',
  'end_weight_kg',
  'health_issue',
  'customer_words',
  'ai_summary',
  'consent_given',
  'consent_name',
  'consent_phone_last4',
  'consent_at',
  'status',
  'created_at',
  'reviewed_summary',
  'updated_at',
  'notes',
  'deleted_at',
  'storage_deleted',
  'archived',
  'non_existent_column_for_test'
];

console.log('=== Empirical Live Schema Column Discovery for public.transformations ===');
const results = {};

for (const col of candidateColumns) {
  const cmd = `curl.exe -s -H "apikey: ${apikey}" "${baseUrl}?select=${col}"`;
  const out = execSync(cmd).toString();
  const json = JSON.parse(out);
  if (json.code === '42501') {
    results[col] = { exists: true, status: 'CONFIRMED_EXISTS_IN_DB', postgres_code: '42501', error: 'permission denied (table level RLS reached)' };
    console.log(`[CONFIRMED COLUMN]  ${col.padEnd(25)} -> Exists in public.transformations (PG 42501)`);
  } else if (json.code === '42703') {
    results[col] = { exists: false, status: 'DOES_NOT_EXIST', postgres_code: '42703', error: json.message };
    console.log(`[ABSENT COLUMN]     ${col.padEnd(25)} -> DOES NOT EXIST (${json.message})`);
  } else {
    results[col] = { exists: 'unknown', json };
    console.log(`[UNKNOWN]           ${col.padEnd(25)} -> ${JSON.stringify(json)}`);
  }
}

fs.writeFileSync('deployed_schema_empirical_evidence.json', JSON.stringify(results, null, 2));
console.log('\nResults saved to deployed_schema_empirical_evidence.json');
