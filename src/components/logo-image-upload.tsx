"use client";

import ImageUpload from "@/components/image-upload";

// Small square logo/badge shown over the cover image — separate from the
// wide cover banner. Stored in the same `event-covers` bucket under a
// `logo-` filename prefix so it doesn't collide with cover uploads.
export default function LogoImageUpload({
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
      label="Event logo (small, square)"
      aspectClassName="aspect-square max-w-[10rem]"
      shapeClassName="rounded-2xl"
      pathPrefix="logo-"
      helpText="Square image works best, up to 8MB. We'll automatically resize it."
      maxDimension={640}
    />
  );
}
