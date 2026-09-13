import zipfile
import hashlib

baseline_zip = 'pulsezen_candidate_isolated.zip'
candidate_zip = 'pulsezen_candidate_v4.zip'

def get_zip_info(zip_path):
    info = {}
    with zipfile.ZipFile(zip_path, 'r') as zf:
        for entry in zf.infolist():
            # normalize name to forward slashes
            norm_name = entry.filename.replace('\\', '/')
            content = zf.read(entry)
            h = hashlib.sha256(content).hexdigest().upper()
            info[norm_name] = {
                'size': entry.file_size,
                'sha256': h
            }
    return info

b_info = get_zip_info(baseline_zip)
c_info = get_zip_info(candidate_zip)

all_files = sorted(set(list(b_info.keys()) + list(c_info.keys())))

identical = []
modified = []
only_in_baseline = []
only_in_candidate = []

for f in all_files:
    if f in b_info and f in c_info:
        if b_info[f]['sha256'] == c_info[f]['sha256']:
            identical.append(f)
        else:
            modified.append({
                'file': f,
                'b_size': b_info[f]['size'],
                'c_size': c_info[f]['size'],
                'b_sha': b_info[f]['sha256'],
                'c_sha': c_info[f]['sha256']
            })
    elif f in b_info:
        only_in_baseline.append(f)
    else:
        only_in_candidate.append(f)

print(f"Total files in baseline ({baseline_zip}): {len(b_info)}")
print(f"Total files in candidate ({candidate_zip}): {len(c_info)}")
print(f"Identical files: {len(identical)}")
print(f"Modified files: {len(modified)}")
print(f"Only in baseline: {len(only_in_baseline)}")
print(f"Only in candidate: {len(only_in_candidate)}")

print("\n--- MODIFIED FILES ---")
for m in modified:
    print(f"File: {m['file']}")
    print(f"  Baseline  Size: {m['b_size']} bytes | SHA-256: {m['b_sha']}")
    print(f"  Candidate Size: {m['c_size']} bytes | SHA-256: {m['c_sha']}")

print("\n--- IDENTICAL FILES (Sample) ---")
for f in identical[:10]:
    print(f"  {f}: {b_info[f]['sha256'][:16]}...")
