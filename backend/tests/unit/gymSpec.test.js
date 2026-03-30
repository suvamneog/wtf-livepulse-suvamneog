import { hourMultiplier, DOW_MULT } from "../../src/db/seeds/gymSpec.js";

describe("gymSpec distribution helpers", () => {
  test("morning peak >= afternoon quiet", () => {
    expect(hourMultiplier(8)).toBeGreaterThan(hourMultiplier(15));
  });

  test("dead night is zero", () => {
    expect(hourMultiplier(2)).toBe(0);
  });

  test("DOW has weekend dip", () => {
    expect(DOW_MULT[0]).toBeLessThan(DOW_MULT[1]);
  });
});
