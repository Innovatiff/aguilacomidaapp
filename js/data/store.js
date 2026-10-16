/**
 * One person's live data.
 *
 * One client, one set of listeners: their own record, their invoices, their
 * receipts and their thread with the kitchen. Everything the screens show is
 * derived from those, so the app never re-queries on navigation and every
 * screen agrees with every other one.
 */

import { watchClient } from './clients.js';
import { watchInvoices, watchUnsettled } from './invoices.js';
import { watchReceipts } from './receipts.js';
import { watchConversation } from './chat.js';
import { today } from '../lib/dates.js';
import { summarize, periodOf, projectPeriod, paidThroughOn } from '../lib/billing.js';
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
// The two reads the bills come from — see `watchUnsettled` — kept apart and
// joined into `state.invoices`.
let recent = [];
let unsettled = [];

export const store = state;

export function subscribe(fn) {
  subscribers.add(fn);
  fn(state);
  return () => subscribers.delete(fn);
}

const emit = () => { for (const fn of subscribers) fn(state); };
const onError = (error) => { state.error = error; emit(); };

/** Newest first, each bill once: the history, and anything older still owed. */
function joinBills() {
  const byId = new Map();
  for (const bill of [...unsettled, ...recent]) byId.set(bill.id, bill);
  state.invoices = [...byId.values()]
    .sort((a, b) => String(b.periodStart || '').localeCompare(String(a.periodStart || '')));
}

/*
 * The date moves on by itself. The app is left open on a phone for days, and
 * which fortnight is running and what is owed today must be about today.
 */
function checkDay() {
  if (today() === state.day) return;
  state.day = today();
  emit();
}
if (typeof document !== 'undefined') {
  setInterval(checkDay, 60 * 1000);
  document.addEventListener('visibilitychange', checkDay);
}

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
    }, (error) => { state.loaded.client = true; onError(error); }),

    watchInvoices(clientId, (rows) => {
      recent = rows;
      joinBills();
      state.loaded.invoices = true;
      emit();
    }, (error) => {
      // Said, rather than shown as a balance of nothing.
      state.loaded.invoices = true;
      state.invoicesFailed = true;
      onError(error);
    }),

    // Not fatal if it fails: the history above already holds every bill of
    // the last months, which is nearly always every bill still owed.
    watchUnsettled(clientId, (rows) => {
      unsettled = rows;
      joinBills();
      emit();
    }, () => {}),

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
  recent = [];
  unsettled = [];
  Object.assign(state, {
    clientId: null, client: null,
    invoices: [], receipts: [], pricing: { ...DEFAULT_PRICING },
    conversation: null, error: null, invoicesFailed: false,
    loaded: { client: false, invoices: false },
  });
}

/* --- Derived --------------------------------------------------------------- */

export const billing = () => (state.client ? summarize(state.client, state.invoices, state.day) : null);

export const currentPeriod = () => (state.client ? periodOf(state.client, state.day) : null);

/**
 * The last day of food they have paid for — always a day already eaten.
 *
 * Nobody pays ahead here: every payment is for the fortnight that has just
 * been served. A date still to come is something the kitchen is putting right
 * (a payment that landed on a fortnight before it was served), so it is not
 * repeated back to the client as if it were true.
 */
export const paidUpTo = () => {
  const client = state.client;
  if (!client?.paidThrough) return null;
  const through = paidThroughOn(client, client.paidThrough);
  return through < periodOf(client).start ? through : null;
};

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

/** The person and their bills: without the bills, a balance would read as $0. */
export const isReady = () => state.loaded.client && state.loaded.invoices;
