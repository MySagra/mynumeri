// Unified in-memory store for display configuration.
// Persists to data/display-config.json; the in-memory cache makes reads instant.

import fs from "fs";
import path from "path";

export interface DisplayConfig {
    announcement: string;
    displayZoom: number;
}

type Subscriber = (text: string) => void;
type ConfigSubscriber = (config: DisplayConfig) => void;

const CONFIG_PATH = path.join(process.cwd(), "data", "display-config.json");

const DEFAULT_CONFIG: DisplayConfig = {
    announcement: "",
    displayZoom: 100,
};

// In-memory cache — populated lazily on first read/write
let cache: DisplayConfig = { ...DEFAULT_CONFIG };
let loaded = false;

function loadFromFile(): void {
    if (loaded) return;
    loaded = true;
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
            const parsed = JSON.parse(raw) as Partial<DisplayConfig> & {
                eventName?: string;
                displayMode?: string;
                fullscreenAlertEnabled?: boolean;
                autoScrollPagesEnabled?: boolean;
                stationsEnabled?: boolean;
                numberDisplay?: string;
                ticketNumberMax?: number;
            };
            // Discard retired preferences from older config files.
            // eventName now comes from the backend settings (sagra.name);
            // displayMode/fullscreenAlertEnabled/autoScrollPagesEnabled from the selected backend display.
            const {
                eventName: _name, displayMode: _mode, fullscreenAlertEnabled: _alert, autoScrollPagesEnabled: _scroll,
                stationsEnabled: _stations, numberDisplay: _display, ticketNumberMax: _max, ...current
            } = parsed;
            void _name; void _mode; void _alert; void _scroll; void _stations; void _display; void _max;
            cache = { ...DEFAULT_CONFIG, ...current };
        }
    } catch {
        // Missing or corrupt file — keep defaults
    }
}

function saveToFile(): void {
    try {
        fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(cache, null, 2), "utf-8");
    } catch (err) {
        console.error("[display-config] Failed to persist config:", err);
    }
}

// SSE subscribers — notified when the announcement text changes
const announcementSubscribers = new Set<Subscriber>();
// SSE subscribers — notified when display preferences change
const configSubscribers = new Set<ConfigSubscriber>();

export function getConfig(): DisplayConfig {
    loadFromFile();
    return { ...cache };
}

export function updateConfig(patch: Partial<DisplayConfig>): DisplayConfig {
    loadFromFile();
    const prevAnnouncement = cache.announcement;
    cache = { ...cache, ...patch };
    saveToFile();

    if (patch.announcement !== undefined && patch.announcement !== prevAnnouncement) {
        announcementSubscribers.forEach((fn) => {
            try { fn(cache.announcement); } catch { /* subscriber gone */ }
        });
    }

    if (patch.displayZoom !== undefined) {
        configSubscribers.forEach((fn) => {
            try { fn({ ...cache }); } catch { /* subscriber gone */ }
        });
    }

    return { ...cache };
}

// --- Backward-compat helpers used by /api/announcement ---

export function getAnnouncement(): string {
    loadFromFile();
    return cache.announcement;
}

export function setAnnouncement(text: string): void {
    updateConfig({ announcement: text });
}

export function subscribe(fn: Subscriber): () => void {
    announcementSubscribers.add(fn);
    return () => announcementSubscribers.delete(fn);
}

export function subscribeConfig(fn: ConfigSubscriber): () => void {
    loadFromFile();
    fn({ ...cache });
    configSubscribers.add(fn);
    return () => configSubscribers.delete(fn);
}
