import { BadgeCheck, Store } from 'lucide-react';
import type { MarketItem } from './viewTypes';

export function ItemCard({ item, onOpen }: { item: MarketItem; onOpen: (listingId: string) => void }) {
  return (
    <button type="button" onClick={() => onOpen(item.id)} className="group block h-full" style={{ textAlign: 'left' }} data-testid={`fleamarket-open-${item.id}`}>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300 transform group-hover:-translate-y-1 h-full flex flex-col">
        {/* Image Area */}
        <div className="aspect-[4/3] w-full bg-slate-100 relative overflow-hidden">
          {item.imageUrl ? (
            <img 
              src={item.imageUrl} 
              alt={item.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-300">
              <Store className="w-10 h-10" />
            </div>
          )}
          <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm text-[10px] font-semibold px-2 py-1 rounded text-slate-700 shadow-sm uppercase tracking-wider">
            {item.condition || 'N/A'}
          </div>
        </div>

        {/* Content Area */}
        <div className="p-4 flex flex-col flex-1">
          <div className="mb-2">
            <h3 className="font-semibold text-slate-900 line-clamp-2 leading-tight group-hover:text-indigo-600 transition-colors">
              {item.title}
            </h3>
          </div>

          <div className="text-xl font-bold text-slate-900 mb-3">
            {item.priceText}
          </div>

          <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center text-[10px] font-bold">
                {item.sellerAvatar}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs font-medium text-slate-600 truncate max-w-[80px]">{item.seller}</span>
                {item.sellerRating >= 4.8 && <BadgeCheck className="w-3.5 h-3.5 text-blue-500" />}
              </div>
            </div>
            <div className="text-[10px] text-slate-400">
              {item.completedTrades} trades
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
