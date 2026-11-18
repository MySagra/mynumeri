import { Metadata } from "next";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main>
      {children}
    </main>
  )
}

export const metadata: Metadata = {
  title: "MyNumeri - Login",
  description: "Gestione dei numeri di ritiro ordini",
};