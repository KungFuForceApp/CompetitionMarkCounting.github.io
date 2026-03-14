// ============================================================
// firebase-app.js  —  Firebase init, global state, core utils
// ============================================================

const firebaseConfig = {
    apiKey: "AIzaSyB2EAzctjXJXEm-ZfIdqDiXDHaGRSVdTxY",
    authDomain: "markcounting.firebaseapp.com",
    databaseURL: "https://markcounting-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "markcounting",
    storageBucket: "markcounting.firebasestorage.app",
    messagingSenderId: "141500133139",
    appId: "1:141500133139:web:b3687a740c658a206f34e6",
    measurementId: "G-8E4QF5VBTD"
};

const GOOGLE_SHEETS_URL = "https://script.google.com/macros/s/AKfycbySj5OCJ58r1SYnEpYi_oktCIyL2e5sNkTHoIEhmhdslXS6CVaK4lyd6RLPgGjZJ94LAw/exec";

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

let currentCompetitionId = null;
let currentRefereeId = null;
let currentRefereeName = null;
let competitionData = null;
let timerInterval = null;
let remainingTime = 0;
let isTimerRunning = false;
let unsubscribers = [];
let allCompetitions = {};
let allFolders = {};
let folderAwardCount = 0;
let scoreCategoryCount = 0;
let contestantCount = 0;
let nameCheckTimeout = null;
let isNameAvailable = false;
let currentRevealStep = 0;
let revealedPodium = [];
let revealedAwards = [];
let currentContestants = [];
let currentAwardsConfig = [];

const colors = ['#667eea', '#11998e', '#f5576c', '#fbbf24', '#a78bfa', '#38ef7d', '#f093fb', '#00cec9'];

function loadCompetitions() {
    let deepLinkHandled = false;
    database.ref('competitions').on('value', snapshot => {
        allCompetitions = snapshot.val() || {};
        updateCompetitionDropdowns();
        if (!deepLinkHandled) {
            deepLinkHandled = true;
            handleDeepLink();
        }
    });
}

function updateCompetitionDropdowns() {
    const sel = document.getElementById('final-comp-select');
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">— Select a competition —</option>';
    const sorted = Object.entries(allCompetitions)
        .filter(([, c]) => c && c.name)
        .sort(([, a], [, b]) => a.name.localeCompare(b.name));
    sorted.forEach(([id, comp]) => {
        const opt = document.createElement('option');
        opt.value = id;
        opt.dataset.name = comp.name;
        const statusBadge = comp.status === 'ended' ? ' ✅' : comp.status === 'running' ? ' 🔴' : '';
        opt.textContent = comp.name + statusBadge;
        sel.appendChild(opt);
    });
    if (current && sel.querySelector(`option[value="${current}"]`)) sel.value = current;
}

function updateFolderOptions() {
    const entries = Object.entries(allFolders || {});
    const folderList = entries.map(([id]) => ({ id, label: buildFolderLabel(id) })).sort((a, b) => a.label.localeCompare(b.label));

    ['existing-folder-select', 'new-folder-parent', 'final-folder-select', 'rankings-folder-filter', 'winner-folder-filter'].forEach(selId => {
        const sel = document.getElementById(selId);
        if (!sel) return;
        const current = sel.value;
        const defaultOpt = sel.options[0] ? sel.options[0].outerHTML : '';
        sel.innerHTML = defaultOpt;
        folderList.forEach(item => {
            const opt = document.createElement('option');
            opt.value = item.id;
            opt.textContent = item.label;
            sel.appendChild(opt);
        });
        if (current && sel.querySelector(`option[value="${current}"]`)) sel.value = current;
    });
}

function checkCompetitionName() {
    const name = document.getElementById('comp-name').value.trim().toLowerCase();
    const statusEl = document.getElementById('name-status');
    if (!name) { statusEl.innerHTML = ''; isNameAvailable = false; return; }
    clearTimeout(nameCheckTimeout);
    nameCheckTimeout = setTimeout(() => {
        const exists = Object.values(allCompetitions).some(comp => comp && comp.name && comp.name.toLowerCase() === name);
        if (exists) {
            statusEl.innerHTML = '<span style="color: #f87171;">❌ This name is already taken</span>';
            isNameAvailable = false;
        } else {
            statusEl.innerHTML = '<span style="color: #34d399;">✅ Name is available</span>';
            isNameAvailable = true;
        }
    }, 300);
}

function showPanel(panelName) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    const panel = document.getElementById(`${panelName}-panel`);
    if (panel) panel.classList.add('active');
    unsubscribers.forEach(unsub => unsub());
    unsubscribers = [];

    if (panelName === 'final' && currentCompetitionId && allCompetitions[currentCompetitionId]) {
        const comp = allCompetitions[currentCompetitionId];
        const sel = document.getElementById('final-comp-select');
        if (sel) {
            sel.value = currentCompetitionId;
            if (!sel.value) document.getElementById('final-comp-name').value = comp.name;
        }
        document.getElementById('final-comp-name').value = comp.name;
        document.getElementById('final-type').value = 'competition';
        updateFinalType();
    }
}

function updateModeInfo() {
    const mode = document.getElementById('comp-mode').value;
    document.getElementById('mode-info-1').classList.toggle('hidden', mode !== '1');
    document.getElementById('mode-info-2').classList.toggle('hidden', mode !== '2');
    document.getElementById('mode1-settings').classList.toggle('hidden', mode !== '1');
    document.getElementById('mode2-settings').classList.toggle('hidden', mode !== '2');
}

loadCompetitions();

function loadFolders() {
    database.ref('folders').on('value', snapshot => {
        allFolders = snapshot.val() || {};
        updateFolderOptions();
    });
}
loadFolders();
addContestant();
addContestant();
addScoreCategory();

function showStatus(message, type) {
    const existing = document.querySelector('.status-message');
    if (existing) existing.remove();
    const div = document.createElement('div');
    div.className = `status-message ${type}`;
    div.textContent = message;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 3000);
}

window.addEventListener('beforeunload', () => {
    if (currentRefereeId && currentCompetitionId) database.ref(`competitions/${currentCompetitionId}/referees/${currentRefereeId}/online`).set(false);
    stopTimerSync();
});

function updateFinalType() {
    const type = document.getElementById('final-type').value;
    document.getElementById('final-comp-wrapper').classList.toggle('hidden', type !== 'competition');
    document.getElementById('final-folder-wrapper').classList.toggle('hidden', type !== 'folder');
}

function toggleFullscreen(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.classList.add('fullscreen-surface');
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
}

document.addEventListener('keydown', e => {
    if (e.code === 'Escape' && document.fullscreenElement) { document.exitFullscreen(); return; }
    if (e.code !== 'Space') return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
    const finalVisible = document.getElementById('final-scoreboard-display') && !document.getElementById('final-scoreboard-display').classList.contains('hidden');
    if (finalVisible) { e.preventDefault(); revealStep(); }
});

function buildFolderLabel(folderId) {
    const visited = new Set();
    let parts = [];
    let currentId = folderId;
    while (currentId && allFolders[currentId] && !visited.has(currentId)) {
        visited.add(currentId);
        const folder = allFolders[currentId];
        parts.unshift(folder.name || '');
        currentId = folder.parentId || null;
    }
    return parts.filter(Boolean).join(' / ');
}

function buildShareUrl(view, compName) {
    const base = window.location.href.split('?')[0].split('#')[0];
    return `${base}?view=${encodeURIComponent(view)}&comp=${encodeURIComponent(compName)}`;
}

function renderShareLinks(compName, container) {
    if (!container) return;
    const links = [
        { view: 'referee', label: '🎯 Referee', cls: 'referee' },
        { view: 'scoreboard', label: '📊 Live Scoreboard', cls: 'scoreboard' },
        { view: 'final', label: '🏅 Final Scoreboard', cls: 'final' },
    ];
    container.innerHTML = `<div class="share-links-title">🔗 Shareable Links</div>` +
        links.map(({ view, label, cls }) => { const url = buildShareUrl(view, compName); return `<div class="share-link-row"><span class="share-link-label ${cls}">${label}</span><span class="share-link-url">${url}</span><button class="share-link-copy-btn" onclick="copyShareLink('${url}', this)">📋 Copy</button><a class="share-link-open-btn" href="${url}" target="_blank">↗ Open</a></div>`; }).join('');
}

function copyShareLink(url, btn) {
    navigator.clipboard.writeText(url).then(() => { const orig = btn.textContent; btn.textContent = '✅ Copied!'; setTimeout(() => { btn.textContent = orig; }, 1800); });
}

function toggleShareLinks(containerId, compName) {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (el.classList.contains('hidden')) { el.classList.remove('hidden'); if (compName) renderShareLinks(compName, el); }
    else el.classList.add('hidden');
}

function handleDeepLink() {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    const comp = params.get('comp');
    if (!view || !comp) return;
    const tryNavigate = (attempts) => {
        if (attempts <= 0) return;
        const found = Object.values(allCompetitions).some(c => c && c.name && c.name.toLowerCase() === comp.toLowerCase());
        if (!found) { setTimeout(() => tryNavigate(attempts - 1), 400); return; }
        if (view === 'referee') { showPanel('join'); document.getElementById('join-comp-name').value = comp; }
        else if (view === 'scoreboard') { showPanel('scoreboard'); document.getElementById('view-comp-name').value = comp; viewScoreboard(); }
        else if (view === 'final') { showPanel('final'); document.getElementById('final-type').value = 'competition'; updateFinalType(); document.getElementById('final-comp-name').value = comp; showFinalScoreboard(); }
    };
    setTimeout(() => tryNavigate(15), 600);
}
function toggleTheme() {
    const body = document.body;
    body.classList.toggle('light-mode');
    const isLight = body.classList.contains('light-mode');
    document.getElementById('theme-icon').textContent = isLight ? '🌙' : '☀️';
    document.getElementById('theme-label').textContent = isLight ? 'Dark Mode' : 'Light Mode';
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
}

(function() {
    if (localStorage.getItem('theme') === 'light') {
        document.body.classList.add('light-mode');
        document.getElementById('theme-icon').textContent = '🌙';
        document.getElementById('theme-label').textContent = 'Dark Mode';
    }
})();

