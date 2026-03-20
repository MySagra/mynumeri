import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Moon, Sun, Palette } from 'lucide-react';

export function AppearanceSettingsCard() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    // Before mount, render neutral variants to match SSR output
    const lightVariant = mounted && theme === 'light' ? 'default' : 'outline';
    const darkVariant = mounted && theme === 'dark' ? 'default' : 'outline';

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <Palette className="h-5 w-5 text-amber-600" />
                    <CardTitle className='select-none'>Aspetto</CardTitle>
                </div>
                <CardDescription className='select-none'>
                    Personalizza l'aspetto dell'applicazione
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="space-y-0.5">
                        <Label>Tema</Label>
                        <div className="text-sm text-muted-foreground select-none">
                            Scegli tra tema chiaro e scuro
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant={lightVariant}
                            size="sm"
                            className='select-none'
                            onClick={() => setTheme('light')}
                        >
                            <Sun className="h-4 w-4 mr-2" />
                            Chiaro
                        </Button>
                        <Button
                            variant={darkVariant}
                            size="sm"
                            className='select-none'
                            onClick={() => setTheme('dark')}
                        >
                            <Moon className="h-4 w-4 mr-2" />
                            Scuro
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
