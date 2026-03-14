// ============================================================
// winner.js  —  Winner reveal animation, fireworks, audio
// ============================================================

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

