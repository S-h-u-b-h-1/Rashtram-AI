import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function DocumentSummaryPanel({ summary }) {
  return (
    <section>
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#874047]">
        Evidence brief
      </p>
      {summary ? (
        <div className="chat-markdown mt-3 text-xs text-[#514d46]">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {summary}
          </ReactMarkdown>
        </div>
      ) : (
        <p className="mt-3 text-xs leading-5 text-[#81796e]">
          A summary is generated when a readable official PDF is available.
        </p>
      )}
    </section>
  );
}
