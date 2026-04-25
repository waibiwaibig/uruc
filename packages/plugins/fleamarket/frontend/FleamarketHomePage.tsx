import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from 'react';
import { isPluginCommandError } from '@uruc/plugin-sdk/frontend';
import { usePluginAgent, usePluginRuntime, usePluginShell } from '@uruc/plugin-sdk/frontend-react';
import {
  Store,
} from 'lucide-react';
import { FLEAMARKET_COMMAND, FleamarketApi } from './api';
import { Chat } from './Chat';
import {
  ComposeView,
  MyListingsView,
  ReportModal,
  ReportsView,
  TradeListView,
  type ListingFormMode,
} from './FleamarketViews';
import { Home, type SortMode } from './Home';
import { ItemDetail } from './ItemDetail';
import { MainLayout, type FleamarketNotice } from './MainLayout';
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
  heroImage,
  initials,
  parseCommaList,
} from './ui';
import type { MarketItem } from './viewTypes';

type ViewMode = 'home' | 'detail' | 'compose' | 'trades' | 'trade' | 'listings' | 'reports';
type ManagedView = Extract<ViewMode, 'trades' | 'listings' | 'reports'>;
type BackendSortMode = 'latest' | 'price_asc' | 'price_desc' | 'title';

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

function marketItemFromListing(listing: ListingSummary): MarketItem {
  return {
    id: listing.listingId,
    title: listing.title,
    description: '',
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
    status: listing.status,
  };
}

export function FleamarketHomePage() {
  const runtime = usePluginRuntime();
  const { notify } = usePluginShell();
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
  const [sellerReviewsHasMore, setSellerReviewsHasMore] = useState(false);
  const [trade, setTrade] = useState<FleamarketTrade | null>(null);
  const [messages, setMessages] = useState<FleamarketMessage[]>([]);
  const [messageDraft, setMessageDraft] = useState('');
  const [reviewRating, setReviewRating] = useState('5');
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [customCategoryFilter, setCustomCategoryFilter] = useState('');
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
  const [eventNotices, setEventNotices] = useState<FleamarketNotice[]>([]);
  const [showNoticeMenu, setShowNoticeMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const busy = Boolean(busyAction);

  const sendFleamarketCommand = useCallback(async <T,>(label: string, commandId: string, payload?: unknown): Promise<T | null> => {
    setBusyAction(label);
    try {
      return await runtime.sendCommand<T>(FLEAMARKET_COMMAND(commandId), payload);
    } catch (error) {
      notify({ type: 'error', message: getErrorText(error, `${label} failed.`) });
      return null;
    } finally {
      setBusyAction('');
    }
  }, [notify, runtime]);

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
    ...(category !== 'all' ? { category: backendCategoryFor(category) } : customCategoryFilter.trim() ? { category: customCategoryFilter.trim() } : {}),
    ...(sellerFilterAgentId ? { sellerAgentId: sellerFilterAgentId } : {}),
    ...(cursor ? { beforeUpdatedAt: cursor } : {}),
  }), [category, customCategoryFilter, query, sellerFilterAgentId, sortMode]);

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

  const loadSellerReputation = useCallback(async (agentId: string) => {
    const payload = await sendFleamarketCommand<ReputationProfile | { profile: ReputationProfile }>('Load seller reputation', 'get_reputation_profile', { agentId });
    if (!payload) return null;
    if ('profile' in payload) return payload.profile;
    return payload;
  }, [sendFleamarketCommand]);

  const loadSellerReviews = useCallback(async (agentId: string, limit: number) => {
    const payload = await sendFleamarketCommand<ReviewsPayload>('Load seller reviews', 'list_reviews', {
      agentId,
      limit,
    });
    if (!payload) return null;
    setSellerReviews(payload.reviews);
    setSellerReviewsHasMore(payload.hasMore);
    return payload;
  }, [sendFleamarketCommand]);

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
    const isSameTrade = trade?.tradeId === tradeId;
    const payload = await sendFleamarketCommand<{ trade: FleamarketTrade }>('Load trade', 'get_trade', { tradeId });
    if (!payload) return;
    setTrade(payload.trade);
    if (!isSameTrade) {
      setReviewSubmitted(false);
    }
    setReviewRating('5');
    setReviewComment('');
    setShowUserMenu(false);
    setView('trade');
    setSelectedListing(null);
    setSellerReputation(null);
    setSellerReviews([]);
    setSellerReviewsHasMore(false);
    try {
      const listingPayload = await runtime.sendCommand<ListingDetailPayload>(FLEAMARKET_COMMAND('get_listing'), { listingId: payload.trade.listingId });
      setSelectedListing(listingPayload.listing);
      setSellerReputation(listingPayload.sellerReputation);
    } catch {
      // Keep the trade open even if the listing snapshot cannot be refreshed.
    }
    await loadTradeMessages(tradeId);
  }, [loadTradeMessages, runtime, sendFleamarketCommand]);

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
    const reputation = await loadSellerReputation(payload.listing.sellerAgentId);
    setSellerReputation(reputation ?? payload.sellerReputation);
    setTradeQuantity('1');
    setOpeningMessage('');
    await loadSellerReviews(payload.listing.sellerAgentId, 5);
    setShowUserMenu(false);
    setReviewSubmitted(false);
    setView('detail');
  }, [loadSellerReputation, loadSellerReviews, sendFleamarketCommand]);

  const refreshSellerProfile = useCallback(async () => {
    if (!selectedListing) return;
    const reputation = await loadSellerReputation(selectedListing.sellerAgentId);
    if (reputation) {
      setSellerReputation(reputation);
    }
    await loadSellerReviews(selectedListing.sellerAgentId, Math.max(sellerReviews.length || 5, 5));
  }, [loadSellerReputation, loadSellerReviews, selectedListing, sellerReviews.length]);

  const loadMoreSellerReviews = useCallback(async () => {
    if (!selectedListing || !sellerReviewsHasMore) return;
    await loadSellerReviews(selectedListing.sellerAgentId, Math.min(Math.max(sellerReviews.length + 10, 20), 50));
  }, [loadSellerReviews, selectedListing, sellerReviews.length, sellerReviewsHasMore]);

  const openTrade = useCallback(async () => {
    if (!selectedListing) return;
    if (!canWrite) {
      notify({ type: 'error', message: 'Claim controller ownership before opening a trade.' });
      return;
    }
    const quantity = Number(tradeQuantity || 1);
    if (!Number.isInteger(quantity) || quantity < 1) {
      notify({ type: 'error', message: 'Quantity must be a positive integer.' });
      return;
    }
    const payload = await sendFleamarketCommand<{ ok: true; trade: FleamarketTrade }>('Open trade', 'open_trade', {
      listingId: selectedListing.listingId,
      quantity,
      ...(openingMessage.trim() ? { openingMessage: openingMessage.trim() } : {}),
    });
    if (!payload) return;
    setTrade(payload.trade);
    setReviewSubmitted(false);
    setView('trade');
    await loadTradeMessages(payload.trade.tradeId);
  }, [canWrite, loadTradeMessages, notify, openingMessage, selectedListing, sendFleamarketCommand, tradeQuantity]);

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
    notify({ type: 'success', message: `Trade status is now ${payload.trade.status}.` });
    void loadMyTrades();
  }, [loadMyTrades, notify, sendFleamarketCommand, trade]);

  const submitReview = useCallback(async () => {
    if (!trade) return;
    const rating = Number(reviewRating);
    try {
      const payload = await runtime.sendCommand<{ ok: true }>(FLEAMARKET_COMMAND('create_review'), {
        tradeId: trade.tradeId,
        rating,
        comment: reviewComment.trim(),
      });
      if (payload) {
        setReviewSubmitted(true);
        notify({ type: 'success', message: 'Review submitted.' });
        setReviewComment('');
      }
    } catch (error) {
      if (isPluginCommandError(error) && error.code === 'REVIEW_ALREADY_EXISTS') {
        setReviewSubmitted(true);
        notify({ type: 'info', message: 'Review already submitted.' });
        return;
      }
      notify({ type: 'error', message: getErrorText(error, 'Submit review failed.') });
    }
  }, [notify, reviewComment, reviewRating, runtime, trade]);

  const updateForm = useCallback((name: keyof ListingFormState, value: string) => {
    setForm((current) => ({ ...current, [name]: value }));
  }, []);

  const openCreateListing = useCallback(() => {
    if (!canWrite) {
      notify({ type: 'error', message: 'Claim controller ownership before posting a listing.' });
      setShowUserMenu(false);
      return;
    }
    setFormMode('create');
    setEditingListing(null);
    setForm(EMPTY_FORM);
    setSelectedFiles([]);
    setRetainedImageAssetIds([]);
    setReviewSubmitted(false);
    setPreviousView(view);
    setShowUserMenu(false);
    setView('compose');
  }, [canWrite, notify, view]);

  const openEditListing = useCallback(async (listingId: string) => {
    const payload = await sendFleamarketCommand<ListingDetailPayload>('Load listing', 'get_listing', { listingId });
    if (!payload) return;
    setFormMode('edit');
    setEditingListing(payload.listing);
    setForm(formFromListing(payload.listing));
    setSelectedFiles([]);
    setRetainedImageAssetIds(payload.listing.imageAssetIds ?? []);
    setReviewSubmitted(false);
    setPreviousView('listings');
    setView('compose');
  }, [sendFleamarketCommand]);

  const handleFilesChange = useCallback((files: File[]) => {
    const nextFiles = files.slice(0, MAX_LISTING_IMAGES);
    if (retainedImageAssetIds.length + nextFiles.length > MAX_LISTING_IMAGES) {
      notify({ type: 'error', message: `A listing can include at most ${MAX_LISTING_IMAGES} images.` });
      return;
    }
    const oversized = nextFiles.find((file) => file.size > MAX_LISTING_IMAGE_BYTES);
    if (oversized) {
      notify({ type: 'error', message: 'Listing image size cannot exceed 512KB.' });
      return;
    }
    const unsupported = nextFiles.find((file) => file.type && !['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type));
    if (unsupported) {
      notify({ type: 'error', message: 'Only png, jpg, jpeg, and webp listing images are supported.' });
      return;
    }
    setSelectedFiles(nextFiles);
  }, [notify, retainedImageAssetIds.length]);

  const removeRetainedImage = useCallback((assetId: string) => {
    setRetainedImageAssetIds((current) => current.filter((id) => id !== assetId));
  }, []);

  const submitListing = useCallback(async (publish: boolean) => {
    if (!activeAgentId) {
      notify({ type: 'error', message: 'Connect an agent before posting a listing.' });
      return;
    }
    if (!canWrite) {
      notify({ type: 'error', message: 'Claim controller ownership before changing a listing.' });
      return;
    }
    setBusyAction(formMode === 'edit' ? 'Update listing' : publish ? 'Create listing' : 'Save draft');
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
        notify({ type: 'success', message: 'Listing saved.' });
        setView('listings');
        void loadMyListings();
        return;
      }
      const created = await runtime.sendCommand<{ ok: true; listing: ListingDetail }>(FLEAMARKET_COMMAND('create_listing'), payload);
      setSelectedListing(created.listing);
      setSellerReputation(null);
      setSellerReviews([]);
      setSellerReviewsHasMore(false);
      if (publish) {
        const published = await runtime.sendCommand<{ ok: true; listing: ListingDetail }>(FLEAMARKET_COMMAND('publish_listing'), {
          listingId: created.listing.listingId,
        });
        setSelectedListing(published.listing);
        setView('detail');
        notify({ type: 'success', message: 'Listing created and published.' });
        void loadListings();
      } else {
        setView('listings');
        notify({ type: 'success', message: 'Listing saved as draft.' });
      }
      void loadMyListings();
    } catch (error) {
      notify({ type: 'error', message: getErrorText(error, formMode === 'edit' ? 'Update listing failed.' : publish ? 'Create listing failed.' : 'Save draft failed.') });
    } finally {
      setBusyAction('');
      setForm(EMPTY_FORM);
      setSelectedFiles([]);
      setRetainedImageAssetIds([]);
      setEditingListing(null);
      setFormMode('create');
    }
  }, [activeAgentId, canWrite, editingListing, form, formMode, loadListings, loadMyListings, notify, retainedImageAssetIds, runtime, selectedFiles]);

  const runListingAction = useCallback(async (commandId: string, listingId: string) => {
    const payload = await sendFleamarketCommand<{ ok: true; listing: ListingDetail }>('Update listing', commandId, { listingId });
    if (!payload) return;
    notify({ type: 'success', message: `Listing status is now ${payload.listing.status}.` });
    void loadMyListings();
    void loadListings();
  }, [loadListings, loadMyListings, notify, sendFleamarketCommand]);

  const createReport = useCallback(async () => {
    if (!reportTarget) return;
    if (!canWrite) {
      notify({ type: 'error', message: 'Claim controller ownership before creating a report.' });
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
      notify({ type: 'success', message: 'Report recorded.' });
      setReportTarget(null);
      setReportReasonCode('safety_review');
      setReportDetail('');
      void loadReports();
    }
  }, [canWrite, loadReports, notify, reportDetail, reportReasonCode, reportTarget, sendFleamarketCommand]);

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
    setCustomCategoryFilter('');
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

  const mainContent = () => {
    if (!canUseCommands) {
      return (
        <section className="py-20 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-white">
          <Store className="w-10 h-10 mx-auto text-slate-300 mb-4" aria-hidden="true" />
          <h1 className="text-2xl font-semibold text-slate-900 mb-2">Fleamarket needs a connected agent</h1>
          <p className="text-slate-500">Connect an agent to browse listings and coordinate trades.</p>
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
          onSaveDraft={() => void submitListing(false)}
          onPublishNow={() => void submitListing(true)}
          onSaveListing={() => void submitListing(true)}
        />
      );
    }

    if (view === 'detail' && selectedListing) {
      return (
        <ItemDetail
          item={selectedListing}
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
          sellerReviewsHasMore={sellerReviewsHasMore}
          onRefreshSellerProfile={() => void refreshSellerProfile()}
          onLoadMoreReviews={() => void loadMoreSellerReviews()}
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
        <Chat
          trade={trade}
          listing={selectedListing}
          messages={messages}
          activeAgentId={activeAgentId}
          messageDraft={messageDraft}
          messagesHasMore={messagesHasMore}
          reviewRating={reviewRating}
          reviewComment={reviewComment}
          reviewSubmitted={reviewSubmitted}
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

    return (
      <Home
        categories={MARKET_CATEGORIES}
        items={listings.map(marketItemFromListing)}
        activeCategory={category}
        customCategoryFilter={customCategoryFilter}
        sortMode={sortMode}
        busy={busy}
        hasMore={hasMore}
        canWrite={canWrite}
        onCategoryChange={selectCategory}
        onCustomCategoryFilterChange={setCustomCategoryFilter}
        onSortChange={setSortMode}
        onOpenItem={openListing}
        onPostItem={openCreateListing}
        onShowC2CInfo={() => setShowNoticeMenu(true)}
        onLoadMore={() => void loadListings({ append: true, cursor: nextCursor })}
      />
    );
  };

  return (
    <MainLayout
      query={query}
      activeAgentName={activeAgentName}
      activeAgentId={activeAgentId}
      isController={runtime.isController}
      canWrite={canWrite}
      notices={eventNotices}
      showNoticeMenu={showNoticeMenu}
      showUserMenu={showUserMenu}
      onHome={() => setView('home')}
      onQueryChange={setQuery}
      onSearchSubmit={submitSearch}
      onToggleNoticeMenu={() => setShowNoticeMenu((current) => !current)}
      onToggleUserMenu={() => setShowUserMenu((current) => !current)}
      onOpenManagedView={openManagedView}
      onPostItem={openCreateListing}
    >
        {mainContent()}
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
    </MainLayout>
  );
}
