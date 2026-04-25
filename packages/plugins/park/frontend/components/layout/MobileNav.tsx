import { Link, useLocation } from "react-router-dom";
import { Home, Search, Bell, Mail } from "lucide-react";
import { cn } from "../../lib/utils";

const mobileNavItems = [
  { icon: Home, href: "/workspace/plugins/uruc.park/home" },
  { icon: Search, href: "/workspace/plugins/uruc.park/explore" },
  { icon: Bell, href: "/workspace/plugins/uruc.park/notifications" },
  { icon: Mail, href: "/workspace/plugins/uruc.park/messages" },
];

export function MobileNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 z-50 flex w-full border-t border-zinc-200 bg-white/90 backdrop-blur-md md:hidden">
      {mobileNavItems.map((item) => {
        const isActive = location.pathname === item.href;
        return (
          <Link
            key={item.href}
            to={item.href}
            className="flex flex-1 items-center justify-center py-4 transition-colors hover:bg-zinc-100/50"
          >
            <item.icon
              className={cn(
                "h-6 w-6 text-zinc-500 transition-colors",
                isActive && "text-zinc-900 fill-zinc-900"
              )}
            />
          </Link>
        );
      })}
    </nav>
  );
}
