const BOARD_SIZE = 19;
const DEFAULT_KOMI = 7.5;
const DIRECTIONS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function createBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
}

function cloneBoard(board) {
  return board.map((row) => [...row]);
}

function inBounds(x, y) {
  return Number.isInteger(x)
    && Number.isInteger(y)
    && x >= 0
    && y >= 0
    && x < BOARD_SIZE
    && y < BOARD_SIZE;
}

function otherColor(color) {
  return color === 'B' ? 'W' : 'B';
}

function serializeBoard(board) {
  return board
    .map((row) => row.map((value) => value ?? '.').join(''))
    .join('/');
}

function toPointKey(point) {
  return `${point.x},${point.y}`;
}

function getGroup(board, x, y) {
  const color = board[y]?.[x] ?? null;
  if (!color) {
    return { stones: [], liberties: new Set() };
  }

  const queue = [{ x, y }];
  const visited = new Set([toPointKey({ x, y })]);
  const stones = [];
  const liberties = new Set();

  while (queue.length > 0) {
    const current = queue.pop();
    if (!current) break;
    stones.push(current);

    for (const [dx, dy] of DIRECTIONS) {
      const nextX = current.x + dx;
      const nextY = current.y + dy;
      if (!inBounds(nextX, nextY)) continue;
      const value = board[nextY][nextX];
      if (value === null) {
        liberties.add(toPointKey({ x: nextX, y: nextY }));
        continue;
      }
      if (value !== color) continue;
      const key = toPointKey({ x: nextX, y: nextY });
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push({ x: nextX, y: nextY });
    }
  }

  return { stones, liberties };
}

function removeGroup(board, stones) {
  for (const stone of stones) {
    board[stone.y][stone.x] = null;
  }
}

function floodEmpty(board, startX, startY, seen) {
  const queue = [{ x: startX, y: startY }];
  const territory = [];
  const borderingColors = new Set();
  const startKey = toPointKey({ x: startX, y: startY });
  seen.add(startKey);

  while (queue.length > 0) {
    const current = queue.pop();
    if (!current) break;
    territory.push(current);

    for (const [dx, dy] of DIRECTIONS) {
      const nextX = current.x + dx;
      const nextY = current.y + dy;
      if (!inBounds(nextX, nextY)) continue;
      const value = board[nextY][nextX];
      if (value === null) {
        const key = toPointKey({ x: nextX, y: nextY });
        if (seen.has(key)) continue;
        seen.add(key);
        queue.push({ x: nextX, y: nextY });
        continue;
      }
      borderingColors.add(value);
    }
  }

  return { territory, borderingColors };
}

function scoreBoard(board, komi) {
  let blackStones = 0;
  let whiteStones = 0;

  for (const row of board) {
    for (const value of row) {
      if (value === 'B') blackStones += 1;
      if (value === 'W') whiteStones += 1;
    }
  }

  let blackTerritory = 0;
  let whiteTerritory = 0;
  const seen = new Set();

  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      if (board[y][x] !== null) continue;
      const key = toPointKey({ x, y });
      if (seen.has(key)) continue;
      const region = floodEmpty(board, x, y, seen);
      if (region.borderingColors.size !== 1) continue;
      const owner = Array.from(region.borderingColors)[0];
      if (owner === 'B') blackTerritory += region.territory.length;
      if (owner === 'W') whiteTerritory += region.territory.length;
    }
  }

  const blackScore = blackStones + blackTerritory;
  const whiteScore = whiteStones + whiteTerritory + komi;
  const winner = blackScore > whiteScore ? 'B' : 'W';

  return {
    blackScore,
    whiteScore,
    winner,
    margin: Math.abs(blackScore - whiteScore),
    breakdown: {
      blackStones,
      whiteStones,
      blackTerritory,
      whiteTerritory,
      komi,
    },
  };
}

function createSnapshot(state) {
  return {
    boardSize: BOARD_SIZE,
    board: cloneBoard(state.board),
    currentPlayer: state.currentPlayer,
    captures: { ...state.captures },
    moves: state.moves.map((move) => ({ ...move })),
    finished: state.finished,
    consecutivePasses: state.consecutivePasses,
    komi: state.komi,
    result: state.result
      ? {
        ...state.result,
        score: { ...state.result.score, breakdown: { ...state.result.score.breakdown } },
      }
      : null,
  };
}

export function createGoGame(options = {}) {
  const state = {
    board: createBoard(),
    currentPlayer: 'B',
    captures: {
      black: 0,
      white: 0,
    },
    moves: [],
    finished: false,
    consecutivePasses: 0,
    komi: typeof options.komi === 'number' ? options.komi : DEFAULT_KOMI,
    result: null,
    koPoint: null,
  };

  function assertActive() {
    if (state.finished) {
      throw new Error('game already finished');
    }
  }

  function assertTurn(color) {
    if (color !== state.currentPlayer) {
      throw new Error('not your turn');
    }
  }

  function finalizeGame() {
    const score = scoreBoard(state.board, state.komi);
    state.finished = true;
    state.result = {
      winner: score.winner,
      reason: 'double_pass',
      score,
    };
  }

  function play(color, point) {
    assertActive();
    assertTurn(color);

    if (!point || !inBounds(point.x, point.y)) {
      throw new Error('point out of bounds');
    }
    if (state.board[point.y][point.x] !== null) {
      throw new Error('occupied point');
    }
    if (state.koPoint && state.koPoint.x === point.x && state.koPoint.y === point.y) {
      throw new Error('ko violation');
    }

    const board = cloneBoard(state.board);
    board[point.y][point.x] = color;

    const captured = [];
    for (const [dx, dy] of DIRECTIONS) {
      const nextX = point.x + dx;
      const nextY = point.y + dy;
      if (!inBounds(nextX, nextY)) continue;
      if (board[nextY][nextX] !== otherColor(color)) continue;
      const group = getGroup(board, nextX, nextY);
      if (group.liberties.size !== 0) continue;
      captured.push(...group.stones);
      removeGroup(board, group.stones);
    }

    const ownGroup = getGroup(board, point.x, point.y);
    if (ownGroup.liberties.size === 0) {
      throw new Error('suicide move');
    }

    state.board = board;
    state.moves.push({
      type: 'play',
      color,
      x: point.x,
      y: point.y,
    });
    state.consecutivePasses = 0;
    state.currentPlayer = otherColor(color);
    state.koPoint = captured.length === 1 && ownGroup.stones.length === 1
      ? { x: captured[0].x, y: captured[0].y }
      : null;

    if (captured.length > 0) {
      if (color === 'B') {
        state.captures.black += captured.length;
      } else {
        state.captures.white += captured.length;
      }
    }

    return createSnapshot(state);
  }

  function pass(color) {
    assertActive();
    assertTurn(color);

    state.moves.push({
      type: 'pass',
      color,
    });
    state.consecutivePasses += 1;
    state.currentPlayer = otherColor(color);
    state.koPoint = null;

    if (state.consecutivePasses >= 2) {
      finalizeGame();
    }

    return createSnapshot(state);
  }

  function load(moves) {
    for (const move of moves ?? []) {
      if (move?.type === 'pass') {
        pass(move.color);
        continue;
      }
      play(move.color, { x: move.x, y: move.y });
    }
    return api;
  }

  const api = {
    play,
    pass,
    load,
    snapshot: () => createSnapshot(state),
  };

  return api;
}
