import { randomUUID } from 'crypto';
import { Chess } from 'chess.js';

const PLUGIN_ID = 'uruc.chess';
const CHESS_LOCATION_ID = 'chess-club';
const PUBLIC_LOCATION_ID = `${PLUGIN_ID}.${CHESS_LOCATION_ID}`;
const INITIAL_RATING = 1500;
const K_FACTOR = 40;
const INITIAL_TIME_MS = 10 * 60 * 1000;
const TURN_REMINDER_MS = 20 * 1000;
const RECONNECT_GRACE_MS = 60 * 1000;
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

function createGuide(summary, whyYouReceivedThis, whatToDoNow, recommendedCommands, fieldGlossary = []) {
  return {
    summary,
    whyYouReceivedThis,
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

function buildLegalMoves(chess, viewer) {
  if (!viewer || viewer.color !== chess.turn()) return [];
  return chess.moves({ verbose: true }).map((move) => ({
    from: move.from,
    to: move.to,
    san: move.san,
    promotion: move.promotion ?? null,
  }));
}

function remainingMsForColor(match, color) {
  const key = color === 'w' ? 'whiteMs' : 'blackMs';
  if (match.phase !== 'playing' || match.turnStartedAt === null || currentTurn(match) !== color) {
    return match.clocks[key];
  }
  return Math.max(0, match.clocks[key] - Math.max(0, now() - match.turnStartedAt));
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

function createBootstrapGuide() {
  return createGuide(
    'Chess Hall is a two-seat timed chess venue with Elo ratings, reconnect recovery, and standard chess win and draw conditions.',
    'You asked the chess plugin for the full bootstrap snapshot for the current session.',
    `Use ${COMMAND_IDS.createMatch} to open a room, ${COMMAND_IDS.listRooms} to inspect public rooms or search by room code, or ${COMMAND_IDS.state} to inspect your current match in more detail.`,
    [COMMAND_IDS.createMatch, COMMAND_IDS.listRooms, COMMAND_IDS.joinMatch, COMMAND_IDS.state, COMMAND_IDS.listMatches],
    [
      guideField('currentMatch', 'Your current authoritative match snapshot, or null if you are not linked to a room.'),
      guideField('joinableMatches', 'Visible waiting rooms that can still be joined.'),
      guideField('lobbyVersion', 'A monotonic version number for public lobby updates.'),
      guideField('rating', 'Your current Elo record for this venue.'),
      guideField('leaderboard', 'Top Elo entries currently known to the venue.'),
    ],
  );
}

function createCommandGuide(kind) {
  switch (kind) {
    case 'list_matches':
      return createGuide(
        'This is the current list of joinable chess rooms.',
        'You asked the chess plugin for waiting rooms that are still open to join.',
        `Call ${COMMAND_IDS.joinMatch} with a matchId to take an open seat, ${COMMAND_IDS.listRooms} to inspect public rooms in more detail, or ${COMMAND_IDS.createMatch} to open a new room.`,
        [COMMAND_IDS.joinMatch, COMMAND_IDS.listRooms, COMMAND_IDS.createMatch, COMMAND_IDS.bootstrap],
        [
          guideField('matches', 'Waiting rooms that can currently be joined.'),
        ],
      );
    case 'list_rooms':
      return createGuide(
        'This is the current room directory slice for Chess Hall.',
        'You asked the chess plugin to list public rooms or to search for a room by name or room code.',
        `Call ${COMMAND_IDS.watchRoom} to spectate one of these rooms, or ${COMMAND_IDS.joinMatch} to take an open seat in a waiting room.`,
        [COMMAND_IDS.watchRoom, COMMAND_IDS.joinMatch, COMMAND_IDS.createMatch, COMMAND_IDS.bootstrap],
        [
          guideField('rooms', 'Public waiting or playing rooms, plus a private room only when the query exactly matches its room code.'),
          guideField('directoryVersion', 'A monotonic version number for public room-directory updates.'),
          guideField('query', 'The normalized search text used for this directory slice, or null when unfiltered.'),
        ],
      );
    case 'create_match':
      return createGuide(
        'A new chess room was created and linked to this agent.',
        'You asked the chess plugin to create a waiting room.',
        `Wait for another agent to join, then call ${COMMAND_IDS.ready}. Use ${COMMAND_IDS.state} if you need the latest authoritative room snapshot.`,
        [COMMAND_IDS.ready, COMMAND_IDS.state, COMMAND_IDS.leaveMatch],
        [
          guideField('matchId', 'The newly created room id.'),
          guideField('state', 'The authoritative room snapshot after creation.'),
        ],
      );
    case 'join_match':
      return createGuide(
        'This agent joined a waiting chess room.',
        'You asked the chess plugin to join an existing room.',
        `If this room is correct, call ${COMMAND_IDS.ready}. If not, call ${COMMAND_IDS.leaveMatch} before the game starts.`,
        [COMMAND_IDS.ready, COMMAND_IDS.state, COMMAND_IDS.leaveMatch],
        [
          guideField('state', 'The authoritative room snapshot after joining.'),
        ],
      );
    case 'watch_room':
      return createGuide(
        'This agent is now watching a chess room.',
        'You asked the chess plugin to spectate a room without taking a player seat.',
        `Observe future ${'chess_room_delta'} pushes for realtime updates. If an open waiting seat appears and you want it, call ${COMMAND_IDS.joinMatch}.`,
        [COMMAND_IDS.joinMatch, COMMAND_IDS.state, COMMAND_IDS.unwatchRoom, COMMAND_IDS.listRooms],
        [
          guideField('room', 'The current summary for the room being watched.'),
          guideField('state', 'The authoritative snapshot of the watched room for this agent.'),
        ],
      );
    case 'unwatch_room':
      return createGuide(
        'This agent is no longer watching a chess room.',
        'You asked the chess plugin to clear the current spectator registration.',
        `No more room-specific spectator pushes will be sent. Use ${COMMAND_IDS.listRooms} to choose another room or ${COMMAND_IDS.createMatch} to open your own.`,
        [COMMAND_IDS.listRooms, COMMAND_IDS.watchRoom, COMMAND_IDS.createMatch],
        [
          guideField('matchId', 'The room that stopped being watched, or null when no watcher was active.'),
        ],
      );
    case 'leave_match':
      return createGuide(
        'This agent left its waiting chess room.',
        'You asked the chess plugin to leave a non-started room.',
        `No more action is required. Call ${COMMAND_IDS.listRooms} or ${COMMAND_IDS.listMatches} to find another room, or ${COMMAND_IDS.createMatch} to open a fresh one.`,
        [COMMAND_IDS.listRooms, COMMAND_IDS.listMatches, COMMAND_IDS.createMatch, COMMAND_IDS.bootstrap],
        [
          guideField('state', 'The remaining room snapshot if one still exists, or null if the room closed.'),
        ],
      );
    case 'ready':
      return createGuide(
        'This seat is marked ready.',
        'You asked the chess plugin to ready the current seat.',
        `If both seats are ready, wait for turn prompts or inspect ${COMMAND_IDS.state}. Otherwise you can wait, call ${COMMAND_IDS.unready}, or leave the room.`,
        [COMMAND_IDS.state, COMMAND_IDS.unready, COMMAND_IDS.leaveMatch],
        [
          guideField('state', 'The authoritative room snapshot after the ready action.'),
          guideField('started', 'Whether the room transitioned from waiting to playing.'),
        ],
      );
    case 'unready':
      return createGuide(
        'This seat is no longer marked ready.',
        'You asked the chess plugin to cancel readiness for the current waiting seat.',
        `Wait in the room, call ${COMMAND_IDS.ready} again when you want to start, or leave with ${COMMAND_IDS.leaveMatch}.`,
        [COMMAND_IDS.ready, COMMAND_IDS.state, COMMAND_IDS.leaveMatch],
        [
          guideField('state', 'The authoritative room snapshot after readiness was cancelled.'),
        ],
      );
    case 'move':
      return createGuide(
        'A legal move was accepted and the authoritative chess state advanced.',
        'You asked the chess plugin to make a move in an active match.',
        `If the game is still live, wait for the next ${'chess_turn_prompt'} or inspect ${COMMAND_IDS.state}. If the game ended, review result and rating changes in state.`,
        [COMMAND_IDS.state, COMMAND_IDS.offerDraw, COMMAND_IDS.resign],
        [
          guideField('state', 'The authoritative match snapshot after the move was applied.'),
        ],
      );
    case 'resign':
      return createGuide(
        'This agent resigned the current chess match.',
        'You asked the chess plugin to concede an active game.',
        `Review the terminal state and rating changes, then use ${COMMAND_IDS.bootstrap} or ${COMMAND_IDS.listMatches} to find your next room.`,
        [COMMAND_IDS.state, COMMAND_IDS.bootstrap, COMMAND_IDS.listMatches],
        [
          guideField('state', 'The terminal authoritative match snapshot after resignation.'),
        ],
      );
    case 'offer_draw':
      return createGuide(
        'A draw offer is now active in the current game.',
        'You asked the chess plugin to offer a draw.',
        `Wait for the opponent to accept or decline, or inspect ${COMMAND_IDS.state} if you need the latest authoritative snapshot.`,
        [COMMAND_IDS.state, COMMAND_IDS.declineDraw, COMMAND_IDS.resign],
        [
          guideField('state', 'The authoritative match snapshot after the draw offer was recorded.'),
        ],
      );
    case 'accept_draw':
      return createGuide(
        'The current game was settled as a draw by agreement.',
        'You asked the chess plugin to accept an active draw offer.',
        `Review the terminal state and rating changes, then leave the finished room context by using ${COMMAND_IDS.bootstrap} when needed.`,
        [COMMAND_IDS.state, COMMAND_IDS.bootstrap, COMMAND_IDS.listMatches],
        [
          guideField('state', 'The terminal authoritative match snapshot after the draw was accepted.'),
        ],
      );
    case 'decline_draw':
      return createGuide(
        'The active draw offer was declined and normal play continues.',
        'You asked the chess plugin to decline an opponent draw offer.',
        `If it is now this agent's turn, wait for ${'chess_turn_prompt'} or inspect ${COMMAND_IDS.state} to choose a move.`,
        [COMMAND_IDS.state, COMMAND_IDS.move, COMMAND_IDS.resign],
        [
          guideField('state', 'The authoritative match snapshot after the draw offer was cleared.'),
        ],
      );
    case 'state':
      return createGuide(
        'This is the latest authoritative snapshot for the requested chess match.',
        'You asked the chess plugin for current match state.',
        `Use legalMoves only when this agent is the seated side to move. Spectators receive structural room state but no legal move list.`,
        [COMMAND_IDS.move, COMMAND_IDS.offerDraw, COMMAND_IDS.resign, COMMAND_IDS.watchRoom],
        [
          guideField('roomName', 'Human-readable room label for the match.'),
          guideField('visibility', 'Whether the room is public or private.'),
          guideField('legalMoves', 'Legal moves for this agent only when it is currently that agent’s turn; otherwise empty.'),
          guideField('clocks', 'Remaining wall-clock time for white and black from the last authoritative update.'),
          guideField('result', 'Terminal result data when the game is finished; null otherwise.'),
        ],
      );
    case 'rating':
      return createGuide(
        'This is the current Elo record for the requesting agent.',
        'You asked the chess plugin for the current rating record.',
        `Use ${COMMAND_IDS.leaderboard} to compare against the venue table or ${COMMAND_IDS.bootstrap} for the full venue snapshot.`,
        [COMMAND_IDS.leaderboard, COMMAND_IDS.bootstrap],
        [
          guideField('rating', 'Current Elo value for this agent.'),
          guideField('gamesPlayed', 'Completed rated games counted for this agent.'),
          guideField('wins', 'Rated wins recorded for this agent.'),
          guideField('losses', 'Rated losses recorded for this agent.'),
          guideField('draws', 'Rated draws recorded for this agent.'),
        ],
      );
    case 'leaderboard':
      return createGuide(
        'This is the current visible Elo leaderboard for Chess Hall.',
        'You asked the chess plugin for top rating entries.',
        `Use ${COMMAND_IDS.rating} for this agent’s own record or ${COMMAND_IDS.bootstrap} if you also need room and lobby state.`,
        [COMMAND_IDS.rating, COMMAND_IDS.bootstrap, COMMAND_IDS.listRooms, COMMAND_IDS.listMatches],
        [
          guideField('leaderboard', 'Sorted Elo entries returned by the venue.'),
        ],
      );
    default:
      return createGuide(
        'This is a chess plugin response.',
        'You asked the chess plugin to perform or explain a chess venue action.',
        `Use ${COMMAND_IDS.bootstrap} or ${COMMAND_IDS.state} if you need fresh authoritative state.`,
        [COMMAND_IDS.bootstrap, COMMAND_IDS.state],
      );
  }
}

function createWelcomeGuide(currentMatchId) {
  return createGuide(
    'You are connected to Chess Hall, a two-seat timed chess venue with Elo ratings and realtime match updates.',
    'You entered the chess hall location, so the plugin opened its event channel for this session.',
    currentMatchId
      ? `Call ${COMMAND_IDS.bootstrap} first. Then use ${COMMAND_IDS.state} if you want a focused snapshot for match ${currentMatchId}.`
      : `Call ${COMMAND_IDS.bootstrap} first. Then use ${COMMAND_IDS.listRooms} to inspect public rooms or ${COMMAND_IDS.createMatch} to open a new one.`,
    currentMatchId
      ? [COMMAND_IDS.bootstrap, COMMAND_IDS.state, COMMAND_IDS.listRooms, COMMAND_IDS.listMatches]
      : [COMMAND_IDS.bootstrap, COMMAND_IDS.listRooms, COMMAND_IDS.listMatches, COMMAND_IDS.createMatch],
    [
      guideField('locationId', 'The public location id for Chess Hall.'),
      guideField('needsBootstrap', 'When true, fetch fresh read models instead of assuming any local cache is current.'),
      guideField('currentMatchId', 'The room currently linked to this agent, or null if no room link exists.'),
    ],
  );
}

function createReconnectedGuide(currentMatchId) {
  return createGuide(
    'Your Chess Hall session has been restored.',
    'The current agent re-authenticated while the chess plugin still had relevant state for it.',
    currentMatchId
      ? `Refresh with ${COMMAND_IDS.bootstrap} or ${COMMAND_IDS.state} for match ${currentMatchId}. If it is your turn, also expect a ${'chess_turn_prompt'}.`
      : `Refresh with ${COMMAND_IDS.bootstrap}, then inspect the room directory with ${COMMAND_IDS.listRooms} if needed.`,
    currentMatchId
      ? [COMMAND_IDS.bootstrap, COMMAND_IDS.state, COMMAND_IDS.listRooms, COMMAND_IDS.listMatches]
      : [COMMAND_IDS.bootstrap, COMMAND_IDS.listRooms, COMMAND_IDS.listMatches, COMMAND_IDS.createMatch],
    [
      guideField('needsBootstrap', 'When true, discard stale assumptions and refetch venue state.'),
      guideField('currentMatchId', 'The linked room after reconnect, or null if no room was restored.'),
    ],
  );
}

function createLobbyDeltaGuide(kind) {
  let summary = 'A chess lobby room changed.';
  let nextStep = `Call ${COMMAND_IDS.listMatches} if you need a fresh waiting-room list.`;
  let recommended = [COMMAND_IDS.listMatches, COMMAND_IDS.state];

  if (kind === 'room_added') {
    summary = 'A new waiting chess room appeared in the public lobby.';
    nextStep = `No immediate action is required. Call ${COMMAND_IDS.joinMatch} if you want this seat, or ${COMMAND_IDS.listMatches} to refresh the lobby.`;
    recommended = [COMMAND_IDS.listMatches, COMMAND_IDS.joinMatch, COMMAND_IDS.createMatch];
  } else if (kind === 'room_updated') {
    summary = 'A waiting chess room changed state in the public lobby.';
    nextStep = `Refresh with ${COMMAND_IDS.listMatches}. If that room matters to you, inspect it with ${COMMAND_IDS.state} after joining it.`;
    recommended = [COMMAND_IDS.listMatches, COMMAND_IDS.joinMatch, COMMAND_IDS.state];
  } else if (kind === 'room_removed') {
    summary = 'A waiting chess room disappeared from the public lobby.';
    nextStep = `Drop stale references to that room. Use ${COMMAND_IDS.listMatches} or ${COMMAND_IDS.createMatch} if you still need a room.`;
    recommended = [COMMAND_IDS.listMatches, COMMAND_IDS.createMatch];
  }

  return createGuide(
    summary,
    'You are currently inside Chess Hall, so public waiting-room changes are pushed to this session.',
    nextStep,
    recommended,
    [
      guideField('kind', 'The lobby update kind: room_added, room_updated, or room_removed.'),
      guideField('version', 'A monotonic version number for the public lobby.'),
      guideField('matchId', 'The room affected by this lobby update.'),
      guideField('room', 'A summary of the affected waiting room when it still exists.'),
    ],
  );
}

function createRoomDirectoryDeltaGuide(kind) {
  let summary = 'A public chess room changed in the room directory.';
  let nextStep = `Call ${COMMAND_IDS.listRooms} if you need a fresh directory slice.`;
  let recommended = [COMMAND_IDS.listRooms, COMMAND_IDS.watchRoom];

  if (kind === 'room_added') {
    summary = 'A public chess room entered the room directory.';
    nextStep = `No immediate action is required. Call ${COMMAND_IDS.watchRoom} to spectate it or ${COMMAND_IDS.joinMatch} if it still has an open seat.`;
    recommended = [COMMAND_IDS.watchRoom, COMMAND_IDS.joinMatch, COMMAND_IDS.listRooms];
  } else if (kind === 'room_updated') {
    summary = 'A public chess room changed status or spectator count.';
    nextStep = `Refresh local directory state if you rely on room metadata such as phase, seats, or spectatorCount.`;
    recommended = [COMMAND_IDS.listRooms, COMMAND_IDS.watchRoom, COMMAND_IDS.joinMatch];
  } else if (kind === 'room_removed') {
    summary = 'A public chess room left the room directory.';
    nextStep = `Drop stale directory references to that room. If you still need to inspect it, rely on an existing watch or search again by room code when appropriate.`;
    recommended = [COMMAND_IDS.listRooms, COMMAND_IDS.createMatch];
  }

  return createGuide(
    summary,
    'You are inside Chess Hall, so public room-directory changes are pushed to this session.',
    nextStep,
    recommended,
    [
      guideField('kind', 'The directory update kind: room_added, room_updated, or room_removed.'),
      guideField('version', 'A monotonic version number for the public room directory.'),
      guideField('matchId', 'The room affected by this directory update.'),
      guideField('room', 'A current summary of the affected room when it still belongs in the directory.'),
    ],
  );
}

function createMatchDeltaGuide(kind) {
  let summary = 'A chess match state change was published.';
  let nextStep = `Call ${COMMAND_IDS.state} if you need the latest authoritative room snapshot.`;
  let recommended = [COMMAND_IDS.state, COMMAND_IDS.move];

  if (kind === 'player_joined') {
    summary = 'A second agent joined the waiting room.';
    nextStep = `If this is your room, wait for both seats to become ready, then watch ${COMMAND_IDS.state} for the transition into play.`;
    recommended = [COMMAND_IDS.ready, COMMAND_IDS.state, COMMAND_IDS.leaveMatch];
  } else if (kind === 'player_ready') {
    summary = 'A seated agent marked ready.';
    nextStep = `If this agent is also seated and not ready yet, call ${COMMAND_IDS.ready}. Otherwise wait for the room to start or cancel readiness with ${COMMAND_IDS.unready}.`;
    recommended = [COMMAND_IDS.ready, COMMAND_IDS.unready, COMMAND_IDS.state];
  } else if (kind === 'player_unready') {
    summary = 'A seated agent cancelled readiness.';
    nextStep = `Wait for both seats to become ready again, or call ${COMMAND_IDS.ready} when this agent is ready to start.`;
    recommended = [COMMAND_IDS.ready, COMMAND_IDS.state, COMMAND_IDS.leaveMatch];
  } else if (kind === 'player_left_waiting') {
    summary = 'A seated agent left the waiting room before the game started.';
    nextStep = `If you still want to play, wait for another agent or leave and create a new room.`;
    recommended = [COMMAND_IDS.state, COMMAND_IDS.leaveMatch, COMMAND_IDS.createMatch];
  } else if (kind === 'player_disconnected') {
    summary = 'A seated player disconnected from the room.';
    nextStep = 'If this is your agent, reconnect before the deadline if possible. Otherwise no immediate action is required.';
    recommended = [COMMAND_IDS.state];
  } else if (kind === 'player_reconnected') {
    summary = 'A previously disconnected player reconnected to the room.';
    nextStep = `Refresh with ${COMMAND_IDS.state} if you need current clocks or turn ownership.`;
    recommended = [COMMAND_IDS.state, COMMAND_IDS.move];
  } else if (kind === 'game_started') {
    summary = 'The room transitioned from waiting to an active chess game.';
    nextStep = `If this agent has the move, expect ${'chess_turn_prompt'}. Otherwise wait for the opponent move or inspect ${COMMAND_IDS.state}.`;
    recommended = [COMMAND_IDS.state, COMMAND_IDS.move, COMMAND_IDS.offerDraw];
  } else if (kind === 'move_made') {
    summary = 'A legal move was applied to the active chess game.';
    nextStep = `If it is now your turn, expect ${'chess_turn_prompt'} or inspect legalMoves in ${COMMAND_IDS.state}. Otherwise just observe the next update.`;
    recommended = [COMMAND_IDS.state, COMMAND_IDS.move, COMMAND_IDS.offerDraw];
  } else if (kind === 'draw_offered') {
    summary = 'A draw offer is active in the current game.';
    nextStep = `If you are the non-offering side, either call ${COMMAND_IDS.acceptDraw} or ${COMMAND_IDS.declineDraw}.`;
    recommended = [COMMAND_IDS.acceptDraw, COMMAND_IDS.declineDraw, COMMAND_IDS.state];
  } else if (kind === 'draw_declined') {
    summary = 'An active draw offer was declined.';
    nextStep = `Continue normal play. If it is your move, wait for ${'chess_turn_prompt'} or inspect ${COMMAND_IDS.state}.`;
    recommended = [COMMAND_IDS.state, COMMAND_IDS.move, COMMAND_IDS.offerDraw];
  } else if (kind === 'game_finished') {
    summary = 'The active chess game reached a terminal result.';
    nextStep = `No further moves are possible. Review state and rating changes, then use ${COMMAND_IDS.bootstrap} or ${COMMAND_IDS.listMatches} for your next room.`;
    recommended = [COMMAND_IDS.state, COMMAND_IDS.bootstrap, COMMAND_IDS.listMatches];
  }

  return createGuide(
    summary,
    'You received this because this agent is a participant in the affected chess room.',
    nextStep,
    recommended,
    [
      guideField('matchId', 'The room whose state changed.'),
      guideField('seq', 'A monotonic room update sequence number.'),
      guideField('kind', 'The specific match event that was emitted.'),
      guideField('phase', 'The room phase after this update was applied.'),
      guideField('state', 'A recipient-scoped authoritative room snapshot after this update.'),
    ],
  );
}

function createTurnPromptGuide(promptKind = 'turn') {
  if (promptKind === 'reminder') {
    return createGuide(
      'Reminder: this agent still has the move in an active chess game.',
      'No legal move has been recorded since the previous turn prompt, so the chess plugin is sending one follow-up reminder.',
      `Choose one move from legalMoves and call ${COMMAND_IDS.move} before remainingMs reaches zero. This reminder is only sent once for the current turn.`,
      [COMMAND_IDS.move, COMMAND_IDS.state, COMMAND_IDS.offerDraw, COMMAND_IDS.resign],
      [
        guideField('promptKind', 'Whether this payload is the initial turn prompt or the one-time follow-up reminder.'),
        guideField('reminder', 'True when this payload is the one-time 20 second reminder for the current turn.'),
        guideField('yourColor', 'The color controlled by this agent in the current game.'),
        guideField('remainingMs', 'Approximate remaining move time for this side at prompt emission time.'),
        guideField('state', 'The authoritative match snapshot for this agent at prompt emission time.'),
        guideField('legalMoves', 'All currently legal moves for this agent, including SAN and promotion metadata.'),
      ],
    );
  }

  return createGuide(
    'It is this agent’s turn in an active chess game.',
    'The chess plugin only sends this prompt to the seated agent whose move is currently due.',
    `Choose one move from legalMoves and call ${COMMAND_IDS.move} before remainingMs reaches zero. Use promotion when the selected legal move requires it.`,
    [COMMAND_IDS.move, COMMAND_IDS.state, COMMAND_IDS.offerDraw, COMMAND_IDS.resign],
    [
      guideField('promptKind', 'Whether this payload is the initial turn prompt or the one-time follow-up reminder.'),
      guideField('reminder', 'False for the initial turn prompt and true for the follow-up reminder.'),
      guideField('yourColor', 'The color controlled by this agent in the current game.'),
      guideField('remainingMs', 'Approximate remaining move time for this side at prompt emission time.'),
      guideField('state', 'The authoritative match snapshot for this agent at prompt emission time.'),
      guideField('legalMoves', 'All currently legal moves for this agent, including SAN and promotion metadata.'),
    ],
  );
}

function createRoomWatchGuide(match) {
  const nextStep = match.phase === 'waiting'
    ? `Watch for ${'chess_room_delta'} updates while the room fills, or call ${COMMAND_IDS.joinMatch} if you want to claim an open seat.`
    : match.phase === 'playing'
      ? `Observe future ${'chess_room_delta'} pushes for clocks, moves, and result changes.`
      : `Review the terminal state and use ${COMMAND_IDS.listRooms} or ${COMMAND_IDS.createMatch} when you want another room.`;

  return createGuide(
    'A watched chess room changed.',
    'You received this because this agent is currently registered as a spectator of the affected room.',
    nextStep,
    [COMMAND_IDS.state, COMMAND_IDS.joinMatch, COMMAND_IDS.unwatchRoom, COMMAND_IDS.listRooms],
    [
      guideField('matchId', 'The watched room whose authoritative state changed.'),
      guideField('seq', 'The room update sequence number at the time this spectator snapshot was emitted.'),
      guideField('phase', 'The room phase currently visible to the spectator.'),
      guideField('spectatorCount', 'Online spectators currently registered for this room, excluding seated players.'),
      guideField('state', 'The authoritative room snapshot for the current spectator session.'),
    ],
  );
}

function matchLabel(matchId, roomName) {
  const trimmed = typeof roomName === 'string' ? roomName.trim() : '';
  return trimmed ? `${trimmed} (${matchId})` : matchId;
}

function createWelcomeWakeText(currentMatchId) {
  return currentMatchId
    ? `Connected to Chess Hall. Refresh bootstrap, then inspect match ${currentMatchId} if needed.`
    : 'Connected to Chess Hall. Refresh bootstrap, then browse rooms or create a match.';
}

function createReconnectedWakeText(currentMatchId) {
  return currentMatchId
    ? `Chess Hall session restored. Refresh bootstrap or state for match ${currentMatchId}.`
    : 'Chess Hall session restored. Refresh bootstrap before acting.';
}

function createLobbyDeltaWakeText(kind, match) {
  const label = matchLabel(match.matchId, match.roomName);
  if (kind === 'room_added') return `New waiting room in lobby: ${label}. Refresh bootstrap if you care about the lobby.`;
  if (kind === 'room_removed') return `Lobby room removed: ${label}. Refresh bootstrap if you kept local lobby state.`;
  return `Lobby room updated: ${label}. Refresh bootstrap if you care about the lobby.`;
}

function createRoomDirectoryWakeText(kind, match) {
  const label = matchLabel(match.matchId, match.roomName);
  if (kind === 'room_added') return `Room directory added ${label}. Refresh rooms if you are browsing rooms.`;
  if (kind === 'room_removed') return `Room directory removed ${label}. Refresh rooms if you are browsing rooms.`;
  return `Room directory updated ${label}. Refresh rooms if you are browsing rooms.`;
}

function createMatchDeltaWakeText(kind, match, extra = {}) {
  const label = matchLabel(match.matchId, match.roomName);
  if (kind === 'player_joined') return `A player joined waiting room ${label}. Refresh match state if you need the latest seats.`;
  if (kind === 'player_ready') return `A seated player marked ready in ${label}. Refresh match state if you need the latest seats.`;
  if (kind === 'player_unready') return `A seated player cancelled ready in ${label}. Refresh match state if you need the latest seats.`;
  if (kind === 'player_left_waiting') return `A seated player left waiting room ${label}. Refresh match state if you need the latest seats.`;
  if (kind === 'player_disconnected') return `A seated player disconnected in ${label}. Refresh match state if you need deadlines or turn info.`;
  if (kind === 'player_reconnected') return `A seated player reconnected in ${label}. Refresh match state if you need clocks or turn info.`;
  if (kind === 'game_started') return `Game started in ${label}. Refresh match state for colors, clocks, and board.`;
  if (kind === 'move_made') {
    const san = typeof extra.move?.san === 'string' && extra.move.san.trim() !== '' ? extra.move.san.trim() : 'a move';
    return `Move played in ${label}: ${san}. Refresh match state if you need the latest board.`;
  }
  if (kind === 'draw_offered') return `A draw offer is active in ${label}. Refresh match state if you need the current board.`;
  if (kind === 'draw_declined') return `A draw offer was declined in ${label}. Refresh match state if you need the current board.`;
  if (kind === 'game_finished') return `Game finished in ${label}. Refresh match state for the final result and ratings.`;
  return `Match ${label} changed. Refresh match state if you need authoritative details.`;
}

function createRoomDeltaWakeText(match) {
  const label = matchLabel(match.matchId, match.roomName);
  return `Watched room changed: ${label}. Refresh room state if you are watching it.`;
}

function createTurnPromptWakeText(promptKind, match, state) {
  const label = matchLabel(match.matchId, match.roomName);
  if (promptKind === 'reminder') {
    return `Reminder: it is still your move in ${label}. Choose one legal move and submit it before time runs out.`;
  }
  if (state.moveCount > 0) {
    return `It is your move in ${label}. Refresh state if needed, then choose one legal move and submit it.`;
  }
  return `It is your first move in ${label}. Choose one legal move and submit it.`;
}

function requireSession(runtimeCtx) {
  if (!runtimeCtx.session) {
    throw createError('Authenticate your agent first.', 'NOT_AUTHENTICATED', 'auth');
  }
  return runtimeCtx.session;
}

function replayMatch(match) {
  const chess = new Chess();
  for (const move of match.moves ?? []) {
    chess.move(move);
  }
  return chess;
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
    color: player.color,
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
      ready: player.ready,
      connected: player.connected,
    })),
    createdAt: match.createdAt,
  };
}

function matchState(match, viewerAgentId) {
  const chess = replayMatch(match);
  const viewer = match.players.find((player) => player.agentId === viewerAgentId);
  return {
    matchId: match.matchId,
    roomName: match.roomName,
    visibility: match.visibility,
    phase: match.phase,
    seq: match.seq,
    serverTimestamp: now(),
    moveCount: (match.moves ?? []).length,
    fen: chess.fen(),
    pgn: chess.pgn(),
    turn: match.phase === 'playing' ? chess.turn() : null,
    inCheck: match.phase === 'playing' ? chess.inCheck() : false,
    clocks: match.clocks,
    drawOfferBy: match.drawOfferBy,
    players: match.players.map(playerPublicState),
    yourAgentId: viewer?.agentId,
    yourColor: viewer?.color ?? null,
    result: match.result,
    legalMoves: buildLegalMoves(chess, viewer),
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
  if (match.phase !== 'waiting' && match.phase !== 'playing' && !hasRoomAccess(agentId, match.matchId)) {
    return false;
  }
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

function sendToChessHall(ctx, type, payload) {
  for (const agentId of ctx.messaging.getOnlineAgentIds()) {
    if (ctx.messaging.getAgentCurrentLocation(agentId) !== PUBLIC_LOCATION_ID) continue;
    ctx.messaging.sendToAgent(agentId, type, payload);
  }
}

async function emitLobbyDelta(ctx, kind, match) {
  const version = await bumpLobbyVersion(ctx);
  sendToChessHall(ctx, 'chess_lobby_delta', {
    kind,
    version,
    matchId: match.matchId,
    needsBootstrap: true,
    wakeText: createLobbyDeltaWakeText(kind, match),
  });
}

async function emitRoomDirectoryDelta(ctx, kind, match) {
  const version = await bumpRoomDirectoryVersion(ctx);
  sendToChessHall(ctx, 'chess_room_directory_delta', {
    kind,
    version,
    matchId: match.matchId,
    needsRoomDirectoryRefresh: true,
    wakeText: createRoomDirectoryWakeText(kind, match),
  });
}

async function emitMatchDelta(ctx, match, kind, extra = {}) {
  for (const player of match.players) {
    ctx.messaging.sendToAgent(player.agentId, 'chess_match_delta', {
      matchId: match.matchId,
      seq: match.seq,
      kind,
      phase: match.phase,
      serverTimestamp: now(),
      needsMatchRefresh: true,
      ...(kind === 'game_finished' ? { needsBootstrap: true } : {}),
      ...(typeof extra.agentId === 'string' && extra.agentId !== '' ? { agentId: extra.agentId } : {}),
      ...(extra.move ? { move: extra.move } : {}),
      ...(typeof extra.drawOfferBy !== 'undefined' ? { drawOfferBy: extra.drawOfferBy } : {}),
      ...(typeof extra.reconnectDeadlineAt !== 'undefined' ? { reconnectDeadlineAt: extra.reconnectDeadlineAt } : {}),
      wakeText: createMatchDeltaWakeText(kind, match, extra),
    });
  }
}

async function emitRoomDelta(ctx, match) {
  for (const agentId of getSpectatorAgentIds(ctx, match)) {
    grantRoomAccess(agentId, match.matchId);
    ctx.messaging.sendToAgent(agentId, 'chess_room_delta', {
      matchId: match.matchId,
      seq: match.seq,
      phase: match.phase,
      serverTimestamp: now(),
      spectatorCount: getSpectatorCount(ctx, match),
      needsWatchedRoomRefresh: true,
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
  } else if (hadDirectory && hasDirectory && previousMatch.phase !== nextMatch.phase) {
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
  const state = matchState(match, player.agentId);
  ctx.messaging.sendToAgent(player.agentId, 'chess_turn_prompt', {
    matchId: match.matchId,
    seq: match.seq,
    serverTimestamp: now(),
    promptKind,
    reminder: promptKind === 'reminder',
    yourColor: player.color,
    remainingMs: remainingMsForColor(match, color),
    fen: state.fen,
    moveCount: state.moveCount,
    needsMatchRefresh: true,
    legalMoves: state.legalMoves,
    wakeText: createTurnPromptWakeText(promptKind, match, state),
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

function expectedScore(rating, opponentRating) {
  return 1 / (1 + 10 ** ((opponentRating - rating) / 400));
}

async function applyRatings(ctx, match, resultType) {
  const white = match.players.find((player) => player.color === 'w');
  const black = match.players.find((player) => player.color === 'b');
  if (!white || !black) {
    return {};
  }

  const whiteRating = await getOrCreateRating(ctx, white.agentId, white.userId, white.agentName);
  const blackRating = await getOrCreateRating(ctx, black.agentId, black.userId, black.agentName);

  const whiteScore = resultType === 'white_win' ? 1 : resultType === 'black_win' ? 0 : 0.5;
  const blackScore = resultType === 'black_win' ? 1 : resultType === 'white_win' ? 0 : 0.5;

  const whiteDelta = Math.round(K_FACTOR * (whiteScore - expectedScore(whiteRating.rating, blackRating.rating)));
  const blackDelta = Math.round(K_FACTOR * (blackScore - expectedScore(blackRating.rating, whiteRating.rating)));

  whiteRating.rating += whiteDelta;
  whiteRating.gamesPlayed += 1;
  whiteRating.wins += whiteScore === 1 ? 1 : 0;
  whiteRating.losses += whiteScore === 0 ? 1 : 0;
  whiteRating.draws += whiteScore === 0.5 ? 1 : 0;
  whiteRating.updatedAt = now();

  blackRating.rating += blackDelta;
  blackRating.gamesPlayed += 1;
  blackRating.wins += blackScore === 1 ? 1 : 0;
  blackRating.losses += blackScore === 0 ? 1 : 0;
  blackRating.draws += blackScore === 0.5 ? 1 : 0;
  blackRating.updatedAt = now();

  await ctx.storage.put('ratings', white.agentId, whiteRating);
  await ctx.storage.put('ratings', black.agentId, blackRating);

  return {
    [white.agentId]: whiteDelta,
    [black.agentId]: blackDelta,
  };
}

async function finishMatch(ctx, match, resultType, reason, winnerAgentId, viewerAgentId) {
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
  };
  match.drawOfferBy = null;
  await saveMatch(ctx, match);
  await emitRoomDelta(ctx, match);
  await emitMatchDelta(ctx, match, 'game_finished', {
    result: match.result,
    turn: null,
    drawOfferBy: null,
  });
  await emitRoomVisibilityTransition(ctx, previousMatch, match);
  return matchState(match, viewerAgentId);
}

function currentTurn(match) {
  return replayMatch(match).turn();
}

function otherColor(color) {
  return color === 'w' ? 'b' : 'w';
}

function getPlayer(match, agentId) {
  const player = match.players.find((entry) => entry.agentId === agentId);
  if (!player) {
    throw createError('You are not part of this match.', 'MATCH_NOT_FOUND');
  }
  return player;
}

function ensureHallOrMatch(runtimeCtx, match) {
  if (runtimeCtx.currentLocation === PUBLIC_LOCATION_ID || match) {
    return;
  }
  throw createError(`Enter Chess Hall with enter_location and locationId "${PUBLIC_LOCATION_ID}".`, 'NOT_IN_CHESS_LOCATION', 'enter_location', {
    locationId: PUBLIC_LOCATION_ID,
  });
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
    const loser = current.players.find((player) => player.color === color);
    const winner = current.players.find((player) => player.color === otherColor(color));
    await finishMatch(ctx, current, color === 'w' ? 'black_win' : 'white_win', 'timeout', winner?.agentId ?? null);
  }, Math.max(1, match.clocks[currentTurn(match) === 'w' ? 'whiteMs' : 'blackMs']));
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
  if (match.phase === 'playing' && player.color === currentTurn(match)) {
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
      const winner = current.players.find((entry) => entry.agentId !== agentId);
      await finishMatch(ctx, current, disconnected.color === 'w' ? 'black_win' : 'white_win', 'disconnect_timeout', winner?.agentId ?? null);
    }
  }, RECONNECT_GRACE_MS));
}

function consumeClock(match) {
  if (match.phase !== 'playing' || !match.turnStartedAt) return null;
  const turn = currentTurn(match);
  const elapsed = Math.max(0, now() - match.turnStartedAt);
  const key = turn === 'w' ? 'whiteMs' : 'blackMs';
  match.clocks[key] = Math.max(0, match.clocks[key] - elapsed);
  match.turnStartedAt = now();
  return { turn, elapsed, remaining: match.clocks[key] };
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
      id: CHESS_LOCATION_ID,
      name: 'Chess Hall',
      description: 'Head-to-head chess with ratings, reconnect grace, and typed realtime deltas.',
    });

    await ctx.commands.register({
      id: 'create_match',
      description: 'Create a chess match.',
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
            color: null,
            ready: false,
            connected: true,
            disconnectDeadlineAt: null,
          }],
          moves: [],
          clocks: {
            whiteMs: INITIAL_TIME_MS,
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
        await ctx.logging.info('chess.audit', {
          userId: session.userId,
          agentId: session.agentId,
          locationId: CHESS_LOCATION_ID,
          actionType: 'chess_create_match',
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
          const privateMatch = matches.find((match) => match.matchId.toLowerCase() === query && match.visibility === 'private' && (match.phase === 'waiting' || match.phase === 'playing'));
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
      description: 'Join a waiting chess match.',
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
        const match = await getMatch(ctx, String(input?.matchId ?? ''));
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
        return withGuide({ state: matchState(match, session.agentId) }, createCommandGuide('join_match'));
      },
    });

    await ctx.commands.register({
      id: 'bootstrap',
      description: 'Fetch a full chess bootstrap snapshot.',
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
          match.players[0].color = 'w';
          match.players[1].color = 'b';
          match.clocks = { whiteMs: INITIAL_TIME_MS, blackMs: INITIAL_TIME_MS };
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
            turn: 'w',
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
        promotion: { type: 'string' },
      },
      handler: async (input, runtimeCtx) => {
        const session = requireSession(runtimeCtx);
        const match = await getCurrentMatch(ctx, session.agentId);
        if (!match || match.phase !== 'playing') {
          throw createError('No active game.', 'MATCH_NOT_FOUND');
        }
        const player = getPlayer(match, session.agentId);
        const chess = replayMatch(match);
        const turn = chess.turn();
        if (player.color !== turn) {
          throw createError('It is not your turn.', 'NOT_YOUR_TURN');
        }
        const clock = consumeClock(match);
        if (clock && clock.remaining <= 0) {
          const winner = match.players.find((entry) => entry.color === otherColor(turn));
          return withGuide({
            state: await finishMatch(ctx, match, turn === 'w' ? 'black_win' : 'white_win', 'timeout', winner?.agentId ?? null, session.agentId),
          }, createCommandGuide('move'));
        }
        const move = chess.move({
          from: String(input?.from ?? '').toLowerCase(),
          to: String(input?.to ?? '').toLowerCase(),
          promotion: typeof input?.promotion === 'string' ? input.promotion.toLowerCase() : undefined,
        });
        if (!move) {
          throw createError('Illegal move.', 'ILLEGAL_MOVE');
        }
        const previousMatch = structuredClone(match);
        match.moves.push({
          from: move.from,
          to: move.to,
          promotion: move.promotion ?? undefined,
        });
        match.drawOfferBy = null;
        match.seq += 1;
        match.turnStartedAt = now();
        await saveMatch(ctx, match);

        if (chess.isGameOver()) {
          if (chess.isCheckmate()) {
            const winnerColor = otherColor(chess.turn());
            const winner = match.players.find((entry) => entry.color === winnerColor);
            return withGuide({
              state: await finishMatch(ctx, match, winnerColor === 'w' ? 'white_win' : 'black_win', 'checkmate', winner?.agentId ?? null, session.agentId),
            }, createCommandGuide('move'));
          }
          return withGuide({
            state: await finishMatch(ctx, match, 'draw', 'draw', null, session.agentId),
          }, createCommandGuide('move'));
        }

        installTurnTimer(ctx, match);
        await emitRoomDelta(ctx, match);
        await emitMatchDelta(ctx, match, 'move_made', {
          move: {
            from: move.from,
            to: move.to,
            san: move.san,
            promotion: move.promotion ?? null,
          },
          turn: chess.turn(),
          clocks: match.clocks,
          inCheck: chess.inCheck(),
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
        const winner = match.players.find((entry) => entry.agentId !== session.agentId);
        return withGuide({
          state: await finishMatch(ctx, match, player.color === 'w' ? 'black_win' : 'white_win', 'resignation', winner?.agentId ?? null, session.agentId),
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
          throw createError('You cannot leave the chess hall during an active match.', 'MATCH_IN_PROGRESS');
        }
      },
    });

    await ctx.events.subscribe('location.entered', async (payload) => {
      if (payload.locationId !== PUBLIC_LOCATION_ID || !payload.session?.agentId || !payload.ctx?.gateway || !payload.ctx?.ws) return;
      const currentMatchId = await getAgentMatchId(ctx, payload.session.agentId);
      payload.ctx.gateway.send(payload.ctx.ws, {
        id: '',
        type: 'chess_welcome',
        payload: {
          locationId: PUBLIC_LOCATION_ID,
          needsBootstrap: true,
          currentMatchId,
          wakeText: createWelcomeWakeText(currentMatchId),
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
      payload.ctx.gateway.send(payload.ctx.ws, {
        id: '',
        type: 'chess_reconnected',
        payload: {
          needsBootstrap: true,
          currentMatchId: recovered?.matchId ?? await getAgentMatchId(ctx, payload.session.agentId),
          wakeText: createReconnectedWakeText(recovered?.matchId ?? await getAgentMatchId(ctx, payload.session.agentId)),
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
