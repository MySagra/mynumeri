import { cn } from "@/lib/utils";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
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
        <div className={cn("select-none h-full w-full rounded-xl outline-2 outline-secondary bg-card shadow-lg px-4 pb-4 overflow-y-auto", className)}>
            {
                title || children ?
                    <div className="flex place-content-between items-center sticky top-0 bg-card z-10 pt-4 pb-2">
                        {
                            title ? <h2 className="select-none text-2xl font-bold mb-4">{title}</h2> : <></>
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
        </div >
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

    const orderTitle = order.ticketNumber || order.displayCode;

    if (status === 'CONFIRMED') {
        return (
            <Button
                variant="outline"
                size="lg"
                onClick={addNext}
                className="select-none h-16 w-24 text-3xl font-bold hover:bg-primary hover:text-primary-foreground transition-colors"
                disabled={!onNext}
            >
                {orderTitle}
            </Button>
        )
    }

    if (status === 'COMPLETED') {
        return (
            <ButtonGroup className="text-3xl font-bold h-16 w-32 shadow-sm">
                <Button
                    variant="outline"
                    className="select-none h-full w-12 text-3xl font-bold hover:bg-red-500 hover:text-white dark:hover:bg-red-600 transition-colors border-r"
                    onClick={undoPrev}
                    disabled={!onPrev}
                >
                    <Undo2 className="h-6 w-6" />
                </Button>
                <Button
                    variant="outline"
                    onClick={addNext}
                    className="select-none h-full flex-1 text-3xl font-bold bg-green-500 text-white hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 transition-colors"
                    disabled={!onNext}
                >
                    {orderTitle}
                </Button>
            </ButtonGroup>
        )
    }

    if (status === 'PICKED_UP') {
        return (
            <ButtonGroup className="text-3xl font-bold h-16 w-32 shadow-sm">
                <Button
                    variant="outline"
                    className="select-none h-full w-12 text-3xl font-bold hover:bg-red-500 hover:text-white dark:hover:bg-red-600 transition-colors border-r"
                    onClick={undoPrev}
                    disabled={!onPrev}
                >
                    <Undo2 className="h-6 w-6" />
                </Button>
                <Button
                    variant="outline"
                    className="select-none h-full flex-1 text-3xl font-bold bg-green-500 text-white dark:bg-green-600 transition-colors opacity-70 cursor-not-allowed"
                    disabled
                >
                    {orderTitle}
                </Button>
            </ButtonGroup>
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