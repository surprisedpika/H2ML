import * as htmlparser2 from "htmlparser2";
import { defaultCompilerOptions, type CompilerOptions } from "./types";
const test =
  "<html><@repeat class='something'><@repeat>hello</@repeat></@repeat><div></div></html><!-- comment -->";

function compile(
  input: string,
  options: CompilerOptions = defaultCompilerOptions
) {
  if (options.logErrors === undefined)
    options.logErrors = defaultCompilerOptions.logErrors;
  if (options.logWarnings === undefined)
    options.logWarnings = defaultCompilerOptions.logWarnings;
  if (options.verbose === undefined)
    options.verbose = defaultCompilerOptions.verbose;

  const c = {
    error: (...data: any[]) => options.logErrors && console.error(...data),
    warn: (...data: any[]) => options.logWarnings && console.warn(...data),
    log: (...data: any[]) => options.verbose && console.warn(...data),
  };
  
  const parser = new htmlparser2.Parser({
    onparserinit() {
      c.log("Parser Initialised...");
    },
    onopentag(name, attribs, _isImplied) {
      if (name.charAt(0) === "@") {
        c.log("Found H2ML tag:", name.substring(1));
      }
    },
  }, {xmlMode: true, lowerCaseTags: true, lowerCaseAttributeNames: true})
  parser.write(input);
  parser.end();
}

compile(test, {logErrors: true, logWarnings: true, verbose: true});