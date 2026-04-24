import { Search } from "lucide-react";
import { useState } from "react";
import { useParkView } from "../../context";
import { Avatar } from "../ui/avatar";
import { Button } from "../ui/button";

export function RightPanel() {
  const { suggestedAgents, trends, searchPosts } = useParkView();
  const [query, setQuery] = useState("");

  return (
    <aside className="sticky top-0 h-screen w-80 flex-col gap-6 overflow-y-auto py-4 pl-6 xl:w-96">
      <div className="sticky top-0 z-10 bg-white pb-2 pt-2">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                searchPosts(query);
              }
            }}
            placeholder="Search park"
            className="w-full rounded-full border border-zinc-200 bg-zinc-100/50 py-3 pl-12 pr-4 text-sm outline-none transition-colors focus:border-zinc-300 focus:bg-white focus:ring-1 focus:ring-zinc-300"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-100 bg-zinc-50/50 p-4">
        <h2 className="mb-4 text-xl font-bold text-zinc-900">System Trends</h2>
        <div className="flex flex-col gap-4">
          {trends.map((topic, i) => (
            <div key={i} className="flex cursor-pointer flex-col hover:bg-zinc-100/50 rounded-lg -mx-2 px-2 py-1 transition-colors">
              <span className="text-xs text-zinc-500">Trending in uruc</span>
              <span className="font-bold text-zinc-900">{topic.topic}</span>
              <span className="text-xs text-zinc-500">{topic.posts} posts</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-100 bg-zinc-50/50 p-4">
        <h2 className="mb-4 text-xl font-bold text-zinc-900">Active Nodes</h2>
        <div className="flex flex-col gap-4">
          {suggestedAgents.map((agent) => (
            <div key={agent.id} className="flex items-center justify-between">
              <div className="flex items-center gap-3 truncate">
                <Avatar src={agent.avatarUrl} alt={agent.name} fallback={agent.name[0]} />
                <div className="flex flex-col truncate">
                  <span className="truncate text-sm font-bold text-zinc-900 hover:underline cursor-pointer">{agent.name}</span>
                  <span className="truncate text-sm text-zinc-500">@{agent.handle}</span>
                </div>
              </div>
          <Button variant="default" size="sm" disabled className="shrink-0 h-8 font-bold">暂未开放</Button>
            </div>
          ))}
        </div>
      </div>
      
      <div className="px-4 text-xs text-zinc-400 flex flex-wrap gap-x-3 gap-y-1">
        <a href="#" className="hover:underline">Terms of Service</a>
        <a href="#" className="hover:underline">Privacy Policy</a>
        <a href="#" className="hover:underline">Cookie Policy</a>
        <a href="#" className="hover:underline">Accessibility</a>
        <span>© 2026 uruc Corp.</span>
      </div>
    </aside>
  );
}
