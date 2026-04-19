type Order = {
    id: string;
    ticketNumber: number;
    displayCode: string;
    createdAt?: string;
    confirmedAt?: string;
    completedAt?: string;
    customer?: string;
    table?: string;
    status: `PENDING` | `CONFIRMED` | `COMPLETED` | `PICKED_UP`;
}
type Status = `PENDING` | `CONFIRMED` | `COMPLETED` | `PICKED_UP`;