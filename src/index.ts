import * as htmlparser2 from "htmlparser2";
import { Parser } from "expr-eval";

import {
  defaultCompilerOptions,
  type CompilerOptions,
  type Console,
  type Repeat,
} from "./types";

const test =
  "<html><@var x='4' y='5' /><p class='test-{x + 2}'></p><p>hello</p><@var x='7' />{x - y}<div></div></html><!-- comment --><test /><@repeat count='2'><@repeat count='4'><p>hello</p></@repeat><h1>bye</h1></@repeat>";

//TODO: Changing variables inside repeat tags
//TODO: Escape variables with backslash
//TODO: Variables in tag names
//TODO: Variables in name of elements
//TODO: Templates
//TODO: Import
//TODO: <p>{something {x}</p>

function compile(input: string, opts: CompilerOptions) {
  const options = { ...defaultCompilerOptions, ...opts };

  const c: Console = {
    error: (...data: any[]) => options.logErrors && console.error(...data),
    warn: (...data: any[]) => options.logWarnings && console.warn(...data),
    log: (...data: any[]) => options.verbose && console.warn(...data),
  };

  let out = "";
  const repeat: Repeat = [];
  let variables: { [key: string]: string } = {};

  const appendToOutput = (newText: string) => {
    out += newText;
    repeat.forEach((layer) => {
      layer.content += newText;
    });
  };

  const replaceVariables = (input: string) => {
    c.log(`Finding and replacing variables in string "${input}"`);
    return input.replace(/\{([^{}]+)\}/g, (_, content) => {
      const p = new Parser();
      const expression = p.parse(content);
      return expression.evaluate(variables);
    });
  };

  const mapAttributes = (attributes: { [s: string]: string }) => {
    return Object.entries(attributes)
      .map(([key, value]) => `${key}="${replaceVariables(value)}"`)
      .join(" ");
  };

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
          appendToOutput(`<!--${data}-->`);
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
            case "@repeat":
              let count = Math.round(Number(attribs["count"])) ?? 1;
              if (count === 1) {
                c.warn(
                  "Repeat tag found with missing count attribute / count = 1"
                );
              }
              if (count < 1) {
                c.error("Repeat tag with count outside range!");
                count = 1;
              }
              repeat.push({ depth: count, content: "" });
              break;
            default:
              c.warn("Unknown H2ML tag", name, "with attributes:", attribs);
              break;
          }
        } else {
          const attributes = mapAttributes(attribs);
          const joiner = attributes ? " " : "";
          appendToOutput(`<${name}${joiner}${attributes}>`);
        }
      },
      ontext(data) {
        appendToOutput(replaceVariables(data));
      },
      onclosetag(name, isImplied) {
        switch (name) {
          case "@repeat":
            const content = repeat.pop();
            if (content === undefined) break;
            if (content.depth < 2) break;

            for (let i = 1; i < content.depth; i++) {
              appendToOutput(content.content);
            }
            break;
          case "@var":
            break;
          default:
            if (isImplied) {
              out = out.slice(0, -1) + " />";
            } else {
              appendToOutput(`</${name}>`);
            }
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
