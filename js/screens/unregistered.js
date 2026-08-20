/**
 * Shown to a signed-in account the kitchen has not registered for any farm.
 *
 * There is nothing for the person to do here except tell the kitchen which
 * address they used — so the screen makes that address impossible to miss and
 * offers to copy it. The lookup is watched live, so the moment the kitchen
 * registers it this screen becomes the app.
 */

import { h, mount } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { alert, button, avatar } from '../ui/kit.js';
import { toastOk, toastBad } from '../ui/overlay.js';
import { session, signOutNow } from '../data/session.js';

export function renderUnregistered(host) {
  const email = session.email;

  mount(host, h('div.auth',
    h('div.auth__hero',
      h('div.auth__mark',
        h('span', { style: { color: 'var(--brand-500)' } }, icon('eagle')),
        h('div',
          h('div.auth__name', 'El Águila Cocina'),
          h('div.auth__tag', 'Para nuestros clientes'))),
      h('h1.auth__lede', 'Falta registrarte'),
      h('p.auth__sub',
        'Entraste bien, pero la cocina todavía no ha registrado este correo '
        + 'para ningún cliente.')),

    h('div.auth__body.stack.stack-4',
      h('div.card',
        h('div.row',
          avatar(session.displayName || email || '?'),
          h('div.grow', { style: { minWidth: 0 } },
            h('div.w-650', 'Tu correo'),
            h('div.t-sm.c-soft.truncate', email || '')))),

      h('div.card',
        h('div.stack.stack-3',
          h('div.row',
            h('span', { style: { color: 'var(--brand-500)' } }, icon('phone')),
            h('div.w-650', 'Qué hacer')),
          h('p.t-sm.c-soft', { style: { lineHeight: '1.5' } },
            'Llama a la cocina y pídeles que te registren con este '
            + 'mismo correo. En cuanto lo hagan, esta pantalla se convierte '
            + 'en tu app sola — no tienes que volver a entrar.'),
          button('Copiar mi correo', {
            variant: 'ghost', size: 'sm', block: true, icon: 'copy',
            onClick: async () => {
              try {
                await navigator.clipboard.writeText(email);
                toastOk('Correo copiado');
              } catch {
                toastBad('No se pudo copiar. Dicta el correo por teléfono.');
              }
            },
          }))),

      alert('Si la cocina lo registró con otro correo, cierra sesión y entra '
        + 'con ese.', 'info'),

      button('Cerrar sesión', { variant: 'ghost', block: true, icon: 'logout', onClick: () => signOutNow() }))));
}
