import { describe, expect, it } from "vitest";
import { parseWorkflow, prepareWorkflow } from "./comfy";

const wf = {
  "1": { class_type: "LoadImage", inputs: { image: "x.png" } },
  "2": { class_type: "CLIPTextEncode", inputs: { text: "{{descricao}}, estúdio" } },
  "3": { class_type: "KSampler", inputs: { seed: 1, steps: 20 } },
  "4": { class_type: "SaveImage", inputs: { images: ["3", 0] } },
};

describe("ComfyUI", () => {
  it("aceita só o formato API", () => {
    expect(() => parseWorkflow(JSON.stringify({ nodes: [], links: [] }))).toThrow(/Export \(API\)/);
    expect(() => parseWorkflow("{x")).toThrow();
    expect(() => parseWorkflow(JSON.stringify({ "1": wf["1"] }))).toThrow(/Save Image/);
    expect(parseWorkflow(JSON.stringify(wf))["1"]!.class_type).toBe("LoadImage");
  });
  it("troca a imagem, o texto e a semente sem alterar o original", () => {
    const out = prepareWorkflow(parseWorkflow(JSON.stringify(wf)), "pallessiani-1.png", "Mocassins castanhos");
    expect(out["1"]!.inputs["image"]).toBe("pallessiani-1.png");
    expect(out["2"]!.inputs["text"]).toBe("Mocassins castanhos, estúdio");
    expect(typeof out["3"]!.inputs["seed"]).toBe("number");
    expect(wf["1"].inputs.image).toBe("x.png");
  });
});
