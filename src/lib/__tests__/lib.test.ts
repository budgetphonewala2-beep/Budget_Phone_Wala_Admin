import { describe, expect, it } from "vitest";
import { csvCell, parseCsv, toCsv } from "../csv";
import { rupees, toPaise, maskImei } from "../format";

describe("csv safety", () => {
  it("neutralises formula-looking cells", () => {
    for (const bad of ["=1+1", "+SUM(A1)", "-2+3", "@cmd", "\tx"]) expect(csvCell(bad).startsWith("'") || csvCell(bad).startsWith('"\'')).toBe(true);
  });
  it("quotes commas, quotes and newlines", () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
  });
  it("round-trips parse/toCsv", () => {
    const rows = [{ a: "1", b: "x, y" }, { a: "2", b: 'q"r' }];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});

describe("money", () => {
  it("groups the Indian way", () => {
    expect(rupees(2749900)).toBe("₹27,499");
    expect(rupees(12345600)).toBe("₹1,23,456");
    expect(rupees(150)).toBe("₹1.50");
    expect(rupees(null)).toBe("-");
  });
  it("parses rupee text to paise strictly", () => {
    expect(toPaise("27,499")).toBe(2749900);
    expect(toPaise("99.5")).toBe(9950);
    expect(toPaise("")).toBeNull();
    expect(Number.isNaN(toPaise("12abc"))).toBe(true);
  });
  it("masks IMEI to last four", () => {
    expect(maskImei("356938035643809")).toBe("•••••••••••3809");
  });
});

import { adminIdToEmail } from "../adminId";
describe("admin id", () => {
  it("keeps real emails and maps other IDs to an undeliverable address", () => {
    expect(adminIdToEmail("Owner@Shop.in")).toBe("owner@shop.in");
    expect(adminIdToEmail("BudgetPhoneWala@12344321")).toBe("budgetphonewala-12344321@admin.invalid");
    expect(adminIdToEmail("  ")).toBe("admin@admin.invalid");
  });
});
