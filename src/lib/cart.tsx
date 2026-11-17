import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// O carrinho vive no browser só para mostrar. Os preços finais são sempre
// recalculados na base de dados quando a encomenda é feita.
export type CartItem = {
  key: string;
  id: string;
  slug: string;
  title: string;
  price: number;
  image: string;
  size?: string | undefined;
  color?: string | undefined;
  qty: number;
};

type Ctx = {
  items: CartItem[];
  add: (item: Omit<CartItem, "qty" | "key">) => void;
  remove: (key: string) => void;
  setQty: (key: string, qty: number) => void;
  clear: () => void;
  total: number;
  count: number;
  ready: boolean;
};

const CartContext = createContext<Ctx | null>(null);
const KEY = "pallessiani-cart";
export const MAX_QTY = 10;

const keyOf = (id: string, size?: string, color?: string) => `${id}:${size ?? ""}:${color ?? ""}`;
const clampQty = (n: number) => Math.min(MAX_QTY, Math.max(1, Math.floor(n) || 1));

function sanitize(raw: unknown): CartItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (i): i is CartItem =>
        !!i &&
        typeof i.id === "string" &&
        typeof i.slug === "string" &&
        typeof i.title === "string" &&
        Number.isFinite(i.price),
    )
    .slice(0, 20)
    .map((i) => ({
      ...i,
      image: typeof i.image === "string" ? i.image : "",
      size: typeof i.size === "string" ? i.size : undefined,
      color: typeof i.color === "string" ? i.color.slice(0, 30) : undefined,
      key: keyOf(
        i.id,
        typeof i.size === "string" ? i.size : undefined,
        typeof i.color === "string" ? i.color : undefined,
      ),
      qty: clampQty(i.qty),
    }));
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setItems(sanitize(JSON.parse(localStorage.getItem(KEY) || "[]")));
    } catch {
      // Carrinho guardado inválido: começa vazio.
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {
      // Sem armazenamento: o carrinho dura só esta visita.
    }
  }, [items, ready]);

  const value: Ctx = {
    items,
    ready,
    add: (item) =>
      setItems((prev) => {
        const key = keyOf(item.id, item.size, item.color);
        const found = prev.find((i) => i.key === key);
        if (found) return prev.map((i) => (i.key === key ? { ...i, qty: clampQty(i.qty + 1) } : i));
        return [...prev, { ...item, key, qty: 1 }].slice(0, 20);
      }),
    remove: (key) => setItems((prev) => prev.filter((i) => i.key !== key)),
    setQty: (key, qty) =>
      setItems((prev) => prev.map((i) => (i.key === key ? { ...i, qty: clampQty(qty) } : i))),
    clear: () => setItems([]),
    total: items.reduce((s, i) => s + i.price * i.qty, 0),
    count: items.reduce((s, i) => s + i.qty, 0),
  };
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const c = useContext(CartContext);
  if (!c) throw new Error("useCart must be used inside CartProvider");
  return c;
}

export const euro = (n: number) =>
  new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(n);
