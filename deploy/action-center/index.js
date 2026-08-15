/**
 * PulseIQ Phase 2.2 — Action Centre / Daily Tasks
 * Main Orchestrator & Public API
 * 
 * Manages operational task generation, priority classification,
 * rendering, filtering, and interactive task completion.
 */

(function(window) {
  'use strict';

  let cachedTasks = [];

  function refreshTasks(sourceData) {
    const D = sourceData || window.D || {};
    
    if (window.PulseIQ_ActionEngine) {
      cachedTasks = window.PulseIQ_ActionEngine.generateTasks(D);
    } else {
      console.warn('[PulseIQ Action Center] ActionEngine not loaded');
      cachedTasks = [];
    }

    if (window.PulseIQ_TaskRenderer) {
      window.PulseIQ_TaskRenderer.renderFeed(cachedTasks);
    }

    return cachedTasks;
  }

  function setFilter(type, val, el) {
    if (type === 'priority') {
      if (window.PulseIQ_TaskRenderer) {
        window.PulseIQ_TaskRenderer.setPriorityFilter(val);
      }
      if (typeof document !== 'undefined') {
        document.querySelectorAll('[data-ac-filter="priority"]').forEach(chip => {
          chip.classList.remove('active');
        });
        if (el) el.classList.add('active');
      }
    }
    if (window.PulseIQ_TaskRenderer) {
      window.PulseIQ_TaskRenderer.renderFeed(cachedTasks);
    }
  }

  function setCategoryFilter(val) {
    if (window.PulseIQ_TaskRenderer) {
      window.PulseIQ_TaskRenderer.setCategoryFilter(val);
      window.PulseIQ_TaskRenderer.renderFeed(cachedTasks);
    }
  }

  function setSearchQuery(val) {
    if (window.PulseIQ_TaskRenderer) {
      window.PulseIQ_TaskRenderer.setSearchQuery(val);
      window.PulseIQ_TaskRenderer.renderFeed(cachedTasks);
    }
  }

  function toggleComplete(taskId) {
    if (window.PulseIQ_TaskRenderer) {
      window.PulseIQ_TaskRenderer.toggleComplete(taskId);
      window.PulseIQ_TaskRenderer.renderFeed(cachedTasks);
    }
  }

  function toggleExpand(taskId) {
    if (window.PulseIQ_TaskRenderer) {
      window.PulseIQ_TaskRenderer.toggleExpand(taskId);
      window.PulseIQ_TaskRenderer.renderFeed(cachedTasks);
    }
  }

  function resetFilters() {
    if (window.PulseIQ_TaskRenderer) {
      window.PulseIQ_TaskRenderer.setPriorityFilter('');
      window.PulseIQ_TaskRenderer.setCategoryFilter('');
      window.PulseIQ_TaskRenderer.setSearchQuery('');
    }
    if (typeof document !== 'undefined') {
      const catSel = document.getElementById('ac-category-filter');
      if (catSel) catSel.value = '';
      const srchInp = document.getElementById('ac-search-input');
      if (srchInp) srchInp.value = '';

      document.querySelectorAll('[data-ac-filter="priority"]').forEach((chip, idx) => {
        if (idx === 0) chip.classList.add('active');
        else chip.classList.remove('active');
      });
    }
    if (window.PulseIQ_TaskRenderer) {
      window.PulseIQ_TaskRenderer.renderFeed(cachedTasks);
    }
  }

  // Intercept section rendering or load event safely
  if (typeof window !== 'undefined') {
    const origGoTo = window.goTo;
    window.goTo = function(sec, el) {
      if (typeof origGoTo === 'function') {
        origGoTo(sec, el);
      }
      if (sec === 'actioncenter') {
        refreshTasks(window.D);
      }
    };
  }

  window.PulseIQ_ActionCenter = {
    refreshTasks: refreshTasks,
    setFilter: setFilter,
    setCategoryFilter: setCategoryFilter,
    setSearchQuery: setSearchQuery,
    toggleComplete: toggleComplete,
    toggleExpand: toggleExpand,
    resetFilters: resetFilters,
    getTasks: function() { return cachedTasks; },
    version: '2.2.0'
  };

})(typeof window !== 'undefined' ? window : global);
