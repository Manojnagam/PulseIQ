/**
 * PulseIQ Phase 2.5 — Automated Customer Follow-ups
 * Main Orchestrator & Public API
 * 
 * Manages follow-up queue generation, message template rendering,
 * human approval workflows, copy-to-clipboard, and interactive filters.
 */

(function(window) {
  'use strict';

  let cachedQueue = [];

  function refreshQueue(sourceData) {
    const D = sourceData || window.D || {};

    if (window.PulseIQ_FollowupEngine) {
      cachedQueue = window.PulseIQ_FollowupEngine.generateFollowupQueue(D);
    } else {
      console.warn('[PulseIQ Customer Followup] FollowupEngine not loaded');
      cachedQueue = [];
    }

    if (window.PulseIQ_FollowupQueueRenderer) {
      window.PulseIQ_FollowupQueueRenderer.renderDashboard(cachedQueue);
    }

    return cachedQueue;
  }

  function setFilter(type, val, el) {
    if (type === 'priority') {
      if (window.PulseIQ_FollowupQueueRenderer) {
        window.PulseIQ_FollowupQueueRenderer.setPriorityFilter(val);
      }
      if (typeof document !== 'undefined') {
        document.querySelectorAll('[data-fu-filter="priority"]').forEach(chip => {
          chip.classList.remove('active');
        });
        if (el) el.classList.add('active');
      }
    }
    if (window.PulseIQ_FollowupQueueRenderer) {
      window.PulseIQ_FollowupQueueRenderer.renderDashboard(cachedQueue);
    }
  }

  function setCategoryFilter(val) {
    if (window.PulseIQ_FollowupQueueRenderer) {
      window.PulseIQ_FollowupQueueRenderer.setCategoryFilter(val);
      window.PulseIQ_FollowupQueueRenderer.renderDashboard(cachedQueue);
    }
  }

  function setApprovalFilter(val, el) {
    if (window.PulseIQ_FollowupQueueRenderer) {
      window.PulseIQ_FollowupQueueRenderer.setApprovalFilter(val);
    }
    if (typeof document !== 'undefined') {
      document.querySelectorAll('[data-fu-filter="approval"]').forEach(chip => {
        chip.classList.remove('active');
      });
      if (el) el.classList.add('active');
    }
    if (window.PulseIQ_FollowupQueueRenderer) {
      window.PulseIQ_FollowupQueueRenderer.renderDashboard(cachedQueue);
    }
  }

  function setSearchQuery(val) {
    if (window.PulseIQ_FollowupQueueRenderer) {
      window.PulseIQ_FollowupQueueRenderer.setSearchQuery(val);
      window.PulseIQ_FollowupQueueRenderer.renderDashboard(cachedQueue);
    }
  }

  function markApproved(id) {
    if (window.PulseIQ_FollowupQueueRenderer) {
      window.PulseIQ_FollowupQueueRenderer.markApproved(id);
      window.PulseIQ_FollowupQueueRenderer.renderDashboard(cachedQueue);
    }
  }

  function markDismissed(id) {
    if (window.PulseIQ_FollowupQueueRenderer) {
      window.PulseIQ_FollowupQueueRenderer.markDismissed(id);
      window.PulseIQ_FollowupQueueRenderer.renderDashboard(cachedQueue);
    }
  }

  function copyMessage(id) {
    if (typeof document === 'undefined') return;
    const msgEl = document.getElementById('msg-text-' + id);
    if (msgEl) {
      const text = msgEl.innerText || msgEl.textContent;
      navigator.clipboard.writeText(text).then(() => {
        if (typeof window.showToast === 'function') {
          window.showToast('📋 Message copied to clipboard!');
        } else {
          alert('📋 Message copied to clipboard!');
        }
      }).catch(err => {
        console.error('Clipboard copy failed:', err);
      });
    }
  }

  function resetFilters() {
    if (window.PulseIQ_FollowupQueueRenderer) {
      window.PulseIQ_FollowupQueueRenderer.setPriorityFilter('');
      window.PulseIQ_FollowupQueueRenderer.setCategoryFilter('');
      window.PulseIQ_FollowupQueueRenderer.setApprovalFilter('pending');
      window.PulseIQ_FollowupQueueRenderer.setSearchQuery('');
    }
    if (typeof document !== 'undefined') {
      const catSel = document.getElementById('fu-category-filter');
      if (catSel) catSel.value = '';
      const srchInp = document.getElementById('fu-search-input');
      if (srchInp) srchInp.value = '';

      document.querySelectorAll('[data-fu-filter="priority"]').forEach((chip, idx) => {
        if (idx === 0) chip.classList.add('active');
        else chip.classList.remove('active');
      });
      document.querySelectorAll('[data-fu-filter="approval"]').forEach((chip, idx) => {
        if (idx === 0) chip.classList.add('active');
        else chip.classList.remove('active');
      });
    }
    if (window.PulseIQ_FollowupQueueRenderer) {
      window.PulseIQ_FollowupQueueRenderer.renderDashboard(cachedQueue);
    }
  }

  // Intercept section rendering safely
  if (typeof window !== 'undefined') {
    const origGoTo = window.goTo;
    window.goTo = function(sec, el) {
      if (typeof origGoTo === 'function') {
        origGoTo(sec, el);
      }
      if (sec === 'customerfollowup') {
        refreshQueue(window.D);
      }
    };
  }

  window.PulseIQ_CustomerFollowup = {
    refreshQueue: refreshQueue,
    setFilter: setFilter,
    setCategoryFilter: setCategoryFilter,
    setApprovalFilter: setApprovalFilter,
    setSearchQuery: setSearchQuery,
    markApproved: markApproved,
    markDismissed: markDismissed,
    copyMessage: copyMessage,
    resetFilters: resetFilters,
    getQueue: function() { return cachedQueue; },
    version: '2.5.0'
  };

})(typeof window !== 'undefined' ? window : global);
