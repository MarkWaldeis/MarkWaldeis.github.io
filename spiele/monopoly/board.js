'use strict';

const MonoBoard = (() => {
  const PIPS = [[], [4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]];
  const ROTATION = [[0, 0], [0, 0], [0, -90], [-90, 0], [90, 0], [0, 90], [0, 180]];
  const ICON = { bahn: '🚂', tax: '€', chance: '?', community: '📦', free: 'P', go: '←', gotojail: '↪', jail: '🔒' };
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const faceMarkup = PIPS.slice(1).map((pips, i) =>
    `<div class="die-face face-${i + 1}"><div class="pipgrid">${Array.from({ length: 9 }, (_, j) =>
      `<span class="pip${pips.includes(j) ? ' on' : ''}"></span>`).join('')}</div></div>`
  ).join('');

  function gridPosition(i) {
    if (i <= 9) return [11, 11 - i, 'top'];
    if (i <= 19) return [21 - i, 1, 'right'];
    if (i <= 29) return [1, i - 19, 'bottom'];
    return [i - 29, 11, 'left'];
  }

  const rotate = (x, y) => `rotateX(${x}deg) rotateY(${y}deg)`;
  const translate = (x, y, lift = 0, scale = 1) =>
    `translate3d(${x}px, ${y - lift}px, 0) translate(-50%, -86%) scale(${scale})`;
  const STEP_MS = 76;         // Dauer pro Feld beim Laufen
  const CARD_PAUSE = 1600;    // Karte kurz zeigen, dann weiterlaufen
  // Richtungszeilen im Sprite: 0=Süden,1=Westen,2=Norden,3=Osten
  const dirOf = (dx, dy) => Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 3 : 1) : (dy > 0 ? 0 : 2);

  function create(engine, icons, colors, onSelect) {
    const board = document.getElementById('board');
    const diceRow = document.getElementById('dice-row');
    const result = document.getElementById('dice-result');
    const pieceLayer = document.createElement('div');
    pieceLayer.className = 'piece-layer';
    pieceLayer.setAttribute('aria-hidden', 'true');
    board.append(pieceLayer);
    const cells = engine.S.map((space, index) => {
      const [row, column, edge] = gridPosition(index);
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = `space t-${space.t} edge-${edge}${index % 10 === 0 ? ' corner c-' + space.t : ''}`;
      cell.style.gridArea = row + ' / ' + column;
      cell.setAttribute('aria-label', space.name);
      const icon = index === 12 ? '💡' : index === 27 ? '🚰' : ICON[space.t];
      const price = space.price || space.amount;
      cell.innerHTML = `
        ${space.group ? `<span class="colorbar" style="background:${engine.GROUP_CSS[space.group]}"></span>` : ''}
        <span class="s-name"></span>
        ${price ? `<span class="s-price">${price} €</span>` : ''}
        ${icon ? `<span class="s-icon" aria-hidden="true">${icon}</span>` : ''}
        <span class="s-houses" aria-hidden="true"></span><span class="s-owner" aria-hidden="true"></span>`;
      cell.querySelector('.s-name').textContent = space.name;
      cell.addEventListener('click', () => onSelect(index));
      board.append(cell);
      return { cell, houses: cell.querySelector('.s-houses'), owner: cell.querySelector('.s-owner') };
    });
    const dice = [document.getElementById('die1'), document.getElementById('die2')].map(shell => {
      shell.innerHTML = '<div class="die-cube" aria-hidden="true">' + faceMarkup + '</div>';
      return { shell, cube: shell.firstElementChild, value: 1 };
    });
    const pieces = new Map();
    let previousRoll = null;
    let current = null;
    let highlighted = null;

    function point(space, slot = 0, count = 1) {
      const cell = cells[space]?.cell;
      if (!cell) return [0, 0];
      const columns = Math.min(3, count);
      const column = slot % columns, row = Math.floor(slot / columns);
      return [
        cell.offsetLeft + cell.offsetWidth * (.5 + (column - (columns - 1) / 2) * .23),
        cell.offsetTop + cell.offsetHeight * (count > 3 ? .37 + row * .38 : .58)
      ];
    }

    function locations(state) {
      const stacks = new Map();
      for (const pid of state.order) {
        if (state.out[pid]) continue;
        const space = state.pos[pid];
        if (!stacks.has(space)) stacks.set(space, []);
        stacks.get(space).push(pid);
      }
      return stacks;
    }

    function drawPieces(state, motion, delay) {
      let duration = 0, cardAt = null;
      const active = state.order[state.turn];
      const stacks = locations(state);
      state.order.forEach((pid, index) => {
        let piece = pieces.get(pid);
        if (state.out[pid]) {
          piece?.node.remove();
          pieces.delete(pid);
          return;
        }
        const space = state.pos[pid];
        const stack = stacks.get(space);
        const target = point(space, stack.indexOf(pid), stack.length);
        const ti = Number.isInteger(state.players?.[pid]?.token) ? state.players[pid].token : index;
        if (!piece) {
          const node = document.createElement('span');
          node.className = 'piece';
          node.style.setProperty('--piece-color', colors[ti]);
          node.style.setProperty('--dir', 0);
          node.innerHTML = `<span class="emoji">${icons[ti]}</span><span class="fig" style="background-image:url('figs/fig-${ti}.png')"></span><span class="shadow"></span>`;
          pieceLayer.append(node);
          piece = { node, target, timers: [] };
          pieces.set(pid, piece);
        }
        piece.node.classList.toggle('is-active', pid === active);
        piece.node.style.transform = translate(...target);
        const steps = motion?.pid === pid ? (motion.steps || []) : [];
        const cardSteps = motion?.pid === pid ? (motion.cardSteps || []) : [];
        if (steps.length || cardSteps.length) {
          piece.animation?.cancel();
          piece.cardAnim?.cancel();
          piece.timers.forEach(clearTimeout);
          piece.timers = [];
          const segs = [];
          let t = delay;
          if (steps.length) {
            const travel = Math.max(250, steps.length * STEP_MS);
            segs.push({ steps, at: delay, per: travel / steps.length });
            t = delay + travel;
          }
          if (cardSteps.length) {
            cardAt = t;
            const at = t + CARD_PAUSE;
            const travel = Math.max(250, cardSteps.length * STEP_MS);
            segs.push({ steps: cardSteps, at, per: travel / cardSteps.length });
            t = at + travel;
          }
          let from = piece.target;
          for (const [si, seg] of segs.entries()) {
            const last = si === segs.length - 1;
            const frames = [{ transform: translate(...from) }];
            seg.steps.forEach((step, i) => {
              const to = last && i === seg.steps.length - 1 ? target : point(step.space);
              const mid = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
              frames.push({ transform: translate(mid[0], mid[1], step.jump ? 28 : 13, step.jump ? 1.3 : 1.1) },
                { transform: translate(...to) });
              piece.timers.push(setTimeout(() =>
                piece.node.style.setProperty('--dir', dirOf(to[0] - from[0], to[1] - from[1])), seg.at + i * seg.per));
              from = to;
            });
            const anim = piece.node.animate(frames,
              { duration: seg.steps.length * seg.per, delay: seg.at, fill: 'backwards', easing: 'ease-in-out' });
            if (si === 0) piece.animation = anim; else piece.cardAnim = anim;
          }
          piece.node.classList.add('running');
          piece.timers.push(setTimeout(() => piece.node.classList.remove('running'), t));
          duration = Math.max(duration, t);
        }
        piece.target = target;
      });
      return { duration, cardAt };
    }

    function drawDice(values, animate) {
      const duration = 590;
      diceRow.classList.toggle('unrolled', !values);
      diceRow.setAttribute('aria-label', values ? `Gewürfelt: ${values[0]} und ${values[1]}` : 'Noch nicht gewürfelt');
      result.textContent = values ? `${values[0]} + ${values[1]} = ${values[0] + values[1]}` : '';
      if (animate) result.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, delay: duration - 70, fill: 'backwards' });
      for (const [index, die] of dice.entries()) {
        const next = values?.[index] || 1;
        const [x, y] = ROTATION[next];
        die.cube.style.transform = rotate(x, y);
        if (animate) {
          die.spin?.cancel();
          die.toss?.cancel();
          const direction = index === 0 ? 1 : -1;
          die.spin = die.cube.animate([
            { transform: rotate(...ROTATION[die.value]) },
            { transform: rotate(x + 720, y + direction * 720) }
          ], { duration, easing: 'cubic-bezier(.18,.65,.37,1)' });
          die.toss = die.shell.animate([
            { transform: 'translate3d(0,0,0) scale(1)' },
            { transform: `translate3d(${direction * 12}px,-25px,24px) scale(1.12)`, offset: .38 },
            { transform: 'translate3d(0,0,0) scale(1)', offset: .77 },
            { transform: 'translate3d(0,-5px,0) scale(1)', offset: .89 },
            { transform: 'translate3d(0,0,0) scale(1)' }
          ], { duration, easing: 'ease-out' });
        }
        die.value = next;
      }
      return animate ? duration : 0;
    }

    function update(state) {
      const key = state.rollSeq ?? state.dice?.join('-') ?? '';
      const rolled = previousRoll !== null && key !== previousRoll && !!state.dice;
      const animate = rolled && !reducedMotion.matches && !document.hidden;
      previousRoll = key;
      const delay = drawDice(state.dice, animate);
      const motion = animate ? state.motion : null;
      current = state;
      const drawn = drawPieces(state, motion, delay);
      const duration = drawn.duration, cardAt = drawn.cardAt;

      for (const [index, item] of cells.entries()) {
        const prop = state.props[index];
        const ownerIndex = prop?.owner ? state.order.indexOf(prop.owner) : -1;
        const signature = `${ownerIndex}/${prop?.houses || 0}/${!!prop?.mortgaged}`;
        if (item.signature === signature) continue;
        item.signature = signature;
        item.owner.style.setProperty('--owner-color', colors[ownerIndex] || 'transparent');
        item.owner.classList.toggle('owned', ownerIndex >= 0);
        item.cell.classList.toggle('mortgaged', !!prop?.mortgaged);
        item.houses.innerHTML = prop?.houses === 5 ? '<span class="hotel"></span>' :
          '<span class="house"></span>'.repeat(prop?.houses || 0);
        if (item.houses.children.length && !reducedMotion.matches) {
          item.houses.animate([{ transform: 'translateY(-7px)', opacity: .3 }, { transform: 'none', opacity: 1 }], 230);
        }
      }

      const activeSpace = state.pos[state.order[state.turn]];
      if (highlighted !== activeSpace || rolled) {
        cells[highlighted]?.cell.classList.remove('active-space');
        const cell = cells[activeSpace]?.cell;
        cell?.classList.add('active-space');
        if (animate) cell?.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(1.24)' }, { filter: 'brightness(1)' }],
          { duration: 460, delay: duration || delay });
        highlighted = activeSpace;
      }
      return { duration: Math.max(delay, duration), cardAt };
    }

    new ResizeObserver(() => {
      if (board.offsetWidth && current) drawPieces(current, null, 0);
    }).observe(board);

    // Position einer Figur in Board-Pixeln (für Effekte), sonst null
    function piecePoint(pid) {
      const piece = pieces.get(pid);
      if (!piece) return null;
      return [piece.target[0], piece.target[1]];
    }

    function reset() {
      for (const piece of pieces.values()) {
        piece.animation?.cancel();
        piece.cardAnim?.cancel();
        piece.timers?.forEach(clearTimeout);
        piece.timers = [];
      }
      for (const die of dice) {
        die.spin?.cancel();
        die.toss?.cancel();
      }
      pieces.clear();
      pieceLayer.replaceChildren();
      cells[highlighted]?.cell.classList.remove('active-space');
      highlighted = null;
      previousRoll = null;
      current = null;
    }

    return { update, reset, piecePoint };
  }

  return { create };
})();
