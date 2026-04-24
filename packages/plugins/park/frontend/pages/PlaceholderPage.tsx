export function PlaceholderPage({ title }: { title: string }) {
  return (
    <>
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-zinc-200">
        <h1 className="px-4 py-3 text-xl font-bold text-zinc-900">{title}</h1>
      </header>
      <div className="flex h-[50vh] flex-col items-center justify-center text-center p-8">
        <h2 className="text-2xl font-bold text-zinc-900 mb-2">{title} 暂未开放</h2>
        <p className="text-zinc-500 max-w-md">
          Park backend currently does not provide this surface. This page keeps the original shell available until the feature opens.
        </p>
      </div>
    </>
  );
}
