# El Águila Cocina — app para los ranchos

La app que usan los clientes de El Águila Cocina: seguir la entrega del día,
ver cuánto se debe y cuándo vence, y escribir a la cocina. Pensada para
teléfono, sin paso de compilación — HTML, CSS y JavaScript con módulos ES
nativos.

El panel de la cocina vive en el repositorio `aguilacomidasoftware` y usa el
mismo proyecto de Firebase.

---

## Qué ve el rancho

| Pantalla | Para qué |
|---|---|
| **Inicio** | La entrega de hoy en vivo — programada, en cocina, en camino, entregada — y el saldo con su cuenta regresiva |
| **Entregas** | El historial completo, agrupado por quincena para que cuadre con lo facturado |
| **Pagos** | Saldo, fecha límite, facturas por periodo y todos los pagos ya registrados |
| **Mensajes** | Un solo hilo con la cocina, con avisos automáticos de pagos y problemas |
| **Perfil** | Sus datos, las condiciones acordadas y el precio por comida |

El rancho **no puede modificar nada**: entregas y montos los escribe la cocina.
Esta app existe para que no tengan que llamar por teléfono para saber.

---

## Cómo entra un rancho

1. La cocina registra el rancho en su panel; el software genera un **código de
   acceso** de 6 caracteres.
2. El encargado abre esta app, crea su cuenta con su correo y contraseña.
3. Escribe el código. La app lo resuelve, muestra el nombre del rancho para
   confirmar, y al aceptar queda conectado.

Una cuenta sin conectar no ve absolutamente nada. Varias personas del mismo
rancho pueden conectarse con el mismo código.

Si hace falta cortar el acceso, la cocina usa **Generar código nuevo** o
**Quitar acceso** en la ficha del rancho.

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

### Publicar

```sh
firebase deploy --only hosting:clientes
```

Requiere un sitio de Hosting llamado `aguila-clientes` en el proyecto
`aguilacocina-24496` (**Hosting → Agregar otro sitio**).

---

## Cómo está organizado

```
index.html            una sola página; todo se monta con JavaScript
sw.js                 service worker: el shell funciona sin señal
manifest.webmanifest  instalable en el teléfono

css/                  mismos tokens y componentes que el panel de la cocina
js/
  app.js              arranque: sin sesión → entrar; sin rancho → conectar; listo → app
  firebase.js         SDK de Firebase (CDN) y configuración del proyecto
  lib/                dom, router, fechas, cobro quincenal, formato, modelo, iconos
  data/
    session.js        sesión y perfil del usuario
    clients.js        el rancho propio + canje del código de acceso
    deliveries.js     entregas (sólo lectura) y la línea de tiempo de seguimiento
    invoices.js       facturas y pagos (sólo lectura)
    chat.js           hilo con la cocina
    store.js          escuchas en vivo del rancho
  ui/                 shell, kit de componentes, hojas, chat, saldo
  screens/            login, link, home, deliveries, billing, chat, profile
```

`css/`, `js/lib/`, `js/ui/` y `js/firebase.js` son idénticos a los del panel de
la cocina — es el mismo sistema de diseño y la misma capa base. Si cambias algo
ahí, cópialo al otro repositorio.

### Decisiones que conviene conocer

**El seguimiento no es trabajo extra para la cocina.** El chofer avanza la
parada en su panel porque necesita hacerlo de todas formas; esta app lee ese
mismo documento. No hay un segundo sistema que mantener sincronizado.

**Los días son cadenas `YYYY-MM-DD`, no marcas de tiempo.** Una entrega ocurre
el martes, no a las 19:00 UTC — eso elimina los errores de zona horaria entre el
teléfono de la cocina y el del rancho.

**El estado de la factura se calcula al leer.** «Vencido» depende de la fecha de
hoy; guardarlo en el documento lo dejaría desactualizado al día siguiente.

**Los acuses de lectura son dos marcas de tiempo, no un campo por mensaje.**
Abrir un hilo de 200 mensajes es una escritura pequeña, no 200.

**Persistencia sin conexión activada.** Los ranchos están donde la señal es
mala; la app abre y muestra lo último que sabe.

---

## Privacidad

Las reglas de Firestore confinan cada cuenta a su propio rancho: Firestore
evalúa las reglas contra cada documento que devolvería una consulta, así que
una consulta que no filtre por el rancho propio simplemente falla. Un rancho no
puede ver a otro, ni sus pagos, ni sus mensajes.
