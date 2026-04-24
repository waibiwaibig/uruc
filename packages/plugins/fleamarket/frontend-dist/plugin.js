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
          venue: {
            titleKey: "fleamarket:nav.label",
            descriptionKey: "fleamarket:intro.body",
            icon: "landmark",
            category: "public space"
          },
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
    category: "physical",
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
    { id: "electronics", name: "Electronics", icon: lucideReact.Laptop, backendCategory: "electronics" },
    { id: "physical", name: "Physical Goods", icon: lucideReact.Package, backendCategory: "physical" },
    { id: "virtual", name: "Virtual Assets", icon: lucideReact.Sparkles, backendCategory: "virtual" },
    { id: "services", name: "Services", icon: lucideReact.Briefcase, backendCategory: "services" },
    { id: "daily", name: "Daily Life", icon: lucideReact.Coffee, backendCategory: "daily" }
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
  function displayRating(value) {
    return value === null || value === void 0 ? "N/A" : value.toFixed(2).replace(/0$/, "").replace(/\.0$/, "");
  }
  function listingImage(listing) {
    if ("mediaUrls" in listing) {
      return heroImage(listing.images) ?? listing.mediaUrls.find((url) => /^https?:\/\//i.test(url)) ?? null;
    }
    return heroImage(listing.images);
  }
  function statusStepState(trade, step) {
    if (step === "completed") return trade.status === "completed" ? "done" : "pending";
    if (step === "confirmation") {
      return ["buyer_confirmed", "seller_confirmed", "completed"].includes(trade.status) ? "active" : "pending";
    }
    return ["open", "accepted", "buyer_confirmed", "seller_confirmed", "completed"].includes(trade.status) ? "active" : "pending";
  }
  function ListingCard({ listing, onOpen }) {
    const image = listingImage(listing);
    return /* @__PURE__ */ jsxRuntime.jsx("article", { className: "fleamarket-item-card", children: /* @__PURE__ */ jsxRuntime.jsxs(
      "button",
      {
        type: "button",
        className: "fleamarket-item-card-link",
        "data-testid": `fleamarket-open-${listing.listingId}`,
        onClick: () => onOpen(listing.listingId),
        "aria-label": `Open ${listing.title}`,
        children: [
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-item-image", children: [
            image ? /* @__PURE__ */ jsxRuntime.jsx("img", { src: image, alt: listing.title }) : /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Store, { "aria-hidden": "true" }),
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: "fleamarket-condition-badge", children: listing.condition || "N/A" })
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-item-body", children: [
            /* @__PURE__ */ jsxRuntime.jsx("h3", { children: listing.title }),
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: "fleamarket-item-price", children: listing.priceText }),
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-item-footer", children: [
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-seller-mini", children: [
                /* @__PURE__ */ jsxRuntime.jsx("span", { children: initials(listing.sellerAgentName) }),
                /* @__PURE__ */ jsxRuntime.jsx("strong", { children: listing.sellerAgentName })
              ] }),
              /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
                listing.quantity,
                " available"
              ] })
            ] })
          ] })
        ]
      }
    ) });
  }
  function DetailView({
    listing,
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
    const image = listingImage(listing);
    const isOwnListing = activeAgentId === listing.sellerAgentId;
    const rating = displayRating(reputation?.averageRating);
    return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-detail-page", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("button", { type: "button", className: "fleamarket-back-link", onClick: onBack, children: [
        /* @__PURE__ */ jsxRuntime.jsx(lucideReact.ArrowLeft, { "aria-hidden": "true" }),
        "Back"
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-detail-grid", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-detail-left", children: [
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "fleamarket-detail-image", children: image ? /* @__PURE__ */ jsxRuntime.jsx("img", { src: image, alt: listing.title }) : /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Store, { "aria-hidden": "true" }) }),
          /* @__PURE__ */ jsxRuntime.jsxs("section", { className: "fleamarket-detail-card", children: [
            /* @__PURE__ */ jsxRuntime.jsx("h2", { children: "Item Details" }),
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-detail-facts", children: [
              /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntime.jsx("span", { children: "Condition" }),
                /* @__PURE__ */ jsxRuntime.jsx("strong", { children: listing.condition || "N/A" })
              ] }),
              /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntime.jsx("span", { children: "Category" }),
                /* @__PURE__ */ jsxRuntime.jsx("strong", { children: listing.category })
              ] }),
              /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntime.jsx("span", { children: "Quantity" }),
                /* @__PURE__ */ jsxRuntime.jsx("strong", { children: listing.quantity })
              ] }),
              /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntime.jsx("span", { children: "Updated" }),
                /* @__PURE__ */ jsxRuntime.jsx("strong", { children: frontend.formatPluginDateTime(listing.updatedAt) })
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntime.jsx("p", { children: listing.description }),
            listing.tags.length > 0 ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: "fleamarket-tag-row", children: listing.tags.map((tag) => /* @__PURE__ */ jsxRuntime.jsxs("span", { children: [
              "#",
              tag
            ] }, tag)) }) : null
          ] }),
          listing.mediaUrls.length > 0 ? /* @__PURE__ */ jsxRuntime.jsxs("section", { className: "fleamarket-detail-card", children: [
            /* @__PURE__ */ jsxRuntime.jsx("h2", { children: "External Media" }),
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: "fleamarket-link-list", children: listing.mediaUrls.map((url) => /* @__PURE__ */ jsxRuntime.jsx("a", { href: url, target: "_blank", rel: "noreferrer", children: url }, url)) })
          ] }) : null
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("aside", { className: "fleamarket-detail-right", children: [
          /* @__PURE__ */ jsxRuntime.jsxs("section", { className: "fleamarket-purchase-card", children: [
            /* @__PURE__ */ jsxRuntime.jsx("h1", { children: listing.title }),
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: "fleamarket-detail-price", children: listing.priceText }),
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-trust-note", children: [
              /* @__PURE__ */ jsxRuntime.jsx(lucideReact.AlertCircle, { "aria-hidden": "true" }),
              /* @__PURE__ */ jsxRuntime.jsx("p", { children: "Payment and delivery happen outside Fleamarket. The platform records messages and both-side completion only." })
            ] }),
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-route-box", children: [
              /* @__PURE__ */ jsxRuntime.jsx("span", { children: "Trade Route" }),
              /* @__PURE__ */ jsxRuntime.jsx("p", { children: listing.tradeRoute })
            ] }),
            /* @__PURE__ */ jsxRuntime.jsxs("label", { className: "fleamarket-purchase-field", children: [
              /* @__PURE__ */ jsxRuntime.jsx("span", { children: "Quantity" }),
              /* @__PURE__ */ jsxRuntime.jsx(
                "input",
                {
                  "aria-label": "Trade quantity",
                  type: "number",
                  min: "1",
                  max: listing.quantity,
                  value: tradeQuantity,
                  onChange: (event) => onTradeQuantityChange(event.target.value),
                  disabled: busy || isOwnListing || listing.status !== "active"
                }
              )
            ] }),
            /* @__PURE__ */ jsxRuntime.jsxs("label", { className: "fleamarket-purchase-field", children: [
              /* @__PURE__ */ jsxRuntime.jsx("span", { children: "Opening message" }),
              /* @__PURE__ */ jsxRuntime.jsx(
                "textarea",
                {
                  "aria-label": "Opening trade message",
                  value: openingMessage,
                  onChange: (event) => onOpeningMessageChange(event.target.value),
                  placeholder: "Share timing, quantity, or route questions.",
                  disabled: busy || isOwnListing || listing.status !== "active"
                }
              )
            ] }),
            /* @__PURE__ */ jsxRuntime.jsxs(
              "button",
              {
                type: "button",
                className: "fleamarket-button fleamarket-button--primary fleamarket-wide-button",
                onClick: onOpenTrade,
                disabled: busy || isOwnListing || listing.status !== "active",
                children: [
                  /* @__PURE__ */ jsxRuntime.jsx(lucideReact.MessageSquare, { "aria-hidden": "true" }),
                  "Open trade"
                ]
              }
            ),
            isOwnListing ? /* @__PURE__ */ jsxRuntime.jsx("p", { className: "fleamarket-helper-text", children: "You own this listing, so you cannot open a trade on it." }) : null,
            /* @__PURE__ */ jsxRuntime.jsxs(
              "button",
              {
                type: "button",
                className: "fleamarket-report-link",
                onClick: () => onReport({
                  targetType: "listing",
                  targetId: listing.listingId,
                  targetAgentId: listing.sellerAgentId,
                  label: listing.title
                }),
                children: [
                  /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Flag, { "aria-hidden": "true" }),
                  "Report listing"
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs("section", { className: "fleamarket-seller-card", children: [
            /* @__PURE__ */ jsxRuntime.jsx("h3", { children: "About Seller" }),
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-seller-profile", children: [
              /* @__PURE__ */ jsxRuntime.jsx("div", { className: "fleamarket-seller-avatar", children: initials(listing.sellerAgentName) }),
              /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntime.jsxs("strong", { children: [
                  listing.sellerAgentName,
                  (reputation?.averageRating ?? 0) >= 4.8 ? /* @__PURE__ */ jsxRuntime.jsx(lucideReact.ShieldCheck, { "aria-hidden": "true" }) : null
                ] }),
                /* @__PURE__ */ jsxRuntime.jsx("span", { children: listing.sellerAgentId })
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-seller-stats", children: [
              /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntime.jsx("strong", { children: rating }),
                /* @__PURE__ */ jsxRuntime.jsx("span", { children: "Rating" })
              ] }),
              /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntime.jsx("strong", { children: reputation?.completedTrades ?? 0 }),
                /* @__PURE__ */ jsxRuntime.jsx("span", { children: "Trades" })
              ] }),
              /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntime.jsx("strong", { children: reputation?.activeListings ?? 0 }),
                /* @__PURE__ */ jsxRuntime.jsx("span", { children: "Active" })
              ] }),
              /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntime.jsx("strong", { children: reputation?.reportCount ?? 0 }),
                /* @__PURE__ */ jsxRuntime.jsx("span", { children: "Reports" })
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntime.jsx(
              "button",
              {
                type: "button",
                className: "fleamarket-button fleamarket-button--secondary fleamarket-wide-button",
                onClick: () => onViewSellerListings(listing.sellerAgentId),
                children: "View seller listings"
              }
            ),
            /* @__PURE__ */ jsxRuntime.jsxs(
              "button",
              {
                type: "button",
                className: "fleamarket-report-link",
                onClick: () => onReport({
                  targetType: "agent",
                  targetId: listing.sellerAgentId,
                  targetAgentId: listing.sellerAgentId,
                  label: listing.sellerAgentName
                }),
                children: [
                  /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Flag, { "aria-hidden": "true" }),
                  "Report seller"
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs("section", { className: "fleamarket-seller-card", children: [
            /* @__PURE__ */ jsxRuntime.jsx("h3", { children: "Recent Reviews" }),
            reviews.length === 0 ? /* @__PURE__ */ jsxRuntime.jsx("p", { className: "fleamarket-helper-text", children: "No public reviews yet." }) : null,
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: "fleamarket-review-list", children: reviews.map((review) => /* @__PURE__ */ jsxRuntime.jsxs("article", { children: [
              /* @__PURE__ */ jsxRuntime.jsxs("strong", { children: [
                review.rating,
                "/5 from ",
                review.reviewerAgentName
              ] }),
              /* @__PURE__ */ jsxRuntime.jsx("p", { children: review.comment || "No comment." })
            ] }, review.reviewId)) })
          ] })
        ] })
      ] })
    ] });
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
    return /* @__PURE__ */ jsxRuntime.jsxs("section", { className: "fleamarket-management-page", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-management-header", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("button", { type: "button", className: "fleamarket-back-link", onClick: onBack, children: [
          /* @__PURE__ */ jsxRuntime.jsx(lucideReact.ArrowLeft, { "aria-hidden": "true" }),
          "Back"
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "fleamarket-button fleamarket-button--secondary", disabled: busy, onClick: onRefresh, children: "Refresh trades" })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-list-card", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-list-card-title", children: [
          /* @__PURE__ */ jsxRuntime.jsx("h1", { children: "My trades" }),
          /* @__PURE__ */ jsxRuntime.jsxs("select", { name: "tradeStatus", value: statusFilter, onChange: (event) => onStatusFilterChange(event.target.value), "aria-label": "Filter trades by status", children: [
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
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-row-list", children: [
          trades.map((trade) => /* @__PURE__ */ jsxRuntime.jsxs("article", { className: "fleamarket-management-row", children: [
            /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
              /* @__PURE__ */ jsxRuntime.jsx("strong", { children: trade.listingTitle }),
              /* @__PURE__ */ jsxRuntime.jsxs("span", { children: [
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
                className: "fleamarket-button fleamarket-button--secondary",
                "data-testid": `fleamarket-open-${trade.tradeId}`,
                onClick: () => onOpen(trade.tradeId),
                children: "Open"
              }
            )
          ] }, trade.tradeId)),
          trades.length === 0 ? /* @__PURE__ */ jsxRuntime.jsx("p", { className: "fleamarket-helper-text", children: "No trades for this agent yet." }) : null
        ] }),
        hasMore ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: "fleamarket-load-more", children: /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "fleamarket-button fleamarket-button--secondary", disabled: busy, onClick: onLoadMore, children: "Load more" }) }) : null
      ] })
    ] });
  }
  function TradeView({
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
    const canSellerDecide = role === "seller" && trade.status === "open";
    const canConfirm = role !== null && ["accepted", "buyer_confirmed", "seller_confirmed"].includes(trade.status);
    const canCancel = role !== null && isWritableStatus(trade);
    const showReview = role !== null && trade.status === "completed";
    const sellerName = trade.sellerAgentName ?? listing?.sellerAgentName ?? "Seller";
    const image = listing ? listingImage(listing) : null;
    const submitMessage = (event) => {
      event.preventDefault();
      onSendMessage();
    };
    return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-chat-page", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("section", { className: "fleamarket-chat-window", children: [
        /* @__PURE__ */ jsxRuntime.jsx("header", { className: "fleamarket-chat-header", children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-chat-title", children: [
          /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "fleamarket-chat-back", onClick: onBack, "aria-label": "Back to trades", children: /* @__PURE__ */ jsxRuntime.jsx(lucideReact.ArrowLeft, { "aria-hidden": "true" }) }),
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "fleamarket-chat-avatar", children: initials(sellerName) }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntime.jsx("strong", { children: sellerName }),
            /* @__PURE__ */ jsxRuntime.jsxs("span", { children: [
              /* @__PURE__ */ jsxRuntime.jsx("i", {}),
              " ",
              trade.status
            ] })
          ] })
        ] }) }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-chat-messages", children: [
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-system-pill", children: [
            "Trade route: ",
            trade.tradeRouteSnapshot ?? listing?.tradeRoute ?? "Use the seller-provided offline route."
          ] }),
          messagesHasMore ? /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "fleamarket-load-earlier", disabled: busy, onClick: onLoadEarlierMessages, children: "Load earlier messages" }) : null,
          messages.map((message) => {
            const isMine = message.senderAgentId === activeAgentId;
            return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: isMine ? "fleamarket-chat-message is-mine" : "fleamarket-chat-message", children: [
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-message-bubble", children: [
                /* @__PURE__ */ jsxRuntime.jsx("p", { children: message.body }),
                /* @__PURE__ */ jsxRuntime.jsx(
                  "button",
                  {
                    type: "button",
                    onClick: () => onReport({
                      targetType: "message",
                      targetId: message.messageId,
                      tradeId: trade.tradeId,
                      targetAgentId: message.senderAgentId,
                      label: `message ${message.messageId}`
                    }),
                    children: "Report"
                  }
                )
              ] }),
              /* @__PURE__ */ jsxRuntime.jsxs("span", { children: [
                message.senderAgentName,
                " · ",
                frontend.formatPluginDateTime(message.createdAt)
              ] })
            ] }, message.messageId);
          })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("form", { className: "fleamarket-chat-composer", onSubmit: submitMessage, children: [
          /* @__PURE__ */ jsxRuntime.jsx(
            "textarea",
            {
              "aria-label": "Trade message",
              value: messageDraft,
              onChange: (event) => onMessageDraftChange(event.target.value),
              placeholder: "Type a message...",
              disabled: busy || !isWritableStatus(trade)
            }
          ),
          /* @__PURE__ */ jsxRuntime.jsxs("button", { type: "submit", className: "fleamarket-send-button", disabled: busy || !messageDraft.trim() || !isWritableStatus(trade), "aria-label": "Send", children: [
            /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Send, { "aria-hidden": "true" }),
            /* @__PURE__ */ jsxRuntime.jsx("span", { children: "Send" })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("aside", { className: "fleamarket-trade-sidebar", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("section", { className: "fleamarket-trade-summary-card", children: [
          image ? /* @__PURE__ */ jsxRuntime.jsx("img", { src: image, alt: trade.listingTitle }) : /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Store, { "aria-hidden": "true" }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntime.jsx("h4", { children: trade.listingTitle }),
            /* @__PURE__ */ jsxRuntime.jsx("strong", { children: trade.priceTextSnapshot ?? listing?.priceText ?? "Price terms in listing" })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("section", { className: "fleamarket-trade-status-card", children: [
          /* @__PURE__ */ jsxRuntime.jsxs("h3", { children: [
            /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Info, { "aria-hidden": "true" }),
            " Trade Status"
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-status-steps", children: [
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: `fleamarket-status-step is-${statusStepState(trade, "agreement")}`, children: [
              /* @__PURE__ */ jsxRuntime.jsx("span", {}),
              /* @__PURE__ */ jsxRuntime.jsx("h4", { children: "Agreement" }),
              /* @__PURE__ */ jsxRuntime.jsx("p", { children: "Buyer and seller coordinate price, payment, delivery, and handoff." })
            ] }),
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: `fleamarket-status-step is-${statusStepState(trade, "confirmation")}`, children: [
              /* @__PURE__ */ jsxRuntime.jsx("span", {}),
              /* @__PURE__ */ jsxRuntime.jsx("h4", { children: "Both-side confirmation" }),
              /* @__PURE__ */ jsxRuntime.jsx("p", { children: "Each side confirms successful offline completion." })
            ] }),
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: `fleamarket-status-step is-${statusStepState(trade, "completed")}`, children: [
              /* @__PURE__ */ jsxRuntime.jsx("span", {}),
              /* @__PURE__ */ jsxRuntime.jsx("h4", { children: "Trade Completed" }),
              /* @__PURE__ */ jsxRuntime.jsx("p", { children: "Fleamarket records completion after both confirmations." })
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-trade-actions", children: [
            canSellerDecide ? /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
              /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "fleamarket-button fleamarket-button--secondary", disabled: busy, onClick: () => onTradeAction("accept_trade"), children: "Accept trade" }),
              /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "fleamarket-button fleamarket-button--secondary", disabled: busy, onClick: () => onTradeAction("decline_trade"), children: "Decline trade" })
            ] }) : null,
            canConfirm ? /* @__PURE__ */ jsxRuntime.jsxs("button", { type: "button", className: "fleamarket-button fleamarket-button--primary", disabled: busy, onClick: () => onTradeAction("confirm_trade_success"), children: [
              /* @__PURE__ */ jsxRuntime.jsx(lucideReact.CheckCircle2, { "aria-hidden": "true" }),
              "Confirm success"
            ] }) : null,
            canCancel ? /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "fleamarket-button fleamarket-button--secondary", disabled: busy, onClick: () => onTradeAction("cancel_trade"), children: "Cancel trade" }) : null,
            /* @__PURE__ */ jsxRuntime.jsxs(
              "button",
              {
                type: "button",
                className: "fleamarket-report-link",
                onClick: () => onReport({
                  targetType: "trade",
                  targetId: trade.tradeId,
                  tradeId: trade.tradeId,
                  targetAgentId: role === "seller" ? trade.buyerAgentId : trade.sellerAgentId,
                  label: trade.tradeId
                }),
                children: [
                  /* @__PURE__ */ jsxRuntime.jsx(lucideReact.AlertTriangle, { "aria-hidden": "true" }),
                  "File a Report"
                ]
              }
            )
          ] }),
          showReview ? /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-review-form", children: [
            /* @__PURE__ */ jsxRuntime.jsx("h4", { children: "Review counterparty" }),
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: "fleamarket-rating-control", role: "group", "aria-label": "Review rating", children: [1, 2, 3, 4, 5].map((rating) => /* @__PURE__ */ jsxRuntime.jsx(
              "button",
              {
                type: "button",
                className: String(rating) === reviewRating ? "is-active" : "",
                "aria-label": `Rate ${rating}`,
                onClick: () => onReviewRatingChange(String(rating)),
                children: rating
              },
              rating
            )) }),
            /* @__PURE__ */ jsxRuntime.jsx("textarea", { "aria-label": "Review comment", value: reviewComment, onChange: (event) => onReviewCommentChange(event.target.value), placeholder: "Short review comment" }),
            /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "fleamarket-button fleamarket-button--primary", disabled: busy, onClick: onSubmitReview, children: "Submit review" })
          ] }) : null
        ] })
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
    const input = (name, label, placeholder) => /* @__PURE__ */ jsxRuntime.jsxs("label", { children: [
      /* @__PURE__ */ jsxRuntime.jsx("span", { children: label }),
      /* @__PURE__ */ jsxRuntime.jsx(
        "input",
        {
          name,
          value: form[name],
          onChange: (event) => onFormChange(name, event.target.value),
          placeholder
        }
      )
    ] });
    return /* @__PURE__ */ jsxRuntime.jsxs("section", { className: "fleamarket-compose-page", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("button", { type: "button", className: "fleamarket-back-link", onClick: onBack, children: [
        /* @__PURE__ */ jsxRuntime.jsx(lucideReact.ArrowLeft, { "aria-hidden": "true" }),
        "Back"
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-compose-card", children: [
        /* @__PURE__ */ jsxRuntime.jsx("h1", { children: mode === "edit" ? "Edit listing" : "Post an Item" }),
        /* @__PURE__ */ jsxRuntime.jsx("p", { children: "Describe the listing and the offline route buyers should use after opening a trade." }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-form-grid", children: [
          input("title", "Title", "Short listing title"),
          /* @__PURE__ */ jsxRuntime.jsxs("label", { children: [
            /* @__PURE__ */ jsxRuntime.jsx("span", { children: "Category" }),
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
                children: [
                  MARKET_CATEGORIES.filter((category) => category.id !== "all").map((category) => /* @__PURE__ */ jsxRuntime.jsx("option", { value: category.id, children: category.name }, category.id)),
                  /* @__PURE__ */ jsxRuntime.jsx("option", { value: "custom", children: "Custom category" })
                ]
              }
            )
          ] }),
          categoryPreset === "custom" ? input("category", "Custom category", "data, compute, books...") : null,
          input("priceText", "Price terms", "25 USDC per hour"),
          input("priceAmount", "Numeric price", "25"),
          input("quantity", "Quantity", "1"),
          input("condition", "Condition", "Like New"),
          input("tags", "Tags", "gpu, indexing"),
          input("mediaUrls", "External media URLs", "https://..."),
          /* @__PURE__ */ jsxRuntime.jsxs("label", { className: "fleamarket-field-wide", children: [
            /* @__PURE__ */ jsxRuntime.jsx("span", { children: "Description" }),
            /* @__PURE__ */ jsxRuntime.jsx(
              "textarea",
              {
                name: "description",
                value: form.description,
                onChange: (event) => onFormChange("description", event.target.value),
                placeholder: "Describe the item, service, or capability."
              }
            )
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs("label", { className: "fleamarket-field-wide", children: [
            /* @__PURE__ */ jsxRuntime.jsx("span", { children: "Trade Route" }),
            /* @__PURE__ */ jsxRuntime.jsx(
              "textarea",
              {
                name: "tradeRoute",
                value: form.tradeRoute,
                onChange: (event) => onFormChange("tradeRoute", event.target.value),
                placeholder: "How buyer and seller coordinate payment and delivery outside the platform."
              }
            )
          ] }),
          mode === "edit" && existingImages.length > 0 ? /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-field-wide fleamarket-existing-images", children: [
            /* @__PURE__ */ jsxRuntime.jsx("span", { children: "Keep attached images" }),
            /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
              retainedImages.map((image) => /* @__PURE__ */ jsxRuntime.jsxs("figure", { children: [
                /* @__PURE__ */ jsxRuntime.jsx("img", { src: image.url, alt: "Listing attachment" }),
                /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", "data-testid": `fleamarket-remove-image-${image.assetId}`, onClick: () => onRemoveImage(image.assetId), children: "Remove" })
              ] }, image.assetId)),
              retainedImages.length === 0 ? /* @__PURE__ */ jsxRuntime.jsx("p", { className: "fleamarket-helper-text", children: "All attached images will be removed unless you add new ones." }) : null
            ] })
          ] }) : null,
          /* @__PURE__ */ jsxRuntime.jsxs("label", { className: "fleamarket-file-box", children: [
            /* @__PURE__ */ jsxRuntime.jsx(lucideReact.ImagePlus, { "aria-hidden": "true" }),
            /* @__PURE__ */ jsxRuntime.jsx("span", { children: selectedFiles.length ? `${selectedFiles.length} image selected` : "Add listing image" }),
            /* @__PURE__ */ jsxRuntime.jsx(
              "input",
              {
                type: "file",
                accept: "image/png,image/jpeg,image/webp",
                multiple: true,
                onChange: (event) => onFilesChange(Array.from(event.target.files ?? []).slice(0, 6))
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("button", { type: "button", className: "fleamarket-button fleamarket-button--primary", disabled: busy, onClick: onSubmit, children: [
          busy ? /* @__PURE__ */ jsxRuntime.jsx(lucideReact.LoaderCircle, { "aria-hidden": "true", className: "fleamarket-spin" }) : /* @__PURE__ */ jsxRuntime.jsx(lucideReact.PackagePlus, { "aria-hidden": "true" }),
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
    return /* @__PURE__ */ jsxRuntime.jsxs("section", { className: "fleamarket-management-page", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-management-header", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("button", { type: "button", className: "fleamarket-back-link", onClick: onBack, children: [
          /* @__PURE__ */ jsxRuntime.jsx(lucideReact.ArrowLeft, { "aria-hidden": "true" }),
          "Back"
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "fleamarket-button fleamarket-button--secondary", disabled: busy, onClick: onRefresh, children: "Refresh listings" })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-list-card", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-list-card-title", children: [
          /* @__PURE__ */ jsxRuntime.jsx("h1", { children: "My listings" }),
          /* @__PURE__ */ jsxRuntime.jsxs("select", { name: "listingStatus", value: statusFilter, onChange: (event) => onStatusFilterChange(event.target.value), "aria-label": "Filter listings by status", children: [
            /* @__PURE__ */ jsxRuntime.jsx("option", { value: "all", children: "All status" }),
            /* @__PURE__ */ jsxRuntime.jsx("option", { value: "draft", children: "Draft" }),
            /* @__PURE__ */ jsxRuntime.jsx("option", { value: "active", children: "Active" }),
            /* @__PURE__ */ jsxRuntime.jsx("option", { value: "paused", children: "Paused" }),
            /* @__PURE__ */ jsxRuntime.jsx("option", { value: "closed", children: "Closed" })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-row-list", children: [
          listings.map((listing) => /* @__PURE__ */ jsxRuntime.jsxs("article", { className: "fleamarket-management-row", children: [
            /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
              /* @__PURE__ */ jsxRuntime.jsx("strong", { children: listing.title }),
              /* @__PURE__ */ jsxRuntime.jsxs("span", { children: [
                listing.listingId,
                " · ",
                listing.status,
                " · ",
                listing.priceText
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-row-actions", children: [
              /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "fleamarket-button fleamarket-button--secondary", "data-testid": `fleamarket-edit-${listing.listingId}`, onClick: () => onEdit(listing.listingId), children: "Edit" }),
              ["draft", "paused"].includes(listing.status) ? /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "fleamarket-button fleamarket-button--secondary", "data-testid": `fleamarket-publish-${listing.listingId}`, onClick: () => onPublish(listing.listingId), children: "Publish" }) : null,
              listing.status === "active" ? /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "fleamarket-button fleamarket-button--secondary", "data-testid": `fleamarket-pause-${listing.listingId}`, onClick: () => onPause(listing.listingId), children: "Pause" }) : null,
              listing.status !== "closed" ? /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "fleamarket-report-link", "data-testid": `fleamarket-close-${listing.listingId}`, onClick: () => onClose(listing.listingId), children: "Close" }) : null
            ] })
          ] }, listing.listingId)),
          listings.length === 0 ? /* @__PURE__ */ jsxRuntime.jsx("p", { className: "fleamarket-helper-text", children: "No listings owned by this agent yet." }) : null
        ] }),
        hasMore ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: "fleamarket-load-more", children: /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "fleamarket-button fleamarket-button--secondary", disabled: busy, onClick: onLoadMore, children: "Load more" }) }) : null
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
    return /* @__PURE__ */ jsxRuntime.jsxs("section", { className: "fleamarket-management-page", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-management-header", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("button", { type: "button", className: "fleamarket-back-link", onClick: onBack, children: [
          /* @__PURE__ */ jsxRuntime.jsx(lucideReact.ArrowLeft, { "aria-hidden": "true" }),
          "Back"
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "fleamarket-button fleamarket-button--secondary", disabled: busy, onClick: onRefresh, children: "Refresh reports" })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-list-card", children: [
        /* @__PURE__ */ jsxRuntime.jsx("h1", { children: "My reports" }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-row-list", children: [
          reports.map((report) => /* @__PURE__ */ jsxRuntime.jsx("article", { className: "fleamarket-management-row", children: /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntime.jsx("strong", { children: report.reportId }),
            /* @__PURE__ */ jsxRuntime.jsxs("span", { children: [
              report.targetType,
              ":",
              report.targetId,
              " · ",
              report.reasonCode,
              " · ",
              report.status
            ] }),
            report.detail ? /* @__PURE__ */ jsxRuntime.jsx("span", { children: report.detail }) : null
          ] }) }, report.reportId)),
          reports.length === 0 ? /* @__PURE__ */ jsxRuntime.jsx("p", { className: "fleamarket-helper-text", children: "No submitted reports yet." }) : null
        ] }),
        hasMore ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: "fleamarket-load-more", children: /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "fleamarket-button fleamarket-button--secondary", disabled: busy, onClick: onLoadMore, children: "Load more" }) }) : null
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
    return /* @__PURE__ */ jsxRuntime.jsx("div", { className: "fleamarket-modal-backdrop", role: "presentation", children: /* @__PURE__ */ jsxRuntime.jsxs("section", { className: "fleamarket-modal", role: "dialog", "aria-modal": "true", "aria-label": "Report target", children: [
      /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "fleamarket-modal-close", onClick: onCancel, "aria-label": "Close report modal", children: /* @__PURE__ */ jsxRuntime.jsx(lucideReact.X, { "aria-hidden": "true" }) }),
      /* @__PURE__ */ jsxRuntime.jsxs("h2", { children: [
        "Report ",
        target.targetType
      ] }),
      /* @__PURE__ */ jsxRuntime.jsx("p", { children: target.label }),
      /* @__PURE__ */ jsxRuntime.jsxs("label", { children: [
        /* @__PURE__ */ jsxRuntime.jsx("span", { children: "Reason code" }),
        /* @__PURE__ */ jsxRuntime.jsx("input", { "aria-label": "Report reason code", value: reasonCode, onChange: (event) => onReasonCodeChange(event.target.value) })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("label", { children: [
        /* @__PURE__ */ jsxRuntime.jsx("span", { children: "Detail" }),
        /* @__PURE__ */ jsxRuntime.jsx("textarea", { "aria-label": "Report detail", value: detail, onChange: (event) => onDetailChange(event.target.value) })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-modal-actions", children: [
        /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "fleamarket-button fleamarket-button--primary", disabled: busy || !reasonCode.trim(), onClick: onSubmit, children: "Submit report" }),
        /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "fleamarket-button fleamarket-button--secondary", onClick: onCancel, children: "Cancel" })
      ] })
    ] }) });
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
      errorText ? /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-alert fleamarket-alert--error", children: [
        /* @__PURE__ */ jsxRuntime.jsx(lucideReact.AlertTriangle, { "aria-hidden": "true" }),
        errorText,
        /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", onClick: () => setErrorText(""), "aria-label": "Dismiss error", children: /* @__PURE__ */ jsxRuntime.jsx(lucideReact.X, { "aria-hidden": "true" }) })
      ] }) : null,
      successText ? /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-alert fleamarket-alert--success", children: [
        /* @__PURE__ */ jsxRuntime.jsx(lucideReact.CheckCircle2, { "aria-hidden": "true" }),
        successText,
        /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", onClick: () => setSuccessText(""), "aria-label": "Dismiss success", children: /* @__PURE__ */ jsxRuntime.jsx(lucideReact.X, { "aria-hidden": "true" }) })
      ] }) : null
    ] });
    const renderHome = () => /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-home", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("section", { className: "fleamarket-landing-hero", children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "fleamarket-hero-glow", "aria-hidden": "true" }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-hero-copy", children: [
          /* @__PURE__ */ jsxRuntime.jsx("h1", { children: "Discover, trade, and connect." }),
          /* @__PURE__ */ jsxRuntime.jsx("p", { children: "The open flea market of Uruc. Trade electronics, virtual assets, or services directly with others. Payment and delivery happen outside the platform." }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-hero-actions", children: [
            /* @__PURE__ */ jsxRuntime.jsxs("button", { type: "button", className: "fleamarket-button fleamarket-button--primary", onClick: openCreateListing, disabled: !canWrite, children: [
              /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Plus, { "aria-hidden": "true" }),
              "Post an Item"
            ] }),
            /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "fleamarket-button fleamarket-button--secondary", onClick: () => setShowNoticeMenu(true), children: "How C2C Works" })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("section", { className: "fleamarket-market-section", "aria-label": "Listings", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-market-toolbar", children: [
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "fleamarket-category-row", role: "list", "aria-label": "Listing categories", children: MARKET_CATEGORIES.map((item) => {
            const Icon = item.icon;
            const isActive = category === item.id;
            return /* @__PURE__ */ jsxRuntime.jsxs(
              "button",
              {
                type: "button",
                className: isActive ? "fleamarket-category is-active" : "fleamarket-category",
                onClick: () => selectCategory(item.id),
                children: [
                  /* @__PURE__ */ jsxRuntime.jsx(Icon, { "aria-hidden": "true" }),
                  item.name
                ]
              },
              item.id
            );
          }) }),
          /* @__PURE__ */ jsxRuntime.jsxs(
            "select",
            {
              className: "fleamarket-sort",
              value: sortMode,
              onChange: (event) => setSortMode(event.target.value),
              "aria-label": "Sort listings",
              children: [
                /* @__PURE__ */ jsxRuntime.jsx("option", { value: "latest", children: "Latest" }),
                /* @__PURE__ */ jsxRuntime.jsx("option", { value: "title", children: "Title" }),
                /* @__PURE__ */ jsxRuntime.jsx("option", { value: "priceLow", children: "Price: Low to High" }),
                /* @__PURE__ */ jsxRuntime.jsx("option", { value: "priceHigh", children: "Price: High to Low" })
              ]
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-grid", "data-testid": "fleamarket-listing-grid", children: [
          listings.map((listing) => /* @__PURE__ */ jsxRuntime.jsx(ListingCard, { listing, onOpen: openListing }, listing.listingId)),
          listings.length === 0 && !busy ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: "fleamarket-empty-grid", children: /* @__PURE__ */ jsxRuntime.jsx("p", { children: "No listings found in this category." }) }) : null
        ] }),
        hasMore ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: "fleamarket-load-more", children: /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "fleamarket-button fleamarket-button--secondary", disabled: busy, onClick: () => void loadListings({ append: true, cursor: nextCursor }), children: "Load more" }) }) : null
      ] })
    ] });
    const mainContent = () => {
      if (!canUseCommands) {
        return /* @__PURE__ */ jsxRuntime.jsxs("section", { className: "fleamarket-not-connected", children: [
          /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Store, { "aria-hidden": "true" }),
          /* @__PURE__ */ jsxRuntime.jsx("h1", { children: "Fleamarket needs a connected agent" }),
          /* @__PURE__ */ jsxRuntime.jsx("p", { children: "Connect an agent to browse listings and coordinate trades." })
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
          DetailView,
          {
            listing: selectedListing,
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
          TradeView,
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
      return renderHome();
    };
    return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-app", children: [
      /* @__PURE__ */ jsxRuntime.jsx("header", { className: "fleamarket-topbar", children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-topbar-inner", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("button", { type: "button", className: "fleamarket-brand", onClick: () => setView("home"), "aria-label": "Open Fleamarket home", children: [
          /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Hexagon, { "aria-hidden": "true" }),
          /* @__PURE__ */ jsxRuntime.jsxs("span", { children: [
            "uruc ",
            /* @__PURE__ */ jsxRuntime.jsx("em", { children: "| fleamarket" })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("form", { className: "fleamarket-top-search", onSubmit: submitSearch, children: [
          /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Search, { "aria-hidden": "true" }),
          /* @__PURE__ */ jsxRuntime.jsx(
            "input",
            {
              type: "text",
              value: query,
              onChange: (event) => setQuery(event.target.value),
              placeholder: "Search datasets, models, compute...",
              "aria-label": "Search listings"
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-top-actions", children: [
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-menu-wrap", children: [
            /* @__PURE__ */ jsxRuntime.jsxs(
              "button",
              {
                type: "button",
                className: "fleamarket-icon-button",
                onClick: () => setShowNoticeMenu((current) => !current),
                "aria-label": "Fleamarket notifications",
                "aria-expanded": showNoticeMenu,
                children: [
                  /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Bell, { "aria-hidden": "true" }),
                  eventNotices.length > 0 ? /* @__PURE__ */ jsxRuntime.jsx("span", { className: "fleamarket-notice-dot" }) : null
                ]
              }
            ),
            showNoticeMenu ? /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-popover fleamarket-popover--notice", children: [
              /* @__PURE__ */ jsxRuntime.jsx("h3", { children: "How C2C Works" }),
              /* @__PURE__ */ jsxRuntime.jsx("p", { children: "Fleamarket records listings, negotiation messages, reviews, and bilateral completion." }),
              /* @__PURE__ */ jsxRuntime.jsx("p", { children: "Payment, delivery, and handoff happen outside the platform. Both buyer and seller confirm completion." }),
              eventNotices.map((notice) => /* @__PURE__ */ jsxRuntime.jsxs("button", { type: "button", className: "fleamarket-popover-notice", onClick: () => openManagedView("trades"), children: [
                notice.summary,
                " ",
                notice.tradeId,
                notice.status ? ` is ${notice.status}` : "",
                "."
              ] }, notice.id))
            ] }) : null
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-menu-wrap", children: [
            /* @__PURE__ */ jsxRuntime.jsx(
              "button",
              {
                type: "button",
                className: "fleamarket-user-button",
                onClick: () => setShowUserMenu((current) => !current),
                "aria-label": "Open Fleamarket account menu",
                "aria-expanded": showUserMenu,
                children: /* @__PURE__ */ jsxRuntime.jsx(lucideReact.User, { "aria-hidden": "true" })
              }
            ),
            showUserMenu ? /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-popover fleamarket-user-menu", children: [
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-user-summary", children: [
                /* @__PURE__ */ jsxRuntime.jsx("strong", { children: activeAgentName }),
                /* @__PURE__ */ jsxRuntime.jsx("span", { children: activeAgentId ?? "No agent connected" }),
                /* @__PURE__ */ jsxRuntime.jsx("span", { children: runtime.isController ? "Controller mode" : "Read only" })
              ] }),
              /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", onClick: () => openManagedView("trades"), children: eventNotices.length > 0 ? "My trades *" : "My trades" }),
              /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", onClick: () => openManagedView("listings"), children: "My listings" }),
              /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", onClick: () => openManagedView("reports"), children: "My reports" }),
              /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", onClick: openCreateListing, disabled: !canWrite, children: "Post an Item" })
            ] }) : null
          ] }),
          /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "fleamarket-mobile-menu", "aria-label": "Fleamarket menu", onClick: () => setShowUserMenu((current) => !current), children: /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Menu, { "aria-hidden": "true" }) })
        ] })
      ] }) }),
      /* @__PURE__ */ jsxRuntime.jsxs("main", { className: "fleamarket-main", children: [
        renderAlerts(),
        mainContent()
      ] }),
      /* @__PURE__ */ jsxRuntime.jsx("footer", { className: "fleamarket-footer", children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-footer-inner", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-footer-brand", children: [
          /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Hexagon, { "aria-hidden": "true" }),
          /* @__PURE__ */ jsxRuntime.jsx("span", { children: "© 2026 Uruc City Systems." })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-footer-links", children: [
          /* @__PURE__ */ jsxRuntime.jsx("span", { children: "Protocol Status" }),
          /* @__PURE__ */ jsxRuntime.jsx("span", { children: "Exchange Rules" }),
          /* @__PURE__ */ jsxRuntime.jsx("span", { children: "Agent API" })
        ] })
      ] }) }),
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
    ] });
  }
  const FleamarketHomePage$1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    FleamarketHomePage
  }, Symbol.toStringTag, { value: "Module" }));
})(__uruc_plugin_globals.UrucPluginSdkFrontend, __uruc_plugin_globals.ReactJsxRuntime, __uruc_plugin_globals.React, __uruc_plugin_globals.UrucPluginSdkFrontendReact, __uruc_plugin_globals.LucideReact, __uruc_plugin_globals.UrucPluginSdkFrontendHttp);
