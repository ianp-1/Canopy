import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { SpringConfig, spring } from "remotion";
import { Star, ShieldCheck, TrendingDown } from "lucide-react";

export const ShowcaseVideo = () => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	// Scene Timing
	const cropEntry = 0;
	const riskEntry = 40;
	const successEntry = 90;

	// Animations
	const cropScale = spring({
		frame: frame - cropEntry,
		fps,
		config: { damping: 12 },
	});

	const riskSlide = spring({
		frame: frame - riskEntry,
		fps,
		config: { mass: 2, damping: 20 },
	});

	const successOpacity = interpolate(frame, [successEntry, successEntry + 20], [0, 1], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
	});

    const successScale = spring({
        frame: frame - successEntry,
        fps,
        config: { damping: 12 }
    });

	return (
		<AbsoluteFill className="bg-white rounded-3xl overflow-hidden shadow-inner flex items-center justify-center">
			<div className="relative w-full h-full p-12 flex flex-col items-center justify-center space-y-8">
				
                {/* Background Pattern */}
                <AbsoluteFill className="opacity-10 bg-[radial-gradient(#2E7D32_1px,transparent_1px)] [background-size:20px_20px]" />

				{/* Scene 1: Crop Selection */}
				<div 
                    style={{ transform: `scale(${cropScale})`, opacity: Math.min(1, Math.max(0, (frame - cropEntry) / 10)) }}
                    className="flex flex-col items-center space-y-2 z-10"
                >
					<div className="flex gap-4">
                        <div className="w-20 h-20 bg-yellow-100 rounded-2xl flex items-center justify-center text-4xl shadow-lg border-2 border-yellow-200">🌽</div>
                        <div className="w-20 h-20 bg-green-100 rounded-2xl flex items-center justify-center text-4xl shadow-lg border-2 border-green-200">🌱</div>
                        <div className="w-20 h-20 bg-amber-100 rounded-2xl flex items-center justify-center text-4xl shadow-lg border-2 border-amber-200">🌾</div>
                    </div>
                    <h2 className="text-xl font-bold text-slate-700 mt-4">1. Select Crop</h2>
				</div>

				{/* Scene 2: Risk Slider */}
                {frame > riskEntry && (
                    <div 
                        style={{ opacity: Math.min(1, (frame - riskEntry) / 10), transform: `translateY(${interpolate(frame, [riskEntry, riskEntry+20], [20, 0], { extrapolateRight: "clamp" })}px)` }}
                        className="w-full max-w-sm bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-sm z-20"
                    >
                        <div className="flex justify-between text-sm font-semibold text-slate-600 mb-2">
                            <span>Adjust Risk</span>
                            <span>{Math.round(interpolate(riskSlide, [0, 1], [10, 85]))}% Protection</span>
                        </div>
                        <div className="h-4 bg-slate-200 rounded-full overflow-hidden relative">
                            <div 
                                style={{ width: `${interpolate(riskSlide, [0, 1], [10, 85])}%` }}
                                className="h-full bg-[#2E7D32] absolute left-0 top-0 rounded-full"
                            />
                        </div>
                    </div>
                )}
			</div>
            
            {/* Scene 3: Success (Moved to root to span full width) */}
            {frame > successEntry && (
                <AbsoluteFill className="flex items-center justify-center bg-white/90 backdrop-blur-sm z-30">
                    <div style={{ opacity: successOpacity, transform: `scale(${successScale})` }} className="flex flex-col items-center">
                        <div className="w-32 h-32 bg-[#2E7D32] rounded-full flex items-center justify-center text-white shadow-2xl mb-6">
                            <ShieldCheck size={64} />
                        </div>
                        <h1 className="text-4xl font-extrabold text-[#1B3A2B]">Protected!</h1>
                        <p className="text-slate-500 font-medium">Policy #882910 Active</p>
                    </div>
                </AbsoluteFill>
            )}
		</AbsoluteFill>
	);
};
