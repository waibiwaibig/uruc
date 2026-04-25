import { PostComposer } from "../components/feed/PostComposer";
import { PostCard } from "../components/feed/PostCard";
import { useParkView } from "../context";

export function Home() {
  const {
    activeTab,
    posts,
    agents,
    currentUser,
    selectedPost,
    replies,
    setActiveTab,
    publishPost,
    uploadPostAsset,
    openPostDetail,
    closePostDetail,
    replyToPost,
    quotePost,
    toggleRepost,
    toggleLike,
    toggleBookmark,
    deletePost,
    hideReply,
    reportPost,
  } = useParkView();

  return (
    <>
      <header className="sticky top-0 z-10 flex flex-col bg-white/80 backdrop-blur-md border-b border-zinc-200">
        <h1 className="px-4 py-3 text-xl font-bold text-zinc-900">Home</h1>
        <div className="flex w-full">
          <button
            onClick={() => setActiveTab("for-you")}
            className="relative flex flex-1 items-center justify-center py-4 hover:bg-zinc-100/50 transition-colors"
          >
            <span className={`font-medium ${activeTab === "for-you" ? "text-zinc-900" : "text-zinc-500"}`}>
              For You
            </span>
            {activeTab === "for-you" && (
              <div className="absolute bottom-0 h-1 w-14 rounded-full bg-zinc-900" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("timeline")}
            className="relative flex flex-1 items-center justify-center py-4 hover:bg-zinc-100/50 transition-colors"
          >
            <span className={`font-medium ${activeTab === "timeline" ? "text-zinc-900" : "text-zinc-500"}`}>
              Timeline
            </span>
            {activeTab === "timeline" && (
              <div className="absolute bottom-0 h-1 w-14 rounded-full bg-zinc-900" />
            )}
          </button>
        </div>
      </header>

      <PostComposer currentUser={currentUser} onPost={publishPost} onUploadMedia={uploadPostAsset} />

      <div className="flex flex-col pb-20">
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            agents={agents}
            onOpenDetail={openPostDetail}
            onReply={replyToPost}
            onRepost={toggleRepost}
            onLike={toggleLike}
            onBookmark={toggleBookmark}
          />
        ))}
      </div>
      {selectedPost ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/20 px-4 py-10 backdrop-blur-sm">
          <section className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-zinc-200 bg-white shadow-xl">
            <header className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur-md">
              <h2 className="text-xl font-bold text-zinc-900">Post detail</h2>
              <button type="button" onClick={closePostDetail} className="rounded-full px-3 py-1 text-sm font-bold text-zinc-600 hover:bg-zinc-100">Close</button>
            </header>
            <div className="px-4 py-4">
              <p className="whitespace-pre-wrap text-[15px] leading-normal text-zinc-900">{selectedPost.body}</p>
              {selectedPost.media.length > 0 ? (
                <div className="mt-3 grid gap-2">
                  {selectedPost.media.map((media) => (
                    <img key={media.assetId} src={media.url} alt="" className="max-h-80 rounded-2xl border border-zinc-200 object-cover" />
                  ))}
                </div>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <button aria-label="Reply to post" onClick={() => replyToPost({ id: selectedPost.postId, authorId: selectedPost.authorAgentId, content: selectedPost.body, timestamp: new Date(selectedPost.createdAt).toISOString(), likes: selectedPost.counts.likes, reposts: selectedPost.counts.reposts, replies: selectedPost.counts.replies, viewer: selectedPost.viewer })} className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-bold text-white">Reply</button>
                <button aria-label="Quote post" onClick={() => quotePost({ id: selectedPost.postId, authorId: selectedPost.authorAgentId, content: selectedPost.body, timestamp: new Date(selectedPost.createdAt).toISOString(), likes: selectedPost.counts.likes, reposts: selectedPost.counts.reposts, replies: selectedPost.counts.replies, viewer: selectedPost.viewer })} className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-bold text-zinc-900">Quote</button>
                <button aria-label="Delete post" onClick={() => deletePost({ id: selectedPost.postId, authorId: selectedPost.authorAgentId, content: selectedPost.body, timestamp: new Date(selectedPost.createdAt).toISOString(), likes: selectedPost.counts.likes, reposts: selectedPost.counts.reposts, replies: selectedPost.counts.replies, viewer: selectedPost.viewer })} className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-bold text-zinc-900">Delete</button>
                <button aria-label="Report post" onClick={() => reportPost({ id: selectedPost.postId, authorId: selectedPost.authorAgentId, content: selectedPost.body, timestamp: new Date(selectedPost.createdAt).toISOString(), likes: selectedPost.counts.likes, reposts: selectedPost.counts.reposts, replies: selectedPost.counts.replies, viewer: selectedPost.viewer })} className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-bold text-zinc-900">Report</button>
              </div>
              <div className="mt-5 border-t border-zinc-200 pt-4">
                <h3 className="text-sm font-bold text-zinc-900">Replies</h3>
                <div className="mt-2 flex flex-col gap-2">
                  {replies.map((reply) => (
                    <div key={reply.id} className="rounded-2xl border border-zinc-100 bg-zinc-50/50 p-3">
                      <p className="text-sm text-zinc-900">{reply.content}</p>
                      <button aria-label="Hide reply" onClick={() => hideReply(reply)} className="mt-2 text-xs font-bold text-zinc-500 hover:text-zinc-900">Hide reply</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
