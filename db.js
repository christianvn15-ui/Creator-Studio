// Simple IndexedDB wrapper for projects, notes, files, scenes, profile
const DB_NAME = 'creator-studio';
const DB_VERSION = 1;

let dbPromise;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      if (!db.objectStoreNames.contains('projects')) {
        db.createObjectStore('projects', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('notes')) {
        const store = db.createObjectStore('notes', { keyPath: 'id' });
        store.createIndex('byProject', 'projectId', { unique: false });
      }
      if (!db.objectStoreNames.contains('files')) {
        const store = db.createObjectStore('files', { keyPath: 'id' });
        store.createIndex('byProject', 'projectId', { unique: false });
      }
      if (!db.objectStoreNames.contains('scenes')) {
        const store = db.createObjectStore('scenes', { keyPath: 'id' });
        store.createIndex('byProject', 'projectId', { unique: false });
      }
      if (!db.objectStoreNames.contains('profile')) {
        db.createObjectStore('profile', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx(storeName, mode = 'readonly') {
  const db = await openDB();
  const t = db.transaction(storeName, mode);
  return t.objectStore(storeName);
}

// Projects
export async function addProject(title) {
  const id = crypto.randomUUID();
  const project = { id, title, createdAt: Date.now() };
  const store = await tx('projects', 'readwrite');
  store.put(project);
  return project;
}
export async function listProjects() {
  const store = await tx('projects');
  return new Promise((resolve) => {
    const out = [];
    store.openCursor().onsuccess = (e) => {
      const cur = e.target.result;
      if (cur) { out.push(cur.value); cur.continue(); } else { resolve(out); }
    };
  });
}

// Notes
export async function addNote(projectId, title, content) {
  const id = crypto.randomUUID();
  const note = { id, projectId, title, content, createdAt: Date.now() };
  const store = await tx('notes', 'readwrite');
  store.put(note);
  return note;
}
export async function listNotes(projectId) {
  const store = await tx('notes');
  const idx = store.index('byProject');
  return new Promise((resolve) => {
    const out = [];
    idx.openCursor(IDBKeyRange.only(projectId)).onsuccess = (e) => {
      const cur = e.target.result;
      if (cur) { out.push(cur.value); cur.continue(); } else { resolve(out); }
    };
  });
}

// Files
export async function addFile(projectId, name, type, content) {
  const id = crypto.randomUUID();
  const file = { id, projectId, name, type, content, createdAt: Date.now() };
  const store = await tx('files', 'readwrite');
  store.put(file);
  return file;
}
export async function listFiles(projectId) {
  const store = await tx('files');
  const idx = store.index('byProject');
  return new Promise((resolve) => {
    const out = [];
    idx.openCursor(IDBKeyRange.only(projectId)).onsuccess = (e) => {
      const cur = e.target.result;
      if (cur) { out.push(cur.value); cur.continue(); } else { resolve(out); }
    };
  });
}
export async function listAllFiles() {
  const store = await tx('files');
  return new Promise((resolve) => {
    const out = [];
    store.openCursor().onsuccess = (e) => {
      const cur = e.target.result;
      if (cur) { out.push(cur.value); cur.continue(); } else { resolve(out); }
    };
  });
}

// Scenes
export async function saveScene(projectId, data) {
  const id = crypto.randomUUID();
  const scene = { id, projectId, data, createdAt: Date.now() };
  const store = await tx('scenes', 'readwrite');
  store.put(scene);
  return scene;
}
export async function listScenes(projectId) {
  const store = await tx('scenes');
  const idx = store.index('byProject');
  return new Promise((resolve) => {
    const out = [];
    idx.openCursor(IDBKeyRange.only(projectId)).onsuccess = (e) => {
      const cur = e.target.result;
      if (cur) { out.push(cur.value); cur.continue(); } else { resolve(out); }
    };
  });
}
export async function listAllScenes() {
  const store = await tx('scenes');
  return new Promise((resolve) => {
    const out = [];
    store.openCursor().onsuccess = (e) => {
      const cur = e.target.result;
      if (cur) { out.push(cur.value); cur.continue(); } else { resolve(out); }
    };
  });
}

// Profile
export async function saveProfile(profile) {
  const store = await tx('profile', 'readwrite');
  store.put({ id: 'me', ...profile });
}
export async function getProfile() {
  const store = await tx('profile');
  return new Promise((resolve) => {
    const req = store.get('me');
    req.onsuccess = () => resolve(req.result || null);
  });
}