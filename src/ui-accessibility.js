/**
 * @file src/ui-accessibility.js
 * @description WAI-ARIA 1.2 compliant tab roving focus, keyboard navigation, and live screen-reader announcer.
 */

/**
 * Announces a message to screen readers via an aria-live polite region.
 * @param {string} message - Message text
 */
export function announceToScreenReader(message) {
  let liveRegion = document.getElementById('sr-announcer');
  if (!liveRegion) {
    liveRegion = document.createElement('div');
    liveRegion.id = 'sr-announcer';
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.className = 'sr-only';
    document.body.appendChild(liveRegion);
  }
  // Clear and update to ensure screen readers announce duplicate strings
  liveRegion.textContent = '';
  setTimeout(() => {
    liveRegion.textContent = message;
  }, 50);
}

/**
 * Initializes roving tabindex keyboard navigation across a WAI-ARIA tablist.
 * @param {HTMLElement} tablistElement - Container element with role="tablist"
 * @param {Array<HTMLElement>} tabs - Array of tab button elements
 * @param {Array<HTMLElement>} panels - Array of corresponding tabpanel elements
 * @param {(index: number) => void} onTabSelect - Callback on selection
 */
export function setupAriaTabs(tablistElement, tabs, panels, onTabSelect) {
  if (!tablistElement || tabs.length === 0) return;

  function activateTab(index) {
    tabs.forEach((tab, i) => {
      const isSelected = i === index;
      tab.setAttribute('aria-selected', String(isSelected));
      tab.setAttribute('tabindex', isSelected ? '0' : '-1');
      if (panels[i]) {
        panels[i].hidden = !isSelected;
      }
    });
    tabs[index].focus();
    if (typeof onTabSelect === 'function') {
      onTabSelect(index);
    }
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activateTab(index));

    tab.addEventListener('keydown', (e) => {
      let nextIndex = index;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        nextIndex = (index + 1) % tabs.length;
        activateTab(nextIndex);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        nextIndex = (index - 1 + tabs.length) % tabs.length;
        activateTab(nextIndex);
      } else if (e.key === 'Home') {
        e.preventDefault();
        activateTab(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        activateTab(tabs.length - 1);
      }
    });
  });
}

/**
 * Handles skip-to-content focus management.
 * @param {string} targetId - ID of main content container
 */
export function initSkipLink(targetId) {
  const skipLink = document.querySelector('.skip-link');
  if (!skipLink) return;

  skipLink.addEventListener('click', (e) => {
    e.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      target.setAttribute('tabindex', '-1');
      target.focus();
    }
  });
}
