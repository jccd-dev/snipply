"use client";

import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-[60vh] w-full grid place-items-center p-6">
      <SignIn routing="path" path="/sign-in" />
    </div>
  );
}