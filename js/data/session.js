/**
 * Auth session for the farm app.
 *
 * Which farm this account belongs to is decided by one document:
 * `clientEmails/{your email}`, written by the kitchen when it registers the
 * farm. There is no code to redeem and nothing for the farm to claim — the
 * kitchen typing the address *is* the grant.
 *
 * That document is watched rather than read once, so a farm registered (or
 * moved to a different address) while the app is open reacts immediately.
 *
 * `users/{uid}` holds only a display name and a phone number. It carries no
 * authority whatsoever.
 */

import {
  auth, db, doc, setDoc, onSnapshot, serverTimestamp,
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, updateProfile, sendPasswordResetEmail, docData,
} from '../firebase.js';

const state = { user: null, link: null, profile: null, ready: false };
const listeners = new Set();
let stopLink = null;
let stopProfile = null;

export const session = {
  get user() { return state.user; },
  get uid() { return state.user?.uid || null; },
  /** Lowercased, because that is how the lookup is keyed. */
  get email() { return (state.user?.email || '').trim().toLowerCase(); },
  get ready() { return state.ready; },
  get clientId() { return state.link?.clientId || null; },
  get clientName() { return state.link?.clientName || ''; },
  get profile() { return state.profile; },
  /** Signed in, but the kitchen has not registered this address for a farm. */
  get isUnregistered() { return !!state.user && !state.link; },
  get displayName() {
    return state.profile?.name || state.user?.displayName || state.user?.email || '';
  },
};

const emit = () => { for (const fn of listeners) fn(session); };

/** Subscribe to session changes. Returns an unsubscribe function. */
export function watchSession(fn) {
  listeners.add(fn);
  if (state.ready) fn(session);
  return () => listeners.delete(fn);
}

export function startSession() {
  onAuthStateChanged(auth, (user) => {
    stopLink?.();
    stopProfile?.();
    stopLink = null;
    stopProfile = null;

    state.user = user;
    state.link = null;
    state.profile = null;

    if (!user) {
      state.ready = true;
      emit();
      return;
    }

    const email = (user.email || '').trim().toLowerCase();
    if (!email) {
      state.ready = true;
      emit();
      return;
    }

    stopLink = onSnapshot(
      doc(db, 'clientEmails', email),
      (snap) => {
        state.link = docData(snap);
        state.ready = true;
        emit();
      },
      () => {
        // A refused read means "not registered" just as clearly as an empty one.
        state.link = null;
        state.ready = true;
        emit();
      },
    );

    stopProfile = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => { state.profile = docData(snap); emit(); },
      () => {},
    );
  });
}

/* --- Actions ---------------------------------------------------------------- */

export async function signIn(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  return credential.user;
}

/**
 * Creates the login for an address the kitchen has already registered.
 *
 * The account itself grants nothing: what opens the app is
 * `clientEmails/{email}`, and only the kitchen can write that.
 */
export async function signUp({ email, password, name, phone = '' }) {
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const user = credential.user;
  if (name) await updateProfile(user, { displayName: name });

  await setDoc(doc(db, 'users', user.uid), {
    name: name || '',
    email: user.email || '',
    phone,
    createdAt: serverTimestamp(),
  });
  return user;
}

export const signOutNow = () => signOut(auth);

export const resetPassword = (email) => sendPasswordResetEmail(auth, email.trim());

/** Saves this person's own name and phone. Grants nothing. */
export async function updateOwnProfile(patch) {
  if (!state.user) throw new Error('Sin sesión');
  await setDoc(doc(db, 'users', state.user.uid), {
    ...patch,
    email: state.user.email || '',
    updatedAt: serverTimestamp(),
  }, { merge: true });
  if (patch.name) await updateProfile(state.user, { displayName: patch.name });
}
