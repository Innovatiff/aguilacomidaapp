/**
 * Receipts — read only, and the reason to open this app at the counter.
 *
 * Somebody pays cash at the store and walks out with nothing in their hand. The
 * folio that appears here, seconds later, is the proof: what was taken, which
 * fortnights it covered, and what is left. It is written by the kitchen and can
 * never be edited by anybody, which is what makes it worth trusting.
 *
 * A payment cancelled by mistake shows as a second, negative receipt rather
 * than by the first one quietly disappearing.
 */

import {
  db, doc, collection, onSnapshot, query, where, orderBy,
  limit as qLimit, docData, listData,
} from '../firebase.js';

/** This person's receipts, newest first. */
export function watchReceipts(clientId, onData, onError, count = 40) {
  return onSnapshot(
    query(collection(db, 'receipts'), where('clientId', '==', clientId),
      orderBy('at', 'desc'), qLimit(count)),
    (snap) => onData(listData(snap)),
    onError,
  );
}

export function watchReceipt(id, onData, onError) {
  return onSnapshot(doc(db, 'receipts', id), (snap) => onData(docData(snap)), onError);
}

/** Everything taken in, net of cancellations. */
export const totalPaid = (receipts) =>
  Math.round((receipts || []).reduce((sum, row) => sum + (Number(row.amount) || 0), 0) * 100) / 100;

/** The most recent receipt, or null — the one worth showing on the home screen. */
export const latest = (receipts) => (receipts || []).find((row) => Number(row.amount) > 0) || null;
