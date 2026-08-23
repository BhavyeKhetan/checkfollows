"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/design-system";

export function DeleteTrackedAccountModal({
  open,
  username,
  loading,
  onClose,
  onConfirm,
}: {
  open: boolean;
  username: string;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loading) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [loading, onClose, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close deletion warning"
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        disabled={loading}
        onClick={onClose}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
        aria-describedby="delete-account-description"
        className="relative z-10 w-full max-w-md rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 text-[var(--foreground)] shadow-2xl sm:p-7"
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-600">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h2
          id="delete-account-title"
          className="mt-4 text-xl font-extrabold tracking-tight"
        >
          Remove @{username}?
        </h2>
        <p
          id="delete-account-description"
          className="mt-2 text-sm font-medium leading-6 text-[var(--muted-foreground)]"
        >
          Monitoring will stop and this account will disappear from your
          dashboard. You can add it again later.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            ref={cancelButtonRef}
            type="button"
            variant="secondary"
            disabled={loading}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="dark"
            isLoading={loading}
            leftIcon={<Trash2 className="h-4 w-4" />}
            onClick={onConfirm}
          >
            Remove account
          </Button>
        </div>
      </div>
    </div>
  );
}
