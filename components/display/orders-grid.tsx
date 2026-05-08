import { cn } from "@/lib/utils";
import { Undo2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card, CardContent } from "@/components/ui/card"

interface OrdersGridProps {
    className?: string;
    orders: Order[];
    title?: string;
    children?: React.ReactNode;
    status?: Status;
    prevSetter?: React.Dispatch<React.SetStateAction<Order[]>>;
    actualSetter: React.Dispatch<React.SetStateAction<Order[]>>;
    nextSetter?: React.Dispatch<React.SetStateAction<Order[]>>;
}

export default function OrdersGrid({ className, orders, title, status, prevSetter, actualSetter, nextSetter, children }: OrdersGridProps) {
    return (
        <div className={cn("h-full w-full rounded-xl p-4", className)}>
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
            <div className="flex gap-3">
                {
                    orders.map((order) => (
                        <OrderCard key={order.id} order={order} status={status} prevSetter={prevSetter} actualSetter={actualSetter} nextSetter={nextSetter} />
                    ))
                }
            </div>
        </div >
    )
}

interface OrderCardProps {
    order: Order;
    status?: Status;
    prevSetter?: React.Dispatch<React.SetStateAction<Order[]>>;
    actualSetter: React.Dispatch<React.SetStateAction<Order[]>>;
    nextSetter?: React.Dispatch<React.SetStateAction<Order[]>>;
}

function OrderCard({ order, status, prevSetter, actualSetter, nextSetter }: OrderCardProps) {
    function addNext() {
        if (nextSetter) {
            actualSetter((prev) => prev.filter((o) => o.id !== order.id));
            nextSetter((prev) => [...prev, order]);
        }
    }

    function undoPrev() {
        if (prevSetter) {
            actualSetter((prev) => prev.filter((o) => o.id !== order.id));
            prevSetter((prev) => [...prev, order]);
        }
    }

    if (status === 'CONFIRMED') {
        return (
            <Button
                key={order.id}
                variant="outline"
                size="lg"
                onClick={addNext}
                className="h-15 text-3xl font-bold font-mono hover:bg-primary hover:text-primary-foreground transition-colors"
            >
                {order.ticketNumber}
            </Button>
        )
    }

    if (status === 'COMPLETED') {
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
                    className="h-15 text-3xl font-bold font-mono bg-green-500 hover:bg-green-600 transition-colors"
                    disabled={!nextSetter}
                >
                    {order.ticketNumber}
                    <CheckCircle className="h-8 w-8" />
                </Button>
            </ButtonGroup>
        )
    }

    if (status === 'PICKED_UP') {
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
                    className="h-15 text-3xl font-bold font-mono bg-green-500 transition-colors"
                    disabled={!nextSetter}
                >
                    {order.ticketNumber}
                    <CheckCircle className="h-8 w-8" />
                </Button>
            </ButtonGroup>
        )
    }

    return (
        <Card
            className="bg-gray-300"
            key={order.id}
        >
            <CardContent><p className="text-8xl text-black font-bold font-mono">{order.ticketNumber}</p></CardContent>
        </Card>
    )
}