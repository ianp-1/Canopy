"use client";

import { Player } from "@remotion/player";
import { ShowcaseVideo } from "@/remotion/ShowcaseVideo";
import { AnimatedIcon } from "@/remotion/AnimatedIcons";

export function HomeShowcasePlayer() {
  return (
    <Player
      component={ShowcaseVideo}
      durationInFrames={240}
      compositionWidth={640}
      compositionHeight={360}
      fps={30}
      style={{
        width: "100%",
        height: "100%",
        borderRadius: "1rem",
      }}
      controls={false}
      autoPlay
      loop
      acknowledgeRemotionLicense
    />
  );
}

export function FeatureIconPlayer({
  iconType,
}: {
  iconType: "lightning" | "satellite" | "secure";
}) {
  return (
    <Player
      component={AnimatedIcon}
      inputProps={{ type: iconType }}
      durationInFrames={120}
      compositionWidth={64}
      compositionHeight={64}
      fps={30}
      style={{ width: 64, height: 64 }}
      controls={false}
      autoPlay
      loop
      acknowledgeRemotionLicense
    />
  );
}
