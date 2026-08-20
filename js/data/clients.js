/**
 * The farm this login belongs to.
 *
 * A client app only ever touches one `clients/{id}` document — its own. The
 * link is established once, by redeeming the access code the kitchen handed
 * over, and after that `users/{uid}.clientId` carries it.
 */

import {
  db, doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp, arrayUnion, docData,
} from '../firebase.js';

export function watchClient(clientId, onData, onError) {
  return onSnapshot(doc(db, 'clients', clientId), (snap) => onData(docData(snap)), onError);
}

export const getClient = async (clientId) => docData(await getDoc(doc(db, 'clients', clientId)));

/**
 * Resolves a code typed by the farm manager.
 *
 * Codes live in their own collection, one document per code, and the rules
 * allow reading them one at a time by exact id — so a wrong guess reveals
 * nothing and the collection cannot be enumerated.
 */
export async function resolveAccessCode(code) {
  const key = normalizeCode(code);
  if (!isWellFormed(key)) return null;
  const snap = await getDoc(doc(db, 'accessCodes', key));
  return snap.exists() ? { code: key, ...snap.data() } : null;
}

/**
 * Links the signed-in login to a farm.
 *
 * Three writes, in this order, because the security rules chain them:
 * staging the code is what authorises joining `linkedUids`, and being in
 * `linkedUids` is what authorises pointing the profile at the farm. Skipping
 * or reordering any step is rejected server-side, which is the point — the
 * checks do not live in this file.
 */
export async function linkSelfToClient(uid, clientId, code) {
  await setDoc(doc(db, 'redemptions', uid), {
    code: normalizeCode(code),
    at: serverTimestamp(),
  });
  await updateDoc(doc(db, 'clients', clientId), { linkedUids: arrayUnion(uid) });
  await updateDoc(doc(db, 'users', uid), { clientId, linkedAt: serverTimestamp() });
}

/** Uppercases and strips the spaces and dashes people add when reading aloud. */
export const normalizeCode = (code) =>
  String(code || '').trim().toUpperCase().replace(/[\s-]/g, '');

export const isWellFormed = (code) => /^[A-Z0-9]{4,10}$/.test(code);
