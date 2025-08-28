// public/js/services/auth.js

import { auth, db } from '../config/firebase.js';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from '/vendor/firebase/9.6.0/firebase-auth.js';
import { doc, getDoc } from '/vendor/firebase/9.6.0/firebase-firestore.js';

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

function safeRedirectToIndex(reason) {
  try {
    const now = Date.now();
    const lastTs = Number(sessionStorage.getItem('lastIndexRedirectTs') || 0);
    if (now - lastTs < 4000) {
      console.warn('[auth] Debounce redirect to index. Reason:', reason);
      return;
    }
    sessionStorage.setItem('lastIndexRedirectTs', String(now));
  } catch {}

  const here = new URL(window.location.href);
  const target = new URL('index.html', here.origin);
  if (here.href === target.href) {
    console.warn('[auth] Already at index; skip redirect. Reason:', reason);
    return;
  }
  console.log('[auth] Redirecting to index. Reason:', reason, { from: here.href, to: target.href });
  window.location.replace(target.href);
}

window.safeRedirectToIndex = safeRedirectToIndex;
console.log('auth.js loaded');

try {
  window.getCurrentUid = function () {
    try {
      return (auth && auth.currentUser && auth.currentUser.uid) || localStorage.getItem('organia:persistUid') || null;
    } catch {
      return (auth && auth.currentUser && auth.currentUser.uid) || null;
    }
  };
} catch {}

function setCachedUserRole(uid, role) {
  try {
    if (uid && role) localStorage.setItem(`organia:userRole:${uid}`, role);
  } catch {}
}

function getCachedUserRole(uid) {
  try {
    return localStorage.getItem(`organia:userRole:${uid}`) || null;
  } catch {
    return null;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('[auth] DOMContentLoaded');
  console.log('[auth] diag:', { isLoginRoute: isLoginRoute(), isLoginDomPresent: isLoginDomPresent() });
  let redirecting = false;

  async function handleLogin(e) {
    e.preventDefault();
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    const email = loginForm?.email?.value || '';
    const password = loginForm?.password?.value || '';

    try {
      console.log('[auth] login attempt', { email });
      showLoader();
      if (loginError) loginError.classList.add('hidden');
      await signInWithEmailAndPassword(auth, email, password);
      console.log('[auth] login success, awaiting onAuthStateChanged');
    } catch (error) {
      console.error('[auth] login error:', error);
      if (loginError) {
        if (error?.code === 'auth/wrong-password' || error?.code === 'auth/user-not-found' || error?.code === 'auth/invalid-credential') {
          loginError.textContent = 'Email ou senha incorretos.';
        } else {
          loginError.textContent = 'Ocorreu um erro. Tente novamente.';
        }
        loginError.classList.remove('hidden');
      }
    } finally {
      hideLoader();
    }
  }

  const logout = async () => {
    console.log('[auth] logout called');
    try {
      showLoader();
      await signOut(auth);
    } catch (error) {
      console.error('[auth] logout error:', error);
    } finally {
      hideLoader();
      if (!redirecting) {
        redirecting = true;
        if (!isLoginRoute()) {
          safeRedirectToIndex('logout');
        } else {
          console.log('[auth] logout: already at index');
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
      } else if (document.getElementById('operador-dashboard-marker')) {
        initOperadorDashboard(user.uid, userRole);
      } else if (document.getElementById('operador-tarefas-marker')) {
        initOperadorTarefas(user.uid, userRole);
      } else if (document.getElementById('operador-agenda-marker')) {
        initOperadorAgenda(user.uid, userRole);
      } else if (document.getElementById('operador-perfil-marker')) {
        initOperadorPerfil(user.uid, userRole);
      }
    } catch (error) {
      console.error('[auth] page init error:', error);
      alert('Erro ao carregar os componentes. Recarregue a página.');
    }
  }

  onAuthStateChanged(auth, async (user) => {
    const routeCheck = isLoginRoute();
    const domCheck = isLoginDomPresent();
    const onLogin = isOnLoginPage();
    console.log('[auth] onAuthStateChanged', { uid: user?.uid, onLogin, isLoginRoute: routeCheck, isLoginDomPresent: domCheck });

    try {
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        let userRole = null;
        let fetchedFrom = 'server';

        try {
          const snap = await getDoc(userRef);
          if (snap.exists()) {
            const data = snap.data();
            userRole = data?.role || null;
            setCachedUserRole(user.uid, userRole);
          } else {
            fetchedFrom = navigator.onLine ? 'server-empty' : 'cache-miss';
          }
        } catch (err) {
          console.warn('[auth] getDoc failed; will try cache', err);
          fetchedFrom = 'error';
        }

        if (!userRole) {
          const cached = getCachedUserRole(user.uid);
          if (cached) {
            userRole = cached;
            fetchedFrom = 'cache';
          }
        }

        if (!userRole) {
          if (!navigator.onLine) {
            try {
              const last = localStorage.getItem('organia:lastDashboard');
              if (onLogin) {
                const dest = last || 'dashboard-agronomo.html';
                console.warn('[auth] offline without role; redirecting to', dest);
                window.location.replace(dest);
                return;
              } else if (last) {
                const role = last.includes('admin') ? 'admin' :
                             last.includes('agronomo') ? 'agronomo' :
                             last.includes('cliente') ? 'cliente' :
                             last.includes('operador') ? 'operador' : 'agronomo';
                console.warn('[auth] offline without role; initializing page with', role);
                initializePage(user, role);
                return;
              }
            } catch {}
            console.warn('[auth] offline without role and no last dashboard; staying put');
            return;
          }

          console.error('[auth] authenticated but no role; logging out');
          await logout();
          return;
        }

        console.log('[auth] role resolved', { userRole, fetchedFrom });

        if (onLogin) {
          const roleToDashboard = {
            admin: 'dashboard-admin.html',
            agronomo: 'dashboard-agronomo.html',
            cliente: 'dashboard-cliente.html',
            operador: 'operador-dashboard.html',
          };
          const destination = roleToDashboard[userRole];
          if (destination) {
            try { localStorage.setItem('organia:lastDashboard', destination); } catch {}
            console.log('[auth] redirecting to', destination);
            window.location.replace(destination);
          } else {
            console.error('[auth] unknown role:', userRole);
            await logout();
          }
        } else {
          console.log('[auth] authenticated; syncing local data');
          await Promise.all([
            syncClientsFromFirestore(),
            syncLeadsFromFirestore(),
            syncAgendaFromFirestore(),
          ]);
          window.addEventListener('online', () => {
            syncClientsFromFirestore();
            syncLeadsFromFirestore();
            syncAgendaFromFirestore();
            getVisits();
          });
          console.log('[auth] data synced; initializing page', userRole);
          initializePage(user, userRole);
        }
      } else if (!onLogin && !redirecting) {
        redirecting = true;
        if (!routeCheck) {
          safeRedirectToIndex('user-unauthenticated');
        } else {
          console.log('[auth] unauthenticated and already at index');
        }
      }
    } catch (e) {
      console.error('[auth] onAuthStateChanged error:', e);
      if (!onLogin && !redirecting) {
        redirecting = true;
        if (!routeCheck) {
          safeRedirectToIndex('onAuthStateChanged-error');
        } else {
          console.log('[auth] error but already at index');
        }
      }
    }
  });

  const form = document.getElementById('loginForm');
  if (form) form.addEventListener('submit', handleLogin);
});

