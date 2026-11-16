"use client";

import { useState } from "react";

import { SOURCE_TYPES, SOURCE_TYPE_LABELS } from "@/lib/constants";
import { userConfirmedValue } from "@/schemas/sourceSchema";

function AddItemRow({ onAdd, disabled, placeholder }) {
  const [text, setText] = useState("");

  function submit() {
    const value = text.trim();

    if (!value) {
      return;
    }

    onAdd(value);
    setText("");
  }

  return (
    <div className="flex items-center gap-2">
      <input
        value={text}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={`${placeholder}`}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            submit();
          }
        }}
        className="min-w-0 flex-1 rounded-lg border border-[#2c2822] bg-[#100f0e] px-2 py-1.5 text-sm text-[#e6ddce] placeholder:text-[#5f5950] focus:border-[#57503f] focus:outline-none"
      />
      <button
        type="button"
        onClick={submit}
        disabled={disabled || text.trim().length === 0}
        className="shrink-0 rounded-lg border border-[#3a342c] px-3 py-1.5 text-xs text-[#c9c0b0] hover:bg-[#1f1c18] disabled:opacity-40"
      >
        添加
      </button>
    </div>
  );
}

// Typing only touches local state; a discrete action (tick, add, delete, blur)
// asks the parent to persist the draft.
export function AnalysisItemEditor({ label, items, disabled = false, onChange, addPlaceholder }) {
  function replaceAt(index, patch) {
    onChange(
      items.map((item, position) => (position === index ? { ...item, ...patch } : item)),
      false,
    );
  }

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm text-[#c9c0b0]">{label}</h3>
        <span className="text-xs text-[#6b6459]">{items.length} 项</span>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-[#6b6459]">这一项还是空的。</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item, index) => (
            <li
              key={`${item.value}-${index}`}
              className="flex items-center gap-2 rounded-lg border border-[#2c2822] bg-[#141210] px-2 py-1.5"
            >
              <input
                type="checkbox"
                checked={item.adopted}
                disabled={disabled}
                aria-label={`采用 ${item.value}`}
                onChange={(event) =>
                  onChange(
                    items.map((entry, position) =>
                      position === index ? { ...entry, adopted: event.target.checked } : entry,
                    ),
                    true,
                  )
                }
                className="h-4 w-4 shrink-0 accent-[#e6d5b0]"
              />
              <input
                value={item.value}
                disabled={disabled}
                aria-label={`${label}第 ${index + 1} 项`}
                onChange={(event) =>
                  replaceAt(index, {
                    value: event.target.value,
                    sourceType: SOURCE_TYPES.USER_CONFIRMED,
                    confidence: 1,
                    confirmed: true,
                  })
                }
                onBlur={() => onChange(items, true)}
                className="min-w-0 flex-1 bg-transparent text-sm text-[#e6ddce] focus:outline-none"
              />
              <span className="shrink-0 rounded-full border border-[#3a342c] px-2 py-0.5 text-[11px] text-[#8d8474]">
                {SOURCE_TYPE_LABELS[item.sourceType] ?? item.sourceType}
              </span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(items.filter((_, position) => position !== index), true)}
                className="shrink-0 text-xs text-[#8d8474] hover:text-[#e0a98f] disabled:opacity-40"
              >
                删除
              </button>
            </li>
          ))}
        </ul>
      )}

      <AddItemRow
        disabled={disabled}
        placeholder={addPlaceholder}
        onAdd={(value) =>
          onChange([...items, { ...userConfirmedValue(value), baseline: value, adopted: true }], true)
        }
      />
    </section>
  );
}
