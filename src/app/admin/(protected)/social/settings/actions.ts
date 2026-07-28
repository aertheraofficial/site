"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/staff-auth";
import { saveStudioSettings } from "@/lib/social/studio-settings";

const SETTINGS_PATH = "/admin/social/settings";

export async function saveSettingsAction(formData: FormData) {
  await requirePermission("social", SETTINGS_PATH);

  const read = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value.trim() : "";
  };

  // Only the four known preference keys are written; `saveStudioSettings`
  // filters again. Nothing here is a secret — API keys live in the environment.
  await saveStudioSettings({
    default_niche: read("default_niche"),
    default_tone: read("default_tone"),
    default_language: read("default_language"),
    brand_voice_notes: read("brand_voice_notes"),
  });

  revalidatePath(SETTINGS_PATH);
  redirect(`${SETTINGS_PATH}?saved=1`);
}
