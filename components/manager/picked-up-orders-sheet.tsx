"use client";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import OrdersGrid from "@/components/manager/orders-grid";
import { useTranslation } from "react-i18next";

interface PickedUpOrdersSheetProps {
    pickedUpOrders: Order[];
    onPrev?: (order: Order) => void;
}

export function PickedUpOrdersSheet({ pickedUpOrders, onPrev }: PickedUpOrdersSheetProps) {
    const { t } = useTranslation();
    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button variant="outline">{t("manager.pickedUpOrders")}</Button>
            </SheetTrigger>
            <SheetContent className="w-[90vw] sm:max-w-sm">
                <SheetHeader>
                    <SheetTitle className="text-2xl font-bold">{t("manager.pickedUpOrders")}</SheetTitle>
                    <SheetDescription>{t("manager.pickedUpOrdersDesc")}</SheetDescription>
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
