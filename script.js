let constraintCount = 0;
const canvas = document.getElementById('plot');
const ctx = canvas.getContext('2d');
let w = 700, h = 700;

// Initialize on load
window.onload = function () {
    resize();
    addConstraint(); // start with one empty row
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
    // Reset objective
    document.getElementById('coef_x').value = '';
    document.getElementById('coef_y').value = '';
    document.getElementById('const').value = '';
    document.getElementById('opt_type').value = 'Minimize';

    // Remove all constraint rows and reset counter
    document.getElementById('constraints').innerHTML = '';
    constraintCount = 0;

    // Clear output
    document.getElementById('result').innerHTML = '';
    ctx.clearRect(0, 0, w, h);

    // Add one fresh empty constraint row (consistent UX)
    addConstraint();
}

function getConstraints() {
    const cons = [];

    // Non-negativity (x≥0, y≥0)
    if (document.getElementById('nonneg').checked) {
        cons.push({ a: -1, b: 0, c: 0, label: 'x ≥ 0' });
        cons.push({ a: 0, b: -1, c: 0, label: 'y ≥ 0' });
    }

    for (let i = 1; i <= constraintCount; i++) {
        const aEl = document.getElementById(`a${i}`);
        if (!aEl) continue;

        const a = parseFloat(aEl.value) || 0;
        const b = parseFloat(document.getElementById(`b${i}`).value) || 0;
        const op = document.getElementById(`op${i}`).value;
        const d = parseFloat(document.getElementById(`d${i}`).value) || 0;

        // Skip completely empty rows
        if (a === 0 && b === 0 && d === 0) continue;

        const label = `${a}x + ${b}y ${op} ${d}`;

        if (op === '<=') {
            cons.push({ a, b, c: d, label });
        } else if (op === '>=') {
            cons.push({ a: -a, b: -b, c: -d, label });
        } else if (op === '=') {
            cons.push({ a, b, c: d, label });
            cons.push({ a: -a, b: -b, c: -d, label: '' });
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

    // Intersections between every pair of constraints
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const c1 = cons[i];
            const c2 = cons[j];
            const det = c1.a * c2.b - c2.a * c1.b;
            if (Math.abs(det) < 1e-8) continue;
            const x = (c1.c * c2.b - c2.c * c1.b) / det;
            const y = (c2.c * c1.a - c1.c * c2.a) / det;
            if (pointFeasible([x, y], cons)) pts.push([x, y]);
        }
    }

    // Intercepts with axes
    for (const c of cons) {
        if (Math.abs(c.a) > 1e-8) {
            const x = c.c / c.a;
            if (pointFeasible([x, 0], cons) && x >= -1e-6) pts.push([x, 0]);
        }
        if (Math.abs(c.b) > 1e-8) {
            const y = c.c / c.b;
            if (pointFeasible([0, y], cons) && y >= -1e-6) pts.push([0, y]);
        }
    }

    // Remove near-duplicates
    const unique = [];
    pts.forEach(p => {
        if (!unique.some(q => Math.abs(q[0] - p[0]) < 1e-5 && Math.abs(q[1] - p[1]) < 1e-5)) {
            unique.push(p);
        }
    });

    return unique;
}

function solveLP() {
    const cons = getConstraints();

    if (cons.length < 2) {  // at least non-neg + one real constraint usually needed
        document.getElementById('result').innerHTML = 'Please enter at least one valid constraint.';
        ctx.clearRect(0, 0, w, h);
        return;
    }

    const corners = findCorners(cons);

    if (corners.length === 0) {
        document.getElementById('result').innerHTML = 'No feasible region found (empty or unbounded).';
        ctx.clearRect(0, 0, w, h);
        return;
    }

    const isMax = document.getElementById('opt_type').value === 'Maximize';
    const coefX = parseFloat(document.getElementById('coef_x').value) || 0;
    const coefY = parseFloat(document.getElementById('coef_y').value) || 0;
    const constTerm = parseFloat(document.getElementById('const').value) || 0;

    let bestZ = isMax ? -Infinity : Infinity;
    let bestP = null;

    corners.forEach(([x, y]) => {
        const z = coefX * x + coefY * y + constTerm;
        if ((isMax && z > bestZ) || (!isMax && z < bestZ)) {
            bestZ = z;
            bestP = [x, y];
        }
    });

    const xFmt = bestP[0].toFixed(2).replace(/\.?0+$/, '');
    const yFmt = bestP[1].toFixed(2).replace(/\.?0+$/, '');
    const zFmt = bestZ.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

    document.getElementById('result').innerHTML = 
        `Optimal: x = ${xFmt}, y = ${yFmt}<br>Z = ${zFmt}`;

    drawPlot(cons, corners, bestP, isMax, zFmt);
}

function drawPlot(cons, corners, bestP, isMax, zValue) {
    ctx.clearRect(0, 0, w, h);

    // Determine plot bounds
    let minX = 0;
    let minY = 0;
    let maxX = 5;
    let maxY = 5;

    if (corners.length > 0) {
        maxX = Math.max(...corners.map(p => p[0]), 5);
        maxY = Math.max(...corners.map(p => p[1]), 5);
    }

    const pad = Math.max(maxX, maxY) * 0.18;
    maxX += pad;
    maxY += pad;

    const sx = x => (x / maxX) * w;
    const sy = y => h - (y / maxY) * h;

    // Light grid / axes
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx(0), 0);
    ctx.lineTo(sx(0), h);
    ctx.moveTo(0, sy(0));
    ctx.lineTo(w, sy(0));
    ctx.stroke();

    // Draw constraint lines
    cons.forEach(c => {
        if (!c.label) return;
        ctx.strokeStyle = '#757575';
        ctx.setLineDash([4, 3]);
        ctx.lineWidth = 1.5;

        ctx.beginPath();
        if (Math.abs(c.b) < 1e-8) {
            const xv = c.c / c.a;
            if (xv >= -1e-6 && xv <= maxX * 1.1) {
                ctx.moveTo(sx(xv), 0);
                ctx.lineTo(sx(xv), h);
            }
        } else {
            const y0 = c.c / c.b;
            const yMax = (c.c - c.a * maxX) / c.b;
            ctx.moveTo(sx(0), sy(y0));
            ctx.lineTo(sx(maxX), sy(yMax));
        }
        ctx.stroke();
        ctx.setLineDash([]);
    });

    // Feasible region polygon
    if (corners.length >= 3) {
        const cx = corners.reduce((sum, p) => sum + p[0], 0) / corners.length;
        const cy = corners.reduce((sum, p) => sum + p[1], 0) / corners.length;

        corners.sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));

        ctx.beginPath();
        ctx.moveTo(sx(corners[0][0]), sy(corners[0][1]));
        for (let i = 1; i < corners.length; i++) {
            ctx.lineTo(sx(corners[i][0]), sy(corners[i][1]));
        }
        ctx.closePath();

        ctx.fillStyle = 'rgba(33, 150, 243, 0.18)';
        ctx.fill();
        ctx.strokeStyle = '#1976d2';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // Corner points
    ctx.fillStyle = '#424242';
    ctx.font = '10px Arial';
    corners.forEach(([x, y]) => {
        const px = sx(x);
        const py = sy(y);
        ctx.beginPath();
        ctx.arc(px, py, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillText(`(${x.toFixed(1)}, ${y.toFixed(1)})`, px + 6, py - 6);
    });

    // Optimal point
    if (bestP) {
        const px = sx(bestP[0]);
        const py = sy(bestP[1]);
        ctx.fillStyle = '#d32f2f';
        ctx.beginPath();
        ctx.arc(px, py, 6.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Label optimal
        ctx.fillStyle = '#d32f2f';
        ctx.font = 'bold 13px Arial';
        ctx.fillText(`${isMax ? 'MAX' : 'MIN'} = ${zValue}`, px + 10, py - 12);
    }
}
