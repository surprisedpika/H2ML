import * as htmlparser2 from "htmlparser2";
import type { CompilerOptions } from "./types";

export const defaultCompilerOptions: Required<CompilerOptions> = {
  logWarnings: true,
  logErrors: true,
  verbose: false,
  preserveComments: false,
  evaluateExpressionsInComments: false,
} as const;

export const defaultParserOptions: htmlparser2.ParserOptions = {
  xmlMode: true,
  lowerCaseTags: true,
  lowerCaseAttributeNames: true,
} as const;
