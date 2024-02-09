export type CompilerOptions = {
  logWarnings?: boolean;
  logErrors?: boolean;
  verbose?: boolean;
  preserveComments?: boolean;
  evaluateExpressionsInComments?: boolean;
};

export type Console = {
  error: (...data: any[]) => false | void;
  warn: (...data: any[]) => false | void;
  log: (...data: any[]) => false | void;
  table: (...data: any[]) => false | void;
};

export type Repeat = { count: number; content: string; }[];

export type AttributeSet = { [s: string]: string };