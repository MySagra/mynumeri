import { useEffect, useState } from 'react';
import { useTheme } from '@teispace/next-themes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Moon, Sun, Palette } from 'lucide-react';
import { useTranslation } from "react-i18next";

export function AppearanceSettingsCard() {
    const { theme, setTheme } = useTheme();
    const { t } = useTranslation();
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    // Before mount, render neutral variants to match SSR output
    const lightVariant = mounted && theme === 'light' ? 'default' : 'outline';
    const darkVariant = mounted && theme === 'dark' ? 'default' : 'outline';

    return (
        <Card className="gap-4 rounded-2xl border-border/70 py-4 shadow-sm">
            <CardHeader className="gap-1 px-4 sm:px-5">
                <div className="flex items-center gap-2">
                    <Palette className="h-5 w-5 text-amber-500" />
                    <CardTitle className='select-none'>{t("settings.appearance")}</CardTitle>
                </div>
                <CardDescription className='select-none'>
                    {t("settings.appearanceDesc")}
                </CardDescription>
            </CardHeader>
            <CardContent className="px-4 sm:px-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-0.5">
                        <Label>{t("settings.theme")}</Label>
                        <div className="text-sm text-muted-foreground select-none">
                            {t("settings.themeDesc")}
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant={lightVariant}
                            size="sm"
                            className='min-w-24 select-none'
                            onClick={() => setTheme('light')}
                        >
                            <Sun className="h-4 w-4 mr-2" />
                            {t("settings.light")}
                        </Button>
                        <Button
                            variant={darkVariant}
                            size="sm"
                            className='min-w-24 select-none'
                            onClick={() => setTheme('dark')}
                        >
                            <Moon className="h-4 w-4 mr-2" />
                            {t("settings.dark")}
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
