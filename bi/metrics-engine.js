/**
 * PulseIQ Phase 2 — AI Business Analyst (Phase 2.1)
 * Layer 1: Business Metrics Engine
 * 
 * STRICTLY DETERMINISTIC. ZERO AI. ZERO HALLUCINATIONS.
 * Computes exact KPIs from production data objects.
 */

(function(window) {
  'use strict';

  function computeBusinessMetrics(sourceData) {
    const D = sourceData || window.D || {};

    const customers = D.customers || [];
    const attendance = D.attendance || [];
    const finance = D.finance || [];
    const inventory = D.inventory || [];
    const bodyScans = D.body || D.bodyData || [];
    const coaches = D.coaches || [];
    const centers = D.centers || [];
    const expenses = D.expenses || [];

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Helper: Days difference
    function daysBetween(d1, d2) {
      return Math.floor((new Date(d1) - new Date(d2)) / (1000 * 60 * 60 * 24));
    }

    // Date Windows
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const currentMonthStr = todayStr.substring(0, 7);

    // ── 1. REVENUE METRICS ──
    let totalIncome = 0;
    let weeklyRevenue = 0;
    let prevWeeklyRevenue = 0;
    let monthlyRevenue = 0;

    finance.forEach(item => {
      const amt = parseFloat(item.amount) || 0;
      const type = (item.type || '').toLowerCase();
      const date = item.date || '';

      if (type === 'income' || amt > 0) {
        totalIncome += amt;
        if (date >= sevenDaysAgo) {
          weeklyRevenue += amt;
        } else if (date >= fourteenDaysAgo && date < sevenDaysAgo) {
          prevWeeklyRevenue += amt;
        }
        if (date.startsWith(currentMonthStr)) {
          monthlyRevenue += amt;
        }
      }
    });

    const weeklyRevenueGrowthPct = prevWeeklyRevenue > 0
      ? Math.round(((weeklyRevenue - prevWeeklyRevenue) / prevWeeklyRevenue) * 100)
      : (weeklyRevenue > 0 ? 100 : 0);

    const activeCustomers = customers.filter(c => {
      const st = (c.status || '').toLowerCase();
      return st === 'active' || (!c.expiry_date || c.expiry_date >= todayStr);
    });

    const activeCustCount = activeCustomers.length || 1;
    const arpu = Math.round(monthlyRevenue / activeCustCount);

    // ── 2. ATTENDANCE METRICS ──
    let todayAttendance = 0;
    let weeklyAttendance = 0;
    let prevWeeklyAttendance = 0;

    attendance.forEach(att => {
      const st = (att.status || '').toLowerCase();
      const date = att.date || '';
      if (st === 'present' || st === 'checked_in' || !att.status) {
        if (date === todayStr) todayAttendance++;
        if (date >= sevenDaysAgo) weeklyAttendance++;
        else if (date >= fourteenDaysAgo && date < sevenDaysAgo) prevWeeklyAttendance++;
      }
    });

    const attendanceGrowthPct = prevWeeklyAttendance > 0
      ? Math.round(((weeklyAttendance - prevWeeklyAttendance) / prevWeeklyAttendance) * 100)
      : (weeklyAttendance > 0 ? 100 : 0);

    // Inactive Customers (Active membership but no check-in for 7+ days)
    const recentAttMap = {};
    attendance.forEach(a => {
      if (a.customer_id && a.date) {
        if (!recentAttMap[a.customer_id] || a.date > recentAttMap[a.customer_id]) {
          recentAttMap[a.customer_id] = a.date;
        }
      }
    });

    const inactiveCustomers = activeCustomers.filter(c => {
      const lastAtt = recentAttMap[c.id] || c.start_date || c.created_at;
      if (!lastAtt) return true;
      return lastAtt < sevenDaysAgo;
    });

    // ── 3. CUSTOMER ANALYTICS ──
    const totalCustomersCount = customers.length;
    const newCustomers = customers.filter(c => (c.created_at || c.start_date || '') >= thirtyDaysAgo);
    const expiringMemberships = activeCustomers.filter(c => {
      if (!c.expiry_date) return false;
      const daysLeft = daysBetween(c.expiry_date, todayStr);
      return daysLeft >= 0 && daysLeft <= 7;
    });

    const retentionRatePct = totalCustomersCount > 0
      ? Math.round(((activeCustomers.length - newCustomers.length) / Math.max(totalCustomersCount - newCustomers.length, 1)) * 100)
      : 100;

    // ── 4. BODY COMPOSITION METRICS ──
    const customerScans = {};
    bodyScans.forEach(scan => {
      if (!scan.customer_id) return;
      if (!customerScans[scan.customer_id]) customerScans[scan.customer_id] = [];
      customerScans[scan.customer_id].push(scan);
    });

    let totalWeightDiff = 0;
    let totalFatDiff = 0;
    let totalMuscleDiff = 0;
    let scannedCustomerCount = 0;
    let recheckDueCount = 0;

    Object.keys(customerScans).forEach(cid => {
      const scans = customerScans[cid].sort((a, b) => new Date(a.date) - new Date(b.date));
      if (scans.length > 0) {
        const first = scans[0];
        const last = scans[scans.length - 1];
        if (first.weight_kg && last.weight_kg) totalWeightDiff += (parseFloat(last.weight_kg) - parseFloat(first.weight_kg));
        if (first.fat_percent && last.fat_percent) totalFatDiff += (parseFloat(last.fat_percent) - parseFloat(first.fat_percent));
        if (first.muscle_percent && last.muscle_percent) totalMuscleDiff += (parseFloat(last.muscle_percent) - parseFloat(first.muscle_percent));
        scannedCustomerCount++;

        // Recheck due if latest scan is >14 days old
        if (last.date < fourteenDaysAgo) {
          recheckDueCount++;
        }
      }
    });

    // Active customers with NO scan at all count as recheck due
    activeCustomers.forEach(c => {
      if (!customerScans[c.id]) recheckDueCount++;
    });

    const avgWeightChange = scannedCustomerCount > 0 ? (totalWeightDiff / scannedCustomerCount).toFixed(1) : '0.0';
    const avgBodyFatChange = scannedCustomerCount > 0 ? (totalFatDiff / scannedCustomerCount).toFixed(1) : '0.0';
    const avgMuscleGain = scannedCustomerCount > 0 ? (totalMuscleDiff / scannedCustomerCount).toFixed(1) : '0.0';

    // ── 5. FINANCE METRICS ──
    let totalExpenses = 0;
    finance.forEach(item => {
      const type = (item.type || '').toLowerCase();
      if (type === 'expense') totalExpenses += parseFloat(item.amount) || 0;
    });
    expenses.forEach(item => {
      totalExpenses += parseFloat(item.amount) || 0;
    });

    const netProfit = totalIncome - totalExpenses;
    const profitMarginPct = totalIncome > 0 ? Math.round((netProfit / totalIncome) * 100) : 0;

    // ── 6. INVENTORY METRICS ──
    const lowStockItems = [];
    const outOfStockItems = [];
    const expiringProducts = [];

    inventory.forEach(item => {
      const qty = parseInt(item.stock_quantity || item.quantity || 0, 10);
      const threshold = parseInt(item.low_stock_threshold || item.min_stock || 5, 10);
      const name = item.name || item.product_name || 'Item #' + item.id;

      if (qty === 0) {
        outOfStockItems.push({ id: item.id, name, qty });
      } else if (qty <= threshold) {
        lowStockItems.push({ id: item.id, name, qty, threshold });
      }

      if (item.expiry_date && item.expiry_date <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]) {
        expiringProducts.push({ id: item.id, name, expiry_date: item.expiry_date });
      }
    });

    // ── 7. COACH ANALYTICS ──
    const coachStats = coaches.map(coach => {
      const coachCusts = customers.filter(c => c.coach_id === coach.id || c.assigned_coach_id === coach.id);
      const activeCount = coachCusts.filter(c => (c.status || '').toLowerCase() === 'active').length;
      const coachRevenue = finance
        .filter(f => coachCusts.some(c => c.id === f.customer_id))
        .reduce((sum, f) => sum + (parseFloat(f.amount) || 0), 0);

      const retention = coachCusts.length > 0 ? Math.round((activeCount / coachCusts.length) * 100) : 100;

      return {
        id: coach.id,
        name: coach.name || 'Coach #' + coach.id,
        pin: coach.herbalife_pin || 'Associate',
        totalCustomers: coachCusts.length,
        activeCustomers: activeCount,
        retentionRate: retention,
        revenue: coachRevenue
      };
    });

    const topCoach = coachStats.length > 0
      ? coachStats.reduce((best, curr) => (curr.retentionRate > best.retentionRate || (curr.retentionRate === best.retentionRate && curr.revenue > best.revenue) ? curr : best), coachStats[0])
      : { name: 'N/A', retentionRate: 0 };

    const topProduct = inventory.length > 0
      ? (inventory.find(i => (i.stock_quantity || 0) > 0) || inventory[0]).name || 'Formula 1'
      : 'Formula 1 Shake';

    // Business Health Score Calculation (0 - 100)
    let healthScore = 70; // baseline
    if (weeklyRevenueGrowthPct > 0) healthScore += 10;
    else if (weeklyRevenueGrowthPct < -10) healthScore -= 10;

    if (attendanceGrowthPct >= 0) healthScore += 5;
    else healthScore -= 5;

    if (retentionRatePct >= 80) healthScore += 10;
    else if (retentionRatePct < 60) healthScore -= 10;

    if (outOfStockItems.length === 0) healthScore += 5;
    else healthScore -= 5;

    healthScore = Math.max(10, Math.min(100, healthScore));

    return {
      timestamp: new Date().toISOString(),
      healthScore,
      revenue: {
        totalIncome,
        weeklyRevenue,
        prevWeeklyRevenue,
        weeklyRevenueGrowthPct,
        monthlyRevenue,
        arpu
      },
      attendance: {
        todayAttendance,
        weeklyAttendance,
        prevWeeklyAttendance,
        attendanceGrowthPct,
        missedAttendanceCount: inactiveCustomers.length
      },
      customers: {
        total: totalCustomersCount,
        active: activeCustomers.length,
        newCount: newCustomers.length,
        inactive: inactiveCustomers,
        expiringMemberships,
        retentionRatePct
      },
      bodyComposition: {
        avgWeightChange,
        avgBodyFatChange,
        avgMuscleGain,
        recheckDueCount,
        scannedCount: scannedCustomerCount
      },
      finance: {
        income: totalIncome,
        expenses: totalExpenses,
        netProfit,
        profitMarginPct
      },
      inventory: {
        lowStockItems,
        outOfStockItems,
        expiringProducts,
        totalLowOrOut: lowStockItems.length + outOfStockItems.length
      },
      coaches: {
        stats: coachStats,
        topCoach
      },
      topProduct
    };
  }

  window.PulseIQ_MetricsEngine = {
    computeBusinessMetrics: computeBusinessMetrics
  };

})(window);
