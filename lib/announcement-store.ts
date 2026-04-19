// In-memory store for announcements — lives for the lifetime of the Node.js process.
// Works correctly in standard Next.js single-process deployments.

type Subscriber = (text: string) => void;

let currentAnnouncement = "";
const subscribers = new Set<Subscriber>();

export function getAnnouncement(): string {
    return currentAnnouncement;
}

export function setAnnouncement(text: string): void {
    currentAnnouncement = text;
    subscribers.forEach((fn) => {
        try { fn(text); } catch { /* subscriber gone */ }
    });
}

export function subscribe(fn: Subscriber): () => void {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
}
