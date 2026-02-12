import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import LoginClient from "@/app/login/LoginClient";
import { getAuthenticatedUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth";

export default async function LoginPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const user = getAuthenticatedUserFromToken(sessionToken);

  if (user?.profileDisplayName) {
    redirect("/dashboard");
  }
  if (user) {
    redirect("/profile/create");
  }

  return <LoginClient />;
}
