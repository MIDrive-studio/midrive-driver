import { Image, Text, View } from "react-native";

// A company document, laid out for reading on a phone.
//
// The blocks arrive already resolved -- the portal has put the company's real
// details in -- so nothing here interprets or rewrites anything. It draws what
// it is given, and a block type it does not recognise is drawn as its text
// rather than dropped, because silently omitting a paragraph from something
// somebody is about to sign is the worst thing this file could do.
//
// The signed PDF remains the document of record. This is the readable version
// of the same resolved text, which is why both come from one place.

export type Block = {
  type: string;
  text?: string;
  level?: number;
  lead?: string;
  items?: string[];
  columns?: string[];
  rows?: string[][];
  asset?: string;
  width?: number;
  prompt?: string;
  options?: string[];
  id?: string;
  required?: boolean;
};

/** Where the pictures inside a document come from. */
const FIGURE_BASE = `${(process.env.EXPO_PUBLIC_PORTAL_URL ?? "").replace(/\/$/, "")}/api/documents/figures`;

function Heading({ text, level }: { text: string; level: number }) {
  const size = level <= 1 ? "text-2xl" : level === 2 ? "text-xl" : "text-lg";
  return <Text className={`mb-2 mt-5 font-bold text-ink ${size}`}>{text}</Text>;
}

function Bullets({ items, numbered }: { items: string[]; numbered: boolean }) {
  return (
    <View className="mb-3">
      {items.map((item, index) => (
        <View key={index} className="mb-1.5 flex-row">
          <Text className="w-7 text-[15px] leading-6 text-ink-muted">{numbered ? `${index + 1}.` : "•"}</Text>
          <Text className="flex-1 text-[15px] leading-6 text-ink-muted">{item}</Text>
        </View>
      ))}
    </View>
  );
}

// Scrolling a table sideways on a phone loses the row you were reading. Each
// row is stacked instead, with the column name against its value, which reads
// as the same information without the horizontal scroll.
function Table({ columns, rows }: { columns: string[]; rows: string[][] }) {
  return (
    <View className="mb-4 overflow-hidden rounded-lg border border-line">
      {rows.map((row, r) => (
        <View key={r} className={`px-3 py-2.5 ${r % 2 ? "bg-surface-sunken" : "bg-white"} ${r ? "border-t border-line" : ""}`}>
          {row.map((cell, c) => (
            <View key={c} className={c ? "mt-1.5" : undefined}>
              {columns[c] ? (
                <Text className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{columns[c]}</Text>
              ) : null}
              <Text className="text-[15px] leading-6 text-ink-muted">{cell}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function Figure({ asset }: { asset: string }) {
  if (!FIGURE_BASE.startsWith("http")) {
    // No portal configured for this build. Saying the picture is missing beats
    // a blank space in a document somebody is signing.
    return (
      <View className="mb-4 rounded-lg border border-line bg-surface-sunken px-3 py-4">
        <Text className="text-center text-sm text-ink-subtle">
          A diagram here could not be loaded. It is in the signed copy of this document.
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: `${FIGURE_BASE}/${encodeURIComponent(asset)}` }}
      className="mb-4 h-72 w-full"
      resizeMode="contain"
    />
  );
}

export function DocumentBlocks({ blocks }: { blocks: Block[] }) {
  return (
    <View>
      {blocks.map((block, index) => {
        switch (block.type) {
          case "heading":
            return <Heading key={index} text={block.text ?? ""} level={block.level ?? 2} />;

          case "bullets":
            return <Bullets key={index} items={block.items ?? []} numbered={false} />;

          case "numbered":
            return <Bullets key={index} items={block.items ?? []} numbered />;

          case "table":
            return <Table key={index} columns={block.columns ?? []} rows={block.rows ?? []} />;

          case "image":
            return block.asset ? <Figure key={index} asset={block.asset} /> : null;

          case "warning":
            return (
              <View key={index} className="mb-4 rounded-lg border border-warn-line bg-warn-surface px-3 py-3">
                <Text className="text-[15px] leading-6 text-warn-strong">{block.text}</Text>
              </View>
            );

          case "spacer":
            return <View key={index} className="h-4" />;

          case "question":
            // Answered on the declaration screen, not here. Shown so the driver
            // reads the question in the place the document asks it.
            return (
              <View key={index} className="mb-4 rounded-lg border border-line bg-surface-sunken px-3 py-3">
                <Text className="text-[15px] font-semibold leading-6 text-ink">{block.prompt}</Text>
                <Text className="mt-1 text-sm text-ink-subtle">You will be asked this before you sign.</Text>
              </View>
            );

          case "signature":
          case "company_signature":
            // Drawn on the signing step and printed in the PDF. A box here
            // would invite somebody to sign the same thing twice.
            return null;

          case "text":
          default:
            return (
              <View key={index} className="mb-3">
                {block.lead ? (
                  <Text className="mb-1 text-[15px] font-semibold leading-6 text-ink">{block.lead}</Text>
                ) : null}
                {block.text ? <Text className="text-[15px] leading-6 text-ink-muted">{block.text}</Text> : null}
              </View>
            );
        }
      })}
    </View>
  );
}
