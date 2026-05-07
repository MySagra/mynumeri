type OrderStationState = {
    stationId: string;
    status: string;
};

type Order = {
    id: string;
    ticketNumber: number;
    displayCode: string;
    createdAt?: string;
    confirmedAt?: string;
    completedAt?: string;
    customer?: string;
    table?: string;
    status: `PENDING` | `CONFIRMED` | `COMPLETED` | `PICKED_UP` | `PARTIAL`;
    ordersStations?: string[];
    orderStationStates?: OrderStationState[];
}
type Status = `PENDING` | `CONFIRMED` | `COMPLETED` | `PICKED_UP`;

type Station = {
    id: string;
    name: string;
};