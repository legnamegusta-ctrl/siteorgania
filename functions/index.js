// functions/index.js

const functions = require('firebase-functions');
const admin     = require('firebase-admin');
const express   = require('express');
const cors      = require('cors');

// Inicializa o Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();

// Cria o app Express
const app = express();

// Habilita CORS (inclui preflight OPTIONS automaticamente)
app.use(cors({ origin: true }));

// Permite JSON no corpo das requisições
app.use(express.json());

//
// Rotas da sua API — **todos** são caminhos relativos válidos
//

// GET /tarefas — lista todas as tarefas
app.get('/tarefas', async (req, res) => {
  try {
    const snap  = await db.collection('tarefas').get();
    const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return res.json(lista);
  } catch (err) {
    console.error('Erro ao buscar tarefas:', err);
    return res.status(500).json({ error: 'Erro interno ao listar tarefas' });
  }
});

// GET /ordens — lista todas as ordens
app.get('/ordens', async (req, res) => {
  try {
    const snap  = await db.collection('ordens').get();
    const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return res.json(lista);
  } catch (err) {
    console.error('Erro ao buscar ordens:', err);
    return res.status(500).json({ error: 'Erro interno ao listar ordens' });
  }
});

// GET /agenda?mes=YYYY-MM — retorna documento "agenda/mes"
app.get('/agenda', async (req, res) => {
  const mes = req.query.mes;
  if (!mes) {
    return res
      .status(400)
      .json({ error: 'Parâmetro "mes" obrigatório (formato YYYY-MM)' });
  }
  try {
    const docSnap = await db.collection('agenda').doc(mes).get();
    return res.json(docSnap.exists ? docSnap.data() : {});
  } catch (err) {
    console.error('Erro ao buscar agenda:', err);
    return res.status(500).json({ error: 'Erro interno ao listar agenda' });
  }
});

// Exporta a função HTTP "api"
exports.api = functions.https.onRequest(app);
