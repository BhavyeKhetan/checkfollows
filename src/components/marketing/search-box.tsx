"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Input, Button } from "@/design-system";

export function SearchBox({
  placeholder = "Enter Instagram handle... (e.g. alex)",
}: {
  placeholder?: string;
}) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = () => {
    const username = value.replace(/^@/, "").trim();
    if (!username || loading) return;
    setLoading(true);
    window.location.href = `/?q=${encodeURIComponent(username)}`;
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="w-full max-w-lg mx-auto"
    >
      <div className="flex flex-col gap-3.5 rounded-2xl border border-[#E2E2DC] bg-[#FFFFFF] shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-3.5">
        <Input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          leftIcon={<span className="text-[#121212] font-black text-lg">@</span>}
          className="border-none bg-transparent py-3 text-base focus:ring-0"
          spellCheck={false}
          autoCapitalize="off"
        />
        <Button
          type="submit"
          variant="primary"
          size="md"
          isLoading={loading}
          disabled={!value.trim()}
          rightIcon={<ArrowRight className="w-4 h-4" />}
          className="w-full font-bold text-[#121212] py-3.5"
        >
          Check followers anonymously
        </Button>
      </div>
    </form>
  );
}
