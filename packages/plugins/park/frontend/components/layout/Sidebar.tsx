import { Link, useLocation } from "react-router-dom";
import { motion } from "motion/react";
import { 
  Home, 
  Search, 
  Bell, 
  Mail, 
  User, 
  Settings, 
  Hexagon,
  MoreHorizontal
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useParkView } from "../../context";
import { Avatar } from "../ui/avatar";

const navItems = [
  { icon: Home, label: "Home", href: "/workspace/plugins/uruc.park/home" },
  { icon: Search, label: "Explore", href: "/workspace/plugins/uruc.park/explore" },
  { icon: Bell, label: "Notifications", href: "/workspace/plugins/uruc.park/notifications" },
  { icon: Mail, label: "Messages", href: "/workspace/plugins/uruc.park/messages" },
  { icon: User, label: "Profile", href: "/workspace/plugins/uruc.park/profile" },
  { icon: Settings, label: "Settings", href: "/workspace/plugins/uruc.park/settings" },
];

export function Sidebar() {
  const location = useLocation();
  const { currentUser } = useParkView();

  return (
    <header className="sticky top-0 flex h-screen w-20 flex-col items-center bg-white py-6 md:w-64 md:items-start md:px-4">
      <Link to="/workspace/plugins/uruc.park/home" className="mb-8 flex items-center justify-center rounded-full p-2 hover:bg-zinc-100 md:w-fit md:px-3 md:justify-start">
        <motion.div
          whileHover={{ rotate: 90 }}
          transition={{ type: "spring", stiffness: 200, damping: 10 }}
        >
          <Hexagon className="h-8 w-8 text-zinc-900" />
        </motion.div>
        <span className="ml-3 hidden text-2xl font-black tracking-tight text-zinc-900 md:block">park</span>
        <span className="sr-only">uruc park</span>
      </Link>

      <nav className="flex w-full flex-col gap-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.label}
              to={item.href}
              className={cn(
                "group flex w-full items-center justify-center rounded-full p-3 transition-colors hover:bg-zinc-100 md:justify-start",
                isActive && "font-bold"
              )}
            >
              <item.icon
                className={cn(
                  "h-6 w-6 shrink-0 text-zinc-900 transition-transform group-hover:scale-110",
                  isActive && "fill-zinc-900"
                )}
              />
              <span className="ml-4 hidden text-lg text-zinc-900 md:block">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <Link to="/workspace/plugins/uruc.park/home" className="mt-8 hidden w-full rounded-full bg-zinc-900 py-3.5 text-center text-base font-bold text-white transition-colors hover:bg-zinc-800 md:block">
        Broadcast
      </Link>

      <div className="mt-auto flex w-full items-center justify-center rounded-full p-2 transition-colors hover:bg-zinc-100 md:justify-between cursor-pointer">
        <div className="flex items-center gap-3">
          <Avatar src={currentUser.avatarUrl} alt={currentUser.name} fallback={currentUser.name[0]} />
          <div className="hidden flex-col md:flex">
            <span className="text-sm font-bold leading-tight text-zinc-900">{currentUser.name}</span>
            <span className="text-sm text-zinc-500 leading-tight">@{currentUser.handle}</span>
          </div>
        </div>
        <MoreHorizontal className="hidden h-5 w-5 text-zinc-900 md:block" />
      </div>
    </header>
  );
}
