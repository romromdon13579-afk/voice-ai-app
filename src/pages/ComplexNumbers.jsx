import React, { useRef, useEffect, useState, useCallback } from 'react';

// ── Math helpers ──────────────────────────────────────────────────────────────
const DEG = Math.PI / 180;
const toRad = d => d * DEG;
const toDeg = r => r / DEG;
const norm = d => ((d % 360) + 360) % 360;
const f0 = n => Number(n).toFixed(0);
const f2 = n => Number(n).toFixed(2);

// ── Colors ────────────────────────────────────────────────────────────────────
const C = {
  bg: '#020617', panel: '#0f172a', border: '#1e293b',
  axis: '#334155', circle: '#3b82f6', text: '#64748b',
  z1: '#f59e0b', z2: '#10b981', result: '#a855f7', target: '#f43f5e',
  roots: ['#f43f5e','#3b82f6','#22d3ee','#84cc16','#f97316','#e879f9','#0ea5e9','#4ade80'],
};

// ── Canvas helpers ────────────────────────────────────────────────────────────
function pt(cx, cy, R, angleDeg) {
  return { x: cx + R * Math.cos(toRad(angleDeg)), y: cy - R * Math.sin(toRad(angleDeg)) };
}
function angleFromXY(x, y, cx, cy) {
  return norm(toDeg(Math.atan2(-(y - cy), x - cx)));
}
function evPos(canvas, e) {
  const r = canvas.getBoundingClientRect();
  const sx = canvas.width / r.width, sy = canvas.height / r.height;
  const s = e.touches ? e.touches[0] : e;
  return { x: (s.clientX - r.left) * sx, y: (s.clientY - r.top) * sy };
}

function arrowHead(ctx, x, y, angle, color, size = 9) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - size * Math.cos(angle - 0.42), y - size * Math.sin(angle - 0.42));
  ctx.lineTo(x - size * Math.cos(angle + 0.42), y - size * Math.sin(angle + 0.42));
  ctx.closePath();
  ctx.fill();
}

function drawVector(ctx, cx, cy, R, angleDeg, color, label, draggable = false, dashed = false) {
  const { x, y } = pt(cx, cy, R, angleDeg);
  const ang = Math.atan2(y - cy, x - cx);
  ctx.strokeStyle = color;
  ctx.lineWidth = draggable ? 2.5 : 2;
  if (dashed) ctx.setLineDash([6, 4]);
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke();
  ctx.setLineDash([]);
  arrowHead(ctx, x, y, ang, color, draggable ? 10 : 8);
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, draggable ? 8 : 6, 0, 2 * Math.PI); ctx.fill();
  if (draggable) { ctx.strokeStyle = '#ffffff50'; ctx.lineWidth = 2; ctx.stroke(); }
  if (label) {
    const lp = pt(cx, cy, R + 22, angleDeg);
    ctx.fillStyle = color; ctx.font = 'bold 13px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, lp.x, lp.y);
  }
}

function drawArc(ctx, cx, cy, r, angleDeg, color) {
  if (Math.abs(angleDeg) < 0.5) return;
  ctx.strokeStyle = color + '90'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, -toRad(angleDeg), angleDeg > 0);
  ctx.stroke();
  // tiny arrowhead midway on arc
  const mid = angleDeg / 2;
  const { x: mx, y: my } = pt(cx, cy, r, mid);
  const tang = -toRad(mid) + (angleDeg > 0 ? -Math.PI / 2 : Math.PI / 2);
  arrowHead(ctx, mx, my, tang, color + '90', 5);
}

// ── Main scene renderer ───────────────────────────────────────────────────────
function drawScene(ctx, W, H, st) {
  const { mode, z1, z2, n, eqResult, hlRoot, challenge, guess, revealed } = st;
  const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.37;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);

  // Grid circles
  [0.25, 0.5, 0.75].forEach(f => {
    ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.arc(cx, cy, R * f, 0, 2 * Math.PI); ctx.stroke();
  });

  // Axes
  ctx.strokeStyle = C.axis; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(20, cy); ctx.lineTo(W - 20, cy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, 20); ctx.lineTo(cx, H - 20); ctx.stroke();
  arrowHead(ctx, W - 20, cy, 0, C.axis);
  arrowHead(ctx, cx, 20, -Math.PI / 2, C.axis);

  // Unit circle glow
  ctx.strokeStyle = C.circle + '50'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * Math.PI); ctx.stroke();
  ctx.strokeStyle = C.circle + 'a0'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * Math.PI); ctx.stroke();

  // Labels
  ctx.fillStyle = C.text; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '13px Arial';
  ctx.fillText('Re', W - 14, cy - 12); ctx.fillText('Im', cx + 14, 14);
  [
    [cx + R, cy, '1', 12, -10], [cx - R, cy, '-1', -14, -10],
    [cx, cy - R, 'i', 10, 0],   [cx, cy + R, '-i', 10, 14],
  ].forEach(([x, y, t, ox, oy]) => {
    ctx.font = '12px Arial'; ctx.fillStyle = C.text;
    ctx.fillText(t, x + ox, y + oy);
    ctx.fillStyle = C.axis; ctx.beginPath(); ctx.arc(x, y, 3, 0, 2 * Math.PI); ctx.fill();
  });
  ctx.fillStyle = C.text; ctx.beginPath(); ctx.arc(cx, cy, 3, 0, 2 * Math.PI); ctx.fill();
  ctx.font = '11px Arial'; ctx.fillText('O', cx - 12, cy + 12);

  // ── Mode drawing ──────────────────────────────────────────────────────────

  if (mode === 'explore') {
    drawVector(ctx, cx, cy, R, z1, C.z1, 'z', true);
    drawArc(ctx, cx, cy, R * 0.3, z1, C.z1);

    // Projection lines
    const { x: px, y: py } = pt(cx, cy, R, z1);
    ctx.strokeStyle = C.z1 + '50'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(px, cy); ctx.lineTo(px, py);
    ctx.moveTo(cx, py); ctx.lineTo(px, py); ctx.stroke();
    ctx.setLineDash([]);

    // Projection labels
    const cosV = Math.cos(toRad(z1)), sinV = Math.sin(toRad(z1));
    ctx.font = '11px monospace'; ctx.fillStyle = C.z1 + 'c0';
    ctx.textAlign = 'center';
    ctx.fillText(`cos(${f0(z1)}°) = ${f2(cosV)}`, px, cy + (sinV >= 0 ? 16 : -10));
    ctx.textAlign = 'left';
    ctx.fillText(`sin(${f0(z1)}°) = ${f2(sinV)}`, cx + 6, py + (cosV >= 0 ? -8 : 16));

    // Angle label
    const lp = pt(cx, cy, R * 0.2, z1 / 2);
    ctx.fillStyle = C.z1; ctx.font = '12px monospace'; ctx.textAlign = 'center';
    ctx.fillText(`${f0(z1)}°`, lp.x, lp.y);
  }

  else if (mode === 'multiply' || mode === 'divide') {
    const ra = mode === 'multiply' ? norm(z1 + z2) : norm(z1 - z2);
    drawVector(ctx, cx, cy, R, z1, C.z1, 'z₁', true);
    drawVector(ctx, cx, cy, R, z2, C.z2, 'z₂', true);
    drawArc(ctx, cx, cy, R * 0.25, z1, C.z1);
    drawArc(ctx, cx, cy, R * 0.35, z2, C.z2);
    drawArc(ctx, cx, cy, R * 0.45, ra, C.result);
    drawVector(ctx, cx, cy, R, ra, C.result, mode === 'multiply' ? 'z₁·z₂' : 'z₁÷z₂', false, true);
    const op = mode === 'multiply' ? '+' : '−';
    const aOp = mode === 'multiply' ? z1 + z2 : z1 - z2;
    ctx.fillStyle = C.result + 'c0'; ctx.font = '11px monospace'; ctx.textAlign = 'center';
    ctx.fillText(`${f0(z1)}°${op}${f0(z2)}°=${f0(norm(aOp))}°`, cx, H - 12);
  }

  else if (mode === 'power') {
    const total = n * z1, ra = norm(total);
    drawVector(ctx, cx, cy, R, z1, C.z1, 'z', true);
    drawArc(ctx, cx, cy, R * 0.28, z1, C.z1);
    drawArc(ctx, cx, cy, R * 0.44, ra, C.result);
    drawVector(ctx, cx, cy, R, ra, C.result, `z^${n}`, false, true);
    const winds = Math.floor(total / 360);
    ctx.fillStyle = C.result + 'c0'; ctx.font = '11px monospace'; ctx.textAlign = 'center';
    ctx.fillText(`${n}×${f0(z1)}°=${f0(total)}°${winds > 0 ? ` (${winds} סיבוב)` : ''}`, cx, H - 12);
  }

  else if (mode === 'root') {
    drawVector(ctx, cx, cy, R, z1, '#ffffff60', 'z', false, true);
    for (let k = 0; k < n; k++) {
      const ra = norm((z1 + 360 * k) / n);
      const col = hlRoot === k ? '#ffffff' : C.roots[k % C.roots.length];
      drawVector(ctx, cx, cy, R, ra, col, `r${k}`, hlRoot === k);
      drawArc(ctx, cx, cy, R * (0.2 + k * 0.07), ra, col);
    }
  }

  else if (mode === 'equation' && eqResult) {
    drawVector(ctx, cx, cy, R, eqResult.targetAngle, C.target, '★', true);
    eqResult.roots.forEach((angle, k) => {
      const col = hlRoot === k ? '#ffffff' : C.roots[k % C.roots.length];
      drawVector(ctx, cx, cy, R, angle, col, `z${k}`, hlRoot === k);
      drawArc(ctx, cx, cy, R * (0.2 + k * 0.07), angle, col);
    });
  }

  else if (mode === 'challenge' && challenge) {
    // Given points
    drawVector(ctx, cx, cy, R, challenge.z1, C.z1, 'z₁', false);
    if (challenge.z2 != null) drawVector(ctx, cx, cy, R, challenge.z2, C.z2, 'z₂', false);

    // Target ring pulse
    ctx.strokeStyle = C.target + '25'; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * Math.PI); ctx.stroke();

    // User guess
    if (guess != null) {
      drawVector(ctx, cx, cy, R, guess, C.result, '?', true);
    }

    // Reveal correct answer
    if (revealed) {
      drawVector(ctx, cx, cy, R, challenge.target, '#ffffff', '✓', false, true);
      const diff = Math.min(
        Math.abs(norm(guess ?? 0) - challenge.target),
        360 - Math.abs(norm(guess ?? 0) - challenge.target)
      );
      const ok = diff < 8;
      ctx.fillStyle = ok ? '#10b981' : '#f43f5e'; ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(ok ? `✓ נכון! (${f0(diff)}°)` : `✗ ${f0(diff)}° מהמטרה`, cx, H - 14);
    }
  }
}

// ── Equation parser ───────────────────────────────────────────────────────────
const SPECIAL_ANGLES = { j:90, i:90, '-j':270, '-i':270, '-1':180, '1':0, '0':0, '1+0i':0 };

function parseEq(raw) {
  let s = raw.trim()
    .replace(/\(z\^(\d+)\)\^(\d+)/gi, (_, a, b) => `z^${+a * +b}`)
    .replace(/z\^(\d+)\s*\*\s*z\^(\d+)/gi, (_, a, b) => `z^${+a + +b}`);

  const m = s.match(/z\^(\d+)\s*=\s*(.+)/i);
  if (!m) return null;
  const power = parseInt(m[1]);
  const ts = m[2].trim().toLowerCase();

  let targetAngle;
  if (ts in SPECIAL_ANGLES) targetAngle = SPECIAL_ANGLES[ts];
  else {
    const num = parseFloat(ts);
    if (!isNaN(num)) targetAngle = norm(num);
    else return null;
  }

  const roots = Array.from({ length: power }, (_, k) => norm((targetAngle + 360 * k) / power));
  return { power, targetAngle, roots };
}

// ── Challenge generator ───────────────────────────────────────────────────────
const NICE = [0,30,45,60,90,120,135,150,180,210,225,240,270,300,315,330];
const rPick = () => NICE[Math.floor(Math.random() * NICE.length)];

function newChallenge(op) {
  if (op === 'power') {
    const n = Math.floor(Math.random() * 3) + 2, z1 = rPick();
    return { op, n, z1, z2: null, target: norm(n * z1), hint: `cis(${z1}°)^${n}` };
  }
  const z1 = rPick(), z2 = rPick();
  const target = op === 'multiply' ? norm(z1 + z2) : norm(z1 - z2);
  const sym = op === 'multiply' ? '·' : '÷';
  return { op, n: null, z1, z2, target, hint: `cis(${z1}°) ${sym} cis(${z2}°)` };
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ComplexNumbers() {
  const canvasRef = useRef(null);
  const stRef = useRef({});

  const [mode, setMode] = useState('explore');
  const [z1, setZ1] = useState(60);
  const [z2, setZ2] = useState(30);
  const [n, setN] = useState(3);
  const [equation, setEquation] = useState('z^3 = j');
  const [eqResult, setEqResult] = useState(null);
  const [hlRoot, setHlRoot] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [challenge, setChallenge] = useState(null);
  const [guess, setGuess] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState({ ok: 0, total: 0 });
  const [eqError, setEqError] = useState('');

  stRef.current = { mode, z1, z2, n, eqResult, hlRoot, dragging, challenge, guess, revealed };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawScene(canvas.getContext('2d'), canvas.width, canvas.height, stRef.current);
  }, [mode, z1, z2, n, eqResult, hlRoot, challenge, guess, revealed]);

  const onDown = useCallback(e => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const { x, y } = evPos(canvas, e);
    const cx = canvas.width / 2, cy = canvas.height / 2;
    const R = Math.min(canvas.width, canvas.height) * 0.37;
    const angle = angleFromXY(x, y, cx, cy);
    const { mode, z1, z2 } = stRef.current;

    if (mode === 'challenge') { setGuess(angle); return; }
    if (mode === 'multiply' || mode === 'divide') {
      const p1 = pt(cx, cy, R, z1), p2 = pt(cx, cy, R, z2);
      const d1 = Math.hypot(x - p1.x, y - p1.y), d2 = Math.hypot(x - p2.x, y - p2.y);
      const which = d1 <= d2 ? 'z1' : 'z2';
      setDragging(which);
      if (which === 'z1') setZ1(angle); else setZ2(angle);
    } else if (['explore', 'power', 'root'].includes(mode)) {
      setDragging('z1'); setZ1(angle);
    }
  }, []);

  const onMove = useCallback(e => {
    const { dragging: drag, mode } = stRef.current;
    if (!drag && mode !== 'challenge') return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const { x, y } = evPos(canvas, e);
    const angle = angleFromXY(x, y, canvas.width / 2, canvas.height / 2);
    if (mode === 'challenge') { setGuess(angle); return; }
    if (drag === 'z1') setZ1(angle); else if (drag === 'z2') setZ2(angle);
  }, []);

  const onUp = useCallback(() => setDragging(null), []);

  const solveEq = () => {
    const r = parseEq(equation);
    if (!r) { setEqError('נסה: z^2 = j · z^3 = -1 · (z^2)^3 = i'); return; }
    setEqError(''); setEqResult(r); setMode('equation'); setHlRoot(null);
  };

  const startChallenge = (op) => {
    const c = newChallenge(op || ['multiply','power','divide'][Math.floor(Math.random()*3)]);
    setChallenge(c); setGuess(null); setRevealed(false); setMode('challenge');
  };

  const checkGuess = () => {
    if (guess == null) return;
    const { challenge: ch } = stRef.current;
    const diff = Math.min(
      Math.abs(norm(guess) - ch.target),
      360 - Math.abs(norm(guess) - ch.target)
    );
    setScore(s => ({ ok: s.ok + (diff < 8 ? 1 : 0), total: s.total + 1 }));
    setRevealed(true);
  };

  // ── Info panel content ──────────────────────────────────────────────────────
  const getInfo = () => {
    const a1 = f0(z1), a2 = f0(z2);
    const c1 = f2(Math.cos(toRad(z1))), s1 = f2(Math.sin(toRad(z1)));
    switch (mode) {
      case 'explore': return {
        title: 'ייצוג קוטבי',
        formula: 'cis(θ) = cos(θ) + i·sin(θ)',
        vals: `cis(${a1}°) =\n  cos(${a1}°) + i·sin(${a1}°)\n= ${c1} + ${s1}i`,
        tip: 'גרור את z על המעגל',
      };
      case 'multiply': return {
        title: 'כפל — זוויות מתחברות',
        formula: 'cis(θ₁)·cis(θ₂) = cis(θ₁+θ₂)',
        vals: `cis(${a1}°)·cis(${a2}°)\n= cis(${a1}°+${a2}°)\n= cis(${f0(norm(z1+z2))}°)`,
        tip: 'גרור כל נקודה בנפרד',
      };
      case 'divide': return {
        title: 'חילוק — זוויות מתחסרות',
        formula: 'cis(θ₁)/cis(θ₂) = cis(θ₁−θ₂)',
        vals: `cis(${a1}°)/cis(${a2}°)\n= cis(${a1}°−${a2}°)\n= cis(${f0(norm(z1-z2))}°)`,
        tip: 'גרור כל נקודה בנפרד',
      };
      case 'power': return {
        title: `חזקה — De Moivre`,
        formula: `(cis θ)^n = cis(n·θ)`,
        vals: `cis(${a1}°)^${n}\n= cis(${n}×${a1}°)\n= cis(${f0(n*z1)}°)\n= cis(${f0(norm(n*z1))}°)`,
        tip: 'שנה n עם הסליידר',
      };
      case 'root': {
        const rs = Array.from({length:n},(_,k)=>`r${k}: cis(${f0(norm((z1+360*k)/n))}°)`);
        return {
          title: `שורשים — ${n} פתרונות`,
          formula: `ⁿ√cis(θ) = cis((θ+360k)/n)`,
          vals: rs.join('\n'),
          tip: 'לחץ על שורש ברשימה',
        };
      }
      case 'equation':
        if (!eqResult) return { title:'', formula:'', vals:'', tip:'' };
        return {
          title: `פתרון: ${equation}`,
          formula: `z^${eqResult.power} = cis(${f0(eqResult.targetAngle)}°)`,
          vals: eqResult.roots.map((a,k)=>`z${k} = cis(${f0(a)}°)`).join('\n'),
          tip: 'לחץ על פתרון להדגשה',
        };
      case 'challenge':
        return {
          title: `🎯 אתגר: ${challenge?.hint ?? ''}`,
          formula: `= ?`,
          vals: revealed
            ? `תשובה: cis(${f0(challenge?.target)}°)\nניחוש: cis(${f0(guess??0)}°)`
            : guess != null ? `ניחוש: cis(${f0(guess)}°)` : 'לחץ על המעגל לנחש',
          tip: `ניקוד: ${score.ok}/${score.total}${score.total>0?` (${Math.round(100*score.ok/score.total)}%)`:''}`,
        };
      default: return { title:'', formula:'', vals:'', tip:'' };
    }
  };

  const info = getInfo();
  const rootList = mode === 'root'
    ? Array.from({length: n}, (_, k) => norm((z1 + 360*k)/n))
    : mode === 'equation' && eqResult ? eqResult.roots : null;

  const MODES = [
    { id:'explore',   label:'🔍 חקור' },
    { id:'multiply',  label:'× כפל' },
    { id:'divide',    label:'÷ חילוק' },
    { id:'power',     label:'xⁿ חזקה' },
    { id:'root',      label:'√ שורש' },
    { id:'equation',  label:'= משוואה' },
    { id:'challenge', label:'🎯 אתגר' },
  ];

  const panel = {
    background: C.panel, borderRadius: '12px',
    padding: '14px', border: `1px solid ${C.border}`,
  };

  return (
    <div style={{
      display:'flex', flexDirection:'column', minHeight:'100vh',
      background: C.bg, color:'#e2e8f0', padding:'12px', gap:'12px',
      fontFamily:'Arial, sans-serif', direction:'rtl',
    }}>
      {/* Header */}
      <div style={{ textAlign:'center' }}>
        <h1 style={{ margin:0, fontSize:'22px', color:'#60a5fa', fontWeight:'bold' }}>
          מספרים מרוכבים — מעגל היחידה
        </h1>
        <p style={{ margin:'4px 0 0', color:'#475569', fontSize:'13px' }}>
          Complex Numbers · Unit Circle Interactive (r = 1)
        </p>
      </div>

      {/* Mode tabs */}
      <div style={{ display:'flex', gap:'6px', justifyContent:'center', flexWrap:'wrap' }}>
        {MODES.map(m => (
          <button key={m.id} onClick={() => {
            setMode(m.id);
            if (m.id !== 'equation') setEqResult(null);
            if (m.id !== 'challenge') { setChallenge(null); setGuess(null); setRevealed(false); }
            if (m.id === 'challenge') startChallenge();
            setHlRoot(null);
          }} style={{
            padding:'7px 14px', borderRadius:'8px', border:'none', cursor:'pointer',
            background: mode===m.id ? '#2563eb' : '#1e293b',
            color: mode===m.id ? '#fff' : '#94a3b8',
            fontWeight: mode===m.id ? 'bold' : 'normal',
            fontSize:'13px', transition:'all 0.15s',
          }}>
            {m.label}
          </button>
        ))}
      </div>

      {/* Main area: canvas + side panel */}
      <div style={{ display:'flex', gap:'12px', flex:1, flexWrap:'wrap', minHeight:0 }}>

        {/* Canvas */}
        <div style={{ flex:'1 1 300px', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <canvas
            ref={canvasRef} width={500} height={500}
            style={{
              borderRadius:'14px', maxWidth:'100%', maxHeight:'70vmin',
              cursor: dragging ? 'grabbing' : 'crosshair',
              border:`1px solid ${C.border}`, touchAction:'none',
            }}
            onMouseDown={onDown} onMouseMove={onMove}
            onMouseUp={onUp}    onMouseLeave={onUp}
            onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}
          />
        </div>

        {/* Side panel */}
        <div style={{ flex:'0 0 268px', display:'flex', flexDirection:'column', gap:'10px' }}>

          {/* Formula + values */}
          <div style={panel}>
            <div style={{ color:'#60a5fa', fontWeight:'bold', fontSize:'13px', marginBottom:'6px' }}>
              {info.title}
            </div>
            <div style={{
              color:'#c4b5fd', fontFamily:'monospace', fontSize:'13px',
              marginBottom:'8px', lineHeight:1.4,
            }}>
              {info.formula}
            </div>
            <pre style={{
              color:'#e2e8f0', fontFamily:'monospace', fontSize:'12px',
              margin:0, whiteSpace:'pre-wrap', lineHeight:1.6,
            }}>
              {info.vals}
            </pre>
            {info.tip && (
              <div style={{ color:'#475569', fontSize:'11px', marginTop:'8px', fontStyle:'italic' }}>
                💡 {info.tip}
              </div>
            )}
          </div>

          {/* Controls */}
          <div style={panel}>
            <div style={{ color:'#f59e0b', fontWeight:'bold', fontSize:'13px', marginBottom:'10px' }}>
              בקרים
            </div>

            {/* θ₁ slider */}
            {['explore','multiply','divide','power','root'].includes(mode) && (
              <label style={{ display:'flex', flexDirection:'column', gap:'4px', marginBottom:'10px' }}>
                <span style={{ color:'#f59e0b', fontSize:'12px' }}>
                  θ₁ = {f0(z1)}° &nbsp;
                  <span style={{ color:C.text }}>({f2(Math.cos(toRad(z1)))} + {f2(Math.sin(toRad(z1)))}i)</span>
                </span>
                <input type="range" min="0" max="359" value={Math.round(z1)}
                  onChange={e => setZ1(+e.target.value)}
                  style={{ accentColor:'#f59e0b', width:'100%' }} />
              </label>
            )}

            {/* θ₂ slider */}
            {['multiply','divide'].includes(mode) && (
              <label style={{ display:'flex', flexDirection:'column', gap:'4px', marginBottom:'10px' }}>
                <span style={{ color:'#10b981', fontSize:'12px' }}>θ₂ = {f0(z2)}°</span>
                <input type="range" min="0" max="359" value={Math.round(z2)}
                  onChange={e => setZ2(+e.target.value)}
                  style={{ accentColor:'#10b981', width:'100%' }} />
              </label>
            )}

            {/* n slider */}
            {['power','root'].includes(mode) && (
              <label style={{ display:'flex', flexDirection:'column', gap:'4px', marginBottom:'10px' }}>
                <span style={{ color:'#a855f7', fontSize:'12px' }}>n = {n}</span>
                <input type="range" min="2" max="8" value={n}
                  onChange={e => setN(+e.target.value)}
                  style={{ accentColor:'#a855f7', width:'100%' }} />
              </label>
            )}

            {/* Equation input */}
            {mode === 'equation' && (
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                <span style={{ color:'#475569', fontSize:'11px' }}>
                  דוגמאות: z^2 = j &nbsp;·&nbsp; z^3 = -1 &nbsp;·&nbsp; (z^2)^5 = i
                </span>
                <input
                  value={equation}
                  onChange={e => setEquation(e.target.value)}
                  onKeyDown={e => e.key==='Enter' && solveEq()}
                  placeholder="z^n = target"
                  style={{
                    background:'#1e293b', border:'1px solid #334155', borderRadius:'6px',
                    padding:'8px', color:'#e2e8f0', fontFamily:'monospace', fontSize:'14px',
                    width:'100%', boxSizing:'border-box', direction:'ltr',
                  }}
                />
                {eqError && <div style={{ color:'#f43f5e', fontSize:'11px' }}>{eqError}</div>}
                <button onClick={solveEq} style={{
                  background:'#2563eb', border:'none', borderRadius:'6px',
                  padding:'8px', color:'#fff', cursor:'pointer', fontWeight:'bold', fontSize:'13px',
                }}>
                  פתור →
                </button>
              </div>
            )}

            {/* Challenge controls */}
            {mode === 'challenge' && (
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                <div style={{ color:'#94a3b8', fontSize:'12px' }}>
                  ניקוד: {score.ok}/{score.total}
                  {score.total>0 && ` (${Math.round(100*score.ok/score.total)}%)`}
                </div>
                {guess!=null && !revealed && (
                  <button onClick={checkGuess} style={{
                    background:'#059669', border:'none', borderRadius:'6px',
                    padding:'8px', color:'#fff', cursor:'pointer', fontWeight:'bold', fontSize:'13px',
                  }}>
                    בדוק תשובה ✓
                  </button>
                )}
                {revealed && (
                  <button onClick={() => startChallenge()} style={{
                    background:'#2563eb', border:'none', borderRadius:'6px',
                    padding:'8px', color:'#fff', cursor:'pointer', fontSize:'13px',
                  }}>
                    אתגר חדש →
                  </button>
                )}
                <div style={{ display:'flex', gap:'6px' }}>
                  {[
                    { op:'multiply', label:'× כפל' },
                    { op:'power',    label:'xⁿ חזקה' },
                    { op:'divide',   label:'÷ חילוק' },
                  ].map(({ op, label }) => (
                    <button key={op} onClick={() => startChallenge(op)} style={{
                      flex:1, padding:'6px', borderRadius:'6px', border:'none',
                      background:'#1e293b', color:'#94a3b8', cursor:'pointer', fontSize:'11px',
                    }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Roots list */}
          {rootList && (
            <div style={{ ...panel, maxHeight:'220px', overflowY:'auto' }}>
              <div style={{ color:'#94a3b8', fontWeight:'bold', fontSize:'12px', marginBottom:'8px' }}>
                {mode==='root' ? `${n} שורשים של z = cis(${f0(z1)}°)` : 'פתרונות'}
              </div>
              {rootList.map((angle, k) => {
                const col = C.roots[k % C.roots.length];
                const hl = hlRoot === k;
                const cosV = Math.cos(toRad(angle)), sinV = Math.sin(toRad(angle));
                return (
                  <div key={k} onClick={() => setHlRoot(hl ? null : k)} style={{
                    padding:'6px 10px', borderRadius:'6px', cursor:'pointer', marginBottom:'4px',
                    background: hl ? col+'25' : '#1e293b',
                    borderLeft:`3px solid ${col}`,
                    fontSize:'11px', fontFamily:'monospace', color: col,
                    transition:'all 0.15s',
                  }}>
                    z{k} = cis({f0(angle)}°) = {f2(cosV)} {sinV>=0?'+':'−'} {f2(Math.abs(sinV))}i
                  </div>
                );
              })}
            </div>
          )}

          {/* Quick reference */}
          <div style={panel}>
            <div style={{ color:'#475569', fontSize:'11px', marginBottom:'6px', fontWeight:'bold' }}>
              ערכים מיוחדים
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px' }}>
              {[
                ['1',       '0°'],  ['i (j)',   '90°'],
                ['-1',     '180°'], ['-i (-j)', '270°'],
                ['(1+i)/√2','45°'], ['√3/2+½i', '30°'],
              ].map(([name, angle]) => (
                <div key={name} style={{ fontSize:'10px', fontFamily:'monospace', color:'#475569' }}>
                  <span style={{ color:'#60a5fa' }}>{name}</span> = cis({angle})
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
