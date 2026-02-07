'use client'

export default function LandingGradient() {
  return (
    <div className="fixed inset-0 -z-10 bg-[#F0F5F0]">
      <video
        autoPlay
        loop
        muted
        playsInline
        className="w-full h-full object-cover opacity-60"
      >
        <source src="/gradient-bg.webm" type="video/webm" />
      </video>
    </div>
  )
}
