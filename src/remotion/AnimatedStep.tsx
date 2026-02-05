import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";

export const AnimatedStep = ({ step }: { step: number }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

    // 1. Scale In
	const scale = spring({
		frame,
		fps,
		config: { damping: 10 },
	});

    // 2. Draw Ring
    // Circumference of r=40 is ~251
    const progress = spring({
        frame: frame - 10,
        fps,
        config: { mass: 2, damping: 20 },
    });
    const strokeDashoffset = interpolate(progress, [0, 1], [251, 0]);

    // 3. Count Up
    const count = Math.round(interpolate(frame, [10, 30], [0, step], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
    }));

    // 4. Pulse Loop (after entry)
    const pulse = Math.sin((frame - 40) / 10) * 0.05 + 1; // 0.95-1.05
    const finalScale = frame > 40 ? pulse : scale;

	return (
		<AbsoluteFill className="flex items-center justify-center">
            <div style={{ transform: `scale(${finalScale})` }} className="relative flex items-center justify-center w-24 h-24">
                {/* Background Circle */}
                <div className="absolute inset-0 rounded-full bg-white border-4 border-gray-100 shadow-sm" />
                
                {/* Animated Ring (SVG) */}
                <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="none"
                        stroke="#2E7D32"
                        strokeWidth="5"
                        strokeDasharray="251"
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                    />
                </svg>

                {/* Number */}
                <span className="relative text-4xl font-bold text-[#1B3A2B] font-mono">
                    {count}
                </span>
            </div>
		</AbsoluteFill>
	);
};
