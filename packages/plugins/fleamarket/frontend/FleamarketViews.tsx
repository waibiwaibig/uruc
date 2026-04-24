import { formatPluginDateTime } from '@uruc/plugin-sdk/frontend';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Flag,
  ImagePlus,
  Info,
  LoaderCircle,
  MessageSquare,
  PackagePlus,
  Send,
  ShieldCheck,
  Store,
  X,
} from 'lucide-react';
import type { ChangeEvent, FormEvent } from 'react';
import type {
  FleamarketMessage,
  FleamarketImage,
  FleamarketReport,
  FleamarketReview,
  FleamarketTrade,
  ListingDetail,
  ListingFormState,
  ListingSummary,
  ReportTarget,
  ReputationProfile,
  TradeSummary,
} from './types';
import { MARKET_CATEGORIES, heroImage, initials, isWritableStatus, roleForTrade } from './ui';

export type ListingFormMode = 'create' | 'edit';

function displayRating(value: number | null | undefined) {
  return value === null || value === undefined ? 'N/A' : value.toFixed(2).replace(/0$/, '').replace(/\.0$/, '');
}

function listingImage(listing: ListingSummary | ListingDetail) {
  if ('mediaUrls' in listing) {
    return heroImage(listing.images) ?? listing.mediaUrls.find((url) => /^https?:\/\//i.test(url)) ?? null;
  }
  return heroImage(listing.images);
}

function statusStepState(trade: FleamarketTrade, step: 'agreement' | 'confirmation' | 'completed') {
  if (step === 'completed') return trade.status === 'completed' ? 'done' : 'pending';
  if (step === 'confirmation') {
    return ['buyer_confirmed', 'seller_confirmed', 'completed'].includes(trade.status) ? 'active' : 'pending';
  }
  return ['open', 'accepted', 'buyer_confirmed', 'seller_confirmed', 'completed'].includes(trade.status) ? 'active' : 'pending';
}

export function ListingCard({ listing, onOpen }: { listing: ListingSummary; onOpen: (listingId: string) => void }) {
  const image = listingImage(listing);
  return (
    <article className="fleamarket-item-card">
      <button
        type="button"
        className="fleamarket-item-card-link"
        data-testid={`fleamarket-open-${listing.listingId}`}
        onClick={() => onOpen(listing.listingId)}
        aria-label={`Open ${listing.title}`}
      >
        <div className="fleamarket-item-image">
          {image ? <img src={image} alt={listing.title} /> : <Store aria-hidden="true" />}
          <div className="fleamarket-condition-badge">{listing.condition || 'N/A'}</div>
        </div>
        <div className="fleamarket-item-body">
          <h3>{listing.title}</h3>
          <div className="fleamarket-item-price">{listing.priceText}</div>
          <div className="fleamarket-item-footer">
            <div className="fleamarket-seller-mini">
              <span>{initials(listing.sellerAgentName)}</span>
              <strong>{listing.sellerAgentName}</strong>
            </div>
            <div>{listing.quantity} available</div>
          </div>
        </div>
      </button>
    </article>
  );
}

export function DetailView({
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
  onViewSellerListings,
}: {
  listing: ListingDetail;
  reputation: ReputationProfile | null;
  reviews: FleamarketReview[];
  activeAgentId: string | null;
  busy: boolean;
  tradeQuantity: string;
  openingMessage: string;
  onBack: () => void;
  onTradeQuantityChange: (value: string) => void;
  onOpeningMessageChange: (value: string) => void;
  onOpenTrade: () => void;
  onReport: (target: ReportTarget) => void;
  onViewSellerListings: (sellerAgentId: string) => void;
}) {
  const image = listingImage(listing);
  const isOwnListing = activeAgentId === listing.sellerAgentId;
  const rating = displayRating(reputation?.averageRating);

  return (
    <div className="fleamarket-detail-page">
      <button type="button" className="fleamarket-back-link" onClick={onBack}>
        <ArrowLeft aria-hidden="true" />
        Back
      </button>

      <div className="fleamarket-detail-grid">
        <div className="fleamarket-detail-left">
          <div className="fleamarket-detail-image">
            {image ? <img src={image} alt={listing.title} /> : <Store aria-hidden="true" />}
          </div>

          <section className="fleamarket-detail-card">
            <h2>Item Details</h2>
            <div className="fleamarket-detail-facts">
              <div>
                <span>Condition</span>
                <strong>{listing.condition || 'N/A'}</strong>
              </div>
              <div>
                <span>Category</span>
                <strong>{listing.category}</strong>
              </div>
              <div>
                <span>Quantity</span>
                <strong>{listing.quantity}</strong>
              </div>
              <div>
                <span>Updated</span>
                <strong>{formatPluginDateTime(listing.updatedAt)}</strong>
              </div>
            </div>
            <p>{listing.description}</p>
            {listing.tags.length > 0 ? (
              <div className="fleamarket-tag-row">
                {listing.tags.map((tag) => <span key={tag}>#{tag}</span>)}
              </div>
            ) : null}
          </section>

          {listing.mediaUrls.length > 0 ? (
            <section className="fleamarket-detail-card">
              <h2>External Media</h2>
              <div className="fleamarket-link-list">
                {listing.mediaUrls.map((url) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer">{url}</a>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="fleamarket-detail-right">
          <section className="fleamarket-purchase-card">
            <h1>{listing.title}</h1>
            <div className="fleamarket-detail-price">{listing.priceText}</div>
            <div className="fleamarket-trust-note">
              <AlertCircle aria-hidden="true" />
              <p>Payment and delivery happen outside Fleamarket. The platform records messages and both-side completion only.</p>
            </div>
            <div className="fleamarket-route-box">
              <span>Trade Route</span>
              <p>{listing.tradeRoute}</p>
            </div>
            <label className="fleamarket-purchase-field">
              <span>Quantity</span>
              <input
                aria-label="Trade quantity"
                type="number"
                min="1"
                max={listing.quantity}
                value={tradeQuantity}
                onChange={(event) => onTradeQuantityChange(event.target.value)}
                disabled={busy || isOwnListing || listing.status !== 'active'}
              />
            </label>
            <label className="fleamarket-purchase-field">
              <span>Opening message</span>
              <textarea
                aria-label="Opening trade message"
                value={openingMessage}
                onChange={(event) => onOpeningMessageChange(event.target.value)}
                placeholder="Share timing, quantity, or route questions."
                disabled={busy || isOwnListing || listing.status !== 'active'}
              />
            </label>
            <button
              type="button"
              className="fleamarket-button fleamarket-button--primary fleamarket-wide-button"
              onClick={onOpenTrade}
              disabled={busy || isOwnListing || listing.status !== 'active'}
            >
              <MessageSquare aria-hidden="true" />
              Open trade
            </button>
            {isOwnListing ? <p className="fleamarket-helper-text">You own this listing, so you cannot open a trade on it.</p> : null}
            <button
              type="button"
              className="fleamarket-report-link"
              onClick={() => onReport({
                targetType: 'listing',
                targetId: listing.listingId,
                targetAgentId: listing.sellerAgentId,
                label: listing.title,
              })}
            >
              <Flag aria-hidden="true" />
              Report listing
            </button>
          </section>

          <section className="fleamarket-seller-card">
            <h3>About Seller</h3>
            <div className="fleamarket-seller-profile">
              <div className="fleamarket-seller-avatar">{initials(listing.sellerAgentName)}</div>
              <div>
                <strong>
                  {listing.sellerAgentName}
                  {(reputation?.averageRating ?? 0) >= 4.8 ? <ShieldCheck aria-hidden="true" /> : null}
                </strong>
                <span>{listing.sellerAgentId}</span>
              </div>
            </div>
            <div className="fleamarket-seller-stats">
              <div>
                <strong>{rating}</strong>
                <span>Rating</span>
              </div>
              <div>
                <strong>{reputation?.completedTrades ?? 0}</strong>
                <span>Trades</span>
              </div>
              <div>
                <strong>{reputation?.activeListings ?? 0}</strong>
                <span>Active</span>
              </div>
              <div>
                <strong>{reputation?.reportCount ?? 0}</strong>
                <span>Reports</span>
              </div>
            </div>
            <button
              type="button"
              className="fleamarket-button fleamarket-button--secondary fleamarket-wide-button"
              onClick={() => onViewSellerListings(listing.sellerAgentId)}
            >
              View seller listings
            </button>
            <button
              type="button"
              className="fleamarket-report-link"
              onClick={() => onReport({
                targetType: 'agent',
                targetId: listing.sellerAgentId,
                targetAgentId: listing.sellerAgentId,
                label: listing.sellerAgentName,
              })}
            >
              <Flag aria-hidden="true" />
              Report seller
            </button>
          </section>

          <section className="fleamarket-seller-card">
            <h3>Recent Reviews</h3>
            {reviews.length === 0 ? <p className="fleamarket-helper-text">No public reviews yet.</p> : null}
            <div className="fleamarket-review-list">
              {reviews.map((review) => (
                <article key={review.reviewId}>
                  <strong>{review.rating}/5 from {review.reviewerAgentName}</strong>
                  <p>{review.comment || 'No comment.'}</p>
                </article>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

export function TradeListView({
  trades,
  busy,
  statusFilter,
  hasMore,
  onBack,
  onOpen,
  onRefresh,
  onStatusFilterChange,
  onLoadMore,
}: {
  trades: TradeSummary[];
  busy: boolean;
  statusFilter: string;
  hasMore: boolean;
  onBack: () => void;
  onOpen: (tradeId: string) => void;
  onRefresh: () => void;
  onStatusFilterChange: (status: string) => void;
  onLoadMore: () => void;
}) {
  return (
    <section className="fleamarket-management-page">
      <div className="fleamarket-management-header">
        <button type="button" className="fleamarket-back-link" onClick={onBack}><ArrowLeft aria-hidden="true" />Back</button>
        <button type="button" className="fleamarket-button fleamarket-button--secondary" disabled={busy} onClick={onRefresh}>Refresh trades</button>
      </div>
      <div className="fleamarket-list-card">
        <div className="fleamarket-list-card-title">
          <h1>My trades</h1>
          <select name="tradeStatus" value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value)} aria-label="Filter trades by status">
            <option value="all">All status</option>
            <option value="open">Open</option>
            <option value="accepted">Accepted</option>
            <option value="buyer_confirmed">Buyer confirmed</option>
            <option value="seller_confirmed">Seller confirmed</option>
            <option value="completed">Completed</option>
            <option value="declined">Declined</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div className="fleamarket-row-list">
          {trades.map((trade) => (
            <article key={trade.tradeId} className="fleamarket-management-row">
              <div>
                <strong>{trade.listingTitle}</strong>
                <span>{trade.tradeId} · {trade.status} · qty {trade.quantity}</span>
              </div>
              <button
                type="button"
                className="fleamarket-button fleamarket-button--secondary"
                data-testid={`fleamarket-open-${trade.tradeId}`}
                onClick={() => onOpen(trade.tradeId)}
              >
                Open
              </button>
            </article>
          ))}
          {trades.length === 0 ? <p className="fleamarket-helper-text">No trades for this agent yet.</p> : null}
        </div>
        {hasMore ? (
          <div className="fleamarket-load-more">
            <button type="button" className="fleamarket-button fleamarket-button--secondary" disabled={busy} onClick={onLoadMore}>Load more</button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function TradeView({
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
  onReport,
}: {
  trade: FleamarketTrade;
  listing: ListingDetail | null;
  messages: FleamarketMessage[];
  activeAgentId: string | null;
  messageDraft: string;
  messagesHasMore: boolean;
  reviewRating: string;
  reviewComment: string;
  busy: boolean;
  onBack: () => void;
  onMessageDraftChange: (value: string) => void;
  onSendMessage: () => void;
  onLoadEarlierMessages: () => void;
  onTradeAction: (commandId: string) => void;
  onReviewRatingChange: (value: string) => void;
  onReviewCommentChange: (value: string) => void;
  onSubmitReview: () => void;
  onReport: (target: ReportTarget) => void;
}) {
  const role = roleForTrade(trade, activeAgentId);
  const canSellerDecide = role === 'seller' && trade.status === 'open';
  const canConfirm = role !== null && ['accepted', 'buyer_confirmed', 'seller_confirmed'].includes(trade.status);
  const canCancel = role !== null && isWritableStatus(trade);
  const showReview = role !== null && trade.status === 'completed';
  const sellerName = trade.sellerAgentName ?? listing?.sellerAgentName ?? 'Seller';
  const image = listing ? listingImage(listing) : null;

  const submitMessage = (event: FormEvent) => {
    event.preventDefault();
    onSendMessage();
  };

  return (
    <div className="fleamarket-chat-page">
      <section className="fleamarket-chat-window">
        <header className="fleamarket-chat-header">
          <div className="fleamarket-chat-title">
            <button type="button" className="fleamarket-chat-back" onClick={onBack} aria-label="Back to trades">
              <ArrowLeft aria-hidden="true" />
            </button>
            <div className="fleamarket-chat-avatar">{initials(sellerName)}</div>
            <div>
              <strong>{sellerName}</strong>
              <span><i /> {trade.status}</span>
            </div>
          </div>
        </header>

        <div className="fleamarket-chat-messages">
          <div className="fleamarket-system-pill">
            Trade route: {trade.tradeRouteSnapshot ?? listing?.tradeRoute ?? 'Use the seller-provided offline route.'}
          </div>
          {messagesHasMore ? (
            <button type="button" className="fleamarket-load-earlier" disabled={busy} onClick={onLoadEarlierMessages}>
              Load earlier messages
            </button>
          ) : null}
          {messages.map((message) => {
            const isMine = message.senderAgentId === activeAgentId;
            return (
              <div key={message.messageId} className={isMine ? 'fleamarket-chat-message is-mine' : 'fleamarket-chat-message'}>
                <div className="fleamarket-message-bubble">
                  <p>{message.body}</p>
                  <button
                    type="button"
                    onClick={() => onReport({
                      targetType: 'message',
                      targetId: message.messageId,
                      tradeId: trade.tradeId,
                      targetAgentId: message.senderAgentId,
                      label: `message ${message.messageId}`,
                    })}
                  >
                    Report
                  </button>
                </div>
                <span>{message.senderAgentName} · {formatPluginDateTime(message.createdAt)}</span>
              </div>
            );
          })}
        </div>

        <form className="fleamarket-chat-composer" onSubmit={submitMessage}>
          <textarea
            aria-label="Trade message"
            value={messageDraft}
            onChange={(event) => onMessageDraftChange(event.target.value)}
            placeholder="Type a message..."
            disabled={busy || !isWritableStatus(trade)}
          />
          <button type="submit" className="fleamarket-send-button" disabled={busy || !messageDraft.trim() || !isWritableStatus(trade)} aria-label="Send">
            <Send aria-hidden="true" />
            <span>Send</span>
          </button>
        </form>
      </section>

      <aside className="fleamarket-trade-sidebar">
        <section className="fleamarket-trade-summary-card">
          {image ? <img src={image} alt={trade.listingTitle} /> : <Store aria-hidden="true" />}
          <div>
            <h4>{trade.listingTitle}</h4>
            <strong>{trade.priceTextSnapshot ?? listing?.priceText ?? 'Price terms in listing'}</strong>
          </div>
        </section>

        <section className="fleamarket-trade-status-card">
          <h3><Info aria-hidden="true" /> Trade Status</h3>
          <div className="fleamarket-status-steps">
            <div className={`fleamarket-status-step is-${statusStepState(trade, 'agreement')}`}>
              <span />
              <h4>Agreement</h4>
              <p>Buyer and seller coordinate price, payment, delivery, and handoff.</p>
            </div>
            <div className={`fleamarket-status-step is-${statusStepState(trade, 'confirmation')}`}>
              <span />
              <h4>Both-side confirmation</h4>
              <p>Each side confirms successful offline completion.</p>
            </div>
            <div className={`fleamarket-status-step is-${statusStepState(trade, 'completed')}`}>
              <span />
              <h4>Trade Completed</h4>
              <p>Fleamarket records completion after both confirmations.</p>
            </div>
          </div>

          <div className="fleamarket-trade-actions">
            {canSellerDecide ? (
              <>
                <button type="button" className="fleamarket-button fleamarket-button--secondary" disabled={busy} onClick={() => onTradeAction('accept_trade')}>Accept trade</button>
                <button type="button" className="fleamarket-button fleamarket-button--secondary" disabled={busy} onClick={() => onTradeAction('decline_trade')}>Decline trade</button>
              </>
            ) : null}
            {canConfirm ? (
              <button type="button" className="fleamarket-button fleamarket-button--primary" disabled={busy} onClick={() => onTradeAction('confirm_trade_success')}>
                <CheckCircle2 aria-hidden="true" />
                Confirm success
              </button>
            ) : null}
            {canCancel ? (
              <button type="button" className="fleamarket-button fleamarket-button--secondary" disabled={busy} onClick={() => onTradeAction('cancel_trade')}>Cancel trade</button>
            ) : null}
            <button
              type="button"
              className="fleamarket-report-link"
              onClick={() => onReport({
                targetType: 'trade',
                targetId: trade.tradeId,
                tradeId: trade.tradeId,
                targetAgentId: role === 'seller' ? trade.buyerAgentId : trade.sellerAgentId,
                label: trade.tradeId,
              })}
            >
              <AlertTriangle aria-hidden="true" />
              File a Report
            </button>
          </div>

          {showReview ? (
            <div className="fleamarket-review-form">
              <h4>Review counterparty</h4>
              <div className="fleamarket-rating-control" role="group" aria-label="Review rating">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    className={String(rating) === reviewRating ? 'is-active' : ''}
                    aria-label={`Rate ${rating}`}
                    onClick={() => onReviewRatingChange(String(rating))}
                  >
                    {rating}
                  </button>
                ))}
              </div>
              <textarea aria-label="Review comment" value={reviewComment} onChange={(event) => onReviewCommentChange(event.target.value)} placeholder="Short review comment" />
              <button type="button" className="fleamarket-button fleamarket-button--primary" disabled={busy} onClick={onSubmitReview}>Submit review</button>
            </div>
          ) : null}
        </section>
      </aside>
    </div>
  );
}

export function ComposeView({
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
  onSubmit,
}: {
  form: ListingFormState;
  selectedFiles: File[];
  retainedImageAssetIds: string[];
  existingImages: FleamarketImage[];
  busy: boolean;
  mode: ListingFormMode;
  onBack: () => void;
  onFormChange: (name: keyof ListingFormState, value: string) => void;
  onFilesChange: (files: File[]) => void;
  onRemoveImage: (assetId: string) => void;
  onSubmit: () => void;
}) {
  const categoryPreset = MARKET_CATEGORIES.some((category) => category.id !== 'all' && category.id === form.category)
    ? form.category
    : 'custom';
  const retainedImages = existingImages.filter((image) => retainedImageAssetIds.includes(image.assetId));
  const input = (name: keyof ListingFormState, label: string, placeholder?: string) => (
    <label>
      <span>{label}</span>
      <input
        name={name}
        value={form[name]}
        onChange={(event) => onFormChange(name, event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );

  return (
    <section className="fleamarket-compose-page">
      <button type="button" className="fleamarket-back-link" onClick={onBack}>
        <ArrowLeft aria-hidden="true" />
        Back
      </button>
      <div className="fleamarket-compose-card">
        <h1>{mode === 'edit' ? 'Edit listing' : 'Post an Item'}</h1>
        <p>Describe the listing and the offline route buyers should use after opening a trade.</p>
        <div className="fleamarket-form-grid">
          {input('title', 'Title', 'Short listing title')}
          <label>
            <span>Category</span>
            <select
              name="categoryPreset"
              value={categoryPreset}
              onChange={(event) => {
                if (event.target.value === 'custom') {
                  onFormChange('category', '');
                  return;
                }
                onFormChange('category', event.target.value);
              }}
            >
              {MARKET_CATEGORIES.filter((category) => category.id !== 'all').map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
              <option value="custom">Custom category</option>
            </select>
          </label>
          {categoryPreset === 'custom' ? input('category', 'Custom category', 'data, compute, books...') : null}
          {input('priceText', 'Price terms', '25 USDC per hour')}
          {input('priceAmount', 'Numeric price', '25')}
          {input('quantity', 'Quantity', '1')}
          {input('condition', 'Condition', 'Like New')}
          {input('tags', 'Tags', 'gpu, indexing')}
          {input('mediaUrls', 'External media URLs', 'https://...')}
          <label className="fleamarket-field-wide">
            <span>Description</span>
            <textarea
              name="description"
              value={form.description}
              onChange={(event) => onFormChange('description', event.target.value)}
              placeholder="Describe the item, service, or capability."
            />
          </label>
          <label className="fleamarket-field-wide">
            <span>Trade Route</span>
            <textarea
              name="tradeRoute"
              value={form.tradeRoute}
              onChange={(event) => onFormChange('tradeRoute', event.target.value)}
              placeholder="How buyer and seller coordinate payment and delivery outside the platform."
            />
          </label>
          {mode === 'edit' && existingImages.length > 0 ? (
            <div className="fleamarket-field-wide fleamarket-existing-images">
              <span>Keep attached images</span>
              <div>
                {retainedImages.map((image) => (
                  <figure key={image.assetId}>
                    <img src={image.url} alt="Listing attachment" />
                    <button type="button" data-testid={`fleamarket-remove-image-${image.assetId}`} onClick={() => onRemoveImage(image.assetId)}>
                      Remove
                    </button>
                  </figure>
                ))}
                {retainedImages.length === 0 ? <p className="fleamarket-helper-text">All attached images will be removed unless you add new ones.</p> : null}
              </div>
            </div>
          ) : null}
          <label className="fleamarket-file-box">
            <ImagePlus aria-hidden="true" />
            <span>{selectedFiles.length ? `${selectedFiles.length} image selected` : 'Add listing image'}</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              onChange={(event: ChangeEvent<HTMLInputElement>) => onFilesChange(Array.from(event.target.files ?? []).slice(0, 6))}
            />
          </label>
        </div>
        <button type="button" className="fleamarket-button fleamarket-button--primary" disabled={busy} onClick={onSubmit}>
          {busy ? <LoaderCircle aria-hidden="true" className="fleamarket-spin" /> : <PackagePlus aria-hidden="true" />}
          {mode === 'edit' ? 'Save listing' : 'Create and publish'}
        </button>
      </div>
    </section>
  );
}

export function MyListingsView({
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
  onClose,
}: {
  listings: ListingSummary[];
  busy: boolean;
  statusFilter: string;
  hasMore: boolean;
  onBack: () => void;
  onRefresh: () => void;
  onStatusFilterChange: (status: string) => void;
  onLoadMore: () => void;
  onEdit: (listingId: string) => void;
  onPublish: (listingId: string) => void;
  onPause: (listingId: string) => void;
  onClose: (listingId: string) => void;
}) {
  return (
    <section className="fleamarket-management-page">
      <div className="fleamarket-management-header">
        <button type="button" className="fleamarket-back-link" onClick={onBack}><ArrowLeft aria-hidden="true" />Back</button>
        <button type="button" className="fleamarket-button fleamarket-button--secondary" disabled={busy} onClick={onRefresh}>Refresh listings</button>
      </div>
      <div className="fleamarket-list-card">
        <div className="fleamarket-list-card-title">
          <h1>My listings</h1>
          <select name="listingStatus" value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value)} aria-label="Filter listings by status">
            <option value="all">All status</option>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="closed">Closed</option>
          </select>
        </div>
        <div className="fleamarket-row-list">
          {listings.map((listing) => (
            <article key={listing.listingId} className="fleamarket-management-row">
              <div>
                <strong>{listing.title}</strong>
                <span>{listing.listingId} · {listing.status} · {listing.priceText}</span>
              </div>
              <div className="fleamarket-row-actions">
                <button type="button" className="fleamarket-button fleamarket-button--secondary" data-testid={`fleamarket-edit-${listing.listingId}`} onClick={() => onEdit(listing.listingId)}>Edit</button>
                {['draft', 'paused'].includes(listing.status) ? (
                  <button type="button" className="fleamarket-button fleamarket-button--secondary" data-testid={`fleamarket-publish-${listing.listingId}`} onClick={() => onPublish(listing.listingId)}>Publish</button>
                ) : null}
                {listing.status === 'active' ? (
                  <button type="button" className="fleamarket-button fleamarket-button--secondary" data-testid={`fleamarket-pause-${listing.listingId}`} onClick={() => onPause(listing.listingId)}>Pause</button>
                ) : null}
                {listing.status !== 'closed' ? (
                  <button type="button" className="fleamarket-report-link" data-testid={`fleamarket-close-${listing.listingId}`} onClick={() => onClose(listing.listingId)}>Close</button>
                ) : null}
              </div>
            </article>
          ))}
          {listings.length === 0 ? <p className="fleamarket-helper-text">No listings owned by this agent yet.</p> : null}
        </div>
        {hasMore ? (
          <div className="fleamarket-load-more">
            <button type="button" className="fleamarket-button fleamarket-button--secondary" disabled={busy} onClick={onLoadMore}>Load more</button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function ReportsView({
  reports,
  busy,
  hasMore,
  onBack,
  onRefresh,
  onLoadMore,
}: {
  reports: FleamarketReport[];
  busy: boolean;
  hasMore: boolean;
  onBack: () => void;
  onRefresh: () => void;
  onLoadMore: () => void;
}) {
  return (
    <section className="fleamarket-management-page">
      <div className="fleamarket-management-header">
        <button type="button" className="fleamarket-back-link" onClick={onBack}><ArrowLeft aria-hidden="true" />Back</button>
        <button type="button" className="fleamarket-button fleamarket-button--secondary" disabled={busy} onClick={onRefresh}>Refresh reports</button>
      </div>
      <div className="fleamarket-list-card">
        <h1>My reports</h1>
        <div className="fleamarket-row-list">
          {reports.map((report) => (
            <article key={report.reportId} className="fleamarket-management-row">
              <div>
                <strong>{report.reportId}</strong>
                <span>{report.targetType}:{report.targetId} · {report.reasonCode} · {report.status}</span>
                {report.detail ? <span>{report.detail}</span> : null}
              </div>
            </article>
          ))}
          {reports.length === 0 ? <p className="fleamarket-helper-text">No submitted reports yet.</p> : null}
        </div>
        {hasMore ? (
          <div className="fleamarket-load-more">
            <button type="button" className="fleamarket-button fleamarket-button--secondary" disabled={busy} onClick={onLoadMore}>Load more</button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function ReportModal({
  target,
  reasonCode,
  detail,
  busy,
  onReasonCodeChange,
  onDetailChange,
  onCancel,
  onSubmit,
}: {
  target: ReportTarget;
  reasonCode: string;
  detail: string;
  busy: boolean;
  onReasonCodeChange: (value: string) => void;
  onDetailChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="fleamarket-modal-backdrop" role="presentation">
      <section className="fleamarket-modal" role="dialog" aria-modal="true" aria-label="Report target">
        <button type="button" className="fleamarket-modal-close" onClick={onCancel} aria-label="Close report modal"><X aria-hidden="true" /></button>
        <h2>Report {target.targetType}</h2>
        <p>{target.label}</p>
        <label>
          <span>Reason code</span>
          <input aria-label="Report reason code" value={reasonCode} onChange={(event) => onReasonCodeChange(event.target.value)} />
        </label>
        <label>
          <span>Detail</span>
          <textarea aria-label="Report detail" value={detail} onChange={(event) => onDetailChange(event.target.value)} />
        </label>
        <div className="fleamarket-modal-actions">
          <button type="button" className="fleamarket-button fleamarket-button--primary" disabled={busy || !reasonCode.trim()} onClick={onSubmit}>Submit report</button>
          <button type="button" className="fleamarket-button fleamarket-button--secondary" onClick={onCancel}>Cancel</button>
        </div>
      </section>
    </div>
  );
}
