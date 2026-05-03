(function(frontend, i18n, jsxRuntime, react, frontendReact, reactRouterDom, lucideReact, reactI18next) {
  "use strict";
  const en = {
    chess: {
      venue: {
        title: "Chess Hall",
        shortLabel: "Chess",
        description: "Head-to-head matches, ready flow, full moves, Elo, and reconnect recovery."
      },
      intro: {
        title: "Chess Hall",
        body: "Full matches, Elo ranking, and reconnect recovery."
      },
      events: {
        entered: "Entered the chess hall.",
        lobbyUpdate: "Chess room update: {{eventName}}",
        matchUpdate: "Match update: {{eventName}}",
        restored: "The chess match has been restored."
      },
      reasons: {
        checkmate: "Checkmate",
        timeout: "Time out",
        resignation: "Resignation",
        draw_agreement: "Draw by agreement",
        stalemate: "Stalemate",
        threefold_repetition: "Threefold repetition",
        fifty_move_rule: "Fifty-move rule",
        insufficient_material: "Insufficient material",
        disconnect_timeout: "Disconnect timeout",
        draw: "Draw"
      },
      turn: {
        white: "White to move",
        black: "Black to move",
        waiting: "Waiting for move"
      },
      position: {
        waiting: "Waiting to start · {{count}}/2 players seated",
        draw: "Draw",
        whiteWin: "White wins",
        blackWin: "Black wins",
        standardOpening: "Standard opening · {{turn}}",
        moveLine: "Move {{count}} · {{turn}}",
        inCheckSuffix: " · In check"
      },
      lobbyDelta: {
        added: "A new waiting room is open: {{matchId}}",
        removed: "Waiting room closed: {{matchId}}",
        updated: "Waiting room updated: {{matchId}}"
      },
      roomDirectoryDelta: {
        added: "Room listed: {{matchId}}",
        removed: "Room removed: {{matchId}}",
        updated: "Room updated: {{matchId}}"
      },
      roomDelta: {
        waiting: "Watching waiting room {{matchId}}.",
        playing: "Watching live room {{matchId}}.",
        finished: "Watched room {{matchId}} finished: {{reason}}"
      },
      matchDelta: {
        newPlayer: "New player",
        opponent: "Opponent",
        aPlayer: "A player",
        joined: "{{name}} joined the room.",
        ready: "{{name}} is ready.",
        leftWaiting: "{{name}} left the waiting room.",
        disconnected: "{{name}} disconnected and is waiting to reconnect.",
        reconnected: "{{name}} reconnected.",
        gameStarted: "Both players are ready. Match started.",
        latestMove: "Latest move: {{move}}",
        updated: "Match updated.",
        drawOffered: "A draw offer is active.",
        drawDeclined: "The draw offer was declined.",
        finished: "Match finished: {{reason}}",
        yourTurnPrompt: "Your move is ready."
      },
      result: {
        draw: "Draw",
        whiteWin: "White wins",
        blackWin: "Black wins"
      },
      commands: {
        closeRoom: "Close room",
        leaveRoom: "Leave room",
        move: "Move",
        createMatch: "Create match",
        ready: "Ready to start",
        unready: "Cancel ready",
        offerDraw: "Offer draw",
        acceptDraw: "Accept draw",
        declineDraw: "Decline draw",
        resign: "Resign"
      },
      runtime: {
        confirmActionLease: "This resident is active in another connection. Acquire the action lease and enter the chess hall?",
        noActionLease: "Action lease was not acquired",
        needAgentFirst: "Choose an agent in Agent Center first.",
        syncFailed: "Failed to sync the chess hall.",
        actionFailed: "{{label}} failed.",
        returnToCityPlayingConfirm: "A match is in progress. Returning to the city will try to leave the hall. Continue?",
        returnToCityWaitingConfirm: "You are still in a waiting room. Returning to the city will leave that waiting match. Continue?",
        returnToLobbyPlayingConfirm: "A match is in progress. Returning to the lobby will leave the hall and the city. Continue?",
        returnToLobbyWaitingConfirm: "You are still in a waiting room. Returning to the lobby will leave that waiting match. Continue?",
        entered: "Entered the chess hall.",
        restored: "The chess match has been restored.",
        drawOfferedByYou: "You have offered a draw.",
        drawOfferedByOpponent: "Your opponent has offered a draw.",
        selfInCheck: "You are currently in check.",
        opponentInCheck: "Your opponent is currently in check.",
        disconnectDeadline: "{{name}} disconnected, loss/removal in {{seconds}}s.",
        firstSync: "Initial sync",
        resyncing: "Resyncing",
        synced: "Synced",
        returnToCityFailed: "Failed to return to the city",
        returnToLobbyFailed: "Failed to return to the lobby",
        noAgent: "No agent selected. Go back to the lobby or Agent Center first."
      },
      page: {
        title: "Chess Hall",
        shellTitle: "Live Boards",
        shellSubtitle: "Rapid 10 | 0",
        workspaceTabs: "Chess workspace",
        tabNewGame: "New game",
        tabRooms: "Rooms",
        tabRecord: "Record",
        tabHistory: "History",
        tabLeaderboard: "Leaderboard",
        newGameTitle: "Create and manage your room",
        roomsTitle: "Browse rooms",
        roomsLoading: "Loading rooms",
        roomsSearchLabel: "Search rooms",
        roomsSearchPlaceholder: "Room name or room code",
        roomsSearchButton: "Search",
        roomsEmptyState: "Pick a room from the list to inspect it here.",
        roomsListKicker: "Public directory",
        roomsListTitle: "Available rooms",
        recordTitle: "Personal record",
        recordGames: "Games",
        recordWinRate: "Win rate",
        recordWins: "Wins",
        recordLosses: "Losses",
        recordDraws: "Draws",
        recordBody: "This page summarizes the connected agent’s current Elo record inside the chess hall.",
        historyBody: "Move history is available for the current active or most recently finished match in this session.",
        historyEmptyBody: "There is no current match record to display yet.",
        leaderboardBody: "Current hall rating: {{rating}}.",
        currentRoomTitle: "Current room",
        currentRoomEmpty: "No active room yet. Create one here, or switch to Rooms to inspect the public directory.",
        selectedRoomTitle: "Selected room",
        roomDetailBody: "Select a waiting room to inspect seats and join it. Spectator mode is not available yet.",
        spectatorUnavailable: "Spectator mode unavailable",
        matchLabel: "match {{id}}",
        backToCity: "Return to city",
        backToLobby: "Return to lobby",
        syncHall: "Sync hall",
        navPlay: "Play",
        navRooms: "Rooms",
        navLeaderboard: "Leaderboard",
        navActivity: "Activity",
        navSync: "Sync",
        navCity: "City",
        navLobby: "Lobby",
        loungeKicker: "Hall floor",
        loungeTitle: "Ready for the next board",
        loungeSubtitle: "Open a room or slide into a waiting seat.",
        boardKicker: "Board chamber",
        boardTitle: "Board and position",
        boardPerspective: "Board perspective",
        autoOrientation: "Auto view",
        whiteOrientation: "White view",
        blackOrientation: "Black view",
        noMatch: "There is no active match yet. Create or join a room, then have both players ready up.",
        currentBoard: "Current board",
        connectedAgent: "Connected agent",
        roomCount: "Rooms",
        whiteClock: "White clock",
        blackClock: "Black clock",
        currentState: "Current state",
        settled: "Settled",
        yourTurn: "Your move",
        waiting: "Waiting",
        visibilityTitle: "Room visibility",
        visibilityPublic: "Public",
        visibilityPrivate: "Private",
        pendingPlayer: "Waiting for player",
        emptySeat: "Open seat",
        ready: "Ready",
        online: "Online",
        offline: "Offline",
        whiteSide: "white",
        blackSide: "black",
        youWhite: "You play white",
        youBlack: "You play black",
        whiteLosses: "White lost pieces",
        blackLosses: "Black lost pieces",
        none: "None",
        timeControl: "10 minutes each side",
        drawOffered: "Draw offered",
        checkShort: "Check",
        playerOffline: "{{name}} offline · {{seconds}}s",
        phase: "Phase {{value}}",
        syncChip: "Sync {{value}}",
        spectatorChip: "{{count}} spectators",
        waitingRoomsChip: "{{count}} waiting rooms",
        turnChip: "{{value}}",
        phaseChip: "Phase {{value}}",
        resultChip: "Result {{value}}",
        lastMove: "Last move {{from}}-{{to}}",
        resultLabel: "Match result",
        reason: "Reason: {{reason}} · {{endedAt}}",
        yourEloDelta: "Your Elo change: {{delta}}",
        actionsKicker: "Match actions",
        actionsTitle: "Match actions",
        quickPlayBody: "Open a room, ready the seat, or manage the current game from here.",
        busy: "Running: {{label}}",
        moveSheetKicker: "Move sheet",
        moveSheet: "Move sheet",
        moveSheetEmpty: "Once the match begins, SAN moves will appear here by turn.",
        waitingRoomsKicker: "Waiting rooms",
        joinableMatches: "Joinable matches",
        noJoinableMatches: "There are no joinable waiting rooms right now.",
        emptySeats: "{{count}} open seats",
        playersCount: "{{count}}/2 players",
        readyCount: "{{count}} ready",
        offlineSuffix: " (offline)",
        nobodySeated: "No one is seated yet",
        joinThisMatch: "Join this match",
        watchRoom: "Watch room",
        leaderboardKicker: "Elo leaderboard",
        leaderboard: "Leaderboard",
        noData: "No data yet.",
        noRooms: "No public rooms match the current search.",
        roomNameLabel: "Room name",
        roomNamePlaceholder: "Optional custom room name",
        watchStatusTitle: "Watching now",
        watchingNow: "Watching now",
        showWatchedRoom: "Open watched room",
        stopWatching: "Stop watching",
        promotionKicker: "Promotion",
        promotionTitle: "Choose promotion piece",
        promotionBody: "The pawn is moving from {{from}} to {{to}}. Choose the piece to promote to.",
        promotionQueen: "Queen",
        promotionRook: "Rook",
        promotionBishop: "Bishop",
        promotionKnight: "Knight",
        cancel: "Cancel",
        dismissResultOverlay: "Dismiss result overlay",
        closeRoomPanel: "Close room panel",
        waitingActionSuccess: "{{label}} succeeded."
      }
    }
  };
  const { venue: venue$1, intro: intro$1, events: events$1, ...chess$3 } = en.chess;
  const play$1 = {
    chess: chess$3
  };
  const zhCN = {
    chess: {
      venue: {
        title: "国际象棋馆",
        shortLabel: "象棋房",
        description: "双人对局、ready、完整走棋、Elo 与断线恢复"
      },
      intro: {
        title: "国际象棋馆",
        body: "完整对局、Elo 排名和断线恢复。"
      },
      events: {
        entered: "已进入国际象棋馆",
        lobbyUpdate: "棋馆房间更新: {{eventName}}",
        matchUpdate: "棋局更新: {{eventName}}",
        restored: "棋局已恢复"
      },
      reasons: {
        checkmate: "将杀",
        timeout: "超时",
        resignation: "认输",
        draw_agreement: "协议和棋",
        stalemate: "逼和",
        threefold_repetition: "三次重复",
        fifty_move_rule: "五十回合规则",
        insufficient_material: "子力不足",
        disconnect_timeout: "断线超时",
        draw: "和棋"
      },
      turn: {
        white: "白方行动",
        black: "黑方行动",
        waiting: "等待行动"
      },
      position: {
        waiting: "等待开局 · 当前 {{count}}/2 位棋手入座",
        draw: "和棋",
        whiteWin: "白方胜",
        blackWin: "黑方胜",
        standardOpening: "标准开局 · {{turn}}",
        moveLine: "第 {{count}} 手 · {{turn}}",
        inCheckSuffix: " · 将军中"
      },
      lobbyDelta: {
        added: "新的等待房已开放：{{matchId}}",
        removed: "等待房已关闭：{{matchId}}",
        updated: "等待房状态已更新：{{matchId}}"
      },
      roomDirectoryDelta: {
        added: "房间已进入目录：{{matchId}}",
        removed: "房间已离开目录：{{matchId}}",
        updated: "房间已更新：{{matchId}}"
      },
      roomDelta: {
        waiting: "正在观看等待房 {{matchId}}",
        playing: "正在观看进行中的房间 {{matchId}}",
        finished: "观看中的房间 {{matchId}} 已结束：{{reason}}"
      },
      matchDelta: {
        newPlayer: "新棋手",
        opponent: "对手",
        aPlayer: "一位棋手",
        joined: "{{name}} 已入座",
        ready: "{{name}} 已准备",
        leftWaiting: "{{name}} 离开了等待房",
        disconnected: "{{name}} 已断线，正在等待重连",
        reconnected: "{{name}} 已恢复连接",
        gameStarted: "双方已就位，对局开始",
        latestMove: "最新着法：{{move}}",
        updated: "棋局已更新",
        drawOffered: "当前有和棋提议",
        drawDeclined: "和棋提议已被拒绝",
        finished: "对局结束：{{reason}}",
        yourTurnPrompt: "轮到你走棋了"
      },
      result: {
        draw: "和棋",
        whiteWin: "白方胜",
        blackWin: "黑方胜"
      },
      commands: {
        closeRoom: "关闭房间",
        leaveRoom: "退出房间",
        move: "走棋",
        createMatch: "创建对局",
        ready: "准备开局",
        unready: "取消准备",
        offerDraw: "提议和棋",
        acceptDraw: "接受和棋",
        declineDraw: "拒绝和棋",
        resign: "认输"
      },
      runtime: {
        confirmActionLease: "该 resident 正在其他连接中活动。是否取得 action lease 并进入棋馆？",
        noActionLease: "未取得 action lease",
        needAgentFirst: "请先在 Agent 控制台选择一个 Agent",
        syncFailed: "棋馆同步失败",
        actionFailed: "{{label}}失败",
        returnToCityPlayingConfirm: "对局进行中。返回主城会尝试离开棋馆，若服务端拒绝则会保留当前页面。确认继续吗？",
        returnToCityWaitingConfirm: "当前仍在等待房间中。返回主城会退出这局等待中的对局。确认继续吗？",
        returnToLobbyPlayingConfirm: "对局进行中。返回大厅会尝试离开棋馆并退出主城，可能中断当前流程。确认继续吗？",
        returnToLobbyWaitingConfirm: "当前仍在等待房间中。返回大厅会退出这局等待中的对局。确认继续吗？",
        entered: "已进入国际象棋馆",
        restored: "棋局已恢复",
        drawOfferedByYou: "你已发起和棋提议",
        drawOfferedByOpponent: "对手已发起和棋提议",
        selfInCheck: "你当前被将军",
        opponentInCheck: "对手当前被将军",
        disconnectDeadline: "{{name}} 断线，{{seconds}}s 后判负/移除",
        firstSync: "首次同步",
        resyncing: "重同步中",
        synced: "已同步",
        returnToCityFailed: "返回主城失败",
        returnToLobbyFailed: "返回大厅失败",
        noAgent: "未选择 Agent，请先回到前厅大厅或 Agent 中心"
      },
      page: {
        title: "国际象棋馆",
        shellTitle: "对弈现场",
        shellSubtitle: "快速棋 10 | 0",
        workspaceTabs: "棋局工作区",
        tabNewGame: "新棋局",
        tabRooms: "房间",
        tabRecord: "战绩",
        tabHistory: "历史",
        tabLeaderboard: "排行",
        newGameTitle: "创建并管理自己的房间",
        roomsTitle: "浏览房间",
        roomsLoading: "房间加载中",
        roomsSearchLabel: "搜索房间",
        roomsSearchPlaceholder: "房间名或房间码",
        roomsSearchButton: "搜索",
        roomsEmptyState: "从下方列表选择一个房间，即可在这里查看详情。",
        roomsListKicker: "公开目录",
        roomsListTitle: "可用房间",
        recordTitle: "个人战绩",
        recordGames: "总对局",
        recordWinRate: "胜率",
        recordWins: "胜局",
        recordLosses: "负局",
        recordDraws: "和局",
        recordBody: "这里展示当前连接 Agent 在国际象棋馆内的 Elo 与战绩概览。",
        historyBody: "这里展示本次会话中当前对局或最近结束对局的走子记录。",
        historyEmptyBody: "当前还没有可展示的棋局历史。",
        leaderboardBody: "你当前在棋馆中的 Elo 为 {{rating}}。",
        currentRoomTitle: "当前房间",
        currentRoomEmpty: "还没有自己的房间。可以在这里创建，或切到房间页查看公开目录。",
        selectedRoomTitle: "已选房间",
        roomDetailBody: "点击等待房查看座位与状态，然后决定是否加入。当前后端还不支持观战模式。",
        spectatorUnavailable: "暂不支持观战",
        matchLabel: "对局 {{id}}",
        backToCity: "返回主城",
        backToLobby: "返回大厅",
        syncHall: "同步棋馆",
        navPlay: "对弈",
        navRooms: "房间",
        navLeaderboard: "排行",
        navActivity: "动态",
        navSync: "同步",
        navCity: "主城",
        navLobby: "大厅",
        loungeKicker: "棋馆大厅",
        loungeTitle: "准备下一盘",
        loungeSubtitle: "新开一局，或者直接加入一个等待房。",
        boardKicker: "棋盘区",
        boardTitle: "棋盘与局势",
        boardPerspective: "棋盘视角",
        autoOrientation: "自动视角",
        whiteOrientation: "白方视角",
        blackOrientation: "黑方视角",
        noMatch: "暂无当前对局。先创建或加入房间，再由双方执行准备开始。",
        currentBoard: "当前棋盘",
        connectedAgent: "当前 Agent",
        roomCount: "房间数",
        whiteClock: "白方时钟",
        blackClock: "黑方时钟",
        currentState: "当前态势",
        settled: "已结算",
        yourTurn: "轮到你",
        waiting: "等待",
        visibilityTitle: "房间可见性",
        visibilityPublic: "公开",
        visibilityPrivate: "私密",
        pendingPlayer: "待加入",
        emptySeat: "空位",
        ready: "已准备",
        online: "在线",
        offline: "离线",
        whiteSide: "白方",
        blackSide: "黑方",
        youWhite: "你执白",
        youBlack: "你执黑",
        whiteLosses: "白方失子",
        blackLosses: "黑方失子",
        none: "无",
        timeControl: "每方 10 分钟",
        drawOffered: "和棋提议",
        checkShort: "将军",
        playerOffline: "{{name}} 离线 · {{seconds}}s",
        phase: "阶段 {{value}}",
        syncChip: "同步 {{value}}",
        spectatorChip: "{{count}} 位观战",
        waitingRoomsChip: "{{count}} 个等待房",
        turnChip: "{{value}}",
        phaseChip: "阶段 {{value}}",
        resultChip: "结果 {{value}}",
        lastMove: "上一步 {{from}}-{{to}}",
        resultLabel: "对局结果",
        reason: "原因：{{reason}} · {{endedAt}}",
        yourEloDelta: "你的 Elo 变化：{{delta}}",
        actionsKicker: "对局操作",
        actionsTitle: "对局操作",
        quickPlayBody: "在这里创建房间、准备入局，或取得当前棋局的 action lease。",
        busy: "执行中：{{label}}",
        moveSheetKicker: "着法记录",
        moveSheet: "着法记录",
        moveSheetEmpty: "对局开始后，这里会按回合展示 SAN 着法。",
        waitingRoomsKicker: "等待房",
        joinableMatches: "待加入对局",
        noJoinableMatches: "当前没有可加入的等待房。",
        emptySeats: "{{count}} 个空位",
        playersCount: "{{count}}/2 玩家",
        readyCount: "{{count}} 已准备",
        offlineSuffix: " (离线)",
        nobodySeated: "尚无人入座",
        joinThisMatch: "加入此局",
        watchRoom: "观战房间",
        leaderboardKicker: "积分榜",
        leaderboard: "积分排行",
        noData: "暂无数据。",
        noRooms: "当前搜索下没有公开房间。",
        roomNameLabel: "房间名",
        roomNamePlaceholder: "可选自定义房间名",
        watchStatusTitle: "正在观战",
        watchingNow: "正在观战",
        showWatchedRoom: "打开观战房间",
        stopWatching: "退出观战",
        promotionKicker: "升变",
        promotionTitle: "选择升变棋子",
        promotionBody: "兵即将从 {{from}} 走到 {{to}}。请选择要升变的棋子。",
        promotionQueen: "后",
        promotionRook: "车",
        promotionBishop: "象",
        promotionKnight: "马",
        cancel: "取消",
        dismissResultOverlay: "关闭结果弹层",
        closeRoomPanel: "关闭房间浮窗",
        waitingActionSuccess: "{{label}}成功"
      }
    }
  };
  const { venue, intro, events, ...chess$2 } = zhCN.chess;
  const play = {
    chess: chess$2
  };
  function mountChessRuntimeSlice(api) {
    const unsubscribers = [
      api.subscribe("chess_welcome", () => {
        api.reportEvent(i18n.t("chess:events.entered"));
      }),
      api.subscribe("chess_lobby_delta", (payload) => {
        const eventName = payload?.kind ?? "room_updated";
        api.reportEvent(i18n.t("chess:events.lobbyUpdate", { eventName }));
      }),
      api.subscribe("chess_match_delta", (payload) => {
        const eventName = payload?.kind ?? "match_update";
        api.reportEvent(i18n.t("chess:events.matchUpdate", { eventName }));
      }),
      api.subscribe("chess_reconnected", () => {
        api.reportEvent(i18n.t("chess:events.restored"));
      })
    ];
    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }
  const loadChessStyles = () => Promise.resolve().then(() => chess$1);
  const plugin = frontend.defineFrontendPlugin({
    pluginId: "uruc.chess",
    version: "0.1.0",
    contributes: [
      {
        target: frontend.PAGE_ROUTE_TARGET,
        payload: {
          id: "hall",
          pathSegment: "hall",
          aliases: ["/play/chess"],
          shell: "standalone",
          guard: "auth",
          order: 20,
          styles: [loadChessStyles],
          venue: {
            titleKey: "chess:venue.title",
            shortLabelKey: "chess:venue.shortLabel",
            descriptionKey: "chess:venue.description",
            icon: "swords",
            category: "public space"
          },
          load: async () => ({ default: (await Promise.resolve().then(() => ChessPage$1)).ChessPage })
        }
      },
      {
        target: frontend.LOCATION_PAGE_TARGET,
        payload: {
          locationId: "uruc.chess.chess-club",
          routeId: "hall",
          titleKey: "chess:venue.title",
          shortLabelKey: "chess:venue.shortLabel",
          descriptionKey: "chess:venue.description",
          icon: "swords",
          accent: "var(--city-node-royal)",
          venueCategory: "public space",
          order: 20,
          x: 20,
          y: 28
        }
      },
      {
        target: frontend.INTRO_CARD_TARGET,
        payload: {
          id: "intro",
          titleKey: "chess:intro.title",
          bodyKey: "chess:intro.body",
          icon: "swords",
          order: 20
        }
      },
      {
        target: frontend.RUNTIME_SLICE_TARGET,
        payload: {
          id: "runtime",
          mount: mountChessRuntimeSlice
        }
      }
    ],
    translations: {
      en: {
        ...en,
        play: play$1
      },
      "zh-CN": {
        ...zhCN,
        play
      }
    }
  });
  globalThis.__uruc_plugin_exports = globalThis.__uruc_plugin_exports || {};
  globalThis.__uruc_plugin_exports["uruc.chess"] = plugin;
  const chess = '.chess-com-shell {\n  --chess-shell-bg: #1f1f1b;\n  --chess-shell-bg-soft: #292924;\n  --chess-shell-panel: rgba(49, 49, 44, 0.9);\n  --chess-shell-panel-strong: rgba(61, 61, 54, 0.96);\n  --chess-shell-panel-soft: rgba(41, 41, 36, 0.82);\n  --chess-shell-line: rgba(255, 255, 255, 0.08);\n  --chess-shell-line-strong: rgba(255, 255, 255, 0.16);\n  --chess-shell-text: #f4f3ed;\n  --chess-shell-text-dim: rgba(244, 243, 237, 0.66);\n  --chess-shell-text-muted: rgba(244, 243, 237, 0.48);\n  --chess-shell-green: #83b64a;\n  --chess-shell-green-strong: #92c95a;\n  --chess-shell-green-deep: #5c8530;\n  --chess-shell-red: #bd5a50;\n  --chess-shell-gold: #d4bb72;\n  --chess-shell-magenta: rgba(174, 92, 255, 0.15);\n  --chess-shell-cyan: rgba(81, 188, 255, 0.14);\n  --chess-board-light: #edeed1;\n  --chess-board-dark: #779556;\n  --chess-board-highlight: rgba(246, 246, 105, 0.22);\n  --chess-board-target: rgba(132, 182, 73, 0.22);\n  --chess-board-target-ring: rgba(194, 236, 108, 0.64);\n  --chess-piece-white-fill: #fffdf7;\n  --chess-piece-white-stroke: #c7b190;\n  --chess-piece-black-fill: #41342d;\n  --chess-piece-black-stroke: #17120f;\n  --chess-page-pad-inline: clamp(14px, 2.2vw, 36px);\n  --chess-page-pad-block: clamp(14px, 2vh, 24px);\n  --chess-column-gap: clamp(16px, 2.4vw, 32px);\n  --chess-board-stack-gap: 6px;\n  --chess-right-rail-width: clamp(420px, 32vw, 540px);\n  --chess-seat-card-height: clamp(58px, 6vh, 68px);\n  --chess-board-size: min(\n    720px,\n    calc(100svh - (var(--chess-page-pad-block) * 2) - (var(--chess-seat-card-height) * 2) - (var(--chess-board-stack-gap) * 2)),\n    calc(100vw - (var(--chess-page-pad-inline) * 2) - var(--chess-right-rail-width) - var(--chess-column-gap))\n  );\n  --chess-stage-height: calc(var(--chess-board-size) + (var(--chess-seat-card-height) * 2) + (var(--chess-board-stack-gap) * 2));\n  position: relative;\n  width: 100%;\n  max-width: none;\n  min-height: 100vh;\n  min-height: 100svh;\n  height: 100svh;\n  margin: 0;\n  padding: var(--chess-page-pad-block) var(--chess-page-pad-inline);\n  display: flex;\n  flex-direction: column;\n  justify-content: center;\n  overflow: hidden;\n  color: var(--chess-shell-text);\n  font-family: "Avenir Next", "Segoe UI Variable", "Helvetica Neue", sans-serif;\n  animation: none;\n}\n\n.page-wrap.chess-com-shell {\n  width: 100%;\n  max-width: none;\n}\n\nbody:has(.chess-com-shell) {\n  background:\n    radial-gradient(circle at top left, rgba(201, 105, 255, 0.14), transparent 28%),\n    radial-gradient(circle at top right, rgba(84, 188, 255, 0.12), transparent 32%),\n    linear-gradient(180deg, #161613 0%, #1b1a17 42%, #121210 100%);\n  overflow-x: hidden;\n  overflow-y: hidden;\n}\n\nbody:has(.chess-com-shell) .game-shell {\n  min-height: 100vh;\n  background: transparent;\n}\n\nbody:has(.chess-com-shell) .game-shell__header {\n  display: none;\n}\n\nbody:has(.chess-com-shell) .game-shell__main {\n  padding-bottom: 0;\n}\n\n.chess-com-shell__ambience {\n  position: absolute;\n  inset: 0;\n  pointer-events: none;\n  background:\n    radial-gradient(circle at 14% 12%, var(--chess-shell-magenta), transparent 24%),\n    radial-gradient(circle at 82% 10%, var(--chess-shell-cyan), transparent 26%),\n    radial-gradient(circle at 48% 92%, rgba(131, 182, 74, 0.1), transparent 22%);\n  filter: blur(4px);\n}\n\n.chess-inline-notice {\n  position: relative;\n  z-index: 1;\n  display: flex;\n  align-items: flex-start;\n  gap: 8px;\n  padding: 10px 14px;\n  border-radius: 18px;\n  border: 1px solid var(--chess-shell-line);\n  backdrop-filter: blur(14px);\n  box-shadow: 0 18px 38px rgba(0, 0, 0, 0.22);\n  line-height: 1.45;\n}\n\n.chess-notice-stack {\n  position: fixed;\n  top: 18px;\n  left: 50%;\n  z-index: 40;\n  display: grid;\n  gap: 10px;\n  width: min(calc(100vw - 24px), 560px);\n  transform: translateX(-50%);\n  pointer-events: none;\n}\n\n.chess-notice-stack .chess-inline-notice {\n  pointer-events: auto;\n}\n\n.chess-inline-notice--info {\n  background: rgba(55, 59, 77, 0.78);\n}\n\n.chess-inline-notice--error {\n  background: rgba(108, 39, 39, 0.82);\n}\n\n.chess-inline-notice__row {\n  display: inline-flex;\n  align-items: center;\n  gap: 8px;\n  flex-wrap: wrap;\n}\n\n.chess-inline-link {\n  color: var(--chess-shell-green-strong);\n  text-decoration: none;\n}\n\n.chess-inline-link:hover {\n  text-decoration: underline;\n}\n\n.chess-visually-hidden {\n  position: absolute;\n  width: 1px;\n  height: 1px;\n  padding: 0;\n  margin: -1px;\n  overflow: hidden;\n  clip: rect(0, 0, 0, 0);\n  white-space: nowrap;\n  border: 0;\n}\n\n.chess-com-layout {\n  position: relative;\n  z-index: 1;\n  flex: 0 0 auto;\n  width: min(100%, calc(var(--chess-board-size) + var(--chess-column-gap) + var(--chess-right-rail-width)));\n  height: var(--chess-stage-height);\n  margin: auto;\n  display: grid;\n  grid-template-columns: var(--chess-board-size) var(--chess-right-rail-width);\n  gap: var(--chess-column-gap);\n  align-items: stretch;\n  justify-content: center;\n  min-height: 0;\n}\n\n.chess-nav-rail,\n.chess-main-stage,\n.chess-panel-card,\n.promotion-card {\n  border: 1px solid var(--chess-shell-line);\n  background:\n    linear-gradient(180deg, rgba(61, 61, 54, 0.94), rgba(35, 35, 31, 0.94));\n  box-shadow: 0 22px 56px rgba(0, 0, 0, 0.28);\n  backdrop-filter: blur(22px);\n}\n\n.chess-nav-rail,\n.chess-mobile-toolbar {\n  display: none;\n}\n\n.chess-nav-rail__brand {\n  display: grid;\n  gap: 12px;\n  justify-items: center;\n}\n\n.chess-nav-rail__brand-mark {\n  width: 44px;\n  height: 44px;\n  border-radius: 16px;\n  display: grid;\n  place-items: center;\n  color: #12240a;\n  background: linear-gradient(180deg, var(--chess-shell-green-strong), var(--chess-shell-green));\n  box-shadow: 0 12px 24px rgba(131, 182, 74, 0.28);\n}\n\n.chess-nav-rail__brand-copy {\n  display: grid;\n  gap: 3px;\n  justify-items: center;\n  text-align: center;\n}\n\n.chess-nav-rail__eyebrow,\n.chess-stage-label {\n  display: inline-block;\n  font-size: 0.7rem;\n  font-weight: 700;\n  line-height: 1.2;\n  letter-spacing: 0.16em;\n  text-transform: uppercase;\n  color: var(--chess-shell-text-muted);\n}\n\n.chess-nav-rail__brand-copy strong {\n  font-family: "Avenir Next Condensed", "Arial Narrow", sans-serif;\n  font-size: 1.2rem;\n  line-height: 1;\n  letter-spacing: 0.05em;\n}\n\n.chess-nav-rail__brand-copy span:last-child {\n  font-size: 0.74rem;\n  line-height: 1.35;\n  color: var(--chess-shell-text-dim);\n}\n\n.chess-nav-rail__menu,\n.chess-nav-rail__actions,\n.chess-nav-rail__summary {\n  display: grid;\n  gap: 10px;\n}\n\n.chess-nav-link,\n.chess-nav-action,\n.chess-mobile-tab,\n.chess-mobile-action {\n  border: 1px solid transparent;\n  color: var(--chess-shell-text);\n  text-decoration: none;\n  transition: transform 140ms ease, background-color 140ms ease, border-color 140ms ease, color 140ms ease;\n}\n\n.chess-nav-link {\n  display: grid;\n  justify-items: center;\n  gap: 6px;\n  padding: 10px 8px;\n  border-radius: 18px;\n  background: rgba(255, 255, 255, 0.03);\n  color: var(--chess-shell-text-dim);\n}\n\n.chess-nav-link:hover,\n.chess-nav-action:hover,\n.chess-mobile-tab:hover,\n.chess-mobile-action:hover {\n  transform: translateY(-1px);\n  border-color: var(--chess-shell-line-strong);\n  background: rgba(255, 255, 255, 0.06);\n  color: var(--chess-shell-text);\n}\n\n.chess-nav-link span {\n  font-size: 0.71rem;\n  line-height: 1.2;\n  text-align: center;\n}\n\n.chess-nav-stat {\n  display: grid;\n  gap: 5px;\n  padding: 11px 12px;\n  border-radius: 16px;\n  background: rgba(255, 255, 255, 0.04);\n  border: 1px solid rgba(255, 255, 255, 0.04);\n}\n\n.chess-nav-stat span {\n  font-size: 0.68rem;\n  line-height: 1.2;\n  letter-spacing: 0.12em;\n  text-transform: uppercase;\n  color: var(--chess-shell-text-muted);\n}\n\n.chess-nav-stat strong {\n  font-size: 0.92rem;\n  line-height: 1.25;\n  word-break: break-word;\n}\n\n.chess-nav-action {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  gap: 8px;\n  min-height: 42px;\n  padding: 0 12px;\n  border-radius: 16px;\n  background: rgba(255, 255, 255, 0.03);\n  cursor: pointer;\n}\n\n.chess-nav-action span {\n  font-size: 0.78rem;\n  line-height: 1.2;\n}\n\n.chess-main-column,\n.chess-right-rail {\n  min-width: 0;\n  min-height: 0;\n}\n\n.chess-main-column {\n  display: flex;\n  justify-content: center;\n  align-items: stretch;\n  height: 100%;\n}\n\n.chess-main-stage {\n  display: flex;\n  flex-direction: column;\n  flex: 0 0 auto;\n  width: fit-content;\n  max-width: 100%;\n  min-height: 0;\n  gap: 6px;\n  padding: 8px 10px;\n  border-radius: 24px;\n}\n\n.chess-main-stage.is-live {\n  height: 100%;\n  padding: 0;\n  border: 0;\n  background: transparent;\n  box-shadow: none;\n  backdrop-filter: none;\n}\n\n.chess-main-stage.is-lobby {\n  justify-content: center;\n}\n\n.chess-stage-badges {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 8px;\n}\n\n.chess-stage-badges--sidebar {\n  justify-content: flex-start;\n}\n\n.chess-stage-badge,\n.chess-panel-pill,\n.chess-com-shell .info-pill {\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n  min-height: 26px;\n  padding: 0 9px;\n  border-radius: 999px;\n  border: 1px solid rgba(255, 255, 255, 0.07);\n  background: rgba(255, 255, 255, 0.05);\n  color: var(--chess-shell-text-dim);\n  font-size: 0.75rem;\n  line-height: 1.2;\n  white-space: nowrap;\n}\n\n.chess-panel-pill--watching {\n  color: #d8f3b2;\n  border-color: rgba(146, 201, 90, 0.26);\n  background: rgba(146, 201, 90, 0.16);\n}\n\n.chess-stage-badge--warn {\n  color: #ffd695;\n  border-color: rgba(255, 214, 149, 0.24);\n  background: rgba(255, 180, 73, 0.12);\n}\n\n.chess-stage-center {\n  min-height: 0;\n  display: flex;\n  flex-direction: column;\n  gap: var(--chess-board-stack-gap);\n  justify-content: center;\n}\n\n.chess-stage-center--lobby {\n  align-items: center;\n}\n\n.chess-stage-center--live {\n  flex: 1;\n  height: 100%;\n  align-items: center;\n  justify-content: flex-start;\n}\n\n.chess-board-shell {\n  display: grid;\n  gap: 6px;\n  min-height: 0;\n  justify-items: center;\n}\n\n.chess-board-shell--preview,\n.chess-board-shell--live {\n  width: fit-content;\n  max-width: 100%;\n}\n\n.result-banner__head,\n.result-banner__body,\n.chess-room-card__head,\n.chess-leaderboard-item__head {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n}\n\n.board-wrap {\n  position: relative;\n  min-height: 0;\n  padding: 4px;\n  border-radius: 18px;\n  background: rgba(12, 12, 10, 0.3);\n  display: grid;\n  place-items: center;\n}\n\n.board-wrap::before {\n  display: none;\n}\n\n.board-wrap--lounge,\n.board-wrap--live {\n  width: fit-content;\n  max-width: 100%;\n}\n\n.board-wrap--live {\n  padding: 0;\n  background: transparent;\n}\n\n.chess-result-overlay {\n  position: absolute;\n  inset: 18px;\n  z-index: 5;\n  display: grid;\n  place-items: center;\n  pointer-events: none;\n  background: radial-gradient(circle at center, rgba(12, 12, 10, 0.06), rgba(12, 12, 10, 0.28) 72%, transparent 100%);\n}\n\n.chess-result-overlay__card {\n  position: relative;\n  width: min(calc(100% - 28px), 360px);\n  display: grid;\n  gap: 10px;\n  padding: 18px 18px 16px;\n  border-radius: 24px;\n  border: 1px solid rgba(246, 246, 180, 0.34);\n  background: linear-gradient(180deg, rgba(39, 45, 30, 0.94), rgba(25, 28, 21, 0.94));\n  box-shadow: 0 24px 52px rgba(0, 0, 0, 0.34);\n  backdrop-filter: blur(18px);\n  pointer-events: auto;\n  text-align: center;\n}\n\n.chess-result-overlay__card strong {\n  font-family: "Avenir Next Condensed", "Arial Narrow", sans-serif;\n  font-size: 1.55rem;\n  line-height: 1.05;\n  letter-spacing: 0.03em;\n}\n\n.chess-result-overlay__room {\n  font-size: 0.82rem;\n  color: var(--chess-shell-text-dim);\n}\n\n.chess-result-overlay__meta {\n  display: grid;\n  gap: 4px;\n  font-size: 0.82rem;\n  color: var(--chess-shell-text-dim);\n}\n\n.chess-result-overlay__delta {\n  font-size: 0.84rem;\n  color: #f3f0d6;\n}\n\n.chess-result-overlay__close {\n  position: absolute;\n  top: 10px;\n  right: 10px;\n  width: 32px;\n  height: 32px;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  border-radius: 999px;\n  border: 1px solid rgba(255, 255, 255, 0.08);\n  background: rgba(255, 255, 255, 0.06);\n  color: var(--chess-shell-text);\n  cursor: pointer;\n}\n\n.chess-board {\n  width: var(--chess-board-size);\n  margin: 0 auto;\n  aspect-ratio: 1;\n  display: grid;\n  grid-template-columns: repeat(8, minmax(0, 1fr));\n  grid-template-rows: repeat(8, minmax(0, 1fr));\n  overflow: hidden;\n  border-radius: 16px;\n  box-shadow:\n    0 18px 40px rgba(0, 0, 0, 0.28),\n    0 0 0 1px rgba(0, 0, 0, 0.55);\n}\n\n.board-wrap--lounge .chess-board {\n  width: min(100%, calc(100vh - 200px), calc(100vw - 640px), 740px);\n}\n\n.chess-square {\n  position: relative;\n  display: grid;\n  place-items: center;\n  aspect-ratio: 1;\n  padding: 0;\n  margin: 0;\n  border: 0;\n  min-width: 0;\n  min-height: 0;\n  transition: filter 120ms ease, box-shadow 120ms ease, transform 120ms ease;\n}\n\nbutton.chess-square {\n  cursor: pointer;\n}\n\n.chess-square.light {\n  background: var(--chess-board-light);\n}\n\n.chess-square.dark {\n  background: var(--chess-board-dark);\n}\n\nbutton.chess-square:hover {\n  filter: brightness(1.03);\n}\n\n.chess-square.selected {\n  box-shadow: inset 0 0 0 4px rgba(255, 255, 255, 0.46);\n}\n\n.chess-square.target {\n  box-shadow:\n    inset 0 0 0 4px var(--chess-board-target-ring),\n    inset 0 0 0 999px var(--chess-board-target);\n}\n\n.chess-square.last-move {\n  box-shadow: inset 0 0 0 999px rgba(246, 246, 105, 0.2);\n}\n\n.chess-square.last-move-from {\n  box-shadow:\n    inset 0 0 0 3px rgba(255, 238, 186, 0.96),\n    inset 0 0 0 999px rgba(234, 197, 92, 0.26);\n}\n\n.chess-square.last-move-to {\n  box-shadow:\n    inset 0 0 0 3px rgba(255, 249, 214, 0.98),\n    0 0 0 2px rgba(250, 243, 144, 0.36),\n    inset 0 0 0 999px rgba(246, 246, 105, 0.4);\n}\n\n.chess-square.drag-source {\n  box-shadow: inset 0 0 0 4px rgba(146, 201, 90, 0.88);\n}\n\n.chess-piece {\n  width: 84%;\n  height: 84%;\n  filter: drop-shadow(0 5px 10px rgba(0, 0, 0, 0.24));\n  pointer-events: none;\n}\n\n.chess-mark {\n  position: absolute;\n  font-family: var(--font-mono);\n  font-size: 10px;\n  font-weight: 700;\n  line-height: 1;\n  text-transform: uppercase;\n  color: rgba(26, 23, 20, 0.46);\n}\n\n.chess-square.dark .chess-mark {\n  color: rgba(255, 255, 255, 0.58);\n}\n\n.chess-mark.file {\n  right: 6px;\n  bottom: 4px;\n}\n\n.chess-mark.rank {\n  left: 6px;\n  top: 4px;\n}\n\n.chess-seat-card {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr) auto;\n  width: var(--chess-board-size);\n  gap: 8px;\n  align-items: center;\n  height: var(--chess-seat-card-height);\n  min-height: var(--chess-seat-card-height);\n  padding: 4px 8px;\n  border-radius: 14px;\n  border: 1px solid rgba(255, 255, 255, 0.04);\n  background: rgba(23, 23, 20, 0.56);\n}\n\n.chess-seat-card.is-active {\n  border-color: rgba(146, 201, 90, 0.38);\n  box-shadow: 0 0 0 1px rgba(146, 201, 90, 0.16), 0 8px 18px rgba(0, 0, 0, 0.16);\n}\n\n.chess-seat-card__identity {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  min-width: 0;\n}\n\n.chess-seat-card__avatar {\n  width: 28px;\n  height: 28px;\n  border-radius: 9px;\n  display: grid;\n  place-items: center;\n  font-size: 0.72rem;\n  font-weight: 800;\n  color: #14140f;\n  background: linear-gradient(180deg, #f8f7f0, #d8d3c1);\n}\n\n.chess-seat-card__avatar.is-self {\n  background: linear-gradient(180deg, var(--chess-shell-green-strong), var(--chess-shell-green));\n}\n\n.chess-seat-card__copy {\n  display: grid;\n  gap: 1px;\n  min-width: 0;\n}\n\n.chess-panel-pill-row,\n.pill-row {\n  display: flex;\n  align-items: center;\n  flex-wrap: wrap;\n  gap: 6px;\n}\n\n.chess-seat-card__name {\n  min-width: 0;\n  font-size: 0.8rem;\n  line-height: 1.1;\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n.chess-seat-card__detail {\n  min-height: 0.6rem;\n  font-size: 0.62rem;\n  line-height: 0.6rem;\n  color: var(--chess-shell-text-muted);\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n.chess-seat-card__detail.is-placeholder {\n  opacity: 0;\n}\n\n.chess-seat-card__clock {\n  min-width: 76px;\n  padding: 6px 8px;\n  border-radius: 10px;\n  text-align: center;\n  font-size: clamp(0.96rem, 1.35vw, 1.2rem);\n  line-height: 1;\n  color: var(--chess-shell-text);\n  background: rgba(11, 11, 10, 0.46);\n  border: 1px solid rgba(255, 255, 255, 0.05);\n}\n\n.chess-com-shell .tiny {\n  font-size: 0.76rem;\n}\n\n.chess-com-shell .muted {\n  color: var(--chess-shell-text-muted);\n}\n\n.chess-com-shell .mono {\n  font-family: var(--font-mono);\n}\n\n.result-banner {\n  padding: 15px 16px;\n  border-radius: 22px;\n  border: 1px solid rgba(146, 201, 90, 0.22);\n  background: rgba(116, 157, 64, 0.14);\n}\n\n.result-banner__head strong {\n  font-size: 1.05rem;\n}\n\n.result-banner__body {\n  margin-top: 8px;\n  font-size: 0.82rem;\n  color: var(--chess-shell-text-dim);\n}\n\n.result-banner__delta {\n  margin-top: 10px;\n  font-size: 0.84rem;\n  color: var(--chess-shell-text);\n}\n\n.chess-right-rail {\n  display: grid;\n  grid-template-rows: auto minmax(0, 1fr);\n  gap: 14px;\n  position: relative;\n  width: 100%;\n  height: 100%;\n  max-height: var(--chess-stage-height);\n  overflow: hidden;\n  padding-right: 0;\n}\n\n.chess-sidebar-meta {\n  display: grid;\n  gap: 10px;\n  align-content: start;\n}\n\n.chess-panel-card {\n  display: grid;\n  gap: 14px;\n  padding: 16px;\n  border-radius: 24px;\n}\n\n.chess-panel-card__header {\n  display: flex;\n  align-items: flex-start;\n  justify-content: space-between;\n  gap: 12px;\n}\n\n.chess-panel-card__header h2,\n.promotion-card h3 {\n  margin: 4px 0 0;\n  font-size: 1.02rem;\n  line-height: 1.2;\n}\n\n.chess-panel-card__summary {\n  display: grid;\n  gap: 10px;\n  padding: 12px 14px;\n  border-radius: 18px;\n  background: rgba(255, 255, 255, 0.04);\n  border: 1px solid rgba(255, 255, 255, 0.04);\n}\n\n.chess-panel-card__summary p,\n.promotion-card__copy {\n  margin: 0;\n  font-size: 0.85rem;\n  line-height: 1.5;\n  color: var(--chess-shell-text-dim);\n}\n\n.chess-workspace-tabs {\n  display: grid;\n  grid-template-columns: repeat(5, minmax(0, 1fr));\n  gap: 8px;\n  padding: 8px;\n  border-radius: 20px;\n  border: 1px solid var(--chess-shell-line);\n  background: linear-gradient(180deg, rgba(53, 53, 48, 0.94), rgba(33, 33, 29, 0.94));\n  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.22);\n}\n\n.chess-workspace-tab {\n  display: grid;\n  justify-items: center;\n  gap: 5px;\n  min-height: 62px;\n  padding: 8px 6px;\n  border-radius: 16px;\n  border: 1px solid transparent;\n  background: transparent;\n  color: var(--chess-shell-text-dim);\n  cursor: pointer;\n  transition: transform 140ms ease, background-color 140ms ease, border-color 140ms ease, color 140ms ease;\n}\n\n.chess-workspace-tab:hover {\n  transform: translateY(-1px);\n  border-color: rgba(255, 255, 255, 0.1);\n  background: rgba(255, 255, 255, 0.04);\n}\n\n.chess-workspace-tab.is-active {\n  border-color: rgba(255, 255, 255, 0.1);\n  background: rgba(255, 255, 255, 0.06);\n  color: var(--chess-shell-text);\n}\n\n.chess-workspace-tab span {\n  font-size: 0.76rem;\n  line-height: 1.25;\n  text-align: center;\n}\n\n.chess-panel-card--workspace {\n  position: relative;\n  min-height: 0;\n  overflow: auto;\n  align-content: start;\n}\n\n.chess-panel-card--workspace::-webkit-scrollbar {\n  width: 8px;\n}\n\n.chess-panel-card--workspace::-webkit-scrollbar-thumb {\n  border-radius: 999px;\n  background: rgba(255, 255, 255, 0.12);\n}\n\n.chess-launch-card,\n.chess-room-detail {\n  display: grid;\n  gap: 12px;\n  padding: 14px;\n  border-radius: 20px;\n  background: rgba(255, 255, 255, 0.04);\n  border: 1px solid rgba(255, 255, 255, 0.05);\n}\n\n.chess-launch-card__time {\n  display: flex;\n  justify-content: flex-start;\n}\n\n.chess-field {\n  display: grid;\n  gap: 8px;\n}\n\n.chess-field__label {\n  font-size: 0.72rem;\n  line-height: 1.2;\n  letter-spacing: 0.12em;\n  text-transform: uppercase;\n  color: var(--chess-shell-text-muted);\n}\n\n.chess-field__control {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  min-height: 46px;\n  padding: 0 14px;\n  border-radius: 16px;\n  background: rgba(0, 0, 0, 0.18);\n  border: 1px solid rgba(255, 255, 255, 0.05);\n  color: var(--chess-shell-text);\n}\n\n.chess-field__control input {\n  width: 100%;\n  border: 0;\n  outline: none;\n  background: transparent;\n  color: inherit;\n  font: inherit;\n}\n\n.chess-field__control input::placeholder {\n  color: var(--chess-shell-text-muted);\n}\n\n.chess-field__control--search {\n  padding-left: 12px;\n}\n\n.chess-room-search {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr) auto;\n  gap: 10px;\n}\n\n.chess-room-watch-banner {\n  display: grid;\n  gap: 10px;\n  padding: 12px 14px;\n  border-radius: 18px;\n  border: 1px solid rgba(146, 201, 90, 0.18);\n  background: rgba(146, 201, 90, 0.08);\n}\n\n.chess-room-watch-banner__copy {\n  display: grid;\n  gap: 3px;\n}\n\n.chess-room-watch-banner__copy strong {\n  font-size: 0.98rem;\n  line-height: 1.2;\n}\n\n.chess-room-watch-banner__actions {\n  display: flex;\n  align-items: center;\n  flex-wrap: wrap;\n  gap: 8px;\n}\n\n.chess-room-watch-banner__actions .app-btn {\n  width: auto;\n  min-width: 0;\n}\n\n.chess-visibility-toggle {\n  display: grid;\n  grid-template-columns: repeat(2, minmax(0, 1fr));\n  gap: 8px;\n}\n\n.chess-visibility-toggle__option {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  gap: 8px;\n  min-height: 42px;\n  padding: 0 12px;\n  border-radius: 14px;\n  border: 1px solid rgba(255, 255, 255, 0.06);\n  background: rgba(255, 255, 255, 0.04);\n  color: var(--chess-shell-text-dim);\n  transition: transform 140ms ease, border-color 140ms ease, background-color 140ms ease, color 140ms ease;\n}\n\n.chess-visibility-toggle__option:hover {\n  transform: translateY(-1px);\n  border-color: rgba(255, 255, 255, 0.12);\n  color: var(--chess-shell-text);\n}\n\n.chess-visibility-toggle__option.is-active {\n  color: var(--chess-shell-text);\n  border-color: rgba(146, 201, 90, 0.28);\n  background: rgba(146, 201, 90, 0.12);\n}\n\n.chess-room-detail.is-current {\n  border-color: rgba(146, 201, 90, 0.22);\n  background: rgba(146, 201, 90, 0.08);\n}\n\n.chess-room-detail__header {\n  display: flex;\n  align-items: flex-start;\n  justify-content: space-between;\n  gap: 12px;\n}\n\n.chess-room-detail__header h3 {\n  margin: 4px 0 0;\n  font-size: 1.05rem;\n  line-height: 1.2;\n}\n\n.chess-room-detail__copy,\n.chess-room-detail__hint {\n  font-size: 0.82rem;\n  line-height: 1.45;\n  color: var(--chess-shell-text-dim);\n}\n\n.chess-room-detail__body {\n  display: grid;\n  gap: 8px;\n}\n\n.chess-room-detail__player {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 10px;\n  padding: 10px 12px;\n  border-radius: 14px;\n  background: rgba(0, 0, 0, 0.16);\n}\n\n.chess-room-detail__actions {\n  display: grid;\n  gap: 8px;\n}\n\n.chess-room-detail--directory .chess-room-detail__actions {\n  grid-template-columns: repeat(2, minmax(0, 1fr));\n}\n\n.chess-room-detail-modal {\n  position: absolute;\n  top: 104px;\n  left: 14px;\n  right: 14px;\n  z-index: 7;\n  pointer-events: none;\n}\n\n.chess-room-detail--floating {\n  pointer-events: auto;\n  box-shadow: 0 30px 64px rgba(0, 0, 0, 0.42);\n  background:\n    linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.03)),\n    rgba(34, 35, 32, 0.98);\n  border-color: rgba(255, 255, 255, 0.08);\n}\n\n.chess-room-detail__header-actions {\n  display: inline-flex;\n  align-items: center;\n  gap: 10px;\n}\n\n.chess-room-detail__close {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 36px;\n  height: 36px;\n  border: 0;\n  border-radius: 999px;\n  background: rgba(0, 0, 0, 0.22);\n  color: var(--chess-shell-text);\n  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);\n  transition: transform 140ms ease, background-color 140ms ease;\n}\n\n.chess-room-detail__close:hover {\n  transform: translateY(-1px);\n  background: rgba(0, 0, 0, 0.3);\n}\n\n.chess-stat-grid {\n  display: grid;\n  grid-template-columns: repeat(2, minmax(0, 1fr));\n  gap: 10px;\n}\n\n.chess-stat-card {\n  display: grid;\n  gap: 6px;\n  padding: 13px 14px;\n  border-radius: 18px;\n  background: rgba(255, 255, 255, 0.04);\n  border: 1px solid rgba(255, 255, 255, 0.05);\n}\n\n.chess-stat-card span {\n  font-size: 0.72rem;\n  line-height: 1.2;\n  letter-spacing: 0.1em;\n  text-transform: uppercase;\n  color: var(--chess-shell-text-muted);\n}\n\n.chess-stat-card strong {\n  font-size: 1.18rem;\n  line-height: 1.2;\n}\n\n.chess-inline-result {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n  padding: 11px 12px;\n  border-radius: 16px;\n  border: 1px solid rgba(146, 201, 90, 0.22);\n  background: rgba(146, 201, 90, 0.12);\n}\n\n.chess-inline-result span {\n  font-size: 0.8rem;\n  color: var(--chess-shell-text-dim);\n}\n\n.chess-action-grid {\n  display: grid;\n  gap: 10px;\n}\n\n.chess-com-shell .app-btn {\n  width: 100%;\n  min-height: 46px;\n  padding: 0 16px;\n  border: 1px solid rgba(255, 255, 255, 0.06);\n  border-radius: 16px;\n  background: rgba(255, 255, 255, 0.06);\n  color: var(--chess-shell-text);\n  font-weight: 700;\n  box-shadow: none;\n  transition: transform 140ms ease, background-color 140ms ease, border-color 140ms ease, color 140ms ease;\n}\n\n.chess-com-shell .app-btn:hover:not(:disabled) {\n  transform: translateY(-1px);\n  border-color: rgba(255, 255, 255, 0.16);\n  background: rgba(255, 255, 255, 0.1);\n}\n\n.chess-com-shell .app-btn.secondary {\n  background: rgba(255, 255, 255, 0.04);\n}\n\n.chess-com-shell .app-btn.ghost {\n  background: transparent;\n}\n\n.chess-com-shell .app-btn.chess-cta {\n  color: #13240b;\n  border-color: rgba(154, 216, 88, 0.68);\n  background: linear-gradient(180deg, var(--chess-shell-green-strong), var(--chess-shell-green));\n  box-shadow: 0 16px 28px rgba(131, 182, 74, 0.22);\n}\n\n.chess-com-shell .app-btn:disabled,\n.chess-nav-action:disabled,\n.chess-mobile-action:disabled {\n  opacity: 0.52;\n  cursor: not-allowed;\n  transform: none;\n}\n\n.chess-panel-empty {\n  padding: 12px 14px;\n  border-radius: 16px;\n  background: rgba(255, 255, 255, 0.04);\n  border: 1px dashed rgba(255, 255, 255, 0.08);\n  color: var(--chess-shell-text-dim);\n  font-size: 0.84rem;\n  line-height: 1.45;\n}\n\n.chess-scroll {\n  max-height: 260px;\n  overflow: auto;\n  padding-right: 4px;\n}\n\n.chess-scroll::-webkit-scrollbar {\n  width: 8px;\n}\n\n.chess-scroll::-webkit-scrollbar-thumb {\n  border-radius: 999px;\n  background: rgba(255, 255, 255, 0.12);\n}\n\n.chess-right-rail::-webkit-scrollbar {\n  width: 8px;\n}\n\n.chess-right-rail::-webkit-scrollbar-thumb {\n  border-radius: 999px;\n  background: rgba(255, 255, 255, 0.12);\n}\n\n.move-list,\n.chess-room-list,\n.chess-leaderboard-list,\n.chess-activity-list {\n  display: grid;\n  gap: 10px;\n}\n\n.move-row {\n  display: grid;\n  grid-template-columns: 40px minmax(0, 1fr) minmax(0, 1fr);\n  gap: 8px;\n  align-items: center;\n}\n\n.move-row__index {\n  color: var(--chess-shell-text-muted);\n  font-size: 0.8rem;\n}\n\n.move-pill {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  min-height: 34px;\n  padding: 0 10px;\n  border-radius: 12px;\n  background: rgba(255, 255, 255, 0.04);\n  border: 1px solid rgba(255, 255, 255, 0.04);\n  color: var(--chess-shell-text);\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n.move-pill.is-latest {\n  border-color: rgba(244, 235, 143, 0.4);\n  background: rgba(206, 182, 83, 0.22);\n  box-shadow: 0 0 0 1px rgba(244, 235, 143, 0.18);\n  font-weight: 700;\n}\n\n.chess-room-card,\n.chess-leaderboard-item,\n.chess-activity-item {\n  display: grid;\n  gap: 10px;\n  padding: 12px 13px;\n  border-radius: 18px;\n  background: rgba(255, 255, 255, 0.04);\n  border: 1px solid rgba(255, 255, 255, 0.04);\n}\n\n.chess-room-card--selectable {\n  width: 100%;\n  text-align: left;\n  cursor: pointer;\n  transition: transform 140ms ease, border-color 140ms ease, background-color 140ms ease;\n}\n\n.chess-room-card--selectable:hover {\n  transform: translateY(-1px);\n  border-color: rgba(255, 255, 255, 0.12);\n}\n\n.chess-room-card--selectable.is-selected {\n  border-color: rgba(146, 201, 90, 0.34);\n  background: rgba(146, 201, 90, 0.1);\n}\n\n.chess-room-card__head,\n.chess-leaderboard-item__head {\n  font-size: 0.82rem;\n  color: var(--chess-shell-text-dim);\n}\n\n.chess-room-card__head strong,\n.chess-leaderboard-item__head strong {\n  color: var(--chess-shell-text);\n}\n\n.chess-room-card__meta {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 8px 10px;\n  font-size: 0.8rem;\n  line-height: 1.4;\n  color: var(--chess-shell-text-dim);\n}\n\n.chess-room-card__players,\n.chess-leaderboard-item__meta,\n.chess-activity-item {\n  font-size: 0.8rem;\n  line-height: 1.5;\n  color: var(--chess-shell-text-dim);\n}\n\n.chess-leaderboard-item__name {\n  font-size: 0.92rem;\n  line-height: 1.3;\n}\n\n.chess-rank {\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n}\n\n.chess-sidebar-headline {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 10px;\n  padding: 10px 2px 0;\n  color: var(--chess-shell-text);\n  font-size: 0.88rem;\n}\n\n.promotion-overlay {\n  position: fixed;\n  inset: 0;\n  z-index: 40;\n  display: grid;\n  place-items: center;\n  padding: 24px;\n  background: rgba(11, 11, 9, 0.72);\n  backdrop-filter: blur(16px);\n}\n\n.promotion-card {\n  width: min(560px, 100%);\n  padding: 22px;\n  border-radius: 28px;\n}\n\n.promotion-grid {\n  display: grid;\n  grid-template-columns: repeat(4, minmax(0, 1fr));\n  gap: 10px;\n  margin-top: 18px;\n}\n\n.promotion-option {\n  display: grid;\n  place-items: center;\n  gap: 8px;\n  min-height: 112px;\n  padding: 12px 8px;\n  border-radius: 18px;\n  border: 1px solid rgba(255, 255, 255, 0.08);\n  background: rgba(255, 255, 255, 0.05);\n  color: var(--chess-shell-text);\n  cursor: pointer;\n  transition: transform 140ms ease, border-color 140ms ease, background-color 140ms ease;\n}\n\n.promotion-option:hover {\n  transform: translateY(-1px);\n  border-color: rgba(146, 201, 90, 0.36);\n  background: rgba(146, 201, 90, 0.1);\n}\n\n.promotion-piece {\n  width: 56px;\n  height: 56px;\n}\n\n.promotion-card__actions {\n  margin-top: 16px;\n}\n\n.chess-scroll--workspace {\n  max-height: min(32vh, 320px);\n}\n\n.chess-float-orb {\n  position: fixed;\n  z-index: 60;\n  display: flex;\n  align-items: flex-start;\n  gap: 8px;\n}\n\n.chess-float-orb.is-dragging {\n  user-select: none;\n}\n\n.chess-float-orb__core {\n  width: 68px;\n  height: 68px;\n  border-radius: 999px;\n  display: grid;\n  place-items: center;\n  border: 1px solid rgba(154, 216, 88, 0.46);\n  background: linear-gradient(180deg, var(--chess-shell-green-strong), var(--chess-shell-green));\n  color: #12210a;\n  box-shadow: 0 18px 32px rgba(131, 182, 74, 0.26);\n  cursor: grab;\n  touch-action: none;\n}\n\n.chess-float-orb.is-dragging .chess-float-orb__core {\n  cursor: grabbing;\n}\n\n.chess-float-orb__menu {\n  display: grid;\n  gap: 8px;\n  min-width: 160px;\n  padding: 10px;\n  border-radius: 22px;\n  border: 1px solid var(--chess-shell-line);\n  background: linear-gradient(180deg, rgba(50, 50, 44, 0.96), rgba(29, 29, 26, 0.96));\n  box-shadow: 0 22px 48px rgba(0, 0, 0, 0.26);\n}\n\n.chess-float-orb__action {\n  display: inline-flex;\n  align-items: center;\n  gap: 8px;\n  min-height: 42px;\n  padding: 0 12px;\n  border-radius: 14px;\n  border: 1px solid rgba(255, 255, 255, 0.05);\n  background: rgba(255, 255, 255, 0.04);\n  color: var(--chess-shell-text);\n  cursor: pointer;\n}\n\n@media (max-width: 1260px) {\n  .chess-com-layout {\n    --chess-right-rail-width: clamp(340px, 35vw, 430px);\n    --chess-board-size: min(\n      660px,\n      calc(100svh - (var(--chess-page-pad-block) * 2) - (var(--chess-seat-card-height) * 2) - (var(--chess-board-stack-gap) * 2)),\n      calc(100vw - (var(--chess-page-pad-inline) * 2) - var(--chess-right-rail-width) - var(--chess-column-gap))\n    );\n  }\n\n  .chess-board,\n  .chess-seat-card {\n    width: var(--chess-board-size);\n  }\n\n  .board-wrap--lounge .chess-board {\n    width: var(--chess-board-size);\n  }\n}\n\n@media (max-width: 1040px) {\n  .chess-com-shell {\n    height: auto;\n    min-height: 100%;\n    overflow: visible;\n    padding: 14px 14px 22px;\n    justify-content: flex-start;\n  }\n\n  body:has(.chess-com-shell) {\n    overflow-y: auto;\n  }\n\n  .chess-com-layout {\n    flex: none;\n    width: 100%;\n    height: auto;\n    margin: 0;\n    grid-template-columns: 1fr;\n    justify-content: stretch;\n  }\n\n  .chess-right-rail {\n    position: static;\n    width: 100%;\n    max-height: none;\n    overflow: visible;\n    padding-right: 0;\n    grid-template-rows: auto auto auto;\n  }\n\n  .chess-board,\n  .chess-seat-card,\n  .board-wrap--lounge .chess-board {\n    width: min(100%, calc(100vw - 48px), 720px);\n  }\n\n  .chess-workspace-tabs {\n    grid-template-columns: repeat(5, minmax(0, 1fr));\n  }\n\n  .chess-float-orb {\n    left: 16px !important;\n    top: auto !important;\n    bottom: 16px;\n  }\n}\n\n@media (max-width: 760px) {\n  .chess-notice-stack {\n    top: 10px;\n    width: min(calc(100vw - 16px), 560px);\n  }\n\n  .chess-main-stage,\n  .chess-panel-card,\n  .promotion-card {\n    border-radius: 22px;\n  }\n\n  .chess-main-stage {\n    padding: 12px;\n  }\n\n  .chess-board-shell,\n  .board-wrap {\n    padding: 6px;\n  }\n\n  .chess-seat-card {\n    grid-template-columns: 1fr;\n  }\n\n  .chess-seat-card__clock {\n    width: 100%;\n  }\n\n  .chess-workspace-tabs {\n    grid-template-columns: repeat(2, minmax(0, 1fr));\n  }\n\n  .chess-workspace-tab {\n    min-height: 64px;\n  }\n\n  .chess-stat-grid {\n    grid-template-columns: 1fr;\n  }\n\n  .chess-room-search,\n  .chess-room-detail--directory .chess-room-detail__actions {\n    grid-template-columns: 1fr;\n  }\n\n  .chess-room-detail-modal {\n    top: 112px;\n    left: 12px;\n    right: 12px;\n  }\n\n  .chess-room-detail__header {\n    flex-direction: column;\n  }\n\n  .chess-room-detail__header-actions {\n    width: 100%;\n    justify-content: space-between;\n  }\n\n  .chess-float-orb__menu {\n    min-width: 144px;\n  }\n\n  .promotion-grid {\n    grid-template-columns: repeat(2, minmax(0, 1fr));\n  }\n}\n';
  const chess$1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    default: chess
  }, Symbol.toStringTag, { value: "Module" }));
  function rootNode(comment) {
    return comment !== null ? { comment, variations: [] } : { variations: [] };
  }
  function node(move, suffix, nag, comment, variations) {
    const node2 = { move, variations };
    if (suffix) {
      node2.suffix = suffix;
    }
    if (nag) {
      node2.nag = nag;
    }
    if (comment !== null) {
      node2.comment = comment;
    }
    return node2;
  }
  function lineToTree(...nodes) {
    const [root, ...rest] = nodes;
    let parent = root;
    for (const child of rest) {
      if (child !== null) {
        parent.variations = [child, ...child.variations];
        child.variations = [];
        parent = child;
      }
    }
    return root;
  }
  function pgn(headers, game) {
    if (game.marker && game.marker.comment) {
      let node2 = game.root;
      while (true) {
        const next = node2.variations[0];
        if (!next) {
          node2.comment = game.marker.comment;
          break;
        }
        node2 = next;
      }
    }
    return {
      headers,
      root: game.root,
      result: (game.marker && game.marker.result) ?? void 0
    };
  }
  function peg$subclass(child, parent) {
    function C() {
      this.constructor = child;
    }
    C.prototype = parent.prototype;
    child.prototype = new C();
  }
  function peg$SyntaxError(message, expected, found, location) {
    var self = Error.call(this, message);
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(self, peg$SyntaxError.prototype);
    }
    self.expected = expected;
    self.found = found;
    self.location = location;
    self.name = "SyntaxError";
    return self;
  }
  peg$subclass(peg$SyntaxError, Error);
  function peg$padEnd(str, targetLength, padString) {
    padString = padString || " ";
    if (str.length > targetLength) {
      return str;
    }
    targetLength -= str.length;
    padString += padString.repeat(targetLength);
    return str + padString.slice(0, targetLength);
  }
  peg$SyntaxError.prototype.format = function(sources) {
    var str = "Error: " + this.message;
    if (this.location) {
      var src = null;
      var k;
      for (k = 0; k < sources.length; k++) {
        if (sources[k].source === this.location.source) {
          src = sources[k].text.split(/\r\n|\n|\r/g);
          break;
        }
      }
      var s = this.location.start;
      var offset_s = this.location.source && typeof this.location.source.offset === "function" ? this.location.source.offset(s) : s;
      var loc = this.location.source + ":" + offset_s.line + ":" + offset_s.column;
      if (src) {
        var e = this.location.end;
        var filler = peg$padEnd("", offset_s.line.toString().length, " ");
        var line = src[s.line - 1];
        var last = s.line === e.line ? e.column : line.length + 1;
        var hatLen = last - s.column || 1;
        str += "\n --> " + loc + "\n" + filler + " |\n" + offset_s.line + " | " + line + "\n" + filler + " | " + peg$padEnd("", s.column - 1, " ") + peg$padEnd("", hatLen, "^");
      } else {
        str += "\n at " + loc;
      }
    }
    return str;
  };
  peg$SyntaxError.buildMessage = function(expected, found) {
    var DESCRIBE_EXPECTATION_FNS = {
      literal: function(expectation) {
        return '"' + literalEscape(expectation.text) + '"';
      },
      class: function(expectation) {
        var escapedParts = expectation.parts.map(function(part) {
          return Array.isArray(part) ? classEscape(part[0]) + "-" + classEscape(part[1]) : classEscape(part);
        });
        return "[" + (expectation.inverted ? "^" : "") + escapedParts.join("") + "]";
      },
      any: function() {
        return "any character";
      },
      end: function() {
        return "end of input";
      },
      other: function(expectation) {
        return expectation.description;
      }
    };
    function hex(ch) {
      return ch.charCodeAt(0).toString(16).toUpperCase();
    }
    function literalEscape(s) {
      return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\0/g, "\\0").replace(/\t/g, "\\t").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/[\x00-\x0F]/g, function(ch) {
        return "\\x0" + hex(ch);
      }).replace(/[\x10-\x1F\x7F-\x9F]/g, function(ch) {
        return "\\x" + hex(ch);
      });
    }
    function classEscape(s) {
      return s.replace(/\\/g, "\\\\").replace(/\]/g, "\\]").replace(/\^/g, "\\^").replace(/-/g, "\\-").replace(/\0/g, "\\0").replace(/\t/g, "\\t").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/[\x00-\x0F]/g, function(ch) {
        return "\\x0" + hex(ch);
      }).replace(/[\x10-\x1F\x7F-\x9F]/g, function(ch) {
        return "\\x" + hex(ch);
      });
    }
    function describeExpectation(expectation) {
      return DESCRIBE_EXPECTATION_FNS[expectation.type](expectation);
    }
    function describeExpected(expected2) {
      var descriptions = expected2.map(describeExpectation);
      var i, j;
      descriptions.sort();
      if (descriptions.length > 0) {
        for (i = 1, j = 1; i < descriptions.length; i++) {
          if (descriptions[i - 1] !== descriptions[i]) {
            descriptions[j] = descriptions[i];
            j++;
          }
        }
        descriptions.length = j;
      }
      switch (descriptions.length) {
        case 1:
          return descriptions[0];
        case 2:
          return descriptions[0] + " or " + descriptions[1];
        default:
          return descriptions.slice(0, -1).join(", ") + ", or " + descriptions[descriptions.length - 1];
      }
    }
    function describeFound(found2) {
      return found2 ? '"' + literalEscape(found2) + '"' : "end of input";
    }
    return "Expected " + describeExpected(expected) + " but " + describeFound(found) + " found.";
  };
  function peg$parse(input, options) {
    options = options !== void 0 ? options : {};
    var peg$FAILED = {};
    var peg$source = options.grammarSource;
    var peg$startRuleFunctions = { pgn: peg$parsepgn };
    var peg$startRuleFunction = peg$parsepgn;
    var peg$c0 = "[";
    var peg$c1 = '"';
    var peg$c2 = "]";
    var peg$c3 = ".";
    var peg$c4 = "O-O-O";
    var peg$c5 = "O-O";
    var peg$c6 = "0-0-0";
    var peg$c7 = "0-0";
    var peg$c8 = "$";
    var peg$c9 = "{";
    var peg$c10 = "}";
    var peg$c11 = ";";
    var peg$c12 = "(";
    var peg$c13 = ")";
    var peg$c14 = "1-0";
    var peg$c15 = "0-1";
    var peg$c16 = "1/2-1/2";
    var peg$c17 = "*";
    var peg$r0 = /^[a-zA-Z]/;
    var peg$r1 = /^[^"]/;
    var peg$r2 = /^[0-9]/;
    var peg$r3 = /^[.]/;
    var peg$r4 = /^[a-zA-Z1-8\-=]/;
    var peg$r5 = /^[+#]/;
    var peg$r6 = /^[!?]/;
    var peg$r7 = /^[^}]/;
    var peg$r8 = /^[^\r\n]/;
    var peg$r9 = /^[ \t\r\n]/;
    var peg$e0 = peg$otherExpectation("tag pair");
    var peg$e1 = peg$literalExpectation("[", false);
    var peg$e2 = peg$literalExpectation('"', false);
    var peg$e3 = peg$literalExpectation("]", false);
    var peg$e4 = peg$otherExpectation("tag name");
    var peg$e5 = peg$classExpectation([["a", "z"], ["A", "Z"]], false, false);
    var peg$e6 = peg$otherExpectation("tag value");
    var peg$e7 = peg$classExpectation(['"'], true, false);
    var peg$e8 = peg$otherExpectation("move number");
    var peg$e9 = peg$classExpectation([["0", "9"]], false, false);
    var peg$e10 = peg$literalExpectation(".", false);
    var peg$e11 = peg$classExpectation(["."], false, false);
    var peg$e12 = peg$otherExpectation("standard algebraic notation");
    var peg$e13 = peg$literalExpectation("O-O-O", false);
    var peg$e14 = peg$literalExpectation("O-O", false);
    var peg$e15 = peg$literalExpectation("0-0-0", false);
    var peg$e16 = peg$literalExpectation("0-0", false);
    var peg$e17 = peg$classExpectation([["a", "z"], ["A", "Z"], ["1", "8"], "-", "="], false, false);
    var peg$e18 = peg$classExpectation(["+", "#"], false, false);
    var peg$e19 = peg$otherExpectation("suffix annotation");
    var peg$e20 = peg$classExpectation(["!", "?"], false, false);
    var peg$e21 = peg$otherExpectation("NAG");
    var peg$e22 = peg$literalExpectation("$", false);
    var peg$e23 = peg$otherExpectation("brace comment");
    var peg$e24 = peg$literalExpectation("{", false);
    var peg$e25 = peg$classExpectation(["}"], true, false);
    var peg$e26 = peg$literalExpectation("}", false);
    var peg$e27 = peg$otherExpectation("rest of line comment");
    var peg$e28 = peg$literalExpectation(";", false);
    var peg$e29 = peg$classExpectation(["\r", "\n"], true, false);
    var peg$e30 = peg$otherExpectation("variation");
    var peg$e31 = peg$literalExpectation("(", false);
    var peg$e32 = peg$literalExpectation(")", false);
    var peg$e33 = peg$otherExpectation("game termination marker");
    var peg$e34 = peg$literalExpectation("1-0", false);
    var peg$e35 = peg$literalExpectation("0-1", false);
    var peg$e36 = peg$literalExpectation("1/2-1/2", false);
    var peg$e37 = peg$literalExpectation("*", false);
    var peg$e38 = peg$otherExpectation("whitespace");
    var peg$e39 = peg$classExpectation([" ", "	", "\r", "\n"], false, false);
    var peg$f0 = function(headers, game) {
      return pgn(headers, game);
    };
    var peg$f1 = function(tagPairs) {
      return Object.fromEntries(tagPairs);
    };
    var peg$f2 = function(tagName, tagValue) {
      return [tagName, tagValue];
    };
    var peg$f3 = function(root, marker) {
      return { root, marker };
    };
    var peg$f4 = function(comment, moves) {
      return lineToTree(rootNode(comment), ...moves.flat());
    };
    var peg$f5 = function(san, suffix, nag, comment, variations) {
      return node(san, suffix, nag, comment, variations);
    };
    var peg$f6 = function(nag) {
      return nag;
    };
    var peg$f7 = function(comment) {
      return comment.replace(/[\r\n]+/g, " ");
    };
    var peg$f8 = function(comment) {
      return comment.trim();
    };
    var peg$f9 = function(line) {
      return line;
    };
    var peg$f10 = function(result, comment) {
      return { result, comment };
    };
    var peg$currPos = options.peg$currPos | 0;
    var peg$posDetailsCache = [{ line: 1, column: 1 }];
    var peg$maxFailPos = peg$currPos;
    var peg$maxFailExpected = options.peg$maxFailExpected || [];
    var peg$silentFails = options.peg$silentFails | 0;
    var peg$result;
    if (options.startRule) {
      if (!(options.startRule in peg$startRuleFunctions)) {
        throw new Error(`Can't start parsing from rule "` + options.startRule + '".');
      }
      peg$startRuleFunction = peg$startRuleFunctions[options.startRule];
    }
    function peg$literalExpectation(text, ignoreCase) {
      return { type: "literal", text, ignoreCase };
    }
    function peg$classExpectation(parts, inverted, ignoreCase) {
      return { type: "class", parts, inverted, ignoreCase };
    }
    function peg$endExpectation() {
      return { type: "end" };
    }
    function peg$otherExpectation(description) {
      return { type: "other", description };
    }
    function peg$computePosDetails(pos) {
      var details = peg$posDetailsCache[pos];
      var p;
      if (details) {
        return details;
      } else {
        if (pos >= peg$posDetailsCache.length) {
          p = peg$posDetailsCache.length - 1;
        } else {
          p = pos;
          while (!peg$posDetailsCache[--p]) {
          }
        }
        details = peg$posDetailsCache[p];
        details = {
          line: details.line,
          column: details.column
        };
        while (p < pos) {
          if (input.charCodeAt(p) === 10) {
            details.line++;
            details.column = 1;
          } else {
            details.column++;
          }
          p++;
        }
        peg$posDetailsCache[pos] = details;
        return details;
      }
    }
    function peg$computeLocation(startPos, endPos, offset) {
      var startPosDetails = peg$computePosDetails(startPos);
      var endPosDetails = peg$computePosDetails(endPos);
      var res = {
        source: peg$source,
        start: {
          offset: startPos,
          line: startPosDetails.line,
          column: startPosDetails.column
        },
        end: {
          offset: endPos,
          line: endPosDetails.line,
          column: endPosDetails.column
        }
      };
      return res;
    }
    function peg$fail(expected) {
      if (peg$currPos < peg$maxFailPos) {
        return;
      }
      if (peg$currPos > peg$maxFailPos) {
        peg$maxFailPos = peg$currPos;
        peg$maxFailExpected = [];
      }
      peg$maxFailExpected.push(expected);
    }
    function peg$buildStructuredError(expected, found, location) {
      return new peg$SyntaxError(
        peg$SyntaxError.buildMessage(expected, found),
        expected,
        found,
        location
      );
    }
    function peg$parsepgn() {
      var s0, s1, s2;
      s0 = peg$currPos;
      s1 = peg$parsetagPairSection();
      s2 = peg$parsemoveTextSection();
      s0 = peg$f0(s1, s2);
      return s0;
    }
    function peg$parsetagPairSection() {
      var s0, s1, s2;
      s0 = peg$currPos;
      s1 = [];
      s2 = peg$parsetagPair();
      while (s2 !== peg$FAILED) {
        s1.push(s2);
        s2 = peg$parsetagPair();
      }
      s2 = peg$parse_();
      s0 = peg$f1(s1);
      return s0;
    }
    function peg$parsetagPair() {
      var s0, s2, s4, s6, s7, s8, s10;
      peg$silentFails++;
      s0 = peg$currPos;
      peg$parse_();
      if (input.charCodeAt(peg$currPos) === 91) {
        s2 = peg$c0;
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e1);
        }
      }
      if (s2 !== peg$FAILED) {
        peg$parse_();
        s4 = peg$parsetagName();
        if (s4 !== peg$FAILED) {
          peg$parse_();
          if (input.charCodeAt(peg$currPos) === 34) {
            s6 = peg$c1;
            peg$currPos++;
          } else {
            s6 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e2);
            }
          }
          if (s6 !== peg$FAILED) {
            s7 = peg$parsetagValue();
            if (input.charCodeAt(peg$currPos) === 34) {
              s8 = peg$c1;
              peg$currPos++;
            } else {
              s8 = peg$FAILED;
              if (peg$silentFails === 0) {
                peg$fail(peg$e2);
              }
            }
            if (s8 !== peg$FAILED) {
              peg$parse_();
              if (input.charCodeAt(peg$currPos) === 93) {
                s10 = peg$c2;
                peg$currPos++;
              } else {
                s10 = peg$FAILED;
                if (peg$silentFails === 0) {
                  peg$fail(peg$e3);
                }
              }
              if (s10 !== peg$FAILED) {
                s0 = peg$f2(s4, s7);
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        if (peg$silentFails === 0) {
          peg$fail(peg$e0);
        }
      }
      return s0;
    }
    function peg$parsetagName() {
      var s0, s1, s2;
      peg$silentFails++;
      s0 = peg$currPos;
      s1 = [];
      s2 = input.charAt(peg$currPos);
      if (peg$r0.test(s2)) {
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e5);
        }
      }
      if (s2 !== peg$FAILED) {
        while (s2 !== peg$FAILED) {
          s1.push(s2);
          s2 = input.charAt(peg$currPos);
          if (peg$r0.test(s2)) {
            peg$currPos++;
          } else {
            s2 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e5);
            }
          }
        }
      } else {
        s1 = peg$FAILED;
      }
      if (s1 !== peg$FAILED) {
        s0 = input.substring(s0, peg$currPos);
      } else {
        s0 = s1;
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e4);
        }
      }
      return s0;
    }
    function peg$parsetagValue() {
      var s0, s1, s2;
      peg$silentFails++;
      s0 = peg$currPos;
      s1 = [];
      s2 = input.charAt(peg$currPos);
      if (peg$r1.test(s2)) {
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e7);
        }
      }
      while (s2 !== peg$FAILED) {
        s1.push(s2);
        s2 = input.charAt(peg$currPos);
        if (peg$r1.test(s2)) {
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e7);
          }
        }
      }
      s0 = input.substring(s0, peg$currPos);
      peg$silentFails--;
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e6);
      }
      return s0;
    }
    function peg$parsemoveTextSection() {
      var s0, s1, s3;
      s0 = peg$currPos;
      s1 = peg$parseline();
      peg$parse_();
      s3 = peg$parsegameTerminationMarker();
      if (s3 === peg$FAILED) {
        s3 = null;
      }
      peg$parse_();
      s0 = peg$f3(s1, s3);
      return s0;
    }
    function peg$parseline() {
      var s0, s1, s2, s3;
      s0 = peg$currPos;
      s1 = peg$parsecomment();
      if (s1 === peg$FAILED) {
        s1 = null;
      }
      s2 = [];
      s3 = peg$parsemove();
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = peg$parsemove();
      }
      s0 = peg$f4(s1, s2);
      return s0;
    }
    function peg$parsemove() {
      var s0, s4, s5, s6, s7, s8, s9, s10;
      s0 = peg$currPos;
      peg$parse_();
      peg$parsemoveNumber();
      peg$parse_();
      s4 = peg$parsesan();
      if (s4 !== peg$FAILED) {
        s5 = peg$parsesuffixAnnotation();
        if (s5 === peg$FAILED) {
          s5 = null;
        }
        s6 = [];
        s7 = peg$parsenag();
        while (s7 !== peg$FAILED) {
          s6.push(s7);
          s7 = peg$parsenag();
        }
        s7 = peg$parse_();
        s8 = peg$parsecomment();
        if (s8 === peg$FAILED) {
          s8 = null;
        }
        s9 = [];
        s10 = peg$parsevariation();
        while (s10 !== peg$FAILED) {
          s9.push(s10);
          s10 = peg$parsevariation();
        }
        s0 = peg$f5(s4, s5, s6, s8, s9);
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      return s0;
    }
    function peg$parsemoveNumber() {
      var s0, s1, s2, s3, s4, s5;
      peg$silentFails++;
      s0 = peg$currPos;
      s1 = [];
      s2 = input.charAt(peg$currPos);
      if (peg$r2.test(s2)) {
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e9);
        }
      }
      while (s2 !== peg$FAILED) {
        s1.push(s2);
        s2 = input.charAt(peg$currPos);
        if (peg$r2.test(s2)) {
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e9);
          }
        }
      }
      if (input.charCodeAt(peg$currPos) === 46) {
        s2 = peg$c3;
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e10);
        }
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$parse_();
        s4 = [];
        s5 = input.charAt(peg$currPos);
        if (peg$r3.test(s5)) {
          peg$currPos++;
        } else {
          s5 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e11);
          }
        }
        while (s5 !== peg$FAILED) {
          s4.push(s5);
          s5 = input.charAt(peg$currPos);
          if (peg$r3.test(s5)) {
            peg$currPos++;
          } else {
            s5 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e11);
            }
          }
        }
        s1 = [s1, s2, s3, s4];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e8);
        }
      }
      return s0;
    }
    function peg$parsesan() {
      var s0, s1, s2, s3, s4, s5;
      peg$silentFails++;
      s0 = peg$currPos;
      s1 = peg$currPos;
      if (input.substr(peg$currPos, 5) === peg$c4) {
        s2 = peg$c4;
        peg$currPos += 5;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e13);
        }
      }
      if (s2 === peg$FAILED) {
        if (input.substr(peg$currPos, 3) === peg$c5) {
          s2 = peg$c5;
          peg$currPos += 3;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e14);
          }
        }
        if (s2 === peg$FAILED) {
          if (input.substr(peg$currPos, 5) === peg$c6) {
            s2 = peg$c6;
            peg$currPos += 5;
          } else {
            s2 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e15);
            }
          }
          if (s2 === peg$FAILED) {
            if (input.substr(peg$currPos, 3) === peg$c7) {
              s2 = peg$c7;
              peg$currPos += 3;
            } else {
              s2 = peg$FAILED;
              if (peg$silentFails === 0) {
                peg$fail(peg$e16);
              }
            }
            if (s2 === peg$FAILED) {
              s2 = peg$currPos;
              s3 = input.charAt(peg$currPos);
              if (peg$r0.test(s3)) {
                peg$currPos++;
              } else {
                s3 = peg$FAILED;
                if (peg$silentFails === 0) {
                  peg$fail(peg$e5);
                }
              }
              if (s3 !== peg$FAILED) {
                s4 = [];
                s5 = input.charAt(peg$currPos);
                if (peg$r4.test(s5)) {
                  peg$currPos++;
                } else {
                  s5 = peg$FAILED;
                  if (peg$silentFails === 0) {
                    peg$fail(peg$e17);
                  }
                }
                if (s5 !== peg$FAILED) {
                  while (s5 !== peg$FAILED) {
                    s4.push(s5);
                    s5 = input.charAt(peg$currPos);
                    if (peg$r4.test(s5)) {
                      peg$currPos++;
                    } else {
                      s5 = peg$FAILED;
                      if (peg$silentFails === 0) {
                        peg$fail(peg$e17);
                      }
                    }
                  }
                } else {
                  s4 = peg$FAILED;
                }
                if (s4 !== peg$FAILED) {
                  s3 = [s3, s4];
                  s2 = s3;
                } else {
                  peg$currPos = s2;
                  s2 = peg$FAILED;
                }
              } else {
                peg$currPos = s2;
                s2 = peg$FAILED;
              }
            }
          }
        }
      }
      if (s2 !== peg$FAILED) {
        s3 = input.charAt(peg$currPos);
        if (peg$r5.test(s3)) {
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e18);
          }
        }
        if (s3 === peg$FAILED) {
          s3 = null;
        }
        s2 = [s2, s3];
        s1 = s2;
      } else {
        peg$currPos = s1;
        s1 = peg$FAILED;
      }
      if (s1 !== peg$FAILED) {
        s0 = input.substring(s0, peg$currPos);
      } else {
        s0 = s1;
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e12);
        }
      }
      return s0;
    }
    function peg$parsesuffixAnnotation() {
      var s0, s1, s2;
      peg$silentFails++;
      s0 = peg$currPos;
      s1 = [];
      s2 = input.charAt(peg$currPos);
      if (peg$r6.test(s2)) {
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e20);
        }
      }
      while (s2 !== peg$FAILED) {
        s1.push(s2);
        if (s1.length >= 2) {
          s2 = peg$FAILED;
        } else {
          s2 = input.charAt(peg$currPos);
          if (peg$r6.test(s2)) {
            peg$currPos++;
          } else {
            s2 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e20);
            }
          }
        }
      }
      if (s1.length < 1) {
        peg$currPos = s0;
        s0 = peg$FAILED;
      } else {
        s0 = s1;
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e19);
        }
      }
      return s0;
    }
    function peg$parsenag() {
      var s0, s2, s3, s4, s5;
      peg$silentFails++;
      s0 = peg$currPos;
      peg$parse_();
      if (input.charCodeAt(peg$currPos) === 36) {
        s2 = peg$c8;
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e22);
        }
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$currPos;
        s4 = [];
        s5 = input.charAt(peg$currPos);
        if (peg$r2.test(s5)) {
          peg$currPos++;
        } else {
          s5 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e9);
          }
        }
        if (s5 !== peg$FAILED) {
          while (s5 !== peg$FAILED) {
            s4.push(s5);
            s5 = input.charAt(peg$currPos);
            if (peg$r2.test(s5)) {
              peg$currPos++;
            } else {
              s5 = peg$FAILED;
              if (peg$silentFails === 0) {
                peg$fail(peg$e9);
              }
            }
          }
        } else {
          s4 = peg$FAILED;
        }
        if (s4 !== peg$FAILED) {
          s3 = input.substring(s3, peg$currPos);
        } else {
          s3 = s4;
        }
        if (s3 !== peg$FAILED) {
          s0 = peg$f6(s3);
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        if (peg$silentFails === 0) {
          peg$fail(peg$e21);
        }
      }
      return s0;
    }
    function peg$parsecomment() {
      var s0;
      s0 = peg$parsebraceComment();
      if (s0 === peg$FAILED) {
        s0 = peg$parserestOfLineComment();
      }
      return s0;
    }
    function peg$parsebraceComment() {
      var s0, s1, s2, s3, s4;
      peg$silentFails++;
      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 123) {
        s1 = peg$c9;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e24);
        }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$currPos;
        s3 = [];
        s4 = input.charAt(peg$currPos);
        if (peg$r7.test(s4)) {
          peg$currPos++;
        } else {
          s4 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e25);
          }
        }
        while (s4 !== peg$FAILED) {
          s3.push(s4);
          s4 = input.charAt(peg$currPos);
          if (peg$r7.test(s4)) {
            peg$currPos++;
          } else {
            s4 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e25);
            }
          }
        }
        s2 = input.substring(s2, peg$currPos);
        if (input.charCodeAt(peg$currPos) === 125) {
          s3 = peg$c10;
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e26);
          }
        }
        if (s3 !== peg$FAILED) {
          s0 = peg$f7(s2);
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e23);
        }
      }
      return s0;
    }
    function peg$parserestOfLineComment() {
      var s0, s1, s2, s3, s4;
      peg$silentFails++;
      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 59) {
        s1 = peg$c11;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e28);
        }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$currPos;
        s3 = [];
        s4 = input.charAt(peg$currPos);
        if (peg$r8.test(s4)) {
          peg$currPos++;
        } else {
          s4 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e29);
          }
        }
        while (s4 !== peg$FAILED) {
          s3.push(s4);
          s4 = input.charAt(peg$currPos);
          if (peg$r8.test(s4)) {
            peg$currPos++;
          } else {
            s4 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e29);
            }
          }
        }
        s2 = input.substring(s2, peg$currPos);
        s0 = peg$f8(s2);
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e27);
        }
      }
      return s0;
    }
    function peg$parsevariation() {
      var s0, s2, s3, s5;
      peg$silentFails++;
      s0 = peg$currPos;
      peg$parse_();
      if (input.charCodeAt(peg$currPos) === 40) {
        s2 = peg$c12;
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e31);
        }
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$parseline();
        if (s3 !== peg$FAILED) {
          peg$parse_();
          if (input.charCodeAt(peg$currPos) === 41) {
            s5 = peg$c13;
            peg$currPos++;
          } else {
            s5 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e32);
            }
          }
          if (s5 !== peg$FAILED) {
            s0 = peg$f9(s3);
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        if (peg$silentFails === 0) {
          peg$fail(peg$e30);
        }
      }
      return s0;
    }
    function peg$parsegameTerminationMarker() {
      var s0, s1, s3;
      peg$silentFails++;
      s0 = peg$currPos;
      if (input.substr(peg$currPos, 3) === peg$c14) {
        s1 = peg$c14;
        peg$currPos += 3;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e34);
        }
      }
      if (s1 === peg$FAILED) {
        if (input.substr(peg$currPos, 3) === peg$c15) {
          s1 = peg$c15;
          peg$currPos += 3;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e35);
          }
        }
        if (s1 === peg$FAILED) {
          if (input.substr(peg$currPos, 7) === peg$c16) {
            s1 = peg$c16;
            peg$currPos += 7;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e36);
            }
          }
          if (s1 === peg$FAILED) {
            if (input.charCodeAt(peg$currPos) === 42) {
              s1 = peg$c17;
              peg$currPos++;
            } else {
              s1 = peg$FAILED;
              if (peg$silentFails === 0) {
                peg$fail(peg$e37);
              }
            }
          }
        }
      }
      if (s1 !== peg$FAILED) {
        peg$parse_();
        s3 = peg$parsecomment();
        if (s3 === peg$FAILED) {
          s3 = null;
        }
        s0 = peg$f10(s1, s3);
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e33);
        }
      }
      return s0;
    }
    function peg$parse_() {
      var s0, s1;
      peg$silentFails++;
      s0 = [];
      s1 = input.charAt(peg$currPos);
      if (peg$r9.test(s1)) {
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e39);
        }
      }
      while (s1 !== peg$FAILED) {
        s0.push(s1);
        s1 = input.charAt(peg$currPos);
        if (peg$r9.test(s1)) {
          peg$currPos++;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e39);
          }
        }
      }
      peg$silentFails--;
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e38);
      }
      return s0;
    }
    peg$result = peg$startRuleFunction();
    if (options.peg$library) {
      return (
        /** @type {any} */
        {
          peg$result,
          peg$currPos,
          peg$FAILED,
          peg$maxFailExpected,
          peg$maxFailPos
        }
      );
    }
    if (peg$result !== peg$FAILED && peg$currPos === input.length) {
      return peg$result;
    } else {
      if (peg$result !== peg$FAILED && peg$currPos < input.length) {
        peg$fail(peg$endExpectation());
      }
      throw peg$buildStructuredError(
        peg$maxFailExpected,
        peg$maxFailPos < input.length ? input.charAt(peg$maxFailPos) : null,
        peg$maxFailPos < input.length ? peg$computeLocation(peg$maxFailPos, peg$maxFailPos + 1) : peg$computeLocation(peg$maxFailPos, peg$maxFailPos)
      );
    }
  }
  const MASK64 = 0xffffffffffffffffn;
  function rotl(x, k) {
    return (x << k | x >> 64n - k) & 0xffffffffffffffffn;
  }
  function wrappingMul(x, y) {
    return x * y & MASK64;
  }
  function xoroshiro128(state) {
    return function() {
      let s0 = BigInt(state & MASK64);
      let s1 = BigInt(state >> 64n & MASK64);
      const result = wrappingMul(rotl(wrappingMul(s0, 5n), 7n), 9n);
      s1 ^= s0;
      s0 = (rotl(s0, 24n) ^ s1 ^ s1 << 16n) & MASK64;
      s1 = rotl(s1, 37n);
      state = s1 << 64n | s0;
      return result;
    };
  }
  const rand = xoroshiro128(0xa187eb39cdcaed8f31c4b365b102e01en);
  const PIECE_KEYS = Array.from({ length: 2 }, () => Array.from({ length: 6 }, () => Array.from({ length: 128 }, () => rand())));
  const EP_KEYS = Array.from({ length: 8 }, () => rand());
  const CASTLING_KEYS = Array.from({ length: 16 }, () => rand());
  const SIDE_KEY = rand();
  const WHITE = "w";
  const BLACK = "b";
  const PAWN = "p";
  const KNIGHT = "n";
  const BISHOP = "b";
  const ROOK = "r";
  const QUEEN = "q";
  const KING = "k";
  const DEFAULT_POSITION = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  class Move {
    color;
    from;
    to;
    piece;
    captured;
    promotion;
    /**
     * @deprecated This field is deprecated and will be removed in version 2.0.0.
     * Please use move descriptor functions instead: `isCapture`, `isPromotion`,
     * `isEnPassant`, `isKingsideCastle`, `isQueensideCastle`, `isCastle`, and
     * `isBigPawn`
     */
    flags;
    san;
    lan;
    before;
    after;
    constructor(chess2, internal) {
      const { color, piece, from, to, flags, captured, promotion } = internal;
      const fromAlgebraic = algebraic(from);
      const toAlgebraic = algebraic(to);
      this.color = color;
      this.piece = piece;
      this.from = fromAlgebraic;
      this.to = toAlgebraic;
      this.san = chess2["_moveToSan"](internal, chess2["_moves"]({ legal: true }));
      this.lan = fromAlgebraic + toAlgebraic;
      this.before = chess2.fen();
      chess2["_makeMove"](internal);
      this.after = chess2.fen();
      chess2["_undoMove"]();
      this.flags = "";
      for (const flag in BITS) {
        if (BITS[flag] & flags) {
          this.flags += FLAGS[flag];
        }
      }
      if (captured) {
        this.captured = captured;
      }
      if (promotion) {
        this.promotion = promotion;
        this.lan += promotion;
      }
    }
    isCapture() {
      return this.flags.indexOf(FLAGS["CAPTURE"]) > -1;
    }
    isPromotion() {
      return this.flags.indexOf(FLAGS["PROMOTION"]) > -1;
    }
    isEnPassant() {
      return this.flags.indexOf(FLAGS["EP_CAPTURE"]) > -1;
    }
    isKingsideCastle() {
      return this.flags.indexOf(FLAGS["KSIDE_CASTLE"]) > -1;
    }
    isQueensideCastle() {
      return this.flags.indexOf(FLAGS["QSIDE_CASTLE"]) > -1;
    }
    isBigPawn() {
      return this.flags.indexOf(FLAGS["BIG_PAWN"]) > -1;
    }
  }
  const EMPTY = -1;
  const FLAGS = {
    NORMAL: "n",
    CAPTURE: "c",
    BIG_PAWN: "b",
    EP_CAPTURE: "e",
    PROMOTION: "p",
    KSIDE_CASTLE: "k",
    QSIDE_CASTLE: "q",
    NULL_MOVE: "-"
  };
  const BITS = {
    NORMAL: 1,
    CAPTURE: 2,
    BIG_PAWN: 4,
    EP_CAPTURE: 8,
    PROMOTION: 16,
    KSIDE_CASTLE: 32,
    QSIDE_CASTLE: 64,
    NULL_MOVE: 128
  };
  const SEVEN_TAG_ROSTER = {
    Event: "?",
    Site: "?",
    Date: "????.??.??",
    Round: "?",
    White: "?",
    Black: "?",
    Result: "*"
  };
  const SUPLEMENTAL_TAGS = {
    WhiteTitle: null,
    BlackTitle: null,
    WhiteElo: null,
    BlackElo: null,
    WhiteUSCF: null,
    BlackUSCF: null,
    WhiteNA: null,
    BlackNA: null,
    WhiteType: null,
    BlackType: null,
    EventDate: null,
    EventSponsor: null,
    Section: null,
    Stage: null,
    Board: null,
    Opening: null,
    Variation: null,
    SubVariation: null,
    ECO: null,
    NIC: null,
    Time: null,
    UTCTime: null,
    UTCDate: null,
    TimeControl: null,
    SetUp: null,
    FEN: null,
    Termination: null,
    Annotator: null,
    Mode: null,
    PlyCount: null
  };
  const HEADER_TEMPLATE = {
    ...SEVEN_TAG_ROSTER,
    ...SUPLEMENTAL_TAGS
  };
  const Ox88 = {
    a8: 0,
    b8: 1,
    c8: 2,
    d8: 3,
    e8: 4,
    f8: 5,
    g8: 6,
    h8: 7,
    a7: 16,
    b7: 17,
    c7: 18,
    d7: 19,
    e7: 20,
    f7: 21,
    g7: 22,
    h7: 23,
    a6: 32,
    b6: 33,
    c6: 34,
    d6: 35,
    e6: 36,
    f6: 37,
    g6: 38,
    h6: 39,
    a5: 48,
    b5: 49,
    c5: 50,
    d5: 51,
    e5: 52,
    f5: 53,
    g5: 54,
    h5: 55,
    a4: 64,
    b4: 65,
    c4: 66,
    d4: 67,
    e4: 68,
    f4: 69,
    g4: 70,
    h4: 71,
    a3: 80,
    b3: 81,
    c3: 82,
    d3: 83,
    e3: 84,
    f3: 85,
    g3: 86,
    h3: 87,
    a2: 96,
    b2: 97,
    c2: 98,
    d2: 99,
    e2: 100,
    f2: 101,
    g2: 102,
    h2: 103,
    a1: 112,
    b1: 113,
    c1: 114,
    d1: 115,
    e1: 116,
    f1: 117,
    g1: 118,
    h1: 119
  };
  const PAWN_OFFSETS = {
    b: [16, 32, 17, 15],
    w: [-16, -32, -17, -15]
  };
  const PIECE_OFFSETS = {
    n: [-18, -33, -31, -14, 18, 33, 31, 14],
    b: [-17, -15, 17, 15],
    r: [-16, 1, 16, -1],
    q: [-17, -16, -15, 1, 17, 16, 15, -1],
    k: [-17, -16, -15, 1, 17, 16, 15, -1]
  };
  const ATTACKS = [
    20,
    0,
    0,
    0,
    0,
    0,
    0,
    24,
    0,
    0,
    0,
    0,
    0,
    0,
    20,
    0,
    0,
    20,
    0,
    0,
    0,
    0,
    0,
    24,
    0,
    0,
    0,
    0,
    0,
    20,
    0,
    0,
    0,
    0,
    20,
    0,
    0,
    0,
    0,
    24,
    0,
    0,
    0,
    0,
    20,
    0,
    0,
    0,
    0,
    0,
    0,
    20,
    0,
    0,
    0,
    24,
    0,
    0,
    0,
    20,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    20,
    0,
    0,
    24,
    0,
    0,
    20,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    20,
    2,
    24,
    2,
    20,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    2,
    53,
    56,
    53,
    2,
    0,
    0,
    0,
    0,
    0,
    0,
    24,
    24,
    24,
    24,
    24,
    24,
    56,
    0,
    56,
    24,
    24,
    24,
    24,
    24,
    24,
    0,
    0,
    0,
    0,
    0,
    0,
    2,
    53,
    56,
    53,
    2,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    20,
    2,
    24,
    2,
    20,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    20,
    0,
    0,
    24,
    0,
    0,
    20,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    20,
    0,
    0,
    0,
    24,
    0,
    0,
    0,
    20,
    0,
    0,
    0,
    0,
    0,
    0,
    20,
    0,
    0,
    0,
    0,
    24,
    0,
    0,
    0,
    0,
    20,
    0,
    0,
    0,
    0,
    20,
    0,
    0,
    0,
    0,
    0,
    24,
    0,
    0,
    0,
    0,
    0,
    20,
    0,
    0,
    20,
    0,
    0,
    0,
    0,
    0,
    0,
    24,
    0,
    0,
    0,
    0,
    0,
    0,
    20
  ];
  const RAYS = [
    17,
    0,
    0,
    0,
    0,
    0,
    0,
    16,
    0,
    0,
    0,
    0,
    0,
    0,
    15,
    0,
    0,
    17,
    0,
    0,
    0,
    0,
    0,
    16,
    0,
    0,
    0,
    0,
    0,
    15,
    0,
    0,
    0,
    0,
    17,
    0,
    0,
    0,
    0,
    16,
    0,
    0,
    0,
    0,
    15,
    0,
    0,
    0,
    0,
    0,
    0,
    17,
    0,
    0,
    0,
    16,
    0,
    0,
    0,
    15,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    17,
    0,
    0,
    16,
    0,
    0,
    15,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    17,
    0,
    16,
    0,
    15,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    17,
    16,
    15,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    0,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    -15,
    -16,
    -17,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    -15,
    0,
    -16,
    0,
    -17,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    -15,
    0,
    0,
    -16,
    0,
    0,
    -17,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    -15,
    0,
    0,
    0,
    -16,
    0,
    0,
    0,
    -17,
    0,
    0,
    0,
    0,
    0,
    0,
    -15,
    0,
    0,
    0,
    0,
    -16,
    0,
    0,
    0,
    0,
    -17,
    0,
    0,
    0,
    0,
    -15,
    0,
    0,
    0,
    0,
    0,
    -16,
    0,
    0,
    0,
    0,
    0,
    -17,
    0,
    0,
    -15,
    0,
    0,
    0,
    0,
    0,
    0,
    -16,
    0,
    0,
    0,
    0,
    0,
    0,
    -17
  ];
  const PIECE_MASKS = { p: 1, n: 2, b: 4, r: 8, q: 16, k: 32 };
  const SYMBOLS = "pnbrqkPNBRQK";
  const PROMOTIONS = [KNIGHT, BISHOP, ROOK, QUEEN];
  const RANK_1 = 7;
  const RANK_2 = 6;
  const RANK_7 = 1;
  const RANK_8 = 0;
  const SIDES = {
    [KING]: BITS.KSIDE_CASTLE,
    [QUEEN]: BITS.QSIDE_CASTLE
  };
  const ROOKS = {
    w: [
      { square: Ox88.a1, flag: BITS.QSIDE_CASTLE },
      { square: Ox88.h1, flag: BITS.KSIDE_CASTLE }
    ],
    b: [
      { square: Ox88.a8, flag: BITS.QSIDE_CASTLE },
      { square: Ox88.h8, flag: BITS.KSIDE_CASTLE }
    ]
  };
  const SECOND_RANK = { b: RANK_7, w: RANK_2 };
  const SAN_NULLMOVE = "--";
  function rank(square) {
    return square >> 4;
  }
  function file(square) {
    return square & 15;
  }
  function isDigit(c) {
    return "0123456789".indexOf(c) !== -1;
  }
  function algebraic(square) {
    const f = file(square);
    const r = rank(square);
    return "abcdefgh".substring(f, f + 1) + "87654321".substring(r, r + 1);
  }
  function swapColor(color) {
    return color === WHITE ? BLACK : WHITE;
  }
  function validateFen(fen) {
    const tokens = fen.split(/\s+/);
    if (tokens.length !== 6) {
      return {
        ok: false,
        error: "Invalid FEN: must contain six space-delimited fields"
      };
    }
    const moveNumber = parseInt(tokens[5], 10);
    if (isNaN(moveNumber) || moveNumber <= 0) {
      return {
        ok: false,
        error: "Invalid FEN: move number must be a positive integer"
      };
    }
    const halfMoves = parseInt(tokens[4], 10);
    if (isNaN(halfMoves) || halfMoves < 0) {
      return {
        ok: false,
        error: "Invalid FEN: half move counter number must be a non-negative integer"
      };
    }
    if (!/^(-|[abcdefgh][36])$/.test(tokens[3])) {
      return { ok: false, error: "Invalid FEN: en-passant square is invalid" };
    }
    if (/[^kKqQ-]/.test(tokens[2])) {
      return { ok: false, error: "Invalid FEN: castling availability is invalid" };
    }
    if (!/^(w|b)$/.test(tokens[1])) {
      return { ok: false, error: "Invalid FEN: side-to-move is invalid" };
    }
    const rows = tokens[0].split("/");
    if (rows.length !== 8) {
      return {
        ok: false,
        error: "Invalid FEN: piece data does not contain 8 '/'-delimited rows"
      };
    }
    for (let i = 0; i < rows.length; i++) {
      let sumFields = 0;
      let previousWasNumber = false;
      for (let k = 0; k < rows[i].length; k++) {
        if (isDigit(rows[i][k])) {
          if (previousWasNumber) {
            return {
              ok: false,
              error: "Invalid FEN: piece data is invalid (consecutive number)"
            };
          }
          sumFields += parseInt(rows[i][k], 10);
          previousWasNumber = true;
        } else {
          if (!/^[prnbqkPRNBQK]$/.test(rows[i][k])) {
            return {
              ok: false,
              error: "Invalid FEN: piece data is invalid (invalid piece)"
            };
          }
          sumFields += 1;
          previousWasNumber = false;
        }
      }
      if (sumFields !== 8) {
        return {
          ok: false,
          error: "Invalid FEN: piece data is invalid (too many squares in rank)"
        };
      }
    }
    if (tokens[3][1] == "3" && tokens[1] == "w" || tokens[3][1] == "6" && tokens[1] == "b") {
      return { ok: false, error: "Invalid FEN: illegal en-passant square" };
    }
    const kings = [
      { color: "white", regex: /K/g },
      { color: "black", regex: /k/g }
    ];
    for (const { color, regex } of kings) {
      if (!regex.test(tokens[0])) {
        return { ok: false, error: `Invalid FEN: missing ${color} king` };
      }
      if ((tokens[0].match(regex) || []).length > 1) {
        return { ok: false, error: `Invalid FEN: too many ${color} kings` };
      }
    }
    if (Array.from(rows[0] + rows[7]).some((char) => char.toUpperCase() === "P")) {
      return {
        ok: false,
        error: "Invalid FEN: some pawns are on the edge rows"
      };
    }
    return { ok: true };
  }
  function getDisambiguator(move, moves) {
    const from = move.from;
    const to = move.to;
    const piece = move.piece;
    let ambiguities = 0;
    let sameRank = 0;
    let sameFile = 0;
    for (let i = 0, len = moves.length; i < len; i++) {
      const ambigFrom = moves[i].from;
      const ambigTo = moves[i].to;
      const ambigPiece = moves[i].piece;
      if (piece === ambigPiece && from !== ambigFrom && to === ambigTo) {
        ambiguities++;
        if (rank(from) === rank(ambigFrom)) {
          sameRank++;
        }
        if (file(from) === file(ambigFrom)) {
          sameFile++;
        }
      }
    }
    if (ambiguities > 0) {
      if (sameRank > 0 && sameFile > 0) {
        return algebraic(from);
      } else if (sameFile > 0) {
        return algebraic(from).charAt(1);
      } else {
        return algebraic(from).charAt(0);
      }
    }
    return "";
  }
  function addMove(moves, color, from, to, piece, captured = void 0, flags = BITS.NORMAL) {
    const r = rank(to);
    if (piece === PAWN && (r === RANK_1 || r === RANK_8)) {
      for (let i = 0; i < PROMOTIONS.length; i++) {
        const promotion = PROMOTIONS[i];
        moves.push({
          color,
          from,
          to,
          piece,
          captured,
          promotion,
          flags: flags | BITS.PROMOTION
        });
      }
    } else {
      moves.push({
        color,
        from,
        to,
        piece,
        captured,
        flags
      });
    }
  }
  function inferPieceType(san) {
    let pieceType = san.charAt(0);
    if (pieceType >= "a" && pieceType <= "h") {
      const matches = san.match(/[a-h]\d.*[a-h]\d/);
      if (matches) {
        return void 0;
      }
      return PAWN;
    }
    pieceType = pieceType.toLowerCase();
    if (pieceType === "o") {
      return KING;
    }
    return pieceType;
  }
  function strippedSan(move) {
    return move.replace(/=/, "").replace(/[+#]?[?!]*$/, "");
  }
  class Chess {
    _board = new Array(128);
    _turn = WHITE;
    _header = {};
    _kings = { w: EMPTY, b: EMPTY };
    _epSquare = -1;
    _halfMoves = 0;
    _moveNumber = 0;
    _history = [];
    _comments = {};
    _castling = { w: 0, b: 0 };
    _hash = 0n;
    // tracks number of times a position has been seen for repetition checking
    _positionCount = /* @__PURE__ */ new Map();
    constructor(fen = DEFAULT_POSITION, { skipValidation = false } = {}) {
      this.load(fen, { skipValidation });
    }
    clear({ preserveHeaders = false } = {}) {
      this._board = new Array(128);
      this._kings = { w: EMPTY, b: EMPTY };
      this._turn = WHITE;
      this._castling = { w: 0, b: 0 };
      this._epSquare = EMPTY;
      this._halfMoves = 0;
      this._moveNumber = 1;
      this._history = [];
      this._comments = {};
      this._header = preserveHeaders ? this._header : { ...HEADER_TEMPLATE };
      this._hash = this._computeHash();
      this._positionCount = /* @__PURE__ */ new Map();
      this._header["SetUp"] = null;
      this._header["FEN"] = null;
    }
    load(fen, { skipValidation = false, preserveHeaders = false } = {}) {
      let tokens = fen.split(/\s+/);
      if (tokens.length >= 2 && tokens.length < 6) {
        const adjustments = ["-", "-", "0", "1"];
        fen = tokens.concat(adjustments.slice(-(6 - tokens.length))).join(" ");
      }
      tokens = fen.split(/\s+/);
      if (!skipValidation) {
        const { ok, error } = validateFen(fen);
        if (!ok) {
          throw new Error(error);
        }
      }
      const position = tokens[0];
      let square = 0;
      this.clear({ preserveHeaders });
      for (let i = 0; i < position.length; i++) {
        const piece = position.charAt(i);
        if (piece === "/") {
          square += 8;
        } else if (isDigit(piece)) {
          square += parseInt(piece, 10);
        } else {
          const color = piece < "a" ? WHITE : BLACK;
          this._put({ type: piece.toLowerCase(), color }, algebraic(square));
          square++;
        }
      }
      this._turn = tokens[1];
      if (tokens[2].indexOf("K") > -1) {
        this._castling.w |= BITS.KSIDE_CASTLE;
      }
      if (tokens[2].indexOf("Q") > -1) {
        this._castling.w |= BITS.QSIDE_CASTLE;
      }
      if (tokens[2].indexOf("k") > -1) {
        this._castling.b |= BITS.KSIDE_CASTLE;
      }
      if (tokens[2].indexOf("q") > -1) {
        this._castling.b |= BITS.QSIDE_CASTLE;
      }
      this._epSquare = tokens[3] === "-" ? EMPTY : Ox88[tokens[3]];
      this._halfMoves = parseInt(tokens[4], 10);
      this._moveNumber = parseInt(tokens[5], 10);
      this._hash = this._computeHash();
      this._updateSetup(fen);
      this._incPositionCount();
    }
    fen({ forceEnpassantSquare = false } = {}) {
      let empty = 0;
      let fen = "";
      for (let i = Ox88.a8; i <= Ox88.h1; i++) {
        if (this._board[i]) {
          if (empty > 0) {
            fen += empty;
            empty = 0;
          }
          const { color, type: piece } = this._board[i];
          fen += color === WHITE ? piece.toUpperCase() : piece.toLowerCase();
        } else {
          empty++;
        }
        if (i + 1 & 136) {
          if (empty > 0) {
            fen += empty;
          }
          if (i !== Ox88.h1) {
            fen += "/";
          }
          empty = 0;
          i += 8;
        }
      }
      let castling = "";
      if (this._castling[WHITE] & BITS.KSIDE_CASTLE) {
        castling += "K";
      }
      if (this._castling[WHITE] & BITS.QSIDE_CASTLE) {
        castling += "Q";
      }
      if (this._castling[BLACK] & BITS.KSIDE_CASTLE) {
        castling += "k";
      }
      if (this._castling[BLACK] & BITS.QSIDE_CASTLE) {
        castling += "q";
      }
      castling = castling || "-";
      let epSquare = "-";
      if (this._epSquare !== EMPTY) {
        if (forceEnpassantSquare) {
          epSquare = algebraic(this._epSquare);
        } else {
          const bigPawnSquare = this._epSquare + (this._turn === WHITE ? 16 : -16);
          const squares = [bigPawnSquare + 1, bigPawnSquare - 1];
          for (const square of squares) {
            if (square & 136) {
              continue;
            }
            const color = this._turn;
            if (this._board[square]?.color === color && this._board[square]?.type === PAWN) {
              this._makeMove({
                color,
                from: square,
                to: this._epSquare,
                piece: PAWN,
                captured: PAWN,
                flags: BITS.EP_CAPTURE
              });
              const isLegal = !this._isKingAttacked(color);
              this._undoMove();
              if (isLegal) {
                epSquare = algebraic(this._epSquare);
                break;
              }
            }
          }
        }
      }
      return [
        fen,
        this._turn,
        castling,
        epSquare,
        this._halfMoves,
        this._moveNumber
      ].join(" ");
    }
    _pieceKey(i) {
      if (!this._board[i]) {
        return 0n;
      }
      const { color, type } = this._board[i];
      const colorIndex = {
        w: 0,
        b: 1
      }[color];
      const typeIndex = {
        p: 0,
        n: 1,
        b: 2,
        r: 3,
        q: 4,
        k: 5
      }[type];
      return PIECE_KEYS[colorIndex][typeIndex][i];
    }
    _epKey() {
      return this._epSquare === EMPTY ? 0n : EP_KEYS[this._epSquare & 7];
    }
    _castlingKey() {
      const index = this._castling.w >> 5 | this._castling.b >> 3;
      return CASTLING_KEYS[index];
    }
    _computeHash() {
      let hash = 0n;
      for (let i = Ox88.a8; i <= Ox88.h1; i++) {
        if (i & 136) {
          i += 7;
          continue;
        }
        if (this._board[i]) {
          hash ^= this._pieceKey(i);
        }
      }
      hash ^= this._epKey();
      hash ^= this._castlingKey();
      if (this._turn === "b") {
        hash ^= SIDE_KEY;
      }
      return hash;
    }
    /*
     * Called when the initial board setup is changed with put() or remove().
     * modifies the SetUp and FEN properties of the header object. If the FEN
     * is equal to the default position, the SetUp and FEN are deleted the setup
     * is only updated if history.length is zero, ie moves haven't been made.
     */
    _updateSetup(fen) {
      if (this._history.length > 0)
        return;
      if (fen !== DEFAULT_POSITION) {
        this._header["SetUp"] = "1";
        this._header["FEN"] = fen;
      } else {
        this._header["SetUp"] = null;
        this._header["FEN"] = null;
      }
    }
    reset() {
      this.load(DEFAULT_POSITION);
    }
    get(square) {
      return this._board[Ox88[square]];
    }
    findPiece(piece) {
      const squares = [];
      for (let i = Ox88.a8; i <= Ox88.h1; i++) {
        if (i & 136) {
          i += 7;
          continue;
        }
        if (!this._board[i] || this._board[i]?.color !== piece.color) {
          continue;
        }
        if (this._board[i].color === piece.color && this._board[i].type === piece.type) {
          squares.push(algebraic(i));
        }
      }
      return squares;
    }
    put({ type, color }, square) {
      if (this._put({ type, color }, square)) {
        this._updateCastlingRights();
        this._updateEnPassantSquare();
        this._updateSetup(this.fen());
        return true;
      }
      return false;
    }
    _set(sq, piece) {
      this._hash ^= this._pieceKey(sq);
      this._board[sq] = piece;
      this._hash ^= this._pieceKey(sq);
    }
    _put({ type, color }, square) {
      if (SYMBOLS.indexOf(type.toLowerCase()) === -1) {
        return false;
      }
      if (!(square in Ox88)) {
        return false;
      }
      const sq = Ox88[square];
      if (type == KING && !(this._kings[color] == EMPTY || this._kings[color] == sq)) {
        return false;
      }
      const currentPieceOnSquare = this._board[sq];
      if (currentPieceOnSquare && currentPieceOnSquare.type === KING) {
        this._kings[currentPieceOnSquare.color] = EMPTY;
      }
      this._set(sq, { type, color });
      if (type === KING) {
        this._kings[color] = sq;
      }
      return true;
    }
    _clear(sq) {
      this._hash ^= this._pieceKey(sq);
      delete this._board[sq];
    }
    remove(square) {
      const piece = this.get(square);
      this._clear(Ox88[square]);
      if (piece && piece.type === KING) {
        this._kings[piece.color] = EMPTY;
      }
      this._updateCastlingRights();
      this._updateEnPassantSquare();
      this._updateSetup(this.fen());
      return piece;
    }
    _updateCastlingRights() {
      this._hash ^= this._castlingKey();
      const whiteKingInPlace = this._board[Ox88.e1]?.type === KING && this._board[Ox88.e1]?.color === WHITE;
      const blackKingInPlace = this._board[Ox88.e8]?.type === KING && this._board[Ox88.e8]?.color === BLACK;
      if (!whiteKingInPlace || this._board[Ox88.a1]?.type !== ROOK || this._board[Ox88.a1]?.color !== WHITE) {
        this._castling.w &= -65;
      }
      if (!whiteKingInPlace || this._board[Ox88.h1]?.type !== ROOK || this._board[Ox88.h1]?.color !== WHITE) {
        this._castling.w &= -33;
      }
      if (!blackKingInPlace || this._board[Ox88.a8]?.type !== ROOK || this._board[Ox88.a8]?.color !== BLACK) {
        this._castling.b &= -65;
      }
      if (!blackKingInPlace || this._board[Ox88.h8]?.type !== ROOK || this._board[Ox88.h8]?.color !== BLACK) {
        this._castling.b &= -33;
      }
      this._hash ^= this._castlingKey();
    }
    _updateEnPassantSquare() {
      if (this._epSquare === EMPTY) {
        return;
      }
      const startSquare = this._epSquare + (this._turn === WHITE ? -16 : 16);
      const currentSquare = this._epSquare + (this._turn === WHITE ? 16 : -16);
      const attackers = [currentSquare + 1, currentSquare - 1];
      if (this._board[startSquare] !== null || this._board[this._epSquare] !== null || this._board[currentSquare]?.color !== swapColor(this._turn) || this._board[currentSquare]?.type !== PAWN) {
        this._hash ^= this._epKey();
        this._epSquare = EMPTY;
        return;
      }
      const canCapture = (square) => !(square & 136) && this._board[square]?.color === this._turn && this._board[square]?.type === PAWN;
      if (!attackers.some(canCapture)) {
        this._hash ^= this._epKey();
        this._epSquare = EMPTY;
      }
    }
    _attacked(color, square, verbose) {
      const attackers = [];
      for (let i = Ox88.a8; i <= Ox88.h1; i++) {
        if (i & 136) {
          i += 7;
          continue;
        }
        if (this._board[i] === void 0 || this._board[i].color !== color) {
          continue;
        }
        const piece = this._board[i];
        const difference = i - square;
        if (difference === 0) {
          continue;
        }
        const index = difference + 119;
        if (ATTACKS[index] & PIECE_MASKS[piece.type]) {
          if (piece.type === PAWN) {
            if (difference > 0 && piece.color === WHITE || difference <= 0 && piece.color === BLACK) {
              if (!verbose) {
                return true;
              } else {
                attackers.push(algebraic(i));
              }
            }
            continue;
          }
          if (piece.type === "n" || piece.type === "k") {
            if (!verbose) {
              return true;
            } else {
              attackers.push(algebraic(i));
              continue;
            }
          }
          const offset = RAYS[index];
          let j = i + offset;
          let blocked = false;
          while (j !== square) {
            if (this._board[j] != null) {
              blocked = true;
              break;
            }
            j += offset;
          }
          if (!blocked) {
            if (!verbose) {
              return true;
            } else {
              attackers.push(algebraic(i));
              continue;
            }
          }
        }
      }
      if (verbose) {
        return attackers;
      } else {
        return false;
      }
    }
    attackers(square, attackedBy) {
      if (!attackedBy) {
        return this._attacked(this._turn, Ox88[square], true);
      } else {
        return this._attacked(attackedBy, Ox88[square], true);
      }
    }
    _isKingAttacked(color) {
      const square = this._kings[color];
      return square === -1 ? false : this._attacked(swapColor(color), square);
    }
    hash() {
      return this._hash.toString(16);
    }
    isAttacked(square, attackedBy) {
      return this._attacked(attackedBy, Ox88[square]);
    }
    isCheck() {
      return this._isKingAttacked(this._turn);
    }
    inCheck() {
      return this.isCheck();
    }
    isCheckmate() {
      return this.isCheck() && this._moves().length === 0;
    }
    isStalemate() {
      return !this.isCheck() && this._moves().length === 0;
    }
    isInsufficientMaterial() {
      const pieces = {
        b: 0,
        n: 0,
        r: 0,
        q: 0,
        k: 0,
        p: 0
      };
      const bishops = [];
      let numPieces = 0;
      let squareColor = 0;
      for (let i = Ox88.a8; i <= Ox88.h1; i++) {
        squareColor = (squareColor + 1) % 2;
        if (i & 136) {
          i += 7;
          continue;
        }
        const piece = this._board[i];
        if (piece) {
          pieces[piece.type] = piece.type in pieces ? pieces[piece.type] + 1 : 1;
          if (piece.type === BISHOP) {
            bishops.push(squareColor);
          }
          numPieces++;
        }
      }
      if (numPieces === 2) {
        return true;
      } else if (
        // k vs. kn .... or .... k vs. kb
        numPieces === 3 && (pieces[BISHOP] === 1 || pieces[KNIGHT] === 1)
      ) {
        return true;
      } else if (numPieces === pieces[BISHOP] + 2) {
        let sum = 0;
        const len = bishops.length;
        for (let i = 0; i < len; i++) {
          sum += bishops[i];
        }
        if (sum === 0 || sum === len) {
          return true;
        }
      }
      return false;
    }
    isThreefoldRepetition() {
      return this._getPositionCount(this._hash) >= 3;
    }
    isDrawByFiftyMoves() {
      return this._halfMoves >= 100;
    }
    isDraw() {
      return this.isDrawByFiftyMoves() || this.isStalemate() || this.isInsufficientMaterial() || this.isThreefoldRepetition();
    }
    isGameOver() {
      return this.isCheckmate() || this.isDraw();
    }
    moves({ verbose = false, square = void 0, piece = void 0 } = {}) {
      const moves = this._moves({ square, piece });
      if (verbose) {
        return moves.map((move) => new Move(this, move));
      } else {
        return moves.map((move) => this._moveToSan(move, moves));
      }
    }
    _moves({ legal = true, piece = void 0, square = void 0 } = {}) {
      const forSquare = square ? square.toLowerCase() : void 0;
      const forPiece = piece?.toLowerCase();
      const moves = [];
      const us = this._turn;
      const them = swapColor(us);
      let firstSquare = Ox88.a8;
      let lastSquare = Ox88.h1;
      let singleSquare = false;
      if (forSquare) {
        if (!(forSquare in Ox88)) {
          return [];
        } else {
          firstSquare = lastSquare = Ox88[forSquare];
          singleSquare = true;
        }
      }
      for (let from = firstSquare; from <= lastSquare; from++) {
        if (from & 136) {
          from += 7;
          continue;
        }
        if (!this._board[from] || this._board[from].color === them) {
          continue;
        }
        const { type } = this._board[from];
        let to;
        if (type === PAWN) {
          if (forPiece && forPiece !== type)
            continue;
          to = from + PAWN_OFFSETS[us][0];
          if (!this._board[to]) {
            addMove(moves, us, from, to, PAWN);
            to = from + PAWN_OFFSETS[us][1];
            if (SECOND_RANK[us] === rank(from) && !this._board[to]) {
              addMove(moves, us, from, to, PAWN, void 0, BITS.BIG_PAWN);
            }
          }
          for (let j = 2; j < 4; j++) {
            to = from + PAWN_OFFSETS[us][j];
            if (to & 136)
              continue;
            if (this._board[to]?.color === them) {
              addMove(moves, us, from, to, PAWN, this._board[to].type, BITS.CAPTURE);
            } else if (to === this._epSquare) {
              addMove(moves, us, from, to, PAWN, PAWN, BITS.EP_CAPTURE);
            }
          }
        } else {
          if (forPiece && forPiece !== type)
            continue;
          for (let j = 0, len = PIECE_OFFSETS[type].length; j < len; j++) {
            const offset = PIECE_OFFSETS[type][j];
            to = from;
            while (true) {
              to += offset;
              if (to & 136)
                break;
              if (!this._board[to]) {
                addMove(moves, us, from, to, type);
              } else {
                if (this._board[to].color === us)
                  break;
                addMove(moves, us, from, to, type, this._board[to].type, BITS.CAPTURE);
                break;
              }
              if (type === KNIGHT || type === KING)
                break;
            }
          }
        }
      }
      if (forPiece === void 0 || forPiece === KING) {
        if (!singleSquare || lastSquare === this._kings[us]) {
          if (this._castling[us] & BITS.KSIDE_CASTLE) {
            const castlingFrom = this._kings[us];
            const castlingTo = castlingFrom + 2;
            if (!this._board[castlingFrom + 1] && !this._board[castlingTo] && !this._attacked(them, this._kings[us]) && !this._attacked(them, castlingFrom + 1) && !this._attacked(them, castlingTo)) {
              addMove(moves, us, this._kings[us], castlingTo, KING, void 0, BITS.KSIDE_CASTLE);
            }
          }
          if (this._castling[us] & BITS.QSIDE_CASTLE) {
            const castlingFrom = this._kings[us];
            const castlingTo = castlingFrom - 2;
            if (!this._board[castlingFrom - 1] && !this._board[castlingFrom - 2] && !this._board[castlingFrom - 3] && !this._attacked(them, this._kings[us]) && !this._attacked(them, castlingFrom - 1) && !this._attacked(them, castlingTo)) {
              addMove(moves, us, this._kings[us], castlingTo, KING, void 0, BITS.QSIDE_CASTLE);
            }
          }
        }
      }
      if (!legal || this._kings[us] === -1) {
        return moves;
      }
      const legalMoves = [];
      for (let i = 0, len = moves.length; i < len; i++) {
        this._makeMove(moves[i]);
        if (!this._isKingAttacked(us)) {
          legalMoves.push(moves[i]);
        }
        this._undoMove();
      }
      return legalMoves;
    }
    move(move, { strict = false } = {}) {
      let moveObj = null;
      if (typeof move === "string") {
        moveObj = this._moveFromSan(move, strict);
      } else if (move === null) {
        moveObj = this._moveFromSan(SAN_NULLMOVE, strict);
      } else if (typeof move === "object") {
        const moves = this._moves();
        for (let i = 0, len = moves.length; i < len; i++) {
          if (move.from === algebraic(moves[i].from) && move.to === algebraic(moves[i].to) && (!("promotion" in moves[i]) || move.promotion === moves[i].promotion)) {
            moveObj = moves[i];
            break;
          }
        }
      }
      if (!moveObj) {
        if (typeof move === "string") {
          throw new Error(`Invalid move: ${move}`);
        } else {
          throw new Error(`Invalid move: ${JSON.stringify(move)}`);
        }
      }
      if (this.isCheck() && moveObj.flags & BITS.NULL_MOVE) {
        throw new Error("Null move not allowed when in check");
      }
      const prettyMove = new Move(this, moveObj);
      this._makeMove(moveObj);
      this._incPositionCount();
      return prettyMove;
    }
    _push(move) {
      this._history.push({
        move,
        kings: { b: this._kings.b, w: this._kings.w },
        turn: this._turn,
        castling: { b: this._castling.b, w: this._castling.w },
        epSquare: this._epSquare,
        halfMoves: this._halfMoves,
        moveNumber: this._moveNumber
      });
    }
    _movePiece(from, to) {
      this._hash ^= this._pieceKey(from);
      this._board[to] = this._board[from];
      delete this._board[from];
      this._hash ^= this._pieceKey(to);
    }
    _makeMove(move) {
      const us = this._turn;
      const them = swapColor(us);
      this._push(move);
      if (move.flags & BITS.NULL_MOVE) {
        if (us === BLACK) {
          this._moveNumber++;
        }
        this._halfMoves++;
        this._turn = them;
        this._epSquare = EMPTY;
        return;
      }
      this._hash ^= this._epKey();
      this._hash ^= this._castlingKey();
      if (move.captured) {
        this._hash ^= this._pieceKey(move.to);
      }
      this._movePiece(move.from, move.to);
      if (move.flags & BITS.EP_CAPTURE) {
        if (this._turn === BLACK) {
          this._clear(move.to - 16);
        } else {
          this._clear(move.to + 16);
        }
      }
      if (move.promotion) {
        this._clear(move.to);
        this._set(move.to, { type: move.promotion, color: us });
      }
      if (this._board[move.to].type === KING) {
        this._kings[us] = move.to;
        if (move.flags & BITS.KSIDE_CASTLE) {
          const castlingTo = move.to - 1;
          const castlingFrom = move.to + 1;
          this._movePiece(castlingFrom, castlingTo);
        } else if (move.flags & BITS.QSIDE_CASTLE) {
          const castlingTo = move.to + 1;
          const castlingFrom = move.to - 2;
          this._movePiece(castlingFrom, castlingTo);
        }
        this._castling[us] = 0;
      }
      if (this._castling[us]) {
        for (let i = 0, len = ROOKS[us].length; i < len; i++) {
          if (move.from === ROOKS[us][i].square && this._castling[us] & ROOKS[us][i].flag) {
            this._castling[us] ^= ROOKS[us][i].flag;
            break;
          }
        }
      }
      if (this._castling[them]) {
        for (let i = 0, len = ROOKS[them].length; i < len; i++) {
          if (move.to === ROOKS[them][i].square && this._castling[them] & ROOKS[them][i].flag) {
            this._castling[them] ^= ROOKS[them][i].flag;
            break;
          }
        }
      }
      this._hash ^= this._castlingKey();
      if (move.flags & BITS.BIG_PAWN) {
        let epSquare;
        if (us === BLACK) {
          epSquare = move.to - 16;
        } else {
          epSquare = move.to + 16;
        }
        if (!(move.to - 1 & 136) && this._board[move.to - 1]?.type === PAWN && this._board[move.to - 1]?.color === them || !(move.to + 1 & 136) && this._board[move.to + 1]?.type === PAWN && this._board[move.to + 1]?.color === them) {
          this._epSquare = epSquare;
          this._hash ^= this._epKey();
        } else {
          this._epSquare = EMPTY;
        }
      } else {
        this._epSquare = EMPTY;
      }
      if (move.piece === PAWN) {
        this._halfMoves = 0;
      } else if (move.flags & (BITS.CAPTURE | BITS.EP_CAPTURE)) {
        this._halfMoves = 0;
      } else {
        this._halfMoves++;
      }
      if (us === BLACK) {
        this._moveNumber++;
      }
      this._turn = them;
      this._hash ^= SIDE_KEY;
    }
    undo() {
      const hash = this._hash;
      const move = this._undoMove();
      if (move) {
        const prettyMove = new Move(this, move);
        this._decPositionCount(hash);
        return prettyMove;
      }
      return null;
    }
    _undoMove() {
      const old = this._history.pop();
      if (old === void 0) {
        return null;
      }
      this._hash ^= this._epKey();
      this._hash ^= this._castlingKey();
      const move = old.move;
      this._kings = old.kings;
      this._turn = old.turn;
      this._castling = old.castling;
      this._epSquare = old.epSquare;
      this._halfMoves = old.halfMoves;
      this._moveNumber = old.moveNumber;
      this._hash ^= this._epKey();
      this._hash ^= this._castlingKey();
      this._hash ^= SIDE_KEY;
      const us = this._turn;
      const them = swapColor(us);
      if (move.flags & BITS.NULL_MOVE) {
        return move;
      }
      this._movePiece(move.to, move.from);
      if (move.piece) {
        this._clear(move.from);
        this._set(move.from, { type: move.piece, color: us });
      }
      if (move.captured) {
        if (move.flags & BITS.EP_CAPTURE) {
          let index;
          if (us === BLACK) {
            index = move.to - 16;
          } else {
            index = move.to + 16;
          }
          this._set(index, { type: PAWN, color: them });
        } else {
          this._set(move.to, { type: move.captured, color: them });
        }
      }
      if (move.flags & (BITS.KSIDE_CASTLE | BITS.QSIDE_CASTLE)) {
        let castlingTo, castlingFrom;
        if (move.flags & BITS.KSIDE_CASTLE) {
          castlingTo = move.to + 1;
          castlingFrom = move.to - 1;
        } else {
          castlingTo = move.to - 2;
          castlingFrom = move.to + 1;
        }
        this._movePiece(castlingFrom, castlingTo);
      }
      return move;
    }
    pgn({ newline = "\n", maxWidth = 0 } = {}) {
      const result = [];
      let headerExists = false;
      for (const i in this._header) {
        const headerTag = this._header[i];
        if (headerTag)
          result.push(`[${i} "${this._header[i]}"]` + newline);
        headerExists = true;
      }
      if (headerExists && this._history.length) {
        result.push(newline);
      }
      const appendComment = (moveString2) => {
        const comment = this._comments[this.fen()];
        if (typeof comment !== "undefined") {
          const delimiter = moveString2.length > 0 ? " " : "";
          moveString2 = `${moveString2}${delimiter}{${comment}}`;
        }
        return moveString2;
      };
      const reversedHistory = [];
      while (this._history.length > 0) {
        reversedHistory.push(this._undoMove());
      }
      const moves = [];
      let moveString = "";
      if (reversedHistory.length === 0) {
        moves.push(appendComment(""));
      }
      while (reversedHistory.length > 0) {
        moveString = appendComment(moveString);
        const move = reversedHistory.pop();
        if (!move) {
          break;
        }
        if (!this._history.length && move.color === "b") {
          const prefix = `${this._moveNumber}. ...`;
          moveString = moveString ? `${moveString} ${prefix}` : prefix;
        } else if (move.color === "w") {
          if (moveString.length) {
            moves.push(moveString);
          }
          moveString = this._moveNumber + ".";
        }
        moveString = moveString + " " + this._moveToSan(move, this._moves({ legal: true }));
        this._makeMove(move);
      }
      if (moveString.length) {
        moves.push(appendComment(moveString));
      }
      moves.push(this._header.Result || "*");
      if (maxWidth === 0) {
        return result.join("") + moves.join(" ");
      }
      const strip = function() {
        if (result.length > 0 && result[result.length - 1] === " ") {
          result.pop();
          return true;
        }
        return false;
      };
      const wrapComment = function(width, move) {
        for (const token of move.split(" ")) {
          if (!token) {
            continue;
          }
          if (width + token.length > maxWidth) {
            while (strip()) {
              width--;
            }
            result.push(newline);
            width = 0;
          }
          result.push(token);
          width += token.length;
          result.push(" ");
          width++;
        }
        if (strip()) {
          width--;
        }
        return width;
      };
      let currentWidth = 0;
      for (let i = 0; i < moves.length; i++) {
        if (currentWidth + moves[i].length > maxWidth) {
          if (moves[i].includes("{")) {
            currentWidth = wrapComment(currentWidth, moves[i]);
            continue;
          }
        }
        if (currentWidth + moves[i].length > maxWidth && i !== 0) {
          if (result[result.length - 1] === " ") {
            result.pop();
          }
          result.push(newline);
          currentWidth = 0;
        } else if (i !== 0) {
          result.push(" ");
          currentWidth++;
        }
        result.push(moves[i]);
        currentWidth += moves[i].length;
      }
      return result.join("");
    }
    /**
     * @deprecated Use `setHeader` and `getHeaders` instead. This method will return null header tags (which is not what you want)
     */
    header(...args) {
      for (let i = 0; i < args.length; i += 2) {
        if (typeof args[i] === "string" && typeof args[i + 1] === "string") {
          this._header[args[i]] = args[i + 1];
        }
      }
      return this._header;
    }
    // TODO: value validation per spec
    setHeader(key, value) {
      this._header[key] = value ?? SEVEN_TAG_ROSTER[key] ?? null;
      return this.getHeaders();
    }
    removeHeader(key) {
      if (key in this._header) {
        this._header[key] = SEVEN_TAG_ROSTER[key] || null;
        return true;
      }
      return false;
    }
    // return only non-null headers (omit placemarker nulls)
    getHeaders() {
      const nonNullHeaders = {};
      for (const [key, value] of Object.entries(this._header)) {
        if (value !== null) {
          nonNullHeaders[key] = value;
        }
      }
      return nonNullHeaders;
    }
    loadPgn(pgn2, { strict = false, newlineChar = "\r?\n" } = {}) {
      if (newlineChar !== "\r?\n") {
        pgn2 = pgn2.replace(new RegExp(newlineChar, "g"), "\n");
      }
      const parsedPgn = peg$parse(pgn2);
      this.reset();
      const headers = parsedPgn.headers;
      let fen = "";
      for (const key in headers) {
        if (key.toLowerCase() === "fen") {
          fen = headers[key];
        }
        this.header(key, headers[key]);
      }
      if (!strict) {
        if (fen) {
          this.load(fen, { preserveHeaders: true });
        }
      } else {
        if (headers["SetUp"] === "1") {
          if (!("FEN" in headers)) {
            throw new Error("Invalid PGN: FEN tag must be supplied with SetUp tag");
          }
          this.load(headers["FEN"], { preserveHeaders: true });
        }
      }
      let node2 = parsedPgn.root;
      while (node2) {
        if (node2.move) {
          const move = this._moveFromSan(node2.move, strict);
          if (move == null) {
            throw new Error(`Invalid move in PGN: ${node2.move}`);
          } else {
            this._makeMove(move);
            this._incPositionCount();
          }
        }
        if (node2.comment !== void 0) {
          this._comments[this.fen()] = node2.comment;
        }
        node2 = node2.variations[0];
      }
      const result = parsedPgn.result;
      if (result && Object.keys(this._header).length && this._header["Result"] !== result) {
        this.setHeader("Result", result);
      }
    }
    /*
     * Convert a move from 0x88 coordinates to Standard Algebraic Notation
     * (SAN)
     *
     * @param {boolean} strict Use the strict SAN parser. It will throw errors
     * on overly disambiguated moves (see below):
     *
     * r1bqkbnr/ppp2ppp/2n5/1B1pP3/4P3/8/PPPP2PP/RNBQK1NR b KQkq - 2 4
     * 4. ... Nge7 is overly disambiguated because the knight on c6 is pinned
     * 4. ... Ne7 is technically the valid SAN
     */
    _moveToSan(move, moves) {
      let output = "";
      if (move.flags & BITS.KSIDE_CASTLE) {
        output = "O-O";
      } else if (move.flags & BITS.QSIDE_CASTLE) {
        output = "O-O-O";
      } else if (move.flags & BITS.NULL_MOVE) {
        return SAN_NULLMOVE;
      } else {
        if (move.piece !== PAWN) {
          const disambiguator = getDisambiguator(move, moves);
          output += move.piece.toUpperCase() + disambiguator;
        }
        if (move.flags & (BITS.CAPTURE | BITS.EP_CAPTURE)) {
          if (move.piece === PAWN) {
            output += algebraic(move.from)[0];
          }
          output += "x";
        }
        output += algebraic(move.to);
        if (move.promotion) {
          output += "=" + move.promotion.toUpperCase();
        }
      }
      this._makeMove(move);
      if (this.isCheck()) {
        if (this.isCheckmate()) {
          output += "#";
        } else {
          output += "+";
        }
      }
      this._undoMove();
      return output;
    }
    // convert a move from Standard Algebraic Notation (SAN) to 0x88 coordinates
    _moveFromSan(move, strict = false) {
      let cleanMove = strippedSan(move);
      if (!strict) {
        if (cleanMove === "0-0") {
          cleanMove = "O-O";
        } else if (cleanMove === "0-0-0") {
          cleanMove = "O-O-O";
        }
      }
      if (cleanMove == SAN_NULLMOVE) {
        const res = {
          color: this._turn,
          from: 0,
          to: 0,
          piece: "k",
          flags: BITS.NULL_MOVE
        };
        return res;
      }
      let pieceType = inferPieceType(cleanMove);
      let moves = this._moves({ legal: true, piece: pieceType });
      for (let i = 0, len = moves.length; i < len; i++) {
        if (cleanMove === strippedSan(this._moveToSan(moves[i], moves))) {
          return moves[i];
        }
      }
      if (strict) {
        return null;
      }
      let piece = void 0;
      let matches = void 0;
      let from = void 0;
      let to = void 0;
      let promotion = void 0;
      let overlyDisambiguated = false;
      matches = cleanMove.match(/([pnbrqkPNBRQK])?([a-h][1-8])x?-?([a-h][1-8])([qrbnQRBN])?/);
      if (matches) {
        piece = matches[1];
        from = matches[2];
        to = matches[3];
        promotion = matches[4];
        if (from.length == 1) {
          overlyDisambiguated = true;
        }
      } else {
        matches = cleanMove.match(/([pnbrqkPNBRQK])?([a-h]?[1-8]?)x?-?([a-h][1-8])([qrbnQRBN])?/);
        if (matches) {
          piece = matches[1];
          from = matches[2];
          to = matches[3];
          promotion = matches[4];
          if (from.length == 1) {
            overlyDisambiguated = true;
          }
        }
      }
      pieceType = inferPieceType(cleanMove);
      moves = this._moves({
        legal: true,
        piece: piece ? piece : pieceType
      });
      if (!to) {
        return null;
      }
      for (let i = 0, len = moves.length; i < len; i++) {
        if (!from) {
          if (cleanMove === strippedSan(this._moveToSan(moves[i], moves)).replace("x", "")) {
            return moves[i];
          }
        } else if ((!piece || piece.toLowerCase() == moves[i].piece) && Ox88[from] == moves[i].from && Ox88[to] == moves[i].to && (!promotion || promotion.toLowerCase() == moves[i].promotion)) {
          return moves[i];
        } else if (overlyDisambiguated) {
          const square = algebraic(moves[i].from);
          if ((!piece || piece.toLowerCase() == moves[i].piece) && Ox88[to] == moves[i].to && (from == square[0] || from == square[1]) && (!promotion || promotion.toLowerCase() == moves[i].promotion)) {
            return moves[i];
          }
        }
      }
      return null;
    }
    ascii() {
      let s = "   +------------------------+\n";
      for (let i = Ox88.a8; i <= Ox88.h1; i++) {
        if (file(i) === 0) {
          s += " " + "87654321"[rank(i)] + " |";
        }
        if (this._board[i]) {
          const piece = this._board[i].type;
          const color = this._board[i].color;
          const symbol = color === WHITE ? piece.toUpperCase() : piece.toLowerCase();
          s += " " + symbol + " ";
        } else {
          s += " . ";
        }
        if (i + 1 & 136) {
          s += "|\n";
          i += 8;
        }
      }
      s += "   +------------------------+\n";
      s += "     a  b  c  d  e  f  g  h";
      return s;
    }
    perft(depth) {
      const moves = this._moves({ legal: false });
      let nodes = 0;
      const color = this._turn;
      for (let i = 0, len = moves.length; i < len; i++) {
        this._makeMove(moves[i]);
        if (!this._isKingAttacked(color)) {
          if (depth - 1 > 0) {
            nodes += this.perft(depth - 1);
          } else {
            nodes++;
          }
        }
        this._undoMove();
      }
      return nodes;
    }
    setTurn(color) {
      if (this._turn == color) {
        return false;
      }
      this.move("--");
      return true;
    }
    turn() {
      return this._turn;
    }
    board() {
      const output = [];
      let row = [];
      for (let i = Ox88.a8; i <= Ox88.h1; i++) {
        if (this._board[i] == null) {
          row.push(null);
        } else {
          row.push({
            square: algebraic(i),
            type: this._board[i].type,
            color: this._board[i].color
          });
        }
        if (i + 1 & 136) {
          output.push(row);
          row = [];
          i += 8;
        }
      }
      return output;
    }
    squareColor(square) {
      if (square in Ox88) {
        const sq = Ox88[square];
        return (rank(sq) + file(sq)) % 2 === 0 ? "light" : "dark";
      }
      return null;
    }
    history({ verbose = false } = {}) {
      const reversedHistory = [];
      const moveHistory = [];
      while (this._history.length > 0) {
        reversedHistory.push(this._undoMove());
      }
      while (true) {
        const move = reversedHistory.pop();
        if (!move) {
          break;
        }
        if (verbose) {
          moveHistory.push(new Move(this, move));
        } else {
          moveHistory.push(this._moveToSan(move, this._moves()));
        }
        this._makeMove(move);
      }
      return moveHistory;
    }
    /*
     * Keeps track of position occurrence counts for the purpose of repetition
     * checking. Old positions are removed from the map if their counts are reduced to 0.
     */
    _getPositionCount(hash) {
      return this._positionCount.get(hash) ?? 0;
    }
    _incPositionCount() {
      this._positionCount.set(this._hash, (this._positionCount.get(this._hash) ?? 0) + 1);
    }
    _decPositionCount(hash) {
      const currentCount = this._positionCount.get(hash) ?? 0;
      if (currentCount === 1) {
        this._positionCount.delete(hash);
      } else {
        this._positionCount.set(hash, currentCount - 1);
      }
    }
    _pruneComments() {
      const reversedHistory = [];
      const currentComments = {};
      const copyComment = (fen) => {
        if (fen in this._comments) {
          currentComments[fen] = this._comments[fen];
        }
      };
      while (this._history.length > 0) {
        reversedHistory.push(this._undoMove());
      }
      copyComment(this.fen());
      while (true) {
        const move = reversedHistory.pop();
        if (!move) {
          break;
        }
        this._makeMove(move);
        copyComment(this.fen());
      }
      this._comments = currentComments;
    }
    getComment() {
      return this._comments[this.fen()];
    }
    setComment(comment) {
      this._comments[this.fen()] = comment.replace("{", "[").replace("}", "]");
    }
    /**
     * @deprecated Renamed to `removeComment` for consistency
     */
    deleteComment() {
      return this.removeComment();
    }
    removeComment() {
      const comment = this._comments[this.fen()];
      delete this._comments[this.fen()];
      return comment;
    }
    getComments() {
      this._pruneComments();
      return Object.keys(this._comments).map((fen) => {
        return { fen, comment: this._comments[fen] };
      });
    }
    /**
     * @deprecated Renamed to `removeComments` for consistency
     */
    deleteComments() {
      return this.removeComments();
    }
    removeComments() {
      this._pruneComments();
      return Object.keys(this._comments).map((fen) => {
        const comment = this._comments[fen];
        delete this._comments[fen];
        return { fen, comment };
      });
    }
    setCastlingRights(color, rights) {
      for (const side of [KING, QUEEN]) {
        if (rights[side] !== void 0) {
          if (rights[side]) {
            this._castling[color] |= SIDES[side];
          } else {
            this._castling[color] &= ~SIDES[side];
          }
        }
      }
      this._updateCastlingRights();
      const result = this.getCastlingRights(color);
      return (rights[KING] === void 0 || rights[KING] === result[KING]) && (rights[QUEEN] === void 0 || rights[QUEEN] === result[QUEEN]);
    }
    getCastlingRights(color) {
      return {
        [KING]: (this._castling[color] & SIDES[KING]) !== 0,
        [QUEEN]: (this._castling[color] & SIDES[QUEEN]) !== 0
      };
    }
    moveNumber() {
      return this._moveNumber;
    }
  }
  const CHESS_LOCATION_ID = "uruc.chess.chess-club";
  const CHESS_COMMAND = (id) => `uruc.chess.${id}@v1`;
  const FILES_WHITE = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const FILES_BLACK = ["h", "g", "f", "e", "d", "c", "b", "a"];
  const RANKS_WHITE = ["8", "7", "6", "5", "4", "3", "2", "1"];
  const RANKS_BLACK = ["1", "2", "3", "4", "5", "6", "7", "8"];
  const PREVIEW_FEN = new Chess().fen();
  const DEFAULT_RATING = 1500;
  const DEFAULT_CLOCK_MS = 10 * 60 * 1e3;
  const INITIAL_COUNTS = {
    w: { k: 1, q: 1, r: 2, b: 2, n: 2, p: 8 },
    b: { k: 1, q: 1, r: 2, b: 2, n: 2, p: 8 }
  };
  const EMPTY_CAPTURED = { white: [], black: [] };
  const EMPTY_DERIVED = { moveList: [], lastMove: null, capturedPieces: EMPTY_CAPTURED };
  const INITIAL_VIEW_STATE = {
    syncState: "idle",
    lobbyVersion: 0,
    joinableMatches: [],
    currentMatch: null,
    moveList: [],
    lastMove: null,
    capturedPieces: EMPTY_CAPTURED,
    rating: null,
    leaderboard: []
  };
  function parseFenBoard(fen) {
    const empty = Array.from({ length: 8 }, () => Array(8).fill(""));
    if (!fen) return empty;
    const rows = fen.split(" ")[0]?.split("/");
    if (!rows || rows.length !== 8) return empty;
    for (let row = 0; row < rows.length; row++) {
      const cells = [];
      for (const token of rows[row]) {
        if (/\d/.test(token)) {
          const count = Number.parseInt(token, 10);
          for (let i = 0; i < count; i++) cells.push("");
        } else {
          cells.push(token);
        }
      }
      if (cells.length === 8) empty[row] = cells;
    }
    return empty;
  }
  function pieceColor(piece) {
    if (!piece) return null;
    return piece === piece.toUpperCase() ? "w" : "b";
  }
  function pieceAtSquare(board, square) {
    const file2 = square.charCodeAt(0) - 97;
    const rank2 = Number.parseInt(square[1], 10);
    const row = 8 - rank2;
    return board[row]?.[file2] ?? "";
  }
  function formatClock(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1e3));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  function isPromotionCandidate(piece, targetSquare) {
    if (piece === "P") return targetSquare.endsWith("8");
    if (piece === "p") return targetSquare.endsWith("1");
    return false;
  }
  function findPlayer(state, color) {
    return state?.players.find((player) => player.color === color) ?? null;
  }
  function findPlayerByAgentId(state, agentId) {
    if (!state || !agentId) return null;
    return state.players.find((player) => player.agentId === agentId) ?? null;
  }
  function compareMatchSnapshot(current, next) {
    if (!current || current.matchId !== next.matchId) return 1;
    if (next.seq > current.seq) return 1;
    if (next.seq < current.seq) return -1;
    if (next.serverTimestamp > current.serverTimestamp) return 1;
    if (next.serverTimestamp < current.serverTimestamp) return -1;
    return 0;
  }
  function formatReason(reason) {
    const labels = {
      checkmate: i18n.t("play:chess.reasons.checkmate"),
      timeout: i18n.t("play:chess.reasons.timeout"),
      resignation: i18n.t("play:chess.reasons.resignation"),
      draw_agreement: i18n.t("play:chess.reasons.draw_agreement"),
      stalemate: i18n.t("play:chess.reasons.stalemate"),
      threefold_repetition: i18n.t("play:chess.reasons.threefold_repetition"),
      fifty_move_rule: i18n.t("play:chess.reasons.fifty_move_rule"),
      insufficient_material: i18n.t("play:chess.reasons.insufficient_material"),
      disconnect_timeout: i18n.t("play:chess.reasons.disconnect_timeout"),
      draw: i18n.t("play:chess.reasons.draw")
    };
    return labels[reason] ?? reason;
  }
  function formatTurnLabel(turn) {
    if (turn === "w") return i18n.t("play:chess.turn.white");
    if (turn === "b") return i18n.t("play:chess.turn.black");
    return i18n.t("play:chess.turn.waiting");
  }
  function formatPositionSummary(state) {
    if (state.phase === "waiting") {
      return i18n.t("play:chess.position.waiting", { count: state.players.length });
    }
    if (state.result) {
      const outcome = state.result.result === "draw" ? i18n.t("play:chess.position.draw") : state.result.result === "white_win" ? i18n.t("play:chess.position.whiteWin") : i18n.t("play:chess.position.blackWin");
      return `${outcome} · ${formatReason(state.result.reason)}`;
    }
    if (state.moveCount === 0) {
      return i18n.t("play:chess.position.standardOpening", { turn: formatTurnLabel(state.turn) });
    }
    return `${i18n.t("play:chess.position.moveLine", { count: state.moveCount, turn: formatTurnLabel(state.turn) })}${state.inCheck ? i18n.t("play:chess.position.inCheckSuffix") : ""}`;
  }
  function sortMatches(matches) {
    return [...matches].sort((a, b) => b.createdAt - a.createdAt || a.matchId.localeCompare(b.matchId));
  }
  function sortRooms(rooms) {
    const phaseOrder = {
      waiting: 0,
      playing: 1,
      finished: 2
    };
    return [...rooms].sort((a, b) => {
      const phaseDelta = phaseOrder[a.phase] - phaseOrder[b.phase];
      if (phaseDelta !== 0) return phaseDelta;
      return b.createdAt - a.createdAt || a.matchId.localeCompare(b.matchId);
    });
  }
  function reduceLobby(matches, delta) {
    if (delta.kind === "room_removed") {
      return matches.filter((match) => match.matchId !== delta.matchId);
    }
    if (!delta.room) return matches;
    const next = matches.filter((match) => match.matchId !== delta.matchId);
    next.push(delta.room);
    return sortMatches(next);
  }
  function roomSummaryFromState(current, state, spectatorCount) {
    return {
      matchId: state.matchId,
      roomName: state.roomName,
      visibility: state.visibility,
      phase: state.phase,
      playerCount: state.players.length,
      seatsRemaining: Math.max(0, 2 - state.players.length),
      readyCount: state.players.filter((player) => player.ready).length,
      spectatorCount: spectatorCount ?? current?.spectatorCount ?? 0,
      players: state.players.map((player) => ({
        agentId: player.agentId,
        agentName: player.agentName,
        ready: player.ready,
        connected: player.connected
      })),
      createdAt: current?.createdAt ?? Date.now()
    };
  }
  function chessReducer(state, action) {
    switch (action.type) {
      case "reset":
        return INITIAL_VIEW_STATE;
      case "sync_started":
        return { ...state, syncState: action.value };
      case "bootstrap_loaded":
        return {
          syncState: "synced",
          lobbyVersion: action.payload.lobbyVersion,
          joinableMatches: sortMatches(action.payload.joinableMatches),
          currentMatch: action.payload.currentMatch,
          moveList: action.derived.moveList,
          lastMove: action.derived.lastMove,
          capturedPieces: action.derived.capturedPieces,
          rating: action.payload.rating,
          leaderboard: action.payload.leaderboard
        };
      case "match_snapshot":
        return {
          ...state,
          syncState: "synced",
          currentMatch: action.match,
          moveList: action.derived.moveList,
          lastMove: action.derived.lastMove,
          capturedPieces: action.derived.capturedPieces,
          rating: action.rating
        };
      case "match_cleared":
        return {
          ...state,
          currentMatch: null,
          moveList: [],
          lastMove: null,
          capturedPieces: EMPTY_CAPTURED
        };
      case "lobby_delta":
        if (action.payload.version <= state.lobbyVersion) return state;
        return {
          ...state,
          lobbyVersion: action.payload.version,
          joinableMatches: reduceLobby(state.joinableMatches, action.payload)
        };
      case "match_delta":
        return {
          ...state,
          syncState: "synced",
          currentMatch: action.match,
          moveList: action.derived.moveList,
          lastMove: action.derived.lastMove,
          capturedPieces: action.derived.capturedPieces,
          rating: action.rating
        };
      default:
        return state;
    }
  }
  function buildEngineFromState(matchState) {
    if (!matchState) return { chess: null, derived: EMPTY_DERIVED };
    const chess2 = new Chess();
    const pgn2 = matchState.pgn.trim();
    if (pgn2) {
      chess2.loadPgn(pgn2);
    } else if (matchState.fen && matchState.fen !== chess2.fen()) {
      chess2.load(matchState.fen);
    }
    const history = chess2.history({ verbose: true });
    const moveList = history.map((move, index) => ({
      ply: index + 1,
      moveNumber: Math.floor(index / 2) + 1,
      color: move.color,
      san: move.san,
      from: move.from,
      to: move.to,
      promotion: move.promotion ?? null
    }));
    const counts = {
      w: { k: 0, q: 0, r: 0, b: 0, n: 0, p: 0 },
      b: { k: 0, q: 0, r: 0, b: 0, n: 0, p: 0 }
    };
    for (const row of chess2.board()) {
      for (const piece of row) {
        if (!piece) continue;
        counts[piece.color][piece.type] += 1;
      }
    }
    const capturedPieces = {
      white: buildCapturedGlyphs("w", counts.w),
      black: buildCapturedGlyphs("b", counts.b)
    };
    const lastMove = moveList.length > 0 ? { from: moveList[moveList.length - 1].from, to: moveList[moveList.length - 1].to } : null;
    return {
      chess: chess2,
      derived: {
        moveList,
        lastMove,
        capturedPieces
      }
    };
  }
  function buildCapturedGlyphs(color, counts) {
    const order = ["q", "r", "b", "n", "p"];
    const pieces = [];
    for (const pieceType of order) {
      const missing = INITIAL_COUNTS[color][pieceType] - (counts[pieceType] ?? 0);
      for (let index = 0; index < missing; index++) {
        pieces.push(color === "w" ? pieceType.toUpperCase() : pieceType);
      }
    }
    return pieces;
  }
  function applyMatchResultToRating(rating, currentMatch, nextMatch) {
    if (!rating || !nextMatch?.result || !nextMatch.yourAgentId) return rating;
    if (currentMatch?.result?.endedAt === nextMatch.result.endedAt) return rating;
    const delta = nextMatch.result.ratingChanges[nextMatch.yourAgentId];
    if (typeof delta !== "number") return rating;
    const didWin = nextMatch.result.winnerAgentId === nextMatch.yourAgentId;
    const didDraw = nextMatch.result.result === "draw";
    return {
      ...rating,
      rating: rating.rating + delta,
      gamesPlayed: rating.gamesPlayed + 1,
      wins: rating.wins + (didWin ? 1 : 0),
      losses: rating.losses + (!didWin && !didDraw ? 1 : 0),
      draws: rating.draws + (didDraw ? 1 : 0),
      updatedAt: nextMatch.result.endedAt
    };
  }
  function groupMoves(moveList) {
    const rows = [];
    for (let index = 0; index < moveList.length; index += 2) {
      rows.push({
        moveNumber: moveList[index].moveNumber,
        white: moveList[index] ?? null,
        black: moveList[index + 1] ?? null
      });
    }
    return rows;
  }
  function formatResultTitle(result) {
    if (result.result === "draw") return i18n.t("play:chess.result.draw");
    return result.result === "white_win" ? i18n.t("play:chess.result.whiteWin") : i18n.t("play:chess.result.blackWin");
  }
  function agentNameLabel(agentName, fallback) {
    return agentName && agentName.trim() !== "" ? agentName : fallback;
  }
  function agentMonogram(name) {
    const label = (name ?? "").trim();
    if (!label) return "AI";
    return label.split(/\s+/).slice(0, 2).map((token) => token[0]?.toUpperCase() ?? "").join("").slice(0, 2);
  }
  function visibilityLabel(visibility) {
    return visibility === "private" ? i18n.t("play:chess.page.visibilityPrivate") : i18n.t("play:chess.page.visibilityPublic");
  }
  function ChessPieceIcon({ piece, className }) {
    const isWhite = piece === piece.toUpperCase();
    const type = piece.toLowerCase();
    const fill = isWhite ? "var(--chess-piece-white-fill)" : "var(--chess-piece-black-fill)";
    const stroke = isWhite ? "var(--chess-piece-white-stroke)" : "var(--chess-piece-black-stroke)";
    return /* @__PURE__ */ jsxRuntime.jsxs("svg", { viewBox: "0 0 80 80", className, "aria-hidden": "true", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("g", { fill, stroke, strokeWidth: "3.4", strokeLinecap: "round", strokeLinejoin: "round", children: [
        type === "p" ? /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
          /* @__PURE__ */ jsxRuntime.jsx("circle", { cx: "40", cy: "18", r: "8.5" }),
          /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M31 42c0-8 4.5-13 9-13s9 5 9 13v5H31z" }),
          /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M24 55c4-5.5 9.5-8.5 16-8.5S52 49.5 56 55" }),
          /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M22 61h36" }),
          /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M26 67h28" })
        ] }) : null,
        type === "r" ? /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
          /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M22 17h36v9H22z" }),
          /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M24 17v-6h7v6M36.5 17v-6h7v6M49 17v-6h7v6" }),
          /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M29 26h22v25H29z" }),
          /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M26 52h28" }),
          /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M22 60h36" }),
          /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M26 67h28" })
        ] }) : null,
        type === "n" ? /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
          /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M25 66h31" }),
          /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M21 59h39" }),
          /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M31 59c-1-11 1.5-21 8.5-30l-5.5-10 12.5 4c9 2.5 15 9.5 16.5 17-7-1.2-12.5 1-15.5 5.5l7.5 13.5H31z" }),
          /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M39 22c3.5-4.5 9-7 15.5-7" })
        ] }) : null,
        type === "b" ? /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
          /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M40 13l7 9-7 9-7-9z" }),
          /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M40 13v18" }),
          /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M30 45c0-10 4.5-16 10-16s10 6 10 16v4H30z" }),
          /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M24 57c4.5-5.5 10-8.5 16-8.5s11.5 3 16 8.5" }),
          /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M22 63h36" }),
          /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M26 69h28" })
        ] }) : null,
        type === "q" ? /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
          /* @__PURE__ */ jsxRuntime.jsx("circle", { cx: "26", cy: "16", r: "4" }),
          /* @__PURE__ */ jsxRuntime.jsx("circle", { cx: "40", cy: "12", r: "4.5" }),
          /* @__PURE__ */ jsxRuntime.jsx("circle", { cx: "54", cy: "16", r: "4" }),
          /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M23 43l4-18 13 10 13-10 4 18z" }),
          /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M28 43h24v11H28z" }),
          /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M22 58c5-4.5 11-7 18-7s13 2.5 18 7" }),
          /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M20 64h40" }),
          /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M24 70h32" })
        ] }) : null,
        type === "k" ? /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
          /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M40 10v15" }),
          /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M33 17.5h14" }),
          /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M31 34c0-7 4-12 9-12s9 5 9 12v14H31z" }),
          /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M24 55c5-5.5 10.5-8.5 16-8.5S51 49.5 56 55" }),
          /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M20 62h40" }),
          /* @__PURE__ */ jsxRuntime.jsx("path", { d: "M24 68h32" })
        ] }) : null
      ] }),
      type === "n" ? /* @__PURE__ */ jsxRuntime.jsx("circle", { cx: "48", cy: "31", r: "2.8", fill: stroke, stroke: "none" }) : null
    ] });
  }
  function ChessPage() {
    const { t } = reactI18next.useTranslation(["play", "nav"]);
    const runtime = frontendReact.usePluginRuntime();
    const { connectedAgent } = frontendReact.usePluginAgent();
    const navigate = reactRouterDom.useNavigate();
    const [viewState, dispatch] = react.useReducer(chessReducer, INITIAL_VIEW_STATE);
    const viewStateRef = react.useRef(viewState);
    viewStateRef.current = viewState;
    const [errorText, setErrorText] = react.useState("");
    const [busyCommand, setBusyCommand] = react.useState("");
    const [selectedSquare, setSelectedSquare] = react.useState(null);
    const initialClockNow = performance.now();
    const [clockTick, setClockTick] = react.useState(initialClockNow);
    const [currentClockAnchor, setCurrentClockAnchor] = react.useState(initialClockNow);
    const [inspectedClockAnchor, setInspectedClockAnchor] = react.useState(initialClockNow);
    const [promotionRequest, setPromotionRequest] = react.useState(null);
    const [dragSquare, setDragSquare] = react.useState(null);
    const [workspaceTab, setWorkspaceTab] = react.useState("new-game");
    const [roomDirectory, setRoomDirectory] = react.useState([]);
    const [roomDirectoryVersion, setRoomDirectoryVersion] = react.useState(0);
    const [inspectedRoom, setInspectedRoom] = react.useState(null);
    const [selectedRoomId, setSelectedRoomId] = react.useState(null);
    const [roomDetailOpen, setRoomDetailOpen] = react.useState(false);
    const [roomSearchText, setRoomSearchText] = react.useState("");
    const [activeRoomQuery, setActiveRoomQuery] = react.useState("");
    const [roomDirectoryBusy, setRoomDirectoryBusy] = react.useState(false);
    const [createRoomName, setCreateRoomName] = react.useState("");
    const [createRoomVisibility, setCreateRoomVisibility] = react.useState("public");
    const [resultOverlay, setResultOverlay] = react.useState(null);
    const [orbExpanded, setOrbExpanded] = react.useState(false);
    const [orbPosition, setOrbPosition] = react.useState({ x: 24, y: 160 });
    const [orbDragging, setOrbDragging] = react.useState(false);
    const matchEngineRef = react.useRef(null);
    const inspectedRoomRef = react.useRef(inspectedRoom);
    inspectedRoomRef.current = inspectedRoom;
    const activeRoomQueryRef = react.useRef(activeRoomQuery);
    activeRoomQueryRef.current = activeRoomQuery;
    const roomsAutoFetchAttemptedRef = react.useRef(false);
    const bootstrapRefreshJobRef = react.useRef({
      timer: null,
      inFlight: false,
      rerun: false,
      pendingMode: "resyncing"
    });
    const roomDirectoryRefreshJobRef = react.useRef({
      timer: null,
      inFlight: false,
      rerun: false
    });
    const matchRefreshJobRef = react.useRef({
      timer: null,
      inFlight: false,
      rerun: false,
      matchId: null
    });
    const watchedRoomRefreshJobRef = react.useRef({
      timer: null,
      inFlight: false,
      rerun: false,
      matchId: null,
      spectatorCount: null
    });
    const orbRef = react.useRef(null);
    const shownResultOverlaySignatureRef = react.useRef(null);
    const orbPointerRef = react.useRef(null);
    const clampOrbPosition = (nextX, nextY) => {
      if (typeof window === "undefined") return { x: nextX, y: nextY };
      const rect = orbRef.current?.getBoundingClientRect();
      const width = rect?.width ?? (orbExpanded ? 232 : 72);
      const height = rect?.height ?? (orbExpanded ? 220 : 72);
      const inset = 14;
      const maxX = Math.max(inset, window.innerWidth - width - inset);
      const maxY = Math.max(inset, window.innerHeight - height - inset);
      return {
        x: Math.min(Math.max(inset, nextX), maxX),
        y: Math.min(Math.max(inset, nextY), maxY)
      };
    };
    const waitingActionLabel = viewState.currentMatch?.phase === "waiting" && (viewState.currentMatch.players.length ?? 0) <= 1 ? t("chess.commands.closeRoom") : t("chess.commands.leaveRoom");
    const canCreateOrJoin = !viewState.currentMatch || viewState.currentMatch.phase === "finished";
    const currentMatch = viewState.currentMatch;
    const inspectedDerived = react.useMemo(
      () => buildEngineFromState(inspectedRoom?.state).derived,
      [inspectedRoom?.state]
    );
    const boardMatch = workspaceTab === "rooms" && inspectedRoom ? inspectedRoom.state : currentMatch;
    const boardDerived = workspaceTab === "rooms" && inspectedRoom ? inspectedDerived : {
      moveList: viewState.moveList,
      lastMove: viewState.lastMove,
      capturedPieces: viewState.capturedPieces
    };
    const boardMatchIsCurrent = !!boardMatch && !!currentMatch && boardMatch.matchId === currentMatch.matchId;
    const resolvedOrientation = boardMatchIsCurrent && boardMatch?.yourColor === "b" ? "black" : "white";
    const boardFiles = resolvedOrientation === "white" ? FILES_WHITE : FILES_BLACK;
    const boardRanks = resolvedOrientation === "white" ? RANKS_WHITE : RANKS_BLACK;
    const currentBoardMatrix = react.useMemo(() => parseFenBoard(currentMatch?.fen), [currentMatch?.fen]);
    const boardMatrix = react.useMemo(() => parseFenBoard(boardMatch?.fen), [boardMatch?.fen]);
    const previewBoardMatrix = react.useMemo(() => parseFenBoard(PREVIEW_FEN), []);
    const yourTurn = boardMatchIsCurrent && currentMatch?.phase === "playing" && !!currentMatch.yourColor && currentMatch.turn === currentMatch.yourColor;
    const groupedMoveRows = react.useMemo(() => groupMoves(boardDerived.moveList), [boardDerived.moveList]);
    const latestMovePly = boardDerived.moveList.length > 0 ? boardDerived.moveList[boardDerived.moveList.length - 1].ply : null;
    const activeResultOverlay = resultOverlay && boardMatch && resultOverlay.matchId === boardMatch.matchId ? resultOverlay : null;
    const getPieceAtSquare = (square) => {
      if (!currentMatch?.fen) return "";
      return pieceAtSquare(currentBoardMatrix, square);
    };
    const resetCurrentClock = (value = performance.now()) => {
      setCurrentClockAnchor(value);
      setClockTick(value);
    };
    const resetInspectedClock = (value = performance.now()) => {
      setInspectedClockAnchor(value);
      setClockTick(value);
    };
    const syncMatchSnapshot = (match, nextRating = viewStateRef.current.rating) => {
      const { chess: chess2, derived } = buildEngineFromState(match);
      matchEngineRef.current = chess2;
      dispatch({ type: "match_snapshot", match, derived, rating: nextRating });
      setSelectedSquare(null);
      setPromotionRequest(null);
      setDragSquare(null);
      resetCurrentClock();
    };
    const showResultOverlay = react.useEffectEvent((match) => {
      if (!match?.result) return;
      const signature = `${match.matchId}:${match.result.endedAt}`;
      if (shownResultOverlaySignatureRef.current === signature) return;
      shownResultOverlaySignatureRef.current = signature;
      setResultOverlay((current) => {
        if (current?.signature === signature) return current;
        return {
          signature,
          matchId: match.matchId,
          roomName: match.roomName,
          result: match.result,
          yourAgentId: match.yourAgentId
        };
      });
    });
    const syncInspectedRoomSnapshot = (summary, match) => {
      const currentInspected = inspectedRoomRef.current;
      const snapshotOrder = compareMatchSnapshot(currentInspected?.state, match);
      const baseState = snapshotOrder < 0 && currentInspected?.state ? currentInspected.state : match;
      setInspectedRoom({
        summary: roomSummaryFromState(summary, baseState, summary.spectatorCount),
        state: baseState
      });
      setSelectedRoomId(summary.matchId);
      setSelectedSquare(null);
      setPromotionRequest(null);
      setDragSquare(null);
      if (snapshotOrder > 0) {
        resetInspectedClock();
      }
    };
    const clearInspectedRoomSnapshot = () => {
      setInspectedRoom(null);
      setSelectedRoomId(null);
      setRoomDetailOpen(false);
    };
    const applyBootstrapPayload = (payload) => {
      const { chess: chess2, derived } = buildEngineFromState(payload.currentMatch);
      matchEngineRef.current = chess2;
      dispatch({ type: "bootstrap_loaded", payload, derived });
      setSelectedSquare(null);
      setPromotionRequest(null);
      setDragSquare(null);
      resetCurrentClock();
    };
    const acquireActionLeaseIfNeeded = async () => {
      const snapshot = await runtime.refreshSessionState();
      if (snapshot.isActionLeaseHolder) return snapshot;
      if (snapshot.hasActionLease && !window.confirm(t("chess.runtime.confirmActionLease"))) {
        throw new Error(t("chess.runtime.noActionLease"));
      }
      return runtime.acquireActionLease();
    };
    const ensureChessReady = async () => {
      if (!connectedAgent) {
        throw new Error(t("runtime:websocket.missingShadowAgent"));
      }
      if (!runtime.isConnected) {
        await runtime.connect();
      }
      const snapshot = await acquireActionLeaseIfNeeded();
      if (!snapshot.inCity) {
        await runtime.enterCity();
      }
      const nextSnapshot = await runtime.refreshSessionState();
      if (nextSnapshot.currentLocation !== CHESS_LOCATION_ID) {
        await runtime.enterLocation(CHESS_LOCATION_ID);
      }
    };
    const refreshRooms = async (query = activeRoomQueryRef.current, options) => {
      const trimmed = query.trim();
      if (!options?.silent) {
        setRoomDirectoryBusy(true);
        setErrorText("");
      }
      try {
        if (!options?.skipReady) {
          await ensureChessReady();
        }
        const payload = await runtime.sendCommand(CHESS_COMMAND("list_rooms"), {
          query: trimmed || void 0,
          limit: 40
        });
        setRoomDirectory(sortRooms(payload.rooms));
        setRoomDirectoryVersion(payload.directoryVersion);
        setActiveRoomQuery(trimmed);
        setInspectedRoom((current) => {
          if (!current) return current;
          const nextSummary = payload.rooms.find((room) => room.matchId === current.summary.matchId);
          return nextSummary ? { ...current, summary: nextSummary } : current;
        });
      } catch (err) {
        if (!options?.silent) {
          setErrorText(err instanceof Error ? err.message : t("chess.runtime.syncFailed"));
        }
      } finally {
        if (!options?.silent) {
          setRoomDirectoryBusy(false);
        }
      }
    };
    const stopWatchingRooms = async (options) => {
      const currentInspected = inspectedRoomRef.current;
      if (!currentInspected) {
        if (options?.clearSelection) clearInspectedRoomSnapshot();
        return;
      }
      try {
        await runtime.sendCommand(CHESS_COMMAND("unwatch_room"), { matchId: currentInspected.summary.matchId });
      } catch {
      } finally {
        if (options?.clearSelection !== false) {
          clearInspectedRoomSnapshot();
        }
      }
    };
    const refreshBootstrap = async (mode = "resyncing") => {
      dispatch({ type: "sync_started", value: mode });
      try {
        await ensureChessReady();
        const payload = await runtime.sendCommand(CHESS_COMMAND("bootstrap"), { limit: 20 });
        applyBootstrapPayload(payload);
        setErrorText("");
      } catch (err) {
        setErrorText(err instanceof Error ? err.message : t("chess.runtime.syncFailed"));
      }
    };
    const resyncCurrentMatch = async (matchId) => {
      try {
        dispatch({ type: "sync_started", value: "resyncing" });
        const state = await runtime.sendCommand(CHESS_COMMAND("state"), matchId ? { matchId } : void 0);
        const nextRating = applyMatchResultToRating(viewStateRef.current.rating, viewStateRef.current.currentMatch, state);
        syncMatchSnapshot(state, nextRating);
        setErrorText("");
      } catch {
        await refreshBootstrap("resyncing");
      }
    };
    const resyncWatchedRoom = async (matchId, spectatorCount) => {
      try {
        const state = await runtime.sendCommand(CHESS_COMMAND("state"), { matchId });
        const currentInspected = inspectedRoomRef.current;
        if (!currentInspected || currentInspected.summary.matchId !== matchId) return;
        const nextSpectatorCount = spectatorCount ?? currentInspected.summary.spectatorCount;
        const nextSummary = roomSummaryFromState(currentInspected.summary, state, nextSpectatorCount);
        syncInspectedRoomSnapshot(nextSummary, state);
        setErrorText("");
      } catch {
        await refreshRooms(activeRoomQueryRef.current, { silent: true, skipReady: true });
      }
    };
    const scheduleBootstrapRefresh = react.useEffectEvent((mode = "resyncing") => {
      const job = bootstrapRefreshJobRef.current;
      job.pendingMode = mode;
      job.rerun = true;
      if (job.timer !== null) window.clearTimeout(job.timer);
      job.timer = window.setTimeout(() => {
        job.timer = null;
        if (job.inFlight) return;
        const run = async () => {
          if (!job.rerun) return;
          const nextMode = job.pendingMode;
          job.rerun = false;
          job.inFlight = true;
          try {
            await refreshBootstrap(nextMode);
          } finally {
            job.inFlight = false;
            if (job.rerun) {
              await run();
            }
          }
        };
        void run();
      }, 50);
    });
    const scheduleRoomDirectoryRefresh = react.useEffectEvent(() => {
      const job = roomDirectoryRefreshJobRef.current;
      job.rerun = true;
      if (job.timer !== null) window.clearTimeout(job.timer);
      job.timer = window.setTimeout(() => {
        job.timer = null;
        if (job.inFlight) return;
        const run = async () => {
          if (!job.rerun) return;
          job.rerun = false;
          job.inFlight = true;
          try {
            await refreshRooms(activeRoomQueryRef.current, { silent: true, skipReady: true });
          } finally {
            job.inFlight = false;
            if (job.rerun) {
              await run();
            }
          }
        };
        void run();
      }, 50);
    });
    const scheduleMatchRefresh = react.useEffectEvent((matchId) => {
      const currentMatchId = matchId ?? viewStateRef.current.currentMatch?.matchId ?? null;
      if (!currentMatchId) return;
      const job = matchRefreshJobRef.current;
      job.matchId = currentMatchId;
      job.rerun = true;
      if (job.timer !== null) window.clearTimeout(job.timer);
      job.timer = window.setTimeout(() => {
        job.timer = null;
        if (job.inFlight) return;
        const run = async () => {
          if (!job.rerun || !job.matchId) return;
          const nextMatchId = job.matchId;
          job.rerun = false;
          job.inFlight = true;
          try {
            await resyncCurrentMatch(nextMatchId);
          } finally {
            job.inFlight = false;
            if (job.rerun) {
              await run();
            }
          }
        };
        void run();
      }, 50);
    });
    const scheduleWatchedRoomRefresh = react.useEffectEvent((matchId, spectatorCount) => {
      const currentRoomId = matchId ?? inspectedRoomRef.current?.summary.matchId ?? null;
      if (!currentRoomId) return;
      const job = watchedRoomRefreshJobRef.current;
      job.matchId = currentRoomId;
      job.spectatorCount = spectatorCount ?? job.spectatorCount ?? inspectedRoomRef.current?.summary.spectatorCount ?? null;
      job.rerun = true;
      if (job.timer !== null) window.clearTimeout(job.timer);
      job.timer = window.setTimeout(() => {
        job.timer = null;
        if (job.inFlight) return;
        const run = async () => {
          if (!job.rerun || !job.matchId) return;
          const nextMatchId = job.matchId;
          const nextSpectatorCount = job.spectatorCount;
          job.rerun = false;
          job.inFlight = true;
          try {
            await resyncWatchedRoom(nextMatchId, nextSpectatorCount);
          } finally {
            job.inFlight = false;
            if (job.rerun) {
              await run();
            }
          }
        };
        void run();
      }, 50);
    });
    const runCommand = async (label, type, payload) => {
      setBusyCommand(label);
      setErrorText("");
      try {
        const result = await runtime.sendCommand(type, payload);
        return result;
      } catch (err) {
        if (frontendReact.isPluginCommandError(err) && err.code === "ACTION_LEASE_HELD") {
          try {
            await acquireActionLeaseIfNeeded();
            const retry = await runtime.sendCommand(type, payload);
            return retry;
          } catch (retryErr) {
            setErrorText(retryErr instanceof Error ? retryErr.message : t("chess.runtime.actionFailed", { label }));
            return null;
          }
        }
        setErrorText(err instanceof Error ? err.message : t("chess.runtime.actionFailed", { label }));
        return null;
      } finally {
        setBusyCommand("");
      }
    };
    const leaveChessHall = async () => {
      if (runtime.currentLocation === CHESS_LOCATION_ID) {
        await runtime.leaveLocation();
      }
    };
    const returnToPlay = async () => {
      if (viewState.currentMatch?.phase === "playing" && !window.confirm(t("chess.runtime.returnToCityPlayingConfirm"))) {
        return;
      }
      if (viewState.currentMatch?.phase === "waiting" && !window.confirm(t("chess.runtime.returnToCityWaitingConfirm"))) {
        return;
      }
      await leaveChessHall();
      navigate("/play");
    };
    const returnToLobby = async () => {
      if (viewState.currentMatch?.phase === "playing" && !window.confirm(t("chess.runtime.returnToLobbyPlayingConfirm"))) {
        return;
      }
      if (viewState.currentMatch?.phase === "waiting" && !window.confirm(t("chess.runtime.returnToLobbyWaitingConfirm"))) {
        return;
      }
      await leaveChessHall();
      if (runtime.inCity) {
        await runtime.leaveCity();
      }
      navigate("/lobby");
    };
    react.useEffect(() => {
      dispatch({ type: "reset" });
      matchEngineRef.current = null;
      setSelectedSquare(null);
      setPromotionRequest(null);
      setDragSquare(null);
      setRoomDirectory([]);
      setRoomDirectoryVersion(0);
      setInspectedRoom(null);
      setSelectedRoomId(null);
      setRoomDetailOpen(false);
      setRoomSearchText("");
      setActiveRoomQuery("");
      roomsAutoFetchAttemptedRef.current = false;
      setCreateRoomName("");
      setCreateRoomVisibility("public");
      setResultOverlay(null);
      shownResultOverlaySignatureRef.current = null;
      if (!connectedAgent) return;
      void refreshBootstrap("initializing");
    }, [connectedAgent?.id]);
    react.useEffect(() => {
      if (!currentMatch?.result) return;
      showResultOverlay(currentMatch);
    }, [currentMatch?.matchId, currentMatch?.result?.endedAt, showResultOverlay]);
    react.useEffect(() => {
      if (!inspectedRoom?.state.result) return;
      showResultOverlay(inspectedRoom.state);
    }, [inspectedRoom?.state.matchId, inspectedRoom?.state.result?.endedAt, showResultOverlay]);
    react.useEffect(() => {
      if (workspaceTab !== "rooms") {
        roomsAutoFetchAttemptedRef.current = false;
        setRoomDetailOpen(false);
        return;
      }
      if (!connectedAgent) return;
      if (roomDirectory.length > 0 || roomDirectoryBusy || roomsAutoFetchAttemptedRef.current) return;
      roomsAutoFetchAttemptedRef.current = true;
      void refreshRooms(activeRoomQueryRef.current, { silent: false });
    }, [connectedAgent, roomDirectory.length, roomDirectoryBusy, workspaceTab]);
    react.useEffect(() => {
      if (workspaceTab === "rooms") return;
      if (!inspectedRoomRef.current) return;
      void stopWatchingRooms({ clearSelection: true });
    }, [workspaceTab]);
    react.useEffect(() => {
      const handleResize = () => {
        setOrbPosition((current) => clampOrbPosition(current.x, current.y));
      };
      handleResize();
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }, [orbExpanded]);
    react.useEffect(() => {
      if (!boardMatch || boardMatch.phase !== "playing" && !boardMatch.players.some((player) => player.disconnectDeadlineAt)) {
        return void 0;
      }
      const timer = window.setInterval(() => {
        setClockTick(performance.now());
      }, 250);
      return () => window.clearInterval(timer);
    }, [boardMatch]);
    react.useEffect(() => {
      if (viewState.currentMatch?.phase !== "waiting" && viewState.currentMatch?.phase !== "playing") return void 0;
      const handler = (event) => {
        event.preventDefault();
        event.returnValue = "";
      };
      window.addEventListener("beforeunload", handler);
      return () => window.removeEventListener("beforeunload", handler);
    }, [viewState.currentMatch?.phase]);
    react.useEffect(() => {
      return () => {
        const timers = [
          bootstrapRefreshJobRef.current.timer,
          roomDirectoryRefreshJobRef.current.timer,
          matchRefreshJobRef.current.timer,
          watchedRoomRefreshJobRef.current.timer
        ];
        timers.forEach((timer) => {
          if (timer !== null) window.clearTimeout(timer);
        });
      };
    }, []);
    react.useEffect(() => {
      const unsubWelcome = runtime.subscribe("chess_welcome", (payload) => {
        const data = payload;
        if (data?.needsBootstrap) {
          scheduleBootstrapRefresh(viewStateRef.current.syncState === "idle" ? "initializing" : "resyncing");
        }
      });
      const unsubLobby = runtime.subscribe("chess_lobby_delta", (payload) => {
        const delta = payload;
        if (delta.version <= viewStateRef.current.lobbyVersion) return;
        scheduleBootstrapRefresh("resyncing");
      });
      const unsubRoomDirectory = runtime.subscribe("chess_room_directory_delta", (payload) => {
        const delta = payload;
        if (delta.version <= roomDirectoryVersion) return;
        scheduleRoomDirectoryRefresh();
      });
      const unsubMatch = runtime.subscribe("chess_match_delta", (payload) => {
        const delta = payload;
        scheduleMatchRefresh(delta.matchId);
        if (delta.needsBootstrap) {
          scheduleBootstrapRefresh("resyncing");
        }
      });
      const unsubRoom = runtime.subscribe("chess_room_delta", (payload) => {
        const delta = payload;
        const current = inspectedRoomRef.current;
        if (!current || current.summary.matchId !== delta.matchId) return;
        scheduleWatchedRoomRefresh(delta.matchId, delta.spectatorCount);
      });
      const unsubTurnPrompt = runtime.subscribe("chess_turn_prompt", (payload) => {
        const prompt = payload;
        scheduleMatchRefresh(prompt.matchId);
      });
      const unsubReconnect = runtime.subscribe("chess_reconnected", (payload) => {
        const data = payload;
        if (data?.needsBootstrap) {
          scheduleBootstrapRefresh("resyncing");
        }
      });
      return () => {
        unsubWelcome();
        unsubLobby();
        unsubRoomDirectory();
        unsubMatch();
        unsubRoom();
        unsubTurnPrompt();
        unsubReconnect();
      };
    }, [runtime, roomDirectoryVersion, scheduleBootstrapRefresh, scheduleMatchRefresh, scheduleRoomDirectoryRefresh, scheduleWatchedRoomRefresh]);
    const displayedClocks = react.useMemo(() => {
      const matchState = boardMatch;
      if (!matchState) return null;
      const activeClockAnchor = workspaceTab === "rooms" && inspectedRoom && !boardMatchIsCurrent ? inspectedClockAnchor : currentClockAnchor;
      let whiteMs = matchState.clocks.whiteMs;
      let blackMs = matchState.clocks.blackMs;
      if (matchState.phase === "playing" && matchState.turn) {
        const elapsed = Math.max(0, clockTick - activeClockAnchor);
        if (matchState.turn === "w") whiteMs = Math.max(0, whiteMs - elapsed);
        if (matchState.turn === "b") blackMs = Math.max(0, blackMs - elapsed);
      }
      return { whiteMs, blackMs };
    }, [boardMatch, boardMatchIsCurrent, clockTick, currentClockAnchor, inspectedClockAnchor, inspectedRoom, workspaceTab]);
    const getLegalTargets = (square) => {
      const matchState = currentMatch;
      const chess2 = matchEngineRef.current;
      if (!matchState || matchState.phase !== "playing" || !square || !yourTurn || !chess2) {
        return /* @__PURE__ */ new Set();
      }
      try {
        const moves = chess2.moves({ square, verbose: true });
        return new Set(moves.map((move) => move.to));
      } catch {
        return /* @__PURE__ */ new Set();
      }
    };
    const legalTargets = react.useMemo(() => getLegalTargets(selectedSquare), [selectedSquare, currentMatch, yourTurn]);
    const dragTargets = react.useMemo(() => getLegalTargets(dragSquare), [dragSquare, currentMatch, yourTurn]);
    const activeTargets = dragSquare ? dragTargets : legalTargets;
    const isLiveMatch = currentMatch?.phase === "playing";
    const isWaitingMatch = currentMatch?.phase === "waiting";
    const isFinishedMatch = currentMatch?.phase === "finished";
    const whitePlayer = findPlayer(boardMatch, "w");
    const blackPlayer = findPlayer(boardMatch, "b");
    const boardBottomTone = boardMatchIsCurrent && boardMatch?.yourColor === "b" ? "b" : "w";
    const boardTopTone = boardBottomTone === "w" ? "b" : "w";
    const currentViewer = boardMatchIsCurrent ? findPlayerByAgentId(boardMatch, boardMatch?.yourAgentId) : null;
    const waitingPlayer = findPlayerByAgentId(currentMatch, currentMatch?.yourAgentId ?? connectedAgent?.id);
    const waitingBottomPlayer = boardMatchIsCurrent ? currentViewer ?? boardMatch?.players[0] ?? null : boardMatch?.players[0] ?? null;
    const waitingOpponent = boardMatch?.players.find((player) => player.agentId !== waitingBottomPlayer?.agentId) ?? null;
    const topStagePlayer = boardMatch ? boardMatch.phase === "waiting" ? waitingOpponent : boardTopTone === "w" ? whitePlayer : blackPlayer : null;
    const bottomStagePlayer = boardMatch ? boardMatch.phase === "waiting" ? waitingBottomPlayer : boardBottomTone === "w" ? whitePlayer : blackPlayer : null;
    const lobbySelfPreviewPlayer = connectedAgent ? {
      agentId: connectedAgent.id,
      agentName: connectedAgent.name,
      color: null,
      connected: true
    } : null;
    const resolveDisplayedClock = (player, fallbackColor) => {
      const seatColor = player?.color ?? fallbackColor;
      return seatColor === "w" ? displayedClocks?.whiteMs ?? boardMatch?.clocks.whiteMs : displayedClocks?.blackMs ?? boardMatch?.clocks.blackMs;
    };
    const selectedRoom = react.useMemo(
      () => roomDirectory.find((room) => room.matchId === selectedRoomId) ?? inspectedRoom?.summary ?? null,
      [inspectedRoom?.summary, roomDirectory, selectedRoomId]
    );
    const watchedRoomId = inspectedRoom?.summary.matchId ?? null;
    const recordWins = viewState.rating?.wins ?? 0;
    const recordLosses = viewState.rating?.losses ?? 0;
    const recordDraws = viewState.rating?.draws ?? 0;
    const recordGames = viewState.rating?.gamesPlayed ?? 0;
    const winRate = recordGames > 0 ? Math.round(recordWins / recordGames * 100) : 0;
    const workspaceTabs = [
      { key: "new-game", icon: lucideReact.PlusSquare, label: t("chess.page.tabNewGame") },
      { key: "rooms", icon: lucideReact.Eye, label: t("chess.page.tabRooms") },
      { key: "record", icon: lucideReact.BarChart3, label: t("chess.page.tabRecord") },
      { key: "history", icon: lucideReact.ListOrdered, label: t("chess.page.tabHistory") },
      { key: "leaderboard", icon: lucideReact.Trophy, label: t("chess.page.tabLeaderboard") }
    ];
    const executeMove = async (from, to, promotion) => {
      if (!viewState.currentMatch || !yourTurn || !viewState.currentMatch.yourColor) return;
      const payload = await runCommand(t("chess.commands.move"), CHESS_COMMAND("move"), { from, to, promotion });
      if (payload?.state) {
        const nextRating = applyMatchResultToRating(viewStateRef.current.rating, viewStateRef.current.currentMatch, payload.state);
        syncMatchSnapshot(payload.state, nextRating);
      }
    };
    const attemptMove = (from, to) => {
      const targets = getLegalTargets(from);
      if (!targets.has(to)) return false;
      const movingPiece = getPieceAtSquare(from);
      if (isPromotionCandidate(movingPiece, to)) {
        setPromotionRequest({ from, to });
        setSelectedSquare(from);
        return true;
      }
      void executeMove(from, to);
      return true;
    };
    const onSquareClick = (square) => {
      const matchState = viewState.currentMatch;
      if (!matchState || matchState.phase !== "playing") return;
      if (!matchState.yourColor) return;
      const squarePiece = getPieceAtSquare(square);
      const owner = pieceColor(squarePiece);
      if (!selectedSquare) {
        if (!yourTurn) return;
        if (!squarePiece) return;
        if (owner !== matchState.yourColor) return;
        setSelectedSquare(square);
        return;
      }
      if (square === selectedSquare) {
        setSelectedSquare(null);
        return;
      }
      if (squarePiece && owner === matchState.yourColor) {
        setSelectedSquare(square);
        return;
      }
      if (!legalTargets.has(square)) {
        return;
      }
      attemptMove(selectedSquare, square);
    };
    const onSquareDragStart = (square) => {
      const matchState = viewState.currentMatch;
      if (!matchState || matchState.phase !== "playing" || !matchState.yourColor || !yourTurn) return false;
      const piece = getPieceAtSquare(square);
      if (!piece || pieceColor(piece) !== matchState.yourColor) return false;
      setDragSquare(square);
      setSelectedSquare(square);
      return true;
    };
    const renderPlayerCard = (seatTone, player, clockMs) => {
      const seatColor = player?.color ?? seatTone;
      const isTurnCard = !!player?.color && boardMatch?.turn === player.color && !boardMatch?.result;
      const isSelf = player?.agentId === ((boardMatchIsCurrent ? currentMatch?.yourAgentId : null) ?? connectedAgent?.id);
      const displayName = agentNameLabel(player?.agentName, t("chess.page.pendingPlayer"));
      const detailLabel = !player ? t("chess.page.emptySeat") : !player.connected ? t("chess.page.offline") : " ";
      return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: `chess-seat-card chess-seat-card--${seatColor === "w" ? "light" : "dark"} ${isTurnCard ? "is-active" : ""}`, children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "chess-seat-card__identity", children: [
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: `chess-seat-card__avatar ${isSelf ? "is-self" : ""}`, children: agentMonogram(player?.agentName ?? displayName) }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "chess-seat-card__copy", children: [
            /* @__PURE__ */ jsxRuntime.jsx("strong", { className: "chess-seat-card__name", children: displayName }),
            /* @__PURE__ */ jsxRuntime.jsx("span", { className: `chess-seat-card__detail ${detailLabel.trim() === "" ? "is-placeholder" : ""}`, children: detailLabel })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "chess-seat-card__clock mono", children: formatClock(clockMs ?? 0) })
      ] });
    };
    const renderBoard = (matrix, interactive, showHistory) => /* @__PURE__ */ jsxRuntime.jsx("div", { className: `chess-board ${showHistory ? "is-live" : "is-preview"}`, children: boardRanks.map((rank2, rowIndex) => boardFiles.map((file2, colIndex) => {
      const square = `${file2}${rank2}`;
      const piece = pieceAtSquare(matrix, square);
      const owner = pieceColor(piece);
      const dark = (rowIndex + colIndex) % 2 === 1;
      const isLastMoveFrom = showHistory && boardDerived.lastMove?.from === square;
      const isLastMoveTo = showHistory && boardDerived.lastMove?.to === square;
      const isTarget = interactive && activeTargets.has(square);
      const isSelected = interactive && selectedSquare === square;
      const isDragSource = interactive && dragSquare === square;
      const canDrag = interactive && !!piece && !!currentMatch?.yourColor && yourTurn && owner === currentMatch.yourColor;
      const squareInner = /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
        piece ? /* @__PURE__ */ jsxRuntime.jsx(ChessPieceIcon, { piece, className: `chess-piece ${piece === piece.toLowerCase() ? "black" : "white"}` }) : null,
        rowIndex === 7 ? /* @__PURE__ */ jsxRuntime.jsx("span", { className: "chess-mark file", children: file2 }) : null,
        colIndex === 0 ? /* @__PURE__ */ jsxRuntime.jsx("span", { className: "chess-mark rank", children: rank2 }) : null
      ] });
      const className = `chess-square ${dark ? "dark" : "light"} ${isSelected ? "selected" : ""} ${isTarget ? "target" : ""} ${isLastMoveFrom || isLastMoveTo ? "last-move" : ""} ${isLastMoveFrom ? "last-move-from" : ""} ${isLastMoveTo ? "last-move-to" : ""} ${isDragSource ? "drag-source" : ""}`;
      if (!interactive) {
        return /* @__PURE__ */ jsxRuntime.jsx("div", { className, children: squareInner }, square);
      }
      return /* @__PURE__ */ jsxRuntime.jsx(
        "button",
        {
          type: "button",
          className,
          onClick: () => onSquareClick(square),
          title: square,
          draggable: canDrag,
          onDragStart: (event) => {
            if (!onSquareDragStart(square)) {
              event.preventDefault();
              return;
            }
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", square);
          },
          onDragEnd: () => setDragSquare(null),
          onDragOver: (event) => {
            if (!dragSquare || !activeTargets.has(square)) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
          },
          onDrop: (event) => {
            event.preventDefault();
            const from = dragSquare ?? event.dataTransfer.getData("text/plain");
            setDragSquare(null);
            if (!from) return;
            attemptMove(from, square);
          },
          children: squareInner
        },
        square
      );
    })) });
    const startOrbGesture = (event) => {
      if (event.button !== 0) return;
      orbPointerRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        offsetX: event.clientX - orbPosition.x,
        offsetY: event.clientY - orbPosition.y,
        moved: false
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    };
    const moveOrbGesture = (event) => {
      const pointer = orbPointerRef.current;
      if (!pointer || pointer.pointerId !== event.pointerId) return;
      const deltaX = event.clientX - pointer.startX;
      const deltaY = event.clientY - pointer.startY;
      if (!pointer.moved && Math.hypot(deltaX, deltaY) >= 6) {
        pointer.moved = true;
        setOrbDragging(true);
      }
      if (!pointer.moved) return;
      setOrbPosition(clampOrbPosition(event.clientX - pointer.offsetX, event.clientY - pointer.offsetY));
    };
    const finishOrbGesture = (event) => {
      const pointer = orbPointerRef.current;
      if (!pointer || pointer.pointerId !== event.pointerId) return;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      const wasDrag = pointer.moved;
      orbPointerRef.current = null;
      setOrbDragging(false);
      if (!wasDrag) {
        setOrbExpanded((value) => !value);
      }
    };
    const cancelOrbGesture = (event) => {
      if (orbPointerRef.current?.pointerId !== event.pointerId) return;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      orbPointerRef.current = null;
      setOrbDragging(false);
    };
    const renderWorkspaceActions = () => /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "chess-action-grid", children: [
      isWaitingMatch ? /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
        /* @__PURE__ */ jsxRuntime.jsx(
          "button",
          {
            className: waitingPlayer?.ready ? "app-btn secondary" : "app-btn chess-cta",
            disabled: !!busyCommand,
            onClick: () => void runCommand(
              waitingPlayer?.ready ? t("chess.commands.unready") : t("chess.commands.ready"),
              CHESS_COMMAND(waitingPlayer?.ready ? "unready" : "ready")
            ).then((res) => {
              if (res?.state) syncMatchSnapshot(res.state);
            }),
            children: waitingPlayer?.ready ? t("chess.commands.unready") : t("chess.commands.ready")
          }
        ),
        /* @__PURE__ */ jsxRuntime.jsx(
          "button",
          {
            className: "app-btn secondary",
            disabled: !!busyCommand,
            onClick: () => void runCommand(waitingActionLabel, CHESS_COMMAND("leave_match")).then((res) => {
              if (!res) return;
              dispatch({ type: "match_cleared" });
              setSelectedSquare(null);
              setPromotionRequest(null);
              setDragSquare(null);
            }),
            children: waitingActionLabel
          }
        )
      ] }) : null,
      isLiveMatch ? /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
        !currentMatch?.drawOfferBy ? /* @__PURE__ */ jsxRuntime.jsx(
          "button",
          {
            className: "app-btn chess-cta",
            disabled: !!busyCommand,
            onClick: () => void runCommand(t("chess.commands.offerDraw"), CHESS_COMMAND("offer_draw")).then((res) => {
              if (res?.state) syncMatchSnapshot(res.state);
            }),
            children: t("chess.commands.offerDraw")
          }
        ) : null,
        currentMatch?.drawOfferBy && currentMatch.drawOfferBy !== currentMatch.yourAgentId ? /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
          /* @__PURE__ */ jsxRuntime.jsx(
            "button",
            {
              className: "app-btn chess-cta",
              disabled: !!busyCommand,
              onClick: () => void runCommand(t("chess.commands.acceptDraw"), CHESS_COMMAND("accept_draw")).then((res) => {
                if (res?.state) {
                  const nextRating = applyMatchResultToRating(viewStateRef.current.rating, viewStateRef.current.currentMatch, res.state);
                  syncMatchSnapshot(res.state, nextRating);
                }
              }),
              children: t("chess.commands.acceptDraw")
            }
          ),
          /* @__PURE__ */ jsxRuntime.jsx(
            "button",
            {
              className: "app-btn secondary",
              disabled: !!busyCommand,
              onClick: () => void runCommand(t("chess.commands.declineDraw"), CHESS_COMMAND("decline_draw")).then((res) => {
                if (res?.state) syncMatchSnapshot(res.state);
              }),
              children: t("chess.commands.declineDraw")
            }
          )
        ] }) : null,
        /* @__PURE__ */ jsxRuntime.jsx(
          "button",
          {
            className: "app-btn secondary",
            disabled: !!busyCommand,
            onClick: () => void runCommand(t("chess.commands.resign"), CHESS_COMMAND("resign")).then((res) => {
              if (res?.state) {
                const nextRating = applyMatchResultToRating(viewStateRef.current.rating, viewStateRef.current.currentMatch, res.state);
                syncMatchSnapshot(res.state, nextRating);
              }
            }),
            children: t("chess.commands.resign")
          }
        )
      ] }) : null
    ] });
    const createMatch = async () => {
      const payload = await runCommand(
        t("chess.commands.createMatch"),
        CHESS_COMMAND("create_match"),
        {
          roomName: createRoomName.trim() || void 0,
          visibility: createRoomVisibility
        }
      );
      if (payload?.state) {
        syncMatchSnapshot(payload.state);
        setCreateRoomName("");
        void refreshRooms(activeRoomQueryRef.current, { silent: true, skipReady: true });
      }
    };
    const openRoom = async (room) => {
      setSelectedRoomId(room.matchId);
      setRoomDetailOpen(true);
      const currentInspected = inspectedRoomRef.current;
      if (currentInspected?.summary.matchId === room.matchId) {
        setInspectedRoom({
          summary: roomSummaryFromState(room, currentInspected.state, room.spectatorCount),
          state: currentInspected.state
        });
        return;
      }
      const payload = await runCommand(
        t("chess.page.watchRoom"),
        CHESS_COMMAND("watch_room"),
        { matchId: room.matchId }
      );
      if (!payload) return;
      syncInspectedRoomSnapshot(payload.room, payload.state);
    };
    const searchRooms = async () => {
      await refreshRooms(roomSearchText);
    };
    const joinSelectedRoom = async () => {
      const room = inspectedRoomRef.current?.summary;
      if (!room) return;
      const payload = await runCommand(
        t("chess.page.joinThisMatch"),
        CHESS_COMMAND("join_match"),
        { matchId: room.matchId }
      );
      if (!payload?.state) return;
      const nextRating = applyMatchResultToRating(viewStateRef.current.rating, viewStateRef.current.currentMatch, payload.state);
      syncMatchSnapshot(payload.state, nextRating);
      await stopWatchingRooms({ clearSelection: true });
      setWorkspaceTab("new-game");
    };
    const workspaceContent = (() => {
      switch (workspaceTab) {
        case "record":
          return /* @__PURE__ */ jsxRuntime.jsxs("section", { className: "chess-panel-card chess-panel-card--workspace", children: [
            /* @__PURE__ */ jsxRuntime.jsxs("header", { className: "chess-panel-card__header", children: [
              /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntime.jsx("span", { className: "chess-stage-label", children: t("chess.page.tabRecord") }),
                /* @__PURE__ */ jsxRuntime.jsx("h2", { children: t("chess.page.recordTitle") })
              ] }),
              /* @__PURE__ */ jsxRuntime.jsxs("span", { className: "chess-panel-pill", children: [
                "Elo ",
                viewState.rating?.rating ?? DEFAULT_RATING
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "chess-stat-grid", children: [
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "chess-stat-card", children: [
                /* @__PURE__ */ jsxRuntime.jsx("span", { children: t("chess.page.recordGames") }),
                /* @__PURE__ */ jsxRuntime.jsx("strong", { children: recordGames })
              ] }),
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "chess-stat-card", children: [
                /* @__PURE__ */ jsxRuntime.jsx("span", { children: t("chess.page.recordWinRate") }),
                /* @__PURE__ */ jsxRuntime.jsx("strong", { children: recordGames > 0 ? `${winRate}%` : "--" })
              ] }),
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "chess-stat-card", children: [
                /* @__PURE__ */ jsxRuntime.jsx("span", { children: t("chess.page.recordWins") }),
                /* @__PURE__ */ jsxRuntime.jsx("strong", { children: recordWins })
              ] }),
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "chess-stat-card", children: [
                /* @__PURE__ */ jsxRuntime.jsx("span", { children: t("chess.page.recordLosses") }),
                /* @__PURE__ */ jsxRuntime.jsx("strong", { children: recordLosses })
              ] }),
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "chess-stat-card", children: [
                /* @__PURE__ */ jsxRuntime.jsx("span", { children: t("chess.page.recordDraws") }),
                /* @__PURE__ */ jsxRuntime.jsx("strong", { children: recordDraws })
              ] }),
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "chess-stat-card", children: [
                /* @__PURE__ */ jsxRuntime.jsx("span", { children: t("chess.page.currentBoard") }),
                /* @__PURE__ */ jsxRuntime.jsx("strong", { children: currentMatch ? currentMatch.phase : t("chess.page.waiting") })
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "chess-panel-card__summary", children: [
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "chess-panel-pill-row", children: [
                /* @__PURE__ */ jsxRuntime.jsx("span", { className: "chess-panel-pill", children: t("chess.page.connectedAgent") }),
                /* @__PURE__ */ jsxRuntime.jsx("span", { className: "chess-panel-pill", children: connectedAgent?.name ?? t("chess.runtime.noAgent") })
              ] }),
              /* @__PURE__ */ jsxRuntime.jsx("p", { children: t("chess.page.recordBody") })
            ] })
          ] });
        case "rooms": {
          const detailRoom = inspectedRoom?.summary ?? selectedRoom;
          const detailState = inspectedRoom?.state ?? null;
          const showRoomDetail = roomDetailOpen && !!detailRoom;
          const isWatchingSelectedRoom = !!detailRoom && watchedRoomId === detailRoom.matchId;
          const canJoinSelectedRoom = !!detailRoom && detailRoom.phase === "waiting" && detailRoom.seatsRemaining > 0 && canCreateOrJoin;
          return /* @__PURE__ */ jsxRuntime.jsxs("section", { className: "chess-panel-card chess-panel-card--workspace", children: [
            /* @__PURE__ */ jsxRuntime.jsxs("header", { className: "chess-panel-card__header", children: [
              /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntime.jsx("span", { className: "chess-stage-label", children: t("chess.page.tabRooms") }),
                /* @__PURE__ */ jsxRuntime.jsx("h2", { children: t("chess.page.roomsTitle") })
              ] }),
              roomDirectoryBusy ? /* @__PURE__ */ jsxRuntime.jsx("span", { className: "chess-panel-pill", children: t("chess.page.roomsLoading") }) : null
            ] }),
            /* @__PURE__ */ jsxRuntime.jsxs(
              "form",
              {
                className: "chess-room-search",
                onSubmit: (event) => {
                  event.preventDefault();
                  void searchRooms();
                },
                children: [
                  /* @__PURE__ */ jsxRuntime.jsxs("label", { className: "chess-field", children: [
                    /* @__PURE__ */ jsxRuntime.jsx("span", { className: "chess-field__label", children: t("chess.page.roomsSearchLabel") }),
                    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "chess-field__control chess-field__control--search", children: [
                      /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Search, { size: 16 }),
                      /* @__PURE__ */ jsxRuntime.jsx(
                        "input",
                        {
                          value: roomSearchText,
                          onChange: (event) => setRoomSearchText(event.target.value),
                          placeholder: t("chess.page.roomsSearchPlaceholder")
                        }
                      )
                    ] })
                  ] }),
                  /* @__PURE__ */ jsxRuntime.jsx("button", { className: "app-btn secondary", type: "submit", disabled: roomDirectoryBusy, children: t("chess.page.roomsSearchButton") })
                ]
              }
            ),
            inspectedRoom ? /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "chess-room-watch-banner", children: [
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "chess-room-watch-banner__copy", children: [
                /* @__PURE__ */ jsxRuntime.jsx("span", { className: "chess-stage-label", children: t("chess.page.watchStatusTitle") }),
                /* @__PURE__ */ jsxRuntime.jsx("strong", { children: inspectedRoom.summary.roomName }),
                /* @__PURE__ */ jsxRuntime.jsx("span", { className: "mono", children: inspectedRoom.summary.matchId })
              ] }),
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "chess-room-watch-banner__actions", children: [
                /* @__PURE__ */ jsxRuntime.jsx("span", { className: "chess-panel-pill chess-panel-pill--watching", children: t("chess.page.watchingNow") }),
                /* @__PURE__ */ jsxRuntime.jsx(
                  "button",
                  {
                    type: "button",
                    className: "app-btn secondary",
                    onClick: () => {
                      setSelectedRoomId(inspectedRoom.summary.matchId);
                      setRoomDetailOpen(true);
                    },
                    children: t("chess.page.showWatchedRoom")
                  }
                ),
                /* @__PURE__ */ jsxRuntime.jsx(
                  "button",
                  {
                    type: "button",
                    className: "app-btn ghost",
                    disabled: !!busyCommand,
                    onClick: () => void stopWatchingRooms({ clearSelection: true }),
                    children: t("chess.page.stopWatching")
                  }
                )
              ] })
            ] }) : null,
            showRoomDetail ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: "chess-room-detail-modal", role: "dialog", "aria-label": t("chess.page.selectedRoomTitle"), children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "chess-room-detail chess-room-detail--directory chess-room-detail--floating", children: [
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "chess-room-detail__header", children: [
                /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
                  /* @__PURE__ */ jsxRuntime.jsx("span", { className: "chess-stage-label", children: t("chess.page.selectedRoomTitle") }),
                  /* @__PURE__ */ jsxRuntime.jsx("h3", { children: detailRoom.roomName })
                ] }),
                /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "chess-room-detail__header-actions", children: [
                  /* @__PURE__ */ jsxRuntime.jsx("span", { className: "chess-panel-pill mono", children: detailRoom.matchId }),
                  /* @__PURE__ */ jsxRuntime.jsx(
                    "button",
                    {
                      type: "button",
                      className: "chess-room-detail__close",
                      "aria-label": t("chess.page.closeRoomPanel"),
                      onClick: () => setRoomDetailOpen(false),
                      children: /* @__PURE__ */ jsxRuntime.jsx(lucideReact.X, { size: 16 })
                    }
                  )
                ] })
              ] }),
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "chess-panel-pill-row", children: [
                /* @__PURE__ */ jsxRuntime.jsx("span", { className: "chess-panel-pill", children: visibilityLabel(detailRoom.visibility) }),
                /* @__PURE__ */ jsxRuntime.jsx("span", { className: "chess-panel-pill", children: t("chess.page.phaseChip", { value: detailRoom.phase }) }),
                /* @__PURE__ */ jsxRuntime.jsx("span", { className: "chess-panel-pill", children: t("chess.page.spectatorChip", { count: detailRoom.spectatorCount }) }),
                isWatchingSelectedRoom ? /* @__PURE__ */ jsxRuntime.jsx("span", { className: "chess-panel-pill chess-panel-pill--watching", children: t("chess.page.watchingNow") }) : null
              ] }),
              /* @__PURE__ */ jsxRuntime.jsx("div", { className: "chess-room-detail__body", children: (detailState?.players ?? detailRoom.players).map((player) => /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "chess-room-detail__player", children: [
                /* @__PURE__ */ jsxRuntime.jsx("span", { children: player.agentName }),
                /* @__PURE__ */ jsxRuntime.jsx("span", { children: player.connected ? t("chess.page.online") : t("chess.page.offline") })
              ] }, player.agentId)) }),
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "chess-room-detail__actions", children: [
                isWatchingSelectedRoom ? /* @__PURE__ */ jsxRuntime.jsx(
                  "button",
                  {
                    type: "button",
                    className: "app-btn secondary",
                    disabled: !!busyCommand,
                    onClick: () => void stopWatchingRooms({ clearSelection: true }),
                    children: t("chess.page.stopWatching")
                  }
                ) : /* @__PURE__ */ jsxRuntime.jsx(
                  "button",
                  {
                    type: "button",
                    className: "app-btn secondary",
                    disabled: !!busyCommand,
                    onClick: () => void openRoom(detailRoom),
                    children: t("chess.page.watchRoom")
                  }
                ),
                canJoinSelectedRoom ? /* @__PURE__ */ jsxRuntime.jsx(
                  "button",
                  {
                    type: "button",
                    className: "app-btn chess-cta",
                    disabled: !!busyCommand,
                    onClick: () => void joinSelectedRoom(),
                    children: t("chess.page.joinThisMatch")
                  }
                ) : null
              ] })
            ] }) }) : null,
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "chess-panel-card__header", children: [
              /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntime.jsx("span", { className: "chess-stage-label", children: t("chess.page.roomsListKicker") }),
                /* @__PURE__ */ jsxRuntime.jsx("h2", { children: t("chess.page.roomsListTitle") })
              ] }),
              /* @__PURE__ */ jsxRuntime.jsx("span", { className: "chess-panel-pill", children: roomDirectory.length })
            ] }),
            roomDirectory.length === 0 ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: "chess-panel-empty", children: t("chess.page.noRooms") }) : /* @__PURE__ */ jsxRuntime.jsx("div", { className: "chess-room-list chess-scroll chess-scroll--workspace", children: roomDirectory.map((room) => /* @__PURE__ */ jsxRuntime.jsxs(
              "button",
              {
                type: "button",
                className: `chess-room-card chess-room-card--selectable ${selectedRoomId === room.matchId ? "is-selected" : ""}`,
                onClick: () => void openRoom(room),
                children: [
                  /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "chess-room-card__head", children: [
                    /* @__PURE__ */ jsxRuntime.jsx("strong", { children: room.roomName }),
                    /* @__PURE__ */ jsxRuntime.jsx("span", { className: "mono", children: room.matchId })
                  ] }),
                  /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "chess-room-card__meta", children: [
                    /* @__PURE__ */ jsxRuntime.jsx("span", { children: t("chess.page.phaseChip", { value: room.phase }) }),
                    /* @__PURE__ */ jsxRuntime.jsx("span", { children: t("chess.page.spectatorChip", { count: room.spectatorCount }) }),
                    /* @__PURE__ */ jsxRuntime.jsx("span", { children: visibilityLabel(room.visibility) })
                  ] })
                ]
              },
              room.matchId
            )) })
          ] });
        }
        case "history":
          return /* @__PURE__ */ jsxRuntime.jsxs("section", { className: "chess-panel-card chess-panel-card--workspace", children: [
            /* @__PURE__ */ jsxRuntime.jsxs("header", { className: "chess-panel-card__header", children: [
              /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntime.jsx("span", { className: "chess-stage-label", children: t("chess.page.tabHistory") }),
                /* @__PURE__ */ jsxRuntime.jsx("h2", { children: t("chess.page.moveSheet") })
              ] }),
              /* @__PURE__ */ jsxRuntime.jsx("span", { className: "chess-panel-pill", children: boardDerived.moveList.length })
            ] }),
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "chess-panel-card__summary", children: [
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "chess-panel-pill-row", children: [
                boardMatch ? /* @__PURE__ */ jsxRuntime.jsx("span", { className: "chess-panel-pill mono", children: t("chess.page.matchLabel", { id: boardMatch.matchId }) }) : null,
                /* @__PURE__ */ jsxRuntime.jsx("span", { className: "chess-panel-pill", children: boardMatch ? formatPositionSummary(boardMatch) : t("chess.page.noMatch") })
              ] }),
              /* @__PURE__ */ jsxRuntime.jsx("p", { children: boardMatch ? t("chess.page.historyBody") : t("chess.page.historyEmptyBody") })
            ] }),
            groupedMoveRows.length === 0 ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: "chess-panel-empty", children: t("chess.page.moveSheetEmpty") }) : /* @__PURE__ */ jsxRuntime.jsx("div", { className: "move-list chess-scroll chess-scroll--workspace", children: groupedMoveRows.map((row) => /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "move-row", children: [
              /* @__PURE__ */ jsxRuntime.jsxs("span", { className: "move-row__index mono", children: [
                row.moveNumber,
                "."
              ] }),
              /* @__PURE__ */ jsxRuntime.jsx("span", { className: `move-pill ${row.white?.ply === latestMovePly ? "is-latest" : ""}`, children: row.white?.san ?? "..." }),
              /* @__PURE__ */ jsxRuntime.jsx("span", { className: `move-pill ${row.black?.ply === latestMovePly ? "is-latest" : ""}`, children: row.black?.san ?? "..." })
            ] }, row.moveNumber)) })
          ] });
        case "leaderboard":
          return /* @__PURE__ */ jsxRuntime.jsxs("section", { className: "chess-panel-card chess-panel-card--workspace", children: [
            /* @__PURE__ */ jsxRuntime.jsxs("header", { className: "chess-panel-card__header", children: [
              /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntime.jsx("span", { className: "chess-stage-label", children: t("chess.page.tabLeaderboard") }),
                /* @__PURE__ */ jsxRuntime.jsx("h2", { children: t("chess.page.leaderboard") })
              ] }),
              /* @__PURE__ */ jsxRuntime.jsxs("span", { className: "chess-panel-pill", children: [
                "Top ",
                viewState.leaderboard.length
              ] })
            ] }),
            viewState.rating ? /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "chess-panel-card__summary", children: [
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "chess-panel-pill-row", children: [
                /* @__PURE__ */ jsxRuntime.jsx("span", { className: "chess-panel-pill", children: t("chess.page.connectedAgent") }),
                /* @__PURE__ */ jsxRuntime.jsx("span", { className: "chess-panel-pill", children: connectedAgent?.name ?? t("chess.runtime.noAgent") })
              ] }),
              /* @__PURE__ */ jsxRuntime.jsx("p", { children: t("chess.page.leaderboardBody", { rating: viewState.rating.rating }) })
            ] }) : null,
            viewState.leaderboard.length === 0 ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: "chess-panel-empty", children: t("chess.page.noData") }) : /* @__PURE__ */ jsxRuntime.jsx("div", { className: "chess-leaderboard-list chess-scroll chess-scroll--workspace", children: viewState.leaderboard.map((item, idx) => /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "chess-leaderboard-item", children: [
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "chess-leaderboard-item__head", children: [
                /* @__PURE__ */ jsxRuntime.jsxs("span", { className: "chess-rank", children: [
                  /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Crown, { size: 14 }),
                  " #",
                  idx + 1
                ] }),
                /* @__PURE__ */ jsxRuntime.jsx("strong", { children: item.rating })
              ] }),
              /* @__PURE__ */ jsxRuntime.jsx("div", { className: "chess-leaderboard-item__name", children: agentNameLabel(item.agentName, item.agentId) }),
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "chess-leaderboard-item__meta mono", children: [
                item.wins,
                "W/",
                item.losses,
                "L/",
                item.draws,
                "D"
              ] })
            ] }, item.agentId)) })
          ] });
        case "new-game":
        default:
          return /* @__PURE__ */ jsxRuntime.jsxs("section", { className: "chess-panel-card chess-panel-card--workspace", children: [
            /* @__PURE__ */ jsxRuntime.jsxs("header", { className: "chess-panel-card__header", children: [
              /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntime.jsx("span", { className: "chess-stage-label", children: t("chess.page.tabNewGame") }),
                /* @__PURE__ */ jsxRuntime.jsx("h2", { children: t("chess.page.newGameTitle") })
              ] }),
              busyCommand ? /* @__PURE__ */ jsxRuntime.jsx("span", { className: "chess-panel-pill", children: t("chess.page.busy", { label: busyCommand }) }) : null
            ] }),
            !currentMatch || isFinishedMatch ? /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "chess-launch-card", children: [
              /* @__PURE__ */ jsxRuntime.jsxs("label", { className: "chess-field", children: [
                /* @__PURE__ */ jsxRuntime.jsx("span", { className: "chess-field__label", children: t("chess.page.roomNameLabel") }),
                /* @__PURE__ */ jsxRuntime.jsx("div", { className: "chess-field__control", children: /* @__PURE__ */ jsxRuntime.jsx(
                  "input",
                  {
                    value: createRoomName,
                    onChange: (event) => setCreateRoomName(event.target.value),
                    placeholder: t("chess.page.roomNamePlaceholder")
                  }
                ) })
              ] }),
              /* @__PURE__ */ jsxRuntime.jsx("div", { className: "chess-visibility-toggle", role: "tablist", "aria-label": t("chess.page.visibilityTitle"), children: ["public", "private"].map((visibility) => /* @__PURE__ */ jsxRuntime.jsxs(
                "button",
                {
                  type: "button",
                  className: `chess-visibility-toggle__option ${createRoomVisibility === visibility ? "is-active" : ""}`,
                  onClick: () => setCreateRoomVisibility(visibility),
                  children: [
                    visibility === "public" ? /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Globe2, { size: 15 }) : /* @__PURE__ */ jsxRuntime.jsx(lucideReact.LockKeyhole, { size: 15 }),
                    /* @__PURE__ */ jsxRuntime.jsx("span", { children: visibilityLabel(visibility) })
                  ]
                },
                visibility
              )) }),
              /* @__PURE__ */ jsxRuntime.jsx("div", { className: "chess-launch-card__time", children: /* @__PURE__ */ jsxRuntime.jsxs("span", { className: "chess-panel-pill", children: [
                /* @__PURE__ */ jsxRuntime.jsx(lucideReact.TimerReset, { size: 14 }),
                " ",
                t("chess.page.timeControl")
              ] }) }),
              /* @__PURE__ */ jsxRuntime.jsx(
                "button",
                {
                  className: "app-btn chess-cta",
                  disabled: !!busyCommand || !connectedAgent || !canCreateOrJoin,
                  onClick: () => void createMatch(),
                  children: t("chess.commands.createMatch")
                }
              )
            ] }) : null,
            currentMatch ? /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "chess-room-detail is-current", children: [
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "chess-room-detail__header", children: [
                /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
                  /* @__PURE__ */ jsxRuntime.jsx("span", { className: "chess-stage-label", children: t("chess.page.currentRoomTitle") }),
                  /* @__PURE__ */ jsxRuntime.jsx("h3", { children: currentMatch.roomName })
                ] }),
                /* @__PURE__ */ jsxRuntime.jsx("span", { className: "chess-panel-pill mono", children: currentMatch.matchId })
              ] }),
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "chess-panel-pill-row", children: [
                /* @__PURE__ */ jsxRuntime.jsx("span", { className: "chess-panel-pill", children: visibilityLabel(currentMatch.visibility) }),
                /* @__PURE__ */ jsxRuntime.jsx("span", { className: "chess-panel-pill", children: t("chess.page.phaseChip", { value: currentMatch.phase }) }),
                /* @__PURE__ */ jsxRuntime.jsx("span", { className: "chess-panel-pill", children: t("chess.page.playersCount", { count: currentMatch.players.length }) }),
                /* @__PURE__ */ jsxRuntime.jsx("span", { className: "chess-panel-pill", children: t("chess.page.readyCount", { count: currentMatch.players.filter((player) => player.ready).length }) })
              ] }),
              /* @__PURE__ */ jsxRuntime.jsx("div", { className: "chess-room-detail__body", children: currentMatch.players.map((player) => /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "chess-room-detail__player", children: [
                /* @__PURE__ */ jsxRuntime.jsx("span", { children: player.agentName }),
                /* @__PURE__ */ jsxRuntime.jsx("span", { children: player.ready ? t("chess.page.ready") : t("common:status.waiting") })
              ] }, player.agentId)) }),
              /* @__PURE__ */ jsxRuntime.jsx("div", { className: "chess-room-detail__actions", children: renderWorkspaceActions() })
            ] }) : /* @__PURE__ */ jsxRuntime.jsx("div", { className: "chess-panel-empty", children: t("chess.page.currentRoomEmpty") })
          ] });
      }
    })();
    return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "page-wrap chess-com-shell", children: [
      /* @__PURE__ */ jsxRuntime.jsx("div", { className: "chess-com-shell__ambience", "aria-hidden": "true" }),
      !connectedAgent || errorText || runtime.error ? /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "chess-notice-stack", children: [
        !connectedAgent ? /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "chess-inline-notice chess-inline-notice--info", children: [
          t("chess.runtime.noAgent"),
          " ",
          /* @__PURE__ */ jsxRuntime.jsx(reactRouterDom.Link, { className: "chess-inline-link", to: "/lobby", children: t("nav:lobby") }),
          " / ",
          /* @__PURE__ */ jsxRuntime.jsx(reactRouterDom.Link, { className: "chess-inline-link", to: "/agents", children: t("nav:agents") })
        ] }) : null,
        errorText || runtime.error ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: "chess-inline-notice chess-inline-notice--error", children: /* @__PURE__ */ jsxRuntime.jsxs("span", { className: "chess-inline-notice__row", children: [
          /* @__PURE__ */ jsxRuntime.jsx(lucideReact.ShieldAlert, { size: 14 }),
          " ",
          errorText || runtime.error
        ] }) }) : null
      ] }) : null,
      /* @__PURE__ */ jsxRuntime.jsxs("section", { className: "chess-com-layout", children: [
        /* @__PURE__ */ jsxRuntime.jsx("main", { className: "chess-main-column", children: /* @__PURE__ */ jsxRuntime.jsx("section", { className: "chess-main-stage is-live", id: "play", children: !boardMatch ? /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "chess-stage-center chess-stage-center--live", children: [
          renderPlayerCard("b", null, DEFAULT_CLOCK_MS),
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "chess-board-shell chess-board-shell--live", children: /* @__PURE__ */ jsxRuntime.jsx("div", { className: "board-wrap board-wrap--live", children: renderBoard(previewBoardMatrix, false, false) }) }),
          renderPlayerCard("w", lobbySelfPreviewPlayer, DEFAULT_CLOCK_MS)
        ] }) : /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "chess-stage-center chess-stage-center--live", children: [
          renderPlayerCard(
            boardTopTone,
            topStagePlayer,
            resolveDisplayedClock(topStagePlayer, boardTopTone)
          ),
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "chess-board-shell chess-board-shell--live", children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "board-wrap board-wrap--live", children: [
            activeResultOverlay ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: "chess-result-overlay", role: "status", "aria-live": "polite", children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "chess-result-overlay__card", children: [
              /* @__PURE__ */ jsxRuntime.jsx(
                "button",
                {
                  type: "button",
                  className: "chess-result-overlay__close",
                  "aria-label": t("chess.page.dismissResultOverlay"),
                  onClick: () => setResultOverlay(null),
                  children: /* @__PURE__ */ jsxRuntime.jsx(lucideReact.X, { size: 16 })
                }
              ),
              /* @__PURE__ */ jsxRuntime.jsx("span", { className: "chess-stage-label", children: t("chess.page.resultLabel") }),
              /* @__PURE__ */ jsxRuntime.jsx("strong", { children: formatResultTitle(activeResultOverlay.result) }),
              /* @__PURE__ */ jsxRuntime.jsx("span", { className: "chess-result-overlay__room", children: activeResultOverlay.roomName }),
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "chess-result-overlay__meta", children: [
                /* @__PURE__ */ jsxRuntime.jsx("span", { children: formatReason(activeResultOverlay.result.reason) }),
                /* @__PURE__ */ jsxRuntime.jsx("span", { children: frontend.formatPluginDateTime(activeResultOverlay.result.endedAt) })
              ] }),
              boardMatchIsCurrent && activeResultOverlay.yourAgentId && typeof activeResultOverlay.result.ratingChanges[activeResultOverlay.yourAgentId] === "number" ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: "chess-result-overlay__delta", children: t("chess.page.yourEloDelta", {
                delta: `${activeResultOverlay.result.ratingChanges[activeResultOverlay.yourAgentId] > 0 ? "+" : ""}${activeResultOverlay.result.ratingChanges[activeResultOverlay.yourAgentId]}`
              }) }) : null
            ] }) }) : null,
            renderBoard(boardMatrix, isLiveMatch && boardMatchIsCurrent, true)
          ] }) }),
          renderPlayerCard(
            boardBottomTone,
            bottomStagePlayer,
            resolveDisplayedClock(bottomStagePlayer, boardBottomTone)
          )
        ] }) }) }),
        /* @__PURE__ */ jsxRuntime.jsxs("aside", { className: "chess-right-rail", children: [
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "chess-workspace-tabs", role: "tablist", "aria-label": t("chess.page.workspaceTabs"), children: workspaceTabs.map(({ key, icon: Icon, label }) => /* @__PURE__ */ jsxRuntime.jsxs(
            "button",
            {
              type: "button",
              className: `chess-workspace-tab ${workspaceTab === key ? "is-active" : ""}`,
              onClick: () => setWorkspaceTab(key),
              children: [
                /* @__PURE__ */ jsxRuntime.jsx(Icon, { size: 18 }),
                /* @__PURE__ */ jsxRuntime.jsx("span", { children: label })
              ]
            },
            key
          )) }),
          workspaceContent
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs(
        "div",
        {
          ref: orbRef,
          className: `chess-float-orb ${orbExpanded ? "is-expanded" : ""} ${orbDragging ? "is-dragging" : ""}`,
          style: { left: orbPosition.x, top: orbPosition.y },
          children: [
            /* @__PURE__ */ jsxRuntime.jsx(
              "button",
              {
                type: "button",
                className: "chess-float-orb__core",
                onPointerDown: startOrbGesture,
                onPointerMove: moveOrbGesture,
                onPointerUp: finishOrbGesture,
                onPointerCancel: cancelOrbGesture,
                onClick: (event) => {
                  if (event.detail === 0) {
                    setOrbExpanded((value) => !value);
                  }
                },
                children: orbExpanded ? /* @__PURE__ */ jsxRuntime.jsx(lucideReact.X, { size: 20 }) : /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Bot, { size: 20 })
              }
            ),
            orbExpanded ? /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "chess-float-orb__menu", children: [
              /* @__PURE__ */ jsxRuntime.jsxs("button", { className: "chess-float-orb__action", disabled: !!busyCommand || !connectedAgent, onClick: () => void refreshBootstrap("resyncing"), children: [
                /* @__PURE__ */ jsxRuntime.jsx(lucideReact.RefreshCw, { size: 16 }),
                /* @__PURE__ */ jsxRuntime.jsx("span", { children: t("chess.page.navSync") })
              ] }),
              /* @__PURE__ */ jsxRuntime.jsxs("button", { className: "chess-float-orb__action", disabled: !!busyCommand, onClick: () => void returnToPlay().catch((err) => setErrorText(err instanceof Error ? err.message : t("chess.runtime.returnToCityFailed"))), children: [
                /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Building2, { size: 16 }),
                /* @__PURE__ */ jsxRuntime.jsx("span", { children: t("chess.page.navCity") })
              ] }),
              /* @__PURE__ */ jsxRuntime.jsxs("button", { className: "chess-float-orb__action", disabled: !!busyCommand, onClick: () => void returnToLobby().catch((err) => setErrorText(err instanceof Error ? err.message : t("chess.runtime.returnToLobbyFailed"))), children: [
                /* @__PURE__ */ jsxRuntime.jsx(lucideReact.LayoutGrid, { size: 16 }),
                /* @__PURE__ */ jsxRuntime.jsx("span", { children: t("chess.page.navLobby") })
              ] })
            ] }) : null
          ]
        }
      ),
      promotionRequest ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: "promotion-overlay", children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "promotion-card", children: [
        /* @__PURE__ */ jsxRuntime.jsx("p", { className: "chess-stage-label", children: t("chess.page.promotionKicker") }),
        /* @__PURE__ */ jsxRuntime.jsx("h3", { children: t("chess.page.promotionTitle") }),
        /* @__PURE__ */ jsxRuntime.jsx("p", { className: "promotion-card__copy", children: t("chess.page.promotionBody", { from: promotionRequest.from, to: promotionRequest.to }) }),
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "promotion-grid", children: ["q", "r", "b", "n"].map((piece) => {
          const code = currentMatch?.yourColor === "b" ? piece : piece.toUpperCase();
          const labelMap = {
            q: t("chess.page.promotionQueen"),
            r: t("chess.page.promotionRook"),
            b: t("chess.page.promotionBishop"),
            n: t("chess.page.promotionKnight")
          };
          return /* @__PURE__ */ jsxRuntime.jsxs(
            "button",
            {
              className: "promotion-option",
              onClick: () => void executeMove(promotionRequest.from, promotionRequest.to, piece),
              children: [
                /* @__PURE__ */ jsxRuntime.jsx(ChessPieceIcon, { piece: code, className: "promotion-piece" }),
                /* @__PURE__ */ jsxRuntime.jsx("span", { children: labelMap[piece] })
              ]
            },
            piece
          );
        }) }),
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "promotion-card__actions", children: /* @__PURE__ */ jsxRuntime.jsx("button", { className: "app-btn ghost", onClick: () => setPromotionRequest(null), children: t("chess.page.cancel") }) })
      ] }) }) : null
    ] });
  }
  const ChessPage$1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    ChessPage
  }, Symbol.toStringTag, { value: "Module" }));
})(__uruc_plugin_globals.UrucPluginSdkFrontend, __uruc_plugin_globals.I18next, __uruc_plugin_globals.ReactJsxRuntime, __uruc_plugin_globals.React, __uruc_plugin_globals.UrucPluginSdkFrontendReact, __uruc_plugin_globals.ReactRouterDom, __uruc_plugin_globals.LucideReact, __uruc_plugin_globals.ReactI18next);
