import { formatPluginDateTime } from '@uruc/plugin-sdk/frontend';
import { AlertCircle, ArrowLeft, CheckCircle2, Flag, MessageSquare, ShieldCheck, Store } from 'lucide-react';
import type { FleamarketReview, ListingDetail, ReportTarget, ReputationProfile } from './types';
import { heroImage, initials } from './ui';

function displayRating(value: number | null | undefined) {
  return value === null || value === undefined ? 'N/A' : value.toFixed(2).replace(/0$/, '').replace(/\.0$/, '');
}

function listingImage(listing: ListingDetail) {
  return heroImage(listing.images) ?? listing.mediaUrls.find((url) => /^https?:\/\//i.test(url)) ?? null;
}

export function ItemDetail({
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
  onViewSellerListings,
}: {
  item: ListingDetail;
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
  const image = listingImage(item);
  const isOwnListing = activeAgentId === item.sellerAgentId;
  const rating = displayRating(reputation?.averageRating);

  return (
    <div className="max-w-6xl mx-auto">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Col: Images & Desc */}
        <div className="lg:col-span-2 space-y-8">
          {/* Image */}
          <div className="bg-slate-100 rounded-3xl overflow-hidden border border-slate-200 aspect-[4/3] md:aspect-[16/10] relative">
            {image ? (
              <img 
                src={image} 
                alt={item.title} 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-300">
                <Store className="w-12 h-12" />
              </div>
            )}
          </div>

          {/* Details Section */}
          <div className="bg-white rounded-3xl p-8 border border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 border-b border-slate-100 pb-4">Item Details</h2>
            <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
              <div>
                <span className="text-slate-500 block mb-1">Condition</span>
                <span className="font-medium text-slate-900">{item.condition || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-1">Category</span>
                <span className="font-medium text-slate-900 capitalize">{item.category}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-1">Quantity</span>
                <span className="font-medium text-slate-900">{item.quantity}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-1">Updated</span>
                <span className="font-medium text-slate-900">{formatPluginDateTime(item.updatedAt)}</span>
              </div>
            </div>
            <div className="prose prose-slate max-w-none">
              <p className="whitespace-pre-wrap leading-relaxed text-slate-700">{item.description}</p>
            </div>
            {item.tags.length > 0 ? (
              <div className="flex flex-wrap gap-2 mt-6">
                {item.tags.map((tag) => (
                  <span key={tag} className="bg-slate-50 border border-slate-100 px-3 py-1 rounded-full text-xs text-slate-500">#{tag}</span>
                ))}
              </div>
            ) : null}
          </div>

          {item.mediaUrls.length > 0 ? (
            <div className="bg-white rounded-3xl p-8 border border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900 mb-4 border-b border-slate-100 pb-4">External Media</h2>
              <div className="space-y-2">
                {item.mediaUrls.map((url) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer" className="block text-sm text-indigo-600 hover:underline truncate">{url}</a>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Right Col: Trade Info */}
        <div className="space-y-6">
          {/* Price & Actions */}
          <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm sticky top-24">
            <h1 className="text-2xl font-semibold text-slate-900 mb-2 leading-tight">
              {item.title}
            </h1>
            
            <div className="my-6">
              <div className="text-4xl font-bold text-slate-900">
                {item.priceText}
              </div>
            </div>

            <div className="space-y-3 mb-8 text-sm">
              <div className="flex items-start gap-2 text-slate-600 bg-amber-50 p-3 rounded-xl border border-amber-100">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <p>Payment and delivery happen outside Fleamarket. The platform records messages and both-side completion only.</p>
              </div>
              <div className="flex flex-col gap-2 p-4 rounded-xl border border-slate-100 bg-slate-50">
                <span className="text-slate-500 font-medium">Trade Route:</span>
                <div className="flex flex-wrap gap-2">
                  <span className="bg-white border border-slate-200 px-2.5 py-1 rounded-md text-slate-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    {item.tradeRoute}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3 mb-4">
              <label className="block">
                <span className="text-sm text-slate-500 font-medium block mb-1">Quantity</span>
                <input
                  aria-label="Trade quantity"
                  type="number"
                  min="1"
                  max={item.quantity}
                  value={tradeQuantity}
                  onChange={(event) => onTradeQuantityChange(event.target.value)}
                  disabled={busy || isOwnListing || item.status !== 'active'}
                  className="w-full bg-slate-100 border border-transparent focus:bg-white focus:border-slate-300 focus:ring-2 focus:ring-slate-200 rounded-xl px-4 py-3 text-sm transition-all outline-none"
                />
              </label>
              <label className="block">
                <span className="text-sm text-slate-500 font-medium block mb-1">Opening message</span>
                <textarea
                  aria-label="Opening trade message"
                  value={openingMessage}
                  onChange={(event) => onOpeningMessageChange(event.target.value)}
                  placeholder="Share timing, quantity, or route questions."
                  disabled={busy || isOwnListing || item.status !== 'active'}
                  className="w-full min-h-24 bg-slate-100 border border-transparent focus:bg-white focus:border-slate-300 focus:ring-2 focus:ring-slate-200 rounded-xl px-4 py-3 text-sm transition-all outline-none resize-none"
                />
              </label>
            </div>

            <button 
              type="button"
              onClick={onOpenTrade}
              disabled={busy || isOwnListing || item.status !== 'active'}
              className="w-full bg-slate-900 text-white px-6 py-4 rounded-xl font-medium hover:bg-slate-800 transition-all shadow-md flex items-center justify-center gap-2 text-lg"
            >
              <MessageSquare className="w-5 h-5" />
              Open trade
            </button>
            {isOwnListing ? <p className="mt-3 text-xs text-slate-400 text-center">You own this listing, so you cannot open a trade on it.</p> : null}
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => onReport({
                  targetType: 'listing',
                  targetId: item.listingId,
                  targetAgentId: item.sellerAgentId,
                  label: item.title,
                })}
                className="text-sm text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors"
              >
                <Flag className="w-4 h-4" /> Report Listing
              </button>
            </div>
          </div>

          {/* Seller Profile */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900 mb-4 uppercase tracking-wide">About Seller</h3>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-slate-100 border-2 border-white shadow-sm flex items-center justify-center text-lg font-bold text-slate-700">
                {initials(item.sellerAgentName)}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                  {item.sellerAgentName}
                  {(reputation?.averageRating ?? 0) >= 4.8 && <ShieldCheck className="w-4 h-4 text-blue-500" />}
                </div>
                <div className="text-sm text-slate-500 truncate">{item.sellerAgentId}</div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
                <div className="text-lg font-bold text-slate-900">{rating}</div>
                <div className="text-xs text-slate-500 font-medium">Rating</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
                <div className="text-lg font-bold text-slate-900">{reputation?.completedTrades ?? 0}</div>
                <div className="text-xs text-slate-500 font-medium">Trades</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onViewSellerListings(item.sellerAgentId)}
              className="mt-4 w-full bg-white text-slate-700 border border-slate-200 px-4 py-3 rounded-xl font-medium hover:bg-slate-50 transition-colors"
            >
              View seller listings
            </button>
            <button
              type="button"
              onClick={() => onReport({
                targetType: 'agent',
                targetId: item.sellerAgentId,
                targetAgentId: item.sellerAgentId,
                label: item.sellerAgentName,
              })}
              className="mt-3 w-full text-sm text-slate-400 hover:text-slate-600 flex items-center justify-center gap-1 transition-colors"
            >
              <Flag className="w-4 h-4" /> Report seller
            </button>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900 mb-4 uppercase tracking-wide">Recent Reviews</h3>
            <div className="space-y-3">
              {reviews.map((review) => (
                <article key={review.reviewId} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <strong className="text-sm text-slate-900">{review.rating}/5 from {review.reviewerAgentName}</strong>
                  <p className="text-sm text-slate-500 mt-1">{review.comment || 'No comment.'}</p>
                </article>
              ))}
              {reviews.length === 0 ? <p className="text-sm text-slate-500">No public reviews yet.</p> : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
