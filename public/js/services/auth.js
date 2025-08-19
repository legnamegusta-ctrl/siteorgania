// public/js/services/auth.js

// IMPORTADO: 'db' e 'auth' (instância) de firebase.js
import { auth, db } from '../config/firebase.js';
// IMPORTADO: Funções modulares de autenticação e Firestore (passam a instância 'auth' ou 'db' como primeiro argumento)
import { signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';

// Importa as funções de inicialização de cada página
import { initAdminDashboard } from '../pages/dashboard-admin.js';
import { initFormulasAdmin } from '../pages/formulas-admin.js';
import { initAgronomoDashboard } from '../pages/dashboard-agronomo.js';
import { initClienteDashboard } from '../pages/dashboard-cliente.js';
import { initClientDetails } from '../pages/client-details.js';
import { initPropertyDetails } from '../pages/property-details.js';
import { initPlotDetails } from '../pages/plot-details.js';
import { initPlotReport } from '../pages/plot-report.js';
import { initTaskViewer } from '../pages/task-viewer.js';
import { initProductionOrders } from '../pages/ordens-producao.js';
import { setupNotifications } from './notifications.js';
import { initMapaGeral } from '../pages/mapa-geral.js';
import { initMapaAgronomo } from '../pages/mapa-agronomo.js';
import { initClientList } from '../pages/client-list.js';
import { initAgenda } from '../pages/agenda.js';
// NOVO: Importa a função de inicialização do dashboard do operador
import { initOperadorDashboard } from '../pages/operador-dashboard.js';
import { initActivityDetails } from '../pages/activity-details.js';
import { initOperadorTarefas } from '../pages/operador-tarefas.js';
import { initOperadorAgenda } from '../pages/operador-agenda.js';
import { initOperadorPerfil } from '../pages/operador-perfil.js';
import { showLoader, hideLoader } from './ui.js';

console.log('auth.js carregado');
console.log('[auth] página atual:', window.location.href);

document.addEventListener('DOMContentLoaded', () => {
      let redirecting = false;

      const isOnIndex = () =>
          window.location.pathname.endsWith('index.html') || window.location.pathname === '/';

      async function handleLogin(e) {
          e.preventDefault();
          const loginForm = document.getElementById('loginForm');
          const loginError = document.getElementById('loginError');
          const email = loginForm.email.value;
          const password = loginForm.password.value;

          try {
              showLoader();
              loginError.classList.add('hidden');
              // SINTAXE CORRIGIDA FIREBASE V9 AUTH: passa 'auth' como primeiro argumento
              await signInWithEmailAndPassword(auth, email, password);
          } catch (error) {
              console.error("Erro de login detalhado:", error);

              if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
                  loginError.textContent = 'Email ou senha incorretos.';
              } else {
                  loginError.textContent = 'Ocorreu um erro. Tente novamente.';
              }
              loginError.classList.remove('hidden');
          } finally {
              hideLoader();
          }
      }

      const logout = async () => {
          console.log('[auth] logout chamado');
          try {
              showLoader();
              // SINTAXE CORRIGIDA FIREBASE V9 AUTH: passa 'auth' como primeiro argumento
              await signOut(auth);
          } catch (error) {
              console.error('Erro ao fazer logout:', error);
          } finally {
              hideLoader();
              if (!redirecting) {
                  redirecting = true;
                  if (!isOnIndex()) {
                      console.log('[auth] redirecionando para index após logout');
                      window.location.replace('index.html');
                  } else {
                      console.log('[auth] já está na index, sem redirecionar');
                  }
              }
          }
      };

    window.logout = logout;

    function initializePage(user, userRole) {
        setupNotifications(user.uid);

        try {
            if (document.getElementById('dashboard-admin-marker')) {
                initAdminDashboard(user.uid, userRole);
            } else if (document.getElementById('formulas-admin-marker')) {
                initFormulasAdmin(user.uid, userRole);
            } else if (document.getElementById('production-orders-marker')) {
                initProductionOrders(user.uid, userRole);
            } else if (document.getElementById('dashboard-agronomo-marker')) {
                initAgronomoDashboard(user.uid, userRole);
            } else if (document.getElementById('dashboard-cliente-marker')) {
                initClienteDashboard(user.uid, userRole);
            } else if (document.getElementById('client-details-marker')) {
                initClientDetails(user.uid, userRole);
            } else if (document.getElementById('property-details-marker')) {
                initPropertyDetails(user.uid, userRole);
            } else if (document.getElementById('plot-details-marker')) {
                initPlotDetails(user.uid, userRole);
            } else if (document.getElementById('plot-report-marker')) {
                initPlotReport(user.uid, userRole);
                 } else if (document.getElementById('activity-details-marker')) {
                initActivityDetails(user.uid, userRole);
            } else if (document.getElementById('task-viewer-marker')) {
                initTaskViewer(user.uid, userRole);
            } else if (document.getElementById('mapa-geral-marker')) {
                initMapaGeral(user.uid, userRole);
            } else if (document.getElementById('mapa-agronomo-marker')) {
                initMapaAgronomo(user.uid, userRole);
            } else if (document.getElementById('client-list-marker')) {
                initClientList(user.uid, userRole);
            } else if (document.getElementById('agenda-marker')) {
                initAgenda(user.uid, userRole);
            }
            // NOVO: Inicializa o dashboard do operador
            else if (document.getElementById('operador-dashboard-marker')) {
                initOperadorDashboard(user.uid, userRole);
            } else if (document.getElementById('operador-tarefas-marker')) {
                initOperadorTarefas(user.uid, userRole);
            } else if (document.getElementById('operador-agenda-marker')) {
                initOperadorAgenda(user.uid, userRole);
            } else if (document.getElementById('operador-perfil-marker')) {
                initOperadorPerfil(user.uid, userRole);
            }
        } catch (error) {
            console.error("Erro na inicialização da página:", error);
            alert("Ocorreu um erro ao carregar os componentes da página. Por favor, recarregue.");
        }
    }

    auth.onAuthStateChanged(async (user) => {
        const onLoginPage = !!document.getElementById('loginForm');
        console.log('[auth] onAuthStateChanged disparado', { uid: user?.uid, onLoginPage });

        try {
            if (user) {
                // USANDO O 'db' IMPORTADO DIRETAMENTE DE 'firebase.js'
                const userRef = doc(db, 'users', user.uid);
                const userDoc = await getDoc(userRef);

                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    const userRole = userData.role; // Obtém o papel do usuário

                    if (onLoginPage) {
                        const roleToDashboard = {
                            admin: 'dashboard-admin.html',
                            agronomo: 'dashboard-agronomo.html',
                            cliente: 'dashboard-cliente.html',
                            // NOVO: Adiciona o roteamento para o papel 'operador'
                            operador: 'operador-dashboard.html'
                        };

                        const destination = roleToDashboard[userRole];
                        if (destination) {
                            console.log('[auth] redirecionando para', destination);
                            window.location.replace(destination);
                        } else {
                            console.error(`Papel de usuário desconhecido: ${userRole}`);
                            await logout();
                        }
                    } else {
                        console.log('[auth] usuário autenticado, inicializando página', userRole);
                        initializePage(user, userRole);
                    }
                } else {
                    console.error("Documento de usuário não encontrado no Firestore. Fazendo logout forçado.");
                    await logout();
                }
            } else if (!onLoginPage && !redirecting) {
                redirecting = true;
                if (!isOnIndex()) {
                    console.log('[auth] usuário não autenticado, redirecionando para index');
                    window.location.replace('index.html');
                } else {
                    console.log('[auth] usuário não autenticado já está na index');
                }
            }
        } catch (e) {
            console.error('Erro no onAuthStateChanged:', e);
            if (!onLoginPage && !redirecting) {
                redirecting = true;
                if (!isOnIndex()) {
                    console.log('[auth] erro no onAuthStateChanged, redirecionando para index');
                    window.location.replace('index.html');
                } else {
                    console.log('[auth] erro no onAuthStateChanged, já na index');
                }
            }
        }
    });

    if (document.getElementById('loginForm')) {
        document.getElementById('loginForm').addEventListener('submit', handleLogin);
    }
});
