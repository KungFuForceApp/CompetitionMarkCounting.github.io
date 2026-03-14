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

