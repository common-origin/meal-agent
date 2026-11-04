/**
 * Shared shapes for the extension. ExtensionListItem and ExtensionListResponse
 * mirror apps/web/src/lib/coles/extensionList.ts; keep the two in step.
 */

export interface RememberedProduct {
  productId: string;
  name: string;
  url: string | null;
  packSize: number | null;
  packUnit: string | null;
  lastPrice: number | null;
  timesBought: number;
}

export interface ExtensionListItem {
  key: string;
  name: string;
  category: string;
  shoppingLabel: string;
  buyQty?: number;
  amount: number;
  amountUnit: string;
  product: RememberedProduct | null;
  packs: number;
}

export interface ExtensionListResponse {
  weekStart: string;
  items: ExtensionListItem[];
}

export interface Settings {
  appUrl: string;
  token: string;
}

/** The list line the user is finding a product for, so their next trolley add is remembered against it. */
export interface ActiveItem {
  key: string;
  name: string;
}

/** What the background worker learns from coles.com.au's own API calls. */
export interface ColesSession {
  headers: Record<string, string>;
  storeId: string;
}

export interface TrolleyAdd {
  productId: string;
  packs: number;
}

export interface TrolleyResult {
  productId: string;
  ok: boolean;
  error?: string;
}

export interface ProductInfo {
  name: string;
  url: string | null;
  price: number | null;
}

/** Messages to the content script. */
export type ContentMessage =
  | { type: 'addToTrolley'; session: ColesSession; adds: TrolleyAdd[] }
  | { type: 'productInfo'; productId: string }
  | { type: 'clickAdd'; packs: number };

/** Messages from the background worker to the side panel. */
export type PanelMessage =
  | { type: 'remembered'; key: string; product: ProductInfo & { productId: string } }
  | { type: 'rememberFailed'; key: string; error: string };

export const DEFAULT_APP_URL = 'https://meal-agent.vercel.app';
export const COLES_ORIGIN = 'https://www.coles.com.au';
