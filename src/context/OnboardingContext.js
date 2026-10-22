"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./AuthContext";

const OnboardingContext = createContext(null);

/**
 * Wraps every /onboarding/* route. Holds the half-finished org answers
 * between steps and redirects based on auth state:
 *
 *   signed out            -> /onboarding (register)
 *   signed in, has org    -> /home
 *   signed in, no org     -> stay in the flow (register page forwards to /welcome)
 */
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

  // Avoid flashing a step that is about to redirect
  if (loading) return null;
  if (user && (hasOrg || isRegisterStep)) return null;
  if (!user && !isRegisterStep) return null;

  return (
    <OnboardingContext.Provider value={{ draft, setDraft }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export const useOnboarding = () => useContext(OnboardingContext);
