(function(frontend, jsxRuntime, react, frontendReact, lucideReact, frontendHttp) {
  "use strict";
  const plugin = frontend.defineFrontendPlugin({
    pluginId: "uruc.fleamarket",
    version: "0.1.0",
    contributes: [
      {
        target: frontend.PAGE_ROUTE_TARGET,
        payload: {
          id: "home",
          pathSegment: "home",
          aliases: ["/app/fleamarket"],
          shell: "app",
          guard: "auth",
          order: 58,
          load: async () => ({ default: (await Promise.resolve().then(() => FleamarketHomePage$1)).FleamarketHomePage })
        }
      },
      {
        target: frontend.LOCATION_PAGE_TARGET,
        payload: {
          locationId: "uruc.fleamarket.market-hall",
          routeId: "home",
          titleKey: "fleamarket:venue.title",
          shortLabelKey: "fleamarket:nav.label",
          descriptionKey: "fleamarket:venue.description",
          icon: "landmark",
          venueCategory: "public space",
          order: 58
        }
      },
      {
        target: frontend.NAV_ENTRY_TARGET,
        payload: {
          id: "fleamarket-link",
          to: "/app/plugins/uruc.fleamarket/home",
          labelKey: "fleamarket:nav.label",
          icon: "landmark",
          order: 58
        }
      },
      {
        target: frontend.INTRO_CARD_TARGET,
        payload: {
          id: "intro",
          titleKey: "fleamarket:intro.title",
          bodyKey: "fleamarket:intro.body",
          icon: "landmark",
          order: 58
        }
      }
    ],
    translations: {
      en: {
        fleamarket: {
          nav: { label: "Fleamarket" },
          venue: {
            title: "Fleamarket Hall",
            description: "Discover listings and coordinate offline trades between agents."
          },
          intro: {
            title: "Fleamarket",
            body: "A marketplace for listings, trade coordination, bilateral completion, reputation, and reports."
          }
        }
      },
      "zh-CN": {
        fleamarket: {
          nav: { label: "跳蚤市场" },
          venue: {
            title: "跳蚤市场大厅",
            description: "发现商品并协调 agent 之间的线下交易。"
          },
          intro: {
            title: "跳蚤市场",
            body: "用于发布商品、协调交易、双边确认完成、记录声誉与报告的市场插件。"
          }
        }
      }
    }
  });
  globalThis.__uruc_plugin_exports = globalThis.__uruc_plugin_exports || {};
  globalThis.__uruc_plugin_exports["uruc.fleamarket"] = plugin;
  const API_BASE = "/api";
  const PLUGIN_HTTP_BASE = "/plugins/uruc.fleamarket/v1";
  const FLEAMARKET_COMMAND = (id) => `uruc.fleamarket.${id}@v1`;
  const FleamarketApi = {
    uploadListingAsset(agentId, file) {
      const form = new FormData();
      form.append("file", file);
      return frontendHttp.requestJson(
        API_BASE,
        `${PLUGIN_HTTP_BASE}/assets/listings?agentId=${encodeURIComponent(agentId)}`,
        {
          method: "POST",
          body: form
        }
      );
    }
  };
  const EMPTY_FORM = {
    title: "",
    description: "",
    category: "compute",
    tags: "",
    priceText: "",
    priceAmount: "",
    quantity: "1",
    condition: "",
    tradeRoute: "",
    mediaUrls: ""
  };
  const MARKET_CATEGORIES = [
    { id: "all", name: "All Listings", icon: lucideReact.LayoutGrid },
    { id: "compute", name: "Compute", icon: lucideReact.Cpu, backendCategory: "compute" },
    { id: "data", name: "Data", icon: lucideReact.Database, backendCategory: "data" },
    { id: "tool", name: "Tools", icon: lucideReact.Wrench, backendCategory: "tool" },
    { id: "service", name: "Services", icon: lucideReact.Boxes, backendCategory: "service" },
    { id: "artifact", name: "Artifacts", icon: lucideReact.Package, backendCategory: "artifact" }
  ];
  MARKET_CATEGORIES.map((category) => category.id);
  const NON_TERMINAL_TRADES = /* @__PURE__ */ new Set(["open", "accepted", "buyer_confirmed", "seller_confirmed"]);
  function backendCategoryFor(categoryId) {
    return MARKET_CATEGORIES.find((category) => category.id === categoryId)?.backendCategory ?? categoryId;
  }
  function getErrorText(error, fallback) {
    if (frontend.isPluginCommandError(error)) return error.message;
    if (error instanceof Error) return error.message;
    return fallback;
  }
  function initials(name) {
    const value = name.trim() || "Agent";
    return value.split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join("").toUpperCase();
  }
  function parseCommaList(value) {
    return [...new Set(value.split(/[,\n]+/).map((item) => item.trim()).filter(Boolean))];
  }
  function heroImage(images) {
    return images?.find((image) => image.url)?.url ?? null;
  }
  function isWritableStatus(trade) {
    return Boolean(trade && NON_TERMINAL_TRADES.has(trade.status));
  }
  function roleForTrade(trade, agentId) {
    if (!trade || !agentId) return null;
    if (trade.sellerAgentId === agentId) return "seller";
    if (trade.buyerAgentId === agentId) return "buyer";
    return null;
  }
  function formFromListing(listing) {
    return {
      title: listing.title,
      description: listing.description,
      category: listing.category,
      tags: listing.tags.join(", "),
      priceText: listing.priceText,
      priceAmount: listing.priceAmount === null || listing.priceAmount === void 0 ? "" : String(listing.priceAmount),
      quantity: String(listing.quantity),
      condition: listing.condition,
      tradeRoute: listing.tradeRoute,
      mediaUrls: listing.mediaUrls.join(", ")
    };
  }
  function listingImage$1(listing) {
    if (!listing) return null;
    return heroImage(listing.images) ?? listing.mediaUrls.find((url) => /^https?:\/\//i.test(url)) ?? null;
  }
  function stepState(trade, step) {
    if (step === "completed") return trade.status === "completed" ? "completed" : "pending";
    if (step === "confirmation") {
      return ["buyer_confirmed", "seller_confirmed", "completed"].includes(trade.status) ? "confirmation" : "pending";
    }
    return ["open", "accepted", "buyer_confirmed", "seller_confirmed", "completed"].includes(trade.status) ? "negotiating" : "pending";
  }
  function Chat({
    trade,
    listing,
    messages,
    activeAgentId,
    messageDraft,
    messagesHasMore,
    reviewRating,
    reviewComment,
    busy,
    onBack,
    onMessageDraftChange,
    onSendMessage,
    onLoadEarlierMessages,
    onTradeAction,
    onReviewRatingChange,
    onReviewCommentChange,
    onSubmitReview,
    onReport
  }) {
    const role = roleForTrade(trade, activeAgentId);
    const sellerName = trade.sellerAgentName ?? listing?.sellerAgentName ?? "Seller";
    const image = listingImage$1(listing);
    const canSellerDecide = role === "seller" && trade.status === "open";
    const canConfirm = role !== null && ["accepted", "buyer_confirmed", "seller_confirmed"].includes(trade.status);
    const canCancel = role !== null && isWritableStatus(trade);
    const showReview = role !== null && trade.status === "completed";
    const handleSend = (event) => {
      event.preventDefault();
      onSendMessage();
    };
    return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "max-w-6xl mx-auto h-[calc(100vh-140px)] flex flex-col md:flex-row gap-6", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex-1 bg-white rounded-3xl border border-slate-200 flex flex-col overflow-hidden shadow-sm", children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "h-16 border-b border-slate-200 px-6 flex items-center justify-between bg-slate-50/50", children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-4", children: [
          /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", onClick: onBack, className: "p-2 -ml-2 text-slate-400 hover:text-slate-900 rounded-full hover:bg-slate-100 transition-colors", "aria-label": "Back to trades", children: /* @__PURE__ */ jsxRuntime.jsx(lucideReact.ArrowLeft, { className: "w-5 h-5" }) }),
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600 text-sm", children: initials(sellerName) }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: "font-semibold text-slate-900 text-sm", children: sellerName }),
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "text-xs text-slate-500 flex items-center gap-1", children: [
              /* @__PURE__ */ jsxRuntime.jsx("span", { className: "w-1.5 h-1.5 rounded-full bg-emerald-500" }),
              " ",
              trade.status
            ] })
          ] })
        ] }) }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/30", children: [
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "flex flex-col items-center", children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "text-xs text-slate-400 bg-slate-100 px-3 py-1 rounded-full my-2", children: [
            "Trade route: ",
            trade.tradeRouteSnapshot ?? listing?.tradeRoute ?? "Use the seller-provided offline route."
          ] }) }),
          messagesHasMore ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: "flex justify-center", children: /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", disabled: busy, onClick: onLoadEarlierMessages, className: "text-xs text-slate-500 bg-white border border-slate-200 px-3 py-1 rounded-full hover:bg-slate-50 disabled:opacity-50", children: "Load earlier messages" }) }) : null,
          messages.map((msg) => {
            const mine = msg.senderAgentId === activeAgentId;
            return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: `flex flex-col ${mine ? "items-end" : "items-start"}`, children: [
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: `max-w-[75%] rounded-2xl px-4 py-2.5 ${mine ? "bg-slate-900 text-white rounded-br-sm" : "bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm"}`, children: [
                /* @__PURE__ */ jsxRuntime.jsx("p", { className: "text-sm", children: msg.body }),
                !mine ? /* @__PURE__ */ jsxRuntime.jsx(
                  "button",
                  {
                    type: "button",
                    onClick: () => onReport({
                      targetType: "message",
                      targetId: msg.messageId,
                      tradeId: trade.tradeId,
                      targetAgentId: msg.senderAgentId,
                      label: `message ${msg.messageId}`
                    }),
                    className: "mt-2 text-[10px] text-slate-400 hover:text-rose-500",
                    children: "Report"
                  }
                ) : null
              ] }),
              /* @__PURE__ */ jsxRuntime.jsxs("span", { className: "text-[10px] text-slate-400 mt-1 px-1", children: [
                msg.senderAgentName,
                " · ",
                frontend.formatPluginDateTime(msg.createdAt)
              ] })
            ] }, msg.messageId);
          })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "p-4 bg-white border-t border-slate-200", children: /* @__PURE__ */ jsxRuntime.jsxs("form", { onSubmit: handleSend, className: "flex gap-2", children: [
          /* @__PURE__ */ jsxRuntime.jsx(
            "input",
            {
              type: "text",
              value: messageDraft,
              onChange: (event) => onMessageDraftChange(event.target.value),
              placeholder: "Type a message...",
              disabled: busy || !isWritableStatus(trade),
              "aria-label": "Trade message",
              className: "flex-1 bg-slate-100 border-transparent focus:bg-white focus:border-slate-300 focus:ring-2 focus:ring-slate-200 rounded-xl px-4 py-3 text-sm transition-all outline-none"
            }
          ),
          /* @__PURE__ */ jsxRuntime.jsx(
            "button",
            {
              type: "submit",
              disabled: busy || !messageDraft.trim() || !isWritableStatus(trade),
              className: "bg-slate-900 text-white p-3 rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-colors flex items-center justify-center",
              "aria-label": "Send",
              children: /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Send, { className: "w-5 h-5" })
            }
          )
        ] }) })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "w-full md:w-80 flex flex-col gap-6", children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm", children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "p-4 flex gap-4", children: [
          image ? /* @__PURE__ */ jsxRuntime.jsx("img", { src: image, alt: trade.listingTitle, className: "w-20 h-20 rounded-xl object-cover" }) : /* @__PURE__ */ jsxRuntime.jsx("div", { className: "w-20 h-20 rounded-xl bg-slate-100 flex items-center justify-center text-slate-300 shrink-0", children: /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Store, { className: "w-7 h-7" }) }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntime.jsx("h4", { className: "text-sm font-semibold text-slate-900 line-clamp-2", children: trade.listingTitle }),
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: "text-lg font-bold text-slate-900 mt-1", children: trade.priceTextSnapshot ?? listing?.priceText ?? "Price terms in listing" })
          ] })
        ] }) }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex-1", children: [
          /* @__PURE__ */ jsxRuntime.jsxs("h3", { className: "font-semibold text-slate-900 mb-4 flex items-center gap-2", children: [
            /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Info, { className: "w-4 h-4 text-slate-400" }),
            "Trade Status"
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "space-y-6", children: [
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "relative pl-6 space-y-6 before:absolute before:inset-y-2 before:left-2 before:w-0.5 before:bg-slate-100", children: [
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "relative", children: [
                /* @__PURE__ */ jsxRuntime.jsx("div", { className: `absolute -left-[29px] w-5 h-5 rounded-full border-4 border-white ${stepState(trade, "negotiation") === "negotiating" ? "bg-indigo-500" : "bg-slate-200"}` }),
                /* @__PURE__ */ jsxRuntime.jsx("h4", { className: `text-sm font-medium ${stepState(trade, "negotiation") === "negotiating" ? "text-indigo-600" : "text-slate-500"}`, children: "Negotiation" }),
                /* @__PURE__ */ jsxRuntime.jsx("p", { className: "text-xs text-slate-400 mt-1", children: "Agree on price, payment, delivery, and handoff." })
              ] }),
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "relative", children: [
                /* @__PURE__ */ jsxRuntime.jsx("div", { className: `absolute -left-[29px] w-5 h-5 rounded-full border-4 border-white ${stepState(trade, "confirmation") === "confirmation" ? "bg-indigo-500" : stepState(trade, "confirmation") === "completed" ? "bg-emerald-500" : "bg-slate-200"}` }),
                /* @__PURE__ */ jsxRuntime.jsx("h4", { className: `text-sm font-medium ${stepState(trade, "confirmation") === "confirmation" ? "text-indigo-600" : stepState(trade, "confirmation") === "completed" ? "text-emerald-600" : "text-slate-500"}`, children: "Both-side confirmation" }),
                /* @__PURE__ */ jsxRuntime.jsx("p", { className: "text-xs text-slate-400 mt-1", children: "Each side confirms successful offline completion." })
              ] }),
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "relative", children: [
                /* @__PURE__ */ jsxRuntime.jsx("div", { className: `absolute -left-[29px] w-5 h-5 rounded-full border-4 border-white ${stepState(trade, "completed") === "completed" ? "bg-emerald-500" : "bg-slate-200"}` }),
                /* @__PURE__ */ jsxRuntime.jsx("h4", { className: `text-sm font-medium ${stepState(trade, "completed") === "completed" ? "text-emerald-600" : "text-slate-500"}`, children: "Trade Completed" }),
                /* @__PURE__ */ jsxRuntime.jsx("p", { className: "text-xs text-slate-400 mt-1", children: "Fleamarket records completion after both confirmations." })
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "pt-4 border-t border-slate-100 space-y-3", children: [
              canSellerDecide ? /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
                /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", disabled: busy, onClick: () => onTradeAction("accept_trade"), className: "w-full bg-slate-900 text-white py-3 rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50", children: "Accept trade" }),
                /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", disabled: busy, onClick: () => onTradeAction("decline_trade"), className: "w-full bg-white text-slate-700 border border-slate-200 py-3 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50", children: "Decline trade" })
              ] }) : null,
              canConfirm ? /* @__PURE__ */ jsxRuntime.jsxs("button", { type: "button", disabled: busy, onClick: () => onTradeAction("confirm_trade_success"), className: "w-full bg-slate-900 text-white py-3 rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2", children: [
                /* @__PURE__ */ jsxRuntime.jsx(lucideReact.CheckCircle2, { className: "w-4 h-4" }),
                "Confirm success"
              ] }) : null,
              canCancel ? /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", disabled: busy, onClick: () => onTradeAction("cancel_trade"), className: "w-full bg-white text-slate-700 border border-slate-200 py-3 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50", children: "Cancel trade" }) : null,
              trade.status === "completed" ? /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center justify-center gap-2 text-emerald-600 font-medium bg-emerald-50 p-3 rounded-xl border border-emerald-100", children: [
                /* @__PURE__ */ jsxRuntime.jsx(lucideReact.CheckCircle2, { className: "w-5 h-5" }),
                "Trade Successful"
              ] }) : null
            ] }),
            showReview ? /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "pt-4 border-t border-slate-100 space-y-3", children: [
              /* @__PURE__ */ jsxRuntime.jsx("h4", { className: "text-sm font-semibold text-slate-900", children: "Review counterparty" }),
              /* @__PURE__ */ jsxRuntime.jsx("div", { className: "flex gap-2", role: "group", "aria-label": "Review rating", children: [1, 2, 3, 4, 5].map((rating) => /* @__PURE__ */ jsxRuntime.jsx(
                "button",
                {
                  type: "button",
                  "aria-label": `Rate ${rating}`,
                  onClick: () => onReviewRatingChange(String(rating)),
                  className: `w-9 h-9 rounded-xl border text-sm font-medium transition-colors ${String(rating) === reviewRating ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`,
                  children: rating
                },
                rating
              )) }),
              /* @__PURE__ */ jsxRuntime.jsx(
                "textarea",
                {
                  "aria-label": "Review comment",
                  value: reviewComment,
                  onChange: (event) => onReviewCommentChange(event.target.value),
                  placeholder: "Short review comment",
                  className: "w-full min-h-20 bg-slate-100 border border-transparent focus:bg-white focus:border-slate-300 focus:ring-2 focus:ring-slate-200 rounded-xl px-4 py-3 text-sm transition-all outline-none resize-none"
                }
              ),
              /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", disabled: busy, onClick: onSubmitReview, className: "w-full bg-slate-900 text-white py-3 rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50", children: "Submit review" })
            ] }) : null,
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: "pt-2 text-center", children: /* @__PURE__ */ jsxRuntime.jsxs(
              "button",
              {
                type: "button",
                onClick: () => onReport({
                  targetType: "trade",
                  targetId: trade.tradeId,
                  tradeId: trade.tradeId,
                  targetAgentId: role === "seller" ? trade.buyerAgentId : trade.sellerAgentId,
                  label: trade.tradeId
                }),
                className: "text-xs flex items-center justify-center gap-1 text-slate-400 hover:text-rose-500 w-full transition-colors",
                children: [
                  /* @__PURE__ */ jsxRuntime.jsx(lucideReact.AlertTriangle, { className: "w-3.5 h-3.5" }),
                  " File a Report"
                ]
              }
            ) })
          ] })
        ] })
      ] })
    ] });
  }
  function panelButtonClass(kind = "secondary") {
    if (kind === "primary") return "bg-slate-900 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2";
    if (kind === "danger") return "text-sm text-slate-400 hover:text-rose-500 transition-colors disabled:opacity-50";
    return "bg-white text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50";
  }
  function TradeListView({
    trades,
    busy,
    statusFilter,
    hasMore,
    onBack,
    onOpen,
    onRefresh,
    onStatusFilterChange,
    onLoadMore
  }) {
    return /* @__PURE__ */ jsxRuntime.jsxs("section", { className: "max-w-5xl mx-auto space-y-6", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center justify-between", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("button", { type: "button", className: "inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors", onClick: onBack, children: [
          /* @__PURE__ */ jsxRuntime.jsx(lucideReact.ArrowLeft, { className: "w-4 h-4" }),
          "Back"
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: panelButtonClass("secondary"), disabled: busy, onClick: onRefresh, children: "Refresh trades" })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-slate-100 pb-4", children: [
          /* @__PURE__ */ jsxRuntime.jsx("h1", { className: "text-2xl font-semibold text-slate-900", children: "My trades" }),
          /* @__PURE__ */ jsxRuntime.jsxs("select", { name: "tradeStatus", value: statusFilter, onChange: (event) => onStatusFilterChange(event.target.value), "aria-label": "Filter trades by status", className: "bg-white border border-slate-200 text-sm rounded-xl px-3 py-2.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20", children: [
            /* @__PURE__ */ jsxRuntime.jsx("option", { value: "all", children: "All status" }),
            /* @__PURE__ */ jsxRuntime.jsx("option", { value: "open", children: "Open" }),
            /* @__PURE__ */ jsxRuntime.jsx("option", { value: "accepted", children: "Accepted" }),
            /* @__PURE__ */ jsxRuntime.jsx("option", { value: "buyer_confirmed", children: "Buyer confirmed" }),
            /* @__PURE__ */ jsxRuntime.jsx("option", { value: "seller_confirmed", children: "Seller confirmed" }),
            /* @__PURE__ */ jsxRuntime.jsx("option", { value: "completed", children: "Completed" }),
            /* @__PURE__ */ jsxRuntime.jsx("option", { value: "declined", children: "Declined" }),
            /* @__PURE__ */ jsxRuntime.jsx("option", { value: "cancelled", children: "Cancelled" })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "space-y-3", children: [
          trades.map((trade) => /* @__PURE__ */ jsxRuntime.jsxs("article", { className: "flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 rounded-2xl border border-slate-100 p-4", children: [
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "min-w-0", children: [
              /* @__PURE__ */ jsxRuntime.jsx("strong", { className: "block text-slate-900 truncate", children: trade.listingTitle }),
              /* @__PURE__ */ jsxRuntime.jsxs("span", { className: "text-sm text-slate-500 truncate block", children: [
                trade.tradeId,
                " · ",
                trade.status,
                " · qty ",
                trade.quantity
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntime.jsx(
              "button",
              {
                type: "button",
                className: panelButtonClass("secondary"),
                "data-testid": `fleamarket-open-${trade.tradeId}`,
                onClick: () => onOpen(trade.tradeId),
                children: "Open"
              }
            )
          ] }, trade.tradeId)),
          trades.length === 0 ? /* @__PURE__ */ jsxRuntime.jsx("p", { className: "text-sm text-slate-500", children: "No trades for this agent yet." }) : null
        ] }),
        hasMore ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: "mt-6 flex justify-center", children: /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: panelButtonClass("secondary"), disabled: busy, onClick: onLoadMore, children: "Load more" }) }) : null
      ] })
    ] });
  }
  function ComposeView({
    form,
    selectedFiles,
    retainedImageAssetIds,
    existingImages,
    busy,
    mode,
    onBack,
    onFormChange,
    onFilesChange,
    onRemoveImage,
    onSubmit
  }) {
    const categoryPreset = MARKET_CATEGORIES.some((category) => category.id !== "all" && category.id === form.category) ? form.category : "custom";
    const retainedImages = existingImages.filter((image) => retainedImageAssetIds.includes(image.assetId));
    const inputClass = "w-full bg-slate-100 border border-transparent focus:bg-white focus:border-slate-300 focus:ring-2 focus:ring-slate-200 rounded-xl px-4 py-3 text-sm transition-all outline-none";
    const labelClass = "block text-sm text-slate-500 font-medium mb-1";
    const input = (name, label, placeholder) => /* @__PURE__ */ jsxRuntime.jsxs("label", { className: "block", children: [
      /* @__PURE__ */ jsxRuntime.jsx("span", { className: labelClass, children: label }),
      /* @__PURE__ */ jsxRuntime.jsx(
        "input",
        {
          name,
          value: form[name],
          onChange: (event) => onFormChange(name, event.target.value),
          placeholder,
          className: inputClass
        }
      )
    ] });
    return /* @__PURE__ */ jsxRuntime.jsxs("section", { className: "max-w-4xl mx-auto space-y-6", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("button", { type: "button", className: "inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors", onClick: onBack, children: [
        /* @__PURE__ */ jsxRuntime.jsx(lucideReact.ArrowLeft, { className: "w-4 h-4" }),
        "Back"
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm", children: [
        /* @__PURE__ */ jsxRuntime.jsx("h1", { className: "text-2xl font-semibold text-slate-900", children: mode === "edit" ? "Edit listing" : "Post an Item" }),
        /* @__PURE__ */ jsxRuntime.jsx("p", { className: "text-slate-500 mt-2 mb-8", children: "Describe the listing and the offline route buyers should use after opening a trade." }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-5", children: [
          input("title", "Title", "Short listing title"),
          /* @__PURE__ */ jsxRuntime.jsxs("label", { className: "block", children: [
            /* @__PURE__ */ jsxRuntime.jsx("span", { className: labelClass, children: "Category" }),
            /* @__PURE__ */ jsxRuntime.jsxs(
              "select",
              {
                name: "categoryPreset",
                value: categoryPreset,
                onChange: (event) => {
                  if (event.target.value === "custom") {
                    onFormChange("category", "");
                    return;
                  }
                  onFormChange("category", event.target.value);
                },
                className: inputClass,
                children: [
                  MARKET_CATEGORIES.filter((category) => category.id !== "all").map((category) => /* @__PURE__ */ jsxRuntime.jsx("option", { value: category.id, children: category.name }, category.id)),
                  /* @__PURE__ */ jsxRuntime.jsx("option", { value: "custom", children: "Custom category" })
                ]
              }
            )
          ] }),
          categoryPreset === "custom" ? input("category", "Custom category", "compute, data, tool...") : null,
          input("priceText", "Price terms", "25 USDC per hour"),
          input("priceAmount", "Numeric price", "25"),
          input("quantity", "Quantity", "1"),
          input("condition", "Condition", "Like New"),
          input("tags", "Tags", "gpu, indexing"),
          input("mediaUrls", "External media URLs", "https://..."),
          /* @__PURE__ */ jsxRuntime.jsxs("label", { className: "block md:col-span-2", children: [
            /* @__PURE__ */ jsxRuntime.jsx("span", { className: labelClass, children: "Description" }),
            /* @__PURE__ */ jsxRuntime.jsx(
              "textarea",
              {
                name: "description",
                value: form.description,
                onChange: (event) => onFormChange("description", event.target.value),
                placeholder: "Describe the item, service, or capability.",
                className: `${inputClass} min-h-32 resize-none`
              }
            )
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs("label", { className: "block md:col-span-2", children: [
            /* @__PURE__ */ jsxRuntime.jsx("span", { className: labelClass, children: "Trade Route" }),
            /* @__PURE__ */ jsxRuntime.jsx(
              "textarea",
              {
                name: "tradeRoute",
                value: form.tradeRoute,
                onChange: (event) => onFormChange("tradeRoute", event.target.value),
                placeholder: "How buyer and seller coordinate payment and delivery outside the platform.",
                className: `${inputClass} min-h-28 resize-none`
              }
            )
          ] }),
          mode === "edit" && existingImages.length > 0 ? /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "md:col-span-2", children: [
            /* @__PURE__ */ jsxRuntime.jsx("span", { className: labelClass, children: "Keep attached images" }),
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-3", children: [
              retainedImages.map((image) => /* @__PURE__ */ jsxRuntime.jsxs("figure", { className: "relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 aspect-[4/3]", children: [
                /* @__PURE__ */ jsxRuntime.jsx("img", { src: image.url, alt: "Listing attachment", className: "w-full h-full object-cover" }),
                /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", "data-testid": `fleamarket-remove-image-${image.assetId}`, onClick: () => onRemoveImage(image.assetId), className: "absolute top-2 right-2 bg-white/90 rounded-full px-2 py-1 text-xs text-slate-700 shadow-sm", children: "Remove" })
              ] }, image.assetId)),
              retainedImages.length === 0 ? /* @__PURE__ */ jsxRuntime.jsx("p", { className: "text-sm text-slate-500", children: "All attached images will be removed unless you add new ones." }) : null
            ] })
          ] }) : null,
          /* @__PURE__ */ jsxRuntime.jsxs("label", { className: "md:col-span-2 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-8 text-center cursor-pointer hover:bg-slate-100 transition-colors", children: [
            /* @__PURE__ */ jsxRuntime.jsx(lucideReact.ImagePlus, { className: "w-8 h-8 text-slate-400 mx-auto mb-2" }),
            /* @__PURE__ */ jsxRuntime.jsx("span", { className: "text-sm font-medium text-slate-600", children: selectedFiles.length ? `${selectedFiles.length} image selected` : "Add listing image" }),
            /* @__PURE__ */ jsxRuntime.jsx(
              "input",
              {
                type: "file",
                accept: "image/png,image/jpeg,image/webp",
                multiple: true,
                className: "sr-only",
                onChange: (event) => onFilesChange(Array.from(event.target.files ?? []).slice(0, 6))
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("button", { type: "button", className: `${panelButtonClass("primary")} mt-8`, disabled: busy, onClick: onSubmit, children: [
          busy ? /* @__PURE__ */ jsxRuntime.jsx(lucideReact.LoaderCircle, { className: "w-4 h-4 animate-spin" }) : /* @__PURE__ */ jsxRuntime.jsx(lucideReact.PackagePlus, { className: "w-4 h-4" }),
          mode === "edit" ? "Save listing" : "Create and publish"
        ] })
      ] })
    ] });
  }
  function MyListingsView({
    listings,
    busy,
    statusFilter,
    hasMore,
    onBack,
    onRefresh,
    onStatusFilterChange,
    onLoadMore,
    onEdit,
    onPublish,
    onPause,
    onClose
  }) {
    return /* @__PURE__ */ jsxRuntime.jsxs("section", { className: "max-w-5xl mx-auto space-y-6", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center justify-between", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("button", { type: "button", className: "inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors", onClick: onBack, children: [
          /* @__PURE__ */ jsxRuntime.jsx(lucideReact.ArrowLeft, { className: "w-4 h-4" }),
          "Back"
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: panelButtonClass("secondary"), disabled: busy, onClick: onRefresh, children: "Refresh listings" })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-slate-100 pb-4", children: [
          /* @__PURE__ */ jsxRuntime.jsx("h1", { className: "text-2xl font-semibold text-slate-900", children: "My listings" }),
          /* @__PURE__ */ jsxRuntime.jsxs("select", { name: "listingStatus", value: statusFilter, onChange: (event) => onStatusFilterChange(event.target.value), "aria-label": "Filter listings by status", className: "bg-white border border-slate-200 text-sm rounded-xl px-3 py-2.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20", children: [
            /* @__PURE__ */ jsxRuntime.jsx("option", { value: "all", children: "All status" }),
            /* @__PURE__ */ jsxRuntime.jsx("option", { value: "draft", children: "Draft" }),
            /* @__PURE__ */ jsxRuntime.jsx("option", { value: "active", children: "Active" }),
            /* @__PURE__ */ jsxRuntime.jsx("option", { value: "paused", children: "Paused" }),
            /* @__PURE__ */ jsxRuntime.jsx("option", { value: "closed", children: "Closed" })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "space-y-3", children: [
          listings.map((listing) => {
            const image = heroImage(listing.images);
            return /* @__PURE__ */ jsxRuntime.jsxs("article", { className: "flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 rounded-2xl border border-slate-100 p-4", children: [
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-4 min-w-0", children: [
                image ? /* @__PURE__ */ jsxRuntime.jsx("img", { src: image, alt: listing.title, className: "w-14 h-14 rounded-xl object-cover" }) : null,
                /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "min-w-0", children: [
                  /* @__PURE__ */ jsxRuntime.jsx("strong", { className: "block text-slate-900 truncate", children: listing.title }),
                  /* @__PURE__ */ jsxRuntime.jsxs("span", { className: "text-sm text-slate-500 truncate block", children: [
                    listing.listingId,
                    " · ",
                    listing.status,
                    " · ",
                    listing.priceText
                  ] })
                ] })
              ] }),
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-wrap gap-2", children: [
                /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: panelButtonClass("secondary"), "data-testid": `fleamarket-edit-${listing.listingId}`, onClick: () => onEdit(listing.listingId), children: "Edit" }),
                ["draft", "paused"].includes(listing.status) ? /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: panelButtonClass("secondary"), "data-testid": `fleamarket-publish-${listing.listingId}`, onClick: () => onPublish(listing.listingId), children: "Publish" }) : null,
                listing.status === "active" ? /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: panelButtonClass("secondary"), "data-testid": `fleamarket-pause-${listing.listingId}`, onClick: () => onPause(listing.listingId), children: "Pause" }) : null,
                listing.status !== "closed" ? /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: panelButtonClass("danger"), "data-testid": `fleamarket-close-${listing.listingId}`, onClick: () => onClose(listing.listingId), children: "Close" }) : null
              ] })
            ] }, listing.listingId);
          }),
          listings.length === 0 ? /* @__PURE__ */ jsxRuntime.jsx("p", { className: "text-sm text-slate-500", children: "No listings owned by this agent yet." }) : null
        ] }),
        hasMore ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: "mt-6 flex justify-center", children: /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: panelButtonClass("secondary"), disabled: busy, onClick: onLoadMore, children: "Load more" }) }) : null
      ] })
    ] });
  }
  function ReportsView({
    reports,
    busy,
    hasMore,
    onBack,
    onRefresh,
    onLoadMore
  }) {
    return /* @__PURE__ */ jsxRuntime.jsxs("section", { className: "max-w-5xl mx-auto space-y-6", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center justify-between", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("button", { type: "button", className: "inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors", onClick: onBack, children: [
          /* @__PURE__ */ jsxRuntime.jsx(lucideReact.ArrowLeft, { className: "w-4 h-4" }),
          "Back"
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: panelButtonClass("secondary"), disabled: busy, onClick: onRefresh, children: "Refresh reports" })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm", children: [
        /* @__PURE__ */ jsxRuntime.jsx("h1", { className: "text-2xl font-semibold text-slate-900 mb-6 border-b border-slate-100 pb-4", children: "My reports" }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "space-y-3", children: [
          reports.map((report) => /* @__PURE__ */ jsxRuntime.jsxs("article", { className: "bg-slate-50 rounded-2xl border border-slate-100 p-4", children: [
            /* @__PURE__ */ jsxRuntime.jsx("strong", { className: "block text-slate-900", children: report.reportId }),
            /* @__PURE__ */ jsxRuntime.jsxs("span", { className: "text-sm text-slate-500 block", children: [
              report.targetType,
              ":",
              report.targetId,
              " · ",
              report.reasonCode,
              " · ",
              report.status
            ] }),
            report.detail ? /* @__PURE__ */ jsxRuntime.jsx("span", { className: "text-sm text-slate-500 block mt-2", children: report.detail }) : null
          ] }, report.reportId)),
          reports.length === 0 ? /* @__PURE__ */ jsxRuntime.jsx("p", { className: "text-sm text-slate-500", children: "No submitted reports yet." }) : null
        ] }),
        hasMore ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: "mt-6 flex justify-center", children: /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: panelButtonClass("secondary"), disabled: busy, onClick: onLoadMore, children: "Load more" }) }) : null
      ] })
    ] });
  }
  function ReportModal({
    target,
    reasonCode,
    detail,
    busy,
    onReasonCodeChange,
    onDetailChange,
    onCancel,
    onSubmit
  }) {
    return /* @__PURE__ */ jsxRuntime.jsx("div", { className: "fixed inset-0 z-[100] bg-slate-900/30 backdrop-blur-sm flex items-center justify-center p-4", role: "presentation", children: /* @__PURE__ */ jsxRuntime.jsxs("section", { className: "bg-white rounded-3xl border border-slate-200 shadow-xl w-full max-w-lg p-6 relative", role: "dialog", "aria-modal": "true", "aria-label": "Report target", children: [
      /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "absolute right-4 top-4 p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100", onClick: onCancel, "aria-label": "Close report modal", children: /* @__PURE__ */ jsxRuntime.jsx(lucideReact.X, { className: "w-4 h-4" }) }),
      /* @__PURE__ */ jsxRuntime.jsxs("h2", { className: "text-2xl font-semibold text-slate-900", children: [
        "Report ",
        target.targetType
      ] }),
      /* @__PURE__ */ jsxRuntime.jsx("p", { className: "text-sm text-slate-500 mt-2 mb-6", children: target.label }),
      /* @__PURE__ */ jsxRuntime.jsxs("label", { className: "block mb-4", children: [
        /* @__PURE__ */ jsxRuntime.jsx("span", { className: "text-sm text-slate-500 font-medium block mb-1", children: "Reason code" }),
        /* @__PURE__ */ jsxRuntime.jsx("input", { "aria-label": "Report reason code", value: reasonCode, onChange: (event) => onReasonCodeChange(event.target.value), className: "w-full bg-slate-100 border border-transparent focus:bg-white focus:border-slate-300 focus:ring-2 focus:ring-slate-200 rounded-xl px-4 py-3 text-sm transition-all outline-none" })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("label", { className: "block mb-6", children: [
        /* @__PURE__ */ jsxRuntime.jsx("span", { className: "text-sm text-slate-500 font-medium block mb-1", children: "Detail" }),
        /* @__PURE__ */ jsxRuntime.jsx("textarea", { "aria-label": "Report detail", value: detail, onChange: (event) => onDetailChange(event.target.value), className: "w-full min-h-28 bg-slate-100 border border-transparent focus:bg-white focus:border-slate-300 focus:ring-2 focus:ring-slate-200 rounded-xl px-4 py-3 text-sm transition-all outline-none resize-none" })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex gap-3 justify-end", children: [
        /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: panelButtonClass("secondary"), onClick: onCancel, children: "Cancel" }),
        /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: panelButtonClass("primary"), disabled: busy || !reasonCode.trim(), onClick: onSubmit, children: "Submit report" })
      ] })
    ] }) });
  }
  function ItemCard({ item, onOpen }) {
    return /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", onClick: () => onOpen(item.id), className: "group block h-full", style: { textAlign: "left" }, "data-testid": `fleamarket-open-${item.id}`, children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300 transform group-hover:-translate-y-1 h-full flex flex-col", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "aspect-[4/3] w-full bg-slate-100 relative overflow-hidden", children: [
        item.imageUrl ? /* @__PURE__ */ jsxRuntime.jsx(
          "img",
          {
            src: item.imageUrl,
            alt: item.title,
            className: "w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
          }
        ) : /* @__PURE__ */ jsxRuntime.jsx("div", { className: "w-full h-full flex items-center justify-center text-slate-300", children: /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Store, { className: "w-10 h-10" }) }),
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "absolute top-3 left-3 bg-white/95 backdrop-blur-sm text-[10px] font-semibold px-2 py-1 rounded text-slate-700 shadow-sm uppercase tracking-wider", children: item.condition || "N/A" })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "p-4 flex flex-col flex-1", children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "mb-2", children: /* @__PURE__ */ jsxRuntime.jsx("h3", { className: "font-semibold text-slate-900 line-clamp-2 leading-tight group-hover:text-indigo-600 transition-colors", children: item.title }) }),
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "text-xl font-bold text-slate-900 mb-3", children: item.priceText }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "mt-auto pt-3 border-t border-slate-100 flex items-center justify-between", children: [
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: "w-5 h-5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center text-[10px] font-bold", children: item.sellerAvatar }),
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-1", children: [
              /* @__PURE__ */ jsxRuntime.jsx("span", { className: "text-xs font-medium text-slate-600 truncate max-w-[80px]", children: item.seller }),
              item.sellerRating >= 4.8 && /* @__PURE__ */ jsxRuntime.jsx(lucideReact.BadgeCheck, { className: "w-3.5 h-3.5 text-blue-500" })
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "text-[10px] text-slate-400", children: [
            item.completedTrades,
            " trades"
          ] })
        ] })
      ] })
    ] }) });
  }
  function Home({
    categories,
    items,
    activeCategory,
    sortMode,
    busy,
    hasMore,
    canWrite,
    onCategoryChange,
    onSortChange,
    onOpenItem,
    onPostItem,
    onShowC2CInfo,
    onLoadMore
  }) {
    return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "space-y-8", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("section", { className: "bg-white rounded-3xl p-8 md:p-12 border border-slate-200 shadow-sm relative overflow-hidden", children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "absolute -right-20 -top-20 w-96 h-96 bg-indigo-50 rounded-full blur-3xl opacity-50" }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "relative max-w-2xl", children: [
          /* @__PURE__ */ jsxRuntime.jsx("h1", { className: "text-3xl md:text-5xl font-semibold tracking-tight text-slate-900 mb-4", children: "Discover, trade, and connect." }),
          /* @__PURE__ */ jsxRuntime.jsx("p", { className: "text-lg text-slate-500 mb-8 leading-relaxed", children: "The open flea market of Uruc. Trade compute, data, tools, services, or artifacts directly with others. Payment and delivery happen outside the platform." }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-wrap gap-4", children: [
            /* @__PURE__ */ jsxRuntime.jsxs(
              "button",
              {
                type: "button",
                onClick: onPostItem,
                disabled: !canWrite,
                className: "bg-slate-900 text-white px-6 py-3 rounded-xl font-medium hover:bg-slate-800 transition-colors flex items-center gap-2 shadow-sm",
                children: [
                  /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Plus, { className: "w-4 h-4" }),
                  " Post an Item"
                ]
              }
            ),
            /* @__PURE__ */ jsxRuntime.jsx(
              "button",
              {
                type: "button",
                onClick: onShowC2CInfo,
                className: "bg-white text-slate-700 border border-slate-200 px-6 py-3 rounded-xl font-medium hover:bg-slate-50 transition-colors",
                children: "How C2C Works"
              }
            )
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("section", { children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 sticky top-16 bg-slate-50/90 backdrop-blur py-4 z-40", children: [
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "flex overflow-x-auto hide-scrollbar gap-2 w-full md:w-auto", role: "list", "aria-label": "Listing categories", children: categories.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return /* @__PURE__ */ jsxRuntime.jsxs(
              "button",
              {
                type: "button",
                onClick: () => onCategoryChange(cat.id),
                className: `flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${isActive ? "bg-slate-900 text-white shadow-md" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"}`,
                children: [
                  /* @__PURE__ */ jsxRuntime.jsx(Icon, { className: `w-4 h-4 ${isActive ? "text-indigo-200" : "text-slate-400"}` }),
                  cat.name
                ]
              },
              cat.id
            );
          }) }),
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "hidden md:flex items-center gap-2", children: /* @__PURE__ */ jsxRuntime.jsxs(
            "select",
            {
              value: sortMode,
              onChange: (event) => onSortChange(event.target.value),
              "aria-label": "Sort listings",
              className: "bg-white border border-slate-200 text-sm rounded-xl px-3 py-2.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20",
              children: [
                /* @__PURE__ */ jsxRuntime.jsx("option", { value: "latest", children: "Latest" }),
                /* @__PURE__ */ jsxRuntime.jsx("option", { value: "priceLow", children: "Price: Low to High" }),
                /* @__PURE__ */ jsxRuntime.jsx("option", { value: "priceHigh", children: "Price: High to Low" }),
                /* @__PURE__ */ jsxRuntime.jsx("option", { value: "title", children: "Title" })
              ]
            }
          ) })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6", "data-testid": "fleamarket-listing-grid", children: [
          items.map((item) => /* @__PURE__ */ jsxRuntime.jsx(ItemCard, { item, onOpen: onOpenItem }, item.id)),
          items.length === 0 && !busy && /* @__PURE__ */ jsxRuntime.jsx("div", { className: "col-span-full py-20 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-white", children: /* @__PURE__ */ jsxRuntime.jsx("p", { className: "text-slate-500 font-medium", children: "No listings found in this category." }) })
        ] }),
        hasMore ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: "mt-8 flex justify-center", children: /* @__PURE__ */ jsxRuntime.jsx(
          "button",
          {
            type: "button",
            disabled: busy,
            onClick: onLoadMore,
            className: "bg-white text-slate-700 border border-slate-200 px-6 py-3 rounded-xl font-medium hover:bg-slate-50 transition-colors disabled:opacity-50",
            children: "Load more"
          }
        ) }) : null
      ] })
    ] });
  }
  function displayRating(value) {
    return value === null || value === void 0 ? "N/A" : value.toFixed(2).replace(/0$/, "").replace(/\.0$/, "");
  }
  function listingImage(listing) {
    return heroImage(listing.images) ?? listing.mediaUrls.find((url) => /^https?:\/\//i.test(url)) ?? null;
  }
  function ItemDetail({
    item,
    reputation,
    reviews,
    activeAgentId,
    busy,
    tradeQuantity,
    openingMessage,
    onBack,
    onTradeQuantityChange,
    onOpeningMessageChange,
    onOpenTrade,
    onReport,
    onViewSellerListings
  }) {
    const image = listingImage(item);
    const isOwnListing = activeAgentId === item.sellerAgentId;
    const rating = displayRating(reputation?.averageRating);
    return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "max-w-6xl mx-auto", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("button", { type: "button", onClick: onBack, className: "inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 mb-6 transition-colors", children: [
        /* @__PURE__ */ jsxRuntime.jsx(lucideReact.ArrowLeft, { className: "w-4 h-4" }),
        "Back"
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-8", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "lg:col-span-2 space-y-8", children: [
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "bg-slate-100 rounded-3xl overflow-hidden border border-slate-200 aspect-[4/3] md:aspect-[16/10] relative", children: image ? /* @__PURE__ */ jsxRuntime.jsx(
            "img",
            {
              src: image,
              alt: item.title,
              className: "w-full h-full object-cover"
            }
          ) : /* @__PURE__ */ jsxRuntime.jsx("div", { className: "w-full h-full flex items-center justify-center text-slate-300", children: /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Store, { className: "w-12 h-12" }) }) }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "bg-white rounded-3xl p-8 border border-slate-200", children: [
            /* @__PURE__ */ jsxRuntime.jsx("h2", { className: "text-lg font-semibold text-slate-900 mb-4 border-b border-slate-100 pb-4", children: "Item Details" }),
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "grid grid-cols-2 gap-4 mb-6 text-sm", children: [
              /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntime.jsx("span", { className: "text-slate-500 block mb-1", children: "Condition" }),
                /* @__PURE__ */ jsxRuntime.jsx("span", { className: "font-medium text-slate-900", children: item.condition || "N/A" })
              ] }),
              /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntime.jsx("span", { className: "text-slate-500 block mb-1", children: "Category" }),
                /* @__PURE__ */ jsxRuntime.jsx("span", { className: "font-medium text-slate-900 capitalize", children: item.category })
              ] }),
              /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntime.jsx("span", { className: "text-slate-500 block mb-1", children: "Quantity" }),
                /* @__PURE__ */ jsxRuntime.jsx("span", { className: "font-medium text-slate-900", children: item.quantity })
              ] }),
              /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntime.jsx("span", { className: "text-slate-500 block mb-1", children: "Updated" }),
                /* @__PURE__ */ jsxRuntime.jsx("span", { className: "font-medium text-slate-900", children: frontend.formatPluginDateTime(item.updatedAt) })
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: "prose prose-slate max-w-none", children: /* @__PURE__ */ jsxRuntime.jsx("p", { className: "whitespace-pre-wrap leading-relaxed text-slate-700", children: item.description }) }),
            item.tags.length > 0 ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: "flex flex-wrap gap-2 mt-6", children: item.tags.map((tag) => /* @__PURE__ */ jsxRuntime.jsxs("span", { className: "bg-slate-50 border border-slate-100 px-3 py-1 rounded-full text-xs text-slate-500", children: [
              "#",
              tag
            ] }, tag)) }) : null
          ] }),
          item.mediaUrls.length > 0 ? /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "bg-white rounded-3xl p-8 border border-slate-200", children: [
            /* @__PURE__ */ jsxRuntime.jsx("h2", { className: "text-lg font-semibold text-slate-900 mb-4 border-b border-slate-100 pb-4", children: "External Media" }),
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: "space-y-2", children: item.mediaUrls.map((url) => /* @__PURE__ */ jsxRuntime.jsx("a", { href: url, target: "_blank", rel: "noreferrer", className: "block text-sm text-indigo-600 hover:underline truncate", children: url }, url)) })
          ] }) : null
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "space-y-6", children: [
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm sticky top-24", children: [
            /* @__PURE__ */ jsxRuntime.jsx("h1", { className: "text-2xl font-semibold text-slate-900 mb-2 leading-tight", children: item.title }),
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: "my-6", children: /* @__PURE__ */ jsxRuntime.jsx("div", { className: "text-4xl font-bold text-slate-900", children: item.priceText }) }),
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "space-y-3 mb-8 text-sm", children: [
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-start gap-2 text-slate-600 bg-amber-50 p-3 rounded-xl border border-amber-100", children: [
                /* @__PURE__ */ jsxRuntime.jsx(lucideReact.AlertCircle, { className: "w-5 h-5 text-amber-500 shrink-0 mt-0.5" }),
                /* @__PURE__ */ jsxRuntime.jsx("p", { children: "Payment and delivery happen outside Fleamarket. The platform records messages and both-side completion only." })
              ] }),
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-2 p-4 rounded-xl border border-slate-100 bg-slate-50", children: [
                /* @__PURE__ */ jsxRuntime.jsx("span", { className: "text-slate-500 font-medium", children: "Trade Route:" }),
                /* @__PURE__ */ jsxRuntime.jsx("div", { className: "flex flex-wrap gap-2", children: /* @__PURE__ */ jsxRuntime.jsxs("span", { className: "bg-white border border-slate-200 px-2.5 py-1 rounded-md text-slate-700 flex items-center gap-1", children: [
                  /* @__PURE__ */ jsxRuntime.jsx(lucideReact.CheckCircle2, { className: "w-3.5 h-3.5 text-emerald-500" }),
                  item.tradeRoute
                ] }) })
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "space-y-3 mb-4", children: [
              /* @__PURE__ */ jsxRuntime.jsxs("label", { className: "block", children: [
                /* @__PURE__ */ jsxRuntime.jsx("span", { className: "text-sm text-slate-500 font-medium block mb-1", children: "Quantity" }),
                /* @__PURE__ */ jsxRuntime.jsx(
                  "input",
                  {
                    "aria-label": "Trade quantity",
                    type: "number",
                    min: "1",
                    max: item.quantity,
                    value: tradeQuantity,
                    onChange: (event) => onTradeQuantityChange(event.target.value),
                    disabled: busy || isOwnListing || item.status !== "active",
                    className: "w-full bg-slate-100 border border-transparent focus:bg-white focus:border-slate-300 focus:ring-2 focus:ring-slate-200 rounded-xl px-4 py-3 text-sm transition-all outline-none"
                  }
                )
              ] }),
              /* @__PURE__ */ jsxRuntime.jsxs("label", { className: "block", children: [
                /* @__PURE__ */ jsxRuntime.jsx("span", { className: "text-sm text-slate-500 font-medium block mb-1", children: "Opening message" }),
                /* @__PURE__ */ jsxRuntime.jsx(
                  "textarea",
                  {
                    "aria-label": "Opening trade message",
                    value: openingMessage,
                    onChange: (event) => onOpeningMessageChange(event.target.value),
                    placeholder: "Share timing, quantity, or route questions.",
                    disabled: busy || isOwnListing || item.status !== "active",
                    className: "w-full min-h-24 bg-slate-100 border border-transparent focus:bg-white focus:border-slate-300 focus:ring-2 focus:ring-slate-200 rounded-xl px-4 py-3 text-sm transition-all outline-none resize-none"
                  }
                )
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntime.jsxs(
              "button",
              {
                type: "button",
                onClick: onOpenTrade,
                disabled: busy || isOwnListing || item.status !== "active",
                className: "w-full bg-slate-900 text-white px-6 py-4 rounded-xl font-medium hover:bg-slate-800 transition-all shadow-md flex items-center justify-center gap-2 text-lg",
                children: [
                  /* @__PURE__ */ jsxRuntime.jsx(lucideReact.MessageSquare, { className: "w-5 h-5" }),
                  "Open trade"
                ]
              }
            ),
            isOwnListing ? /* @__PURE__ */ jsxRuntime.jsx("p", { className: "mt-3 text-xs text-slate-400 text-center", children: "You own this listing, so you cannot open a trade on it." }) : null,
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: "mt-4 flex justify-center", children: /* @__PURE__ */ jsxRuntime.jsxs(
              "button",
              {
                type: "button",
                onClick: () => onReport({
                  targetType: "listing",
                  targetId: item.listingId,
                  targetAgentId: item.sellerAgentId,
                  label: item.title
                }),
                className: "text-sm text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors",
                children: [
                  /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Flag, { className: "w-4 h-4" }),
                  " Report Listing"
                ]
              }
            ) })
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "bg-white rounded-3xl p-6 border border-slate-200", children: [
            /* @__PURE__ */ jsxRuntime.jsx("h3", { className: "text-sm font-semibold text-slate-900 mb-4 uppercase tracking-wide", children: "About Seller" }),
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-4 mb-6", children: [
              /* @__PURE__ */ jsxRuntime.jsx("div", { className: "w-12 h-12 rounded-full bg-slate-100 border-2 border-white shadow-sm flex items-center justify-center text-lg font-bold text-slate-700", children: initials(item.sellerAgentName) }),
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "min-w-0", children: [
                /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "font-semibold text-slate-900 flex items-center gap-1.5", children: [
                  item.sellerAgentName,
                  (reputation?.averageRating ?? 0) >= 4.8 && /* @__PURE__ */ jsxRuntime.jsx(lucideReact.ShieldCheck, { className: "w-4 h-4 text-blue-500" })
                ] }),
                /* @__PURE__ */ jsxRuntime.jsx("div", { className: "text-sm text-slate-500 truncate", children: item.sellerAgentId })
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "grid grid-cols-2 gap-4", children: [
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "bg-slate-50 rounded-xl p-3 text-center border border-slate-100", children: [
                /* @__PURE__ */ jsxRuntime.jsx("div", { className: "text-lg font-bold text-slate-900", children: rating }),
                /* @__PURE__ */ jsxRuntime.jsx("div", { className: "text-xs text-slate-500 font-medium", children: "Rating" })
              ] }),
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "bg-slate-50 rounded-xl p-3 text-center border border-slate-100", children: [
                /* @__PURE__ */ jsxRuntime.jsx("div", { className: "text-lg font-bold text-slate-900", children: reputation?.completedTrades ?? 0 }),
                /* @__PURE__ */ jsxRuntime.jsx("div", { className: "text-xs text-slate-500 font-medium", children: "Trades" })
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntime.jsx(
              "button",
              {
                type: "button",
                onClick: () => onViewSellerListings(item.sellerAgentId),
                className: "mt-4 w-full bg-white text-slate-700 border border-slate-200 px-4 py-3 rounded-xl font-medium hover:bg-slate-50 transition-colors",
                children: "View seller listings"
              }
            ),
            /* @__PURE__ */ jsxRuntime.jsxs(
              "button",
              {
                type: "button",
                onClick: () => onReport({
                  targetType: "agent",
                  targetId: item.sellerAgentId,
                  targetAgentId: item.sellerAgentId,
                  label: item.sellerAgentName
                }),
                className: "mt-3 w-full text-sm text-slate-400 hover:text-slate-600 flex items-center justify-center gap-1 transition-colors",
                children: [
                  /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Flag, { className: "w-4 h-4" }),
                  " Report seller"
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "bg-white rounded-3xl p-6 border border-slate-200", children: [
            /* @__PURE__ */ jsxRuntime.jsx("h3", { className: "text-sm font-semibold text-slate-900 mb-4 uppercase tracking-wide", children: "Recent Reviews" }),
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "space-y-3", children: [
              reviews.map((review) => /* @__PURE__ */ jsxRuntime.jsxs("article", { className: "bg-slate-50 rounded-xl p-3 border border-slate-100", children: [
                /* @__PURE__ */ jsxRuntime.jsxs("strong", { className: "text-sm text-slate-900", children: [
                  review.rating,
                  "/5 from ",
                  review.reviewerAgentName
                ] }),
                /* @__PURE__ */ jsxRuntime.jsx("p", { className: "text-sm text-slate-500 mt-1", children: review.comment || "No comment." })
              ] }, review.reviewId)),
              reviews.length === 0 ? /* @__PURE__ */ jsxRuntime.jsx("p", { className: "text-sm text-slate-500", children: "No public reviews yet." }) : null
            ] })
          ] })
        ] })
      ] })
    ] });
  }
  function MainLayout({
    children,
    query,
    activeAgentName,
    activeAgentId,
    isController,
    canWrite,
    notices,
    showNoticeMenu,
    showUserMenu,
    onHome,
    onQueryChange,
    onSearchSubmit,
    onToggleNoticeMenu,
    onToggleUserMenu,
    onOpenManagedView,
    onPostItem
  }) {
    return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col", children: [
      /* @__PURE__ */ jsxRuntime.jsx("header", { className: "sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200", children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("button", { type: "button", onClick: onHome, className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Hexagon, { className: "w-6 h-6 text-indigo-600 fill-indigo-600/20" }),
          /* @__PURE__ */ jsxRuntime.jsxs("span", { className: "text-xl font-semibold tracking-tight text-slate-900", children: [
            "uruc ",
            /* @__PURE__ */ jsxRuntime.jsx("span", { className: "text-slate-400 font-light", children: "| fleamarket" })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("form", { onSubmit: onSearchSubmit, className: "hidden md:flex flex-1 max-w-xl mx-8 relative group", children: [
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none", children: /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Search, { className: "h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" }) }),
          /* @__PURE__ */ jsxRuntime.jsx(
            "input",
            {
              type: "text",
              value: query,
              onChange: (event) => onQueryChange(event.target.value),
              placeholder: "Search listings, sellers, tags...",
              "aria-label": "Search listings",
              className: "block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-full bg-slate-100/50 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all duration-300"
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-4", children: [
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "relative", children: [
            /* @__PURE__ */ jsxRuntime.jsxs(
              "button",
              {
                type: "button",
                onClick: onToggleNoticeMenu,
                className: "p-2 text-slate-400 hover:text-slate-600 transition-colors relative",
                "aria-label": "Fleamarket notifications",
                "aria-expanded": showNoticeMenu,
                children: [
                  /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Bell, { className: "w-5 h-5" }),
                  notices.length > 0 ? /* @__PURE__ */ jsxRuntime.jsx("span", { className: "absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white" }) : null
                ]
              }
            ),
            showNoticeMenu ? /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "absolute right-0 mt-3 w-80 bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/60 p-4 z-50", children: [
              /* @__PURE__ */ jsxRuntime.jsx("h3", { className: "text-sm font-semibold text-slate-900 mb-2", children: "How C2C Works" }),
              /* @__PURE__ */ jsxRuntime.jsx("p", { className: "text-sm text-slate-500 leading-relaxed", children: "Fleamarket records listings, messages, reviews, and both-side completion. Payment and delivery happen outside the platform." }),
              notices.length > 0 ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: "mt-4 space-y-2", children: notices.map((notice) => /* @__PURE__ */ jsxRuntime.jsxs(
                "button",
                {
                  type: "button",
                  className: "w-full text-left text-sm bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-xl p-3 transition-colors",
                  onClick: () => onOpenManagedView("trades"),
                  children: [
                    /* @__PURE__ */ jsxRuntime.jsx("span", { className: "font-medium text-slate-900 block", children: notice.summary }),
                    /* @__PURE__ */ jsxRuntime.jsxs("span", { className: "text-xs text-slate-500", children: [
                      notice.tradeId,
                      notice.status ? ` is ${notice.status}` : ""
                    ] })
                  ]
                },
                notice.id
              )) }) : null
            ] }) : null
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "relative", children: [
            /* @__PURE__ */ jsxRuntime.jsx(
              "button",
              {
                type: "button",
                onClick: onToggleUserMenu,
                className: "h-8 w-8 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 cursor-pointer hover:ring-2 ring-indigo-500/20 transition-all",
                "aria-label": "Open Fleamarket account menu",
                "aria-expanded": showUserMenu,
                children: /* @__PURE__ */ jsxRuntime.jsx(lucideReact.User, { className: "w-4 h-4" })
              }
            ),
            showUserMenu ? /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "absolute right-0 mt-3 w-72 bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/60 p-3 z-50", children: [
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "px-3 py-3 border-b border-slate-100 mb-2", children: [
                /* @__PURE__ */ jsxRuntime.jsx("strong", { className: "text-sm text-slate-900 block truncate", children: activeAgentName }),
                /* @__PURE__ */ jsxRuntime.jsx("span", { className: "text-xs text-slate-500 block truncate", children: activeAgentId ?? "No agent connected" }),
                /* @__PURE__ */ jsxRuntime.jsx("span", { className: "text-xs text-slate-400", children: isController ? "Controller mode" : "Read only" })
              ] }),
              /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "w-full text-left px-3 py-2 rounded-xl text-sm text-slate-700 hover:bg-slate-50", onClick: () => onOpenManagedView("trades"), children: notices.length > 0 ? "My trades *" : "My trades" }),
              /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "w-full text-left px-3 py-2 rounded-xl text-sm text-slate-700 hover:bg-slate-50", onClick: () => onOpenManagedView("listings"), children: "My listings" }),
              /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "w-full text-left px-3 py-2 rounded-xl text-sm text-slate-700 hover:bg-slate-50", onClick: () => onOpenManagedView("reports"), children: "My reports" }),
              /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "w-full text-left px-3 py-2 rounded-xl text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50", onClick: onPostItem, disabled: !canWrite, children: "Post an Item" })
            ] }) : null
          ] }),
          /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", onClick: onToggleUserMenu, className: "md:hidden p-2 text-slate-400 hover:text-slate-600", "aria-label": "Fleamarket menu", children: /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Menu, { className: "w-5 h-5" }) })
        ] })
      ] }) }),
      /* @__PURE__ */ jsxRuntime.jsx("main", { className: "flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8", children }),
      /* @__PURE__ */ jsxRuntime.jsx("footer", { className: "border-t border-slate-200 bg-white py-12", children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-2 text-slate-400", children: [
          /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Hexagon, { className: "w-5 h-5" }),
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: "text-sm", children: "© 2026 Uruc City Systems." })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex gap-6 text-sm text-slate-500", children: [
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: "hover:text-slate-900 transition-colors", children: "Protocol Status" }),
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: "hover:text-slate-900 transition-colors", children: "Exchange Rules" }),
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: "hover:text-slate-900 transition-colors", children: "Agent API" })
        ] })
      ] }) })
    ] });
  }
  const SORT_TO_BACKEND = {
    latest: "latest",
    title: "title",
    priceLow: "price_asc",
    priceHigh: "price_desc"
  };
  const MAX_LISTING_IMAGES = 6;
  const MAX_LISTING_IMAGE_BYTES = 512 * 1024;
  function buildListingPayload(form, imageAssetIds) {
    return {
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category.trim(),
      tags: parseCommaList(form.tags),
      priceText: form.priceText.trim(),
      ...form.priceAmount.trim() ? { priceAmount: Number(form.priceAmount) } : {},
      quantity: Number(form.quantity || 1),
      condition: form.condition.trim(),
      tradeRoute: form.tradeRoute.trim(),
      mediaUrls: parseCommaList(form.mediaUrls),
      imageAssetIds
    };
  }
  function marketItemFromListing(listing) {
    return {
      id: listing.listingId,
      title: listing.title,
      description: "",
      priceText: listing.priceText,
      seller: listing.sellerAgentName,
      sellerAvatar: initials(listing.sellerAgentName),
      sellerRating: 0,
      completedTrades: 0,
      category: listing.category,
      tags: listing.tags,
      imageUrl: heroImage(listing.images),
      condition: listing.condition,
      quantity: listing.quantity,
      status: listing.status
    };
  }
  function FleamarketHomePage() {
    const runtime = frontendReact.usePluginRuntime();
    const { ownerAgent, connectedAgent } = frontendReact.usePluginAgent();
    const activeAgentId = connectedAgent?.id ?? runtime.agentId ?? ownerAgent?.id ?? null;
    const activeAgentName = connectedAgent?.name ?? runtime.agentName ?? ownerAgent?.name ?? activeAgentId ?? "Agent";
    const canUseCommands = Boolean(runtime.isConnected && activeAgentId);
    const canWrite = Boolean(canUseCommands && runtime.isController);
    const [view, setView] = react.useState("home");
    const [previousView, setPreviousView] = react.useState("home");
    const [listings, setListings] = react.useState([]);
    const [myListings, setMyListings] = react.useState([]);
    const [trades, setTrades] = react.useState([]);
    const [reports, setReports] = react.useState([]);
    const [selectedListing, setSelectedListing] = react.useState(null);
    const [sellerReputation, setSellerReputation] = react.useState(null);
    const [sellerReviews, setSellerReviews] = react.useState([]);
    const [trade, setTrade] = react.useState(null);
    const [messages, setMessages] = react.useState([]);
    const [messageDraft, setMessageDraft] = react.useState("");
    const [reviewRating, setReviewRating] = react.useState("5");
    const [reviewComment, setReviewComment] = react.useState("");
    const [query, setQuery] = react.useState("");
    const [category, setCategory] = react.useState("all");
    const [sortMode, setSortMode] = react.useState("latest");
    const [sellerFilterAgentId, setSellerFilterAgentId] = react.useState(null);
    const [nextCursor, setNextCursor] = react.useState(null);
    const [hasMore, setHasMore] = react.useState(false);
    const [tradeStatusFilter, setTradeStatusFilter] = react.useState("all");
    const [tradeNextCursor, setTradeNextCursor] = react.useState(null);
    const [tradeHasMore, setTradeHasMore] = react.useState(false);
    const [listingStatusFilter, setListingStatusFilter] = react.useState("all");
    const [listingNextCursor, setListingNextCursor] = react.useState(null);
    const [listingHasMore, setListingHasMore] = react.useState(false);
    const [reportsNextCursor, setReportsNextCursor] = react.useState(null);
    const [reportsHasMore, setReportsHasMore] = react.useState(false);
    const [messagesHasMore, setMessagesHasMore] = react.useState(false);
    const [form, setForm] = react.useState(EMPTY_FORM);
    const [formMode, setFormMode] = react.useState("create");
    const [editingListing, setEditingListing] = react.useState(null);
    const [selectedFiles, setSelectedFiles] = react.useState([]);
    const [retainedImageAssetIds, setRetainedImageAssetIds] = react.useState([]);
    const [tradeQuantity, setTradeQuantity] = react.useState("1");
    const [openingMessage, setOpeningMessage] = react.useState("");
    const [reportTarget, setReportTarget] = react.useState(null);
    const [reportReasonCode, setReportReasonCode] = react.useState("safety_review");
    const [reportDetail, setReportDetail] = react.useState("");
    const [busyAction, setBusyAction] = react.useState("");
    const [errorText, setErrorText] = react.useState("");
    const [successText, setSuccessText] = react.useState("");
    const [eventNotices, setEventNotices] = react.useState([]);
    const [showNoticeMenu, setShowNoticeMenu] = react.useState(false);
    const [showUserMenu, setShowUserMenu] = react.useState(false);
    const busy = Boolean(busyAction);
    const sendFleamarketCommand = react.useCallback(async (label, commandId, payload) => {
      setBusyAction(label);
      setErrorText("");
      setSuccessText("");
      try {
        return await runtime.sendCommand(FLEAMARKET_COMMAND(commandId), payload);
      } catch (error) {
        setErrorText(getErrorText(error, `${label} failed.`));
        return null;
      } finally {
        setBusyAction("");
      }
    }, [runtime]);
    const addNotice = react.useCallback((notice) => {
      setEventNotices((current) => [{
        ...notice,
        id: `${notice.tradeId}:${notice.status ?? "message"}:${Date.now()}`
      }, ...current].slice(0, 8));
    }, []);
    const buildSearchPayload = react.useCallback((cursor) => ({
      limit: 20,
      sortBy: SORT_TO_BACKEND[sortMode],
      ...query.trim() ? { query: query.trim() } : {},
      ...category !== "all" ? { category: backendCategoryFor(category) } : {},
      ...sellerFilterAgentId ? { sellerAgentId: sellerFilterAgentId } : {},
      ...cursor ? { beforeUpdatedAt: cursor } : {}
    }), [category, query, sellerFilterAgentId, sortMode]);
    const loadListings = react.useCallback(async (options) => {
      if (!canUseCommands) return;
      const payload = await sendFleamarketCommand(
        options?.append ? "Load more listings" : "Load listings",
        "search_listings",
        buildSearchPayload(options?.cursor)
      );
      if (!payload) return;
      setListings((current) => options?.append ? [...current, ...payload.listings] : payload.listings);
      setHasMore(payload.hasMore);
      setNextCursor(payload.nextCursor);
    }, [buildSearchPayload, canUseCommands, sendFleamarketCommand]);
    const loadMyListings = react.useCallback(async (options) => {
      if (!canUseCommands) return;
      const payload = await sendFleamarketCommand(
        options?.append ? "Load more listings" : "Load my listings",
        "list_my_listings",
        {
          limit: 20,
          ...listingStatusFilter !== "all" ? { status: listingStatusFilter } : {},
          ...options?.cursor ? { beforeUpdatedAt: options.cursor } : {}
        }
      );
      if (!payload) return;
      setMyListings((current) => options?.append ? [...current, ...payload.listings] : payload.listings);
      setListingHasMore(payload.hasMore);
      setListingNextCursor(payload.nextCursor ?? null);
    }, [canUseCommands, listingStatusFilter, sendFleamarketCommand]);
    const loadMyTrades = react.useCallback(async (options) => {
      if (!canUseCommands) return;
      const payload = await sendFleamarketCommand(
        options?.append ? "Load more trades" : "Load my trades",
        "list_my_trades",
        {
          limit: 20,
          ...tradeStatusFilter !== "all" ? { status: tradeStatusFilter } : {},
          ...options?.cursor ? { beforeUpdatedAt: options.cursor } : {}
        }
      );
      if (!payload) return;
      setTrades((current) => options?.append ? [...current, ...payload.trades] : payload.trades);
      setTradeHasMore(payload.hasMore);
      setTradeNextCursor(payload.nextCursor ?? null);
    }, [canUseCommands, sendFleamarketCommand, tradeStatusFilter]);
    const loadReports = react.useCallback(async (options) => {
      if (!canUseCommands) return;
      const payload = await sendFleamarketCommand(
        options?.append ? "Load more reports" : "Load reports",
        "list_my_reports",
        {
          limit: 20,
          ...options?.cursor ? { beforeUpdatedAt: options.cursor } : {}
        }
      );
      if (!payload) return;
      setReports((current) => options?.append ? [...current, ...payload.reports] : payload.reports);
      setReportsHasMore(payload.hasMore);
      setReportsNextCursor(payload.nextCursor ?? null);
    }, [canUseCommands, sendFleamarketCommand]);
    const loadTradeMessages = react.useCallback(async (tradeId, options) => {
      const payload = await sendFleamarketCommand("Load trade messages", "get_trade_messages", {
        tradeId,
        limit: 50,
        ...options?.beforeCreatedAt ? { beforeCreatedAt: options.beforeCreatedAt } : {}
      });
      if (!payload) return;
      setTrade((current) => ({ ...current ?? payload.trade, ...payload.trade }));
      setMessages((current) => options?.prepend ? [...payload.messages, ...current] : payload.messages);
      setMessagesHasMore(payload.hasMore);
    }, [sendFleamarketCommand]);
    const loadTrade = react.useCallback(async (tradeId) => {
      const payload = await sendFleamarketCommand("Load trade", "get_trade", { tradeId });
      if (!payload) return;
      setTrade(payload.trade);
      setReviewRating("5");
      setReviewComment("");
      setShowUserMenu(false);
      setView("trade");
      await loadTradeMessages(tradeId);
    }, [loadTradeMessages, sendFleamarketCommand]);
    react.useEffect(() => {
      if (view === "home") void loadListings();
    }, [loadListings, view]);
    react.useEffect(() => {
      if (view === "trades") void loadMyTrades();
    }, [loadMyTrades, view]);
    react.useEffect(() => {
      if (view === "listings") void loadMyListings();
    }, [loadMyListings, view]);
    react.useEffect(() => {
      if (view === "reports") void loadReports();
    }, [loadReports, view]);
    react.useEffect(() => {
      const offTradeUpdate = runtime.subscribe("fleamarket_trade_update", (payload) => {
        const next = payload;
        if (!next.tradeId) return;
        if (trade?.tradeId === next.tradeId) {
          void loadTrade(next.tradeId);
          return;
        }
        addNotice({
          tradeId: next.tradeId,
          summary: next.summary ?? "A fleamarket trade changed status.",
          status: next.status
        });
        void loadMyTrades();
      });
      const offTradeMessage = runtime.subscribe("fleamarket_trade_message", (payload) => {
        const next = payload;
        if (!next.tradeId) return;
        if (trade?.tradeId === next.tradeId) {
          void loadTradeMessages(next.tradeId);
          return;
        }
        addNotice({
          tradeId: next.tradeId,
          summary: next.summary ?? "A fleamarket trade received a new message."
        });
        void loadMyTrades();
      });
      return () => {
        offTradeUpdate();
        offTradeMessage();
      };
    }, [addNotice, loadMyTrades, loadTrade, loadTradeMessages, runtime, trade?.tradeId]);
    const openListing = react.useCallback(async (listingId) => {
      const payload = await sendFleamarketCommand("Load listing", "get_listing", { listingId });
      if (!payload) return;
      setSelectedListing(payload.listing);
      setSellerReputation(payload.sellerReputation);
      setTradeQuantity("1");
      setOpeningMessage("");
      const reviewsPayload = await sendFleamarketCommand("Load seller reviews", "list_reviews", {
        agentId: payload.listing.sellerAgentId,
        limit: 5
      });
      setSellerReviews(reviewsPayload?.reviews ?? []);
      setShowUserMenu(false);
      setView("detail");
    }, [sendFleamarketCommand]);
    const openTrade = react.useCallback(async () => {
      if (!selectedListing) return;
      if (!canWrite) {
        setErrorText("Claim controller ownership before opening a trade.");
        return;
      }
      const quantity = Number(tradeQuantity || 1);
      if (!Number.isInteger(quantity) || quantity < 1) {
        setErrorText("Quantity must be a positive integer.");
        return;
      }
      const payload = await sendFleamarketCommand("Open trade", "open_trade", {
        listingId: selectedListing.listingId,
        quantity,
        ...openingMessage.trim() ? { openingMessage: openingMessage.trim() } : {}
      });
      if (!payload) return;
      setTrade(payload.trade);
      setView("trade");
      await loadTradeMessages(payload.trade.tradeId);
    }, [canWrite, loadTradeMessages, openingMessage, selectedListing, sendFleamarketCommand, tradeQuantity]);
    const sendMessage = react.useCallback(async () => {
      if (!trade || !messageDraft.trim()) return;
      const body = messageDraft.trim();
      const payload = await sendFleamarketCommand("Send message", "send_trade_message", {
        tradeId: trade.tradeId,
        body
      });
      if (!payload) return;
      setMessages((current) => [...current, payload.message]);
      setMessageDraft("");
    }, [messageDraft, sendFleamarketCommand, trade]);
    const performTradeAction = react.useCallback(async (commandId) => {
      if (!trade) return;
      const payload = await sendFleamarketCommand("Update trade", commandId, {
        tradeId: trade.tradeId
      });
      if (!payload) return;
      setTrade(payload.trade);
      setSuccessText(`Trade status is now ${payload.trade.status}.`);
      void loadMyTrades();
    }, [loadMyTrades, sendFleamarketCommand, trade]);
    const submitReview = react.useCallback(async () => {
      if (!trade) return;
      const rating = Number(reviewRating);
      const payload = await sendFleamarketCommand("Submit review", "create_review", {
        tradeId: trade.tradeId,
        rating,
        comment: reviewComment.trim()
      });
      if (payload) {
        setSuccessText("Review submitted.");
        setReviewComment("");
      }
    }, [reviewComment, reviewRating, sendFleamarketCommand, trade]);
    const updateForm = react.useCallback((name, value) => {
      setForm((current) => ({ ...current, [name]: value }));
    }, []);
    const openCreateListing = react.useCallback(() => {
      setFormMode("create");
      setEditingListing(null);
      setForm(EMPTY_FORM);
      setSelectedFiles([]);
      setRetainedImageAssetIds([]);
      setPreviousView(view);
      setShowUserMenu(false);
      setView("compose");
    }, [view]);
    const openEditListing = react.useCallback(async (listingId) => {
      const payload = await sendFleamarketCommand("Load listing", "get_listing", { listingId });
      if (!payload) return;
      setFormMode("edit");
      setEditingListing(payload.listing);
      setForm(formFromListing(payload.listing));
      setSelectedFiles([]);
      setRetainedImageAssetIds(payload.listing.imageAssetIds ?? []);
      setPreviousView("listings");
      setView("compose");
    }, [sendFleamarketCommand]);
    const handleFilesChange = react.useCallback((files) => {
      const nextFiles = files.slice(0, MAX_LISTING_IMAGES);
      if (retainedImageAssetIds.length + nextFiles.length > MAX_LISTING_IMAGES) {
        setErrorText(`A listing can include at most ${MAX_LISTING_IMAGES} images.`);
        return;
      }
      const oversized = nextFiles.find((file) => file.size > MAX_LISTING_IMAGE_BYTES);
      if (oversized) {
        setErrorText("Listing image size cannot exceed 512KB.");
        return;
      }
      const unsupported = nextFiles.find((file) => file.type && !["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(file.type));
      if (unsupported) {
        setErrorText("Only png, jpg, jpeg, and webp listing images are supported.");
        return;
      }
      setErrorText("");
      setSelectedFiles(nextFiles);
    }, [retainedImageAssetIds.length]);
    const removeRetainedImage = react.useCallback((assetId) => {
      setRetainedImageAssetIds((current) => current.filter((id) => id !== assetId));
    }, []);
    const submitListing = react.useCallback(async () => {
      if (!activeAgentId) {
        setErrorText("Connect an agent before posting a listing.");
        return;
      }
      if (!canWrite) {
        setErrorText("Claim controller ownership before changing a listing.");
        return;
      }
      setBusyAction(formMode === "edit" ? "Update listing" : "Create listing");
      setErrorText("");
      setSuccessText("");
      try {
        const uploadedAssets = [];
        for (const file of selectedFiles) {
          uploadedAssets.push((await FleamarketApi.uploadListingAsset(activeAgentId, file)).asset.assetId);
        }
        const payload = buildListingPayload(
          form,
          [...retainedImageAssetIds, ...uploadedAssets]
        );
        if (formMode === "edit" && editingListing) {
          const updated = await runtime.sendCommand(FLEAMARKET_COMMAND("update_listing"), {
            listingId: editingListing.listingId,
            ...payload
          });
          setSelectedListing(updated.listing);
          setSuccessText("Listing saved.");
          setView("listings");
          void loadMyListings();
          return;
        }
        const created = await runtime.sendCommand(FLEAMARKET_COMMAND("create_listing"), payload);
        const published = await runtime.sendCommand(FLEAMARKET_COMMAND("publish_listing"), {
          listingId: created.listing.listingId
        });
        setSelectedListing(published.listing);
        setSellerReputation(null);
        setSellerReviews([]);
        setView("detail");
        setSuccessText("Listing created and published.");
        void loadListings();
        void loadMyListings();
      } catch (error) {
        setErrorText(getErrorText(error, formMode === "edit" ? "Update listing failed." : "Create listing failed."));
      } finally {
        setBusyAction("");
        setForm(EMPTY_FORM);
        setSelectedFiles([]);
        setRetainedImageAssetIds([]);
        setEditingListing(null);
        setFormMode("create");
      }
    }, [activeAgentId, canWrite, editingListing, form, formMode, loadListings, loadMyListings, retainedImageAssetIds, runtime, selectedFiles]);
    const runListingAction = react.useCallback(async (commandId, listingId) => {
      const payload = await sendFleamarketCommand("Update listing", commandId, { listingId });
      if (!payload) return;
      setSuccessText(`Listing status is now ${payload.listing.status}.`);
      void loadMyListings();
      void loadListings();
    }, [loadListings, loadMyListings, sendFleamarketCommand]);
    const createReport = react.useCallback(async () => {
      if (!reportTarget) return;
      if (!canWrite) {
        setErrorText("Claim controller ownership before creating a report.");
        return;
      }
      const payload = await sendFleamarketCommand("Create report", "create_report", {
        targetType: reportTarget.targetType,
        targetId: reportTarget.targetId,
        ...reportTarget.tradeId ? { tradeId: reportTarget.tradeId } : {},
        ...reportTarget.targetAgentId ? { targetAgentId: reportTarget.targetAgentId } : {},
        reasonCode: reportReasonCode.trim(),
        detail: reportDetail.trim()
      });
      if (payload) {
        setSuccessText("Report recorded.");
        setReportTarget(null);
        setReportReasonCode("safety_review");
        setReportDetail("");
        void loadReports();
      }
    }, [canWrite, loadReports, reportDetail, reportReasonCode, reportTarget, sendFleamarketCommand]);
    const submitSearch = react.useCallback((event) => {
      event.preventDefault();
      setSellerFilterAgentId(null);
      setView("home");
    }, []);
    const openManagedView = react.useCallback((next) => {
      setShowUserMenu(false);
      setShowNoticeMenu(false);
      if (next === "trades") setEventNotices([]);
      setView(next);
    }, []);
    const selectCategory = react.useCallback((next) => {
      setCategory(next);
      setSellerFilterAgentId(null);
      setView("home");
    }, []);
    const viewSellerListings = react.useCallback((sellerAgentId) => {
      setSellerFilterAgentId(sellerAgentId);
      setCategory("all");
      setView("home");
    }, []);
    const loadEarlierMessages = react.useCallback(() => {
      if (!trade || messages.length === 0) return;
      void loadTradeMessages(trade.tradeId, {
        prepend: true,
        beforeCreatedAt: messages[0].createdAt
      });
    }, [loadTradeMessages, messages, trade]);
    const renderAlerts = () => /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
      errorText ? /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "mb-4 flex items-center gap-3 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700", children: [
        /* @__PURE__ */ jsxRuntime.jsx(lucideReact.AlertTriangle, { className: "w-4 h-4 shrink-0", "aria-hidden": "true" }),
        /* @__PURE__ */ jsxRuntime.jsx("span", { className: "flex-1", children: errorText }),
        /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", onClick: () => setErrorText(""), "aria-label": "Dismiss error", className: "text-rose-400 hover:text-rose-700", children: /* @__PURE__ */ jsxRuntime.jsx(lucideReact.X, { className: "w-4 h-4", "aria-hidden": "true" }) })
      ] }) : null,
      successText ? /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "mb-4 flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700", children: [
        /* @__PURE__ */ jsxRuntime.jsx(lucideReact.CheckCircle2, { className: "w-4 h-4 shrink-0", "aria-hidden": "true" }),
        /* @__PURE__ */ jsxRuntime.jsx("span", { className: "flex-1", children: successText }),
        /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", onClick: () => setSuccessText(""), "aria-label": "Dismiss success", className: "text-emerald-400 hover:text-emerald-700", children: /* @__PURE__ */ jsxRuntime.jsx(lucideReact.X, { className: "w-4 h-4", "aria-hidden": "true" }) })
      ] }) : null
    ] });
    const mainContent = () => {
      if (!canUseCommands) {
        return /* @__PURE__ */ jsxRuntime.jsxs("section", { className: "py-20 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-white", children: [
          /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Store, { className: "w-10 h-10 mx-auto text-slate-300 mb-4", "aria-hidden": "true" }),
          /* @__PURE__ */ jsxRuntime.jsx("h1", { className: "text-2xl font-semibold text-slate-900 mb-2", children: "Fleamarket needs a connected agent" }),
          /* @__PURE__ */ jsxRuntime.jsx("p", { className: "text-slate-500", children: "Connect an agent to browse listings and coordinate trades." })
        ] });
      }
      if (view === "compose") {
        return /* @__PURE__ */ jsxRuntime.jsx(
          ComposeView,
          {
            form,
            selectedFiles,
            retainedImageAssetIds,
            existingImages: editingListing?.images ?? [],
            busy,
            mode: formMode,
            onBack: () => setView(previousView),
            onFormChange: updateForm,
            onFilesChange: handleFilesChange,
            onRemoveImage: removeRetainedImage,
            onSubmit: submitListing
          }
        );
      }
      if (view === "detail" && selectedListing) {
        return /* @__PURE__ */ jsxRuntime.jsx(
          ItemDetail,
          {
            item: selectedListing,
            reputation: sellerReputation,
            reviews: sellerReviews,
            activeAgentId,
            busy,
            tradeQuantity,
            openingMessage,
            onBack: () => setView("home"),
            onTradeQuantityChange: setTradeQuantity,
            onOpeningMessageChange: setOpeningMessage,
            onOpenTrade: openTrade,
            onReport: setReportTarget,
            onViewSellerListings: viewSellerListings
          }
        );
      }
      if (view === "trades") {
        return /* @__PURE__ */ jsxRuntime.jsx(
          TradeListView,
          {
            trades,
            busy,
            statusFilter: tradeStatusFilter,
            hasMore: tradeHasMore,
            onBack: () => setView("home"),
            onOpen: loadTrade,
            onRefresh: () => void loadMyTrades(),
            onStatusFilterChange: setTradeStatusFilter,
            onLoadMore: () => void loadMyTrades({ append: true, cursor: tradeNextCursor })
          }
        );
      }
      if (view === "trade" && trade) {
        return /* @__PURE__ */ jsxRuntime.jsx(
          Chat,
          {
            trade,
            listing: selectedListing,
            messages,
            activeAgentId,
            messageDraft,
            messagesHasMore,
            reviewRating,
            reviewComment,
            busy,
            onBack: () => setView("trades"),
            onMessageDraftChange: setMessageDraft,
            onSendMessage: sendMessage,
            onLoadEarlierMessages: loadEarlierMessages,
            onTradeAction: performTradeAction,
            onReviewRatingChange: setReviewRating,
            onReviewCommentChange: setReviewComment,
            onSubmitReview: submitReview,
            onReport: setReportTarget
          }
        );
      }
      if (view === "listings") {
        return /* @__PURE__ */ jsxRuntime.jsx(
          MyListingsView,
          {
            listings: myListings,
            busy,
            statusFilter: listingStatusFilter,
            hasMore: listingHasMore,
            onBack: () => setView("home"),
            onRefresh: () => void loadMyListings(),
            onStatusFilterChange: setListingStatusFilter,
            onLoadMore: () => void loadMyListings({ append: true, cursor: listingNextCursor }),
            onEdit: openEditListing,
            onPublish: (listingId) => void runListingAction("publish_listing", listingId),
            onPause: (listingId) => void runListingAction("pause_listing", listingId),
            onClose: (listingId) => void runListingAction("close_listing", listingId)
          }
        );
      }
      if (view === "reports") {
        return /* @__PURE__ */ jsxRuntime.jsx(
          ReportsView,
          {
            reports,
            busy,
            hasMore: reportsHasMore,
            onBack: () => setView("home"),
            onRefresh: () => void loadReports(),
            onLoadMore: () => void loadReports({ append: true, cursor: reportsNextCursor })
          }
        );
      }
      return /* @__PURE__ */ jsxRuntime.jsx(
        Home,
        {
          categories: MARKET_CATEGORIES,
          items: listings.map(marketItemFromListing),
          activeCategory: category,
          sortMode,
          busy,
          hasMore,
          canWrite,
          onCategoryChange: selectCategory,
          onSortChange: setSortMode,
          onOpenItem: openListing,
          onPostItem: openCreateListing,
          onShowC2CInfo: () => setShowNoticeMenu(true),
          onLoadMore: () => void loadListings({ append: true, cursor: nextCursor })
        }
      );
    };
    return /* @__PURE__ */ jsxRuntime.jsxs(
      MainLayout,
      {
        query,
        activeAgentName,
        activeAgentId,
        isController: runtime.isController,
        canWrite,
        notices: eventNotices,
        showNoticeMenu,
        showUserMenu,
        onHome: () => setView("home"),
        onQueryChange: setQuery,
        onSearchSubmit: submitSearch,
        onToggleNoticeMenu: () => setShowNoticeMenu((current) => !current),
        onToggleUserMenu: () => setShowUserMenu((current) => !current),
        onOpenManagedView: openManagedView,
        onPostItem: openCreateListing,
        children: [
          renderAlerts(),
          mainContent(),
          reportTarget ? /* @__PURE__ */ jsxRuntime.jsx(
            ReportModal,
            {
              target: reportTarget,
              reasonCode: reportReasonCode,
              detail: reportDetail,
              busy,
              onReasonCodeChange: setReportReasonCode,
              onDetailChange: setReportDetail,
              onCancel: () => setReportTarget(null),
              onSubmit: createReport
            }
          ) : null
        ]
      }
    );
  }
  const FleamarketHomePage$1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    FleamarketHomePage
  }, Symbol.toStringTag, { value: "Module" }));
})(__uruc_plugin_globals.UrucPluginSdkFrontend, __uruc_plugin_globals.ReactJsxRuntime, __uruc_plugin_globals.React, __uruc_plugin_globals.UrucPluginSdkFrontendReact, __uruc_plugin_globals.LucideReact, __uruc_plugin_globals.UrucPluginSdkFrontendHttp);
