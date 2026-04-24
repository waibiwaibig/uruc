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
    category: "artifact",
    tags: "",
    priceText: "",
    priceAmount: "",
    quantity: "1",
    condition: "",
    tradeRoute: "",
    mediaUrls: ""
  };
  const CATEGORY_OPTIONS = ["all", "compute", "data", "tool", "service", "artifact"];
  const NON_TERMINAL_TRADES = /* @__PURE__ */ new Set(["open", "accepted", "buyer_confirmed", "seller_confirmed"]);
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
  function SurfaceTabs({
    active,
    tradeNotice,
    onSelect
  }) {
    const tabs = [
      { id: "home", label: "Market" },
      { id: "trades", label: tradeNotice ? "Trades *" : "Trades" },
      { id: "listings", label: "My listings" },
      { id: "reports", label: "Reports" }
    ];
    return /* @__PURE__ */ jsxRuntime.jsx("nav", { className: "fleamarket-tabs", "aria-label": "Fleamarket sections", children: tabs.map((tab) => /* @__PURE__ */ jsxRuntime.jsx(
      "button",
      {
        type: "button",
        className: active === tab.id ? "is-active" : "",
        onClick: () => onSelect(tab.id),
        children: tab.label
      },
      tab.id
    )) });
  }
  function ListingCard({ listing, onOpen }) {
    const image = heroImage(listing.images);
    return /* @__PURE__ */ jsxRuntime.jsxs("article", { className: "fleamarket-card", children: [
      /* @__PURE__ */ jsxRuntime.jsxs(
        "button",
        {
          type: "button",
          className: "fleamarket-card__image",
          "data-testid": `fleamarket-open-${listing.listingId}`,
          onClick: () => onOpen(listing.listingId),
          "aria-label": `Open ${listing.title}`,
          children: [
            image ? /* @__PURE__ */ jsxRuntime.jsx("img", { src: image, alt: listing.title }) : /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Store, { "aria-hidden": "true" }),
            /* @__PURE__ */ jsxRuntime.jsx("span", { children: listing.condition })
          ]
        }
      ),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-card__body", children: [
        /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "fleamarket-link-title", onClick: () => onOpen(listing.listingId), children: listing.title }),
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "fleamarket-price", children: listing.priceText }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-tags", children: [
          /* @__PURE__ */ jsxRuntime.jsx("span", { children: listing.category }),
          listing.tags.slice(0, 3).map((tag) => /* @__PURE__ */ jsxRuntime.jsxs("span", { children: [
            "#",
            tag
          ] }, tag))
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-card__footer", children: [
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: "fleamarket-avatar", children: initials(listing.sellerAgentName) }),
          /* @__PURE__ */ jsxRuntime.jsx("span", { children: listing.sellerAgentName }),
          /* @__PURE__ */ jsxRuntime.jsxs("span", { children: [
            listing.quantity,
            " available"
          ] })
        ] })
      ] })
    ] });
  }
  function DetailView({
    listing,
    reputation,
    reviews,
    activeAgentId,
    busy,
    onBack,
    onOpenTrade,
    onReport
  }) {
    const image = heroImage(listing.images);
    const isOwnListing = activeAgentId === listing.sellerAgentId;
    return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-detail", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("button", { type: "button", className: "fleamarket-ghost", onClick: onBack, children: [
        /* @__PURE__ */ jsxRuntime.jsx(lucideReact.ArrowLeft, { "aria-hidden": "true" }),
        "Back"
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-detail__grid", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("section", { className: "fleamarket-detail__main", children: [
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "fleamarket-detail__image", children: image ? /* @__PURE__ */ jsxRuntime.jsx("img", { src: image, alt: listing.title }) : /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Store, { "aria-hidden": "true" }) }),
          /* @__PURE__ */ jsxRuntime.jsxs("section", { className: "fleamarket-panel", children: [
            /* @__PURE__ */ jsxRuntime.jsx("h2", { children: "Listing details" }),
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-facts", children: [
              /* @__PURE__ */ jsxRuntime.jsxs("span", { children: [
                /* @__PURE__ */ jsxRuntime.jsx("strong", { children: "Condition" }),
                listing.condition
              ] }),
              /* @__PURE__ */ jsxRuntime.jsxs("span", { children: [
                /* @__PURE__ */ jsxRuntime.jsx("strong", { children: "Category" }),
                listing.category
              ] }),
              /* @__PURE__ */ jsxRuntime.jsxs("span", { children: [
                /* @__PURE__ */ jsxRuntime.jsx("strong", { children: "Quantity" }),
                listing.quantity
              ] }),
              /* @__PURE__ */ jsxRuntime.jsxs("span", { children: [
                /* @__PURE__ */ jsxRuntime.jsx("strong", { children: "Updated" }),
                frontend.formatPluginDateTime(listing.updatedAt)
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntime.jsx("p", { children: listing.description }),
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-route-note", children: [
              /* @__PURE__ */ jsxRuntime.jsx(lucideReact.AlertTriangle, { "aria-hidden": "true" }),
              /* @__PURE__ */ jsxRuntime.jsx("span", { children: "The platform does not process payment, escrow assets, ship items, or enforce delivery. Coordinate the offline route below." })
            ] }),
            /* @__PURE__ */ jsxRuntime.jsx("h3", { children: "Offline trade route" }),
            /* @__PURE__ */ jsxRuntime.jsx("p", { children: listing.tradeRoute }),
            listing.mediaUrls.length > 0 ? /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
              /* @__PURE__ */ jsxRuntime.jsx("h3", { children: "External media" }),
              /* @__PURE__ */ jsxRuntime.jsx("div", { className: "fleamarket-link-list", children: listing.mediaUrls.map((url) => /* @__PURE__ */ jsxRuntime.jsx("a", { href: url, target: "_blank", rel: "noreferrer", children: url }, url)) })
            ] }) : null
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("aside", { className: "fleamarket-detail__aside", children: [
          /* @__PURE__ */ jsxRuntime.jsxs("section", { className: "fleamarket-panel fleamarket-sticky", children: [
            /* @__PURE__ */ jsxRuntime.jsx("p", { className: "fleamarket-eyebrow", children: listing.status }),
            /* @__PURE__ */ jsxRuntime.jsx("h1", { children: listing.title }),
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: "fleamarket-detail-price", children: listing.priceText }),
            /* @__PURE__ */ jsxRuntime.jsxs(
              "button",
              {
                type: "button",
                className: "fleamarket-primary",
                onClick: onOpenTrade,
                disabled: busy || isOwnListing || listing.status !== "active",
                children: [
                  /* @__PURE__ */ jsxRuntime.jsx(lucideReact.MessageSquare, { "aria-hidden": "true" }),
                  "Open trade"
                ]
              }
            ),
            isOwnListing ? /* @__PURE__ */ jsxRuntime.jsx("p", { className: "fleamarket-muted", children: "You own this listing, so you cannot open a trade on it." }) : null,
            /* @__PURE__ */ jsxRuntime.jsxs(
              "button",
              {
                type: "button",
                className: "fleamarket-danger-link",
                onClick: () => onReport({ targetType: "listing", targetId: listing.listingId, label: listing.title }),
                children: [
                  /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Flag, { "aria-hidden": "true" }),
                  "Report listing"
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs("section", { className: "fleamarket-panel", children: [
            /* @__PURE__ */ jsxRuntime.jsx("h2", { children: "Seller" }),
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-seller", children: [
              /* @__PURE__ */ jsxRuntime.jsx("span", { className: "fleamarket-avatar fleamarket-avatar--large", children: initials(listing.sellerAgentName) }),
              /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntime.jsx("strong", { children: listing.sellerAgentName }),
                /* @__PURE__ */ jsxRuntime.jsxs("span", { children: [
                  "@",
                  listing.sellerAgentId
                ] })
              ] }),
              (reputation?.averageRating ?? 0) >= 4.75 ? /* @__PURE__ */ jsxRuntime.jsx(lucideReact.ShieldCheck, { "aria-hidden": "true" }) : null
            ] }),
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-metrics", children: [
              /* @__PURE__ */ jsxRuntime.jsxs("span", { children: [
                /* @__PURE__ */ jsxRuntime.jsx("strong", { children: reputation?.averageRating ?? "N/A" }),
                "Rating"
              ] }),
              /* @__PURE__ */ jsxRuntime.jsxs("span", { children: [
                /* @__PURE__ */ jsxRuntime.jsx("strong", { children: reputation?.completedTrades ?? 0 }),
                "Trades"
              ] }),
              /* @__PURE__ */ jsxRuntime.jsxs("span", { children: [
                /* @__PURE__ */ jsxRuntime.jsx("strong", { children: reputation?.activeListings ?? 0 }),
                "Active"
              ] }),
              /* @__PURE__ */ jsxRuntime.jsxs("span", { children: [
                /* @__PURE__ */ jsxRuntime.jsx("strong", { children: reputation?.reportCount ?? 0 }),
                "Reports"
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntime.jsxs(
              "button",
              {
                type: "button",
                className: "fleamarket-danger-link",
                onClick: () => onReport({ targetType: "agent", targetId: listing.sellerAgentId, label: listing.sellerAgentName }),
                children: [
                  /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Flag, { "aria-hidden": "true" }),
                  "Report seller"
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs("section", { className: "fleamarket-panel", children: [
            /* @__PURE__ */ jsxRuntime.jsx("h2", { children: "Recent reviews" }),
            reviews.length === 0 ? /* @__PURE__ */ jsxRuntime.jsx("p", { className: "fleamarket-muted", children: "No public reviews yet." }) : null,
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: "fleamarket-list-stack", children: reviews.map((review) => /* @__PURE__ */ jsxRuntime.jsxs("article", { className: "fleamarket-row", children: [
              /* @__PURE__ */ jsxRuntime.jsxs("strong", { children: [
                review.rating,
                "/5 from ",
                review.reviewerAgentName
              ] }),
              /* @__PURE__ */ jsxRuntime.jsx("span", { children: review.comment || "No comment." })
            ] }, review.reviewId)) })
          ] })
        ] })
      ] })
    ] });
  }
  function TradeListView({
    trades,
    busy,
    onBack,
    onOpen,
    onRefresh
  }) {
    return /* @__PURE__ */ jsxRuntime.jsxs("section", { className: "fleamarket-management", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-management__header", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("button", { type: "button", className: "fleamarket-ghost", onClick: onBack, children: [
          /* @__PURE__ */ jsxRuntime.jsx(lucideReact.ArrowLeft, { "aria-hidden": "true" }),
          "Back"
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "fleamarket-secondary", disabled: busy, onClick: onRefresh, children: "Refresh trades" })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-list-stack", children: [
        trades.map((trade) => /* @__PURE__ */ jsxRuntime.jsxs("article", { className: "fleamarket-row", children: [
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
              className: "fleamarket-secondary",
              "data-testid": `fleamarket-open-${trade.tradeId}`,
              onClick: () => onOpen(trade.tradeId),
              children: "Open"
            }
          )
        ] }, trade.tradeId)),
        trades.length === 0 ? /* @__PURE__ */ jsxRuntime.jsx("p", { className: "fleamarket-muted", children: "No trades for this agent yet." }) : null
      ] })
    ] });
  }
  function TradeView({
    trade,
    listing,
    messages,
    activeAgentId,
    messageDraft,
    reviewRating,
    reviewComment,
    busy,
    onBack,
    onMessageDraftChange,
    onSendMessage,
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
    return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-trade", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("section", { className: "fleamarket-chat", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("header", { className: "fleamarket-chat__header", children: [
          /* @__PURE__ */ jsxRuntime.jsxs("button", { type: "button", className: "fleamarket-ghost", onClick: onBack, children: [
            /* @__PURE__ */ jsxRuntime.jsx(lucideReact.ArrowLeft, { "aria-hidden": "true" }),
            "Back"
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntime.jsx("strong", { children: trade.listingTitle }),
            /* @__PURE__ */ jsxRuntime.jsxs("span", { children: [
              trade.status,
              " · ",
              role ?? "observer"
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-messages", children: [
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-system-message", children: [
            "Trade route: ",
            trade.tradeRouteSnapshot ?? listing?.tradeRoute ?? "Use the seller-provided offline route."
          ] }),
          messages.map((message) => {
            const isMine = message.senderAgentId === activeAgentId;
            return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: isMine ? "fleamarket-message fleamarket-message--mine" : "fleamarket-message", children: [
              /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
                message.body,
                /* @__PURE__ */ jsxRuntime.jsx(
                  "button",
                  {
                    type: "button",
                    className: "fleamarket-message-report",
                    onClick: () => onReport({
                      targetType: "message",
                      targetId: message.messageId,
                      tradeId: trade.tradeId,
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
        /* @__PURE__ */ jsxRuntime.jsxs("footer", { className: "fleamarket-chat__composer", children: [
          /* @__PURE__ */ jsxRuntime.jsx(
            "textarea",
            {
              "aria-label": "Trade message",
              value: messageDraft,
              onChange: (event) => onMessageDraftChange(event.target.value),
              placeholder: "Coordinate only this trade here...",
              disabled: busy || !isWritableStatus(trade)
            }
          ),
          /* @__PURE__ */ jsxRuntime.jsxs("button", { type: "button", className: "fleamarket-primary", onClick: onSendMessage, disabled: busy || !messageDraft.trim() || !isWritableStatus(trade), children: [
            /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Send, { "aria-hidden": "true" }),
            "Send"
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("aside", { className: "fleamarket-panel fleamarket-trade-panel", children: [
        /* @__PURE__ */ jsxRuntime.jsx("h2", { children: "Trade status" }),
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "fleamarket-status-pill", children: trade.status }),
        /* @__PURE__ */ jsxRuntime.jsx("p", { children: "The platform records negotiation messages and bilateral completion. Payment and delivery remain offline." }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-action-stack", children: [
          canSellerDecide ? /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
            /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "fleamarket-secondary", disabled: busy, onClick: () => onTradeAction("accept_trade"), children: "Accept trade" }),
            /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "fleamarket-secondary", disabled: busy, onClick: () => onTradeAction("decline_trade"), children: "Decline trade" })
          ] }) : null,
          canConfirm ? /* @__PURE__ */ jsxRuntime.jsxs("button", { type: "button", className: "fleamarket-primary", disabled: busy, onClick: () => onTradeAction("confirm_trade_success"), children: [
            /* @__PURE__ */ jsxRuntime.jsx(lucideReact.CheckCircle2, { "aria-hidden": "true" }),
            "Confirm success"
          ] }) : null,
          canCancel ? /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "fleamarket-secondary", disabled: busy, onClick: () => onTradeAction("cancel_trade"), children: "Cancel trade" }) : null,
          /* @__PURE__ */ jsxRuntime.jsxs(
            "button",
            {
              type: "button",
              className: "fleamarket-danger-link",
              onClick: () => onReport({ targetType: "trade", targetId: trade.tradeId, tradeId: trade.tradeId, label: trade.tradeId }),
              children: [
                /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Flag, { "aria-hidden": "true" }),
                "Report trade"
              ]
            }
          )
        ] }),
        showReview ? /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-review-form", children: [
          /* @__PURE__ */ jsxRuntime.jsx("h3", { children: "Review counterparty" }),
          /* @__PURE__ */ jsxRuntime.jsx("input", { "aria-label": "Review rating", value: reviewRating, onChange: (event) => onReviewRatingChange(event.target.value), placeholder: "1-5" }),
          /* @__PURE__ */ jsxRuntime.jsx("textarea", { "aria-label": "Review comment", value: reviewComment, onChange: (event) => onReviewCommentChange(event.target.value), placeholder: "Short review comment" }),
          /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "fleamarket-primary", disabled: busy, onClick: onSubmitReview, children: "Submit review" })
        ] }) : null
      ] })
    ] });
  }
  function ComposeView({
    form,
    selectedFiles,
    busy,
    mode,
    onBack,
    onFormChange,
    onFilesChange,
    onSubmit
  }) {
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
    return /* @__PURE__ */ jsxRuntime.jsxs("section", { className: "fleamarket-compose", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("button", { type: "button", className: "fleamarket-ghost", onClick: onBack, children: [
        /* @__PURE__ */ jsxRuntime.jsx(lucideReact.ArrowLeft, { "aria-hidden": "true" }),
        "Back"
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-panel", children: [
        /* @__PURE__ */ jsxRuntime.jsx("p", { className: "fleamarket-eyebrow", children: mode === "edit" ? "Edit listing" : "New listing" }),
        /* @__PURE__ */ jsxRuntime.jsx("h1", { children: mode === "edit" ? "Edit listing" : "Post a listing" }),
        /* @__PURE__ */ jsxRuntime.jsx("p", { className: "fleamarket-muted", children: "The offline trade route is required because Fleamarket does not process payment or delivery." }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-form-grid", children: [
          input("title", "Title", "Short listing title"),
          input("category", "Category", "compute, data, tool, service, artifact"),
          input("priceText", "Price terms", "25 USDC per hour"),
          input("priceAmount", "Numeric price", "25"),
          input("quantity", "Quantity", "1"),
          input("condition", "Condition", "Available tonight"),
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
            /* @__PURE__ */ jsxRuntime.jsx("span", { children: "Offline trade route" }),
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
        /* @__PURE__ */ jsxRuntime.jsxs("button", { type: "button", className: "fleamarket-primary", disabled: busy, onClick: onSubmit, children: [
          busy ? /* @__PURE__ */ jsxRuntime.jsx(lucideReact.LoaderCircle, { "aria-hidden": "true", className: "fleamarket-spin" }) : /* @__PURE__ */ jsxRuntime.jsx(lucideReact.PackagePlus, { "aria-hidden": "true" }),
          mode === "edit" ? "Save listing" : "Create and publish"
        ] })
      ] })
    ] });
  }
  function MyListingsView({
    listings,
    busy,
    onBack,
    onRefresh,
    onEdit,
    onPublish,
    onPause,
    onClose
  }) {
    return /* @__PURE__ */ jsxRuntime.jsxs("section", { className: "fleamarket-management", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-management__header", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("button", { type: "button", className: "fleamarket-ghost", onClick: onBack, children: [
          /* @__PURE__ */ jsxRuntime.jsx(lucideReact.ArrowLeft, { "aria-hidden": "true" }),
          "Back"
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "fleamarket-secondary", disabled: busy, onClick: onRefresh, children: "Refresh listings" })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-list-stack", children: [
        listings.map((listing) => /* @__PURE__ */ jsxRuntime.jsxs("article", { className: "fleamarket-row", children: [
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
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-row__actions", children: [
            /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "fleamarket-secondary", "data-testid": `fleamarket-edit-${listing.listingId}`, onClick: () => onEdit(listing.listingId), children: "Edit" }),
            ["draft", "paused"].includes(listing.status) ? /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "fleamarket-secondary", "data-testid": `fleamarket-publish-${listing.listingId}`, onClick: () => onPublish(listing.listingId), children: "Publish" }) : null,
            listing.status === "active" ? /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "fleamarket-secondary", "data-testid": `fleamarket-pause-${listing.listingId}`, onClick: () => onPause(listing.listingId), children: "Pause" }) : null,
            listing.status !== "closed" ? /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "fleamarket-danger-link", "data-testid": `fleamarket-close-${listing.listingId}`, onClick: () => onClose(listing.listingId), children: "Close" }) : null
          ] })
        ] }, listing.listingId)),
        listings.length === 0 ? /* @__PURE__ */ jsxRuntime.jsx("p", { className: "fleamarket-muted", children: "No listings owned by this agent yet." }) : null
      ] })
    ] });
  }
  function ReportsView({
    reports,
    busy,
    onBack,
    onRefresh
  }) {
    return /* @__PURE__ */ jsxRuntime.jsxs("section", { className: "fleamarket-management", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-management__header", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("button", { type: "button", className: "fleamarket-ghost", onClick: onBack, children: [
          /* @__PURE__ */ jsxRuntime.jsx(lucideReact.ArrowLeft, { "aria-hidden": "true" }),
          "Back"
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "fleamarket-secondary", disabled: busy, onClick: onRefresh, children: "Refresh reports" })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-list-stack", children: [
        reports.map((report) => /* @__PURE__ */ jsxRuntime.jsx("article", { className: "fleamarket-row", children: /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
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
        reports.length === 0 ? /* @__PURE__ */ jsxRuntime.jsx("p", { className: "fleamarket-muted", children: "No submitted reports yet." }) : null
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
      /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "fleamarket-modal__close", onClick: onCancel, "aria-label": "Close report modal", children: /* @__PURE__ */ jsxRuntime.jsx(lucideReact.X, { "aria-hidden": "true" }) }),
      /* @__PURE__ */ jsxRuntime.jsxs("p", { className: "fleamarket-eyebrow", children: [
        "Report ",
        target.targetType
      ] }),
      /* @__PURE__ */ jsxRuntime.jsx("h2", { children: target.label }),
      /* @__PURE__ */ jsxRuntime.jsxs("label", { children: [
        /* @__PURE__ */ jsxRuntime.jsx("span", { children: "Reason code" }),
        /* @__PURE__ */ jsxRuntime.jsx("input", { "aria-label": "Report reason code", value: reasonCode, onChange: (event) => onReasonCodeChange(event.target.value) })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("label", { children: [
        /* @__PURE__ */ jsxRuntime.jsx("span", { children: "Detail" }),
        /* @__PURE__ */ jsxRuntime.jsx("textarea", { "aria-label": "Report detail", value: detail, onChange: (event) => onDetailChange(event.target.value) })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-action-stack", children: [
        /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "fleamarket-primary", disabled: busy || !reasonCode.trim(), onClick: onSubmit, children: "Submit report" }),
        /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "fleamarket-secondary", onClick: onCancel, children: "Cancel" })
      ] })
    ] }) });
  }
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
    const [customCategory, setCustomCategory] = react.useState("");
    const [sellerAgentId, setSellerAgentId] = react.useState("");
    const [nextCursor, setNextCursor] = react.useState(null);
    const [hasMore, setHasMore] = react.useState(false);
    const [form, setForm] = react.useState(EMPTY_FORM);
    const [formMode, setFormMode] = react.useState("create");
    const [editingListing, setEditingListing] = react.useState(null);
    const [selectedFiles, setSelectedFiles] = react.useState([]);
    const [reportTarget, setReportTarget] = react.useState(null);
    const [reportReasonCode, setReportReasonCode] = react.useState("safety_review");
    const [reportDetail, setReportDetail] = react.useState("");
    const [busyAction, setBusyAction] = react.useState("");
    const [errorText, setErrorText] = react.useState("");
    const [successText, setSuccessText] = react.useState("");
    const [eventNotice, setEventNotice] = react.useState("");
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
    const effectiveCategory = category === "custom" ? customCategory.trim() : category;
    const buildSearchPayload = react.useCallback((cursor) => ({
      limit: 20,
      ...query.trim() ? { query: query.trim() } : {},
      ...effectiveCategory && effectiveCategory !== "all" ? { category: effectiveCategory } : {},
      ...sellerAgentId.trim() ? { sellerAgentId: sellerAgentId.trim() } : {},
      ...cursor ? { beforeUpdatedAt: cursor } : {}
    }), [effectiveCategory, query, sellerAgentId]);
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
    const loadMyListings = react.useCallback(async () => {
      if (!canUseCommands) return;
      const payload = await sendFleamarketCommand("Load my listings", "list_my_listings", { limit: 20 });
      if (payload) setMyListings(payload.listings);
    }, [canUseCommands, sendFleamarketCommand]);
    const loadMyTrades = react.useCallback(async () => {
      if (!canUseCommands) return;
      const payload = await sendFleamarketCommand("Load my trades", "list_my_trades", { limit: 20 });
      if (payload) setTrades(payload.trades);
    }, [canUseCommands, sendFleamarketCommand]);
    const loadReports = react.useCallback(async () => {
      if (!canUseCommands) return;
      const payload = await sendFleamarketCommand("Load reports", "list_my_reports", { limit: 20 });
      if (payload) setReports(payload.reports);
    }, [canUseCommands, sendFleamarketCommand]);
    const loadTradeMessages = react.useCallback(async (tradeId) => {
      const payload = await sendFleamarketCommand("Load trade messages", "get_trade_messages", {
        tradeId,
        limit: 50
      });
      if (!payload) return;
      setTrade((current) => ({ ...current ?? payload.trade, ...payload.trade }));
      setMessages(payload.messages);
    }, [sendFleamarketCommand]);
    const loadTrade = react.useCallback(async (tradeId) => {
      const payload = await sendFleamarketCommand("Load trade", "get_trade", { tradeId });
      if (!payload) return;
      setTrade(payload.trade);
      setReviewRating("5");
      setReviewComment("");
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
        setEventNotice(`${next.summary ?? "A fleamarket trade changed status."} ${next.tradeId}${next.status ? ` is ${next.status}` : ""}.`);
        void loadMyTrades();
      });
      const offTradeMessage = runtime.subscribe("fleamarket_trade_message", (payload) => {
        const next = payload;
        if (!next.tradeId) return;
        if (trade?.tradeId === next.tradeId) {
          void loadTradeMessages(next.tradeId);
          return;
        }
        setEventNotice(`${next.summary ?? "A fleamarket trade received a new message."} ${next.tradeId}.`);
        void loadMyTrades();
      });
      return () => {
        offTradeUpdate();
        offTradeMessage();
      };
    }, [loadMyTrades, loadTrade, loadTradeMessages, runtime, trade?.tradeId]);
    const openListing = react.useCallback(async (listingId) => {
      const payload = await sendFleamarketCommand("Load listing", "get_listing", { listingId });
      if (!payload) return;
      setSelectedListing(payload.listing);
      setSellerReputation(payload.sellerReputation);
      const reviewsPayload = await sendFleamarketCommand("Load seller reviews", "list_reviews", {
        agentId: payload.listing.sellerAgentId,
        limit: 5
      });
      setSellerReviews(reviewsPayload?.reviews ?? []);
      setView("detail");
    }, [sendFleamarketCommand]);
    const openTrade = react.useCallback(async () => {
      if (!selectedListing) return;
      if (!canWrite) {
        setErrorText("Claim controller ownership before opening a trade.");
        return;
      }
      const payload = await sendFleamarketCommand("Open trade", "open_trade", {
        listingId: selectedListing.listingId,
        quantity: 1
      });
      if (!payload) return;
      setTrade(payload.trade);
      setView("trade");
      await loadTradeMessages(payload.trade.tradeId);
    }, [canWrite, loadTradeMessages, selectedListing, sendFleamarketCommand]);
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
      setPreviousView(view);
      setView("compose");
    }, [view]);
    const openEditListing = react.useCallback(async (listingId) => {
      const payload = await sendFleamarketCommand("Load listing", "get_listing", { listingId });
      if (!payload) return;
      setFormMode("edit");
      setEditingListing(payload.listing);
      setForm(formFromListing(payload.listing));
      setSelectedFiles([]);
      setPreviousView("listings");
      setView("compose");
    }, [sendFleamarketCommand]);
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
          uploadedAssets.length > 0 ? uploadedAssets : editingListing?.imageAssetIds ?? []
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
        setEditingListing(null);
        setFormMode("create");
      }
    }, [activeAgentId, canWrite, editingListing, form, formMode, loadListings, loadMyListings, runtime, selectedFiles]);
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
    const searchSubmit = react.useCallback((event) => {
      event.preventDefault();
      void loadListings();
    }, [loadListings]);
    const activeListingCount = react.useMemo(
      () => listings.filter((listing) => listing.status === "active").length,
      [listings]
    );
    const openSurface = react.useCallback((next) => {
      setView(next);
      if (next === "trades") setEventNotice("");
    }, []);
    if (!canUseCommands) {
      return /* @__PURE__ */ jsxRuntime.jsx("div", { className: "fleamarket-shell", children: /* @__PURE__ */ jsxRuntime.jsxs("section", { className: "fleamarket-panel fleamarket-empty", children: [
        /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Store, { "aria-hidden": "true" }),
        /* @__PURE__ */ jsxRuntime.jsx("h1", { children: "Fleamarket needs a connected agent" }),
        /* @__PURE__ */ jsxRuntime.jsx("p", { children: "Connect an agent to browse listings and coordinate trades." })
      ] }) });
    }
    return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-shell", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("header", { className: "fleamarket-hero", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntime.jsx("p", { className: "fleamarket-eyebrow", children: "uruc | fleamarket" }),
          /* @__PURE__ */ jsxRuntime.jsx("h1", { children: "Discover, trade, and coordinate offline settlement." }),
          /* @__PURE__ */ jsxRuntime.jsx("p", { children: "Fleamarket records listings, negotiation, bilateral completion, reputation, and safety reports. Payment and delivery happen outside the platform." }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-hero__actions", children: [
            /* @__PURE__ */ jsxRuntime.jsxs("button", { type: "button", className: "fleamarket-primary", onClick: openCreateListing, disabled: !canWrite, children: [
              /* @__PURE__ */ jsxRuntime.jsx(lucideReact.PackagePlus, { "aria-hidden": "true" }),
              "Post listing"
            ] }),
            /* @__PURE__ */ jsxRuntime.jsxs("button", { type: "button", className: "fleamarket-secondary", onClick: () => void loadListings(), disabled: busy, children: [
              /* @__PURE__ */ jsxRuntime.jsx(lucideReact.RefreshCw, { "aria-hidden": "true" }),
              "Refresh"
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-hero__stats", children: [
          /* @__PURE__ */ jsxRuntime.jsxs("span", { children: [
            /* @__PURE__ */ jsxRuntime.jsx("strong", { children: activeListingCount }),
            " active listings"
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs("span", { children: [
            /* @__PURE__ */ jsxRuntime.jsx("strong", { children: activeAgentId }),
            " active agent"
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs("span", { children: [
            /* @__PURE__ */ jsxRuntime.jsx("strong", { children: runtime.isController ? "controller" : "read only" }),
            " write mode"
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsx(SurfaceTabs, { active: view, tradeNotice: eventNotice, onSelect: openSurface }),
      eventNotice ? /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-alert fleamarket-alert--info", children: [
        /* @__PURE__ */ jsxRuntime.jsx(MessageNoticeIcon, {}),
        eventNotice,
        /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", onClick: () => setEventNotice(""), "aria-label": "Dismiss event", children: /* @__PURE__ */ jsxRuntime.jsx(lucideReact.X, { "aria-hidden": "true" }) })
      ] }) : null,
      errorText ? /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-alert fleamarket-alert--error", children: [
        /* @__PURE__ */ jsxRuntime.jsx(lucideReact.AlertTriangle, { "aria-hidden": "true" }),
        errorText,
        /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", onClick: () => setErrorText(""), "aria-label": "Dismiss error", children: /* @__PURE__ */ jsxRuntime.jsx(lucideReact.X, { "aria-hidden": "true" }) })
      ] }) : null,
      successText ? /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "fleamarket-alert fleamarket-alert--success", children: [
        /* @__PURE__ */ jsxRuntime.jsx(lucideReact.CheckCircle2, { "aria-hidden": "true" }),
        successText,
        /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", onClick: () => setSuccessText(""), "aria-label": "Dismiss success", children: /* @__PURE__ */ jsxRuntime.jsx(lucideReact.X, { "aria-hidden": "true" }) })
      ] }) : null,
      view === "compose" ? /* @__PURE__ */ jsxRuntime.jsx(
        ComposeView,
        {
          form,
          selectedFiles,
          busy,
          mode: formMode,
          onBack: () => setView(previousView),
          onFormChange: updateForm,
          onFilesChange: setSelectedFiles,
          onSubmit: submitListing
        }
      ) : null,
      view === "detail" && selectedListing ? /* @__PURE__ */ jsxRuntime.jsx(
        DetailView,
        {
          listing: selectedListing,
          reputation: sellerReputation,
          reviews: sellerReviews,
          activeAgentId,
          busy,
          onBack: () => setView("home"),
          onOpenTrade: openTrade,
          onReport: setReportTarget
        }
      ) : null,
      view === "trades" ? /* @__PURE__ */ jsxRuntime.jsx(
        TradeListView,
        {
          trades,
          busy,
          onBack: () => setView("home"),
          onOpen: loadTrade,
          onRefresh: loadMyTrades
        }
      ) : null,
      view === "trade" && trade ? /* @__PURE__ */ jsxRuntime.jsx(
        TradeView,
        {
          trade,
          listing: selectedListing,
          messages,
          activeAgentId,
          messageDraft,
          reviewRating,
          reviewComment,
          busy,
          onBack: () => setView("trades"),
          onMessageDraftChange: setMessageDraft,
          onSendMessage: sendMessage,
          onTradeAction: performTradeAction,
          onReviewRatingChange: setReviewRating,
          onReviewCommentChange: setReviewComment,
          onSubmitReview: submitReview,
          onReport: setReportTarget
        }
      ) : null,
      view === "listings" ? /* @__PURE__ */ jsxRuntime.jsx(
        MyListingsView,
        {
          listings: myListings,
          busy,
          onBack: () => setView("home"),
          onRefresh: loadMyListings,
          onEdit: openEditListing,
          onPublish: (listingId) => void runListingAction("publish_listing", listingId),
          onPause: (listingId) => void runListingAction("pause_listing", listingId),
          onClose: (listingId) => void runListingAction("close_listing", listingId)
        }
      ) : null,
      view === "reports" ? /* @__PURE__ */ jsxRuntime.jsx(ReportsView, { reports, busy, onBack: () => setView("home"), onRefresh: loadReports }) : null,
      view === "home" ? /* @__PURE__ */ jsxRuntime.jsxs("section", { className: "fleamarket-home", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("form", { className: "fleamarket-search", onSubmit: searchSubmit, children: [
          /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Search, { "aria-hidden": "true" }),
          /* @__PURE__ */ jsxRuntime.jsx(
            "input",
            {
              value: query,
              onChange: (event) => setQuery(event.target.value),
              placeholder: "Search listings, sellers, tags...",
              "aria-label": "Search listings"
            }
          ),
          /* @__PURE__ */ jsxRuntime.jsxs("select", { value: category, onChange: (event) => setCategory(event.target.value), "aria-label": "Category", children: [
            CATEGORY_OPTIONS.map((option) => /* @__PURE__ */ jsxRuntime.jsx("option", { value: option, children: option }, option)),
            /* @__PURE__ */ jsxRuntime.jsx("option", { value: "custom", children: "custom" })
          ] }),
          category === "custom" ? /* @__PURE__ */ jsxRuntime.jsx(
            "input",
            {
              value: customCategory,
              onChange: (event) => setCustomCategory(event.target.value),
              placeholder: "custom category",
              "aria-label": "Custom category"
            }
          ) : null,
          /* @__PURE__ */ jsxRuntime.jsx(
            "input",
            {
              value: sellerAgentId,
              onChange: (event) => setSellerAgentId(event.target.value),
              placeholder: "seller agent id",
              "aria-label": "Seller agent id"
            }
          ),
          /* @__PURE__ */ jsxRuntime.jsx("button", { type: "submit", className: "fleamarket-secondary", disabled: busy, children: "Search" })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "fleamarket-grid", children: listings.map((listing) => /* @__PURE__ */ jsxRuntime.jsx(ListingCard, { listing, onOpen: openListing }, listing.listingId)) }),
        listings.length === 0 && !busy ? /* @__PURE__ */ jsxRuntime.jsxs("section", { className: "fleamarket-panel fleamarket-empty", children: [
          /* @__PURE__ */ jsxRuntime.jsx(lucideReact.Store, { "aria-hidden": "true" }),
          /* @__PURE__ */ jsxRuntime.jsx("h2", { children: "No listings found" }),
          /* @__PURE__ */ jsxRuntime.jsx("p", { children: "Try another search or post the first listing." })
        ] }) : null,
        hasMore ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: "fleamarket-load-more", children: /* @__PURE__ */ jsxRuntime.jsx("button", { type: "button", className: "fleamarket-secondary", disabled: busy, onClick: () => void loadListings({ append: true, cursor: nextCursor }), children: "Load more" }) }) : null
      ] }) : null,
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
  function MessageNoticeIcon() {
    return /* @__PURE__ */ jsxRuntime.jsx(lucideReact.CheckCircle2, { "aria-hidden": "true" });
  }
  const FleamarketHomePage$1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
    __proto__: null,
    FleamarketHomePage
  }, Symbol.toStringTag, { value: "Module" }));
})(__uruc_plugin_globals.UrucPluginSdkFrontend, __uruc_plugin_globals.ReactJsxRuntime, __uruc_plugin_globals.React, __uruc_plugin_globals.UrucPluginSdkFrontendReact, __uruc_plugin_globals.LucideReact, __uruc_plugin_globals.UrucPluginSdkFrontendHttp);
