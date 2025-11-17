"use client"

import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormMessage,
} from "@/components/ui/form"

import { Input } from "@/components/ui/input"

import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"

import z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";

import { Logo } from "@/components/icons/logo";
import { Link } from "lucide-react";

export default function Login() {
    const formSchema = z.object({
        username: z.string(),
        password: z.string()
    });

    const form = useForm<z.input<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            username: "",
            password: ""
        }
    });

    function onSubmit(values: z.infer<typeof formSchema>) {
        console.log(values);
    }


    return (
        <div className="h-screen w-full flex place-content-center items-center bg-secondary-foreground">
            <h1 className="text-primary absolute top-0 p-3 md:left-0 font-bold text-lg">{process.env.NEXT_PUBLIC_APP_NAME}</h1>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                    <div className="h-screen w-full flex flex-col items-center place-content-center">
                        <Card className="w-[350px]">
                            <CardHeader>
                                <div className="relative flex w-full place-content-center pb-6">
                                    <Logo className="h-28" />
                                </div>
                                <CardTitle className="text-center">MyNumeri</CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-2">

                                <FormField
                                    control={form.control}
                                    name="username"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <Input placeholder={"Username"} {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="password"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <Input placeholder={"Password"} type="password" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </CardContent>
                            <CardFooter className="flex justify-between">
                                <Button
                                    variant="outline"
                                    type="button"
                                    onClick={() => form.reset()}
                                >
                                    {"Clear"}
                                </Button>
                                <Button type="submit">{"Login"}</Button>
                            </CardFooter>
                        </Card>
                    </div >
                </form>
            </Form >
            <div className=" absolute bottom-0 text-sm text-white">
                <Link href={"https://www.mysagra.com/"} target="_blank" >
                    {"Powered by"}
                    <Button variant={"link"} className="p-1.5">
                        {"MySagra"}
                    </Button>
                </Link>
            </div>
        </div>
    )
}