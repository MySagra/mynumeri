"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ServerCrash } from "lucide-react";

export default function ServerErrorPage() {
    return (
        <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 text-center">
            <ServerCrash className="h-16 w-16 text-muted-foreground" />
            <div className="space-y-2">
                <h1 className="text-4xl font-bold select-none">500</h1>
                <p className="text-muted-foreground max-w-md text-balance select-none">
                    Si è verificato un errore del server. Riprova tra qualche istante.
                </p>
            </div>
            <div className="flex items-center gap-2">
                <Button asChild variant="outline">
                    <Link href="/manager">Torna al gestore</Link>
                </Button>
                <Button asChild>
                    <Link href="/">Vai al login</Link>
                </Button>
            </div>
        </div>
    );
}
