import { formatPluginDateTime } from '@uruc/plugin-sdk/frontend';
import type { FormEvent } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, Info, Send, Store } from 'lucide-react';
import type { FleamarketMessage, FleamarketTrade, ListingDetail, ReportTarget } from './types';
import { heroImage, initials, isWritableStatus, roleForTrade } from './ui';

function listingImage(listing: ListingDetail | null) {
  if (!listing) return null;
  return heroImage(listing.images) ?? listing.mediaUrls.find((url) => /^https?:\/\//i.test(url)) ?? null;
}

function stepState(trade: FleamarketTrade, step: 'negotiation' | 'confirmation' | 'completed') {
  if (step === 'completed') return trade.status === 'completed' ? 'completed' : 'pending';
  if (step === 'confirmation') {
    return ['buyer_confirmed', 'seller_confirmed', 'completed'].includes(trade.status) ? 'confirmation' : 'pending';
  }
  return ['open', 'accepted', 'buyer_confirmed', 'seller_confirmed', 'completed'].includes(trade.status) ? 'negotiating' : 'pending';
}

export function Chat({
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
  const sellerName = trade.sellerAgentName ?? listing?.sellerAgentName ?? 'Seller';
  const image = listingImage(listing);
  const canSellerDecide = role === 'seller' && trade.status === 'open';
  const canConfirm = role !== null && ['accepted', 'buyer_confirmed', 'seller_confirmed'].includes(trade.status);
  const canCancel = role !== null && isWritableStatus(trade);
  const showReview = role !== null && trade.status === 'completed';

  const handleSend = (event: FormEvent) => {
    event.preventDefault();
    onSendMessage();
  };

  return (
    <div className="max-w-6xl mx-auto h-[calc(100vh-140px)] flex flex-col md:flex-row gap-6">
      
      {/* Left/Main: Chat Window */}
      <div className="flex-1 bg-white rounded-3xl border border-slate-200 flex flex-col overflow-hidden shadow-sm">
        {/* Chat Header */}
        <div className="h-16 border-b border-slate-200 px-6 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-4">
            <button type="button" onClick={onBack} className="p-2 -ml-2 text-slate-400 hover:text-slate-900 rounded-full hover:bg-slate-100 transition-colors" aria-label="Back to trades">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600 text-sm">
              {initials(sellerName)}
            </div>
            <div>
              <div className="font-semibold text-slate-900 text-sm">{sellerName}</div>
              <div className="text-xs text-slate-500 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> {trade.status}
              </div>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/30">
          <div className="flex flex-col items-center">
            <div className="text-xs text-slate-400 bg-slate-100 px-3 py-1 rounded-full my-2">
              Trade route: {trade.tradeRouteSnapshot ?? listing?.tradeRoute ?? 'Use the seller-provided offline route.'}
            </div>
          </div>
          {messagesHasMore ? (
            <div className="flex justify-center">
              <button type="button" disabled={busy} onClick={onLoadEarlierMessages} className="text-xs text-slate-500 bg-white border border-slate-200 px-3 py-1 rounded-full hover:bg-slate-50 disabled:opacity-50">
                Load earlier messages
              </button>
            </div>
          ) : null}
          {messages.map((msg) => {
            const mine = msg.senderAgentId === activeAgentId;
            return (
              <div key={msg.messageId} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                  mine 
                    ? 'bg-slate-900 text-white rounded-br-sm' 
                    : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm'
                }`}>
                  <p className="text-sm">{msg.body}</p>
                  {!mine ? (
                    <button
                      type="button"
                      onClick={() => onReport({
                        targetType: 'message',
                        targetId: msg.messageId,
                        tradeId: trade.tradeId,
                        targetAgentId: msg.senderAgentId,
                        label: `message ${msg.messageId}`,
                      })}
                      className="mt-2 text-[10px] text-slate-400 hover:text-rose-500"
                    >
                      Report
                    </button>
                  ) : null}
                </div>
                <span className="text-[10px] text-slate-400 mt-1 px-1">{msg.senderAgentName} · {formatPluginDateTime(msg.createdAt)}</span>
              </div>
            );
          })}
        </div>

        {/* Input */}
        <div className="p-4 bg-white border-t border-slate-200">
          <form onSubmit={handleSend} className="flex gap-2">
            <input
              type="text"
              value={messageDraft}
              onChange={(event) => onMessageDraftChange(event.target.value)}
              placeholder="Type a message..."
              disabled={busy || !isWritableStatus(trade)}
              aria-label="Trade message"
              className="flex-1 bg-slate-100 border-transparent focus:bg-white focus:border-slate-300 focus:ring-2 focus:ring-slate-200 rounded-xl px-4 py-3 text-sm transition-all outline-none"
            />
            <button 
              type="submit"
              disabled={busy || !messageDraft.trim() || !isWritableStatus(trade)}
              className="bg-slate-900 text-white p-3 rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-colors flex items-center justify-center"
              aria-label="Send"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>

      {/* Right: Trade Sidebar */}
      <div className="w-full md:w-80 flex flex-col gap-6">
        
        {/* Item Info Summary */}
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 flex gap-4">
            {image ? (
              <img src={image} alt={trade.listingTitle} className="w-20 h-20 rounded-xl object-cover" />
            ) : (
              <div className="w-20 h-20 rounded-xl bg-slate-100 flex items-center justify-center text-slate-300 shrink-0">
                <Store className="w-7 h-7" />
              </div>
            )}
            <div>
              <h4 className="text-sm font-semibold text-slate-900 line-clamp-2">{trade.listingTitle}</h4>
              <div className="text-lg font-bold text-slate-900 mt-1">
                {trade.priceTextSnapshot ?? listing?.priceText ?? 'Price terms in listing'}
              </div>
            </div>
          </div>
        </div>

        {/* C2C Trade Panel */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex-1">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Info className="w-4 h-4 text-slate-400" />
            Trade Status
          </h3>

          <div className="space-y-6">
            {/* Steps */}
            <div className="relative pl-6 space-y-6 before:absolute before:inset-y-2 before:left-2 before:w-0.5 before:bg-slate-100">
              
              <div className="relative">
                <div className={`absolute -left-[29px] w-5 h-5 rounded-full border-4 border-white ${stepState(trade, 'negotiation') === 'negotiating' ? 'bg-indigo-500' : 'bg-slate-200'}`}></div>
                <h4 className={`text-sm font-medium ${stepState(trade, 'negotiation') === 'negotiating' ? 'text-indigo-600' : 'text-slate-500'}`}>Negotiation</h4>
                <p className="text-xs text-slate-400 mt-1">Agree on price, payment, delivery, and handoff.</p>
              </div>

              <div className="relative">
                <div className={`absolute -left-[29px] w-5 h-5 rounded-full border-4 border-white ${stepState(trade, 'confirmation') === 'confirmation' ? 'bg-indigo-500' : stepState(trade, 'confirmation') === 'completed' ? 'bg-emerald-500' : 'bg-slate-200'}`}></div>
                <h4 className={`text-sm font-medium ${stepState(trade, 'confirmation') === 'confirmation' ? 'text-indigo-600' : stepState(trade, 'confirmation') === 'completed' ? 'text-emerald-600' : 'text-slate-500'}`}>Both-side confirmation</h4>
                <p className="text-xs text-slate-400 mt-1">Each side confirms successful offline completion.</p>
              </div>

              <div className="relative">
                <div className={`absolute -left-[29px] w-5 h-5 rounded-full border-4 border-white ${stepState(trade, 'completed') === 'completed' ? 'bg-emerald-500' : 'bg-slate-200'}`}></div>
                <h4 className={`text-sm font-medium ${stepState(trade, 'completed') === 'completed' ? 'text-emerald-600' : 'text-slate-500'}`}>Trade Completed</h4>
                <p className="text-xs text-slate-400 mt-1">Fleamarket records completion after both confirmations.</p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-3">
              {canSellerDecide ? (
                <>
                  <button type="button" disabled={busy} onClick={() => onTradeAction('accept_trade')} className="w-full bg-slate-900 text-white py-3 rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50">
                    Accept trade
                  </button>
                  <button type="button" disabled={busy} onClick={() => onTradeAction('decline_trade')} className="w-full bg-white text-slate-700 border border-slate-200 py-3 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50">
                    Decline trade
                  </button>
                </>
              ) : null}
              {canConfirm ? (
                <button type="button" disabled={busy} onClick={() => onTradeAction('confirm_trade_success')} className="w-full bg-slate-900 text-white py-3 rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Confirm success
                </button>
              ) : null}
              {canCancel ? (
                <button type="button" disabled={busy} onClick={() => onTradeAction('cancel_trade')} className="w-full bg-white text-slate-700 border border-slate-200 py-3 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50">
                  Cancel trade
                </button>
              ) : null}
              {trade.status === 'completed' ? (
                <div className="flex items-center justify-center gap-2 text-emerald-600 font-medium bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                  <CheckCircle2 className="w-5 h-5" />
                  Trade Successful
                </div>
              ) : null}
            </div>

            {showReview ? (
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <h4 className="text-sm font-semibold text-slate-900">Review counterparty</h4>
                <div className="flex gap-2" role="group" aria-label="Review rating">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                      key={rating}
                      type="button"
                      aria-label={`Rate ${rating}`}
                      onClick={() => onReviewRatingChange(String(rating))}
                      className={`w-9 h-9 rounded-xl border text-sm font-medium transition-colors ${String(rating) === reviewRating ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                    >
                      {rating}
                    </button>
                  ))}
                </div>
                <textarea
                  aria-label="Review comment"
                  value={reviewComment}
                  onChange={(event) => onReviewCommentChange(event.target.value)}
                  placeholder="Short review comment"
                  className="w-full min-h-20 bg-slate-100 border border-transparent focus:bg-white focus:border-slate-300 focus:ring-2 focus:ring-slate-200 rounded-xl px-4 py-3 text-sm transition-all outline-none resize-none"
                />
                <button type="button" disabled={busy} onClick={onSubmitReview} className="w-full bg-slate-900 text-white py-3 rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50">
                  Submit review
                </button>
              </div>
            ) : null}

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => onReport({
                  targetType: 'trade',
                  targetId: trade.tradeId,
                  tradeId: trade.tradeId,
                  targetAgentId: role === 'seller' ? trade.buyerAgentId : trade.sellerAgentId,
                  label: trade.tradeId,
                })}
                className="text-xs flex items-center justify-center gap-1 text-slate-400 hover:text-rose-500 w-full transition-colors"
              >
                <AlertTriangle className="w-3.5 h-3.5" /> File a Report
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
