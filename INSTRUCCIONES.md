# Cómo poner esto a funcionar

Este backend necesita vivir en un servidor accesible por internet (no puede
correr solo en tu computadora, porque PayPal necesita poder "avisarle" cuando
alguien paga).

## Paso 1 — Súbelo a un hosting gratuito

La opción más simple es **Render.com** (tiene plan gratuito):

1. Crea una cuenta en render.com.
2. Sube esta carpeta `backend/` a un repositorio de GitHub (puedes crear uno
   gratis en github.com si no tienes).
3. En Render: "New +" → "Web Service" → conecta tu repositorio.
4. Configura:
   - **Build command:** `npm install`
   - **Start command:** `npm start`
5. Cuando termine el despliegue, Render te da una URL como:
   `https://impulso-editorial-backend.onrender.com`

Esa es la URL de tu backend.

## Paso 2 — Configura el IPN en tu cuenta de PayPal

1. Entra a tu cuenta de PayPal → Configuración → "Preferencias de notificaciones
   instantáneas de pago (IPN)".
2. Activa el IPN.
3. Pon como URL de notificación:
   `https://TU-URL-DE-RENDER.onrender.com/paypal-ipn`
4. Guarda.

Desde ahora, cada vez que alguien complete un pago, PayPal le avisará
automáticamente a tu backend, y tu backend guardará ese correo como "pagado".

## Paso 3 — Conecta tu página web al backend

En tu `index.html`, después de que el usuario inicia sesión con Google, antes
de mostrar el botón de descarga, tu código debe llamar a:

```javascript
fetch(`https://TU-URL-DE-RENDER.onrender.com/check-access?email=${userEmail}&item=${encodeURIComponent("Ahorra rápido sin sacrificar tu vida")}`)
  .then(res => res.json())
  .then(data => {
    if (data.hasAccess) {
      // mostrar botón de descarga
    } else {
      // mostrar mensaje: "Aún no detectamos tu pago, o compra el libro primero"
    }
  });
```

El `item` debe coincidir EXACTO con el `item_name` que usas en el enlace de
PayPal de ese libro.

## Nota importante

El plan gratuito de Render "duerme" el backend si nadie lo usa por un rato,
y tarda unos segundos en "despertar" la primera vez que alguien lo llama. Es
normal, no es un error.

Cuando quieras, puedo ayudarte a modificar directamente tu `index.html` para
que quede conectado a este backend — solo necesito la URL que te dé Render
después de desplegarlo.
