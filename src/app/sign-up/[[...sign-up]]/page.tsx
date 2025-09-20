"use client";

import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-[60vh] w-full grid place-items-center p-6">
      <SignUp routing="path" path="/sign-up" />
    </div>
  );
}