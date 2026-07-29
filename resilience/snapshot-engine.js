/**
 * PulseIQ Phase 3.9 — Backup, Disaster Recovery & Business Continuity
 * Snapshot Engine
 * 
 * Manages rapid configuration/state snapshots, configuration drift comparison,
 * and instant point-in-time rollbacks.
 */

(function(window) {
  'use strict';

  const STORAGE_KEY = 'pulseiq_snapshots_v1';
  let snapshots = [];

  function loadSnapshots() {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) snapshots = JSON.parse(saved);
      } catch (e) {
        snapshots = [];
      }
    }
  }

  function saveSnapshots() {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshots.slice(-50)));
      } catch (e) {}
    }
  }

  function checkSecurityPermission(permission) {
    if (window.PulseIQ_Security && window.PulseIQ_Security.Auth && typeof window.PulseIQ_Security.Auth.hasPermission === 'function') {
      return window.PulseIQ_Security.Auth.hasPermission(permission) || window.PulseIQ_Security.Auth.hasPermission('system:admin');
    }
    return true;
  }

  function createSnapshot(name, scope) {
    if (!checkSecurityPermission('resilience:admin')) {
      return { success: false, error: 'Permission denied: Requires resilience:admin permission.' };
    }

    loadSnapshots();

    const stateMap = {};
    if (typeof window !== 'undefined' && window.localStorage) {
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith('pulseiq_')) {
          if (!scope || k.includes(scope)) {
            stateMap[k] = window.localStorage.getItem(k);
          }
        }
      }
    }

    const snap = {
      id: 'snp-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      name: name || 'Configuration Snapshot',
      scope: scope || 'GLOBAL',
      keyCount: Object.keys(stateMap).length,
      data: stateMap,
      timestamp: new Date().toISOString()
    };

    snapshots.unshift(snap);
    saveSnapshots();

    return {
      success: true,
      snapshot: {
        id: snap.id,
        name: snap.name,
        scope: snap.scope,
        keyCount: snap.keyCount,
        timestamp: snap.timestamp
      }
    };
  }

  function compareSnapshots(snapshotIdA, snapshotIdB) {
    loadSnapshots();
    const snapA = snapshots.find(s => s.id === snapshotIdA);
    const snapB = snapshots.find(s => s.id === snapshotIdB);

    if (!snapA || !snapB) {
      return { success: false, error: 'One or both snapshot IDs not found for comparison.' };
    }

    const keysA = Object.keys(snapA.data || {});
    const keysB = Object.keys(snapB.data || {});
    const allKeys = Array.from(new Set([...keysA, ...keysB]));

    const diffs = [];
    allKeys.forEach(k => {
      const valA = snapA.data[k];
      const valB = snapB.data[k];
      if (valA !== valB) {
        diffs.push({
          key: k,
          snapshotA: valA !== undefined ? 'Present' : 'Missing',
          snapshotB: valB !== undefined ? 'Present' : 'Missing',
          status: 'CHANGED'
        });
      }
    });

    return {
      success: true,
      snapshotA: { id: snapA.id, name: snapA.name },
      snapshotB: { id: snapB.id, name: snapB.name },
      totalDifferences: diffs.length,
      differences: diffs
    };
  }

  function rollbackToSnapshot(snapshotId) {
    if (!checkSecurityPermission('resilience:admin')) {
      return { success: false, error: 'Permission denied: Requires resilience:admin permission.' };
    }

    loadSnapshots();
    const snap = snapshots.find(s => s.id === snapshotId);
    if (!snap || !snap.data) {
      return { success: false, error: `Snapshot '${snapshotId}' not found.` };
    }

    let restoredCount = 0;
    if (typeof window !== 'undefined' && window.localStorage) {
      Object.keys(snap.data).forEach(k => {
        try {
          window.localStorage.setItem(k, snap.data[k]);
          restoredCount++;
        } catch (e) {}
      });
    }

    return {
      success: true,
      snapshotId: snap.id,
      restoredKeysCount: restoredCount,
      timestamp: new Date().toISOString()
    };
  }

  function getSnapshots() {
    loadSnapshots();
    return snapshots.map(s => ({
      id: s.id,
      name: s.name,
      scope: s.scope,
      keyCount: s.keyCount,
      timestamp: s.timestamp
    }));
  }

  window.PulseIQ_SnapshotEngine = {
    createSnapshot: createSnapshot,
    compareSnapshots: compareSnapshots,
    rollbackToSnapshot: rollbackToSnapshot,
    getSnapshots: getSnapshots
  };

})(typeof window !== 'undefined' ? window : global);
