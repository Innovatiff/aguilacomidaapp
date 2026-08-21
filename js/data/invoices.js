/**
 * The farm's bills — read only. Money is written by the kitchen; showing it
 * here is what stops the "how much do I owe?" phone call.
 */

import {
  db, collection, onSnapshot, query, where, orderBy, limit as qLimit, listData,
} from '../firebase.js';
import { balanceOf, invoiceStatus } from '../lib/billing.js';
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

/** Everything still owed, soonest deadline first. */
export const outstanding = (invoices, day = today()) => invoices
  .filter((invoice) => balanceOf(invoice) > 0.005)
  .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  .map((invoice) => ({ ...invoice, uiStatus: invoiceStatus(invoice, day) }));

export const settledInvoices = (invoices) => invoices.filter((invoice) => balanceOf(invoice) <= 0.005);


export { balanceOf, invoiceStatus };
