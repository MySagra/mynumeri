"use client"

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { ButtonGroup } from "@/components/ui/button-group";
import { cn } from "@/lib/utils";
import { FileText, Settings, Monitor, LogOut, Undo2, CheckCircle } from "lucide-react";
import Head from "next/head";
import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Header } from "@/app/manager/_components/header";
import { set } from "zod";

export default function Manager() {
    const [confirmedOrders, setConfirmedOrders] = useState<Order[]>([{ id: '1', ticketNumber: 123, displayCode: 'A1' }]);
    const [readyOrders, setReadyOrders] = useState<Order[]>([]);
    const [pickedUpOrders, setPickedUpOrders] = useState<Order[]>([]);


    return (
        <>

            <Header />

            <main className="h-screen w-full grid grid-cols-3 gap-4 p-3">
                <OrdersGrid
                    className="col-span-2"
                    orders={confirmedOrders}
                    title="Ordini in preparazione"
                    actualSetter={setConfirmedOrders}
                    nextSetter={setReadyOrders} />
                <OrdersGrid
                    className="col-span-1"
                    orders={readyOrders}
                    title="Ordini pronti"
                    prevSetter={setConfirmedOrders}
                    actualSetter={setReadyOrders}
                    nextSetter={setPickedUpOrders}
                >
                    <Sheet>
                        <SheetTrigger asChild>
                            <Button variant="outline">Ordini ritirati</Button>
                        </SheetTrigger>
                        <SheetContent>
                            <SheetHeader>
                                <SheetTitle className="text-2xl font-bold">Ordini ritirati</SheetTitle>
                            </SheetHeader>
                            <OrdersGrid
                                className="rounded-none shadow-none outline-0"
                                orders={pickedUpOrders}
                                prevSetter={setReadyOrders}
                                actualSetter={setPickedUpOrders}
                            ></OrdersGrid>
                        </SheetContent>
                    </Sheet>
                </OrdersGrid>
            </main>
        </>
    )
}

interface OrdersGridProps {
    className?: string;
    orders: Order[];
    title?: string;
    children?: React.ReactNode;
    prevSetter?: React.Dispatch<React.SetStateAction<Order[]>>;
    actualSetter: React.Dispatch<React.SetStateAction<Order[]>>;
    nextSetter?: React.Dispatch<React.SetStateAction<Order[]>>;
}

function OrdersGrid({ className, orders, title, prevSetter, actualSetter, nextSetter, children }: OrdersGridProps) {
    return (
        <div className={cn("h-full w-full rounded-xl outline-2 outline-secondary shadow-lg p-4", className)}>
            {
                title || children ?
                    <div className="flex place-content-between items-center">
                        {
                            title ? <h2 className="text-2xl font-bold mb-4">{title}</h2> : <></>
                        }
                        {children}
                    </div>
                    :
                    <></>
            }
            {
                orders.map((order) => (
                    <OrderCard key={order.id} order={order} prevSetter={prevSetter} actualSetter={actualSetter} nextSetter={nextSetter} />
                ))
            }
        </div>
    )
}

interface OrderCardProps {
    order: Order;
    prevSetter?: React.Dispatch<React.SetStateAction<Order[]>>;
    actualSetter: React.Dispatch<React.SetStateAction<Order[]>>;
    nextSetter?: React.Dispatch<React.SetStateAction<Order[]>>;
}

function OrderCard({ order, prevSetter, actualSetter, nextSetter }: OrderCardProps) {
    function addNext() {
        actualSetter((prev) => prev.filter((o) => o.id !== order.id));
        if (nextSetter) {
            nextSetter((prev) => [...prev, order]);
        }
    }

    function undoPrev() {
        actualSetter((prev) => prev.filter((o) => o.id !== order.id));
        if (prevSetter) {
            prevSetter((prev) => [...prev, order]);
        }
    }

    if (prevSetter) {
        return (
            <ButtonGroup className="text-3xl font-bold">
                <Button
                    variant="outline"
                    className="h-15 text-3xl font-bold hover:bg-red-500 transition-colors"
                    onClick={undoPrev}
                >
                    <Undo2 className="h-7 w-7" />
                </Button>
                <Button
                    variant="outline"
                    onClick={addNext}
                    className="h-15 text-3xl font-bold bg-green-500 hover:bg-green-600 transition-colors"
                >
                    {order.ticketNumber}
                    <CheckCircle className="h-8 w-8" />
                </Button>
            </ButtonGroup>
        )
    }
    return (
        <div>
            <Button
                key={order.id}
                variant="outline"
                size="lg"
                onClick={addNext}
                className="h-15 text-3xl font-bold hover:bg-primary hover:text-primary-foreground transition-colors"
            >
                {order.ticketNumber}
            </Button>
        </div>
    )
}
