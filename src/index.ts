import * as htmlparser2 from "htmlparser2";
import { defaultCompilerOptions, type CompilerOptions } from "./types";
const test =
  "<html><@repeat class='something' count=2><p>slay</p><@repeat count=5><p>hello</p></@repeat></@repeat><div></div></html><!-- comment -->";

const mapAttributes = (attributes: { [s: string]: string }) => {
  return Object.entries(attributes)
    .map(([key, value]) => `${key}="${value}"`)
    .join(" ");
};

function compile(input: string, opts: CompilerOptions) {
  const options = { ...defaultCompilerOptions, ...opts };

  const c = {
    error: (...data: any[]) => options.logErrors && console.error(...data),
    warn: (...data: any[]) => options.logWarnings && console.warn(...data),
    log: (...data: any[]) => options.verbose && console.warn(...data),
  };

  let out = "";

  const parser = new htmlparser2.Parser(
    {
      onparserinit() {
        c.log("Parser Initialised...");
      },
      onerror(error) {
        c.error(error);
      },
      oncomment(data) {
        if (options.preserveComments) {
          out += `<!--${data}-->`;
        }
      },
      onopentag(name, attribs, _isImplied) {
        const attributes = mapAttributes(attribs);
        const joiner = attributes ? " " : "";
        out += `<${name}${joiner}${attributes}>`
      },
      ontext(data) {
        out += data;
      },
      onclosetag(name, _isImplied) {
        out += `</${name}>`
      }
    },
    { xmlMode: true, lowerCaseTags: true, lowerCaseAttributeNames: true }
  );
  parser.write(input);
  parser.end();
  return out;
}

console.log(test);
console.log(compile(test, { logErrors: true, logWarnings: true, verbose: true, preserveComments: true }));
