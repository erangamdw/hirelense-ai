"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <Card className="w-full max-w-xl">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Access your candidate or recruiter workspace and continue where you left off.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            const email = String(formData.get("email") || "").trim();
            const password = String(formData.get("password") || "");
            setError(null);

            startTransition(async () => {
              try {
                const user = await signIn({ email, password });
                router.push(user.role === "recruiter" ? "/recruiter" : "/candidate");
              } catch (caughtError) {
                setError(caughtError instanceof Error ? caughtError.message : "Sign in failed.");
              }
            });
          }}
        >
          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--color-ink)]" htmlFor="email">
              Email
            </label>
            <Input id="email" name="email" type="email" placeholder="you@example.com" required />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--color-ink)]" htmlFor="password">
              Password
            </label>
            <Input id="password" name="password" type="password" placeholder="At least 8 characters" required />
          </div>
          {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
          <Button className="w-full" type="submit" disabled={isPending}>
            {isPending ? "Signing in..." : "Continue"}
          </Button>
          <p className="text-sm text-[var(--color-ink-muted)]">
            Need an account?{" "}
            <Link className="font-semibold text-[var(--color-accent)]" href="/register">
              Create one
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
