// ============================================================
// MATHSHEET PRO — worksheet.js
// Core worksheet engine: question generation, rendering, PDF export
// ============================================================

// ---- Global State ----
let currentQuestions = [];   // Array of {a, b, op, answer, display}
let currentConfig = {};    // Current worksheet configuration
let timerInterval = null;  // Timer interval reference
let timerSecondsLeft = 0;    // Seconds remaining in timer
let timerTotalSeconds = 0;   // Total timer seconds

// ============================================================
// SECTION 1: UI CONTROL FUNCTIONS
// ============================================================

/**
 * Select an operation type tab (Addition, Subtraction, etc.)
 */
function selectOp(el) {
  document.querySelectorAll('.op-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('breadcrumbOp').textContent =
    { addition: 'Addition', subtraction: 'Subtraction', multiplication: 'Multiplication', division: 'Division', 'column-addition': 'Column Addition' }[el.dataset.op]
    || el.dataset.op;
  // Auto-apply difficulty range hint based on operation
  applyDifficultyRangeHint();
}

/**
 * Select a difficulty tab (Easy, Medium, Hard)
 */
function selectDiff(el) {
  document.querySelectorAll('.diff-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  applyDifficultyRangeHint();
}

/**
 * Select a layout tab (Horizontal, Vertical)
 */
function selectLayout(el) {
  document.querySelectorAll('.layout-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
}

/**
 * Show/hide timer config when timer toggle is changed
 */
function handleTimerToggle() {
  const isOn = document.getElementById('toggleTimer').checked;
  document.getElementById('timerConfig').classList.toggle('visible', isOn);
}

/**
 * Automatically set number range based on current operation + difficulty
 */
function applyDifficultyRangeHint() {
  const op = document.querySelector('.op-tab.active')?.dataset?.op || 'multiplication';
  const diff = document.querySelector('.diff-tab.active')?.dataset?.diff || 'easy';

  const presets = {
    multiplication: { easy: [2, 10], medium: [2, 12], hard: [10, 99] },
    division: { easy: [2, 10], medium: [2, 12], hard: [10, 99] },
    addition: { easy: [1, 20], medium: [10, 99], hard: [100, 999] },
    subtraction: { easy: [1, 20], medium: [10, 99], hard: [100, 999] },
    counting: { easy: [1, 20], medium: [1, 50], hard: [1, 100] },
    'place-value': { easy: [10, 99], medium: [100, 999], hard: [1000, 9999] },
    rounding: { easy: [1, 100], medium: [1, 999], hard: [1, 9999] },
    'mult-properties': { easy: [2, 9], medium: [2, 12], hard: [2, 12] },
    'column-addition': { easy: [1, 9], medium: [10, 99], hard: [100, 999] },
  };

  const range = (presets[op] || presets.multiplication)[diff];
  document.getElementById('numMin').value = range[0];
  document.getElementById('numMax').value = range[1];
}

// ============================================================
// SECTION 2: QUESTION GENERATION ENGINE
// ============================================================

/**
 * Generate a set of unique math questions.
 * Returns array of question objects.
 *
 * @param {Object} opts - Configuration options
 * @returns {Array}     - Array of question objects
 */
function generateQuestions(opts) {
  const { operation, min, max, count, shuffle } = opts;
  const questions = [];
  const seen = new Set();

  const maxAttempts = count * 20;
  let attempts = 0;

  while (questions.length < count && attempts < maxAttempts) {
    attempts++;

    let a, b, answer, display, qNums = null;

    if (operation === 'multiplication') {
      a = randInt(min, max);
      b = randInt(min, max);
      answer = a * b;
      display = `${a} × ${b}`;

    } else if (operation === 'addition') {
      a = randInt(min, max);
      b = randInt(min, max);
      answer = a + b;
      display = `${a} + ${b}`;

    } else if (operation === 'column-addition') {
      const nums = [randInt(min, max), randInt(min, max), randInt(min, max)];
      answer = nums.reduce((s, n) => s + n, 0);
      display = nums.join(' + ');
      qNums = nums; // Store for renderer

    } else if (operation === 'subtraction') {
      a = randInt(min, max);
      b = randInt(min, max);
      if (b > a) { const tmp = a; a = b; b = tmp; }
      answer = a - b;
      display = `${a} − ${b}`;

    } else if (operation === 'division') {
      // divisorDigits: 1 = 1..9, 2 = 10..99, 3 = 100..999
      const dd = opts.divisorDigits || 1;
      const divisorMin = dd === 3 ? 100 : dd === 2 ? 10 : 2;
      const divisorMax = dd === 3 ? 999 : dd === 2 ? 99 : 9;
      b = randInt(divisorMin, divisorMax);
      // Generate a non-trivial quotient (2–999) so dividend is big enough
      const quotientMax = dd === 3 ? 999 : dd === 2 ? 9999 : 9999;
      answer = randInt(2, Math.min(quotientMax, 9999));
      a = b * answer;
      display = `${a} ÷ ${b}`;

    } else if (operation === 'mixed') {
      const ops = ['addition', 'subtraction', 'multiplication'];
      const subOp = ops[Math.floor(Math.random() * ops.length)];
      return generateQuestions({ ...opts, operation: subOp })
        .concat(generateQuestions({ ...opts, operation: 'division', count: Math.floor(count / 4) }))
        .slice(0, count);

      // ── NEW: Counting & Ordering ──────────────────────────────
    } else if (operation === 'counting') {
      const step = [1, 2, 5, 10][randInt(0, 3)];
      const start = randInt(Math.max(0, min), Math.max(min, max - step * 5));
      const len = 6; // sequence length shown
      const gapIdx = randInt(1, len - 2); // which number is hidden (never first/last)
      const seq = Array.from({ length: len }, (_, i) => start + i * step);
      answer = seq[gapIdx];
      const shown = seq.map((n, i) => i === gapIdx ? '___' : n).join(', ');
      display = `Fill in: ${shown}`;
      a = start; b = step;

      // ── NEW: Place Value ──────────────────────────────────────
    } else if (operation === 'place-value') {
      const placeNames = ['ones', 'tens', 'hundreds', 'thousands'];
      const placeValues = [1, 10, 100, 1000];
      const num = randInt(Math.max(min, 10), Math.max(max, 999));
      const pIdx = randInt(0, String(num).length - 1); // pick a valid digit position
      const placeV = placeValues[pIdx];
      const digit = Math.floor(num / placeV) % 10;
      answer = digit;
      display = `What digit is in the ${placeNames[pIdx]} place of ${num}?`;
      a = num; b = placeV;

      // ── NEW: Rounding Numbers ─────────────────────────────────
    } else if (operation === 'rounding') {
      const roundTo = [10, 100, 1000][randInt(0, min > 100 ? 2 : min > 10 ? 1 : 0)];
      const num = randInt(Math.max(min, roundTo + 1), Math.max(max, roundTo * 10));
      answer = Math.round(num / roundTo) * roundTo;
      display = `Round ${num} to the nearest ${roundTo}`;
      a = num; b = roundTo;

      // ── NEW: Multiplication Properties ───────────────────────
    } else if (operation === 'mult-properties') {
      const propType = randInt(0, 2); // 0=commutative, 1=associative, 2=distributive
      if (propType === 0) {
        // Commutative: a × b = b × ___
        a = randInt(min, Math.min(max, 12));
        b = randInt(min, Math.min(max, 12));
        answer = a;
        display = `${b} × ___ = ${a} × ${b}`;
      } else if (propType === 1) {
        // Associative: (a×b)×c = a×(b×___)
        a = randInt(2, 6); b = randInt(2, 6);
        const c = randInt(2, 6);
        answer = c;
        display = `(${a} × ${b}) × ${c} = ${a} × (${b} × ___)`;
      } else {
        // Distributive: a×(b+c) = a×b + a×___
        a = randInt(2, 9);
        b = randInt(1, 9);
        const c = randInt(1, 9);
        answer = c;
        display = `${a} × (${b} + ${c}) = ${a}×${b} + ${a}×___`;
      }
    } else {
      // Fallback to multiplication
      a = randInt(min, max);
      b = randInt(min, max);
      answer = a * b;
      display = `${a} × ${b}`;
    }

    const key = display;
    if (!seen.has(key)) {
      seen.add(key);
      questions.push({ a, b, op: operation, answer, display, nums: qNums });
    }
  }

  if (questions.length < count) {
    while (questions.length < count) {
      const last = questions[Math.floor(Math.random() * questions.length)];
      questions.push({ ...last });
    }
  }

  return shuffle ? shuffleArray(questions) : questions;
}


/**
 * Return a random integer between min and max (inclusive)
 */
function randInt(min, max) {
  if (max < min) max = min;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Fisher-Yates shuffle
 */
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ============================================================
// SECTION 3: WORKSHEET RENDERING
// ============================================================

/**
 * Main entry point: read config, generate questions, render preview
 */
function generateWorksheet() {
  // Read config from UI
  const operation = document.querySelector('.op-tab.active')?.dataset?.op || 'multiplication';
  const difficulty = document.querySelector('.diff-tab.active')?.dataset?.diff || 'easy';
  const layout = document.querySelector('.layout-tab.active')?.dataset?.layout || 'horizontal';
  const min = parseInt(document.getElementById('numMin').value) || 1;
  const max = parseInt(document.getElementById('numMax').value) || 12;
  const count = parseInt(document.getElementById('questionCount').value) || 20;
  const showAnswers = document.getElementById('toggleAnswers').checked;
  const doShuffle = document.getElementById('toggleShuffle').checked;
  const timerOn = document.getElementById('toggleTimer').checked;
  const timerMins = parseInt(document.getElementById('timerMinutes').value) || 5;
  const customTitle = document.getElementById('wsTitle').value.trim();

  // Validate range
  if (min > max) {
    alert('⚠️ Minimum value cannot be greater than Maximum value!');
    return;
  }

  // Read divisor digits for division
  let divisorDigits = 1;
  const activeDigitTab = document.querySelector('.div-digit-tab.active');
  if (activeDigitTab) divisorDigits = parseInt(activeDigitTab.dataset.digits) || 1;

  // Save config globally
  currentConfig = { operation, difficulty, layout, min, max, count, showAnswers, doShuffle, timerOn, timerMins, divisorDigits };

  // Generate
  currentQuestions = generateQuestions({ operation, min, max, count, difficulty, shuffle: doShuffle, divisorDigits });

  // Build worksheet title
  const opLabels = {
    multiplication: 'Multiplication',
    addition: 'Addition',
    subtraction: 'Subtraction',
    division: 'Division',
    mixed: 'Mixed Operations',
    counting: 'Counting & Ordering',
    'place-value': 'Place Value',
    rounding: 'Rounding Numbers',
    'column-addition': 'Column Addition',
    'mult-properties': 'Multiplication Properties',
  };
  const diffLabels = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

  const wsTitle = customTitle || `${opLabels[operation] || 'Math'} Worksheet`;
  const wsSubtitle = `${diffLabels[difficulty]} · ${count} Questions · ${layout === 'horizontal' ? 'Horizontal' : 'Vertical'} Layout`;

  // Render
  const preview = document.getElementById('worksheetPreview');
  preview.innerHTML = buildWorksheetHTML(wsTitle, wsSubtitle, currentQuestions, layout, showAnswers, count);

  // Show preview, hide placeholder
  document.getElementById('previewPlaceholder').style.display = 'none';
  document.getElementById('worksheetPreview').classList.add('visible');
  document.getElementById('previewActionBtns').style.display = 'flex';
  document.getElementById('configActionsRow').style.display = 'grid';
  document.getElementById('previewTitle').textContent = wsTitle;

  // Handle timer
  resetTimerUI();
  if (timerOn) {
    timerSecondsLeft = timerMins * 60;
    timerTotalSeconds = timerSecondsLeft;
    document.getElementById('timerDisplay').classList.add('visible');
    updateTimerClock();
  } else {
    document.getElementById('timerDisplay').classList.remove('visible');
  }

  // Smooth scroll to preview on mobile
  if (window.innerWidth < 1024) {
    document.getElementById('worksheetPreview').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

/**
 * Build the inner HTML for the worksheet paper
 */
function buildWorksheetHTML(title, subtitle, questions, layout, showAnswers, totalCount) {
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const opSymbolMap = {
    multiplication: '×',
    addition: '+',
    subtraction: '−',
    division: '÷',
    mixed: '±',
    'column-addition': '+',
  };

  let html = `
    <div class="ws-paper">
      <div class="ws-header">
        <div class="ws-title">${escHtml(title)}</div>
        <div class="ws-subtitle">${escHtml(subtitle)}</div>
        <div class="ws-info-row">
          <div class="ws-info-field"><span>Name:</span> ________________________</div>
          <div class="ws-info-field"><span>Date:</span> ${date}</div>
          <div class="ws-info-field"><span>Score:</span> ________ / ${totalCount}</div>
        </div>
      </div>
      <p class="ws-instructions">Solve each problem. Show your work where needed.</p>
  `;

  if (layout === 'horizontal') {
    html += `<div class="ws-questions-horizontal">`;
    questions.forEach((q, i) => {
      html += `
        <div class="ws-q-horizontal">
          <span class="q-num-label">${i + 1}.</span>
          <span>${escHtml(q.display)}</span>
          <span>=</span>
          <span class="q-answer-blank"></span>
        </div>
      `;
    });
    html += `</div>`;

  } else {
    // Vertical layout
    // Determine if we are doing standard arithmetic or long text
    const op = currentConfig.operation;
    const isLongText = ['counting', 'place-value', 'rounding', 'mult-properties'].includes(op);
    const isDivision = op === 'division';
    let gridClass = isLongText ? 'ws-questions-longtext'
      : isDivision ? 'ws-questions-long-division'
      : 'ws-questions-vertical-5';
    if (!isLongText && !isDivision && currentConfig.max > 99999) {
      gridClass = 'ws-questions-vertical-3'; // 3 columns for 6-digit numbers
    }


    html += `<div class="${gridClass}">`;

    questions.forEach((q, i) => {
      const symbol = opSymbolMap[q.op] || '×';

      if (isLongText) {
        html += `
          <div class="ws-q-longtext">
            <span class="q-num-label">${i + 1}.</span>
            <div style="margin-bottom: 8px;">${escHtml(q.display)}</div>
            <div style="display:flex; gap:8px;">
               <span style="color:var(--text-muted);font-size:0.9rem;">Answer:</span>
               <div style="border-bottom:1.5px solid var(--text-secondary);flex:1;"></div>
            </div>
          </div>
        `;
      } else if (q.op === 'division') {
        // Classic long-division bracket style (Math-Drills) — 3 per row
        html += `
          <div class="ws-q-long-division">
            <div class="long-div-block">
              <span class="ld-divisor">${q.b}</span><span class="ld-bracket">)</span><span class="ld-dividend-wrap"><span class="ld-dividend">${q.a}</span></span>
            </div>
          </div>
        `;
      } else if (q.op === 'column-addition' && q.nums) {
        html += `
          <div class="ws-q-vertical-math">
            ${q.nums.map((num, idx) => {
              if (idx === q.nums.length - 1) {
                return `
                  <div class="q-operator-line">
                    <span class="q-operator">${symbol}</span>
                    <span class="q-number-bottom">${num}</span>
                  </div>
                `;
              }
              return `<div class="q-number">${num}</div>`;
            }).join('')}
            <div class="q-math-line"></div>
          </div>
        `;
      } else {
        html += `
          <div class="ws-q-vertical-math">
            <div class="q-number">${q.a}</div>
            <div class="q-operator-line">
              <span class="q-operator">${symbol}</span>
              <span class="q-number-bottom">${q.b}</span>
            </div>
            <div class="q-math-line"></div>
          </div>
        `;
      }
    }); // closes questions.forEach
    html += `</div>`;
  }
  html += `</div>`; // Close the first ws-paper

  // Answer key section
  if (showAnswers) {
    html += `
      <div class="ws-paper">
        <div class="ws-answer-key">
          <div class="ws-answer-key-title">✅ Answer Key</div>
          <div class="ws-answers-grid">
    `;
      questions.forEach((q, i) => {
        html += `<div class="ws-answer-item">${i + 1}. ${q.answer}</div>`;
      });
      html += `
          </div>
        </div>
      </div>
    `;
    }

    return html;
  }

  /**
   * Escape HTML to prevent XSS
   */
  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Reset back to placeholder state
   */
  function resetWorksheet() {
    currentQuestions = [];
    currentConfig = {};
    document.getElementById('previewPlaceholder').style.display = 'block';
    document.getElementById('worksheetPreview').classList.remove('visible');
    document.getElementById('previewActionBtns').style.display = 'none';
    document.getElementById('configActionsRow').style.display = 'none';
    document.getElementById('timerDisplay').classList.remove('visible');
    resetTimerUI();
  }

  // ============================================================
  // SECTION 4: PDF EXPORT (using jsPDF)
  // ============================================================

  /**
   * Generate and download a clean PDF of the worksheet
   */
  function downloadPDF() {
    if (!currentQuestions.length) {
      alert('Please generate a worksheet first!');
      return;
    }

    // Show loading state
    const btn = document.getElementById('downloadPdfBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ Generating PDF…';
    btn.disabled = true;

    // Slight delay so UI updates before jsPDF runs
    setTimeout(() => {
      try {
        buildAndDownloadPDF();
      } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
      }
    }, 80);
  }

  /**
   * Core PDF building logic
   */
  function buildAndDownloadPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const config = currentConfig;
    const questions = currentQuestions;

    const opLabels = {
      multiplication: 'Multiplication',
      addition: 'Addition',
      subtraction: 'Subtraction',
      division: 'Division',
      mixed: 'Mixed Operations',
    };
    const title = document.getElementById('wsTitle').value.trim() || `${opLabels[config.operation] || 'Math'} Worksheet`;

    const pageW = 210;
    const pageH = 297;
    const marginX = 20;
    const contentW = pageW - marginX * 2;
    let y = 20;

    function setFont(style, size) {
      doc.setFont('times', style || 'normal');
      doc.setFontSize(size || 12);
      doc.setTextColor(0, 0, 0); // Black and white only
    }

    function checkNewPage(needed) {
      if (y + needed > pageH - 20) {
        doc.addPage();
        y = 20;
        return true;
      }
      return false;
    }

    // ---- Header: Bordered Title ----
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.rect(marginX, y, contentW, 10);
    setFont('normal', 16);
    doc.text(title, pageW / 2, y + 7, { align: 'center' });
    y += 18;

    // ---- Name / Date / Score line ----
    setFont('normal', 11);
    const lineY = y;
    // Name
    doc.text('Name:', marginX, lineY);
    doc.line(marginX + 12, lineY + 1, marginX + 60, lineY + 1);
    // Date
    doc.text('Date:', pageW / 2 - 20, lineY);
    doc.line(pageW / 2 - 8, lineY + 1, pageW / 2 + 35, lineY + 1);
    // Score
    doc.text('Score:', pageW - marginX - 35, lineY);
    doc.line(pageW - marginX - 22, lineY + 1, pageW - marginX - 8, lineY + 1);
    doc.setFontSize(10);
    doc.text(`/${questions.length}`, pageW - marginX - 6, lineY);
    y += 10;

    // ---- Instructions ----
    setFont('normal', 11);
    let instruction = 'Calculate each answer.';
    if (config.operation === 'addition') instruction = 'Calculate each sum.';
    else if (config.operation === 'subtraction') instruction = 'Calculate each difference.';
    else if (config.operation === 'multiplication') instruction = 'Calculate each product.';
    else if (config.operation === 'division') instruction = 'Calculate each quotient.';

    doc.text(instruction, pageW / 2, y, { align: 'center' });
    y += 15;

    // ---- Questions Layout ----
    const isVertical = config.layout === 'vertical';
    const isDivisionOp = config.operation === 'division';

    const isLongText = ['counting', 'place-value', 'rounding', 'mult-properties'].includes(config.operation);
    let cols = isDivisionOp ? 3 : (isVertical ? 5 : (isLongText ? 2 : 4));
    if (isVertical && !isLongText && !isDivisionOp && config.max > 99999) {
      cols = 3;
    }
    const colW = contentW / cols;
    const rowH = isDivisionOp ? 55 : (isVertical ? 35 : (isLongText ? 20 : 15));

    const opSymMap = {
      multiplication: String.fromCharCode(215),
      addition: '+',
      subtraction: String.fromCharCode(8722),
      division: String.fromCharCode(247),
      mixed: '*',
      'column-addition': '+',
    };

    questions.forEach((q, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);

      if (col === 0) checkNewPage(rowH + 5);

      const qx = marginX + col * colW;
      const qy = y + row * rowH;

      if (isDivisionOp) {
        // ── Math-Drills Long-Division bracket style ──
        const divisorStr = String(q.b);
        const dividendStr = String(q.a);

        setFont('normal', 16);
        const divisorW = doc.getTextWidth(divisorStr);
        const bracketW = doc.getTextWidth(')');
        const dividendW = doc.getTextWidth(dividendStr);
        const totalW = divisorW + bracketW + dividendW + 2;

        // Left-align within column with some padding
        const startX = qx + 8;
        const textY = qy + 18;

        // Divisor
        doc.text(divisorStr, startX, textY);
        // Bracket
        doc.text(')', startX + divisorW + 0.5, textY);
        // Dividend
        doc.text(dividendStr, startX + divisorW + bracketW + 2, textY);
        // Overline over dividend only
        doc.setLineWidth(0.5);
        const overlineStartX = startX + divisorW + bracketW + 1;
        const overlineEndX = overlineStartX + dividendW + 3;
        doc.line(overlineStartX, textY - 5, overlineEndX, textY - 5);

      } else if (isVertical && !isLongText) {

        // ── Vertical stacked layout (Classic math-drills style) ──
        // No question numbers
        const boxW = colW * 0.8;
        const boxX = qx + (colW - boxW) / 2; // Center in column
        const boxY = qy;

        setFont('normal', 16);

        if (q.op === 'division') {
          const divisorStr = String(q.b);
          const dividendStr = String(q.a);

          // Let's center the division block inside the column
          const divisorW = doc.getTextWidth(divisorStr);
          const bracketW = doc.getTextWidth(')');
          const dividendW = doc.getTextWidth(dividendStr);
          const totalW = divisorW + bracketW + dividendW + 3; // +3 for padding

          const startX = qx + (colW - totalW) / 2 + 2;

          doc.text(divisorStr, startX, boxY + 14);

          // Thinner font for bracket
          setFont('normal', 16);
          doc.text(')', startX + divisorW + 0.5, boxY + 14);

          // Dividend
          doc.text(dividendStr, startX + divisorW + bracketW + 1.5, boxY + 14);

          // Overline over dividend
          doc.setLineWidth(0.4);
          const lineStartX = startX + divisorW + bracketW + 0.5;
          const lineEndX = lineStartX + dividendW + 2;
          doc.line(lineStartX, boxY + 9, lineEndX, boxY + 9);

        } else if (q.op === 'column-addition' && q.nums) {
          // Render multiple rows
          q.nums.forEach((num, idx) => {
            const currentY = boxY + 6 + (idx * 8);
            if (idx === q.nums.length - 1) {
              const sym = opSymMap[q.op] || '+';
              doc.text(sym, boxX + 2, currentY);
            }
            doc.text(String(num), boxX + boxW - 2, currentY, { align: 'right' });
          });
          const lineY = boxY + 6 + (q.nums.length - 1) * 8 + 2;
          doc.setLineWidth(0.4);
          doc.line(boxX, lineY, boxX + boxW, lineY);

        } else {
          // Top number (right-aligned)
          doc.text(String(q.a), boxX + boxW - 2, boxY + 6, { align: 'right' });

          // Operator + Bottom number
          const sym = opSymMap[q.op] || String.fromCharCode(215);
          doc.text(sym, boxX + 2, boxY + 14);
          doc.text(String(q.b), boxX + boxW - 2, boxY + 14, { align: 'right' });

          // Dividing line
          doc.setLineWidth(0.4);
          doc.line(boxX, boxY + 16, boxX + boxW, boxY + 16);
        }
      } else if (isLongText) {
        // ── Long-text question layout ──
        const maxTxtW = colW - 10;
        setFont('normal', 12);
        doc.text(`${i + 1}.`, qx, qy + 6);
        const lines = doc.splitTextToSize(q.display, maxTxtW);
        doc.text(lines, qx + 7, qy + 6);

        const textBlockH = lines.length * 5;
        const blankY = qy + 6 + textBlockH + 2;
        doc.setLineWidth(0.3);
        doc.line(qx + 7, blankY, qx + maxTxtW, blankY);
      } else {
        // ── Horizontal layout ──
        setFont('normal', 12);
        doc.text(`${i + 1}.`, qx, qy + 7);
        doc.text(`${q.display} =`, qx + 7, qy + 7);
        doc.setLineWidth(0.3);
        const blankX = qx + 7 + doc.getTextWidth(`${q.display} =`) + 2;
        doc.line(blankX, qy + 7, Math.min(blankX + 16, qx + colW - 2), qy + 7);
      }
    });

    const totalRows = Math.ceil(questions.length / cols);
    y += totalRows * rowH + 10;

    // ---- Answer Key ----
    if (config.showAnswers) {
      doc.addPage();
      y = 20;

      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.3);
      doc.rect(marginX, y, contentW, 10);
      setFont('normal', 16);
      doc.text('Answer Key', pageW / 2, y + 7, { align: 'center' });
      y += 20;

      const ansCols = isLongText ? 2 : 5;
      const ansColW = contentW / ansCols;
      const ansRowH = isLongText ? 15 : 12;

      questions.forEach((q, i) => {
        const col = i % ansCols;
        const row = Math.floor(i / ansCols);
        checkNewPage(ansRowH + 2);

        const ax = marginX + col * ansColW;
        const ay = y + row * ansRowH;

        setFont('bold', 12);
        doc.text(`${i + 1}.`, ax + 2, ay + 6);
        setFont('normal', 12);
        const ansText = String(q.answer);
        const ansLines = doc.splitTextToSize(ansText, ansColW - 10);
        doc.text(ansLines, ax + 10, ay + 6);
      });
    }

    const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    doc.save(`${safeTitle}_${new Date().toISOString().slice(0, 10)}.pdf`);
  }



  // ============================================================
  // SECTION 5: PRINT
  // ============================================================

  function printWorksheet() {
    if (!currentQuestions.length) {
      alert('Please generate a worksheet first!');
      return;
    }
    window.print();
  }

  // ============================================================
  // SECTION 6: LOCAL SAVE (localStorage)
  // ============================================================

  function saveLocally() {
    if (!currentQuestions.length) {
      alert('Please generate a worksheet first!');
      return;
    }
    const data = {
      config: currentConfig,
      questions: currentQuestions,
      title: document.getElementById('wsTitle').value || 'Math Worksheet',
      savedAt: new Date().toISOString(),
    };
    const key = `mathsheet_${Date.now()}`;
    try {
      localStorage.setItem(key, JSON.stringify(data));
      const btn = document.getElementById('saveLocalBtn');
      const orig = btn.innerHTML;
      btn.innerHTML = '✅ Saved!';
      btn.style.color = 'var(--green)';
      setTimeout(() => { btn.innerHTML = orig; btn.style.color = ''; }, 2000);
    } catch (e) {
      alert('Could not save to local storage. Your browser may have storage disabled.');
    }
  }

  // ============================================================
  // SECTION 7: TIMER FUNCTIONALITY
  // ============================================================

  /**
   * Start the countdown timer
   */
  function startTimer() {
    if (timerInterval) clearInterval(timerInterval);

    if (timerSecondsLeft <= 0) {
      timerSecondsLeft = timerTotalSeconds;
    }

    const startBtn = document.getElementById('timerStartBtn');
    startBtn.innerHTML = '⏸ Pause';
    startBtn.onclick = pauseTimer;

    timerInterval = setInterval(() => {
      timerSecondsLeft--;
      updateTimerClock();
      updateTimerBar();

      if (timerSecondsLeft <= 0) {
        clearInterval(timerInterval);
        timerInterval = null;
        startBtn.innerHTML = '▶ Start';
        startBtn.onclick = startTimer;

        // Flash effect when time is up
        const clock = document.getElementById('timerClock');
        clock.style.color = 'var(--red)';
        setTimeout(() => { clock.style.color = ''; }, 3000);

        alert('⏰ Time is up! Pencils down!');
      }
    }, 1000);
  }

  /**
   * Pause the timer
   */
  function pauseTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
      const startBtn = document.getElementById('timerStartBtn');
      startBtn.innerHTML = '▶ Resume';
      startBtn.onclick = startTimer;
    }
  }

  /**
   * Reset the timer UI back to its initial state
   */
  function resetTimerUI() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    timerSecondsLeft = timerTotalSeconds;
    const startBtn = document.getElementById('timerStartBtn');
    if (startBtn) {
      startBtn.innerHTML = '▶ Start';
      startBtn.onclick = startTimer;
    }
    updateTimerClock();
    updateTimerBar();
  }

  /**
   * Update the clock display (MM:SS format)
   */
  function updateTimerClock() {
    const el = document.getElementById('timerClock');
    if (!el) return;
    const secs = Math.max(0, timerSecondsLeft);
    const m = String(Math.floor(secs / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    el.textContent = `${m}:${s}`;

    // Warning color when under 20%
    if (timerTotalSeconds > 0 && secs / timerTotalSeconds < 0.2) {
      el.style.color = 'var(--red)';
    } else {
      el.style.color = '';
    }
  }

  /**
   * Update the timer progress bar width
   */
  function updateTimerBar() {
    const bar = document.getElementById('timerBar');
    if (!bar || timerTotalSeconds === 0) return;
    const pct = Math.max(0, timerSecondsLeft / timerTotalSeconds) * 100;
    bar.style.width = `${pct}%`;

    // Change bar color at low time
    if (pct < 20) bar.style.background = 'var(--red)';
    else if (pct < 50) bar.style.background = 'var(--amber)';
    else bar.style.background = 'var(--blue)';
  }

  // ============================================================
  // SECTION 8: INIT
  // ============================================================

  document.addEventListener('DOMContentLoaded', () => {
    // Initialize timer clock display
    timerSecondsLeft = 5 * 60;
    timerTotalSeconds = timerSecondsLeft;
    updateTimerClock();
  });
