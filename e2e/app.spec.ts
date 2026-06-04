import { expect, test } from "@playwright/test";

test("renders and updates the Konva diagram", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Double Assisted Tactical Turn" })).toBeVisible();

  const canvas = page.locator("canvas").first();
  await expect(canvas).toBeVisible();

  const nonBlankPixels = await canvas.evaluate((node) => {
    const canvas = node as HTMLCanvasElement;
    const context = canvas.getContext("2d");
    if (!context) {
      return 0;
    }
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let colored = 0;
    for (let index = 0; index < data.length; index += 4) {
      if (data[index + 3] > 0 && (data[index] < 250 || data[index + 1] < 250 || data[index + 2] < 250)) {
        colored += 1;
      }
    }
    return colored;
  });
  expect(nonBlankPixels).toBeGreaterThan(500);

  await page.getByText("Hook").click();
  await expect(page.getByRole("heading", { name: "Hook" })).toBeVisible();
});
