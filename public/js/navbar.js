(function () {
  if (!document.querySelector('link[href*="font-awesome"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css';
    document.head.appendChild(link);
  }

  const existingHeader = document.querySelector('body > header');
  if (existingHeader) existingHeader.remove();

  const roleMap = {
    'dashboard-admin.html': 'admin',
    'formulas-admin.html': 'admin',
    'client-details.html': 'admin',
    'client-list.html': 'admin',
    'task-viewer.html': 'admin',
    'dashboard-agronomo.html': 'agronomo',
    'agronomo-farm.html': 'agronomo',
    'agenda.html': 'agronomo',
    'mapa-agronomo.html': 'agronomo',
    'mapa-geral.html': 'agronomo',
    'relatorio-talhao.html': 'agronomo',
    'plot-details.html': 'agronomo',
    'dashboard-cliente.html': 'cliente',
    'property-details.html': 'cliente',
    'property-employees.html': 'cliente',
    'activity-details.html': 'cliente',
    'ordens-producao.html': 'cliente',
    'operador-dashboard.html': 'operador',
    'operador-agenda.html': 'operador',
    'operador-ordens.html': 'operador',
    'operador-perfil.html': 'operador',
    'operador-tarefas.html': 'operador'
  };

  const linksByRole = {
    admin: [
      { href: '/dashboard-admin.html', label: 'Dashboard' },
      { href: '/client-list.html', label: 'Clientes' },
      { href: '/property-details.html', label: 'Propriedades' },
      { href: '/formulas-admin.html', label: 'Fórmulas' }
    ],
    agronomo: [
      { href: '/dashboard-agronomo.html', label: 'Dashboard' },
      { href: '/agenda.html', label: 'Agenda' },
      { href: '/agronomo-farm.html', label: 'Fazenda' },
      { href: '/mapa-agronomo.html', label: 'Mapa' }
    ],
    cliente: [
      { href: '/dashboard-cliente.html', label: 'Dashboard' },
      { href: '/property-details.html', label: 'Propriedades' },
      { href: '/ordens-producao.html', label: 'Ordens' }
    ],
    operador: [
      { href: '/operador-dashboard.html', label: 'Dashboard' },
      { href: '/operador-agenda.html', label: 'Agenda' },
      { href: '/operador-ordens.html', label: 'Ordens' },
      { href: '/operador-tarefas.html', label: 'Tarefas' },
      { href: '/operador-perfil.html', label: 'Perfil' }
    ],
    guest: []
  };

  const file = window.location.pathname.split('/').pop();
  const role = roleMap[file] || 'guest';
  const nav = document.createElement('header');
  nav.className = 'navbar';
  nav.innerHTML = `
    <div class="navbar-container">
      <a href="/index.html" class="navbar-logo"><img src="logo.png" alt="Orgânia"></a>
      <nav class="navbar-links"></nav>
      <div class="navbar-icons">
        <i class="fas fa-bell"></i>
      </div>
    </div>
    <nav class="breadcrumbs" aria-label="Breadcrumb"></nav>
  `;

  const linksContainer = nav.querySelector('.navbar-links');
  linksByRole[role].forEach(({ href, label }) => {
    const link = document.createElement('a');
    link.href = href;
    link.textContent = label;
    linksContainer.appendChild(link);
  });

  document.body.prepend(nav);

  const breadcrumb = nav.querySelector('.breadcrumbs');
  const homeLink = document.createElement('a');
  homeLink.href = '/index.html';
  homeLink.textContent = 'Home';
  breadcrumb.appendChild(homeLink);
  breadcrumb.appendChild(document.createTextNode('/ '));
  const current = document.createElement('span');
  current.textContent = document.title;
  breadcrumb.appendChild(current);
})();