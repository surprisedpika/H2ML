export type CompilerOptions = {
  logWarnings?: boolean;
  logErrors?: boolean;
  verbose?: boolean;
  preserveComments?: boolean;
};

export const defaultCompilerOptions: Required<CompilerOptions> = {
  logWarnings: true,
  logErrors: true,
  verbose: false,
  preserveComments: false,
} as const;

export type Console = {
  error: (...data: any[]) => false | void;
  warn: (...data: any[]) => false | void;
  log: (...data: any[]) => false | void;
};

export type Repeat = { depth: number; content: string; variables: VariableSet }[];

export type VariableSet = { [key: string]: string };