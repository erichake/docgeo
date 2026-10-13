// The formula tests again, every formula and program translated to
// JavaScript from its first evaluation.
import { translateAfter } from "../../src/import/dgp_formula";

translateAfter(0);
await import("./dgp_formula.test");
