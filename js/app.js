/**
 * El Águila Cocina — the app for our farms.
 *
 * Three states, decided entirely by the session: signed out; signed in but the
 * kitchen has not registered this address for any farm; and registered, which
 * is the app proper. Nothing queries Firestore until a farm id is known.
 *
 * There is no linking step. Which farm an address belongs to is written by the
 * kitchen when it registers that farm, so this app only ever reads it.
 */

import { $ } from './lib/dom.js';
import { configureShell, clearShell, setTabBadge, splash, notePath, screen } from './ui/shell.js';
import { register, setNotFound, start, go, onNavigate } from './lib/router.js';
import { startSession, watchSession, session } from './data/session.js';
import { startStore, stopStore, subscribe, unreadCount } from './data/store.js';
import { renderAuth } from './screens/login.js';
import { renderUnregistered } from './screens/unregistered.js';
import { renderHome } from './screens/home.js';
import { renderBilling } from './screens/billing.js';
import { renderChat } from './screens/chat.js';
import { renderProfile } from './screens/profile.js';
import { button, emptyState } from './ui/kit.js';
import { renderInstall, installWanted, emailFromHash } from './screens/install.js';

const TABS = [
  { id: 'home',       path: '/',           label: 'Inicio',   icon: 'home' },
  { id: 'billing',    path: '/billing',    label: 'Pagos',    icon: 'wallet' },
  { id: 'chat',       path: '/chat',       label: 'Mensajes', icon: 'chat' },
  { id: 'profile',    path: '/profile',    label: 'Perfil',   icon: 'settings' },
];

const host = $('#app');
let phase = null;          // 'auth' | 'unregistered' | 'app'
let linkedTo = null;       // the farm id the store is running for
let routerStarted = false;
let stopBadge = null;

/*
 * The sticker's page comes first, before anything else starts.
 *
 * Somebody scanning a QR off a container has no session and may have no
 * account, so this screen cannot sit behind the sign-in the way every other
 * screen does. It is decided from the address alone and reads nothing: no
 * Firestore, no session, no splash.
 *
 * Pressing "Entrar a mi cuenta" reloads onto the app proper rather than
 * switching in place. It is a page somebody opens once, from a camera, and a
 * reload is the one way of leaving it that cannot land half-booted.
 */
if (installWanted()) {
  renderInstall(host, {
    email: emailFromHash(),
    onEnter: () => { location.hash = '/'; location.reload(); },
  });
} else {
  splash(host);
  startSession();
  boot();
}

function boot() {
  watchSession(() => {
    if (!session.ready) return;

    if (!session.user) return enter('auth');
    if (!session.clientId) return enter('unregistered');
    return enter('app', session.clientId);
  });
}

function enter(next, clientId = null) {
  // The app phase restarts when the account is linked to a different farm.
  if (phase === next && (next !== 'app' || linkedTo === clientId)) return;

  if (phase === 'app') {
    stopBadge?.();
    stopBadge = null;
    stopStore();
    linkedTo = null;
  }
  phase = next;

  if (next === 'auth') {
    clearShell(host);
    renderAuth(host);
    return;
  }

  if (next === 'unregistered') {
    clearShell(host);
    renderUnregistered(host);
    return;
  }

  linkedTo = clientId;
  host.replaceChildren();
  configureShell({
    mount: host,
    tabs: TABS,
    brand: { name: 'El Águila', sub: 'Mi cuenta' },
  });
  startStore(clientId);
  stopBadge = subscribe(() => setTabBadge('chat', unreadCount()));

  if (!routerStarted) {
    registerRoutes();
    onNavigate((context) => notePath(context.path));
    routerStarted = true;
  }
  start();
}

function registerRoutes() {
  register('/', renderHome);
  // Reachable from inside the app too, though nobody gets here that way: the
  // boot branch above is what actually draws it, so this just puts the address
  // back through it.
  register('/instalar', () => { location.reload(); });
  register('/billing', renderBilling);
  register('/chat', renderChat);
  register('/profile', renderProfile);

  setNotFound(() => {
    screen({
      title: 'No encontrado',
      body: emptyState({
        icon: 'search',
        title: 'Esta pantalla no existe',
        text: 'El enlace puede estar mal escrito.',
        action: button('Ir al inicio', { onClick: () => go('/') }),
      }),
    });
  });
}
