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
function calculateWeightedAverageScoreForCompetition(comp, contestantIndex) {
    if (!comp || !comp.mode1Scores) return 0;
    const contestantScores = comp.mode1Scores[contestantIndex];
    if (!contestantScores) return 0;
    const categories = comp.scoreCategories || [{ name: 'Score', weight: 100 }];
    const refereeIds = Object.keys(contestantScores);
    if (refereeIds.length === 0) return 0;
    const refWeightedScores = refereeIds.map(refId => {
        const refScores = contestantScores[refId];
        let refWeightedScore = 0;
        categories.forEach(cat => { const score = refScores[cat.name] || 0; refWeightedScore += score * (cat.weight / 100); });
        return refWeightedScore;
    });
    let scoresToAverage = refWeightedScores;
    if (refWeightedScores.length >= 3) { const sorted = [...refWeightedScores].sort((a, b) => a - b); scoresToAverage = sorted.slice(1, sorted.length - 1); }
    const total = scoresToAverage.reduce((sum, s) => sum + s, 0);
    return total / scoresToAverage.length;
}

function calculateWeightedAverageScore(contestantIndex) { return calculateWeightedAverageScoreForCompetition(competitionData, contestantIndex); }

function toggleTimer() {
    if (!currentCompetitionId || !competitionData) return;
    const newState = !competitionData.timerState.running;
    const updates = { running: newState, lastUpdate: firebase.database.ServerValue.TIMESTAMP };
    if (newState) updates.remaining = competitionData.timerState.remaining;
    database.ref(`competitions/${currentCompetitionId}/timerState`).update(updates).then(() => {
        if (newState) { database.ref(`competitions/${currentCompetitionId}/status`).set('running'); startTimerSync(); }
        else stopTimerSync();
        updateRefToggleButton();
    });
}

function startTimerSync() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    if (!competitionData || !competitionData.timerState || !competitionData.timerState.running) return;
    const startTime = Date.now();
    const initialRemaining = competitionData.timerState.remaining;
    timerInterval = setInterval(() => {
        if (!competitionData || !competitionData.timerState) return;
        const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
        const newRemaining = Math.max(0, initialRemaining - elapsedSeconds);
        const timeString = `${String(Math.floor(newRemaining / 60)).padStart(2,'0')}:${String(newRemaining % 60).padStart(2,'0')}`;
        const refTimer = document.getElementById('ref-timer');
        const sbTimer = document.getElementById('sb-timer');
        if (refTimer) refTimer.textContent = timeString;
        if (sbTimer) sbTimer.textContent = timeString;
        if (newRemaining <= 0) {
            database.ref(`competitions/${currentCompetitionId}/timerState/running`).set(false);
            database.ref(`competitions/${currentCompetitionId}/status`).set('ended');
            showStatus('Competition ended!', 'info');
            clearInterval(timerInterval); timerInterval = null;
            updateRefToggleButton();
            const mode2Start = document.getElementById('referee-mode2-start');
            if (mode2Start) mode2Start.classList.add('hidden');
        }
    }, 100);
}

function stopTimerSync() { if (timerInterval) { clearInterval(timerInterval); timerInterval = null; } }

function resetTimer() {
    if (!currentCompetitionId) return;
    stopTimerSync();
    const duration = competitionData.duration || 300;
    database.ref(`competitions/${currentCompetitionId}/timerState`).set({ running: false, remaining: duration, lastUpdate: firebase.database.ServerValue.TIMESTAMP });
    database.ref(`competitions/${currentCompetitionId}/status`).set('pending');
}
function confirmResetAllScores() {
    if (!currentCompetitionId) { showStatus('No competition selected', 'error'); return; }
    const modal = document.createElement('div');
    modal.className = 'modal-overlay'; modal.id = 'reset-scores-modal';
    modal.innerHTML = `<div class="modal-content"><h3>🔄 Reset All Player Scores</h3><p>Are you sure you want to reset all player scores to zero?<br><br><strong style="color:#fbbf24;">${competitionData?.name || 'Unknown'}</strong><br><br>This will clear all scores and mark history. This cannot be undone!</p><div class="modal-buttons"><button class="cancel-btn" onclick="closeResetScoresModal()">Cancel</button><button class="confirm-btn" style="background:linear-gradient(135deg,#dc2626,#ef4444);" onclick="resetAllScores()">🔄 Reset All Scores</button></div></div>`;
    document.body.appendChild(modal);
}

function closeResetScoresModal() { const modal = document.getElementById('reset-scores-modal'); if (modal) modal.remove(); }

function resetAllScores() {
    if (!currentCompetitionId || !competitionData) return;
    const updates = {};
    competitionData.contestants.forEach((_, i) => {
        updates[`contestants/${i}/score`] = 0;
        updates[`contestants/${i}/markHistory`] = null;
    });
    updates['mode1Scores'] = null;
    updates['votes'] = null;
    updates['cautions'] = null;
    updates['punishments'] = null;
    updates['cautionVotes'] = null;
    updates['punishmentVotes'] = null;
    database.ref(`competitions/${currentCompetitionId}`).update(updates)
        .then(() => { closeResetScoresModal(); showStatus('All player scores have been reset!', 'success'); })
        .catch(err => { closeResetScoresModal(); showStatus('Error: ' + err.message, 'error'); });
}

function startCompetition() {
    if (!currentCompetitionId || !competitionData) { showStatus('No competition selected', 'error'); return; }
    if (competitionData.mode !== 2) { showStatus('Start competition is only for Mode 2', 'error'); return; }
    const duration = competitionData.duration || 300;
    database.ref(`competitions/${currentCompetitionId}`).update({ status: 'running', timerState: { running: true, remaining: duration, lastUpdate: firebase.database.ServerValue.TIMESTAMP } })
        .then(() => {
            showStatus('Competition started!', 'success');
            document.getElementById('referee-mode2-start').classList.add('hidden');
            document.getElementById('ref-timer-controls').classList.remove('hidden');
            updateRefToggleButton(); startTimerSync();
        }).catch(err => showStatus('Error: ' + err.message, 'error'));
}

function confirmDeleteCompetition() {
    if (!currentCompetitionId) { showStatus('No competition selected', 'error'); return; }
    const modal = document.createElement('div');
    modal.className = 'modal-overlay'; modal.id = 'delete-modal';
    modal.innerHTML = `<div class="modal-content"><h3>⚠️ Delete Competition</h3><p>Are you sure you want to permanently delete this competition?<br><br><strong style="color: #fbbf24;">${competitionData?.name || 'Unknown'}</strong><br><br>This cannot be undone!</p><div class="modal-buttons"><button class="cancel-btn" onclick="closeDeleteModal()">Cancel</button><button class="confirm-btn" onclick="deleteCompetition()">🗑️ Delete</button></div></div>`;
    document.body.appendChild(modal);
}

function closeDeleteModal() { const modal = document.getElementById('delete-modal'); if (modal) modal.remove(); }

function deleteCompetition() {
    if (!currentCompetitionId) return;
    database.ref(`competitions/${currentCompetitionId}`).remove().then(() => {
        closeDeleteModal(); showStatus('Competition deleted!', 'success');
        currentCompetitionId = null; competitionData = null;
        document.getElementById('scoreboard-display').classList.add('hidden');
        document.getElementById('referee-interface').classList.add('hidden');
        unsubscribers.forEach(unsub => unsub()); unsubscribers = [];
    }).catch(err => { closeDeleteModal(); showStatus('Error: ' + err.message, 'error'); });
}
const EXPORT_STORAGE_KEY = 'exportSettings';
function getExportSettings() { try { return JSON.parse(localStorage.getItem(EXPORT_STORAGE_KEY)) || {}; } catch { return {}; } }
function saveExportSettings(s) { localStorage.setItem(EXPORT_STORAGE_KEY, JSON.stringify(s)); }

const EXPORT_FIELD_DEFS = [
    { key: 'competition_name', label: 'Competition Name', modes: [1,2] },
    { key: 'contestant_name', label: 'Contestant Name', modes: [1,2] },
    { key: 'final_score', label: 'Final Score', modes: [1,2] },
    { key: 'rank', label: 'Rank', modes: [1,2] },
    { key: 'referee_count', label: 'Referee Count', modes: [1] },
    { key: 'score_plus', label: 'Total + Score', modes: [2] },
    { key: 'score_minus', label: 'Total - Score', modes: [2] },
    { key: 'max_score', label: 'Max Single Score', modes: [2] },
    { key: 'mark_history', label: 'Mark History (all)', modes: [2] },
    { key: 'cautions', label: 'Cautions 🟨', modes: [2] },
    { key: 'punishments', label: 'Punishments 🟥', modes: [2] },
    { key: 'mode', label: 'Mode', modes: [1,2] },
    { key: 'color', label: 'Colour Tag', modes: [1,2] },
    { key: 'competition_id', label: 'Competition ID', modes: [1,2] },
    { key: 'Timestamp', label: 'Timestamp', modes: [1,2] },
];

function getDynamicExportFields() {
    if (!competitionData || competitionData.mode !== 1) return [];
    const extra = [];
    const categories = competitionData.scoreCategories || [];
    categories.forEach(cat => { extra.push({ key: `${cat.name}_avg`, label: `Avg: ${cat.name}`, modes: [1], dynamic: true }); });
    const mode1Scores = competitionData.mode1Scores || {};
    let maxRefs = 0;
    Object.values(mode1Scores).forEach(cs => { const count = Object.values(cs).filter(v => typeof v === 'object').length; maxRefs = Math.max(maxRefs, count); });
    for (let r = 1; r <= maxRefs; r++) {
        extra.push({ key: `Ref${r}_name`, label: `Referee ${r} Name`, modes: [1], dynamic: true });
        categories.forEach(cat => { extra.push({ key: `Ref${r}_${cat.name}`, label: `Ref ${r}: ${cat.name}`, modes: [1], dynamic: true }); });
        extra.push({ key: `Ref${r}_total`, label: `Ref ${r}: Total`, modes: [1], dynamic: true });
    }
    return extra;
}

function openExportModal() {
    if (!competitionData || !currentCompetitionId) { showStatus('No competition loaded', 'error'); return; }
    const mode = competitionData.mode;
    const saved = getExportSettings();
    const dynamicDefs = getDynamicExportFields();
    const allDefs = [...EXPORT_FIELD_DEFS, ...dynamicDefs];
    const applicableFields = allDefs.filter(f => f.modes.includes(mode));
    const defaultOrder = [];
    EXPORT_FIELD_DEFS.filter(f => f.modes.includes(mode)).forEach(f => {
        defaultOrder.push(f.key);
        if (f.key === 'final_score' && mode === 1) dynamicDefs.filter(d => d.key.endsWith('_avg')).forEach(d => defaultOrder.push(d.key));
    });
    dynamicDefs.filter(d => !defaultOrder.includes(d.key)).forEach(d => defaultOrder.push(d.key));
    const savedOrder = saved.fieldOrder || [];
    const mergedOrder = [...savedOrder.filter(k => applicableFields.find(f => f.key === k)), ...defaultOrder.filter(k => !savedOrder.includes(k) && applicableFields.find(f => f.key === k))];
    const disabledFields = new Set(saved.disabledFields || []);
    const spreadsheetId = saved.spreadsheetId || '';
    const sheetName = saved.sheetName || 'Competition-Score-Manager';
    const startRow = saved.startRow || '';
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay'; overlay.id = 'export-modal';
    const buildFieldsHtml = (order) => order.map(key => {
        const def = applicableFields.find(f => f.key === key);
        if (!def) return '';
        const enabled = !disabledFields.has(key);
        const isCatAvg = def.dynamic && key.endsWith('_avg');
        const isRefField = def.dynamic && !key.endsWith('_avg');
        const accent = isCatAvg ? 'border-left:3px solid #a78bfa;' : isRefField ? 'border-left:3px solid #38bdf8;' : '';
        return `<div class="export-field-row" draggable="true" data-key="${key}" style="${accent}"><span class="export-field-drag">☰</span><span class="export-field-label">${def.label}</span><span class="export-field-key">${key}</span><span class="export-field-toggle" onclick="toggleExportField(this,'${key}')">${enabled ? '✅' : '⬜'}</span></div>`;
    }).join('');
    overlay.innerHTML = `<div class="export-modal-content"><h3>📤 Export to Google Sheets</h3><p class="sub">Drag rows to reorder columns.</p><div class="export-section-title">🔗 Sheet Settings</div><div class="form-group" style="margin-bottom:7px;"><label style="font-size:0.8rem;">Apps Script URL</label><input type="text" id="export-sheet-url" value="${saved.sheetUrl || GOOGLE_SHEETS_URL}" style="font-size:0.78rem;"></div><div class="form-group" style="margin-bottom:7px;"><label style="font-size:0.8rem;">Spreadsheet ID</label><input type="text" id="export-spreadsheet-id" value="${spreadsheetId}" style="font-size:0.78rem;font-family:'Space Mono',monospace;"></div><div style="display:flex;gap:9px;margin-bottom:14px;"><div class="form-group" style="flex:2;margin-bottom:0;"><label style="font-size:0.8rem;">Sheet Tab Name</label><input type="text" id="export-sheet-name" value="${sheetName}"></div><div class="form-group" style="flex:1;margin-bottom:0;"><label style="font-size:0.8rem;">Insert After Row (0=append)</label><input type="number" id="export-start-row" value="${startRow}" min="0" placeholder="0"></div></div><div class="export-section-title">📋 Columns</div><div id="export-fields-list" style="display:flex;flex-direction:column;gap:5px;">${buildFieldsHtml(mergedOrder)}</div><div class="export-actions"><button class="export-cancel-btn" onclick="closeExportModal()">Cancel</button><button class="export-cancel-btn" onclick="previewExportData()" style="border-color:#fbbf24;color:#fbbf24;">🔍 Preview</button><button class="export-run-btn" onclick="runExport()">📤 Export Now</button></div><div id="export-preview" style="margin-top:14px;display:none;"><div class="export-section-title">🔍 Preview</div><pre id="export-preview-text" style="font-size:0.72rem;color:var(--text-secondary);background:var(--input-bg);padding:11px;border-radius:9px;overflow-x:auto;white-space:pre-wrap;word-break:break-all;"></pre></div></div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeExportModal(); });
    initExportDrag();
}

function getExportFieldOrderFromDOM() {
    const list = document.getElementById('export-fields-list');
    if (!list) return [];
    return [...list.querySelectorAll('.export-field-row')].map(row => ({ key: row.dataset.key, enabled: row.querySelector('.export-field-toggle').textContent === '✅' }));
}

function closeExportModal() { const m = document.getElementById('export-modal'); if (m) m.remove(); }
function toggleExportField(el, key) { el.textContent = el.textContent === '✅' ? '⬜' : '✅'; }

let exportDragSrc = null;
function initExportDrag() {
    const list = document.getElementById('export-fields-list');
    if (!list) return;
    list.querySelectorAll('.export-field-row').forEach(row => {
        row.addEventListener('dragstart', e => { exportDragSrc = row; e.dataTransfer.effectAllowed = 'move'; });
        row.addEventListener('dragover', e => { e.preventDefault(); list.querySelectorAll('.export-field-row').forEach(r => r.classList.remove('drag-over')); row.classList.add('drag-over'); });
        row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
        row.addEventListener('drop', e => {
            e.preventDefault(); row.classList.remove('drag-over');
            if (!exportDragSrc || exportDragSrc === row) return;
            const rows = [...list.querySelectorAll('.export-field-row')];
            const srcIdx = rows.indexOf(exportDragSrc);
            const tgtIdx = rows.indexOf(row);
            if (srcIdx < tgtIdx) row.after(exportDragSrc);
            else row.before(exportDragSrc);
        });
    });
}

async function previewExportData() {
    if (!competitionData) return;
    const mode = competitionData.mode;
    const contestants = [...competitionData.contestants].map((c, i) => ({ ...c, _index: i, finalScore: mode === 1 ? calculateWeightedAverageScoreForCompetition(competitionData, i) : (c.score || 0) })).sort((a, b) => b.finalScore - a.finalScore);
    const c = contestants[0];
    const preview = { contestant: c.name, mode, _index: c._index };
    const pre = document.getElementById('export-preview-text');
    const div = document.getElementById('export-preview');
    pre.textContent = JSON.stringify(preview, null, 2);
    div.style.display = 'block';
}

async function runExport() {
    if (!competitionData || !currentCompetitionId) return;
    const spreadsheetId = document.getElementById('export-spreadsheet-id')?.value.trim() || '';
    const sheetName = document.getElementById('export-sheet-name').value.trim();
    const startRow = parseInt(document.getElementById('export-start-row').value) || 0;
    if (!spreadsheetId) { showStatus('Please enter the Spreadsheet ID', 'error'); return; }
    const fieldRows = getExportFieldOrderFromDOM();
    const fieldOrder = fieldRows.map(r => r.key);
    const disabledFields = fieldRows.filter(r => !r.enabled).map(r => r.key);
    saveExportSettings({ spreadsheetId, sheetName, startRow, fieldOrder, disabledFields });
    closeExportModal();
    const mode = competitionData.mode;
    const categories = competitionData.scoreCategories || [{ name: 'Score', weight: 100 }];
    const contestants = [...competitionData.contestants].map((c, i) => ({ ...c, _index: i, finalScore: mode === 1 ? calculateWeightedAverageScoreForCompetition(competitionData, i) : (c.score || 0) })).sort((a, b) => b.finalScore - a.finalScore);
    const enabledFields = fieldOrder.filter(k => !disabledFields.includes(k));
    let successCount = 0, errorCount = 0;
    showStatus('Exporting...', 'info');
    for (let rankIdx = 0; rankIdx < contestants.length; rankIdx++) {
        const c = contestants[rankIdx];
        const i = c._index;
        const allData = { competition_id: currentCompetitionId, competition_name: competitionData.name, contestant_name: c.name, final_score: c.finalScore.toFixed(2), rank: rankIdx + 1, mode: `Mode ${mode}`, color: c.color || '', Timestamp: new Date().toISOString() };
        if (mode === 1) {
            const contestantScores = competitionData.mode1Scores?.[i] || competitionData.mode1Scores?.[String(i)] || {};
            const refereeEntries = Object.entries(contestantScores).filter(([, v]) => typeof v === 'object' && v !== null);
            allData.referee_count = refereeEntries.length;
            categories.forEach(cat => { const vals = refereeEntries.map(([, s]) => parseFloat(s[cat.name]) || 0); const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0; allData[`${cat.name}_avg`] = avg.toFixed(2); });
            refereeEntries.forEach(([, refScores], ri) => {
                const refLabel = `Ref${ri + 1}`;
                allData[`${refLabel}_name`] = refScores.refereeName || `Ref${ri + 1}`;
                categories.forEach(cat => { allData[`${refLabel}_${cat.name}`] = (parseFloat(refScores[cat.name]) || 0).toFixed(2); });
                const weighted = categories.reduce((sum, cat) => sum + (parseFloat(refScores[cat.name]) || 0) * (cat.weight / 100), 0);
                allData[`${refLabel}_total`] = weighted.toFixed(2);
            });
        } else {
            const markHistory = c.markHistory ? Object.values(c.markHistory) : [];
            const plusMarks = markHistory.filter(h => h.mark > 0);
            const minusMarks = markHistory.filter(h => h.mark < 0);
            const cautionCountExport = competitionData.cautions?.[i] || 0;
            const punishmentCountExport = competitionData.punishments?.[i] || 0;
            allData.score_plus = plusMarks.reduce((s, h) => s + h.mark, 0);
            allData.score_minus = minusMarks.reduce((s, h) => s + h.mark, 0);
            allData.max_score = plusMarks.length ? Math.max(...plusMarks.map(h => h.mark)) : 0;
            allData.mark_history = markHistory.map(h => (h.mark > 0 ? `+${h.mark}` : h.mark)).join(', ');
            allData.cautions = cautionCountExport;
            allData.punishments = punishmentCountExport;
            allData.final_score = (c.score || 0).toFixed(2);
        }
        const formData = new URLSearchParams();
        formData.append('_spreadsheet_id', spreadsheetId);
        formData.append('_sheet_name', sheetName);
        if (startRow > 0) formData.append('_insert_after_row', startRow + rankIdx);
        enabledFields.forEach((key, idx) => { formData.append(`v${idx}`, String(allData[key] ?? '')); });
        formData.append('_count', enabledFields.length);
        try {
            const resp = await fetch(GOOGLE_SHEETS_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: formData.toString() });
            const text = await resp.text();
            let result = {};
            try { result = JSON.parse(text); } catch {}
            if (result.error) { errorCount++; showStatus(`Sheet error: ${result.error}`, 'error'); }
            else if (resp.ok) successCount++;
            else { errorCount++; showStatus(`HTTP ${resp.status}`, 'error'); }
        } catch(e) { errorCount++; showStatus(`Network error: ${e.message}`, 'error'); break; }
    }
    if (errorCount === 0) showStatus(`✅ Exported ${successCount} rows!`, 'success');
    else showStatus(`Export: ${successCount} ok, ${errorCount} failed`, 'error');
}

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

function addFolderAward() {
    folderAwardCount += 1;
    const id = folderAwardCount;
    const container = document.getElementById('folder-awards-list');
    const div = document.createElement('div');
    div.className = 'score-category-item';
    div.id = `folder-award-${id}`;
    div.innerHTML = `<input type="text" placeholder="Award name" class="folder-award-name" style="flex:2;"><input type="number" value="1" min="1" max="100" class="folder-award-count" style="width:55px;" title="Max winners"><span style="color: var(--text-muted); font-size:0.82rem;">winners</span><button type="button" onclick="removeFolderAward(${id})">✕</button>`;
    container.appendChild(div);
}

function removeFolderAward(id) { const el = document.getElementById(`folder-award-${id}`); if (el) el.remove(); }

function collectFolderAwards() {
    const awards = [];
    document.querySelectorAll('#folder-awards-list .score-category-item').forEach(item => {
        const nameInput = item.querySelector('.folder-award-name');
        const countInput = item.querySelector('.folder-award-count');
        const name = nameInput.value.trim();
        const maxWinners = parseInt(countInput.value) || 0;
        if (name && maxWinners > 0) awards.push({ name, maxWinners });
    });
    return awards;
}

function createFolder() {
    const nameInput = document.getElementById('new-folder-name');
    const parentSelect = document.getElementById('new-folder-parent');
    const name = nameInput.value.trim();
    if (!name) { showStatus('Please enter folder name', 'error'); return; }
    if (name.includes('/')) { showStatus('Folder name cannot contain "/"', 'error'); return; }
    const parentId = parentSelect.value || null;
    const awards = collectFolderAwards();
    const folderId = name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30) + '_' + Date.now().toString(36);
    database.ref(`folders/${folderId}`).set({ name, parentId, awards }).then(() => {
        nameInput.value = ''; document.getElementById('folder-awards-list').innerHTML = ''; folderAwardCount = 0;
        showStatus('Folder saved', 'success');
        const existingSelect = document.getElementById('existing-folder-select');
        if (existingSelect) existingSelect.value = folderId;
    }).catch(err => showStatus('Error saving folder: ' + err.message, 'error'));
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
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.remove('light-mode');
        document.getElementById('theme-icon').textContent = '☀️';
        document.getElementById('theme-label').textContent = 'Light Mode';
    } else {
        document.body.classList.add('light-mode');
        document.getElementById('theme-icon').textContent = '🌙';
        document.getElementById('theme-label').textContent = 'Dark Mode';
    }
})();
