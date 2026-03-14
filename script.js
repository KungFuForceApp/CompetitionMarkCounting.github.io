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
        }

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
            if (localStorage.getItem('theme') === 'light') {
                document.body.classList.add('light-mode');
                document.getElementById('theme-icon').textContent = '🌙';
                document.getElementById('theme-label').textContent = 'Dark Mode';
            }
        })();

        function updateRankingsFolderFilter() {
            const sel = document.getElementById('rankings-folder-filter');
            if (!sel) return;
            const current = sel.value;
            sel.innerHTML = '<option value="">All Competitions</option>';
            Object.entries(allFolders).forEach(([id, folder]) => {
                if (!folder || !folder.name) return;
                const opt = document.createElement('option');
                opt.value = id; opt.textContent = buildFolderLabel(id);
                sel.appendChild(opt);
            });
            sel.value = current;
        }

        let customAwardOrder = [];

        function loadAwardOrder() {
            database.ref('awardOrder').on('value', snap => {
                customAwardOrder = snap.val() || [];
                const panel = document.getElementById('rankings-panel');
                if (panel && panel.classList.contains('active')) buildRankings();
            });
        }
        loadAwardOrder();

        function collectOrderedAwardNames(compsToAnalyse) {
            const seen = [];
            compsToAnalyse.forEach(comp => {
                const folder = comp.folderId && allFolders ? allFolders[comp.folderId] : null;
                (folder?.awards || []).forEach(a => { if (a.name && !seen.includes(a.name)) seen.push(a.name); });
            });
            const ordered = customAwardOrder.filter(n => seen.includes(n));
            seen.forEach(n => { if (!ordered.includes(n)) ordered.push(n); });
            return ordered;
        }

        function renderAwardOrderDisplay(orderedAwardNames) {
            const display = document.getElementById('award-order-display');
            if (!display) return;
            if (orderedAwardNames.length === 0) { display.innerHTML = `<span style="color:var(--text-muted); font-size:0.82rem;">No awards defined yet.</span>`; return; }
            display.innerHTML = `<div style="display:flex; flex-wrap:wrap; gap:5px; align-items:center;">` + orderedAwardNames.map((name, i) => `<span class="award-chip">${i + 1}. 🏅 ${name}</span>`).join('<span style="color:var(--text-muted);font-size:0.87rem;margin:0 1px;"> › </span>') + `</div>`;
        }

        function toggleAwardOrderEditor() {
            const editor = document.getElementById('award-order-editor');
            const btn = document.getElementById('award-order-toggle-btn');
            const isHidden = editor.classList.contains('hidden');
            editor.classList.toggle('hidden', !isHidden);
            btn.textContent = isHidden ? '✕ Close' : '✏️ Edit Order';
            if (isHidden) renderAwardOrderEditor();
        }

        let dragSrcIndex = null;

        function renderAwardOrderEditor() {
            const list = document.getElementById('award-order-list');
            if (!list) return;
            const allComps = Object.values(allCompetitions).filter(c => c && c.contestants);
            const names = collectOrderedAwardNames(allComps);
            if (names.length === 0) { list.innerHTML = `<p style="color:var(--text-muted); font-size:0.85rem;">No awards found.</p>`; return; }
            list.innerHTML = '';
            names.forEach((name, i) => {
                const div = document.createElement('div');
                div.className = 'award-order-item'; div.draggable = true; div.dataset.index = i;
                div.innerHTML = `<span class="drag-handle">☰</span><span class="award-order-rank">#${i + 1}</span><span class="award-order-name">🏅 ${name}</span><span style="color:var(--text-muted);font-size:0.76rem;">${i === 0 ? 'Highest' : i === names.length - 1 ? 'Lowest' : ''}</span>`;
                attachDragEvents(div, list, names.length);
                list.appendChild(div);
            });
        }

        function attachDragEvents(div, list, total) {
            const i = parseInt(div.dataset.index);
            div.addEventListener('dragstart', e => { dragSrcIndex = i; e.dataTransfer.effectAllowed = 'move'; });
            div.addEventListener('dragover', e => { e.preventDefault(); list.querySelectorAll('.award-order-item').forEach(el => el.classList.remove('drag-over')); div.classList.add('drag-over'); });
            div.addEventListener('dragleave', () => div.classList.remove('drag-over'));
            div.addEventListener('drop', e => {
                e.preventDefault(); div.classList.remove('drag-over');
                if (dragSrcIndex === null || dragSrcIndex === i) return;
                const items = [...list.querySelectorAll('.award-order-item')].map(el => el.querySelector('.award-order-name').textContent.replace('🏅 ', '').trim());
                const moved = items.splice(dragSrcIndex, 1)[0];
                items.splice(i, 0, moved);
                dragSrcIndex = null;
                list.innerHTML = '';
                items.forEach((n, idx) => {
                    const d = document.createElement('div');
                    d.className = 'award-order-item'; d.draggable = true; d.dataset.index = idx;
                    d.innerHTML = `<span class="drag-handle">☰</span><span class="award-order-rank">#${idx + 1}</span><span class="award-order-name">🏅 ${n}</span><span style="color:var(--text-muted);font-size:0.76rem;">${idx === 0 ? 'Highest' : idx === items.length - 1 ? 'Lowest' : ''}</span>`;
                    attachDragEvents(d, list, items.length);
                    list.appendChild(d);
                });
            });
        }

        function saveAwardOrder() {
            const list = document.getElementById('award-order-list');
            if (!list) return;
            const newOrder = [...list.querySelectorAll('.award-order-item')].map(el => el.querySelector('.award-order-name').textContent.replace('🏅 ', '').trim());
            database.ref('awardOrder').set(newOrder).then(() => { showStatus('Award order saved!', 'success'); toggleAwardOrderEditor(); }).catch(err => showStatus('Error: ' + err.message, 'error'));
        }

        function buildRankings() {
            updateRankingsFolderFilter();
            const container = document.getElementById('rankings-content');
            if (!container) return;
            const folderFilter = document.getElementById('rankings-folder-filter')?.value || '';
            const compsToAnalyse = Object.values(allCompetitions).filter(comp => {
                if (!comp || !comp.contestants) return false;
                if (folderFilter && comp.folderId !== folderFilter) return false;
                return true;
            });
            const awardColNames = collectOrderedAwardNames(compsToAnalyse);
            renderAwardOrderDisplay(awardColNames);
            if (compsToAnalyse.length === 0) { container.innerHTML = `<div class="no-data-rankings"><div class="icon">🏆</div><p>No competitions found.</p></div>`; return; }
            const playerStats = {};
            compsToAnalyse.forEach(comp => {
                const contestants = comp.contestants.map((c, i) => ({ ...c, finalScore: comp.mode === 1 ? calculateWeightedAverageScoreForCompetition(comp, i) : (c.score || 0) })).sort((a, b) => b.finalScore - a.finalScore);
                contestants.forEach((c, rank) => {
                    const name = c.name;
                    if (!name) return;
                    if (!playerStats[name]) playerStats[name] = { color: c.color || '#ffffff', gold: 0, silver: 0, bronze: 0, awardCounts: {}, totalScore: 0, comps: 0 };
                    playerStats[name].totalScore += c.finalScore; playerStats[name].comps += 1;
                    if (rank === 0) playerStats[name].gold += 1;
                    else if (rank === 1) playerStats[name].silver += 1;
                    else if (rank === 2) playerStats[name].bronze += 1;
                });
                const folder = comp.folderId && allFolders ? allFolders[comp.folderId] : null;
                const awards = folder && Array.isArray(folder.awards) ? folder.awards : [];
                let startIndex = 3;
                awards.forEach(award => {
                    const winners = contestants.slice(startIndex, startIndex + award.maxWinners);
                    winners.forEach(w => { if (!w.name) return; if (!playerStats[w.name]) playerStats[w.name] = { color: w.color || '#ffffff', gold: 0, silver: 0, bronze: 0, awardCounts: {}, totalScore: 0, comps: 0 }; playerStats[w.name].awardCounts[award.name] = (playerStats[w.name].awardCounts[award.name] || 0) + 1; });
                    startIndex += award.maxWinners;
                });
            });
            const sorted = Object.entries(playerStats).sort(([, a], [, b]) => {
                if (b.gold !== a.gold) return b.gold - a.gold;
                if (b.silver !== a.silver) return b.silver - a.silver;
                if (b.bronze !== a.bronze) return b.bronze - a.bronze;
                for (const awardName of awardColNames) { const diff = (b.awardCounts[awardName] || 0) - (a.awardCounts[awardName] || 0); if (diff !== 0) return diff; }
                return b.totalScore - a.totalScore;
            });
            if (sorted.length === 0) { container.innerHTML = `<div class="no-data-rankings"><div class="icon">🏆</div><p>No player data available yet.</p></div>`; return; }
            const podiumMedals = ['🥇', '🥈', '🥉'];
            const podiumClasses = ['first', 'second', 'third'];
            const top3 = sorted.slice(0, 3);
            const displayOrder = top3.length >= 3 ? [1, 0, 2] : (top3.length === 2 ? [1, 0] : [0]);
            const podiumHtml = displayOrder.map(idx => {
                if (!top3[idx]) return '';
                const [name, stats] = top3[idx];
                const actualRank = idx;
                const awardChipsHtml = awardColNames.filter(aName => stats.awardCounts[aName]).map(aName => `<span class="award-chip" style="font-size:0.7rem; padding:2px 7px;">🏅 ${aName}${stats.awardCounts[aName] > 1 ? ` ×${stats.awardCounts[aName]}` : ''}</span>`).join('');
                const badgesHtml = [stats.gold ? `<span class="rank-badge gold">🥇 ${stats.gold}</span>` : '', stats.silver ? `<span class="rank-badge silver">🥈 ${stats.silver}</span>` : '', stats.bronze ? `<span class="rank-badge bronze">🥉 ${stats.bronze}</span>` : ''].filter(Boolean).join('');
                return `<div class="rankings-podium-slot"><div class="rankings-podium-card" style="border-color: ${stats.color}"><div class="rankings-podium-medal">${podiumMedals[actualRank]}</div><div class="rankings-podium-name" style="color:${stats.color}">${name}</div><div class="rankings-podium-badges">${badgesHtml}</div>${awardChipsHtml ? `<div style="margin-top:5px;">${awardChipsHtml}</div>` : ''}<div style="font-size:0.72rem; color:var(--text-muted); margin-top:5px;">${stats.comps} comp${stats.comps !== 1 ? 's' : ''} · ${stats.totalScore.toFixed(1)} pts</div></div><div class="rankings-podium-base ${podiumClasses[actualRank]}"></div></div>`;
            }).join('');
            const awardHeaderCols = awardColNames.map((name, i) => `<th>🏅 ${name}<br><span style="font-size:0.66rem; font-weight:400; color:var(--text-muted);">rank ${i + 1}</span></th>`).join('');
            const tableRows = sorted.map(([name, stats], i) => {
                const rank = i + 1;
                const rankDisplay = rank === 1 ? `<span class="rank-num r1">🥇</span>` : rank === 2 ? `<span class="rank-num r2">🥈</span>` : rank === 3 ? `<span class="rank-num r3">🥉</span>` : `<span class="rank-num" style="color:var(--text-muted)">#${rank}</span>`;
                const awardCells = awardColNames.map(aName => { const count = stats.awardCounts[aName] || 0; return `<td>${count ? `<span class="award-col-badge">${count}</span>` : `<span style="color:var(--text-muted)">—</span>`}</td>`; }).join('');
                return `<tr class="${rank <= 3 ? 'top-3' : ''}"><td>${rankDisplay}</td><td><span class="player-dot" style="background:${stats.color}"></span>${name}</td><td><span class="rank-badge gold">${stats.gold}</span></td><td><span class="rank-badge silver">${stats.silver}</span></td><td><span class="rank-badge bronze">${stats.bronze}</span></td>${awardCells}<td class="total-score-cell" style="color:${stats.color}">${stats.totalScore.toFixed(1)}</td><td style="color:var(--text-muted)">${stats.comps}</td></tr>`;
            }).join('');
            const sortLabel = ['🥇 Gold', '🥈 Silver', '🥉 Bronze', ...awardColNames.map(a => `🏅 ${a}`), 'Total Score'].join(' → ');
            container.innerHTML = `<div class="rankings-podium-section"><h3>🏆 Top Players Podium</h3><p class="podium-subtitle">Ranked by: ${sortLabel}</p><div class="rankings-podium">${podiumHtml}</div></div><div class="rankings-table-section"><h3>📋 Full Leaderboard <span style="font-weight:400; font-size:0.87rem; color:var(--text-muted)">${sorted.length} players · ${compsToAnalyse.length} competitions</span></h3><div style="overflow-x: auto;"><table class="rankings-table"><thead><tr><th>Rank</th><th>Player</th><th>🥇 1st</th><th>🥈 2nd</th><th>🥉 3rd</th>${awardHeaderCols}<th>Total Score</th><th>Comps</th></tr></thead><tbody>${tableRows}</tbody></table></div></div>`;
        }

        const _showPanelBase = showPanel;
        showPanel = function(panelName) {
            _showPanelBase(panelName);
            if (panelName === 'rankings') { updateRankingsFolderFilter(); buildRankings(); }
            if (panelName === 'winner') { updateWinnerFolderFilter(); }
        };

        function updateWinnerFolderFilter() {
            const sel = document.getElementById('winner-folder-filter');
            if (!sel) return;
            const cur = sel.value;
            sel.innerHTML = '<option value="">All Competitions</option>';
            Object.entries(allFolders).forEach(([id, f]) => {
                if (!f?.name) return;
                const o = document.createElement('option');
                o.value = id; o.textContent = buildFolderLabel(id); sel.appendChild(o);
            });
            if (cur && sel.querySelector(`option[value="${cur}"]`)) sel.value = cur;
        }

        function wrRankings(ff) {
            const comps = Object.values(allCompetitions)
                .filter(c => c?.contestants && (!ff || c.folderId === ff));
            if (!comps.length) return [];
            const ps = {};
            comps.forEach(comp => {
                comp.contestants
                    .map((c, i) => ({
                        ...c,
                        fs: comp.mode === 1
                            ? calculateWeightedAverageScoreForCompetition(comp, i)
                            : (c.score || 0)
                    }))
                    .sort((a, b) => b.fs - a.fs)
                    .forEach((c, rank) => {
                        if (!c.name) return;
                        if (!ps[c.name]) ps[c.name] = { name:c.name, gold:0, silver:0, bronze:0, total:0, comps:0 };
                        ps[c.name].total += c.fs; ps[c.name].comps++;
                        if (rank===0) ps[c.name].gold++;
                        else if (rank===1) ps[c.name].silver++;
                        else if (rank===2) ps[c.name].bronze++;
                    });
            });
            return Object.values(ps).sort((a,b) =>
                b.gold!==a.gold ? b.gold-a.gold :
                b.silver!==a.silver ? b.silver-a.silver :
                b.bronze!==a.bronze ? b.bronze-a.bronze :
                b.total-a.total
            );
        }
        let _wac = null;
        function wac() {
            if (!_wac) _wac = new (window.AudioContext || window.webkitAudioContext)();
            if (_wac.state === 'suspended') _wac.resume();
            return _wac;
        }
        let _wrMaster = null;
        function wrMaster() {
            if (_wrMaster) return _wrMaster;
            const c = wac();
            const comp = c.createDynamicsCompressor();
            comp.threshold.value = -14; comp.knee.value = 8;
            comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.15;
            comp.connect(c.destination);
            _wrMaster = comp; return comp;
        }
        let _wrv = null;
        function getrev() {
            if (_wrv) return _wrv;
            const c = wac(), len = c.sampleRate * 3.0;
            const b = c.createBuffer(2, len, c.sampleRate);
            for (let ch = 0; ch < 2; ch++) {
                const d = b.getChannelData(ch);
                for (let i = 0; i < len; i++)
                    d[i] = (Math.random()*2-1) * Math.pow(1-i/len, 2.2) * (i < 200 ? i/200 : 1);
            }
            _wrv = c.createConvolver(); _wrv.buffer = b;
            _wrv.connect(wrMaster()); return _wrv;
        }

        function wrOsc(f, type, dur, vol, delay, atk, dec, rev) {
            try {
                const c = wac(), o = c.createOscillator(), g = c.createGain();
                o.type = type; o.frequency.value = f;
                o.connect(g); g.connect(rev ? getrev() : wrMaster());
                const t = c.currentTime + (delay||0);
                g.gain.setValueAtTime(0.0001, t);
                g.gain.linearRampToValueAtTime(vol, t+(atk||0.01));
                g.gain.exponentialRampToValueAtTime(0.0001, t+dur-(dec||0.12));
                o.start(t); o.stop(t+dur+0.05);
            } catch(e) {}
        }
        function wrNoiz(dur, vol, hz, delay, q) {
            try {
                const c = wac(), len = c.sampleRate*(dur+0.05);
                const b = c.createBuffer(1, len, c.sampleRate);
                const d = b.getChannelData(0);
                for (let i = 0; i < len; i++) d[i] = Math.random()*2-1;
                const s = c.createBufferSource(), g = c.createGain(), fi = c.createBiquadFilter();
                fi.type = 'bandpass'; fi.frequency.value = hz||500; fi.Q.value = q||0.6;
                s.buffer = b; s.connect(fi); fi.connect(g); g.connect(wrMaster());
                const t = c.currentTime + (delay||0);
                g.gain.setValueAtTime(vol, t);
                g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
                s.start(t); s.stop(t+dur+0.05);
            } catch(e) {}
        }

        function wrSndTick(n) {
            const f = n===3 ? 330 : n===2 ? 440 : 587;
            wrOsc(f,   'sine', 0.16, 0.22, 0, 0.003, 0.08);
            wrOsc(f/2, 'sine', 0.14, 0.12, 0, 0.003, 0.07, true);
            wrNoiz(0.05, 0.06, 1800);
        }
        function wrSndGo() {
            [392,523,659,784,1047].forEach((f,i) =>
                wrOsc(f,'triangle',0.5,0.18,i*0.04,0.006,0.12,true)
            );
            wrNoiz(0.1, 0.08, 2200);
        }

        function wrSndSwell() {
            try {
                const c = wac();
                [[41.2,0],[82.4,0.05],[164.8,0.10],[329.6,0.18],[65.4,0.02]].forEach(([f,delay]) => {
                    const o = c.createOscillator(), g = c.createGain();
                    o.type = 'triangle';
                    o.frequency.setValueAtTime(f*0.55, c.currentTime+delay);
                    o.frequency.exponentialRampToValueAtTime(f, c.currentTime+delay+3.0);
                    o.connect(g); g.connect(getrev());
                    const t = c.currentTime+delay;
                    g.gain.setValueAtTime(0, t);
                    g.gain.linearRampToValueAtTime(0.10-delay*0.01, t+0.7);
                    g.gain.linearRampToValueAtTime(0.16-delay*0.015, t+2.4);
                    g.gain.linearRampToValueAtTime(0, t+3.5);
                    o.start(t); o.stop(t+3.7);
                });

                wrNoiz(3.2, 0.03, 150, 0, 0.3);
                wrNoiz(3.2, 0.02, 80,  0.1, 0.2);
            } catch(e) {}
        }

        function wrSndWhistle(delay) {
            try {
                const c = wac(), o = c.createOscillator(), g = c.createGain();
                o.type = 'sine';
                o.frequency.setValueAtTime(400, c.currentTime+delay);
                o.frequency.exponentialRampToValueAtTime(1800, c.currentTime+delay+0.35);
                o.connect(g); g.connect(wrMaster());
                const t = c.currentTime+delay;
                g.gain.setValueAtTime(0.08, t);
                g.gain.linearRampToValueAtTime(0.0001, t+0.38);
                o.start(t); o.stop(t+0.4);
            } catch(e) {}
        }

        function wrSndBang(delay, pitch) {
            try {
                const c = wac();
                wrNoiz(0.35, 0.35+Math.random()*0.15, 60+pitch*30, delay, 0.8);
                wrNoiz(0.18, 0.25, 300+pitch*200, delay, 1.2);
                wrNoiz(1.2,  0.12, 2000+pitch*800, delay+0.05, 0.5);
                const f = 80 + pitch*120;
                wrOsc(f, 'sine', 0.25, 0.18, delay, 0.002, 0.18, true);
                wrOsc(f*2, 'sine', 0.15, 0.08, delay+0.01, 0.002, 0.10, true);
            } catch(e) {}
        }

        function wrSndFanfare() {
            const melody = [261.6,329.6,392.0,523.3,659.3,784.0,987.8,1046.5];
            melody.forEach((f,i) => {
                const d = i*0.09;
                wrOsc(f,     'triangle', 1.2, 0.18, d, 0.010, 0.25, true);
                wrOsc(f,     'sine',     0.9, 0.05, d, 0.010, 0.20, true);
                wrOsc(f*1.5, 'sine',     0.4, 0.02, d, 0.012, 0.15, true);
            });
            wrOsc(65.4,  'sine', 2.5, 0.28, 0,    0.04, 0.5, true);
            wrOsc(130.8, 'sine', 2.2, 0.18, 0.04, 0.04, 0.4, true);
            wrOsc(196.0, 'sine', 1.8, 0.10, 0.08, 0.04, 0.35, true);
            [0, 0.09, 0.27, 0.45, 0.63].forEach((d,i) => {
                wrNoiz(0.06, 0.12-i*0.015, 180+i*60, d, 1.5);
                wrNoiz(0.04, 0.08, 800+i*100, d+0.005, 2);
            });
            setTimeout(() => {
                [523.3,659.3,784.0,987.8,1046.5].forEach((f,i) =>
                    wrOsc(f,'triangle',2.2,0.13,i*0.012,0.06,0.7,true)
                );
                wrOsc(130.8,'sine',2.5,0.24,0,0.04,0.6,true);
                wrOsc(65.4, 'sine',2.8,0.15,0,0.04,0.7,true);
            }, 750);
            [1046.5,1318.5,1568,2093].forEach((f,i) =>
                wrOsc(f,'sine',1.8,0.04,0.85+i*0.06,0.005,0.5,true)
            );
        }
        let _wrAmbStops = [];
        function wrSndAmbientStart() {
            try {
                const c = wac();
                const baseFreqs = [65.4, 82.4, 98.0, 130.8];
                baseFreqs.forEach((f, i) => {
                    const o = c.createOscillator(), g = c.createGain();
                    o.type = 'sine';
                    o.frequency.value = f;
                    const lfo = c.createOscillator(), lfoG = c.createGain();
                    lfo.frequency.value = 0.18 + i*0.04; lfo.type = 'sine';
                    lfoG.gain.value = f * 0.008;
                    lfo.connect(lfoG); lfoG.connect(o.frequency);
                    lfo.start();
                    o.connect(g); g.connect(getrev());
                    g.gain.setValueAtTime(0, c.currentTime);
                    g.gain.linearRampToValueAtTime(0.05-i*0.008, c.currentTime+2.5);
                    o.start();
                    _wrAmbStops.push(() => {
                        g.gain.setValueAtTime(g.gain.value, c.currentTime);
                        g.gain.linearRampToValueAtTime(0.0001, c.currentTime+2.0);
                        o.stop(c.currentTime+2.1); lfo.stop(c.currentTime+2.1);
                    });
                });
            } catch(e) {}
        }
        function wrSndAmbientStop() {
            _wrAmbStops.forEach(fn => { try { fn(); } catch(e){} });
            _wrAmbStops = [];
        }
        function wrSndGlitter() {
            wrOsc(900+Math.random()*700,'sine',0.22,0.05,0,0.002,0.10,true);
            wrNoiz(0.08, 0.04, 1400+Math.random()*600);
        }
        const _fwParticles = [];
        const _fwTrails = [];
        let _fwRaf = null;
        let _fwRunning = false;
        let _fwW = 0, _fwH = 0;

        const FW_PALETTES = [
            ['#fff','#ffd700','#ffaa00','#ff8800'],
            ['#fff','#ff4466','#ff0033','#cc0022'],
            ['#fff','#44aaff','#0088ff','#0055cc'],
            ['#fff','#44ff88','#00cc44','#009933'],
            ['#fff','#dd88ff','#aa44ff','#7700cc'],
            ['#fff','#ff8844','#ff5500','#cc3300'],
        ];

        function fwBurst(x, y) {
            const palette = FW_PALETTES[Math.floor(Math.random()*FW_PALETTES.length)];
            const count = 110 + Math.floor(Math.random()*50);
            for (let i = 0; i < count; i++) {
                const angle = (Math.PI*2 * i/count) + (Math.random()-0.5)*0.3;
                const speed = 1.8 + Math.random()*3.2;
                const col = palette[Math.floor(Math.random()*palette.length)];
                _fwParticles.push({
                    x, y,
                    vx: Math.cos(angle)*speed,
                    vy: Math.sin(angle)*speed,
                    life: 1.0,
                    decay: 0.012 + Math.random()*0.018,
                    r: 1.8 + Math.random()*2.2,
                    col,
                    trail: Math.random() < 0.5,
                    grav: 0.06 + Math.random()*0.04,
                    twinkle: Math.random() < 0.3,
                });
            }
            for (let i = 0; i < 8; i++) {
                const angle = Math.random()*Math.PI*2;
                _fwParticles.push({
                    x, y,
                    vx: Math.cos(angle)*0.8,
                    vy: Math.sin(angle)*0.8,
                    life: 1.0, decay: 0.006,
                    r: 4+Math.random()*3,
                    col: '#ffffff', trail: false, grav: 0.02, twinkle: true,
                });
            }
        }

        function fwLaunch(x, targetY) {
            _fwTrails.push({
                x, y: _fwH,
                tx: x, ty: targetY,
                speed: 18 + Math.random()*8,
                life: 1.0,
                col: '#ffffffaa',
            });
        }

        function fwSalvo(n, stage) {
            for (let i = 0; i < n; i++) {
                const delay = i * 280 + Math.random()*100;
                setTimeout(() => {
                    if (!_fwRunning) return;
                    const x = _fwW * (0.12 + Math.random()*0.76);
                    const y = _fwH * (0.08 + Math.random()*0.40);
                    fwBurst(x, y);
                    wrSndBang(0, Math.random());
                    wrSndWhistle(-0.4);
                }, delay);
            }
        }

        function fwDraw() {
            if (!_fwRunning) return;
            const cv = document.getElementById('wr-fw-canvas');
            if (!cv) return;
            const ctx = cv.getContext('2d');
            ctx.globalCompositeOperation = 'destination-out';
            ctx.fillStyle = 'rgba(0,0,0,0.18)';
            ctx.fillRect(0, 0, _fwW, _fwH);
            ctx.globalCompositeOperation = 'lighter';

            for (let i = _fwTrails.length-1; i >= 0; i--) {
                const t = _fwTrails[i];
                const dx = t.tx - t.x, dy = t.ty - t.y;
                const dist = Math.sqrt(dx*dx+dy*dy);
                if (dist < t.speed) {
                    fwBurst(t.tx, t.ty);
                    _fwTrails.splice(i, 1); continue;
                }
                const nx = dx/dist * t.speed, ny = dy/dist * t.speed;
                t.x += nx; t.y += ny;
                ctx.beginPath();
                ctx.arc(t.x, t.y, 2, 0, Math.PI*2);
                ctx.fillStyle = t.col;
                ctx.fill();
                for (let j = 0; j < 3; j++) {
                    ctx.beginPath();
                    ctx.arc(t.x - nx*j*2.5, t.y - ny*j*2.5, 1.5-j*0.4, 0, Math.PI*2);
                    ctx.fillStyle = `rgba(255,255,200,${0.4-j*0.12})`;
                    ctx.fill();
                }
            }
            for (let i = _fwParticles.length-1; i >= 0; i--) {
                const p = _fwParticles[i];
                p.vx *= 0.968; p.vy *= 0.968;
                p.vy += p.grav;
                p.x += p.vx; p.y += p.vy;
                p.life -= p.decay;
                if (p.life <= 0) { _fwParticles.splice(i,1); continue; }

                const twinkAlpha = p.twinkle ? (0.5 + Math.sin(Date.now()*0.015+i)*0.5) : 1;
                const alpha = p.life * p.life * twinkAlpha;
                const r = p.r * p.life;

                if (p.trail && p.life > 0.3) {
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(p.x - p.vx*4, p.y - p.vy*4);
                    ctx.strokeStyle = p.col.replace(')',`,${alpha*0.4})`).replace('#','rgba(').replace(/([0-9a-f]{2})/gi,(_,m)=>parseInt(m,16)+',');
                    ctx.lineWidth = r*0.6;
                    ctx.stroke();
                }

                ctx.beginPath();
                ctx.arc(p.x, p.y, Math.max(0.1, r), 0, Math.PI*2);
                ctx.fillStyle = p.col;
                ctx.globalAlpha = alpha;
                ctx.fill();
                ctx.globalAlpha = 1;
            }

            ctx.globalCompositeOperation = 'source-over';
            _fwRaf = requestAnimationFrame(fwDraw);
        }

        function fwInit() {
            const cv = document.getElementById('wr-fw-canvas');
            const st = document.getElementById('wr-stage');
            if (!cv || !st) return;
            _fwW = cv.width  = st.clientWidth  || 900;
            _fwH = cv.height = st.clientHeight || 600;
            _fwParticles.length = 0;
            _fwTrails.length = 0;
        }
        function fwStart() {
            _fwRunning = true;
            _fwRaf = requestAnimationFrame(fwDraw);
        }
        function fwStop() {
            _fwRunning = false;
            if (_fwRaf) { cancelAnimationFrame(_fwRaf); _fwRaf = null; }
            const cv = document.getElementById('wr-fw-canvas');
            if (cv) { const ctx = cv.getContext('2d'); ctx.clearRect(0,0,_fwW,_fwH); }
            _fwParticles.length = 0; _fwTrails.length = 0;
        }

        let _wrPRaf = null;
        const _wrMotes = [];
        let _wrPRunning = false;
        let _wrSpawnTimer = 0;

        function wrInitParticles() {
            const cv = document.getElementById('wr-particles');
            if (!cv) return;
            const st = document.getElementById('wr-stage');
            cv.width = st.clientWidth||900; cv.height = st.clientHeight||600;
            _wrMotes.length = 0;
        }
        function wrSpawnMote() {
            const cv = document.getElementById('wr-particles');
            if (!cv) return;
            _wrMotes.push({
                x: cv.width*(0.25 + Math.random()*0.5),
                y: cv.height*(0.4 + Math.random()*0.35),
                vx: (Math.random()-0.5)*0.6,
                vy: -(0.25 + Math.random()*0.8),
                life: 1, decay: 0.003+Math.random()*0.005,
                r: 0.8+Math.random()*1.8,
                hue: 38+Math.random()*18,
                spin: (Math.random()-0.5)*0.15,
            });
        }
        function wrParticleLoop(ts) {
            const cv = document.getElementById('wr-particles');
            if (!cv || !_wrPRunning) return;
            const ctx = cv.getContext('2d');
            ctx.clearRect(0, 0, cv.width, cv.height);
            if (ts-_wrSpawnTimer > 45) {
                _wrSpawnTimer = ts;
                if (_wrMotes.length < 140) wrSpawnMote();
            }
            for (let i = _wrMotes.length-1; i >= 0; i--) {
                const m = _wrMotes[i];
                m.x += m.vx; m.y += m.vy;
                m.vx += (Math.random()-0.5)*0.05;
                m.vx *= 0.99;
                m.life -= m.decay;
                if (m.life <= 0) { _wrMotes.splice(i,1); continue; }
                const a = m.life*m.life;
                ctx.save();
                ctx.translate(m.x, m.y);
                ctx.rotate(m.spin * (1-m.life) * 20);
                ctx.scale(1, 2.5);
                ctx.beginPath();
                ctx.arc(0, 0, m.r*m.life, 0, Math.PI*2);
                ctx.fillStyle = `hsla(${m.hue},85%,72%,${a*0.65})`;
                ctx.fill();
                ctx.restore();
            }
            _wrPRaf = requestAnimationFrame(wrParticleLoop);
        }
        function wrStartParticles() {
            _wrPRunning = true; _wrSpawnTimer = 0;
            _wrPRaf = requestAnimationFrame(wrParticleLoop);
        }
        function wrStopParticles() {
            _wrPRunning = false;
            if (_wrPRaf) { cancelAnimationFrame(_wrPRaf); _wrPRaf = null; }
            const cv = document.getElementById('wr-particles');
            if (cv) cv.getContext('2d').clearRect(0,0,cv.width,cv.height);
            _wrMotes.length = 0;
        }
        function wrCountdown(cb) {
            const el=document.getElementById('wr-cd'), num=document.getElementById('wr-cd-n'), lbl=document.getElementById('wr-cd-l');
            el.classList.add('on');
            document.getElementById('wr-idle').classList.add('gone');
            let n = 3;
            const tick = () => {
                num.textContent = n;
                lbl.textContent = n===3?'get ready':n===2?'almost...':'here we go';
                num.style.opacity = '1';
                wrSndTick(n);
                num.style.transform = 'scale(1.22)';
                setTimeout(() => { num.style.transform = 'scale(1)'; }, 120);
                n--;
                if (n > 0) { setTimeout(tick, 1050); return; }
                setTimeout(() => {
                    num.textContent = ''; lbl.textContent = '';
                    wrSndGo();
                    setTimeout(() => {
                        el.style.transition = 'opacity 0.45s';
                        el.style.opacity = '0';
                        setTimeout(() => {
                            el.classList.remove('on'); el.style.opacity=''; el.style.transition='';
                            cb();
                        }, 480);
                    }, 380);
                }, 1050);
            };
            tick();
        }
        let _fwSalvoTimer = null;
        function wrReveal(champ, scopeLabel) {
            const s = id => document.getElementById(id);
            s('wr-scope').textContent = scopeLabel||'';
            s('wr-name').textContent  = champ.name;
            s('wr-score').innerHTML   = '';
            s('wr-stats').innerHTML =
                `<div class="wr-stat-item medal-gold"><div class="wr-stat-val">${champ.gold}</div><div class="wr-stat-lbl">🥇 Gold</div></div>` +
                `<div class="wr-stat-item medal-silver"><div class="wr-stat-val">${champ.silver}</div><div class="wr-stat-lbl">🥈 Silver</div></div>` +
                `<div class="wr-stat-item medal-bronze"><div class="wr-stat-val">${champ.bronze}</div><div class="wr-stat-lbl">🥉 Bronze</div></div>` +
                `<div class="wr-stat-item"><div class="wr-stat-val">${champ.comps}</div><div class="wr-stat-lbl">Events</div></div>`;

            const T = (id, delay) => setTimeout(() => s(id)?.classList.add('in'), delay);

            wrSndSwell();

            setTimeout(() => {
                s('wr-spot').classList.add('on');
                wrStartParticles();
            }, 300);

            T('wr-scope', 600);
            T('wr-eyebrow', 820);

            setTimeout(() => {
                s('wr-name').classList.add('in');
                wrSndFanfare();
                [0,100,220,380,560].forEach(d => setTimeout(wrSndGlitter, d));
                for (let i = 0; i < 50; i++) setTimeout(() => wrSpawnMote(), i*14);
                fwSalvo(5);
            }, 1400);
            T('wr-rule', 2000);
            setTimeout(() => {
                const target = parseFloat(champ.total.toFixed(1));
                s('wr-score').innerHTML = `<span id="wr-score-n">0</span><sup>pts</sup>`;
                s('wr-score').classList.add('in');
                let curr = 0;
                const up = () => {
                    curr = Math.min(target, curr + Math.max(0.3, target/32));
                    const el = document.getElementById('wr-score-n');
                    if (el) el.textContent = curr>=target ? target.toFixed(1) : curr.toFixed(0);
                    if (curr < target) setTimeout(up, 38);
                };
                up();
                wrSndAmbientStart();
            }, 2600);

            T('wr-stats', 3200);
            setTimeout(() => s('wr-spot').classList.add('breathing'), 2800);
            const fireTimed = (n, delay) => {
                _fwSalvoTimer = setTimeout(() => { fwSalvo(n); }, delay);
            };
            fireTimed(4, 2200);
            fireTimed(6, 3800);
            fireTimed(4, 5200);
            fireTimed(5, 6800);
            let repeat = 8400;
            const scheduleRepeat = () => {
                _fwSalvoTimer = setTimeout(() => {
                    if (!_fwRunning) return;
                    fwSalvo(3 + Math.floor(Math.random()*3));
                    scheduleRepeat();
                    repeat += 400;
                }, repeat - 8400 + 4000);
            };
            setTimeout(scheduleRepeat, 8400);
        }
        let wrActive = false;

        function wrReset() {
            fwStop();
            wrStopParticles();
            wrSndAmbientStop();
            if (_fwSalvoTimer) { clearTimeout(_fwSalvoTimer); _fwSalvoTimer = null; }
            const idle = document.getElementById('wr-idle');
            if (idle) { idle.classList.remove('gone'); idle.style.opacity=''; }
            const cd = document.getElementById('wr-cd');
            if (cd) { cd.classList.remove('on'); cd.style.opacity=''; cd.style.transition=''; }
            const spot = document.getElementById('wr-spot');
            if (spot) spot.classList.remove('on','breathing');
            ['wr-scope','wr-eyebrow','wr-name','wr-rule','wr-score','wr-stats'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.remove('in');
            });
            wrActive = false;
        }

        function wrLaunch() {
            if (wrActive) { wrReset(); return; }
            const ff    = document.getElementById('winner-folder-filter')?.value||'';
            const ranks = wrRankings(ff);
            if (!ranks.length) { showStatus('No competition data found','error'); return; }
            const champ = ranks[0];
            const scope = ff ? buildFolderLabel(ff) : '';
            try { wac().resume(); } catch(e) {}
            wrActive = true;
            fwInit(); fwStart();
            wrInitParticles();
            wrCountdown(() => wrReveal(champ, scope));
        }

        document.addEventListener('keydown', e => {
            if (e.code!=='Space'||e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA') return;
            const wp = document.getElementById('winner-panel');
            if (wp?.classList.contains('active')) { e.preventDefault(); wrLaunch(); }
        });

        (function() {
            const _base = showPanel;
            showPanel = function(panelName) {
                if (panelName !== 'winner' && wrActive) wrReset();
                _base(panelName);
            };
        })();

    </script>
