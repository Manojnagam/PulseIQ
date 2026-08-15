/**
 * PulseIQ Phase 2.5 — Automated Customer Follow-ups
 * Follow-up Queue Generation Engine
 * 
 * Scans production data and constructs structured follow-up queues.
 * DOES NOT SEND MESSAGES AUTOMATICALLY. GENERATES APPROVAL QUEUES ONLY.
 */

(function(window) {
  'use strict';

  function daysBetween(d1, d2) {
    return Math.floor((new Date(d1) - new Date(d2)) / (1000 * 60 * 60 * 24));
  }

  function generateFollowupQueue(sourceData) {
    const D = sourceData || window.D || {};
    const customers = D.customers || [];
    const attendance = D.attendance || [];
    const bodyScans = D.body || D.bodyData || [];
    const coaches = D.coaches || [];

    const todayStr = new Date().toISOString().split('T')[0];

    const coachMap = {};
    coaches.forEach(c => coachMap[c.id] = c.name || `Coach #${c.id}`);

    const attMap = {};
    attendance.forEach(a => {
      if (!a.customer_id) return;
      if (!attMap[a.customer_id]) attMap[a.customer_id] = [];
      attMap[a.customer_id].push(a);
    });

    const scanMap = {};
    bodyScans.forEach(b => {
      if (!b.customer_id) return;
      if (!scanMap[b.customer_id]) scanMap[b.customer_id] = [];
      scanMap[b.customer_id].push(b);
    });

    // Reuse Risk Profiles if available
    let riskProfiles = [];
    if (window.PulseIQ_RiskEngine && typeof window.PulseIQ_RiskEngine.evaluateAllCustomerRisks === 'function') {
      try {
        riskProfiles = window.PulseIQ_RiskEngine.evaluateAllCustomerRisks(D);
      } catch(e) {
        riskProfiles = [];
      }
    }

    const queue = [];
    const createdTime = new Date().toISOString();

    customers.forEach(cust => {
      const coachName = coachMap[cust.coach_id || cust.assigned_coach_id] || 'your Coach';
      const custAtt = attMap[cust.id] || [];
      const custScans = scanMap[cust.id] || [];

      // ── 1. HIGH RISK FOLLOW-UP ──
      const riskProf = riskProfiles.find(r => r.customerId === cust.id);
      if (riskProf && riskProf.riskLevel === 'HIGH') {
        const msg = window.PulseIQ_FollowupTemplateEngine.renderTemplate('HighRisk', {
          CustomerName: cust.name,
          CoachName: coachName
        });
        queue.push({
          id: `fu-risk-${cust.id}`,
          customer: { id: cust.id, name: cust.name, mobile: cust.mobile, coachName: coachName },
          category: 'HighRisk',
          priority: 'HIGH',
          reason: `Customer high churn risk score (${riskProf.riskScore}/100)`,
          suggestedChannel: 'WhatsApp',
          suggestedMessage: msg,
          createdTime: createdTime,
          approvalStatus: 'pending'
        });
      }

      // ── 2. ATTENDANCE FOLLOW-UP ──
      let lastAttDate = null;
      let daysAbsent = 999;
      if (custAtt.length > 0) {
        const sorted = custAtt.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
        lastAttDate = sorted[0].date;
        daysAbsent = daysBetween(todayStr, lastAttDate);
      }
      if (daysAbsent >= 7 && daysAbsent !== 999 && (!riskProf || riskProf.riskLevel !== 'HIGH')) {
        const msg = window.PulseIQ_FollowupTemplateEngine.renderTemplate('Attendance', {
          CustomerName: cust.name,
          CoachName: coachName,
          DaysAbsent: daysAbsent
        });
        queue.push({
          id: `fu-att-${cust.id}`,
          customer: { id: cust.id, name: cust.name, mobile: cust.mobile, coachName: coachName },
          category: 'Attendance',
          priority: daysAbsent > 14 ? 'HIGH' : 'MEDIUM',
          reason: `Customer absent for ${daysAbsent} days`,
          suggestedChannel: 'WhatsApp',
          suggestedMessage: msg,
          createdTime: createdTime,
          approvalStatus: 'pending'
        });
      }

      // ── 3. MEMBERSHIP RENEWAL ──
      if (cust.expiry_date) {
        const daysRemaining = daysBetween(cust.expiry_date, todayStr);
        if (daysRemaining <= 7 && daysRemaining >= -2) {
          const msg = window.PulseIQ_FollowupTemplateEngine.renderTemplate('Membership', {
            CustomerName: cust.name,
            CoachName: coachName,
            ExpiryDate: cust.expiry_date
          });
          queue.push({
            id: `fu-mem-${cust.id}`,
            customer: { id: cust.id, name: cust.name, mobile: cust.mobile, coachName: coachName },
            category: 'Membership',
            priority: daysRemaining <= 3 ? 'HIGH' : 'MEDIUM',
            reason: daysRemaining <= 0 ? `Membership expired on ${cust.expiry_date}` : `Membership expires in ${daysRemaining} days`,
            suggestedChannel: 'WhatsApp',
            suggestedMessage: msg,
            createdTime: createdTime,
            approvalStatus: 'pending'
          });
        }
      }

      // ── 4. BODY SCAN REMINDER ──
      let daysSinceScan = 999;
      if (custScans.length > 0) {
        const sortedScans = custScans.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
        daysSinceScan = daysBetween(todayStr, sortedScans[0].date);
      }
      if (daysSinceScan > 14 && daysSinceScan !== 999) {
        const msg = window.PulseIQ_FollowupTemplateEngine.renderTemplate('BodyScan', {
          CustomerName: cust.name,
          CoachName: coachName
        });
        queue.push({
          id: `fu-scan-${cust.id}`,
          customer: { id: cust.id, name: cust.name, mobile: cust.mobile, coachName: coachName },
          category: 'BodyScan',
          priority: daysSinceScan > 28 ? 'HIGH' : 'MEDIUM',
          reason: `Body scan overdue (${daysSinceScan} days since scan)`,
          suggestedChannel: 'WhatsApp',
          suggestedMessage: msg,
          createdTime: createdTime,
          approvalStatus: 'pending'
        });
      }

      // ── 5. PROGRESS MILESTONE CONGRATULATIONS ──
      if (custScans.length >= 2) {
        const sortedScans = custScans.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
        const first = sortedScans[0];
        const last = sortedScans[sortedScans.length - 1];
        const weightLoss = parseFloat(first.weight_kg) - parseFloat(last.weight_kg);
        if (weightLoss >= 1.0) {
          const msg = window.PulseIQ_FollowupTemplateEngine.renderTemplate('Milestone', {
            CustomerName: cust.name,
            CoachName: coachName,
            ProgressKg: weightLoss.toFixed(1)
          });
          queue.push({
            id: `fu-milestone-${cust.id}`,
            customer: { id: cust.id, name: cust.name, mobile: cust.mobile, coachName: coachName },
            category: 'Milestone',
            priority: 'LOW',
            reason: `Achieved ${weightLoss.toFixed(1)} kg weight loss milestone`,
            suggestedChannel: 'WhatsApp',
            suggestedMessage: msg,
            createdTime: createdTime,
            approvalStatus: 'pending'
          });
        }
      }

      // ── 6. NEW ONBOARDING ──
      const joinDate = cust.created_at || cust.start_date || '';
      if (joinDate && daysBetween(todayStr, joinDate) <= 7 && daysBetween(todayStr, joinDate) >= 0) {
        const msg = window.PulseIQ_FollowupTemplateEngine.renderTemplate('Onboarding', {
          CustomerName: cust.name,
          CoachName: coachName
        });
        queue.push({
          id: `fu-onboarding-${cust.id}`,
          customer: { id: cust.id, name: cust.name, mobile: cust.mobile, coachName: coachName },
          category: 'Onboarding',
          priority: 'MEDIUM',
          reason: 'New member onboarded within last 7 days',
          suggestedChannel: 'WhatsApp',
          suggestedMessage: msg,
          createdTime: createdTime,
          approvalStatus: 'pending'
        });
      }
    });

    // Sort queue by Priority (HIGH > MEDIUM > LOW)
    const pMap = { HIGH: 1, MEDIUM: 2, LOW: 3 };
    queue.sort((a, b) => pMap[a.priority] - pMap[b.priority]);

    return queue;
  }

  window.PulseIQ_FollowupEngine = {
    generateFollowupQueue: generateFollowupQueue
  };

})(typeof window !== 'undefined' ? window : global);
