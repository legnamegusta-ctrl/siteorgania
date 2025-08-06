// functions/index.js

const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();

// O caminho para a subcoleção de análises, usando wildcards
const analysisPath = "artifacts/{appId}/public/data/clients/{clientId}/" +
  "properties/{propertyId}/plots/{plotId}/culturas/{cultureId}/" +
  "analyses/{analysisId}";

/**
 * Função acionada quando uma nova análise de solo é criada.
 * Incrementa o contador total de análises.
 */
exports.incrementAnalysisCount = functions
    .region("southamerica-east1")
    .firestore
    .document(analysisPath)
    .onCreate(async (snap, context) => {
      const {appId} = context.params;
      const statsRef = db.doc(
          `/artifacts/${appId}/public/data/stats/globalStats`,
      );

      try {
        await statsRef.set({
          totalAnalyses: admin.firestore.FieldValue.increment(1),
        }, {merge: true});
        console.log(`Contador de análises incrementado para o app: ${appId}`);
      } catch (error) {
        console.error("Erro ao incrementar o contador de análises:", error);
      }
    });

/**
 * Função acionada quando uma análise de solo é deletada.
 * Decrementa o contador total de análises.
 */
exports.decrementAnalysisCount = functions
    .region("southamerica-east1")
    .firestore
    .document(analysisPath)
    .onDelete(async (snap, context) => {
      const {appId} = context.params;
      const statsRef = db.doc(
          `/artifacts/${appId}/public/data/stats/globalStats`,
      );

      try {
        await statsRef.update({
          totalAnalyses: admin.firestore.FieldValue.increment(-1),
        });
        console.log(`Contador de análises decrementado para o app: ${appId}`);
      } catch (error) {
        if (error.code === "not-found") {
          console.warn(
              "Documento de estatísticas não encontrado para decrementar.",
          );
          return;
        }
        console.error("Erro ao decrementar o contador de análises:", error);
      }
    });
