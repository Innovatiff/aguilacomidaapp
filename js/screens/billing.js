/**
 * Pagos — what is owed, by when, and everything already paid.
 *
 * The farm cannot change any of it; the point is that they can see it without
 * calling the kitchen, which is the phone call this whole product exists to
 * stop having.
 */

import { h } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { screen } from '../ui/shell.js';
import {
  card, button, badge, alert, defList, defRow, sectionLabel, list, itemRow,
  skeletonRows, meter,
} from '../ui/kit.js';
import { balanceHeadline } from '../ui/balance.js';
import { go } from '../lib/router.js';
import { store, subscribe, billing, currentPeriod, periodEstimate } from '../data/store.js';
import { outstanding, paymentHistory, balanceOf, invoiceStatus } from '../data/invoices.js';
import { sheet } from '../ui/overlay.js';
import { STATUS_LABEL, STATUS_TONE, PERIOD_DAYS } from '../lib/billing.js';
import { paymentMethodMeta } from '../lib/model.js';
import { formatRange, formatDay, formatDayLong, humanDelta, today, daysBetween } from '../lib/dates.js';
import { money, moneyFull, number, percent } from '../lib/format.js';

export function renderBilling() {
  const draw = () => screen({
    title: 'Pagos',
    subtitle: store.client?.name || '',
    tab: 'billing',
    sunken: true,
    body: store.loaded.invoices ? body() : skeletonRows(5),
  });

  return subscribe(draw);
}

function body() {
  const summary = billing();
  const due = outstanding(store.invoices);
  const payments = paymentHistory(store.invoices);

  return h('div.page__inner.stack.stack-4',
    balanceCard(summary),
    runningPeriodCard(),

    due.length ? sectionLabel('Por pagar') : null,
    due.length ? list(due.map(invoiceRow), { card: true }) : null,

    sectionLabel('Historial de pagos'),
    payments.length
      ? list(payments.slice(0, 20).map(paymentRow), { card: true })
      : card(h('p.t-sm.c-soft.center', 'Todavía no hay pagos registrados.')),

    h('p.t-xs.c-faint.center', { style: { marginTop: '8px' } },
      'Los montos los registra la cocina. Si algo no coincide, escríbenos.'));
}

/* --- Balance ----------------------------------------------------------------- */

function balanceCard(summary) {
  if (!summary) return null;
  const owes = summary.balance > 0;
  const days = summary.daysToDue;

  return card(h('div.stack.stack-4',
    balanceHeadline(summary),

    owes
      ? alert(
          days < 0
            ? `Venció ${humanDelta(days)} — ${formatDayLong(summary.dueDate)}.`
            : `Vence ${humanDelta(days)} — ${formatDayLong(summary.dueDate)}.`,
          summary.status === 'overdue' ? 'bad' : days <= 2 ? 'warn' : 'info')
      : alert('Estás al corriente con la cocina. Gracias.', 'ok'),

    button('Pedir los datos de pago', {
      variant: owes ? 'primary' : 'ghost', block: true, icon: 'chat',
      onClick: () => go('/chat?ask=payment'),
    })));
}

/* --- The running fortnight ---------------------------------------------------- */

function runningPeriodCard() {
  const period = currentPeriod();
  const estimate = periodEstimate();
  if (!period || !estimate) return null;

  const elapsed = Math.max(0, Math.min(PERIOD_DAYS, daysBetween(period.start, today()) + 1));

  return h('div.stack.stack-3',
    sectionLabel('Quincena en curso'),
    card(h('div.stack.stack-3',
      h('div.row.row--between',
        h('span.t-sm.c-soft', formatRange(period.start, period.end)),
        h('span.w-700', money(estimate.amount, { round: true }))),
      meter(percent(elapsed, PERIOD_DAYS)),
      h('div.t-xs.c-faint',
        `${estimate.days} días de servicio · ${number(estimate.meals)} comidas estimadas a ${money(store.client?.pricePerMeal || 0)} cada una`),
      alert('Este es un estimado. La cocina cobra únicamente las comidas entregadas.', 'info'))));
}

/* --- Rows --------------------------------------------------------------------- */

function invoiceRow(invoice) {
  const status = invoice.uiStatus || invoiceStatus(invoice, today());
  return itemRow({
    title: formatRange(invoice.periodStart, invoice.periodEnd),
    meta: `${status === 'overdue' ? 'Venció' : 'Vence'} ${formatDay(invoice.dueDate)} · ${number(invoice.meals)} comidas`,
    end: [
      h('span.w-700', money(balanceOf(invoice), { round: true })),
      badge(STATUS_LABEL[status], STATUS_TONE[status]),
    ],
    onClick: () => openInvoice(invoice),
  });
}

function paymentRow(payment) {
  const meta = paymentMethodMeta(payment.method);
  return itemRow({
    lead: h('div.avatar.avatar--sm', { style: { background: 'var(--ok-50)', color: 'var(--ok-600)' } }, icon(meta.icon)),
    title: money(payment.amount),
    meta: [meta.label, payment.date ? formatDay(payment.date) : null].filter(Boolean).join(' · '),
    end: h('span.t-xs.c-faint', formatRange(payment.invoice.periodStart, payment.invoice.periodEnd)),
    chevron: false,
  });
}

/* --- Invoice detail ------------------------------------------------------------ */

function openInvoice(invoice) {
  const status = invoice.uiStatus || invoiceStatus(invoice, today());
  const balance = balanceOf(invoice);

  return sheet({
    title: formatRange(invoice.periodStart, invoice.periodEnd),
    build: () => h('div.stack.stack-4',
      h('div.row.row--between',
        h('div',
          h('div.t-xs.upper.c-faint.w-700', balance > 0 ? 'Saldo pendiente' : 'Pagado'),
          h('div.t-2xl.w-700', money(balance > 0 ? balance : invoice.amount))),
        badge(STATUS_LABEL[status], STATUS_TONE[status])),

      meter(percent(Number(invoice.paid) || 0, Number(invoice.amount) || 0),
        { tone: balance <= 0 ? 'ok' : status === 'overdue' ? 'bad' : null }),

      card(defList([
        defRow('Comidas entregadas', number(invoice.meals)),
        defRow('Precio por comida', money(invoice.pricePerMeal)),
        defRow('Total del periodo', moneyFull(invoice.amount)),
        defRow('Pagado', money(invoice.paid || 0)),
        defRow('Fecha límite', formatDayLong(invoice.dueDate)),
      ])),

      (invoice.payments || []).length
        ? h('div.stack.stack-2',
            h('div.section-label', { style: { padding: '4px 0' } }, 'Pagos de este periodo'),
            list((invoice.payments || []).map((payment) => itemRow({
              title: money(payment.amount),
              meta: [paymentMethodMeta(payment.method).label, payment.date ? formatDay(payment.date) : null]
                .filter(Boolean).join(' · '),
              end: payment.reference ? h('span.t-xs.c-faint', payment.reference) : null,
              chevron: false,
            })), { card: true }))
        : null,

      balance > 0
        ? button('Preguntar sobre este pago', {
            variant: 'primary', block: true, icon: 'chat',
            onClick: () => go('/chat?ask=payment'),
          })
        : null),
  });
}
