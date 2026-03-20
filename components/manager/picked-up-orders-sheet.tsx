"use client";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import OrdersGrid from "@/components/manager/orders-grid";

interface PickedUpOrdersSheetProps {
    pickedUpOrders: Order[];
    onPrev?: (order: Order) => void;
}

export function PickedUpOrdersSheet({ pickedUpOrders, onPrev }: PickedUpOrdersSheetProps) {
    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button variant="outline">Ordini ritirati</Button>
            </SheetTrigger>
            <SheetContent className="w-[90vw] sm:max-w-sm">
                <SheetHeader>
                    <SheetTitle className="text-2xl font-bold">Ordini ritirati</SheetTitle>
                    <SheetDescription>Elenco degli ordini già ritirati dai clienti</SheetDescription>
                </SheetHeader>
                <OrdersGrid
                    status="PICKED_UP"
                    className="rounded-none bg-background shadow-none outline-0 h-[calc(100vh-8rem)] mt-4 px-4 pb-4"
                    orders={pickedUpOrders}
                    onPrev={onPrev}
                />
            </SheetContent>
        </Sheet>
    );
}
