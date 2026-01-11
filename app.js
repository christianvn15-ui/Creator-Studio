import {
  listNotes, addNote, updateNote, deleteNote, getNote,
  listFiles, addFile, updateFile, deleteFile,
  listScenes, addScene,
  saveProfile, getProfile
} from './storage.js';

// Router
const tabs = document.querySelectorAll('.tab:not(.small)');
const pages = document.querySelectorAll('.page');
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const pageId = 'page-' + tab.dataset.page;
    pages.forEach(p => p.classList.toggle('active', p.id === pageId));
    if (pageId === 'page-sandbox' && !threeReady) init3D();
  });
});

// PWA install prompt
let deferredPrompt;
const installBtn = document.getElementById('installBtn');
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.style.display = 'inline-block';
});
installBtn.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBtn.style.display = 'none';
});

// Service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}

/* ---------------- AI Planner ---------------- */
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const chatLog = document.getElementById('chatLog');
const openaiKey = document.getElementById('openaiKey');
const openaiModel = document.getElementById('openaiModel');
const saveAiSettings = document.getElementById('saveAiSettings');

const aiSettings = JSON.parse(localStorage.getItem('ai-settings') || '{}');
openaiKey.value = aiSettings.key || '';
openaiModel.value = aiSettings.model || 'gpt-4o-mini';
saveAiSettings.addEventListener('click', () => {
  localStorage.setItem('ai-settings', JSON.stringify({ key: openaiKey.value, model: openaiModel.value }));
});

function addChatBubble(text, role = 'user') {
  const div = document.createElement('div');
  div.className = 'bubble ' + role;
  div.innerHTML = text;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
}
function localPlan(prompt) {
  const steps = [
    'Clarify the problem and target user.',
    'Define success criteria and constraints.',
    'Sketch flows and core screens.',
    'List technical components and data model.',
    'Plan milestones and test cases.',
    'Ship MVP, gather feedback, iterate.'
  ];
  return `
  <strong>Plan:</strong><br/>
  <em>${prompt}</em><br/><br/>
  <strong>Steps:</strong><br/>• ${steps.join('<br/>• ')}<br/><br/>
  <strong>Next 48h:</strong><br/>1) Draft UI wireframes<br/>2) Create data schema<br/>3) Build MVP route & storage<br/>4) Validate with one user
  `;
}
async function openaiPlan(prompt) {
  const { key, model } = JSON.parse(localStorage.getItem('ai-settings') || '{}');
  if (!key || !model) return localPlan(prompt);

  const body = {
    model,
    messages: [
      { role: 'system', content: 'You are a product planning assistant. Return concise, actionable plans with steps and next actions.' },
      { role: 'user', content: prompt }
    ]
  };

  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!resp.ok) throw new Error('OpenAI error');
    const data = await resp.json();
    const text = data.choices?.[0]?.message?.content || localPlan(prompt);
    return text.replace(/\n/g, '<br/>');
  } catch {
    return localPlan(prompt);
  }
}
chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  addChatBubble(text, 'user');
  const reply = await openaiPlan(text);
  addChatBubble(reply, 'assistant');
  chatInput.value = '';
});

/* ---------------- Notes (Samsung-style) ---------------- */
const notesGrid = document.getElementById('notesGrid');
const notesSearch = document.getElementById('notesSearch');
const newNoteBtn = document.getElementById('newNoteBtn');
const noteSheet = document.getElementById('noteSheet');
const noteTitle = document.getElementById('noteTitle');
const noteContent = document.getElementById('noteContent');
const noteMeta = document.getElementById('noteMeta');
const pinNoteBtn = document.getElementById('pinNote');
const deleteNoteBtn = document.getElementById('deleteNote');
const closeNoteBtn = document.getElementById('closeNote');
const saveNoteBtn = document.getElementById('saveNote');

let currentNoteId = null;

function renderNotes() {
  const q = notesSearch.value;
  const notes = listNotes(q);
  notesGrid.innerHTML = '';
  notes.forEach(n => {
    const card = document.createElement('div');
    card.className = 'note-card';
    card.innerHTML = `
      <div class="title">${n.title}</div>
      <div class="excerpt">${escapeHtml(n.content.slice(0, 140))}${n.content.length > 140 ? '…' : ''}</div>
      <div class="meta">${new Date(n.updatedAt).toLocaleString()}</div>
      ${n.pinned ? '<div class="pin">📌</div>' : ''}
    `;
    card.addEventListener('click', () => openNote(n.id));
    notesGrid.appendChild(card);
  });
}
function openNote(id) {
  const n = getNote(id);
  if (!n) return;
  currentNoteId = id;
  noteTitle.value = n.title;
  noteContent.value = n.content;
  noteMeta.textContent = `Updated ${new Date(n.updatedAt).toLocaleString()}`;
  pinNoteBtn.textContent = n.pinned ? 'Unpin' : 'Pin';
  noteSheet.showModal();
}
notesSearch.addEventListener('input', renderNotes);
newNoteBtn.addEventListener('click', () => {
  const n = addNote({ title: 'Untitled', content: '' });
  renderNotes();
  openNote(n.id);
});
pinNoteBtn.addEventListener('click', () => {
  if (!currentNoteId) return;
  const n = getNote(currentNoteId);
  updateNote(currentNoteId, { pinned: n.pinned ? 0 : 1 });
  renderNotes();
  openNote(currentNoteId);
});
deleteNoteBtn.addEventListener('click', () => {
  if (!currentNoteId) return;
  deleteNote(currentNoteId);
  currentNoteId = null;
  noteSheet.close();
  renderNotes();
});
closeNoteBtn.addEventListener('click', () => noteSheet.close());
saveNoteBtn.addEventListener('click', () => {
  if (!currentNoteId) return;
  updateNote(currentNoteId, { title: noteTitle.value.trim() || 'Untitled', content: noteContent.value });
  renderNotes();
  openNote(currentNoteId);
});

/* ---------------- 3D Sandbox (ES modules) ---------------- */
let THREE, OrbitControls;
let renderer, scene, camera, controls;
let threeReady = false;

async function init3D() {
  if (threeReady) return;
  const [threeMod, controlsMod] = await Promise.all([
    import('https://unpkg.com/three@0.160.0/build/three.module.js'),
    import('https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js')
  ]);
  THREE = threeMod;
  OrbitControls = controlsMod.OrbitControls;

  const canvas = document.getElementById('sandboxCanvas');
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(w, h, false);
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0e13);

  camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 1000);
  camera.position.set(3, 2, 4);

  const light = new THREE.DirectionalLight(0xffffff, 1.0);
  light.position.set(5, 5, 5);
  scene.add(light);
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));

  const grid = new THREE.GridHelper(20, 20, 0x334155, 0x1f2937);
  scene.add(grid);

  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = true;
  controls.enableZoom = true;

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', () => {
    const w2 = canvas.clientWidth;
    const h2 = canvas.clientHeight;
    renderer.setSize(w2, h2, false);
    camera.aspect = w2 / h2;
    camera.updateProjectionMatrix();
  });

  document.getElementById('addCube').addEventListener('click', () => addMesh('cube'));
  document.getElementById('addSphere').addEventListener('click', () => addMesh('sphere'));
  document.getElementById('resetScene').addEventListener('click', clearScene);
  document.getElementById('saveSceneBtn').addEventListener('click', saveSceneSnapshot);

  threeReady = true;
}
function addMesh(type) {
  let mesh;
  if (type === 'cube') {
    mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x4f7cff, roughness: 0.6, metalness: 0.2 })
    );
  } else {
    mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.6, 32, 24),
      new THREE.MeshStandardMaterial({ color: 0x22d3ee, roughness: 0.5, metalness: 0.3 })
    );
  }
  mesh.position.set((Math.random() - 0.5) * 3, 0.5, (Math.random() - 0.5) * 3);
  scene.add(mesh);
}
function clearScene() {
  const keep = new Set(['Scene', 'PerspectiveCamera', 'DirectionalLight', 'AmbientLight', 'GridHelper']);
  scene.children = scene.children.filter(obj => keep.has(obj.type));
}
function saveSceneSnapshot() {
  const data = scene.children
    .filter(obj => obj.type === 'Mesh')
    .map(m => ({ type: m.geometry.type, position: m.position.toArray(), color: m.material.color.getHex() }));
  addScene({ objects: data });
}

/* ---------------- Code Space (Acode-like) ---------------- */
const codeEditor = document.getElementById('codeEditor');
const codeType = document.getElementById('codeType');
const fileName = document.getElementById('fileName');
const newFileBtn = document.getElementById('newFileBtn');
const saveFileBtn = document.getElementById('saveFileBtn');
const filesList = document.getElementById('filesList');
const previewFrame = document.getElementById('previewFrame');
const deleteFileBtn = document.getElementById('deleteFileBtn');
const codeTabs = document.getElementById('codeTabs');

let activeFileId = null;

function renderFiles() {
  const files = listFiles();
  filesList.innerHTML = '';
  codeTabs.innerHTML = '';
  files.forEach(f => {
    const li = document.createElement('li');
    li.innerHTML = `<span><strong>${f.name}</strong> — ${f.type}</span>`;
    const openBtn = document.createElement('button');
    openBtn.className = 'btn';
    openBtn.textContent = 'Open';
    openBtn.addEventListener('click', () => openFile(f.id));
    li.appendChild(openBtn);
    filesList.appendChild(li);

    const tab = document.createElement('button');
    tab.className = 'tab small';
    tab.textContent = f.name;
    tab.addEventListener('click', () => openFile(f.id));
    codeTabs.appendChild(tab);
  });
}
function openFile(id) {
  const f = listFiles().find(x => x.id === id);
  if (!f) return;
  activeFileId = id;
  fileName.value = f.name;
  codeType.value = f.type;
  codeEditor.value = f.content;
  updatePreview();
  [...codeTabs.children].forEach(t => t.classList.toggle('active', t.textContent === f.name));
}
newFileBtn.addEventListener('click', () => {
  activeFileId = null;
  codeEditor.value = '';
  fileName.value = '';
});
saveFileBtn.addEventListener('click', () => {
  const name = (fileName.value || `untitled.${codeType.value}`).trim();
  const type = codeType.value;
  const content = codeEditor.value;
  if (activeFileId) {
    updateFile(activeFileId, { name, type, content });
  } else {
    const f = addFile({ name, type, content });
    activeFileId = f.id;
  }
  renderFiles();
  openFile(activeFileId);
});
deleteFileBtn.addEventListener('click', () => {
  if (!activeFileId) return;
  deleteFile(activeFileId);
  activeFileId = null;
  codeEditor.value = '';
  fileName.value = '';
  renderFiles();
});
function updatePreview() {
  const type = codeType.value;
  if (type === 'html' || type === 'js' || type === 'css') {
    const html = type === 'html'
      ? codeEditor.value
      : type === 'js'
        ? `<!doctype html><html><head></head><body><script>${codeEditor.value}<\/script></body></html>`
        : `<!doctype html><html><head><style>${codeEditor.value}</style></head><body><h3>CSS Preview</h3><p>Styles applied.</p></body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    previewFrame.src = url;
  } else {
    previewFrame.srcdoc = `<pre style="padding:12px">${escapeHtml(codeEditor.value)}</pre>`;
  }
}
codeEditor.addEventListener('input', updatePreview);
codeType.addEventListener('change', updatePreview);

/* ---------------- Profile & Library ---------------- */
const pfp = document.getElementById('pfp');
const pfpInput = document.getElementById('pfpInput');
const displayName = document.getElementById('displayName');
const bio = document.getElementById('bio');
const saveProfileBtn = document.getElementById('saveProfile');

pfp.addEventListener('click', () => pfpInput.click());
pfpInput.addEventListener('change', async () => {
  const file = pfpInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    pfp.src = dataUrl;
    saveProfile({ displayName: displayName.value, bio: bio.value, pfp: dataUrl });
  };
  reader.readAsDataURL(file);
});
saveProfileBtn.addEventListener('click', () => {
  saveProfile({ displayName: displayName.value, bio: bio.value, pfp: pfp.src });
});

const libraryModal = document.getElementById('libraryModal');
const openLibrary = document.getElementById('openLibrary');
const closeLibrary = document.getElementById('closeLibrary');
const libraryTabs = document.querySelectorAll('.tab.small');
const libraryContent = document.getElementById('libraryContent');

openLibrary.addEventListener('click', async () => {
  await renderLibrary('notes');
  libraryModal.showModal();
});
closeLibrary.addEventListener('click', () => libraryModal.close());
libraryTabs.forEach(t => {
  t.addEventListener('click', async () => {
    libraryTabs.forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    await renderLibrary(t.dataset.lib);
  });
});

async function renderLibrary(kind) {
  libraryContent.innerHTML = '';
  if (kind === 'notes') {
    listNotes().forEach(n => {
      const div = document.createElement('div');
      div.className = 'card';
      div.innerHTML = `<h4>${n.title}</h4><div class="muted">${new Date(n.updatedAt).toLocaleString()}</div>`;
      libraryContent.appendChild(div);
    });
  } else if (kind === 'files') {
    listFiles().forEach(f => {
      const div = document.createElement('div');
      div.className = 'card';
      div.innerHTML = `<h4>${f.name}</h4><div class="muted">${f.type}</div>`;
      libraryContent.appendChild(div);
    });
  } else if (kind === 'sandbox') {
    listScenes().forEach(s => {
      const div = document.createElement('div');
      div.className = 'card';
      div.innerHTML = `<h4>Scene ${s.id.slice(0,6)}</h4><div class="muted">${new Date(s.updatedAt).toLocaleString()}</div>`;
      libraryContent.appendChild(div);
    });
  } else if (kind === 'profile') {
    const p = getProfile();
    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = `<h4>${p.displayName || 'Unnamed'}</h4><div class="muted">${p.bio || 'No bio'}</div>`;
    libraryContent.appendChild(div);
  }
}

/* ---------------- Boot ---------------- */
(function boot() {
  const p = getProfile();
  displayName.value = p.displayName || '';
  bio.value = p.bio || '';
  if (p.pfp) pfp.src = p.pfp;

  renderNotes();
  renderFiles();
})();

/* ---------------- Utils ---------------- */
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}