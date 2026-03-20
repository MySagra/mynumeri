import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel, } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { FormField, FormItem, FormControl } from "@/components/ui/form"
import { Eye, EyeOff } from "lucide-react"
import { useRouter } from "next/navigation";
import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, FormProvider } from "react-hook-form"
import { toast } from "sonner";
import { signIn } from "next-auth/react";
import z from "zod"

export function LoginForm() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const formSchema = z.object({
        username: z.string().min(1, "Username obbligatorio"),
        password: z.string().min(1, "Password obbligatoria")
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
            const result = await signIn("credentials", {
                username: values.username,
                password: values.password,
                redirect: false,
            });

            if (result?.error) {
                toast.error("Credenziali non valide");
                form.reset();
            } else if (result?.ok) {
                // Successful login
                toast.success("Login effettuato con successo!");
                router.push("/manager");
                router.refresh();
            }
        } catch (error) {
            console.error('Login error:', error);
            toast.error("Errore durante il login");
            form.reset();
        } finally {
            setIsLoading(false);
        }
    }


    // Handle validation errors from react-hook-form (zod)
    function onError(errors: any) {
        // If both username and password are missing, show a combined message
        const usernameError = (errors.username as any)?.message;
        const passwordError = (errors.password as any)?.message;

        if (usernameError && passwordError) {
            toast.error(`Username e Password sono obbligatori`);
            return;
        }

        const first = Object.values(errors)[0];
        const message = (first as any)?.message || 'Errore di validazione';
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
                                    <h1 className="text-2xl font-bold select-none">Benvenuto!</h1>
                                    <p className="text-muted-foreground text-balance select-none">
                                        Esegui il login al tuo account MyNumeri
                                    </p>
                                </div>
                                <Field>
                                    <FieldLabel htmlFor="username">Username</FieldLabel>
                                    <FormField
                                        control={form.control}
                                        name="username"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormControl>
                                                    <Input autoComplete="off" placeholder="Username o Email" {...field} />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </Field>
                                <Field>
                                    <FieldLabel htmlFor="password">Password</FieldLabel>
                                    <FormField
                                        control={form.control}
                                        name="password"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormControl>
                                                    <ButtonGroup className="w-full">
                                                        <Input autoComplete="off" placeholder="La tua password" type={showPassword ? "text" : "password"} {...field} />
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
                                        {isLoading ? "Accesso..." : "Accedi"}
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
