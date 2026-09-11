import { useState } from "react";
import { ActivityIndicator, Image, Text, View, useWindowDimensions } from "react-native";

// A contract the company supplied, as pages rather than paragraphs.
//
// Most documents in this app are structured content the server resolves into
// sentences. This one is a PDF somebody's solicitor drafted, and it is shown as
// pictures of its pages -- rendered once on the server when the contract was
// published, because Android's WebView will not display a PDF inline and a
// contract a driver cannot read is not one they can agree to.
//
// THE SIGNATURE BOX IS A HIGHLIGHT, NOT A CONTROL
//
// It marks where the signature will be placed so the driver can see what they
// are agreeing to and where it lands. It has no handles, cannot be dragged or
// resized, and nothing here sends coordinates anywhere: the numbers arrive from
// the server and are used only to draw. Where the signature actually goes is
// decided when the PDF is stamped, from the same stored values, so moving this
// rectangle -- if it could be moved -- would change nothing.

export type SignatureField = {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

/** One page, sized from its own aspect ratio once it has loaded. */
function Page({
  uri,
  width,
  field,
  number,
}: {
  uri: string;
  width: number;
  field: SignatureField | null;
  number: number;
}) {
  // A4 until the image says otherwise, which is nearly always right and stops
  // the page jumping about as each one loads.
  const [ratio, setRatio] = useState(1 / 1.414);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const height = width / ratio;

  if (failed) {
    return (
      <View className="mb-4 items-center justify-center rounded-xl border border-warn-line bg-warn-surface px-4 py-10">
        <Text className="text-sm font-semibold text-warn-strong">Page {number} didn&apos;t load</Text>
        <Text className="mt-1 text-center text-xs text-warn-strong">
          Pull down to try again. Don&apos;t sign a contract you haven&apos;t been able to read.
        </Text>
      </View>
    );
  }

  return (
    <View className="mb-4 overflow-hidden rounded-xl border border-line bg-white" style={{ width, height }}>
      {!loaded && (
        <View className="absolute inset-0 items-center justify-center">
          <ActivityIndicator color="#1f5089" />
        </View>
      )}

      <Image
        source={{ uri }}
        style={{ width, height }}
        resizeMode="contain"
        onLoad={(event) => {
          const size = event.nativeEvent.source;
          if (size?.width && size?.height) setRatio(size.width / size.height);
          setLoaded(true);
        }}
        onError={() => setFailed(true)}
      />

      {field && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: field.x * width,
            top: field.y * height,
            width: field.width * width,
            height: field.height * height,
            borderWidth: 2,
            borderColor: "#1f5089",
            borderStyle: "dashed",
            backgroundColor: "rgba(31,80,137,0.10)",
            borderRadius: 4,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text className="text-[10px] font-bold text-marine-700">Your signature goes here</Text>
        </View>
      )}
    </View>
  );
}

export function DocumentPages({
  pages,
  signatureField,
}: {
  pages: string[];
  signatureField: SignatureField | null;
}) {
  const { width: screenWidth } = useWindowDimensions();

  // The screen less the padding the scroll view already applies. Measured from
  // the window rather than onLayout so the first render is the right size and
  // the pages do not visibly resize themselves.
  const width = screenWidth - 40;

  if (pages.length === 0) {
    return (
      <View className="mb-4 rounded-xl border border-warn-line bg-warn-surface p-4">
        <Text className="text-sm font-semibold text-warn-strong">This contract has no pages to show</Text>
        <Text className="mt-1 text-xs text-warn-strong">
          Tell your office before signing anything.
        </Text>
      </View>
    );
  }

  return (
    <View>
      {pages.map((uri, index) => (
        <Page
          key={index}
          uri={uri}
          width={width}
          number={index + 1}
          field={signatureField && signatureField.page === index ? signatureField : null}
        />
      ))}
    </View>
  );
}
