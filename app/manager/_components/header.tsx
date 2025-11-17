import { Settings, FileText, Monitor, LogOut } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { SheetTrigger } from "../../../components/ui/sheet";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Textarea } from "@/components/ui/textarea"

export function Header() {
    return (
        <header className="border-b">
            <div className="w-full px-4 py-4">
                <h1 className="text-2xl font-bold">MyNumeri - Manager</h1>
            </div>
            <div className="absolute top-4 right-4 flex items-center gap-2">
                <Button variant="outline" size="icon">
                    <Settings className="h-4 w-4" />
                </Button>
                <Drawer>
                    <DrawerTrigger>
                        <Button variant="outline">
                            <FileText className="mr-2 h-4 w-4" />
                            Avvisi Display
                        </Button>
                    </DrawerTrigger>
                    <DrawerContent>
                        <div className="mx-auto w-full max-w-2xl">
                            <DrawerHeader>
                                <DrawerTitle className="flex items-center gap-2">
                                    <FileText className="h-5 w-5" />
                                    Avvisi Display
                                </DrawerTitle>
                                <DrawerDescription className="flex items-center gap-2">
                                    Gli avvisi verranno mostrati nell'ultima riga della pagina display
                                </DrawerDescription>
                            </DrawerHeader>
                            <Textarea
                                id="notes-textarea"
                                className="w-full min-h-[200px] px-3 py-2 text-sm border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                placeholder="Es: Promozione del giorno, orari speciali, avvisi..."
                            />
                            <DrawerFooter>
                                <div className="flex items-center gap-2 place-content-end">
                                    <Button >Salva Avvisi</Button>
                                    <DrawerClose>
                                        <Button variant="outline">Annulla</Button>
                                    </DrawerClose>
                                </div>
                            </DrawerFooter>
                        </div>
                    </DrawerContent>
                </Drawer>
                <Button variant="outline">
                    <a href="/display" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                        <Monitor className="h-4 w-4" />
                        Apri Display
                    </a>
                </Button>
                <Button variant="outline">
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                </Button>
            </div>
        </header>
    )
}