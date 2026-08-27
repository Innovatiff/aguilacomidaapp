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

/**
 * The receipts that were taken back.
 *
 * A cancelled payment is not marked on the receipt itself — the rules forbid
 * touching it, and they should: it is the only copy this person holds. What
 * exists instead is a second, negative receipt pointing back at it. So the
 * question "was this one cancelled?" is answered by looking for that pointer,
 * and every screen that shows a receipt has to ask it. One that does not shows
 * somebody "Pago recibido" for money the kitchen already took back off their
 * account — which is the screen they will hold up at the counter.
 */
export const cancelledIds = (receipts) =>
  new Set((receipts || []).map((row) => row.reversalOf).filter(Boolean));

export const wasCancelled = (receipt, receipts) =>
  !!receipt && cancelledIds(receipts).has(receipt.id);

/** The most recent payment that still stands — the one worth showing on Inicio. */
export function latest(receipts) {
  const voided = cancelledIds(receipts);
  return (receipts || []).find(
    (row) => Number(row.amount) > 0 && !voided.has(row.id)) || null;
}
