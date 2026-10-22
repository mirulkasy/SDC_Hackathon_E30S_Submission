import { OnboardingProvider } from "@/context/OnboardingContext";

export default function OnboardingLayout({ children }) {
  return <OnboardingProvider>{children}</OnboardingProvider>;
}
