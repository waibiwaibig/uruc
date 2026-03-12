import {
  ARCADE_GAME_API_VERSION,
  type ArcadeGameAction,
  type ArcadeGameActionReceipt,
  type ArcadeGameActionSchema,
  type ArcadeGameDefinition,
  type ArcadeGameHostContext,
  type ArcadeGameResult,
  type ArcadeGameSession,
  type ArcadeGameSessionContext,
  type ArcadeJoinResult,
  type ArcadeLeaveReason,
  type ArcadeLeaveResult,
  type ArcadeNoticeKind,
  type ArcadePlayerIdentity,
  type ArcadePresentationHero,
  type ArcadePresentationRecap,
  type ArcadeSessionState,
  type ArcadeSessionStatus,
  type ArcadeTimelineEvent,
} from '../../types.js';

type Suit = 'S' | 'H' | 'D' | 'C';
type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
type HoldemPhase = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'between_hands';
type PlayerStatus =
  | 'joined'
  | 'ready'
  | 'acting'
  | 'checked'
  | 'called'
  | 'raised'
  | 'all_in'
  | 'folded'
  | 'settled'
  | 'waiting_next'
  | 'sitting_out'
  | 'skipped';

interface Card {
  suit: Suit;
  rank: Rank;
}

interface PlayerState {
  info: ArcadePlayerIdentity;
  connected: boolean;
  status: PlayerStatus;
  readyForNextHand: boolean;
  sittingOut: boolean;
  holeCards: Card[];
  committed: number;
  streetCommitted: number;
  frozen: number;
  availableStack: number;
  folded: boolean;
  allIn: boolean;
  actedThisStreet: boolean;
  pendingRemoval: boolean;
}

interface HandRank {
  category: number;
  values: number[];
  label: string;
}

interface PotSegment {
  amount: number;
  contenders: string[];
}

interface PotAward {
  amount: number;
  contenders: string[];
  winners: string[];
  winningLabel: string;
  detail: string;
}

interface RankedContender {
  state: PlayerState;
  rank: HandRank;
}

interface RoundResult {
  agentId: string;
  agentName: string;
  committed: number;
  won: number;
  delta: number;
  outcome: 'win' | 'loss' | 'draw';
  hand: string[];
  label: string;
  reason: string;
}

const SMALL_BLIND = 5;
const BIG_BLIND = 10;
const TURN_TIMEOUT_MS = 60_000;
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 6;
const TIMELINE_LIMIT = 24;

function rankValue(rank: Rank): number {
  switch (rank) {
    case 'A':
      return 14;
    case 'K':
      return 13;
    case 'Q':
      return 12;
    case 'J':
      return 11;
    default:
      return parseInt(rank, 10);
  }
}

function rankLabel(value: number): string {
  if (value === 14 || value === 1) return 'A';
  if (value === 13) return 'K';
  if (value === 12) return 'Q';
  if (value === 11) return 'J';
  return String(value);
}

function cardToString(card: Card): string {
  const suits: Record<Suit, string> = {
    S: '♠',
    H: '♥',
    D: '♦',
    C: '♣',
  };
  return `${card.rank}${suits[card.suit]}`;
}

function cardTone(card: string): 'light' | 'dark' {
  return card.includes('♠') || card.includes('♣') ? 'dark' : 'light';
}

function createDeck(): Card[] {
  const suits: Suit[] = ['S', 'H', 'D', 'C'];
  const ranks: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const deck: Card[] = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

function shuffle(deck: Card[]): Card[] {
  const copy = [...deck];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function uniqueDescending(values: number[]): number[] {
  return Array.from(new Set(values)).sort((left, right) => right - left);
}

function straightHigh(values: number[]): number | null {
  const unique = uniqueDescending(values);
  if (unique[0] === 14) unique.push(1);

  let run = 1;
  for (let index = 1; index < unique.length; index += 1) {
    if (unique[index] === unique[index - 1] - 1) {
      run += 1;
      if (run >= 5) return unique[index - 4];
      continue;
    }
    run = 1;
  }
  return null;
}

function compareHandRank(left: HandRank, right: HandRank): number {
  if (left.category !== right.category) return left.category - right.category;
  for (let index = 0; index < Math.max(left.values.length, right.values.length); index += 1) {
    const delta = (left.values[index] ?? 0) - (right.values[index] ?? 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

function evaluateSevenCards(cards: Card[]): HandRank {
  const values = cards.map((card) => rankValue(card.rank));
  const counts = new Map<number, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  const groups = Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((left, right) => right.count - left.count || right.value - left.value);

  const bySuit = new Map<Suit, Card[]>();
  for (const card of cards) {
    const bucket = bySuit.get(card.suit) ?? [];
    bucket.push(card);
    bySuit.set(card.suit, bucket);
  }

  const flushCards = Array.from(bySuit.values()).find((bucket) => bucket.length >= 5);
  if (flushCards) {
    const flushStraight = straightHigh(flushCards.map((card) => rankValue(card.rank)));
    if (flushStraight) {
      return {
        category: 8,
        values: [flushStraight],
        label: flushStraight === 14 ? 'Royal Flush' : `Straight Flush, ${rankLabel(flushStraight)} high`,
      };
    }
  }

  const four = groups.find((group) => group.count === 4);
  if (four) {
    const kicker = groups.find((group) => group.value !== four.value)?.value ?? 0;
    return {
      category: 7,
      values: [four.value, kicker],
      label: `Four of a Kind, ${rankLabel(four.value)}s`,
    };
  }

  const triples = groups.filter((group) => group.count >= 3);
  if (triples.length > 0) {
    const topTriple = triples[0].value;
    const pairCandidate = groups.find((group) => group.value !== topTriple && group.count >= 2);
    if (pairCandidate) {
      return {
        category: 6,
        values: [topTriple, pairCandidate.value],
        label: `Full House, ${rankLabel(topTriple)}s over ${rankLabel(pairCandidate.value)}s`,
      };
    }
  }

  if (flushCards) {
    return {
      category: 5,
      values: uniqueDescending(flushCards.map((card) => rankValue(card.rank))).slice(0, 5),
      label: `Flush, ${rankLabel(uniqueDescending(flushCards.map((card) => rankValue(card.rank)))[0] ?? 0)} high`,
    };
  }

  const straight = straightHigh(values);
  if (straight) {
    return {
      category: 4,
      values: [straight],
      label: `Straight, ${rankLabel(straight)} high`,
    };
  }

  if (triples.length > 0) {
    const topTriple = triples[0].value;
    const kickers = groups
      .filter((group) => group.value !== topTriple)
      .map((group) => group.value)
      .slice(0, 2);
    return {
      category: 3,
      values: [topTriple, ...kickers],
      label: `Three of a Kind, ${rankLabel(topTriple)}s`,
    };
  }

  const pairs = groups.filter((group) => group.count >= 2);
  if (pairs.length >= 2) {
    const highPair = pairs[0].value;
    const lowPair = pairs[1].value;
    const kicker = groups.find((group) => group.value !== highPair && group.value !== lowPair)?.value ?? 0;
    return {
      category: 2,
      values: [highPair, lowPair, kicker],
      label: `Two Pair, ${rankLabel(highPair)}s and ${rankLabel(lowPair)}s`,
    };
  }

  if (pairs.length === 1) {
    const pair = pairs[0].value;
    const kickers = groups
      .filter((group) => group.value !== pair)
      .map((group) => group.value)
      .slice(0, 3);
    return {
      category: 1,
      values: [pair, ...kickers],
      label: `Pair of ${rankLabel(pair)}s`,
    };
  }

  return {
    category: 0,
    values: groups.map((group) => group.value).slice(0, 5),
    label: `High Card, ${rankLabel(groups[0]?.value ?? 0)}`,
  };
}

function playerStatusLabel(state: PlayerState): string {
  if (state.sittingOut) return 'Sitting out this hand';
  if (state.folded) return 'Folded';
  if (state.allIn) return 'All-in';
  switch (state.status) {
    case 'ready':
      return 'Ready for next hand';
    case 'checked':
      return 'Checked';
    case 'called':
      return 'Called';
    case 'raised':
      return 'Raised';
    case 'acting':
      return 'Taking action';
    case 'waiting_next':
      return 'Waiting for next hand';
    case 'skipped':
      return 'Skipped this hand';
    case 'settled':
      return 'Hand finished';
    default:
      return 'Idle';
  }
}

function heroKindFromResult(result: RoundResult): ArcadeNoticeKind {
  if (result.outcome === 'loss') return 'danger';
  if (result.outcome === 'draw') return 'info';
  return 'success';
}

class TexasHoldemSession implements ArcadeGameSession {
  private readonly ctx: ArcadeGameSessionContext;
  private phase: HoldemPhase = 'waiting';
  private readonly players = new Map<string, PlayerState>();
  private seatOrder: string[] = [];
  private handOrder: string[] = [];
  private dealerButtonAgentId?: string;
  private smallBlindAgentId?: string;
  private bigBlindAgentId?: string;
  private currentTurnAgentId?: string;
  private currentBet = 0;
  private minimumRaise = BIG_BLIND;
  private community: Card[] = [];
  private deck: Card[] = [];
  private turnTimer?: ReturnType<typeof setTimeout>;
  private turnDeadlineAt: number | null = null;
  private settling = false;
  private aborted = false;
  private eventCounter = 0;
  private timeline: ArcadeTimelineEvent[] = [];
  private recap: ArcadePresentationRecap | null = null;
  private roundNumber = 0;
  private lastPotAwards: PotAward[] = [];

  constructor(ctx: ArcadeGameSessionContext) {
    this.ctx = ctx;
  }

  get status(): ArcadeSessionStatus {
    if (this.phase === 'waiting' || this.phase === 'between_hands') return 'waiting';
    if (this.phase === 'showdown') return 'finished';
    return 'playing';
  }

  onJoin(player: ArcadePlayerIdentity): ArcadeJoinResult {
    if (!['waiting', 'between_hands'].includes(this.phase)) {
      return { ok: false, error: 'The current hand has already started and cannot be joined right now.' };
    }

    const existing = this.players.get(player.agentId);
    if (existing) {
      existing.connected = true;
      existing.pendingRemoval = false;
      existing.info = player;
      return { ok: true };
    }

    if (this.players.size >= MAX_PLAYERS) {
      return { ok: false, error: `A table supports at most ${MAX_PLAYERS} players.` };
    }

    this.players.set(player.agentId, {
      info: player,
      connected: true,
      status: 'joined',
      readyForNextHand: false,
      sittingOut: false,
      holeCards: [],
      committed: 0,
      streetCommitted: 0,
      frozen: 0,
      availableStack: 0,
      folded: false,
      allIn: false,
      actedThisStreet: false,
      pendingRemoval: false,
    });
    this.seatOrder.push(player.agentId);
    this.recordEvent({
      kind: 'player_joined',
      severity: 'info',
      actorId: player.agentId,
      actorName: player.agentName,
      message: `${player.agentName} joined the Hold'em table`,
      detail: 'They can choose to join the next hand or sit this one out',
    });
    return { ok: true };
  }

  onLeave(player: ArcadePlayerIdentity, reason: ArcadeLeaveReason): ArcadeLeaveResult {
    const state = this.players.get(player.agentId);
    if (!state) {
      return { keepSlot: false };
    }

    if (reason === 'disconnect' && this.phase !== 'waiting' && this.phase !== 'between_hands' && this.phase !== 'showdown') {
      state.connected = false;
      return { keepSlot: true };
    }

    if (this.phase === 'waiting' || this.phase === 'between_hands') {
      this.removePlayerCompletely(player.agentId);
      this.recordEvent({
        kind: 'player_left',
        severity: 'info',
        actorId: player.agentId,
        actorName: player.agentName,
        message: `${player.agentName} left the Hold'em table`,
      });
      return { keepSlot: false };
    }

    state.connected = false;
    state.pendingRemoval = reason !== 'disconnect';
    if (!state.folded && !state.allIn) {
      state.folded = true;
      state.status = 'folded';
      state.actedThisStreet = true;
    }

    this.recordEvent({
      kind: 'player_left',
      severity: 'warning',
      actorId: player.agentId,
      actorName: player.agentName,
      message: `${player.agentName} left mid-hand and is treated as folded`,
      detail: 'Committed chips stay in the pot, and the seat will be removed after the hand ends',
    });

    if (this.currentTurnAgentId === player.agentId) {
      this.advanceAfterAction(player.agentId);
    } else {
      this.checkRoundProgress();
    }

    return { keepSlot: reason === 'disconnect' };
  }

  onReconnect(player: ArcadePlayerIdentity): { ok: boolean; error?: string } {
    const state = this.players.get(player.agentId);
    if (!state || state.pendingRemoval) {
      return { ok: false, error: 'There is no recoverable Hold\'em table state right now.' };
    }

    state.connected = true;
    state.info = player;
    if (this.currentTurnAgentId === player.agentId && this.canAct(state)) {
      this.startTurnTimer();
    }
    return { ok: true };
  }

  onAction(player: ArcadePlayerIdentity, action: ArcadeGameAction): ArcadeGameResult | Promise<ArcadeGameResult> {
    const state = this.players.get(player.agentId);
    if (!state || state.pendingRemoval) {
      return { ok: false, error: 'You are not seated at this table.' };
    }

    switch (action.type) {
      case 'ready':
        return this.handleReady(state);
      case 'sit_in':
        return this.handleSitIn(state);
      case 'sit_out':
        return this.handleSitOut(state);
      case 'start_round':
        return this.handleStartRound(player);
      case 'fold':
        return this.handleFold(state);
      case 'check':
        return this.handleCheck(state);
      case 'call':
        return this.handleCall(state);
      case 'raise':
        return this.handleRaise(state, action.amount as number);
      case 'all_in':
        return this.handleAllIn(state);
      default:
        return { ok: false, error: `Unknown action: ${action.type}` };
    }
  }

  getState(viewer?: ArcadePlayerIdentity): ArcadeSessionState {
    const viewerState = viewer ? this.players.get(viewer.agentId) : undefined;
    const orderedPlayers = this.orderedStates();
    const isShowdown = this.phase === 'showdown' || this.phase === 'between_hands';
    const pot = orderedPlayers.reduce((sum, state) => sum + state.committed, 0);
    const toCall = viewerState ? Math.max(0, this.currentBet - viewerState.streetCommitted) : 0;
    const maxCommit = viewerState ? viewerState.availableStack : 0;
    const minRaiseTo = viewerState && maxCommit > toCall
      ? (this.currentBet === 0 ? BIG_BLIND : this.currentBet + this.minimumRaise)
      : null;
    const prompt = this.buildViewerPrompt(viewerState);

    const players = orderedPlayers.map((state) => {
      const isViewer = viewer?.agentId === state.info.agentId;
      const revealCards = isViewer || (isShowdown && !state.folded);
      return {
        agentId: state.info.agentId,
        agentName: state.info.agentName,
        isHost: state.info.isHost ?? false,
        status: state.status,
        connected: state.connected,
        hand: revealCards ? state.holeCards.map(cardToString) : undefined,
        cardCount: state.holeCards.length,
        bet: state.committed || undefined,
        readyForNextHand: state.readyForNextHand,
        folded: state.folded,
        allIn: state.allIn,
        stack: state.availableStack,
        sittingOut: state.sittingOut,
      };
    });

    return {
      status: this.status,
      phase: this.phase,
      prompt,
      needAction: false,
      legalActions: [],
      deadlineAt: this.turnDeadlineAt,
      currentTurn: this.currentTurnAgentId,
      community: this.community.map(cardToString),
      currentBet: this.currentBet,
      dealerButton: this.dealerButtonAgentId,
      smallBlind: this.smallBlindAgentId,
      bigBlind: this.bigBlindAgentId,
      players,
      result: this.recap,
      pot,
      sidePots: this.phase === 'showdown' || this.phase === 'between_hands' ? this.buildPots() : undefined,
      toCall,
      minRaiseTo,
      minPlayers: MIN_PLAYERS,
      readyCount: this.readyParticipants().length,
      statusText: this.buildStatusText(),
      boardDetail: this.buildBoardDetail(),
      blindStructure: `${SMALL_BLIND}/${BIG_BLIND}`,
    };
  }

  getActionSchema(viewer?: ArcadePlayerIdentity): ArcadeGameActionSchema[] {
    if (!viewer) return [];
    const player = this.players.get(viewer.agentId);
    if (!player || player.pendingRemoval) return [];

    if (this.phase === 'waiting' || this.phase === 'between_hands') {
      const actions: ArcadeGameActionSchema[] = [];
      if (player.sittingOut) {
        actions.push({
          type: 'sit_in',
          label: 'Return to table',
          description: 'Leave sit-out status and return to the next-hand candidate list',
          helperText: 'After returning, you still need to click "Join next hand" to confirm participation',
          style: 'secondary',
          params: {},
        });
      } else {
        if (!player.readyForNextHand) {
          actions.push({
            type: 'ready',
            label: 'Join next hand',
            description: 'Confirm that you will play the next hand and pay blinds or future bets',
            helperText: `The host can only deal after at least ${MIN_PLAYERS} players confirm`,
            style: 'primary',
            params: {},
          });
        }
        actions.push({
          type: 'sit_out',
          label: 'Sit out next hand',
          description: 'Keep your seat but skip the next hand',
          helperText: 'Useful for taking a break, watching, or waiting for a better spot',
          style: 'secondary',
          params: {},
        });
      }
      if (viewer.isHost && this.readyParticipants().length >= MIN_PLAYERS) {
        actions.push({
          type: 'start_round',
          label: 'Deal next hand',
          description: 'Start the next hand and post blinds automatically',
          helperText: `${this.readyParticipants().length} players have confirmed the next hand`,
          style: 'primary',
          params: {},
        });
      }
      return actions;
    }

    if (!this.isBettingPhase() || this.currentTurnAgentId !== viewer.agentId || !this.canAct(player)) {
      return [];
    }

    const actions: ArcadeGameActionSchema[] = [];
    const toCall = Math.max(0, this.currentBet - player.streetCommitted);
    const maxCommit = player.availableStack;
    const minRaiseTo = this.currentBet === 0 ? BIG_BLIND : this.currentBet + this.minimumRaise;

    actions.push({
      type: 'fold',
      label: 'Fold',
      description: 'Give up the current hand and leave the contest',
      helperText: toCall > 0 ? `If you do not want to commit ${toCall} more, fold now to cut your loss` : 'You do not need to call right now, but you may still fold voluntarily',
      style: 'danger',
      params: {},
    });

    if (toCall === 0) {
      actions.push({
        type: 'check',
        label: 'Check',
        description: 'Keep your current bet unchanged and pass action to the next player',
        helperText: 'No one is forcing you to commit more chips this round',
        style: 'secondary',
        params: {},
      });
    } else if (maxCommit >= toCall) {
      actions.push({
        type: 'call',
        label: 'Call',
        description: `Commit ${toCall} chips to match the current bet`,
        helperText: `You still have ${maxCommit} chips available`,
        style: 'secondary',
        params: {},
      });
    }

    if (maxCommit > 0) {
      actions.push({
        type: 'all_in',
        label: 'All-in',
        description: `Push your remaining ${maxCommit} chips into the pot at once`,
        helperText: toCall > 0 ? 'If you do not have enough chips for a normal call, you can go all-in instead' : 'You can go all-in immediately to pressure the table',
        style: 'primary',
        params: {},
      });
    }

    if (maxCommit > toCall && player.streetCommitted + maxCommit >= minRaiseTo) {
      actions.push({
        type: 'raise',
        label: 'Raise to',
        description: 'Set your total bet target for this betting round',
        helperText: `Minimum raise to ${minRaiseTo}, maximum ${player.streetCommitted + maxCommit}`,
        style: 'primary',
        params: {
          amount: {
            type: 'number',
            description: 'Total bet target for this round',
            required: true,
            min: minRaiseTo,
            max: player.streetCommitted + maxCommit,
            step: 1,
            placeholder: `${minRaiseTo}-${player.streetCommitted + maxCommit}`,
            defaultValue: minRaiseTo,
          },
        },
      });
    }

    return actions;
  }

  async abort(reason: string): Promise<void> {
    this.aborted = true;
    this.clearTurnTimer();
    for (const state of this.players.values()) {
      if (state.frozen > 0) {
        await this.ctx.wallet.unfreeze(state.info.agentId, state.frozen, `texas-holdem:abort:${reason}`);
      }
      this.resetPlayerToIdle(state);
    }
  }

  dispose(): void {
    this.aborted = true;
    this.clearTurnTimer();
    this.players.clear();
    this.seatOrder = [];
    this.handOrder = [];
    this.community = [];
    this.deck = [];
    this.currentTurnAgentId = undefined;
    this.timeline = [];
    this.recap = null;
  }

  private handleReady(state: PlayerState): ArcadeGameResult {
    if (!['waiting', 'between_hands'].includes(this.phase)) {
      return { ok: false, error: 'The table is not currently in a waiting phase.' };
    }
    if (state.sittingOut) {
      return { ok: false, error: 'You are currently sitting out. Return to the table first.' };
    }

    state.readyForNextHand = true;
    state.status = 'ready';
    void this.ctx.logger.log('texas_holdem_ready', { agentId: state.info.agentId }, state.info);
    const event = this.recordEvent({
      kind: 'ready',
      severity: 'success',
      actorId: state.info.agentId,
      actorName: state.info.agentName,
      message: `${state.info.agentName} is ready for the next Hold'em hand`,
      detail: `${this.readyParticipants().length} players have confirmed the next hand so far`,
    });
    return this.okFromEvent(event);
  }

  private handleSitIn(state: PlayerState): ArcadeGameResult {
    if (!['waiting', 'between_hands'].includes(this.phase)) {
      return { ok: false, error: 'You cannot return to the table right now. Wait for the current hand to end.' };
    }
    state.sittingOut = false;
    state.readyForNextHand = false;
    state.status = 'joined';
    const event = this.recordEvent({
      kind: 'sit_in',
      severity: 'info',
      actorId: state.info.agentId,
      actorName: state.info.agentName,
      message: `${state.info.agentName} returned to the Hold'em table`,
      detail: 'They still need to confirm if they want to play the next hand',
    });
    return this.okFromEvent(event);
  }

  private handleSitOut(state: PlayerState): ArcadeGameResult {
    if (!['waiting', 'between_hands'].includes(this.phase)) {
      return { ok: false, error: 'You cannot sit out right now. Wait for the current hand to end.' };
    }
    state.sittingOut = true;
    state.readyForNextHand = false;
    state.status = 'sitting_out';
    const event = this.recordEvent({
      kind: 'sit_out',
      severity: 'info',
      actorId: state.info.agentId,
      actorName: state.info.agentName,
      message: `${state.info.agentName} chose to sit out the next Hold'em hand`,
      detail: 'The seat is preserved and they can return after any settlement',
    });
    return this.okFromEvent(event);
  }

  private async handleStartRound(player: ArcadePlayerIdentity): Promise<ArcadeGameResult> {
    if (!['waiting', 'between_hands'].includes(this.phase)) {
      return { ok: false, error: 'The table is not currently waiting for a deal.' };
    }
    if (!player.isHost) {
      return { ok: false, error: 'Only the table host can start the next hand.' };
    }
    if (this.readyParticipants().length < MIN_PLAYERS) {
      return { ok: false, error: `At least ${MIN_PLAYERS} players must confirm the next hand.` };
    }

    return this.startRound(player);
  }

  private handleFold(state: PlayerState): ArcadeGameResult {
    if (!this.ensureActor(state)) {
      return { ok: false, error: 'It is not your turn yet.' };
    }

    state.folded = true;
    state.status = 'folded';
    state.actedThisStreet = true;
    const event = this.recordEvent({
      kind: 'fold',
      severity: 'warning',
      actorId: state.info.agentId,
      actorName: state.info.agentName,
      message: `${state.info.agentName} folded`,
      detail: 'They are out of the hand, and their committed chips stay in the pot',
    });
    this.advanceAfterAction(state.info.agentId);
    return this.okFromEvent(event);
  }

  private handleCheck(state: PlayerState): ArcadeGameResult {
    if (!this.ensureActor(state)) {
      return { ok: false, error: 'It is not your turn yet.' };
    }
    if (this.currentBet !== state.streetCommitted) {
      return { ok: false, error: 'You cannot check right now. Call, raise, or fold instead.' };
    }

    state.status = 'checked';
    state.actedThisStreet = true;
    const event = this.recordEvent({
      kind: 'check',
      severity: 'info',
      actorId: state.info.agentId,
      actorName: state.info.agentName,
      message: `${state.info.agentName} checked`,
      detail: 'No more chips are committed, and action passes to the next player',
    });
    this.advanceAfterAction(state.info.agentId);
    return this.okFromEvent(event);
  }

  private async handleCall(state: PlayerState): Promise<ArcadeGameResult> {
    if (!this.ensureActor(state)) {
      return { ok: false, error: 'It is not your turn yet.' };
    }

    const toCall = this.currentBet - state.streetCommitted;
    if (toCall <= 0) {
      return { ok: false, error: 'There is nothing to call right now. Check or raise instead.' };
    }
    if (state.availableStack < toCall) {
      return { ok: false, error: 'You do not have enough chips. Go all-in instead.' };
    }

    await this.commitChips(state, toCall, 'call');
    state.status = state.availableStack === 0 ? 'all_in' : 'called';
    state.actedThisStreet = true;
    const event = this.recordEvent({
      kind: 'call',
      severity: 'info',
      actorId: state.info.agentId,
      actorName: state.info.agentName,
      message: `${state.info.agentName} called ${toCall} chips`,
      detail: `The current bet is now matched at ${this.currentBet}`,
    });
    this.advanceAfterAction(state.info.agentId);
    return this.okFromEvent(event);
  }

  private async handleRaise(state: PlayerState, rawAmount: number): Promise<ArcadeGameResult> {
    if (!this.ensureActor(state)) {
      return { ok: false, error: 'It is not your turn yet.' };
    }

    const amount = Math.floor(rawAmount);
    const minRaiseTo = this.currentBet === 0 ? BIG_BLIND : this.currentBet + this.minimumRaise;
    const maxRaiseTo = state.streetCommitted + state.availableStack;
    if (!Number.isFinite(amount) || amount < minRaiseTo || amount > maxRaiseTo) {
      return { ok: false, error: `Raise target must be between ${minRaiseTo} and ${maxRaiseTo}.` };
    }

    const toCommit = amount - state.streetCommitted;
    if (toCommit <= 0) {
      return { ok: false, error: 'Raise target must be higher than your current contribution.' };
    }

    const previousBet = this.currentBet;
    await this.commitChips(state, toCommit, 'raise');
    this.currentBet = amount;
    this.minimumRaise = Math.max(BIG_BLIND, amount - previousBet);
    this.resetOthersForReopen(state.info.agentId);
    state.status = state.availableStack === 0 ? 'all_in' : 'raised';
    state.actedThisStreet = true;
    const event = this.recordEvent({
      kind: 'raise',
      severity: 'success',
      actorId: state.info.agentId,
      actorName: state.info.agentName,
      message: `${state.info.agentName} raised the total bet to ${amount}`,
      detail: `Action reopens. The minimum next raise is ${this.minimumRaise}`,
    });
    this.advanceAfterAction(state.info.agentId);
    return this.okFromEvent(event);
  }

  private async handleAllIn(state: PlayerState): Promise<ArcadeGameResult> {
    if (!this.ensureActor(state)) {
      return { ok: false, error: 'It is not your turn yet.' };
    }
    if (state.availableStack <= 0) {
      return { ok: false, error: 'You do not have any chips left to push in.' };
    }

    const previousBet = this.currentBet;
    const target = state.streetCommitted + state.availableStack;
    await this.commitChips(state, state.availableStack, 'all_in');
    state.status = 'all_in';
    state.actedThisStreet = true;

    if (target > this.currentBet) {
      this.currentBet = target;
      const raiseDelta = target - previousBet;
      if (raiseDelta >= this.minimumRaise) {
        this.minimumRaise = raiseDelta;
      }
      this.resetOthersForReopen(state.info.agentId);
      state.actedThisStreet = true;
    }

    const event = this.recordEvent({
      kind: 'all_in',
      severity: 'success',
      actorId: state.info.agentId,
      actorName: state.info.agentName,
      message: `${state.info.agentName} went all-in`,
      detail: `The total bet now stands at ${target}`,
    });
    this.advanceAfterAction(state.info.agentId);
    return this.okFromEvent(event);
  }

  private async startRound(host: ArcadePlayerIdentity): Promise<ArcadeGameResult> {
    if (this.aborted) {
      return { ok: false, error: 'The table has already been closed.' };
    }

    const participants = await this.prepareHandParticipants();
    if (participants.length < MIN_PLAYERS) {
      this.recordEvent({
        kind: 'hand_cancelled',
        severity: 'warning',
        message: `Fewer than ${MIN_PLAYERS} funded players confirmed the hand, so this hand was cancelled`,
        detail: 'Wait for more players to confirm the next hand',
      });
      return { ok: false, error: `At least ${MIN_PLAYERS} players with chips are required to start Hold'em.` };
    }

    this.roundNumber += 1;
    this.recap = null;
    this.lastPotAwards = [];
    this.prepareForNewHand();

    this.phase = 'preflop';
    this.deck = shuffle(createDeck());
    this.community = [];
    this.handOrder = participants.map((state) => state.info.agentId);
    this.currentBet = 0;
    this.minimumRaise = BIG_BLIND;

    const dealerIndex = this.nextDealerIndex(this.handOrder);
    this.dealerButtonAgentId = this.handOrder[dealerIndex];
    this.smallBlindAgentId = this.handOrder[(dealerIndex + 1) % this.handOrder.length];
    this.bigBlindAgentId = this.handOrder[(dealerIndex + 2) % this.handOrder.length];

    if (this.handOrder.length === 2) {
      this.smallBlindAgentId = this.handOrder[dealerIndex];
      this.bigBlindAgentId = this.handOrder[(dealerIndex + 1) % this.handOrder.length];
    }

    for (const state of participants) {
      state.holeCards = [this.draw(), this.draw()];
      state.folded = false;
      state.allIn = false;
      state.actedThisStreet = false;
      state.status = 'acting';
    }

    const smallBlindState = this.smallBlindAgentId ? this.players.get(this.smallBlindAgentId) : undefined;
    const bigBlindState = this.bigBlindAgentId ? this.players.get(this.bigBlindAgentId) : undefined;
    const postedSmall = smallBlindState ? await this.postForcedBet(smallBlindState, SMALL_BLIND, 'small_blind') : 0;
    const postedBig = bigBlindState ? await this.postForcedBet(bigBlindState, BIG_BLIND, 'big_blind') : 0;
    this.currentBet = Math.max(postedSmall, postedBig);

    const event = this.recordEvent({
      kind: 'round_started',
      severity: 'success',
      actorId: host.agentId,
      actorName: host.agentName,
      message: `Host ${host.agentName} started Hold'em hand ${this.roundNumber}`,
      detail: `${this.displayName(this.smallBlindAgentId)} posted the small blind ${postedSmall}, and ${this.displayName(this.bigBlindAgentId)} posted the big blind ${postedBig}`,
    });

    this.currentTurnAgentId = this.findFirstPreflopActor();
    if (!this.currentTurnAgentId) {
      await this.settle();
    } else {
      this.emitCurrentTurn();
    }

    return this.okFromEvent(event);
  }

  private async prepareHandParticipants(): Promise<PlayerState[]> {
    const participants: PlayerState[] = [];
    for (const agentId of this.seatOrder) {
      const state = this.players.get(agentId);
      if (!state || state.pendingRemoval) continue;
      this.resetPlayerForHand(state);
      state.availableStack = await this.ctx.wallet.getBalance(agentId);
      if (state.readyForNextHand && !state.sittingOut && state.availableStack > 0 && state.connected) {
        participants.push(state);
      } else if (state.sittingOut) {
        state.status = 'sitting_out';
      } else {
        state.status = 'waiting_next';
      }
    }
    return participants;
  }

  private prepareForNewHand(): void {
    for (const state of this.players.values()) {
      state.holeCards = [];
      state.committed = 0;
      state.streetCommitted = 0;
      state.frozen = 0;
      state.folded = false;
      state.allIn = false;
      state.actedThisStreet = false;
    }
    this.community = [];
  }

  private resetPlayerForHand(state: PlayerState): void {
    state.holeCards = [];
    state.committed = 0;
    state.streetCommitted = 0;
    state.frozen = 0;
    state.folded = false;
    state.allIn = false;
    state.actedThisStreet = false;
    state.status = state.sittingOut ? 'sitting_out' : state.readyForNextHand ? 'ready' : 'joined';
  }

  private resetPlayerToIdle(state: PlayerState): void {
    state.readyForNextHand = false;
    state.holeCards = [];
    state.committed = 0;
    state.streetCommitted = 0;
    state.frozen = 0;
    state.availableStack = 0;
    state.folded = false;
    state.allIn = false;
    state.actedThisStreet = false;
    state.status = state.sittingOut ? 'sitting_out' : 'joined';
  }

  private async postForcedBet(state: PlayerState, blindAmount: number, reason: string): Promise<number> {
    const commit = Math.min(state.availableStack, blindAmount);
    if (commit <= 0) {
      state.allIn = true;
      state.status = 'all_in';
      return 0;
    }

    await this.commitChips(state, commit, reason);
    state.status = state.availableStack === 0 ? 'all_in' : 'acting';
    this.recordEvent({
      kind: 'blind_posted',
      severity: 'info',
      actorId: state.info.agentId,
      actorName: state.info.agentName,
      message: `${state.info.agentName} posted the ${reason === 'small_blind' ? 'small blind' : 'big blind'} of ${commit}`,
      detail: reason === 'small_blind' ? 'The small blind enters the pot first' : 'The big blind defines the initial amount to call',
    });
    return commit;
  }

  private async commitChips(state: PlayerState, amount: number, reason: string): Promise<void> {
    const frozen = await this.ctx.wallet.freeze(state.info.agentId, amount, `texas-holdem:${reason}`);
    if (!frozen) {
      throw new Error('Not enough chips to complete this action.');
    }

    state.availableStack -= amount;
    state.committed += amount;
    state.streetCommitted += amount;
    state.frozen += amount;
    state.allIn = state.availableStack === 0;
  }

  private ensureActor(state: PlayerState): boolean {
    return this.isBettingPhase() && this.currentTurnAgentId === state.info.agentId && this.canAct(state);
  }

  private canAct(state: PlayerState): boolean {
    return !state.folded && !state.allIn && state.holeCards.length === 2;
  }

  private isBettingPhase(): boolean {
    return this.phase === 'preflop' || this.phase === 'flop' || this.phase === 'turn' || this.phase === 'river';
  }

  private advanceAfterAction(currentAgentId: string): void {
    if (this.aborted) return;
    this.clearTurnTimer();

    const livePlayers = this.liveContenders();
    if (livePlayers.length <= 1) {
      void this.settle();
      return;
    }

    if (this.isStreetComplete()) {
      void this.advanceStreet();
      return;
    }

    const next = this.nextActorAfter(currentAgentId);
    if (!next) {
      void this.advanceStreet();
      return;
    }

    this.currentTurnAgentId = next;
    this.emitCurrentTurn();
  }

  private checkRoundProgress(): void {
    if (this.aborted || !this.isBettingPhase()) return;
    if (this.liveContenders().length <= 1) {
      void this.settle();
      return;
    }
    if (this.isStreetComplete()) {
      void this.advanceStreet();
    }
  }

  private async advanceStreet(): Promise<void> {
    if (this.aborted) return;
    this.clearTurnTimer();

    if (this.phase === 'river') {
      await this.settle();
      return;
    }

    let drawn: string[] = [];
    if (this.phase === 'preflop') {
      this.phase = 'flop';
      this.community.push(this.draw(), this.draw(), this.draw());
      drawn = this.community.slice(0, 3).map(cardToString);
    } else if (this.phase === 'flop') {
      this.phase = 'turn';
      const card = this.draw();
      this.community.push(card);
      drawn = [cardToString(card)];
    } else if (this.phase === 'turn') {
      this.phase = 'river';
      const card = this.draw();
      this.community.push(card);
      drawn = [cardToString(card)];
    }

    this.currentBet = 0;
    this.minimumRaise = BIG_BLIND;
    for (const state of this.orderedStates()) {
      state.streetCommitted = 0;
      state.actedThisStreet = false;
      if (!state.folded && !state.allIn && state.holeCards.length === 2) {
        state.status = 'acting';
      }
    }

    this.recordEvent({
      kind: 'street_dealt',
      severity: 'info',
      message: `Entered the ${this.phaseLabel(this.phase)} phase`,
      detail: drawn.length > 1 ? `Revealed community cards ${drawn.join(' / ')}` : `Added community card ${drawn[0] ?? ''}`,
    });

    const next = this.firstPostflopActor();
    if (!next) {
      await this.settle();
      return;
    }

    this.currentTurnAgentId = next;
    this.emitCurrentTurn();
  }

  private emitCurrentTurn(): void {
    if (this.aborted || !this.currentTurnAgentId) return;
    const state = this.players.get(this.currentTurnAgentId);
    if (!state || !this.canAct(state)) {
      const next = this.nextActorAfter(this.currentTurnAgentId);
      if (!next) {
        void this.advanceStreet();
        return;
      }
      this.currentTurnAgentId = next;
      this.emitCurrentTurn();
      return;
    }

    const toCall = Math.max(0, this.currentBet - state.streetCommitted);
    this.recordEvent({
      kind: 'your_turn',
      severity: 'turn',
      actorId: state.info.agentId,
      actorName: state.info.agentName,
      message: `It is now ${state.info.agentName}'s turn`,
      detail: toCall > 0 ? `They need ${toCall} to call and may also raise or fold` : 'They may check, bet, or go all-in',
    });
    this.startTurnTimer();
  }

  private startTurnTimer(): void {
    this.clearTurnTimer();
    if (!this.currentTurnAgentId) return;

    this.turnDeadlineAt = this.ctx.clock.now() + TURN_TIMEOUT_MS;
    this.turnTimer = this.ctx.clock.setTimeout(() => {
      this.turnTimer = undefined;
      this.turnDeadlineAt = null;
      const state = this.players.get(this.currentTurnAgentId ?? '');
      if (!state || !this.canAct(state)) return;
      state.folded = true;
      state.status = 'folded';
      state.actedThisStreet = true;
      this.recordEvent({
        kind: 'turn_timeout',
        severity: 'warning',
        actorId: state.info.agentId,
        actorName: state.info.agentName,
        message: `${state.info.agentName} timed out, and the system folded the hand automatically`,
        detail: 'Their committed chips remain in the pot',
      });
      this.advanceAfterAction(state.info.agentId);
    }, TURN_TIMEOUT_MS);
  }

  private clearTurnTimer(): void {
    this.ctx.clock.clearTimeout(this.turnTimer);
    this.turnTimer = undefined;
    this.turnDeadlineAt = null;
  }

  private isStreetComplete(): boolean {
    const contenders = this.liveContenders();
    if (contenders.length <= 1) return true;
    return contenders.every((state) => (
      state.folded ||
      state.allIn ||
      (state.actedThisStreet && state.streetCommitted === this.currentBet)
    ));
  }

  private liveContenders(): PlayerState[] {
    return this.orderedStates().filter((state) => state.holeCards.length === 2 && !state.folded);
  }

  private orderedStates(): PlayerState[] {
    return this.seatOrder
      .map((agentId) => this.players.get(agentId))
      .filter((state): state is PlayerState => !!state);
  }

  private readyParticipants(): PlayerState[] {
    return this.orderedStates().filter((state) => state.readyForNextHand && !state.sittingOut && !state.pendingRemoval);
  }

  private nextDealerIndex(order: string[]): number {
    if (!this.dealerButtonAgentId) return 0;
    const currentIndex = order.indexOf(this.dealerButtonAgentId);
    if (currentIndex === -1) return 0;
    return (currentIndex + 1) % order.length;
  }

  private findFirstPreflopActor(): string | undefined {
    if (!this.bigBlindAgentId) return undefined;
    if (this.handOrder.length === 2) {
      return this.smallBlindAgentId;
    }
    return this.nextActorAfter(this.bigBlindAgentId);
  }

  private firstPostflopActor(): string | undefined {
    if (!this.dealerButtonAgentId) return undefined;
    return this.nextActorAfter(this.dealerButtonAgentId);
  }

  private nextActorAfter(agentId: string): string | undefined {
    if (!this.handOrder.length) return undefined;
    const startIndex = this.handOrder.indexOf(agentId);
    for (let step = 1; step <= this.handOrder.length; step += 1) {
      const index = (Math.max(0, startIndex) + step) % this.handOrder.length;
      const next = this.players.get(this.handOrder[index]);
      if (next && this.canAct(next)) {
        return next.info.agentId;
      }
    }
    return undefined;
  }

  private async settle(): Promise<void> {
    if (this.aborted || this.settling) return;
    this.settling = true;
    this.phase = 'showdown';
    this.currentTurnAgentId = undefined;
    this.clearTurnTimer();

    const contenders = this.liveContenders();
    const showdownRequired = contenders.length > 1;
    if (showdownRequired) {
      while (this.community.length < 5) {
        this.community.push(this.draw());
      }
      this.recordEvent({
        kind: 'showdown',
        severity: 'info',
        message: 'Showdown begins',
        detail: `Community cards ${this.community.map(cardToString).join(' / ')}`,
      });
    }

    const ranked = contenders.map((state) => ({
      state,
      rank: evaluateSevenCards([...state.holeCards, ...this.community]),
    }));

    const pots = this.buildPots();
    const rewards = new Map<string, number>();
    const potAwards: PotAward[] = [];

    for (const state of this.orderedStates()) {
      if (state.frozen > 0) {
        await this.ctx.wallet.forfeit(state.info.agentId, state.frozen, 'texas-holdem:pot_lock');
        state.frozen = 0;
      }
    }

    for (const pot of pots) {
      const eligible = ranked.filter((entry) => pot.contenders.includes(entry.state.info.agentId));
      if (!eligible.length) continue;

      let best = eligible[0];
      let winners = [eligible[0]];
      for (let index = 1; index < eligible.length; index += 1) {
        const entry = eligible[index];
        const comparison = compareHandRank(entry.rank, best.rank);
        if (comparison > 0) {
          best = entry;
          winners = [entry];
        } else if (comparison === 0) {
          winners.push(entry);
        }
      }

      const share = Math.floor(pot.amount / winners.length);
      let remainder = pot.amount % winners.length;
      const distributionOrder = this.payoutOrder(winners.map((entry) => entry.state.info.agentId));
      for (const agentId of distributionOrder) {
        const prize = share + (remainder > 0 ? 1 : 0);
        if (remainder > 0) remainder -= 1;
        rewards.set(agentId, (rewards.get(agentId) ?? 0) + prize);
      }

      const losingRanks = eligible.filter((entry) => !winners.some((winner) => winner.state.info.agentId === entry.state.info.agentId));
      potAwards.push({
        amount: pot.amount,
        contenders: pot.contenders,
        winners: winners.map((entry) => entry.state.info.agentId),
        winningLabel: best.rank.label,
        detail: winners.length === 1
          ? losingRanks.length
            ? `${best.state.info.agentName} won with ${best.rank.label} over ${losingRanks[0].rank.label}`
            : `${best.state.info.agentName} collected the pot uncontested`
          : `${winners.map((entry) => entry.state.info.agentName).join(' / ')} split the pot with ${best.rank.label}`,
      });
    }

    const results: RoundResult[] = [];
    for (const state of this.orderedStates()) {
      const won = rewards.get(state.info.agentId) ?? 0;
      if (won > 0) {
        await this.ctx.wallet.reward(state.info.agentId, won, 'texas-holdem:payout');
      }

      const rank = ranked.find((entry) => entry.state.info.agentId === state.info.agentId)?.rank;
      const delta = won - state.committed;
      const outcome = won > state.committed ? 'win' : won === state.committed ? 'draw' : 'loss';
      const reason = this.describeResult(state, rank, outcome, potAwards);
      state.availableStack = await this.ctx.wallet.getBalance(state.info.agentId);

      await this.ctx.stats.recordResult(state.info.agentId, 'texas-holdem', outcome, state.committed, won);
      results.push({
        agentId: state.info.agentId,
        agentName: state.info.agentName,
        committed: state.committed,
        won,
        delta,
        outcome,
        hand: state.holeCards.map(cardToString),
        label: rank?.label ?? (state.folded ? 'Folded before showdown' : 'Did not reach showdown'),
        reason,
      });
      state.status = 'settled';
    }

    this.lastPotAwards = potAwards;
    this.recap = this.buildRecap(results, potAwards);
    this.recordEvent({
      kind: 'game_over',
      severity: 'success',
      message: `Hold'em hand ${this.roundNumber} has been settled`,
      detail: potAwards.map((award) => award.detail).join('; ') || 'No valid pot awards were made for this hand',
    }, {
      recap: this.recap,
      community: this.community.map(cardToString),
      pots,
      results,
    });

    this.transitionToBetweenHands();
    this.settling = false;
  }

  private transitionToBetweenHands(): void {
    this.phase = 'between_hands';
    this.handOrder = [];
    this.currentTurnAgentId = undefined;
    this.currentBet = 0;
    this.minimumRaise = BIG_BLIND;
    this.smallBlindAgentId = undefined;
    this.bigBlindAgentId = undefined;

    for (const state of this.players.values()) {
      state.readyForNextHand = false;
      state.streetCommitted = 0;
      state.actedThisStreet = false;
      state.allIn = false;
      if (state.pendingRemoval) continue;
      if (state.sittingOut) {
        state.status = 'sitting_out';
      } else {
        state.status = 'waiting_next';
      }
    }

    const removable = this.orderedStates().filter((state) => state.pendingRemoval).map((state) => state.info.agentId);
    for (const agentId of removable) {
      this.removePlayerCompletely(agentId);
    }

    this.recordEvent({
      kind: 'between_hands',
      severity: 'info',
      message: 'Settlement is preserved while waiting for the next hand',
      detail: 'Players may confirm the next hand or choose to sit out',
    });
  }

  private buildPots(): PotSegment[] {
    const contributions = this.orderedStates()
      .map((state) => ({
        agentId: state.info.agentId,
        committed: state.committed,
        eligible: !state.folded && state.holeCards.length === 2,
      }))
      .filter((state) => state.committed > 0);

    const levels = uniqueDescending(contributions.map((item) => item.committed)).sort((left, right) => left - right);
    const pots: PotSegment[] = [];
    let previousLevel = 0;

    for (const level of levels) {
      const involved = contributions.filter((item) => item.committed >= level);
      const amount = (level - previousLevel) * involved.length;
      if (amount > 0) {
        pots.push({
          amount,
          contenders: involved.filter((item) => item.eligible).map((item) => item.agentId),
        });
      }
      previousLevel = level;
    }

    return pots;
  }

  private payoutOrder(winners: string[]): string[] {
    if (!this.dealerButtonAgentId || winners.length <= 1) return winners;
    const ordered = [...this.handOrder];
    const start = ordered.indexOf(this.dealerButtonAgentId);
    const rotated = ordered.slice(start + 1).concat(ordered.slice(0, start + 1));
    return rotated.filter((agentId) => winners.includes(agentId));
  }

  private removePlayerCompletely(agentId: string): void {
    this.players.delete(agentId);
    this.seatOrder = this.seatOrder.filter((item) => item !== agentId);
    this.handOrder = this.handOrder.filter((item) => item !== agentId);
  }

  private draw(): Card {
    if (this.deck.length === 0) {
      this.deck = shuffle(createDeck());
    }
    return this.deck.pop()!;
  }

  private displayName(agentId?: string): string {
    if (!agentId) return 'Unknown player';
    return this.players.get(agentId)?.info.agentName ?? agentId;
  }

  private buildPlayerBadges(state: PlayerState): string[] {
    return [
      state.info.isHost ? 'Host' : '',
      state.readyForNextHand ? 'Ready for next hand' : '',
      this.dealerButtonAgentId === state.info.agentId ? 'Dealer button' : '',
      this.smallBlindAgentId === state.info.agentId ? 'Small blind' : '',
      this.bigBlindAgentId === state.info.agentId ? 'Big blind' : '',
      state.sittingOut ? 'Sitting out' : '',
      state.connected ? 'Online' : 'Disconnected',
    ].filter(Boolean);
  }

  private buildStatusText(): string {
    switch (this.phase) {
      case 'waiting':
        return `Waiting for players to confirm the next hand (at least ${MIN_PLAYERS})`;
      case 'preflop':
        return 'Preflop action in progress';
      case 'flop':
        return 'Flop action in progress';
      case 'turn':
        return 'Turn action in progress';
      case 'river':
        return 'River action in progress';
      case 'showdown':
        return 'Showdown and payout in progress';
      case 'between_hands':
        return 'Settlement is preserved while players decide on the next hand';
      default:
        return 'Table state synchronized';
    }
  }

  private phaseLabel(phase: HoldemPhase): string {
    switch (phase) {
      case 'preflop':
        return 'Preflop';
      case 'flop':
        return 'Flop';
      case 'turn':
        return 'Turn';
      case 'river':
        return 'River';
      case 'showdown':
        return 'Showdown';
      case 'between_hands':
        return 'Waiting for next hand';
      default:
        return 'Waiting';
    }
  }

  private buildBoardDetail(): string {
    if (this.phase === 'waiting') {
      return 'Fixed blinds are 5/10. The host may deal once enough players confirm.';
    }
    if (this.phase === 'between_hands') {
      return this.lastPotAwards.length
        ? this.lastPotAwards.map((award) => award.detail).join('; ')
        : 'The previous hand has been fully settled';
    }
    if (!this.community.length) {
      return 'Only hole cards have been dealt so far';
    }
    return `Community cards ${this.community.length}/5`;
  }

  private buildViewerPrompt(viewerState?: PlayerState): string {
    if (!viewerState) return 'You are spectating. Wait for the table to advance.';

    if (this.isBettingPhase()) {
      const toCall = Math.max(0, this.currentBet - viewerState.streetCommitted);
      if (this.currentTurnAgentId === viewerState.info.agentId && this.canAct(viewerState)) {
        return toCall > 0 ? `It is your turn. You need ${toCall} to call.` : 'It is your turn. You may check or bet.';
      }
      if (this.currentTurnAgentId) {
        return `Waiting for ${this.displayName(this.currentTurnAgentId)} to act`;
      }
      return 'Waiting for the hand to advance to the next street or showdown';
    }

    if (this.phase === 'between_hands') {
      if (viewerState.sittingOut) return 'You are currently sitting out. Return to the table before confirming the next hand.';
      if (viewerState.readyForNextHand) return 'You are ready for the next hand. Waiting for the host to deal.';
      return 'You can confirm the next hand or choose to sit out.';
    }

    return `The host can deal only after at least ${MIN_PLAYERS} players confirm the next hand`;
  }

  private buildHero(viewerState: PlayerState | undefined, viewerPrompt: string): ArcadePresentationHero | undefined {
    if (!viewerState) {
      return {
        kind: 'info',
        title: 'Spectating',
        body: viewerPrompt,
      };
    }

    if (this.isBettingPhase() && this.currentTurnAgentId === viewerState.info.agentId && this.canAct(viewerState)) {
      const toCall = Math.max(0, this.currentBet - viewerState.streetCommitted);
      return {
        kind: 'turn',
        title: 'Your turn',
        body: toCall > 0 ? `You need ${toCall} to call. You may also raise, go all-in, or fold.` : 'You may check, bet, or go all-in.',
        countdownMs: this.remainingMs(this.turnDeadlineAt),
      };
    }

    if (this.phase === 'between_hands' && this.recap) {
      const item = this.recap.items.find((entry) => entry.agentId === viewerState.info.agentId);
      if (item) {
        return {
          kind: heroKindFromResult({
            agentId: item.agentId,
            agentName: item.agentName,
            committed: 0,
            won: 0,
            delta: item.delta ?? 0,
            outcome: item.delta && item.delta > 0 ? 'win' : item.delta && item.delta < 0 ? 'loss' : 'draw',
            hand: item.hand ?? [],
            label: item.label ?? '',
            reason: item.summary,
          }),
          title: item.delta && item.delta > 0 ? `You won +${item.delta}` : item.delta && item.delta < 0 ? `You lost ${item.delta}` : 'This hand is over',
          body: item.summary,
        };
      }
    }

    if (this.currentTurnAgentId) {
      return {
        kind: 'info',
        title: `Waiting for ${this.displayName(this.currentTurnAgentId)}`,
        body: viewerPrompt,
      };
    }

    return {
      kind: 'info',
      title: this.phase === 'between_hands' ? 'Waiting for next hand' : 'Hold\'em table idle',
      body: viewerPrompt,
    };
  }

  private describeResult(
    state: PlayerState,
    rank: HandRank | undefined,
    outcome: RoundResult['outcome'],
    potAwards: PotAward[],
  ): string {
    if (state.folded) {
      return 'You folded earlier in the hand and will not reach showdown';
    }

    const awardsWon = potAwards.filter((award) => award.winners.includes(state.info.agentId));
    const awardsLost = potAwards.filter((award) => award.contenders.includes(state.info.agentId) && !award.winners.includes(state.info.agentId));

    if (!rank) {
      return awardsWon.length ? awardsWon[0].detail : 'This hand never reached a meaningful showdown';
    }

    if (outcome === 'draw') {
      return awardsWon.length
        ? `${rank.label} split the pot with the opposition`
        : `${rank.label} did not produce any extra payout`;
    }
    if (outcome === 'win') {
      return awardsWon.length
        ? `${rank.label}, ${awardsWon.map((award) => award.detail).join('; ')}`
        : `${rank.label} collected the pot uncontested`;
    }
    if (awardsLost.length) {
      return `${awardsLost[0].winningLabel} beat your ${rank.label}`;
    }
    return `${rank.label} did not win any share of the pot`;
  }

  private buildRecap(results: RoundResult[], potAwards: PotAward[]): ArcadePresentationRecap {
    return {
      title: `Hold'em hand ${this.roundNumber} recap`,
      summary: `Community cards ${this.community.map(cardToString).join(' / ') || 'not completed'}`,
      detail: potAwards.map((award, index) => `${index === 0 ? 'Main pot' : `Side pot ${index}`} ${award.amount}: ${award.detail}`).join('; '),
      items: results.map((result) => ({
        agentId: result.agentId,
        agentName: result.agentName,
        outcome: result.outcome === 'win' ? 'Won' : result.outcome === 'loss' ? 'Lost' : 'Split',
        summary: result.reason,
        delta: result.delta,
        hand: result.hand,
        label: result.label,
      })),
    };
  }

  private remainingMs(deadlineAt: number | null): number | undefined {
    if (!deadlineAt) return undefined;
    return Math.max(0, deadlineAt - this.ctx.clock.now());
  }

  private resetOthersForReopen(actorAgentId: string): void {
    for (const state of this.orderedStates()) {
      if (state.info.agentId === actorAgentId) continue;
      if (this.canAct(state)) {
        state.actedThisStreet = false;
        state.status = 'acting';
      }
    }
  }

  private okFromEvent(event: ArcadeTimelineEvent): ArcadeGameResult {
    const data: ArcadeGameActionReceipt = {
      message: event.message,
    };
    return { ok: true, data };
  }

  private recordEvent(
    input: Omit<ArcadeTimelineEvent, 'id' | 'createdAt'>,
    extras?: Record<string, unknown>,
  ): ArcadeTimelineEvent {
    const event: ArcadeTimelineEvent = {
      ...input,
      id: `holdem-${this.ctx.table.tableId}-${++this.eventCounter}`,
      createdAt: this.ctx.clock.now(),
      viewerPrompt: input.viewerPrompt,
    };
    this.timeline = [event, ...this.timeline].slice(0, TIMELINE_LIMIT);
    this.ctx.events.emit(extras ? { ...event, ...extras } : event);
    return event;
  }
}

export class TexasHoldemGame implements ArcadeGameDefinition {
  readonly id = 'texas-holdem';
  readonly version = '1.0.0';
  readonly apiVersion = ARCADE_GAME_API_VERSION;
  readonly catalog = {
    name: 'Texas Hold\'em',
    description: 'Standard cash-table Hold\'em with blinds, raises, all-ins, side pots, spectators, and reconnect recovery.',
    minPlayers: MIN_PLAYERS,
    maxPlayers: MAX_PLAYERS,
    tags: ['card', 'betting', 'poker', 'holdem'],
    capabilities: {
      reconnect: true,
      reconnectGraceMs: 60_000,
      minPlayersToContinue: MIN_PLAYERS,
      spectators: true,
      midGameJoin: false,
    },
  };

  private hostContext?: ArcadeGameHostContext;

  init(ctx: ArcadeGameHostContext): void {
    this.hostContext = ctx;
  }

  createSession(ctx: ArcadeGameSessionContext): ArcadeGameSession {
    return new TexasHoldemSession(ctx);
  }
}

export default TexasHoldemGame;
