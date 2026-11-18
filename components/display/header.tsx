import { Logo } from "../icons/logo";
import { HeaderClock } from "@/components/header-clock";

interface HeaderProps {
    title?: string;
    eventName?: string;
}

function LogoIcon() {
    return (
        <Logo width={60} height={60} className="text-black" bgFill="fill-black" itemFill="fill-yellow-400" aria-hidden="true" > </Logo>
    );
}

export function Header({ title, eventName }: HeaderProps) {
    // Senza titolo (vista ibrida) resta solo il nome della sagra
    const parts = [title, eventName].filter((p): p is string => !!p);
    return (
        <header className="z-10 flex flex-col w-full bg-amber-400 shadow-md border-b-2 border-amber-500">
            <div className="flex items-center justify-between px-6" style={{ minHeight: "72px" }}>
                <div className="flex items-center gap-3">
                    <LogoIcon />
                    {parts.length > 0 && (
                        <h1 className="text-3xl text-black font-black tracking-tight select-none">
                            {parts.join(" - ")}
                        </h1>
                    )}
                </div>
                <HeaderClock className="text-3xl font-black text-black" />
            </div>

            <div className="h-2.5 w-full bg-black/10" />
        </header>
    );
}
