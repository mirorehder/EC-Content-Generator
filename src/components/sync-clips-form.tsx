"use client";

import { useActionState } from "react";

import { syncDriveFolder } from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";

export function SyncClipsForm({ defaultFolderId }: { defaultFolderId: string }) {
  const [result, formAction, isPending] = useActionState(syncDriveFolder, null);

  return (
    <form action={formAction} className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input
        type="text"
        name="folderId"
        defaultValue={defaultFolderId}
        placeholder="Google-Drive-Ordner-ID"
        className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <Button type="submit" disabled={isPending}>
        {isPending ? "Synchronisiere…" : "Jetzt synchronisieren"}
      </Button>
      {result && (
        <p className={`text-sm sm:ml-2 ${result.ok ? "text-muted-foreground" : "text-destructive"}`}>
          {result.message}
        </p>
      )}
    </form>
  );
}
