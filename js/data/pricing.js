/**
 * The price list — read only.
 *
 * One document for the whole business, written by the kitchen. This app reads
 * it for one reason: to say what the fortnight in progress will cost before a
 * bill for it exists. Every fortnight already billed carries its own amount, so
 * a price change never rewrites what somebody was charged.
 */

import { db, doc, onSnapshot, docData } from '../firebase.js';
import { normalizePricing } from '../lib/pricing.js';

export function watchPricing(onData, onError) {
  return onSnapshot(doc(db, 'config', 'pricing'),
    (snap) => onData(normalizePricing(docData(snap))), onError);
}
