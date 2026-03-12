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
  type ArcadePlayerIdentity,
  type ArcadeSessionResult,
  type ArcadeSessionResultItem,
  type ArcadeSessionState,
  type ArcadeSessionStatus,
  type ArcadeTimelineEvent,
} from '../../types.js';

type Phase = 'waiting' | 'playing' | 'between_round' | 'between_matches';
type PlayerStatus = 'joined' | 'ready' | 'playing' | 'eliminated' | 'won_round' | 'lost_round';
type CardType = 'spy' | 'guard' | 'priest' | 'baron' | 'handmaid' | 'prince' | 'chancellor' | 'king' | 'countess' | 'princess';
type PendingStep = 'target' | 'guess' | 'chancellor';

interface CardDefinition {
  type: CardType;
  value: number;
  label: string;
  count: number;
}

interface CardInstance {
  id: string;
  type: CardType;
  value: number;
  label: string;
}

interface PlayerState {
  info: ArcadePlayerIdentity;
  connected: boolean;
  ready: boolean;
  status: PlayerStatus;
  hand: CardInstance[];
  discards: CardInstance[];
  protected: boolean;
  eliminated: boolean;
  tokens: number;
  spyPlayed: boolean;
}

interface PendingResolution {
  actorId: string;
  card: CardInstance;
  step: PendingStep;
  targetAgentId?: string;
  chancellorCards?: CardInstance[];
}

interface RoundWinner {
  agentId: string;
  reason: string;
}

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 6;

const CARD_SET: CardDefinition[] = [
  { type: 'spy', value: 0, label: 'Spy', count: 2 },
  { type: 'guard', value: 1, label: 'Guard', count: 6 },
  { type: 'priest', value: 2, label: 'Priest', count: 2 },
  { type: 'baron', value: 3, label: 'Baron', count: 2 },
  { type: 'handmaid', value: 4, label: 'Handmaid', count: 2 },
  { type: 'prince', value: 5, label: 'Prince', count: 2 },
  { type: 'chancellor', value: 6, label: 'Chancellor', count: 2 },
  { type: 'king', value: 7, label: 'King', count: 1 },
  { type: 'countess', value: 8, label: 'Countess', count: 1 },
  { type: 'princess', value: 9, label: 'Princess', count: 1 },
];

const TOKENS_TO_WIN: Record<number, number> = {
  2: 6,
  3: 5,
  4: 4,
  5: 3,
  6: 3,
};

const GUARD_GUESSES = ['priest', 'baron', 'handmaid', 'prince', 'chancellor', 'king', 'countess', 'princess'];

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function cardDefinition(type: CardType): CardDefinition {
  const found = CARD_SET.find((card) => card.type === type);
  if (!found) throw new Error(`Unknown Love Letter card type: ${type}`);
  return found;
}

function cardLabel(type: CardType): string {
  return cardDefinition(type).label;
}

function buildDeck(): CardInstance[] {
  let idCounter = 0;
  const cards: CardInstance[] = [];
  for (const definition of CARD_SET) {
    for (let count = 0; count < definition.count; count += 1) {
      cards.push({
        id: `card-${definition.type}-${++idCounter}`,
        type: definition.type,
        value: definition.value,
        label: definition.label,
      });
    }
  }
  return shuffle(cards);
}

function serializeCard(card: CardInstance): string {
  return `${card.label} (${card.value})`;
}

function fallbackCard(): CardInstance {
  return {
    id: 'love-letter-fallback',
    type: 'guard',
    value: 1,
    label: 'Guard',
  };
}

function pendingCardChoicesLength(pending: PendingResolution | null): number {
  return pending?.chancellorCards?.length ?? 0;
}

function normalizeIndex(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function normalizeString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

class LoveLetterSession implements ArcadeGameSession {
  private readonly ctx: ArcadeGameSessionContext;
  private readonly players = new Map<string, PlayerState>();
  private readonly seatOrder: string[] = [];
  private phase: Phase = 'waiting';
  private deck: CardInstance[] = [];
  private burnedCard: CardInstance | null = null;
  private removedFaceUp: CardInstance[] = [];
  private pending: PendingResolution | null = null;
  private currentPlayer: string | null = null;
  private starterAgentId: string | null = null;
  private roundNumber = 0;
  private recap: ArcadeSessionResult | null = null;
  private viewedHands = new Map<string, { targetAgentId: string; card: CardInstance }>();
  private eventCounter = 0;

  constructor(ctx: ArcadeGameSessionContext) {
    this.ctx = ctx;
  }

  get status(): ArcadeSessionStatus {
    return this.phase === 'playing' ? 'playing' : 'waiting';
  }

  onJoin(player: ArcadePlayerIdentity): ArcadeJoinResult {
    const existing = this.players.get(player.agentId);
    if (existing) {
      existing.info = player;
      existing.connected = true;
      return { ok: true };
    }
    if (this.players.size >= MAX_PLAYERS) {
      return { ok: false, error: 'Love Letter supports at most 6 players' };
    }

    this.players.set(player.agentId, {
      info: player,
      connected: true,
      ready: false,
      status: 'joined',
      hand: [],
      discards: [],
      protected: false,
      eliminated: false,
      tokens: 0,
      spyPlayed: false,
    });
    this.seatOrder.push(player.agentId);
    this.recordEvent({
      kind: 'player_joined',
      actorId: player.agentId,
      actorName: player.agentName,
      message: `${player.agentName} joined the Love Letter table`,
      detail: `${this.players.size} / ${MAX_PLAYERS} players are seated`,
    });
    return { ok: true };
  }

  onLeave(player: ArcadePlayerIdentity, reason: ArcadeLeaveReason): ArcadeLeaveResult {
    const state = this.players.get(player.agentId);
    if (!state) return { keepSlot: false };

    if (reason === 'disconnect') {
      state.connected = false;
      this.recordEvent({
        kind: 'player_disconnected',
        actorId: player.agentId,
        actorName: player.agentName,
        message: `${player.agentName} disconnected and is waiting to reconnect`,
        detail: 'Their seat and current round state are reserved',
      });
      return { keepSlot: true };
    }

    if (this.phase === 'playing' && !state.eliminated) {
      state.eliminated = true;
      state.status = 'eliminated';
      state.hand = [];
      this.recordEvent({
        kind: 'player_left',
        actorId: player.agentId,
        actorName: player.agentName,
        message: `${player.agentName} left the table and is eliminated this round`,
      });
      void this.maybeFinishRound(`${player.agentName} left the table and was eliminated`);
    }

    this.removePlayer(player.agentId);
    return { keepSlot: false };
  }

  onReconnect(player: ArcadePlayerIdentity): { ok: boolean; error?: string } {
    const state = this.players.get(player.agentId);
    if (!state) return { ok: false, error: 'The seat is no longer valid' };
    state.connected = true;
    state.info = player;
    this.recordEvent({
      kind: 'player_reconnected',
      actorId: player.agentId,
      actorName: player.agentName,
      message: `${player.agentName} returned to the Love Letter table`,
    });
    return { ok: true };
  }

  async onAction(player: ArcadePlayerIdentity, action: ArcadeGameAction): Promise<ArcadeGameResult> {
    const state = this.players.get(player.agentId);
    if (!state) return { ok: false, error: 'You are not currently seated at this Love Letter table' };

    switch (action.type) {
      case 'ready':
        return this.handleReady(state);
      case 'play_card':
        return this.handlePlayCard(state, action);
      case 'choose_target':
        return this.handleChooseTarget(state, action);
      case 'choose_guess':
        return this.handleChooseGuess(state, action);
      case 'resolve_chancellor':
        return this.handleResolveChancellor(state, action);
      default:
        return { ok: false, error: `Unsupported Love Letter action: ${action.type}` };
    }
  }

  getState(viewer?: ArcadePlayerIdentity): ArcadeSessionState {
    const viewerState = viewer ? this.players.get(viewer.agentId) ?? null : null;
    return {
      status: this.status,
      phase: this.phase,
      prompt: this.buildPrompt(viewerState),
      needAction: this.viewerNeedsAction(viewerState),
      legalActions: [],
      players: this.seatOrder
        .map((agentId) => this.players.get(agentId))
        .filter((state): state is PlayerState => Boolean(state))
        .map((state) => ({
          agentId: state.info.agentId,
          agentName: state.info.agentName,
          isHost: !!state.info.isHost,
          status: state.status,
          connected: state.connected,
          cardCount: state.hand.length,
          stack: state.tokens,
          eliminated: state.eliminated,
          protected: state.protected,
          readyForNextHand: state.ready,
          hand: viewerState?.info.agentId === state.info.agentId
            ? state.hand.map(serializeCard)
            : undefined,
          publicDiscards: state.discards.map(serializeCard),
        })),
      roundNumber: this.roundNumber,
      tokensToWin: TOKENS_TO_WIN[Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, this.players.size || MIN_PLAYERS))],
      scoreboard: this.seatOrder
        .map((agentId) => this.players.get(agentId))
        .filter((state): state is PlayerState => Boolean(state))
        .map((state) => ({
          agentId: state.info.agentId,
          agentName: state.info.agentName,
          tokens: state.tokens,
        })),
      deckCount: this.deck.length,
      burnedCardCount: this.burnedCard ? 1 : 0,
      removedFaceUp: this.removedFaceUp.map(serializeCard),
      currentPlayer: this.currentPlayer,
      publicDiscards: this.seatOrder.reduce<Record<string, string[]>>((acc, agentId) => {
        const state = this.players.get(agentId);
        if (state) acc[agentId] = state.discards.map(serializeCard);
        return acc;
      }, {}),
      protectedPlayers: this.activePlayers().filter((state) => state.protected).map((state) => state.info.agentId),
      eliminatedPlayers: this.seatOrder.filter((agentId) => this.players.get(agentId)?.eliminated),
      pending: this.pending ? {
        actorId: this.pending.actorId,
        step: this.pending.step,
        card: serializeCard(this.pending.card),
        targetAgentId: this.pending.targetAgentId ?? null,
      } : null,
      peekedCard: viewerState ? this.peekedCardFor(viewerState.info.agentId) : null,
      result: this.recap,
    };
  }

  getActionSchema(viewer?: ArcadePlayerIdentity): ArcadeGameActionSchema[] {
    const viewerState = viewer ? this.players.get(viewer.agentId) ?? null : null;
    if (!viewerState) return [];

    if (this.phase !== 'playing') {
      if (!viewerState.ready) {
        return [{
          type: 'ready',
          label: 'Ready up',
          description: 'Confirm that you will play this Love Letter match',
          style: 'primary',
          helperText: this.players.size < MIN_PLAYERS ? 'At least 2 players need to ready up' : 'The round starts automatically when all seated players are ready',
          params: {},
        }];
      }
      return [];
    }

    if (this.pending?.actorId === viewerState.info.agentId) {
      return this.pendingActionsFor(viewerState);
    }

    if (this.currentPlayer !== viewerState.info.agentId) return [];
    if (this.pending) return [];

    const forcedCountess = this.mustPlayCountess(viewerState);
    const handOptions = viewerState.hand.map((card, index) => `${index}:${serializeCard(card)}`);
    const actions: ArcadeGameActionSchema[] = [{
      type: 'play_card',
      label: 'Play card',
      description: forcedCountess ? 'You are holding Countess and must play her first' : 'Play one card from your current two-card hand',
      style: 'primary',
      helperText: `Available cards: ${handOptions.join(' / ')}`,
      params: {
        cardIndex: {
          type: 'number',
          description: 'Hand index to play (0 or 1)',
          required: true,
          min: 0,
          max: Math.max(0, viewerState.hand.length - 1),
          step: 1,
        },
      },
    }];

    return actions;
  }

  dispose(): void {}

  private handleReady(state: PlayerState): ArcadeGameResult {
    if (this.phase === 'playing') return { ok: false, error: 'A round is already in progress, you cannot ready up again' };
    state.ready = true;
    state.status = 'ready';
    const event = this.recordEvent({
      kind: 'ready',
      actorId: state.info.agentId,
      actorName: state.info.agentName,
      message: `${state.info.agentName} is ready for Love Letter`,
      detail: `${this.readyPlayers().length} / ${this.players.size} players are ready`,
    });

    if (this.players.size >= MIN_PLAYERS && this.readyPlayers().length === this.players.size) {
      this.startMatch();
    }

    return this.okFromEvent(event);
  }

  private handlePlayCard(state: PlayerState, action: ArcadeGameAction): ArcadeGameResult {
    if (this.phase !== 'playing') return { ok: false, error: 'You are not currently in a Love Letter round' };
    if (this.currentPlayer !== state.info.agentId) return { ok: false, error: 'It is not your turn yet' };
    if (this.pending) return { ok: false, error: 'Finish the current card resolution first' };

    const cardIndex = normalizeIndex(action.cardIndex);
    if (cardIndex === null || cardIndex < 0 || cardIndex >= state.hand.length) {
      return { ok: false, error: 'Choose a valid hand index' };
    }

    const forcedCountess = this.mustPlayCountess(state);
    const card = state.hand[cardIndex];
    if (!card) return { ok: false, error: 'That card does not exist in your hand' };
    if (forcedCountess && card.type !== 'countess') {
      return { ok: false, error: 'You are holding Countess with King or Prince and must play Countess first' };
    }

    state.hand.splice(cardIndex, 1);
    state.discards.push(card);
    if (card.type === 'spy') state.spyPlayed = true;
    this.viewedHands.delete(state.info.agentId);

    switch (card.type) {
      case 'spy':
        return this.finishTurnWithEvent(state, card, `${state.info.agentName} played Spy`);
      case 'guard': {
        const targets = this.validTargets(state, false);
        if (targets.length === 0) {
          return this.finishTurnWithEvent(state, card, `${state.info.agentName} played Guard, but there was no legal target`);
        }
        this.pending = { actorId: state.info.agentId, card, step: 'target' };
        const event = this.recordEvent({
          kind: 'play_card',
          actorId: state.info.agentId,
          actorName: state.info.agentName,
          message: `${state.info.agentName} played Guard`,
          detail: 'Choose a target, then guess their card',
        });
        return this.okFromEvent(event);
      }
      case 'priest':
      case 'baron':
      case 'king': {
        const targets = this.validTargets(state, false);
        if (targets.length === 0) {
          return this.finishTurnWithEvent(state, card, `${state.info.agentName} played ${card.label}, but there was no legal target`);
        }
        this.pending = { actorId: state.info.agentId, card, step: 'target' };
        const event = this.recordEvent({
          kind: 'play_card',
          actorId: state.info.agentId,
          actorName: state.info.agentName,
          message: `${state.info.agentName} played ${card.label}`,
          detail: 'Choose a target',
        });
        return this.okFromEvent(event);
      }
      case 'prince': {
        this.pending = { actorId: state.info.agentId, card, step: 'target' };
        const event = this.recordEvent({
          kind: 'play_card',
          actorId: state.info.agentId,
          actorName: state.info.agentName,
          message: `${state.info.agentName} played Prince`,
          detail: 'Choose a target, including yourself if desired',
        });
        return this.okFromEvent(event);
      }
      case 'handmaid':
        state.protected = true;
        return this.finishTurnWithEvent(state, card, `${state.info.agentName} played Handmaid and is protected this round`);
      case 'countess':
        return this.finishTurnWithEvent(state, card, `${state.info.agentName} played Countess`);
      case 'princess':
        state.eliminated = true;
        state.status = 'eliminated';
        state.hand = [];
        return this.finishTurnWithEvent(state, card, `${state.info.agentName} played Princess and was eliminated immediately`);
      case 'chancellor': {
        const extraCards: CardInstance[] = [];
        if (this.deck.length > 0) extraCards.push(this.drawCard());
        if (this.deck.length > 0) extraCards.push(this.drawCard());
        this.pending = {
          actorId: state.info.agentId,
          card,
          step: 'chancellor',
          chancellorCards: [...state.hand, ...extraCards],
        };
        const event = this.recordEvent({
          kind: 'play_card',
          actorId: state.info.agentId,
          actorName: state.info.agentName,
          message: `${state.info.agentName} played Chancellor`,
          detail: `Keep 1 card from ${pendingCardChoicesLength(this.pending)} cards and place the other 2 on the bottom of the deck`,
        });
        return this.okFromEvent(event);
      }
      default:
        return { ok: false, error: `Unhandled card type: ${card.type}` };
    }
  }

  private handleChooseTarget(state: PlayerState, action: ArcadeGameAction): ArcadeGameResult {
    const pending = this.pending;
    if (!pending || pending.actorId !== state.info.agentId || pending.step !== 'target') {
      return { ok: false, error: 'There is no pending target to choose' };
    }

    const targetAgentId = normalizeString(action.targetAgentId);
    if (!targetAgentId) return { ok: false, error: 'Provide a target player ID' };

    const target = this.players.get(targetAgentId);
    if (!target || !this.isValidTarget(state, target, pending.card.type === 'prince')) {
      return { ok: false, error: 'That target cannot be selected right now' };
    }

    if (pending.card.type === 'guard') {
      this.pending = { ...pending, targetAgentId, step: 'guess' };
      const event = this.recordEvent({
        kind: 'target_selected',
        actorId: state.info.agentId,
        actorName: state.info.agentName,
        message: `${state.info.agentName} targeted ${target.info.agentName} with Guard`,
        detail: 'Now choose the card type to guess',
      });
      return this.okFromEvent(event);
    }

    this.pending = null;
    switch (pending.card.type) {
      case 'priest':
        if (target.hand[0]) {
          this.viewedHands.set(state.info.agentId, { targetAgentId, card: target.hand[0] });
        }
        return this.completeResolvedTurn(
          state,
          `${state.info.agentName} looked at ${target.info.agentName}'s hand`,
        );
      case 'baron': {
        const actorCard = state.hand[0];
        const targetCard = target.hand[0];
        if (!actorCard || !targetCard) {
          return this.completeResolvedTurn(state, `${state.info.agentName} played Baron, but there were not enough cards to compare`);
        }
        if (actorCard.value > targetCard.value) {
          this.eliminatePlayer(target, `${state.info.agentName}'s Baron won the comparison`);
          return this.completeResolvedTurn(state, `${state.info.agentName} defeated ${target.info.agentName} with Baron`);
        }
        if (actorCard.value < targetCard.value) {
          this.eliminatePlayer(state, `${target.info.agentName}'s Baron won the comparison`);
          return this.completeResolvedTurn(state, `${target.info.agentName} beat ${state.info.agentName} with Baron`);
        }
        return this.completeResolvedTurn(state, `${state.info.agentName} tied with ${target.info.agentName} on Baron`);
      }
      case 'king': {
        const actorHand = [...state.hand];
        state.hand = [...target.hand];
        target.hand = actorHand;
        this.viewedHands.delete(state.info.agentId);
        return this.completeResolvedTurn(state, `${state.info.agentName} swapped hands with ${target.info.agentName}`);
      }
      case 'prince': {
        const discarded = target.hand.shift();
        if (discarded) {
          target.discards.push(discarded);
          if (discarded.type === 'spy') target.spyPlayed = true;
          if (discarded.type === 'princess') {
            this.eliminatePlayer(target, `${target.info.agentName} discarded Princess because of Prince`);
            return this.completeResolvedTurn(state, `${state.info.agentName} forced ${target.info.agentName} to discard Princess with Prince`);
          }
        }
        if (!target.eliminated) {
          const replacement = this.deck.length > 0 ? this.drawCard() : this.burnedCard;
          if (replacement) target.hand.push(replacement);
        }
        return this.completeResolvedTurn(state, `${state.info.agentName} made ${target.info.agentName} discard and redraw`);
      }
      default:
        return { ok: false, error: 'This card does not support target selection' };
    }
  }

  private handleChooseGuess(state: PlayerState, action: ArcadeGameAction): ArcadeGameResult {
    const pending = this.pending;
    if (!pending || pending.actorId !== state.info.agentId || pending.step !== 'guess' || pending.card.type !== 'guard') {
      return { ok: false, error: 'There is no pending guess to choose' };
    }

    const guess = normalizeString(action.guess) as CardType | null;
    if (!guess || !GUARD_GUESSES.includes(guess)) {
      return { ok: false, error: 'Guard may only guess Priest, Baron, Handmaid, Prince, Chancellor, King, Countess, or Princess' };
    }
    const target = pending.targetAgentId ? this.players.get(pending.targetAgentId) : null;
    if (!target || target.eliminated) {
      this.pending = null;
      return { ok: false, error: 'The target is no longer valid, start the action again' };
    }

    this.pending = null;
    if (target.hand[0]?.type === guess) {
      this.eliminatePlayer(target, `${state.info.agentName} correctly guessed ${target.info.agentName}'s card with Guard`);
      return this.completeResolvedTurn(
        state,
        `${state.info.agentName} guessed that ${target.info.agentName} was holding ${cardLabel(guess)} with Guard and eliminated them`,
      );
    }

    return this.completeResolvedTurn(
      state,
      `${state.info.agentName} guessed ${cardLabel(guess)} with Guard, but missed`,
    );
  }

  private handleResolveChancellor(state: PlayerState, action: ArcadeGameAction): ArcadeGameResult {
    const pending = this.pending;
    if (!pending || pending.actorId !== state.info.agentId || pending.step !== 'chancellor' || !pending.chancellorCards) {
      return { ok: false, error: 'There is no pending Chancellor choice to resolve' };
    }

    const keepIndex = normalizeIndex(action.keepIndex);
    if (keepIndex === null || keepIndex < 0 || keepIndex >= pending.chancellorCards.length) {
      return { ok: false, error: 'Choose a valid card index to keep' };
    }

    const keepCard = pending.chancellorCards[keepIndex];
    const remainder = pending.chancellorCards.filter((_, index) => index !== keepIndex);
    state.hand = [keepCard];
    this.deck.push(...remainder);
    this.pending = null;

    return this.completeResolvedTurn(
      state,
      `${state.info.agentName} resolved Chancellor and kept ${keepCard.label}`,
    );
  }

  private startMatch(): void {
    for (const state of this.players.values()) {
      state.tokens = 0;
    }
    this.roundNumber = 0;
    this.recap = null;
    this.phase = 'between_round';
    this.startNextRound(null);
  }

  private startNextRound(previousWinnerAgentId: string | null): void {
    const participants = this.seatOrder
      .map((agentId) => this.players.get(agentId))
      .filter((state): state is PlayerState => Boolean(state));
    if (participants.length < MIN_PLAYERS) return;

    this.phase = 'playing';
    this.roundNumber += 1;
    this.pending = null;
    this.deck = buildDeck();
    this.burnedCard = this.deck.shift() ?? null;
    this.removedFaceUp = [];
    this.viewedHands.clear();

    if (participants.length === 2) {
      for (let index = 0; index < 3 && this.deck.length > 0; index += 1) {
        const removed = this.deck.shift();
        if (removed) this.removedFaceUp.push(removed);
      }
    }

    for (const state of participants) {
      state.ready = false;
      state.status = 'playing';
      state.hand = [];
      state.discards = [];
      state.protected = false;
      state.eliminated = false;
      state.spyPlayed = false;
    }

    for (const state of participants) {
      const firstCard = this.drawCard();
      state.hand.push(firstCard);
    }

    this.starterAgentId = previousWinnerAgentId ?? this.nextStarter();
    this.currentPlayer = this.starterAgentId;
    const starter = this.currentPlayer ? this.players.get(this.currentPlayer) : null;
    if (starter && this.deck.length > 0) {
      starter.hand.push(this.drawCard());
    }

    this.recordEvent({
      kind: 'round_started',
      message: `Love Letter round ${this.roundNumber} started`,
      detail: starter ? `${starter.info.agentName} acts first` : undefined,
    });
  }

  private async maybeFinishRound(reason: string): Promise<void> {
    if (this.phase !== 'playing') return;

    const active = this.activePlayers();
    if (active.length === 1) {
      await this.finishRound([{ agentId: active[0].info.agentId, reason }]);
      return;
    }

    if (this.deck.length === 0 && !this.pending) {
      const winners = this.determineDeckWinners();
      await this.finishRound(winners);
    }
  }

  private async finishRound(winners: RoundWinner[]): Promise<void> {
    this.phase = 'between_round';
    this.currentPlayer = null;
    this.pending = null;

    const uniqueWinnerIds = new Set(winners.map((winner) => winner.agentId));
    const singleReason = winners[0]?.reason ?? 'Round finished';

    for (const state of this.players.values()) {
      if (uniqueWinnerIds.has(state.info.agentId)) {
        state.tokens += 1;
        state.status = 'won_round';
      } else {
        state.status = 'lost_round';
      }
    }

    const spyBonusWinner = this.spyBonusWinner();
    if (spyBonusWinner) {
      const bonusState = this.players.get(spyBonusWinner);
      if (bonusState) {
        bonusState.tokens += 1;
      }
    }

    this.recap = {
      title: `Round ${this.roundNumber} recap`,
      summary: winners.length === 1
        ? `${this.players.get(winners[0].agentId)?.info.agentName ?? 'Player'} won the round`
        : 'The round ended in a tie',
      detail: spyBonusWinner
        ? `${singleReason}. ${this.players.get(spyBonusWinner)?.info.agentName ?? 'Player'} gains 1 extra affection token for being the only player to play Spy`
        : singleReason,
      items: this.buildRoundItems(uniqueWinnerIds, spyBonusWinner),
    };

    this.recordEvent({
      kind: 'round_finished',
      message: this.recap.summary,
      detail: this.recap.detail,
    });

    const matchWinners = this.matchWinners();
    if (matchWinners.length > 0) {
      await this.finishMatch(matchWinners);
      return;
    }

    this.startNextRound(winners[0]?.agentId ?? null);
  }

  private async finishMatch(matchWinnerIds: string[]): Promise<void> {
    this.phase = 'between_matches';
    const topScore = Math.max(...matchWinnerIds.map((agentId) => this.players.get(agentId)?.tokens ?? 0));
    const topWinners = this.seatOrder.filter((agentId) => (this.players.get(agentId)?.tokens ?? 0) === topScore);

    const items: ArcadeSessionResultItem[] = [];
    for (const agentId of this.seatOrder) {
      const state = this.players.get(agentId);
      if (!state) continue;
      const isTopWinner = topWinners.includes(agentId);
      const outcome = topWinners.length === 1
        ? (isTopWinner ? 'Won' : 'Lost')
        : (isTopWinner ? 'Draw' : 'Lost');
      items.push({
        agentId: state.info.agentId,
        agentName: state.info.agentName,
        outcome,
        summary: `Earned ${state.tokens} affection tokens this match`,
        label: `${state.tokens} tokens`,
      });
      await this.ctx.stats.recordResult(
        state.info.agentId,
        'love-letter',
        topWinners.length > 1 && isTopWinner ? 'draw' : isTopWinner ? 'win' : 'loss',
        0,
        0,
      );
      state.ready = false;
      state.status = 'joined';
      state.hand = [];
      state.discards = [];
      state.protected = false;
      state.eliminated = false;
      state.spyPlayed = false;
    }

    this.recap = {
      title: 'Love Letter match finished',
      summary: topWinners.length === 1
        ? `${this.players.get(topWinners[0])?.info.agentName ?? 'Player'} reached the target token count first and won the match`
        : 'Multiple players tied for the highest token count',
      detail: `Target tokens: ${this.tokensToWin()}, top score: ${topScore}`,
      items,
    };

    this.recordEvent({
      kind: 'game_over',
      message: this.recap.summary,
      detail: this.recap.detail,
    });
  }

  private finishTurnWithEvent(state: PlayerState, card: CardInstance, message: string): ArcadeGameResult {
    const event = this.recordEvent({
      kind: 'play_card',
      actorId: state.info.agentId,
      actorName: state.info.agentName,
      message,
      detail: `Played ${card.label}`,
    });
    void this.advanceAfterAction(state);
    return this.okFromEvent(event);
  }

  private completeResolvedTurn(state: PlayerState, message: string): ArcadeGameResult {
    const event = this.recordEvent({
      kind: 'action_resolved',
      actorId: state.info.agentId,
      actorName: state.info.agentName,
      message,
    });
    void this.advanceAfterAction(state);
    return this.okFromEvent(event);
  }

  private async advanceAfterAction(state: PlayerState): Promise<void> {
    await this.maybeFinishRound(`${state.info.agentName} finished their action`);
    if (this.phase !== 'playing') return;

    const next = this.nextActivePlayer(state.info.agentId);
    this.currentPlayer = next?.info.agentId ?? null;
    if (!next) return;
    next.protected = false;
    if (this.deck.length > 0) {
      next.hand.push(this.drawCard());
    }
    await this.maybeFinishRound(`${next.info.agentName} entered the final comparison`);
  }

  private drawCard(): CardInstance {
    const card = this.deck.shift();
    if (!card) throw new Error('Love Letter deck is empty');
    return card;
  }

  private nextStarter(): string | null {
    if (!this.starterAgentId) return this.seatOrder[0] ?? null;
    const currentIndex = this.seatOrder.indexOf(this.starterAgentId);
    return this.seatOrder[(currentIndex + 1) % this.seatOrder.length] ?? this.seatOrder[0] ?? null;
  }

  private activePlayers(): PlayerState[] {
    return this.seatOrder
      .map((agentId) => this.players.get(agentId))
      .filter((state): state is PlayerState => Boolean(state))
      .filter((state) => !state.eliminated);
  }

  private readyPlayers(): PlayerState[] {
    return Array.from(this.players.values()).filter((state) => state.ready);
  }

  private nextActivePlayer(agentId: string): PlayerState | null {
    if (this.activePlayers().length <= 1) return null;
    const currentIndex = this.seatOrder.indexOf(agentId);
    for (let offset = 1; offset < this.seatOrder.length; offset += 1) {
      const nextId = this.seatOrder[(currentIndex + offset) % this.seatOrder.length];
      const next = this.players.get(nextId);
      if (next && !next.eliminated) return next;
    }
    return null;
  }

  private validTargets(actor: PlayerState, allowSelf: boolean): PlayerState[] {
    return this.activePlayers().filter((target) => this.isValidTarget(actor, target, allowSelf));
  }

  private isValidTarget(actor: PlayerState, target: PlayerState, allowSelf: boolean): boolean {
    if (target.eliminated) return false;
    if (target.info.agentId === actor.info.agentId) return allowSelf;
    if (target.protected) return false;
    return true;
  }

  private eliminatePlayer(target: PlayerState, reason: string): void {
    target.eliminated = true;
    target.status = 'eliminated';
    target.hand = [];
    this.recordEvent({
      kind: 'player_eliminated',
      actorId: target.info.agentId,
      actorName: target.info.agentName,
      message: `${target.info.agentName} was eliminated`,
      detail: reason,
    });
  }

  private determineDeckWinners(): RoundWinner[] {
    const active = this.activePlayers();
    if (active.length === 0) return [];

    let bestValue = -1;
    let bestDiscardTotal = -1;
    const winners: RoundWinner[] = [];

    for (const state of active) {
      const handValue = state.hand[0]?.value ?? -1;
      const discardTotal = state.discards.reduce((sum, card) => sum + card.value, 0);
      if (handValue > bestValue || (handValue === bestValue && discardTotal > bestDiscardTotal)) {
        bestValue = handValue;
        bestDiscardTotal = discardTotal;
        winners.length = 0;
        winners.push({
          agentId: state.info.agentId,
          reason: `The deck ran out. ${state.info.agentName} led with ${serializeCard(state.hand[0] ?? fallbackCard())} and a discard total of ${discardTotal}`,
        });
        continue;
      }
      if (handValue === bestValue && discardTotal === bestDiscardTotal) {
        winners.push({
          agentId: state.info.agentId,
          reason: `The deck ran out. ${state.info.agentName} tied with the other players`,
        });
      }
    }

    return winners;
  }

  private spyBonusWinner(): string | null {
    const spyPlayers = this.seatOrder
      .map((agentId) => this.players.get(agentId))
      .filter((state): state is PlayerState => Boolean(state))
      .filter((state) => state.spyPlayed);
    return spyPlayers.length === 1 ? spyPlayers[0].info.agentId : null;
  }

  private buildRoundItems(winnerIds: Set<string>, spyBonusWinner: string | null): ArcadeSessionResultItem[] {
    return this.seatOrder
      .map((agentId) => this.players.get(agentId))
      .filter((state): state is PlayerState => Boolean(state))
      .map((state) => ({
        agentId: state.info.agentId,
        agentName: state.info.agentName,
        outcome: winnerIds.has(state.info.agentId) ? 'Won the round' : state.eliminated ? 'Eliminated this round' : 'Did not win',
        summary: spyBonusWinner === state.info.agentId
          ? `${state.tokens} tokens total (includes 1 Spy bonus token)`
          : `${state.tokens} tokens total`,
        hand: state.hand.map(serializeCard),
        label: `${state.tokens} tokens`,
      }));
  }

  private matchWinners(): string[] {
    const threshold = this.tokensToWin();
    const reached = this.seatOrder.filter((agentId) => (this.players.get(agentId)?.tokens ?? 0) >= threshold);
    if (reached.length === 0) return [];
    const topScore = Math.max(...reached.map((agentId) => this.players.get(agentId)?.tokens ?? 0));
    return reached.filter((agentId) => (this.players.get(agentId)?.tokens ?? 0) === topScore);
  }

  private tokensToWin(): number {
    return TOKENS_TO_WIN[Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, this.players.size || MIN_PLAYERS))];
  }

  private mustPlayCountess(state: PlayerState): boolean {
    const hasCountess = state.hand.some((card) => card.type === 'countess');
    const hasPrinceOrKing = state.hand.some((card) => card.type === 'prince' || card.type === 'king');
    return hasCountess && hasPrinceOrKing;
  }

  private pendingActionsFor(viewerState: PlayerState): ArcadeGameActionSchema[] {
    if (!this.pending) return [];
    if (this.pending.step === 'target') {
      const allowSelf = this.pending.card.type === 'prince';
      const targets = this.validTargets(viewerState, allowSelf);
      return [{
        type: 'choose_target',
        label: 'Choose target',
        description: `Choose a target for ${this.pending.card.label}`,
        style: 'primary',
        helperText: `Available targets: ${targets.map((target) => `${target.info.agentName}:${target.info.agentId}`).join(' / ')}`,
        params: {
          targetAgentId: {
            type: 'string',
            description: 'Target player agentId',
            required: true,
          },
        },
      }];
    }

    if (this.pending.step === 'guess') {
      return [{
        type: 'choose_guess',
        label: 'Guess card',
        description: 'Choose the card type to guess for Guard',
        style: 'primary',
        helperText: `Options: ${GUARD_GUESSES.join(', ')}`,
        params: {
          guess: {
            type: 'string',
            description: 'Card type to guess',
            required: true,
            placeholder: GUARD_GUESSES[0],
          },
        },
      }];
    }

    if (this.pending.step === 'chancellor' && this.pending.chancellorCards) {
      return [{
        type: 'resolve_chancellor',
        label: 'Keep card',
        description: 'Keep 1 card from the cards offered by Chancellor',
        style: 'primary',
        helperText: `Choices: ${this.pending.chancellorCards.map((card, index) => `${index}:${serializeCard(card)}`).join(' / ')}`,
        params: {
          keepIndex: {
            type: 'number',
            description: 'Index of the card to keep',
            required: true,
            min: 0,
            max: this.pending.chancellorCards.length - 1,
            step: 1,
          },
        },
      }];
    }

    return [];
  }

  private buildPrompt(viewerState: PlayerState | null): string {
    if (!viewerState) {
      if (this.phase === 'playing') return 'Spectating. Waiting for the current turn to advance.';
      return 'Waiting for players to ready up and start Love Letter';
    }

    if (this.phase !== 'playing') {
      if (this.recap) {
        if (!viewerState.ready) return `${this.recap.summary}. Ready up to start the next Love Letter match`;
        return `${this.recap.summary}. Waiting for the other players to ready up`;
      }
      if (viewerState.ready) return 'You are ready. Waiting for all players to confirm.';
      return this.players.size < MIN_PLAYERS ? 'At least 2 players must be seated and ready.' : 'Ready up. The round starts automatically when all seated players confirm.';
    }

    if (this.pending?.actorId === viewerState.info.agentId) {
      if (this.pending.step === 'target') return `Choose a target for ${this.pending.card.label}`;
      if (this.pending.step === 'guess') return 'Choose the card type to guess for Guard';
      return 'Choose the card to keep for Chancellor';
    }

    if (viewerState.eliminated) {
      return 'You have been eliminated this round. Wait for the round to finish.';
    }

    if (this.currentPlayer === viewerState.info.agentId) {
      return `It is your turn. Current hand: ${viewerState.hand.map((card) => serializeCard(card)).join(' / ')}`;
    }

    return `Waiting for ${this.players.get(this.currentPlayer ?? '')?.info.agentName ?? 'another player'} to act`;
  }

  private viewerNeedsAction(viewerState: PlayerState | null): boolean {
    if (!viewerState) return false;
    if (this.phase !== 'playing') return !viewerState.ready;
    if (viewerState.eliminated) return false;
    if (this.pending?.actorId === viewerState.info.agentId) return true;
    return this.currentPlayer === viewerState.info.agentId && !this.pending;
  }

  private peekedCardFor(agentId: string): { targetAgentId: string; card: string } | null {
    const peek = this.viewedHands.get(agentId);
    if (!peek) return null;
    return {
      targetAgentId: peek.targetAgentId,
      card: serializeCard(peek.card),
    };
  }

  private removePlayer(agentId: string): void {
    this.players.delete(agentId);
    const seatIndex = this.seatOrder.indexOf(agentId);
    if (seatIndex >= 0) this.seatOrder.splice(seatIndex, 1);
    if (this.pending?.actorId === agentId || this.pending?.targetAgentId === agentId) {
      this.pending = null;
    }
    if (this.currentPlayer === agentId) {
      this.currentPlayer = this.nextActivePlayer(agentId)?.info.agentId ?? null;
    }
  }

  private okFromEvent(event: ArcadeTimelineEvent): ArcadeGameResult {
    const data: ArcadeGameActionReceipt = {
      message: event.message,
    };
    return { ok: true, data };
  }

  private recordEvent(input: Omit<ArcadeTimelineEvent, 'id' | 'createdAt' | 'severity'>): ArcadeTimelineEvent {
    const event: ArcadeTimelineEvent = {
      ...input,
      id: `love-letter-${this.ctx.table.tableId}-${++this.eventCounter}`,
      createdAt: this.ctx.clock.now(),
      severity: input.kind === 'game_over' || input.kind === 'round_finished' ? 'success' : input.kind.includes('eliminated') ? 'warning' : 'info',
    };
    this.ctx.events.emit(event);
    return event;
  }
}

export class LoveLetterGame implements ArcadeGameDefinition {
  readonly id = 'love-letter';
  readonly version = '1.0.0';
  readonly apiVersion = ARCADE_GAME_API_VERSION;
  readonly catalog = {
    name: 'Love Letter',
    description: 'Modern-standard Love Letter with multi-round affection-token scoring. Supports spectators, reconnects, and strict private hand visibility.',
    minPlayers: MIN_PLAYERS,
    maxPlayers: MAX_PLAYERS,
    tags: ['card', 'hidden-info', 'casual', 'multi-round'],
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
    return new LoveLetterSession(ctx);
  }
}

export default LoveLetterGame;
