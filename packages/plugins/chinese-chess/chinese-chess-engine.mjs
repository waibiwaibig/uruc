import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { xiangqi } = require('xiangqii');

export const DEFAULT_POSITION_FEN = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1';

const FILES = 'abcdefghi';
const NUMERIC_TO_FEN = {
  0: null,
  1: 'P',
  2: 'A',
  3: 'B',
  4: 'N',
  5: 'C',
  6: 'R',
  7: 'K',
  8: 'p',
  9: 'a',
  10: 'b',
  11: 'n',
  12: 'c',
  13: 'r',
  14: 'k',
  15: null,
};
const FEN_TO_DISPLAY = {
  K: '帅',
  A: '仕',
  B: '相',
  N: '马',
  R: '车',
  C: '炮',
  P: '兵',
  k: '将',
  a: '士',
  b: '象',
  n: '马',
  r: '车',
  c: '炮',
  p: '卒',
};
const HORSE_PIECES = new Set(['N', 'n', 'B', 'b', 'A', 'a']);
const CHINESE_NUMERALS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

function createRawEngine(positionFen = DEFAULT_POSITION_FEN) {
  const engine = xiangqi();
  engine.setBoard(positionFen);
  return engine;
}

function sideFromEngine(engine) {
  return engine.getSide() === engine.COLOR.RED ? 'red' : 'black';
}

function oppositeSide(side) {
  return side === 'red' ? 'black' : 'red';
}

function fileToPerspectiveDigit(fileChar, side) {
  const fileIndex = FILES.indexOf(fileChar);
  if (fileIndex < 0) return '';
  const digit = side === 'red' ? 9 - fileIndex : fileIndex + 1;
  return CHINESE_NUMERALS[digit] ?? String(digit);
}

function coordToSquareIndex(coord) {
  const fileIndex = FILES.indexOf(coord[0]);
  const rank = Number.parseInt(coord.slice(1), 10);
  if (fileIndex < 0 || Number.isNaN(rank) || rank < 0 || rank > 9) {
    throw new Error(`Invalid coordinate: ${coord}`);
  }
  return 23 + (9 - rank) * 11 + fileIndex;
}

function boardMapFromEngine(engine) {
  const entries = new Map();
  for (let rank = 9; rank >= 0; rank -= 1) {
    for (let fileIndex = 0; fileIndex < FILES.length; fileIndex += 1) {
      const coord = `${FILES[fileIndex]}${rank}`;
      const piece = NUMERIC_TO_FEN[engine.getPiece(coordToSquareIndex(coord))] ?? null;
      entries.set(coord, piece);
    }
  }
  return entries;
}

function positionFenFromBoard(boardMap, sideToMove) {
  const ranks = [];
  for (let rank = 9; rank >= 0; rank -= 1) {
    let empty = 0;
    let line = '';
    for (let fileIndex = 0; fileIndex < FILES.length; fileIndex += 1) {
      const coord = `${FILES[fileIndex]}${rank}`;
      const piece = boardMap.get(coord);
      if (!piece) {
        empty += 1;
        continue;
      }
      if (empty > 0) {
        line += String(empty);
        empty = 0;
      }
      line += piece;
    }
    if (empty > 0) {
      line += String(empty);
    }
    ranks.push(line);
  }
  return `${ranks.join('/')} ${sideToMove === 'red' ? 'w' : 'b'} - - 0 1`;
}

function moveDisplay(boardMap, iccs, side) {
  const from = iccs.slice(0, 2);
  const to = iccs.slice(2);
  const piece = boardMap.get(from);
  if (!piece) return iccs;
  const fromFile = fileToPerspectiveDigit(from[0], side);
  const toFile = fileToPerspectiveDigit(to[0], side);
  const rankDelta = side === 'red'
    ? Number.parseInt(to[1], 10) - Number.parseInt(from[1], 10)
    : Number.parseInt(from[1], 10) - Number.parseInt(to[1], 10);

  let action = '平';
  let suffix = toFile;
  if (from[0] === to[0]) {
    action = rankDelta > 0 ? '进' : '退';
    suffix = CHINESE_NUMERALS[Math.abs(rankDelta)] ?? String(Math.abs(rankDelta));
  } else if (HORSE_PIECES.has(piece)) {
    action = rankDelta >= 0 ? '进' : '退';
    suffix = toFile;
  }

  return `${FEN_TO_DISPLAY[piece] ?? piece}${fromFile}${action}${suffix}`;
}

function legalMovesFromEngine(engine) {
  const boardMap = boardMapFromEngine(engine);
  const side = sideFromEngine(engine);
  return engine.generateLegalMoves().map((entry) => {
    const iccs = engine.moveToString(entry.move);
    const from = iccs.slice(0, 2);
    const to = iccs.slice(2);
    return {
      iccs,
      from,
      to,
      display: moveDisplay(boardMap, iccs, side),
      isCapture: Boolean(boardMap.get(to)),
    };
  });
}

function resultFromEngine(engine, legalMoves) {
  if (legalMoves.length > 0) return null;
  const side = sideFromEngine(engine);
  const inCheck = Boolean(engine.inCheck(side === 'red' ? engine.COLOR.RED : engine.COLOR.BLACK));
  if (inCheck) {
    return {
      result: side === 'red' ? 'black_win' : 'red_win',
      reason: 'checkmate',
    };
  }
  return {
    result: 'draw',
    reason: 'stalemate',
  };
}

function normalizeMoveRecord(input, boardMap, side, legalMove) {
  const iccs = typeof input === 'string' ? input : input.iccs;
  const from = iccs.slice(0, 2);
  const to = iccs.slice(2);
  return {
    iccs,
    from,
    to,
    display:
      (typeof input === 'object' && input?.display) ||
      legalMove?.display ||
      moveDisplay(boardMap, iccs, side),
    isCapture:
      (typeof input === 'object' && typeof input?.isCapture === 'boolean' ? input.isCapture : undefined) ??
      legalMove?.isCapture ??
      Boolean(boardMap.get(to)),
  };
}

export function createChineseChessEngine(options = {}) {
  const engine = createRawEngine(options.positionFen ?? DEFAULT_POSITION_FEN);
  const moveHistory = [];

  for (const rawMove of options.moveHistory ?? []) {
    const boardMap = boardMapFromEngine(engine);
    const side = sideFromEngine(engine);
    const iccs = typeof rawMove === 'string' ? rawMove : rawMove.iccs;
    const legalMoves = legalMovesFromEngine(engine);
    const legalMove = legalMoves.find((move) => move.iccs === iccs);
    if (!legalMove) {
      throw new Error(`Illegal replay move: ${iccs}`);
    }
    const parsed = engine.moveFromString(iccs);
    if (!parsed) {
      throw new Error(`Invalid replay move: ${iccs}`);
    }
    engine.makeMove(parsed);
    moveHistory.push(normalizeMoveRecord(rawMove, boardMap, side, legalMove));
  }

  return {
    snapshot() {
      const boardMap = boardMapFromEngine(engine);
      const sideToMove = sideFromEngine(engine);
      const legalMoves = legalMovesFromEngine(engine);
      return {
        board: Object.fromEntries(boardMap),
        positionFen: positionFenFromBoard(boardMap, sideToMove),
        sideToMove,
        inCheck: Boolean(engine.inCheck(sideToMove === 'red' ? engine.COLOR.RED : engine.COLOR.BLACK)),
        legalMoves,
        moveHistory: [...moveHistory],
        result: resultFromEngine(engine, legalMoves),
      };
    },
    play(iccs) {
      const boardMap = boardMapFromEngine(engine);
      const side = sideFromEngine(engine);
      const legalMoves = legalMovesFromEngine(engine);
      const legalMove = legalMoves.find((move) => move.iccs === iccs);
      if (!legalMove) {
        throw new Error(`Illegal move: ${iccs}`);
      }
      const parsed = engine.moveFromString(iccs);
      if (!parsed) {
        throw new Error(`Invalid move: ${iccs}`);
      }
      engine.makeMove(parsed);
      const record = normalizeMoveRecord(iccs, boardMap, side, legalMove);
      moveHistory.push(record);
      return record;
    },
  };
}
