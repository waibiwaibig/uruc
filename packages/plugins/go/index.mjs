import { randomUUID } from 'crypto';
import { createGoGame } from './go-engine.mjs';

const PLUGIN_ID = 'uruc.go';
const GO_LOCATION_ID = 'go-club';
const PUBLIC_LOCATION_ID = `${PLUGIN_ID}.${GO_LOCATION_ID}`;
const INITIAL_RATING = 1500;
const K_FACTOR = 40;
const INITIAL_TIME_MS = 10 * 60 * 1000;
const TURN_REMINDER_MS = 20 * 1000;
const RECONNECT_GRACE_MS = 60 * 1000;
const DEFAULT_KOMI = 7.5;

const COMMAND_IDS = Object.freeze({
  bootstrap: `${PLUGIN_ID}.bootstrap@v1`,
  listMatches: `${PLUGIN_ID}.list_matches@v1`,
  listRooms: `${PLUGIN_ID}.list_rooms@v1`,
  createMatch: `${PLUGIN_ID}.create_match@v1`,
  joinMatch: `${PLUGIN_ID}.join_match@v1`,
  watchRoom: `${PLUGIN_ID}.watch_room@v1`,
  unwatchRoom: `${PLUGIN_ID}.unwatch_room@v1`,
  leaveMatch: `${PLUGIN_ID}.leave_match@v1`,
  ready: `${PLUGIN_ID}.ready@v1`,
  unready: `${PLUGIN_ID}.unready@v1`,
  move: `${PLUGIN_ID}.move@v1`,
  pass: `${PLUGIN_ID}.pass@v1`,
  resign: `${PLUGIN_ID}.resign@v1`,
  state: `${PLUGIN_ID}.state@v1`,
  rating: `${PLUGIN_ID}.rating@v1`,
  leaderboard: `${PLUGIN_ID}.leaderboard@v1`,
});

const disconnectTimers = new Map();
const turnTimers = new Map();
const turnReminderTimers = new Map();
const watchedRooms = new Map();
const roomAccessGrants = new Map();

function now() {
  return Date.now();
}

function createError(error, code, action, details) {
  const value = new Error(error);
  value.code = code;
  value.action = action;
  value.details = details;
  return value;
}

function normalizeVisibility(value) {
  return value === 'private' ? 'private' : 'public';
}

function normalizeRoomName(value, fallback) {
  const next = typeof value === 'string' ? value.trim() : '';
  return next !== '' ? next.slice(0, 80) : fallback;
}

function defaultRoomName(agentName, matchId) {
  const label = typeof agentName === 'string' && agentName.trim() !== '' ? agentName.trim() : 'Agent';
  return `${label} room ${matchId}`;
}

function requireSession(runtimeCtx) {
  if (!runtimeCtx.session) {
    throw createError('Authenticate your agent first.', 'NOT_AUTHENTICATED', 'auth');
  }
  return runtimeCtx.session;
}

function playerPublicState(player) {
  return {
    agentId: player.agentId,
    userId: player.userId,
    agentName: player.agentName,
    color: player.color,
    ready: player.ready,
    connected: player.connected,
    disconnectDeadlineAt: player.disconnectDeadlineAt,
  };
}

function recordWithMoveNumber(moves) {
  return (moves ?? []).map((move, index) => ({
    ...move,
    moveNumber: index + 1,
  }));
}

function replayMatch(match) {
  const game = createGoGame({ komi: match.komi ?? DEFAULT_KOMI });
  game.load(match.moves ?? []);
  return game;
}

function currentTurn(match) {
  return replayMatch(match).snapshot().currentPlayer;
}

function otherColor(color) {
  return color === 'B' ? 'W' : 'B';
}

function resultTypeForWinner(color) {
  return color === 'B' ? 'black_win' : 'white_win';
}

function getPlayer(match, agentId) {
  const player = match.players.find((entry) => entry.agentId === agentId);
  if (!player) {
    throw createError('You are not part of this match.', 'MATCH_NOT_FOUND');
  }
  return player;
}

function remainingMsForColor(match, color) {
  const key = color === 'B' ? 'blackMs' : 'whiteMs';
  if (match.phase !== 'playing' || match.turnStartedAt === null || currentTurn(match) !== color) {
    return match.clocks[key];
  }
  return Math.max(0, match.clocks[key] - Math.max(0, now() - match.turnStartedAt));
}

function matchSummary(ctx, match) {
  return {
    matchId: match.matchId,
    roomName: match.roomName,
    visibility: match.visibility,
    phase: match.phase,
    playerCount: match.players.length,
    seatsRemaining: Math.max(0, 2 - match.players.length),
    readyCount: match.players.filter((player) => player.ready).length,
    spectatorCount: getSpectatorCount(ctx, match),
    players: match.players.map((player) => ({
      agentId: player.agentId,
      agentName: player.agentName,
      ready: player.ready,
      connected: player.connected,
    })),
    createdAt: match.createdAt,
  };
}

function buildMatchState(match, viewerAgentId) {
  const snapshot = replayMatch(match).snapshot();
  const viewer = match.players.find((player) => player.agentId === viewerAgentId);
  return {
    matchId: match.matchId,
    roomName: match.roomName,
    visibility: match.visibility,
    phase: match.phase,
    seq: match.seq,
    serverTimestamp: now(),
    moveCount: snapshot.moves.length,
    board: snapshot.board,
    turn: match.phase === 'playing' && !snapshot.finished ? snapshot.currentPlayer : null,
    komi: match.komi ?? DEFAULT_KOMI,
    captures: {
      black: snapshot.captures.black,
      white: snapshot.captures.white,
    },
    consecutivePasses: snapshot.consecutivePasses,
    clocks: match.clocks,
    players: match.players.map(playerPublicState),
    yourAgentId: viewer?.agentId,
    yourColor: viewer?.color ?? null,
    result: match.result,
    legalMoves: [],
    record: recordWithMoveNumber(snapshot.moves),
  };
}

function isJoinableWaitingRoom(match) {
  return match.visibility === 'public' && match.phase === 'waiting' && match.players.length < 2;
}

function isPublicRoomDirectoryEntry(match) {
  return match.visibility === 'public' && (match.phase === 'waiting' || match.phase === 'playing');
}

function grantRoomAccess(agentId, matchId) {
  if (!agentId || !matchId) return;
  const current = roomAccessGrants.get(agentId) ?? new Set();
  current.add(matchId);
  roomAccessGrants.set(agentId, current);
}

function hasRoomAccess(agentId, matchId) {
  if (!agentId || !matchId) return false;
  return roomAccessGrants.get(agentId)?.has(matchId) ?? false;
}

function clearRoomAccess(agentId, matchId) {
  if (!agentId) return;
  if (!matchId) {
    roomAccessGrants.delete(agentId);
    return;
  }
  const current = roomAccessGrants.get(agentId);
  if (!current) return;
  current.delete(matchId);
  if (current.size === 0) {
    roomAccessGrants.delete(agentId);
  }
}

function getWatchedRoomId(agentId) {
  return watchedRooms.get(agentId) ?? null;
}

function getSpectatorAgentIds(ctx, match) {
  const online = new Set(ctx.messaging.getOnlineAgentIds());
  const playerIds = new Set(match.players.map((player) => player.agentId));
  return Array.from(watchedRooms.entries())
    .filter(([agentId, matchId]) => matchId === match.matchId && online.has(agentId) && !playerIds.has(agentId))
    .map(([agentId]) => agentId);
}

function getSpectatorCount(ctx, match) {
  return getSpectatorAgentIds(ctx, match).length;
}

function canAccessMatch(match, agentId) {
  if (!match || !agentId) return false;
  if (match.players.some((player) => player.agentId === agentId)) return true;
  if (hasRoomAccess(agentId, match.matchId)) return true;
  if (getWatchedRoomId(agentId) === match.matchId) return true;
  return isPublicRoomDirectoryEntry(match);
}

function canWatchMatch(match, agentId) {
  if (!match || !agentId) return false;
  if (match.players.some((player) => player.agentId === agentId)) return true;
  if (match.visibility === 'private') {
    return hasRoomAccess(agentId, match.matchId);
  }
  return isPublicRoomDirectoryEntry(match) || hasRoomAccess(agentId, match.matchId);
}

function canJoinMatch(match, agentId) {
  if (!match || !agentId || match.phase !== 'waiting') return false;
  if (match.visibility === 'private' && !hasRoomAccess(agentId, match.matchId) && !match.players.some((player) => player.agentId === agentId)) {
    return false;
  }
  return true;
}

function ensureHallOrMatch(runtimeCtx, match) {
  if (runtimeCtx.currentLocation === PUBLIC_LOCATION_ID || match) {
    return;
  }
  throw createError(`Enter uruc-go with enter_location and locationId "${PUBLIC_LOCATION_ID}".`, 'NOT_IN_GO_LOCATION', 'enter_location', {
    locationId: PUBLIC_LOCATION_ID,
  });
}

async function listCollection(ctx, collection) {
  const records = await ctx.storage.list(collection);
  return records.map((record) => record.value).filter(Boolean);
}

async function getMatch(ctx, matchId) {
  return await ctx.storage.get('matches', matchId);
}

async function saveMatch(ctx, match) {
  match.updatedAt = now();
  await ctx.storage.put('matches', match.matchId, match);
}

async function deleteMatch(ctx, matchId) {
  clearTurnTimer(matchId);
  clearTurnReminderTimer(matchId);
  await ctx.storage.delete('matches', matchId);
}

async function getAgentMatchId(ctx, agentId) {
  const link = await ctx.storage.get('agent-match', agentId);
  return link?.matchId ?? null;
}

async function setAgentMatchId(ctx, agentId, matchId) {
  await ctx.storage.put('agent-match', agentId, { matchId, updatedAt: now() });
}

async function clearAgentMatchId(ctx, agentId) {
  await ctx.storage.delete('agent-match', agentId);
}

async function getCurrentMatch(ctx, agentId) {
  const matchId = await getAgentMatchId(ctx, agentId);
  if (!matchId) return null;
  return await getMatch(ctx, matchId);
}

async function getOrCreateRating(ctx, agentId, userId, agentName) {
  const existing = await ctx.storage.get('ratings', agentId);
  if (existing) {
    if (typeof agentName === 'string' && agentName !== '' && existing.agentName !== agentName) {
      existing.agentName = agentName;
      await ctx.storage.put('ratings', agentId, existing);
    }
    return existing;
  }
  const rating = {
    agentId,
    userId,
    agentName: typeof agentName === 'string' && agentName !== '' ? agentName : agentId,
    rating: INITIAL_RATING,
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    updatedAt: now(),
  };
  await ctx.storage.put('ratings', agentId, rating);
  return rating;
}

async function getLeaderboard(ctx, limit = 20) {
  const ratings = await listCollection(ctx, 'ratings');
  return ratings
    .sort((left, right) => right.rating - left.rating || right.updatedAt - left.updatedAt)
    .slice(0, Math.max(1, limit));
}

async function getLobbyVersion(ctx) {
  const meta = await ctx.storage.get('meta', 'lobby');
  return Number(meta?.version ?? 0);
}

async function bumpLobbyVersion(ctx) {
  const version = (await getLobbyVersion(ctx)) + 1;
  await ctx.storage.put('meta', 'lobby', { version, updatedAt: now() });
  return version;
}

async function getRoomDirectoryVersion(ctx) {
  const meta = await ctx.storage.get('meta', 'room-directory');
  return Number(meta?.version ?? 0);
}

async function bumpRoomDirectoryVersion(ctx) {
  const version = (await getRoomDirectoryVersion(ctx)) + 1;
  await ctx.storage.put('meta', 'room-directory', { version, updatedAt: now() });
  return version;
}

function sendToHall(ctx, type, payload) {
  for (const agentId of ctx.messaging.getOnlineAgentIds()) {
    if (ctx.messaging.getAgentCurrentLocation(agentId) !== PUBLIC_LOCATION_ID) continue;
    ctx.messaging.sendToAgent(agentId, type, payload);
  }
}

async function emitLobbyDelta(ctx, kind, match) {
  const version = await bumpLobbyVersion(ctx);
  sendToHall(ctx, 'go_lobby_delta', {
    kind,
    version,
    matchId: match.matchId,
    needsBootstrap: true,
  });
}

async function emitRoomDirectoryDelta(ctx, kind, match) {
  const version = await bumpRoomDirectoryVersion(ctx);
  sendToHall(ctx, 'go_room_directory_delta', {
    kind,
    version,
    matchId: match.matchId,
    needsRoomDirectoryRefresh: true,
  });
}

async function emitMatchDelta(ctx, match, kind, extra = {}) {
  for (const player of match.players) {
    ctx.messaging.sendToAgent(player.agentId, 'go_match_delta', {
      matchId: match.matchId,
      seq: match.seq,
      kind,
      phase: match.phase,
      serverTimestamp: now(),
      needsMatchRefresh: true,
      ...(kind === 'game_finished' ? { needsBootstrap: true } : {}),
      ...extra,
    });
  }
}

async function emitRoomDelta(ctx, match) {
  for (const agentId of getSpectatorAgentIds(ctx, match)) {
    grantRoomAccess(agentId, match.matchId);
    ctx.messaging.sendToAgent(agentId, 'go_room_delta', {
      matchId: match.matchId,
      seq: match.seq,
      phase: match.phase,
      serverTimestamp: now(),
      spectatorCount: getSpectatorCount(ctx, match),
      needsWatchedRoomRefresh: true,
    });
  }
}

async function emitRoomVisibilityTransition(ctx, previousMatch, nextMatch) {
  const hadLobby = !!previousMatch && isJoinableWaitingRoom(previousMatch);
  const hasLobby = !!nextMatch && isJoinableWaitingRoom(nextMatch);
  if (!hadLobby && hasLobby) {
    await emitLobbyDelta(ctx, 'room_added', nextMatch);
  } else if (hadLobby && hasLobby) {
    await emitLobbyDelta(ctx, 'room_updated', nextMatch);
  } else if (hadLobby && !hasLobby) {
    await emitLobbyDelta(ctx, 'room_removed', previousMatch);
  }

  const hadDirectory = !!previousMatch && isPublicRoomDirectoryEntry(previousMatch);
  const hasDirectory = !!nextMatch && isPublicRoomDirectoryEntry(nextMatch);
  if (!hadDirectory && hasDirectory) {
    await emitRoomDirectoryDelta(ctx, 'room_added', nextMatch);
  } else if (hadDirectory && hasDirectory) {
    await emitRoomDirectoryDelta(ctx, 'room_updated', nextMatch);
  } else if (hadDirectory && !hasDirectory) {
    await emitRoomDirectoryDelta(ctx, 'room_removed', previousMatch);
  }
}

async function updateSpectatorPresence(ctx, matchId) {
  if (!matchId) return;
  const match = await getMatch(ctx, matchId);
  if (!match) return;
  if (isPublicRoomDirectoryEntry(match)) {
    await emitRoomDirectoryDelta(ctx, 'room_updated', match);
  }
  await emitRoomDelta(ctx, match);
}

async function clearWatchedRoom(ctx, agentId, options = {}) {
  const watchedMatchId = watchedRooms.get(agentId);
  if (!watchedMatchId) return null;
  watchedRooms.delete(agentId);
  if (options.clearAccess !== false) {
    clearRoomAccess(agentId, watchedMatchId);
  }
  if (!options.skipPresenceUpdate) {
    await updateSpectatorPresence(ctx, watchedMatchId);
  }
  return watchedMatchId;
}

async function setWatchedRoom(ctx, agentId, matchId) {
  const previousMatchId = watchedRooms.get(agentId) ?? null;
  if (previousMatchId === matchId) {
    grantRoomAccess(agentId, matchId);
    return previousMatchId;
  }
  if (previousMatchId) {
    watchedRooms.delete(agentId);
    await updateSpectatorPresence(ctx, previousMatchId);
  }
  watchedRooms.set(agentId, matchId);
  grantRoomAccess(agentId, matchId);
  await updateSpectatorPresence(ctx, matchId);
  return previousMatchId;
}

function emitTurnPrompt(ctx, match, options = {}) {
  if (match.phase !== 'playing') return;
  const promptKind = options.promptKind === 'reminder' ? 'reminder' : 'turn';
  const color = currentTurn(match);
  const player = match.players.find((entry) => entry.color === color);
  if (!player) return;
  const state = buildMatchState(match, player.agentId);
  ctx.messaging.sendToAgent(player.agentId, 'go_turn_prompt', {
    matchId: match.matchId,
    seq: match.seq,
    serverTimestamp: now(),
    promptKind,
    reminder: promptKind === 'reminder',
    yourColor: player.color,
    remainingMs: remainingMsForColor(match, color),
    needsMatchRefresh: true,
    state,
  });
  if (promptKind === 'turn') {
    installTurnReminderTimer(ctx, match, player.agentId, color);
  }
}

function clearDisconnectTimer(agentId) {
  const timer = disconnectTimers.get(agentId);
  if (timer) {
    clearTimeout(timer);
    disconnectTimers.delete(agentId);
  }
}

function clearTurnTimer(matchId) {
  const timer = turnTimers.get(matchId);
  if (timer) {
    clearTimeout(timer);
    turnTimers.delete(matchId);
  }
}

function clearTurnReminderTimer(matchId) {
  const timer = turnReminderTimers.get(matchId);
  if (timer) {
    clearTimeout(timer);
    turnReminderTimers.delete(matchId);
  }
}

function installTurnReminderTimer(ctx, match, agentId, color) {
  clearTurnReminderTimer(match.matchId);
  if (match.phase !== 'playing') return;

  const expectedTurnStartedAt = match.turnStartedAt;
  const expectedMoveCount = match.moves.length;
  const timer = setTimeout(async () => {
    turnReminderTimers.delete(match.matchId);
    const current = await getMatch(ctx, match.matchId);
    if (!current || current.phase !== 'playing') return;
    if (current.turnStartedAt !== expectedTurnStartedAt) return;
    if (current.moves.length !== expectedMoveCount) return;
    if (currentTurn(current) !== color) return;
    const currentPlayer = current.players.find((entry) => entry.color === color);
    if (!currentPlayer || currentPlayer.agentId !== agentId) return;
    emitTurnPrompt(ctx, current, { promptKind: 'reminder' });
  }, TURN_REMINDER_MS);
  turnReminderTimers.set(match.matchId, timer);
}

function installTurnTimer(ctx, match) {
  clearTurnTimer(match.matchId);
  clearTurnReminderTimer(match.matchId);
  if (match.phase !== 'playing') return;
  const timer = setTimeout(async () => {
    const current = await getMatch(ctx, match.matchId);
    if (!current || current.phase !== 'playing') return;
    const color = currentTurn(current);
    const winner = current.players.find((player) => player.color === otherColor(color));
    await finishMatch(ctx, current, resultTypeForWinner(otherColor(color)), 'timeout', winner?.agentId ?? null);
  }, Math.max(1, match.clocks[currentTurn(match) === 'B' ? 'blackMs' : 'whiteMs']));
  turnTimers.set(match.matchId, timer);
}

function consumeClock(match) {
  if (match.phase !== 'playing' || !match.turnStartedAt) return null;
  const turn = currentTurn(match);
  const elapsed = Math.max(0, now() - match.turnStartedAt);
  const key = turn === 'B' ? 'blackMs' : 'whiteMs';
  match.clocks[key] = Math.max(0, match.clocks[key] - elapsed);
  match.turnStartedAt = now();
  return { turn, elapsed, remaining: match.clocks[key] };
}

function expectedScore(rating, opponentRating) {
  return 1 / (1 + 10 ** ((opponentRating - rating) / 400));
}

async function applyRatings(ctx, match, resultType) {
  const black = match.players.find((player) => player.color === 'B');
  const white = match.players.find((player) => player.color === 'W');
  if (!black || !white) {
    return {};
  }

  const blackRating = await getOrCreateRating(ctx, black.agentId, black.userId, black.agentName);
  const whiteRating = await getOrCreateRating(ctx, white.agentId, white.userId, white.agentName);

  const blackScore = resultType === 'black_win' ? 1 : resultType === 'white_win' ? 0 : 0.5;
  const whiteScore = resultType === 'white_win' ? 1 : resultType === 'black_win' ? 0 : 0.5;

  const blackDelta = Math.round(K_FACTOR * (blackScore - expectedScore(blackRating.rating, whiteRating.rating)));
  const whiteDelta = Math.round(K_FACTOR * (whiteScore - expectedScore(whiteRating.rating, blackRating.rating)));

  blackRating.rating += blackDelta;
  blackRating.gamesPlayed += 1;
  blackRating.wins += blackScore === 1 ? 1 : 0;
  blackRating.losses += blackScore === 0 ? 1 : 0;
  blackRating.draws += blackScore === 0.5 ? 1 : 0;
  blackRating.updatedAt = now();

  whiteRating.rating += whiteDelta;
  whiteRating.gamesPlayed += 1;
  whiteRating.wins += whiteScore === 1 ? 1 : 0;
  whiteRating.losses += whiteScore === 0 ? 1 : 0;
  whiteRating.draws += whiteScore === 0.5 ? 1 : 0;
  whiteRating.updatedAt = now();

  await ctx.storage.put('ratings', black.agentId, blackRating);
  await ctx.storage.put('ratings', white.agentId, whiteRating);

  return {
    [black.agentId]: blackDelta,
    [white.agentId]: whiteDelta,
  };
}

async function finishMatch(ctx, match, resultType, reason, winnerAgentId, viewerAgentId, extra = {}) {
  const previousMatch = structuredClone(match);
  clearTurnTimer(match.matchId);
  clearTurnReminderTimer(match.matchId);
  match.phase = 'finished';
  match.seq += 1;
  match.result = {
    result: resultType,
    reason,
    winnerAgentId,
    ratingChanges: await applyRatings(ctx, match, resultType),
    endedAt: now(),
    ...(extra.score ? { score: extra.score } : {}),
  };
  await saveMatch(ctx, match);
  await emitRoomDelta(ctx, match);
  await emitMatchDelta(ctx, match, 'game_finished', {
    result: match.result,
    turn: null,
  });
  await emitRoomVisibilityTransition(ctx, previousMatch, match);
  return buildMatchState(match, viewerAgentId);
}

async function removeWaitingPlayer(ctx, match, agentId) {
  const previousMatch = structuredClone(match);
  match.players = match.players.filter((player) => player.agentId !== agentId);
  await clearAgentMatchId(ctx, agentId);
  clearDisconnectTimer(agentId);
  if (match.players.length === 0) {
    for (const [watcherAgentId, watchedMatchId] of watchedRooms.entries()) {
      if (watchedMatchId !== match.matchId) continue;
      watchedRooms.delete(watcherAgentId);
      clearRoomAccess(watcherAgentId, match.matchId);
    }
    await deleteMatch(ctx, match.matchId);
    await emitRoomVisibilityTransition(ctx, previousMatch, null);
    return null;
  }
  match.seq += 1;
  match.players = match.players.map((player) => ({
    ...player,
    ready: false,
    color: null,
  }));
  await saveMatch(ctx, match);
  await emitRoomDelta(ctx, match);
  await emitRoomVisibilityTransition(ctx, previousMatch, match);
  await emitMatchDelta(ctx, match, 'player_left_waiting', { agentId });
  return match;
}

async function handleReconnect(ctx, agentId) {
  const match = await getCurrentMatch(ctx, agentId);
  if (!match) return null;
  const player = getPlayer(match, agentId);
  if (player.connected && player.disconnectDeadlineAt === null) {
    return buildMatchState(match, agentId);
  }
  const previousMatch = structuredClone(match);
  player.connected = true;
  player.disconnectDeadlineAt = null;
  clearDisconnectTimer(agentId);
  match.seq += 1;
  await saveMatch(ctx, match);
  await emitRoomDelta(ctx, match);
  await emitRoomVisibilityTransition(ctx, previousMatch, match);
  await emitMatchDelta(ctx, match, 'player_reconnected', {
    agentId,
    player: playerPublicState(player),
  });
  if (match.phase === 'playing' && player.color === currentTurn(match)) {
    emitTurnPrompt(ctx, match);
  }
  return buildMatchState(match, agentId);
}

async function handleDisconnect(ctx, agentId) {
  await clearWatchedRoom(ctx, agentId);
  clearRoomAccess(agentId);
  const match = await getCurrentMatch(ctx, agentId);
  if (!match) return;
  const player = getPlayer(match, agentId);
  const previousMatch = structuredClone(match);
  player.connected = false;
  player.disconnectDeadlineAt = now() + RECONNECT_GRACE_MS;
  match.seq += 1;
  await saveMatch(ctx, match);
  await emitRoomDelta(ctx, match);
  await emitRoomVisibilityTransition(ctx, previousMatch, match);
  await emitMatchDelta(ctx, match, 'player_disconnected', {
    agentId,
    reconnectDeadlineAt: player.disconnectDeadlineAt,
    player: playerPublicState(player),
  });
  clearDisconnectTimer(agentId);
  disconnectTimers.set(agentId, setTimeout(async () => {
    const current = await getCurrentMatch(ctx, agentId);
    if (!current) return;
    if (current.phase === 'waiting') {
      await removeWaitingPlayer(ctx, current, agentId);
      return;
    }
    if (current.phase === 'playing') {
      const disconnected = getPlayer(current, agentId);
      if (disconnected.connected) return;
      const winner = current.players.find((entry) => entry.agentId !== agentId);
      await finishMatch(
        ctx,
        current,
        resultTypeForWinner(otherColor(disconnected.color)),
        'disconnect_timeout',
        winner?.agentId ?? null,
      );
    }
  }, RECONNECT_GRACE_MS));
}

function createWelcomePayload(currentMatchId) {
  return {
    locationId: PUBLIC_LOCATION_ID,
    needsBootstrap: true,
    currentMatchId,
  };
}

export default {
  kind: 'uruc.backend-plugin@v2',
  pluginId: PLUGIN_ID,
  apiVersion: 2,
  async setup(ctx) {
    for (const timer of disconnectTimers.values()) clearTimeout(timer);
    for (const timer of turnTimers.values()) clearTimeout(timer);
    for (const timer of turnReminderTimers.values()) clearTimeout(timer);
    disconnectTimers.clear();
    turnTimers.clear();
    turnReminderTimers.clear();
    watchedRooms.clear();
    roomAccessGrants.clear();

    for (const record of await ctx.storage.list('matches')) {
      await ctx.storage.delete('matches', record.id);
    }
    for (const record of await ctx.storage.list('agent-match')) {
      await ctx.storage.delete('agent-match', record.id);
    }

    ctx.lifecycle.onStop(() => {
      for (const timer of disconnectTimers.values()) clearTimeout(timer);
      for (const timer of turnTimers.values()) clearTimeout(timer);
      for (const timer of turnReminderTimers.values()) clearTimeout(timer);
      disconnectTimers.clear();
      turnTimers.clear();
      turnReminderTimers.clear();
      watchedRooms.clear();
      roomAccessGrants.clear();
    });

    await ctx.locations.register({
      id: GO_LOCATION_ID,
      name: 'uruc-go',
      description: 'Head-to-head 19x19 Go with ratings, reconnect grace, and realtime room updates.',
    });

    await ctx.commands.register({
      id: 'create_match',
      description: 'Create a Go room.',
      inputSchema: {
        roomName: { type: 'string' },
        visibility: { type: 'string' },
      },
      handler: async (input, runtimeCtx) => {
        const session = requireSession(runtimeCtx);
        const current = await getCurrentMatch(ctx, session.agentId);
        if (current?.phase === 'playing' || current?.phase === 'waiting') {
          throw createError('You are already in a room.', 'MATCH_ALREADY_ACTIVE');
        }
        if (current?.phase === 'finished') {
          await clearAgentMatchId(ctx, session.agentId);
        }
        ensureHallOrMatch(runtimeCtx, current?.phase === 'finished' ? null : current);
        await clearWatchedRoom(ctx, session.agentId, { clearAccess: false });
        const matchId = randomUUID().slice(0, 10);
        const visibility = normalizeVisibility(input?.visibility);
        const match = {
          matchId,
          roomName: normalizeRoomName(input?.roomName, defaultRoomName(session.agentName, matchId)),
          visibility,
          phase: 'waiting',
          seq: 0,
          createdAt: now(),
          updatedAt: now(),
          komi: DEFAULT_KOMI,
          players: [{
            agentId: session.agentId,
            userId: session.userId,
            agentName: session.agentName,
            color: null,
            ready: false,
            connected: true,
            disconnectDeadlineAt: null,
          }],
          moves: [],
          clocks: {
            blackMs: INITIAL_TIME_MS,
            whiteMs: INITIAL_TIME_MS,
          },
          turnStartedAt: null,
          result: null,
        };
        await getOrCreateRating(ctx, session.agentId, session.userId, session.agentName);
        await saveMatch(ctx, match);
        await setAgentMatchId(ctx, session.agentId, match.matchId);
        grantRoomAccess(session.agentId, match.matchId);
        await emitRoomVisibilityTransition(ctx, null, match);
        return {
          matchId: match.matchId,
          state: buildMatchState(match, session.agentId),
        };
      },
    });

    await ctx.commands.register({
      id: 'list_matches',
      description: 'List joinable public Go rooms.',
      inputSchema: {},
      controlPolicy: { controllerRequired: false },
      handler: async (_input, runtimeCtx) => {
        ensureHallOrMatch(runtimeCtx, await getCurrentMatch(ctx, requireSession(runtimeCtx).agentId));
        return {
          matches: (await listCollection(ctx, 'matches'))
            .filter((match) => isJoinableWaitingRoom(match))
            .map((match) => matchSummary(ctx, match)),
        };
      },
    });

    await ctx.commands.register({
      id: 'list_rooms',
      description: 'List public Go rooms or search by room code.',
      inputSchema: {
        query: { type: 'string' },
        limit: { type: 'number' },
      },
      controlPolicy: { controllerRequired: false },
      handler: async (input, runtimeCtx) => {
        const session = requireSession(runtimeCtx);
        ensureHallOrMatch(runtimeCtx, await getCurrentMatch(ctx, session.agentId));
        const rawQuery = typeof input?.query === 'string' ? input.query.trim() : '';
        const query = rawQuery.toLowerCase();
        const limit = Math.max(1, Math.min(100, Number(input?.limit ?? 40) || 40));
        const matches = await listCollection(ctx, 'matches');
        const publicRooms = matches
          .filter((match) => isPublicRoomDirectoryEntry(match))
          .filter((match) => {
            if (!query) return true;
            return match.matchId.toLowerCase().includes(query) || match.roomName.toLowerCase().includes(query);
          })
          .sort((left, right) => right.updatedAt - left.updatedAt || right.createdAt - left.createdAt)
          .slice(0, limit);

        const rooms = publicRooms.map((match) => matchSummary(ctx, match));
        if (rawQuery) {
          const privateMatch = matches.find((match) => {
            return match.matchId.toLowerCase() === query
              && match.visibility === 'private'
              && (match.phase === 'waiting' || match.phase === 'playing');
          });
          if (privateMatch) {
            grantRoomAccess(session.agentId, privateMatch.matchId);
            if (!rooms.some((room) => room.matchId === privateMatch.matchId)) {
              rooms.unshift(matchSummary(ctx, privateMatch));
            }
          }
        }

        return {
          rooms: rooms.slice(0, limit),
          directoryVersion: await getRoomDirectoryVersion(ctx),
          query: rawQuery || null,
        };
      },
    });

    await ctx.commands.register({
      id: 'join_match',
      description: 'Join a waiting Go room.',
      inputSchema: { matchId: { type: 'string' } },
      handler: async (input, runtimeCtx) => {
        const session = requireSession(runtimeCtx);
        const current = await getCurrentMatch(ctx, session.agentId);
        ensureHallOrMatch(runtimeCtx, current);
        const targetMatchId = String(input?.matchId ?? '');
        if (current?.phase === 'playing' || current?.phase === 'waiting') {
          if (current.matchId !== targetMatchId) {
            throw createError('You are already in a room.', 'MATCH_ALREADY_ACTIVE');
          }
          return { state: buildMatchState(current, session.agentId) };
        }
        if (current?.phase === 'finished') {
          await clearAgentMatchId(ctx, session.agentId);
        }
        const match = await getMatch(ctx, targetMatchId);
        if (!match || !canJoinMatch(match, session.agentId)) {
          throw createError('Room not found.', 'MATCH_NOT_FOUND');
        }
        if (match.players.length >= 2) {
          throw createError('Room is full.', 'MATCH_FULL');
        }
        if (match.players.some((player) => player.agentId === session.agentId)) {
          return { state: buildMatchState(match, session.agentId) };
        }
        const previousMatch = structuredClone(match);
        match.players.push({
          agentId: session.agentId,
          userId: session.userId,
          agentName: session.agentName,
          color: null,
          ready: false,
          connected: true,
          disconnectDeadlineAt: null,
        });
        match.seq += 1;
        await getOrCreateRating(ctx, session.agentId, session.userId, session.agentName);
        await saveMatch(ctx, match);
        await setAgentMatchId(ctx, session.agentId, match.matchId);
        await clearWatchedRoom(ctx, session.agentId, { clearAccess: false });
        grantRoomAccess(session.agentId, match.matchId);
        await emitRoomDelta(ctx, match);
        await emitRoomVisibilityTransition(ctx, previousMatch, match);
        await emitMatchDelta(ctx, match, 'player_joined', {
          player: playerPublicState(getPlayer(match, session.agentId)),
        });
        return { state: buildMatchState(match, session.agentId) };
      },
    });

    await ctx.commands.register({
      id: 'bootstrap',
      description: 'Fetch a full uruc-go bootstrap snapshot.',
      inputSchema: { limit: { type: 'number' } },
      handler: async (input, runtimeCtx) => {
        const session = requireSession(runtimeCtx);
        const current = await getCurrentMatch(ctx, session.agentId);
        ensureHallOrMatch(runtimeCtx, current);
        return {
          currentMatch: current ? buildMatchState(current, session.agentId) : null,
          joinableMatches: (await listCollection(ctx, 'matches'))
            .filter((match) => isJoinableWaitingRoom(match))
            .map((match) => matchSummary(ctx, match))
            .slice(0, Math.max(1, Number(input?.limit ?? 20) || 20)),
          lobbyVersion: await getLobbyVersion(ctx),
          rating: await getOrCreateRating(ctx, session.agentId, session.userId, session.agentName),
          leaderboard: await getLeaderboard(ctx, Number(input?.limit ?? 20) || 20),
        };
      },
    });

    await ctx.commands.register({
      id: 'watch_room',
      description: 'Watch a public or authorized private Go room.',
      inputSchema: { matchId: { type: 'string' } },
      controlPolicy: { controllerRequired: false },
      handler: async (input, runtimeCtx) => {
        const session = requireSession(runtimeCtx);
        ensureHallOrMatch(runtimeCtx, await getCurrentMatch(ctx, session.agentId));
        const match = await getMatch(ctx, String(input?.matchId ?? ''));
        if (!match || !canWatchMatch(match, session.agentId)) {
          throw createError('Room not found.', 'MATCH_NOT_FOUND');
        }
        await setWatchedRoom(ctx, session.agentId, match.matchId);
        return {
          room: matchSummary(ctx, match),
          state: buildMatchState(match, session.agentId),
        };
      },
    });

    await ctx.commands.register({
      id: 'unwatch_room',
      description: 'Stop watching a room.',
      inputSchema: { matchId: { type: 'string' } },
      controlPolicy: { controllerRequired: false },
      handler: async (input, runtimeCtx) => {
        const session = requireSession(runtimeCtx);
        ensureHallOrMatch(runtimeCtx, await getCurrentMatch(ctx, session.agentId));
        const currentWatched = getWatchedRoomId(session.agentId);
        const requestedMatchId = typeof input?.matchId === 'string' && input.matchId !== '' ? input.matchId : currentWatched;
        if (!requestedMatchId || currentWatched !== requestedMatchId) {
          return { matchId: null };
        }
        const cleared = await clearWatchedRoom(ctx, session.agentId);
        return { matchId: cleared };
      },
    });

    await ctx.commands.register({
      id: 'leave_match',
      description: 'Leave a waiting room.',
      inputSchema: {},
      handler: async (_input, runtimeCtx) => {
        const session = requireSession(runtimeCtx);
        const match = await getCurrentMatch(ctx, session.agentId);
        if (!match) {
          throw createError('No active room.', 'MATCH_NOT_FOUND');
        }
        if (match.phase === 'playing') {
          throw createError('You cannot leave during an active game.', 'MATCH_IN_PROGRESS');
        }
        const next = await removeWaitingPlayer(ctx, match, session.agentId);
        return {
          state: next ? buildMatchState(next, next.players[0]?.agentId ?? session.agentId) : null,
        };
      },
    });

    await ctx.commands.register({
      id: 'ready',
      description: 'Mark yourself ready.',
      inputSchema: {},
      handler: async (_input, runtimeCtx) => {
        const session = requireSession(runtimeCtx);
        const match = await getCurrentMatch(ctx, session.agentId);
        if (!match || match.phase !== 'waiting') {
          throw createError('No waiting room to ready up in.', 'MATCH_NOT_FOUND');
        }
        const previousMatch = structuredClone(match);
        const player = getPlayer(match, session.agentId);
        player.ready = true;
        match.seq += 1;
        let started = false;
        if (match.players.length === 2 && match.players.every((entry) => entry.ready)) {
          match.phase = 'playing';
          match.players[0].color = 'B';
          match.players[1].color = 'W';
          match.clocks = { blackMs: INITIAL_TIME_MS, whiteMs: INITIAL_TIME_MS };
          match.turnStartedAt = now();
          started = true;
          await saveMatch(ctx, match);
          await emitRoomDelta(ctx, match);
          await emitRoomVisibilityTransition(ctx, previousMatch, match);
          installTurnTimer(ctx, match);
          await emitMatchDelta(ctx, match, 'game_started', {
            players: match.players.map((entry) => ({
              agentId: entry.agentId,
              color: entry.color,
              ready: entry.ready,
              connected: entry.connected,
              disconnectDeadlineAt: entry.disconnectDeadlineAt,
            })),
            turn: 'B',
            clocks: match.clocks,
          });
          emitTurnPrompt(ctx, match);
        } else {
          await saveMatch(ctx, match);
          await emitRoomDelta(ctx, match);
          await emitRoomVisibilityTransition(ctx, previousMatch, match);
          await emitMatchDelta(ctx, match, 'player_ready', {
            agentId: session.agentId,
            player: playerPublicState(player),
          });
        }
        return {
          state: buildMatchState(match, session.agentId),
          started,
        };
      },
    });

    await ctx.commands.register({
      id: 'unready',
      description: 'Cancel readiness in a waiting room.',
      inputSchema: {},
      handler: async (_input, runtimeCtx) => {
        const session = requireSession(runtimeCtx);
        const match = await getCurrentMatch(ctx, session.agentId);
        if (!match || match.phase !== 'waiting') {
          throw createError('No waiting room to cancel readiness in.', 'MATCH_NOT_FOUND');
        }
        const player = getPlayer(match, session.agentId);
        if (!player.ready) {
          throw createError('This seat is not marked ready.', 'PLAYER_NOT_READY');
        }
        const previousMatch = structuredClone(match);
        player.ready = false;
        match.seq += 1;
        await saveMatch(ctx, match);
        await emitRoomDelta(ctx, match);
        await emitRoomVisibilityTransition(ctx, previousMatch, match);
        await emitMatchDelta(ctx, match, 'player_unready', {
          agentId: session.agentId,
          player: playerPublicState(player),
        });
        return { state: buildMatchState(match, session.agentId) };
      },
    });

    await ctx.commands.register({
      id: 'move',
      description: 'Play a stone.',
      inputSchema: {
        x: { type: 'number' },
        y: { type: 'number' },
      },
      handler: async (input, runtimeCtx) => {
        const session = requireSession(runtimeCtx);
        const match = await getCurrentMatch(ctx, session.agentId);
        if (!match || match.phase !== 'playing') {
          throw createError('No active game.', 'MATCH_NOT_FOUND');
        }
        const player = getPlayer(match, session.agentId);
        const game = replayMatch(match);
        const turn = game.snapshot().currentPlayer;
        if (player.color !== turn) {
          throw createError('It is not your turn.', 'NOT_YOUR_TURN');
        }
        const clock = consumeClock(match);
        if (clock && clock.remaining <= 0) {
          const winner = match.players.find((entry) => entry.color === otherColor(turn));
          return {
            state: await finishMatch(ctx, match, resultTypeForWinner(otherColor(turn)), 'timeout', winner?.agentId ?? null, session.agentId),
          };
        }

        const x = Number(input?.x);
        const y = Number(input?.y);
        let snapshot;
        try {
          snapshot = game.play(player.color, { x, y });
        } catch (error) {
          throw createError(error instanceof Error ? error.message : 'Illegal move.', 'ILLEGAL_MOVE');
        }

        const previousMatch = structuredClone(match);
        match.moves.push({
          type: 'play',
          color: player.color,
          x,
          y,
        });
        match.seq += 1;
        match.turnStartedAt = now();
        await saveMatch(ctx, match);
        installTurnTimer(ctx, match);
        await emitRoomDelta(ctx, match);
        await emitMatchDelta(ctx, match, 'move_made', {
          move: { type: 'play', color: player.color, x, y },
          turn: snapshot.currentPlayer,
          clocks: match.clocks,
        });
        await emitRoomVisibilityTransition(ctx, previousMatch, match);
        emitTurnPrompt(ctx, match);
        return { state: buildMatchState(match, session.agentId) };
      },
    });

    await ctx.commands.register({
      id: 'pass',
      description: 'Pass the turn.',
      inputSchema: {},
      handler: async (_input, runtimeCtx) => {
        const session = requireSession(runtimeCtx);
        const match = await getCurrentMatch(ctx, session.agentId);
        if (!match || match.phase !== 'playing') {
          throw createError('No active game.', 'MATCH_NOT_FOUND');
        }
        const player = getPlayer(match, session.agentId);
        const game = replayMatch(match);
        const turn = game.snapshot().currentPlayer;
        if (player.color !== turn) {
          throw createError('It is not your turn.', 'NOT_YOUR_TURN');
        }
        const clock = consumeClock(match);
        if (clock && clock.remaining <= 0) {
          const winner = match.players.find((entry) => entry.color === otherColor(turn));
          return {
            state: await finishMatch(ctx, match, resultTypeForWinner(otherColor(turn)), 'timeout', winner?.agentId ?? null, session.agentId),
          };
        }

        const snapshot = game.pass(player.color);
        const previousMatch = structuredClone(match);
        match.moves.push({
          type: 'pass',
          color: player.color,
        });
        match.seq += 1;
        match.turnStartedAt = now();
        await saveMatch(ctx, match);

        if (snapshot.finished && snapshot.result) {
          const winnerColor = snapshot.result.winner;
          const winner = match.players.find((entry) => entry.color === winnerColor);
          return {
            state: await finishMatch(
              ctx,
              match,
              resultTypeForWinner(winnerColor),
              'double_pass',
              winner?.agentId ?? null,
              session.agentId,
              { score: snapshot.result.score },
            ),
          };
        }

        installTurnTimer(ctx, match);
        await emitRoomDelta(ctx, match);
        await emitMatchDelta(ctx, match, 'pass_played', {
          move: { type: 'pass', color: player.color },
          turn: snapshot.currentPlayer,
          clocks: match.clocks,
          consecutivePasses: snapshot.consecutivePasses,
        });
        await emitRoomVisibilityTransition(ctx, previousMatch, match);
        emitTurnPrompt(ctx, match);
        return { state: buildMatchState(match, session.agentId) };
      },
    });

    await ctx.commands.register({
      id: 'resign',
      description: 'Resign the current game.',
      inputSchema: {},
      handler: async (_input, runtimeCtx) => {
        const session = requireSession(runtimeCtx);
        const match = await getCurrentMatch(ctx, session.agentId);
        if (!match || match.phase !== 'playing') {
          throw createError('No active game.', 'MATCH_NOT_FOUND');
        }
        const player = getPlayer(match, session.agentId);
        const winnerColor = otherColor(player.color);
        const winner = match.players.find((entry) => entry.color === winnerColor);
        return {
          state: await finishMatch(ctx, match, resultTypeForWinner(winnerColor), 'resignation', winner?.agentId ?? null, session.agentId),
        };
      },
    });

    await ctx.commands.register({
      id: 'state',
      description: 'View the current match state.',
      inputSchema: { matchId: { type: 'string' } },
      handler: async (input, runtimeCtx) => {
        const session = requireSession(runtimeCtx);
        const match = typeof input?.matchId === 'string' && input.matchId !== ''
          ? await getMatch(ctx, input.matchId)
          : await getCurrentMatch(ctx, session.agentId);
        if (!match || !canAccessMatch(match, session.agentId)) {
          throw createError('Room not found.', 'MATCH_NOT_FOUND');
        }
        return buildMatchState(match, session.agentId);
      },
    });

    await ctx.commands.register({
      id: 'rating',
      description: 'View your Elo rating.',
      inputSchema: {},
      controlPolicy: { controllerRequired: false },
      handler: async (_input, runtimeCtx) => {
        const session = requireSession(runtimeCtx);
        return await getOrCreateRating(ctx, session.agentId, session.userId, session.agentName);
      },
    });

    await ctx.commands.register({
      id: 'leaderboard',
      description: 'View the Elo leaderboard.',
      inputSchema: { limit: { type: 'number' } },
      controlPolicy: { controllerRequired: false },
      handler: async (input) => ({
        leaderboard: await getLeaderboard(ctx, Number(input?.limit ?? 20) || 20),
      }),
    });

    await ctx.policies.register({
      id: 'prevent-leave-during-active-go-match',
      kind: 'location-leave',
      handler: async (payload) => {
        if (payload.locationId !== PUBLIC_LOCATION_ID || !payload.session?.agentId) return;
        const match = await getCurrentMatch(ctx, payload.session.agentId);
        if (match?.phase === 'playing') {
          throw createError('You cannot leave uruc-go during an active game.', 'MATCH_IN_PROGRESS');
        }
      },
    });

    await ctx.events.subscribe('location.entered', async (payload) => {
      if (payload.locationId !== PUBLIC_LOCATION_ID || !payload.session?.agentId || !payload.ctx?.gateway || !payload.ctx?.ws) return;
      const currentMatchId = await getAgentMatchId(ctx, payload.session.agentId);
      payload.ctx.gateway.send(payload.ctx.ws, {
        id: '',
        type: 'go_welcome',
        payload: createWelcomePayload(currentMatchId),
      });
    });

    await ctx.events.subscribe('location.left', async (payload) => {
      if (payload.locationId !== PUBLIC_LOCATION_ID || !payload.session?.agentId) return;
      await clearWatchedRoom(ctx, payload.session.agentId);
      clearRoomAccess(payload.session.agentId);
    });

    await ctx.events.subscribe('connection.close', async (payload) => {
      if (!payload?.session?.agentId) return;
      await handleDisconnect(ctx, payload.session.agentId);
    });

    await ctx.events.subscribe('agent.authenticated', async (payload) => {
      if (!payload?.session?.agentId) return;
      await getOrCreateRating(ctx, payload.session.agentId, payload.session.userId, payload.session.agentName);
      const recovered = await handleReconnect(ctx, payload.session.agentId);
      const inHall = payload?.ctx?.currentLocation === PUBLIC_LOCATION_ID;
      const inMatch = !!(await getCurrentMatch(ctx, payload.session.agentId));
      if ((!inHall && !inMatch) || !payload?.ctx?.gateway || !payload?.ctx?.ws) {
        return;
      }
      payload.ctx.gateway.send(payload.ctx.ws, {
        id: '',
        type: 'go_reconnected',
        payload: {
          needsBootstrap: true,
          currentMatchId: recovered?.matchId ?? await getAgentMatchId(ctx, payload.session.agentId),
        },
      });
      const currentMatch = await getCurrentMatch(ctx, payload.session.agentId);
      if (currentMatch && currentMatch.phase === 'playing') {
        const player = currentMatch.players.find((entry) => entry.agentId === payload.session.agentId);
        if (player?.color === currentTurn(currentMatch)) {
          emitTurnPrompt(ctx, currentMatch);
        }
      }
    });
  },
};
