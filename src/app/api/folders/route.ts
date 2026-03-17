import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { z } from "zod";

const FolderCreateSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().max(120).optional(),
});

type Err = { error: string };

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" } satisfies Err, { status: 401 });

  let input: z.infer<typeof FolderCreateSchema>;
  try {
    const json = await req.json();
    input = FolderCreateSchema.parse(json);
  } catch {
    return Response.json({ error: "Invalid request body" } satisfies Err, { status: 400 });
  }

  const id = input.id;
  const name = (input.name?.trim() ?? "") || "New Folder";

  try {
    const created = await prisma.folder.create({
      data: {
        id,
        clerkUserId: userId,
        name,
      },
    });
    return Response.json(created, { status: 201 });
  } catch (e) {
    console.error("Create folder error", e);
    return Response.json({ error: "Failed to create folder" } satisfies Err, { status: 500 });
  }
}
