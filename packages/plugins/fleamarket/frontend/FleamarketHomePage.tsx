import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import { usePluginAgent, usePluginRuntime } from '@uruc/plugin-sdk/frontend-react';
import { AlertTriangle, CheckCircle2, PackagePlus, RefreshCw, Search, Store, X } from 'lucide-react';
import { FLEAMARKET_COMMAND, FleamarketApi } from './api';
import {
  ComposeView,
  DetailView,
  ListingCard,
  MyListingsView,
  ReportModal,
  ReportsView,
  SurfaceTabs,
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
  CATEGORY_OPTIONS,
  EMPTY_FORM,
  formFromListing,
  getErrorText,
  parseCommaList,
} from './ui';

type ViewMode = 'home' | 'detail' | 'compose' | 'trades' | 'trade' | 'listings' | 'reports';

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
  const [customCategory, setCustomCategory] = useState('');
  const [sellerAgentId, setSellerAgentId] = useState('');
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [form, setForm] = useState<ListingFormState>(EMPTY_FORM);
  const [formMode, setFormMode] = useState<ListingFormMode>('create');
  const [editingListing, setEditingListing] = useState<ListingDetail | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [reportReasonCode, setReportReasonCode] = useState('safety_review');
  const [reportDetail, setReportDetail] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const [errorText, setErrorText] = useState('');
  const [successText, setSuccessText] = useState('');
  const [eventNotice, setEventNotice] = useState('');

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

  const effectiveCategory = category === 'custom' ? customCategory.trim() : category;
  const buildSearchPayload = useCallback((cursor?: number | null) => ({
    limit: 20,
    ...(query.trim() ? { query: query.trim() } : {}),
    ...(effectiveCategory && effectiveCategory !== 'all' ? { category: effectiveCategory } : {}),
    ...(sellerAgentId.trim() ? { sellerAgentId: sellerAgentId.trim() } : {}),
    ...(cursor ? { beforeUpdatedAt: cursor } : {}),
  }), [effectiveCategory, query, sellerAgentId]);

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

  const loadMyListings = useCallback(async () => {
    if (!canUseCommands) return;
    const payload = await sendFleamarketCommand<MyListingsPayload>('Load my listings', 'list_my_listings', { limit: 20 });
    if (payload) setMyListings(payload.listings);
  }, [canUseCommands, sendFleamarketCommand]);

  const loadMyTrades = useCallback(async () => {
    if (!canUseCommands) return;
    const payload = await sendFleamarketCommand<MyTradesPayload>('Load my trades', 'list_my_trades', { limit: 20 });
    if (payload) setTrades(payload.trades);
  }, [canUseCommands, sendFleamarketCommand]);

  const loadReports = useCallback(async () => {
    if (!canUseCommands) return;
    const payload = await sendFleamarketCommand<ReportsPayload>('Load reports', 'list_my_reports', { limit: 20 });
    if (payload) setReports(payload.reports);
  }, [canUseCommands, sendFleamarketCommand]);

  const loadTradeMessages = useCallback(async (tradeId: string) => {
    const payload = await sendFleamarketCommand<TradeMessagesPayload>('Load trade messages', 'get_trade_messages', {
      tradeId,
      limit: 50,
    });
    if (!payload) return;
    setTrade((current) => ({ ...(current ?? payload.trade), ...payload.trade }));
    setMessages(payload.messages);
  }, [sendFleamarketCommand]);

  const loadTrade = useCallback(async (tradeId: string) => {
    const payload = await sendFleamarketCommand<{ trade: FleamarketTrade }>('Load trade', 'get_trade', { tradeId });
    if (!payload) return;
    setTrade(payload.trade);
    setReviewRating('5');
    setReviewComment('');
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
      setEventNotice(`${next.summary ?? 'A fleamarket trade changed status.'} ${next.tradeId}${next.status ? ` is ${next.status}` : ''}.`);
      void loadMyTrades();
    });
    const offTradeMessage = runtime.subscribe('fleamarket_trade_message', (payload) => {
      const next = payload as { tradeId?: string; summary?: string };
      if (!next.tradeId) return;
      if (trade?.tradeId === next.tradeId) {
        void loadTradeMessages(next.tradeId);
        return;
      }
      setEventNotice(`${next.summary ?? 'A fleamarket trade received a new message.'} ${next.tradeId}.`);
      void loadMyTrades();
    });
    return () => {
      offTradeUpdate();
      offTradeMessage();
    };
  }, [loadMyTrades, loadTrade, loadTradeMessages, runtime, trade?.tradeId]);

  const openListing = useCallback(async (listingId: string) => {
    const payload = await sendFleamarketCommand<ListingDetailPayload>('Load listing', 'get_listing', { listingId });
    if (!payload) return;
    setSelectedListing(payload.listing);
    setSellerReputation(payload.sellerReputation);
    const reviewsPayload = await sendFleamarketCommand<ReviewsPayload>('Load seller reviews', 'list_reviews', {
      agentId: payload.listing.sellerAgentId,
      limit: 5,
    });
    setSellerReviews(reviewsPayload?.reviews ?? []);
    setView('detail');
  }, [sendFleamarketCommand]);

  const openTrade = useCallback(async () => {
    if (!selectedListing) return;
    if (!canWrite) {
      setErrorText('Claim controller ownership before opening a trade.');
      return;
    }
    const payload = await sendFleamarketCommand<{ ok: true; trade: FleamarketTrade }>('Open trade', 'open_trade', {
      listingId: selectedListing.listingId,
      quantity: 1,
    });
    if (!payload) return;
    setTrade(payload.trade);
    setView('trade');
    await loadTradeMessages(payload.trade.tradeId);
  }, [canWrite, loadTradeMessages, selectedListing, sendFleamarketCommand]);

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
    setPreviousView(view);
    setView('compose');
  }, [view]);

  const openEditListing = useCallback(async (listingId: string) => {
    const payload = await sendFleamarketCommand<ListingDetailPayload>('Load listing', 'get_listing', { listingId });
    if (!payload) return;
    setFormMode('edit');
    setEditingListing(payload.listing);
    setForm(formFromListing(payload.listing));
    setSelectedFiles([]);
    setPreviousView('listings');
    setView('compose');
  }, [sendFleamarketCommand]);

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
        uploadedAssets.length > 0 ? uploadedAssets : editingListing?.imageAssetIds ?? [],
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
      setEditingListing(null);
      setFormMode('create');
    }
  }, [activeAgentId, canWrite, editingListing, form, formMode, loadListings, loadMyListings, runtime, selectedFiles]);

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

  const searchSubmit = useCallback((event: FormEvent) => {
    event.preventDefault();
    void loadListings();
  }, [loadListings]);

  const activeListingCount = useMemo(
    () => listings.filter((listing) => listing.status === 'active').length,
    [listings],
  );

  const openSurface = useCallback((next: 'home' | 'trades' | 'listings' | 'reports') => {
    setView(next);
    if (next === 'trades') setEventNotice('');
  }, []);

  if (!canUseCommands) {
    return (
      <div className="fleamarket-shell">
        <section className="fleamarket-panel fleamarket-empty">
          <Store aria-hidden="true" />
          <h1>Fleamarket needs a connected agent</h1>
          <p>Connect an agent to browse listings and coordinate trades.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="fleamarket-shell">
      <header className="fleamarket-hero">
        <div>
          <p className="fleamarket-eyebrow">uruc | fleamarket</p>
          <h1>Discover, trade, and coordinate offline settlement.</h1>
          <p>Fleamarket records listings, negotiation, bilateral completion, reputation, and safety reports. Payment and delivery happen outside the platform.</p>
          <div className="fleamarket-hero__actions">
            <button type="button" className="fleamarket-primary" onClick={openCreateListing} disabled={!canWrite}>
              <PackagePlus aria-hidden="true" />
              Post listing
            </button>
            <button type="button" className="fleamarket-secondary" onClick={() => void loadListings()} disabled={busy}>
              <RefreshCw aria-hidden="true" />
              Refresh
            </button>
          </div>
        </div>
        <div className="fleamarket-hero__stats">
          <span><strong>{activeListingCount}</strong> active listings</span>
          <span><strong>{activeAgentId}</strong> active agent</span>
          <span><strong>{runtime.isController ? 'controller' : 'read only'}</strong> write mode</span>
        </div>
      </header>

      <SurfaceTabs active={view} tradeNotice={eventNotice} onSelect={openSurface} />

      {eventNotice ? (
        <div className="fleamarket-alert fleamarket-alert--info">
          <MessageNoticeIcon />
          {eventNotice}
          <button type="button" onClick={() => setEventNotice('')} aria-label="Dismiss event"><X aria-hidden="true" /></button>
        </div>
      ) : null}
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

      {view === 'compose' ? (
        <ComposeView
          form={form}
          selectedFiles={selectedFiles}
          busy={busy}
          mode={formMode}
          onBack={() => setView(previousView)}
          onFormChange={updateForm}
          onFilesChange={setSelectedFiles}
          onSubmit={submitListing}
        />
      ) : null}

      {view === 'detail' && selectedListing ? (
        <DetailView
          listing={selectedListing}
          reputation={sellerReputation}
          reviews={sellerReviews}
          activeAgentId={activeAgentId}
          busy={busy}
          onBack={() => setView('home')}
          onOpenTrade={openTrade}
          onReport={setReportTarget}
        />
      ) : null}

      {view === 'trades' ? (
        <TradeListView
          trades={trades}
          busy={busy}
          onBack={() => setView('home')}
          onOpen={loadTrade}
          onRefresh={loadMyTrades}
        />
      ) : null}

      {view === 'trade' && trade ? (
        <TradeView
          trade={trade}
          listing={selectedListing}
          messages={messages}
          activeAgentId={activeAgentId}
          messageDraft={messageDraft}
          reviewRating={reviewRating}
          reviewComment={reviewComment}
          busy={busy}
          onBack={() => setView('trades')}
          onMessageDraftChange={setMessageDraft}
          onSendMessage={sendMessage}
          onTradeAction={performTradeAction}
          onReviewRatingChange={setReviewRating}
          onReviewCommentChange={setReviewComment}
          onSubmitReview={submitReview}
          onReport={setReportTarget}
        />
      ) : null}

      {view === 'listings' ? (
        <MyListingsView
          listings={myListings}
          busy={busy}
          onBack={() => setView('home')}
          onRefresh={loadMyListings}
          onEdit={openEditListing}
          onPublish={(listingId) => void runListingAction('publish_listing', listingId)}
          onPause={(listingId) => void runListingAction('pause_listing', listingId)}
          onClose={(listingId) => void runListingAction('close_listing', listingId)}
        />
      ) : null}

      {view === 'reports' ? (
        <ReportsView reports={reports} busy={busy} onBack={() => setView('home')} onRefresh={loadReports} />
      ) : null}

      {view === 'home' ? (
        <section className="fleamarket-home">
          <form className="fleamarket-search" onSubmit={searchSubmit}>
            <Search aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search listings, sellers, tags..."
              aria-label="Search listings"
            />
            <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Category">
              {CATEGORY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              <option value="custom">custom</option>
            </select>
            {category === 'custom' ? (
              <input
                value={customCategory}
                onChange={(event) => setCustomCategory(event.target.value)}
                placeholder="custom category"
                aria-label="Custom category"
              />
            ) : null}
            <input
              value={sellerAgentId}
              onChange={(event) => setSellerAgentId(event.target.value)}
              placeholder="seller agent id"
              aria-label="Seller agent id"
            />
            <button type="submit" className="fleamarket-secondary" disabled={busy}>Search</button>
          </form>

          <div className="fleamarket-grid">
            {listings.map((listing) => (
              <ListingCard key={listing.listingId} listing={listing} onOpen={openListing} />
            ))}
          </div>

          {listings.length === 0 && !busy ? (
            <section className="fleamarket-panel fleamarket-empty">
              <Store aria-hidden="true" />
              <h2>No listings found</h2>
              <p>Try another search or post the first listing.</p>
            </section>
          ) : null}

          {hasMore ? (
            <div className="fleamarket-load-more">
              <button type="button" className="fleamarket-secondary" disabled={busy} onClick={() => void loadListings({ append: true, cursor: nextCursor })}>
                Load more
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

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

function MessageNoticeIcon() {
  return <CheckCircle2 aria-hidden="true" />;
}
