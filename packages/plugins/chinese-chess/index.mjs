import { randomUUID } from 'crypto';
import { createChineseChessEngine, DEFAULT_POSITION_FEN } from './chinese-chess-engine.mjs';

const PLUGIN_ID = 'uruc.chinese-chess';
const CHINESE_CHESS_LOCATION_ID = 'chinese-chess-club';
const PUBLIC_LOCATION_ID = `${PLUGIN_ID}.${CHINESE_CHESS_LOCATION_ID}`;
const INITIAL_RATING = 1500;
const K_FACTOR = 40;
const INITIAL_TIME_MS = 10 * 60 * 1000;
const TURN_REMINDER_MS = 20 * 1000;
const RECONNECT_GRACE_MS = 60 * 1000;
const EVENT_TYPES = Object.freeze({
  welcome: 'chinese_chess_welcome',
  lobbyDelta: 'chinese_chess_lobby_delta',
  roomDirectoryDelta: 'chinese_chess_room_directory_delta',
  matchDelta: 'chinese_chess_match_delta',
  roomDelta: 'chinese_chess_room_delta',
  turnPrompt: 'chinese_chess_turn_prompt',
  reconnected: 'chinese_chess_reconnected',
});
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
  resign: `${PLUGIN_ID}.resign@v1`,
  offerDraw: `${PLUGIN_ID}.offer_draw@v1`,
  acceptDraw: `${PLUGIN_ID}.accept_draw@v1`,
  declineDraw: `${PLUGIN_ID}.decline_draw@v1`,
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

function guideField(field, meaning) {
  return { field, meaning };
}

function createGuide(summary, whatToDoNow, recommendedCommands = [], fieldGlossary = []) {
  return {
    summary,
    whyYouReceivedThis: summary,
    whatToDoNow,
    recommendedCommands,
    ...(fieldGlossary.length > 0 ? { fieldGlossary } : {}),
  };
}

function withGuide(payload, guide) {
  return {
    ...payload,
    guide,
  };
}

function createBootstrapGuide() {
  return createGuide(
    'This is the latest Chinese Chess Club bootstrap snapshot.',
    `Use ${COMMAND_IDS.createMatch} to open a room, ${COMMAND_IDS.listRooms} to browse rooms, or ${COMMAND_IDS.state} to inspect your current room.`,
    [COMMAND_IDS.createMatch, COMMAND_IDS.listRooms, COMMAND_IDS.state, COMMAND_IDS.listMatches],
    [
      guideField('currentMatch', 'The current room snapshot for this agent, or null if no room is linked.'),
      guideField('joinableMatches', 'Public waiting rooms with an open seat.'),
      guideField('rating', 'The current Elo record for this venue.'),
      guideField('leaderboard', 'Top current Elo entries.'),
    ],
  );
}

function createCommandGuide(kind) {
  const summaryByKind = {
    list_matches: 'This is the current list of joinable Chinese chess rooms.',
    list_rooms: 'This is the current room directory slice for Chinese Chess Club.',
    create_match: 'A new Chinese chess room was created.',
    join_match: 'This agent joined a waiting Chinese chess room.',
    watch_room: 'This agent is now watching a Chinese chess room.',
    unwatch_room: 'This agent is no longer watching a Chinese chess room.',
    leave_match: 'This agent left its waiting room.',
    ready: 'This seat is marked ready.',
    unready: 'This seat is no longer marked ready.',
    move: 'A legal move was accepted and the authoritative board advanced.',
    resign: 'This agent resigned the current match.',
    offer_draw: 'A draw offer is active in the current match.',
    accept_draw: 'The current match ended in a draw by agreement.',
    decline_draw: 'The draw offer was declined and normal play continues.',
    state: 'This is the latest authoritative snapshot for the requested room.',
    rating: 'This is the current Elo record for the requesting agent.',
    leaderboard: 'This is the current Elo leaderboard for Chinese Chess Club.',
  };

  return createGuide(
    summaryByKind[kind] ?? 'This is a Chinese chess venue response.',
    `Use ${COMMAND_IDS.state} for authoritative room state or ${COMMAND_IDS.bootstrap} for a full venue snapshot.`,
    [COMMAND_IDS.state, COMMAND_IDS.bootstrap],
  );
}

function createWelcomeGuide(currentMatchId) {
  return createGuide(
    'You are connected to Chinese Chess Club.',
    currentMatchId
      ? `Call ${COMMAND_IDS.bootstrap} first, then inspect ${COMMAND_IDS.state} for room ${currentMatchId} if needed.`
      : `Call ${COMMAND_IDS.bootstrap} first, then use ${COMMAND_IDS.listRooms} or ${COMMAND_IDS.createMatch}.`,
    [COMMAND_IDS.bootstrap, COMMAND_IDS.listRooms, COMMAND_IDS.createMatch, COMMAND_IDS.state],
  );
}

function createReconnectedGuide(currentMatchId) {
  return createGuide(
    'Your Chinese Chess Club session has been restored.',
    currentMatchId
      ? `Refresh with ${COMMAND_IDS.bootstrap} or ${COMMAND_IDS.state} for room ${currentMatchId}.`
      : `Refresh with ${COMMAND_IDS.bootstrap} before acting.`,
    [COMMAND_IDS.bootstrap, COMMAND_IDS.state, COMMAND_IDS.listRooms],
  );
}

function createTurnPromptGuide(promptKind = 'turn') {
  return createGuide(
    promptKind === 'reminder'
      ? 'Reminder: this agent still has the move in an active Chinese chess game.'
      : 'It is this agent’s turn in an active Chinese chess game.',
    `Choose one legal move from legalMoves and call ${COMMAND_IDS.move} before remainingMs reaches zero.`,
    [COMMAND_IDS.move, COMMAND_IDS.state, COMMAND_IDS.offerDraw, COMMAND_IDS.resign],
    [
      guideField('yourSide', 'The side controlled by this agent in the current game.'),
      guideField('remainingMs', 'Approximate remaining move time at prompt emission time.'),
      guideField('legalMoves', 'All currently legal moves for this agent.'),
    ],
  );
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

function replayMatch(match) {
  return createChineseChessEngine({
    positionFen: match.positionFen ?? DEFAULT_POSITION_FEN,
    moveHistory: match.moveHistory ?? [],
  });
}

function currentTurn(match) {
  if (match.phase !== 'playing') return null;
  return replayMatch(match).snapshot().sideToMove;
}

function otherSide(side) {
  return side === 'red' ? 'black' : 'red';
}

function remainingMsForSide(match, side) {
  const key = side === 'red' ? 'redMs' : 'blackMs';
  if (match.phase !== 'playing' || match.turnStartedAt === null || currentTurn(match) !== side) {
    return match.clocks[key];
  }
  return Math.max(0, match.clocks[key] - Math.max(0, now() - match.turnStartedAt));
}

function buildLegalMoves(snapshot, viewer) {
  if (!viewer || viewer.side !== snapshot.sideToMove) return [];
  return snapshot.legalMoves;
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

function playerPublicState(player) {
  return {
    agentId: player.agentId,
    userId: player.userId,
    agentName: player.agentName,
    side: player.side,
    ready: player.ready,
    connected: player.connected,
    disconnectDeadlineAt: player.disconnectDeadlineAt,
  };
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
      side: player.side,
      ready: player.ready,
      connected: player.connected,
    })),
    createdAt: match.createdAt,
  };
}

function matchState(match, viewerAgentId) {
  const snapshot = replayMatch(match).snapshot();
  const viewer = match.players.find((player) => player.agentId === viewerAgentId);
  return {
    matchId: match.matchId,
    roomName: match.roomName,
    visibility: match.visibility,
    phase: match.phase,
    seq: match.seq,
    serverTimestamp: now(),
    moveCount: (match.moveHistory ?? []).length,
    positionFen: snapshot.positionFen,
    sideToMove: snapshot.sideToMove,
    inCheck: match.phase === 'playing' ? snapshot.inCheck : false,
    clocks: {
      redMs: remainingMsForSide(match, 'red'),
      blackMs: remainingMsForSide(match, 'black'),
    },
    drawOfferBy: match.drawOfferBy,
    players: match.players.map(playerPublicState),
    yourAgentId: viewer?.agentId,
    yourSide: viewer?.side ?? null,
    result: match.result,
    legalMoves: match.phase === 'playing' ? buildLegalMoves(snapshot, viewer) : [],
    moveHistory: [...(match.moveHistory ?? [])],
  };
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

function sendToChineseChessHall(ctx, type, payload) {
  for (const agentId of ctx.messaging.getOnlineAgentIds()) {
    if (ctx.messaging.getAgentCurrentLocation(agentId) !== PUBLIC_LOCATION_ID) continue;
    ctx.messaging.sendToAgent(agentId, type, payload);
  }
}

function createLobbyDeltaWakeText(kind, match) {
  if (kind === 'room_added') return `New waiting room in lobby: ${match.roomName} (${match.matchId}).`;
  if (kind === 'room_removed') return `Lobby room removed: ${match.roomName} (${match.matchId}).`;
  return `Lobby room updated: ${match.roomName} (${match.matchId}).`;
}

function createRoomDirectoryWakeText(kind, match) {
  if (kind === 'room_added') return `Room listed: ${match.roomName} (${match.matchId}).`;
  if (kind === 'room_removed') return `Room removed: ${match.roomName} (${match.matchId}).`;
  return `Room updated: ${match.roomName} (${match.matchId}).`;
}

function createMatchDeltaWakeText(kind, match, extra = {}) {
  if (kind === 'move_made' && extra.move?.display) {
    return `Move played in ${match.roomName}: ${extra.move.display}.`;
  }
  if (kind === 'game_finished') {
    return `Game finished in ${match.roomName}.`;
  }
  return `Room ${match.roomName} changed: ${kind}.`;
}

function createRoomDeltaWakeText(match) {
  return `Watched room changed: ${match.roomName} (${match.matchId}).`;
}

function createTurnPromptWakeText(promptKind, match) {
  if (promptKind === 'reminder') {
    return `Reminder: it is still your move in ${match.roomName}.`;
  }
  return `It is your move in ${match.roomName}.`;
}

function createWelcomeWakeText(currentMatchId) {
  return currentMatchId
    ? `Connected to Chinese Chess Club. Refresh bootstrap, then inspect room ${currentMatchId} if needed.`
    : 'Connected to Chinese Chess Club. Refresh bootstrap, then browse rooms or create a match.';
}

function createReconnectedWakeText(currentMatchId) {
  return currentMatchId
    ? `Chinese Chess Club session restored. Refresh bootstrap or state for room ${currentMatchId}.`
    : 'Chinese Chess Club session restored. Refresh bootstrap before acting.';
}

async function emitLobbyDelta(ctx, kind, match) {
  const version = await bumpLobbyVersion(ctx);
  sendToChineseChessHall(ctx, EVENT_TYPES.lobbyDelta, {
    kind,
    version,
    matchId: match.matchId,
    room: kind === 'room_removed' ? undefined : matchSummary(ctx, match),
    needsBootstrap: true,
    wakeText: createLobbyDeltaWakeText(kind, match),
  });
}

async function emitRoomDirectoryDelta(ctx, kind, match) {
  const version = await bumpRoomDirectoryVersion(ctx);
  sendToChineseChessHall(ctx, EVENT_TYPES.roomDirectoryDelta, {
    kind,
    version,
    matchId: match.matchId,
    room: kind === 'room_removed' ? undefined : matchSummary(ctx, match),
    needsRoomDirectoryRefresh: true,
    wakeText: createRoomDirectoryWakeText(kind, match),
  });
}

async function emitMatchDelta(ctx, match, kind, extra = {}) {
  for (const player of match.players) {
    ctx.messaging.sendToAgent(player.agentId, EVENT_TYPES.matchDelta, {
      matchId: match.matchId,
      seq: match.seq,
      kind,
      phase: match.phase,
      serverTimestamp: now(),
      state: matchState(match, player.agentId),
      needsMatchRefresh: true,
      ...(kind === 'game_finished' ? { needsBootstrap: true } : {}),
      ...(typeof extra.agentId === 'string' && extra.agentId !== '' ? { agentId: extra.agentId } : {}),
      ...(extra.move ? { move: extra.move } : {}),
      ...(typeof extra.drawOfferBy !== 'undefined' ? { drawOfferBy: extra.drawOfferBy } : {}),
      ...(typeof extra.reconnectDeadlineAt !== 'undefined' ? { reconnectDeadlineAt: extra.reconnectDeadlineAt } : {}),
      ...(typeof extra.sideToMove !== 'undefined' ? { sideToMove: extra.sideToMove } : {}),
      ...(typeof extra.inCheck !== 'undefined' ? { inCheck: extra.inCheck } : {}),
      ...(extra.clocks ? { clocks: extra.clocks } : {}),
      ...(extra.result ? { result: extra.result } : {}),
      wakeText: createMatchDeltaWakeText(kind, match, extra),
    });
  }
}

async function emitRoomDelta(ctx, match) {
  for (const agentId of getSpectatorAgentIds(ctx, match)) {
    grantRoomAccess(agentId, match.matchId);
    ctx.messaging.sendToAgent(agentId, EVENT_TYPES.roomDelta, {
      matchId: match.matchId,
      seq: match.seq,
      phase: match.phase,
      serverTimestamp: now(),
      spectatorCount: getSpectatorCount(ctx, match),
      needsWatchedRoomRefresh: true,
      state: matchState(match, agentId),
      wakeText: createRoomDeltaWakeText(match),
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
  const side = currentTurn(match);
  if (!side) return;
  const player = match.players.find((entry) => entry.side === side);
  if (!player) return;
  const state = matchState(match, player.agentId);
  ctx.messaging.sendToAgent(player.agentId, EVENT_TYPES.turnPrompt, {
    matchId: match.matchId,
    seq: match.seq,
    serverTimestamp: now(),
    promptKind,
    reminder: promptKind === 'reminder',
    yourSide: player.side,
    remainingMs: remainingMsForSide(match, side),
    positionFen: state.positionFen,
    moveCount: state.moveCount,
    needsMatchRefresh: true,
    state,
    legalMoves: state.legalMoves,
    wakeText: createTurnPromptWakeText(promptKind, match),
    guide: createTurnPromptGuide(promptKind),
  });
  if (promptKind === 'turn') {
    installTurnReminderTimer(ctx, match, player.agentId, side);
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

function expectedScore(rating, opponentRating) {
  return 1 / (1 + 10 ** ((opponentRating - rating) / 400));
}

async function applyRatings(ctx, match, resultType) {
  const red = match.players.find((player) => player.side === 'red');
  const black = match.players.find((player) => player.side === 'black');
  if (!red || !black) {
    return {};
  }

  const redRating = await getOrCreateRating(ctx, red.agentId, red.userId, red.agentName);
  const blackRating = await getOrCreateRating(ctx, black.agentId, black.userId, black.agentName);

  const redScore = resultType === 'red_win' ? 1 : resultType === 'black_win' ? 0 : 0.5;
  const blackScore = resultType === 'black_win' ? 1 : resultType === 'red_win' ? 0 : 0.5;

  const redDelta = Math.round(K_FACTOR * (redScore - expectedScore(redRating.rating, blackRating.rating)));
  const blackDelta = Math.round(K_FACTOR * (blackScore - expectedScore(blackRating.rating, redRating.rating)));

  redRating.rating += redDelta;
  redRating.gamesPlayed += 1;
  redRating.wins += redScore === 1 ? 1 : 0;
  redRating.losses += redScore === 0 ? 1 : 0;
  redRating.draws += redScore === 0.5 ? 1 : 0;
  redRating.updatedAt = now();

  blackRating.rating += blackDelta;
  blackRating.gamesPlayed += 1;
  blackRating.wins += blackScore === 1 ? 1 : 0;
  blackRating.losses += blackScore === 0 ? 1 : 0;
  blackRating.draws += blackScore === 0.5 ? 1 : 0;
  blackRating.updatedAt = now();

  await ctx.storage.put('ratings', red.agentId, redRating);
  await ctx.storage.put('ratings', black.agentId, blackRating);

  return {
    [red.agentId]: redDelta,
    [black.agentId]: blackDelta,
  };
}

async function finishMatch(ctx, match, resultType, reason, winnerAgentId, viewerAgentId) {
  const previousMatch = structuredClone(match);
  clearTurnTimer(match.matchId);
  clearTurnReminderTimer(match.matchId);
  match.phase = 'finished';
  match.turnStartedAt = null;
  match.seq += 1;
  match.result = {
    result: resultType,
    reason,
    winnerAgentId,
    ratingChanges: await applyRatings(ctx, match, resultType),
    endedAt: now(),
  };
  match.drawOfferBy = null;
  await saveMatch(ctx, match);
  await emitRoomDelta(ctx, match);
  await emitMatchDelta(ctx, match, 'game_finished', {
    result: match.result,
    drawOfferBy: null,
  });
  await emitRoomVisibilityTransition(ctx, previousMatch, match);
  return matchState(match, viewerAgentId);
}

function getPlayer(match, agentId) {
  const player = match.players.find((entry) => entry.agentId === agentId);
  if (!player) {
    throw createError('You are not part of this match.', 'MATCH_NOT_FOUND');
  }
  return player;
}

function requireSession(runtimeCtx) {
  if (!runtimeCtx.session) {
    throw createError('Authenticate your agent first.', 'NOT_AUTHENTICATED', 'auth');
  }
  return runtimeCtx.session;
}

function ensureHallOrMatch(runtimeCtx, match) {
  if (runtimeCtx.currentLocation === PUBLIC_LOCATION_ID || match) {
    return;
  }
  throw createError(
    `Enter Chinese Chess Club with enter_location and locationId "${PUBLIC_LOCATION_ID}".`,
    'NOT_IN_CHINESE_CHESS_LOCATION',
    'enter_location',
    { locationId: PUBLIC_LOCATION_ID },
  );
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
  match.positionFen = DEFAULT_POSITION_FEN;
  match.moveHistory = [];
  match.turnStartedAt = null;
  match.drawOfferBy = null;
  match.result = null;
  match.clocks = { redMs: INITIAL_TIME_MS, blackMs: INITIAL_TIME_MS };
  match.players = match.players.map((player) => ({
    ...player,
    ready: false,
    side: null,
  }));
  await saveMatch(ctx, match);
  await emitRoomDelta(ctx, match);
  await emitRoomVisibilityTransition(ctx, previousMatch, match);
  await emitMatchDelta(ctx, match, 'player_left_waiting', { agentId });
  return match;
}

function installTurnReminderTimer(ctx, match, agentId, side) {
  clearTurnReminderTimer(match.matchId);
  if (match.phase !== 'playing') return;

  const expectedTurnStartedAt = match.turnStartedAt;
  const expectedMoveCount = match.moveHistory.length;
  const timer = setTimeout(async () => {
    turnReminderTimers.delete(match.matchId);
    const current = await getMatch(ctx, match.matchId);
    if (!current || current.phase !== 'playing') return;
    if (current.turnStartedAt !== expectedTurnStartedAt) return;
    if (current.moveHistory.length !== expectedMoveCount) return;
    if (currentTurn(current) !== side) return;
    const currentPlayer = current.players.find((entry) => entry.side === side);
    if (!currentPlayer || currentPlayer.agentId !== agentId) return;
    emitTurnPrompt(ctx, current, { promptKind: 'reminder' });
  }, TURN_REMINDER_MS);
  turnReminderTimers.set(match.matchId, timer);
}

function installTurnTimer(ctx, match) {
  clearTurnTimer(match.matchId);
  clearTurnReminderTimer(match.matchId);
  if (match.phase !== 'playing') return;
  const side = currentTurn(match);
  if (!side) return;
  const key = side === 'red' ? 'redMs' : 'blackMs';
  const timer = setTimeout(async () => {
    const current = await getMatch(ctx, match.matchId);
    if (!current || current.phase !== 'playing') return;
    const loserSide = currentTurn(current);
    if (!loserSide) return;
    const winnerSide = otherSide(loserSide);
    const winner = current.players.find((player) => player.side === winnerSide);
    await finishMatch(ctx, current, winnerSide === 'red' ? 'red_win' : 'black_win', 'timeout', winner?.agentId ?? null);
  }, Math.max(1, match.clocks[key]));
  turnTimers.set(match.matchId, timer);
}

async function handleReconnect(ctx, agentId) {
  const match = await getCurrentMatch(ctx, agentId);
  if (!match) return null;
  const player = getPlayer(match, agentId);
  if (player.connected && player.disconnectDeadlineAt === null) {
    return matchState(match, agentId);
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
  if (match.phase === 'playing' && player.side === currentTurn(match)) {
    emitTurnPrompt(ctx, match);
  }
  return matchState(match, agentId);
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
      const winnerSide = disconnected.side ? otherSide(disconnected.side) : null;
      const winner = current.players.find((entry) => entry.side === winnerSide);
      await finishMatch(
        ctx,
        current,
        winnerSide === 'red' ? 'red_win' : 'black_win',
        'disconnect_timeout',
        winner?.agentId ?? null,
      );
    }
  }, RECONNECT_GRACE_MS));
}

function consumeClock(match) {
  if (match.phase !== 'playing' || !match.turnStartedAt) return null;
  const side = currentTurn(match);
  if (!side) return null;
  const elapsed = Math.max(0, now() - match.turnStartedAt);
  const key = side === 'red' ? 'redMs' : 'blackMs';
  match.clocks[key] = Math.max(0, match.clocks[key] - elapsed);
  match.turnStartedAt = now();
  return { side, elapsed, remaining: match.clocks[key] };
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
      id: CHINESE_CHESS_LOCATION_ID,
      name: 'Chinese Chess Club',
      description: 'Head-to-head Chinese chess with ratings, reconnect grace, and typed realtime deltas.',
    });

    await ctx.commands.register({
      id: 'create_match',
      description: 'Create a Chinese chess match.',
      inputSchema: {
        roomName: { type: 'string' },
        visibility: { type: 'string' },
      },
      handler: async (input, runtimeCtx) => {
        const session = requireSession(runtimeCtx);
        const current = await getCurrentMatch(ctx, session.agentId);
        if (current?.phase === 'playing' || current?.phase === 'waiting') {
          throw createError('You are already in a match.', 'MATCH_ALREADY_ACTIVE');
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
          players: [{
            agentId: session.agentId,
            userId: session.userId,
            agentName: session.agentName,
            side: null,
            ready: false,
            connected: true,
            disconnectDeadlineAt: null,
          }],
          positionFen: DEFAULT_POSITION_FEN,
          moveHistory: [],
          clocks: {
            redMs: INITIAL_TIME_MS,
            blackMs: INITIAL_TIME_MS,
          },
          turnStartedAt: null,
          drawOfferBy: null,
          result: null,
        };
        await getOrCreateRating(ctx, session.agentId, session.userId, session.agentName);
        await saveMatch(ctx, match);
        await setAgentMatchId(ctx, session.agentId, match.matchId);
        grantRoomAccess(session.agentId, match.matchId);
        await emitRoomVisibilityTransition(ctx, null, match);
        await ctx.logging.info('chinese-chess.audit', {
          userId: session.userId,
          agentId: session.agentId,
          locationId: CHINESE_CHESS_LOCATION_ID,
          actionType: 'chinese_chess_create_match',
          payload: { matchId: match.matchId, roomName: match.roomName, visibility: match.visibility },
          result: 'success',
        });
        return withGuide({
          matchId: match.matchId,
          state: matchState(match, session.agentId),
        }, createCommandGuide('create_match'));
      },
    });

    await ctx.commands.register({
      id: 'list_matches',
      description: 'List joinable waiting rooms.',
      inputSchema: {},
      controlPolicy: { controllerRequired: false },
      handler: async (_input, runtimeCtx) => {
        ensureHallOrMatch(runtimeCtx, await getCurrentMatch(ctx, requireSession(runtimeCtx).agentId));
        const matches = (await listCollection(ctx, 'matches'))
          .filter((match) => isJoinableWaitingRoom(match))
          .map((match) => matchSummary(ctx, match));
        return withGuide({ matches }, createCommandGuide('list_matches'));
      },
    });

    await ctx.commands.register({
      id: 'list_rooms',
      description: 'List public rooms or search by room code.',
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
          const privateMatch = matches.find(
            (match) =>
              match.matchId.toLowerCase() === query &&
              match.visibility === 'private' &&
              (match.phase === 'waiting' || match.phase === 'playing'),
          );
          if (privateMatch) {
            grantRoomAccess(session.agentId, privateMatch.matchId);
            if (!rooms.some((room) => room.matchId === privateMatch.matchId)) {
              rooms.unshift(matchSummary(ctx, privateMatch));
            }
          }
        }

        return withGuide({
          rooms: rooms.slice(0, limit),
          directoryVersion: await getRoomDirectoryVersion(ctx),
          query: rawQuery || null,
        }, createCommandGuide('list_rooms'));
      },
    });

    await ctx.commands.register({
      id: 'join_match',
      description: 'Join a waiting Chinese chess match.',
      inputSchema: { matchId: { type: 'string' } },
      handler: async (input, runtimeCtx) => {
        const session = requireSession(runtimeCtx);
        const current = await getCurrentMatch(ctx, session.agentId);
        ensureHallOrMatch(runtimeCtx, current);
        const targetMatchId = String(input?.matchId ?? '');
        if (current?.phase === 'playing' || current?.phase === 'waiting') {
          if (current.matchId !== targetMatchId) {
            throw createError('You are already in a match.', 'MATCH_ALREADY_ACTIVE');
          }
          return withGuide({ state: matchState(current, session.agentId) }, createCommandGuide('join_match'));
        }
        if (current?.phase === 'finished') {
          await clearAgentMatchId(ctx, session.agentId);
        }
        const match = await getMatch(ctx, targetMatchId);
        if (!match || !canJoinMatch(match, session.agentId)) {
          throw createError('Match not found.', 'MATCH_NOT_FOUND');
        }
        if (match.players.length >= 2) {
          throw createError('Match is full.', 'MATCH_FULL');
        }
        if (match.players.some((player) => player.agentId === session.agentId)) {
          return withGuide({ state: matchState(match, session.agentId) }, createCommandGuide('join_match'));
        }
        const previousMatch = structuredClone(match);
        match.players.push({
          agentId: session.agentId,
          userId: session.userId,
          agentName: session.agentName,
          side: null,
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
          agentId: session.agentId,
          player: playerPublicState(getPlayer(match, session.agentId)),
        });
        return withGuide({ state: matchState(match, session.agentId) }, createCommandGuide('join_match'));
      },
    });

    await ctx.commands.register({
      id: 'bootstrap',
      description: 'Fetch a full Chinese chess bootstrap snapshot.',
      inputSchema: { limit: { type: 'number' } },
      handler: async (input, runtimeCtx) => {
        const session = requireSession(runtimeCtx);
        const current = await getCurrentMatch(ctx, session.agentId);
        ensureHallOrMatch(runtimeCtx, current);
        return {
          guide: createBootstrapGuide(),
          currentMatch: current ? matchState(current, session.agentId) : null,
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
      description: 'Watch a public or authorized private room.',
      inputSchema: { matchId: { type: 'string' } },
      controlPolicy: { controllerRequired: false },
      handler: async (input, runtimeCtx) => {
        const session = requireSession(runtimeCtx);
        ensureHallOrMatch(runtimeCtx, await getCurrentMatch(ctx, session.agentId));
        const match = await getMatch(ctx, String(input?.matchId ?? ''));
        if (!match || !canWatchMatch(match, session.agentId)) {
          throw createError('Match not found.', 'MATCH_NOT_FOUND');
        }
        await setWatchedRoom(ctx, session.agentId, match.matchId);
        return withGuide({
          room: matchSummary(ctx, match),
          state: matchState(match, session.agentId),
        }, createCommandGuide('watch_room'));
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
          return withGuide({ matchId: null }, createCommandGuide('unwatch_room'));
        }
        const cleared = await clearWatchedRoom(ctx, session.agentId);
        return withGuide({ matchId: cleared }, createCommandGuide('unwatch_room'));
      },
    });

    await ctx.commands.register({
      id: 'leave_match',
      description: 'Leave a waiting match.',
      inputSchema: {},
      handler: async (_input, runtimeCtx) => {
        const session = requireSession(runtimeCtx);
        const match = await getCurrentMatch(ctx, session.agentId);
        if (!match) {
          throw createError('No active match.', 'MATCH_NOT_FOUND');
        }
        if (match.phase === 'playing') {
          throw createError('You cannot leave during an active match.', 'MATCH_IN_PROGRESS');
        }
        const next = await removeWaitingPlayer(ctx, match, session.agentId);
        return withGuide({
          state: next ? matchState(next, next.players[0]?.agentId ?? session.agentId) : null,
        }, createCommandGuide('leave_match'));
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
          throw createError('No waiting match to ready up in.', 'MATCH_NOT_FOUND');
        }
        const previousMatch = structuredClone(match);
        const player = getPlayer(match, session.agentId);
        player.ready = true;
        match.seq += 1;
        let started = false;
        if (match.players.length === 2 && match.players.every((entry) => entry.ready)) {
          match.phase = 'playing';
          match.players[0].side = 'red';
          match.players[1].side = 'black';
          match.positionFen = DEFAULT_POSITION_FEN;
          match.moveHistory = [];
          match.clocks = { redMs: INITIAL_TIME_MS, blackMs: INITIAL_TIME_MS };
          match.turnStartedAt = now();
          match.drawOfferBy = null;
          match.result = null;
          started = true;
          await saveMatch(ctx, match);
          await emitRoomDelta(ctx, match);
          await emitRoomVisibilityTransition(ctx, previousMatch, match);
          installTurnTimer(ctx, match);
          await emitMatchDelta(ctx, match, 'game_started', {
            sideToMove: 'red',
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
        return withGuide({
          state: matchState(match, session.agentId),
          started,
        }, createCommandGuide('ready'));
      },
    });

    await ctx.commands.register({
      id: 'unready',
      description: 'Cancel readiness in a waiting match.',
      inputSchema: {},
      handler: async (_input, runtimeCtx) => {
        const session = requireSession(runtimeCtx);
        const match = await getCurrentMatch(ctx, session.agentId);
        if (!match || match.phase !== 'waiting') {
          throw createError('No waiting match to cancel readiness in.', 'MATCH_NOT_FOUND');
        }

        const player = getPlayer(match, session.agentId);
        if (!player.ready) {
          throw createError('This seat is not currently marked ready.', 'PLAYER_NOT_READY');
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

        return withGuide({
          state: matchState(match, session.agentId),
        }, createCommandGuide('unready'));
      },
    });

    await ctx.commands.register({
      id: 'move',
      description: 'Make a move.',
      inputSchema: {
        from: { type: 'string' },
        to: { type: 'string' },
        iccs: { type: 'string' },
      },
      handler: async (input, runtimeCtx) => {
        const session = requireSession(runtimeCtx);
        const match = await getCurrentMatch(ctx, session.agentId);
        if (!match || match.phase !== 'playing') {
          throw createError('No active game.', 'MATCH_NOT_FOUND');
        }
        const player = getPlayer(match, session.agentId);
        const side = currentTurn(match);
        if (!side || player.side !== side) {
          throw createError('It is not your turn.', 'NOT_YOUR_TURN');
        }

        const clock = consumeClock(match);
        if (clock && clock.remaining <= 0) {
          const winnerSide = otherSide(side);
          const winner = match.players.find((entry) => entry.side === winnerSide);
          return withGuide({
            state: await finishMatch(ctx, match, winnerSide === 'red' ? 'red_win' : 'black_win', 'timeout', winner?.agentId ?? null, session.agentId),
          }, createCommandGuide('move'));
        }

        const iccs = typeof input?.iccs === 'string' && input.iccs.trim() !== ''
          ? input.iccs.trim().toLowerCase()
          : `${String(input?.from ?? '').toLowerCase()}${String(input?.to ?? '').toLowerCase()}`;
        if (!/^[a-i][0-9][a-i][0-9]$/.test(iccs)) {
          throw createError('Invalid move coordinates.', 'INVALID_MOVE');
        }

        const previousMatch = structuredClone(match);
        const engine = replayMatch(match);
        let record;
        try {
          record = engine.play(iccs);
        } catch {
          throw createError('Illegal move.', 'ILLEGAL_MOVE');
        }
        const snapshot = engine.snapshot();
        match.positionFen = snapshot.positionFen;
        match.moveHistory.push(record);
        match.drawOfferBy = null;
        match.seq += 1;
        match.turnStartedAt = now();

        if (snapshot.result) {
          const winnerSide = snapshot.result.result === 'draw'
            ? null
            : snapshot.result.result === 'red_win'
              ? 'red'
              : 'black';
          const winner = match.players.find((entry) => entry.side === winnerSide);
          return withGuide({
            state: await finishMatch(ctx, match, snapshot.result.result, snapshot.result.reason, winner?.agentId ?? null, session.agentId),
          }, createCommandGuide('move'));
        }

        await saveMatch(ctx, match);
        installTurnTimer(ctx, match);
        await emitRoomDelta(ctx, match);
        await emitMatchDelta(ctx, match, 'move_made', {
          move: record,
          sideToMove: snapshot.sideToMove,
          clocks: match.clocks,
          inCheck: snapshot.inCheck,
          drawOfferBy: null,
        });
        await emitRoomVisibilityTransition(ctx, previousMatch, match);
        emitTurnPrompt(ctx, match);
        return withGuide({
          state: matchState(match, session.agentId),
        }, createCommandGuide('move'));
      },
    });

    await ctx.commands.register({
      id: 'resign',
      description: 'Resign the current match.',
      inputSchema: {},
      handler: async (_input, runtimeCtx) => {
        const session = requireSession(runtimeCtx);
        const match = await getCurrentMatch(ctx, session.agentId);
        if (!match || match.phase !== 'playing') {
          throw createError('No active game.', 'MATCH_NOT_FOUND');
        }
        const player = getPlayer(match, session.agentId);
        const winnerSide = player.side ? otherSide(player.side) : null;
        const winner = match.players.find((entry) => entry.side === winnerSide);
        return withGuide({
          state: await finishMatch(ctx, match, winnerSide === 'red' ? 'red_win' : 'black_win', 'resignation', winner?.agentId ?? null, session.agentId),
        }, createCommandGuide('resign'));
      },
    });

    await ctx.commands.register({
      id: 'offer_draw',
      description: 'Offer a draw.',
      inputSchema: {},
      handler: async (_input, runtimeCtx) => {
        const session = requireSession(runtimeCtx);
        const match = await getCurrentMatch(ctx, session.agentId);
        if (!match || match.phase !== 'playing') {
          throw createError('No active game.', 'MATCH_NOT_FOUND');
        }
        if (match.drawOfferBy) {
          throw createError('A draw offer is already active.', 'DRAW_ALREADY_OFFERED');
        }
        match.drawOfferBy = session.agentId;
        const previousMatch = structuredClone(match);
        match.seq += 1;
        await saveMatch(ctx, match);
        await emitRoomDelta(ctx, match);
        await emitMatchDelta(ctx, match, 'draw_offered', {
          drawOfferBy: session.agentId,
        });
        await emitRoomVisibilityTransition(ctx, previousMatch, match);
        return withGuide({
          state: matchState(match, session.agentId),
        }, createCommandGuide('offer_draw'));
      },
    });

    await ctx.commands.register({
      id: 'accept_draw',
      description: 'Accept a draw offer.',
      inputSchema: {},
      handler: async (_input, runtimeCtx) => {
        const session = requireSession(runtimeCtx);
        const match = await getCurrentMatch(ctx, session.agentId);
        if (!match || match.phase !== 'playing' || !match.drawOfferBy || match.drawOfferBy === session.agentId) {
          throw createError('No draw offer to accept.', 'DRAW_NOT_AVAILABLE');
        }
        return withGuide({
          state: await finishMatch(ctx, match, 'draw', 'draw_agreement', null, session.agentId),
        }, createCommandGuide('accept_draw'));
      },
    });

    await ctx.commands.register({
      id: 'decline_draw',
      description: 'Decline a draw offer.',
      inputSchema: {},
      handler: async (_input, runtimeCtx) => {
        const session = requireSession(runtimeCtx);
        const match = await getCurrentMatch(ctx, session.agentId);
        if (!match || match.phase !== 'playing' || !match.drawOfferBy || match.drawOfferBy === session.agentId) {
          throw createError('No draw offer to decline.', 'DRAW_NOT_AVAILABLE');
        }
        match.drawOfferBy = null;
        const previousMatch = structuredClone(match);
        match.seq += 1;
        await saveMatch(ctx, match);
        await emitRoomDelta(ctx, match);
        await emitMatchDelta(ctx, match, 'draw_declined', {});
        await emitRoomVisibilityTransition(ctx, previousMatch, match);
        emitTurnPrompt(ctx, match);
        return withGuide({
          state: matchState(match, session.agentId),
        }, createCommandGuide('decline_draw'));
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
          throw createError('Match not found.', 'MATCH_NOT_FOUND');
        }
        return withGuide(matchState(match, session.agentId), createCommandGuide('state'));
      },
    });

    await ctx.commands.register({
      id: 'rating',
      description: 'View your Elo rating.',
      inputSchema: {},
      controlPolicy: { controllerRequired: false },
      handler: async (_input, runtimeCtx) => {
        const session = requireSession(runtimeCtx);
        return withGuide(await getOrCreateRating(ctx, session.agentId, session.userId, session.agentName), createCommandGuide('rating'));
      },
    });

    await ctx.commands.register({
      id: 'leaderboard',
      description: 'View the Elo leaderboard.',
      inputSchema: { limit: { type: 'number' } },
      controlPolicy: { controllerRequired: false },
      handler: async (input) => withGuide({
        leaderboard: await getLeaderboard(ctx, Number(input?.limit ?? 20) || 20),
      }, createCommandGuide('leaderboard')),
    });

    await ctx.policies.register({
      id: 'prevent-leave-during-active-match',
      kind: 'location-leave',
      handler: async (payload) => {
        if (payload.locationId !== PUBLIC_LOCATION_ID || !payload.session?.agentId) return;
        const match = await getCurrentMatch(ctx, payload.session.agentId);
        if (match?.phase === 'playing') {
          throw createError('You cannot leave Chinese Chess Club during an active match.', 'MATCH_IN_PROGRESS');
        }
      },
    });

    await ctx.events.subscribe('location.entered', async (payload) => {
      if (payload.locationId !== PUBLIC_LOCATION_ID || !payload.session?.agentId || !payload.ctx?.gateway || !payload.ctx?.ws) return;
      const currentMatchId = await getAgentMatchId(ctx, payload.session.agentId);
      payload.ctx.gateway.send(payload.ctx.ws, {
        id: '',
        type: EVENT_TYPES.welcome,
        payload: {
          locationId: PUBLIC_LOCATION_ID,
          needsBootstrap: true,
          currentMatchId,
          wakeText: createWelcomeWakeText(currentMatchId),
          guide: createWelcomeGuide(currentMatchId),
        },
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
      const currentMatchId = recovered?.matchId ?? await getAgentMatchId(ctx, payload.session.agentId);
      payload.ctx.gateway.send(payload.ctx.ws, {
        id: '',
        type: EVENT_TYPES.reconnected,
        payload: {
          needsBootstrap: true,
          currentMatchId,
          wakeText: createReconnectedWakeText(currentMatchId),
          guide: createReconnectedGuide(currentMatchId),
        },
      });
      const currentMatch = await getCurrentMatch(ctx, payload.session.agentId);
      if (currentMatch && currentMatch.phase === 'playing') {
        const player = currentMatch.players.find((entry) => entry.agentId === payload.session.agentId);
        if (player?.side === currentTurn(currentMatch)) {
          emitTurnPrompt(ctx, currentMatch);
        }
      }
    });
  },
};
