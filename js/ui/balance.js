/**
 * The payment countdown, shared by Inicio and Pagos.
 *
 * The ring reads as "how much time is left". An overdue balance therefore
 * fills the ring completely in red rather than emptying it — an empty ring
 * looks like missing data, which is the opposite of the message.
 */

import { h } from '../lib/dom.js';
import { ring, badge } from './kit.js';
import { PERIOD_DAYS, STATUS_LABEL, STATUS_TONE } from '../lib/billing.js';
import { money } from '../lib/format.js';

/** Tone for a balance: none while there is comfortable time left. */
export function dueTone(summary) {
  if (!summary || summary.balance <= 0) return 'ok';
  if (summary.status === 'overdue') return 'bad';
  return summary.daysToDue <= 2 ? 'warn' : null;
}

export function dueRing(summary) {
  const owes = summary.balance > 0;
  const days = summary.daysToDue;
  const late = days < 0;
  // A weekly client's ring is a week wide. Drawing seven days against a
  // fourteen-day dial would show them half full on the day they pay.
  const span = Number(summary.currentPeriod?.every) || PERIOD_DAYS;

  return ring({
    // Overdue fills the ring; otherwise it drains as the deadline approaches.
    value: !owes || late ? span : Math.min(span, Math.max(0, days)),
    max: span,
    top: owes ? String(Math.abs(days)) : '✓',
    bottom: !owes
      ? 'al día'
      : late
        ? (Math.abs(days) === 1 ? 'día tarde' : 'días tarde')
        : (days === 1 ? 'día' : 'días'),
    tone: dueTone(summary) || undefined,
  });
}

/** Ring + amount + status pill — the top half of both balance cards. */
export function balanceHeadline(summary) {
  const owes = summary.balance > 0;
  const colour = owes
    ? (summary.status === 'overdue' ? 'var(--bad-600)' : 'var(--ink-900)')
    : 'var(--ok-600)';

  return h('div.row',
    dueRing(summary),
    h('div.grow',
      h('div.t-xs.upper.c-faint.w-700', owes ? 'Saldo pendiente' : 'Sin adeudo'),
      h('div.t-2xl.w-700', { style: { color: colour } }, money(summary.balance)),
      h('div', { style: { marginTop: '6px' } },
        badge(STATUS_LABEL[summary.status] || 'Al corriente', STATUS_TONE[summary.status] || 'ok'))));
}
