import { useCurrentFrame, useVideoConfig } from "remotion";
import { Zap, Satellite, ShieldCheck } from "lucide-react";

export const AnimatedIcon = ({ type }: { type: "lightning" | "satellite" | "secure" }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

    // Continuous loop animations (Sine Waves)
    const lightningScale = Math.sin(frame / 5) * 0.1 + 1; // 0.9 to 1.1 pulse
    const shieldScale = Math.sin(frame / 20) * 0.05 + 1; // 0.95 to 1.05 breathing
    const satelliteY = Math.sin(frame / 20) * 3; // -5px to 5px float

	if (type === "lightning") {
		return (
			<div className="w-full h-full flex items-center justify-center">
				<div style={{ transform: `scale(${lightningScale})` }} className="text-yellow-500">
                    <Zap size={48} fill="currentColor" className="drop-shadow-lg" />
                </div>
			</div>
		);
	}

    if (type === "satellite") {
        return (
            <div className="w-full h-full flex items-center justify-center">
                <div style={{ transform: `translateY(${satelliteY}px)` }} className="text-blue-500">
                    <Satellite size={48} className="drop-shadow-lg" />
                </div>
            </div>
        );
    }

    if (type === "secure") {
        return (
            <div className="w-full h-full flex items-center justify-center">
                <div style={{ transform: `scale(${shieldScale})` }} className="text-green-600">
                    <ShieldCheck size={48} className="drop-shadow-lg" />
                    {/* Subtle glow that gently fades in/out without disappearing explicitly */}
                    <div style={{ opacity: Math.sin(frame / 20) * 0.2 + 0.3 }} className="absolute inset-0 bg-green-400 rounded-full blur-xl -z-10" />
                </div>
            </div>
        );
    }

	return null;
};
