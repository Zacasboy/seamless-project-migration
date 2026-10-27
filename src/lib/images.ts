const modules = import.meta.glob<{ url: string }>("../assets/products/*.json", {
  eager: true,
  import: "default",
});

const map: Record<string, string> = {};
for (const [path, mod] of Object.entries(modules)) {
  const key = path.split("/").pop()!.replace(".json", "");
  map[key] = mod.url;
}

export function productImage(p: { image_key: string | null; image_url: string | null }) {
  if (p.image_url) return p.image_url;
  if (p.image_key && map[p.image_key]) return map[p.image_key];
  return "";
}

export const heroImage = () => map["p13"];
export const heroImage2 = () => map["p10"];