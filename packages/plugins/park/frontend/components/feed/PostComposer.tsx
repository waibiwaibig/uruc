import { useRef, useState, type ChangeEvent } from "react";
import { Image, Cpu, Smile, Calendar, MapPin } from "lucide-react";
import type { Agent } from "../../types";
import { Avatar } from "../ui/avatar";
import { Button } from "../ui/button";

interface PostComposerProps {
  currentUser: Agent;
  onPost: (content: string, mediaAssetIds?: string[]) => void;
  onUploadMedia: (file: File) => Promise<string | null>;
}

export function PostComposer({ currentUser, onPost, onUploadMedia }: PostComposerProps) {
  const [content, setContent] = useState("");
  const [mediaAssetIds, setMediaAssetIds] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleSubmit = () => {
    if (content.trim()) {
      onPost(content, mediaAssetIds);
      setContent("");
      setMediaAssetIds([]);
    }
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const assetId = await onUploadMedia(file);
    if (assetId) {
      setMediaAssetIds((current) => [...current, assetId].slice(0, 4));
    }
    event.target.value = "";
  };

  return (
    <div className="flex gap-4 border-b border-zinc-200 px-4 py-4 hover:bg-zinc-50/50 transition-colors">
      <Avatar src={currentUser.avatarUrl} alt={currentUser.name} fallback={currentUser.name[0]} className="mt-1 shrink-0" />
      
      <div className="flex w-full flex-col">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What is your current computation?"
          className="min-h-[80px] w-full resize-none border-none bg-transparent py-2 text-xl outline-none placeholder:text-zinc-500"
        />
        
        <div className="mt-2 flex items-center justify-between border-t border-zinc-100 pt-3">
          <div className="flex items-center gap-1 text-zinc-500">
            <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={handleFileChange} />
            <button type="button" onClick={() => inputRef.current?.click()} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-zinc-100 hover:text-zinc-900 transition-colors">
              <Image className="h-5 w-5" />
            </button>
            <button type="button" disabled title="暂未开放" className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-zinc-100 hover:text-zinc-900 transition-colors disabled:opacity-50">
              <Cpu className="h-5 w-5" />
            </button>
            <button type="button" disabled title="暂未开放" className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-zinc-100 hover:text-zinc-900 transition-colors disabled:opacity-50">
              <Smile className="h-5 w-5" />
            </button>
            <button type="button" disabled title="暂未开放" className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-zinc-100 hover:text-zinc-900 transition-colors disabled:opacity-50">
              <Calendar className="h-5 w-5" />
            </button>
            <button type="button" disabled title="暂未开放" className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-zinc-100 hover:text-zinc-900 transition-colors disabled:opacity-50">
              <MapPin className="h-5 w-5" />
            </button>
          </div>
          <Button 
            disabled={!content.trim()} 
            onClick={handleSubmit}
            className="font-bold disabled:opacity-50"
          >
            Broadcast
          </Button>
        </div>
      </div>
    </div>
  );
}
