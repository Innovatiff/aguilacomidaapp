# El Águila Cocina — app para los clientes

La app que usa cada persona que come de El Águila Cocina: seguir la entrega del
día, ver cuánto debe y cuándo vence, y escribir a la cocina. Pensada para
teléfono, sin paso de compilación — HTML, CSS y JavaScript con módulos ES
nativos.

El panel de la cocina vive en el repositorio `aguilacomidasoftware` y usa el
mismo proyecto de Firebase.

---

## Qué ve cada persona

| Pantalla | Para qué |
|---|---|
| **Inicio** | Su saldo con la cuenta regresiva, la quincena en curso con su semana y su precio, y su último pago |
| **Pagos** | Saldo, fecha límite, facturas por periodo y **todos sus recibos** con folio |
| **Mensajes** | Un solo hilo con la cocina, con avisos automáticos de pagos y problemas |
| **Perfil** | Sus datos, dónde recibe su comida — rancho y ubicación — y su plan con lo que cuesta la quincena |

Cada quien ve **lo suyo y nada más**: trabajar en el mismo rancho, incluso en la
misma ubicación, no da acceso a la ficha, la cuenta ni el chat del compañero.

Y **no puede modificar nada**: entregas y montos los escribe la cocina. Esta app
existe para no tener que llamar por teléfono para saber.

---

## El recibo

Se paga en efectivo, en la cocina, y uno se va con las manos vacías. Por eso el
recibo está aquí: en cuanto la cocina cobra, aparece en **Pagos** con su folio
(`R-260821-WPUF`), cuánto fue, qué quincenas cubrió y con cuánto quedó la cuenta.

La quincena se puede pagar **antes, durante o después**. El precio es plano — lo
que cuesta el plan de cada quien — así que se puede pagar una quincena que ni
siquiera ha empezado, y el recibo lo dice.

Un recibo no se edita ni se borra. Si la cocina cancela un cobro hecho por error,
aparece un **segundo recibo en negativo**: los dos quedan a la vista, que es la
única forma de que la cuenta se pueda verificar después.

---

## Cómo entra un cliente

1. La cocina lo registra en su panel — en su rancho y su ubicación — **con su
   correo**.
2. Esa persona abre esta app y crea su cuenta con ese mismo correo.
3. Listo. La app se abre con lo suyo.

No hay códigos, ni pasos de vinculación, ni nada que compartir por teléfono. El
correo que escribió la cocina *es* el acceso.

El correo es opcional al registrarse: quien no tenía uno el día del alta aparece
igual en la ruta y en la cobranza, y entra a la app en cuanto la cocina se lo
agregue a su ficha.

Si alguien entra con un correo que la cocina no registró, ve una pantalla que se
lo explica y le muestra su propio correo para que se lo dicte a la cocina — y en
cuanto lo registren, esa pantalla se convierte en su app sola.

Para mover o quitar el acceso, la cocina cambia el correo en la ficha de esa
persona. El anterior deja de funcionar al instante.

---

## Puesta en marcha

Este repositorio es sólo la app. La configuración de Firebase —
Authentication, reglas de Firestore e índices — se despliega desde
`aguilacomidasoftware`, que es su única fuente de verdad.

### Correr en local

```sh
npx http-server . -p 5174 -c-1
# o: python3 -m http.server 5174
```

Abre `http://localhost:5174`. Agrega `localhost` en
**Authentication → Settings → Authorized domains** si el inicio de sesión falla.

> Los módulos ES no funcionan abriendo `index.html` con `file://`. Usa un
> servidor.

### Publicar en Netlify

Netlify vigila la rama del repositorio y sube cada push. No hay build — la raíz
del repositorio *es* el sitio, y `netlify.toml` ya trae la configuración.

| Campo | Valor |
|---|---|
| Branch to deploy | `claude/el-aguila-cocina-app-yo40te` |
| Build command | *(vacío)* |
| Publish directory | `.` |

**Autoriza el dominio en Firebase.** Sin esto el inicio de sesión de los
clientes falla con `auth/unauthorized-domain`: consola de Firebase →
**Authentication → Settings → Authorized domains → Add domain**, con el dominio
de Netlify de *esta* app (es distinto al del panel de la cocina).

> Las reglas de Firestore no se publican desde aquí: viven en
> `aguilacomidasoftware`, para que no existan dos copias que se desincronicen.

---

## Cómo está organizado

```
index.html            una sola página; todo se monta con JavaScript
sw.js                 service worker: el shell funciona sin señal
manifest.webmanifest  instalable en el teléfono

css/                  mismos tokens y componentes que el panel de la cocina
js/
  app.js              arranque: sin sesión → entrar; correo sin registrar → aviso; listo → app
  firebase.js         SDK de Firebase (CDN) y configuración del proyecto
  lib/                dom, router, fechas, cobro quincenal, formato, modelo, iconos
  data/
    session.js        sesión y a qué cliente pertenece este correo
    clients.js        la ficha propia (sólo lectura)
    pricing.js        la lista de precios (sólo lectura)
    invoices.js       facturas (sólo lectura)
    receipts.js       recibos (sólo lectura)
    chat.js           hilo con la cocina
    store.js          escuchas en vivo de esa persona
  ui/                 shell, kit de componentes, hojas, chat, saldo
  screens/            login, unregistered, home, billing, chat, profile
```

`css/`, `js/lib/`, `js/ui/` y `js/firebase.js` son idénticos a los del panel de
la cocina — es el mismo sistema de diseño y la misma capa base. Si cambias algo
ahí, cópialo al otro repositorio.

### Decisiones que conviene conocer

**Los días son cadenas `YYYY-MM-DD`, no marcas de tiempo.** Una entrega ocurre
el martes, no a las 19:00 UTC — eso elimina los errores de zona horaria entre el
teléfono de la cocina y el del cliente.

**El rancho y la ubicación viajan en la ficha propia.** Esta app lee un solo
documento y ya sabe dónde le dejan la comida y bajo qué condiciones; no tiene
que consultar el rancho para mostrar «Casa 1».

**La quincena se cobra plana, no por comida.** Lo que se paga es el plan — una o
dos comidas al día — así que el monto se conoce el día que abre el periodo. Cada
factura guarda el precio con el que se emitió: si la cocina sube el precio, lo ya
cobrado no cambia.

**El estado de la factura se calcula al leer.** «Vencido» depende de la fecha de
hoy; guardarlo en el documento lo dejaría desactualizado al día siguiente.

**Los acuses de lectura son dos marcas de tiempo, no un campo por mensaje.**
Abrir un hilo de 200 mensajes es una escritura pequeña, no 200.

**Persistencia sin conexión activada.** Los ranchos están donde la señal es
mala; la app abre y muestra lo último que sabe.

---

## Privacidad

Las reglas de Firestore confinan cada cuenta a su propia ficha: Firestore evalúa
las reglas contra cada documento que devolvería una consulta, así que una
consulta que no filtre por el cliente propio simplemente falla. Nadie puede ver
a otro, ni sus pagos, ni sus recibos, ni sus mensajes — ni siquiera quien trabaja
en la misma ubicación. Lo compartido son dos documentos de sólo lectura: el del
rancho, para mostrar su nombre y su horario, y la lista de precios. Tampoco se
puede escribir dinero: las facturas, los recibos y las entregas los escribe la
cocina.

Quién es cada quien lo decide `clientEmails/{correo}`, un documento que sólo la
cocina puede escribir. Esta app únicamente lo lee: no hay nada que reclamar ni
que canjear, así que tampoco hay nada que falsificar desde aquí.

Las reglas viven en `aguilacomidasoftware/firestore.rules` y están probadas
contra el emulador de Firestore (`tests/rules` en ese repositorio).
