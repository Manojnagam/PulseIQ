import os
import shutil
import zipfile
import hashlib
import re

base_dir = os.path.abspath('.')
bundle_dir = os.path.join(base_dir, 'pulsezen_review_bundle_v4')
artifact_dir = r'C:\Users\nagam\.gemini\antigravity-cli\brain\2ee657c7-8533-4f73-9b3a-bf33f13e051e'

if os.path.exists(bundle_dir):
    shutil.rmtree(bundle_dir)
os.makedirs(bundle_dir, exist_ok=True)

# 1. Candidate ZIP
candidate_zip = os.path.join(base_dir, 'pulsezen_candidate_v4.zip')
shutil.copy2(candidate_zip, os.path.join(bundle_dir, 'pulsezen_candidate_v4.zip'))

# 2. Candidate extracted directory
candidate_extracted = os.path.join(base_dir, 'pulsezen_candidate_v2')
dest_candidate = os.path.join(bundle_dir, 'pulsezen_candidate_v2')
shutil.copytree(candidate_extracted, dest_candidate)

# 3. Clean Unified Diff against deployed baseline
raw_diff = os.path.join(base_dir, 'pulsezen_candidate_v4_against_deployed_baseline.diff')
clean_diff_path = os.path.join(bundle_dir, 'pulsezen_candidate_v4_against_deployed_baseline.diff')
with open(raw_diff, 'r', encoding='utf-8', errors='replace') as rf:
    diff_text = rf.read()

# Normalize header paths in diff
diff_text = re.sub(r'a/temp_deployed_baseline/', 'a/', diff_text)
diff_text = re.sub(r'b/pulsezen_candidate_v2/', 'b/', diff_text)
with open(clean_diff_path, 'w', encoding='utf-8') as wf:
    wf.write(diff_text)

# Also save copy in root for git tracking
shutil.copy2(clean_diff_path, os.path.join(base_dir, 'pulsezen_candidate_v4_against_deployed_baseline.diff'))

# 4. Executable test files and helpers
test_files = [
    'test_backend_summarize_direct.mjs',
    'test_step5_variants_comprehensive.mjs',
    'test_new_story_flow.mjs',
    'test_upload_url_reproduction.mjs',
    'test_targeted_v2.mjs',
    'test_stale_race.mjs',
    'test_step5_reproduction.mjs',
    'browser_finder.js'
]

for tf in test_files:
    shutil.copy2(os.path.join(base_dir, tf), os.path.join(bundle_dir, tf))

# 5. Master test runner run_all_tests.mjs
run_all_code = '''import { spawnSync } from 'node:child_process';
import path from 'node:path';

const tests = [
  { name: 'Direct Backend Summarize Responses & Manual Entry Validation', file: 'test_backend_summarize_direct.mjs' },
  { name: 'Step 5 Frontend Variant Rendering, Collection Guarding & Textarea State', file: 'test_step5_variants_comprehensive.mjs' },
  { name: 'Browser Flow: Actual New-Story Lifecycle (Draft -> Summarize -> Select/Manual -> Consent)', file: 'test_new_story_flow.mjs' },
  { name: 'Upload URL Reproduction & Guarding Suite', file: 'test_upload_url_reproduction.mjs' },
  { name: 'Targeted Candidate V2 Input & Deletion Safety Suite', file: 'test_targeted_v2.mjs' },
  { name: 'Deterministic Stale Race & Snapshot Protection Suite', file: 'test_stale_race.mjs' }
];

console.log('=== RUNNING ALL PULSEZEN REVIEW BUNDLE V4 VERIFICATION SUITES ===\\n');

let allPassed = true;
const results = [];

for (const t of tests) {
  console.log(`--- Running: ${t.name} (${t.file}) ---`);
  const proc = spawnSync(process.execPath, [t.file], {
    stdio: 'inherit',
    cwd: path.resolve('.')
  });
  const passed = proc.status === 0;
  if (!passed) allPassed = false;
  results.push({ name: t.name, file: t.file, passed, code: proc.status });
  console.log(`\\nResult: ${passed ? 'PASS ✓' : 'FAIL ✗'}\\n------------------------------------------------------------\\n`);
}

console.log('=== SUMMARY OF ALL TEST SUITES ===');
for (const r of results) {
  console.log(`[${r.passed ? 'PASS' : 'FAIL'}] ${r.name} (${r.file})`);
}

if (allPassed) {
  console.log('\\nALL SUITES PASSED EMPIRICALLY! (Zero Failures)');
  process.exit(0);
} else {
  console.error('\\nONE OR MORE SUITES FAILED.');
  process.exit(1);
}
'''
with open(os.path.join(bundle_dir, 'run_all_tests.mjs'), 'w', encoding='utf-8') as f:
    f.write(run_all_code)

# 6. TEST_EXECUTION_GUIDE.md
guide_content = '''# PulseZen Review Bundle v4: Test Execution Guide

This review bundle contains the complete candidate archive `pulsezen_candidate_v4.zip`, the exact unified diff against deployed baseline `CAF7AA3BFD4FC86695B4E04EB2E7B0698BAD66F049E755A6CB2A1953186DD08E`, extracted candidate source files in `pulsezen_candidate_v2/`, and all executable verification test suites.

## 1. Prerequisites & Portable Browser Detection
- **Node.js**: v18.0.0 or later (tested on v22.17.1).
- **Puppeteer-core**: Uses `puppeteer-core`.
- **Browser Executable**: Browser tests use `browser_finder.js` which automatically searches for local Edge, Chrome, or Chromium installations across standard Windows, macOS, and Linux locations.
  - To override or specify a custom browser binary:
    ```bash
    export PUPPETEER_EXECUTABLE_PATH="/path/to/chrome-or-edge"
    # Or in Windows PowerShell:
    # $env:PUPPETEER_EXECUTABLE_PATH="C:\\path\\to\\msedge.exe"
    ```

## 2. Exact Local Test Commands

### Run All 6 Test Suites At Once
```bash
node run_all_tests.mjs
```

### Run Individual Test Suites Directly

1. **Direct Backend Summarize Responses & Manual Entry Validation** (10 subtests):
   Tests both variants empty (HTTP 502), one valid with empty companion (HTTP 200), one valid with provider failure (HTTP 200), both provider failure (HTTP 502), claim blocking (HTTP 400), clean manual entry, medical terms rejection, whitespace rejection, missing snapshot rejection, and stale snapshot conflict.
   ```bash
   node test_backend_summarize_direct.mjs
   ```

2. **Step 5 Frontend Variant Rendering & Collection Guarding** (10 subtests):
   Tests valid variants, partial variants, empty variants `["", ""]`, malformed collections (`string`, `object`, `null`), pure whitespace entries, non-string entries, and mixed entries.
   ```bash
   node test_step5_variants_comprehensive.mjs
   ```

3. **Actual New-Story Lifecycle Flow & Stale ID Guarding** (4 subtests):
   Tests end-to-end new-story progression through draft creation -> summary generation -> variant selection or manual entry -> consent step. Covers valid variants, empty/malformed responses, provider failure, and confirms failed draft creation stops on Step 4 and clears `transformationId` so it cannot reuse a previous ID.
   ```bash
   node test_new_story_flow.mjs
   ```

4. **Upload URL Fastify Reproduction & Route Guarding** (10 subtests):
   ```bash
   node test_upload_url_reproduction.mjs
   ```

5. **Targeted Candidate V2 Input & Deletion Safety**:
   ```bash
   node test_targeted_v2.mjs
   ```

6. **Deterministic Stale Race & Snapshot Protection**:
   ```bash
   node test_stale_race.mjs
   ```

## 3. Verify Candidate Archive Integrity
```bash
sha256sum pulsezen_candidate_v4.zip
# On Windows PowerShell:
# Get-FileHash -Algorithm SHA256 pulsezen_candidate_v4.zip
```
Expected SHA-256: `487C63B38566A904226A6651AE50905D8B2FDB14041D6E11E060B4FBD321CCF0`

## 4. Verify Review Bundle Hashes
Refer to `SHA256SUMS` in this directory to verify every file in this bundle.
'''
with open(os.path.join(bundle_dir, 'TEST_EXECUTION_GUIDE.md'), 'w', encoding='utf-8') as f:
    f.write(guide_content)

# 7. Generate SHA256SUMS
sums_path = os.path.join(bundle_dir, 'SHA256SUMS')
checksum_lines = []

for root, dirs, files in os.walk(bundle_dir):
    dirs.sort()
    files.sort()
    for f in files:
        if f == 'SHA256SUMS':
            continue
        full_path = os.path.join(root, f)
        rel_path = os.path.relpath(full_path, bundle_dir).replace('\\', '/')
        hasher = hashlib.sha256()
        with open(full_path, 'rb') as hf:
            while chunk := hf.read(65536):
                hasher.update(chunk)
        checksum_lines.append(f"{hasher.hexdigest().upper()}  {rel_path}")

with open(sums_path, 'w', encoding='utf-8') as sf:
    sf.write('\n'.join(checksum_lines) + '\n')

print(f"Generated SHA256SUMS with {len(checksum_lines)} entries.")

# 8. Package bundle into pulsezen_review_bundle_v4.zip
bundle_zip_path = os.path.join(base_dir, 'pulsezen_review_bundle_v4.zip')
if os.path.exists(bundle_zip_path):
    os.remove(bundle_zip_path)

with zipfile.ZipFile(bundle_zip_path, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk(bundle_dir):
        dirs.sort()
        files.sort()
        for f in files:
            full_path = os.path.join(root, f)
            rel_path = os.path.relpath(full_path, bundle_dir).replace('\\', '/')
            zf.write(full_path, arcname=rel_path)

hasher = hashlib.sha256()
with open(bundle_zip_path, 'rb') as f:
    while chunk := f.read(65536):
        hasher.update(chunk)

bundle_sha = hasher.hexdigest().upper()
print(f"Review Bundle Archive: {bundle_zip_path}")
print(f"Review Bundle SHA-256: {bundle_sha}")

# 9. Copy to artifact directory
artifact_bundle = os.path.join(artifact_dir, 'pulsezen_review_bundle_v4.zip')
shutil.copy2(bundle_zip_path, artifact_bundle)
print(f"Copied Review Bundle to artifact dir: {artifact_bundle}")
