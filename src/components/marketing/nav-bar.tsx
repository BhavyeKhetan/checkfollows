"use client";

import { useState } from "react";
import Link from "next/link";
import { Zap, Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

const NAV_LINKS = [
  { href: "/#truth-section", label: "The Instagram Trap" },
  { href: "/#comparison", label: "Comparison" },
  { href: "/#use-cases", label: "Use Cases" },
  { href: "/pricing", label: "Pricing" },
];

export function NavBar() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 ramp-glass">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2.5 font-bold text-lg text-[#121212] hover:opacity-80 transition-opacity"
        >
          <div className="w-8 h-8 rounded-full bg-[#121212] flex items-center justify-center text-[#E7F256]">
            <Zap className="w-4 h-4 fill-current text-[#E7F256]" />
          </div>
          <span className="tracking-tight text-xl font-extrabold">CheckFollows</span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href + link.label}
              href={link.href}
              className="text-sm font-semibold text-[#555555] hover:text-[#121212] transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden sm:flex items-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center font-semibold transition-all duration-200 rounded-full text-xs px-3.5 py-2 gap-1.5 bg-[#E7F256] text-[#121212] hover:bg-[#DAE64A] active:bg-[#C7D337] border border-transparent shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
          >
            Check followers anonymously
          </Link>
        </div>

        <button
          className="sm:hidden p-2 text-[#555555] hover:text-[#121212]"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="sm:hidden border-t border-[#E2E2DC] bg-[#FFFFFF]"
          >
            <div className="px-4 py-4 space-y-3">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href + link.label}
                  href={link.href}
                  className="block text-sm font-semibold text-[#555555] hover:text-[#121212]"
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <div className="pt-2">
                <Link
                  href="/"
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-center w-full font-semibold transition-all duration-200 rounded-full text-sm px-4 py-2.5 gap-2 bg-[#E7F256] text-[#121212] hover:bg-[#DAE64A] active:bg-[#C7D337] border border-transparent shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
                >
                  Check followers anonymously
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
