const KEY = 'agro.properties';

export function getProperties() {
  return JSON.parse(localStorage.getItem(KEY) || '[]');
}

export function addProperty(property) {
  const props = getProperties();
  const now = new Date().toISOString();
  const newProp = {
    id: Date.now().toString(36),
    createdAt: now,
    updatedAt: now,
    ...property
  };
  props.push(newProp);
  localStorage.setItem(KEY, JSON.stringify(props));
  return newProp;
}
