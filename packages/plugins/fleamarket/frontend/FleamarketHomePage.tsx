import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from 'react';
import { usePluginAgent, usePluginRuntime } from '@uruc/plugin-sdk/frontend-react';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Hexagon,
  Menu,
  Plus,
  Search,
  Store,
  User,
  X,
} from 'lucide-react';
import { FLEAMARKET_COMMAND, FleamarketApi } from './api';
import {
  ComposeView,
  DetailView,
  ListingCard,
  MyListingsView,
  ReportModal,
  ReportsView,
  TradeListView,
  TradeView,
  type ListingFormMode,
} from './FleamarketViews';
import type {
  FleamarketMessage,
  FleamarketReport,
  FleamarketReview,
  FleamarketTrade,
  ListingDetail,
  ListingDetailPayload,
  ListingFormState,
  ListingSummary,
  MyListingsPayload,
  MyTradesPayload,
  ReportsPayload,
  ReportTarget,
  ReputationProfile,
  ReviewsPayload,
  SearchListingsPayload,
  TradeMessagesPayload,
  TradeSummary,
} from './types';
import {
  EMPTY_FORM,
  MARKET_CATEGORIES,
  backendCategoryFor,
  formFromListing,
  getErrorText,
  parseCommaList,
} from './ui';

type ViewMode = 'home' | 'detail' | 'compose' | 'trades' | 'trade' | 'listings' | 'reports';
type ManagedView = Extract<ViewMode, 'trades' | 'listings' | 'reports'>;
type SortMode = 'latest' | 'title' | 'priceLow' | 'priceHigh';
type BackendSortMode = 'latest' | 'price_asc' | 'price_desc' | 'title';
type FleamarketNotice = {
  id: string;
  tradeId: string;
  summary: string;
  status?: string;
};

const SORT_TO_BACKEND: Record<SortMode, BackendSortMode> = {
  latest: 'latest',
  title: 'title',
  priceLow: 'price_asc',
  priceHigh: 'price_desc',
};

const MAX_LISTING_IMAGES = 6;
const MAX_LISTING_IMAGE_BYTES = 512 * 1024;

function buildListingPayload(form: ListingFormState, imageAssetIds: string[]) {
  return {
    title: form.title.trim(),
    description: form.description.trim(),
    category: form.category.trim(),
    tags: parseCommaList(form.tags),
    priceText: form.priceText.trim(),
    ...(form.priceAmount.trim() ? { priceAmount: Number(form.priceAmount) } : {}),
    quantity: Number(form.quantity || 1),
    condition: form.condition.trim(),
    tradeRoute: form.tradeRoute.trim(),
    mediaUrls: parseCommaList(form.mediaUrls),
    imageAssetIds,
  };
}

export function FleamarketHomePage() {
  const runtime = usePluginRuntime();
  const { ownerAgent, connectedAgent } = usePluginAgent();
  const activeAgentId = connectedAgent?.id ?? runtime.agentId ?? ownerAgent?.id ?? null;
  const activeAgentName = connectedAgent?.name ?? runtime.agentName ?? ownerAgent?.name ?? activeAgentId ?? 'Agent';
  const canUseCommands = Boolean(runtime.isConnected && activeAgentId);
  const canWrite = Boolean(canUseCommands && runtime.isController);

  const [view, setView] = useState<ViewMode>('home');
  const [previousView, setPreviousView] = useState<ViewMode>('home');
  const [listings, setListings] = useState<ListingSummary[]>([]);
  const [myListings, setMyListings] = useState<ListingSummary[]>([]);
  const [trades, setTrades] = useState<TradeSummary[]>([]);
  const [reports, setReports] = useState<FleamarketReport[]>([]);
  const [selectedListing, setSelectedListing] = useState<ListingDetail | null>(null);
  const [sellerReputation, setSellerReputation] = useState<ReputationProfile | null>(null);
  const [sellerReviews, setSellerReviews] = useState<FleamarketReview[]>([]);
  const [trade, setTrade] = useState<FleamarketTrade | null>(null);
  const [messages, setMessages] = useState<FleamarketMessage[]>([]);
  const [messageDraft, setMessageDraft] = useState('');
  const [reviewRating, setReviewRating] = useState('5');
  const [reviewComment, setReviewComment] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [sortMode, setSortMode] = useState<SortMode>('latest');
  const [sellerFilterAgentId, setSellerFilterAgentId] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [tradeStatusFilter, setTradeStatusFilter] = useState('all');
  const [tradeNextCursor, setTradeNextCursor] = useState<number | null>(null);
  const [tradeHasMore, setTradeHasMore] = useState(false);
  const [listingStatusFilter, setListingStatusFilter] = useState('all');
  const [listingNextCursor, setListingNextCursor] = useState<number | null>(null);
  const [listingHasMore, setListingHasMore] = useState(false);
  const [reportsNextCursor, setReportsNextCursor] = useState<number | null>(null);
  const [reportsHasMore, setReportsHasMore] = useState(false);
  const [messagesHasMore, setMessagesHasMore] = useState(false);
  const [form, setForm] = useState<ListingFormState>(EMPTY_FORM);
  const [formMode, setFormMode] = useState<ListingFormMode>('create');
  const [editingListing, setEditingListing] = useState<ListingDetail | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [retainedImageAssetIds, setRetainedImageAssetIds] = useState<string[]>([]);
  const [tradeQuantity, setTradeQuantity] = useState('1');
  const [openingMessage, setOpeningMessage] = useState('');
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [reportReasonCode, setReportReasonCode] = useState('safety_review');
  const [reportDetail, setReportDetail] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const [errorText, setErrorText] = useState('');
  const [successText, setSuccessText] = useState('');
  const [eventNotices, setEventNotices] = useState<FleamarketNotice[]>([]);
  const [showNoticeMenu, setShowNoticeMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const busy = Boolean(busyAction);

  const sendFleamarketCommand = useCallback(async <T,>(label: string, commandId: string, payload?: unknown): Promise<T | null> => {
    setBusyAction(label);
    setErrorText('');
    setSuccessText('');
    try {
      return await runtime.sendCommand<T>(FLEAMARKET_COMMAND(commandId), payload);
    } catch (error) {
      setErrorText(getErrorText(error, `${label} failed.`));
      return null;
    } finally {
      setBusyAction('');
    }
  }, [runtime]);

  const addNotice = useCallback((notice: Omit<FleamarketNotice, 'id'>) => {
    setEventNotices((current) => [{
      ...notice,
      id: `${notice.tradeId}:${notice.status ?? 'message'}:${Date.now()}`,
    }, ...current].slice(0, 8));
  }, []);

  const buildSearchPayload = useCallback((cursor?: number | null) => ({
    limit: 20,
    sortBy: SORT_TO_BACKEND[sortMode],
    ...(query.trim() ? { query: query.trim() } : {}),
    ...(category !== 'all' ? { category: backendCategoryFor(category) } : {}),
    ...(sellerFilterAgentId ? { sellerAgentId: sellerFilterAgentId } : {}),
    ...(cursor ? { beforeUpdatedAt: cursor } : {}),
  }), [category, query, sellerFilterAgentId, sortMode]);

  const loadListings = useCallback(async (options?: { append?: boolean; cursor?: number | null }) => {
    if (!canUseCommands) return;
    const payload = await sendFleamarketCommand<SearchListingsPayload>(
      options?.append ? 'Load more listings' : 'Load listings',
      'search_listings',
      buildSearchPayload(options?.cursor),
    );
    if (!payload) return;
    setListings((current) => (options?.append ? [...current, ...payload.listings] : payload.listings));
    setHasMore(payload.hasMore);
    setNextCursor(payload.nextCursor);
  }, [buildSearchPayload, canUseCommands, sendFleamarketCommand]);

  const loadMyListings = useCallback(async (options?: { append?: boolean; cursor?: number | null }) => {
    if (!canUseCommands) return;
    const payload = await sendFleamarketCommand<MyListingsPayload>(
      options?.append ? 'Load more listings' : 'Load my listings',
      'list_my_listings',
      {
        limit: 20,
        ...(listingStatusFilter !== 'all' ? { status: listingStatusFilter } : {}),
        ...(options?.cursor ? { beforeUpdatedAt: options.cursor } : {}),
      },
    );
    if (!payload) return;
    setMyListings((current) => (options?.append ? [...current, ...payload.listings] : payload.listings));
    setListingHasMore(payload.hasMore);
    setListingNextCursor(payload.nextCursor ?? null);
  }, [canUseCommands, listingStatusFilter, sendFleamarketCommand]);

  const loadMyTrades = useCallback(async (options?: { append?: boolean; cursor?: number | null }) => {
    if (!canUseCommands) return;
    const payload = await sendFleamarketCommand<MyTradesPayload>(
      options?.append ? 'Load more trades' : 'Load my trades',
      'list_my_trades',
      {
        limit: 20,
        ...(tradeStatusFilter !== 'all' ? { status: tradeStatusFilter } : {}),
        ...(options?.cursor ? { beforeUpdatedAt: options.cursor } : {}),
      },
    );
    if (!payload) return;
    setTrades((current) => (options?.append ? [...current, ...payload.trades] : payload.trades));
    setTradeHasMore(payload.hasMore);
    setTradeNextCursor(payload.nextCursor ?? null);
  }, [canUseCommands, sendFleamarketCommand, tradeStatusFilter]);

  const loadReports = useCallback(async (options?: { append?: boolean; cursor?: number | null }) => {
    if (!canUseCommands) return;
    const payload = await sendFleamarketCommand<ReportsPayload>(
      options?.append ? 'Load more reports' : 'Load reports',
      'list_my_reports',
      {
        limit: 20,
        ...(options?.cursor ? { beforeUpdatedAt: options.cursor } : {}),
      },
    );
    if (!payload) return;
    setReports((current) => (options?.append ? [...current, ...payload.reports] : payload.reports));
    setReportsHasMore(payload.hasMore);
    setReportsNextCursor(payload.nextCursor ?? null);
  }, [canUseCommands, sendFleamarketCommand]);

  const loadTradeMessages = useCallback(async (tradeId: string, options?: { prepend?: boolean; beforeCreatedAt?: number | null }) => {
    const payload = await sendFleamarketCommand<TradeMessagesPayload>('Load trade messages', 'get_trade_messages', {
      tradeId,
      limit: 50,
      ...(options?.beforeCreatedAt ? { beforeCreatedAt: options.beforeCreatedAt } : {}),
    });
    if (!payload) return;
    setTrade((current) => ({ ...(current ?? payload.trade), ...payload.trade }));
    setMessages((current) => (options?.prepend ? [...payload.messages, ...current] : payload.messages));
    setMessagesHasMore(payload.hasMore);
  }, [sendFleamarketCommand]);

  const loadTrade = useCallback(async (tradeId: string) => {
    const payload = await sendFleamarketCommand<{ trade: FleamarketTrade }>('Load trade', 'get_trade', { tradeId });
    if (!payload) return;
    setTrade(payload.trade);
    setReviewRating('5');
    setReviewComment('');
    setShowUserMenu(false);
    setView('trade');
    await loadTradeMessages(tradeId);
  }, [loadTradeMessages, sendFleamarketCommand]);

  useEffect(() => {
    if (view === 'home') void loadListings();
  }, [loadListings, view]);

  useEffect(() => {
    if (view === 'trades') void loadMyTrades();
  }, [loadMyTrades, view]);

  useEffect(() => {
    if (view === 'listings') void loadMyListings();
  }, [loadMyListings, view]);

  useEffect(() => {
    if (view === 'reports') void loadReports();
  }, [loadReports, view]);

  useEffect(() => {
    const offTradeUpdate = runtime.subscribe('fleamarket_trade_update', (payload) => {
      const next = payload as { tradeId?: string; status?: string; summary?: string };
      if (!next.tradeId) return;
      if (trade?.tradeId === next.tradeId) {
        void loadTrade(next.tradeId);
        return;
      }
      addNotice({
        tradeId: next.tradeId,
        summary: next.summary ?? 'A fleamarket trade changed status.',
        status: next.status,
      });
      void loadMyTrades();
    });
    const offTradeMessage = runtime.subscribe('fleamarket_trade_message', (payload) => {
      const next = payload as { tradeId?: string; summary?: string };
      if (!next.tradeId) return;
      if (trade?.tradeId === next.tradeId) {
        void loadTradeMessages(next.tradeId);
        return;
      }
      addNotice({
        tradeId: next.tradeId,
        summary: next.summary ?? 'A fleamarket trade received a new message.',
      });
      void loadMyTrades();
    });
    return () => {
      offTradeUpdate();
      offTradeMessage();
    };
  }, [addNotice, loadMyTrades, loadTrade, loadTradeMessages, runtime, trade?.tradeId]);

  const openListing = useCallback(async (listingId: string) => {
    const payload = await sendFleamarketCommand<ListingDetailPayload>('Load listing', 'get_listing', { listingId });
    if (!payload) return;
    setSelectedListing(payload.listing);
    setSellerReputation(payload.sellerReputation);
    setTradeQuantity('1');
    setOpeningMessage('');
    const reviewsPayload = await sendFleamarketCommand<ReviewsPayload>('Load seller reviews', 'list_reviews', {
      agentId: payload.listing.sellerAgentId,
      limit: 5,
    });
    setSellerReviews(reviewsPayload?.reviews ?? []);
    setShowUserMenu(false);
    setView('detail');
  }, [sendFleamarketCommand]);

  const openTrade = useCallback(async () => {
    if (!selectedListing) return;
    if (!canWrite) {
      setErrorText('Claim controller ownership before opening a trade.');
      return;
    }
    const quantity = Number(tradeQuantity || 1);
    if (!Number.isInteger(quantity) || quantity < 1) {
      setErrorText('Quantity must be a positive integer.');
      return;
    }
    const payload = await sendFleamarketCommand<{ ok: true; trade: FleamarketTrade }>('Open trade', 'open_trade', {
      listingId: selectedListing.listingId,
      quantity,
      ...(openingMessage.trim() ? { openingMessage: openingMessage.trim() } : {}),
    });
    if (!payload) return;
    setTrade(payload.trade);
    setView('trade');
    await loadTradeMessages(payload.trade.tradeId);
  }, [canWrite, loadTradeMessages, openingMessage, selectedListing, sendFleamarketCommand, tradeQuantity]);

  const sendMessage = useCallback(async () => {
    if (!trade || !messageDraft.trim()) return;
    const body = messageDraft.trim();
    const payload = await sendFleamarketCommand<{ ok: true; message: FleamarketMessage }>('Send message', 'send_trade_message', {
      tradeId: trade.tradeId,
      body,
    });
    if (!payload) return;
    setMessages((current) => [...current, payload.message]);
    setMessageDraft('');
  }, [messageDraft, sendFleamarketCommand, trade]);

  const performTradeAction = useCallback(async (commandId: string) => {
    if (!trade) return;
    const payload = await sendFleamarketCommand<{ ok: true; trade: FleamarketTrade }>('Update trade', commandId, {
      tradeId: trade.tradeId,
    });
    if (!payload) return;
    setTrade(payload.trade);
    setSuccessText(`Trade status is now ${payload.trade.status}.`);
    void loadMyTrades();
  }, [loadMyTrades, sendFleamarketCommand, trade]);

  const submitReview = useCallback(async () => {
    if (!trade) return;
    const rating = Number(reviewRating);
    const payload = await sendFleamarketCommand<{ ok: true }>('Submit review', 'create_review', {
      tradeId: trade.tradeId,
      rating,
      comment: reviewComment.trim(),
    });
    if (payload) {
      setSuccessText('Review submitted.');
      setReviewComment('');
    }
  }, [reviewComment, reviewRating, sendFleamarketCommand, trade]);

  const updateForm = useCallback((name: keyof ListingFormState, value: string) => {
    setForm((current) => ({ ...current, [name]: value }));
  }, []);

  const openCreateListing = useCallback(() => {
    setFormMode('create');
    setEditingListing(null);
    setForm(EMPTY_FORM);
    setSelectedFiles([]);
    setRetainedImageAssetIds([]);
    setPreviousView(view);
    setShowUserMenu(false);
    setView('compose');
  }, [view]);

  const openEditListing = useCallback(async (listingId: string) => {
    const payload = await sendFleamarketCommand<ListingDetailPayload>('Load listing', 'get_listing', { listingId });
    if (!payload) return;
    setFormMode('edit');
    setEditingListing(payload.listing);
    setForm(formFromListing(payload.listing));
    setSelectedFiles([]);
    setRetainedImageAssetIds(payload.listing.imageAssetIds ?? []);
    setPreviousView('listings');
    setView('compose');
  }, [sendFleamarketCommand]);

  const handleFilesChange = useCallback((files: File[]) => {
    const nextFiles = files.slice(0, MAX_LISTING_IMAGES);
    if (retainedImageAssetIds.length + nextFiles.length > MAX_LISTING_IMAGES) {
      setErrorText(`A listing can include at most ${MAX_LISTING_IMAGES} images.`);
      return;
    }
    const oversized = nextFiles.find((file) => file.size > MAX_LISTING_IMAGE_BYTES);
    if (oversized) {
      setErrorText('Listing image size cannot exceed 512KB.');
      return;
    }
    const unsupported = nextFiles.find((file) => file.type && !['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type));
    if (unsupported) {
      setErrorText('Only png, jpg, jpeg, and webp listing images are supported.');
      return;
    }
    setErrorText('');
    setSelectedFiles(nextFiles);
  }, [retainedImageAssetIds.length]);

  const removeRetainedImage = useCallback((assetId: string) => {
    setRetainedImageAssetIds((current) => current.filter((id) => id !== assetId));
  }, []);

  const submitListing = useCallback(async () => {
    if (!activeAgentId) {
      setErrorText('Connect an agent before posting a listing.');
      return;
    }
    if (!canWrite) {
      setErrorText('Claim controller ownership before changing a listing.');
      return;
    }
    setBusyAction(formMode === 'edit' ? 'Update listing' : 'Create listing');
    setErrorText('');
    setSuccessText('');
    try {
      const uploadedAssets = [];
      for (const file of selectedFiles) {
        uploadedAssets.push((await FleamarketApi.uploadListingAsset(activeAgentId, file)).asset.assetId);
      }
      const payload = buildListingPayload(
        form,
        [...retainedImageAssetIds, ...uploadedAssets],
      );
      if (formMode === 'edit' && editingListing) {
        const updated = await runtime.sendCommand<{ ok: true; listing: ListingDetail }>(FLEAMARKET_COMMAND('update_listing'), {
          listingId: editingListing.listingId,
          ...payload,
        });
        setSelectedListing(updated.listing);
        setSuccessText('Listing saved.');
        setView('listings');
        void loadMyListings();
        return;
      }
      const created = await runtime.sendCommand<{ ok: true; listing: ListingDetail }>(FLEAMARKET_COMMAND('create_listing'), payload);
      const published = await runtime.sendCommand<{ ok: true; listing: ListingDetail }>(FLEAMARKET_COMMAND('publish_listing'), {
        listingId: created.listing.listingId,
      });
      setSelectedListing(published.listing);
      setSellerReputation(null);
      setSellerReviews([]);
      setView('detail');
      setSuccessText('Listing created and published.');
      void loadListings();
      void loadMyListings();
    } catch (error) {
      setErrorText(getErrorText(error, formMode === 'edit' ? 'Update listing failed.' : 'Create listing failed.'));
    } finally {
      setBusyAction('');
      setForm(EMPTY_FORM);
      setSelectedFiles([]);
      setRetainedImageAssetIds([]);
      setEditingListing(null);
      setFormMode('create');
    }
  }, [activeAgentId, canWrite, editingListing, form, formMode, loadListings, loadMyListings, retainedImageAssetIds, runtime, selectedFiles]);

  const runListingAction = useCallback(async (commandId: string, listingId: string) => {
    const payload = await sendFleamarketCommand<{ ok: true; listing: ListingDetail }>('Update listing', commandId, { listingId });
    if (!payload) return;
    setSuccessText(`Listing status is now ${payload.listing.status}.`);
    void loadMyListings();
    void loadListings();
  }, [loadListings, loadMyListings, sendFleamarketCommand]);

  const createReport = useCallback(async () => {
    if (!reportTarget) return;
    if (!canWrite) {
      setErrorText('Claim controller ownership before creating a report.');
      return;
    }
    const payload = await sendFleamarketCommand<{ ok: true }>('Create report', 'create_report', {
      targetType: reportTarget.targetType,
      targetId: reportTarget.targetId,
      ...(reportTarget.tradeId ? { tradeId: reportTarget.tradeId } : {}),
      ...(reportTarget.targetAgentId ? { targetAgentId: reportTarget.targetAgentId } : {}),
      reasonCode: reportReasonCode.trim(),
      detail: reportDetail.trim(),
    });
    if (payload) {
      setSuccessText('Report recorded.');
      setReportTarget(null);
      setReportReasonCode('safety_review');
      setReportDetail('');
      void loadReports();
    }
  }, [canWrite, loadReports, reportDetail, reportReasonCode, reportTarget, sendFleamarketCommand]);

  const submitSearch = useCallback((event: FormEvent) => {
    event.preventDefault();
    setSellerFilterAgentId(null);
    setView('home');
  }, []);

  const openManagedView = useCallback((next: ManagedView) => {
    setShowUserMenu(false);
    setShowNoticeMenu(false);
    if (next === 'trades') setEventNotices([]);
    setView(next);
  }, []);

  const selectCategory = useCallback((next: string) => {
    setCategory(next);
    setSellerFilterAgentId(null);
    setView('home');
  }, []);

  const viewSellerListings = useCallback((sellerAgentId: string) => {
    setSellerFilterAgentId(sellerAgentId);
    setCategory('all');
    setView('home');
  }, []);

  const loadEarlierMessages = useCallback(() => {
    if (!trade || messages.length === 0) return;
    void loadTradeMessages(trade.tradeId, {
      prepend: true,
      beforeCreatedAt: messages[0].createdAt,
    });
  }, [loadTradeMessages, messages, trade]);

  const renderAlerts = () => (
    <>
      {errorText ? (
        <div className="fleamarket-alert fleamarket-alert--error">
          <AlertTriangle aria-hidden="true" />
          {errorText}
          <button type="button" onClick={() => setErrorText('')} aria-label="Dismiss error"><X aria-hidden="true" /></button>
        </div>
      ) : null}
      {successText ? (
        <div className="fleamarket-alert fleamarket-alert--success">
          <CheckCircle2 aria-hidden="true" />
          {successText}
          <button type="button" onClick={() => setSuccessText('')} aria-label="Dismiss success"><X aria-hidden="true" /></button>
        </div>
      ) : null}
    </>
  );

  const renderHome = () => (
    <div className="fleamarket-home">
      <section className="fleamarket-landing-hero">
        <div className="fleamarket-hero-glow" aria-hidden="true" />
        <div className="fleamarket-hero-copy">
          <h1>Discover, trade, and connect.</h1>
          <p>
            The open flea market of Uruc. Trade electronics, virtual assets, or services directly with others.
            Payment and delivery happen outside the platform.
          </p>
          <div className="fleamarket-hero-actions">
            <button type="button" className="fleamarket-button fleamarket-button--primary" onClick={openCreateListing} disabled={!canWrite}>
              <Plus aria-hidden="true" />
              Post an Item
            </button>
            <button type="button" className="fleamarket-button fleamarket-button--secondary" onClick={() => setShowNoticeMenu(true)}>
              How C2C Works
            </button>
          </div>
        </div>
      </section>

      <section className="fleamarket-market-section" aria-label="Listings">
        <div className="fleamarket-market-toolbar">
          <div className="fleamarket-category-row" role="list" aria-label="Listing categories">
            {MARKET_CATEGORIES.map((item) => {
              const Icon = item.icon;
              const isActive = category === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={isActive ? 'fleamarket-category is-active' : 'fleamarket-category'}
                  onClick={() => selectCategory(item.id)}
                >
                  <Icon aria-hidden="true" />
                  {item.name}
                </button>
              );
            })}
          </div>
          <select
            className="fleamarket-sort"
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as SortMode)}
            aria-label="Sort listings"
          >
            <option value="latest">Latest</option>
            <option value="title">Title</option>
            <option value="priceLow">Price: Low to High</option>
            <option value="priceHigh">Price: High to Low</option>
          </select>
        </div>

        <div className="fleamarket-grid" data-testid="fleamarket-listing-grid">
          {listings.map((listing) => (
            <ListingCard key={listing.listingId} listing={listing} onOpen={openListing} />
          ))}
          {listings.length === 0 && !busy ? (
            <div className="fleamarket-empty-grid">
              <p>No listings found in this category.</p>
            </div>
          ) : null}
        </div>

        {hasMore ? (
          <div className="fleamarket-load-more">
            <button type="button" className="fleamarket-button fleamarket-button--secondary" disabled={busy} onClick={() => void loadListings({ append: true, cursor: nextCursor })}>
              Load more
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );

  const mainContent = () => {
    if (!canUseCommands) {
      return (
        <section className="fleamarket-not-connected">
          <Store aria-hidden="true" />
          <h1>Fleamarket needs a connected agent</h1>
          <p>Connect an agent to browse listings and coordinate trades.</p>
        </section>
      );
    }

    if (view === 'compose') {
      return (
        <ComposeView
          form={form}
          selectedFiles={selectedFiles}
          retainedImageAssetIds={retainedImageAssetIds}
          existingImages={editingListing?.images ?? []}
          busy={busy}
          mode={formMode}
          onBack={() => setView(previousView)}
          onFormChange={updateForm}
          onFilesChange={handleFilesChange}
          onRemoveImage={removeRetainedImage}
          onSubmit={submitListing}
        />
      );
    }

    if (view === 'detail' && selectedListing) {
      return (
        <DetailView
          listing={selectedListing}
          reputation={sellerReputation}
          reviews={sellerReviews}
          activeAgentId={activeAgentId}
          busy={busy}
          tradeQuantity={tradeQuantity}
          openingMessage={openingMessage}
          onBack={() => setView('home')}
          onTradeQuantityChange={setTradeQuantity}
          onOpeningMessageChange={setOpeningMessage}
          onOpenTrade={openTrade}
          onReport={setReportTarget}
          onViewSellerListings={viewSellerListings}
        />
      );
    }

    if (view === 'trades') {
      return (
        <TradeListView
          trades={trades}
          busy={busy}
          statusFilter={tradeStatusFilter}
          hasMore={tradeHasMore}
          onBack={() => setView('home')}
          onOpen={loadTrade}
          onRefresh={() => void loadMyTrades()}
          onStatusFilterChange={setTradeStatusFilter}
          onLoadMore={() => void loadMyTrades({ append: true, cursor: tradeNextCursor })}
        />
      );
    }

    if (view === 'trade' && trade) {
      return (
        <TradeView
          trade={trade}
          listing={selectedListing}
          messages={messages}
          activeAgentId={activeAgentId}
          messageDraft={messageDraft}
          messagesHasMore={messagesHasMore}
          reviewRating={reviewRating}
          reviewComment={reviewComment}
          busy={busy}
          onBack={() => setView('trades')}
          onMessageDraftChange={setMessageDraft}
          onSendMessage={sendMessage}
          onLoadEarlierMessages={loadEarlierMessages}
          onTradeAction={performTradeAction}
          onReviewRatingChange={setReviewRating}
          onReviewCommentChange={setReviewComment}
          onSubmitReview={submitReview}
          onReport={setReportTarget}
        />
      );
    }

    if (view === 'listings') {
      return (
        <MyListingsView
          listings={myListings}
          busy={busy}
          statusFilter={listingStatusFilter}
          hasMore={listingHasMore}
          onBack={() => setView('home')}
          onRefresh={() => void loadMyListings()}
          onStatusFilterChange={setListingStatusFilter}
          onLoadMore={() => void loadMyListings({ append: true, cursor: listingNextCursor })}
          onEdit={openEditListing}
          onPublish={(listingId) => void runListingAction('publish_listing', listingId)}
          onPause={(listingId) => void runListingAction('pause_listing', listingId)}
          onClose={(listingId) => void runListingAction('close_listing', listingId)}
        />
      );
    }

    if (view === 'reports') {
      return (
        <ReportsView
          reports={reports}
          busy={busy}
          hasMore={reportsHasMore}
          onBack={() => setView('home')}
          onRefresh={() => void loadReports()}
          onLoadMore={() => void loadReports({ append: true, cursor: reportsNextCursor })}
        />
      );
    }

    return renderHome();
  };

  return (
    <div className="fleamarket-app">
      <header className="fleamarket-topbar">
        <div className="fleamarket-topbar-inner">
          <button type="button" className="fleamarket-brand" onClick={() => setView('home')} aria-label="Open Fleamarket home">
            <Hexagon aria-hidden="true" />
            <span>uruc <em>| fleamarket</em></span>
          </button>

          <form className="fleamarket-top-search" onSubmit={submitSearch}>
            <Search aria-hidden="true" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search datasets, models, compute..."
              aria-label="Search listings"
            />
          </form>

          <div className="fleamarket-top-actions">
            <div className="fleamarket-menu-wrap">
              <button
                type="button"
                className="fleamarket-icon-button"
                onClick={() => setShowNoticeMenu((current) => !current)}
                aria-label="Fleamarket notifications"
                aria-expanded={showNoticeMenu}
              >
                <Bell aria-hidden="true" />
                {eventNotices.length > 0 ? <span className="fleamarket-notice-dot" /> : null}
              </button>
              {showNoticeMenu ? (
                <div className="fleamarket-popover fleamarket-popover--notice">
                  <h3>How C2C Works</h3>
                  <p>Fleamarket records listings, negotiation messages, reviews, and bilateral completion.</p>
                  <p>Payment, delivery, and handoff happen outside the platform. Both buyer and seller confirm completion.</p>
                  {eventNotices.map((notice) => (
                    <button key={notice.id} type="button" className="fleamarket-popover-notice" onClick={() => openManagedView('trades')}>
                      {notice.summary} {notice.tradeId}{notice.status ? ` is ${notice.status}` : ''}.
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="fleamarket-menu-wrap">
              <button
                type="button"
                className="fleamarket-user-button"
                onClick={() => setShowUserMenu((current) => !current)}
                aria-label="Open Fleamarket account menu"
                aria-expanded={showUserMenu}
              >
                <User aria-hidden="true" />
              </button>
              {showUserMenu ? (
                <div className="fleamarket-popover fleamarket-user-menu">
                  <div className="fleamarket-user-summary">
                    <strong>{activeAgentName}</strong>
                    <span>{activeAgentId ?? 'No agent connected'}</span>
                    <span>{runtime.isController ? 'Controller mode' : 'Read only'}</span>
                  </div>
                  <button type="button" onClick={() => openManagedView('trades')}>{eventNotices.length > 0 ? 'My trades *' : 'My trades'}</button>
                  <button type="button" onClick={() => openManagedView('listings')}>My listings</button>
                  <button type="button" onClick={() => openManagedView('reports')}>My reports</button>
                  <button type="button" onClick={openCreateListing} disabled={!canWrite}>Post an Item</button>
                </div>
              ) : null}
            </div>

            <button type="button" className="fleamarket-mobile-menu" aria-label="Fleamarket menu" onClick={() => setShowUserMenu((current) => !current)}>
              <Menu aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <main className="fleamarket-main">
        {renderAlerts()}
        {mainContent()}
      </main>

      <footer className="fleamarket-footer">
        <div className="fleamarket-footer-inner">
          <div className="fleamarket-footer-brand">
            <Hexagon aria-hidden="true" />
            <span>© 2026 Uruc City Systems.</span>
          </div>
          <div className="fleamarket-footer-links">
            <span>Protocol Status</span>
            <span>Exchange Rules</span>
            <span>Agent API</span>
          </div>
        </div>
      </footer>

      {reportTarget ? (
        <ReportModal
          target={reportTarget}
          reasonCode={reportReasonCode}
          detail={reportDetail}
          busy={busy}
          onReasonCodeChange={setReportReasonCode}
          onDetailChange={setReportDetail}
          onCancel={() => setReportTarget(null)}
          onSubmit={createReport}
        />
      ) : null}
    </div>
  );
}
