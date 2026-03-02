import { useEffect, useRef } from "react";

export default function StarsBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let width = window.innerWidth;
    let height = window.innerHeight;

    canvas.width = width;
    canvas.height = height;

    interface Star {
      x: number;
      y: number;
      size: number;
      speed: number;
      opacity: number;
      pulse: number;
      pulseSpeed: number;
    }

    const stars: Star[] = [];
    const STAR_COUNT = Math.floor((width * height) / 4000);

    for (let i = 0; i < STAR_COUNT; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 2 + 0.3,
        speed: Math.random() * 0.15 + 0.02,
        opacity: Math.random() * 0.6 + 0.1,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: Math.random() * 0.02 + 0.005,
      });
    }

    interface ShootingStar {
      x: number;
      y: number;
      length: number;
      speed: number;
      opacity: number;
      angle: number;
      life: number;
      maxLife: number;
    }

    const shootingStars: ShootingStar[] = [];

    function spawnShootingStar() {
      if (shootingStars.length < 2 && Math.random() < 0.003) {
        const angle = (Math.random() * 30 + 15) * (Math.PI / 180);
        shootingStars.push({
          x: Math.random() * width * 0.8,
          y: Math.random() * height * 0.3,
          length: Math.random() * 80 + 40,
          speed: Math.random() * 4 + 3,
          opacity: 1,
          angle,
          life: 0,
          maxLife: Math.random() * 40 + 30,
        });
      }
    }

    function animate() {
      ctx!.clearRect(0, 0, width, height);

      const gradient = ctx!.createRadialGradient(
        width * 0.3, height * 0.4, 0,
        width * 0.3, height * 0.4, width * 0.8
      );
      gradient.addColorStop(0, "rgba(10, 5, 30, 1)");
      gradient.addColorStop(0.4, "rgba(5, 3, 20, 1)");
      gradient.addColorStop(0.7, "rgba(3, 2, 15, 1)");
      gradient.addColorStop(1, "rgba(2, 1, 8, 1)");
      ctx!.fillStyle = gradient;
      ctx!.fillRect(0, 0, width, height);

      const nebula1 = ctx!.createRadialGradient(
        width * 0.7, height * 0.3, 0,
        width * 0.7, height * 0.3, width * 0.25
      );
      nebula1.addColorStop(0, "rgba(60, 20, 80, 0.08)");
      nebula1.addColorStop(0.5, "rgba(40, 10, 60, 0.04)");
      nebula1.addColorStop(1, "transparent");
      ctx!.fillStyle = nebula1;
      ctx!.fillRect(0, 0, width, height);

      const nebula2 = ctx!.createRadialGradient(
        width * 0.2, height * 0.7, 0,
        width * 0.2, height * 0.7, width * 0.2
      );
      nebula2.addColorStop(0, "rgba(20, 40, 80, 0.06)");
      nebula2.addColorStop(0.5, "rgba(10, 20, 50, 0.03)");
      nebula2.addColorStop(1, "transparent");
      ctx!.fillStyle = nebula2;
      ctx!.fillRect(0, 0, width, height);

      for (const star of stars) {
        star.pulse += star.pulseSpeed;
        star.y += star.speed;
        star.x += star.speed * 0.1;

        if (star.y > height) {
          star.y = 0;
          star.x = Math.random() * width;
        }
        if (star.x > width) {
          star.x = 0;
        }

        const pulseOpacity = star.opacity * (0.6 + 0.4 * Math.sin(star.pulse));

        ctx!.beginPath();
        ctx!.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(200, 210, 255, ${pulseOpacity})`;
        ctx!.fill();

        if (star.size > 1.2) {
          ctx!.beginPath();
          ctx!.arc(star.x, star.y, star.size * 2.5, 0, Math.PI * 2);
          ctx!.fillStyle = `rgba(180, 200, 255, ${pulseOpacity * 0.15})`;
          ctx!.fill();
        }
      }

      spawnShootingStar();
      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const s = shootingStars[i];
        s.life++;
        s.x += Math.cos(s.angle) * s.speed;
        s.y += Math.sin(s.angle) * s.speed;
        s.opacity = 1 - s.life / s.maxLife;

        if (s.life >= s.maxLife) {
          shootingStars.splice(i, 1);
          continue;
        }

        const tailX = s.x - Math.cos(s.angle) * s.length;
        const tailY = s.y - Math.sin(s.angle) * s.length;

        const grad = ctx!.createLinearGradient(tailX, tailY, s.x, s.y);
        grad.addColorStop(0, `rgba(255, 255, 255, 0)`);
        grad.addColorStop(1, `rgba(255, 255, 255, ${s.opacity * 0.8})`);

        ctx!.beginPath();
        ctx!.moveTo(tailX, tailY);
        ctx!.lineTo(s.x, s.y);
        ctx!.strokeStyle = grad;
        ctx!.lineWidth = 1.5;
        ctx!.stroke();

        ctx!.beginPath();
        ctx!.arc(s.x, s.y, 2, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(255, 255, 255, ${s.opacity})`;
        ctx!.fill();
      }

      animationId = requestAnimationFrame(animate);
    }

    animate();

    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };

    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 pointer-events-none"
      style={{ opacity: 0.7 }}
    />
  );
}
