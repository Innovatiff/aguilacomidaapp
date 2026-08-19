/**
 * The farm's thread with the kitchen.
 *
 * `#/chat?ask=payment` pre-fills the payment question, so the button that says
 * "pedir datos de pago" actually lands the manager on a composed message rather
 * than an empty box.
 */

import { h } from '../lib/dom.js';
import { screen } from '../ui/shell.js';
import { avatar, alert } from '../ui/kit.js';
import { chatView } from '../ui/chat-view.js';
import { session } from '../data/session.js';
import { store, subscribe, billing } from '../data/store.js';
import { ensureConversation } from '../data/chat.js';
import { CLIENT_QUICK_REPLIES } from '../lib/model.js';
import { money } from '../lib/format.js';

export function renderChat(context) {
  const clientId = store.clientId || session.clientId;
  let view = null;
  let ensured = false;

  function draw() {
    if (!clientId) {
      screen({ title: 'Mensajes', tab: 'chat', body: h('div.page__inner', alert('Conecta tu rancho para escribir a la cocina.', 'info')) });
      return;
    }

    if (!ensured && store.client) {
      ensured = true;
      // A farm that has never written has no thread document yet; create it so
      // the kitchen's inbox and the unread counters have something to update.
      ensureConversation(store.client).catch(() => {});
    }

    if (!view) {
      view = chatView({
        clientId,
        role: 'client',
        sender: { uid: session.uid, name: session.displayName },
        client: store.client,
        quickReplies: CLIENT_QUICK_REPLIES,
        emptyText: 'Escríbenos sobre la entrega de hoy, un cambio en las comidas o los datos para el pago.',
      });

      if (context.query.ask === 'payment') {
        view.node.querySelector('.chat__composer')
          ?.insertText?.('¿Me pueden enviar los datos para el pago?');
      }
    }

    const summary = billing();
    const owes = (summary?.balance || 0) > 0;

    const page = screen({
      title: 'El Águila Cocina',
      tab: 'chat',
      flush: true,
      brand: h('div.topbar__brand',
        avatar('El Águila', { size: 'sm', dark: true }),
        h('div.grow', { style: { minWidth: 0 } },
          h('div.topbar__title', { style: { fontSize: 'var(--fs-md)' } }, 'El Águila Cocina'),
          h('span.topbar__sub', owes ? `Saldo ${money(summary.balance, { round: true })}` : 'Al corriente'))),
      body: h('div.stack', { style: { flex: '1', minHeight: '0', display: 'flex' } }, view.node),
    });

    page.classList.add('page--chat');
  }

  const unsubscribe = subscribe(draw);
  return () => { unsubscribe(); view?.destroy(); };
}
