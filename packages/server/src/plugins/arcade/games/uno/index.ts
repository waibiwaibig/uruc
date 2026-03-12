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

type UnoColor = 'red' | 'yellow' | 'green' | 'blue';
type UnoCardType = 'number' | 'skip' | 'reverse' | 'draw-two' | 'wild' | 'wild-draw-four';
type Phase = 'waiting' | 'playing' | 'between_round' | 'between_matches';
type PlayerStatus = 'joined' | 'ready' | 'playing' | 'won_round' | 'lost_round';

interface UnoCard {
  id: string;
  color: UnoColor | null;
  type: UnoCardType;
  value: number | null;
}

interface PlayerState {
  info: ArcadePlayerIdentity;
  connected: boolean;
  ready: boolean;
  status: PlayerStatus;
  hand: UnoCard[];
  matchScore: number;
  unoDeclared: boolean;
}

interface WildDrawFourState {
  sourceAgentId: string;
  targetAgentId: string;
  sourceHadColorMatch: boolean;
}

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 10;
const MATCH_TARGET_SCORE = 500;
const UNO_COLORS: UnoColor[] = ['red', 'yellow', 'green', 'blue'];

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function buildDeck(): UnoCard[] {
  let idCounter = 0;
  const deck: UnoCard[] = [];
  for (const color of UNO_COLORS) {
    deck.push({ id: `uno-${++idCounter}`, color, type: 'number', value: 0 });
    for (let value = 1; value <= 9; value += 1) {
      deck.push({ id: `uno-${++idCounter}`, color, type: 'number', value });
      deck.push({ id: `uno-${++idCounter}`, color, type: 'number', value });
    }
    for (let count = 0; count < 2; count += 1) {
      deck.push({ id: `uno-${++idCounter}`, color, type: 'skip', value: null });
      deck.push({ id: `uno-${++idCounter}`, color, type: 'reverse', value: null });
      deck.push({ id: `uno-${++idCounter}`, color, type: 'draw-two', value: null });
    }
  }
  for (let count = 0; count < 4; count += 1) {
    deck.push({ id: `uno-${++idCounter}`, color: null, type: 'wild', value: null });
    deck.push({ id: `uno-${++idCounter}`, color: null, type: 'wild-draw-four', value: null });
  }
  return shuffle(deck);
}

function colorLabel(color: UnoColor): string {
  switch (color) {
    case 'red':
      return 'Red';
    case 'yellow':
      return 'Yellow';
    case 'green':
      return 'Green';
    case 'blue':
      return 'Blue';
    default:
      return color;
  }
}

function cardLabel(card: UnoCard): string {
  if (card.type === 'number') return `${colorLabel(card.color as UnoColor)} ${card.value}`;
  if (card.type === 'wild') return 'Wild';
  if (card.type === 'wild-draw-four') return 'Wild Draw Four';
  const typeLabel: Record<Exclude<UnoCardType, 'number' | 'wild' | 'wild-draw-four'>, string> = {
    skip: 'Skip',
    reverse: 'Reverse',
    'draw-two': 'Draw Two',
  };
  return `${colorLabel(card.color as UnoColor)} ${typeLabel[card.type]}`;
}

function cardScore(card: UnoCard): number {
  if (card.type === 'number') return card.value ?? 0;
  if (card.type === 'wild' || card.type === 'wild-draw-four') return 50;
  return 20;
}

function normalizeIndex(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function normalizeBoolean(value: unknown): boolean {
  return value === true;
}

function normalizeString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function normalizeColor(value: unknown): UnoColor | null {
  return typeof value === 'string' && UNO_COLORS.includes(value as UnoColor) ? value as UnoColor : null;
}

class UnoSession implements ArcadeGameSession {
  private readonly ctx: ArcadeGameSessionContext;
  private readonly players = new Map<string, PlayerState>();
  private readonly seatOrder: string[] = [];
  private phase: Phase = 'waiting';
  private drawPile: UnoCard[] = [];
  private discardPile: UnoCard[] = [];
  private currentPlayer: string | null = null;
  private direction: 1 | -1 = 1;
  private chosenColor: UnoColor | null = null;
  private pendingDraw = 0;
  private pendingWildDrawFour: WildDrawFourState | null = null;
  private drawnCardIdThisTurn: string | null = null;
  private pendingUnoAgentId: string | null = null;
  private lastRoundScore = 0;
  private recap: ArcadeSessionResult | null = null;
  private roundNumber = 0;
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
      existing.connected = true;
      existing.info = player;
      return { ok: true };
    }
    if (this.players.size >= MAX_PLAYERS) {
      return { ok: false, error: 'UNO supports at most 10 players' };
    }
    this.players.set(player.agentId, {
      info: player,
      connected: true,
      ready: false,
      status: 'joined',
      hand: [],
      matchScore: 0,
      unoDeclared: false,
    });
    this.seatOrder.push(player.agentId);
    this.recordEvent({
      kind: 'player_joined',
      actorId: player.agentId,
      actorName: player.agentName,
      message: `${player.agentName} joined the UNO table`,
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
      });
      return { keepSlot: true };
    }

    if (this.phase === 'playing') {
      this.removePlayerFromRound(player.agentId);
      void this.maybeFinishRound(`${player.agentName} left the table`);
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
      message: `${player.agentName} returned to the UNO table`,
    });
    return { ok: true };
  }

  async onAction(player: ArcadePlayerIdentity, action: ArcadeGameAction): Promise<ArcadeGameResult> {
    const state = this.players.get(player.agentId);
    if (!state) return { ok: false, error: 'You are not currently seated at this UNO table' };

    switch (action.type) {
      case 'ready':
        return this.handleReady(state);
      case 'play_card':
        return this.handlePlayCard(state, action);
      case 'draw':
        return this.handleDraw(state);
      case 'pass':
        return this.handlePass(state);
      case 'call_uno':
        return this.handleCallUno(state, action);
      case 'challenge_wild_draw_four':
        return this.handleChallengeWildDrawFour(state);
      default:
        return { ok: false, error: `Unsupported UNO action: ${action.type}` };
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
          stack: state.matchScore,
          readyForNextHand: state.ready,
          unoDeclared: state.unoDeclared,
          hand: viewerState?.info.agentId === state.info.agentId
            ? state.hand.map(cardLabel)
            : undefined,
        })),
      direction: this.direction,
      topCard: this.topCard() ? cardLabel(this.topCard() as UnoCard) : null,
      chosenColor: this.chosenColor,
      currentPlayer: this.currentPlayer,
      drawPileCount: this.drawPile.length,
      pendingDraw: this.pendingDraw,
      handCountByPlayer: this.seatOrder.reduce<Record<string, number>>((acc, agentId) => {
        acc[agentId] = this.players.get(agentId)?.hand.length ?? 0;
        return acc;
      }, {}),
      unoDeclaredByPlayer: this.seatOrder.filter((agentId) => this.players.get(agentId)?.unoDeclared),
      roundScore: this.lastRoundScore,
      matchScore: this.seatOrder.reduce<Record<string, number>>((acc, agentId) => {
        acc[agentId] = this.players.get(agentId)?.matchScore ?? 0;
        return acc;
      }, {}),
      canChallengeWildDrawFour: !!this.pendingWildDrawFour && viewerState?.info.agentId === this.pendingWildDrawFour.targetAgentId,
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
          description: 'Confirm that you will play this UNO match',
          style: 'primary',
          helperText: this.players.size < MIN_PLAYERS ? 'At least 2 players need to ready up' : 'The round starts automatically when all seated players are ready',
          params: {},
        }];
      }
      return [];
    }

    const actions: ArcadeGameActionSchema[] = [];

    if (this.pendingUnoAgentId) {
      actions.push({
        type: 'call_uno',
        label: this.pendingUnoAgentId === viewerState.info.agentId ? 'Call UNO now' : 'Catch UNO',
        description: this.pendingUnoAgentId === viewerState.info.agentId ? 'Call UNO before another player catches you' : 'Punish a player who failed to call UNO',
        helperText: `Target ${this.players.get(this.pendingUnoAgentId)?.info.agentName ?? this.pendingUnoAgentId}`,
        params: {
          targetAgentId: {
            type: 'string',
            description: 'agentId of the player who needs to call UNO',
            required: false,
            defaultValue: this.pendingUnoAgentId,
          },
        },
      });
    }

    if (this.pendingWildDrawFour?.targetAgentId === viewerState.info.agentId) {
      actions.unshift(
        {
          type: 'challenge_wild_draw_four',
          label: 'Challenge WDF',
          description: 'Challenge the legality of the previous Wild Draw Four',
          style: 'primary',
          params: {},
        },
        {
          type: 'draw',
          label: `Draw ${this.pendingDraw}`,
          description: 'Accept the Wild Draw Four penalty',
          params: {},
        },
      );
      return actions;
    }

    if (this.currentPlayer !== viewerState.info.agentId) return actions;

    if (this.pendingDraw > 0) {
      actions.unshift({
        type: 'draw',
        label: `Draw ${this.pendingDraw}`,
        description: 'Take the penalty cards and end this turn',
        style: 'primary',
        params: {},
      });
      return actions;
    }

    const playable = viewerState.hand
      .map((card, index) => ({ card, index }))
      .filter(({ card }) => this.isPlayable(card, viewerState));

    if (playable.length > 0) {
      actions.unshift({
        type: 'play_card',
        label: 'Play card',
        description: 'Choose a legal card from your hand to play',
        style: 'primary',
        helperText: `Playable cards: ${playable.map(({ card, index }) => `${index}:${cardLabel(card)}`).join(' / ')}`,
        params: {
          cardIndex: {
            type: 'number',
            description: 'Hand index',
            required: true,
            min: 0,
            max: Math.max(0, viewerState.hand.length - 1),
            step: 1,
          },
          chosenColor: {
            type: 'string',
            description: 'Chosen color for Wild or Wild Draw Four',
            required: false,
            placeholder: 'red | yellow | green | blue',
          },
          declareUno: {
            type: 'boolean',
            description: 'Whether to call UNO when this play leaves you with 1 card',
            required: false,
            defaultValue: false,
          },
        },
      });
    }

    if (!this.drawnCardIdThisTurn && playable.length === 0) {
      actions.push({
        type: 'draw',
        label: 'Draw card',
        description: 'Draw 1 card when you do not have a legal play',
        params: {},
      });
    }

    if (this.drawnCardIdThisTurn) {
      actions.push({
        type: 'pass',
        label: 'Pass',
        description: 'Decline to play the just-drawn card and end the turn',
        params: {},
      });
    }

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
      message: `${state.info.agentName} is ready for UNO`,
      detail: `${this.readyPlayers().length} / ${this.players.size} players are ready`,
    });
    if (this.players.size >= MIN_PLAYERS && this.readyPlayers().length === this.players.size) {
      this.startMatch();
    }
    return this.okFromEvent(event);
  }

  private handlePlayCard(state: PlayerState, action: ArcadeGameAction): ArcadeGameResult {
    if (this.phase !== 'playing') return { ok: false, error: 'You are not currently in an UNO round' };
    if (this.currentPlayer !== state.info.agentId) return { ok: false, error: 'It is not your turn yet' };
    if (this.pendingDraw > 0) return { ok: false, error: 'You must resolve the penalty draw first' };
    if (this.pendingWildDrawFour) return { ok: false, error: 'A Wild Draw Four challenge or penalty must be resolved first' };

    const cardIndex = normalizeIndex(action.cardIndex);
    if (cardIndex === null || cardIndex < 0 || cardIndex >= state.hand.length) {
      return { ok: false, error: 'Choose a valid hand index' };
    }
    const card = state.hand[cardIndex];
    if (!card) return { ok: false, error: 'That card does not exist in your hand' };
    if (!this.isPlayable(card, state)) return { ok: false, error: 'That card cannot be played right now' };

    const declareUno = normalizeBoolean(action.declareUno);
    const chosenColor = normalizeColor(action.chosenColor);
    if ((card.type === 'wild' || card.type === 'wild-draw-four') && !chosenColor) {
      return { ok: false, error: 'Wild cards require a chosen color' };
    }

    const sourceHadColorMatch = card.type === 'wild-draw-four' ? this.hasColorMatch(state, this.activeColor()) : false;

    state.hand.splice(cardIndex, 1);
    this.discardPile.push(card);
    this.chosenColor = card.type === 'wild' || card.type === 'wild-draw-four' ? chosenColor : card.color;
    this.drawnCardIdThisTurn = null;
    state.unoDeclared = false;

    if (state.hand.length === 1) {
      if (declareUno) {
        state.unoDeclared = true;
      } else {
        this.pendingUnoAgentId = state.info.agentId;
      }
    } else {
      this.pendingUnoAgentId = null;
    }

    const event = this.recordEvent({
      kind: 'play_card',
      actorId: state.info.agentId,
      actorName: state.info.agentName,
      message: `${state.info.agentName} played ${cardLabel(card)}`,
      detail: chosenColor ? `Chosen color: ${colorLabel(chosenColor)}` : undefined,
    });

    this.applyCardEffect(state, card, sourceHadColorMatch);
    void this.maybeFinishRound(`${state.info.agentName} went out`);
    return this.okFromEvent(event);
  }

  private handleDraw(state: PlayerState): ArcadeGameResult {
    if (this.phase !== 'playing') return { ok: false, error: 'You are not currently in an UNO round' };
    if (this.currentPlayer !== state.info.agentId) return { ok: false, error: 'It is not your turn yet' };

    if (this.pendingWildDrawFour?.targetAgentId === state.info.agentId) {
      const amount = this.pendingWildDrawFour.sourceHadColorMatch ? 4 : 4;
      this.drawCards(state, amount);
      this.pendingWildDrawFour = null;
      this.pendingDraw = 0;
      const event = this.recordEvent({
        kind: 'wild_draw_four_resolved',
        actorId: state.info.agentId,
        actorName: state.info.agentName,
        message: `${state.info.agentName} accepted Wild Draw Four and drew 4 cards`,
      });
      this.advanceTurn(state.info.agentId, true);
      return this.okFromEvent(event);
    }

    if (this.pendingDraw > 0) {
      const amount = this.pendingDraw;
      this.drawCards(state, amount);
      this.pendingDraw = 0;
      const event = this.recordEvent({
        kind: 'draw_penalty',
        actorId: state.info.agentId,
        actorName: state.info.agentName,
        message: `${state.info.agentName} drew ${amount} penalty cards`,
      });
      this.advanceTurn(state.info.agentId, true);
      return this.okFromEvent(event);
    }

    if (this.drawnCardIdThisTurn) {
      return { ok: false, error: 'You already drew this turn, decide whether to play or pass' };
    }

    const drawn = this.drawCards(state, 1)[0];
    this.drawnCardIdThisTurn = drawn?.id ?? null;
    const event = this.recordEvent({
      kind: 'draw_card',
      actorId: state.info.agentId,
      actorName: state.info.agentName,
      message: `${state.info.agentName} drew 1 card`,
      detail: drawn ? `Drew ${cardLabel(drawn)}` : undefined,
    });
    return this.okFromEvent(event);
  }

  private handlePass(state: PlayerState): ArcadeGameResult {
    if (this.phase !== 'playing') return { ok: false, error: 'You are not currently in an UNO round' };
    if (this.currentPlayer !== state.info.agentId) return { ok: false, error: 'It is not your turn yet' };
    if (!this.drawnCardIdThisTurn) return { ok: false, error: 'You can only pass after drawing a card' };

    this.drawnCardIdThisTurn = null;
    const event = this.recordEvent({
      kind: 'pass',
      actorId: state.info.agentId,
      actorName: state.info.agentName,
      message: `${state.info.agentName} passed`,
    });
    this.advanceTurn(state.info.agentId, false);
    return this.okFromEvent(event);
  }

  private handleCallUno(state: PlayerState, action: ArcadeGameAction): ArcadeGameResult {
    if (!this.pendingUnoAgentId) return { ok: false, error: 'There is no pending UNO call to resolve' };
    const targetAgentId = normalizeString(action.targetAgentId) ?? this.pendingUnoAgentId;
    if (targetAgentId !== this.pendingUnoAgentId) {
      return { ok: false, error: 'You can only resolve the current UNO target' };
    }

    const target = this.players.get(targetAgentId);
    if (!target || target.hand.length !== 1) {
      this.pendingUnoAgentId = null;
      return { ok: false, error: 'The target is no longer in UNO danger' };
    }

    if (state.info.agentId === targetAgentId) {
      target.unoDeclared = true;
      this.pendingUnoAgentId = null;
      const event = this.recordEvent({
        kind: 'uno_declared',
        actorId: target.info.agentId,
        actorName: target.info.agentName,
        message: `${target.info.agentName} called UNO in time`,
      });
      return this.okFromEvent(event);
    }

    this.drawCards(target, 2);
    target.unoDeclared = false;
    this.pendingUnoAgentId = null;
    const event = this.recordEvent({
      kind: 'uno_caught',
      actorId: state.info.agentId,
      actorName: state.info.agentName,
      message: `${state.info.agentName} caught ${target.info.agentName} failing to call UNO`,
      detail: `${target.info.agentName} draws 2 penalty cards`,
    });
    return this.okFromEvent(event);
  }

  private handleChallengeWildDrawFour(state: PlayerState): ArcadeGameResult {
    if (this.pendingWildDrawFour?.targetAgentId !== state.info.agentId) {
      return { ok: false, error: 'There is no Wild Draw Four to challenge right now' };
    }
    const source = this.players.get(this.pendingWildDrawFour.sourceAgentId);
    if (!source) return { ok: false, error: 'The Wild Draw Four source player is no longer valid' };

    if (this.pendingWildDrawFour.sourceHadColorMatch) {
      this.drawCards(source, 4);
      this.pendingWildDrawFour = null;
      this.pendingDraw = 0;
      const event = this.recordEvent({
        kind: 'wild_draw_four_challenged',
        actorId: state.info.agentId,
        actorName: state.info.agentName,
        message: `${state.info.agentName} won the challenge`,
        detail: `${source.info.agentName} illegally played Wild Draw Four and must draw 4 instead`,
      });
      return this.okFromEvent(event);
    }

    this.drawCards(state, 6);
    this.pendingWildDrawFour = null;
    this.pendingDraw = 0;
    const event = this.recordEvent({
      kind: 'wild_draw_four_challenged',
      actorId: state.info.agentId,
      actorName: state.info.agentName,
      message: `${state.info.agentName} lost the challenge`,
      detail: `${state.info.agentName} must draw 6 cards and lose the turn`,
    });
    this.advanceTurn(state.info.agentId, true);
    return this.okFromEvent(event);
  }

  private startMatch(): void {
    for (const state of this.players.values()) {
      state.matchScore = 0;
    }
    this.roundNumber = 0;
    this.recap = null;
    this.phase = 'between_round';
    this.startNextRound();
  }

  private startNextRound(): void {
    const participants = this.seatOrder
      .map((agentId) => this.players.get(agentId))
      .filter((state): state is PlayerState => Boolean(state));
    if (participants.length < MIN_PLAYERS) return;

    this.phase = 'playing';
    this.roundNumber += 1;
    this.drawPile = buildDeck();
    this.discardPile = [];
    this.direction = 1;
    this.chosenColor = null;
    this.pendingDraw = 0;
    this.pendingWildDrawFour = null;
    this.drawnCardIdThisTurn = null;
    this.pendingUnoAgentId = null;
    this.lastRoundScore = 0;
    this.recap = null;

    for (const state of participants) {
      state.ready = false;
      state.status = 'playing';
      state.hand = [];
      state.unoDeclared = false;
    }

    for (let draw = 0; draw < 7; draw += 1) {
      for (const state of participants) {
        state.hand.push(this.drawCard());
      }
    }

    let starter = this.drawCard();
    while (starter.type !== 'number') {
      this.drawPile.push(starter);
      starter = this.drawCard();
    }
    this.discardPile.push(starter);
    this.chosenColor = starter.color;
    this.currentPlayer = participants[0]?.info.agentId ?? null;

    this.recordEvent({
      kind: 'round_started',
      message: `UNO round ${this.roundNumber} started`,
      detail: `Starting card: ${cardLabel(starter)}. ${participants[0]?.info.agentName ?? 'First player'} goes first`,
    });
  }

  private async maybeFinishRound(reason: string): Promise<void> {
    const winner = this.seatOrder
      .map((agentId) => this.players.get(agentId))
      .filter((state): state is PlayerState => Boolean(state))
      .find((state) => state.hand.length === 0);
    if (!winner) return;

    if (this.pendingDraw > 0 && this.currentPlayer && this.currentPlayer !== winner.info.agentId) {
      const target = this.players.get(this.currentPlayer);
      if (target) {
        this.drawCards(target, this.pendingDraw);
      }
      this.pendingDraw = 0;
      this.pendingWildDrawFour = null;
    }

    const roundScore = this.seatOrder
      .map((agentId) => this.players.get(agentId))
      .filter((state): state is PlayerState => Boolean(state))
      .reduce((sum, state) => sum + state.hand.reduce((cards, card) => cards + cardScore(card), 0), 0);

    winner.matchScore += roundScore;
    this.lastRoundScore = roundScore;
    this.phase = 'between_round';
    this.currentPlayer = null;
    this.pendingUnoAgentId = null;
    this.drawnCardIdThisTurn = null;
    this.pendingWildDrawFour = null;
    this.pendingDraw = 0;

    const items: ArcadeSessionResultItem[] = this.seatOrder
      .map((agentId) => this.players.get(agentId))
      .filter((state): state is PlayerState => Boolean(state))
      .map((state) => ({
        agentId: state.info.agentId,
        agentName: state.info.agentName,
        outcome: state.info.agentId === winner.info.agentId ? 'Won the round' : 'Did not win',
        summary: state.info.agentId === winner.info.agentId
          ? `Scored ${roundScore} points this round, total ${state.matchScore}`
          : `${state.hand.length} cards left in hand, total ${state.matchScore}`,
        hand: state.hand.map(cardLabel),
        label: `${state.matchScore} pts`,
      }));
    this.recap = {
      title: `Round ${this.roundNumber} recap`,
      summary: `${winner.info.agentName} went out first`,
      detail: `${reason}. Scored ${roundScore} points this round`,
      items,
    };

    this.recordEvent({
      kind: 'round_finished',
      message: this.recap.summary,
      detail: this.recap.detail,
    });

    const matchWinners = this.seatOrder.filter((agentId) => (this.players.get(agentId)?.matchScore ?? 0) >= MATCH_TARGET_SCORE);
    if (matchWinners.length > 0) {
      await this.finishMatch(matchWinners);
      return;
    }

    this.startNextRound();
  }

  private async finishMatch(matchWinnerIds: string[]): Promise<void> {
    this.phase = 'between_matches';
    const topScore = Math.max(...matchWinnerIds.map((agentId) => this.players.get(agentId)?.matchScore ?? 0));
    const topWinners = matchWinnerIds.filter((agentId) => (this.players.get(agentId)?.matchScore ?? 0) === topScore);
    const items: ArcadeSessionResultItem[] = [];

    for (const state of this.players.values()) {
      const isWinner = topWinners.includes(state.info.agentId);
      const outcome = topWinners.length === 1
        ? (isWinner ? 'Won' : 'Lost')
        : (isWinner ? 'Draw' : 'Lost');
      items.push({
        agentId: state.info.agentId,
        agentName: state.info.agentName,
        outcome,
        summary: `Final score: ${state.matchScore}`,
        label: `${state.matchScore} pts`,
      });
      await this.ctx.stats.recordResult(
        state.info.agentId,
        'uno',
        topWinners.length > 1 && isWinner ? 'draw' : isWinner ? 'win' : 'loss',
        0,
        0,
      );
      state.ready = false;
      state.status = 'joined';
      state.hand = [];
      state.unoDeclared = false;
    }

    this.recap = {
      title: 'UNO match finished',
      summary: topWinners.length === 1
        ? `${this.players.get(topWinners[0])?.info.agentName ?? 'Player'} reached ${MATCH_TARGET_SCORE} first`
        : 'Multiple players tied for the top score',
      detail: `Top score: ${topScore}`,
      items,
    };

    this.recordEvent({
      kind: 'game_over',
      message: this.recap.summary,
      detail: this.recap.detail,
    });
  }

  private isPlayable(card: UnoCard, player: PlayerState): boolean {
    if (card.type === 'wild' || card.type === 'wild-draw-four') {
      if (card.type === 'wild-draw-four' && this.pendingDraw > 0) return false;
      return true;
    }

    const top = this.topCard();
    if (!top) return true;
    const activeColor = this.activeColor();
    if (card.color === activeColor) return true;
    if (card.type === top.type && card.type !== 'number') return true;
    if (card.type === 'number' && top.type === 'number' && card.value === top.value) return true;
    if (this.drawnCardIdThisTurn && card.id !== this.drawnCardIdThisTurn) return false;
    return false;
  }

  private activeColor(): UnoColor {
    if (this.chosenColor) return this.chosenColor;
    return (this.topCard()?.color ?? 'red') as UnoColor;
  }

  private applyCardEffect(player: PlayerState, card: UnoCard, sourceHadColorMatch: boolean): void {
    const playerCount = this.seatOrder.length;
    switch (card.type) {
      case 'number':
        this.advanceTurn(player.info.agentId, false);
        break;
      case 'skip':
        this.advanceTurn(player.info.agentId, true);
        break;
      case 'reverse':
        if (playerCount === 2) {
          this.advanceTurn(player.info.agentId, true);
        } else {
          this.direction = this.direction === 1 ? -1 : 1;
          this.advanceTurn(player.info.agentId, false);
        }
        break;
      case 'draw-two': {
        const target = this.nextPlayer(player.info.agentId);
        this.currentPlayer = target?.info.agentId ?? null;
        this.pendingDraw = 2;
        break;
      }
      case 'wild':
        this.advanceTurn(player.info.agentId, false);
        break;
      case 'wild-draw-four': {
        const target = this.nextPlayer(player.info.agentId);
        if (target) {
          this.currentPlayer = target.info.agentId;
          this.pendingDraw = 4;
          this.pendingWildDrawFour = {
            sourceAgentId: player.info.agentId,
            targetAgentId: target.info.agentId,
            sourceHadColorMatch,
          };
        }
        break;
      }
      default:
        break;
    }
  }

  private drawCards(player: PlayerState, count: number): UnoCard[] {
    const cards: UnoCard[] = [];
    for (let index = 0; index < count; index += 1) {
      if (this.drawPile.length === 0) this.refillDrawPile();
      const card = this.drawPile.shift();
      if (!card) break;
      player.hand.push(card);
      cards.push(card);
    }
    return cards;
  }

  private drawCard(): UnoCard {
    if (this.drawPile.length === 0) this.refillDrawPile();
    const card = this.drawPile.shift();
    if (!card) throw new Error('UNO deck is empty');
    return card;
  }

  private refillDrawPile(): void {
    const top = this.discardPile.pop();
    const replenished = shuffle(this.discardPile);
    this.drawPile.push(...replenished);
    this.discardPile = top ? [top] : [];
  }

  private nextPlayer(agentId: string): PlayerState | null {
    const currentIndex = this.seatOrder.indexOf(agentId);
    if (currentIndex === -1 || this.seatOrder.length === 0) return null;
    const nextIndex = (currentIndex + this.direction + this.seatOrder.length) % this.seatOrder.length;
    return this.players.get(this.seatOrder[nextIndex]) ?? null;
  }

  private advanceTurn(agentId: string, skipNext: boolean): void {
    const first = this.nextPlayer(agentId);
    if (!first) {
      this.currentPlayer = null;
      return;
    }
    const next = skipNext ? this.nextPlayer(first.info.agentId) : first;
    this.currentPlayer = next?.info.agentId ?? null;
    this.drawnCardIdThisTurn = null;
  }

  private topCard(): UnoCard | null {
    return this.discardPile[this.discardPile.length - 1] ?? null;
  }

  private hasColorMatch(player: PlayerState, color: UnoColor): boolean {
    return player.hand.some((card) => card.color === color);
  }

  private buildPrompt(viewerState: PlayerState | null): string {
    if (!viewerState) {
      return this.phase === 'playing' ? 'Spectating. Waiting for the current UNO turn to advance.' : 'Waiting for players to ready up and start UNO';
    }
    if (this.phase !== 'playing') {
      if (this.recap) {
        if (!viewerState.ready) return `${this.recap.summary}. Ready up to start the next UNO match`;
        return `${this.recap.summary}. Waiting for other players to ready up`;
      }
      if (viewerState.ready) return 'You are ready. Waiting for all seated players to confirm.';
      return this.players.size < MIN_PLAYERS ? 'At least 2 players must be seated and ready.' : 'Ready up. The round starts automatically when all seated players confirm.';
    }

    if (this.pendingWildDrawFour?.targetAgentId === viewerState.info.agentId) {
      return `An opponent played Wild Draw Four. Active color: ${colorLabel(this.activeColor())}. You may challenge or draw 4.`;
    }

    if (this.pendingDraw > 0 && this.currentPlayer === viewerState.info.agentId) {
      return `You must draw ${this.pendingDraw} penalty cards first.`;
    }

    if (this.pendingUnoAgentId === viewerState.info.agentId) {
      return 'You have 1 card left. Call UNO immediately.';
    }

    if (this.currentPlayer === viewerState.info.agentId) {
      return `It is your turn. Active color: ${colorLabel(this.activeColor())}. Top card: ${this.topCard() ? cardLabel(this.topCard() as UnoCard) : '--'}`;
    }

    return `Waiting for ${this.players.get(this.currentPlayer ?? '')?.info.agentName ?? 'another player'} to act`;
  }

  private viewerNeedsAction(viewerState: PlayerState | null): boolean {
    if (!viewerState) return false;
    if (this.phase !== 'playing') return !viewerState.ready;
    if (this.pendingUnoAgentId && (this.pendingUnoAgentId === viewerState.info.agentId || viewerState.info.agentId !== this.pendingUnoAgentId)) {
      return true;
    }
    if (this.pendingWildDrawFour?.targetAgentId === viewerState.info.agentId) return true;
    return this.currentPlayer === viewerState.info.agentId;
  }

  private readyPlayers(): PlayerState[] {
    return Array.from(this.players.values()).filter((state) => state.ready);
  }

  private removePlayerFromRound(agentId: string): void {
    const state = this.players.get(agentId);
    if (!state) return;
    if (state.hand.length === 0) return;
    this.discardPile.push(...state.hand);
    state.hand = [];
    if (this.currentPlayer === agentId) {
      this.currentPlayer = this.nextPlayer(agentId)?.info.agentId ?? null;
    }
    if (this.pendingWildDrawFour?.targetAgentId === agentId || this.pendingWildDrawFour?.sourceAgentId === agentId) {
      this.pendingWildDrawFour = null;
      this.pendingDraw = 0;
    }
    if (this.pendingUnoAgentId === agentId) {
      this.pendingUnoAgentId = null;
    }
  }

  private removePlayer(agentId: string): void {
    this.players.delete(agentId);
    const seatIndex = this.seatOrder.indexOf(agentId);
    if (seatIndex >= 0) this.seatOrder.splice(seatIndex, 1);
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
      id: `uno-${this.ctx.table.tableId}-${++this.eventCounter}`,
      createdAt: this.ctx.clock.now(),
      severity: input.kind === 'game_over' || input.kind === 'round_finished' ? 'success' : input.kind.includes('challenge') ? 'warning' : 'info',
    };
    this.ctx.events.emit(event);
    return event;
  }
}

export class UnoGame implements ArcadeGameDefinition {
  readonly id = 'uno';
  readonly version = '1.0.0';
  readonly apiVersion = ARCADE_GAME_API_VERSION;
  readonly catalog = {
    name: 'UNO',
    description: 'Classic 108-card UNO with cumulative scoring to 500. Supports WDF challenges, UNO calls, and spectators.',
    minPlayers: MIN_PLAYERS,
    maxPlayers: MAX_PLAYERS,
    tags: ['card', 'casual', 'multi-round', 'party'],
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
    return new UnoSession(ctx);
  }
}

export default UnoGame;
