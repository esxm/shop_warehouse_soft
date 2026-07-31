"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { createBrowserSupabaseClient } from "@/lib/db/browser";

export function InviteAcceptance() {
  const router = useRouter();
  const [message, setMessage] = useState("Verifying your invitation...");

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    let active = true;

    const continueWhenSignedIn = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (!active) {
        return;
      }

      if (error) {
        setMessage("This invitation link is invalid or has expired.");
        return;
      }

      if (session) {
        router.replace("/set-password");
        router.refresh();
        return;
      }

      setMessage("This invitation link is invalid or has expired.");
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        active &&
        session &&
        (event === "SIGNED_IN" || event === "INITIAL_SESSION")
      ) {
        router.replace("/set-password");
        router.refresh();
      }
    });

    void continueWhenSignedIn();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-slate-950">
          Employee invitation
        </h1>
        <p className="mt-4 leading-7 text-slate-600" role="status">
          {message}
        </p>
      </section>
    </main>
  );
}
