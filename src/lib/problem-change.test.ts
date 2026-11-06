import assert from "node:assert/strict";
import test from "node:test";
import { isSignificantProblemTextChange } from "./problem-change";

test("minor spelling edits do not trigger re-review, while content edits do", () => {
  assert.equal(
    isSignificantProblemTextChange(
      "Xây dựng nền tảng quản lý sinh viên",
      "Xây dựng nền tảng quản lý sinh viê n",
    ),
    false,
  );
  assert.equal(
    isSignificantProblemTextChange(
      "Xây dựng nền tảng quản lý sinh viên",
      "Xây dựng nền tảng quản lý hồ sơ và tuyển nhóm sinh viên",
    ),
    true,
  );
});
