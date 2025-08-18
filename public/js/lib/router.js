export function handleHashChange(hash, doc = document) {
  const dash = doc.getElementById('dashboard');
  const order = doc.getElementById('order-view');
  const task = doc.getElementById('task-view');
  [dash, order, task].forEach(el => el && el.classList.add('hidden'));
  if (hash.startsWith('#order/')) {
    if (order) order.classList.remove('hidden');
  } else if (hash.startsWith('#task/')) {
    if (task) task.classList.remove('hidden');
  } else {
    if (dash) dash.classList.remove('hidden');
  }
}
