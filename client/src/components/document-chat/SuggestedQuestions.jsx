export function SuggestedQuestions({
  questions,
  disabled,
  onSelect,
}) {
  return (
    <div className="flex gap-2 overflow-x-auto border-t border-[#8f1d2c]/8 bg-[#f6f0e6] px-4 py-3">
      {questions.map((question) => (
        <button
          key={question}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(question)}
          className="whitespace-nowrap rounded-full border border-[#8f1d2c]/10 bg-white px-3 py-2 text-[10px] font-medium text-[#514d46] disabled:opacity-40"
        >
          {question}
        </button>
      ))}
    </div>
  );
}
