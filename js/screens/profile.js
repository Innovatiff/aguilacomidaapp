/**
 * Perfil — the account, where you eat, the agreed terms, and the way out.
 *
 * The terms are shown in full on purpose: you should be able to check the price
 * you are being charged without asking the person charging it.
 */

import { h } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { screen } from '../ui/shell.js';
import {
  card, button, badge, avatar, defList, defRow, sectionLabel, alert, field, input,
  chargeRows,
} from '../ui/kit.js';
import { toastOk, toastBad, confirm, sheet } from '../ui/overlay.js';
import { go } from '../lib/router.js';
import { session, signOutNow, updateOwnProfile } from '../data/session.js';
import { store, subscribe, periodPrice } from '../data/store.js';
import { clientStatusMeta } from '../lib/model.js';
import { formatDayLong, today, WEEKDAYS_SHORT } from '../lib/dates.js';
import { periodCharge, mealsOn } from '../lib/pricing.js';
import { moneyFull, phone as fmtPhone } from '../lib/format.js';
import { periodWord, cadenceWord, payEveryOf } from '../lib/billing.js';
import { dbMessage } from '../firebase.js';

export function renderProfile() {
  const draw = () => screen({
    title: 'Mi cuenta',
    subtitle: store.client?.name || '',
    tab: 'profile',
    sunken: true,
    body: h('div.page__inner.page__inner--flow.stack.stack-4',
      accountCard(),
      store.client ? farmCard() : null,
      store.client ? dietCard() : null,
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

  /** Where the food is left — the farm, and the spot inside it. */
  function farmCard() {
    const client = store.client;
    const status = clientStatusMeta(client.status);

    return h('div.stack.stack-3',
      sectionLabel('Dónde recibo mi comida'),
      card(h('div.stack.stack-3',
        h('div.row.row--between',
          h('div',
            h('div.t-lg.w-700', client.farmName || 'Tu rancho'),
            client.locationName ? h('div.t-sm.c-soft', client.locationName) : null),
          badge(status.label, status.tone, status.icon)),
        client.status !== 'active'
          ? alert('Tu servicio está en pausa. Escríbenos para reanudarlo.', 'warn')
          : null)));
  }

  /** What the kitchen has on file that they cannot eat. */
  function dietCard() {
    const tags = store.client?.tags || [];
    if (!tags.length) return null;

    return h('div.stack.stack-3',
      sectionLabel('Lo que no comes'),
      card(h('div.stack.stack-3',
        h('div.tags.tags--loud', tags.map((tag) => h('span.tag', icon('ban'), tag))),
        h('p.t-xs.c-faint', 'Es lo que la cocina deja fuera de tu comida. Si falta algo o '
          + 'sobra, escríbenos y lo corregimos.'))));
  }

  function termsCard() {
    const client = store.client;
    const price = periodPrice();

    return h('div.stack.stack-3',
      sectionLabel('Condiciones acordadas'),
      card(h('div.stack.stack-3',
        h('div.stack.stack-2',
          h('div.t-xs.upper.c-faint.w-700', 'Mi semana'),
          h('div.weekstrip', [1, 2, 3, 4, 5, 6, 0].map((weekday) => {
            const meals = mealsOn(client, weekday);
            const extra = Number(client.extras?.[String(weekday)]) || 0;
            return h(`div.weekstrip__day${meals ? '' : '.is-off'}${extra ? '.has-extra' : ''}`,
              h('div.weekstrip__n', meals || '—'),
              h('div.weekstrip__w', WEEKDAYS_SHORT[weekday]));
          }))),

        defList([
          ...chargeRows(periodCharge(client, store.pricing), !!price),
          defRow('Horario', client.deliveryWindow || '—'),
          defRow('Ciclo de cobro', `Pago ${cadenceWord(client)} — ${payEveryOf(client)} días`),
          defRow('Inicio del ciclo', formatDayLong(client.cycleAnchor || today())),
          defRow(`Precio por ${periodWord(client)}`,
            price ? moneyFull(price) : 'Pregúntanos', { total: true }),
        ]))),
      h('p.t-xs.c-faint', client.farmName
        ? `Los días y el horario los acordó la cocina con ${client.farmName}. El precio es por `
          + `${periodWord(client)} completa y puedes pagarlo antes, durante o después.`
        : `El precio es por ${periodWord(client)} completa y puedes pagarlo antes, durante o `
          + 'después.'));
  }

  /**
   * The chat is the only support channel on purpose: it leaves a record both
   * sides can read back, which a phone call does not.
   */
  function helpCard() {
    return h('div.stack.stack-3',
      sectionLabel('¿Necesitas algo?'),
      card(h('div.stack.stack-3',
        h('p.t-sm.c-soft', 'Cambios en tus comidas, un problema con la entrega o los datos para '
          + 'pagar: escríbele a la cocina y queda registrado.'),
        button('Escribir a la cocina', {
          variant: 'primary', block: true, icon: 'chat', onClick: () => go('/chat'),
        }))));
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
