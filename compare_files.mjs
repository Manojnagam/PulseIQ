import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

function hashFile(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

function listFilesRecursive(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      files = files.concat(listFilesRecursive(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

const baselineDir = path.resolve('deployed_baseline_isolated');
const candidateDir = path.resolve('pulsezen');

const baselineFiles = listFilesRecursive(baselineDir);
const candidateFiles = listFilesRecursive(candidateDir).filter(f => !f.includes('.vercel') && !f.endsWith('test_env_run.cjs'));

const baselineMap = new Map();
for (const f of baselineFiles) {
  const rel = path.relative(baselineDir, f).replace(/\\/g, '/');
  baselineMap.set(rel, hashFile(f));
}

const candidateMap = new Map();
for (const f of candidateFiles) {
  const rel = path.relative(candidateDir, f).replace(/\\/g, '/');
  candidateMap.set(rel, hashFile(f));
}

const modified = [];
const identical = [];
const missingInCandidate = [];
const addedInCandidate = [];

for (const [rel, bHash] of baselineMap.entries()) {
  if (!candidateMap.has(rel)) {
    missingInCandidate.push(rel);
  } else {
    const cHash = candidateMap.get(rel);
    if (bHash === cHash) {
      identical.push(rel);
    } else {
      modified.push({ file: rel, baselineHash: bHash, candidateHash: cHash });
    }
  }
}

for (const rel of candidateMap.keys()) {
  if (!baselineMap.has(rel)) {
    addedInCandidate.push(rel);
  }
}

console.log('=== FILE COMPARISON RESULTS ===');
console.log(`Total Baseline Files: ${baselineMap.size}`);
console.log(`Identical Files: ${identical.length}`);
console.log(`Modified Files: ${modified.length}`);
console.log(`Missing In Candidate: ${missingInCandidate.length}`);
console.log(`Added In Candidate: ${addedInCandidate.length}`);
console.log('\nModified files list:');
for (const m of modified) {
  console.log(` - ${m.file} (baseline: ${m.baselineHash.slice(0, 12)}... vs candidate: ${m.candidateHash.slice(0, 12)}...)`);
}
