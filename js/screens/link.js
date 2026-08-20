/**
 * Connecting an account to its farm.
 *
 * Shown to a signed-in account that is not linked yet. The manager types the
 * 6-character code the kitchen gave them; the code resolves to exactly one
 * farm, the account is added to it, and the app is live from that moment.
 */

import { h, mount } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { alert, button, card } from '../ui/kit.js';
import { toastOk, toastBad } from '../ui/overlay.js';
import { session, signOutNow } from '../data/session.js';
import { resolveAccessCode, linkSelfToClient, normalizeCode, isWellFormed } from '../data/clients.js';
import { ensureConversation } from '../data/chat.js';
import { dbMessage } from '../firebase.js';

const LENGTH = 6;

export function renderLink(host) {
  let code = '';
  let busy = false;
  let error = '';
  let found = null;      // the farm a valid code resolved to
  let handedOff = false;

  const draw = () => { if (!handedOff) mount(host, view()); };

  /** Looks the code up as soon as it is complete, so the manager sees the farm
   *  name before committing — a mistyped code should not silently link. */
  async function check(next) {
    code = normalizeCode(next).slice(0, LENGTH);
    error = '';
    found = null;

    if (code.length === LENGTH && isWellFormed(code)) {
      busy = true; draw();
      try {
        found = await resolveAccessCode(code);
        if (!found) error = 'Ese código no existe. Revísalo con la cocina.';
      } catch {
        error = 'No pudimos verificar el código. Revisa tu conexión.';
      }
      busy = false;
    }
    draw();
  }

  async function connect() {
    if (!found || busy) return;
    busy = true; error = ''; draw();

    try {
      await linkSelfToClient(session.uid, found.clientId, found.code);
      await ensureConversation({ id: found.clientId, name: found.clientName, linkedUids: [session.uid] });
      handedOff = true;
      toastOk(`Conectado con ${found.clientName}`);
      // The session watcher sees the new clientId and swaps in the app.
    } catch (err) {
      busy = false;
      // The rules reject a code that has expired or been replaced. That is the
      // one failure a farm manager can actually do something about, so name it.
      error = err?.code === 'permission-denied'
        ? 'Ese código ya venció o fue reemplazado. Pide uno nuevo a la cocina.'
        : dbMessage(err);
      draw();
      toastBad(error);
    }
  }

  function view() {
    return h('div.auth',
      h('div.auth__hero',
        h('div.auth__mark',
          h('span', { style: { color: 'var(--brand-500)' } }, icon('eagle')),
          h('div',
            h('div.auth__name', 'El Águila Cocina'),
            h('div.auth__tag', `Hola, ${session.displayName || ''}`))),
        h('h1.auth__lede', 'Conecta tu rancho'),
        h('p.auth__sub', 'Escribe el código de 6 caracteres que te dio la cocina.')),

      h('div.auth__body.stack.stack-4',
        codeInput(code, check),

        busy && !found ? h('div.row', { style: { justifyContent: 'center' } },
          h('span.spinner'), h('span.t-sm.c-soft', 'Buscando…')) : null,

        error ? alert(error, 'bad') : null,

        found
          ? card(h('div.stack.stack-3',
              h('div.row',
                h('span', { style: { color: 'var(--ok-500)' } }, icon('check')),
                h('div.grow',
                  h('div.t-xs.upper.c-faint.w-700', 'Código válido'),
                  h('div.t-lg.w-700', found.clientName || 'Tu rancho'))),
              button(busy ? 'Conectando…' : 'Conectar mi cuenta', {
                variant: 'primary', block: true, size: 'lg', disabled: busy,
                onClick: connect,
              })))
          : alert('El código lo genera la cocina desde su panel. Si no lo tienes, pídelo por teléfono.', 'info'),

        h('div.divider', { style: { margin: '8px 0' } }),

        button('Cerrar sesión', { variant: 'quiet', block: true, icon: 'logout', onClick: () => signOutNow() })));
  }

  draw();
}

/**
 * Six separate boxes rather than one text field: codes are read aloud over the
 * phone, and a per-character layout makes it obvious where you are.
 */
function codeInput(value, onChange) {
  const box = h('input', {
    value,
    type: 'text',
    inputmode: 'text',
    autocapitalize: 'characters',
    autocomplete: 'one-time-code',
    spellcheck: 'false',
    maxlength: LENGTH,
    'aria-label': 'Código de acceso',
    style: {
      position: 'absolute', inset: '0', width: '100%', height: '100%',
      opacity: '0', border: '0', padding: '0',
      fontSize: '16px',   // keeps iOS from zooming when it takes focus
    },
    oninput: (event) => onChange(event.target.value),
  });

  const cells = h('div.row', { style: { gap: '8px', pointerEvents: 'none' } },
    Array.from({ length: LENGTH }, (_, i) => {
      const char = value[i] || '';
      const active = i === value.length;
      return h('div', {
        style: {
          flex: '1', height: '58px', display: 'grid', placeItems: 'center',
          border: `2px solid ${char ? 'var(--brand-400)' : active ? 'var(--ink-300)' : 'var(--border)'}`,
          borderRadius: 'var(--r-md)',
          background: char ? 'var(--brand-50)' : 'var(--surface)',
          fontSize: '24px', fontWeight: '700',
          fontFamily: 'var(--font-num)', letterSpacing: '.05em',
          color: 'var(--ink-900)',
        },
      }, char || '');
    }));

  const wrap = h('div', { style: { position: 'relative' }, onclick: () => box.focus() }, cells, box);
  queueMicrotask(() => box.focus({ preventScroll: true }));
  return wrap;
}
