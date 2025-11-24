// src/shared/analyzer/index.ts
import type { Issue } from "./types";
import { checkImageAlt } from "./rules/imageAlt";
import { checkButtonName } from "./rules/buttonName";
import { checkDuplicateId } from "./rules/duplicateId";
import { checkInputLabel } from "./rules/inputLabel";
import { checkLinkName } from "./rules/linkName";
import { checkHeadingOrder } from "./rules/headingOrder";
import { checkAriaHiddenFocus } from "./rules/ariaHiddenFocus";
import { checkNoPositiveTabindex } from "./rules/noPositiveTabindex";
import { checkHtmlLang } from "./rules/htmlLang";
import { checkFormControlLabel } from "./rules/formControlHasLabel";

/**
 * Run all rules and return flat list of issues.
 * Order matters somewhat — keep consistent for UI.
 */
export function analyzeCode(source: string): Issue[] {
  const issues: Issue[] = [];
  issues.push(...checkImageAlt(source));
  issues.push(...checkButtonName(source));
  issues.push(...checkDuplicateId(source));
  issues.push(...checkInputLabel(source));
  issues.push(...checkLinkName(source));
  issues.push(...checkHeadingOrder(source));
  issues.push(...checkAriaHiddenFocus(source));
  issues.push(...checkNoPositiveTabindex(source));
  issues.push(...checkHtmlLang(source));
  issues.push(...checkFormControlLabel(source));
  return issues;
}
