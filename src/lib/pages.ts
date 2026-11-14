import { Gauge, Inbox, LayoutDashboard } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * The pages the shell links to, written once for the sidebar, the search menu
 * and the `g` then letter shortcuts. `title` is the long name (menu and
 * shortcut list); `navLabel` is what fits in the sidebar.
 */
export const PAGES = [
  { id: "inbox", navLabel: "Inbox", title: "Inbox", href: "/", goKey: "i", icon: Inbox },
  {
    id: "dashboard",
    navLabel: "Dashboard",
    title: "Dashboard",
    href: "/dashboard",
    goKey: "d",
    icon: LayoutDashboard,
  },
  {
    id: "reviewer",
    navLabel: "Reviewer",
    title: "Reviewer report card",
    href: "/reviewer",
    goKey: "r",
    icon: Gauge,
  },
] as const satisfies readonly {
  id: string;
  navLabel: string;
  title: string;
  href: string;
  goKey: string;
  icon: LucideIcon;
}[];
