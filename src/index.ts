import {
  defaultCompilerOptions,
  type CompilerOptions,
  type LogLevel,
} from "./types";
import * as htmlparser2 from "htmlparser2";
const test =
  "<html><!repeat class='something'><!repeat>hello</!repeat></!repeat><div></div></html>";

function logger(text: string, level: LogLevel, options: CompilerOptions) {
  switch (level) {
    case "error":
      if (
        (options.logErrors === undefined &&
          defaultCompilerOptions.logErrors === true) ||
        options.logErrors === true
      ) {
        console.error(text);
      }
      break;
    case "warn":
      if (
        (options.logWarnings === undefined &&
          defaultCompilerOptions.logWarnings === true) ||
        options.logWarnings === true
      ) {
        console.error(text);
      }
      break;
    case "log":
      break;
  }
}

function compile(input: string, options = defaultCompilerOptions) {
	if (options.logErrors === undefined) options.logErrors = defaultCompilerOptions.logErrors;
	if (options.logWarnings === undefined) options.logWarnings = defaultCompilerOptions.logWarnings;
	if (options.verbose === undefined) options.verbose = defaultCompilerOptions.verbose;
	
	const c = {
		error: (...data: any[]) => options.logErrors && console.error(data),
		warn: (...data: any[]) => options.logWarnings && console.warn(data),
		log: (...data: any[]) => options.verbose && console.warn(data),
	}
  const parser = new htmlparser2.Parser({
		onparserinit() {
			c.log("Parser initialised");
		},
    onopentag(name, attributes) {
      /*
       * This fires when a new tag is opened.
       *
       * If you don't need an aggregated `attributes` object,
       * have a look at the `onopentagname` and `onattribute` events.
       */
      if (name === "script" && attributes.type === "text/javascript") {
        console.log("JS! Hooray!");
      }
    },
    ontext(text) {
      /*
       * Fires whenever a section of text was processed.
       *
       * Note that this can fire at any point within text and you might
       * have to stitch together multiple pieces.
       */
      console.log("-->", text);
    },
    onclosetag(tagname) {
      /*
       * Fires when a tag is closed.
       *
       * You can rely on this event only firing when you have received an
       * equivalent opening tag before. Closing tags without corresponding
       * opening tags will be ignored.
       */
      if (tagname === "script") {
        console.log("That's it?!");
      }
    }
  }, {
		recognizeSelfClosing: true
	});
  parser.write(input);
  parser.end();
}

compile(test);
