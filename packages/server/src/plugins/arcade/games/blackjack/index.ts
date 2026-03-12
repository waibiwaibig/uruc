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
type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
type PlayerStatus =
  | 'joined'
  | 'ready'
  | 'betting'
  | 'bet_locked'
  | 'playing'
  | 'stood'
  | 'busted'
  | 'done'
  | 'waiting_next'
  | 'sitting_out'
  | 'skipped'
  | 'settled';
type Phase = 'waiting' | 'betting' | 'playing' | 'settling' | 'between_hands';

interface Card {
  suit: Suit;
  rank: Rank;
}

interface PlayerState {
  info: ArcadePlayerIdentity;
  hand: Card[];
  bet: number;
  frozen: number;
  status: PlayerStatus;
  doubledDown: boolean;
  connected: boolean;
  readyForNextHand: boolean;
  sittingOut: boolean;
}

interface RoundResult {
  agentId: string;
  agentName: string;
  hand: string[];
  total: number;
  bet: number;
  outcome: 'win' | 'lose' | 'push' | 'blackjack';
  payout: number;
  delta: number;
  reason: string;
}

const TURN_TIMEOUT_MS = 60_000;
const BETTING_TIMEOUT_MS = 30_000;
const MIN_PLAYERS = 2;
const TIMELINE_LIMIT = 24;

function cardValue(card: Card): number[] {
  if (card.rank === 'A') return [1, 11];
  if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') return [10];
  return [parseInt(card.rank, 10)];
}

function bestTotal(cards: Card[]): number {
  let totals = [0];
  for (const card of cards) {
    const next: number[] = [];
    for (const total of totals) {
      for (const value of cardValue(card)) {
        next.push(total + value);
      }
    }
    totals = next;
  }
  const valid = totals.filter((total) => total <= 21);
  return valid.length > 0 ? Math.max(...valid) : Math.min(...totals);
}

function isBust(cards: Card[]): boolean {
  return cards.length > 0 && bestTotal(cards) > 21;
}

function isBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && bestTotal(cards) === 21;
}

function cardToString(card: Card): string {
  const suitMap: Record<Suit, string> = {
    S: '♠',
    H: '♥',
    D: '♦',
    C: '♣',
  };
  return `${card.rank}${suitMap[card.suit]}`;
}

function playerStatusLabel(status: PlayerStatus): string {
  switch (status) {
    case 'ready':
      return 'Ready for next hand';
    case 'betting':
      return 'Waiting to bet';
    case 'bet_locked':
      return 'Bet locked';
    case 'playing':
      return 'Taking action';
    case 'stood':
      return 'Stood';
    case 'busted':
      return 'Busted';
    case 'done':
      return 'Waiting for dealer';
    case 'waiting_next':
      return 'Waiting for next hand';
    case 'sitting_out':
      return 'Sitting out this hand';
    case 'skipped':
      return 'Skipped this hand';
    case 'settled':
      return 'Settlement complete';
    default:
      return 'Idle';
  }
}

function cardTone(card: string): 'light' | 'dark' {
  return card.includes('♠') || card.includes('♣') ? 'dark' : 'light';
}

function createDeck(): Card[] {
  const suits: Suit[] = ['S', 'H', 'D', 'C'];
  const ranks: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
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

function heroKindFromOutcome(outcome: RoundResult['outcome']): ArcadeNoticeKind {
  if (outcome === 'lose') return 'danger';
  if (outcome === 'push') return 'info';
  return 'success';
}

class BlackjackSession implements ArcadeGameSession {
  private readonly ctx: ArcadeGameSessionContext;
  private phase: Phase = 'waiting';
  private readonly players = new Map<string, PlayerState>();
  private dealer: Card[] = [];
  private deck: Card[] = [];
  private turnOrder: string[] = [];
  private currentTurnIdx = 0;
  private turnTimer?: ReturnType<typeof setTimeout>;
  private bettingTimer?: ReturnType<typeof setTimeout>;
  private turnDeadlineAt: number | null = null;
  private bettingDeadlineAt: number | null = null;
  private settling = false;
  private aborted = false;
  private eventCounter = 0;
  private timeline: ArcadeTimelineEvent[] = [];
  private recap: ArcadePresentationRecap | null = null;
  private roundNumber = 0;

  constructor(ctx: ArcadeGameSessionContext) {
    this.ctx = ctx;
  }

  get status(): ArcadeSessionStatus {
    if (this.phase === 'waiting' || this.phase === 'between_hands') return 'waiting';
    if (this.phase === 'settling') return 'finished';
    return 'playing';
  }

  onJoin(player: ArcadePlayerIdentity): ArcadeJoinResult {
    if (!['waiting', 'between_hands'].includes(this.phase)) {
      return { ok: false, error: 'The game has already started and cannot be joined right now.' };
    }

    const existing = this.players.get(player.agentId);
    if (existing) {
      existing.connected = true;
      existing.info = player;
      return { ok: true };
    }

    this.players.set(player.agentId, {
      info: player,
      hand: [],
      bet: 0,
      frozen: 0,
      status: 'joined',
      doubledDown: false,
      connected: true,
      readyForNextHand: false,
      sittingOut: false,
    });
    this.recordEvent({
      kind: 'player_joined',
      severity: 'info',
      actorId: player.agentId,
      actorName: player.agentName,
      message: `${player.agentName} sat down at the table`,
      detail: 'They can choose to join the next hand or sit out',
    });
    return { ok: true };
  }

  onLeave(player: ArcadePlayerIdentity, reason: ArcadeLeaveReason): ArcadeLeaveResult {
    const state = this.players.get(player.agentId);
    if (!state) {
      return { keepSlot: false };
    }

    if (reason === 'disconnect' && this.phase !== 'waiting' && this.phase !== 'between_hands' && this.phase !== 'settling') {
      state.connected = false;
      return { keepSlot: true };
    }

    if (this.phase === 'waiting' || this.phase === 'between_hands') {
      this.players.delete(player.agentId);
      this.recordEvent({
        kind: 'player_left',
        severity: 'info',
        actorId: player.agentId,
        actorName: player.agentName,
        message: `${player.agentName} left the table`,
      });
      return { keepSlot: false };
    }

    if (this.phase === 'betting') {
      if (state.frozen > 0) {
        void this.ctx.wallet.unfreeze(player.agentId, state.frozen, 'blackjack:leave_before_deal');
        state.frozen = 0;
      }
      this.players.delete(player.agentId);
      this.recordEvent({
        kind: 'player_left',
        severity: 'warning',
        actorId: player.agentId,
        actorName: player.agentName,
        message: `${player.agentName} left before the deal and is removed from this hand`,
      });
      this.checkBettingProgress();
      return { keepSlot: false };
    }

    const wasCurrentTurn = this.currentTurnAgentId() === player.agentId;
    if (state.frozen > 0) {
      void this.ctx.wallet.forfeit(player.agentId, state.frozen, 'blackjack:leave_forfeit');
      void this.ctx.stats.recordResult(player.agentId, 'blackjack', 'loss', state.bet, 0);
      state.frozen = 0;
    }

    state.status = 'busted';
    state.readyForNextHand = false;
    this.players.delete(player.agentId);
    this.turnOrder = this.turnOrder.filter((agentId) => agentId !== player.agentId);
    if (this.currentTurnIdx >= this.turnOrder.length) {
      this.currentTurnIdx = 0;
    }

    this.recordEvent({
      kind: 'player_left',
      severity: 'warning',
      actorId: player.agentId,
      actorName: player.agentName,
      message: `${player.agentName} left mid-hand and forfeits this round`,
    });

    if (wasCurrentTurn) {
      this.advanceTurn();
    } else {
      this.checkAdvance();
    }

    return { keepSlot: false };
  }

  onReconnect(player: ArcadePlayerIdentity): { ok: boolean; error?: string } {
    const state = this.players.get(player.agentId);
    if (!state) {
      return { ok: false, error: 'There is no recoverable Blackjack table state right now.' };
    }

    state.connected = true;
    state.info = player;

    if (this.phase === 'playing' && this.currentTurnAgentId() === player.agentId && state.status === 'playing') {
      this.startTurnTimer();
    }

    return { ok: true };
  }

  onAction(player: ArcadePlayerIdentity, action: ArcadeGameAction): ArcadeGameResult | Promise<ArcadeGameResult> {
    const state = this.players.get(player.agentId);
    if (!state) {
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
      case 'bet':
        return this.handleBet(state, action.amount as number);
      case 'hit':
        return this.handleHit(state);
      case 'stand':
        return this.handleStand(state);
      case 'double_down':
        return this.handleDoubleDown(state);
      default:
        return { ok: false, error: `Unknown action: ${action.type}` };
    }
  }

  getState(viewer?: ArcadePlayerIdentity): ArcadeSessionState {
    const viewerState = viewer ? this.players.get(viewer.agentId) : undefined;
    const currentTurn = this.phase === 'playing' ? this.currentTurnAgentId() : undefined;
    const tablePot = this.seatedPlayers().reduce((sum, state) => sum + state.bet, 0);
    const settledView = this.phase === 'settling' || this.phase === 'between_hands';
    const prompt = this.buildViewerPrompt(viewerState);

    const players = this.seatedPlayers().map((state) => ({
      agentId: state.info.agentId,
      agentName: state.info.agentName,
      isHost: state.info.isHost ?? false,
      status: state.status,
      connected: state.connected,
      cardCount: state.hand.length,
      total: state.hand.length > 0 ? bestTotal(state.hand) : undefined,
      hand: state.hand.length > 0 ? state.hand.map(cardToString) : undefined,
      bet: state.bet || undefined,
      readyForNextHand: state.readyForNextHand,
      sittingOut: state.sittingOut,
    }));

    const dealer = settledView
      ? {
          hand: this.dealer.map(cardToString),
          total: this.dealer.length > 0 ? bestTotal(this.dealer) : undefined,
          busted: isBust(this.dealer),
        }
      : this.dealer.length > 0
        ? {
            showing: cardToString(this.dealer[0]),
            hiddenCount: Math.max(0, this.dealer.length - 1),
          }
        : null;

    return {
      status: this.status,
      phase: this.phase,
      prompt,
      needAction: false,
      legalActions: [],
      deadlineAt: this.phase === 'betting' ? this.bettingDeadlineAt : this.turnDeadlineAt,
      currentTurn,
      players,
      dealer,
      result: this.recap,
      pot: tablePot,
      readyCount: this.readyPlayers().length,
      minPlayers: MIN_PLAYERS,
      statusText: this.buildStatusText(),
      dealerDetail: this.buildDealerDetail(settledView),
    };
  }

  getActionSchema(viewer?: ArcadePlayerIdentity): ArcadeGameActionSchema[] {
    if (!viewer) return [];
    const viewerState = this.players.get(viewer.agentId);
    if (!viewerState) return [];

    if (this.phase === 'waiting' || this.phase === 'between_hands') {
      const actions: ArcadeGameActionSchema[] = [];
      if (viewerState.sittingOut) {
        actions.push({
          type: 'sit_in',
          label: 'Return to table',
          description: 'Leave sit-out status and return to the next-hand candidate list',
          helperText: 'After returning, you still need to click "Join next hand" to be dealt in',
          style: 'secondary',
          params: {},
        });
      } else {
        if (!viewerState.readyForNextHand) {
          actions.push({
            type: 'ready',
            label: 'Join next hand',
            description: 'Confirm that you will bet and be dealt into the next hand',
            helperText: 'After all participants confirm, the host advances with "Deal next hand"',
            style: 'primary',
            params: {},
          });
        }
        actions.push({
          type: 'sit_out',
          label: 'Sit out next hand',
          description: 'Keep your seat but skip the next hand',
          helperText: 'Useful for taking a short break or just watching one hand',
          style: 'secondary',
          params: {},
        });
      }
      if (viewer.isHost && this.readyPlayers().length >= MIN_PLAYERS) {
        actions.push({
          type: 'start_round',
          label: 'Deal next hand',
          description: 'After enough players confirm, start the next hand and enter the betting phase',
          helperText: `At least ${MIN_PLAYERS} players must confirm the next hand`,
          style: 'primary',
          params: {},
        });
      }
      return actions;
    }

    if (this.phase === 'betting') {
      if (viewerState.status !== 'betting') return [];
      return [
        {
          type: 'bet',
          label: 'Place bet',
          description: 'Lock in your bet for this hand',
          helperText: 'Bet range is 1-100. If you time out, the hand is skipped but your seat stays reserved.',
          style: 'primary',
          params: {
            amount: {
              type: 'number',
              description: 'Bet amount',
              required: true,
              min: 1,
              max: 100,
              step: 1,
              placeholder: '1-100',
              defaultValue: 20,
            },
          },
        },
      ];
    }

    if (this.phase === 'playing') {
      if (viewerState.status !== 'playing' || this.currentTurnAgentId() !== viewer.agentId) {
        return [];
      }
      return [
        {
          type: 'hit',
          label: 'Hit',
          description: 'Take another card and try to get closer to 21',
          helperText: 'All players can see your cards and total',
          style: 'secondary',
          params: {},
        },
        {
          type: 'stand',
          label: 'Stand',
          description: 'Keep your current total and wait for the dealer and other players to finish',
          helperText: `Current total ${bestTotal(viewerState.hand)}`,
          style: 'secondary',
          params: {},
        },
        {
          type: 'double_down',
          label: 'Double down',
          description: 'Add an equal wager, draw exactly one card, and then stand automatically',
          helperText: viewerState.hand.length === 2 ? 'Only available on your first two cards' : 'Double down is not available right now',
          style: 'primary',
          params: {},
        },
      ];
    }

    return [];
  }

  async abort(reason: string): Promise<void> {
    this.aborted = true;
    this.clearTurnTimer();
    this.clearBettingTimer();

    for (const state of this.players.values()) {
      if (state.frozen > 0) {
        await this.ctx.wallet.unfreeze(state.info.agentId, state.frozen, `blackjack:abort:${reason}`);
        state.frozen = 0;
      }
      this.resetPlayerToIdle(state);
    }
  }

  dispose(): void {
    this.aborted = true;
    this.clearTurnTimer();
    this.clearBettingTimer();
    this.players.clear();
    this.dealer = [];
    this.deck = [];
    this.turnOrder = [];
    this.timeline = [];
    this.recap = null;
  }

  private handleReady(state: PlayerState): ArcadeGameResult {
    if (!['waiting', 'between_hands'].includes(this.phase)) {
      return { ok: false, error: 'You cannot confirm the next hand right now. Wait for the current hand to end.' };
    }
    if (state.sittingOut) {
      return { ok: false, error: 'You are currently sitting out. Return to the table first.' };
    }

    state.readyForNextHand = true;
    state.status = 'ready';
    void this.ctx.logger.log('blackjack_ready', { agentId: state.info.agentId }, state.info);

    const readyCount = this.readyPlayers().length;
    const event = this.recordEvent({
      kind: 'ready',
      severity: 'success',
      actorId: state.info.agentId,
      actorName: state.info.agentName,
      message: `${state.info.agentName} is ready for the next hand`,
      detail: `${readyCount} players have confirmed the next hand so far`,
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
      message: `${state.info.agentName} returned to the table`,
      detail: 'They still need to click "Join next hand" to be dealt in',
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
      message: `${state.info.agentName} chose to sit out this hand`,
      detail: 'The seat stays reserved, and they can return at any time',
    });
    return this.okFromEvent(event);
  }

  private handleStartRound(player: ArcadePlayerIdentity): ArcadeGameResult {
    if (!['waiting', 'between_hands'].includes(this.phase)) {
      return { ok: false, error: 'The table is not currently waiting to start a new hand.' };
    }
    if (!player.isHost) {
      return { ok: false, error: 'Only the host can deal the next hand.' };
    }
    const readyPlayers = this.readyPlayers();
    if (readyPlayers.length < MIN_PLAYERS) {
      return { ok: false, error: `At least ${MIN_PLAYERS} players must confirm the next hand.` };
    }

    this.startBetting(player);
    const event = this.recordEvent({
      kind: 'round_started',
      severity: 'success',
      actorId: player.agentId,
      actorName: player.agentName,
      message: `Host ${player.agentName} started hand ${this.roundNumber}`,
      detail: 'All confirmed participants now need to place their bets',
    });
    return this.okFromEvent(event);
  }

  private async handleBet(state: PlayerState, amount: number): Promise<ArcadeGameResult> {
    if (this.phase !== 'betting') {
      return { ok: false, error: 'The table is not currently in the betting phase.' };
    }
    if (state.status !== 'betting') {
      return { ok: false, error: 'You have already bet, or you are not eligible for this hand.' };
    }
    if (!Number.isFinite(amount) || amount < 1 || amount > 100) {
      return { ok: false, error: 'Bet amount must be an integer between 1 and 100.' };
    }

    const betAmount = Math.floor(amount);
    const frozen = await this.ctx.wallet.freeze(state.info.agentId, betAmount, 'blackjack:bet');
    if (!frozen) {
      return { ok: false, error: 'Not enough chips to place that bet.' };
    }

    state.bet = betAmount;
    state.frozen = betAmount;
    state.status = 'bet_locked';
    void this.ctx.logger.log('blackjack_bet', { agentId: state.info.agentId, amount: betAmount }, state.info);

    const event = this.recordEvent({
      kind: 'bet_placed',
      severity: 'success',
      actorId: state.info.agentId,
      actorName: state.info.agentName,
      message: `${state.info.agentName} bet ${betAmount} chips`,
      detail: 'Waiting for the remaining players to lock their bets before dealing',
    });

    this.checkBettingProgress();
    return this.okFromEvent(event);
  }

  private handleHit(state: PlayerState): ArcadeGameResult {
    if (this.phase !== 'playing') {
      return { ok: false, error: 'The table is not currently in the playing phase.' };
    }
    if (state.status !== 'playing') {
      return { ok: false, error: 'You have already finished your action for this round.' };
    }
    if (this.currentTurnAgentId() !== state.info.agentId) {
      return { ok: false, error: 'It is not your turn yet.' };
    }

    const card = this.draw();
    state.hand.push(card);
    const total = bestTotal(state.hand);
    const face = cardToString(card);

    if (isBust(state.hand)) {
      state.status = 'busted';
      const event = this.recordEvent({
        kind: 'player_busted',
        severity: 'danger',
        actorId: state.info.agentId,
        actorName: state.info.agentName,
        message: `${state.info.agentName} drew ${face} for a total of ${total} and busted`,
        detail: 'They are out of contention for this hand',
      });
      this.advanceTurn();
      return this.okFromEvent(event);
    }

    if (total === 21) {
      state.status = 'stood';
      const event = this.recordEvent({
        kind: 'player_21',
        severity: 'success',
        actorId: state.info.agentId,
        actorName: state.info.agentName,
        message: `${state.info.agentName} drew ${face}, reached 21, and stood automatically`,
        detail: 'Now waiting for the remaining players or the dealer to finish',
      });
      this.advanceTurn();
      return this.okFromEvent(event);
    }

    this.startTurnTimer();
    const event = this.recordEvent({
      kind: 'card_drawn',
      severity: 'info',
      actorId: state.info.agentId,
      actorName: state.info.agentName,
      message: `${state.info.agentName} drew ${face} and now has ${total}`,
      detail: 'They can still hit, stand, or double down',
    });
    return this.okFromEvent(event);
  }

  private handleStand(state: PlayerState): ArcadeGameResult {
    if (this.phase !== 'playing') {
      return { ok: false, error: 'The table is not currently in the playing phase.' };
    }
    if (state.status !== 'playing') {
      return { ok: false, error: 'You have already finished your action for this round.' };
    }
    if (this.currentTurnAgentId() !== state.info.agentId) {
      return { ok: false, error: 'It is not your turn yet.' };
    }

    state.status = 'stood';
    const total = bestTotal(state.hand);
    const event = this.recordEvent({
      kind: 'player_stand',
      severity: 'info',
      actorId: state.info.agentId,
      actorName: state.info.agentName,
      message: `${state.info.agentName} stood on ${total}`,
      detail: 'Action moves to the next player',
    });
    this.advanceTurn();
    return this.okFromEvent(event);
  }

  private async handleDoubleDown(state: PlayerState): Promise<ArcadeGameResult> {
    if (this.phase !== 'playing') {
      return { ok: false, error: 'The table is not currently in the playing phase.' };
    }
    if (state.status !== 'playing') {
      return { ok: false, error: 'You have already finished your action for this round.' };
    }
    if (this.currentTurnAgentId() !== state.info.agentId) {
      return { ok: false, error: 'It is not your turn yet.' };
    }
    if (state.hand.length !== 2) {
      return { ok: false, error: 'Double down is only allowed on your first two cards.' };
    }
    if (state.doubledDown) {
      return { ok: false, error: 'You have already doubled down.' };
    }

    const frozen = await this.ctx.wallet.freeze(state.info.agentId, state.bet, 'blackjack:double_down');
    if (!frozen) {
      return { ok: false, error: 'Not enough chips to double down.' };
    }

    state.doubledDown = true;
    state.frozen += state.bet;
    state.bet *= 2;

    const card = this.draw();
    state.hand.push(card);
    const total = bestTotal(state.hand);
    state.status = isBust(state.hand) ? 'busted' : 'stood';

    const event = this.recordEvent({
      kind: 'double_down',
      severity: isBust(state.hand) ? 'danger' : 'success',
      actorId: state.info.agentId,
      actorName: state.info.agentName,
      message: isBust(state.hand)
        ? `${state.info.agentName} doubled down, drew ${cardToString(card)}, reached ${total}, and busted`
        : `${state.info.agentName} doubled down, drew ${cardToString(card)}, reached ${total}, and stood automatically`,
      detail: `The current wager is now doubled to ${state.bet}`,
    });

    this.advanceTurn();
    return this.okFromEvent(event);
  }

  private startBetting(host: ArcadePlayerIdentity): void {
    if (this.aborted) return;

    this.phase = 'betting';
    this.roundNumber += 1;
    this.recap = null;
    this.prepareForNewHand();

    for (const state of this.players.values()) {
      if (state.sittingOut) {
        state.status = 'sitting_out';
        continue;
      }
      if (state.readyForNextHand && state.connected) {
        state.status = 'betting';
      } else {
        state.status = 'waiting_next';
      }
    }

    this.clearBettingTimer();
    this.bettingDeadlineAt = this.ctx.clock.now() + BETTING_TIMEOUT_MS;
    this.bettingTimer = this.ctx.clock.setTimeout(() => {
      this.bettingTimer = undefined;
      this.bettingDeadlineAt = null;
      const timedOut = this.seatedPlayers().filter((state) => state.status === 'betting');
      for (const state of timedOut) {
        state.readyForNextHand = false;
        state.status = 'skipped';
        this.recordEvent({
          kind: 'bet_timeout',
          severity: 'warning',
          actorId: state.info.agentId,
          actorName: state.info.agentName,
          message: `${state.info.agentName} timed out while betting and is now sitting out this hand`,
          detail: 'The seat is preserved and they can confirm again next hand',
        });
      }
      this.checkBettingProgress(true);
    }, BETTING_TIMEOUT_MS);

    this.recordEvent({
      kind: 'phase_change',
      severity: 'info',
      actorId: host.agentId,
      actorName: host.agentName,
      message: `Betting opened for hand ${this.roundNumber}`,
      detail: 'Lock in your wager before the timer expires',
    });
  }

  private checkBettingProgress(fromTimeout = false): void {
    if (this.aborted || this.phase !== 'betting') return;

    const participants = this.seatedPlayers().filter((state) => state.status === 'bet_locked');
    const pending = this.seatedPlayers().filter((state) => state.status === 'betting');

    if (pending.length > 0) return;

    if (participants.length < MIN_PLAYERS) {
      void this.cancelHandBeforeDeal(fromTimeout);
      return;
    }

    this.clearBettingTimer();
    this.bettingDeadlineAt = null;
    this.dealCards();
  }

  private async cancelHandBeforeDeal(fromTimeout: boolean): Promise<void> {
    for (const state of this.seatedPlayers()) {
      if (state.frozen > 0) {
        await this.ctx.wallet.unfreeze(state.info.agentId, state.frozen, 'blackjack:cancel_before_deal');
        state.frozen = 0;
      }
      state.bet = 0;
      state.hand = [];
      state.doubledDown = false;
      if (state.sittingOut) {
        state.status = 'sitting_out';
      } else if (state.status !== 'skipped') {
        state.status = 'waiting_next';
      }
      state.readyForNextHand = false;
    }

    this.phase = 'between_hands';
    const event = this.recordEvent({
      kind: 'hand_cancelled',
      severity: 'warning',
      message: fromTimeout
        ? `Fewer than ${MIN_PLAYERS} players remained after betting, so the hand was cancelled and locked wagers were returned`
        : `Fewer than ${MIN_PLAYERS} players locked bets, so the hand was cancelled and locked wagers were returned`,
      detail: 'Players keep their seats and may confirm the next hand again',
    });
    this.recap = {
      title: `Hand ${this.roundNumber} was cancelled`,
      summary: event.message,
      detail: event.detail,
      items: this.seatedPlayers().map((state) => ({
        agentId: state.info.agentId,
        agentName: state.info.agentName,
        outcome: state.status === 'skipped' ? 'Skipped this hand' : state.sittingOut ? 'Sat out this hand' : 'Waiting for next hand',
        summary: state.status === 'skipped' ? 'Betting timed out, but the seat is preserved' : state.sittingOut ? 'Still sitting out this hand' : 'Can confirm the next hand again',
        delta: 0,
      })),
    };
  }

  private dealCards(): void {
    if (this.aborted) return;
    this.phase = 'playing';
    this.deck = shuffle([...createDeck(), ...createDeck()]);
    this.dealer = [this.draw(), this.draw()];
    this.turnOrder = [];

    for (const state of this.seatedPlayers()) {
      if (state.status !== 'bet_locked') continue;
      state.hand = [this.draw(), this.draw()];
      if (isBlackjack(state.hand)) {
        state.status = 'done';
      } else {
        state.status = 'playing';
      }
      this.turnOrder.push(state.info.agentId);
    }

    this.currentTurnIdx = 0;
    this.recordEvent({
      kind: 'phase_change',
      severity: 'info',
      message: 'Cards are dealt, all player hands are visible, and turn order begins',
      detail: `Dealer upcard ${cardToString(this.dealer[0])}; the hole card remains hidden`,
    });

    if (this.turnOrder.length === 0 || this.allPlayersDone()) {
      void this.settle();
      return;
    }

    this.emitCurrentTurn();
  }

  private emitCurrentTurn(): void {
    if (this.aborted) return;
    const agentId = this.currentTurnAgentId();
    if (!agentId) {
      void this.settle();
      return;
    }

    const state = this.players.get(agentId);
    if (!state || state.status !== 'playing') {
      this.advanceTurn();
      return;
    }

    this.startTurnTimer();
    this.recordEvent({
      kind: 'your_turn',
      severity: 'turn',
      actorId: agentId,
      actorName: state.info.agentName,
      message: `It is now ${state.info.agentName}'s turn`,
      detail: `Current total ${bestTotal(state.hand)}. They may hit, stand, or double down.`,
    });
  }

  private startTurnTimer(): void {
    if (this.aborted) return;
    this.clearTurnTimer();
    const agentId = this.currentTurnAgentId();
    if (!agentId) return;

    this.turnDeadlineAt = this.ctx.clock.now() + TURN_TIMEOUT_MS;
    this.turnTimer = this.ctx.clock.setTimeout(() => {
      this.turnTimer = undefined;
      this.turnDeadlineAt = null;
      const state = this.players.get(agentId);
      if (!state || state.status !== 'playing') return;

      state.status = 'stood';
      this.recordEvent({
        kind: 'turn_timeout',
        severity: 'warning',
        actorId: agentId,
        actorName: state.info.agentName,
        message: `${state.info.agentName} timed out, and the system stood automatically`,
        detail: `The system locked in ${bestTotal(state.hand)}`,
      });
      this.advanceTurn();
    }, TURN_TIMEOUT_MS);
  }

  private clearTurnTimer(): void {
    this.ctx.clock.clearTimeout(this.turnTimer);
    this.turnTimer = undefined;
    this.turnDeadlineAt = null;
  }

  private clearBettingTimer(): void {
    this.ctx.clock.clearTimeout(this.bettingTimer);
    this.bettingTimer = undefined;
    this.bettingDeadlineAt = null;
  }

  private advanceTurn(): void {
    if (this.aborted) return;
    this.clearTurnTimer();
    if (this.turnOrder.length === 0) {
      void this.settle();
      return;
    }

    for (let step = 1; step <= this.turnOrder.length; step += 1) {
      const nextIndex = (this.currentTurnIdx + step) % this.turnOrder.length;
      const state = this.players.get(this.turnOrder[nextIndex]);
      if (state && state.status === 'playing') {
        this.currentTurnIdx = nextIndex;
        this.emitCurrentTurn();
        return;
      }
    }

    void this.settle();
  }

  private checkAdvance(): void {
    if (this.aborted || this.phase !== 'playing') return;
    if (this.allPlayersDone()) {
      void this.settle();
    }
  }

  private allPlayersDone(): boolean {
    return this.seatedPlayers()
      .filter((state) => state.bet > 0)
      .every((state) => state.status !== 'playing');
  }

  private async settle(): Promise<void> {
    if (this.aborted || this.settling) return;
    this.settling = true;
    this.phase = 'settling';
    this.clearTurnTimer();
    this.clearBettingTimer();

    const dealerDraws: string[] = [];
    while (bestTotal(this.dealer) < 17) {
      if (this.aborted) {
        this.settling = false;
        return;
      }
      const card = this.draw();
      this.dealer.push(card);
      dealerDraws.push(cardToString(card));
    }

    const dealerTotal = bestTotal(this.dealer);
    const dealerBust = isBust(this.dealer);
    if (dealerDraws.length > 0) {
      this.recordEvent({
        kind: 'dealer_draw',
        severity: dealerBust ? 'warning' : 'info',
        message: `Dealer drew ${dealerDraws.join(' / ')}`,
        detail: dealerBust ? `Dealer finished on ${dealerTotal} and busted` : `Dealer stood on ${dealerTotal}`,
      });
    } else {
      this.recordEvent({
        kind: 'dealer_stand',
        severity: 'info',
        message: `Dealer stood on ${dealerTotal}`,
        detail: dealerBust ? 'Dealer busted' : 'Comparing all player results now',
      });
    }

    const results: RoundResult[] = [];

    for (const state of this.seatedPlayers()) {
      if (this.aborted) {
        this.settling = false;
        return;
      }
      if (state.bet <= 0) continue;

      const total = bestTotal(state.hand);
      const playerBlackjack = isBlackjack(state.hand);
      const dealerBlackjack = isBlackjack(this.dealer);
      let outcome: RoundResult['outcome'];
      let payout = 0;
      let delta = 0;
      let reason = '';

      if (state.status === 'busted') {
        outcome = 'lose';
        reason = `You busted first, and ${total} is over 21`;
        await this.ctx.wallet.forfeit(state.info.agentId, state.frozen, 'blackjack:lose');
        delta = -state.bet;
      } else if (playerBlackjack && !dealerBlackjack) {
        outcome = 'blackjack';
        reason = `Blackjack natural 21 beats the dealer's ${dealerTotal}`;
        await this.ctx.wallet.unfreeze(state.info.agentId, state.frozen, 'blackjack:return_principal');
        payout = Math.floor(state.bet * 1.5);
        await this.ctx.wallet.reward(state.info.agentId, payout, 'blackjack:blackjack_bonus');
        delta = payout;
      } else if (playerBlackjack && dealerBlackjack) {
        outcome = 'push';
        reason = 'You and the dealer both have Blackjack, so the hand pushes';
        await this.ctx.wallet.unfreeze(state.info.agentId, state.frozen, 'blackjack:push');
      } else if (dealerBust || total > dealerTotal) {
        outcome = 'win';
        reason = dealerBust
          ? `The dealer busted, so your ${total} wins immediately`
          : `${total} beats the dealer's ${dealerTotal}`;
        await this.ctx.wallet.unfreeze(state.info.agentId, state.frozen, 'blackjack:return_principal');
        payout = state.bet;
        await this.ctx.wallet.reward(state.info.agentId, payout, 'blackjack:win');
        delta = payout;
      } else if (total === dealerTotal) {
        outcome = 'push';
        reason = `${total} ties the dealer, so the hand pushes`;
        await this.ctx.wallet.unfreeze(state.info.agentId, state.frozen, 'blackjack:push');
      } else {
        outcome = 'lose';
        reason = `${total} is lower than the dealer's ${dealerTotal}`;
        await this.ctx.wallet.forfeit(state.info.agentId, state.frozen, 'blackjack:lose');
        delta = -state.bet;
      }

      state.frozen = 0;
      state.status = 'settled';
      results.push({
        agentId: state.info.agentId,
        agentName: state.info.agentName,
        hand: state.hand.map(cardToString),
        total,
        bet: state.bet,
        outcome,
        payout,
        delta,
        reason,
      });

      const scoreResult = outcome === 'push' ? 'draw' : outcome === 'lose' ? 'loss' : 'win';
      await this.ctx.stats.recordResult(state.info.agentId, 'blackjack', scoreResult, state.bet, payout);
    }

    this.recap = this.buildRecap(results, dealerTotal, dealerBust);
    const summary = results
      .map((result) => `${result.agentName}${result.delta > 0 ? ` +${result.delta}` : result.delta < 0 ? ` ${result.delta}` : ' 0'}`)
      .join(', ');

    this.recordEvent({
      kind: 'game_over',
      severity: 'success',
      message: `Hand ${this.roundNumber} has been settled`,
      detail: summary || 'No player placed a real wager this hand',
    }, {
      recap: this.recap,
      dealer: {
        hand: this.dealer.map(cardToString),
        total: dealerTotal,
        busted: dealerBust,
      },
      results: results.map((result) => ({
        agentId: result.agentId,
        agentName: result.agentName,
        hand: result.hand,
        total: result.total,
        bet: result.bet,
        outcome: result.outcome,
        payout: result.payout,
        delta: result.delta,
        reason: result.reason,
      })),
    });

    this.transitionToBetweenHands(results);
    this.settling = false;
  }

  private transitionToBetweenHands(results: RoundResult[]): void {
    if (this.aborted) return;
    this.phase = 'between_hands';
    this.clearTurnTimer();
    this.clearBettingTimer();
    this.turnOrder = [];
    this.currentTurnIdx = 0;

    for (const state of this.seatedPlayers()) {
      state.doubledDown = false;
      state.readyForNextHand = false;
      if (state.sittingOut) {
        state.status = 'sitting_out';
      } else if (state.bet > 0) {
        state.status = 'waiting_next';
      } else if (state.status === 'skipped') {
        state.status = 'skipped';
      } else {
        state.status = 'joined';
      }
    }

    const winners = results.filter((result) => result.delta > 0);
    this.recordEvent({
      kind: 'between_hands',
      severity: winners.length > 0 ? 'success' : 'info',
      message: winners.length
        ? `Waiting for the next hand. Winners: ${winners.map((result) => result.agentName).join(' / ')}`
        : 'Waiting for the next hand. Players may confirm participation again.',
      detail: 'Players may continue into the next hand or choose to sit out',
    });
  }

  private prepareForNewHand(): void {
    this.dealer = [];
    this.deck = [];
    this.turnOrder = [];
    this.currentTurnIdx = 0;

    for (const state of this.players.values()) {
      state.hand = [];
      state.bet = 0;
      state.frozen = 0;
      state.doubledDown = false;
    }
  }

  private currentTurnAgentId(): string | undefined {
    return this.turnOrder[this.currentTurnIdx];
  }

  private seatedPlayers(): PlayerState[] {
    return Array.from(this.players.values());
  }

  private readyPlayers(): PlayerState[] {
    return this.seatedPlayers().filter((state) => state.readyForNextHand && !state.sittingOut && state.connected);
  }

  private draw(): Card {
    if (this.deck.length === 0) {
      this.deck = shuffle([...createDeck(), ...createDeck()]);
    }
    return this.deck.pop()!;
  }

  private buildStatusText(): string {
    switch (this.phase) {
      case 'waiting':
        return `Waiting for players to confirm the next hand (at least ${MIN_PLAYERS})`;
      case 'betting':
        return 'Betting phase. Every participant must lock in a wager before the timer expires.';
      case 'playing':
        return 'Action phase. All player hands are visible, and each player chooses hit, stand, or double down in order.';
      case 'settling':
        return 'Dealer reveal and hand settlement';
      case 'between_hands':
        return 'Settlement is preserved while players decide on the next hand';
      default:
        return 'Table state synchronized';
    }
  }

  private buildDealerDetail(settledView: boolean): string {
    if (!this.dealer.length) {
      return this.phase === 'between_hands' ? 'No hand was completed in the previous round' : 'Waiting for the host to deal the next hand';
    }
    if (settledView) {
      return isBust(this.dealer) ? 'Dealer busted' : 'Dealer reveal complete';
    }
    return 'Dealer shows one card and keeps one hidden';
  }

  private buildViewerPrompt(viewerState?: PlayerState): string {
    if (!viewerState) return 'You are spectating. Wait for the table to advance.';

    if (this.phase === 'betting') {
      if (viewerState.status === 'betting') return 'This hand has started. Place your bet soon to lock your seat.';
      if (viewerState.status === 'bet_locked') return 'Your bet is locked. Waiting for the other players to finish betting.';
      return 'Waiting for the betting phase to finish';
    }

    if (this.phase === 'playing') {
      if (viewerState.status === 'playing' && this.currentTurnAgentId() === viewerState.info.agentId) {
        return `It is your turn. Your current total is ${bestTotal(viewerState.hand)}.`;
      }
      if (this.currentTurnAgentId()) {
        const actor = this.players.get(this.currentTurnAgentId() ?? '');
        return `Waiting for ${actor?.info.agentName ?? 'the next player'} to act`;
      }
      return 'Waiting for the dealer reveal and settlement';
    }

    if (this.phase === 'between_hands') {
      if (viewerState.sittingOut) return 'You are currently sitting out. Return to the table before joining the next hand.';
      if (viewerState.readyForNextHand) return 'You are ready for the next hand. Waiting for the host to deal.';
      return 'You can choose to join the next hand or sit out.';
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

    if (this.phase === 'playing' && viewerState.status === 'playing' && this.currentTurnAgentId() === viewerState.info.agentId) {
      return {
        kind: 'turn',
        title: 'Your turn',
        body: `Your current total is ${bestTotal(viewerState.hand)}. Choose hit, stand, or double down.`,
        countdownMs: this.remainingMs(this.turnDeadlineAt),
      };
    }

    if (this.phase === 'betting' && viewerState.status === 'betting') {
      return {
        kind: 'turn',
        title: 'Place your bet first',
        body: 'This hand has started. You will only receive two face-up cards after locking in your bet.',
        countdownMs: this.remainingMs(this.bettingDeadlineAt),
      };
    }

    if (this.phase === 'between_hands' && this.recap) {
      const recapItem = this.recap.items.find((item) => item.agentId === viewerState.info.agentId);
      if (recapItem) {
        return {
          kind: recapItem.delta === undefined ? 'info' : recapItem.delta > 0 ? 'success' : recapItem.delta < 0 ? 'danger' : 'info',
          title: recapItem.delta && recapItem.delta > 0 ? `You won +${recapItem.delta}` : recapItem.delta && recapItem.delta < 0 ? `You lost ${recapItem.delta}` : 'This hand is over',
          body: recapItem.summary,
        };
      }
    }

    if (this.currentTurnAgentId()) {
      const actor = this.players.get(this.currentTurnAgentId() ?? '');
      return {
        kind: 'info',
        title: `Waiting for ${actor?.info.agentName ?? 'the next player'}`,
        body: viewerPrompt,
      };
    }

    return {
      kind: 'info',
      title: this.phase === 'between_hands' ? 'Waiting for next hand' : 'Table synchronized',
      body: viewerPrompt,
    };
  }

  private buildRecap(results: RoundResult[], dealerTotal: number, dealerBust: boolean): ArcadePresentationRecap {
    const dealerSummary = `Dealer ${dealerBust ? `busted (${dealerTotal})` : `${dealerTotal}`}`;
    return {
      title: `Hand ${this.roundNumber} recap`,
      summary: dealerSummary,
      detail: `Dealer hand ${this.dealer.map(cardToString).join(' / ')}`,
      items: results.map((result) => ({
        agentId: result.agentId,
        agentName: result.agentName,
        outcome: result.outcome === 'blackjack' ? 'Blackjack' : result.outcome === 'win' ? 'Won' : result.outcome === 'lose' ? 'Lost' : 'Push',
        summary: result.reason,
        delta: result.delta,
        hand: result.hand,
        label: result.outcome === 'blackjack' ? 'Blackjack' : `${result.total}`,
      })),
    };
  }

  private resetPlayerToIdle(state: PlayerState): void {
    state.hand = [];
    state.bet = 0;
    state.frozen = 0;
    state.status = state.sittingOut ? 'sitting_out' : 'joined';
    state.doubledDown = false;
    state.readyForNextHand = false;
  }

  private remainingMs(deadlineAt: number | null): number | undefined {
    if (!deadlineAt) return undefined;
    return Math.max(0, deadlineAt - this.ctx.clock.now());
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
      id: `blackjack-${this.ctx.table.tableId}-${++this.eventCounter}`,
      createdAt: this.ctx.clock.now(),
      viewerPrompt: input.viewerPrompt,
    };
    this.timeline = [event, ...this.timeline].slice(0, TIMELINE_LIMIT);
    this.ctx.events.emit(extras ? { ...event, ...extras } : event);
    return event;
  }
}

export class BlackjackGame implements ArcadeGameDefinition {
  readonly id = 'blackjack';
  readonly version = '1.0.0';
  readonly apiVersion = ARCADE_GAME_API_VERSION;
  readonly catalog = {
    name: 'Blackjack',
    description: 'Classic continuous Blackjack table with host-driven deals, open player hands, double down, spectating, and reconnect recovery.',
    minPlayers: MIN_PLAYERS,
    maxPlayers: 6,
    tags: ['card', 'betting', 'classic'],
    capabilities: {
      reconnect: true,
      reconnectGraceMs: 60_000,
      minPlayersToContinue: 1,
      spectators: true,
      midGameJoin: false,
    },
  };

  private hostContext?: ArcadeGameHostContext;

  init(ctx: ArcadeGameHostContext): void {
    this.hostContext = ctx;
  }

  createSession(ctx: ArcadeGameSessionContext): ArcadeGameSession {
    return new BlackjackSession(ctx);
  }
}

export default BlackjackGame;
