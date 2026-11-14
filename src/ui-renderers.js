/**
 * @file src/ui-renderers.js
 * @description Pure DOM node builders using DocumentFragment and createElement (ZERO unsafe HTML injection).
 */

import { createSafeElement } from './security.js';

/**
 * Renders the verified telemetry table with EEA physics badges via DocumentFragment.
 * @param {HTMLElement} container - Table container element
 * @param {Array<any>} rows - Processed telemetry rows
 * @param {(rowIndex: number) => void} [onRowClick] - Click handler
 */
export function renderTelemetryTable(container, rows, onRowClick) {
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  if (!rows || rows.length === 0) {
    const emptyNotice = createSafeElement('div', { class: 'empty-notice' }, ['No valid telemetry records loaded.']);
    container.appendChild(emptyNotice);
    return;
  }

  const table = createSafeElement('table', { class: 'data-table', 'aria-label': 'Verified Civic Sensor Telemetry' });
  const thead = createSafeElement('thead', {}, [
    createSafeElement('tr', {}, [
      createSafeElement('th', { scope: 'col' }, ['Row']),
      createSafeElement('th', { scope: 'col' }, ['Location / Ward']),
      createSafeElement('th', { scope: 'col' }, ['PM2.5 (µg/m³)']),
      createSafeElement('th', { scope: 'col' }, ['PM10']),
      createSafeElement('th', { scope: 'col' }, ['AQI']),
      createSafeElement('th', { scope: 'col' }, ['EEA Physics & Reliability Badges'])
    ])
  ]);

  const tbody = createSafeElement('tbody');
  if (typeof onRowClick === 'function') {
    tbody.addEventListener('click', (e) => {
      const tr = e.target.closest('.telemetry-data-row');
      if (tr && tr.dataset.rowIndex) {
        onRowClick(parseInt(tr.dataset.rowIndex, 10));
      }
    });
    tbody.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const tr = e.target.closest('.telemetry-data-row');
        if (tr && tr.dataset.rowIndex) {
          e.preventDefault();
          onRowClick(parseInt(tr.dataset.rowIndex, 10));
        }
      }
    });
  }

  const frag = document.createDocumentFragment();

  rows.forEach((row) => {
    const tr = createSafeElement('tr', {
      id: `telemetry-row-${row.rowIndex}`,
      class: 'telemetry-data-row',
      'data-row-index': String(row.rowIndex),
      tabindex: '0'
    });

    const tdRow = createSafeElement('td', { class: 'font-mono' }, [String(row.rowIndex)]);
    const tdLoc = createSafeElement('td', { class: 'font-semibold' }, [row.location]);
    const tdPm25 = createSafeElement('td', { class: 'font-mono' }, [row.pm25 !== null ? String(row.pm25) : 'MISSING']);
    const tdPm10 = createSafeElement('td', { class: 'font-mono' }, [row.pm10 !== null ? String(row.pm10) : 'N/A']);

    const aqiPill = createSafeElement(
      'span',
      { class: 'aqi-pill', style: `background-color: ${row.color}22; color: ${row.color}; border: 1px solid ${row.color}66;` },
      [`${row.aqi} • ${row.category}`]
    );
    const tdAqi = createSafeElement('td', {}, [aqiPill]);

    const flagsContainer = createSafeElement('div', { class: 'flags-cluster' });
    row.flags.forEach((flag) => {
      let badgeClass = 'badge-info';
      if (flag.includes('Bias') || flag.includes('Drift')) badgeClass = 'badge-warning';
      if (flag.includes('Gap') || flag.includes('Outlier')) badgeClass = 'badge-danger';
      const badge = createSafeElement('span', { class: `badge ${badgeClass}` }, [flag]);
      flagsContainer.appendChild(badge);
    });
    const tdFlags = createSafeElement('td', {}, [flagsContainer]);

    tr.appendChild(tdRow);
    tr.appendChild(tdLoc);
    tr.appendChild(tdPm25);
    tr.appendChild(tdPm10);
    tr.appendChild(tdAqi);
    tr.appendChild(tdFlags);
    frag.appendChild(tr);
  });

  tbody.appendChild(frag);
  table.appendChild(thead);
  table.appendChild(tbody);
  container.appendChild(table);
}

/**
 * Renders the delta comparison matrix comparing current and previous shift data.
 * @param {HTMLElement} container - Delta grid container
 * @param {Array<any>} deltas - Delta objects
 */
export function renderDeltaMatrix(container, deltas) {
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  if (!deltas || deltas.length === 0) {
    container.appendChild(createSafeElement('p', { class: 'text-muted' }, ['No prior shift baseline active for comparison.']));
    return;
  }

  const grid = createSafeElement('div', { class: 'delta-grid' });
  const frag = document.createDocumentFragment();

  deltas.forEach((d) => {
    let statusClass = 'delta-stable';
    if (d.status.includes('Deteriorating') || d.status.includes('New Hotspot')) {
      statusClass = 'delta-worsening';
    } else if (d.status.includes('Improving')) {
      statusClass = 'delta-improving';
    }

    const card = createSafeElement('div', { class: `delta-card ${statusClass}` }, [
      createSafeElement('div', { class: 'delta-header' }, [
        createSafeElement('span', { class: 'font-semibold' }, [d.location]),
        createSafeElement('span', { class: 'delta-status-pill' }, [d.status])
      ]),
      createSafeElement('div', { class: 'delta-body' }, [
        createSafeElement('div', { class: 'metric' }, [
          createSafeElement('span', { class: 'metric-label' }, ['Previous']),
          createSafeElement('span', { class: 'metric-val' }, [String(d.prevAQI || '—')])
        ]),
        createSafeElement('div', { class: 'metric-arrow' }, ['→']),
        createSafeElement('div', { class: 'metric' }, [
          createSafeElement('span', { class: 'metric-label' }, ['Current']),
          createSafeElement('span', { class: 'metric-val font-bold' }, [String(d.currentAQI)])
        ]),
        createSafeElement('div', { class: 'delta-shift' }, [
          createSafeElement('span', { class: 'shift-tag' }, [`${d.delta >= 0 ? '+' : ''}${d.delta} (${d.pct}%)`])
        ])
      ])
    ]);
    frag.appendChild(card);
  });

  grid.appendChild(frag);
  container.appendChild(grid);
}

/**
 * Renders prioritized operational action cards (P0, P1, P2) with clickable citation chips.
 * @param {HTMLElement} container - Target container
 * @param {Array<any>} actions - Action items
 * @param {(rowIndex: number) => void} [onCitationClick] - Citation click handler
 */
export function renderPriorityActionCards(container, actions, onCitationClick) {
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  if (typeof onCitationClick === 'function' && !container.dataset.hasDelegatedCitation) {
    container.dataset.hasDelegatedCitation = 'true';
    container.addEventListener('click', (e) => {
      const chip = e.target.closest('.citation-chip');
      if (chip && chip.dataset.rowIndex) {
        onCitationClick(parseInt(chip.dataset.rowIndex, 10));
      }
    });
  }

  const frag = document.createDocumentFragment();
  actions.forEach((a) => {
    const card = createSafeElement('div', { class: `action-card action-${a.priority.toLowerCase()}` });
    const header = createSafeElement('div', { class: 'action-card-header' }, [
      createSafeElement('span', { class: `priority-tag priority-${a.priority.toLowerCase()}` }, [a.priority]),
      createSafeElement('span', { class: 'timeframe-tag' }, [a.timeframe])
    ]);
    const body = createSafeElement('p', { class: 'action-text' }, [a.action]);

    const match = a.citation ? a.citation.match(/Row\s*#(\d+)/i) : null;
    const rowIdx = match ? match[1] : '1';
    const citationChip = createSafeElement('button', {
      type: 'button',
      class: 'citation-chip',
      'data-row-index': rowIdx,
      'aria-label': `View source evidence ${a.citation}`
    }, [a.citation]);

    const impact = createSafeElement('p', { class: 'action-impact' }, [
      createSafeElement('strong', {}, ['Projected Impact: ']),
      a.impact
    ]);

    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(citationChip);
    card.appendChild(impact);
    frag.appendChild(card);
  });

  container.appendChild(frag);
}

/**
 * Renders citizen public advisory guidance with vulnerable group cards.
 * @param {HTMLElement} container - Target element
 * @param {{ headline: string, advisory: string, vulnerableGuidance: Array<string> }} data
 */
export function renderCitizenAdvisory(container, data) {
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  const wrapper = createSafeElement('div', { class: 'citizen-bulletin-wrapper' });
  const title = createSafeElement('h3', { class: 'citizen-headline' }, [data.headline || 'Community Air Advisory']);
  const intro = createSafeElement('p', { class: 'citizen-advisory-p' }, [data.advisory || '']);

  const list = createSafeElement('ul', { class: 'citizen-guidelines-list' });
  (data.vulnerableGuidance || []).forEach((item) => {
    const li = createSafeElement('li', { class: 'citizen-guideline-item' }, [item]);
    list.appendChild(li);
  });

  const helpline = createSafeElement('div', { class: 'civic-helpline-box' }, [
    createSafeElement('strong', {}, ['Emergency Civic Health Helpline: ']),
    'Dial 1916 for Rapid Medical or Smog Response'
  ]);

  wrapper.appendChild(title);
  wrapper.appendChild(intro);
  wrapper.appendChild(list);
  wrapper.appendChild(helpline);
  container.appendChild(wrapper);
}
