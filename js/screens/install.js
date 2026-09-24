/**
 * The page a sticker leads to.
 *
 * Every container the kitchen packs carries a QR, and this is where it goes:
 * the worker's own address, and how to put this app on their phone. It is the
 * first thing most of them will ever see of it, standing in a field with the
 * lid still warm, so it asks for nothing and explains one thing.
 *
 * **It runs before the session does.** Somebody scanning that code has not
 * signed in and may not have an account yet, so this screen is decided at boot
 * from the address alone and never touches Firestore. The address in the link
 * is read out of the fragment — the part of a URL browsers never send to a
 * server — so nobody ends up with a log of who was handed which container.
 */

import { h, mount } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { button, alert } from '../ui/kit.js';
import { toastOk, toastBad } from '../ui/overlay.js';

/** The address the sticker carried, if it carried one. */
export function emailFromHash(hash = location.hash) {
  const [, search = ''] = String(hash || '').slice(1).split('?');
  const value = new URLSearchParams(search).get('e') || '';
  return value.trim();
}

/** True when this page was opened from a sticker. */
export const installWanted = (hash = location.hash) =>
  String(hash || '').slice(1).split('?')[0].replace(/\/$/, '') === '/instalar';

/* --- What to press on a phone ----------------------------------------------- */

const step = (n, text) => h('li.inst__step', h('span.inst__n', String(n)), h('span', text));

const HOW = {
  ios: {
    title: 'En iPhone',
    hint: 'Ábrela en Safari.',
    steps: [
      'Toca el botón de Compartir, abajo en medio.',
      'Baja y toca «Agregar a pantalla de inicio».',
      'Toca «Agregar», arriba a la derecha.',
    ],
  },
  android: {
    title: 'En Android',
    hint: 'Ábrela en Chrome.',
    steps: [
      'Toca los tres puntos ⋮, arriba a la derecha.',
      'Toca «Instalar aplicación» o «Agregar a pantalla principal».',
      'Toca «Instalar».',
    ],
  },
  desktop: {
    title: 'En la computadora',
    hint: 'En Chrome o Edge.',
    steps: [
      'Busca el icono de instalar en la barra de direcciones, a la derecha.',
      'Tócalo y luego «Instalar».',
    ],
  },
};

/** Which set of instructions goes first. */
function platform() {
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  // An iPad on recent iOS reports itself as a Mac; the touch points give it away.
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

const installed = () => window.matchMedia?.('(display-mode: standalone)').matches
  || window.navigator.standalone === true;

function howCard(key, open) {
  const how = HOW[key];
  return h(`div.card.inst__how${open ? '.is-open' : ''}`,
    h('div.stack.stack-3',
      h('div.row',
        h('span', { style: { color: 'var(--brand-500)' } }, icon(key === 'desktop' ? 'home' : 'phone')),
        h('div',
          h('div.w-650', how.title),
          h('div.t-xs.c-faint', how.hint))),
      h('ol.inst__steps', how.steps.map((text, i) => step(i + 1, text)))));
}

/* --- The screen ------------------------------------------------------------- */

export function renderInstall(host, { email = '', onEnter } = {}) {
  const mine = platform();
  const others = ['ios', 'android', 'desktop'].filter((key) => key !== mine);

  mount(host, h('div.auth',
    h('div.auth__hero',
      h('div.auth__mark',
        h('span', { style: { color: 'var(--brand-500)' } }, icon('eagle')),
        h('div',
          h('div.auth__name', 'El Águila Cocina'),
          h('div.auth__tag', 'Tu comida y tu cuenta'))),
      h('h1.auth__lede', installed() ? 'Ya la tienes' : 'Ponla en tu teléfono'),
      h('p.auth__sub', installed()
        ? 'Entra con tu correo y ve tu comida, lo que debes y tus mensajes.'
        : 'Se instala como cualquier app y desde ahí ves tu comida, lo que '
          + 'debes y tus mensajes con la cocina.')),

    h('div.auth__body.stack.stack-4',
      email
        ? h('div.card.inst__me',
            h('div.t-xs.upper.c-faint.w-700', 'Tu correo'),
            h('div.inst__mail', email),
            h('p.t-sm.c-soft', 'Con ese correo entras. Si todavía no tienes contraseña, '
              + 'pídesela a la cocina.'),
            button('Copiar mi correo', {
              variant: 'ghost', size: 'sm', block: true, icon: 'copy',
              onClick: async () => {
                try {
                  await navigator.clipboard.writeText(email);
                  toastOk('Correo copiado');
                } catch {
                  toastBad('No se pudo copiar. Escríbelo tal cual como se ve arriba.');
                }
              },
            }))
        : alert('Entra con el correo que le diste a la cocina. Si no les has dado '
          + 'ninguno, pídeles que te registren uno.', 'info'),

      // Chrome on Android offers to do it properly, with no instructions at
      // all. The event is caught in index.html because it can fire before any
      // module has finished loading.
      !installed() && window.__installPrompt
        ? button('Instalar la app', {
          variant: 'primary', block: true, size: 'lg', icon: 'download',
          onClick: async () => {
            const event = window.__installPrompt;
            window.__installPrompt = null;
            try { await event.prompt(); } catch { toastBad('No se pudo abrir la instalación.'); }
          },
        })
        : null,

      installed() ? null : h('div.stack.stack-3',
        h('div.t-xs.upper.c-faint.w-700', 'Cómo instalarla'),
        howCard(mine, true),
        ...others.map((key) => howCard(key, false))),

      button('Entrar a mi cuenta', {
        variant: installed() ? 'primary' : 'ghost', block: true, size: 'lg',
        iconEnd: 'arrowRight',
        onClick: onEnter,
      }))));
}
