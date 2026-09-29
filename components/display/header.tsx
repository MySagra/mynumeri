import { Logo } from "../icons/logo";
import { useTranslation } from "react-i18next";

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
    const { t } = useTranslation();
    const finalTitle = title || t("display.ordersReady");
    return (
        <header className="z-10 flex flex-col w-full bg-amber-400 shadow-md border-b-2 border-amber-500">
            <div className="flex items-center justify-between px-6" style={{ minHeight: "72px" }}>
                <div className="flex items-center gap-3">
                    <LogoIcon />
                    <h1 className="text-3xl text-black font-black tracking-tight select-none">
                        {finalTitle}
                        {eventName && (
                            <>
                                <span > - </span>
                                <span >{eventName}</span>
                            </>
                        )}
                    </h1>
                </div>

            </div>

            <div className="h-2.5 w-full bg-black/10" />
        </header>
    );
}
