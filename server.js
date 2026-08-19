// server.js
// Backend que verifica pagos de PayPal automáticamente y controla el acceso
// a las descargas de los libros de Impulso Editorial.
//
// Flujo:
// 1) PayPal envía una notificación (IPN) a POST /paypal-ipn cuando alguien paga.
// 2) Verificamos esa notificación directamente con los servidores de PayPal
//    (para asegurarnos de que no sea falsa).
// 3) Si el pago es válido y está "Completed", guardamos el correo del comprador
//    y el nombre del producto que compró en data/paid-users.json.
// 4) Tu página web llama a GET /check-access?email=...&item=... para saber si
//    esa persona (identificada por su correo de Google) ya pagó ese libro.
//    Solo si la respuesta es {"hasAccess": true} le muestras el botón de descarga.

const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");
const https = require("https");
const querystring = require("querystring");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data", "paid-users.json");

// Cambia esto por tu dominio real una vez lo despliegues (para permitir
// que tu página web (front-end) pueda llamar a este backend).
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.header("Access-Control-Allow-Methods", "GET, POST");
  next();
});

// PayPal envía el IPN como application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

function readPaidUsers() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (e) {
    return [];
  }
}

function savePaidUsers(list) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2));
}

// Verifica la notificación de PayPal reenviándola a PayPal para confirmar
// que es legítima (paso obligatorio de seguridad en IPN).
function verifyWithPaypal(bodyRaw) {
  return new Promise((resolve, reject) => {
    const verificationBody = "cmd=_notify-validate&" + bodyRaw;

    const options = {
      hostname: "ipnpb.paypal.com", // usa "ipnpb.sandbox.paypal.com" para pruebas
      path: "/cgi-bin/webscr",
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(verificationBody),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data.trim())); // "VERIFIED" o "INVALID"
    });

    req.on("error", reject);
    req.write(verificationBody);
    req.end();
  });
}

app.post("/paypal-ipn", async (req, res) => {
  // Responder rápido a PayPal (no debe esperar tu procesamiento)
  res.sendStatus(200);

  try {
    const bodyRaw = querystring.stringify(req.body);
    const verification = await verifyWithPaypal(bodyRaw);

    if (verification !== "VERIFIED") {
      console.warn("IPN no verificado, se ignora:", req.body);
      return;
    }

    const { payment_status, payer_email, item_name, mc_gross, txn_id } =
      req.body;

    if (payment_status === "Completed") {
      const paidUsers = readPaidUsers();

      // Evitar duplicados si PayPal reenvía el mismo IPN
      const alreadyExists = paidUsers.some((u) => u.txn_id === txn_id);
      if (!alreadyExists) {
        paidUsers.push({
          email: (payer_email || "").toLowerCase(),
          item: item_name,
          amount: mc_gross,
          txn_id,
          date: new Date().toISOString(),
        });
        savePaidUsers(paidUsers);
        console.log(`Pago confirmado: ${payer_email} compró "${item_name}"`);
      }
    }
  } catch (err) {
    console.error("Error procesando IPN:", err);
  }
});

// Mapa: nombre exacto del item_name de PayPal -> archivo que le corresponde.
// Añade aquí una línea por cada libro que vendas.
const BOOK_FILES = {
  "Ahorra rápido sin sacrificar tu vida": "libro-ahorro.docx",
};

// Tu página web llama a esto después de que el usuario inicia sesión con Google,
// SOLO para saber si debe mostrar el botón de descarga o no.
app.get("/check-access", (req, res) => {
  const email = (req.query.email || "").toLowerCase();
  const item = req.query.item || "";

  if (!email || !item) {
    return res.status(400).json({ error: "Falta email o item" });
  }

  const paidUsers = readPaidUsers();
  const hasAccess = paidUsers.some(
    (u) => u.email === email && u.item === item
  );

  res.json({ hasAccess });
});

// Esta es la ÚNICA vía por la que el archivo real sale del servidor.
// Nunca está en el HTML ni es público: solo se entrega si el correo
// realmente pagó ese libro (según lo que registró el IPN de PayPal).
app.get("/download", (req, res) => {
  const email = (req.query.email || "").toLowerCase();
  const item = req.query.item || "";

  if (!email || !item) {
    return res.status(400).send("Falta email o item");
  }

  const paidUsers = readPaidUsers();
  const hasAccess = paidUsers.some(
    (u) => u.email === email && u.item === item
  );

  if (!hasAccess) {
    return res.status(403).send("No se encontró un pago confirmado para este libro y correo.");
  }

  const fileName = BOOK_FILES[item];
  if (!fileName) {
    return res.status(404).send("Libro no configurado en BOOK_FILES.");
  }

  const filePath = path.join(__dirname, "protected", fileName);
  res.download(filePath, fileName, (err) => {
    if (err) {
      console.error("Error enviando archivo:", err);
    }
  });
});

app.get("/", (req, res) => {
  res.send("Backend de Impulso Editorial funcionando correctamente.");
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
