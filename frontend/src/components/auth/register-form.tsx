"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function RegisterForm() {
  const router = useRouter();
  const { register } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <Card className="w-full max-w-xl">
      <CardHeader>
        <CardTitle>Create account</CardTitle>
        <CardDescription>Foundation register flow for candidate and recruiter roles.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            const fullName = String(formData.get("full_name") || "").trim();
            const email = String(formData.get("email") || "").trim();
            const password = String(formData.get("password") || "");
            const role = String(formData.get("role") || "candidate") as "candidate" | "recruiter";
            setError(null);

            startTransition(async () => {
              try {
                const user = await register({
                  full_name: fullName || undefined,
                  email,
                  password,
                  role,
                });
                router.push(user.role === "recruiter" ? "/recruiter" : "/candidate");
              } catch (caughtError) {
                setError(caughtError instanceof Error ? caughtError.message : "Registration failed.");
              }
            });
          }}
        >
          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--color-ink)]" htmlFor="full_name">
              Full name
            </label>
            <Input id="full_name" name="full_name" placeholder="Ari Morgan" />
          </div>
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
          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--color-ink)]" htmlFor="role">
              Role
            </label>
            <select
              id="role"
              name="role"
              defaultValue="candidate"
              className="flex h-11 w-full rounded-2xl border border-[var(--color-border)] bg-white px-4 text-sm text-[var(--color-ink)] outline-none focus:ring-4 focus:ring-[var(--color-ring)]"
            >
              <option value="candidate">Candidate</option>
              <option value="recruiter">Recruiter</option>
            </select>
          </div>
          {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
          <Button className="w-full" type="submit" disabled={isPending}>
            {isPending ? "Creating account..." : "Create account"}
          </Button>
          <p className="text-sm text-[var(--color-ink-muted)]">
            Already registered?{" "}
            <Link className="font-semibold text-[var(--color-accent)]" href="/login">
              Sign in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
