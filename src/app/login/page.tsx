import { Suspense } from "react";
import LoginForm from "./login-form";
import TicketBackdrop from "@/components/ticket-backdrop";

export default function LoginPage() {
  return (
    <main className="flex-1 relative overflow-hidden flex items-center justify-center px-6">
      <div
        className="zv-glow-orb w-[400px] h-[400px] -top-32 -right-32"
        style={{ background: "linear-gradient(135deg, #facc15, #ca8a04)" }}
      />
      <TicketBackdrop className="opacity-70" />
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
