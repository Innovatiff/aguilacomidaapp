/**
 * One person's live data.
 *
 * One client, one set of listeners: their own record, today's stop, the recent
 * days, their invoices and their thread with the kitchen. Everything the
 * screens show is derived from these five, so the app never re-queries on
 * navigation and every screen agrees with every other one.
 */

import { watchClient } from './clients.js';
import { watchDay, watchHistory } from './deliveries.js';
import { watchInvoices } from './invoices.js';
import { watchReceipts } from './receipts.js';
import { watchConversation } from './chat.js';
import { today } from '../lib/dates.js';
import { summarize, periodFor, projectPeriod } from '../lib/billing.js';
import { watchPricing } from './pricing.js';
import { DEFAULT_TIERS, priceFor } from '../lib/pricing.js';

const state = {
  clientId: null,
  client: null,
  todayDelivery: null,
  history: [],
  invoices: [],
  receipts: [],
  // The price list, so the running fortnight can be quoted before it is billed.
  pricing: [...DEFAULT_TIERS],
  conversation: null,
  day: today(),
  loaded: { client: false, today: false, history: false, invoices: false },
  error: null,
};

const subscribers = new Set();
let stops = [];
let dayWatch = null;

export const store = state;

export function subscribe(fn) {
  subscribers.add(fn);
  fn(state);
  return () => subscribers.delete(fn);
}

const emit = () => { for (const fn of subscribers) fn(state); };
const onError = (error) => { state.error = error; emit(); };

/** Starts (or restarts) the listeners for one client. */
export function startStore(clientId) {
  if (state.clientId === clientId && stops.length) return;
  stopStore();
  state.clientId = clientId;
  state.day = today();
  state.error = null;

  stops = [
    watchClient(clientId, (row) => {
      state.client = row;
      state.loaded.client = true;
      emit();
    }, onError),

    watchToday(),

    watchHistory(clientId, 40, (rows) => {
      state.history = rows;
      state.loaded.history = true;
      emit();
    }, onError),

    watchInvoices(clientId, (rows) => {
      state.invoices = rows;
      state.loaded.invoices = true;
      emit();
    }, onError),

    watchReceipts(clientId, (rows) => {
      state.receipts = rows;
      emit();
    }, () => {}),

    // Not fatal if it fails: every issued invoice already carries its own
    // amount, and this only quotes the fortnight that has not been billed yet.
    watchPricing((tiers) => {
      state.pricing = tiers;
      emit();
    }, () => {}),

    watchConversation(clientId, (row) => {
      state.conversation = row;
      emit();
    }, () => {}),
  ];

  document.addEventListener('visibilitychange', checkDayRollover);
}

/**
 * Watches the delivery for whatever day it is *now*.
 *
 * Farms leave the app open. Without this the home screen would still be
 * tracking yesterday's delivery the next morning, which is exactly the
 * moment the screen matters most.
 */
function watchToday() {
  dayWatch?.();
  const day = state.day;
  dayWatch = watchDay(state.clientId, day, (row) => {
    if (state.day !== day) return;      // a stale response for a day we left
    state.todayDelivery = row;
    state.loaded.today = true;
    emit();
  }, onError);
  return () => dayWatch?.();
}

/** Rolls the tracked day over when the app comes back to the foreground. */
function checkDayRollover() {
  if (document.visibilityState !== 'visible') return;
  const now = today();
  if (now === state.day) return;
  state.day = now;
  state.todayDelivery = null;
  state.loaded.today = false;
  emit();
  watchToday();
}

export function stopStore() {
  document.removeEventListener('visibilitychange', checkDayRollover);
  for (const stop of stops) { try { stop(); } catch { /* already detached */ } }
  stops = [];
  dayWatch = null;
  Object.assign(state, {
    clientId: null, client: null, todayDelivery: null, history: [],
    invoices: [], receipts: [], pricing: [...DEFAULT_TIERS],
    conversation: null, error: null,
    loaded: { client: false, today: false, history: false, invoices: false },
  });
}

/* --- Derived --------------------------------------------------------------- */

export const billing = () => (state.client ? summarize(state.client, state.invoices) : null);

export const currentPeriod = () =>
  (state.client ? periodFor(state.client.cycleAnchor || today(), today()) : null);

/** What the running fortnight costs, at the price of this person's plan. */
export const periodEstimate = () => {
  const period = currentPeriod();
  return period && state.client ? projectPeriod(state.client, period, state.pricing) : null;
};

/** The flat price of one fortnight on this person's plan. */
export const fortnightPrice = () => priceFor(state.pricing, state.client?.mealsPerDay);

/** Days of the current period already delivered. */
export const deliveredThisPeriod = () => {
  const period = currentPeriod();
  if (!period) return [];
  return state.history.filter((row) =>
    row.status === 'delivered' && row.date >= period.start && row.date <= period.end);
};

export const unreadCount = () => Number(state.conversation?.unreadClient) || 0;

/** True when the farm is not being served right now. */
export const isPaused = () => state.client && state.client.status !== 'active';

export const isReady = () => state.loaded.client && state.loaded.today;
