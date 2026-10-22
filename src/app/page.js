import { redirect } from "next/navigation";

// "/" has no UI of its own. (protected)/layout.js sends signed-out users
// to /login and users without an org to /onboarding/welcome.
export default function RootPage() {
  redirect("/home");
}
