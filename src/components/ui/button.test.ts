import { describe, expect, it } from "vitest";
import { buttonVariants } from "@/components/ui/button";

// Links styled as buttons use buttonVariants() directly, without <Button>'s own merge.
describe("buttonVariants", () => {
  it("lets a variant's border color replace the base's transparent one", () => {
    const classes = buttonVariants({ variant: "outline" }).split(" ");
    expect(classes).toContain("border-input");
    expect(classes).not.toContain("border-transparent");
  });

  it("keeps the transparent border when the variant sets no color", () => {
    expect(buttonVariants().split(" ")).toContain("border-transparent");
  });
});
