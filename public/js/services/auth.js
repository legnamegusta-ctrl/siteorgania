// public/js/services/auth.js

// IMPORTADO: 'db' e 'auth' (instância) de firebase.js
import { auth, db } from '../config/firebase.js';
// IMPORTADO: Funções modulares de autenticação e Firestore (passam a instância 'auth' ou 'db' como primeiro argumento)
import { signInWithEmailAndPassword, signOut } from '/vendor/firebase/9.6.0/firebase-auth.js';
import { doc, getDoc } from '/vendor/firebase/9.6.0/firebase-firestore.js';

// Cache local da role do usuário para suportar modo offline após reinício do navegador
function getCachedUserRole(uid) {
  try {
    return localStorage.getItem(`organia:userRole:${uid}`) || null;
  } catch {
    return null;
  }
}

function setCachedUserRole(uid, role) {
  try {
    if (uid && role) localStorage.setItem(`organia:userRole:${uid}`, role);
  } catch {}
}

// Importa as funções de inicialização de cada página
import { initAdminDashboard } from '../pages/dashboard-admin.js';
import { initFormulasAdmin } from '../pages/formulas-admin.js';
import { initAgronomoDashboard } from '../pages/dashboard-agronomo.js';
import { initClienteDashboard } from '../pages/dashboard-cliente.js';
import { initClientDetails } from '../pages/client-details.js';
import { initLeadDetails } from '../pages/lead-details.js';
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
import { syncClientsFromFirestore } from '../stores/clientsStore.js';
import { syncLeadsFromFirestore } from '../stores/leadsStore.js';
import { syncAgendaFromFirestore } from '../stores/agendaStore.js';
import { getVisits } from '../stores/visitsStore.js';

// ===== Detectores robustos de "tela de login" e redirect seguro =====
function isLoginRoute() {
  try {
    const p = new URL(window.location.href).pathname.replace(/\/+$/, '/');
    return p === '/' || p.endsWith('/index.html');
  } catch {
    return false;
  }
}

function isLoginDomPresent() {
  return !!document.getElementById('loginForm') ||
         (document.body && document.body.dataset && document.body.dataset.page === 'login');
}

function isOnLoginPage() {
  return isLoginRoute() || isLoginDomPresent();
}

// Evita redirecionar em loop para a mesma URL e cria um "debounce" temporal
function safeRedirectToIndex(reason) {
  try {
    const now = Date.now();
    const lastTs = Number(sessionStorage.getItem('lastIndexRedirectTs') || 0);
    if (now - lastTs < 4000) {
      console.warn('[auth] Bloqueado redirect repetido para index (debounce). Motivo:', reason);
      return;
    }
    sessionStorage.setItem('lastIndexRedirectTs', String(now));
  } catch {}

  const here = new URL(window.location.href);
  const target = new URL('index.html', here.origin);
  if (here.href === target.href) {
    console.warn('[auth] Já está na index; redirecionamento ignorado. Motivo:', reason);
    return;
  }
  console.log('[auth] Redirecionando para index. Motivo:', reason, { from: here.href, to: target.href });
  window.location.replace(target.href);
}

// Exponibiliza para outros módulos
window.safeRedirectToIndex = safeRedirectToIndex;

console.log('auth.js carregado');
console.log('[auth] página atual:', window.location.href);

document.addEventListener('DOMContentLoaded', () => {
      console.log('[auth] DOMContentLoaded disparado');
      console.log('[auth] diag: isLoginRoute=', isLoginRoute(), 'isLoginDomPresent=', isLoginDomPresent());
      let redirecting = false;

        async function handleLogin(e) {
            e.preventDefault();
            const loginForm = document.getElementById('loginForm');
            const loginError = document.getElementById('loginError');
            const email = loginForm.email.value;
            const password = loginForm.password.value;

            try {
                console.log('[auth] tentativa de login iniciada', { email });
                showLoader();
                loginError.classList.add('hidden');
                // SINTAXE CORRIGIDA FIREBASE V9 AUTH: passa 'auth' como primeiro argumento
                await signInWithEmailAndPassword(auth, email, password);
                console.log('[auth] login bem-sucedido, aguardando onAuthStateChanged');
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
                  if (!isLoginRoute()) {
                      safeRedirectToIndex('logout');
                  } else {
                      console.log('[auth] logout: já na index; sem redirect.');
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
            } else if (document.getElementById('lead-details-marker')) {
                initLeadDetails(user.uid, userRole);
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
        const routeCheck = isLoginRoute();
        const domCheck = isLoginDomPresent();
        const onLoginPage = isOnLoginPage();
        console.log('[auth] onAuthStateChanged disparado', { uid: user?.uid, onLoginPage, isLoginRoute: routeCheck, isLoginDomPresent: domCheck });

        try {
            if (user) {
                // USANDO O 'db' IMPORTADO DIRETAMENTE DE 'firebase.js'
                const userRef = doc(db, 'users', user.uid);
                // NOVO: fluxo robusto com cache local e suporte offline
                {
                  let userRole = null;
                  let fetchedFrom = 'server';
                  try {
                    const snap = await getDoc(userRef);
                    if (snap.exists()) {
                      const userData = snap.data();
                      userRole = userData?.role || null;
                      // Cacheia para uso offline futuro
                      setCachedUserRole(user.uid, userRole);
                    } else {
                      fetchedFrom = navigator.onLine ? 'server-empty' : 'cache-miss';
                    }
                  } catch (err) {
                    console.warn('[auth] Falha ao obter doc do usuário; usando fallback', err);
                    fetchedFrom = 'error';
                  }

                  // Se não obteve role do Firestore, tenta cache local
                  if (!userRole) {
                    const cached = getCachedUserRole(user.uid);
                    if (cached) {
                      userRole = cached;
                      fetchedFrom = fetchedFrom + '+localCache';
                    }
                  }

                  if (!userRole) {
                    // Sem role e usuário autenticado: não desloga automaticamente quando offline
                    if (!navigator.onLine) {
                      console.warn('[auth] Offline e sem role em cache; mantendo sessão e página atual sem redirect.');
                      return;
                    }
                    // Online e sem role -> sessão inconsistente; faz logout seguro
                    console.error('[auth] Usuário autenticado mas sem role. Efetuando logout.');
                    await logout();
                    return;
                  }

                  console.log('[auth] role resolvida:', { userRole, fetchedFrom });

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
                      console.log('[auth] usuário autenticado, sincronizando dados locais');
                      await Promise.all([
                        syncClientsFromFirestore(),
                        syncLeadsFromFirestore(),
                        syncAgendaFromFirestore(),
                      ]);
                      // Re-sincroniza automaticamente quando voltar online
                      window.addEventListener('online', () => {
                        syncClientsFromFirestore();
                        syncLeadsFromFirestore();
                        syncAgendaFromFirestore();
                        // visitas sincronizam dentro de getVisits()
                        getVisits();
                      });
                      console.log('[auth] dados sincronizados, inicializando página', userRole);
                      initializePage(user, userRole);
                  }
                  return; // impede executar fluxo anterior (desnecessário)
                }
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
                        console.log('[auth] usuário autenticado, sincronizando dados locais');
                        await Promise.all([
                          syncClientsFromFirestore(),
                          syncLeadsFromFirestore(),
                          syncAgendaFromFirestore(),
                        ]);
                        // Re-sincroniza automaticamente quando voltar online
                        window.addEventListener('online', () => {
                          syncClientsFromFirestore();
                          syncLeadsFromFirestore();
                          syncAgendaFromFirestore();
                          // visitas sincronizam dentro de getVisits()
                          getVisits();
                        });
                        console.log('[auth] dados sincronizados, inicializando página', userRole);
                        initializePage(user, userRole);
                    }
                } else {
                    console.error("Documento de usuário não encontrado no Firestore. Fazendo logout forçado.");
                    await logout();
                }
            } else if (!onLoginPage && !redirecting) {
                redirecting = true;
                if (!routeCheck) {
                    safeRedirectToIndex('user-unauthenticated');
                } else {
                    console.log('[auth] Usuário não autenticado já na index; sem redirect.');
                }
            }
        } catch (e) {
            console.error('Erro no onAuthStateChanged:', e);
            if (!onLoginPage && !redirecting) {
                redirecting = true;
                if (!routeCheck) {
                    safeRedirectToIndex('onAuthStateChanged-error');
                } else {
                    console.log('[auth] Erro no onAuthStateChanged, mas já na index; sem redirect.');
                }
            }
        }
    });

    if (document.getElementById('loginForm')) {
        document.getElementById('loginForm').addEventListener('submit', handleLogin);
    }
});
