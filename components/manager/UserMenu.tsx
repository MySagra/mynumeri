"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChevronDownIcon, LogOutIcon } from "lucide-react"

interface UserMenuProps {
    user: {
        username: string
        role: string
    }
    onLogout: () => void
}

export function UserMenu({ user, onLogout }: UserMenuProps) {
    const initials = user.username.slice(0, 2).toUpperCase()

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" className="cursor-pointer gap-1 ">
                        <div className="rounded-md text-lg font-semibold select-none">{initials}</div>
                    <ChevronDownIcon className="h-3 w-3 text-muted-foreground" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="min-w-48 rounded-lg select-none" align="end" sideOffset={6}>
                <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-2 px-1 py-1.5">
                        <Avatar className="h-8 w-8 rounded-lg">
                            <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
                        </Avatar>
                        <div className="grid text-left text-sm leading-tight">
                            <span className="truncate font-medium">{user.username}</span>
                            <span className="truncate text-xs text-muted-foreground">{user.role}</span>
                        </div>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onLogout} className="cursor-pointer">
                    <LogOutIcon className="h-4 w-4" />
                    Esci
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
