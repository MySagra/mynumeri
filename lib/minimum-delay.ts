// Wait for the request and a minimum duration, including when the request fails.
export async function withMinimumDelay<T>(request: Promise<T>, ms: number): Promise<T> {
    const [result] = await Promise.allSettled([
        request,
        new Promise<void>(resolve => setTimeout(resolve, ms)),
    ]);
    if (result.status === "rejected") throw result.reason;
    return result.value;
}
