// Basic UI interactions
(function(){
  const html = document.documentElement;
  const storedTheme = localStorage.getItem('theme');
  if (storedTheme) html.dataset.theme = storedTheme;

  document.querySelectorAll('[data-theme-toggle]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const next = html.dataset.theme === 'dark' ? 'light' : 'dark';
      html.dataset.theme = next;
      localStorage.setItem('theme', next);
    });
  });

  // Drawer toggle
  document.querySelectorAll('[data-drawer-target]').forEach(btn=>{
    const target = document.getElementById(btn.dataset.drawerTarget);
    const overlay = document.createElement('div');
    overlay.className = 'drawer__overlay';
    target.after(overlay);
    function close(){target.dataset.open='false'; overlay.remove(); btn.focus();}
    btn.addEventListener('click',()=>{target.dataset.open='true'; document.body.appendChild(overlay); overlay.addEventListener('click',close);});
    document.addEventListener('keydown',e=>{if(e.key==='Escape' && target.dataset.open==='true') close();});
  });

  // Modal
  document.querySelectorAll('[data-modal-trigger]').forEach(btn=>{
    const modal = document.getElementById(btn.dataset.modalTrigger);
    const focusable = modal.querySelectorAll('a,button,input,textarea,select,[tabindex]:not([tabindex="-1"])');
    const first = focusable[0];
    const last = focusable[focusable.length-1];
    function trap(e){
      if(e.key==='Tab'){
        if(e.shiftKey && document.activeElement===first){e.preventDefault();last.focus();}
        else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first.focus();}
      }
      if(e.key==='Escape') close();
    }
    function open(){modal.dataset.open='true';first.focus();document.addEventListener('keydown',trap);}
    function close(){modal.dataset.open='false';btn.focus();document.removeEventListener('keydown',trap);}
    btn.addEventListener('click',open);
    modal.addEventListener('click',e=>{if(e.target===modal) close();});
    modal.querySelectorAll('[data-close]').forEach(c=>c.addEventListener('click',close));
  });

  // Tabs
  document.querySelectorAll('.tabs').forEach(tablist=>{
    const tabs = tablist.querySelectorAll('button');
    const panels = tablist.nextElementSibling.querySelectorAll('[role="tabpanel"]');
    tabs.forEach((tab,i)=>{
      tab.addEventListener('click',()=>{
        tabs.forEach(t=>t.setAttribute('aria-selected','false'));
        panels.forEach(p=>p.setAttribute('aria-hidden','true'));
        tab.setAttribute('aria-selected','true');
        panels[i].setAttribute('aria-hidden','false');
      });
    });
  });

  // Accordion
  document.querySelectorAll('.accordion').forEach(acc=>{
    acc.querySelectorAll('button').forEach(btn=>{
      const panel = btn.nextElementSibling;
      btn.addEventListener('click',()=>{
        const open = btn.parentElement.dataset.open === 'true';
        acc.querySelectorAll('[data-open]').forEach(e=>e.dataset.open='false');
        if(!open){btn.parentElement.dataset.open='true';}
      });
    });
  });

  // Toast helper
  window.showToast = function(msg,type='info'){
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(()=>{toast.remove();},4000);
  };
})();