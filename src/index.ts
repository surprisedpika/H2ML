import * as htmlparser2 from "htmlparser2";
import { Parser } from "expr-eval";

import type { CompilerOptions, Console, Repeat, AttributeSet } from "./types";
import { defaultCompilerOptions, defaultParserOptions } from "./constants";

//TODO: @template
//TODO: @import

/*//TODO
  Known bugs / unsolved edge cases

  - Should allow backslash escaping in tag names beginning with @.
  - 
*/

const makeConsole = (options: CompilerOptions): Console => {
  return {
    error: (...data: any[]) => options.logErrors && console.error(...data),
    warn: (...data: any[]) => options.logWarnings && console.warn(...data),
    log: (...data: any[]) => options.verbose && console.warn(...data),
    table: (...data: any[]) => options.verbose && console.table(...data),
  } as const;
};

// Evaluates all mathematical expressions in a given string.
// Mathematical expressions are contained within curly braces
const evaluateExpressions = (
  input: string,
  variables: AttributeSet,
  c: Console
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

// Adds to all repeat layers.
const appendToRepeatLayers = (content: string, repeat: Repeat): void => {
  // For every nested repeat tag we are currently in
  repeat.forEach((layer) => {
    // Add the content to that layer of nesting
    layer.content += content;
  });
};

const replaceRepeatTags = (
  input: string,
  options: CompilerOptions,
  parserOptions: htmlparser2.ParserOptions,
  c: Console
): string => {
  let out = "";
  const repeat: Repeat = [];

  const parser = new htmlparser2.Parser(
    {
      onparserinit() {
        c.log("Beginning Replacement of Repeat Tags");
      },
      onend() {
        c.log("Ended Replacement of Repeat Tags");
      },
      onerror(error) {
        c.error(error);
      },
      oncomment(data) {
        if (options.preserveComments) {
          const str = `<!--${data}-->`;
          out += str;
          appendToRepeatLayers(str, repeat);
        }
      },
      onopentag(name, attribs: AttributeSet, _isImplied) {
        switch (name) {
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
            repeat.push({ count: count, content: "" });
            break;
          default:
            // If not h2ml tag, simply add to output
            const attributes = mapAttributes(attribs);
            const joiner = attributes ? " " : "";
            const str = `<${name}${joiner}${attributes}>`;
            out += str;
            appendToRepeatLayers(`<${name}${joiner}${attributes}>`, repeat);
            break;
        }
      },
      ontext(data) {
        out += data;
        appendToRepeatLayers(data, repeat);
      },
      onclosetag(name, isImplied) {
        switch (name) {
          case "@repeat":
            // Remove one level of nesting
            const content = repeat.pop();
            if (content === undefined) break;
            if (content.count < 2) break;

            // For each time the content is repeated (value of count attribute) inside the currently closing repeat tag
            for (let i = 1; i < content.count; i++) {
              out += content.content;
              appendToRepeatLayers(content.content, repeat);
            }
            break;
          default:
            const str = `</${name}>`;
            out += str;
            appendToRepeatLayers(str, repeat);
            break;
        }
      },
    },
    parserOptions
  );
  parser.write(input);
  parser.end();
  return out;
};

const finishCompile = (
  input: string,
  options: CompilerOptions,
  parserOptions: htmlparser2.ParserOptions,
  c: Console
): string => {
  let out: string = "";

  const variables: AttributeSet = {};
  const ifBuffer: boolean[] = [];

  let varDepth: number = 0;
  let shouldOutput: boolean = true;

  const _evaluateExpressions = (data: string): string => {
    return evaluateExpressions(data, variables, c);
  };

  const appendToOutput = (data: string): void => {
    if (shouldOutput) {
      out += data;
    }
  };

  const parser = new htmlparser2.Parser(
    {
      onparserinit() {
        c.log("Beginning final translation");
      },
      onend() {
        c.log("Translation finished");
      },
      onerror(error) {
        c.error(error);
      },
      oncomment(data) {
        if (options.preserveComments) {
          let str = "";
          if (options.evaluateExpressionsInComments) {
            str = `<!--${_evaluateExpressions(data)}-->`;
          } else {
            str = `<!--${data}-->`;
          }
          appendToOutput(str);
        }
      },
      onopentag(name, attribs: AttributeSet, _isImplied) {
        // c.table(attribs);

        if (!name.startsWith("@")) {
          const attributes = _evaluateExpressions(mapAttributes(attribs));
          const joiner = attributes ? " " : "";
          appendToOutput(`<${name}${joiner}${attributes}>`);
        } else {
          switch (name) {
            case "@if":
              let conditionIsTrue: boolean;

              const value = attribs.condition;
              if (value == undefined) {
                c.warn(
                  "No 'condition' attribute found on @if with attributes:"
                );
                c.table(attribs);
                conditionIsTrue = true;
              } else {
                const matches = value.match(/\{([^}]+)\}/);
                if (matches == null) {
                  c.warn("Invalid 'condition' attribute found on @if", value);
                  conditionIsTrue = true;
                } else {
                  const match = matches[1];
                  const p = new Parser();
                  let expression = p.parse(match);
                  conditionIsTrue = Boolean(expression.evaluate(variables));
                }
              }
              ifBuffer.push(conditionIsTrue);
              if (!conditionIsTrue) {
                shouldOutput = false;
              }
              break;
            case "@var":
              Object.entries(attribs).map(([key, value]) => {
                const replaced = _evaluateExpressions(value);
                variables[key] = replaced;
                c.log("Variable", key, "set to", replaced);
              });
              varDepth++;
              shouldOutput = false;
              break;
            default:
              const attributes = _evaluateExpressions(mapAttributes(attribs));
              c.warn("Unknown H2ML tag", name);
              // If not h2ml tag, simply add to output
              const joiner = attributes ? " " : "";
              appendToOutput(`<${name}${joiner}${attributes}>`);
              break;
          }
        }
      },
      ontext(data) {
        appendToOutput(_evaluateExpressions(data));
      },
      onclosetag(name, isImplied) {
        switch (name) {
          case "@var":
            varDepth--;
            if (varDepth === 0 && ifBuffer[ifBuffer.length - 1]) {
              shouldOutput = true;
            }
            break;
          case "@if":
            ifBuffer.pop();
            if (varDepth === 0 && ifBuffer[ifBuffer.length - 1]) {
              shouldOutput = true;
            }
            break;
          default:
            if (isImplied && shouldOutput) {
              out = out.slice(0, -1) + "/>";
              break;
            }
            appendToOutput(`</${name}>`);
            break;
        }
      },
    },
    parserOptions
  );
  parser.write(input);
  parser.end();
  return out;
};

export default function compile(input: string, opts: CompilerOptions): string {
  const options = { ...defaultCompilerOptions, ...opts } as const;
  const c = makeConsole(options);

  let replacedRepeatTags: string = "";
  if (!input.includes("@repeat")) {
    //If there are no repeat tags, theres no point replacing all the repeat tags
    replacedRepeatTags = input;
  } else {
    replacedRepeatTags = replaceRepeatTags(
      input,
      options,
      defaultParserOptions,
      c
    );
  }

  console.log(replacedRepeatTags);

  return finishCompile(replacedRepeatTags, options, defaultParserOptions, c);
}

const test = `
<@if condition='{1 == 1}'>holy<@if condition='{1 == 2}'>guacamole</@if>frotnite</@if>`;

console.log(test);
console.log(
  compile(test, {
    logErrors: true,
    logWarnings: true,
    verbose: true,
    preserveComments: true,
    evaluateExpressionsInComments: false,
  })
);
