import {
  addProject, listProjects,
  addNote, listNotes,
  addFile, listFiles, listAllFiles,
  saveScene, listScenes, listAllScenes,
  saveProfile, getProfile
} from './db.js';

// Router
const tabs = document.querySelectorAll('.tab:not(.small)');
const pages = document.querySelectorAll('.page');
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const pageId = 'page-' + tab.dataset.page;
    pages.forEach(p => p.classList.toggle('active', p.id === pageId));
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

// AI Planner (local prompt + heuristic)
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const chatLog = document.getElementById('chatLog');

function addChatBubble(text, role = 'user') {
  const div = document.createElement('div');
  div.className = 'bubble ' + role;
  div.innerHTML = text;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
}
function aiRespond(prompt) {
  // Lightweight planning heuristic—no external calls
  const steps = [
    'Clarify the problem and target user.',
    'Define success criteria and constraints.',
    'Sketch flows and core screens.',
    'List technical components and data model.',
    'Plan milestones and test cases.',
    'Ship MVP, gather feedback, iterate.'
  ];
  const idea = prompt.trim();
  const response = `
  <strong>Plan:</strong><br/>
  <em>${idea}</em><br/><br/>
  <strong>Steps:</strong><br/>• ${steps.join('<br/>• ')}<br/><br/>
  <strong>Next 48h:</strong><br/>1) Draft UI wireframes<br/>2) Create data schema<br/>3) Build MVP route & storage<br/>4) Validate with one user
  `;
  addChatBubble(response, 'assistant');
}
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = chatInput.value;
  addChatBubble(text, 'user');
  aiRespond(text);
  chatInput.value = '';
});

// Notes & Projects
const newProjectBtn = document.getElementById('newProjectBtn');
const projectModal = document.getElementById('projectModal');
const projectTitle = document.getElementById('projectTitle');
const createProject = document.getElementById('createProject');
const projectsList = document.getElementById('projectsList');

const notesModal = document.getElementById('notesModal');
const closeNotes = document.getElementById('closeNotes');
const noteTitle = document.getElementById('noteTitle');
const noteContent = document.getElementById('noteContent');
const saveNoteBtn = document.getElementById('saveNote');
const newNoteBtn = document.getElementById('newNote');
const notesList = document.getElementById('notesList');

let currentProjectId = null;

newProjectBtn.addEventListener('click', () => projectModal.showModal());
document.getElementById('closeProject').addEventListener('click', () => projectModal.close());
createProject.addEventListener('click', async () => {
  const title = projectTitle.value.trim();
  if (!title) return;
  const p = await addProject(title);
  projectTitle.value = '';
  projectModal.close();
  renderProjects();
});

async function renderProjects() {
  const projects = await listProjects();
  projectsList.innerHTML = '';
  projects.forEach(p => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h4>${p.title}</h4>
      <div class="muted">${new Date(p.createdAt).toLocaleString()}</div>
      <div class="row gap" style="margin-top:8px">
        <button class="btn primary" data-open="${p.id}">Open notes</button>
        <button class="btn" data-files="${p.id}">Files</button>
        <button class="btn" data-scenes="${p.id}">Scenes</button>
      </div>
    `;
    projectsList.appendChild(card);
  });

  projectsList.querySelectorAll('[data-open]').forEach(btn => {
    btn.addEventListener('click', async () => {
      currentProjectId = btn.dataset.open;
      await renderNotes(currentProjectId);
      document.getElementById('modalTitle').textContent = 'Project: ' + projects.find(x => x.id === currentProjectId).title;
      notesModal.showModal();
    });
  });
  projectsList.querySelectorAll('[data-files]').forEach(btn => {
    btn.addEventListener('click', async () => {
      currentProjectId = btn.dataset.files;
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelector('[data-page="code"]').classList.add('active');
      pages.forEach(p => p.classList.toggle('active', p.id === 'page-code'));
      await renderFiles(currentProjectId);
    });
  });
  projectsList.querySelectorAll('[data-scenes]').forEach(btn => {
    btn.addEventListener('click', async () => {
      currentProjectId = btn.dataset.scenes;
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelector('[data-page="sandbox"]').classList.add('active');
      pages.forEach(p => p.classList.toggle('active', p.id === 'page-sandbox'));
    });
  });

  // Profile projects
  const profileProjects = document.getElementById('profileProjects');
  profileProjects.innerHTML = '';
  projects.forEach(p => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<h4>${p.title}</h4><div class="muted">Created ${new Date(p.createdAt).toLocaleDateString()}</div>`;
    profileProjects.appendChild(card);
  });
}
async function renderNotes(projectId) {
  const notes = await listNotes(projectId);
  notesList.innerHTML = '';
  notes.forEach(n => {
    const li = document.createElement('li');
    li.innerHTML = `<span><strong>${n.title}</strong> — ${new Date(n.createdAt).toLocaleString()}</span>`;
    notesList.appendChild(li);
  });
}
closeNotes.addEventListener('click', () => notesModal.close());
saveNoteBtn.addEventListener('click', async () => {
  if (!currentProjectId) return;
  const title = (noteTitle.value || 'Untitled').trim();
  const content = noteContent.value.trim();
  await addNote(currentProjectId, title, content);
  noteTitle.value = ''; noteContent.value = '';
  await renderNotes(currentProjectId);
});
newNoteBtn.addEventListener('click', () => {
  noteTitle.value = ''; noteContent.value = '';
});

// 3D Sandbox (Three.js)
let renderer, scene, camera, controls;
const canvas = document.getElementById('sandboxCanvas');
const addCube = document.getElementById('addCube');
const addSphere = document.getElementById('addSphere');
const resetScene = document.getElementById('resetScene');

function init3D() {
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

  controls = new THREE.OrbitControls(camera, canvas);
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

addCube.addEventListener('click', () => addMesh('cube'));
addSphere.addEventListener('click', () => addMesh('sphere'));
resetScene.addEventListener('click', clearScene);

// Initialize 3D when sandbox page first shown
const sandboxPage = document.getElementById('page-sandbox');
const observer = new MutationObserver(() => {
  if (sandboxPage.classList.contains('active') && !renderer) init3D();
});
observer.observe(sandboxPage, { attributes: true });

// Code Space
const codeEditor = document.getElementById('codeEditor');
const codeType = document.getElementById('codeType');
const fileName = document.getElementById('fileName');
const newFileBtn = document.getElementById('newFileBtn');
const saveFileBtn = document.getElementById('saveFileBtn');
const filesList = document.getElementById('filesList');
const previewFrame = document.getElementById('previewFrame');

newFileBtn.addEventListener('click', () => {
  codeEditor.value = '';
  fileName.value = '';
});
saveFileBtn.addEventListener('click', async () => {
  const name = (fileName.value || 'untitled.' + codeType.value).trim();
  const type = codeType.value;
  const content = codeEditor.value;
  const pid = currentProjectId || (await ensureDefaultProject()).id;
  await addFile(pid, name, type, content);
  await renderFiles(pid);
});
async function renderFiles(projectId) {
  const files = await listFiles(projectId);
  filesList.innerHTML = '';
  files.forEach(f => {
    const li = document.createElement('li');
    const openBtn = document.createElement('button');
    openBtn.className = 'btn';
    openBtn.textContent = 'Open';
    openBtn.addEventListener('click', () => {
      fileName.value = f.name;
      codeEditor.value = f.content;
      codeType.value = f.type;
      updatePreview();
    });
    li.innerHTML = `<span><strong>${f.name}</strong> — ${f.type}</span>`;
    li.appendChild(openBtn);
    filesList.appendChild(li);
  });
}
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
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
async function ensureDefaultProject() {
  const projects = await listProjects();
  if (projects.length) return projects[0];
  return addProject('Default Project');
}

// Profile
const displayName = document.getElementById('displayName');
const bio = document.getElementById('bio');
const saveProfileBtn = document.getElementById('saveProfile');
saveProfileBtn.addEventListener('click', async () => {
  await saveProfile({ displayName: displayName.value, bio: bio.value });
});
(async function loadProfile() {
  const p = await getProfile();
  if (p) {
    displayName.value = p.displayName || '';
    bio.value = p.bio || '';
  }
})();

// Library modal
const libraryModal = document.getElementById('libraryModal');
const openLibrary = document.getElementById('openLibrary');
const closeLibrary = document.getElementById('closeLibrary');
const libraryTabs = document.querySelectorAll('.tab.small');
const libraryContent = document.getElementById('libraryContent');

openLibrary.addEventListener('click', async () => {
  await renderLibrary('projects');
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
  if (kind === 'projects') {
    const projects = await listProjects();
    projects.forEach(p => {
      const div = document.createElement('div');
      div.className = 'card';
      div.innerHTML = `<h4>${p.title}</h4><div class="muted">${new Date(p.createdAt).toLocaleString()}</div>`;
      libraryContent.appendChild(div);
    });
  } else if (kind === 'notes') {
    const projects = await listProjects();
    for (const p of projects) {
      const notes = await listNotes(p.id);
      const div = document.createElement('div');
      div.className = 'card';
      div.innerHTML = `<h4>${p.title}</h4>`;
      const ul = document.createElement('ul'); ul.className = 'list';
      notes.forEach(n => {
        const li = document.createElement('li');
        li.innerHTML = `<span><strong>${n.title}</strong></span>`;
        ul.appendChild(li);
      });
      div.appendChild(ul);
      libraryContent.appendChild(div);
    }
  } else if (kind === 'files') {
    const files = await listAllFiles();
    files.forEach(f => {
      const div = document.createElement('div');
      div.className = 'card';
      div.innerHTML = `<h4>${f.name}</h4><div class="muted">${f.type}</div>`;
      libraryContent.appendChild(div);
    });
  } else if (kind === 'sandbox') {
    const scenes = await listAllScenes();
    scenes.forEach(s => {
      const div = document.createElement('div');
      div.className = 'card';
      div.innerHTML = `<h4>Scene ${s.id.slice(0,6)}</h4><div class="muted">${new Date(s.createdAt).toLocaleString()}</div>`;
      libraryContent.appendChild(div);
    });
  } else if (kind === 'profile') {
    const p = await getProfile();
    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = `<h4>Profile</h4><div class="muted">${p ? (p.displayName || 'Unnamed') : 'No profile saved'}</div>`;
    libraryContent.appendChild(div);
  }
}