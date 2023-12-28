export type CompilerOptions = {
  logWarnings?: boolean;
  logErrors?: boolean;
  verbose?: boolean;
}

export const defaultCompilerOptions: Required<CompilerOptions> = {
  logWarnings: true,
  logErrors: true,
  verbose: false
}

export type LogLevel = "log" | "warn" | "error"