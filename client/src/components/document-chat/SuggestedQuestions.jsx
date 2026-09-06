export function SuggestedQuestions({
  questions,
  disabled,
  onSelect,
}) {
  return (
    <div aria-label="Suggested questions" className="flex min-w-0 max-w-full gap-2 overflow-x-auto overscroll-x-contain bg-[#f8f6f1] px-4 pt-3 pb-1">
      {questions.map((question) => (
        <button
          key={question}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(question)}
          title={question}
          className="min-h-11 w-64 max-w-[85vw] shrink-0 rounded-xl border border-[#ded7ca] bg-white px-3 py-2 text-left text-xs font-medium leading-5 text-[#514d46] transition hover:border-[#a85a52] hover:bg-[#fffaf0] disabled:opacity-40"
        >
          <span className="line-clamp-2">{question}</span>
        </button>
      ))}
    </div>
  );
}
