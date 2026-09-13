function getSupabaseConfig() {
  const supabaseUrl = process.env.SUPABASE_URL || 'https://erteibdxzdvsaujptxsd.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { supabaseUrl, serviceKey };
}

function normalizePath(p) {
  if (!p || typeof p !== 'string') return '';
  return p.trim().replace(/^\/+/, '').replace(/\/+/g, '/').toLowerCase();
}

export default async function handler(req, res) {
  // D2: Verify CRON_SECRET authorization
  const authHeader = req.headers['authorization'];
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing CRON_SECRET' });
  }

  // D1 (4): Dry-run mode defaults to true unless explicitly ?dry_run=false
  const isDryRun = req.query.dry_run !== 'false';

  const { supabaseUrl, serviceKey } = getSupabaseConfig();
  if (!serviceKey) {
    return res.status(500).json({ error: 'Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY missing' });
  }

  try {
    // --------------------------------------------------------------------------
    // 1. Get exact total count of transformations via HEAD request
    // --------------------------------------------------------------------------
    const countRes = await fetch(`${supabaseUrl}/rest/v1/transformations?select=id`, {
      method: 'HEAD',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Prefer': 'count=exact'
      }
    });

    if (!countRes.ok) {
      return res.status(502).json({ error: `Failed to fetch transformations count: HTTP ${countRes.status}` });
    }

    const contentRange = countRes.headers.get('content-range') || '';
    const totalMatch = contentRange.match(/\/(\d+)$/);
    if (!totalMatch) {
      return res.status(502).json({ error: `Cannot parse total count from Content-Range: ${contentRange}` });
    }
    const expectedTotalRows = parseInt(totalMatch[1], 10);

    // F1: Page through transformations with deterministic ORDER BY id.asc
    const PAGE_SIZE = 500;
    let offset = 0;
    let collectedRowsCount = 0;
    const referencedPaths = new Set();
    const centerIds = new Set();

    while (true) {
      const pageRes = await fetch(
        `${supabaseUrl}/rest/v1/transformations?select=center_id,before_path,after_path&order=id.asc&limit=${PAGE_SIZE}&offset=${offset}`,
        {
          headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`
          }
        }
      );

      if (!pageRes.ok) {
        return res.status(502).json({ error: `Failed to fetch transformations page at offset ${offset}: HTTP ${pageRes.status}` });
      }

      const rows = await pageRes.json();
      if (!rows || rows.length === 0) break;

      for (const r of rows) {
        if (r.center_id) centerIds.add(normalizePath(r.center_id));
        if (r.before_path) referencedPaths.add(normalizePath(r.before_path));
        if (r.after_path) referencedPaths.add(normalizePath(r.after_path));
      }

      collectedRowsCount += rows.length;
      if (rows.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    // D1 (1) ASSERTION: Collected count must equal expected total
    if (collectedRowsCount !== expectedTotalRows) {
      console.error(`ABORTING CLEANUP: Collected ${collectedRowsCount} rows but expected ${expectedTotalRows}. Deleting nothing.`);
      return res.status(500).json({
        error: 'count_mismatch_aborted',
        message: `Abort safety: collected count (${collectedRowsCount}) does not match expected total (${expectedTotalRows}). Deleted zero objects.`
      });
    }

    // F1: Include all centers from wellness_centers with order=id.asc
    const centersRes = await fetch(`${supabaseUrl}/rest/v1/wellness_centers?select=id&order=id.asc`, {
      headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` }
    });

    if (centersRes.ok) {
      const centers = await centersRes.json();
      for (const c of centers) {
        if (c.id) centerIds.add(normalizePath(c.id));
      }
    }

    const candidateOrphans = [];
    let totalObjectsScanned = 0;
    const nowMs = Date.now();
    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
    const STORAGE_LIMIT = 100;

    for (const centerId of centerIds) {
      let storageOffset = 0;
      while (true) {
        const listRes = await fetch(`${supabaseUrl}/storage/v1/object/list/transformations`, {
          method: 'POST',
          headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            prefix: centerId,
            limit: STORAGE_LIMIT,
            offset: storageOffset,
            sortBy: { column: 'name', order: 'asc' }
          })
        });

        if (!listRes.ok) {
          return res.status(502).json({ error: `Storage list failed for prefix ${centerId}: HTTP ${listRes.status}` });
        }

        const objects = await listRes.json();
        if (!objects || objects.length === 0) break;

        for (const obj of objects) {
          // Skip folders
          if (!obj.id && !obj.created_at) continue;

          totalObjectsScanned++;

          // E1: Normalize both sides to identical {center_id}/{filename} format
          const cleanObjName = normalizePath(obj.name);
          const fullPath = cleanObjName.startsWith(centerId + '/')
            ? cleanObjName
            : `${centerId}/${cleanObjName}`;

          const isReferenced = referencedPaths.has(fullPath);
          const ageMs = nowMs - new Date(obj.created_at).getTime();

          // D1 (5): Never delete an object created in the last 24h
          if (!isReferenced && ageMs > TWENTY_FOUR_HOURS_MS) {
            candidateOrphans.push({
              path: fullPath,
              created_at: obj.created_at,
              age_hours: Number((ageMs / (1000 * 60 * 60)).toFixed(1))
            });
          }
        }

        if (objects.length < STORAGE_LIMIT) break;
        storageOffset += STORAGE_LIMIT;
      }
    }

    // E1 ASSERTION: If 100% of scanned objects are flagged as orphans, abort immediately
    if (candidateOrphans.length === totalObjectsScanned && totalObjectsScanned > 0) {
      console.error(`ABORTING CLEANUP: candidateOrphans (${candidateOrphans.length}) === totalObjectsScanned (${totalObjectsScanned}). Path normalization suspected broken. Deleting zero objects.`);
      return res.status(500).json({
        error: 'normalization_failure_aborted',
        message: `Abort safety: 100% of scanned objects (${totalObjectsScanned}) were flagged as orphans. Path normalization suspected broken. Deleting zero objects.`
      });
    }

    // D1 (3) SAFETY CAP: Never delete more than 20 objects in a single run
    if (candidateOrphans.length > 20) {
      console.error(`SAFETY GUARD TRIGGERED: Candidate orphans count (${candidateOrphans.length}) exceeds 20. Deleting nothing.`);
      return res.status(200).json({
        status: 'aborted_safety_cap_exceeded',
        candidate_count: candidateOrphans.length,
        message: `Safety guard triggered: found ${candidateOrphans.length} orphans, which exceeds the max safety limit of 20. Deleting nothing.`
      });
    }

    // Dry-run mode return
    if (isDryRun) {
      return res.status(200).json({
        mode: 'dry_run',
        total_objects_scanned: totalObjectsScanned,
        total_referenced_paths: referencedPaths.size,
        candidate_orphans_count: candidateOrphans.length,
        candidate_orphans: candidateOrphans,
        message: 'Dry run completed. No storage objects were deleted.'
      });
    }

    // Live deletion
    let deletedObjectsCount = 0;
    if (candidateOrphans.length > 0) {
      const deletePaths = candidateOrphans.map(o => o.path);
      const delRes = await fetch(`${supabaseUrl}/storage/v1/object/transformations`, {
        method: 'DELETE',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prefixes: deletePaths })
      });

      if (!delRes.ok) {
        return res.status(502).json({ error: `Failed to delete orphan objects from storage: HTTP ${delRes.status}` });
      }
      deletedObjectsCount = deletePaths.length;
    }

    // Prune audit table rows older than 24h
    const twentyFourHoursAgoISO = new Date(nowMs - TWENTY_FOUR_HOURS_MS).toISOString();
    await fetch(`${supabaseUrl}/rest/v1/owner_login_attempts?created_at=lt.${encodeURIComponent(twentyFourHoursAgoISO)}`, {
      method: 'DELETE',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`
      }
    });

    return res.status(200).json({
      mode: 'live',
      deleted_objects_count: deletedObjectsCount,
      deleted_objects: candidateOrphans.map(o => o.path),
      audit_pruned_before: twentyFourHoursAgoISO
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error during cleanup', details: err.message });
  }
}
