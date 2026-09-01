/**
 * Pagos — what is owed, by when, and every receipt already issued.
 *
 * Nobody can change any of it here; the point is that they can see it without
 * calling the kitchen, which is the phone call this whole product exists to
 * stop having. The receipts matter most: people pay cash at the store and walk
 * out with nothing in their hand, so the folio on this screen is the proof.
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
import {
  store, subscribe, billing, currentPeriod, periodEstimate, periodPrice,
} from '../data/store.js';
import { outstanding, balanceOf, invoiceStatus } from '../data/invoices.js';
import { totalPaid, cancelledIds } from '../data/receipts.js';
import { sheet } from '../ui/overlay.js';
import {
  STATUS_LABEL, STATUS_TONE, isCharge, invoiceTitle, appliedTitle, periodWord,
} from '../lib/billing.js';
import { paymentMethodMeta } from '../lib/model.js';
import { formatRange, formatDay, formatDayLong, formatStamp, humanDelta, today, daysBetween } from '../lib/dates.js';
import { money, moneyFull, number, percent, plural } from '../lib/format.js';
import { toDate } from '../firebase.js';

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
  const receipts = store.receipts || [];

  return h('div.page__inner.page__inner--flow.stack.stack-4',
    balanceCard(summary),
    runningPeriodCard(),

    due.length ? sectionLabel('Por pagar') : null,
    due.length ? list(due.map(invoiceRow), { card: true }) : null,

    sectionLabel('Mis recibos', receipts.length
      ? h('span.t-sm.c-soft', `${money(totalPaid(receipts), { round: true })} pagados`)
      : null),
    receipts.length
      ? list(receipts.slice(0, 20).map(
          (row) => receiptRow(row, cancelledIds(receipts).has(row.id))), { card: true })
      : card(h('p.t-sm.c-soft.center',
          'Todavía no hay pagos. Cuando pagues en la cocina, tu recibo aparece aquí solo.')),

    h('p.t-xs.c-faint.center', { style: { marginTop: '8px' } },
      'Los montos los registra la cocina. Si algo no coincide, escríbenos.'));
}

/* --- Balance ----------------------------------------------------------------- */

/** How far the kitchen has this person paid up, when it is worth saying. */
function paidUpTo() {
  const through = store.client?.paidThrough;
  return through && through >= today() ? through : null;
}

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
      : alert(paidUpTo()
        ? `Estás al corriente. Tienes pagado hasta el ${formatDay(paidUpTo())}.`
        : 'Estás al corriente con la cocina. Gracias.', 'ok'),

    button('Pedir los datos de pago', {
      variant: owes ? 'primary' : 'ghost', block: true, icon: 'chat',
      onClick: () => go('/chat?ask=payment'),
    })));
}

/* --- The running period ------------------------------------------------------- */

function runningPeriodCard() {
  const period = currentPeriod();
  const estimate = periodEstimate();
  if (!period || !estimate) return null;

  const span = period.every;
  const elapsed = Math.max(0, Math.min(span, daysBetween(period.start, today()) + 1));
  const word = periodWord(store.client);

  return h('div.stack.stack-3',
    sectionLabel(`${word === 'semana' ? 'Semana' : 'Quincena'} en curso`),
    card(h('div.stack.stack-3',
      h('div.row.row--between',
        h('span.t-sm.c-soft', formatRange(period.start, period.end)),
        h('span.w-700', money(estimate.amount, { round: true }))),
      meter(percent(elapsed, span)),
      h('div.t-xs.c-faint',
        `${plural(store.client?.mealsPerDay || 0, 'comida', 'comidas')} al día · `
        + `${estimate.days} días de servicio · ${number(estimate.meals)} comidas`),
      periodPrice()
        ? alert(`Es el precio de tu plan por ${word} completa. Puedes pagarlo antes, durante o `
          + 'después — en la cocina te dan tu recibo al momento.', 'info')
        : alert(`Pregúntanos el precio de tu ${word}.`, 'info'))));
}

/* --- Rows --------------------------------------------------------------------- */

function invoiceRow(invoice) {
  const status = invoice.uiStatus || invoiceStatus(invoice, today());
  return itemRow({
    title: invoiceTitle(invoice),
    meta: `${status === 'overdue' ? 'Venció' : 'Vence'} ${formatDay(invoice.dueDate)} · ${moneyFull(invoice.amount)}`
      + `${isCharge(invoice) ? ' · cargo' : ''}`,
    end: [
      h('span.w-700', money(balanceOf(invoice), { round: true })),
      badge(STATUS_LABEL[status], STATUS_TONE[status]),
    ],
    onClick: () => openInvoice(invoice),
  });
}

/**
 * `wasCancelled` is the payment the kitchen took back off the account.
 *
 * It has to keep showing — it is this person's own record and it did happen —
 * but it must say so on its face. A row that still reads "Pago recibido" for
 * money that no longer counts is the screen somebody holds up at the counter.
 */
function receiptRow(receipt, wasCancelled = false) {
  const meta = paymentMethodMeta(receipt.method);
  const reversal = Number(receipt.amount) < 0;
  const dead = reversal || wasCancelled;

  return itemRow({
    lead: h('div.avatar.avatar--sm', {
      style: dead
        ? { background: 'var(--bad-50)', color: 'var(--bad-600)' }
        : { background: 'var(--ok-50)', color: 'var(--ok-600)' },
    }, icon(dead ? 'refresh' : meta.icon)),
    title: h(`span${wasCancelled ? '.is-void' : ''}`, money(receipt.amount)),
    meta: [receipt.folio, meta.label, receipt.date ? formatDay(receipt.date) : null]
      .filter(Boolean).join(' · '),
    end: dead ? badge('Cancelado', 'bad') : null,
    onClick: () => openReceipt(receipt, wasCancelled),
  });
}

/**
 * The receipt itself.
 *
 * Shown as it would be on paper — amount, folio, what it covered — because
 * that is what somebody opens when they are asked "did you pay?".
 */
function openReceipt(receipt, wasCancelled = false) {
  const reversal = Number(receipt.amount) < 0;
  const dead = reversal || wasCancelled;

  return sheet({
    title: receipt.folio || 'Recibo',
    build: () => h('div.stack.stack-4',
      h('div.receipt', { class: dead ? 'is-void' : '' },
        h('div.receipt__mark', icon(dead ? 'refresh' : 'check')),
        h('div.receipt__amount', money(Math.abs(receipt.amount))),
        h('div.receipt__what', reversal
          ? 'Pago cancelado'
          : wasCancelled ? 'Este pago fue cancelado' : 'Pago recibido'),
        h('div.receipt__folio', receipt.folio || '')),

      wasCancelled
        ? alert('La cocina canceló este pago. El monto volvió a tu saldo; abajo está el '
          + 'recibo de la cancelación. Si no sabes por qué, escríbenos.', 'bad')
        : null,

      card(defList([
        defRow('Forma de pago', paymentMethodMeta(receipt.method).label),
        receipt.reference ? defRow('Referencia', receipt.reference) : null,
        defRow('Fecha', formatDayLong(receipt.date)),
        receipt.takenByName ? defRow('Recibió', receipt.takenByName) : null,
        receipt.at ? defRow('Registrado', formatStamp(toDate(receipt.at))) : null,
      ].filter(Boolean))),

      (receipt.applied || []).length
        ? h('div.stack.stack-2',
            h('div.section-label', { style: { padding: '4px 0' } }, 'Qué cubre'),
            list((receipt.applied || []).map((row) => itemRow({
              title: appliedTitle(row),
              meta: row.kind === 'charge' ? 'Cargo' : 'Periodo de comida',
              end: h('span.w-700', money(row.amount)),
              chevron: false,
            })), { card: true }))
        : null,

      // Only true while the payment still stands. Saying "quedaste al
      // corriente" under a cancelled receipt would be the most misleading line
      // on the screen.
      dead
        ? null
        : alert((receipt.balanceAfter || 0) > 0.005
          ? `Después de este pago quedaban ${money(receipt.balanceAfter)} pendientes.`
          : 'Con este pago quedaste al corriente.',
        (receipt.balanceAfter || 0) > 0.005 ? 'warn' : 'ok'),

      button('Preguntar sobre este recibo', {
        variant: 'ghost', block: true, icon: 'chat',
        onClick: () => go('/chat?ask=payment'),
      })),
  });
}

/* --- Invoice detail ------------------------------------------------------------ */

function openInvoice(invoice) {
  const status = invoice.uiStatus || invoiceStatus(invoice, today());
  const balance = balanceOf(invoice);

  return sheet({
    title: invoiceTitle(invoice),
    build: () => h('div.stack.stack-4',
      h('div.row.row--between',
        h('div',
          h('div.t-xs.upper.c-faint.w-700', balance > 0 ? 'Saldo pendiente' : 'Pagado'),
          h('div.t-2xl.w-700', money(balance > 0 ? balance : invoice.amount))),
        badge(STATUS_LABEL[status], STATUS_TONE[status])),

      meter(percent(Number(invoice.paid) || 0, Number(invoice.amount) || 0),
        { tone: balance <= 0 ? 'ok' : status === 'overdue' ? 'bad' : null }),

      // A cargo is not a fortnight of food: it says what it was for and when,
      // rather than a plan and a meal count that were never counted.
      card(defList(isCharge(invoice)
        ? [
            defRow('Concepto', invoice.reason || 'Cargo'),
            defRow('Fecha', formatDayLong(invoice.periodStart)),
            defRow('Total', moneyFull(invoice.amount)),
            defRow('Pagado', money(invoice.paid || 0)),
            defRow('Fecha límite', formatDayLong(invoice.dueDate)),
          ]
        : [
            defRow('Plan', invoice.mealsPerDay
              ? `${number(invoice.mealsPerDay)} ${invoice.mealsPerDay === 1 ? 'comida' : 'comidas'} al día`
              : '—'),
            defRow('Comidas entregadas', number(invoice.meals)),
            defRow(`Total de la ${periodWord(invoice)}`, moneyFull(invoice.amount)),
            defRow('Pagado', money(invoice.paid || 0)),
            defRow('Fecha límite', formatDayLong(invoice.dueDate)),
          ])),

      isCharge(invoice)
        ? alert(`Es un cargo aparte de tu ${periodWord(store.client)}. Si no lo reconoces, `
          + 'escríbenos y lo revisamos.', 'info')
        : null,

      (invoice.payments || []).length
        ? h('div.stack.stack-2',
            h('div.section-label', { style: { padding: '4px 0' } },
              isCharge(invoice) ? 'Pagos de este cargo' : 'Pagos de este periodo'),
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
