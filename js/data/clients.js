/**
 * The farm this login belongs to — read only.
 *
 * A farm app only ever touches one `clients/{id}` document. Which one is
 * decided by `clientEmails/{your email}`, written by the kitchen; this app
 * never claims or changes it.
 */

import { db, doc, getDoc, onSnapshot, docData } from '../firebase.js';

export function watchClient(clientId, onData, onError) {
  return onSnapshot(doc(db, 'clients', clientId), (snap) => onData(docData(snap)), onError);
}

export const getClient = async (clientId) => docData(await getDoc(doc(db, 'clients', clientId)));
