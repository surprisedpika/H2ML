import * as htmlparser2 from "htmlparser2";
import { Parser } from "expr-eval";

import {
  defaultCompilerOptions,
  type CompilerOptions,
  type Console,
  type Repeat,
  type AttributeSet,
} from "./types";

const test =
  "<@var x='1' /><@repeat count='4'><@repeat count='4'><@var x='{x * 2}' />{x}, </@repeat></@repeat>";

// should be:
// 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536,

//TODO: Nested changing variables inside repeat tags
//TODO: Templates
//TODO: Import
//TODO: @if ?

export default function compile(input: string, opts: CompilerOptions) {
  const options = { ...defaultCompilerOptions, ...opts } as const;

  const c: Console = {
    error: (...data: any[]) => options.logErrors && console.error(...data),
    warn: (...data: any[]) => options.logWarnings && console.warn(...data),
    log: (...data: any[]) => options.verbose && console.warn(...data),
  } as const;

  let out = "";
  let isInTemplate: boolean = false;
  const repeat: Repeat = [];
  const variables: AttributeSet = {};
  const templates: { [name: string]: Template }[] = [];

  const appendToOutput = (content: string) => {
    if (!isInTemplate) {
      out += replaceVariables(content, variables);
      repeat.forEach((layer) => {
        // Object.keys(layer.variables).length != 0 &&
        //   console.table(layer.variables);
        layer.content += content;
      });
      return;
    }
  };

  const replaceVariables = (input: string, variables: AttributeSet): string => {
    c.log(`Evaluating variables in "${input}"`);
    return input.replace(
      /(\\*)\{([^{}]+)\}/g,
      (_, escapeCharacters: string, content: string) => {
        c.log(`  Match found: ${content}`);
        const numDelimiters = escapeCharacters.length;
        if (numDelimiters == 0) {
          const p = new Parser();
          const expression = p.parse(content);
          return expression.evaluate(variables);
        }
        c.log(`    Match escaped`);
        return `${"\\".repeat(numDelimiters - 1)}{${content}}`;
      }
    );
  };

  const mapAttributes = (attributes: AttributeSet) => {
    return Object.entries(attributes)
      .map(([key, value]) => `${key}="${replaceVariables(value, variables)}"`)
      .join(" ");
  };

  class Template {
    content: string;
    variables: AttributeSet;

    constructor(variables: AttributeSet, content: string) {
      this.content = content;
      this.variables = variables;
    }

    generate() {
      return replaceVariables(this.content, this.variables);
    }
  }

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
      onopentag(name, attribs: AttributeSet, _isImplied) {
        name = replaceVariables(name, variables);
        if (name.startsWith("@")) {
          switch (name) {
            case "@var":
              // console.table(attribs);
              Object.entries(attribs).map(([key, value]) => {
                repeat.forEach((layer) => {
                  layer.variables[key] = value;
                });
                const replaced = replaceVariables(value, variables);
                variables[key] = replaced;
                c.log("Variable", key, "set to", replaced);
                // console.table(variables);
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
              repeat.push({ depth: count, content: "", variables: {} });
              break;
            case "@template":
              if (isInTemplate) {
                throw new Error("Template cannot be inside another template!");
              }
              isInTemplate = true;
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
        appendToOutput(data);
      },
      onclosetag(name, isImplied) {
        if (!isImplied) {
          name = replaceVariables(name, variables);
        }

        switch (name) {
          case "@repeat":
            const content = repeat.pop();
            if (content === undefined) break;
            if (content.depth < 2) break;

            for (let i = 1; i < content.depth; i++) {
              Object.entries(content.variables).map(([name, value]) => {
                const replaced = replaceVariables(value, variables);
                variables[name] = replaced;
                c.log("Variable", name, "set to (in repeat)", replaced);
              });
              appendToOutput(content.content);
            }
            break;
          case "@template":
            if (!isInTemplate) {
              throw new Error(
                "Closing template tag without matching opening tag!"
              );
            }
            isInTemplate = false;
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