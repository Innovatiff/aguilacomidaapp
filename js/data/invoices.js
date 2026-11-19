/**
 * The farm's bills — read only. Money is written by the kitchen; showing it
 * here is what stops the "how much do I owe?" phone call.
 */

import {
  db, collection, onSnapshot, query, where, orderBy, limit as qLimit, listData,
} from '../firebase.js';
import { balanceOf, invoiceStatus, isOwed, dueOf } from '../lib/billing.js';
import { today } from '../lib/dates.js';

export function watchInvoices(clientId, onData, onError, count = 24) {
  return onSnapshot(
    query(collection(db, 'invoices'),
      where('clientId', '==', clientId),
      orderBy('periodStart', 'desc'),
      qLimit(count)),
    (snap) => onData(listData(snap)),
    onError,
  );
}

/**
 * Every bill not yet paid, however old.
 *
 * The list above is the latest two dozen, which is the history worth showing.
 * What is owed cannot stop there: a debt older than that would quietly drop
 * out of the balance, and the app would say less than the kitchen does.
 */
export function watchUnsettled(clientId, onData, onError) {
  return onSnapshot(
    query(collection(db, 'invoices'),
      where('clientId', '==', clientId),
      where('settled', '==', false)),
    (snap) => onData(listData(snap)),
    onError,
  );
}

/**
 * Everything still owed, soonest deadline first.
 *
 * Only for food already eaten: a bill for the fortnight still running is paid
 * the day it ends, not before — and one for a fortnight that began after their
 * last day is not owed at all (`isOwed`, the rule the kitchen's panel uses).
 */
export const outstanding = (invoices, day = today(), client = null) => invoices
  .filter((invoice) => balanceOf(invoice) > 0.005)
  .filter((invoice) => isOwed(invoice, client, day))
  // As text, whatever is there: a bill with no due date sorts last instead
  // of stopping Pagos from opening.
  .sort((a, b) => String(dueOf(a) || '9999').localeCompare(String(dueOf(b) || '9999')))
  .map((invoice) => ({ ...invoice, uiStatus: invoiceStatus(invoice, day) }));

export const settledInvoices = (invoices) => invoices.filter((invoice) => balanceOf(invoice) <= 0.005);


export { balanceOf, invoiceStatus };
