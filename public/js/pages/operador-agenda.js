// public/js/pages/operador-agenda.js

const state = { agenda: {}, currentMonth: new Date() };
const API_BASE = window.location.hostname === 'localhost'
  ? ''
  : 'https://us-central1-app-organia.cloudfunctions.net';

export function initOperadorAgenda(userId, userRole) {
  bindUI();
  loadAgenda();
}

function bindUI() {
  document.getElementById('prevMonth')?.addEventListener('click', () => {
    state.currentMonth.setMonth(state.currentMonth.getMonth() - 1);
    loadAgenda();
  });
  document.getElementById('nextMonth')?.addEventListener('click', () => {
    state.currentMonth.setMonth(state.currentMonth.getMonth() + 1);
    loadAgenda();
  });
  document.getElementById('calendarTable')?.addEventListener('click', e => {
    const cell = e.target.closest('td[data-date]');
    if (cell) openDailyAgenda(cell.dataset.date);
  });
  document.getElementById('closeDailyAgenda')?.addEventListener('click', () => {
    const m = document.getElementById('dailyAgendaModal');
    m?.classList.add('hidden');
    m?.classList.remove('flex');
  });
}

async function loadAgenda() {
  const m = state.currentMonth;
  const mes = `${m.getFullYear()}-${String(m.getMonth()+1).padStart(2,'0')}`;
  try {
    const res = await fetch(`${API_BASE}/api/agenda?mes=${mes}`);
    state.agenda = await res.json();
  } catch {
    state.agenda = {};
  }
  renderCalendar();
}

function renderCalendar() {
  const table = document.getElementById('calendarTable');
  if (!table) return;
  table.innerHTML = '';
  const m = state.currentMonth.getMonth(), y = state.currentMonth.getFullYear();
  const first = new Date(y,m,1), fw = first.getDay();
  const dim = new Date(y,m+1,0).getDate();
  const header = document.createElement('tr');
  ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].forEach(d=>{
    const th = document.createElement('th');
    th.className='p-1 text-xs';
    th.textContent=d;
    header.appendChild(th);
  });
  table.appendChild(header);
  let row=document.createElement('tr');
  for(let i=0;i<fw;i++) row.appendChild(document.createElement('td'));
  for(let day=1;day<=dim;day++){
    if((fw+day-1)%7===0){ table.appendChild(row); row=document.createElement('tr'); }
    const ds=`${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const count=state.agenda[ds]?.length||0;
    const td=document.createElement('td');
    td.className='p-1 border cursor-pointer hover:bg-green-100';
    td.dataset.date=ds;
    td.innerHTML=`<div class="text-xs">${day}</div>${count?`<div class="text-xs text-green-600">${count}</div>`:''}`;
    row.appendChild(td);
  }
  table.appendChild(row);
  const label = document.getElementById('monthLabel');
  if(label) label.textContent = state.currentMonth.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
}

function openDailyAgenda(date){
  const m = document.getElementById('dailyAgendaModal');
  const title = document.getElementById('dailyAgendaTitle');
  const list = document.getElementById('dailyAgendaList');
  if(!m||!title||!list) return;
  title.textContent = new Date(date).toLocaleDateString('pt-BR',{dateStyle:'full'});
  list.innerHTML='';
  (state.agenda[date]||[]).forEach(t=>{
    const li=document.createElement('li');
    li.textContent=t.titulo||t.id;
    list.appendChild(li);
  });
  m.classList.remove('hidden');
  m.classList.add('flex');
}