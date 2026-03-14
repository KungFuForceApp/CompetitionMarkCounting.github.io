function viewScoreboard() {
    const compName = document.getElementById('view-comp-name').value.trim();
    if (!compName) { showStatus('Please enter a competition name', 'error'); return; }
    let compId = null;
    for (const id in allCompetitions) { if (allCompetitions[id]?.name?.toLowerCase() === compName.toLowerCase()) { compId = id; break; } }
    if (!compId) { showStatus('Competition not found', 'error'); return; }
    currentCompetitionId = compId;
    const compRef = database.ref(`competitions/${compId}`);
    const unsub = compRef.on('value', snapshot => {
        if (!snapshot.exists()) { showStatus('Competition not found', 'error'); return; }
        competitionData = snapshot.val();
        updateScoreboard();
        if (competitionData.mode === 2 && competitionData.timerState?.running && !timerInterval) startTimerSync();
    });
    unsubscribers.push(() => compRef.off('value', unsub));
}

function updateScoreboard() {
    document.getElementById('scoreboard-display').classList.remove('hidden');
    document.getElementById('sb-comp-name').textContent = competitionData.name;
    document.getElementById('sb-comp-desc').textContent = competitionData.description || '';
    document.getElementById('sb-comp-mode').textContent = competitionData.mode === 1 ? 'Average Scoring' : 'Consensus Scoring';
    if (competitionData.mode === 2) {
        document.getElementById('sb-timer').classList.remove('hidden');
        document.getElementById('sb-competition-status').classList.remove('hidden');
        updateScoreboardTimer(); updateScoreboardStatus();
    } else {
        document.getElementById('sb-timer').classList.add('hidden');
        document.getElementById('sb-competition-status').classList.add('hidden');
    }
    const contestants = competitionData.contestants.map((c, i) => ({ ...c, originalIndex: i, finalScore: competitionData.mode === 1 ? calculateWeightedAverageScoreForCompetition(competitionData, i) : (c.score || 0) }));
    const ranked = [...contestants].sort((a, b) => b.finalScore - a.finalScore);
    contestants.forEach(c => { c.rank = ranked.findIndex(r => r.originalIndex === c.originalIndex) + 1; });
    const container = document.getElementById('scores-grid');
    container.innerHTML = '';
    contestants.forEach(contestant => {
        if (hiddenPlayers.has(contestant.originalIndex)) return;
        const card = document.createElement('div');
        card.className = `score-card rank-${contestant.rank}`;
        card.style.borderColor = contestant.color;
        let detailsHtml = '';
        if (competitionData.mode === 1) {
            const refCount = countScoresForContestant(contestant.originalIndex);
            const trimNote = refCount >= 3 ? ' <span style="color:#fbbf24;font-size:0.73rem;">(±1 trimmed)</span>' : '';
            detailsHtml = `<p style="color: var(--text-muted); font-size: 0.78rem; margin-top: 11px;">${refCount} referee score${refCount !== 1 ? 's' : ''}${trimNote}</p>`;
        } else {
            const markHistory = contestant.markHistory ? Object.values(contestant.markHistory) : [];
            const cautionCount = (competitionData.cautions || {})[contestant.originalIndex] || 0;
            const punishmentCount = (competitionData.punishments || {})[contestant.originalIndex] || 0;
            const cautionHtml = cautionCount > 0 ? `<div class="caution-badge">🟨 ${cautionCount} caution${cautionCount > 1 ? 's' : ''}${cautionCount >= 2 ? ` (-${Math.floor(cautionCount/2)})` : ''}</div>` : '';
            const punishmentHtml = punishmentCount > 0 ? `<div class="punishment-badge">🟥 ${punishmentCount} punishment${punishmentCount > 1 ? 's' : ''} (-${punishmentCount})</div>` : '';
            detailsHtml = `<div class="mark-history">${markHistory.slice(-5).map(h => `<div class="mark-history-item ${h.type === 'punishment' ? 'punishment' : h.type === 'caution' ? 'caution' : h.mark < 0 ? 'caution' : 'consensus'}">${h.mark > 0 ? '+' : ''}${h.mark} (${h.votes} votes)</div>`).join('')}</div>${cautionHtml}${punishmentHtml}`;
        }
        card.innerHTML = `<div class="rank">#${contestant.rank}</div><h3 style="color: ${contestant.color}">${contestant.name}</h3><div class="score" style="color: ${contestant.color}">${contestant.finalScore.toFixed(1)}</div>${competitionData.mode === 1 ? '<p style="color: var(--text-muted); font-size: 0.82rem;">/100</p>' : ''}${detailsHtml}`;
        container.appendChild(card);
    });
}

let hiddenPlayers = new Set();

function toggleHidePlayersMenu() {
    const menu = document.getElementById('hide-players-menu');
    const isOpen = menu.style.display !== 'none';
    menu.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) renderHidePlayersList();
}

function renderHidePlayersList() {
    const list = document.getElementById('hide-players-list');
    if (!list || !competitionData?.contestants) return;
    list.innerHTML = competitionData.contestants.map((c, i) => {
        const hidden = hiddenPlayers.has(i);
        return `<div style="display:flex; align-items:center; gap:7px; cursor:pointer; padding:3px 5px; border-radius:6px; background:${hidden ? 'rgba(255,255,255,0.04)' : 'transparent'};" onclick="togglePlayerVisibility(${i})"><span style="font-size:0.95rem;">${hidden ? '🙈' : '👁'}</span><span style="width:9px;height:9px;border-radius:50%;background:${c.color};flex-shrink:0;"></span><span style="font-size:0.82rem; color:${hidden ? 'var(--text-muted)' : 'var(--text-primary)'}; text-decoration:${hidden ? 'line-through' : 'none'};">${c.name}</span></div>`;
    }).join('');
}

function togglePlayerVisibility(index) {
    if (hiddenPlayers.has(index)) hiddenPlayers.delete(index);
    else hiddenPlayers.add(index);
    renderHidePlayersList();
    updateScoreboard();
    const btn = document.getElementById('hide-players-btn');
    if (btn) btn.textContent = hiddenPlayers.size > 0 ? `👁 Hide Players (${hiddenPlayers.size} hidden)` : '👁 Hide Players';
}

function showAllPlayers() {
    hiddenPlayers.clear();
    renderHidePlayersList();
    updateScoreboard();
    const btn = document.getElementById('hide-players-btn');
    if (btn) btn.textContent = '👁 Hide Players';
}

function hideAllPlayers() {
    if (!competitionData?.contestants) return;
    competitionData.contestants.forEach((_, i) => hiddenPlayers.add(i));
    renderHidePlayersList();
    updateScoreboard();
    const btn = document.getElementById('hide-players-btn');
    if (btn) btn.textContent = `👁 Hide Players (${hiddenPlayers.size} hidden)`;
}

document.addEventListener('click', e => {
    const menu = document.getElementById('hide-players-menu');
    const btn = document.getElementById('hide-players-btn');
    if (menu && !menu.contains(e.target) && e.target !== btn) menu.style.display = 'none';
});

function countScoresForContestant(index) {
    if (!competitionData.mode1Scores || !competitionData.mode1Scores[index]) return 0;
    return Object.keys(competitionData.mode1Scores[index]).length;
}

function updateScoreboardTimer() {
    if (competitionData && competitionData.timerState) {
        const remaining = competitionData.timerState.remaining;
        document.getElementById('sb-timer').textContent = `${String(Math.floor(remaining / 60)).padStart(2,'0')}:${String(remaining % 60).padStart(2,'0')}`;
        if (competitionData.timerState.running && !timerInterval) startTimerSync();
    }
}

function updateScoreboardStatus() {
    const statusEl = document.getElementById('sb-competition-status');
    if (!statusEl || !competitionData) return;
    const status = competitionData.status || 'pending';
    const timerRunning = competitionData.timerState?.running || false;
    const remaining = competitionData.timerState?.remaining || 0;
    statusEl.classList.remove('pending', 'running', 'ended');
    if (status === 'running' || timerRunning) { statusEl.classList.add('running'); statusEl.textContent = '🟢 Competition Running'; }
    else if (remaining <= 0 && status !== 'pending') { statusEl.classList.add('ended'); statusEl.textContent = '🔴 Competition Ended'; }
    else { statusEl.classList.add('pending'); statusEl.textContent = '⏳ Waiting to Start'; }
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

function showFinalScoreboard() {
    const type = document.getElementById('final-type').value;
    if (type === 'competition') {
        const sel = document.getElementById('final-comp-select');
        const selectedName = sel?.options[sel.selectedIndex]?.dataset?.name || '';
        const compName = selectedName || document.getElementById('final-comp-name').value.trim();
        if (!compName) { showStatus('Please select or enter a competition name', 'error'); return; }
        let compId = null;
        for (const id in allCompetitions) { if (allCompetitions[id]?.name?.toLowerCase() === compName.toLowerCase()) { compId = id; break; } }
        if (!compId) { showStatus('Competition not found', 'error'); return; }
        renderFinalScoreboardForCompetition(allCompetitions[compId]);
    } else {
        const folderId = document.getElementById('final-folder-select').value;
        if (!folderId) { showStatus('Please select a folder', 'error'); return; }
        renderFinalScoreboardForFolder(folderId);
    }
}

function renderFinalScoreboardForCompetition(comp) {
    if (!comp || !comp.contestants) { showStatus('No competition data', 'error'); return; }
    currentContestants = comp.contestants.map((c, i) => ({ ...c, finalScore: comp.mode === 1 ? calculateWeightedAverageScoreForCompetition(comp, i) : (c.score || 0) })).sort((a, b) => b.finalScore - a.finalScore);
    const folder = comp.folderId && allFolders ? allFolders[comp.folderId] : null;
    currentAwardsConfig = folder && Array.isArray(folder.awards) ? folder.awards : [];
    document.getElementById('final-title').textContent = comp.name;
    document.getElementById('final-subtitle').textContent = comp.description || '';
    buildRevealSequence(); resetReveal();
    document.getElementById('final-scoreboard-display').classList.remove('hidden');
}

function renderFinalScoreboardForFolder(folderId) {
    const folder = allFolders && allFolders[folderId] ? allFolders[folderId] : null;
    if (!folder) { showStatus('Folder not found', 'error'); return; }
    const aggregated = {};
    let competitionCount = 0;
    Object.values(allCompetitions).forEach(comp => {
        if (!comp || !comp.contestants || comp.folderId !== folderId) return;
        competitionCount++;
        comp.contestants.forEach((c, i) => {
            const name = c.name;
            if (!name) return;
            const finalScore = comp.mode === 1 ? calculateWeightedAverageScoreForCompetition(comp, i) : (c.score || 0);
            if (!aggregated[name]) aggregated[name] = { name, color: c.color || '#ffffff', totalScore: 0, competitions: 0 };
            aggregated[name].totalScore += finalScore; aggregated[name].competitions += 1;
        });
    });
    if (competitionCount === 0) { showStatus('No competitions found in this folder', 'error'); return; }
    currentContestants = Object.values(aggregated).sort((a, b) => b.totalScore - a.totalScore);
    currentAwardsConfig = folder && Array.isArray(folder.awards) ? folder.awards : [];
    document.getElementById('final-title').textContent = buildFolderLabel(folderId);
    document.getElementById('final-subtitle').textContent = `Aggregated over ${competitionCount} competition(s).`;
    buildRevealSequence(); resetReveal();
    document.getElementById('final-scoreboard-display').classList.remove('hidden');
}

let revealSequence = [];
let revealStepIndex = 0;

function buildRevealSequence() {
    revealSequence = [];
    const awards = [...currentAwardsConfig].reverse();
    awards.forEach((award, reversedIdx) => { revealSequence.push({ type: 'award', awardIndex: currentAwardsConfig.length - 1 - reversedIdx }); });
    if (currentContestants.length >= 3) revealSequence.push({ type: 'podium', place: 3 });
    if (currentContestants.length >= 2) revealSequence.push({ type: 'podium', place: 2 });
    if (currentContestants.length >= 1) revealSequence.push({ type: 'podium', place: 1 });
}

function revealStep() {
    if (revealStepIndex >= revealSequence.length) return;
    const step = revealSequence[revealStepIndex];
    revealStepIndex++;
    if (step.type === 'award') doRevealAward(step.awardIndex);
    else doRevealPodium(step.place);
    const remaining = revealSequence.length - revealStepIndex;
    const labelEl = document.getElementById('reveal-step-label');
    const btnEl = document.getElementById('reveal-next-btn');
    if (labelEl) {
        if (remaining === 0) { labelEl.textContent = '✅ All revealed'; if (btnEl) { btnEl.disabled = true; btnEl.textContent = '✅ Done'; } }
        else { const next = revealSequence[revealStepIndex]; if (next.type === 'podium') { const names = ['', '冠軍', '亞軍', '季軍']; labelEl.textContent = `Next: ${names[next.place]}`; } else labelEl.textContent = `Next: ${currentAwardsConfig[next.awardIndex]?.name || 'Award'}`; }
    }
}

function resetReveal() {
    revealStepIndex = 0; revealedAwards = [];
    document.getElementById('final-podium').innerHTML = '';
    document.getElementById('final-awards').innerHTML = '';
    const btn = document.getElementById('reveal-next-btn');
    if (btn) { btn.disabled = false; btn.textContent = '▶ Reveal Next'; }
    const lbl = document.getElementById('reveal-step-label');
    if (lbl) {
        if (revealSequence.length > 0) { const first = revealSequence[0]; if (first.type === 'podium') { const names = ['', '冠軍', '亞軍', '季軍']; lbl.textContent = `Next: ${names[first.place]}`; } else lbl.textContent = `Next: ${currentAwardsConfig[first.awardIndex]?.name || 'Award'}`; }
        else lbl.textContent = '';
    }
    renderFinalResultsList();
}

function renderFinalResultsList() {
    const el = document.getElementById('final-results-list');
    if (!el || !currentContestants || currentContestants.length === 0) return;
    const rankLabels = ['🥇 冠軍', '🥈 亞軍', '🥉 季軍'];
    const rows = currentContestants.map((c, i) => { const score = c.finalScore !== undefined ? c.finalScore : (c.totalScore || 0); return `<tr><td style="font-size:1.1rem; font-weight:800; white-space:nowrap;">${rankLabels[i] || '#' + (i+1)}</td><td style="font-size:1.05rem; font-weight:700; color:${c.color};">${c.name}</td><td style="font-size:1.05rem; font-weight:800; color:${c.color}; text-align:right;">${score.toFixed(1)}</td></tr>`; }).join('');
    el.innerHTML = `<div class="rankings-table-section" style="max-width:680px; margin: 0 auto;"><h3 style="margin-bottom:13px;">📋 Full Results</h3><table class="rankings-table" style="width:100%;"><thead><tr><th style="width:115px;">Rank</th><th>Player</th><th style="text-align:right;">Score</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function doRevealPodium(place) {
    const idx = place === 1 ? 0 : place === 2 ? 1 : 2;
    const contestant = currentContestants[idx];
    if (!contestant) return;
    const podiumEl = document.getElementById('final-podium');
    const podiumNames = ['冠軍', '亞軍', '季軍'];
    const podiumClasses = ['first', 'second', 'third'];
    const podiumIdx = place === 1 ? 0 : place === 2 ? 1 : 2;
    const slot = document.createElement('div');
    slot.className = 'podium-slot reveal-pop';
    const card = document.createElement('div');
    card.className = 'podium-card current-highlight';
    card.style.borderColor = contestant.color;
    card.innerHTML = `<div class="podium-rank">${podiumNames[podiumIdx]}</div><div class="podium-name" style="color:${contestant.color}">${contestant.name}</div><div class="podium-score" style="color:${contestant.color}">${(contestant.finalScore ?? contestant.totalScore ?? 0).toFixed(1)}</div>`;
    const base = document.createElement('div');
    base.className = `podium-base ${podiumClasses[podiumIdx]}`;
    slot.appendChild(card); slot.appendChild(base);
    if (place === 3) podiumEl.appendChild(slot);
    else if (place === 2) podiumEl.prepend(slot);
    else { const slots = podiumEl.querySelectorAll('.podium-slot'); if (slots.length === 0) podiumEl.appendChild(slot); else if (slots.length === 1) slots[0].after(slot); else slots[0].after(slot); }
    setTimeout(() => card.classList.remove('current-highlight'), 2000);
}

function doRevealAward(awardIndex) {
    const award = currentAwardsConfig[awardIndex];
    if (!award) return;
    let startIndex = 3;
    for (let i = 0; i < awardIndex; i++) startIndex += currentAwardsConfig[i]?.maxWinners || 0;
    const winners = currentContestants.slice(startIndex, startIndex + award.maxWinners);
    if (winners.length === 0) return;
    const awardsEl = document.getElementById('final-awards');
    const section = document.createElement('div');
    section.className = 'final-awards-section award-section highlight reveal-pop';
    section.innerHTML = `<h3>🏅 ${award.name}</h3>`;
    const list = document.createElement('div');
    list.className = 'final-awards-list';
    winners.forEach((entry, i) => { const item = document.createElement('div'); item.className = 'final-award-item'; item.style.animationDelay = `${i * 0.08}s`; item.innerHTML = `<span class="final-award-name" style="color:${entry.color}">${entry.name}</span><span class="final-award-score" style="color:${entry.color}">${(entry.finalScore ?? entry.totalScore ?? 0).toFixed(1)}</span>`; list.appendChild(item); });
    section.appendChild(list);
    awardsEl.prepend(section);
    revealedAwards.push(awardIndex);
    setTimeout(() => section.classList.remove('highlight'), 2000);
}

