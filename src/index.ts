import * as htmlparser2 from "htmlparser2";
import { defaultCompilerOptions, type CompilerOptions, type Console } from "./types";
import { Parser } from "expr-eval";
const test =
  "<html><@repeat class='something' count=2><@var x='4' y='5'></@var><p>{x}</p><@repeat count=5><p>hello</p><@var x='7'></@var></@repeat>{x}</@repeat><div></div></html><!-- comment -->";

const mapAttributes = (attributes: { [s: string]: string }) => {
  return Object.entries(attributes)
    .map(([key, value]) => `${key}="${value}"`)
    .join(" ");
};

const replaceVariables = (
  input: string,
  variables: { [key: string]: string }
) => {
  return input.replace(/\{([^{}]+)\}/g, (_match, content) => {
    const p = new Parser();
    const expression = p.parse(content);
    return expression.evaluate(variables);
  })
};

function compile(input: string, opts: CompilerOptions) {
  const options = { ...defaultCompilerOptions, ...opts };

  const c: Console = {
    error: (...data: any[]) => options.logErrors && console.error(...data),
    warn: (...data: any[]) => options.logWarnings && console.warn(...data),
    log: (...data: any[]) => options.verbose && console.warn(...data),
  };

  let out = "";
  let variables: { [key: string]: string } = {};

  const parser = new htmlparser2.Parser(
    {
      onparserinit() {
        c.log("Parser Initialised...");
      },
      onend() {
        c.log("Parser Finished.");
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
        if (name.startsWith("@")) {
          switch (name) {
            case "@var":
              Object.entries(attribs).map(([key, value]) => {
                variables[key] = value;
                c.log("Variable", key, "set to", value);
              });
              break;
            default:
              c.warn("Unknown H2ML tag", name, "with attributes:", attribs);
              break;
          }
        } else {
          const attributes = mapAttributes(attribs);
          const joiner = attributes ? " " : "";
          out += `<${name}${joiner}${attributes}>`;
        }
      },
      ontext(data) {
        out += replaceVariables(data, variables);
      },
      onclosetag(name, _isImplied) {
        switch (name) {
          case "@var":
          case "@repeat":
            break;
          default:
            out += `</${name}>`;
            break;
        }
      },
    },
    { xmlMode: true, lowerCaseTags: true, lowerCaseAttributeNames: true }
  );
  parser.write(input);
  parser.end();
  return out;
}

console.log(test);
console.log(
  compile(test, {
    logErrors: true,
    logWarnings: true,
    verbose: true,
    preserveComments: true,
  })
);