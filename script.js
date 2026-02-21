let constraintCount = 0;
const canvas = document.getElementById('plot');
const ctx = canvas.getContext('2d');
let w = 720, h = 720;

function resizeCanvas() {
    const size = Math.min(window.innerWidth - 40, 720);
    canvas.width = size;
    canvas.height = size;
    w = h = size;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

document.getElementById('add-constraint-btn').addEventListener('click', addConstraint);

function addConstraint() {
    constraintCount++;
    const div = document.createElement('div');
    div.innerHTML = `
        <input id="a${constraintCount}" type="number" step="any" placeholder="coef x">
        <span>x</span> +
        <input id="b${constraintCount}" type="number" step="any" placeholder="coef y">
        <span>y</span>
        <select id="op${constraintCount}">
            <option value="<=">≤</option>
            <option value=">=">≥</option>
            <option value="=">=</option>
        </select>
        <input id="d${constraintCount}" type="number" step="any" placeholder="constant">
    `;
    document.getElementById('constraints').appendChild(div);
}

document.getElementById('clear-btn').addEventListener('click', clearAll);

function clearAll() {
    document.getElementById('coef_x').value = '';
    document.getElementById('coef_y').value = '';
    document.getElementById('const').value = '';
    document.getElementById('opt_type').value = 'Minimize';

    document.getElementById('constraints').innerHTML = '';
    constraintCount = 0;

    document.getElementById('result').innerHTML = '';
    ctx.clearRect(0, 0, w, h);
}

document.getElementById('solve-btn').addEventListener('click', solveLP);

function getConstraints() {
    const cons = [];
    if (document.getElementById('nonneg').checked) {
        cons.push({a: -1, b: 0, c: 0, label: 'x ≥ 0'});
        cons.push({a: 0, b: -1, c: 0, label: 'y ≥ 0'});
    }

    for (let i = 1; i <= constraintCount; i++) {
        const aEl = document.getElementById(`a${i}`);
        if (!aEl) continue;
        const a = parseFloat(aEl.value) || 0;
        const b = parseFloat(document.getElementById(`b${i}`).value) || 0;
        const op = document.getElementById(`op${i}`).value;
        const d = parseFloat(document.getElementById(`d${i}`).value) || 0;

        const label = `${a}x + ${b}y ${op} ${d}`;

        if (op === '<=') cons.push({a, b, c: d, label});
        else if (op === '>=') cons.push({a: -a, b: -b, c: -d, label});
        else if (op === '=') {
            cons.push({a, b, c: d, label});
            cons.push({a: -a, b: -b, c: -d, label: ''});
        }
    }
    return cons;
}

// ────────────────────────────────────────────────
// The rest of the logic (pointFeasible, findCorners, solveLP) 
// remains the same as in your previous version
// ────────────────────────────────────────────────

function pointFeasible(p, cons) {
    return cons.every(c => c.a * p[0] + c.b * p[1] <= c.c + 1e-8);
}

function findCorners(cons) {
    const pts = [];
    const n = cons.length;

    // Line intersections
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const c1 = cons[i], c2 = cons[j];
            const det = c1.a * c2.b - c2.a * c1.b;
            if (Math.abs(det) < 1e-8) continue;
            const x = (c1.c * c2.b - c2.c * c1.b) / det;
            const y = (c2.c * c1.a - c1.c * c2.a) / det;
            if (pointFeasible([x, y], cons)) pts.push([x, y]);
        }
    }

    // Axis intercepts
    for (const c of cons) {
        if (Math.abs(c.a) > 1e-8) {
            const x = c.c / c.a;
            if (pointFeasible([x, 0], cons)) pts.push([x, 0]);
        }
        if (Math.abs(c.b) > 1e-8) {
            const y = c.c / c.b;
            if (pointFeasible([0, y], cons)) pts.push([0, y]);
        }
    }

    // Deduplicate with rounding
    const unique = [];
    pts.forEach(p => {
        const rx = Math.round(p[0] * 10000) / 10000;
        const ry = Math.round(p[1] * 10000) / 10000;
        if (!unique.some(q => Math.abs(q[0] - rx) < 1e-6 && Math.abs(q[1] - ry) < 1e-6))
            unique.push([rx, ry]);
    });
    return unique;
}

function solveLP() {
    const cons = getConstraints();
    if (cons.length === 0) {
        document.getElementById('result').innerHTML = 'Add at least one constraint.';
        return;
    }

    const corners = findCorners(cons);
    if (corners.length === 0) {
        document.getElementById('result').innerHTML = 'No feasible region.';
        ctx.clearRect(0, 0, w, h);
        return;
    }

    const isMax = document.getElementById('opt_type').value === 'Maximize';
    const a = parseFloat(document.getElementById('coef_x').value) || 0;
    const b = parseFloat(document.getElementById('coef_y').value) || 0;
    const k = parseFloat(document.getElementById('const').value) || 0;

    let bestZ = isMax ? -Infinity : Infinity;
    let bestP = null;

    corners.forEach(([x, y]) => {
        const z = a * x + b * y + k;
        if ((isMax && z > bestZ) || (!isMax && z < bestZ)) {
            bestZ = z;
            bestP = [x, y];
        }
    });

    const xFmt = bestP[0].toFixed(2).replace(/\.?0+$/, '');
    const yFmt = bestP[1].toFixed(2).replace(/\.?0+$/, '');
    const zFmt = bestZ.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 2});

    document.getElementById('result').innerHTML = `Optimal: x = ${xFmt}, y = ${yFmt}<br>Z = ${zFmt}`;

    // ── Plotting ─────────────────────────────────────
    ctx.clearRect(0, 0, w, h);

    let minX = Math.min(...corners.map(p => p[0]));
    let maxX = Math.max(...corners.map(p => p[0]));
    let minY = Math.min(...corners.map(p => p[1]));
    let maxY = Math.max(...corners.map(p => p[1]));

    const padX = (maxX - minX) * 0.15 || 1;
    const padY = (maxY - minY) * 0.15 || 1;
    minX -= padX; maxX += padX;
    minY -= padY; maxY += padY;

    if (isNaN(minX)) {
        minX = -10; maxX = 10; minY = -10; maxY = 10;
    }

    const sx = x => (x - minX) / (maxX - minX) * w;
    const sy = y => h - (y - minY) / (maxY - minY) * h;

    // Axes
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1;
    if (minX <= 0 && maxX >= 0) {
        ctx.beginPath();
        ctx.moveTo(sx(0), sy(minY));
        ctx.lineTo(sx(0), sy(maxY));
        ctx.stroke();
    }
    if (minY <= 0 && maxY >= 0) {
        ctx.beginPath();
        ctx.moveTo(sx(minX), sy(0));
        ctx.lineTo(sx(maxX), sy(0));
        ctx.stroke();
    }

    // Constraints
    cons.forEach(c => {
        if (!c.label) return;
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 1.5;
        ctx.setLineDash(c.label.includes('≥') || c.label.includes('=') ? [4, 3] : []);
        ctx.beginPath();

        if (Math.abs(c.b) < 1e-8) {
            const xx = c.c / c.a;
            ctx.moveTo(sx(xx), sy(minY));
            ctx.lineTo(sx(xx), sy(maxY));
        } else {
            const y1 = (c.c - c.a * minX) / c.b;
            const y2 = (c.c - c.a * maxX) / c.b;
            ctx.moveTo(sx(minX), sy(y1));
            ctx.lineTo(sx(maxX), sy(y2));
        }
        ctx.stroke();
        ctx.setLineDash([]);
    });

    // Feasible region
    if (corners.length >= 3) {
        const cx = corners.reduce((s, p) => s + p[0], 0) / corners.length;
        const cy = corners.reduce((s, p) => s + p[1], 0) / corners.length;
        corners.sort((p1, p2) => Math.atan2(p1[1]-cy, p1[0]-cx) - Math.atan2(p2[1]-cy, p2[0]-cx));

        ctx.beginPath();
        ctx.moveTo(sx(corners[0][0]), sy(corners[0][1]));
        for (let i = 1; i < corners.length; i++) {
            ctx.lineTo(sx(corners[i][0]), sy(corners[i][1]));
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(100, 180, 255, 0.25)';
        ctx.fill();
        ctx.strokeStyle = '#1976d2';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // Corner points
    ctx.fillStyle = '#000';
    ctx.font = '12px Arial';
    corners.forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(sx(x), sy(y), 4, 0, Math.PI*2);
        ctx.fill();
        ctx.fillText(`(${x.toFixed(1)}, ${y.toFixed(1)})`, sx(x)+6, sy(y)-6);
    });

    // Optimal point
    if (bestP) {
        ctx.fillStyle = '#d32f2f';
        ctx.beginPath();
        ctx.arc(sx(bestP[0]), sy(bestP[1]), 7, 0, Math.PI*2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // Title on canvas
    ctx.fillStyle = '#000';
    ctx.font = 'bold 16px Arial';
    ctx.fillText(`${isMax ? 'Max' : 'Min'} Z = ${zFmt}`, 20, 30);
}
