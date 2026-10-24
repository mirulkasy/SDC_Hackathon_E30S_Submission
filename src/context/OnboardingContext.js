"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./AuthContext";
import SplashScreen from "@/components/SplashScreen";

const OnboardingContext = createContext(null);

export function OnboardingProvider({ children }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [draft, setDraft] = useState({ orgName: "", businessType: "" });

  const isRegisterStep = pathname === "/onboarding";
  const hasOrg = Boolean(profile?.orgId);

  useEffect(() => {
    if (loading) return;
    if (user && hasOrg) router.replace("/home");
    else if (user && isRegisterStep) router.replace("/onboarding/welcome");
    else if (!user && !isRegisterStep) router.replace("/onboarding");
  }, [loading, user, hasOrg, isRegisterStep, router]);

  if (loading) return <SplashScreen />;
  if (user && (hasOrg || isRegisterStep)) return <SplashScreen />;
  if (!user && !isRegisterStep) return <SplashScreen />;

  return (
    <OnboardingContext.Provider value={{ draft, setDraft }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export const useOnboarding = () => useContext(OnboardingContext);
