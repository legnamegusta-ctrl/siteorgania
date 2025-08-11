// functions/index.js

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const {v4: uuidv4} = require("uuid");

// 1) Inicializa o Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();

// 2) Cria o app Express e habilita CORS (inclui preflight OPTIONS)
const app = express();
app.use(cors({origin: true}));
app.use(express.json());

// 3) Rotas da API — **todos** caminhos são relativos
app.get("/tarefas", async (req, res) => {
  try {
    const snap = await db.collection("tarefas").get();
    const lista = snap.docs.map((d) => ({id: d.id, ...d.data()}));
    return res.json(lista);
  } catch (err) {
    console.error("Erro ao buscar tarefas:", err);
    return res.status(500).json({error: "Erro interno ao listar tarefas"});
  }
});

app.get("/ordens", async (req, res) => {
  try {
    const snap = await db.collection("ordens").get();
    const lista = snap.docs.map((d) => ({id: d.id, ...d.data()}));
    return res.json(lista);
  } catch (err) {
    console.error("Erro ao buscar ordens:", err);
    return res.status(500).json({error: "Erro interno ao listar ordens"});
  }
});

app.get("/agenda", async (req, res) => {
  const mes = req.query.mes;
  if (!mes) {
    return res.status(400).json({
      error: "Parâmetro \"mes\" obrigatório (formato YYYY-MM)",
    });
  }
  try {
    const doc = await db.collection("agenda").doc(mes).get();
    return res.json(doc.exists ? doc.data() : {});
  } catch (err) {
    console.error("Erro ao buscar agenda:", err);
    return res.status(500).json({error: "Erro interno ao listar agenda"});
  }
});

// Rota para upload de fotos de tarefas
app.post("/uploadTaskPhoto", async (req, res) => {
  try {
    const {imageBase64, clientId, taskId} = req.body;
    if (!imageBase64 || !clientId || !taskId) {
      return res.status(400).json({error: "Dados incompletos"});
    }
    const buffer = Buffer.from(imageBase64, "base64");
    const fileName = `clients/${clientId}/tasks/${taskId}/${uuidv4()}.jpg`;
    const file = admin.storage().bucket().file(fileName);
    await file.save(buffer, {contentType: "image/jpeg"});
    const [url] = await file.getSignedUrl({
      action: "read",
      expires: "03-09-2491",
    });
    return res.json({imageUrl: url});
  } catch (err) {
    console.error("Erro ao enviar foto:", err);
    return res.status(500).json({error: "Erro interno ao salvar foto"});
  }
});

// 4) Exporta a Function HTTP “api”
exports.api = functions.https.onRequest(app);