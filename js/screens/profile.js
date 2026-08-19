/**
 * Perfil — the account, the farm's agreed terms, and the way out.
 *
 * The terms are shown in full on purpose: a farm should be able to check the
 * price it is being charged without asking the person charging it.
 */

import { h } from '../lib/dom.js';
import { screen } from '../ui/shell.js';
import {
  card, button, badge, avatar, defList, defRow, sectionLabel, alert, field, input,
} from '../ui/kit.js';
import { toastOk, toastBad, confirm, sheet } from '../ui/overlay.js';
import { go } from '../lib/router.js';
import { session, signOutNow, updateOwnProfile } from '../data/session.js';
import { store, subscribe } from '../data/store.js';
import { clientStatusMeta } from '../lib/model.js';
import { formatDayLong, today, WEEKDAYS_SHORT, capitalize } from '../lib/dates.js';
import { money, moneyFull, number, phone as fmtPhone, telHref } from '../lib/format.js';
import { PERIOD_DAYS } from '../lib/billing.js';
import { dbMessage } from '../firebase.js';

export function renderProfile() {
  const draw = () => screen({
    title: 'Mi cuenta',
    subtitle: store.client?.name || '',
    tab: 'profile',
    sunken: true,
    body: h('div.page__inner.stack.stack-4',
      accountCard(),
      store.client ? farmCard() : null,
      store.client ? termsCard() : null,
      helpCard(),
      aboutCard(),
      button('Cerrar sesión', { variant: 'danger-soft', block: true, icon: 'logout', onClick: leave })),
  });

  function accountCard() {
    return card(h('div.stack.stack-3',
      h('div.row',
        avatar(session.displayName, { size: 'lg' }),
        h('div.grow',
          h('div.t-lg.w-700', session.displayName || 'Sin nombre'),
          h('div.t-sm.c-soft', session.user?.email || ''),
          session.profile?.phone
            ? h('div.t-sm.c-soft', fmtPhone(session.profile.phone))
            : null)),
      button('Editar mis datos', { variant: 'ghost', size: 'sm', block: true, icon: 'edit', onClick: editProfile })));
  }

  function farmCard() {
    const client = store.client;
    const status = clientStatusMeta(client.status);

    return h('div.stack.stack-3',
      sectionLabel('Mi rancho'),
      card(h('div.stack.stack-3',
        h('div.row.row--between',
          h('div',
            h('div.t-lg.w-700', client.name),
            client.contactName ? h('div.t-sm.c-soft', client.contactName) : null),
          badge(status.label, status.tone, status.icon)),
        client.address ? h('div.t-sm.c-soft', client.address) : null,
        client.status !== 'active'
          ? alert('Tu servicio está en pausa. Escríbenos para reanudarlo.', 'warn')
          : null)));
  }

  function termsCard() {
    const client = store.client;
    const order = [1, 2, 3, 4, 5, 6, 0];
    const days = order
      .filter((day) => (client.deliveryDays || []).includes(day))
      .map((day) => capitalize(WEEKDAYS_SHORT[day]))
      .join(', ');

    return h('div.stack.stack-3',
      sectionLabel('Condiciones acordadas'),
      card(defList([
        defRow('Comidas por día', number(client.mealsPerDay)),
        defRow('Precio por comida', moneyFull(client.pricePerMeal)),
        defRow('Días de servicio', days || '—'),
        defRow('Horario', client.deliveryWindow || '—'),
        defRow('Ciclo de cobro', `Cada ${PERIOD_DAYS} días`),
        defRow('Inicio del ciclo', formatDayLong(client.cycleAnchor || today())),
        defRow('Estimado por quincena',
          money((Number(client.mealsPerDay) || 0) * (Number(client.pricePerMeal) || 0) * 12, { round: true })),
      ])),
      h('p.t-xs.c-faint',
        'El estimado supone 12 días de servicio. Se cobra únicamente lo entregado.'));
  }

  function helpCard() {
    const phone = store.client?.phone;
    return h('div.stack.stack-3',
      sectionLabel('¿Necesitas algo?'),
      card(h('div.stack.stack-2',
        button('Escribir a la cocina', { variant: 'primary', block: true, icon: 'chat', onClick: () => go('/chat') }),
        phone
          ? h('a.btn.btn--ghost.btn--block', { href: telHref(phone) }, 'Llamar al rancho')
          : null)));
  }

  const aboutCard = () => h('div.stack.stack-3',
    sectionLabel('Acerca de'),
    card(defList([
      defRow('Aplicación', 'El Águila Cocina'),
      defRow('Versión', '1.0.0'),
      defRow('Moneda', 'CAD'),
    ])));

  async function editProfile() {
    const result = await sheet({
      title: 'Mis datos',
      build: (close) => {
        let name = session.profile?.name || '';
        let phone = session.profile?.phone || '';
        return h('div.stack.stack-4',
          field({ label: 'Nombre', control: input({ value: name, oninput: (e) => { name = e.target.value; } }) }),
          field({ label: 'Teléfono', control: input({ value: phone, type: 'tel', oninput: (e) => { phone = e.target.value; } }) }),
          field({
            label: 'Correo',
            hint: 'Es tu correo de acceso y no se puede cambiar desde aquí.',
            control: input({ value: session.user?.email || '', disabled: true }),
          }),
          button('Guardar', {
            variant: 'primary', block: true,
            onClick: () => close({ name: name.trim(), phone: phone.trim() }),
          }));
      },
    });
    if (!result) return;

    try {
      await updateOwnProfile(result);
      toastOk('Datos actualizados');
    } catch (error) { toastBad(dbMessage(error)); }
  }

  async function leave() {
    if (!await confirm({
      title: 'Cerrar sesión',
      message: '¿Seguro que quieres salir? Tendrás que entrar de nuevo con tu correo y contraseña.',
      confirmLabel: 'Cerrar sesión', tone: 'danger', icon: 'logout',
    })) return;
    await signOutNow();
  }

  return subscribe(draw);
}
