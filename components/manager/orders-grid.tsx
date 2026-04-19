import { cn } from "@/lib/utils";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card"

interface OrdersGridProps {
    className?: string;
    orders: Order[];
    title?: string;
    children?: React.ReactNode;
    status?: Status;
    onPrev?: (order: Order) => void;
    onNext?: (order: Order) => void;
}

export default function OrdersGrid({ className, orders, title, status, onPrev, onNext, children }: OrdersGridProps) {
    return (
        <div className={cn("select-none h-full w-full rounded-xl outline-2 outline-secondary bg-card shadow-lg overflow-hidden flex flex-col", className)}>
            <div className="flex-1 overflow-y-auto px-4 pb-4">
                {
                    title || children ?
                        <div className="flex place-content-between items-center sticky top-0 bg-card z-10 pt-4 pb-2">
                            {
                                title ? <h2 className="select-none text-2xl font-bold">{title}</h2> : <></>
                            }
                            {children}
                        </div>
                        :
                        <></>
                }
                <div className="flex gap-3 flex-wrap items-start place-content-start">
                    {
                        orders.map((order) => (
                            <div key={order.id} className="min-w-max">
                                <OrderCard order={order} status={status} onPrev={onPrev} onNext={onNext} />
                            </div>
                        ))
                    }
                </div>
            </div>
        </div>
    )
}

interface OrderCardProps {
    order: Order;
    status?: Status;
    onPrev?: (order: Order) => void;
    onNext?: (order: Order) => void;
}

function OrderCard({ order, status, onPrev, onNext }: OrderCardProps) {
    function addNext() {
        if (onNext) {
            onNext(order);
        }
    }

    function undoPrev() {
        if (onPrev) {
            onPrev(order);
        }
    }

    const orderTitle = order.displayCode;

    if (status === 'CONFIRMED') {
        return (
            <Button
                variant="outline"
                size="lg"
                onClick={addNext}
                className="select-none h-16 px-4 text-3xl font-bold whitespace-nowrap hover:bg-primary hover:text-primary-foreground transition-colors"
                disabled={!onNext}
            >
                {orderTitle}
            </Button>
        )
    }

    if (status === 'COMPLETED') {
        return (
            <div className="flex h-16 rounded-md overflow-hidden shadow-sm border border-input dark:border-input">
                <Button
                    variant="ghost"
                    className="select-none h-full w-12 shrink-0 rounded-none border-r border-input dark:border-input hover:bg-red-500 hover:text-white dark:hover:bg-red-600 transition-colors"
                    onClick={undoPrev}
                    disabled={!onPrev}
                >
                    <Undo2 className="h-5 w-5" />
                </Button>
                <Button
                    variant="ghost"
                    onClick={addNext}
                    className="select-none h-full px-4 rounded-none text-3xl font-bold whitespace-nowrap bg-green-500 text-white hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 transition-colors"
                    disabled={!onNext}
                >
                    {orderTitle}
                </Button>
            </div>
        )
    }

    if (status === 'PICKED_UP') {
        return (
            <div className="flex h-16 rounded-md overflow-hidden shadow-sm border border-input dark:border-input">
                <Button
                    variant="ghost"
                    className="select-none h-full w-12 shrink-0 rounded-none border-r border-input dark:border-input hover:bg-red-500 hover:text-white dark:hover:bg-red-600 transition-colors"
                    onClick={undoPrev}
                    disabled={!onPrev}
                >
                    <Undo2 className="h-5 w-5" />
                </Button>
                <Button
                    variant="ghost"
                    className="select-none h-full px-4 rounded-none text-3xl font-bold whitespace-nowrap bg-green-500 text-white dark:bg-green-600 transition-colors opacity-70 cursor-not-allowed"
                    disabled
                >
                    {orderTitle}
                </Button>
            </div>
        )
    }

    return (
        <Card
            key={order.id}
        >
            <CardContent className="p-4 flex items-center justify-center h-full">
                <p className="text-8xl font-bold m-0">{orderTitle}</p>
            </CardContent>
        </Card>
    )
}