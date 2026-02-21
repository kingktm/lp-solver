let constraintCount = 0;
const canvas = document.getElementById('plot');
const ctx = canvas.getContext('2d');
let w = 700, h = 700;

// Initialize on load
window.onload = function() {
    resize();
    addConstraint(); 
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
    // Reset Objective
    document.getElementById('coef_x').value = '';
    document.getElementById('coef_y').value = '';
    document.getElementById('const').value = '';
    document.getElementById('opt_type').value = 'Minimize';

    // Reset Constraints to exactly one row
    document.getElementById('constraints').innerHTML = '';
    constraintCount = 0;
    addConstraint(); 

    // Clear UI and Canvas
    document.getElementById('result').innerHTML = '';
    ctx.clearRect(0, 0, w, h);
}

// Ensure solveLP and findCorners logic remains below...
// (The mathematical logic provided in your first snippet should follow here)
