/**
 * The farm's deliveries — read only. The kitchen writes them; this app watches.
 */

import {
  db, doc, collection, onSnapshot, query, where, orderBy, limit as qLimit,
  docData, listData, toDate,
} from '../firebase.js';
import { deliveryId } from '../lib/billing.js';
import { DELIVERY_FLOW } from '../lib/model.js';

const deliveriesRef = () => collection(db, 'deliveries');

/** Today's stop, live. This is the tracking card on the home screen. */
export function watchDay(clientId, day, onData, onError) {
  return onSnapshot(doc(db, 'deliveries', deliveryId(clientId, day)),
    (snap) => onData(docData(snap)), onError);
}

/** Recent days, newest first. */
export function watchHistory(clientId, count, onData, onError) {
  return onSnapshot(
    query(deliveriesRef(),
      where('clientId', '==', clientId),
      orderBy('date', 'desc'),
      qLimit(count)),
    (snap) => onData(listData(snap)),
    onError,
  );
}

/**
 * The timeline shown on the tracking card: every step of the normal flow, each
 * marked done / current / pending, with the time it happened when known.
 */
export function timeline(delivery) {
  const events = new Map();
  for (const event of delivery?.events || []) {
    const at = toDate(event.at);
    // Keep the first time a status was reached, not the last.
    if (at && !events.has(event.status)) events.set(event.status, at);
  }

  const reached = DELIVERY_FLOW.indexOf(delivery?.status);
  const failed = delivery?.status === 'issue' || delivery?.status === 'skipped';

  return DELIVERY_FLOW.map((status, index) => ({
    status,
    at: events.get(status) || null,
    done: !failed && index < reached,
    current: !failed && index === reached,
    pending: failed || index > reached,
  }));
}

/** Counts the delivered days in a list — used for the "this fortnight" tile. */
export const deliveredCount = (rows) => rows.filter((row) => row.status === 'delivered').length;

export const mealsDelivered = (rows) => rows
  .filter((row) => row.status === 'delivered')
  .reduce((sum, row) => sum + (Number(row.meals) || 0), 0);
