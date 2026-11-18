import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import { Card, CardContent } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel, } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { FormField, FormItem, FormControl } from "@/components/ui/form"
import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, FormProvider, type FieldErrors } from "react-hook-form"
import { toast } from "sonner";
import { login as loginAction } from "@/actions/auth";
import { USER_STORAGE_KEY } from "@/hooks/use-auth";
import { Eye, EyeOff } from "lucide-react";
import z from "zod"
import { useTranslation } from "react-i18next";

export function LoginForm() {
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const { t } = useTranslation();

    const formSchema = z.object({
        username: z.string().min(1, t('loginForm.usernameRequired')),
        password: z.string().min(1, t('loginForm.passwordRequired'))
    });

    const form = useForm<z.input<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            username: "",
            password: ""
        }
    });

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsLoading(true);
        try {
            const result = await loginAction(values.username, values.password);
            if (result.success) {
                localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(result.user));
                await new Promise(resolve => setTimeout(resolve, 100));
                window.location.assign('/manager');
            } else {
                toast.error(result.error || t('loginForm.invalidCredentials'));
                form.reset();
            }
        } catch (error) {
            console.error('Login error:', error);
            toast.error(t('loginForm.loginError'));
            form.reset();
        } finally {
            setIsLoading(false);
        }
    }


    // Handle validation errors from react-hook-form (zod)
    function onError(errors: FieldErrors<z.input<typeof formSchema>>) {
        // If both username and password are missing, show a combined message
        const usernameError = errors.username?.message;
        const passwordError = errors.password?.message;

        if (usernameError && passwordError) {
            toast.error(t('loginForm.bothRequired'));
            return;
        }

        const first = Object.values(errors)[0];
        const message = (first as { message?: string } | undefined)?.message || t('loginForm.validationError');
        toast.error(message);
    }

    return (
        <FormProvider {...form}>
            <div className={cn("flex flex-col gap-6")}>
                <Card className="overflow-hidden p-0">
                    <CardContent className="grid p-0 md:grid-cols-2">
                        <form className="p-6 md:p-8 place-content-center" onSubmit={form.handleSubmit(onSubmit, onError)}>
                            <FieldGroup>
                                <img
                                    src="/logo.svg"
                                    alt="Logo"
                                    className="mx-auto h-36 w-auto select-none"
                                />
                                <div className="flex flex-col items-center gap-2 text-center">
                                    <h1 className="text-2xl font-bold select-none">{t('loginForm.welcome')}</h1>
                                    <p className="text-muted-foreground text-balance select-none">
                                        {t('loginForm.subtitle')}
                                    </p>
                                </div>
                                <Field>
                                    <FieldLabel htmlFor="username">{t('loginForm.usernameLabel')}</FieldLabel>
                                    <FormField
                                        control={form.control}
                                        name="username"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormControl>
                                                    <Input autoComplete="off" placeholder={t('loginForm.usernamePlaceholder')} {...field} />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </Field>
                                <Field>
                                    <FieldLabel htmlFor="password">{t('loginForm.passwordLabel')}</FieldLabel>
                                    <FormField
                                        control={form.control}
                                        name="password"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormControl>
                                                    <ButtonGroup className="w-full">
                                                        <Input autoComplete="off" placeholder={t('loginForm.passwordPlaceholder')} type={showPassword ? "text" : "password"} {...field} />
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="icon"
                                                            tabIndex={-1}
                                                            onClick={() => setShowPassword(p => !p)}
                                                        >
                                                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                        </Button>
                                                    </ButtonGroup>
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </Field>
                                <Field>
                                    <Button type="submit" disabled={isLoading} className="w-full select-none">
                                        {isLoading ? t('loginForm.loggingIn') : t('loginForm.loginButton')}
                                    </Button>
                                </Field>
                            </FieldGroup>
                        </form>
                        <div className="hidden md:flex bg-white items-center justify-center h-150 w-full">
                            <img
                                src="/placeholder.jpg"
                                alt="Logo"
                                className="object-contain select-none"
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </FormProvider>
    )
}
