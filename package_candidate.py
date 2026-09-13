import os
import zipfile
import hashlib
import shutil

src_dir = os.path.abspath('pulsezen_candidate_v2')
out_zip = os.path.abspath('pulsezen_candidate_v4.zip')
artifact_dir = r'C:\Users\nagam\.gemini\antigravity-cli\brain\2ee657c7-8533-4f73-9b3a-bf33f13e051e'

if os.path.exists(out_zip):
    os.remove(out_zip)

with zipfile.ZipFile(out_zip, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk(src_dir):
        # Sort for determinism
        dirs.sort()
        files.sort()
        for f in files:
            full_path = os.path.join(root, f)
            rel_path = os.path.relpath(full_path, src_dir).replace('\\', '/')
            zf.write(full_path, arcname=rel_path)

hasher = hashlib.sha256()
with open(out_zip, 'rb') as f:
    while chunk := f.read(65536):
        hasher.update(chunk)

sha256_hash = hasher.hexdigest().upper()
print(f"Archive: {out_zip}")
print(f"SHA-256: {sha256_hash}")

# Copy to artifacts
artifact_zip = os.path.join(artifact_dir, 'pulsezen_candidate_v4.zip')
shutil.copy2(out_zip, artifact_zip)
print(f"Copied to artifact dir: {artifact_zip}")

# Verify archive entries
with zipfile.ZipFile(out_zip, 'r') as zf:
    entries = zf.namelist()
    print(f"Total entries in archive: {len(entries)}")
    for e in entries:
        if '\\' in e:
            print(f"WARNING: Windows backslash found in entry: {e}")
print("Archive verification complete. All paths use forward slashes.")
