// In-memory pub/sub for order status updates — notifies all connected manager clients.

type OrderUpdate = { id: string; status: string; [key: string]: unknown };
type Subscriber = (update: OrderUpdate) => void;

const subscribers = new Set<Subscriber>();

export function emitOrderUpdate(update: OrderUpdate): void {
    subscribers.forEach((fn) => {
        try { fn(update); } catch { /* subscriber gone */ }
    });
}

export function subscribe(fn: Subscriber): () => void {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
}
