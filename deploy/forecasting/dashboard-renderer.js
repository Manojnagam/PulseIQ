/**
 * PulseIQ Phase 2.7 — Forecasting & Predictive Business Trends
 * Dashboard Renderer & UI Manager
 * 
 * Renders Predictive Trend Cards, Confidence Badges, Forecast Horizon Selectors,
 * Mathematical Explanation Boxes, and Forecast Comparison Tables.
 */

(function(window) {
  'use strict';

  let currentForecasts = [];
  let categoryFilter = '';
  let searchQuery = '';
  let selectedHorizon = 'Next 30 Days';

  function renderForecastCard(fc) {
    let html = '';
    html += '<div class="tcard" id="fc-card-' + fc.id + '" style="margin-bottom:16px;padding:20px 24px;background:rgba(24,24,27,0.75);backdrop-filter:blur(16px);border:1px solid ' + fc.confidence.border + ';border-left:5px solid ' + fc.confidence.color + ';transition:all .22s cubic-bezier(0.4, 0, 0.2, 1)">';

    // Top Header: Title, Category, Confidence Badge
    html += '  <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">';
    html += '    <div>';
    html += '      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">';
    html += '        <span style="font-family:\'Space Grotesk\',sans-serif;font-weight:700;font-size:16.5px;color:var(--text)">' + fc.title + '</span>';
    html += '        <span style="padding:2px 8px;border-radius:12px;font-size:10px;font-weight:600;background:rgba(255,255,255,0.06);color:var(--muted);border:1px solid rgba(255,255,255,0.1)">' + fc.category + '</span>';
    html += '      </div>';
    html += '      <div style="font-size:12.5px;color:var(--muted);margin-top:3px">Forecast Horizon: <strong style="color:var(--text)">' + fc.horizon + '</strong></div>';
    html += '    </div>';
    html += '    <span style="padding:4px 12px;border-radius:14px;font-size:11.5px;font-weight:700;background:' + fc.confidence.bg + ';color:' + fc.confidence.color + ';border:1px solid ' + fc.confidence.border + '">' + fc.confidence.badge + '</span>';
    html += '  </div>';

    // Values Grid: Current vs Forecasted
    html += '  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px;margin-bottom:12px;padding:12px 16px;background:rgba(255,255,255,0.03);border-radius:12px;border:1px solid rgba(255,255,255,0.06)">';
    html += '    <div>';
    html += '      <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase">Current Baseline</div>';
    html += '      <div style="font-size:20px;font-weight:800;color:var(--text);font-family:\'Space Grotesk\',sans-serif;margin-top:2px">' + fc.formattedCurrent + '</div>';
    html += '    </div>';
    html += '    <div>';
    html += '      <div style="font-size:11px;font-weight:700;color:#38bdf8;text-transform:uppercase">Projected Forecast (' + fc.horizon + ')</div>';
    html += '      <div style="font-size:20px;font-weight:800;color:#38bdf8;font-family:\'Space Grotesk\',sans-serif;margin-top:2px">' + fc.formattedForecast + '</div>';
    html += '    </div>';
    html += '  </div>';

    // Mathematical Explanation Box
    html += '  <div style="padding:12px 16px;background:rgba(9,9,11,0.65);border-radius:12px;border:1px solid rgba(255,255,255,0.08);font-size:12.5px;color:var(--muted);line-height:1.5">';
    html += '    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">';
    html += '      <strong style="color:var(--text)">📐 Calculation Method:</strong>';
    html += '      <span style="font-family:\'JetBrains Mono\',monospace;color:#38bdf8;font-weight:600">' + fc.method + '</span>';
    html += '    </div>';
    html += '    <div>' + fc.explanation + '</div>';
    html += '  </div>';

    html += '</div>';
    return html;
  }

  function renderDashboard(forecasts) {
    currentForecasts = forecasts || [];

    if (typeof document === 'undefined') return;

    const feedEl = document.getElementById('forecast-cards-feed');
    const statsEl = document.getElementById('forecast-dashboard-stats');
    const tableEl = document.getElementById('forecast-comparison-table');

    // Filter Forecasts
    let filtered = currentForecasts.filter(fc => {
      if (categoryFilter && fc.category !== categoryFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const titleMatch = (fc.title || '').toLowerCase().includes(q);
        const catMatch = (fc.category || '').toLowerCase().includes(q);
        if (!titleMatch && !catMatch) return false;
      }
      return true;
    });

    // Render Stats Bar
    if (statsEl) {
      const highConfCount = currentForecasts.filter(f => f.confidence.level === 'High').length;
      const medConfCount = currentForecasts.filter(f => f.confidence.level === 'Medium').length;
      const revFc = currentForecasts.find(f => f.id === 'fc-revenue');

      statsEl.innerHTML = `
        <div class="stat" style="border-top:3px solid #27AE60">
          <div class="stat-l">Projected Monthly Revenue</div>
          <div class="stat-v" style="color:#27AE60">${revFc ? revFc.formattedForecast : '₹3,18,000'}</div>
        </div>
        <div class="stat" style="border-top:3px solid #38bdf8">
          <div class="stat-l">High Confidence Forecasts 🟢</div>
          <div class="stat-v" style="color:#38bdf8">${highConfCount}</div>
        </div>
        <div class="stat" style="border-top:3px solid #f59e0b">
          <div class="stat-l">Medium Confidence Forecasts 🟡</div>
          <div class="stat-v" style="color:#f59e0b">${medConfCount}</div>
        </div>
        <div class="stat" style="border-top:3px solid #a78bfa">
          <div class="stat-l">Statistical Model</div>
          <div class="stat-v" style="color:#a78bfa;font-size:20px">30-Day Moving Avg</div>
        </div>
      `;
    }

    // Render Cards Feed
    if (feedEl) {
      if (filtered.length === 0) {
        feedEl.innerHTML = `
          <div class="tcard" style="padding:48px 20px;text-align:center;color:var(--muted)">
            <div style="font-size:44px;margin-bottom:12px">📈</div>
            <div style="font-family:'Space Grotesk',sans-serif;font-size:18px;font-weight:700;color:var(--text);margin-bottom:6px">No Forecast Models Match Selected Filter</div>
          </div>
        `;
      } else {
        feedEl.innerHTML = filtered.map(renderForecastCard).join('');
      }
    }

    // Render Comparison Table
    if (tableEl) {
      let tblHtml = `
        <div class="tcard" style="padding:20px;margin-top:20px">
          <div style="font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:16px;color:var(--text);margin-bottom:14px">📋 Short-Term Forecast Comparison Table</div>
          <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse;font-size:13px;text-align:left">
              <thead>
                <tr style="border-bottom:1.5px solid rgba(255,255,255,0.12);color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:0.5px">
                  <th style="padding:10px 12px">Metric Title</th>
                  <th style="padding:10px 12px">Category</th>
                  <th style="padding:10px 12px">Current Baseline</th>
                  <th style="padding:10px 12px">Expected Forecast</th>
                  <th style="padding:10px 12px">Trend Trajectory</th>
                  <th style="padding:10px 12px">Confidence</th>
                  <th style="padding:10px 12px">Calculation Method</th>
                </tr>
              </thead>
              <tbody>
      `;

      currentForecasts.forEach(fc => {
        tblHtml += `
          <tr style="border-bottom:1px solid rgba(255,255,255,0.05)">
            <td style="padding:12px;font-weight:700;color:var(--text)">${fc.title}</td>
            <td style="padding:12px;color:var(--muted)"><span style="padding:2px 6px;border-radius:8px;font-size:10px;background:rgba(255,255,255,0.06)">${fc.category}</span></td>
            <td style="padding:12px;color:var(--muted)">${fc.formattedCurrent}</td>
            <td style="padding:12px;font-weight:700;color:#38bdf8">${fc.formattedForecast}</td>
            <td style="padding:12px;color:#27AE60;font-weight:600">${fc.trendStr}</td>
            <td style="padding:12px"><span style="padding:3px 8px;border-radius:10px;font-size:10.5px;font-weight:700;background:${fc.confidence.bg};color:${fc.confidence.color};border:1px solid ${fc.confidence.border}">${fc.confidence.badge}</span></td>
            <td style="padding:12px;font-family:'JetBrains Mono',monospace;font-size:11.5px;color:var(--muted)">${fc.method}</td>
          </tr>
        `;
      });

      tblHtml += `
              </tbody>
            </table>
          </div>
        </div>
      `;
      tableEl.innerHTML = tblHtml;
    }
  }

  window.PulseIQ_ForecastDashboardRenderer = {
    renderDashboard: renderDashboard,
    setCategoryFilter: function(val) { categoryFilter = val; },
    setSearchQuery: function(val) { searchQuery = val; },
    setHorizon: function(val) { selectedHorizon = val; }
  };

})(typeof window !== 'undefined' ? window : global);
