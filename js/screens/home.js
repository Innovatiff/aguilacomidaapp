/**
 * Home — "is my food coming today, and what do I owe?"
 *
 * Those are the only two questions anyone opens this app to answer, so they are
 * the only two things above the fold. Everything else is one tap away.
 */

import { h } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { screen, topbarButton } from '../ui/shell.js';
import {
  card, button, badge, alert, meter, statGrid, stat, sectionLabel, skeletonRows,
} from '../ui/kit.js';
import { balanceHeadline } from '../ui/balance.js';
import { go } from '../lib/router.js';
import {
  store, subscribe, billing, currentPeriod, periodEstimate, deliveredThisPeriod,
  fortnightPrice, isPaused, isReady,
} from '../data/store.js';
import { timeline } from '../data/deliveries.js';
import { deliveryMeta } from '../lib/model.js';
import {
  greeting, formatDayLong, today, formatTime, humanDelta, formatDay, formatRange, relativeDay,
} from '../lib/dates.js';
import { money, plural, number } from '../lib/format.js';

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
  return h('div.page__inner.stack.stack-4',
    isPaused() ? pausedNotice() : null,
    trackingCard(),
    paymentCard(),
    fortnightCard(),
    h('div.stack.stack-2',
      button('Escribir a la cocina', { variant: 'dark', block: true, icon: 'chat', onClick: () => go('/chat') }),
      button('Ver mis entregas', { variant: 'ghost', block: true, icon: 'truck', onClick: () => go('/deliveries') })));
}

const pausedNotice = () => alert(
  'Tu servicio está en pausa. Escríbenos si quieres reanudar las entregas.',
  'warn', 'pause');

/* --- Today ------------------------------------------------------------------ */

function trackingCard() {
  const delivery = store.todayDelivery;

  if (!delivery) {
    return card(h('div.stack.stack-3',
      h('div.row.row--between',
        h('div.card__title', 'Hoy'),
        badge('Sin programar', 'muted')),
      h('p.t-sm.c-soft', servesToday()
        ? 'Todavía no se programa la entrega de hoy. En cuanto la cocina la registre, la verás aquí en vivo.'
        : 'Hoy no toca servicio según tu calendario. La próxima entrega será el ' + nextServiceLabel() + '.')));
  }

  const meta = deliveryMeta(delivery.status);
  const off = delivery.status === 'skipped' || delivery.status === 'issue';

  return h('div.stack.stack-3',
    h('div.hero',
      h('div.hero__eyebrow', 'Entrega de hoy'),
      h('div.hero__title', meta.clientText),
      h('p.hero__note',
        [
          plural(delivery.meals, 'comida', 'comidas'),
          delivery.window,
          delivery.locationName || store.client?.locationName,
        ].filter(Boolean).join(' · ')),
      delivery.status === 'delivered'
        ? h('div', { style: { marginTop: '14px' } }, meter(100, { tone: 'ok', large: true }))
        : null),

    card(h('div.stack.stack-3',
      h('div.row.row--between',
        h('div.card__title', 'Seguimiento'),
        badge(meta.label, meta.tone, meta.icon)),

      off
        ? alert(
            delivery.status === 'issue'
              ? (delivery.notes || 'Hubo un problema con la entrega de hoy. La cocina te contactará.')
              : 'Hoy no hay servicio programado.',
            delivery.status === 'issue' ? 'bad' : 'warn')
        : trackingSteps(delivery),

      delivery.driver && !off
        ? h('div.row.t-sm.c-soft',
            h('span', { style: { color: 'var(--ink-400)' } }, icon('truck')),
            h('span', `Lleva tu entrega: ${delivery.driver}`))
        : null,

      off || delivery.status === 'delivered'
        ? button('Avisar un problema', {
            variant: 'ghost', size: 'sm', block: true, icon: 'chat',
            onClick: () => go('/chat'),
          })
        : null)));
}

/** The four-step delivery timeline, with times where they are known. */
function trackingSteps(delivery) {
  const steps = timeline(delivery);

  return h('div.track',
    steps.map((step) => {
      const meta = deliveryMeta(step.status);
      const cls = step.done ? '.is-done' : step.current ? '.is-current' : '';
      return h(`div.track__step${cls}`,
        h('div.track__mark', icon(step.done ? 'check' : meta.icon)),
        h('div.grow',
          h('div.track__label', meta.label),
          h('div.track__time',
            step.at ? formatTime(step.at)
              : step.current ? 'En curso'
                : step.done ? '' : 'Pendiente')));
    }));
}

/* --- Money ------------------------------------------------------------------ */

function paymentCard() {
  const summary = billing();
  if (!summary) return null;

  const owes = summary.balance > 0;
  const days = summary.daysToDue;

  return h('div.stack.stack-3',
    sectionLabel('Tu pago'),
    card(h('div.stack.stack-4',
      balanceHeadline(summary),

      owes
        ? alert(
            summary.daysToDue < 0
              ? `Venció ${humanDelta(days)} — ${formatDay(summary.dueDate)}.`
              : `Vence ${humanDelta(days)} — ${formatDay(summary.dueDate)}.`,
            summary.status === 'overdue' ? 'bad' : days <= 2 ? 'warn' : 'info')
        : alert('Estás al corriente con la cocina. Gracias.', 'ok'),

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
  const estimate = periodEstimate();
  if (!period || !estimate) return null;

  const delivered = deliveredThisPeriod();
  const meals = delivered.reduce((sum, row) => sum + (Number(row.meals) || 0), 0);

  return h('div.stack.stack-3',
    sectionLabel(`Quincena en curso · ${formatRange(period.start, period.end)}`),
    statGrid([
      stat({
        label: 'Días entregados',
        value: number(delivered.length),
        foot: `de ${estimate.days} programados`,
      }),
      stat({
        label: 'Esta quincena',
        value: fortnightPrice() ? money(fortnightPrice(), { round: true }) : '—',
        foot: `${number(meals)} comidas hasta hoy`,
      }),
    ]));
}

/* --- Helpers ----------------------------------------------------------------- */

const servesToday = () =>
  store.client?.status === 'active' && (store.client?.deliveryDays || []).includes(new Date().getDay());

/** The next weekday this person is served, phrased for a person. */
function nextServiceLabel() {
  const days = store.client?.deliveryDays || [];
  if (!days.length) return 'próximo día de servicio';
  for (let i = 1; i <= 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    if (days.includes(date.getDay())) {
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      return relativeDay(key).toLowerCase();
    }
  }
  return 'próximo día de servicio';
}
