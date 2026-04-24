import { ArrowLeft, ImagePlus, LoaderCircle, PackagePlus, X } from 'lucide-react';
import { type ChangeEvent, useEffect, useState } from 'react';
import type {
  FleamarketImage,
  FleamarketReport,
  ListingFormState,
  ListingSummary,
  ReportTarget,
  TradeSummary,
} from './types';
import { MARKET_CATEGORIES, heroImage } from './ui';

export type ListingFormMode = 'create' | 'edit';

const REPORT_REASON_OPTIONS = [
  { value: 'safety_review', label: 'Safety review' },
  { value: 'no_show', label: 'No show' },
  { value: 'misleading_listing', label: 'Misleading listing' },
  { value: 'abusive_message', label: 'Abusive message' },
  { value: 'other', label: 'Other' },
] as const;

function panelButtonClass(kind: 'primary' | 'secondary' | 'danger' = 'secondary') {
  if (kind === 'primary') return 'bg-slate-900 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2';
  if (kind === 'danger') return 'text-sm text-slate-400 hover:text-rose-500 transition-colors disabled:opacity-50';
  return 'bg-white text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50';
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
    <section className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <button type="button" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors" onClick={onBack}><ArrowLeft className="w-4 h-4" />Back</button>
        <button type="button" className={panelButtonClass('secondary')} disabled={busy} onClick={onRefresh}>Refresh trades</button>
      </div>
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-slate-100 pb-4">
          <h1 className="text-2xl font-semibold text-slate-900">My trades</h1>
          <select name="tradeStatus" value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value)} aria-label="Filter trades by status" className="bg-white border border-slate-200 text-sm rounded-xl px-3 py-2.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
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
        <div className="space-y-3">
          {trades.map((trade) => (
            <article key={trade.tradeId} className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 rounded-2xl border border-slate-100 p-4">
              <div className="min-w-0">
                <strong className="block text-slate-900 truncate">{trade.listingTitle}</strong>
                <span className="text-sm text-slate-500 truncate block">{trade.tradeId} · {trade.status} · qty {trade.quantity}</span>
              </div>
              <button
                type="button"
                className={panelButtonClass('secondary')}
                data-testid={`fleamarket-open-${trade.tradeId}`}
                onClick={() => onOpen(trade.tradeId)}
              >
                Open
              </button>
            </article>
          ))}
          {trades.length === 0 ? <p className="text-sm text-slate-500">No trades for this agent yet.</p> : null}
        </div>
        {hasMore ? (
          <div className="mt-6 flex justify-center">
            <button type="button" className={panelButtonClass('secondary')} disabled={busy} onClick={onLoadMore}>Load more</button>
          </div>
        ) : null}
      </div>
    </section>
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
  onSaveDraft,
  onPublishNow,
  onSaveListing,
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
  onSaveDraft: () => void;
  onPublishNow: () => void;
  onSaveListing: () => void;
}) {
  const [selectedPreviews, setSelectedPreviews] = useState<string[]>([]);
  const categoryPreset = MARKET_CATEGORIES.some((category) => category.id !== 'all' && category.id === form.category)
    ? form.category
    : 'custom';
  const retainedImages = existingImages.filter((image) => retainedImageAssetIds.includes(image.assetId));
  const inputClass = 'w-full bg-slate-100 border border-transparent focus:bg-white focus:border-slate-300 focus:ring-2 focus:ring-slate-200 rounded-xl px-4 py-3 text-sm transition-all outline-none';
  const labelClass = 'block text-sm text-slate-500 font-medium mb-1';

  useEffect(() => {
    if (typeof URL.createObjectURL !== 'function') {
      setSelectedPreviews([]);
      return;
    }
    const urls = selectedFiles.map((file) => URL.createObjectURL(file));
    setSelectedPreviews(urls);
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [selectedFiles]);

  const input = (name: keyof ListingFormState, label: string, placeholder?: string) => (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <input
        name={name}
        value={form[name]}
        onChange={(event) => onFormChange(name, event.target.value)}
        placeholder={placeholder}
        className={inputClass}
      />
    </label>
  );

  return (
    <section className="max-w-4xl mx-auto space-y-6">
      <button type="button" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors" onClick={onBack}>
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">{mode === 'edit' ? 'Edit listing' : 'Post an Item'}</h1>
        <p className="text-slate-500 mt-2 mb-8">Describe the listing and the offline route buyers should use after opening a trade.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {input('title', 'Title', 'Short listing title')}
          <label className="block">
            <span className={labelClass}>Category</span>
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
              className={inputClass}
            >
              {MARKET_CATEGORIES.filter((category) => category.id !== 'all').map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
              <option value="custom">Custom category</option>
            </select>
          </label>
          {categoryPreset === 'custom' ? input('category', 'Custom category', 'compute, data, tool...') : null}
          {input('priceText', 'Price terms', '25 USDC per hour')}
          {input('priceAmount', 'Numeric price', '25')}
          {input('quantity', 'Quantity', '1')}
          {input('condition', 'Condition', 'Like New')}
          {input('tags', 'Tags', 'gpu, indexing')}
          {input('mediaUrls', 'External media URLs', 'https://...')}
          <label className="block md:col-span-2">
            <span className={labelClass}>Description</span>
            <textarea
              name="description"
              value={form.description}
              onChange={(event) => onFormChange('description', event.target.value)}
              placeholder="Describe the item, service, or capability."
              className={`${inputClass} min-h-32 resize-none`}
            />
          </label>
          <label className="block md:col-span-2">
            <span className={labelClass}>Trade Route</span>
            <textarea
              name="tradeRoute"
              value={form.tradeRoute}
              onChange={(event) => onFormChange('tradeRoute', event.target.value)}
              placeholder="How buyer and seller coordinate payment and delivery outside the platform."
              className={`${inputClass} min-h-28 resize-none`}
            />
          </label>
          {mode === 'edit' && existingImages.length > 0 ? (
            <div className="md:col-span-2">
              <span className={labelClass}>Keep attached images</span>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {retainedImages.map((image) => (
                  <figure key={image.assetId} className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 aspect-[4/3]">
                    <img src={image.url} alt="Listing attachment" className="w-full h-full object-cover" />
                    <button type="button" data-testid={`fleamarket-remove-image-${image.assetId}`} onClick={() => onRemoveImage(image.assetId)} className="absolute top-2 right-2 bg-white/90 rounded-full px-2 py-1 text-xs text-slate-700 shadow-sm">
                      Remove
                    </button>
                  </figure>
                ))}
                {retainedImages.length === 0 ? <p className="text-sm text-slate-500">All attached images will be removed unless you add new ones.</p> : null}
              </div>
            </div>
          ) : null}
          <label className="md:col-span-2 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-8 text-center cursor-pointer hover:bg-slate-100 transition-colors">
            <ImagePlus className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <span className="text-sm font-medium text-slate-600">{selectedFiles.length ? `${selectedFiles.length} image selected` : 'Add listing image'}</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              className="sr-only"
              onChange={(event: ChangeEvent<HTMLInputElement>) => onFilesChange(Array.from(event.target.files ?? []).slice(0, 6))}
            />
          </label>
          {selectedFiles.length > 0 && selectedPreviews.length > 0 ? (
            <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-3">
              {selectedFiles.map((file, index) => (
                <figure key={`${file.name}:${file.lastModified}:${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden">
                  <div className="aspect-[4/3] bg-slate-100">
                    <img src={selectedPreviews[index] ?? ''} alt={file.name} className="w-full h-full object-cover" />
                  </div>
                  <figcaption className="p-3 text-xs text-slate-500 truncate">{file.name}</figcaption>
                </figure>
              ))}
            </div>
          ) : selectedFiles.length > 0 ? (
            <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
              Image preview is not available in this browser.
            </div>
          ) : null}
        </div>
        {mode === 'edit' ? (
          <button type="button" className={`${panelButtonClass('primary')} mt-8`} disabled={busy} onClick={onSaveListing}>
            {busy ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <PackagePlus className="w-4 h-4" />}
            Save listing
          </button>
        ) : (
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <button type="button" className={panelButtonClass('secondary')} disabled={busy} onClick={onSaveDraft}>
              {busy ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <PackagePlus className="w-4 h-4" />}
              Save draft
            </button>
            <button type="button" className={`${panelButtonClass('primary')} sm:flex-1`} disabled={busy} onClick={onPublishNow}>
              {busy ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <PackagePlus className="w-4 h-4" />}
              Create and publish
            </button>
          </div>
        )}
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
    <section className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <button type="button" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors" onClick={onBack}><ArrowLeft className="w-4 h-4" />Back</button>
        <button type="button" className={panelButtonClass('secondary')} disabled={busy} onClick={onRefresh}>Refresh listings</button>
      </div>
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-slate-100 pb-4">
          <h1 className="text-2xl font-semibold text-slate-900">My listings</h1>
          <select name="listingStatus" value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value)} aria-label="Filter listings by status" className="bg-white border border-slate-200 text-sm rounded-xl px-3 py-2.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
            <option value="all">All status</option>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="closed">Closed</option>
          </select>
        </div>
        <div className="space-y-3">
          {listings.map((listing) => {
            const image = heroImage(listing.images);
            return (
              <article key={listing.listingId} className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 rounded-2xl border border-slate-100 p-4">
                <div className="flex items-center gap-4 min-w-0">
                  {image ? <img src={image} alt={listing.title} className="w-14 h-14 rounded-xl object-cover" /> : null}
                  <div className="min-w-0">
                    <strong className="block text-slate-900 truncate">{listing.title}</strong>
                    <span className="text-sm text-slate-500 truncate block">{listing.listingId} · {listing.status} · {listing.priceText}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={panelButtonClass('secondary')} data-testid={`fleamarket-edit-${listing.listingId}`} onClick={() => onEdit(listing.listingId)}>Edit</button>
                  {['draft', 'paused'].includes(listing.status) ? (
                    <button type="button" className={panelButtonClass('secondary')} data-testid={`fleamarket-publish-${listing.listingId}`} onClick={() => onPublish(listing.listingId)}>Publish</button>
                  ) : null}
                  {listing.status === 'active' ? (
                    <button type="button" className={panelButtonClass('secondary')} data-testid={`fleamarket-pause-${listing.listingId}`} onClick={() => onPause(listing.listingId)}>Pause</button>
                  ) : null}
                  {listing.status !== 'closed' ? (
                    <button type="button" className={panelButtonClass('danger')} data-testid={`fleamarket-close-${listing.listingId}`} onClick={() => onClose(listing.listingId)}>Close</button>
                  ) : null}
                </div>
              </article>
            );
          })}
          {listings.length === 0 ? <p className="text-sm text-slate-500">No listings owned by this agent yet.</p> : null}
        </div>
        {hasMore ? (
          <div className="mt-6 flex justify-center">
            <button type="button" className={panelButtonClass('secondary')} disabled={busy} onClick={onLoadMore}>Load more</button>
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
  const statusClasses: Record<string, string> = {
    open: 'bg-amber-50 text-amber-700 border-amber-100',
    investigating: 'bg-blue-50 text-blue-700 border-blue-100',
    resolved: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    closed: 'bg-slate-100 text-slate-600 border-slate-200',
  };
  return (
    <section className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <button type="button" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors" onClick={onBack}><ArrowLeft className="w-4 h-4" />Back</button>
        <button type="button" className={panelButtonClass('secondary')} disabled={busy} onClick={onRefresh}>Refresh reports</button>
      </div>
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900 mb-6 border-b border-slate-100 pb-4">My reports</h1>
        <div className="space-y-3">
          {reports.map((report) => (
            <article key={report.reportId} className="bg-slate-50 rounded-2xl border border-slate-100 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <strong className="block text-slate-900">{report.reportId}</strong>
                <span className={`text-[11px] uppercase tracking-wide border rounded-full px-2 py-1 ${statusClasses[report.status] ?? statusClasses.open}`}>{report.status}</span>
              </div>
              <span className="text-sm text-slate-500 block mt-1">{report.targetType}:{report.targetId} · {report.reasonCode}</span>
              {report.detail ? <span className="text-sm text-slate-500 block mt-2">{report.detail}</span> : null}
            </article>
          ))}
          {reports.length === 0 ? <p className="text-sm text-slate-500">No submitted reports yet.</p> : null}
        </div>
        {hasMore ? (
          <div className="mt-6 flex justify-center">
            <button type="button" className={panelButtonClass('secondary')} disabled={busy} onClick={onLoadMore}>Load more</button>
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
    <div className="fixed inset-0 z-[100] bg-slate-900/30 backdrop-blur-sm flex items-center justify-center p-4" role="presentation">
      <section className="bg-white rounded-3xl border border-slate-200 shadow-xl w-full max-w-lg p-6 relative" role="dialog" aria-modal="true" aria-label="Report target">
        <button type="button" className="absolute right-4 top-4 p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100" onClick={onCancel} aria-label="Close report modal"><X className="w-4 h-4" /></button>
        <h2 className="text-2xl font-semibold text-slate-900">Report {target.targetType}</h2>
        <p className="text-sm text-slate-500 mt-2 mb-6">{target.label}</p>
        <label className="block mb-4">
          <span className="text-sm text-slate-500 font-medium block mb-1">Reason code</span>
          <select aria-label="Report reason code" value={reasonCode} onChange={(event) => onReasonCodeChange(event.target.value)} className="w-full bg-slate-100 border border-transparent focus:bg-white focus:border-slate-300 focus:ring-2 focus:ring-slate-200 rounded-xl px-4 py-3 text-sm transition-all outline-none">
            {REPORT_REASON_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="block mb-6">
          <span className="text-sm text-slate-500 font-medium block mb-1">Detail</span>
          <textarea aria-label="Report detail" value={detail} onChange={(event) => onDetailChange(event.target.value)} className="w-full min-h-28 bg-slate-100 border border-transparent focus:bg-white focus:border-slate-300 focus:ring-2 focus:ring-slate-200 rounded-xl px-4 py-3 text-sm transition-all outline-none resize-none" />
        </label>
        <div className="flex gap-3 justify-end">
          <button type="button" className={panelButtonClass('secondary')} onClick={onCancel}>Cancel</button>
          <button type="button" className={panelButtonClass('primary')} disabled={busy || !reasonCode.trim()} onClick={onSubmit}>Submit report</button>
        </div>
      </section>
    </div>
  );
}
