/**
 * Quiz system — sailing commands with pip-based leveling.
 * 10 pips to level up. Correct = +1 pip. Wrong/timeout = -1 pip.
 * Level 2+ adds compound commands (tack to a beam reach, etc.).
 */

// ── Points of sail ────────────────────────────────────────────

const POS_RANGES = [
  { name: 'In Irons', min: 0, max: 30 },
  { name: 'Close Hauled', min: 30, max: 50 },
  { name: 'Close Reach', min: 50, max: 75 },
  { name: 'Beam Reach', min: 75, max: 105 },
  { name: 'Broad Reach', min: 105, max: 150 },
  { name: 'Running', min: 150, max: 180 },
] as const;

function getPointOfSail(windAngle: number): string {
  const deg = Math.abs(windAngle) * (180 / Math.PI);
  for (const r of POS_RANGES) {
    if (deg < r.max) return r.name;
  }
  return 'Running';
}

function getTack(windAngle: number): string {
  if (Math.abs(windAngle) < Math.PI / 6) return '';
  return windAngle < 0 ? 'Port' : 'Starboard';
}

function absDeg(angle: number): number {
  return Math.abs(angle) * (180 / Math.PI);
}

// ── Command definitions ───────────────────────────────────────

// Time multipliers per level: level 3 cuts times in half
const TIME_MULT = [1, 1, 1, 0.5] as const;
function timeMult(level: number): number {
  return TIME_MULT[Math.min(level, TIME_MULT.length - 1)];
}

interface Command {
  text: string;
  timeLimit: number;
  check: (startAngle: number, current: number) => 'pending' | 'correct';
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Level 1

function headUpCmd(level: number): Command {
  return {
    text: pick(['Head Up!', 'Luff Up!', 'Come Up!']),
    timeLimit: 5 * timeMult(level),
    check: (start, cur) => absDeg(start) - absDeg(cur) > 11 ? 'correct' : 'pending',
  };
}

function bearAwayCmd(level: number): Command {
  return {
    text: pick(['Bear Away!', 'Fall Off!', 'Head Down!']),
    timeLimit: 5 * timeMult(level),
    check: (start, cur) => absDeg(cur) - absDeg(start) > 11 ? 'correct' : 'pending',
  };
}

function targetCmd(label: string, minDeg: number, maxDeg: number, level: number): Command {
  return {
    text: pick([`Go to a ${label}`, `Sail ${label}`]),
    timeLimit: 10 * timeMult(level),
    check: (_start, cur) => {
      const d = absDeg(cur);
      return d >= minDeg && d <= maxDeg ? 'correct' : 'pending';
    },
  };
}

function tackCmd(level: number): Command {
  let minAbs = Infinity; // track closest to head-to-wind
  return {
    text: pick(['Tack!', 'Ready About!', 'Tacking!', 'Helm\'s Alee!']),
    timeLimit: 10 * timeMult(level),
    check: (start, cur) => {
      minAbs = Math.min(minAbs, Math.abs(cur));
      const crossed = Math.sign(start) !== 0 && Math.sign(start) !== Math.sign(cur);
      // Must have passed through head-to-wind (minAbs was small)
      return crossed && minAbs < Math.PI / 3 && Math.abs(cur) > Math.PI / 6
        ? 'correct' : 'pending';
    },
  };
}

function jibeCmd(level: number): Command {
  let maxAbs = 0; // track closest to dead downwind
  return {
    text: pick(['Jibe!', 'Gybe!', 'Jibing!', 'Gybing!']),
    timeLimit: 10 * timeMult(level),
    check: (start, cur) => {
      maxAbs = Math.max(maxAbs, Math.abs(cur));
      const crossed = Math.sign(start) !== 0 && Math.sign(start) !== Math.sign(cur);
      // Must have passed through dead downwind (maxAbs was near π)
      return crossed && maxAbs > 2 * Math.PI / 3 && Math.abs(cur) > Math.PI / 6
        ? 'correct' : 'pending';
    },
  };
}

// Level 2 compound

function tackToTargetCmd(label: string, minDeg: number, maxDeg: number, level: number): Command {
  let minAbs = Infinity;
  return {
    text: `Tack to a ${label}`,
    timeLimit: 15 * timeMult(level),
    check: (start, cur) => {
      minAbs = Math.min(minAbs, Math.abs(cur));
      const crossed = Math.sign(start) !== 0 && Math.sign(start) !== Math.sign(cur);
      if (!crossed || minAbs >= Math.PI / 3) return 'pending';
      const d = absDeg(cur);
      return d >= minDeg && d <= maxDeg ? 'correct' : 'pending';
    },
  };
}

function jibeToTargetCmd(label: string, minDeg: number, maxDeg: number, level: number): Command {
  let maxAbs = 0;
  return {
    text: `Jibe to a ${label}`,
    timeLimit: 15 * timeMult(level),
    check: (start, cur) => {
      maxAbs = Math.max(maxAbs, Math.abs(cur));
      const crossed = Math.sign(start) !== 0 && Math.sign(start) !== Math.sign(cur);
      if (!crossed || maxAbs <= 2 * Math.PI / 3) return 'pending';
      const d = absDeg(cur);
      return d >= minDeg && d <= maxDeg ? 'correct' : 'pending';
    },
  };
}

// ── Command generation ────────────────────────────────────────

function generateCommand(windAngle: number, level: number): Command {
  const deg = absDeg(windAngle);
  const pos = getPointOfSail(windAngle);
  const cmds: Command[] = [];

  if (deg > 45) cmds.push(headUpCmd(level));
  if (deg < 155) cmds.push(bearAwayCmd(level));

  if (pos !== 'Close Hauled' && pos !== 'In Irons')
    cmds.push(targetCmd('Close Hauled', 30, 52, level));
  if (pos !== 'Close Reach')
    cmds.push(targetCmd('Close Reach', 48, 77, level));
  if (pos !== 'Beam Reach')
    cmds.push(targetCmd('Beam Reach', 73, 107, level));
  if (pos !== 'Broad Reach')
    cmds.push(targetCmd('Broad Reach', 103, 152, level));
  if (pos !== 'Running')
    cmds.push(targetCmd('Run', 148, 180, level));

  if (deg < 120 && pos !== 'In Irons') cmds.push(tackCmd(level));
  if (deg > 100) cmds.push(jibeCmd(level));

  if (level >= 2) {
    if (deg < 120 && pos !== 'In Irons') {
      cmds.push(tackToTargetCmd('Close Hauled', 30, 52, level));
      cmds.push(tackToTargetCmd('Beam Reach', 73, 107, level));
      if (pos !== 'Close Reach')
        cmds.push(tackToTargetCmd('Close Reach', 48, 77, level));
    }
    if (deg > 100) {
      cmds.push(jibeToTargetCmd('Broad Reach', 103, 152, level));
      cmds.push(jibeToTargetCmd('Beam Reach', 73, 107, level));
    }
  }

  return pick(cmds);
}

// ── Quiz class ────────────────────────────────────────────────

type Phase = 'idle' | 'showing' | 'result';
const PIPS_PER_LEVEL = 10;

export class Quiz {
  private phase: Phase = 'idle';
  private phaseTimer = 4;
  private score = 0;
  private pips = 0;
  private level = 1;
  private cmd: Command | null = null;
  private cmdStartAngle = 0;
  private cmdElapsed = 0;
  private holdTime = 0;
  private static HOLD_DURATION = 2;

  // DOM
  private posEl!: HTMLDivElement;
  private statsEl!: HTMLDivElement;
  private pipEls: HTMLDivElement[] = [];
  private cmdEl!: HTMLDivElement;
  private timerEl!: HTMLDivElement;
  private feedbackEl!: HTMLDivElement;

  constructor() {
    this.injectStyles();
    this.buildDOM();
    this.updatePips();
  }

  private injectStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
      #quiz-pos {
        position: fixed; top: 16px; right: 16px;
        color: #fff; font: bold 16px sans-serif;
        text-shadow: 0 1px 4px rgba(0,0,0,0.6);
        text-align: right;
      }
      #quiz-stats {
        position: fixed; top: 42px; right: 16px;
        display: flex; flex-direction: column; align-items: flex-end; gap: 6px;
      }
      .quiz-level-row {
        display: flex; align-items: center; gap: 8px;
        color: #fff; font: bold 13px sans-serif;
        text-shadow: 0 1px 3px rgba(0,0,0,0.5);
      }
      .quiz-level-label {
        min-width: 52px; text-align: right;
        opacity: 0.7;
      }
      .quiz-pips {
        display: flex; gap: 4px;
      }
      .pip {
        width: 10px; height: 10px; border-radius: 50%;
        border: 1.5px solid rgba(255,255,255,0.3);
        background: transparent;
        transition: background 0.3s, border-color 0.3s, box-shadow 0.3s;
      }
      .pip.filled {
        background: #fff;
        border-color: #fff;
        box-shadow: 0 0 4px rgba(255,255,255,0.4);
      }
      .pip.pop {
        animation: pip-pop 0.35s ease-out;
      }
      @keyframes pip-pop {
        0%   { transform: scale(1); }
        40%  { transform: scale(1.6); }
        100% { transform: scale(1); }
      }
      .quiz-score {
        color: rgba(255,255,255,0.7); font: 13px sans-serif;
        text-shadow: 0 1px 3px rgba(0,0,0,0.5);
      }
      #quiz-cmd {
        position: fixed; top: 20%; left: 50%; transform: translateX(-50%);
        color: #fff; font: bold 32px sans-serif;
        text-shadow: 0 2px 8px rgba(0,0,0,0.7);
        opacity: 0; transition: opacity 0.2s;
        pointer-events: none; white-space: nowrap;
      }
      #quiz-cmd.visible { opacity: 1; }
      #quiz-timer {
        position: fixed; top: calc(20% + 44px); left: 50%; transform: translateX(-50%);
        width: 200px; height: 4px; border-radius: 2px;
        background: rgba(255,255,255,0.2); overflow: hidden;
        opacity: 0; transition: opacity 0.2s;
        pointer-events: none;
      }
      #quiz-timer.visible { opacity: 1; }
      #quiz-timer-fill {
        height: 100%; background: #fff; border-radius: 2px;
        transition: background 0.3s;
      }
      #quiz-feedback {
        position: fixed; top: 20%; left: 50%; transform: translateX(-50%);
        font: bold 36px sans-serif;
        text-shadow: 0 2px 8px rgba(0,0,0,0.5);
        opacity: 0; transition: opacity 0.3s;
        pointer-events: none; white-space: nowrap;
      }
      .level-up-flash {
        animation: level-flash 0.6s ease-out;
      }
      @keyframes level-flash {
        0%   { transform: scale(1); color: #ffdd44; }
        50%  { transform: scale(1.3); color: #ffee88; }
        100% { transform: scale(1); }
      }
    `;
    document.head.appendChild(style);
  }

  private buildDOM(): void {
    this.posEl = this.el('quiz-pos');

    this.statsEl = this.el('quiz-stats');

    // Level row with pips
    const levelRow = document.createElement('div');
    levelRow.className = 'quiz-level-row';

    const label = document.createElement('span');
    label.className = 'quiz-level-label';
    label.textContent = 'Level 1';
    label.id = 'quiz-level-label';
    levelRow.appendChild(label);

    const pipsContainer = document.createElement('div');
    pipsContainer.className = 'quiz-pips';
    for (let i = 0; i < PIPS_PER_LEVEL; i++) {
      const pip = document.createElement('div');
      pip.className = 'pip';
      pipsContainer.appendChild(pip);
      this.pipEls.push(pip);
    }
    levelRow.appendChild(pipsContainer);
    this.statsEl.appendChild(levelRow);

    // Score
    const scoreRow = document.createElement('div');
    scoreRow.className = 'quiz-score';
    scoreRow.id = 'quiz-score-row';
    this.statsEl.appendChild(scoreRow);

    this.cmdEl = this.el('quiz-cmd');
    this.feedbackEl = this.el('quiz-feedback');

    this.timerEl = this.el('quiz-timer');
    const fill = document.createElement('div');
    fill.id = 'quiz-timer-fill';
    this.timerEl.appendChild(fill);
  }

  private el(id: string): HTMLDivElement {
    const d = document.createElement('div');
    d.id = id;
    document.body.appendChild(d);
    return d;
  }

  private updatePips(): void {
    for (let i = 0; i < PIPS_PER_LEVEL; i++) {
      const filled = i < this.pips;
      this.pipEls[i].classList.toggle('filled', filled);
    }
    const label = document.getElementById('quiz-level-label');
    if (label) label.textContent = `Level ${this.level}`;
    const scoreRow = document.getElementById('quiz-score-row');
    if (scoreRow) scoreRow.textContent = `Score: ${this.score}`;
  }

  private animatePip(index: number): void {
    const pip = this.pipEls[index];
    if (!pip) return;
    pip.classList.remove('pop');
    // Force reflow to restart animation
    void pip.offsetWidth;
    pip.classList.add('pop');
  }

  update(windAngle: number, dt: number): void {
    const pos = getPointOfSail(windAngle);
    const tack = getTack(windAngle);
    this.posEl.textContent = tack ? `${pos} — ${tack} Tack` : pos;

    switch (this.phase) {
      case 'idle':
        this.phaseTimer -= dt;
        if (this.phaseTimer <= 0) this.startCommand(windAngle);
        break;
      case 'showing':
        this.updateShowing(windAngle, dt);
        break;
      case 'result':
        this.phaseTimer -= dt;
        if (this.phaseTimer <= 0) {
          this.feedbackEl.style.opacity = '0';
          this.phase = 'idle';
          this.phaseTimer = 1.5 + Math.random();
        }
        break;
    }
  }

  private startCommand(windAngle: number): void {
    this.cmd = generateCommand(windAngle, this.level);
    this.cmdStartAngle = windAngle;
    this.cmdElapsed = 0;
    this.holdTime = 0;
    this.phase = 'showing';
    this.cmdEl.textContent = this.cmd.text;
    this.cmdEl.classList.add('visible');
    this.timerEl.classList.add('visible');
  }

  private updateShowing(windAngle: number, dt: number): void {
    if (!this.cmd) return;
    this.cmdElapsed += dt;

    const frac = Math.max(0, 1 - this.cmdElapsed / this.cmd.timeLimit);
    const fill = this.timerEl.firstElementChild as HTMLElement;
    fill.style.width = `${frac * 100}%`;
    fill.style.background = frac > 0.3 ? '#fff' : frac > 0.15 ? '#ffaa00' : '#ff4444';

    const result = this.cmd.check(this.cmdStartAngle, windAngle);

    if (result === 'correct') {
      this.holdTime += dt;
      if (this.holdTime >= Quiz.HOLD_DURATION) {
        this.finishCommand('correct');
      }
    } else {
      this.holdTime = 0;
      if (this.cmdElapsed >= this.cmd.timeLimit) {
        this.finishCommand('timeout');
      }
    }
  }

  private finishCommand(result: 'correct' | 'timeout'): void {
    this.cmdEl.classList.remove('visible');
    this.timerEl.classList.remove('visible');

    if (result === 'correct') {
      this.score++;
      this.pips = Math.min(this.pips + 1, PIPS_PER_LEVEL);
      this.animatePip(this.pips - 1);
      this.updatePips();

      if (this.pips >= PIPS_PER_LEVEL) {
        this.level++;
        this.pips = 0;
        this.updatePips();
        this.feedbackEl.textContent = `Level ${this.level}!`;
        this.feedbackEl.style.color = '#ffdd44';
        const label = document.getElementById('quiz-level-label');
        if (label) {
          label.classList.remove('level-up-flash');
          void label.offsetWidth;
          label.classList.add('level-up-flash');
        }
        this.phaseTimer = 3;
      } else {
        this.feedbackEl.textContent = 'Correct!';
        this.feedbackEl.style.color = '#44ff66';
        this.phaseTimer = 2;
      }
    } else {
      this.pips = 0;
      this.updatePips();
      this.feedbackEl.textContent = 'Too slow!';
      this.feedbackEl.style.color = '#ffaa00';
      this.phaseTimer = 2;
    }

    this.feedbackEl.style.opacity = '1';
    this.phase = 'result';
  }
}
