/**
 * The person this login belongs to — read only.
 *
 * This app only ever touches one `clients/{id}` document: yours. Which one is
 * decided by `clientEmails/{your email}`, written by the kitchen; the app never
 * claims or changes it. The farm you work at and the location where your food
 * is left travel on that same document, so there is nothing else to read.
 */

import { db, doc, getDoc, onSnapshot, docData } from '../firebase.js';

export function watchClient(clientId, onData, onError) {
  return onSnapshot(doc(db, 'clients', clientId), (snap) => onData(docData(snap)), onError);
}

export const getClient = async (clientId) => docData(await getDoc(doc(db, 'clients', clientId)));
