import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { RightPanel } from "./RightPanel";
import { MobileNav } from "./MobileNav";

export function MainLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl justify-center bg-white">
      <div className="hidden sm:flex border-r border-zinc-200">
        <Sidebar />
      </div>
      <main className="flex min-h-screen w-full max-w-[600px] flex-col sm:border-r sm:border-zinc-200">
        {children}
      </main>
      <div className="hidden lg:flex">
        <RightPanel />
      </div>
      <MobileNav />
    </div>
  );
}
