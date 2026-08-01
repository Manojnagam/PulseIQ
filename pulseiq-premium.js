/**
 * PulseIQ Premium Effects v2.0
 * Implements Aceternity UI-style effects in vanilla JS:
 *  - Card spotlight (mouse-tracking radial glow)
 *  - Animated metric counters (Motion Primitives style)
 *  - Stagger entrance for dynamic DOM cards
 */
(function () {
  'use strict';

  /* ─── 1. CARD SPOTLIGHT (Aceternity's signature effect) ─── */
  function initSpotlight() {
    const SELECTORS = '.stat, .ov-card, .tcard, .report-card, .ws-report-card, .pin-card, .agent-card, .ov-rev-card';

    function attachSpotlight(card) {
      if (card._spotlight) return;
      card._spotlight = true;

      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width * 100).toFixed(1) + '%';
        const y = ((e.clientY - rect.top) / rect.height * 100).toFixed(1) + '%';
        card.style.setProperty('--mouse-x', x);
        card.style.setProperty('--mouse-y', y);
      });
    }

    // Attach to existing cards
    document.querySelectorAll(SELECTORS).forEach(attachSpotlight);

    // Watch for dynamically rendered cards (module sections render async)
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.matches && node.matches(SELECTORS)) attachSpotlight(node);
          node.querySelectorAll && node.querySelectorAll(SELECTORS).forEach(attachSpotlight);
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  /* ─── 2. ANIMATED COUNTER (Motion Primitives style) ─── */
  function animateCounter(el, target, duration = 800, prefix = '', suffix = '') {
    const start = performance.now();
    const startVal = 0;
    const isFloat = !Number.isInteger(target);
    const decimals = isFloat ? 1 : 0;

    function ease(t) {
      // Ease out cubic
      return 1 - Math.pow(1 - t, 3);
    }

    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const current = startVal + (target - startVal) * ease(progress);
      el.textContent = prefix + current.toFixed(decimals) + suffix;

      if (progress < 1) requestAnimationFrame(tick);
      else el.textContent = prefix + target.toFixed(decimals) + suffix;
    }

    requestAnimationFrame(tick);
  }

  function initCounters() {
    // Observe stat values entering the viewport
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target;
        if (el._counted) continue;

        const text = el.textContent.trim();
        // Match ₹1,23,456 or 94% or 1.2K etc
        const numMatch = text.match(/[\d,.]+/);
        if (!numMatch) continue;

        const raw = numMatch[0].replace(/,/g, '');
        const num = parseFloat(raw);
        if (isNaN(num) || num === 0) continue;

        // Extract prefix/suffix around the number
        const idx = text.indexOf(numMatch[0]);
        const pre = text.slice(0, idx);
        const suf = text.slice(idx + numMatch[0].length);

        el._counted = true;
        io.unobserve(el);
        animateCounter(el, num, 900, pre, suf);
      }
    }, { threshold: 0.3 });

    function observeCounters() {
      document.querySelectorAll('.stat-v, .ov-rev-val').forEach((el) => {
        if (!el._counted) io.observe(el);
      });
    }

    observeCounters();

    // Re-observe after section switches
    document.addEventListener('click', () => {
      setTimeout(observeCounters, 100);
    });
  }

  /* ─── 3. STAGGER ENTRANCE for dynamic card lists ─── */
  function staggerEnter(container, selector = '.att-card, .lead-card, .recheck-card, .retention-card') {
    const cards = container.querySelectorAll(selector);
    cards.forEach((card, i) => {
      card.style.opacity = '0';
      card.style.transform = 'translateY(12px)';
      card.style.transition = `opacity 0.3s ${i * 40}ms cubic-bezier(0.0,0.0,0.2,1), transform 0.3s ${i * 40}ms cubic-bezier(0.175,0.885,0.32,1.275)`;

      // Trigger
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          card.style.opacity = '1';
          card.style.transform = 'translateY(0)';
        });
      });
    });
  }

  const staggerObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1) continue;
        const targets = ['.att-card', '.lead-card', '.recheck-card', '.retention-card'];
        if (targets.some(sel => node.matches && node.matches(sel))) {
          // Single card added
          node.style.opacity = '0';
          node.style.transform = 'translateY(10px)';
          node.style.transition = 'opacity 0.25s var(--ease-out), transform 0.25s var(--spring)';
          requestAnimationFrame(() => requestAnimationFrame(() => {
            node.style.opacity = '1';
            node.style.transform = 'translateY(0)';
          }));
        }
        if (node.querySelector) {
          staggerEnter(node);
        }
      }
    }
  });

  staggerObserver.observe(document.body, { childList: true, subtree: true });

  /* ─── 4. SIDEBAR ACTIVE INDICATOR GLOW ─── */
  function patchNavItems() {
    document.querySelectorAll('.nav-item').forEach((item) => {
      item.addEventListener('click', () => {
        // Brief flash glow on click
        item.style.boxShadow = '0 0 16px rgba(0, 217, 126, 0.25)';
        setTimeout(() => { item.style.boxShadow = ''; }, 400);
      });
    });
  }

  /* ─── 5. TOAST UPGRADE (Aceternity-style notification) ─── */
  function patchToast() {
    const original = window.showToast;
    if (typeof original !== 'function') return;

    window.showToast = function(msg, type) {
      original(msg, type);
      const toast = document.getElementById('toast');
      if (!toast) return;

      // Add icon prefix
      const icons = { success: '✓', error: '✕', warning: '⚠' };
      const icon = icons[type] || '•';
      if (!toast.textContent.startsWith(icon)) {
        toast.textContent = icon + '  ' + toast.textContent;
      }
    };
  }

  /* ─── 6. SECTION TRANSITION — smooth like Linear ─── */
  function enhanceSectionTransitions() {
    const sections = document.querySelectorAll('.sec');
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.target.classList.contains('active')) {
          entry.target.style.animation = 'none';
          entry.target.offsetHeight; // Reflow
          entry.target.style.animation = '';
        }
      }
    });
    sections.forEach(s => observer.observe(s));
  }

  /* ─── INIT ─── */
  function init() {
    initSpotlight();
    initCounters();
    patchNavItems();
    patchToast();
    enhanceSectionTransitions();
    console.log('[PulseIQ Premium] ✓ Effects initialised');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // App loads async after Supabase auth — wait for #app to appear
    const appObserver = new MutationObserver(() => {
      const app = document.getElementById('app');
      if (app && app.style.display !== 'none') {
        init();
        appObserver.disconnect();
      }
    });
    appObserver.observe(document.body, { childList: true, subtree: true, attributes: true });

    // Init spotlight immediately (login screen also benefits)
    initSpotlight();
  }
})();
