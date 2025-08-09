(function () {
  if (!document.querySelector('link[href*="font-awesome"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css';
    document.head.appendChild(link);
  }

  const existingHeader = document.querySelector('body > header');
  if (existingHeader) existingHeader.remove();

  const nav = document.createElement('header');
  nav.className = 'navbar';
  nav.innerHTML = `
    <div class="navbar-container">
      <a href="index.html" class="navbar-logo"><img src="logo.png" alt="Orgânia"></a>
      <nav class="navbar-links">
        <a href="dashboard-cliente.html">Dashboard</a>
        <a href="client-list.html">Clientes</a>
        <a href="property-details.html">Propriedades</a>
      </nav>
      <div class="navbar-icons">
        <i class="fas fa-bell"></i>
      </div>
    </div>
    <nav class="breadcrumbs" aria-label="Breadcrumb"></nav>
  `;

  document.body.prepend(nav);

  const breadcrumb = nav.querySelector('.breadcrumbs');
  const homeLink = document.createElement('a');
  homeLink.href = 'index.html';
  homeLink.textContent = 'Home';
  breadcrumb.appendChild(homeLink);
  breadcrumb.appendChild(document.createTextNode('/ '));
  const current = document.createElement('span');
  current.textContent = document.title;
  breadcrumb.appendChild(current);
})();