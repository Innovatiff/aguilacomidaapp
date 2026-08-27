/**
 * Home — "what do I owe, and by when?"
 *
 * That is the question this app exists to answer without a phone call, so it is
 * the first thing on the screen and the biggest. Under it: the fortnight in
 * progress and what it comes to, the last payment, and the way to ask the
 * kitchen anything else.
 */

import { h } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { screen, topbarButton } from '../ui/shell.js';
import { card, button, alert, sectionLabel, skeletonRows, defList, defRow } from '../ui/kit.js';
import { balanceHeadline } from '../ui/balance.js';
import { go } from '../lib/router.js';
import {
  store, subscribe, billing, currentPeriod, fortnightPrice, isPaused, isReady,
} from '../data/store.js';
import { latest } from '../data/receipts.js';
import { mealsOn, extrasOf } from '../lib/pricing.js';
import { greeting, formatDayLong, today, humanDelta, formatDay, formatRange, WEEKDAYS_SHORT } from '../lib/dates.js';
import { money, plural } from '../lib/format.js';

export function renderHome() {
  const draw = () => screen({
    title: greeting(),
    subtitle: store.client?.name || formatDayLong(today()),
    tab: 'home',
    actions: [topbarButton('settings', { label: 'Perfil', onClick: () => go('/profile') })],
    body: isReady() ? body() : skeletonRows(4),
  });

  return subscribe(draw);
}

function body() {
  return h('div.page__inner.page__inner--flow.stack.stack-4',
    isPaused() ? h('div.span-all', pausedNotice()) : null,
    paymentCard(),
    fortnightCard(),
    lastPaymentCard(),
    h('div.span-all.stack.stack-2',
      button('Escribir a la cocina', { variant: 'dark', block: true, icon: 'chat', onClick: () => go('/chat') }),
      button('Ver mis pagos', { variant: 'ghost', block: true, icon: 'wallet', onClick: () => go('/billing') })));
}

const pausedNotice = () => alert(
  'Tu servicio está en pausa. Escríbenos si quieres reanudar tus comidas.',
  'warn', 'pause');

/* --- Money ------------------------------------------------------------------ */

function paymentCard() {
  const summary = billing();
  if (!summary) return null;

  const owes = summary.balance > 0;
  const days = summary.daysToDue;

  return h('div.stack.stack-3',
    sectionLabel('Tu cuenta'),
    card(h('div.stack.stack-4',
      balanceHeadline(summary),

      owes
        ? alert(
            summary.daysToDue < 0
              ? `Venció ${humanDelta(days)} — ${formatDay(summary.dueDate)}.`
              : `Vence ${humanDelta(days)} — ${formatDay(summary.dueDate)}.`,
            summary.status === 'overdue' ? 'bad' : days <= 2 ? 'warn' : 'info')
        : alert(store.client?.paidThrough && store.client.paidThrough >= today()
          ? `Estás al corriente. Tienes pagado hasta el ${formatDay(store.client.paidThrough)}.`
          : 'Estás al corriente con la cocina. Gracias.', 'ok'),

      h('div.btn-group',
        button('Pedir datos de pago', {
          variant: owes ? 'primary' : 'ghost', size: 'sm', icon: 'chat',
          onClick: () => go('/chat?ask=payment'),
        }),
        button('Ver detalle', { variant: 'ghost', size: 'sm', icon: 'receipt', onClick: () => go('/billing') })))));
}

/* --- The running fortnight --------------------------------------------------- */

function fortnightCard() {
  const period = currentPeriod();
  const client = store.client;
  if (!period || !client) return null;

  const price = fortnightPrice();
  const order = [1, 2, 3, 4, 5, 6, 0];
  const extras = extrasOf(client);

  return h('div.stack.stack-3',
    sectionLabel('Mi quincena'),
    card(h('div.stack.stack-3',
      h('div.row.row--between',
        h('span.t-sm.c-soft', formatRange(period.start, period.end)),
        h('span.t-lg.w-700', price ? money(price) : '—')),

      h('div.weekstrip', order.map((weekday) => {
        const meals = mealsOn(client, weekday);
        const extra = Number(client.extras?.[String(weekday)]) || 0;
        return h(`div.weekstrip__day${meals ? '' : '.is-off'}${extra ? '.has-extra' : ''}`,
          h('div.weekstrip__n', meals || '—'),
          h('div.weekstrip__w', WEEKDAYS_SHORT[weekday]));
      })),

      defList([
        defRow('Mi plan', plural(client.mealsPerDay, 'comida al día', 'comidas al día')),
        extras.length
          ? defRow('Comidas extra',
              extras.map((entry) => `${WEEKDAYS_SHORT[entry.weekday]} +${entry.count}`).join(' · '))
          : null,
        defRow('Horario', client.deliveryWindow || '—'),
      ].filter(Boolean)),

      alert('Puedes pagar esta quincena antes, durante o después. En la cocina te dan tu recibo '
        + 'al momento.', 'info'))));
}

/* --- The last payment -------------------------------------------------------- */

function lastPaymentCard() {
  const last = latest(store.receipts);
  if (!last) return null;

  return h('div.stack.stack-3',
    sectionLabel('Tu último pago'),
    card(h('div.row',
      h('span', { style: { color: 'var(--ok-600)' } }, icon('check')),
      h('div.grow',
        h('div.t-lg.w-700', money(last.amount)),
        h('div.t-sm.c-soft', `${formatDayLong(last.date)} · ${last.folio || ''}`)),
      button('Ver recibo', {
        variant: 'ghost', size: 'sm', onClick: () => go('/billing'),
      }))));
}
