import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

export function ArticleBody({ markdown }: { markdown: string }) {
  return (
    <div className="note-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          a: ({ href, children, ...rest }) => {
            const isExternal = href?.startsWith("http");
            return (
              <a
                href={href}
                rel={isExternal ? "noopener noreferrer" : undefined}
                target={isExternal ? "_blank" : undefined}
                {...rest}
              >
                {children}
              </a>
            );
          },
          img: ({ src, alt }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={typeof src === "string" ? src : ""}
              alt={alt ?? ""}
              loading="lazy"
              className="w-full h-auto"
            />
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
