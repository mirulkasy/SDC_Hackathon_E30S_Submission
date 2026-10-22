"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function ProtectedLayout({ children }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const ready = !loading && user && profile?.orgId;

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (!profile?.orgId) router.replace("/onboarding/welcome");
  }, [loading, user, profile, router]);

  return ready ? children : null;
}
