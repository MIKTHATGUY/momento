import { renderMermaidSVG } from 'beautiful-mermaid';
import { MermaidClient } from './mermaid-client';

// `beautiful-mermaid` parses line-by-line, while Mermaid treats `;` as a
// statement separator. Normalize so inline charts like `graph TD; A-->B;`
// render as diagrams instead of falling back to a code block.
function normalizeChart(chart: string) {
  return chart
    .split('\n')
    .flatMap((line) => line.split(';'))
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n');
}

export async function Mermaid({ chart }: { chart: string }) {
  const normalized = normalizeChart(chart);

  try {
    const svg = renderMermaidSVG(normalized, {
      bg: 'var(--color-fd-background)',
      fg: 'var(--color-fd-foreground)',
      interactive: true,
      transparent: true,
    });

    return (
      <div
        className="overflow-x-auto [&_svg]:mx-auto [&_svg]:block [&_svg]:h-auto [&_svg]:max-w-full"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    );
  } catch {
    // Diagram type not supported by `beautiful-mermaid` (e.g. `journey`):
    // render it in the browser with the official `mermaid` package.
    // Only then, if that fails too, it degrades to a code block.
    return <MermaidClient chart={normalized} />;
  }
}
