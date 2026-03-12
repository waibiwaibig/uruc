import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import {
  ArrowLeft,
  Crown,
  DoorOpen,
  Gamepad2,
  Landmark,
  RefreshCw,
  ShieldCheck,
  UserRoundX,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArcadeStatusToasts } from '../components/ArcadeStatusToasts';
import i18n, { formatTime as formatLocaleTime } from '../i18n';
import type {
  ArcadeGameActionSchema,
  ArcadeSessionPlayerState,
  ArcadeSessionState,
} from '../lib/types';
import {
  arcadeTableHref,
  byActionOrder,
  cardFaceClass,
  formatActionLabel,
  formatPlayerStatus,
  playerOccupancy,
  useArcadeClient,
} from '../lib/arcade';

type ArcadeTableHook = ReturnType<typeof useArcadeClient>;

type BoardSelection = { x: number; y: number } | null;

const UNO_CARD_TONES: Record<string, string> = {
  red: 'arcade-uno-card--red',
  yellow: 'arcade-uno-card--yellow',
  green: 'arcade-uno-card--green',
  blue: 'arcade-uno-card--blue',
};

const XIANGQI_PIECES: Record<string, string> = {
  'red-rook': '车',
  'red-horse': '马',
  'red-elephant': '相',
  'red-advisor': '仕',
  'red-general': '帅',
  'red-cannon': '炮',
  'red-soldier': '兵',
  'black-rook': '车',
  'black-horse': '马',
  'black-elephant': '象',
  'black-advisor': '士',
  'black-general': '将',
  'black-cannon': '炮',
  'black-soldier': '卒',
};

function runtimeStatusLabel(status: string): string {
  switch (status) {
    case 'connecting':
      return i18n.t('runtime:wsStatus.connecting');
    case 'authenticating':
      return i18n.t('runtime:wsStatus.authenticating');
    case 'syncing':
      return i18n.t('runtime:wsStatus.syncing');
    case 'reconnecting':
      return i18n.t('runtime:wsStatus.reconnecting');
    case 'connected':
      return i18n.t('runtime:wsStatus.connected');
    case 'error':
      return i18n.t('runtime:wsStatus.error');
    case 'closed':
      return i18n.t('runtime:wsStatus.closed');
    default:
      return i18n.t('runtime:wsStatus.idle');
  }
}

function formatTime(value: number | undefined): string {
  if (!value) return '--:--:--';
  return formatLocaleTime(value);
}

function defaultActionValue(action: ArcadeGameActionSchema, paramKey: string): string {
  const schema = action.params[paramKey];
  if (!schema) return '';
  if (schema.defaultValue !== undefined) return String(schema.defaultValue);
  if (schema.min !== undefined) return String(schema.min);
  return '';
}

function parseActionPayload(
  action: ArcadeGameActionSchema,
  values: Record<string, string>,
): { ok: true; payload: Record<string, unknown> } | { ok: false; error: string } {
  const payload: Record<string, unknown> = {};
  for (const [paramKey, schema] of Object.entries(action.params)) {
    const rawValue = values[paramKey] ?? '';
    if (schema.type === 'number') {
      const parsed = Number.parseFloat(rawValue);
      if (!Number.isFinite(parsed)) {
        return { ok: false, error: i18n.t('play:arcade.table.invalidNumber', { field: schema.description ?? paramKey }) };
      }
      if (schema.min !== undefined && parsed < schema.min) {
        return { ok: false, error: i18n.t('play:arcade.table.minNumber', { field: schema.description ?? paramKey, value: schema.min }) };
      }
      if (schema.max !== undefined && parsed > schema.max) {
        return { ok: false, error: i18n.t('play:arcade.table.maxNumber', { field: schema.description ?? paramKey, value: schema.max }) };
      }
      payload[paramKey] = parsed;
      continue;
    }
    if (schema.type === 'boolean') {
      payload[paramKey] = rawValue === 'true';
      continue;
    }
    if (schema.required && rawValue.trim() === '') {
      return { ok: false, error: i18n.t('play:arcade.table.requiredField', { field: schema.description ?? paramKey }) };
    }
    if (rawValue.trim() !== '') payload[paramKey] = rawValue.trim();
  }
  return { ok: true, payload };
}

function tableStatePlayers(state: ArcadeSessionState): ArcadeSessionPlayerState[] {
  return Array.isArray(state.players) ? state.players : [];
}

function roomOwnerLabel(hook: ArcadeTableHook): string {
  const currentTable = hook.currentTable;
  if (!currentTable?.table.createdBy) return i18n.t('play:arcade.ownership.unspecified');
  if (currentTable.table.createdBy === hook.currentAgentId) return i18n.t('play:arcade.ownership.you', { name: hook.selectedAgent?.name ?? currentTable.table.createdBy });
  return currentTable.table.playerNames[currentTable.table.createdBy] ?? currentTable.table.createdBy;
}

function canAutoPlayCard(action: ArcadeGameActionSchema | undefined): boolean {
  return action?.type === 'play_card';
}

function chooseWildColor(): string | null {
  const input = window.prompt(i18n.t('play:arcade.table.chooseWildColor'), 'red');
  if (!input) return null;
  const value = input.trim().toLowerCase();
  return ['red', 'yellow', 'green', 'blue'].includes(value) ? value : null;
}

function tableSeatPositions(count: number): Array<{ left: string; top: string }> {
  const presets: Record<number, Array<{ left: string; top: string }>> = {
    1: [{ left: '50%', top: '78%' }],
    2: [{ left: '32%', top: '76%' }, { left: '68%', top: '76%' }],
    3: [{ left: '20%', top: '68%' }, { left: '50%', top: '80%' }, { left: '80%', top: '68%' }],
    4: [{ left: '18%', top: '54%' }, { left: '38%', top: '82%' }, { left: '62%', top: '82%' }, { left: '82%', top: '54%' }],
    5: [{ left: '14%', top: '52%' }, { left: '30%', top: '82%' }, { left: '50%', top: '88%' }, { left: '70%', top: '82%' }, { left: '86%', top: '52%' }],
    6: [{ left: '12%', top: '48%' }, { left: '26%', top: '78%' }, { left: '42%', top: '88%' }, { left: '58%', top: '88%' }, { left: '74%', top: '78%' }, { left: '88%', top: '48%' }],
  };
  return presets[Math.max(1, Math.min(6, count))] ?? presets[6];
}

function renderPlayingCard(card: string, key: string) {
  const isHidden = card === '?';
  return (
    <span key={key} className={isHidden ? 'arcade-card arcade-card--hidden' : cardFaceClass(card)}>
      {card}
    </span>
  );
}

function SummaryStrip({ hook }: { hook: ArcadeTableHook }) {
  const currentTable = hook.currentTable;
  if (!currentTable) return null;

  const cards = [
    [i18n.t('play:arcade.table.summaryGame'), currentTable.table.gameName],
    [i18n.t('play:arcade.table.summaryPhase'), currentTable.state.phase ?? currentTable.table.status],
    [i18n.t('play:arcade.table.summaryHost'), roomOwnerLabel(hook)],
    [i18n.t('play:arcade.table.summaryPlayers'), playerOccupancy(currentTable.table)],
  ];

  return (
    <div className="arcade-compact-summary">
      {cards.map(([label, value]) => (
        <article key={label} className="arcade-compact-summary__card">
          <span>{label}</span>
          <strong>{value}</strong>
        </article>
      ))}
    </div>
  );
}

function GenericActionPanel({
  hook,
  actionValues,
  setActionValues,
}: {
  hook: ArcadeTableHook;
  actionValues: Record<string, Record<string, string>>;
  setActionValues: Dispatch<SetStateAction<Record<string, Record<string, string>>>>;
}) {
  const actions = useMemo(
    () => [...(hook.currentTable?.state.legalActions ?? [])].sort(byActionOrder),
    [hook.currentTable?.state.legalActions],
  );

  const submitAction = async (action: ArcadeGameActionSchema) => {
    const parsed = parseActionPayload(action, actionValues[action.type] ?? {});
    if (!parsed.ok) {
      hook.setErrorText(parsed.error);
      return;
    }
    await hook.runGameAction(action.type, parsed.payload);
  };

  if (!actions.length) {
    return (
      <section className="arcade-game-panel">
        <div className="arcade-game-panel__head">
          <span className="arcade-kicker">{i18n.t('play:arcade.table.actionsKicker')}</span>
          <h3>{i18n.t('play:arcade.table.noActions')}</h3>
        </div>
        <p className="arcade-game-panel__muted">{hook.currentTable?.state.prompt ?? i18n.t('play:arcade.table.waitingAdvance')}</p>
      </section>
    );
  }

  return (
    <section className="arcade-game-panel">
      <div className="arcade-game-panel__head">
        <span className="arcade-kicker">{i18n.t('play:arcade.table.actionsKicker')}</span>
        <h3>{i18n.t('play:arcade.table.availableActions')}</h3>
        <p>{hook.currentTable?.state.prompt}</p>
      </div>

      <div className="arcade-game-panel__body arcade-action-stack scroll-pane list-pane-lg">
        {actions.map((action) => (
          <article key={action.type} className="arcade-action-card">
            <div className="arcade-action-card__copy">
              <strong>{action.label ?? formatActionLabel(action.type)}</strong>
              <p>{action.description}</p>
              {action.helperText ? <span>{action.helperText}</span> : null}
            </div>
            {Object.keys(action.params).length ? (
              <div className="arcade-action-card__form">
                {Object.entries(action.params).map(([paramKey, schema]) => (
                  <label key={paramKey} className="arcade-action-card__field">
                    <span>{schema.description ?? paramKey}</span>
                    <input
                      value={actionValues[action.type]?.[paramKey] ?? defaultActionValue(action, paramKey)}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setActionValues((prev) => ({
                          ...prev,
                          [action.type]: {
                            ...(prev[action.type] ?? {}),
                            [paramKey]: nextValue,
                          },
                        }));
                      }}
                      placeholder={schema.placeholder}
                      type={schema.type === 'number' ? 'number' : 'text'}
                    />
                  </label>
                ))}
              </div>
            ) : null}
            <button className="arcade-action-card__submit" disabled={!!hook.busyAction} onClick={() => void submitAction(action)}>
              {action.label ?? formatActionLabel(action.type)}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function FeedPanel({ hook }: { hook: ArcadeTableHook }) {
  return (
    <section className="arcade-game-panel">
      <div className="arcade-game-panel__head">
        <span className="arcade-kicker">{i18n.t('play:arcade.table.historyKicker')}</span>
        <h3>{i18n.t('play:arcade.table.feedTitle')}</h3>
      </div>
      <div className="arcade-game-panel__body arcade-feed-list scroll-pane list-pane-lg">
        {hook.feed.length ? hook.feed.map((event) => (
          <article key={event.id} className={`arcade-feed-card arcade-feed-card--${event.severity}`}>
            <div className="arcade-feed-card__meta">
              <strong>{event.actorName ?? i18n.t('play:arcade.table.systemActor')}</strong>
              <span>{formatTime(event.createdAt)}</span>
            </div>
            <div className="arcade-feed-card__copy">
              <p>{event.message}</p>
              {event.detail ? <span>{event.detail}</span> : null}
            </div>
          </article>
        )) : <p className="arcade-game-panel__muted">{i18n.t('play:arcade.table.noFeed')}</p>}
      </div>
    </section>
  );
}

function MembersPanel({ hook }: { hook: ArcadeTableHook }) {
  const currentTable = hook.currentTable;
  if (!currentTable) return null;
  const players = tableStatePlayers(currentTable.state);

  return (
    <section className="arcade-game-panel">
      <div className="arcade-game-panel__head">
        <span className="arcade-kicker">{i18n.t('play:arcade.table.playersKicker')}</span>
        <h3>{i18n.t('play:arcade.table.membersTitle')}</h3>
      </div>
      <div className="arcade-game-panel__body arcade-member-list scroll-pane list-pane-md">
        {players.map((player) => (
          <article key={player.agentId} className="arcade-member-card">
            <div className="arcade-member-card__copy">
              <strong>{player.agentName}</strong>
              <span>{formatPlayerStatus(player.status)}</span>
              {player.connected === false ? <em>{i18n.t('play:arcade.table.disconnectedHold')}</em> : null}
            </div>
            <div className="arcade-member-card__meta">
              {player.isHost ? <span>{i18n.t('play:arcade.table.hostBadge')}</span> : null}
              {typeof player.cardCount === 'number' ? <span>{i18n.t('play:arcade.table.cardsCount', { count: player.cardCount })}</span> : null}
              {typeof player.stack === 'number' ? <span>{i18n.t('play:arcade.table.pointsCount', { count: player.stack })}</span> : null}
            </div>
            {hook.isCurrentHost && player.agentId !== hook.currentAgentId && hook.currentPlace === 'table' ? (
              <button className="arcade-member-card__kick" disabled={!!hook.busyAction} onClick={() => void hook.kickPlayer(player.agentId)}>
                <UserRoundX size={14} /> {i18n.t('play:arcade.table.kick')}
              </button>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function BlackjackView({ hook }: { hook: ArcadeTableHook }) {
  const currentTable = hook.currentTable;
  const state = currentTable?.state;
  if (!state) return null;
  const players = tableStatePlayers(state);
  const positions = tableSeatPositions(players.length);
  const dealer = (state.dealer ?? {}) as Record<string, unknown>;
  const dealerCards = Array.isArray(dealer.hand)
    ? dealer.hand as string[]
    : [
        ...((dealer.showing ? [dealer.showing] : []) as string[]),
        ...Array.from({ length: Number(dealer.hiddenCount ?? 0) }).map(() => '?'),
      ];
  const activeAgentId = typeof state.currentTurn === 'string'
    ? state.currentTurn
    : typeof state.currentPlayer === 'string'
      ? state.currentPlayer
      : null;

  return (
    <section className="arcade-game-scene arcade-game-scene--cards">
      <SummaryStrip hook={hook} />
      <div className="arcade-table-scene">
        <div className="arcade-table-surface">
          <div className="arcade-table-surface__rim" />
          <div className="arcade-table-surface__lightband" />

          <div className="arcade-table-center-grid">
            <article className="arcade-center-card arcade-center-card--sun">
              <span className="arcade-kicker">{i18n.t('play:arcade.table.dealerKicker')}</span>
              <strong>{i18n.t('play:arcade.table.dealer')}</strong>
              <div className="arcade-card-strip arcade-card-strip--center">
                {dealerCards.map((card, index) => renderPlayingCard(card, `dealer-${index}`))}
              </div>
              <p>{typeof dealer.total === 'number' ? i18n.t('play:arcade.table.totalPoints', { count: dealer.total }) : i18n.t('play:arcade.table.hiddenDealer')}</p>
            </article>
            <article className="arcade-center-card arcade-center-card--mint">
              <span className="arcade-kicker">{i18n.t('play:arcade.table.potKicker')}</span>
              <strong>{String(state.pot ?? 0)}</strong>
              <p>{i18n.t('play:arcade.table.totalBetThisHand')}</p>
            </article>
            <article className="arcade-center-card arcade-center-card--cyan">
              <span className="arcade-kicker">{i18n.t('play:arcade.table.phaseKicker')}</span>
              <strong>{state.phase}</strong>
              <p>{state.prompt}</p>
            </article>
          </div>

          <div className="arcade-seat-ring arcade-seat-ring--combat">
            {players.map((player, index) => (
              <article
                key={player.agentId}
                className={`arcade-seat-card ${player.agentId === hook.currentAgentId ? 'is-self' : ''} ${player.agentId === activeAgentId ? 'is-turn' : ''}`}
                style={positions[index]}
              >
                <div className="arcade-seat-card__head">
                  <strong>{player.agentName}</strong>
                  {player.isHost ? <span>{i18n.t('play:arcade.table.hostBadge')}</span> : null}
                </div>
                <div className="arcade-seat-card__badges">
                  <span>{formatPlayerStatus(player.status)}</span>
                  {player.readyForNextHand ? <span>{i18n.t('play:arcade.table.readyBadge')}</span> : null}
                </div>
                <div className="arcade-card-strip arcade-card-strip--player">
                  {(player.hand ?? []).map((card, cardIndex) => renderPlayingCard(card, `${player.agentId}-${cardIndex}`))}
                </div>
                <div className="arcade-seat-card__foot">
                  <span>{typeof player.bet === 'number' ? i18n.t('play:arcade.table.betValue', { value: player.bet }) : i18n.t('play:arcade.table.betValue', { value: '--' })}</span>
                  <span>{typeof player.total === 'number' ? i18n.t('play:arcade.table.totalValue', { value: player.total }) : i18n.t('play:arcade.table.totalValue', { value: '--' })}</span>
                </div>
                <div className="arcade-seat-card__chips">
                  <span className="arcade-seat-card__chip" />
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function TexasHoldemView({ hook }: { hook: ArcadeTableHook }) {
  const currentTable = hook.currentTable;
  const state = currentTable?.state;
  if (!state) return null;
  const players = tableStatePlayers(state);
  const positions = tableSeatPositions(players.length);
  const community = Array.isArray(state.community) ? state.community as string[] : [];
  const activeAgentId = typeof state.currentPlayer === 'string'
    ? state.currentPlayer
    : typeof state.currentTurn === 'string'
      ? state.currentTurn
      : null;

  return (
    <section className="arcade-game-scene arcade-game-scene--cards">
      <SummaryStrip hook={hook} />
      <div className="arcade-table-scene">
        <div className="arcade-table-surface">
          <div className="arcade-table-surface__rim" />
          <div className="arcade-table-surface__lightband" />

          <div className="arcade-table-center-grid">
            <article className="arcade-center-card arcade-center-card--sun">
              <span className="arcade-kicker">{i18n.t('play:arcade.table.communityKicker')}</span>
              <strong>{i18n.t('play:arcade.table.communityCards')}</strong>
              <div className="arcade-card-strip arcade-card-strip--center">
                {community.length
                  ? community.map((card, index) => renderPlayingCard(card, `community-${index}`))
                  : <span className="arcade-card arcade-card--hidden">?</span>}
              </div>
              <p>{i18n.t('play:arcade.table.boardRounds')}</p>
            </article>
            <article className="arcade-center-card arcade-center-card--mint">
              <span className="arcade-kicker">{i18n.t('play:arcade.table.potKicker')}</span>
              <strong>{String(state.pot ?? 0)}</strong>
              <p>{i18n.t('play:arcade.table.callValue', { value: String(state.toCall ?? 0) })}</p>
            </article>
            <article className="arcade-center-card arcade-center-card--cyan">
              <span className="arcade-kicker">{i18n.t('play:arcade.table.phaseKicker')}</span>
              <strong>{state.phase}</strong>
              <p>{typeof state.minRaiseTo === 'number' ? i18n.t('play:arcade.table.minRaiseTo', { value: state.minRaiseTo }) : state.prompt}</p>
            </article>
          </div>

          <div className="arcade-seat-ring arcade-seat-ring--combat">
            {players.map((player, index) => (
              <article
                key={player.agentId}
                className={`arcade-seat-card ${player.agentId === hook.currentAgentId ? 'is-self' : ''} ${player.agentId === activeAgentId ? 'is-turn' : ''}`}
                style={positions[index]}
              >
                <div className="arcade-seat-card__head">
                  <strong>{player.agentName}</strong>
                  {player.isHost ? <span>{i18n.t('play:arcade.table.hostBadge')}</span> : null}
                </div>
                <div className="arcade-seat-card__badges">
                  <span>{formatPlayerStatus(player.status)}</span>
                  {player.folded ? <span>{i18n.t('play:arcade.table.folded')}</span> : null}
                  {player.allIn ? <span>{i18n.t('play:arcade.playerStatus.all_in')}</span> : null}
                </div>
                <div className="arcade-card-strip arcade-card-strip--player">
                  {(player.hand ?? []).length
                    ? (player.hand ?? []).map((card, cardIndex) => renderPlayingCard(card, `${player.agentId}-${cardIndex}`))
                    : Array.from({ length: player.cardCount ?? 0 }).map((_, cardIndex) => (
                      <span key={`${player.agentId}-hidden-${cardIndex}`} className="arcade-card arcade-card--hidden">?</span>
                    ))}
                </div>
                <div className="arcade-seat-card__foot">
                  <span>{typeof player.committed === 'number' ? i18n.t('play:arcade.table.committed', { value: player.committed }) : i18n.t('play:arcade.table.committed', { value: '--' })}</span>
                  <span>{typeof player.stack === 'number' ? i18n.t('play:arcade.table.stack', { value: player.stack }) : i18n.t('play:arcade.table.stack', { value: '--' })}</span>
                </div>
                <div className="arcade-seat-card__chips">
                  <span className="arcade-seat-card__chip" />
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function GomokuView({ hook }: { hook: ArcadeTableHook }) {
  const state = hook.currentTable?.state;
  if (!state) return null;
  const board = (state.board as Array<Array<'black' | 'white' | null>> | undefined) ?? [];
  const canPlace = state.legalActions.some((action) => action.type === 'place_stone');
  const winningLine = new Set(((state.winningLine as Array<{ x: number; y: number }> | undefined) ?? []).map((cell) => `${cell.x}:${cell.y}`));

  return (
    <section className="arcade-game-scene arcade-game-scene--board">
      <SummaryStrip hook={hook} />
      <div className="arcade-board-frame arcade-board-frame--gomoku">
        <div className="arcade-gomoku-board">
          {board.map((row, y) => row.map((cell, x) => (
            <button
              key={`${x}-${y}`}
              className={`arcade-gomoku-cell ${winningLine.has(`${x}:${y}`) ? 'is-winning' : ''}`}
              disabled={!canPlace || !!cell || !!hook.busyAction}
              onClick={() => void hook.runGameAction('place_stone', { x, y })}
            >
              {cell ? <span className={`arcade-gomoku-stone arcade-gomoku-stone--${cell}`} /> : null}
            </button>
          )))}
        </div>
      </div>
    </section>
  );
}

function XiangqiView({ hook }: { hook: ArcadeTableHook }) {
  const state = hook.currentTable?.state;
  const [selection, setSelection] = useState<BoardSelection>(null);
  const currentSeat = hook.currentSeat;
  if (!state) return null;
  const board = (state.board as Array<Array<{ color: 'red' | 'black'; kind: string } | null>> | undefined) ?? [];
  const canMove = state.legalActions.some((action) => action.type === 'move');

  const onCellClick = async (x: number, y: number) => {
    const cell = board[y]?.[x];
    if (!canMove) return;
    if (!selection) {
      if (cell && cell.color === currentSeat?.color) setSelection({ x, y });
      return;
    }
    if (cell && cell.color === currentSeat?.color) {
      setSelection({ x, y });
      return;
    }
    const ok = await hook.runGameAction('move', {
      fromX: selection.x,
      fromY: selection.y,
      toX: x,
      toY: y,
    });
    if (ok) setSelection(null);
  };

  return (
    <section className="arcade-game-scene arcade-game-scene--board">
      <SummaryStrip hook={hook} />
      <div className="arcade-board-frame arcade-board-frame--xiangqi">
        <div className="arcade-xiangqi-board">
          {board.map((row, y) => row.map((cell, x) => {
            const key = `${x}-${y}`;
            const selected = selection?.x === x && selection.y === y;
            const glyph = cell ? XIANGQI_PIECES[`${cell.color}-${cell.kind}`] ?? cell.kind : '';
            return (
              <button key={key} className={`arcade-xiangqi-cell ${selected ? 'is-selected' : ''}`} disabled={!!hook.busyAction} onClick={() => void onCellClick(x, y)}>
                {cell ? <span className={`arcade-xiangqi-piece arcade-xiangqi-piece--${cell.color}`}>{glyph}</span> : null}
              </button>
            );
          }))}
        </div>
      </div>
    </section>
  );
}

function LoveLetterView({ hook }: { hook: ArcadeTableHook }) {
  const state = hook.currentTable?.state;
  if (!state) return null;
  const players = tableStatePlayers(state);
  const currentSeat = hook.currentSeat;
  const playCardAction = state.legalActions.find((action) => action.type === 'play_card');

  const autoPlay = async (index: number) => {
    if (!canAutoPlayCard(playCardAction)) return;
    const result = await hook.runGameAction('play_card', { cardIndex: index });
    if (!result && currentSeat?.hand && currentSeat.hand[1]) {
      await hook.runGameAction('play_card', { cardIndex: 1 });
    }
  };

  return (
    <section className="arcade-game-scene arcade-game-scene--cards">
      <SummaryStrip hook={hook} />
      <div className="arcade-compact-summary">
        <article className="arcade-compact-summary__card"><span>{i18n.t('play:arcade.table.round')}</span><strong>{state.roundNumber ?? 1}</strong></article>
        <article className="arcade-compact-summary__card"><span>{i18n.t('play:arcade.table.targetTokens')}</span><strong>{state.tokensToWin ?? '--'}</strong></article>
        <article className="arcade-compact-summary__card"><span>{i18n.t('play:arcade.table.deckCount')}</span><strong>{state.deckCount ?? 0}</strong></article>
        <article className="arcade-compact-summary__card"><span>{i18n.t('play:arcade.table.currentPlayer')}</span><strong>{state.currentPlayer ? hook.currentTable?.table.playerNames[state.currentPlayer] ?? state.currentPlayer : '--'}</strong></article>
      </div>
      <div className="arcade-seat-grid">
        {players.map((player) => (
          <article key={player.agentId} className={`arcade-compact-card ${player.agentId === hook.currentAgentId ? 'is-self' : ''}`}>
            <div className="arcade-compact-card__head">
              <strong>{player.agentName}</strong>
              <span>{i18n.t('play:arcade.table.tokensCount', { count: player.stack ?? 0 })}</span>
            </div>
            <div className="arcade-compact-card__meta">
              <span>{formatPlayerStatus(player.status)}</span>
              {player.protected ? <span>{i18n.t('play:arcade.table.protected')}</span> : null}
              {player.eliminated ? <span>{i18n.t('play:arcade.table.eliminated')}</span> : null}
            </div>
            <div className="arcade-card-row">
              {(player.hand ?? []).length
                ? (player.hand ?? []).map((card, index) => (
                  <button key={`${player.agentId}-${index}`} className="arcade-card-chip arcade-card-chip--button" disabled={!canAutoPlayCard(playCardAction) || player.agentId !== hook.currentAgentId} onClick={() => void autoPlay(index)}>
                    {card}
                  </button>
                ))
                : <span className="arcade-card-chip arcade-card-chip--muted">{i18n.t('play:arcade.table.handCount', { count: player.cardCount ?? 0 })}</span>}
            </div>
            {(player.publicDiscards as string[] | undefined)?.length ? (
              <div className="arcade-discard-list">
                {(player.publicDiscards as string[]).map((card) => <span key={`${player.agentId}-${card}`} className="arcade-chip-inline">{card}</span>)}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function UnoView({ hook }: { hook: ArcadeTableHook }) {
  const state = hook.currentTable?.state;
  if (!state) return null;
  const players = tableStatePlayers(state);
  const playCardAction = state.legalActions.find((action) => action.type === 'play_card');

  const playCard = async (index: number, label: string) => {
    if (!playCardAction) return;
    const chosenColor = /Wild/.test(label) ? chooseWildColor() : undefined;
    if (/Wild/.test(label) && !chosenColor) {
      hook.setErrorText(i18n.t('play:arcade.table.wildColorRequired'));
      return;
    }
    const declareUno = (hook.currentSeat?.hand?.length ?? 0) === 2;
    await hook.runGameAction('play_card', {
      cardIndex: index,
      chosenColor,
      declareUno,
    });
  };

  return (
    <section className="arcade-game-scene arcade-game-scene--cards">
      <SummaryStrip hook={hook} />
      <div className="arcade-compact-summary arcade-compact-summary--uno">
        <article className="arcade-compact-summary__card"><span>{i18n.t('play:arcade.table.topCard')}</span><strong>{String(state.topCard ?? '--')}</strong></article>
        <article className="arcade-compact-summary__card"><span>{i18n.t('play:arcade.table.currentColor')}</span><strong>{state.chosenColor ? String(state.chosenColor) : '--'}</strong></article>
        <article className="arcade-compact-summary__card"><span>{i18n.t('play:arcade.table.drawPenalty')}</span><strong>{state.pendingDraw ?? 0}</strong></article>
        <article className="arcade-compact-summary__card"><span>{i18n.t('play:arcade.table.drawPile')}</span><strong>{state.drawPileCount ?? 0}</strong></article>
      </div>
      <div className="arcade-seat-grid">
        {players.map((player) => (
          <article key={player.agentId} className={`arcade-compact-card ${player.agentId === hook.currentAgentId ? 'is-self' : ''}`}>
            <div className="arcade-compact-card__head">
              <strong>{player.agentName}</strong>
              <span>{i18n.t('play:arcade.table.points', { count: player.stack ?? 0 })}</span>
            </div>
            <div className="arcade-compact-card__meta">
              <span>{formatPlayerStatus(player.status)}</span>
              {player.unoDeclared ? <span>{i18n.t('play:arcade.table.unoCalled')}</span> : null}
              <span>{i18n.t('play:arcade.table.cardCount', { count: player.cardCount ?? 0 })}</span>
            </div>
            <div className="arcade-card-row">
              {(player.hand ?? []).length
                ? (player.hand ?? []).map((card, index) => {
                  const tone = Object.entries(UNO_CARD_TONES).find(([key]) => card.toLowerCase().includes(key))?.[1] ?? '';
                  return (
                    <button
                      key={`${player.agentId}-${index}`}
                      className={`arcade-uno-card ${tone}`}
                      disabled={!playCardAction || player.agentId !== hook.currentAgentId}
                      onClick={() => void playCard(index, card)}
                    >
                      {card}
                    </button>
                  );
                })
                : <span className="arcade-card-chip arcade-card-chip--muted">{i18n.t('play:arcade.table.showHandCountOnly')}</span>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function GenericCompactView({ hook }: { hook: ArcadeTableHook }) {
  const state = hook.currentTable?.state;
  if (!state) return null;
  return (
    <section className="arcade-game-scene">
      <SummaryStrip hook={hook} />
      <div className="arcade-state-dump">
        <pre>{JSON.stringify(state, null, 2)}</pre>
      </div>
    </section>
  );
}

function GameScene({ hook }: { hook: ArcadeTableHook }) {
  const gameId = hook.currentTable?.table.gameId;
  switch (gameId) {
    case 'blackjack':
      return <BlackjackView hook={hook} />;
    case 'texas-holdem':
      return <TexasHoldemView hook={hook} />;
    case 'gomoku':
      return <GomokuView hook={hook} />;
    case 'xiangqi':
      return <XiangqiView hook={hook} />;
    case 'love-letter':
      return <LoveLetterView hook={hook} />;
    case 'uno':
      return <UnoView hook={hook} />;
    default:
      return <GenericCompactView hook={hook} />;
  }
}

export function ArcadeTablePage() {
  const { t } = useTranslation('play');
  const navigate = useNavigate();
  const params = useParams<{ tableId: string }>();
  const [actionValues, setActionValues] = useState<Record<string, Record<string, string>>>({});
  const hook = useArcadeClient(params.tableId ?? null);

  useEffect(() => {
    if (!hook.initialSyncDone) return;
    if (hook.currentTableId && hook.currentTableId !== params.tableId) {
      navigate(arcadeTableHref(hook.currentTableId), { replace: true });
      return;
    }
    if (hook.lobby && hook.currentPlace === 'lobby' && !hook.currentTableId) {
      navigate('/play/arcade', { replace: true });
    }
  }, [hook.currentPlace, hook.currentTableId, hook.initialSyncDone, hook.lobby, navigate, params.tableId]);

  useEffect(() => {
    const nextValues: Record<string, Record<string, string>> = {};
    for (const action of hook.currentTable?.state.legalActions ?? []) {
      nextValues[action.type] = {};
      for (const paramKey of Object.keys(action.params)) {
        nextValues[action.type][paramKey] = actionValues[action.type]?.[paramKey] ?? defaultActionValue(action, paramKey);
      }
    }
    setActionValues(nextValues);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hook.currentTable?.snapshotVersion]);

  const systemToasts = useMemo(() => [
    ...(hook.errorText ? [{
      id: `arcade-table-local-error:${hook.errorText}`,
      tone: 'error' as const,
      title: t('arcade.runtime.tableActionFailed'),
      body: hook.errorText,
      durationMs: 6000,
      onDismiss: () => hook.setErrorText(''),
    }] : []),
    ...(hook.runtime.error ? [{
      id: `arcade-table-runtime-error:${hook.runtime.error}`,
      tone: 'warning' as const,
      title: runtimeStatusLabel(hook.runtime.status),
      body: hook.runtime.error,
    }] : []),
  ], [hook.errorText, hook.runtime.error, hook.runtime.status, hook.setErrorText, t]);

  const leaveToArcadeLobby = async () => {
    const ok = await hook.leaveArcadeTable();
    if (!ok) return;
    navigate('/play/arcade');
  };

  const returnToCityMap = async () => {
    try {
      const ok = await hook.leaveArcadeTable();
      if (!ok) return;
      if (hook.runtime.currentLocation === 'arcade') {
        await hook.runtime.leaveLocation();
      }
      navigate('/play');
    } catch (error) {
      hook.setErrorText(error instanceof Error ? error.message : t('arcade.runtime.returnToCityFailed'));
    }
  };

  const closeTableAndExit = async () => {
    const ok = await hook.closeCurrentTable();
    if (!ok) return;
    navigate('/play/arcade');
  };

  if (!hook.selectedAgent) {
    return (
      <div className="page-wrap main-grid">
        <section className="card game-stage game-stage--empty">
          <div className="stack-md content-narrow">
            <p className="kicker">arcade table runtime</p>
            <h1 className="section-title">{t('arcade.runtime.noAgentTitle')}</h1>
            <p className="section-sub">{t('arcade.runtime.noAgentBody')}</p>
            <div className="utility-links">
              <Link className="app-btn" to="/lobby"><ArrowLeft size={14} /> {t('arcade.runtime.backToLobby')}</Link>
              <Link className="app-btn secondary" to="/play/arcade"><Gamepad2 size={14} /> {t('arcade.runtime.backToArcade')}</Link>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page-wrap arcade-table-page">
      <div className="arcade-table-page__backdrop" aria-hidden="true" />

      <header className="arcade-mergebar arcade-mergebar--table">
        <div className="arcade-mergebar__brand">
          <span className="brand-mark brand-mark--compact arcade-mergebar__mark" />
          <div className="arcade-mergebar__copy">
            <strong>{`URUC / ${hook.currentTable?.table.name ?? t('arcade.runtime.waitingTableTitle')}`}</strong>
            <span>{hook.currentTable ? `${hook.currentTable.table.gameName} · ${t('arcade.runtime.seatedSummary', { value: playerOccupancy(hook.currentTable.table) })}` : t('arcade.runtime.waitingTableState')}</span>
          </div>
        </div>

        <div className="arcade-mergebar__status">
          <span className="arcade-mergebar__pill"><Landmark size={12} /> {runtimeStatusLabel(hook.runtime.status)}</span>
          <span className="arcade-mergebar__pill"><ShieldCheck size={12} /> {hook.runtime.isController ? t('arcade.runtime.controlClaimed') : hook.runtime.hasController ? t('arcade.runtime.controlElsewhere') : t('arcade.runtime.controlIdle')}</span>
          <span className="arcade-mergebar__pill"><Crown size={12} /> {hook.selectedAgent.name}</span>
          <span className="arcade-mergebar__pill">{t('arcade.runtime.balance', { value: hook.lobby?.wallet?.balance ?? '--' })}</span>
          <span className="arcade-mergebar__pill">{t('arcade.runtime.phasePill', { value: hook.currentTable?.state.phase ?? hook.currentTable?.table.status ?? '--' })}</span>
          <span className="arcade-mergebar__pill">{t('arcade.runtime.statusPill', { value: formatPlayerStatus(hook.currentSeat?.status) })}</span>
        </div>

        <div className="arcade-mergebar__actions">
          <button className="arcade-mergebar__btn" disabled={!!hook.busyAction} onClick={() => void leaveToArcadeLobby()}>
            <ArrowLeft size={16} /> {t('arcade.runtime.backToArcade')}
          </button>
          <button className="arcade-mergebar__btn arcade-mergebar__btn--accent" disabled={!!hook.busyAction} onClick={() => void hook.refreshArcade(hook.currentTableId)}>
            <RefreshCw size={16} /> {t('arcade.runtime.refreshTable')}
          </button>
        </div>
      </header>

      <ArcadeStatusToasts items={systemToasts} />

      <section className="arcade-compact-hero">
        <div>
          <span className="arcade-kicker">{t('arcade.runtime.tableSignal')}</span>
          <h1>{hook.currentTable?.state.prompt ?? hook.successText ?? t('arcade.runtime.waitingSignal')}</h1>
          <p>{hook.currentTable?.state.result?.summary ?? hook.successText ?? t('arcade.runtime.statePushHint')}</p>
        </div>
        <div className="arcade-compact-hero__meta">
          <span>seq {hook.currentTable?.seq ?? '--'}</span>
          <span>snapshot {hook.currentTable?.snapshotVersion ?? '--'}</span>
          <span>{hook.currentTable?.table.gameId ?? '--'}</span>
        </div>
      </section>

      <section className="arcade-compact-layout">
        <div className="arcade-compact-layout__main">
          {hook.currentTable ? <GameScene hook={hook} /> : (
            <div className="arcade-table-empty">
              <Gamepad2 size={64} />
              <h2>{t('arcade.runtime.runtimeWaitingTitle')}</h2>
              <p>{t('arcade.runtime.runtimeWaitingBody')}</p>
            </div>
          )}
        </div>

        <aside className="arcade-compact-layout__side">
          <GenericActionPanel hook={hook} actionValues={actionValues} setActionValues={setActionValues} />
          <MembersPanel hook={hook} />
          {hook.currentTable?.state.result ? (
            <section className="arcade-game-panel">
              <div className="arcade-game-panel__head">
                <span className="arcade-kicker">{t('arcade.table.resultKicker')}</span>
                <h3>{hook.currentTable.state.result.title}</h3>
                <p>{hook.currentTable.state.result.summary}</p>
              </div>
              <div className="arcade-game-panel__body arcade-member-list scroll-pane list-pane-md">
                {hook.currentTable.state.result.items.map((item) => (
                  <article key={`${item.agentId}-${item.outcome}`} className="arcade-member-card">
                    <div className="arcade-member-card__copy">
                      <strong>{item.agentName}</strong>
                      <span>{item.outcome}</span>
                      <em>{item.summary}</em>
                    </div>
                    <div className="arcade-member-card__meta">
                      {item.label ? <span>{item.label}</span> : null}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
          <FeedPanel hook={hook} />
          <section className="arcade-game-panel">
            <div className="arcade-action-stack">
              <button className="arcade-action-card__submit arcade-action-card__submit--ghost" disabled={!!hook.busyAction} onClick={() => void returnToCityMap()}>
                <DoorOpen size={14} /> {t('arcade.runtime.returnToCity')}
              </button>
              {hook.isCurrentHost ? (
                <button className="arcade-action-card__submit arcade-action-card__submit--danger" disabled={!!hook.busyAction} onClick={() => void closeTableAndExit()}>
                  {t('arcade.runtime.closeTable')}
                </button>
              ) : null}
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}
