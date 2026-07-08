"use client";

import { useEffect } from "react";
import { signOut } from "next-auth/react";

// Terminates the blocked user's session once they land on /blocked, so their (still-valid) JWT
// can't be reused on protected routes. We stay on the page — the message is already rendered.
export function BlockedNotice() {
  useEffect(() => {
    void signOut({ redirect: false });
  }, []);
  return null;
}
