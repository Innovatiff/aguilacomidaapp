/**
 * One person's live data.
 *
 * One client, one set of listeners: their own record, their invoices, their
 * receipts and their thread with the kitchen. Everything the screens show is
 * derived from those, so the app never re-queries on navigation and every
 * screen agrees with every other one.
 */

import { watchClient } from './clients.js';
import { watchInvoices } from './invoices.js';
import { watchReceipts } from './receipts.js';
import { watchConversation } from './chat.js';
import { today } from '../lib/dates.js';
import { summarize, periodOf, projectPeriod } from '../lib/billing.js';
import { watchPricing } from './pricing.js';
import { DEFAULT_PRICING, chargeFor } from '../lib/pricing.js';

const state = {
  clientId: null,
  client: null,
  invoices: [],
  receipts: [],
  // The price list, so the running fortnight can be quoted before it is billed.
  pricing: { ...DEFAULT_PRICING },
  conversation: null,
  day: today(),
  loaded: { client: false, invoices: false },
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
    watchPricing((pricing) => {
      state.pricing = pricing;
      emit();
    }, () => {}),

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
    clientId: null, client: null,
    invoices: [], receipts: [], pricing: { ...DEFAULT_PRICING },
    conversation: null, error: null,
    loaded: { client: false, invoices: false },
  });
}

/* --- Derived --------------------------------------------------------------- */

export const billing = () => (state.client ? summarize(state.client, state.invoices) : null);

export const currentPeriod = () => (state.client ? periodOf(state.client) : null);

/** What the running period costs, at the price of this person's plan. */
export const periodEstimate = () => {
  const period = currentPeriod();
  return period && state.client ? projectPeriod(state.client, period, state.pricing) : null;
};

/** What one period costs: the plan, adjusted for their week and extras. */
export const periodPrice = () => chargeFor(state.client, state.pricing);

export const unreadCount = () => Number(state.conversation?.unreadClient) || 0;

/** True when the farm is not being served right now. */
export const isPaused = () => state.client && state.client.status !== 'active';

export const isReady = () => state.loaded.client;
