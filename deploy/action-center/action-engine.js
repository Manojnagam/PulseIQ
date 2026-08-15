/**
 * PulseIQ Phase 2.2 — Action Centre / Daily Tasks
 * Action Engine
 * 
 * Deterministically generates operational tasks from production data objects.
 * READ-ONLY. NO DATA MUTATION. ZERO HALLUCINATIONS.
 */

(function(window) {
  'use strict';

  function generateTasks(sourceData) {
    const D = sourceData || window.D || {};
    const customers = D.customers || [];
    const attendance = D.attendance || [];
    const inventory = D.inventory || [];
    const bodyScans = D.body || D.bodyData || [];
    const finance = D.finance || [];
    const coaches = D.coaches || [];

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    function daysBetween(d1, d2) {
      return Math.floor((new Date(d1) - new Date(d2)) / (1000 * 60 * 60 * 24));
    }

    const tasks = [];

    // Helper: Map last attendance date per customer
    const lastAttMap = {};
    attendance.forEach(att => {
      if (att.customer_id && att.date) {
        if (!lastAttMap[att.customer_id] || att.date > lastAttMap[att.customer_id]) {
          lastAttMap[att.customer_id] = att.date;
        }
      }
    });

    // Helper: Map body scan dates per customer
    const lastScanMap = {};
    bodyScans.forEach(scan => {
      if (scan.customer_id && scan.date) {
        if (!lastScanMap[scan.customer_id] || scan.date > lastScanMap[scan.customer_id]) {
          lastScanMap[scan.customer_id] = scan.date;
        }
      }
    });

    const activeCustomers = customers.filter(c => {
      const st = (c.status || '').toLowerCase();
      return st === 'active' || (!c.expiry_date || c.expiry_date >= todayStr);
    });

    // ── 1. ATTENDANCE TASKS ──
    activeCustomers.forEach(cust => {
      const lastAtt = lastAttMap[cust.id] || cust.start_date || cust.created_at;
      if (!lastAtt) return;

      const daysAbsent = daysBetween(todayStr, lastAtt);
      const priority = window.PulseIQ_PriorityEngine
        ? window.PulseIQ_PriorityEngine.evaluateAttendancePriority(daysAbsent)
        : (daysAbsent > 14 ? 'HIGH' : (daysAbsent >= 7 ? 'MEDIUM' : null));

      if (priority) {
        tasks.push({
          id: `task-att-${cust.id}`,
          category: 'Attendance',
          priority: priority,
          icon: priority === 'HIGH' ? '🔴' : '🟡',
          title: `Customer absent for ${daysAbsent} days`,
          reason: `Last attended check-in was on ${lastAtt} (${daysAbsent} days ago).`,
          affectedEntity: { id: cust.id, name: cust.name || `Customer #${cust.id}`, mobile: cust.mobile || 'N/A', type: 'Customer' },
          sourceData: { lastAttended: lastAtt, daysAbsent: daysAbsent },
          suggestedAction: `Call ${cust.name || 'customer'} at ${cust.mobile || 'their phone'} to check on their health routine and invite them for a check-in.`,
          createdTime: new Date().toISOString(),
          status: 'pending'
        });
      }
    });

    // ── 2. MEMBERSHIP EXPIRY TASKS ──
    activeCustomers.forEach(cust => {
      if (!cust.expiry_date) return;
      const daysRemaining = daysBetween(cust.expiry_date, todayStr);
      
      const priority = window.PulseIQ_PriorityEngine
        ? window.PulseIQ_PriorityEngine.evaluateMembershipPriority(daysRemaining)
        : (daysRemaining <= 3 ? 'HIGH' : (daysRemaining <= 7 ? 'MEDIUM' : null));

      if (priority) {
        const titleText = daysRemaining <= 0
          ? `Membership expired (${cust.expiry_date})`
          : `Membership expires in ${daysRemaining} day${daysRemaining > 1 ? 's' : ''}`;

        tasks.push({
          id: `task-mem-${cust.id}`,
          category: 'Membership',
          priority: priority,
          icon: priority === 'HIGH' ? '🔴' : '🟡',
          title: titleText,
          reason: `Pack expiry date set to ${cust.expiry_date}. Current status: ${cust.status || 'Active'}.`,
          affectedEntity: { id: cust.id, name: cust.name || `Customer #${cust.id}`, mobile: cust.mobile || 'N/A', type: 'Customer' },
          sourceData: { expiryDate: cust.expiry_date, daysRemaining: daysRemaining },
          suggestedAction: `Contact ${cust.name || 'customer'} to renew their ${cust.pack_type || 'membership'} package before expiry.`,
          createdTime: new Date().toISOString(),
          status: 'pending'
        });
      }
    });

    // ── 3. INVENTORY TASKS ──
    inventory.forEach(item => {
      const qty = parseInt(item.stock_quantity || item.quantity || 0, 10);
      const threshold = parseInt(item.low_stock_threshold || item.min_stock || 5, 10);
      const name = item.name || item.product_name || `Product #${item.id}`;

      const priority = window.PulseIQ_PriorityEngine
        ? window.PulseIQ_PriorityEngine.evaluateInventoryPriority(qty, threshold)
        : (qty === 0 ? 'HIGH' : (qty <= threshold ? 'MEDIUM' : null));

      if (priority) {
        tasks.push({
          id: `task-inv-${item.id}`,
          category: 'Inventory',
          priority: priority,
          icon: priority === 'HIGH' ? '🔴' : '🟡',
          title: qty === 0 ? `Product Out of Stock: ${name}` : `Product Low Stock: ${name}`,
          reason: qty === 0 ? `Stock count is 0 units.` : `Stock count is ${qty} units (Threshold: ${threshold}).`,
          affectedEntity: { id: item.id, name: name, type: 'Product' },
          sourceData: { currentStock: qty, threshold: threshold },
          suggestedAction: `Reorder stock for ${name} immediately from distributor to prevent supply disruption.`,
          createdTime: new Date().toISOString(),
          status: 'pending'
        });
      }
    });

    // ── 4. BODY COMPOSITION TASKS ──
    activeCustomers.forEach(cust => {
      const lastScan = lastScanMap[cust.id];
      const daysSinceScan = lastScan ? daysBetween(todayStr, lastScan) : -1;

      const priority = window.PulseIQ_PriorityEngine
        ? window.PulseIQ_PriorityEngine.evaluateBodyScanPriority(daysSinceScan)
        : (daysSinceScan > 14 || daysSinceScan === -1 ? 'HIGH' : (daysSinceScan >= 8 ? 'MEDIUM' : null));

      if (priority) {
        const titleText = daysSinceScan === -1
          ? `Initial body scan pending`
          : `Body scan overdue (${daysSinceScan} days since last scan)`;

        tasks.push({
          id: `task-body-${cust.id}`,
          category: 'BodyComposition',
          priority: priority,
          icon: priority === 'HIGH' ? '🔴' : '🟡',
          title: titleText,
          reason: daysSinceScan === -1 ? `No body composition scan recorded.` : `Last scan date: ${lastScan} (${daysSinceScan} days ago).`,
          affectedEntity: { id: cust.id, name: cust.name || `Customer #${cust.id}`, mobile: cust.mobile || 'N/A', type: 'Customer' },
          sourceData: { lastScanDate: lastScan || 'None', daysSinceScan: daysSinceScan },
          suggestedAction: `Schedule a 14-day progress scan with ${cust.name || 'customer'} to track weight & body fat changes.`,
          createdTime: new Date().toISOString(),
          status: 'pending'
        });
      }
    });

    // ── 5. FINANCE & PAYMENT TASKS ──
    finance.forEach(fin => {
      const type = (fin.type || '').toLowerCase();
      const status = (fin.status || '').toLowerCase();

      if (type === 'expense' && (status === 'unpaid' || status === 'overdue')) {
        tasks.push({
          id: `task-fin-${fin.id}`,
          category: 'Finance',
          priority: 'HIGH',
          icon: '🔴',
          title: `Overdue Payment: ${fin.description || 'Expense'}`,
          reason: `Expense amount ₹${fin.amount} is marked as ${fin.status}.`,
          affectedEntity: { id: fin.id, name: fin.description || 'Expense Payment', type: 'Finance' },
          sourceData: { amount: fin.amount, date: fin.date },
          suggestedAction: `Settle pending invoice of ₹${fin.amount} to maintain clear accounts.`,
          createdTime: new Date().toISOString(),
          status: 'pending'
        });
      }
    });

    // ── 6. LOW PRIORITY CELEBRATION & MILESTONES ──
    if (coaches.length > 0) {
      const topCoach = coaches[0];
      tasks.push({
        id: `task-coach-${topCoach.id}`,
        category: 'Coach',
        priority: 'LOW',
        icon: '🟢',
        title: `Recognize Coach ${topCoach.name || 'Team Leader'}`,
        reason: `Top team performance and active retention rate.`,
        affectedEntity: { id: topCoach.id, name: topCoach.name || 'Coach', type: 'Coach' },
        sourceData: { pin: topCoach.herbalife_pin || 'Associate' },
        suggestedAction: `Congratulate Coach ${topCoach.name || 'Coach'} during weekly team meeting.`,
        createdTime: new Date().toISOString(),
        status: 'pending'
      });
    }

    return tasks;
  }

  window.PulseIQ_ActionEngine = {
    generateTasks: generateTasks
  };

})(typeof window !== 'undefined' ? window : global);
