// js/pages/mapa-geral.js

import { db } from '../config/firebase.js';
import { showSpinner, hideSpinner } from '../services/ui.js';

export function initMapaGeral(userId, userRole) {
    const mapContainer = document.getElementById('mapaGeral');
    let map = null;

    async function loadAllProperties() {
        showSpinner(mapContainer);

        try {
            // A consulta para buscar todas as 'properties' que possuem coordenadas está correta
            const propertiesSnapshot = await db.collectionGroup('properties')
                .where('coordenadas', '!=', null)
                .get();

            hideSpinner(mapContainer);

            if (propertiesSnapshot.empty) {
                mapContainer.innerHTML = '<p class="text-center text-gray-500 p-8">Nenhuma propriedade com coordenadas cadastradas foi encontrada.</p>';
                return;
            }

            initializeMap();

            // Para otimizar, primeiro coletamos os IDs de todos os clientes únicos
            const clientIds = new Set();
            propertiesSnapshot.forEach(doc => {
                const clientId = doc.ref.parent.parent.id;
                clientIds.add(clientId);
            });

            // Agora, buscamos os dados de todos os clientes necessários de uma só vez
            const clientPromises = Array.from(clientIds).map(id => db.collection('clients').doc(id).get());
            const clientDocs = await Promise.all(clientPromises);
            const clientsMap = new Map(clientDocs.map(doc => [doc.id, doc.data().name]));

            // Finalmente, iteramos sobre as propriedades para adicionar os marcadores no mapa
            propertiesSnapshot.forEach(doc => {
                const property = doc.data();
                const clientId = doc.ref.parent.parent.id; // Maneira correta de obter o ID do cliente
                const clientName = clientsMap.get(clientId) || 'Cliente não identificado';

                const { latitude, longitude } = property.coordenadas;
                
                if (latitude && longitude) {
                    const marker = L.marker([latitude, longitude]).addTo(map);
                    
                    // MODIFICADO: Conteúdo do pop-up mais rico
                    let popupContent = `<b>${property.name}</b><br>`;
                    popupContent += `Cliente: ${clientName}<br>`;
                    if (property.area && property.area > 0) {
                        popupContent += `Área: ${property.area} ha<br>`;
                    }
                    // Adiciona um link para os detalhes do cliente/propriedade (se houver um ID de cliente válido)
                    if (clientId) {
                        popupContent += `<a href="client-details.html?clientId=${clientId}&from=admin" target="_blank" class="text-blue-600 hover:underline mt-1 block">Ver Detalhes do Cliente</a>`;
                        // Se quisermos um link direto para a propriedade, precisaremos de mais dados na consulta
                        // ou de um Collection Group para "properties" que inclua o nome do cliente.
                        // Por enquanto, o link para o cliente é mais simples e funcional.
                    }

                    marker.bindPopup(popupContent);
                }
            });

        } catch (error) {
            console.error("Erro ao carregar propriedades no mapa:", error);
            hideSpinner(mapContainer);
            mapContainer.innerHTML = '<p class="text-center text-red-500 p-8">Ocorreu um erro ao carregar os dados do mapa.</p>';
        }
    }

    function initializeMap() {
        if (map) return;
        map = L.map('mapaGeral').setView([-14.235, -51.925], 4); // Centro do Brasil
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
    }

    loadAllProperties();
}