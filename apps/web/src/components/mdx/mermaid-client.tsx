'use client';

import { useEffect, useId, useState } from 'react';
import { useTheme } from 'next-themes';
import { CodeBlock, Pre } from 'fumadocs-ui/components/codeblock';

// Client-side renderer (official `mermaid` package) for diagram types that
// `beautiful-mermaid` cannot parse (e.g. `journey`). Loaded dynamically so
// pages without such diagrams pay no bundle cost.
export function MermaidClient({ chart }: { chart: string }) {
  const rawId = useId();
  const { resolvedTheme } = useTheme();
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSvg(null);
    setFailed(false);

    (async () => {
      try {
        const { default: mermaid } = await import('mermaid');
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'loose',
          fontFamily: 'inherit',
          themeCSS: 'margin: 1.5rem auto 0;',
          theme: resolvedTheme === 'dark' ? 'dark' : 'default',
        });

        const id = `mermaid-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;
        const { svg } = await mermaid.render(
          id,
          chart.replaceAll('\\n', '\n'),
        );
        if (!cancelled) setSvg(svg);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chart, rawId, resolvedTheme]);

  if (failed) {
    return (
      <CodeBlock title="Mermaid">
        <Pre>{chart}</Pre>
      </CodeBlock>
    );
  }

  if (!svg) return null;
  return (
    <div
      className="overflow-x-auto [&_svg]:mx-auto [&_svg]:block [&_svg]:h-auto [&_svg]:max-w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
