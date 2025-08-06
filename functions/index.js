// functions/index.js

const functions = require('firebase-functions');
const admin     = require('firebase-admin');
const express   = require('express');
const cors      = require('cors');

// 1) Inicializa o Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();

// 2) Cria o app Express e habilita CORS (inclui preflight OPTIONS)
const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// 3) Rotas da API — **todos** caminhos são relativos
app.get('/tarefas', async (req, res) => {
  try {
    const snap = await db.collection('tarefas').get();
    const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return res.json(lista);
  } catch (err) {
    console.error('Erro ao buscar tarefas:', err);
    return res.status(500).json({ error: 'Erro interno ao listar tarefas' });
  }
});

app.get('/ordens', async (req, res) => {
  try {
    const snap = await db.collection('ordens').get();
    const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return res.json(lista);
  } catch (err) {
    console.error('Erro ao buscar ordens:', err);
    return res.status(500).json({ error: 'Erro interno ao listar ordens' });
  }
});

app.get('/agenda', async (req, res) => {
  const mes = req.query.mes;
  if (!mes) {
    return res.status(400).json({ error: 'Parâmetro "mes" obrigatório (formato YYYY-MM)' });
  }
  try {
    const doc = await db.collection('agenda').doc(mes).get();
    return res.json(doc.exists ? doc.data() : {});
  } catch (err) {
    console.error('Erro ao buscar agenda:', err);
    return res.status(500).json({ error: 'Erro interno ao listar agenda' });
  }
});

// 4) Exporta a Function HTTP “api”
exports.api = functions.https.onRequest(app);
