let constraintCount = 0;
const canvas = document.getElementById('plot');
const ctx = canvas.getContext('2d');
let w = 700, h = 700;

// Initialize the app on load
window.onload = function() {
    resize();
    addConstraint(); // Start with one empty constraint row
};

function resize() {
    const size = Math.min(window.innerWidth - 40, 700);
    canvas.width = size;
    canvas.height = size;
    w = h = size;
}

window.addEventListener('resize', resize);

function addConstraint() {
    constraintCount++;
    const div = document.createElement('div');
    div.id = `con-row-${constraintCount}`;
    div.innerHTML = `
        <input id="a${constraintCount}" type="number" step="any" placeholder="x">
        <span>x +</span>
        <input id="b${constraintCount}" type="number" step="any" placeholder="y">
        <span>y</span>
        <select id="op${constraintCount}">
            <option value="<=">≤</option>
            <option value=">=">≥</option>
            <option value="=">=</option>
        </select>
        <input id="d${constraintCount}" type="number" step="any" placeholder="c">
    `;
    document.getElementById('constraints').appendChild(div);
}

function clearAll() {
    // 1. Reset Objective Inputs
    document.getElementById('coef_x').value = '';
    document.getElementById('coef_y').value = '';
    document.getElementById('const').value = '';
    document.getElementById('opt_type').value = 'Minimize';

    // 2. Clear all constraint rows and reset counter
    document.getElementById('constraints').innerHTML = '';
    constraintCount = 0;

    // 3. Clear Canvas and Results
    document.getElementById('result').innerHTML = '';
    ctx.clearRect(0, 0, w, h);

    // 4. Re-add the initial starting row
    addConstraint();
}

function getConstraints() {
    const cons = [];
    // Standard Non-negativity constraints
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
        
        if (a === 0 && b === 0) continue; // Skip empty rows

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

function pointFeasible(p, cons) {
    return cons.every(c => c.a * p[0] + c.b * p[1] <= c.c + 1e-8);
}

function findCorners(cons) {
    const pts = [];
    const n = cons.length;
    // Intersection of every pair of lines
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
    // Intersections with axes
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
    // Clean duplicates
    const unique = [];
    pts.forEach(p => {
        if (!unique.some(q => Math.abs(q[0] - p[0]) < 1e-6 && Math.abs(q[1] - p[1]) < 1e-6))
            unique.push(p);
    });
    return unique;
}

function solveLP() {
    const cons = getConstraints();
    if (cons.length === 0) {
        document.getElementById('result').innerHTML = 'Please add valid constraints.';
        return;
    }

    const corners = findCorners(cons);
    if (corners.length === 0) {
        document.getElementById('result').innerHTML = 'Feasible region is empty or unbounded.';
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

    // Formatting Results
    const xFmt = bestP[0].toFixed(2).replace(/\.?0+$/, '');
    const yFmt = bestP[1].toFixed(2).replace(/\.?0+$/, '');
    const zFmt = bestZ.toLocaleString('en-US', {maximumFractionDigits: 2});
    document.getElementById('result').innerHTML = `Optimal Solution:<br>x = ${xFmt}, y = ${yFmt}<br>Z = ${zFmt}`;

    drawPlot(cons, corners, bestP, isMax, zFmt);
}

function drawPlot(cons, corners, bestP, isMax, zValue) {
    ctx.clearRect(0, 0, w, h);

    // Scaling
    let minX = 0, minY = 0;
    let maxX = Math.max(5, ...corners.map(p => p[0]));
    let maxY = Math.max(5, ...corners.map(p => p[1]));
    const padX = maxX * 0.2;
    const padY = maxY * 0.2;
    maxX += padX; maxY += padY;

    const sx = x => (x / maxX) * w;
    const sy = y => h - (y / maxY) * h;

    // Draw Axes
    ctx.strokeStyle = '#aaa';
    ctx.beginPath(); ctx.moveTo(sx(0), 0); ctx.lineTo(sx(0), h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, sy(0)); ctx.lineTo(w, sy(0)); ctx.stroke();

    // Draw Feasible Region
    if (corners.length >= 2) {
        const cx = corners.reduce((s, p) => s + p[0], 0) / corners.length;
        const cy = corners.reduce((s, p) => s + p[1], 0) / corners.length;
        corners.sort((p1, p2) => Math.atan2(p1[1]-cy, p1[0]-cx) - Math.atan2(p2[1]-cy, p2[0]-cx));

        ctx.beginPath();
        ctx.moveTo(sx(corners[0][0]), sy(corners[0][1]));
        corners.forEach(p => ctx.lineTo(sx(p[0]), sy(p[1])));
        ctx.closePath();
        ctx.fillStyle = 'rgba(25, 118, 210, 0.2)';
        ctx.fill();
        ctx.strokeStyle = '#1976d2';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // Draw Constraint Lines
    cons.forEach(c => {
        if (!c.label) return;
        ctx.strokeStyle = '#888';
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        if (Math.abs(c.b) < 1e-8) {
            const xVal = c.c / c.a;
            ctx.moveTo(sx(xVal), 0); ctx.lineTo(sx(xVal), h);
        } else {
            ctx.moveTo(sx(0), sy(c.c / c.b));
            ctx.lineTo(sx(maxX), sy((c.c - c.a * maxX) / c.b));
        }
        ctx.stroke();
        ctx.setLineDash([]);
    });

    // Draw Corner Points
    ctx.fillStyle = '#333';
    corners.forEach(([x, y]) => {
        ctx.beginPath(); ctx.arc(sx(x), sy(y), 4, 0, Math.PI*2); ctx.fill();
        ctx.font = '10px Arial';
        ctx.fillText(`(${x.toFixed(1)},${y.toFixed(1)})`, sx(x)+5, sy(y)-5);
    });

    // Highlight Optimal Point
    if (bestP) {
        ctx.fillStyle = '#d32f2f';
        ctx.beginPath(); ctx.arc(sx(bestP[0]), sy(bestP[1]), 7, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    }
}
