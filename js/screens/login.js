/**
 * Farm sign-in.
 *
 * Anyone can create an account here, and an account on its own sees nothing.
 * What opens the app is `clientEmails/{email}`, written by the kitchen when it
 * registers the farm — so signing up with an address the kitchen has not
 * registered gets you a login and no data at all.
 *
 * The point of letting farms sign themselves up is that the kitchen never
 * handles anybody else's password.
 */

import { h, mount } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { field, input, alert } from '../ui/kit.js';
import { toastOk } from '../ui/overlay.js';
import { signIn, signUp, resetPassword } from '../data/session.js';
import { authMessage } from '../firebase.js';

export function renderAuth(host) {
  let mode = 'signin';   // 'signin' | 'signup' | 'reset'
  let busy = false;
  let error = '';
  let notice = '';
  /** Once auth succeeds the session listener swaps this whole screen out; a
   *  late redraw here would paint the login form back over the app. */
  let handedOff = false;

  const draw = () => { if (!handedOff) mount(host, view()); };

  function set(next) {
    mode = next; error = ''; notice = ''; draw();
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;

    const values = Object.fromEntries(new FormData(event.target).entries());
    busy = true; error = ''; draw();

    try {
      if (mode === 'signin') {
        await signIn(values.email, values.password);
        handedOff = true;
        return;
      }
      if (mode === 'signup') {
        if (values.password.length < 6) throw { code: 'auth/weak-password' };
        await signUp({
          email: values.email,
          password: values.password,
          name: values.name,
          phone: values.phone,
        });
        handedOff = true;
        return;
      }
      await resetPassword(values.email);
      notice = 'Te enviamos un correo para crear una contraseña nueva.';
      mode = 'signin';
      toastOk('Correo enviado');
    } catch (err) {
      error = authMessage(err);
    }

    busy = false;
    draw();
  }

  function view() {
    const copy = {
      signin: {
        lede: 'Tu comida, al día',
        sub: 'Sigue la entrega de hoy, revisa tu pago y escríbenos.',
        cta: 'Entrar',
      },
      signup: {
        lede: 'Crea tu cuenta',
        sub: 'Usa el mismo correo que le diste a la cocina; con eso encuentra tu rancho.',
        cta: 'Crear cuenta',
      },
      reset: {
        lede: 'Recuperar acceso',
        sub: 'Te enviaremos un enlace para crear una contraseña nueva.',
        cta: 'Enviar enlace',
      },
    }[mode];

    return h('div.auth',
      h('div.auth__hero',
        h('div.auth__mark',
          h('span', { style: { color: 'var(--brand-500)' } }, icon('eagle')),
          h('div',
            h('div.auth__name', 'El Águila Cocina'),
            h('div.auth__tag', 'Para nuestros ranchos'))),
        h('h1.auth__lede', copy.lede),
        h('p.auth__sub', copy.sub)),

      h('div.auth__body',
        h('form.stack.stack-4', { onsubmit: submit, novalidate: true },
          error ? alert(error, 'bad') : null,
          notice ? alert(notice, 'ok') : null,

          mode === 'signup' ? field({
            label: 'Tu nombre',
            control: input({ name: 'name', required: true, autocomplete: 'name', placeholder: 'Rafael Núñez' }),
          }) : null,

          field({
            label: 'Correo',
            control: input({
              name: 'email', type: 'email', required: true, autocomplete: 'email',
              inputmode: 'email', placeholder: 'tu@correo.com',
            }),
            hint: mode === 'signup'
              ? 'Tiene que ser el correo que la cocina registró para tu rancho.'
              : null,
          }),

          mode === 'signup' ? field({
            label: 'Teléfono',
            hint: 'Para que la cocina pueda localizarte.',
            control: input({ name: 'phone', type: 'tel', autocomplete: 'tel', placeholder: '(604) 555-0143' }),
          }) : null,

          mode !== 'reset' ? field({
            label: 'Contraseña',
            hint: mode === 'signup' ? 'Mínimo 6 caracteres.' : null,
            control: passwordInput(mode),
          }) : null,

          h('button.btn.btn--primary.btn--block.btn--lg', { type: 'submit', disabled: busy },
            busy ? h('span.spinner.spinner--light') : null,
            busy ? 'Un momento…' : copy.cta),

          mode === 'signin'
            ? h('button.btn.btn--quiet.btn--block', { type: 'button', onclick: () => set('reset') },
                'Olvidé mi contraseña')
            : null),

        h('div.auth__switch',
          mode === 'signin'
            ? [h('span', '¿Primera vez? '),
               h('button', { type: 'button', onclick: () => set('signup') }, 'Crear cuenta')]
            : [h('span', '¿Ya tienes cuenta? '),
               h('button', { type: 'button', onclick: () => set('signin') }, 'Iniciar sesión')])));
  }

  draw();
}

/** Password field with a show/hide toggle — typing blind on a phone is worse. */
function passwordInput(mode) {
  const box = input({
    name: 'password', type: 'password', required: true, minlength: 6,
    autocomplete: mode === 'signup' ? 'new-password' : 'current-password',
    placeholder: '••••••••',
  });

  const toggle = h('button.input-group__icon', {
    type: 'button', 'aria-label': 'Mostrar contraseña',
    style: { left: 'auto', right: '12px', pointerEvents: 'auto', background: 'none' },
    onclick: () => {
      const showing = box.type === 'text';
      box.type = showing ? 'password' : 'text';
      mount(toggle, icon(showing ? 'eye' : 'eyeOff'));
      toggle.setAttribute('aria-label', showing ? 'Mostrar contraseña' : 'Ocultar contraseña');
    },
  }, icon('eye'));

  const wrap = h('div.input-group', box, toggle);
  box.style.paddingLeft = '12px';
  box.style.paddingRight = '42px';
  return wrap;
}
