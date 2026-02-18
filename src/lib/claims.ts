import { getIdTokenResult } from "firebase/auth";
import type { User } from "firebase/auth";

export async function getUserRole(user: User): Promise<"admin" | "client"> {
  const token = await getIdTokenResult(user, true); // true forces refresh
  const role = token.claims?.role;
  return role === "admin" ? "admin" : "client";
}
