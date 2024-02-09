import * as htmlparser2 from "htmlparser2";
import { Parser } from "expr-eval";

import type { CompilerOptions, Console, Repeat, AttributeSet } from "./types";

import { defaultCompilerOptions, defaultParserOptions } from "./constants";

//TODO: @var
//TODO: mathematical expressions
//TODO: Templates
//TODO: Import
//TODO: @if ?

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
        // is h2ml tag
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
  let out = "";
  const variables: AttributeSet = {};
  const _evaluateExpressions = (data: string) =>
    evaluateExpressions(data, variables, c);

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
          const str = `<!--${data}-->`;
          out += str;
        }
      },
      onopentag(name, attribs: AttributeSet, _isImplied) {
        const attributes = _evaluateExpressions(mapAttributes(attribs));
        const evaluatedName = _evaluateExpressions(name);

        if (!evaluatedName.startsWith("@")) {
          const joiner = attributes ? " " : "";
          const str = `<${name}${joiner}${attributes}>`;
          out += str;
        } else {
          switch (evaluatedName) {
            case "@var":
              Object.entries(attribs).map(([key, value]) => {
                const replaced = _evaluateExpressions(value);
                variables[key] = replaced;
                c.log("Variable", key, "set to", replaced);
              });
              break;
            default:
              c.warn("Unknown H2ML tag", name);
              // If not h2ml tag, simply add to output
              const joiner = attributes ? " " : "";
              const str = `<${evaluatedName}${joiner}${attributes}>`;
              out += str;
              break;
          }
        }
      },
      ontext(data) {
        out += _evaluateExpressions(data);
      },
      onclosetag(name, isImplied) {
        const evaluatedName = _evaluateExpressions(name);
        switch (evaluatedName) {
          case "@var":
            break;
          default:
            if (isImplied) {
              out = out.slice(0, -1) + "/>";
              break;
            }
            const str = `</${evaluatedName}>`;
            out += str;
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
<@var x='1' /><@repeat count='5'><@repeat count='5'>{x}</@repeat><@var x='{x + 1}'/></@repeat>`;

console.log(test);
console.log(
  compile(test, {
    logErrors: true,
    logWarnings: true,
    verbose: false,
    preserveComments: true,
  })
);
