import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import React, { useRef, useEffect } from 'react';

export const GradientVideo = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const frame = useCurrentFrame();
    const { width, height } = useVideoConfig();

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Gradient orbs for mesh effect - darker, more sophisticated tones
        const orbs = [
            { x: 0.1, y: 0.2, radius: 0.5, color: { h: 150, s: 45, l: 85 }, speed: 0.02 },
            { x: 0.8, y: 0.1, radius: 0.6, color: { h: 160, s: 40, l: 82 }, speed: 0.015 },
            { x: 0.5, y: 0.7, radius: 0.4, color: { h: 140, s: 35, l: 80 }, speed: 0.025 },
            { x: 0.2, y: 0.8, radius: 0.35, color: { h: 170, s: 30, l: 78 }, speed: 0.01 },
            { x: 0.9, y: 0.5, radius: 0.45, color: { h: 155, s: 38, l: 75 }, speed: 0.018 },
        ];

        // Draw background
        ctx.fillStyle = '#F0F5F0';
        ctx.fillRect(0, 0, width, height);

        // Draw soft gradient orbs
        orbs.forEach((orb) => {
            // Loop the movement using sine
            const time = frame;
            const offsetX = Math.sin(time * orb.speed) * 50;
            const offsetY = Math.cos(time * orb.speed * 0.8) * 30;

            const x = orb.x * width + offsetX;
            const y = orb.y * height + offsetY;
            const radius = orb.radius * Math.min(width, height);

            const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);

            const { h, s, l } = orb.color
            gradient.addColorStop(0, `hsla(${h}, ${s}%, ${l}%, 0.8)`);
            gradient.addColorStop(0.5, `hsla(${h}, ${s}%, ${l}%, 0.4)`);
            gradient.addColorStop(1, `hsla(${h}, ${s}%, ${l}%, 0)`);

            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);
        });

        // Subtle noise overlay for texture
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            const noise = (Math.random() - 0.5) * 5; // Slightly stronger noise for video
            data[i] = Math.min(255, Math.max(0, data[i] + noise));
            data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
            data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
        }
        ctx.putImageData(imageData, 0, 0);

    }, [frame, width, height]);

    return (
        <AbsoluteFill>
            <canvas
                ref={canvasRef}
                width={width}
                height={height}
                style={{ width: '100%', height: '100%' }}
            />
        </AbsoluteFill>
    );
};
