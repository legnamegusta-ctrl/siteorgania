// public/js/services/auth.js

// IMPORTADO: 'db' e 'auth' (instÃ¢ncia) de firebase.js
import { auth, db } from '../config/firebase.js';
// IMPORTADO: FunÃ§Ãµes modulares de autenticaÃ§Ã£o e Firestore (passam a instÃ¢ncia 'auth' ou 'db' como primeiro argumento)
import { signInWithEmailAndPassword, signOut } from '/vendor/firebase/9.6.0/firebase-auth.js';
import { doc, getDoc } from '/vendor/firebase/9.6.0/firebase-firestore.js';

// Cache local da role do usuÃ¡rio para suportar modo offline apÃ³s reinÃ­cio do navegador
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

// Importa as funÃ§Ãµes de inicializaÃ§Ã£o de cada pÃ¡gina
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
// NOVO: Importa a funÃ§Ã£o de inicializaÃ§Ã£o do dashboard do operador
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
    console.warn('[auth] JÃ¡ estÃ¡ na index; redirecionamento ignorado. Motivo:', reason);
    return;
  }
  console.log('[auth] Redirecionando para index. Motivo:', reason, { from: here.href, to: target.href });
  window.location.replace(target.href);
}

// Exponibiliza para outros mÃ³dulos
window.safeRedirectToIndex = safeRedirectToIndex;

console.log('auth.js carregado');

\r\n// Helper global para UID persistido (offline)\r\ntry {\r\n  window.getCurrentUid = function(){\r\n    try { return (auth && auth.currentUser && auth.currentUser.uid) || localStorage.getItem('organia:persistUid') || null; }\r\n    catch { return (auth && auth.currentUser && auth.currentUser.uid) || null; }\r\n  };\r\n} catch {}\r\n

document.addEventListener('DOMContentLoaded', () => {
      console.log('[auth] DOMContentLoaded disparado');
      console.log('[auth] diag: isLoginRoute=', isLoginRoute(), 'isLoginDomPresent=', isLoginDomPresent());
      let redirecting = false;\r\n\r\n      // Offline auto-redirect se já existir sessão persistida\r\n      try {\r\n        if (!navigator.onLine) {\r\n          const last = localStorage.getItem('organia:lastDashboard');\r\n          if (auth?.currentUser && last && isOnLoginPage()) {\r\n            console.warn('[auth] Offline com sessao persistida; indo para', last);\r\n            window.location.replace(last);\r\n            return;\r\n          }\r\n        }\r\n      } catch {}\r\n

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
                      console.log('[auth] logout: jÃ¡ na index; sem redirect.');
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
            console.error("Erro na inicializaÃ§Ã£o da pÃ¡gina:", error);
            alert("Ocorreu um erro ao carregar os componentes da pÃ¡gina. Por favor, recarregue.");
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
                    console.warn('[auth] Falha ao obter doc do usuÃ¡rio; usando fallback', err);
                    fetchedFrom = 'error';
                  }

                  // Se nÃ£o obteve role do Firestore, tenta cache local
  

                  // Inferir papel pelo último dashboard salvo (fallback offline)
                  try {
                    const last = localStorage.getItem('organia:lastDashboard');
                    if (last && !userRole) {
                      if (last.includes('admin')) userRole = 'admin';
                      else if (last.includes('agronomo')) userRole = 'agronomo';
                      else if (last.includes('cliente')) userRole = 'cliente';
                      else if (last.includes('operador')) userRole = 'operador';
                    }
                  } catch {}
  }

  // Fallback extra: offline e sem role -> tentar Ãºltimo dashboard conhecido
  if (!userRole && !navigator.onLine) {
    try {
      const last = localStorage.getItem('organia:lastDashboard');
      if (onLoginPage) {
        const fallback = last || 'dashboard-agronomo.html';
        console.warn('[auth] Offline sem role; redirecionando para', fallback);
        window.location.replace(fallback);
        return;
      }
    } catch {}
  }

  if (!userRole) {
    // Sem role e usuÃ¡rio autenticado: nÃ£o desloga automaticamente quando offline
    if (!navigator.onLine) {
      console.warn('[auth] Offline e sem role em cache; mantendo sessÃ£o e pÃ¡gina atual sem redirect.');
      return;
                    }
                    // Online e sem role -> sessÃ£o inconsistente; faz logout seguro
                    console.error('[auth] UsuÃ¡rio autenticado mas sem role. Efetuando logout.');
                    await logout();
                    return;
                  }

                  console.log('[auth] role resolvida:', { userRole, fetchedFrom });\r\n                  // Fallback: sem role e offline -> iniciar página ou redirecionar usando último dashboard\r\n                  if (!userRole && !navigator.onLine) {\r\n                    try {\r\n                      const last = localStorage.getItem('organia:lastDashboard');\r\n                      if (onLoginPage) {\r\n                        const dest = last || 'dashboard-agronomo.html';\r\n                        console.warn('[auth] Offline sem role; redirecionando para', dest);\r\n                        window.location.replace(dest);\r\n                        return;\r\n                      } else {\r\n                        const role = (last && (last.includes('admin') ? 'admin' : last.includes('agronomo') ? 'agronomo' : last.includes('cliente') ? 'cliente' : last.includes('operador') ? 'operador' : 'agronomo')) || 'agronomo';\r\n                        console.warn('[auth] Offline sem role; inicializando página com', role);\r\n                        initializePage(user, role);\r\n                        return;\r\n                      }\r\n                    } catch {}\r\n                  }\r\n

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
                          try { localStorage.setItem('organia:lastDashboard', destination); } catch {}
                          console.log('[auth] redirecionando para', destination);
                          window.location.replace(destination);
                      } else {
                          console.error(`Papel de usuÃ¡rio desconhecido: ${userRole}`);
                          await logout();
                      }
                  } else {
                      console.log('[auth] usuÃ¡rio autenticado, sincronizando dados locais');
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
                      console.log('[auth] dados sincronizados, inicializando pÃ¡gina', userRole);
                      initializePage(user, userRole);
                  }
                  return; // impede executar fluxo anterior (desnecessÃ¡rio)
                }
                const userDoc = await getDoc(userRef);

                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    const userRole = userData.role; // ObtÃ©m o papel do usuÃ¡rio

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
                            try { localStorage.setItem('organia:lastDashboard', destination); } catch {}
                            console.log('[auth] redirecionando para', destination);
                            window.location.replace(destination);
                        } else {
                            console.error(`Papel de usuÃ¡rio desconhecido: ${userRole}`);
                            await logout();
                        }
                    } else {
                        console.log('[auth] usuÃ¡rio autenticado, sincronizando dados locais');
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
                        console.log('[auth] dados sincronizados, inicializando pÃ¡gina', userRole);
                        initializePage(user, userRole);
                    }
                } else {
                    console.error("Documento de usuÃ¡rio nÃ£o encontrado no Firestore. Fazendo logout forÃ§ado.");
                    await logout();
                }
            } else if (!onLoginPage && !redirecting) {
                redirecting = true;
                if (!routeCheck) {
                    safeRedirectToIndex('user-unauthenticated');
                } else {
                    console.log('[auth] UsuÃ¡rio nÃ£o autenticado jÃ¡ na index; sem redirect.');
                }
            }
        } catch (e) {
            console.error('Erro no onAuthStateChanged:', e);
            if (!onLoginPage && !redirecting) {
                redirecting = true;
                if (!routeCheck) {
                    safeRedirectToIndex('onAuthStateChanged-error');
                } else {
                    console.log('[auth] Erro no onAuthStateChanged, mas jÃ¡ na index; sem redirect.');
                }
            }
        }
    });

    if (document.getElementById('loginForm')) {
        document.getElementById('loginForm').addEventListener('submit', handleLogin);
    }
});






