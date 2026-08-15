/**
 * PulseIQ Phase 3.9 — Backup, Disaster Recovery & Business Continuity
 * Restore Engine
 * 
 * Manages backup package validation, safety snapshot creation, point-in-time state restoration,
 * and restore audit history tracking.
 */

(function(window) {
  'use strict';

  const STORAGE_KEY = 'pulseiq_restore_history_v1';
  let restoreHistory = [];

  function loadHistory() {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) restoreHistory = JSON.parse(saved);
      } catch (e) {
        restoreHistory = [];
      }
    }
  }

  function saveHistory() {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(restoreHistory.slice(-100)));
      } catch (e) {}
    }
  }

  function checkSecurityPermission(permission) {
    if (window.PulseIQ_Security && window.PulseIQ_Security.Auth && typeof window.PulseIQ_Security.Auth.hasPermission === 'function') {
      return window.PulseIQ_Security.Auth.hasPermission(permission) || window.PulseIQ_Security.Auth.hasPermission('system:admin');
    }
    return true;
  }

  function recordMonitoringMetric(metricName, data) {
    if (window.PulseIQ_Monitoring && typeof window.PulseIQ_Monitoring.recordMetric === 'function') {
      try {
        window.PulseIQ_Monitoring.recordMetric(metricName, data);
      } catch (e) {}
    }
  }

  function validateRestorePackage(backupId) {
    if (!window.PulseIQ_BackupEngine) {
      return { valid: false, error: 'BackupEngine not available.' };
    }

    const verification = window.PulseIQ_BackupEngine.verifyBackup(backupId);
    return {
      valid: verification.success,
      backupId: backupId,
      status: verification.status,
      error: verification.success ? null : 'Checksum mismatch or corrupt backup package.'
    };
  }

  function executeRestore(backupId, options) {
    // 1. RBAC Permission Check
    if (!checkSecurityPermission('resilience:admin')) {
      return { success: false, error: 'Permission denied: Requires resilience:admin permission.' };
    }

    if (!window.PulseIQ_BackupEngine) {
      return { success: false, error: 'BackupEngine not available.' };
    }

    // 2. Validate backup package integrity
    const val = validateRestorePackage(backupId);
    if (!val.valid) {
      return { success: false, error: val.error || 'Restore package validation failed.' };
    }

    loadHistory();

    // 3. Create Pre-Restore Safety Snapshot automatically
    let safetySnapshotId = null;
    if (window.PulseIQ_SnapshotEngine) {
      const snapRes = window.PulseIQ_SnapshotEngine.createSnapshot('Pre-Restore Safety Guard');
      if (snapRes.success) safetySnapshotId = snapRes.snapshot.id;
    }

    // Retrieve backup payload
    const backups = window.PulseIQ_BackupEngine.getBackups();
    const bakSummary = backups.find(b => b.id === backupId);

    // Retrieve full backup object with payload from internal storage
    let fullBackup = null;
    try {
      const rawBackups = JSON.parse(window.localStorage.getItem('pulseiq_backups_v1') || '[]');
      fullBackup = rawBackups.find(b => b.id === backupId);
    } catch (e) {}

    if (!fullBackup || !fullBackup.payload) {
      return { success: false, error: `Backup payload for '${backupId}' is missing or unreadable.` };
    }

    const payload = fullBackup.payload;
    let restoredKeysCount = 0;

    // Apply restore to localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      Object.keys(payload).forEach(k => {
        try {
          window.localStorage.setItem(k, payload[k]);
          restoredKeysCount++;
        } catch (e) {}
      });
    }

    const logEntry = {
      restoreId: 'rst-' + Date.now(),
      backupId: backupId,
      backupLabel: bakSummary ? bakSummary.label : 'Restore Operation',
      safetySnapshotId: safetySnapshotId,
      restoredKeysCount: restoredKeysCount,
      status: 'RESTORE_SUCCESSFUL',
      timestamp: new Date().toISOString()
    };

    restoreHistory.unshift(logEntry);
    saveHistory();

    recordMonitoringMetric('restore_executed', { restoreId: logEntry.restoreId, backupId, restoredKeysCount });

    return {
      success: true,
      restore: logEntry
    };
  }

  function getRestoreHistory() {
    loadHistory();
    return restoreHistory.slice();
  }

  window.PulseIQ_RestoreEngine = {
    validateRestorePackage: validateRestorePackage,
    executeRestore: executeRestore,
    getRestoreHistory: getRestoreHistory
  };

})(typeof window !== 'undefined' ? window : global);
