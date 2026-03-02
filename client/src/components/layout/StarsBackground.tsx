import { useEffect, useRef, useState } from "react";

export default function StarsBackground() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoLoaded, setVideoLoaded] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleCanPlay = () => setVideoLoaded(true);
    video.addEventListener("canplay", handleCanPlay);

    video.play().catch(() => {});

    return () => {
      video.removeEventListener("canplay", handleCanPlay);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${videoLoaded ? "opacity-50" : "opacity-0"}`}
      >
        <source src="/bg-video.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60" />
    </div>
  );
}
