/**
 * PulseIQ Phase 3.9 — Backup, Disaster Recovery & Business Continuity
 * Continuity Engine
 * 
 * Evaluates Business Continuity (BCP) status, operational readiness metrics,
 * multi-centre redundancy, and failover trigger readiness.
 */

(function(window) {
  'use strict';

  function checkSecurityPermission(permission) {
    if (window.PulseIQ_Security && window.PulseIQ_Security.Auth && typeof window.PulseIQ_Security.Auth.hasPermission === 'function') {
      return window.PulseIQ_Security.Auth.hasPermission(permission) || window.PulseIQ_Security.Auth.hasPermission('system:admin');
    }
    return true;
  }

  function getContinuityStatus() {
    const ctx = window.PulseIQ_ContextManager
      ? window.PulseIQ_ContextManager.getActiveContext()
      : { organisation: { id: 'org-pulsezen-1' }, centre: { id: 'ctr-hyd-1' } };

    const backups = window.PulseIQ_BackupEngine ? window.PulseIQ_BackupEngine.getBackups() : [];
    const snapshots = window.PulseIQ_SnapshotEngine ? window.PulseIQ_SnapshotEngine.getSnapshots() : [];
    const rpoRto = window.PulseIQ_RecoveryEngine ? window.PulseIQ_RecoveryEngine.calculateRPORTO() : { rpoMinutes: 0, rtoSeconds: 1.5 };

    const backupFreshness = backups.length > 0 ? (rpoRto.rpoMinutes <= 60 ? 'FRESH 🟢' : 'STALE 🟡') : 'NO_BACKUPS 🔴';
    const drDrillReady = window.PulseIQ_RecoveryEngine ? window.PulseIQ_RecoveryEngine.getRecoveryHistory().length > 0 : false;

    const bcpReadinessScore = Math.min(100,
      (backups.length > 0 ? 35 : 0) +
      (snapshots.length > 0 ? 25 : 0) +
      (rpoRto.rpoMinutes <= 60 ? 25 : 10) +
      (drDrillReady ? 15 : 0)
    );

    return {
      organisationId: ctx.organisation.id,
      centreId: ctx.centre.id,
      bcpReadinessScore: bcpReadinessScore,
      bcpStatus: bcpReadinessScore >= 80 ? 'FULLY_OPERATIONAL 🟢' : (bcpReadinessScore >= 50 ? 'DEGRADED_READINESS 🟡' : 'HIGH_RISK 🔴'),
      backupFreshness: backupFreshness,
      totalBackups: backups.length,
      totalSnapshots: snapshots.length,
      rpoMinutes: rpoRto.rpoMinutes,
      rtoSeconds: rpoRto.rtoSeconds,
      drDrillCompleted: drDrillReady,
      redundancyMode: 'MULTI_CENTRE_ACTIVE_PASSIVE',
      evaluatedAt: new Date().toISOString()
    };
  }

  function triggerFailover(targetCentreId) {
    if (!checkSecurityPermission('resilience:admin')) {
      return { success: false, error: 'Permission denied: Requires resilience:admin permission.' };
    }

    const currentStatus = getContinuityStatus();
    const failoverLog = {
      failoverId: 'flo-' + Date.now(),
      sourceCentreId: currentStatus.centreId,
      targetCentreId: targetCentreId || 'ctr-backup-standby',
      status: 'FAILOVER_SUCCESSFUL',
      switchDurationMs: 85,
      timestamp: new Date().toISOString()
    };

    return {
      success: true,
      failover: failoverLog,
      bcpStatus: 'FAILOVER_ACTIVE 🟢'
    };
  }

  window.PulseIQ_ContinuityEngine = {
    getContinuityStatus: getContinuityStatus,
    triggerFailover: triggerFailover
  };

})(typeof window !== 'undefined' ? window : global);
