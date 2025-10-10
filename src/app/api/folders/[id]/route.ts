import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { z } from "zod";

type Err = { error: string };

const FolderUpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
});

async function requireUserId() {
  const { userId } = auth();
  if (!userId) return { status: 401 as const, body: { error: "Unauthorized" } satisfies Err };
  const dbUser = await prisma.user.findUnique({ where: { clerkUserId: userId } });
  if (!dbUser) return { status: 403 as const, body: { error: "User not provisioned" } satisfies Err };
  return { status: 200 as const, user: dbUser };
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ensured = await requireUserId();
  if (ensured.status !== 200) return Response.json(ensured.body, { status: ensured.status });
  const dbUser = ensured.user;

  const id = params.id;
  if (!id) return Response.json({ error: "Missing id" } satisfies Err, { status: 400 });

  const existing = await prisma.folder.findFirst({ where: { id, userId: dbUser.id } });
  if (!existing) return Response.json({ error: "Folder not found" } satisfies Err, { status: 404 });

  let input: z.infer<typeof FolderUpdateSchema>;
  try {
    const json = await req.json();
    input = FolderUpdateSchema.parse(json);
  } catch {
    return Response.json({ error: "Invalid request body" } satisfies Err, { status: 400 });
  }

  try {
    const updated = await prisma.folder.update({
      where: { id },
      data: {
        name: input.name?.trim() ?? undefined,
      },
    });
    return Response.json(updated, { status: 200 });
  } catch (e) {
    console.error("Update folder error", e);
    return Response.json({ error: "Failed to update folder" } satisfies Err, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const ensured = await requireUserId();
  if (ensured.status !== 200) return Response.json(ensured.body, { status: ensured.status });
  const dbUser = ensured.user;

  const id = params.id;
  if (!id) return Response.json({ error: "Missing id" } satisfies Err, { status: 400 });

  const existing = await prisma.folder.findFirst({ where: { id, userId: dbUser.id } });
  if (!existing) return Response.json({ error: "Folder not found" } satisfies Err, { status: 404 });

  try {
    await prisma.folder.delete({ where: { id } });
    return Response.json({} as const, { status: 204 });
  } catch (e) {
    console.error("Delete folder error", e);
    return Response.json({ error: "Failed to delete folder" } satisfies Err, { status: 500 });
  }
}