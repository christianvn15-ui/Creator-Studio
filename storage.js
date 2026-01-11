// Local-first storage with delete support
const KEY = 'creator-storage-v1';

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
  catch { return {}; }
}
function save(data) { localStorage.setItem(KEY, JSON.stringify(data)); }

const state = load();

// Collections
state.notes ??= [];      // {id, title, content, pinned, updatedAt, createdAt}
state.files ??= [];      // {id, name, type, content, updatedAt, createdAt}
state.scenes ??= [];     // {id, data, updatedAt, createdAt}
state.profile ??= { displayName: '', bio: '', pfp: '' };

export function getAll() { return state; }

// Notes
export function listNotes(query = '') {
  const q = query.trim().toLowerCase();
  const arr = [...state.notes].sort((a,b) => (b.pinned - a.pinned) || (b.updatedAt - a.updatedAt));
  return q ? arr.filter(n => (n.title + ' ' + n.content).toLowerCase().includes(q)) : arr;
}
export function getNote(id) { return state.notes.find(n => n.id === id) || null; }
export function addNote({ title = 'Untitled', content = '' }) {
  const id = crypto.randomUUID();
  const now = Date.now();
  const note = { id, title, content, pinned: 0, createdAt: now, updatedAt: now };
  state.notes.push(note); save(state); return note;
}
export function updateNote(id, patch) {
  const n = getNote(id); if (!n) return null;
  Object.assign(n, patch, { updatedAt: Date.now() }); save(state); return n;
}
export function deleteNote(id) {
  state.notes = state.notes.filter(n => n.id !== id); save(state);
}

// Files
export function listFiles() {
  return [...state.files].sort((a,b) => b.updatedAt - a.updatedAt);
}
export function getFile(id) { return state.files.find(f => f.id === id) || null; }
export function addFile({ name, type, content }) {
  const id = crypto.randomUUID();
  const now = Date.now();
  const file = { id, name, type, content, createdAt: now, updatedAt: now };
  state.files.push(file); save(state); return file;
}
export function updateFile(id, patch) {
  const f = getFile(id); if (!f) return null;
  Object.assign(f, patch, { updatedAt: Date.now() }); save(state); return f;
}
export function deleteFile(id) {
  state.files = state.files.filter(f => f.id !== id); save(state);
}

// Scenes
export function listScenes() { return [...state.scenes].sort((a,b) => b.updatedAt - a.updatedAt); }
export function addScene(data) {
  const id = crypto.randomUUID();
  const now = Date.now();
  const scene = { id, data, createdAt: now, updatedAt: now };
  state.scenes.push(scene); save(state); return scene;
}

// Profile
export function saveProfile(patch) {
  Object.assign(state.profile, patch); save(state);
}
export function getProfile() { return state.profile; }