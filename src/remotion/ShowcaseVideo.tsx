import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, Sequence } from "remotion";
import { spring } from "remotion";
import { ShieldCheck, MapPin, Sliders } from "lucide-react";

interface PhaseProps {
  title: string;
  subtitle: string;
  phaseNumber: number;
}

const PhaseIndicator = ({ phaseNumber, currentPhase }: { phaseNumber: number; currentPhase: number }) => {
  const isActive = phaseNumber <= currentPhase;
  const isCurrent = phaseNumber === currentPhase;
  
  return (
    <div className="flex flex-col items-center">
      <div 
        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg transition-all ${
          isCurrent 
            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/40 scale-110' 
            : isActive 
              ? 'bg-emerald-500 text-white' 
              : 'bg-slate-200 text-slate-400'
        }`}
      >
        {phaseNumber}
      </div>
      <span className={`text-xs mt-2 font-medium ${isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
        {phaseNumber === 1 ? 'Select' : phaseNumber === 2 ? 'Configure' : 'Protect'}
      </span>
    </div>
  );
};

const ProgressLine = ({ progress }: { progress: number }) => (
  <div className="w-16 h-1 bg-slate-200 rounded-full overflow-hidden mx-2">
    <div 
      className="h-full bg-emerald-500 rounded-full transition-all"
      style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
    />
  </div>
);

export const ShowcaseVideo = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Phase timing (frames)
  const phase1Start = 0;
  const phase1End = 70;
  const phase2Start = 60;
  const phase2End = 140;
  const phase3Start = 155;

  // Determine current phase for indicators
  const getCurrentPhase = () => {
    if (frame < phase2Start) return 1;
    if (frame < phase3Start) return 2;
    return 3;
  };
  const currentPhase = getCurrentPhase();

  // Progress between phases
  const progress1to2 = interpolate(frame, [phase1End - 20, phase2Start + 10], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const progress2to3 = interpolate(frame, [phase2End - 20, phase3Start + 10], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Phase 1 animations
  const phase1Entry = spring({ frame: frame - phase1Start, fps, config: { damping: 12 } });
  const phase1Exit = interpolate(frame, [phase1End, phase1End + 15], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  
  // Phase 2 animations
  const phase2Entry = spring({ frame: frame - phase2Start, fps, config: { damping: 14 } });
  const phase2Exit = interpolate(frame, [phase2End, phase2End + 15], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const sliderProgress = spring({ frame: frame - phase2Start - 20, fps, config: { damping: 20, mass: 2 } });
  
  // Phase 3 animations
  const phase3Entry = spring({ frame: frame - phase3Start, fps, config: { damping: 10 } });
  const shieldPulse = Math.sin((frame - phase3Start) * 0.15) * 0.05 + 1;

  // Selected crop state
  const selectedCrop = frame > phase1Start + 30 ? 1 : -1; // Select after 1 second

  return (
    <AbsoluteFill className="bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden">
      {/* Background Pattern */}
      <AbsoluteFill 
        className="opacity-[0.03]"
        style={{ 
          backgroundImage: 'radial-gradient(circle at 1px 1px, #1B3A2B 1px, transparent 0)',
          backgroundSize: '24px 24px'
        }} 
      />

      {/* Progress Indicator - Top */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center z-50">
        <PhaseIndicator phaseNumber={1} currentPhase={currentPhase} />
        <ProgressLine progress={progress1to2} />
        <PhaseIndicator phaseNumber={2} currentPhase={currentPhase} />
        <ProgressLine progress={progress2to3} />
        <PhaseIndicator phaseNumber={3} currentPhase={currentPhase} />
      </div>

      {/* Main Content Area */}
      <div className="absolute inset-0 flex items-center justify-center pt-16">
        
        {/* Phase 1: Crop Selection */}
        {frame >= phase1Start && frame < phase2End && (
          <div 
            className="absolute flex flex-col items-center"
            style={{ 
              opacity: phase1Exit,
              transform: `scale(${phase1Entry}) translateY(${(1 - phase1Exit) * -30}px)`
            }}
          >
            <div className="flex items-center gap-3 mb-4">
              <MapPin className="w-5 h-5 text-emerald-600" />
              <span className="text-slate-500 font-medium">Select Your Crop</span>
            </div>
            
            <div className="flex gap-4">
              {[
                { emoji: '🌽', label: 'Corn', color: 'yellow', index: 0 },
                { emoji: '🌱', label: 'Soybean', color: 'green', index: 1 },
                { emoji: '🌾', label: 'Wheat', color: 'amber', index: 2 },
              ].map((crop, i) => {
                const isSelected = selectedCrop === crop.index;
                const entryDelay = spring({ frame: frame - phase1Start - (i * 5), fps, config: { damping: 12 } });
                return (
                  <div
                    key={crop.label}
                    style={{ transform: `scale(${entryDelay})` }}
                    className={`
                      w-24 h-28 rounded-2xl flex flex-col items-center justify-center gap-2
                      transition-all cursor-pointer shadow-lg
                      ${isSelected 
                        ? `bg-emerald-100 border-2 border-emerald-500 shadow-emerald-200` 
                        : `bg-white border-2 border-slate-100 hover:border-slate-200`
                      }
                    `}
                  >
                    <span className="text-4xl">{crop.emoji}</span>
                    <span className={`text-sm font-semibold ${isSelected ? 'text-emerald-700' : 'text-slate-600'}`}>
                      {crop.label}
                    </span>
                    {isSelected && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs">✓</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Phase 2: Risk Configuration */}
        {frame >= phase2Start && frame < phase3Start + 30 && (
          <div 
            className="absolute flex flex-col items-center w-full max-w-md px-6"
            style={{ 
              opacity: Math.min(phase2Entry, phase2Exit),
              transform: `scale(${phase2Entry}) translateY(${(1 - phase2Exit) * -30}px)`
            }}
          >
            <div className="flex items-center gap-3 mb-6">
              <Sliders className="w-5 h-5 text-emerald-600" />
              <span className="text-slate-500 font-medium">Configure Protection Level</span>
            </div>

            <div className="w-full bg-white rounded-2xl p-6 shadow-xl border border-slate-100">
              {/* Coverage Slider */}
              <div className="mb-6">
                <div className="flex justify-between text-sm mb-3">
                  <span className="text-slate-600 font-medium">Coverage Amount</span>
                  <span className="text-emerald-600 font-bold">
                    ${Math.round(interpolate(sliderProgress, [0, 1], [5000, 25000])).toLocaleString()}
                  </span>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full"
                    style={{ width: `${interpolate(sliderProgress, [0, 1], [20, 80])}%` }}
                  />
                </div>
              </div>

              {/* Risk Threshold */}
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-3">
                  <span className="text-slate-600 font-medium">Drought Threshold</span>
                  <span className="text-amber-600 font-bold">
                    {Math.round(interpolate(sliderProgress, [0, 1], [10, 30]))} Days
                  </span>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-amber-400 to-amber-600 rounded-full"
                    style={{ width: `${interpolate(sliderProgress, [0, 1], [15, 60])}%` }}
                  />
                </div>
              </div>

              {/* Premium Display */}
              <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                <span className="text-slate-500 text-sm">Estimated Premium</span>
                <span className="text-2xl font-bold text-slate-800">
                  ${Math.round(interpolate(sliderProgress, [0, 1], [50, 180]))}
                  <span className="text-sm font-normal text-slate-400">/month</span>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Phase 3: Protection Confirmed */}
        {frame >= phase3Start && (
          <div 
            className="absolute flex flex-col items-center"
            style={{ 
              opacity: phase3Entry,
              transform: `scale(${phase3Entry * shieldPulse})`
            }}
          >
            <div 
              className="w-28 h-28 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center shadow-2xl shadow-emerald-500/40 mb-6"
            >
              <ShieldCheck className="w-14 h-14 text-white" strokeWidth={2.5} />
            </div>
            
            <h2 className="text-3xl font-extrabold text-slate-800 mb-2">Protected!</h2>
            <p className="text-slate-500 font-medium mb-4">Policy #RLUSD-882910 Active</p>
            
            <div className="flex gap-6 text-center">
              <div>
                <div className="text-lg font-bold text-emerald-600">$25,000</div>
                <div className="text-xs text-slate-400">Coverage</div>
              </div>
              <div className="w-px bg-slate-200" />
              <div>
                <div className="text-lg font-bold text-emerald-600">30 Days</div>
                <div className="text-xs text-slate-400">Threshold</div>
              </div>
              <div className="w-px bg-slate-200" />
              <div>
                <div className="text-lg font-bold text-emerald-600">XRPL</div>
                <div className="text-xs text-slate-400">Secured</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
