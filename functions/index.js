// functions/index.js

// 1) Importa as bibliotecas necessárias
const functions = require('firebase-functions');
const admin     = require('firebase-admin');
const express   = require('express');
const cors      = require('cors');

// 2) Inicializa o Firebase Admin (Firestore)
admin.initializeApp();
const db = admin.firestore();

// 3) Cria um app Express
const app = express();
app.use(cors({ origin: true }));  // libera CORS para qualquer origem
app.use(express.json());          // permite receber JSON no corpo

// 4) Endpoints HTTP

// 4.1) /tarefas — lista todas as tarefas da coleção "tarefas"
app.get('/tarefas', async (req, res) => {
  try {
    const snapshot = await db.collection('tarefas').get();
    const lista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(lista);
  } catch (err) {
    console.error('Erro ao buscar tarefas:', err);
    res.status(500).json({ error: 'Erro interno ao listar tarefas' });
  }
});

// 4.2) /ordens — lista todas as ordens da coleção "ordens"
app.get('/ordens', async (req, res) => {
  try {
    const snapshot = await db.collection('ordens').get();
    const lista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(lista);
  } catch (err) {
    console.error('Erro ao buscar ordens:', err);
    res.status(500).json({ error: 'Erro interno ao listar ordens' });
  }
});

// 4.3) /agenda — recebe query ?mes=YYYY-MM e retorna o documento "agenda/mes"
app.get('/agenda', async (req, res) => {
  const mes = req.query.mes;
  if (!mes) {
    return res.status(400).json({ error: 'Parametro "mes" é obrigatório (formato YYYY-MM)' });
  }
  try {
    const docRef = db.collection('agenda').doc(mes);
    const docSnap = await docRef.get();
    if (!docSnap.exists) return res.json({});
    res.json(docSnap.data());
  } catch (err) {
    console.error('Erro ao buscar agenda:', err);
    res.status(500).json({ error: 'Erro interno ao listar agenda' });
  }
});

// 5) Exporta tudo como uma única função HTTP chamada "api"
//    Assim, no firebase.json, um rewrite "/api/**" → função "api" fará:
//      GET /api/tarefas    chamar /tarefas
//      GET /api/ordens     chamar /ordens
//      GET /api/agenda?mes consultar /agenda
exports.api = functions.https.onRequest(app);
