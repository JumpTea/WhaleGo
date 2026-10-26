import React from "react";
import { Composition } from "remotion";
import { Promo } from "./Promo";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="WhaleGoPromo"
      component={Promo}
      durationInFrames={2880}
      fps={60}
      width={1920}
      height={1080}
    />
  );
};
