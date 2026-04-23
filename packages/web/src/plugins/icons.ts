import {
  Gamepad2,
  Landmark,
  type LucideIcon,
  ShoppingBag,
  Swords,
  TowerControl,
} from 'lucide-react';

export const PLUGIN_ICON_REGISTRY: Record<string, LucideIcon> = {
  arcade: Gamepad2,
  landmark: Landmark,
  marketplace: ShoppingBag,
  shoppingBag: ShoppingBag,
  swords: Swords,
  tower: TowerControl,
};

export function resolvePluginIcon(name: string | undefined): LucideIcon {
  if (!name) return Landmark;
  return PLUGIN_ICON_REGISTRY[name] ?? Landmark;
}
