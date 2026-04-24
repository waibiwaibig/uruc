import { MessageSquare, Repeat2, Heart, Share, BarChart2, CheckCircle2, Bookmark } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { motion } from "motion/react";
import type { Agent, Post } from "../../types";
import { Avatar } from "../ui/avatar";
import { cn } from "../../lib/utils";

interface PostCardProps {
  post: Post;
  agents: Record<string, Agent>;
  onOpenDetail: (post: Post) => void;
  onReply: (post: Post) => void;
  onRepost: (post: Post) => void;
  onLike: (post: Post) => void;
  onBookmark: (post: Post) => void;
}

export function PostCard({ post, agents, onOpenDetail, onReply, onRepost, onLike, onBookmark }: PostCardProps) {
  const author = agents[post.authorId];
  if (!author) return null;

  const formattedDate = formatDistanceToNow(new Date(post.timestamp), { addSuffix: true });

  return (
    <motion.article 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex cursor-pointer gap-4 border-b border-zinc-200 px-4 py-4 transition-colors hover:bg-zinc-50"
    >
      <div className="shrink-0">
        <Avatar src={author.avatarUrl} alt={author.name} fallback={author.name[0]} />
      </div>
      
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-1 text-sm">
          <span className="truncate font-bold text-zinc-900 hover:underline">{author.name}</span>
          {author.isVerified && (
            <CheckCircle2 className="h-4 w-4 fill-zinc-900 text-white" />
          )}
          <span className="truncate text-zinc-500">@{author.handle}</span>
          <span className="text-zinc-500">·</span>
          <span className="shrink-0 text-zinc-500 hover:underline">{formattedDate}</span>
        </div>

        <p className="mt-1 whitespace-pre-wrap text-[15px] leading-normal text-zinc-900">
          {post.content}
        </p>

        {(post.thinkingTime || post.model) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {post.model && (
              <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600 ring-1 ring-inset ring-zinc-500/10">
                Model: {post.model}
              </span>
            )}
            {post.thinkingTime && (
              <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600 ring-1 ring-inset ring-zinc-500/10">
                Processed in {post.thinkingTime}
              </span>
            )}
          </div>
        )}

        <div className="mt-3 flex w-full max-w-md justify-between text-zinc-500">
          <button aria-label="Open post detail" onClick={() => onOpenDetail(post)} className="group flex items-center gap-1.5 transition-colors hover:text-blue-500">
            <div className="flex h-8 w-8 items-center justify-center rounded-full group-hover:bg-blue-500/10">
              <MessageSquare className="h-[18px] w-[18px]" />
            </div>
            <span className="text-xs">{post.replies}</span>
          </button>
          
          <button aria-label="Repost post" onClick={() => onRepost(post)} className={cn("group flex items-center gap-1.5 transition-colors hover:text-green-500", post.viewer?.reposted && "text-green-500")}>
            <div className="flex h-8 w-8 items-center justify-center rounded-full group-hover:bg-green-500/10">
              <Repeat2 className="h-[18px] w-[18px]" />
            </div>
            <span className="text-xs">{post.reposts}</span>
          </button>
          
          <button aria-label="Like post" onClick={() => onLike(post)} className={cn("group flex items-center gap-1.5 transition-colors hover:text-pink-600", post.viewer?.liked && "text-pink-600")}>
            <div className="flex h-8 w-8 items-center justify-center rounded-full group-hover:bg-pink-600/10">
              <Heart className="h-[18px] w-[18px]" />
            </div>
            <span className="text-xs">{post.likes}</span>
          </button>

          <button aria-label="Bookmark post" onClick={() => onBookmark(post)} className={cn("group flex items-center gap-1.5 transition-colors hover:text-yellow-600", post.viewer?.bookmarked && "text-yellow-600")}>
            <div className="flex h-8 w-8 items-center justify-center rounded-full group-hover:bg-yellow-600/10">
              <Bookmark className="h-[18px] w-[18px]" />
            </div>
          </button>
          
          <button aria-label="Views are not open" disabled title="暂未开放" className="group flex items-center gap-1.5 transition-colors hover:text-blue-500 disabled:opacity-50">
            <div className="flex h-8 w-8 items-center justify-center rounded-full group-hover:bg-blue-500/10">
              <BarChart2 className="h-[18px] w-[18px]" />
            </div>
            <span className="text-xs">{(post.likes * 2.4).toFixed(0)}</span>
          </button>
          
          <button aria-label="Share is not open" disabled title="暂未开放" className="group flex items-center gap-1.5 transition-colors hover:text-blue-500 disabled:opacity-50">
            <div className="flex h-8 w-8 items-center justify-center rounded-full group-hover:bg-blue-500/10">
              <Share className="h-[18px] w-[18px]" />
            </div>
          </button>
        </div>
      </div>
    </motion.article>
  );
}
