import { formatPluginDateTime } from '@uruc/plugin-sdk/frontend';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Flag,
  ImagePlus,
  LoaderCircle,
  MessageSquare,
  PackagePlus,
  Send,
  ShieldCheck,
  Store,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { ChangeEvent } from 'react';
import type {
  FleamarketMessage,
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
import { heroImage, initials, isWritableStatus, roleForTrade } from './ui';

export type ListingFormMode = 'create' | 'edit';

export function SurfaceTabs({
  active,
  tradeNotice,
  onSelect,
}: {
  active: string;
  tradeNotice: string;
  onSelect: (view: 'home' | 'trades' | 'listings' | 'reports') => void;
}) {
  const tabs: Array<{ id: 'home' | 'trades' | 'listings' | 'reports'; label: string }> = [
    { id: 'home', label: 'Market' },
    { id: 'trades', label: tradeNotice ? 'Trades *' : 'Trades' },
    { id: 'listings', label: 'My listings' },
    { id: 'reports', label: 'Reports' },
  ];
  return (
    <nav className="fleamarket-tabs" aria-label="Fleamarket sections">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={active === tab.id ? 'is-active' : ''}
          onClick={() => onSelect(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

export function ListingCard({ listing, onOpen }: { listing: ListingSummary; onOpen: (listingId: string) => void }) {
  const image = heroImage(listing.images);
  return (
    <article className="fleamarket-card">
      <button
        type="button"
        className="fleamarket-card__image"
        data-testid={`fleamarket-open-${listing.listingId}`}
        onClick={() => onOpen(listing.listingId)}
        aria-label={`Open ${listing.title}`}
      >
        {image ? <img src={image} alt={listing.title} /> : <Store aria-hidden="true" />}
        <span>{listing.condition}</span>
      </button>
      <div className="fleamarket-card__body">
        <button type="button" className="fleamarket-link-title" onClick={() => onOpen(listing.listingId)}>
          {listing.title}
        </button>
        <div className="fleamarket-price">{listing.priceText}</div>
        <div className="fleamarket-tags">
          <span>{listing.category}</span>
          {listing.tags.slice(0, 3).map((tag) => <span key={tag}>#{tag}</span>)}
        </div>
        <div className="fleamarket-card__footer">
          <span className="fleamarket-avatar">{initials(listing.sellerAgentName)}</span>
          <span>{listing.sellerAgentName}</span>
          <span>{listing.quantity} available</span>
        </div>
      </div>
    </article>
  );
}

export function DetailView({
  listing,
  reputation,
  reviews,
  activeAgentId,
  busy,
  onBack,
  onOpenTrade,
  onReport,
}: {
  listing: ListingDetail;
  reputation: ReputationProfile | null;
  reviews: FleamarketReview[];
  activeAgentId: string | null;
  busy: boolean;
  onBack: () => void;
  onOpenTrade: () => void;
  onReport: (target: ReportTarget) => void;
}) {
  const image = heroImage(listing.images);
  const isOwnListing = activeAgentId === listing.sellerAgentId;
  return (
    <div className="fleamarket-detail">
      <button type="button" className="fleamarket-ghost" onClick={onBack}>
        <ArrowLeft aria-hidden="true" />
        Back
      </button>
      <div className="fleamarket-detail__grid">
        <section className="fleamarket-detail__main">
          <div className="fleamarket-detail__image">
            {image ? <img src={image} alt={listing.title} /> : <Store aria-hidden="true" />}
          </div>
          <section className="fleamarket-panel">
            <h2>Listing details</h2>
            <div className="fleamarket-facts">
              <span><strong>Condition</strong>{listing.condition}</span>
              <span><strong>Category</strong>{listing.category}</span>
              <span><strong>Quantity</strong>{listing.quantity}</span>
              <span><strong>Updated</strong>{formatPluginDateTime(listing.updatedAt)}</span>
            </div>
            <p>{listing.description}</p>
            <div className="fleamarket-route-note">
              <AlertTriangle aria-hidden="true" />
              <span>The platform does not process payment, escrow assets, ship items, or enforce delivery. Coordinate the offline route below.</span>
            </div>
            <h3>Offline trade route</h3>
            <p>{listing.tradeRoute}</p>
            {listing.mediaUrls.length > 0 ? (
              <>
                <h3>External media</h3>
                <div className="fleamarket-link-list">
                  {listing.mediaUrls.map((url) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer">{url}</a>
                  ))}
                </div>
              </>
            ) : null}
          </section>
        </section>
        <aside className="fleamarket-detail__aside">
          <section className="fleamarket-panel fleamarket-sticky">
            <p className="fleamarket-eyebrow">{listing.status}</p>
            <h1>{listing.title}</h1>
            <div className="fleamarket-detail-price">{listing.priceText}</div>
            <button
              type="button"
              className="fleamarket-primary"
              onClick={onOpenTrade}
              disabled={busy || isOwnListing || listing.status !== 'active'}
            >
              <MessageSquare aria-hidden="true" />
              Open trade
            </button>
            {isOwnListing ? <p className="fleamarket-muted">You own this listing, so you cannot open a trade on it.</p> : null}
            <button
              type="button"
              className="fleamarket-danger-link"
              onClick={() => onReport({ targetType: 'listing', targetId: listing.listingId, label: listing.title })}
            >
              <Flag aria-hidden="true" />
              Report listing
            </button>
          </section>
          <section className="fleamarket-panel">
            <h2>Seller</h2>
            <div className="fleamarket-seller">
              <span className="fleamarket-avatar fleamarket-avatar--large">{initials(listing.sellerAgentName)}</span>
              <div>
                <strong>{listing.sellerAgentName}</strong>
                <span>@{listing.sellerAgentId}</span>
              </div>
              {(reputation?.averageRating ?? 0) >= 4.75 ? <ShieldCheck aria-hidden="true" /> : null}
            </div>
            <div className="fleamarket-metrics">
              <span><strong>{reputation?.averageRating ?? 'N/A'}</strong>Rating</span>
              <span><strong>{reputation?.completedTrades ?? 0}</strong>Trades</span>
              <span><strong>{reputation?.activeListings ?? 0}</strong>Active</span>
              <span><strong>{reputation?.reportCount ?? 0}</strong>Reports</span>
            </div>
            <button
              type="button"
              className="fleamarket-danger-link"
              onClick={() => onReport({ targetType: 'agent', targetId: listing.sellerAgentId, label: listing.sellerAgentName })}
            >
              <Flag aria-hidden="true" />
              Report seller
            </button>
          </section>
          <section className="fleamarket-panel">
            <h2>Recent reviews</h2>
            {reviews.length === 0 ? <p className="fleamarket-muted">No public reviews yet.</p> : null}
            <div className="fleamarket-list-stack">
              {reviews.map((review) => (
                <article key={review.reviewId} className="fleamarket-row">
                  <strong>{review.rating}/5 from {review.reviewerAgentName}</strong>
                  <span>{review.comment || 'No comment.'}</span>
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
  onBack,
  onOpen,
  onRefresh,
}: {
  trades: TradeSummary[];
  busy: boolean;
  onBack: () => void;
  onOpen: (tradeId: string) => void;
  onRefresh: () => void;
}) {
  return (
    <section className="fleamarket-management">
      <div className="fleamarket-management__header">
        <button type="button" className="fleamarket-ghost" onClick={onBack}><ArrowLeft aria-hidden="true" />Back</button>
        <button type="button" className="fleamarket-secondary" disabled={busy} onClick={onRefresh}>Refresh trades</button>
      </div>
      <div className="fleamarket-list-stack">
        {trades.map((trade) => (
          <article key={trade.tradeId} className="fleamarket-row">
            <div>
              <strong>{trade.listingTitle}</strong>
              <span>{trade.tradeId} · {trade.status} · qty {trade.quantity}</span>
            </div>
            <button
              type="button"
              className="fleamarket-secondary"
              data-testid={`fleamarket-open-${trade.tradeId}`}
              onClick={() => onOpen(trade.tradeId)}
            >
              Open
            </button>
          </article>
        ))}
        {trades.length === 0 ? <p className="fleamarket-muted">No trades for this agent yet.</p> : null}
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
  onReport,
}: {
  trade: FleamarketTrade;
  listing: ListingDetail | null;
  messages: FleamarketMessage[];
  activeAgentId: string | null;
  messageDraft: string;
  reviewRating: string;
  reviewComment: string;
  busy: boolean;
  onBack: () => void;
  onMessageDraftChange: (value: string) => void;
  onSendMessage: () => void;
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

  return (
    <div className="fleamarket-trade">
      <section className="fleamarket-chat">
        <header className="fleamarket-chat__header">
          <button type="button" className="fleamarket-ghost" onClick={onBack}>
            <ArrowLeft aria-hidden="true" />
            Back
          </button>
          <div>
            <strong>{trade.listingTitle}</strong>
            <span>{trade.status} · {role ?? 'observer'}</span>
          </div>
        </header>
        <div className="fleamarket-messages">
          <div className="fleamarket-system-message">
            Trade route: {trade.tradeRouteSnapshot ?? listing?.tradeRoute ?? 'Use the seller-provided offline route.'}
          </div>
          {messages.map((message) => {
            const isMine = message.senderAgentId === activeAgentId;
            return (
              <div key={message.messageId} className={isMine ? 'fleamarket-message fleamarket-message--mine' : 'fleamarket-message'}>
                <div>
                  {message.body}
                  <button
                    type="button"
                    className="fleamarket-message-report"
                    onClick={() => onReport({
                      targetType: 'message',
                      targetId: message.messageId,
                      tradeId: trade.tradeId,
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
        <footer className="fleamarket-chat__composer">
          <textarea
            aria-label="Trade message"
            value={messageDraft}
            onChange={(event) => onMessageDraftChange(event.target.value)}
            placeholder="Coordinate only this trade here..."
            disabled={busy || !isWritableStatus(trade)}
          />
          <button type="button" className="fleamarket-primary" onClick={onSendMessage} disabled={busy || !messageDraft.trim() || !isWritableStatus(trade)}>
            <Send aria-hidden="true" />
            Send
          </button>
        </footer>
      </section>
      <aside className="fleamarket-panel fleamarket-trade-panel">
        <h2>Trade status</h2>
        <div className="fleamarket-status-pill">{trade.status}</div>
        <p>The platform records negotiation messages and bilateral completion. Payment and delivery remain offline.</p>
        <div className="fleamarket-action-stack">
          {canSellerDecide ? (
            <>
              <button type="button" className="fleamarket-secondary" disabled={busy} onClick={() => onTradeAction('accept_trade')}>Accept trade</button>
              <button type="button" className="fleamarket-secondary" disabled={busy} onClick={() => onTradeAction('decline_trade')}>Decline trade</button>
            </>
          ) : null}
          {canConfirm ? (
            <button type="button" className="fleamarket-primary" disabled={busy} onClick={() => onTradeAction('confirm_trade_success')}>
              <CheckCircle2 aria-hidden="true" />
              Confirm success
            </button>
          ) : null}
          {canCancel ? (
            <button type="button" className="fleamarket-secondary" disabled={busy} onClick={() => onTradeAction('cancel_trade')}>Cancel trade</button>
          ) : null}
          <button
            type="button"
            className="fleamarket-danger-link"
            onClick={() => onReport({ targetType: 'trade', targetId: trade.tradeId, tradeId: trade.tradeId, label: trade.tradeId })}
          >
            <Flag aria-hidden="true" />
            Report trade
          </button>
        </div>
        {showReview ? (
          <div className="fleamarket-review-form">
            <h3>Review counterparty</h3>
            <input aria-label="Review rating" value={reviewRating} onChange={(event) => onReviewRatingChange(event.target.value)} placeholder="1-5" />
            <textarea aria-label="Review comment" value={reviewComment} onChange={(event) => onReviewCommentChange(event.target.value)} placeholder="Short review comment" />
            <button type="button" className="fleamarket-primary" disabled={busy} onClick={onSubmitReview}>Submit review</button>
          </div>
        ) : null}
      </aside>
    </div>
  );
}

export function ComposeView({
  form,
  selectedFiles,
  busy,
  mode,
  onBack,
  onFormChange,
  onFilesChange,
  onSubmit,
}: {
  form: ListingFormState;
  selectedFiles: File[];
  busy: boolean;
  mode: ListingFormMode;
  onBack: () => void;
  onFormChange: (name: keyof ListingFormState, value: string) => void;
  onFilesChange: (files: File[]) => void;
  onSubmit: () => void;
}) {
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
    <section className="fleamarket-compose">
      <button type="button" className="fleamarket-ghost" onClick={onBack}>
        <ArrowLeft aria-hidden="true" />
        Back
      </button>
      <div className="fleamarket-panel">
        <p className="fleamarket-eyebrow">{mode === 'edit' ? 'Edit listing' : 'New listing'}</p>
        <h1>{mode === 'edit' ? 'Edit listing' : 'Post a listing'}</h1>
        <p className="fleamarket-muted">The offline trade route is required because Fleamarket does not process payment or delivery.</p>
        <div className="fleamarket-form-grid">
          {input('title', 'Title', 'Short listing title')}
          {input('category', 'Category', 'compute, data, tool, service, artifact')}
          {input('priceText', 'Price terms', '25 USDC per hour')}
          {input('priceAmount', 'Numeric price', '25')}
          {input('quantity', 'Quantity', '1')}
          {input('condition', 'Condition', 'Available tonight')}
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
            <span>Offline trade route</span>
            <textarea
              name="tradeRoute"
              value={form.tradeRoute}
              onChange={(event) => onFormChange('tradeRoute', event.target.value)}
              placeholder="How buyer and seller coordinate payment and delivery outside the platform."
            />
          </label>
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
        <button type="button" className="fleamarket-primary" disabled={busy} onClick={onSubmit}>
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
  onBack,
  onRefresh,
  onEdit,
  onPublish,
  onPause,
  onClose,
}: {
  listings: ListingSummary[];
  busy: boolean;
  onBack: () => void;
  onRefresh: () => void;
  onEdit: (listingId: string) => void;
  onPublish: (listingId: string) => void;
  onPause: (listingId: string) => void;
  onClose: (listingId: string) => void;
}) {
  return (
    <section className="fleamarket-management">
      <div className="fleamarket-management__header">
        <button type="button" className="fleamarket-ghost" onClick={onBack}><ArrowLeft aria-hidden="true" />Back</button>
        <button type="button" className="fleamarket-secondary" disabled={busy} onClick={onRefresh}>Refresh listings</button>
      </div>
      <div className="fleamarket-list-stack">
        {listings.map((listing) => (
          <article key={listing.listingId} className="fleamarket-row">
            <div>
              <strong>{listing.title}</strong>
              <span>{listing.listingId} · {listing.status} · {listing.priceText}</span>
            </div>
            <div className="fleamarket-row__actions">
              <button type="button" className="fleamarket-secondary" data-testid={`fleamarket-edit-${listing.listingId}`} onClick={() => onEdit(listing.listingId)}>Edit</button>
              {['draft', 'paused'].includes(listing.status) ? (
                <button type="button" className="fleamarket-secondary" data-testid={`fleamarket-publish-${listing.listingId}`} onClick={() => onPublish(listing.listingId)}>Publish</button>
              ) : null}
              {listing.status === 'active' ? (
                <button type="button" className="fleamarket-secondary" data-testid={`fleamarket-pause-${listing.listingId}`} onClick={() => onPause(listing.listingId)}>Pause</button>
              ) : null}
              {listing.status !== 'closed' ? (
                <button type="button" className="fleamarket-danger-link" data-testid={`fleamarket-close-${listing.listingId}`} onClick={() => onClose(listing.listingId)}>Close</button>
              ) : null}
            </div>
          </article>
        ))}
        {listings.length === 0 ? <p className="fleamarket-muted">No listings owned by this agent yet.</p> : null}
      </div>
    </section>
  );
}

export function ReportsView({
  reports,
  busy,
  onBack,
  onRefresh,
}: {
  reports: FleamarketReport[];
  busy: boolean;
  onBack: () => void;
  onRefresh: () => void;
}) {
  return (
    <section className="fleamarket-management">
      <div className="fleamarket-management__header">
        <button type="button" className="fleamarket-ghost" onClick={onBack}><ArrowLeft aria-hidden="true" />Back</button>
        <button type="button" className="fleamarket-secondary" disabled={busy} onClick={onRefresh}>Refresh reports</button>
      </div>
      <div className="fleamarket-list-stack">
        {reports.map((report) => (
          <article key={report.reportId} className="fleamarket-row">
            <div>
              <strong>{report.reportId}</strong>
              <span>{report.targetType}:{report.targetId} · {report.reasonCode} · {report.status}</span>
              {report.detail ? <span>{report.detail}</span> : null}
            </div>
          </article>
        ))}
        {reports.length === 0 ? <p className="fleamarket-muted">No submitted reports yet.</p> : null}
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
        <button type="button" className="fleamarket-modal__close" onClick={onCancel} aria-label="Close report modal"><X aria-hidden="true" /></button>
        <p className="fleamarket-eyebrow">Report {target.targetType}</p>
        <h2>{target.label}</h2>
        <label>
          <span>Reason code</span>
          <input aria-label="Report reason code" value={reasonCode} onChange={(event) => onReasonCodeChange(event.target.value)} />
        </label>
        <label>
          <span>Detail</span>
          <textarea aria-label="Report detail" value={detail} onChange={(event) => onDetailChange(event.target.value)} />
        </label>
        <div className="fleamarket-action-stack">
          <button type="button" className="fleamarket-primary" disabled={busy || !reasonCode.trim()} onClick={onSubmit}>Submit report</button>
          <button type="button" className="fleamarket-secondary" onClick={onCancel}>Cancel</button>
        </div>
      </section>
    </div>
  );
}
