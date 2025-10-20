import { Router, Request, Response } from "express";

type CartItem = { id: string; title: string; price: number; imageUrl?: string; quantity: number };
type Cart = { items: CartItem[] };

// In-memory store for demo; replace with DB/Redis in production
const carts = new Map<string, Cart>();

function getUserId(req: Request): string {
  const userId = (req.header("x-user-id") || req.query["userId"]) as string | undefined;
  if (!userId) {
    throw new Error("Missing user id");
  }
  return userId;
}

function ensureCart(userId: string): Cart {
  if (!carts.has(userId)) carts.set(userId, { items: [] });
  return carts.get(userId)!;
}

export const cartRouter = Router();

cartRouter.get("/", (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const cart = ensureCart(userId);
    res.json(cart);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

cartRouter.post("/items", (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id, title, price, imageUrl, quantity = 1 } = req.body as Partial<CartItem>;
    if (!id || !title || typeof price !== "number") {
      return res.status(400).json({ error: "id, title, price required" });
    }
    const cart = ensureCart(userId);
    const existing = cart.items.find((i) => i.id === id);
    if (existing) existing.quantity += quantity!; else cart.items.push({ id, title, price, imageUrl, quantity: quantity! });
    res.status(201).json(cart);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

cartRouter.patch("/items/:id", (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const { quantity } = req.body as { quantity?: number };
    if (typeof quantity !== "number") return res.status(400).json({ error: "quantity required" });
    const cart = ensureCart(userId);
    const item = cart.items.find((i) => i.id === id);
    if (!item) return res.status(404).json({ error: "item not found" });
    item.quantity = Math.max(1, quantity);
    res.json(cart);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

cartRouter.delete("/items/:id", (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const cart = ensureCart(userId);
    cart.items = cart.items.filter((i) => i.id !== id);
    res.json(cart);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

cartRouter.delete("/", (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const cart = ensureCart(userId);
    cart.items = [];
    res.json(cart);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default cartRouter;


