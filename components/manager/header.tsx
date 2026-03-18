"use client";

import { Settings, FileText, Monitor, LogOut } from "lucide-react";
import { Button } from "../ui/button";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Textarea } from "@/components/ui/textarea";
import { ThemeToggle } from "@/components/theme-toggle";
import { signOut } from "next-auth/react";
import { logout as logoutAction } from "@/actions/auth";
import { toast } from "sonner";
import { ButtonGroup } from "../ui/button-group";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export function Header() {
    const router = useRouter();

    const [noticeText, setNoticeText] = useState("");

    useEffect(() => {
        const stored = localStorage.getItem("display-announcement");
        if (stored) setNoticeText(stored);
    }, []);

    const saveAnnouncement = async () => {
        localStorage.setItem("display-announcement", noticeText);
        try {
            await fetch("/api/announcement", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ announcement: noticeText }),
            });
            toast.success("Avviso salvato e inviato al display");
        } catch {
            toast.error("Errore durante il salvataggio dell'avviso");
        }
    };

    const handleLogout = async () => {
        try {
            // Call backend logout to revoke refresh token
            await logoutAction();

            // Then sign out from NextAuth
            await signOut({ redirect: true, callbackUrl: "/" });

            toast.success("Logout effettuato con successo");
        } catch (error) {
            console.error("Logout error:", error);
            // Still try to sign out even if backend logout fails
            await signOut({ redirect: true, callbackUrl: "/" });
        }
    };

    return (
        <header className="border-b fixed top-0 z-10 flex h-16 w-full items-center justify-between bg-card px-4 shadow-sm">
            <div className="flex items-center gap-3">
                <img
                    src="/logo.svg"
                    alt="Logo"
                    className="mx-auto h-10 w-auto select-none"
                />
                <h1 className="text-2xl font-bold select-none">MyNumeri</h1>
            </div>
            <div className="absolute top-4 right-4 flex items-center gap-2">
                <ButtonGroup>
                    <Button variant="outline" size="icon" onClick={() => router.push("/settings")}>
                        <Settings className="h-4 w-4" />
                    </Button>
                    <ThemeToggle />
                </ButtonGroup>
                <Drawer>
                    <DrawerTrigger asChild>
                        <Button variant="outline">
                            <FileText className="mr-2 h-4 w-4" />
                            Avvisi Display
                        </Button>
                    </DrawerTrigger>
                    <DrawerContent>
                        <div className="mx-auto w-full max-w-2xl">
                            <DrawerHeader>
                                <DrawerTitle className="flex items-center gap-2">
                                    <FileText className="h-5 w-5" />
                                    Avvisi Display
                                </DrawerTitle>
                                <DrawerDescription className="flex items-center gap-2">
                                    Gli avvisi verranno mostrati infondo alla pagina del display
                                </DrawerDescription>
                            </DrawerHeader>
                            <Textarea
                                id="notes-textarea"
                                className="w-full min-h-[200px] px-3 py-2 text-sm border rounded-md resize-none"
                                placeholder="Es: Promozione del giorno, orari speciali, avvisi..."
                                value={noticeText}
                                onChange={(e) => setNoticeText(e.target.value)}
                            />
                            <DrawerFooter>
                                <div className="flex items-center gap-2 place-content-end">
                                    <DrawerClose asChild>
                                        <Button onClick={saveAnnouncement}>Salva Avvisi</Button>
                                    </DrawerClose>
                                    <DrawerClose asChild>
                                        <Button variant="outline">Annulla</Button>
                                    </DrawerClose>
                                </div>
                            </DrawerFooter>
                        </div>
                    </DrawerContent>
                </Drawer>
                <Button variant="outline" className="bg-primary hover:bg-primary/80">
                    <a href="/display" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                        <Monitor className="h-4 w-4" />
                        Apri Display
                    </a>
                </Button>
                <Button variant="outline" onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                </Button>
            </div>
        </header>
    );
}