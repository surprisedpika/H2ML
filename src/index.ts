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

// desired output:
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
  // const templates: { [name: string]: Template }[] = [];

  // Appends data to output. Has additional functionality for repeat tags.
  const appendToOutput = (content: string) => {
    if (!isInTemplate) {
      out += evaluateExpressions(content, variables);
      // For every nested repeat tag we are currently in
      repeat.forEach((layer) => {
        // Object.keys(layer.variables).length != 0 &&
        //   console.table(layer.variables);
        // Add the content to that layer of nesting
        layer.content += content;
      });
      return;
    }
  };

  // Evaluates all mathematical expressions in a given string.
  // Mathematical expressions are contained within curly braces
  const evaluateExpressions = (
    input: string,
    variables: AttributeSet
  ): string => {
    c.log(`Evaluating variables in "${input}"`);
    return input.replace(
      // Regex matches any content contained within curly braces, as well as any immediately preceeding backslashes
      /(\\*)\{([^{}]+)\}/g,
      (_, escapeCharacters: string, content: string) => {
        c.log(`  Match found: ${content}`);
        const numDelimiters = escapeCharacters.length;
        // If there are no backslashes, the expression is evaluated
        if (numDelimiters == 0) {
          const p = new Parser();
          const expression = p.parse(content);
          return expression.evaluate(variables);
        }
        c.log(`    Match escaped`);
        // Otherwise, remove one backslash from the count and return the actual text of the expression.
        return `${"\\".repeat(numDelimiters - 1)}{${content}}`;
      }
    );
  };

  // Converts an object of attribute names and values to a space-seperated string
  // E.G { class: "foo", id: "bar" } => "class='foo' id='bar'"
  const mapAttributes = (attributes: AttributeSet) => {
    return Object.entries(attributes)
      .map(([key, value]) => `${key}="${value}"`)
      .join(" ");
  };

  // class Template {
  //   content: string;
  //   variables: AttributeSet;

  //   constructor(variables: AttributeSet, content: string) {
  //     this.content = content;
  //     this.variables = variables;
  //   }

  //   generate() {
  //     return evaluateExpressions(this.content, this.variables);
  //   }
  // }

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
        // is h2ml tag
        if (name.startsWith("@")) {
          switch (name) {
            case "@var":
              // console.table(attribs);
              // For each variable named
              Object.entries(attribs).map(([key, value]) => {
                // Add variable to all repeat layers without evaluating. This should allow for nested repeat tags
                //TODO: Act as if the variable was changed multiple times inside nested repeat tags?
                repeat.forEach((layer) => {
                  layer.variables[key] = value;
                });
                // Change variable as usual.
                const replaced = evaluateExpressions(value, variables);
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
              repeat.push({ count: count, content: "", variables: {} });
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
          // If not h2ml tag, simply add to output
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
          name = evaluateExpressions(name, variables);
        }

        switch (name) {
          case "@repeat":
            // Remove one level of nesting
            const content = repeat.pop();
            if (content === undefined) break;
            if (content.count < 2) break;

            // For each time the content is repeated (value of count attribute) inside the currently closing repeat tag
            for (let i = 1; i < content.count; i++) {
              Object.entries(content.variables).map(([name, value]) => {
                // Evaluate all expressions as variable values may be expressions.
                // The expressions are evaluated now to allow for the changing of variables inside repeat tags
                // ^ This doesn't currently work for nested repeat tags.
                const replaced = evaluateExpressions(value, variables);
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
              // If self-closing tag, out will currently look like "...<br>". Change to "...<br/>"
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
    verbose: false,
    preserveComments: true,
  })
);
