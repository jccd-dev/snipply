import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import { Webhook } from "svix";
import prisma from "@/lib/prisma";

// Explicit types for Clerk webhook events we handle
type ClerkEmailAddress = {
  id: string;
  email_address: string;
};

type ClerkUser = {
  id: string;
  email_addresses?: ClerkEmailAddress[];
  primary_email_address_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  image_url?: string | null;
  public_metadata?: Record<string, unknown>;
};

type ClerkUserEventType = "user.created" | "user.updated" | "user.deleted";

type ClerkUserEvent = {
  type: ClerkUserEventType;
  data: ClerkUser;
};

function isClerkUserEvent(input: unknown): input is ClerkUserEvent {
  if (typeof input !== "object" || input === null) return false;
  const obj = input as Record<string, unknown>;
  if (obj.type !== "user.created" && obj.type !== "user.updated" && obj.type !== "user.deleted") {
    return false;
  }
  const data = obj.data as Record<string, unknown> | undefined;
  if (!data || typeof data !== "object") return false;
  return typeof data.id === "string";
}

export async function POST(req: NextRequest) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) {
    return new Response("Missing CLERK_WEBHOOK_SECRET", { status: 500 });
  }

  const payload = await req.text();
  const h = await headers();

  const svixId = h.get("svix-id");
  const svixTimestamp = h.get("svix-timestamp");
  const svixSignature = h.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing Svix headers", { status: 400 });
  }

  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: ClerkUserEvent;
  try {
    const untyped = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as unknown;

    if (!isClerkUserEvent(untyped)) {
      return new Response("Unsupported event", { status: 400 });
    }

    evt = untyped;
  } catch (err: unknown) {
    console.log(err)
    return new Response("Invalid signature", { status: 400 });
  }

  const eventType: ClerkUserEventType = evt.type;

  try {
    if (eventType === "user.created" || eventType === "user.updated") {
      const user = evt.data;
      const primaryEmail =
        user.email_addresses?.find((addr) => addr.id === user.primary_email_address_id)?.email_address ??
        undefined;
      const role = typeof user.public_metadata?.role === "string" ? (user.public_metadata.role as string) : undefined;

      await prisma.user.upsert({
        where: { clerkUserId: user.id },
        create: {
          clerkUserId: user.id,
          email: primaryEmail,
          firstName: user.first_name ?? undefined,
          lastName: user.last_name ?? undefined,
          imageUrl: user.image_url ?? undefined,
          role: role ?? "user",
        },
        update: {
          email: primaryEmail,
          firstName: user.first_name ?? undefined,
          lastName: user.last_name ?? undefined,
          imageUrl: user.image_url ?? undefined,
          role,
        },
      });
    }

    if (eventType === "user.deleted") {
      const user = evt.data;
      await prisma.user
        .delete({ where: { clerkUserId: user.id } })
        .catch(() => undefined);
    }

    return new Response(null, { status: 204 });
  } catch (e: unknown) {
    console.error("Webhook handling error", e);
    return new Response("Webhook error", { status: 500 });
  }
}
