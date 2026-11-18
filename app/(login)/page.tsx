"use client"

import { useEffect } from 'react';
import { useMounted } from '@/hooks/use-mounted';
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LoginForm } from "@/components/login/login-card/login-form";
import { useTheme } from '@teispace/next-themes';
import { Moon, Sun, Languages } from 'lucide-react';
import { ButtonGroup, ButtonGroupText } from '@/components/ui/button-group';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

// Mappa codice errore (passato come ?error=) -> chiave di traduzione
const ERROR_MESSAGE_KEYS: Record<string, string> = {
  session_expired: 'loginForm.sessionExpired',
  unauthorized: 'loginForm.sessionExpired',
  forbidden: 'loginForm.accessDenied',
};

export default function LoginPage() {
  const { theme, setTheme } = useTheme();
  const { t, i18n } = useTranslation();
  const language = i18n.language?.slice(0, 2) || 'it';
  // Prevent hydration mismatch by only rendering theme toggle after mount
  const mounted = useMounted();

  // Mostra un messaggio se reindirizzati al login con un codice errore (?error=)
  useEffect(() => {
    const error = new URLSearchParams(window.location.search).get('error');
    if (!error) return;
    const key = ERROR_MESSAGE_KEYS[error] ?? 'loginForm.sessionExpired';
    toast.error(t(key));
    // Rimuovi il parametro dall'URL così il messaggio non riappare al refresh
    window.history.replaceState({}, '', '/');
  }, [t]);

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm md:max-w-4xl">
        <LoginForm />
      </div>

      <div className="absolute bottom-0 text-sm text-muted-foreground select-none">
        <Link href={"https://www.mysagra.com/"} target="_blank" rel="noopener noreferrer">
          {"Powered by"}
          <Button variant={"link"} className="text-primary p-1.5">
            {"MySagra"}
          </Button>
        </Link>
      </div>
      <div className="absolute bottom-0 right-0 m-4 flex gap-2">
        {/* Two buttons, not a menu: a menu at the bottom edge opens over the button
            and picks the item under the pointer. The choice is saved by I18nProvider. */}
        <ButtonGroup aria-label={t('userMenu.language')}>
          <ButtonGroupText className="px-2.5" title={t('userMenu.language')}>
            <Languages className="h-4 w-4" />
          </ButtonGroupText>
          {(['it', 'en'] as const).map((code) => (
            <Button
              key={code}
              variant={language === code ? 'default' : 'outline'}
              className="cursor-pointer select-none uppercase"
              title={code === 'it' ? t('userMenu.italian') : t('userMenu.english')}
              aria-pressed={language === code}
              onClick={() => i18n.changeLanguage(code)}
            >
              {code}
            </Button>
          ))}
        </ButtonGroup>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {mounted && (theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />)}
        </Button>
      </div>
    </div>
  );
}
