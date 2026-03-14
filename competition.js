function addScoreCategory() {
    scoreCategoryCount++;
    const div = document.createElement('div');
    div.className = 'score-category-item';
    div.id = `score-category-${scoreCategoryCount}`;
    div.innerHTML = `
        <input type="text" placeholder="Category (e.g., Technique)" class="category-name">
        <input type="number" value="25" min="1" max="100" class="category-weight" onchange="updateWeightTotal()">
        <span style="color: var(--text-muted);">%</span>
        <button onclick="removeScoreCategory(${scoreCategoryCount})">✕</button>
    `;
    document.getElementById('score-categories-list').appendChild(div);
    updateWeightTotal();
}

function removeScoreCategory(id) {
    const element = document.getElementById(`score-category-${id}`);
    if (element) element.remove();
    updateWeightTotal();
}

function updateWeightTotal() {
    let total = 0;
    document.querySelectorAll('.score-category-item .category-weight').forEach(input => { total += parseFloat(input.value) || 0; });
    const totalEl = document.getElementById('weight-total');
    totalEl.textContent = `Total Weight: ${total}%`;
    totalEl.classList.remove('valid', 'invalid');
    if (total === 100) { totalEl.classList.add('valid'); totalEl.textContent += ' ✓'; }
    else { totalEl.classList.add('invalid'); totalEl.textContent += ` (${total < 100 ? 'need ' + (100 - total) + '% more' : (total - 100) + '% over'})`; }
}

function addContestant() {
    contestantCount++;
    const color = colors[(contestantCount - 1) % colors.length];
    const div = document.createElement('div');
    div.className = 'contestant-item';
    div.id = `contestant-${contestantCount}`;
    div.innerHTML = `
        <input type="text" placeholder="Contestant ${contestantCount} Name" class="contestant-name">
        <input type="color" value="${color}" class="contestant-color">
        <button onclick="removeContestant(${contestantCount})">✕</button>
    `;
    document.getElementById('contestants-list').appendChild(div);
}

function removeContestant(id) {
    const element = document.getElementById(`contestant-${id}`);
    if (element) element.remove();
}

function toggleCompJsonImport() {
    const el = document.getElementById('comp-json-import-area');
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function applyCompJson() {
    const raw = document.getElementById('comp-json-input').value.trim();
    const errEl = document.getElementById('comp-json-error');
    errEl.textContent = '';
    let d;
    try { d = JSON.parse(raw); } catch(e) { errEl.textContent = 'Invalid JSON: ' + e.message; return; }
    if (d.name) document.getElementById('comp-name').value = d.name;
    if (d.description !== undefined) document.getElementById('comp-description').value = d.description;
    if (d.mode === 1 || d.mode === 2) { document.getElementById('comp-mode').value = d.mode; updateModeInfo(); }
    if (d.categories && Array.isArray(d.categories)) {
        document.getElementById('score-categories-list').innerHTML = '';
        scoreCategoryCount = 0;
        d.categories.forEach(cat => {
            scoreCategoryCount++;
            const div = document.createElement('div');
            div.className = 'score-category-item';
            div.id = `score-category-${scoreCategoryCount}`;
            div.innerHTML = `<input type="text" placeholder="Category" class="category-name" value="${(cat.name || '').replace(/"/g,'&quot;')}"><input type="number" value="${cat.weight || 25}" min="1" max="100" class="category-weight" onchange="updateWeightTotal()"><span style="color:var(--text-muted);">%</span><button onclick="removeScoreCategory(${scoreCategoryCount})">✕</button>`;
            document.getElementById('score-categories-list').appendChild(div);
        });
        updateWeightTotal();
    }
    if (d.quickButtons) document.getElementById('mode1-quick-buttons').value = d.quickButtons;
    if (d.consensusThreshold) document.getElementById('consensus-threshold').value = d.consensusThreshold;
    if (d.timeWindow) document.getElementById('time-window').value = d.timeWindow;
    if (d.duration) document.getElementById('comp-duration').value = d.duration;
    if (d.quickMarks) document.getElementById('quick-marks').value = d.quickMarks;
    if (d.contestants && Array.isArray(d.contestants)) {
        document.getElementById('contestants-list').innerHTML = '';
        contestantCount = 0;
        d.contestants.forEach((c, idx) => {
            contestantCount++;
            const color = c.color || colors[idx % colors.length];
            const div = document.createElement('div');
            div.className = 'contestant-item';
            div.id = `contestant-${contestantCount}`;
            div.innerHTML = `<input type="text" placeholder="Name" class="contestant-name" value="${(c.name || '').replace(/"/g,'&quot;')}"><input type="color" value="${color}" class="contestant-color"><button onclick="removeContestant(${contestantCount})">✕</button>`;
            document.getElementById('contestants-list').appendChild(div);
        });
    }
    if (d.name) document.getElementById('comp-name').dispatchEvent(new Event('input'));
    showStatus('Form filled from JSON!', 'success');
    document.getElementById('comp-json-import-area').style.display = 'none';
}

function copyCompJson() {
    const mode = parseInt(document.getElementById('comp-mode').value);
    const contestants = [...document.querySelectorAll('.contestant-item')].map(el => ({ name: el.querySelector('.contestant-name').value, color: el.querySelector('.contestant-color').value }));
    const categories = [...document.querySelectorAll('.score-category-item')].map(el => ({ name: el.querySelector('.category-name').value, weight: parseFloat(el.querySelector('.category-weight').value) || 0 }));
    const obj = { name: document.getElementById('comp-name').value, description: document.getElementById('comp-description').value, mode, contestants, ...(mode === 1 ? { categories, quickButtons: document.getElementById('mode1-quick-buttons').value } : { consensusThreshold: parseInt(document.getElementById('consensus-threshold').value), timeWindow: parseFloat(document.getElementById('time-window').value), duration: parseInt(document.getElementById('comp-duration').value), quickMarks: document.getElementById('quick-marks').value }) };
    navigator.clipboard.writeText(JSON.stringify(obj, null, 2)).then(() => showStatus('JSON copied!', 'success')).catch(() => showStatus('Copy failed', 'error'));
}

function createCompetition() {
    const name = document.getElementById('comp-name').value.trim();
    const description = document.getElementById('comp-description').value.trim();
    const mode = parseInt(document.getElementById('comp-mode').value);
    if (!name) { showStatus('Please enter a competition name', 'error'); return; }
    const nameExists = Object.values(allCompetitions).some(comp => comp && comp.name && comp.name.toLowerCase() === name.toLowerCase());
    if (nameExists) { showStatus('This competition name already exists.', 'error'); return; }
    const contestants = [];
    document.querySelectorAll('.contestant-item').forEach(item => {
        const nameInput = item.querySelector('.contestant-name');
        const colorInput = item.querySelector('.contestant-color');
        if (nameInput.value.trim()) contestants.push({ name: nameInput.value.trim(), color: colorInput.value, score: 0, markHistory: [] });
    });
    if (contestants.length < 1) { showStatus('Please add at least 1 contestant', 'error'); return; }
    const competition = { name, description, mode, contestants, referees: {}, createdAt: firebase.database.ServerValue.TIMESTAMP, status: 'pending' };
    const existingFolderSelect = document.getElementById('existing-folder-select');
    if (existingFolderSelect) { const folderId = existingFolderSelect.value; if (folderId && folderId !== '__none__') competition.folderId = folderId; }
    if (mode === 1) {
        const categories = [];
        let totalWeight = 0;
        document.querySelectorAll('#score-categories-list .score-category-item').forEach(item => {
            const nameInput = item.querySelector('.category-name');
            const weightInput = item.querySelector('.category-weight');
            if (!nameInput || !weightInput) return;
            if (nameInput.value.trim()) { const weight = parseFloat(weightInput.value) || 0; categories.push({ name: nameInput.value.trim(), weight }); totalWeight += weight; }
        });
        if (categories.length === 0) { showStatus('Please add at least one score category', 'error'); return; }
        if (totalWeight !== 100) { showStatus('Category weights must total 100%', 'error'); return; }
        competition.scoreCategories = categories;
        const quickInput = document.getElementById('mode1-quick-buttons');
        if (quickInput) { const arr = quickInput.value.split(',').map(x => parseFloat(x.trim())).filter(x => !isNaN(x) && x >= 0 && x <= 100); if (arr.length > 0) competition.mode1QuickButtons = arr.slice(0, 12); }
    }
    if (mode === 2) {
        competition.consensusThreshold = parseInt(document.getElementById('consensus-threshold').value) || 2;
        competition.timeWindow = parseFloat(document.getElementById('time-window').value) || 0.5;
        competition.duration = parseInt(document.getElementById('comp-duration').value) * 60;
        competition.quickMarks = document.getElementById('quick-marks').value.split(',').map(m => parseInt(m.trim())).filter(m => !isNaN(m));
        competition.votes = {};
        competition.refereeCooldowns = {};
        competition.timerState = { running: false, remaining: parseInt(document.getElementById('comp-duration').value) * 60, lastUpdate: null };
        competition.status = 'pending';
    }
    const compId = name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30) + '_' + Date.now().toString(36);
    database.ref(`competitions/${compId}`).set(competition)
        .then(() => {
            document.getElementById('new-comp-name').textContent = name;
            document.getElementById('competition-created').classList.remove('hidden');
            showStatus('Competition created successfully!', 'success');
            currentCompetitionId = compId;
            renderShareLinks(name, document.getElementById('share-links-box'));
        })
        .catch(err => showStatus('Error creating competition: ' + err.message, 'error'));
}

function copyCompetitionName() {
    const name = document.getElementById('new-comp-name').textContent;
    navigator.clipboard.writeText(name).then(() => showStatus('Competition name copied!', 'success'));
}

function joinCompetition() {
    const compName = document.getElementById('join-comp-name').value.trim();
    const refereeName = document.getElementById('referee-name').value.trim();
    if (!compName) { showStatus('Please enter a competition name', 'error'); return; }
    if (!refereeName) { showStatus('Please enter your name', 'error'); return; }
    showStatus('Joining...', 'info');

    const doJoin = (compId) => {
        currentCompetitionId = compId;
        currentRefereeName = refereeName;
        database.ref(`competitions/${compId}`).once('value').then(snapshot => {
            if (!snapshot.exists()) { showStatus('Competition not found', 'error'); return; }
            competitionData = snapshot.val();
            currentRefereeId = database.ref(`competitions/${compId}/referees`).push().key;
            database.ref(`competitions/${compId}/referees/${currentRefereeId}`).set({ name: refereeName, joinedAt: firebase.database.ServerValue.TIMESTAMP, online: true });
            database.ref(`competitions/${compId}/referees/${currentRefereeId}/online`).onDisconnect().set(false);
            document.getElementById('referee-name-display').textContent = refereeName;
            setupRefereeInterface();
        }).catch(err => showStatus('Error joining: ' + err.message, 'error'));
    };

    let compId = null;
    for (const id in allCompetitions) {
        if (allCompetitions[id]?.name?.toLowerCase() === compName.toLowerCase()) { compId = id; break; }
    }
    if (compId) { doJoin(compId); return; }

    database.ref('competitions').orderByChild('name').once('value').then(snapshot => {
        snapshot.forEach(child => {
            if (child.val()?.name?.toLowerCase() === compName.toLowerCase()) { compId = child.key; }
        });
        if (!compId) { showStatus('Competition not found', 'error'); return; }
        allCompetitions[compId] = snapshot.child(compId).val();
        doJoin(compId);
    }).catch(err => showStatus('Error: ' + err.message, 'error'));
}

function setupRefereeInterface() {
    document.getElementById('referee-interface').classList.remove('hidden');
    document.getElementById('ref-comp-name').textContent = competitionData.name;
    document.getElementById('ref-comp-mode').textContent = competitionData.mode === 1 ? 'Average Scoring' : 'Consensus Scoring';
    document.getElementById('referee-controls').classList.remove('hidden');
    const refTimer = document.getElementById('ref-timer');
    const refStatus = document.getElementById('ref-status');
    const refTimerControls = document.getElementById('ref-timer-controls');
    const mode2Start = document.getElementById('referee-mode2-start');
    if (competitionData.mode === 2) {
        refTimer.classList.remove('hidden'); refStatus.classList.remove('hidden');
        if (competitionData.status === 'pending' && (!competitionData.timerState || !competitionData.timerState.running)) { mode2Start.classList.remove('hidden'); refTimerControls.classList.add('hidden'); }
        else { mode2Start.classList.add('hidden'); refTimerControls.classList.remove('hidden'); }
    } else { refTimer.classList.add('hidden'); refStatus.classList.add('hidden'); mode2Start.classList.add('hidden'); refTimerControls.classList.add('hidden'); }
    const compRef = database.ref(`competitions/${currentCompetitionId}`);
    const unsub = compRef.on('value', snapshot => {
        competitionData = snapshot.val();
        if (competitionData) {
            updateRefereeCards(); updateRefereeCount();
            if (competitionData.mode === 2) {
                updateRefTimer(); updateRefereeStatus(); updateRefToggleButton();
                if (competitionData.status === 'pending' && (!competitionData.timerState || !competitionData.timerState.running)) { mode2Start.classList.remove('hidden'); refTimerControls.classList.add('hidden'); }
                else { mode2Start.classList.add('hidden'); refTimerControls.classList.remove('hidden'); }
                if ((competitionData.status === 'running' || competitionData.timerState?.running) && !timerInterval) startTimerSync();
            }
        }
    });
    unsubscribers.push(() => compRef.off('value', unsub));
}

function updateRefereeStatus() {
    const statusEl = document.getElementById('ref-status');
    if (!statusEl || !competitionData) return;
    const status = competitionData.status || 'pending';
    const timerRunning = competitionData.timerState?.running || false;
    const remaining = competitionData.timerState?.remaining || 0;
    statusEl.classList.remove('pending', 'running', 'ended');
    if (status === 'running' || timerRunning) { statusEl.classList.add('running'); statusEl.textContent = '🟢 Competition Active - Score Now!'; }
    else if (remaining <= 0 && status !== 'pending') { statusEl.classList.add('ended'); statusEl.textContent = '🔴 Competition Ended'; }
    else { statusEl.classList.add('pending'); statusEl.textContent = '⏳ Waiting to start...'; }
}

function updateRefereeCards() {
    const container = document.getElementById('referee-cards');
    container.innerHTML = '';
    competitionData.contestants.forEach((contestant, index) => {
        const card = document.createElement('div');
        card.className = 'contestant-card';
        card.style.borderColor = contestant.color;
        if (competitionData.mode === 1) {
            const categories = competitionData.scoreCategories || [{ name: 'Score', weight: 100 }];
            const myScores = getMyScores(index);
            const quickButtons = Array.isArray(competitionData.mode1QuickButtons) && competitionData.mode1QuickButtons.length > 0 ? competitionData.mode1QuickButtons : [60, 70, 80, 90, 95, 100];
            const hasSubmitted = myScores && Object.keys(myScores).length > 0;
            const submittedBadge = hasSubmitted ? '<span class="score-submitted-badge">✓ Submitted</span>' : '';
            let categoryInputsHtml = categories.map((cat, catIndex) => {
                const myScore = myScores[cat.name] || '';
                const quickHtml = `<div class="quick-marks mode1">${quickButtons.map(val => `<button type="button" class="quick-mark-btn small" onclick="setMode1QuickScore(${index}, ${catIndex}, ${val})">${val}</button>`).join('')}</div>`;
                return `<div class="category-score-row"><label>${cat.name}</label><span class="weight-badge">${cat.weight}%</span><input type="number" id="score-input-${index}-${catIndex}" min="0" max="100" step="0.1" placeholder="0-100" value="${myScore}"></div>${quickHtml}`;
            }).join('');
            card.innerHTML = `<h3 style="color: ${contestant.color}">${contestant.name} ${submittedBadge}</h3><div class="current-score" style="color: ${contestant.color}">${calculateWeightedAverageScore(index).toFixed(1)}</div><p style="color: var(--text-muted); font-size: 0.82rem;">/100</p><div class="category-scores">${categoryInputsHtml}<button class="submit-all-scores-btn" onclick="submitMode1Scores(${index})">Submit Scores</button></div>`;
        } else {
            const quickMarks = competitionData.quickMarks || [1, 2, 3, 5, 10];
            const threshold = competitionData.consensusThreshold || 2;
            const votes = competitionData.votes?.[index] || {};
            const recentVotes = Object.values(votes).filter(v => v.timestamp && (Date.now() - v.timestamp) < (competitionData.timeWindow || 0.5) * 1000);
            const markCounts = {};
            recentVotes.forEach(v => { markCounts[v.mark] = (markCounts[v.mark] || 0) + 1; });
            const cautionCount = competitionData.cautions?.[index] || 0;
            const punishmentCount = competitionData.punishments?.[index] || 0;
            const cautionVotes = competitionData.cautionVotes?.[index] || {};
            const recentCautionVotes = Object.values(cautionVotes).filter(v => v.timestamp && (Date.now() - v.timestamp) < (competitionData.timeWindow || 0.5) * 1000);
            const punishmentVotes = competitionData.punishmentVotes?.[index] || {};
            const recentPunishmentVotes = Object.values(punishmentVotes).filter(v => v.timestamp && (Date.now() - v.timestamp) < (competitionData.timeWindow || 0.5) * 1000);
            card.innerHTML = `<h3 style="color: ${contestant.color}">${contestant.name}</h3><div class="current-score" style="color: ${contestant.color}">${contestant.score || 0}</div><p style="color: var(--text-muted); font-size: 0.82rem;">Need ${threshold} referees</p><div class="quick-marks" id="quick-marks-${index}">${quickMarks.map(mark => `<button class="quick-mark-btn" onclick="submitMode2Vote(${index}, ${mark})" data-mark="${mark}">+${mark}</button>`).join('')}</div><div class="vote-indicator"><span class="vote-count" id="vote-status-${index}">${formatVoteStatus(markCounts, threshold)}</span></div><button class="caution-btn" onclick="submitCautionVote(${index})">🟨 Caution (2× = -1)</button><div class="penalty-vote-status" id="caution-vote-status-${index}">${recentCautionVotes.length}/${threshold} caution votes</div>${cautionCount > 0 ? `<div class="caution-count">🟨 ${cautionCount} caution${cautionCount > 1 ? 's' : ''}${cautionCount >= 2 ? ` (-${Math.floor(cautionCount/2)})` : ''}</div>` : ''}<button class="punishment-btn" onclick="submitPunishmentVote(${index})">🟥 Punishment (-1)</button><div class="penalty-vote-status" id="punishment-vote-status-${index}">${recentPunishmentVotes.length}/${threshold} punishment votes</div>${punishmentCount > 0 ? `<div class="punishment-count">🟥 ${punishmentCount} punishment${punishmentCount > 1 ? 's' : ''} (-${punishmentCount})</div>` : ''}`;
        }
        container.appendChild(card);
    });
}

function formatVoteStatus(markCounts, threshold) {
    if (Object.keys(markCounts).length === 0) return 'Waiting for votes...';
    return Object.entries(markCounts).map(([mark, count]) => `+${mark}: ${count}/${threshold}`).join(' | ');
}

function submitCautionVote(contestantIndex) {
    if (!competitionData.timerState || !competitionData.timerState.running) { showStatus('Competition not running', 'error'); return; }
    const voteRef = database.ref(`competitions/${currentCompetitionId}/cautionVotes/${contestantIndex}`).push();
    voteRef.set({ refereeId: currentRefereeId, refereeName: currentRefereeName, timestamp: Date.now() }).then(() => {
        checkCautionConsensus(contestantIndex);
    });
}

function checkCautionConsensus(contestantIndex) {
    database.ref(`competitions/${currentCompetitionId}/cautionVotes/${contestantIndex}`).once('value').then(snapshot => {
        const votes = snapshot.val();
        if (!votes) return;
        const now = Date.now();
        const timeWindow = (competitionData.timeWindow || 0.5) * 1000;
        const requiredVotes = competitionData.consensusThreshold || 2;
        const recent = Object.values(votes).filter(v => typeof v.timestamp === 'number' && (now - v.timestamp) < timeWindow);
        const statusEl = document.getElementById(`caution-vote-status-${contestantIndex}`);
        if (statusEl) statusEl.textContent = `${recent.length}/${requiredVotes} caution votes`;
        if (recent.length >= requiredVotes) {
            const currentCautions = competitionData.cautions?.[contestantIndex] || 0;
            const newCautions = currentCautions + 1;
            const currentScore = competitionData.contestants[contestantIndex].score || 0;
            const updates = {};
            updates[`cautions/${contestantIndex}`] = newCautions;
            updates[`cautionVotes/${contestantIndex}`] = null;
            if (newCautions % 2 === 0) {
                updates[`contestants/${contestantIndex}/score`] = currentScore - 1;
                const histRef = database.ref(`competitions/${currentCompetitionId}/contestants/${contestantIndex}/markHistory`).push();
                histRef.set({ mark: -1, votes: recent.length, timestamp: Date.now(), type: 'caution', referees: recent.map(v => v.refereeName).join(', ') });
                showStatus(`🟨 Caution #${newCautions} — -1 score applied!`, 'info');
            } else {
                showStatus(`🟨 Caution #${newCautions} issued`, 'info');
            }
            database.ref(`competitions/${currentCompetitionId}`).update(updates);
        }
    });
}


function submitPunishmentVote(contestantIndex) {
    if (!competitionData.timerState || !competitionData.timerState.running) { showStatus('Competition not running', 'error'); return; }
    const voteRef = database.ref(`competitions/${currentCompetitionId}/punishmentVotes/${contestantIndex}`).push();
    voteRef.set({ refereeId: currentRefereeId, refereeName: currentRefereeName, timestamp: Date.now() }).then(() => {
        checkPunishmentConsensus(contestantIndex);
    });
}

function checkPunishmentConsensus(contestantIndex) {
    database.ref(`competitions/${currentCompetitionId}/punishmentVotes/${contestantIndex}`).once('value').then(snapshot => {
        const votes = snapshot.val();
        if (!votes) return;
        const now = Date.now();
        const timeWindow = (competitionData.timeWindow || 0.5) * 1000;
        const requiredVotes = competitionData.consensusThreshold || 2;
        const recent = Object.values(votes).filter(v => typeof v.timestamp === 'number' && (now - v.timestamp) < timeWindow);
        const statusEl = document.getElementById(`punishment-vote-status-${contestantIndex}`);
        if (statusEl) statusEl.textContent = `${recent.length}/${requiredVotes} punishment votes`;
        if (recent.length >= requiredVotes) {
            const currentPunishments = competitionData.punishments?.[contestantIndex] || 0;
            const currentScore = competitionData.contestants[contestantIndex].score || 0;
            const updates = {};
            updates[`punishments/${contestantIndex}`] = currentPunishments + 1;
            updates[`punishmentVotes/${contestantIndex}`] = null;
            updates[`contestants/${contestantIndex}/score`] = currentScore - 1;
            const histRef = database.ref(`competitions/${currentCompetitionId}/contestants/${contestantIndex}/markHistory`).push();
            histRef.set({ mark: -1, votes: recent.length, timestamp: Date.now(), type: 'punishment', referees: recent.map(v => v.refereeName).join(', ') });
            showStatus(`🟥 Punishment issued — -1 score!`, 'info');
            database.ref(`competitions/${currentCompetitionId}`).update(updates);
        }
    });

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

function getMyScores(contestantIndex) {
    if (!competitionData.mode1Scores) return {};
    const scores = competitionData.mode1Scores[contestantIndex];
    if (!scores || !scores[currentRefereeId]) return {};
    const refScores = scores[currentRefereeId];
    const result = {};
    for (const key in refScores) { if (key !== 'timestamp' && key !== 'refereeName') result[key] = refScores[key]; }
    return result;
}

function updateRefereeCount() {
    const referees = competitionData.referees || {};
    const onlineCount = Object.values(referees).filter(r => r.online).length;
    document.getElementById('ref-count').textContent = onlineCount;
}

function updateRefTimer() {
    if (competitionData && competitionData.timerState) {
        const remaining = competitionData.timerState.remaining;
        const minutes = Math.floor(remaining / 60);
        const seconds = remaining % 60;
        document.getElementById('ref-timer').textContent = `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
        isTimerRunning = competitionData.timerState.running;
        remainingTime = remaining;
        if (isTimerRunning && !timerInterval) startTimerSync();
    }
}

function updateRefToggleButton() {
    const btn = document.getElementById('ref-toggle-btn');
    if (!btn) return;
    const running = competitionData?.timerState?.running || false;
    btn.textContent = running ? '⏸ Stop' : '▶ Start';
    btn.className = running ? 'stop-btn' : 'start-btn';
}

function submitMode1Scores(contestantIndex) {
    const categories = competitionData.scoreCategories || [{ name: 'Score', weight: 100 }];
    const scores = {};
    let valid = true;
    categories.forEach((cat, catIndex) => {
        const input = document.getElementById(`score-input-${contestantIndex}-${catIndex}`);
        const score = parseFloat(input.value);
        if (isNaN(score) || score < 0 || score > 100) valid = false;
        else scores[cat.name] = score;
    });
    if (!valid) { showStatus('Please enter valid scores (0-100) for all categories', 'error'); return; }
    scores.refereeName = currentRefereeName;
    scores.timestamp = firebase.database.ServerValue.TIMESTAMP;
    database.ref(`competitions/${currentCompetitionId}/mode1Scores/${contestantIndex}/${currentRefereeId}`).set(scores)
        .then(() => { showStatus('Scores submitted!', 'success'); updateRefereeCards(); })
        .catch(err => showStatus('Error: ' + err.message, 'error'));
}

function setMode1QuickScore(contestantIndex, catIndex, val) {
    const input = document.getElementById(`score-input-${contestantIndex}-${catIndex}`);
    if (!input) return;
    input.value = String(val);
    input.dispatchEvent(new Event('input', { bubbles: true }));
}

function submitMode2Vote(contestantIndex, mark) {
    if (!competitionData.timerState || !competitionData.timerState.running) { showStatus('Competition not running', 'error'); return; }
    const refereeCooldowns = competitionData.refereeCooldowns || {};
    const lastVoteTime = refereeCooldowns[currentRefereeId] || 0;
    const now = Date.now();
    const timeWindow = (competitionData.timeWindow || 0.5) * 1000;
    if (now - lastVoteTime < timeWindow) { showStatus(`Please wait ${((timeWindow - (now - lastVoteTime)) / 1000).toFixed(1)}s`, 'error'); return; }
    const voteRef = database.ref(`competitions/${currentCompetitionId}/votes/${contestantIndex}`).push();
    voteRef.set({ mark, refereeId: currentRefereeId, refereeName: currentRefereeName, timestamp: Date.now() }).then(() => {
        database.ref(`competitions/${currentCompetitionId}/refereeCooldowns/${currentRefereeId}`).set(now);
        const btn = document.querySelector(`#quick-marks-${contestantIndex} .quick-mark-btn[data-mark="${mark}"]`);
        if (btn) { btn.classList.add('voted'); btn.disabled = true; setTimeout(() => { btn.classList.remove('voted'); btn.disabled = false; }, timeWindow); }
        checkConsensusFromDb(contestantIndex);
    });
}

function checkConsensusFromDb(contestantIndex) {
    const votesRef = database.ref(`competitions/${currentCompetitionId}/votes/${contestantIndex}`);
    votesRef.once('value').then(snapshot => {
        const votes = snapshot.val();
        if (!votes) return;
        const now = Date.now();
        const timeWindow = (competitionData.timeWindow || 0.5) * 1000;
        const requiredVotes = competitionData.consensusThreshold || 2;
        const voteArray = Object.values(votes);
        const recentVotes = voteArray.filter(v => typeof v.timestamp === 'number' && (now - v.timestamp) < timeWindow);
        const markCounts = {};
        recentVotes.forEach(v => { markCounts[v.mark] = (markCounts[v.mark] || 0) + 1; });
        for (const [mark, count] of Object.entries(markCounts)) {
            if (count >= requiredVotes) {
                const currentScore = competitionData.contestants[contestantIndex].score || 0;
                const newScore = currentScore + parseInt(mark);
                const updates = {};
                updates[`contestants/${contestantIndex}/score`] = newScore;
                updates[`votes/${contestantIndex}`] = null;
                const historyRef = database.ref(`competitions/${currentCompetitionId}/contestants/${contestantIndex}/markHistory`).push();
                historyRef.set({ mark: parseInt(mark), votes: count, timestamp: Date.now(), referees: recentVotes.map(v => v.refereeName).join(', ') });
                database.ref(`competitions/${currentCompetitionId}`).update(updates);
                showStatus(`+${mark} scored!`, 'success');
                break;
            }
        }
        const statusEl = document.getElementById(`vote-status-${contestantIndex}`);
        if (statusEl) statusEl.textContent = formatVoteStatus(markCounts, requiredVotes);
    });

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

