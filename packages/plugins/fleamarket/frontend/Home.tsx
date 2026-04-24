import { Plus } from 'lucide-react';
import { ItemCard } from './ItemCard';
import type { MarketCategory, MarketItem } from './viewTypes';

export type SortMode = 'latest' | 'title' | 'priceLow' | 'priceHigh';

export function Home({
  categories,
  items,
  activeCategory,
  customCategoryFilter,
  sortMode,
  busy,
  hasMore,
  canWrite,
  onCategoryChange,
  onCustomCategoryFilterChange,
  onSortChange,
  onOpenItem,
  onPostItem,
  onShowC2CInfo,
  onLoadMore,
}: {
  categories: MarketCategory[];
  items: MarketItem[];
  activeCategory: string;
  customCategoryFilter: string;
  sortMode: SortMode;
  busy: boolean;
  hasMore: boolean;
  canWrite: boolean;
  onCategoryChange: (categoryId: string) => void;
  onCustomCategoryFilterChange: (value: string) => void;
  onSortChange: (sortMode: SortMode) => void;
  onOpenItem: (listingId: string) => void;
  onPostItem: () => void;
  onShowC2CInfo: () => void;
  onLoadMore: () => void;
}) {
  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <section className="bg-white rounded-3xl p-8 md:p-12 border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute -right-20 -top-20 w-96 h-96 bg-indigo-50 rounded-full blur-3xl opacity-50"></div>
        <div className="relative max-w-2xl">
          <h1 className="text-3xl md:text-5xl font-semibold tracking-tight text-slate-900 mb-4">
            Discover, trade, and connect.
          </h1>
          <p className="text-lg text-slate-500 mb-8 leading-relaxed">
            The open flea market of Uruc. Trade compute, data, tools, services, or artifacts directly with others. Payment and delivery happen outside the platform.
          </p>
          <div className="flex flex-wrap gap-4">
            <button
              type="button"
              onClick={onPostItem}
              disabled={!canWrite}
              className="bg-slate-900 text-white px-6 py-3 rounded-xl font-medium hover:bg-slate-800 transition-colors flex items-center gap-2 shadow-sm"
            >
              <Plus className="w-4 h-4" /> Post an Item
            </button>
            <button
              type="button"
              onClick={onShowC2CInfo}
              className="bg-white text-slate-700 border border-slate-200 px-6 py-3 rounded-xl font-medium hover:bg-slate-50 transition-colors"
            >
              How C2C Works
            </button>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <section>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 sticky top-16 bg-slate-50/90 backdrop-blur py-4 z-40">
          
          {/* Category Navigation */}
          <div className="flex overflow-x-auto hide-scrollbar gap-2 w-full md:w-auto" role="list" aria-label="Listing categories">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => onCategoryChange(cat.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                    isActive 
                      ? 'bg-slate-900 text-white shadow-md' 
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-200' : 'text-slate-400'}`} />
                  {cat.name}
                </button>
              );
            })}
          </div>
          
          {/* Filter / Sort */}
          <div className="hidden md:flex items-center gap-2">
            <input
              value={customCategoryFilter}
              onChange={(event) => onCustomCategoryFilterChange(event.target.value)}
              aria-label="Custom category filter"
              placeholder="Custom category"
              className="bg-white border border-slate-200 text-sm rounded-xl px-3 py-2.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-40"
            />
            <select
              value={sortMode}
              onChange={(event) => onSortChange(event.target.value as SortMode)}
              aria-label="Sort listings"
              className="bg-white border border-slate-200 text-sm rounded-xl px-3 py-2.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="latest">Latest</option>
              <option value="priceLow">Price: Low to High</option>
              <option value="priceHigh">Price: High to Low</option>
              <option value="title">Title</option>
            </select>
          </div>
        </div>

        {/* Items Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" data-testid="fleamarket-listing-grid">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} onOpen={onOpenItem} />
          ))}
          {items.length === 0 && !busy && (
            <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-white">
              <p className="text-slate-500 font-medium">No listings found in this category.</p>
            </div>
          )}
        </div>

        {hasMore ? (
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              disabled={busy}
              onClick={onLoadMore}
              className="bg-white text-slate-700 border border-slate-200 px-6 py-3 rounded-xl font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Load more
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
