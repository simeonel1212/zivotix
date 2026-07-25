"use client";

import ImageUpload from "@/components/image-upload";

export default function CoverImageUpload({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  return (
    <ImageUpload
      value={value}
      onChange={onChange}
      label="Cover image"
      aspectClassName="aspect-[21/9]"
      shapeClassName="rounded-3xl"
      pathPrefix=""
      helpText="JPG or PNG, up to 8MB. We'll automatically resize it. This is the first thing buyers see, so a bright, high-resolution widescreen photo makes a real difference."
      maxDimension={1920}
    />
  );
}
