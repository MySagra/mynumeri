"use client";

import { Settings, FileText, Monitor, Maximize, Minimize, Sun, Moon } from "lucide-react";
import { Button } from "../ui/button";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Textarea } from "@/components/ui/textarea";
import { useTheme } from "@teispace/next-themes";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useMounted } from "@/hooks/use-mounted";
import { useSagraSettings } from "@/lib/sagra-settings";
import { cn } from "@/lib/utils";
import { logout as logoutAction } from "@/actions/auth";
import { useAuth, USER_STORAGE_KEY } from "@/hooks/use-auth";
import { toast } from "sonner";
import { ButtonGroup } from "../ui/button-group";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { UserMenu } from "@/components/manager/UserMenu";
import { PickedUpOrdersSheet } from "@/components/manager/picked-up-orders-sheet";
import { useTranslation } from "react-i18next";
import { subscribeSSE } from "@/lib/sse";
import { HeaderClock } from "@/components/header-clock";

/** Stile dei "chip" informativi dell'header: stessa altezza e raggio dei pulsanti. */
const headerChipClass =
    "inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium select-none whitespace-nowrap";

interface HeaderProps {
    pickedUpOrders?: Order[];
    onPickupPrev?: (order: Order) => void;
    /** Monitor scelto su questo dispositivo. */
    display?: { id: string; name: string } | null;
    onChangeDisplay?: () => void;
}

export function Header({ pickedUpOrders, onPickupPrev, display, onChangeDisplay }: HeaderProps = {}) {
    const router = useRouter();
    const { user } = useAuth();
    const { t } = useTranslation();
    const { theme, setTheme } = useTheme();
    const mounted = useMounted();
    const sagraName = useSagraSettings()?.sagraName;

    const [noticeText, setNoticeText] = useState("");
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [avvisiOpen, setAvvisiOpen] = useState(false);

    useEffect(() => {
        fetch("/api/display-config")
            .then((res) => res.ok ? res.json() : null)
            .then((cfg) => {
                if (cfg?.announcement !== undefined) {
                    setNoticeText(cfg.announcement);
                } else {
                    const stored = localStorage.getItem("display-announcement");
                    if (stored) setNoticeText(stored);
                }
            })
            .catch(() => {
                const stored = localStorage.getItem("display-announcement");
                if (stored) setNoticeText(stored);
            });
    }, []);

    useEffect(() => {
        const close = subscribeSSE("/api/announcement/events", {
            onMessage: (data) => {
                const { announcement: text } = (data ?? {}) as { announcement?: string };
                if (typeof text !== "string") return;
                setAvvisiOpen(open => {
                    if (!open) setNoticeText(text);
                    return open;
                });
            },
            onError: err => console.error("SSE announcement:", err),
        });
        return () => close();
    }, []);

    useEffect(() => {
        const onChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener("fullscreenchange", onChange);
        return () => document.removeEventListener("fullscreenchange", onChange);
    }, []);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    };

    const saveAnnouncement = async () => {
        try {
            await fetch("/api/display-config", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ announcement: noticeText }),
            });
            toast.success(t("manager.noticeSaved"));
        } catch {
            toast.error(t("manager.noticeSaveError"));
        }
    };

    const handleLogout = async () => {
        try {
            await logoutAction();
            toast.success(t("manager.logoutSuccess"));
        } catch (error) {
            console.error("Logout error:", error);
        } finally {
            localStorage.removeItem(USER_STORAGE_KEY);
            window.location.href = "/";
        }
    };

    const themeLabel = theme === "dark" ? t("userMenu.lightTheme") : t("userMenu.darkTheme");
    const fullscreenLabel = isFullscreen ? t("header.exitFullscreen") : t("header.fullscreen");

    return (
        <header className="fixed top-0 z-50 w-full border-b bg-card">
            <div className="flex h-16 items-center justify-between gap-3 px-4 md:px-6">
                {/* Left: logo + title (with sagra name) | clock */}
                <div className="flex min-w-0 items-center gap-3">
                    <img
                        src="/logo.svg"
                        alt="Logo"
                        className="h-10 w-auto shrink-0 select-none"
                    />
                    <div className="hidden shrink-0 flex-col leading-tight md:flex">
                        <h1 className="whitespace-nowrap text-2xl font-bold select-none">MyNumeri</h1>
                        {sagraName && (
                            <span className="max-w-40 truncate text-xs text-muted-foreground select-none lg:max-w-64" title={sagraName}>
                                {sagraName}
                            </span>
                        )}
                    </div>
                    {/* Orologio solo su schermi larghi: sotto xl lo spazio serve alle azioni */}
                    <div className="mx-2 hidden h-8 w-px bg-border xl:block" aria-hidden />
                    <HeaderClock className="hidden xl:inline" />
                </div>

                {/* Right: monitor chip | actions | icon group | user */}
                <div className="flex shrink-0 items-center gap-2">
                    {display && onChangeDisplay && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    type="button"
                                    onClick={onChangeDisplay}
                                    className={cn(headerChipClass, "hidden max-w-56 cursor-pointer bg-muted/50 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:inline-flex")}
                                >
                                    <Monitor className="h-4 w-4 shrink-0" />
                                    <span className="truncate">{display.name}</span>
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>{t("displays.change")}</TooltipContent>
                        </Tooltip>
                    )}

                    {display && onChangeDisplay && (
                        <div className="mx-1 hidden h-6 w-px bg-border lg:block" aria-hidden />
                    )}

                    {pickedUpOrders !== undefined && (
                        <div className="md:hidden">
                            <PickedUpOrdersSheet pickedUpOrders={pickedUpOrders} onPrev={onPickupPrev} />
                        </div>
                    )}
                    <Drawer open={avvisiOpen} onOpenChange={setAvvisiOpen}>
                        <DrawerTrigger asChild>
                            <Button
                                variant="outline"
                                className="hidden cursor-pointer md:flex"
                                title={t("manager.displayNotices")}
                                aria-label={t("manager.displayNotices")}
                            >
                                <FileText className="h-4 w-4" />
                                {/* Solo icona sotto lg */}
                                <span className="hidden lg:inline">{t("manager.displayNotices")}</span>
                            </Button>
                        </DrawerTrigger>
                        <DrawerContent>
                            <div className="mx-auto w-full max-w-2xl px-4 md:px-6">
                                <DrawerHeader>
                                    <DrawerTitle className="flex items-center gap-2">
                                        <FileText className="h-5 w-5" />
                                        {t("manager.displayNotices")}
                                    </DrawerTitle>
                                    <DrawerDescription className="flex items-center gap-2 text-left">
                                        {t("manager.displayNoticesDesc")}
                                    </DrawerDescription>
                                </DrawerHeader>
                                <div className="mx-4">
                                    <Textarea
                                        id="notes-textarea"
                                        className="w-full min-h-[200px] px-3 py-2 text-sm border rounded-md resize-none"
                                        placeholder={t("manager.noticesPlaceholder")}
                                        value={noticeText}
                                        maxLength={500}
                                        onChange={(e) => setNoticeText(e.target.value)}
                                    />
                                    <p className={`text-xs mt-1 text-right ${noticeText.length >= 450 ? "text-destructive" : "text-muted-foreground"}`}>
                                        {noticeText.length} / 500
                                    </p>
                                </div>
                                <DrawerFooter>
                                    <div className="flex items-center gap-2 justify-between">
                                        <Button variant="destructive" onClick={() => setNoticeText("")}>
                                            {t("manager.empty")}
                                        </Button>
                                        <div className="flex items-center gap-2">
                                            <DrawerClose asChild>
                                                <Button variant="outline">{t("manager.cancel")}</Button>
                                            </DrawerClose>
                                            <DrawerClose asChild>
                                                <Button onClick={saveAnnouncement}>{t("manager.saveNotices")}</Button>
                                            </DrawerClose>
                                        </div>
                                    </div>
                                </DrawerFooter>
                            </div>
                        </DrawerContent>
                    </Drawer>
                    <Button asChild className="hidden md:flex">
                        <a href="/display" target="_blank" rel="noopener noreferrer" title={t("manager.openDisplay")} aria-label={t("manager.openDisplay")}>
                            <Monitor className="h-4 w-4" />
                            <span className="hidden lg:inline">{t("manager.openDisplay")}</span>
                        </a>
                    </Button>

                    <ButtonGroup className="hidden md:flex">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="outline" size="icon" className="cursor-pointer" onClick={() => router.push("/settings")} aria-label={t("userMenu.settings")}>
                                    <Settings className="h-5 w-5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t("userMenu.settings")}</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="cursor-pointer"
                                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                                    disabled={!mounted}
                                    aria-label={themeLabel}
                                >
                                    {mounted && theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>{themeLabel}</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="outline" size="icon" className="cursor-pointer" onClick={toggleFullscreen} aria-label={fullscreenLabel}>
                                    {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>{fullscreenLabel}</TooltipContent>
                        </Tooltip>
                    </ButtonGroup>

                    {user && (
                        <UserMenu user={user} onLogout={handleLogout} onOpenAvvisi={() => setAvvisiOpen(true)} onChangeDisplay={onChangeDisplay} displayName={display?.name} />
                    )}
                </div>
            </div>
        </header>
    );
}
