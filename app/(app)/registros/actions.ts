"use server";

import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/lib/auth";
import { query } from "@/lib/db";

export async function voidScan(formData: FormData) {
  const user = await requireSuperadmin();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;
  await query("UPDATE scans SET deleted_at = now(), deleted_by = $2 WHERE id = $1 AND deleted_at IS NULL", [id, user.id]);
  revalidatePath("/registros");
}
