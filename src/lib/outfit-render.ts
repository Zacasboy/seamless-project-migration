// Imagem final de um conjunto (PNG 1200×1500), igual ao quadro da loja: fundo com textura leve,
// recortes com sombra suave e as mesmas posições. Corre só no navegador do painel.
import { BACKGROUND_PAINT, type BackgroundKey, type Layout } from "@/lib/outfits";
import { loadImage } from "@/lib/cutout";

const W = 1200;
const H = 1500;

// Gerador simples e repetível (a mesma composição dá sempre a mesma textura).
function rng(seed: number) {
  let s = seed || 1;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

function paintBackground(ctx: CanvasRenderingContext2D, key: BackgroundKey) {
  const p = BACKGROUND_PAINT[key] ?? BACKGROUND_PAINT.cinza;
  const g = ctx.createLinearGradient(0, 0, W * 0.4, H);
  g.addColorStop(0, p.from);
  g.addColorStop(1, p.to);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Luz natural vinda do canto superior esquerdo.
  const light = ctx.createRadialGradient(W * 0.25, H * 0.15, 50, W * 0.4, H * 0.35, H);
  light.addColorStop(0, "rgba(255,255,255,0.16)");
  light.addColorStop(1, "rgba(0,0,0,0.06)");
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, W, H);

  const r = rng(7);
  ctx.save();
  if (p.texture === "linho") {
    // Pregas largas e suaves de um lençol.
    ctx.filter = "blur(18px)";
    for (let i = 0; i < 9; i++) {
      ctx.strokeStyle = i % 2 ? "rgba(255,255,255,0.35)" : "rgba(120,110,100,0.10)";
      ctx.lineWidth = 30 + r() * 50;
      ctx.beginPath();
      const y = r() * H;
      ctx.moveTo(-100, y);
      ctx.bezierCurveTo(W * 0.3, y + (r() - 0.5) * 400, W * 0.7, y + (r() - 0.5) * 400, W + 100, y + (r() - 0.5) * 300);
      ctx.stroke();
    }
  } else if (p.texture === "marmore") {
    ctx.filter = "blur(1.2px)";
    for (let i = 0; i < 7; i++) {
      ctx.strokeStyle = `rgba(160,132,100,${0.12 + r() * 0.18})`;
      ctx.lineWidth = 1 + r() * 3;
      ctx.beginPath();
      let x = r() * W, y = -20;
      ctx.moveTo(x, y);
      while (y < H + 20) {
        x += (r() - 0.35) * 90;
        y += 40 + r() * 80;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  } else if (p.texture === "madeira") {
    // Soalho em espinha.
    const s = 150;
    ctx.strokeStyle = "rgba(110,86,60,0.16)";
    ctx.lineWidth = 2;
    for (let y = -s; y < H + s; y += s / 2.5)
      for (let x = -s; x < W + s; x += s) {
        const up = Math.round(y / (s / 2.5)) % 2 === 0;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + s / 2, y + (up ? -s / 2 : s / 2));
        ctx.lineTo(x + s, y);
        ctx.stroke();
      }
  }
  ctx.restore();

  // Grão fino para não parecer digital.
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * 9;
    d[i] = d[i]! + n;
    d[i + 1] = d[i + 1]! + n;
    d[i + 2] = d[i + 2]! + n;
  }
  ctx.putImageData(img, 0, 0);
}

export type RenderPiece = { image: string; layout: Layout };

export async function renderOutfit(background: BackgroundKey, pieces: RenderPiece[]): Promise<string> {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("O navegador não permite desenhar imagens.");
  paintBackground(ctx, background);
  const light = background !== "cinza" && background !== "chocolate";
  const imgs = await Promise.all(pieces.map((p) => loadImage(p.image)));
  const order = pieces.map((p, i) => ({ p, img: imgs[i]! })).sort((a, b) => a.p.layout.z - b.p.layout.z);
  for (const { p, img } of order) {
    const w = (p.layout.w / 100) * W;
    const h = w * (img.naturalHeight / Math.max(1, img.naturalWidth));
    const x = (p.layout.x / 100) * W;
    const y = (p.layout.y / 100) * H;
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate((p.layout.r * Math.PI) / 180);
    if (p.layout.cutout) {
      // Duas sombras: contacto curto e difusa, como peça pousada.
      ctx.shadowColor = "rgba(0,0,0,0.20)";
      ctx.shadowBlur = 36;
      ctx.shadowOffsetY = 18;
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      ctx.shadowColor = "rgba(0,0,0,0.18)";
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 3;
    } else if (light) ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
  }
  return c.toDataURL("image/png");
}
