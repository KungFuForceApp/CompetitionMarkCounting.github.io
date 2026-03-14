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
}

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
}

addContestant();
addContestant();
addScoreCategory();
