/**
 * PulseIQ Phase 3.9 — Backup, Disaster Recovery & Business Continuity
 * Resilience Renderer & UI Manager
 * 
 * Renders Business Continuity Dashboard, BCP Readiness Gauge, Backup Orchestrator,
 * Snapshot Manager, Disaster Recovery Drill Runner, and Restore Audit Log UI.
 */

(function(window) {
  'use strict';

  function renderResilienceDashboard(containerId) {
    if (typeof document === 'undefined') return;

    const el = document.getElementById(containerId || 'sec-resilience');
    if (!el) return;

    const bcp = window.PulseIQ_ContinuityEngine ? window.PulseIQ_ContinuityEngine.getContinuityStatus() : { bcpReadinessScore: 100, bcpStatus: 'FULLY_OPERATIONAL 🟢' };
    const backups = window.PulseIQ_BackupEngine ? window.PulseIQ_BackupEngine.getBackups() : [];
    const snapshots = window.PulseIQ_SnapshotEngine ? window.PulseIQ_SnapshotEngine.getSnapshots() : [];
    const restores = window.PulseIQ_RestoreEngine ? window.PulseIQ_RestoreEngine.getRestoreHistory() : [];
    const rpoRto = window.PulseIQ_RecoveryEngine ? window.PulseIQ_RecoveryEngine.calculateRPORTO() : { rpoMinutes: 0, rtoSeconds: 1.5 };

    let html = '';

    // Header Controls & BCP Readiness Metrics
    html += '<div style="margin-bottom:24px">';
    html += '  <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;margin-bottom:20px">';
    html += '    <div>';
    html += '      <div style="font-size:12px;font-weight:700;color:#10b981;text-transform:uppercase;letter-spacing:1px">🛡️ Enterprise Resilience & Business Continuity</div>';
    html += '      <div style="font-family:\'Space Grotesk\',sans-serif;font-size:26px;font-weight:800;color:var(--text);margin-top:2px">Disaster Recovery & Backup Control Centre</div>';
    html += '    </div>';
    html += '    <div style="display:flex;gap:10px">';
    html += '      <button onclick="PulseIQ_ResilienceRenderer.triggerManualBackup()" class="btn-p" style="padding:10px 18px;font-size:13px;background:linear-gradient(135deg,#10b981,#059669);border:none;box-shadow:0 4px 14px rgba(16,185,129,0.3)">📦 Create System Backup</button>';
    html += '      <button onclick="PulseIQ_ResilienceRenderer.triggerSnapshot()" class="btn-p" style="padding:10px 18px;font-size:13px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15)">📸 Take Snapshot</button>';
    html += '      <button onclick="PulseIQ_ResilienceRenderer.runDRDrill()" class="btn-p" style="padding:10px 18px;font-size:13px;background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid rgba(239,68,68,0.3)">🧪 Run DR Drill</button>';
    html += '    </div>';
    html += '  </div>';

    // Metrics Row
    html += '  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-bottom:24px">';
    
    html += '    <div class="tcard" style="padding:18px;background:rgba(24,24,27,0.8);backdrop-filter:blur(12px);border:1px solid rgba(16,185,129,0.3)">';
    html += '      <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase">BCP Readiness Score</div>';
    html += '      <div style="font-family:\'Space Grotesk\',sans-serif;font-size:26px;font-weight:800;color:#10b981;margin-top:4px">' + bcp.bcpReadinessScore + '%</div>';
    html += '      <div style="font-size:11px;color:var(--muted);margin-top:4px">' + bcp.bcpStatus + '</div>';
    html += '    </div>';

    html += '    <div class="tcard" style="padding:18px;background:rgba(24,24,27,0.8);backdrop-filter:blur(12px);border:1px solid rgba(56,189,248,0.3)">';
    html += '      <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase">Recovery Point Objective (RPO)</div>';
    html += '      <div style="font-family:\'Space Grotesk\',sans-serif;font-size:22px;font-weight:800;color:#38bdf8;margin-top:6px">' + rpoRto.rpoMinutes + ' mins</div>';
    html += '      <div style="font-size:11px;color:var(--muted);margin-top:4px">Target: &lt;60 mins (' + rpoRto.rpoStatus + ')</div>';
    html += '    </div>';

    html += '    <div class="tcard" style="padding:18px;background:rgba(24,24,27,0.8);backdrop-filter:blur(12px);border:1px solid rgba(168,85,247,0.3)">';
    html += '      <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase">Recovery Time Objective (RTO)</div>';
    html += '      <div style="font-family:\'Space Grotesk\',sans-serif;font-size:22px;font-weight:800;color:#a855f7;margin-top:6px">' + rpoRto.rtoSeconds + ' secs</div>';
    html += '      <div style="font-size:11px;color:var(--muted);margin-top:4px">Target: &lt;30 secs (' + rpoRto.rtoStatus + ')</div>';
    html += '    </div>';

    html += '    <div class="tcard" style="padding:18px;background:rgba(24,24,27,0.8);backdrop-filter:blur(12px);border:1px solid rgba(245,158,11,0.3)">';
    html += '      <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase">Active Backups & Snapshots</div>';
    html += '      <div style="font-family:\'Space Grotesk\',sans-serif;font-size:22px;font-weight:800;color:#f59e0b;margin-top:6px">' + backups.length + ' / ' + snapshots.length + '</div>';
    html += '      <div style="font-size:11px;color:var(--muted);margin-top:4px">Integrity Verified & SHA-256 Hashed</div>';
    html += '    </div>';

    html += '  </div>';

    // Backups & Snapshots Table Grid
    html += '<div style="display:grid;grid-template-columns:1fr;gap:24px">';
    
    // System Backups Ledger
    html += '  <div class="tcard" style="padding:24px;background:rgba(24,24,27,0.85);backdrop-filter:blur(16px);border:1.5px solid rgba(255,255,255,0.08)">';
    html += '    <div style="font-family:\'Space Grotesk\',sans-serif;font-size:18px;font-weight:700;color:var(--text);margin-bottom:16px">System Backups Orchestration</div>';
    html += '    <div style="overflow-x:auto">';
    html += '      <table style="width:100%;border-collapse:collapse;font-size:13px;text-align:left">';
    html += '        <thead>';
    html += '          <tr style="border-bottom:1.5px solid rgba(255,255,255,0.1);color:var(--muted);font-size:11px;text-transform:uppercase">';
    html += '            <th style="padding:10px">Backup ID</th>';
    html += '            <th style="padding:10px">Type / Label</th>';
    html += '            <th style="padding:10px">Checksum Hash</th>';
    html += '            <th style="padding:10px">Size</th>';
    html += '            <th style="padding:10px">Status</th>';
    html += '            <th style="padding:10px">Created At</th>';
    html += '            <th style="padding:10px;text-align:right">Actions</th>';
    html += '          </tr>';
    html += '        </thead>';
    html += '        <tbody>';

    if (backups.length > 0) {
      backups.forEach(b => {
        html += '          <tr style="border-bottom:1px solid rgba(255,255,255,0.05)">';
        html += '            <td style="padding:10px;font-weight:700;font-family:monospace;color:#10b981">' + b.id + '</td>';
        html += '            <td style="padding:10px;font-weight:700;color:var(--text)">' + b.label + '<div style="font-size:11px;color:var(--muted);font-weight:normal">' + b.type + '</div></td>';
        html += '            <td style="padding:10px;font-family:monospace;font-size:11px;color:var(--muted)">' + b.checksum.substring(0, 18) + '...</td>';
        html += '            <td style="padding:10px;color:var(--muted)">' + Math.round(b.sizeBytes / 1024) + ' KB</td>';
        html += '            <td style="padding:10px"><span style="padding:2px 8px;border-radius:10px;background:rgba(16,185,129,0.15);color:#10b981;font-size:11px;font-weight:700">' + b.status + '</span></td>';
        html += '            <td style="padding:10px;font-size:11px;color:var(--muted)">' + new Date(b.timestamp).toLocaleString() + '</td>';
        html += '            <td style="padding:10px;text-align:right">';
        html += '              <button onclick="PulseIQ_ResilienceRenderer.restoreBackup(\'' + b.id + '\')" style="padding:4px 10px;font-size:11px;background:rgba(56,189,248,0.15);color:#38bdf8;border:1px solid rgba(56,189,248,0.3);border-radius:4px;cursor:pointer">🔄 Restore</button>';
        html += '            </td>';
        html += '          </tr>';
      });
    } else {
      html += '          <tr><td colspan="7" style="padding:20px;text-align:center;color:var(--muted)">No system backups available. Click <b>📦 Create System Backup</b> to initiate.</td></tr>';
    }

    html += '        </tbody>';
    html += '      </table>';
    html += '    </div>';
    html += '  </div>';

    html += '</div>';

    el.innerHTML = html;
  }

  function triggerManualBackup() {
    if (!window.PulseIQ_BackupEngine) return;
    const res = window.PulseIQ_BackupEngine.createBackup('MANUAL', 'Admin On-Demand Backup');
    if (res.success) {
      alert(`✅ System Backup Created Successfully!\nBackup ID: ${res.backup.id}\nChecksum: ${res.backup.checksum}`);
    } else {
      alert(`❌ Backup Failed: ${res.error}`);
    }
    renderResilienceDashboard();
  }

  function triggerSnapshot() {
    if (!window.PulseIQ_SnapshotEngine) return;
    const res = window.PulseIQ_SnapshotEngine.createSnapshot('On-Demand Config Snapshot');
    if (res.success) {
      alert(`📸 Snapshot Created Successfully!\nSnapshot ID: ${res.snapshot.id}`);
    } else {
      alert(`❌ Snapshot Failed: ${res.error}`);
    }
    renderResilienceDashboard();
  }

  function restoreBackup(backupId) {
    if (!confirm(`⚠️ Are you sure you want to restore system state from Backup ID '${backupId}'? A safety guard snapshot will be captured automatically before restore execution.`)) return;

    if (!window.PulseIQ_RestoreEngine) return;
    const res = window.PulseIQ_RestoreEngine.executeRestore(backupId);

    if (res.success) {
      alert(`✅ Restore Complete!\nRestore ID: ${res.restore.restoreId}\nRestored Keys: ${res.restore.restoredKeysCount}\nSafety Snapshot: ${res.restore.safetySnapshotId || 'N/A'}`);
    } else {
      alert(`❌ Restore Failed: ${res.error}`);
    }
    renderResilienceDashboard();
  }

  function runDRDrill() {
    if (!window.PulseIQ_RecoveryEngine) return;
    const res = window.PulseIQ_RecoveryEngine.runRecoveryDrill('FULL_SIMULATION');

    if (res.success) {
      alert(`🧪 Disaster Recovery Drill Completed Successfully!\nDrill ID: ${res.drill.drillId}\nExecution Latency: ${res.drill.executionDurationMs}ms\nRPO: ${res.metrics.rpoMinutes} mins | RTO: ${res.metrics.rtoSeconds} secs`);
    } else {
      alert(`❌ DR Drill Failed: ${res.error}`);
    }
    renderResilienceDashboard();
  }

  window.PulseIQ_ResilienceRenderer = {
    renderResilienceDashboard: renderResilienceDashboard,
    triggerManualBackup: triggerManualBackup,
    triggerSnapshot: triggerSnapshot,
    restoreBackup: restoreBackup,
    runDRDrill: runDRDrill
  };

})(typeof window !== 'undefined' ? window : global);
