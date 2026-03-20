"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Props = {
  children: React.ReactNode;
};

export function AuthGuard({ children }: Props) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (cancelled) return;
      if (error || !data?.user) {
        setAllowed(false);
        setChecking(false);
        router.replace("/login");
        return;
      }
      setAllowed(true);
      setChecking(false);
    };
    check();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (checking) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-sm text-slate-500">
        Verificando acceso...
      </div>
    );
  }

  if (!allowed) return null;

  return <>{children}</>;
}


