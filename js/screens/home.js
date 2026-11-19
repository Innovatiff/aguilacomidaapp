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
  store, subscribe, billing, currentPeriod, periodPrice, isPaused, isReady, paidUpTo, lateStart,
} from '../data/store.js';
import { latest } from '../data/receipts.js';
import { mealsOn, extrasOf } from '../lib/pricing.js';
import {
  greeting, formatDayLong, today, humanDelta, formatDay, formatRange,
  weekdayName, capitalize, WEEKDAYS_SHORT,
} from '../lib/dates.js';
import { payDayAfter, periodWord } from '../lib/billing.js';
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
    periodCard(),
    lastPaymentCard(),
    h('div.span-all.stack.stack-2',
      button('Escribir a la cocina', { variant: 'dark', block: true, icon: 'chat', onClick: () => go('/chat') }),
      button('Ver mis pagos', { variant: 'ghost', block: true, icon: 'wallet', onClick: () => go('/billing') })));
}

// Registered ahead by the kitchen: not on pause, just not started yet.
const pausedNotice = () => (store.client?.startsOn > today()
  ? alert(`Empiezas el ${formatDayLong(store.client.startsOn)}. Ese día te llega tu primera comida.`,
    'info', 'calendar')
  : alert('Tu servicio está en pausa. Escríbenos si quieres reanudar tus comidas.', 'warn', 'pause'));

/* --- Money ------------------------------------------------------------------ */

function paymentCard() {
  // Bills that could not be read are not a balance of nothing.
  if (store.invoicesFailed) {
    return h('div.stack.stack-3',
      sectionLabel('Tu cuenta'),
      alert('No pudimos leer tus pagos ahora. Revisa tu internet y vuelve a abrir la app.', 'warn'));
  }
  const summary = billing();
  if (!summary) return null;

  const owes = summary.balance > 0;
  const days = summary.daysToDue;

  return h('div.stack.stack-3',
    sectionLabel('Tu cuenta'),
    card(h('div.stack.stack-4',
      balanceHeadline(summary),

      owes
        // A bill saved long ago can carry no deadline: said without a date.
        ? (summary.hasDeadline
            ? alert(
                summary.daysToDue < 0
                  ? `Venció ${humanDelta(days)} — ${formatDay(summary.dueDate)}.`
                  : `Vence ${humanDelta(days)} — ${formatDay(summary.dueDate)}.`,
                summary.status === 'overdue' ? 'bad' : days <= 2 ? 'warn' : 'info')
            : alert('Tienes un saldo pendiente con la cocina.', 'info'))
        : alert(paidUpTo()
          ? `Estás al corriente: pagaste hasta el ${formatDay(paidUpTo())}. Gracias.`
          : 'Estás al corriente con la cocina. Gracias.', 'ok'),

      h('div.btn-group',
        button('Pedir datos de pago', {
          variant: owes ? 'primary' : 'ghost', size: 'sm', icon: 'chat',
          onClick: () => go('/chat?ask=payment'),
        }),
        button('Ver detalle', { variant: 'ghost', size: 'sm', icon: 'receipt', onClick: () => go('/billing') })))));
}

/* --- The running fortnight --------------------------------------------------- */

function periodCard() {
  const period = currentPeriod();
  const client = store.client;
  if (!period || !client) return null;

  const price = periodPrice();
  const order = [1, 2, 3, 4, 5, 6, 0];
  const extras = extrasOf(client);
  const word = periodWord(client);
  // Somebody who started with this one already under way does not pay it:
  // what they are shown is the first one they do, with its own pay day.
  const late = lateStart();
  const shown = late ? late.first : period;
  const payDay = payDayAfter(shown);

  return h('div.stack.stack-3',
    sectionLabel(late
      ? (word === 'semana' ? 'Mi primera semana de pago' : 'Mi primera quincena')
      : (word === 'semana' ? 'Mi semana de pago' : 'Mi quincena')),
    card(h('div.stack.stack-3',
      h('div.row.row--between',
        h('span.t-sm.c-soft', formatRange(shown.start, shown.end)),
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
        // The one date they need: not the bill's grace deadline, the day they
        // turn up with the money.
        defRow(late ? 'Primer pago' : 'Próximo pago',
          `${capitalize(weekdayName(payDay))} ${formatDay(payDay)}`),
      ].filter(Boolean)),

      // Paid for once eaten, never before — the way the kitchen has always
      // worked, said in the one place a client looks for it.
      late
        ? alert(firstWords(late, word, payDay), 'info')
        : alert(`Esta ${word} se paga cuando termina, el `
          + `${weekdayName(payDay)} ${formatDay(payDay)}: siempre pagas `
          + 'lo que ya comiste, nunca por adelantado. En la cocina te dan tu recibo al momento.',
        'info'))));
}

/** What somebody in their first days — or about to start — is told about paying. */
function firstWords(late, word, payDay) {
  const when = `se paga cuando termina, el ${weekdayName(payDay)} ${formatDay(payDay)}`;
  const began = `${late.upcoming ? 'Empiezas' : 'Empezaste'} el ${formatDay(late.since)}`;
  if (!late.partial) return `${began}. Tu primera ${word} es esta: ${when}.`;
  return `${began}, con la ${word} ya empezada. Tu primera ${word} completa es esta: ${when}. `
    + 'Por tus primeros días, la cocina te dice si hay algo que pagar.';
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
        // A receipt from long ago can have no date: then just its folio.
        h('div.t-sm.c-soft',
          [last.date ? formatDayLong(last.date) : '', last.folio || ''].filter(Boolean).join(' · '))),
      button('Ver recibo', {
        variant: 'ghost', size: 'sm', onClick: () => go('/billing'),
      }))));
}
