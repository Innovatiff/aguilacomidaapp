/**
 * The farm's live data.
 *
 * One farm, one set of listeners: its own record, today's stop, the recent
 * days, its invoices and its thread with the kitchen. Everything the screens
 * show is derived from these five, so the app never re-queries on navigation
 * and every screen agrees with every other one.
 */

import { watchClient } from './clients.js';
import { watchDay, watchHistory } from './deliveries.js';
import { watchInvoices } from './invoices.js';
import { watchConversation } from './chat.js';
import { today } from '../lib/dates.js';
import { summarize, periodFor, projectPeriod } from '../lib/billing.js';

const state = {
  clientId: null,
  client: null,
  todayDelivery: null,
  history: [],
  invoices: [],
  conversation: null,
  day: today(),
  loaded: { client: false, today: false, history: false, invoices: false },
  error: null,
};

const subscribers = new Set();
let stops = [];

export const store = state;

export function subscribe(fn) {
  subscribers.add(fn);
  fn(state);
  return () => subscribers.delete(fn);
}

const emit = () => { for (const fn of subscribers) fn(state); };
const onError = (error) => { state.error = error; emit(); };

/** Starts (or restarts) the listeners for a farm. */
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

    watchDay(clientId, state.day, (row) => {
      state.todayDelivery = row;
      state.loaded.today = true;
      emit();
    }, onError),

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

    watchConversation(clientId, (row) => {
      state.conversation = row;
      emit();
    }, () => {}),
  ];
}

export function stopStore() {
  for (const stop of stops) { try { stop(); } catch { /* already detached */ } }
  stops = [];
  Object.assign(state, {
    clientId: null, client: null, todayDelivery: null, history: [],
    invoices: [], conversation: null, error: null,
    loaded: { client: false, today: false, history: false, invoices: false },
  });
}

/* --- Derived --------------------------------------------------------------- */

export const billing = () => (state.client ? summarize(state.client, state.invoices) : null);

export const currentPeriod = () =>
  (state.client ? periodFor(state.client.cycleAnchor || today(), today()) : null);

/** What the running fortnight is shaping up to cost, at the agreed terms. */
export const periodEstimate = () => {
  const period = currentPeriod();
  return period && state.client ? projectPeriod(state.client, period) : null;
};

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
