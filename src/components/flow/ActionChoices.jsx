"use client";

export function ActionChoices({ choices, onChoose, disabled = false }) {
  if (!choices?.length) {
    return null;
  }

  return (
    <section className="space-y-3">
      <h3 className="text-sm text-[#c9c0b0]">你可以这样做</h3>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {choices.map((choice) => (
          <li key={choice.id}>
            <button
              type="button"
              onClick={() => onChoose(choice.id)}
              disabled={disabled}
              className="min-h-[44px] w-full rounded-xl border border-[#3a342c] bg-[#161412] px-4 py-3 text-left text-base text-[#efe7d8] transition-colors hover:border-[#57503f] hover:bg-[#1d1a16] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {choice.label}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}