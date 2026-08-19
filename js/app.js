/**
 * El Águila Cocina — the app for our farms.
 *
 * Four states, decided entirely by the session: signed out, signed in but not
 * yet linked to a farm, linked (the app proper), and a staff account that has
 * opened the wrong app. Nothing queries Firestore until a farm id is known.
 */

import { h, $, mount } from './lib/dom.js';
import { icon } from './lib/icons.js';
import { configureShell, setTabBadge, splash, notePath, screen } from './ui/shell.js';
import { register, setNotFound, start, go, onNavigate } from './lib/router.js';
import { startSession, watchSession, session, signOutNow } from './data/session.js';
import { startStore, stopStore, subscribe, unreadCount } from './data/store.js';
import { renderAuth } from './screens/login.js';
import { renderLink } from './screens/link.js';
import { renderHome } from './screens/home.js';
import { renderDeliveries } from './screens/deliveries.js';
import { renderBilling } from './screens/billing.js';
import { renderChat } from './screens/chat.js';
import { renderProfile } from './screens/profile.js';
import { button, emptyState, alert } from './ui/kit.js';

const TABS = [
  { id: 'home',       path: '/',           label: 'Inicio',   icon: 'home' },
  { id: 'deliveries', path: '/deliveries', label: 'Entregas', icon: 'truck' },
  { id: 'billing',    path: '/billing',    label: 'Pagos',    icon: 'wallet' },
  { id: 'chat',       path: '/chat',       label: 'Mensajes', icon: 'chat' },
  { id: 'profile',    path: '/profile',    label: 'Perfil',   icon: 'settings' },
];

const host = $('#app');
let phase = null;          // 'auth' | 'link' | 'staff' | 'app'
let linkedTo = null;       // the farm id the store is running for
let routerStarted = false;
let stopBadge = null;

splash(host);
startSession();

watchSession(() => {
  if (!session.ready) return;

  if (!session.user) return enter('auth');
  // Staff accounts belong in the admin panel; this app has nothing for them.
  if (session.role && session.role !== 'client') return enter('staff');
  if (!session.clientId) return enter('link');
  return enter('app', session.clientId);
});

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
    host.replaceChildren();
    renderAuth(host);
    return;
  }

  if (next === 'link') {
    host.replaceChildren();
    renderLink(host);
    return;
  }

  if (next === 'staff') {
    host.replaceChildren();
    renderStaffNotice(host);
    return;
  }

  linkedTo = clientId;
  host.replaceChildren();
  configureShell({ mount: host, tabs: TABS });
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
  register('/deliveries', renderDeliveries);
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

/** A kitchen account signed in here by mistake. */
function renderStaffNotice(root) {
  mount(root, h('div.auth',
    h('div.auth__hero',
      h('div.auth__mark',
        h('span', { style: { color: 'var(--brand-500)' } }, icon('eagle')),
        h('div',
          h('div.auth__name', 'El Águila Cocina'),
          h('div.auth__tag', 'Para nuestros ranchos'))),
      h('h1.auth__lede', 'Esta app es para los ranchos'),
      h('p.auth__sub', 'Tu cuenta pertenece al equipo de la cocina. Entra al panel de administración para ver clientes, rutas y cobros.')),
    h('div.auth__body.stack.stack-4',
      alert('Si necesitas la app de un rancho, cierra sesión y entra con la cuenta del rancho.', 'info'),
      button('Cerrar sesión', { variant: 'ghost', block: true, icon: 'logout', onClick: () => signOutNow() }))));
}
