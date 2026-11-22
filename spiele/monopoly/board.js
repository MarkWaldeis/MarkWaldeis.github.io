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
    `translate3d(${x}px, ${y - lift}px, 0) translate(-50%, -68%) scale(${scale})`;

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
      let duration = 0;
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
          node.innerHTML = '<span>' + icons[ti] + '</span>';
          pieceLayer.append(node);
          piece = { node, target };
          pieces.set(pid, piece);
        }
        piece.node.classList.toggle('is-active', pid === active);
        piece.node.style.transform = translate(...target);
        if (motion?.pid === pid && motion.steps?.length) {
          piece.animation?.cancel();
          const steps = motion.steps;
          const frames = [{ transform: translate(...piece.target) }];
          let from = piece.target;
          for (const [i, step] of steps.entries()) {
            const to = i === steps.length - 1 ? target : point(step.space);
            frames.push({
              transform: translate((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, step.jump ? 28 : 13, step.jump ? 1.32 : 1.12)
            }, { transform: translate(...to) });
            from = to;
          }
          const travel = Math.max(250, steps.length * 76);
          piece.animation = piece.node.animate(frames, { duration: travel, delay, fill: 'backwards', easing: 'ease-in-out' });
          duration = delay + travel;
        }
        piece.target = target;
      });
      return duration;
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
      const duration = drawPieces(state, motion, delay);

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
      return Math.max(delay, duration);
    }

    new ResizeObserver(() => {
      if (board.offsetWidth && current) drawPieces(current, null, 0);
    }).observe(board);

    function reset() {
      for (const piece of pieces.values()) piece.animation?.cancel();
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

    return { update, reset };
  }

  return { create };
})();
