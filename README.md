# H2ML

An extension to HTML that improves DX, without changing the final product.

To get started, clone the git repository, run `bun install`, then `bun run ./src/index.ts`

## Maths

```H2ML
{5 + 2}
```

Compiles to:

```HTML
7
```

## Variables

```H2ML
<@var
	foo="https://www.github.com"
	bar="something"
/>
<a href="{foo}">{bar} </a>
```

Compiles to:

```HTML
<a href="https://www.github.com">something</a>
```

(I don't actually know what a valid variable name is) Valid variable names contain only alphanumeric characters, hyphens, and underscores. They are case-insensitive.

Variables can be escaped via the backslash character.

```H2ML
<p>\{foo}</p>
```

Compiles to:

```HTML
<p>{foo}</p>
```

It is up to the developer to ensure their H2ML produces valid HTML.

The compiler will only complete one pass for variables.

```H2ML
<@var
  x="}"
  y="hello"
/>
{y{x}
```

Compiles to:

```HTML
{y}
```

NOT to:

```HTML
hello
```

## Repetition

```H2ML
<@repeat count=2>
  <div class="container">
    ...
  </div>
</@repeat>
```

Compiles to:

```HTML
<div class="container">
  ...
</div>
<div class="container">
  ...
</div>
```

If the count attribute is missing, it is assumed to be 1 and a warning is logged by the compiler.

A "for" loop can be constructed using variables.

```H2ML
<ul>
  <@var i=0 />
  <@repeat count=5>
    <li>{i}</li>
    <var i={i + 1}
  </@repeat>
</ul>
```

Compiles to:

```HTML
<ul>
  <li>0</li>
  <li>1</li>
  <li>2</li>
  <li>3</li>
  <li>4</li>
</ul>
```

## Templates

```H2ML
<@template hello>
  <p>Hello, World@</p>
</@template>
<@hello />
<@hello></@hello>
```

Compiles to:

```HTML
<p>Hello, World@</p>
<p>Hello, World@</p>
```

A template name must follow the rules of variable naming. Additionally, it cannot be the same as any existing template name or H2ML tag.

Templates can be passed parameters. Parameter names must follow names for variables, and cannot be "children".

```H2ML
<@template name="hello">
  <p>{_text}</p>
</@template>

<@hello _text="world" />
```

Compiles to:

```HTML
<p>world</p>
```

Templates have a built-in "\_children" parameter.

```H2ML
<@template name="paragraph">
  <p>
    {_children}
  </p>
</@template>

<@paragraph>Hello, World</@paragraph>
```

Compiles to:

```HTML
<p>
  Hello, World
</p>
```

Templates must have a "name" attribute.

## Import

Used for importing templates and making them available in another file.

```H2ML
templates.h2ml
<@template
  name="myTemplate"
  ...
```

```H2ML
<@import
  src="./templates.h2ml@myTemplate"
/>
<@myTemplate />
```

Import statements must contain an src attribute. They can contain a name attribute. Otherwise, the original name of the imported template is used.
