/**
 * Delivery history — the record the farm never had before.
 *
 * Grouped by fortnight so it lines up with what gets billed: a manager
 * checking an invoice can count the days that produced it.
 */

import { h } from '../lib/dom.js';
import { screen } from '../ui/shell.js';
import {
  card, badge, statGrid, stat, sectionLabel, list, itemRow, emptyState, skeletonRows, meter,
} from '../ui/kit.js';
import { store, subscribe, currentPeriod, periodEstimate } from '../data/store.js';
import { deliveryMeta } from '../lib/model.js';
import { periodByIndex, periodIndex } from '../lib/billing.js';
import { relativeDay, formatDay, formatRange, weekdayName, capitalize, today } from '../lib/dates.js';
import { plural, number, percent } from '../lib/format.js';

export function renderDeliveries() {
  const draw = () => screen({
    title: 'Mis entregas',
    subtitle: store.client?.name || '',
    tab: 'deliveries',
    sunken: true,
    body: store.loaded.history ? body() : skeletonRows(6),
  });

  return subscribe(draw);
}

function body() {
  if (!store.history.length) {
    return h('div.page__inner', emptyState({
      icon: 'truck',
      title: 'Todavía no hay entregas',
      text: 'Cuando la cocina registre tu primera entrega, aparecerá aquí con su estado en vivo.',
    }));
  }

  return h('div.page__inner.stack.stack-4',
    summaryCard(),
    groups().map(([period, rows]) => h('div.stack.stack-2',
      sectionLabel(formatRange(period.start, period.end)),
      list(rows.map(row), { card: true }))));
}

/** How the running fortnight is going. */
function summaryCard() {
  const period = currentPeriod();
  const estimate = periodEstimate();
  if (!period || !estimate) return null;

  const rows = store.history.filter((r) => r.date >= period.start && r.date <= period.end);
  const delivered = rows.filter((r) => r.status === 'delivered');
  const meals = delivered.reduce((sum, r) => sum + (Number(r.meals) || 0), 0);
  const done = percent(delivered.length, estimate.days);

  return card(h('div.stack.stack-3',
    h('div.row.row--between',
      h('div',
        h('div.t-xs.upper.c-faint.w-700', 'Quincena en curso'),
        h('div.t-xl.w-700', `${delivered.length} de ${estimate.days} días`)),
      h('div.t-2xl.w-700.c-brand', `${done}%`)),
    meter(done, { tone: done === 100 ? 'ok' : null, large: true }),
    statGrid([
      stat({ label: 'Comidas recibidas', value: number(meals) }),
      stat({ label: 'Por día', value: number(store.client?.mealsPerDay || 0) }),
    ])));
}

/** Rows grouped by the billing period they fall in, newest first. */
function groups() {
  const anchor = store.client?.cycleAnchor || today();
  const map = new Map();

  for (const row of store.history) {
    const index = periodIndex(anchor, row.date);
    if (!map.has(index)) map.set(index, []);
    map.get(index).push(row);
  }

  return [...map.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([index, rows]) => [periodByIndex(anchor, index), rows]);
}

function row(delivery) {
  const meta = deliveryMeta(delivery.status);
  return itemRow({
    title: `${capitalize(weekdayName(delivery.date))} ${formatDay(delivery.date)}`,
    meta: [
      plural(delivery.meals, 'comida', 'comidas'),
      delivery.date === today() ? 'Hoy' : relativeDay(delivery.date) === 'Ayer' ? 'Ayer' : null,
      delivery.notes || null,
    ].filter(Boolean).join(' · '),
    end: badge(meta.short, meta.tone),
    chevron: false,
  });
}
