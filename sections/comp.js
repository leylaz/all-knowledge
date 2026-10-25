/* Section: Compilers and the toolchain
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "comp"). */

section({
  id: "comp",
  name: "Compilers and the Toolchain",
  cap: "Compile, assemble, link, load",
  sections: [
    { id: "pipeline", label: "The Pipeline" },
    { id: "example", label: "The Running Example" },
    { id: "preprocess", label: "Preprocessing" },
    { id: "phases", label: "Inside the Compiler" },
    { id: "why-perf", label: "Why This Matters for Performance" }
  ],
  body: `
<p>A <strong>toolchain</strong> turns source code into a running program in five steps: <strong>preprocess, compile, assemble, link, and load</strong>. Each step produces a file the next one consumes, and each answers a different question: what does this code mean, what instructions implement it, what bits encode those instructions, where does everything live, and how does it get into memory?</p>
<h3 id="sec-pipeline">The Pipeline</h3>
<div class="tbl"><svg viewBox="0 0 380 650" role="img" aria-label="The toolchain pipeline. f.c (source code) goes into the preprocessor, producing f.i (expanded source). The compiler turns f.i into f.s (assembly). The assembler turns f.s into f.o (object file). The linker combines f.o with other object files and libraries into a.out, an ELF executable. The loader (the OS plus the dynamic linker) turns the executable into a running process." style="width:100%;max-width:380px;display:block;margin:0 auto;font-family:var(--sans)">
<defs><marker id="cmparrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker></defs>
<g style="stroke:var(--muted);stroke-width:1.5" marker-end="url(#cmparrow)">
<line x1="130" y1="46" x2="130" y2="68"/><line x1="130" y1="106" x2="130" y2="128"/><line x1="130" y1="166" x2="130" y2="188"/><line x1="130" y1="226" x2="130" y2="248"/><line x1="130" y1="286" x2="130" y2="308"/><line x1="130" y1="346" x2="130" y2="368"/><line x1="130" y1="406" x2="130" y2="428"/><line x1="130" y1="466" x2="130" y2="488"/><line x1="130" y1="526" x2="130" y2="548"/><line x1="130" y1="586" x2="130" y2="608"/>
<line x1="252" y1="392" x2="232" y2="392"/>
</g>
<g style="fill:var(--paper);stroke:var(--muted);stroke-width:1.2;stroke-dasharray:4 3">
<rect x="30" y="10" width="200" height="36" rx="18"/><rect x="30" y="130" width="200" height="36" rx="18"/><rect x="30" y="250" width="200" height="36" rx="18"/><rect x="30" y="370" width="200" height="36" rx="18"/><rect x="30" y="490" width="200" height="36" rx="18"/><rect x="254" y="364" width="118" height="56" rx="10"/>
</g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5">
<rect x="30" y="70" width="200" height="36" rx="4"/><rect x="30" y="190" width="200" height="36" rx="4"/><rect x="30" y="310" width="200" height="36" rx="4"/><rect x="30" y="430" width="200" height="36" rx="4"/><rect x="30" y="550" width="200" height="36" rx="4"/><rect x="30" y="610" width="200" height="36" rx="4" style="fill:var(--trace);"/>
</g>
<g text-anchor="middle" style="font-size:12.5px;fill:var(--ink)">
<text x="130" y="33">f.c: source code</text>
<text x="130" y="93" style="font-weight:600">Preprocessor</text>
<text x="130" y="153">f.i: expanded source</text>
<text x="130" y="213" style="font-weight:600">Compiler</text>
<text x="130" y="273">f.s: assembly</text>
<text x="130" y="333" style="font-weight:600">Assembler</text>
<text x="130" y="393">f.o: object file</text>
<text x="130" y="453" style="font-weight:600">Linker</text>
<text x="130" y="513">a.out: executable (ELF)</text>
<text x="130" y="573" style="font-weight:600">Loader (OS + dynamic linker)</text>
<text x="130" y="633" style="font-weight:600;fill:var(--paper)">Running process</text>
<text x="313" y="388" style="font-size:11.5px">other .o files,</text>
<text x="313" y="404" style="font-size:11.5px">libraries</text>
</g>
</svg></div>
<p>Dashed ovals are files; solid boxes are tools. With GCC or Clang, one command usually runs the whole pipeline, but each step can be run separately:</p>
<pre><code>gcc -E f.c -o f.i     # preprocess only
gcc -S f.c -o f.s     # compile to assembly
gcc -c f.c -o f.o     # assemble to an object file
gcc f.o -o prog       # link into an executable
./prog                # the OS loads and runs it</code></pre>
<h3 id="sec-example">The Running Example</h3>
<p>The pages in this section follow one small function through every step. It has an if-statement and a print statement:</p>
<pre><code>#include &lt;stdio.h&gt;

int f(int x) {
    int y = 0;
    if (x &gt; 10)
        y = x * 2;
    printf("x = %d\\n", x);
    return y;
}</code></pre>
<h3 id="sec-preprocess">Step 1: Preprocessing</h3>
<p>The preprocessor works on text, before any real compiling:</p>
<ul>
<li><strong>#include</strong> pastes in the contents of other files. Here, stdio.h supplies the declaration <code>int printf(const char *restrict format, ...);</code>, which is how the compiler later knows printf exists, what it returns, and that it takes a variable number of arguments. It does <em>not</em> supply printf's code; that comes from the C library at link time.</li>
<li><strong>#define</strong> macros are expanded, and <strong>#if / #ifdef</strong> blocks are kept or dropped (conditional compilation).</li>
<li>Comments are removed.</li>
</ul>
<h3 id="sec-phases">Inside the Compiler: Three Phases</h3>
<div class="tbl"><table>
<tr><th>Phase</th><th>What it does</th><th>Output</th></tr>
<tr><td>Front end</td><td><a href="#/comp-lex">Lexing</a> (characters into tokens), <a href="#/comp-lex/parse">parsing</a> (tokens into a syntax tree), and <a href="#/comp-lex/semantic">semantic analysis</a> (names and types checked)</td><td>Abstract syntax tree (AST)</td></tr>
<tr><td>Middle end</td><td>Translates the AST into an <a href="#/comp-ir">intermediate representation</a> and <a href="#/comp-opt">optimizes</a> it, independent of the target ISA</td><td>Optimized IR</td></tr>
<tr><td>Back end</td><td><a href="#/comp-ir/codegen">Instruction selection, register allocation, and instruction scheduling</a> for a specific ISA</td><td>Assembly (or object code directly)</td></tr>
</table></div>
<p>This split is why one compiler supports many languages and ISAs. In LLVM, for example, Clang (C and C++), Rust, and Swift front ends all produce the same IR, and separate back ends turn it into x86, Arm, or RISC-V code.</p>
<h3 id="sec-why-perf">Why This Matters for Performance Work</h3>
<ul>
<li><strong>The compiler sets the instruction count</strong> in the iron law, and strongly affects CPI through instruction choice, scheduling, and code layout. The same source can run very differently at <code>-O0</code> and <code>-O2</code>.</li>
<li><strong>Comparing microarchitectures fairly</strong> means fixing the binaries: same compiler, version, and flags, or ideally the exact same files (see <a href="#/ipc-spec">IPC and simulation methodology</a>).</li>
<li><strong>Linking and loading decide where code lives,</strong> which affects instruction cache and TLB behavior, and add overheads such as calls through the <a href="#/comp-plt">PLT</a>.</li>
</ul>
`,
  practice: {
    guided: [
      {
        q: `<p>Which command produces each file from <code>f.c</code>: the expanded source, the assembly, the object file, and the executable? What does each step add?</p>`,
        a: `<ol><li><code>gcc -E</code> gives <code>f.i</code>: includes pasted in and macros expanded.</li><li><code>gcc -S</code> gives <code>f.s</code>: the compiler's assembly for the target ISA.</li><li><code>gcc -c</code> gives <code>f.o</code>: machine code plus a symbol table and relocations.</li><li><code>gcc f.o -o prog</code> gives the executable: object files and libraries combined, symbols resolved, addresses fixed.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Walk through what happens between typing <code>gcc main.c -o prog</code> and <code>main</code> starting to run.</p>`,
        a: `<p>The preprocessor expands includes and macros. The compiler lexes and parses the code into an AST, checks names and types, lowers it to IR, optimizes, and generates assembly. The assembler encodes the instructions into an object file with a symbol table and relocations. The linker resolves symbols against other objects and libraries, lays out sections, applies relocations, and writes an ELF executable, leaving calls into shared libraries to go through the PLT and GOT. When run, the kernel maps the executable's segments and sets up the stack, the dynamic linker loads shared libraries and fills the GOT, and startup code at <code>_start</code> calls <code>main</code>.</p>`
      }
    ]
  }
}, [
{
  id: "comp-lex",
  region: "comp",
  title: "Lexing, Parsing, and Syntax Trees",
  sections: [{ id: "lexing", label: "Lexing: Characters into Tokens" }, { id: "parse", label: "Parsing: Tokens into a Tree" }, { id: "semantic", label: "Semantic Analysis" }],
  body: `
<p>The compiler's front end turns a stream of characters into a structure it can reason about, in three steps: <strong>lexing</strong>, <strong>parsing</strong>, and <strong>semantic analysis</strong>.</p>
<h3 id="sec-lexing">Lexing: Characters into Tokens</h3>
<p>The <strong>lexer</strong> (or scanner) reads characters and groups them into <strong>tokens</strong>, the smallest meaningful units: keywords, identifiers, literals, operators, and punctuation. Whitespace and comments are discarded. It always takes the longest match, so <code>&gt;=</code> becomes one token, not two.</p>
<p><strong>The if-statement</strong> <code>if (x &gt; 10) y = x * 2;</code> becomes 12 tokens:</p>
<div class="tbl"><table>
<tr><th>#</th><th>Text</th><th>Token kind</th></tr>
<tr><td>1</td><td><code>if</code></td><td>Keyword</td></tr>
<tr><td>2</td><td><code>(</code></td><td>Left parenthesis</td></tr>
<tr><td>3</td><td><code>x</code></td><td>Identifier</td></tr>
<tr><td>4</td><td><code>&gt;</code></td><td>Operator (greater than)</td></tr>
<tr><td>5</td><td><code>10</code></td><td>Integer literal</td></tr>
<tr><td>6</td><td><code>)</code></td><td>Right parenthesis</td></tr>
<tr><td>7</td><td><code>y</code></td><td>Identifier</td></tr>
<tr><td>8</td><td><code>=</code></td><td>Operator (assignment)</td></tr>
<tr><td>9</td><td><code>x</code></td><td>Identifier</td></tr>
<tr><td>10</td><td><code>*</code></td><td>Operator (multiply)</td></tr>
<tr><td>11</td><td><code>2</code></td><td>Integer literal</td></tr>
<tr><td>12</td><td><code>;</code></td><td>Semicolon</td></tr>
</table></div>
<p><strong>The print statement</strong> <code>printf("x = %d\\n", x);</code> becomes 7 tokens:</p>
<div class="tbl"><table>
<tr><th>#</th><th>Text</th><th>Token kind</th></tr>
<tr><td>1</td><td><code>printf</code></td><td>Identifier</td></tr>
<tr><td>2</td><td><code>(</code></td><td>Left parenthesis</td></tr>
<tr><td>3</td><td><code>"x = %d\\n"</code></td><td>String literal (the <code>\\n</code> escape becomes a single newline character)</td></tr>
<tr><td>4</td><td><code>,</code></td><td>Comma</td></tr>
<tr><td>5</td><td><code>x</code></td><td>Identifier</td></tr>
<tr><td>6</td><td><code>)</code></td><td>Right parenthesis</td></tr>
<tr><td>7</td><td><code>;</code></td><td>Semicolon</td></tr>
</table></div>
<p>Note that <code>printf</code> is an ordinary identifier, not a keyword. The compiler only knows what it is because the preprocessor pasted in its declaration from stdio.h.</p>
<h3 id="sec-parse">Parsing: Tokens into a Tree</h3>
<p>The <strong>parser</strong> checks that the tokens follow the language's grammar and builds a tree that captures their structure. A grammar rule for an if-statement looks like:</p>
<pre><code>if_statement  :=  "if" "(" expression ")" statement</code></pre>
<p>The parser also applies <strong>precedence</strong> rules: <code>*</code> binds more tightly than <code>=</code>, so <code>y = x * 2</code> means <code>y = (x * 2)</code>, not <code>(y = x) * 2</code>. The result is an <strong>abstract syntax tree (AST)</strong>. It's "abstract" because it drops tokens that only mattered for grouping, such as parentheses and semicolons; the tree's shape now carries that information.</p>
<p><strong>The AST for the if-statement:</strong></p>
<div class="tbl"><svg viewBox="0 0 480 270" role="img" aria-label="Abstract syntax tree for if (x > 10) y = x * 2. The root is an if node with two children: the condition, a greater-than node with children x and 10; and the then-branch, an assignment node with children y and a multiply node, whose children are x and 2." style="width:100%;min-width:420px;max-width:480px;display:block;font-family:var(--mono)">
<g style="stroke:var(--muted);stroke-width:1.5;fill:none">
<line x1="220" y1="40" x2="110" y2="85"/><line x1="220" y1="40" x2="330" y2="85"/>
<line x1="110" y1="115" x2="60" y2="155"/><line x1="110" y1="115" x2="160" y2="155"/>
<line x1="330" y1="115" x2="270" y2="155"/><line x1="330" y1="115" x2="390" y2="155"/>
<line x1="390" y1="185" x2="345" y2="225"/><line x1="390" y1="185" x2="435" y2="225"/>
</g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5">
<rect x="185" y="10" width="70" height="30" rx="4"/><rect x="75" y="85" width="70" height="30" rx="4"/><rect x="295" y="85" width="70" height="30" rx="4"/><rect x="355" y="155" width="70" height="30" rx="4"/>
</g>
<g style="fill:var(--paper);stroke:var(--muted);stroke-width:1.2">
<rect x="25" y="155" width="70" height="30" rx="15"/><rect x="125" y="155" width="70" height="30" rx="15"/><rect x="235" y="155" width="70" height="30" rx="15"/><rect x="310" y="225" width="70" height="30" rx="15"/><rect x="400" y="225" width="70" height="30" rx="15"/>
</g>
<g text-anchor="middle" style="font-size:14px;fill:var(--ink);font-weight:600">
<text x="220" y="30">if</text><text x="110" y="105">&gt;</text><text x="330" y="105">=</text><text x="390" y="175">*</text>
</g>
<g text-anchor="middle" style="font-size:14px;fill:var(--ink)">
<text x="60" y="175">x</text><text x="160" y="175">10</text><text x="270" y="175">y</text><text x="345" y="245">x</text><text x="435" y="245">2</text>
</g>
<g style="font-size:11px;fill:var(--pad);font-family:var(--sans);font-weight:600">
<text x="118" y="58">condition</text><text x="290" y="58">then</text>
</g>
</svg></div>
<p><strong>The AST for the print statement:</strong> a function call node whose children are the function being called and its arguments, in order.</p>
<div class="tbl"><svg viewBox="0 0 420 150" role="img" aria-label="Abstract syntax tree for printf with arguments. The root is a call node with three children: the callee, printf; argument 0, the string literal x = %d followed by a newline; and argument 1, the variable x." style="width:100%;min-width:380px;max-width:420px;display:block;font-family:var(--mono)">
<g style="stroke:var(--muted);stroke-width:1.5"><line x1="210" y1="40" x2="70" y2="95"/><line x1="210" y1="40" x2="215" y2="95"/><line x1="210" y1="40" x2="360" y2="95"/></g>
<rect x="170" y="10" width="80" height="30" rx="4" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/>
<g style="fill:var(--paper);stroke:var(--muted);stroke-width:1.2"><rect x="20" y="95" width="100" height="30" rx="15"/><rect x="145" y="95" width="140" height="30" rx="15"/><rect x="320" y="95" width="80" height="30" rx="15"/></g>
<g text-anchor="middle" style="font-size:13.5px;fill:var(--ink)"><text x="210" y="30" style="font-weight:600">call</text><text x="70" y="115">printf</text><text x="215" y="115">"x = %d\\n"</text><text x="360" y="115">x</text></g>
<g style="font-size:11px;fill:var(--pad);font-family:var(--sans);font-weight:600"><text x="92" y="66">callee</text><text x="218" y="72">arg 0</text><text x="300" y="66">arg 1</text></g>
</svg></div>
<p>The whole function becomes one larger tree: a function node for <code>f</code> containing a parameter <code>x</code> and a body block with four statements (the declaration of <code>y</code>, the if, the call, and the return).</p>
<h3 id="sec-semantic">Semantic Analysis: Names and Types</h3>
<p>A grammatically valid tree can still be meaningless, so the compiler walks the AST and checks it, using a <strong>symbol table</strong> that maps each name to what it refers to:</p>
<ul>
<li><strong>Name resolution:</strong> every identifier must be declared. <code>x</code> is the parameter, <code>y</code> the local variable, and <code>printf</code> the function declared in stdio.h. Using an undeclared name is an error here.</li>
<li><strong>Type checking:</strong> <code>x &gt; 10</code> compares two <code>int</code>s, <code>x * 2</code> produces an <code>int</code>, and assigning it to the <code>int</code> <code>y</code> is fine. For the call, the string literal matches printf's <code>const char *</code> parameter, and because printf takes a variable number of arguments, <code>x</code> is passed with the default argument rules.</li>
<li><strong>Annotation:</strong> each node is labeled with its type, and implicit conversions are made explicit, so later phases never have to guess.</li>
</ul>
<p>Errors split cleanly by phase: a character sequence that isn't any token is a <em>lexical</em> error, tokens in an order the grammar doesn't allow (a missing parenthesis) is a <em>syntax</em> error, and a well-formed tree that breaks the rules (an undeclared variable, adding a pointer to a struct) is a <em>semantic</em> error.</p>
`,
  practice: {
    guided: [
      {
        q: `<p>Tokenize <code>while (i &lt; n) i++;</code> and sketch its AST.</p>`,
        a: `<ol><li>Tokens (9): <code>while</code> (keyword), <code>(</code>, <code>i</code> (identifier), <code>&lt;</code> (operator), <code>n</code> (identifier), <code>)</code>, <code>i</code> (identifier), <code>++</code> (one operator, by longest match), <code>;</code>.</li><li>AST: a <em>while</em> node with two children: the condition, a <em>&lt;</em> node with children <code>i</code> and <code>n</code>; and the body, a <em>post-increment</em> node with child <code>i</code>. The parentheses and semicolon don't appear in the tree.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Classify each error as lexical, syntax, or semantic: (a) <code>int x = 5 @ 3;</code> (b) <code>if (x &gt; 10 y = 2;</code> (c) <code>z = x + 1;</code> where <code>z</code> was never declared.</p>`,
        a: `<ol type="a"><li>Lexical: <code>@</code> isn't a valid token in C.</li><li>Syntax: every token is valid, but the grammar requires a <code>)</code> after the condition.</li><li>Semantic: the statement is well-formed, but name resolution finds no declaration of <code>z</code>.</li></ol>`
      }
    ]
  }
},

{
  id: "comp-ir",
  region: "comp",
  title: "IR and Code Generation",
  sections: [{ id: "tac", label: "Three-Address Code" }, { id: "ssa", label: "SSA Form and LLVM IR" }, { id: "cfg", label: "Basic Blocks and the CFG" }, { id: "codegen", label: "From IR to Assembly" }],
  body: `
<p>After the front end, the compiler translates the AST into an <strong>intermediate representation (IR)</strong>: a simple, explicit form that's easy to analyze and optimize, and not tied to any ISA. The back end then turns the IR into assembly for a specific ISA.</p>
<h3 id="sec-tac">Three-Address Code</h3>
<p>Most IRs break expressions into small steps, each with at most one operation, using temporary names. For <code>f</code>, a simple version looks like:</p>
<pre><code>    y  = 0
    t1 = x &gt; 10
    if_false t1 goto L_end
    t2 = x * 2
    y  = t2
L_end:
    call printf(str0, x)      # str0 = "x = %d\\n"
    return y</code></pre>
<p>The if-statement has become a <strong>conditional jump</strong> around the then-branch: the condition is tested, and if it's false, the code skips ahead. That's exactly the form the hardware needs, since processors have branches, not if-statements.</p>
<h3 id="sec-ssa">SSA Form and LLVM IR</h3>
<p>Modern compilers use <strong>static single assignment (SSA)</strong> form: every variable is assigned exactly once, so each value has one definition that's easy to track. When control flow merges and a variable could have come from either path, a <strong>phi</strong> instruction picks the value based on which path was taken. Here is <code>f</code> in LLVM IR, as Clang produces it with optimization:</p>
<pre><code>@.str = private constant [8 x i8] c"x = %d\\0A\\00"

define i32 @f(i32 %x) {
entry:
  %cmp = icmp sgt i32 %x, 10          ; signed x &gt; 10
  br i1 %cmp, label %then, label %end
then:
  %mul = shl nsw i32 %x, 1            ; x * 2, as a shift
  br label %end
end:
  %y = phi i32 [ %mul, %then ], [ 0, %entry ]
  %call = call i32 (ptr, ...) @printf(ptr @.str, i32 %x)
  ret i32 %y
}</code></pre>
<ul>
<li>The format string became a global constant of 8 bytes: the 7 visible characters, a newline (<code>\\0A</code>), and a terminating zero byte (<code>\\00</code>).</li>
<li><code>y</code> no longer exists as a variable: it's the phi's result, either <code>%mul</code> (if the then-block ran) or 0 (if it was skipped).</li>
<li>The multiply already became a shift: an optimization (see <a href="#/comp-opt">Compiler optimizations</a>).</li>
</ul>
<h3 id="sec-cfg">Basic Blocks and the Control-Flow Graph</h3>
<p>The IR is organized into <strong>basic blocks</strong>: straight-line sequences with one entry at the top and one exit at the bottom. Branches connect them into a <strong>control-flow graph (CFG)</strong>, which most optimizations work on:</p>
<div class="tbl"><svg viewBox="0 0 360 340" role="img" aria-label="Control-flow graph for f. The entry block computes x greater than 10 and branches. Its true edge goes to the then block, which computes x times 2, and then falls into the end block. Its false edge goes directly to the end block. The end block selects y with a phi, calls printf, and returns y." style="width:100%;min-width:330px;max-width:360px;display:block;font-family:var(--mono)">
<defs><marker id="cfgarrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker></defs>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5">
<rect x="50" y="10" width="260" height="68" rx="4"/><rect x="20" y="135" width="170" height="52" rx="4"/><rect x="40" y="245" width="300" height="86" rx="4"/>
</g>
<g style="stroke:var(--muted);stroke-width:1.5;fill:none" marker-end="url(#cfgarrow)">
<line x1="120" y1="78" x2="110" y2="133"/><line x1="105" y1="187" x2="115" y2="243"/><line x1="285" y1="78" x2="285" y2="243"/>
</g>
<g style="font-size:12px;fill:var(--ink)">
<text x="60" y="30" style="font-weight:700">entry:</text><text x="60" y="48">%cmp = x &gt; 10</text><text x="60" y="66">br %cmp, then, end</text>
<text x="30" y="155" style="font-weight:700">then:</text><text x="30" y="174">%mul = x &lt;&lt; 1</text>
<text x="50" y="265" style="font-weight:700">end:</text><text x="50" y="283">%y = phi [%mul, then], [0, entry]</text><text x="50" y="301">call printf(@.str, x)</text><text x="50" y="319">ret %y</text>
</g>
<g style="font-size:11px;fill:var(--pad);font-family:var(--sans);font-weight:600"><text x="122" y="110">true</text><text x="292" y="165">false</text></g>
</svg></div>
<h3 id="sec-codegen">The Back End: From IR to Assembly</h3>
<ol>
<li><strong>Instruction selection:</strong> each IR operation is matched to target instructions. The comparison and branch become one compare-and-branch on RISC-V, or a compare plus a conditional jump on x86; <code>x * 2</code> becomes a shift (RISC-V) or an address-computation trick (x86).</li>
<li><strong>Register allocation:</strong> the IR assumes unlimited virtual registers; the real ISA has 31 or 32 (or 16 on x86-64). The allocator assigns each value a register and <em>spills</em> values to the stack when it runs out.</li>
<li><strong>Calling convention (ABI):</strong> arguments go in specific registers (RISC-V: a0, a1, ...; x86-64: rdi, rsi, ...) and the return value comes back in a0 or eax. A call may overwrite <em>caller-saved</em> registers, so any value needed after a call (here, <code>x</code> and <code>y</code> survive the printf call) is kept in a <em>callee-saved</em> register, which the function must save and restore itself.</li>
<li><strong>Instruction scheduling:</strong> instructions are reordered to hide latencies, for example moving a load earlier so its result is ready when needed.</li>
<li><strong>Emission:</strong> the final assembly text, with labels, directives, and a stack frame.</li>
</ol>
<p><strong>RISC-V (RV32) assembly for f</strong> (typical optimized output, lightly simplified):</p>
<pre><code>.LC0:   .string "x = %d\\n"         # the format string, in read-only data

f:
        addi  sp, sp, -16          # make a stack frame
        sw    ra, 12(sp)           # save the return address (the call overwrites ra)
        sw    s0, 8(sp)            # save callee-saved registers we'll use
        sw    s1, 4(sp)
        mv    s0, a0               # s0 = x  (must survive the call)
        li    s1, 0                # s1 = y = 0
        li    t0, 10
        ble   a0, t0, .L2          # if (x &lt;= 10) skip the then-branch
        slli  s1, a0, 1            # y = x &lt;&lt; 1  (x * 2)
.L2:
        lui   a0, %hi(.LC0)        # argument 0: address of the format string
        addi  a0, a0, %lo(.LC0)
        mv    a1, s0               # argument 1: x
        call  printf
        mv    a0, s1               # return value: y
        lw    ra, 12(sp)           # restore and return
        lw    s0, 8(sp)
        lw    s1, 4(sp)
        addi  sp, sp, 16
        ret</code></pre>
<p>Things to notice:</p>
<ul>
<li><strong>The condition is inverted:</strong> the source says "do the assignment if x &gt; 10"; the assembly says "skip it if x &lt;= 10." Branching around a block is the natural shape for an if without an else.</li>
<li><strong>Base + offset everywhere:</strong> the saves and restores (<code>sw ra, 12(sp)</code>) use base + offset addressing with the stack pointer as the base.</li>
<li><strong>Two instructions for an address:</strong> a 32-bit address doesn't fit in one instruction's immediate, so <code>lui</code> sets the upper 20 bits and <code>addi</code> adds the lower 12. The assembler and linker fill in <code>%hi</code> and <code>%lo</code> (see <a href="#/comp-asm/relocations">relocations</a>).</li>
<li><strong>Pseudo-instructions:</strong> <code>mv</code>, <code>li</code>, <code>ble</code>, <code>call</code>, and <code>ret</code> are assembler shorthands for real instructions; for example, <code>ble a0, t0, .L2</code> is <code>bge t0, a0, .L2</code>, and <code>ret</code> is <code>jalr x0, 0(ra)</code>.</li>
</ul>
<p><strong>x86-64 assembly for the same function,</strong> for comparison:</p>
<pre><code>.LC0:   .string "x = %d\\n"

f:
        push    rbx                    ; save callee-saved rbx (also aligns the stack)
        xor     ebx, ebx               ; y = 0
        cmp     edi, 10                ; x arrives in edi
        jle     .L2                    ; if (x &lt;= 10) skip
        lea     ebx, [rdi+rdi]         ; y = x + x, computed by the address unit
.L2:
        mov     esi, edi               ; argument 1: x
        mov     edi, OFFSET FLAT:.LC0  ; argument 0: the format string
        xor     eax, eax               ; variadic call: 0 vector registers used
        call    printf
        mov     eax, ebx               ; return value: y
        pop     rbx
        ret</code></pre>
<p>Same structure, different ISA conventions: flags set by <code>cmp</code> and tested by <code>jle</code> (RISC-V has no flags), arguments in edi and esi, and an extra rule that variadic calls report how many vector registers carry arguments.</p>
`,
  practice: {
    guided: [
      {
        q: `<p>In the RISC-V code for <code>f</code>, why is <code>x</code> copied from a0 into s0 at the start, and why must the function save and restore s0, s1, and ra?</p>`,
        a: `<ol><li>a0 is a caller-saved argument register, and the call to printf will overwrite it (printf's own first argument goes in a0). Since <code>x</code> is needed after the call setup, it's kept in s0, a callee-saved register that printf must preserve.</li><li>Because s0 and s1 are callee-saved, <code>f</code> itself must restore their old values before returning, for its own caller's sake, so it saves them on the stack.</li><li><code>call</code> writes the return address into ra, overwriting <code>f</code>'s own return address, so ra is saved too.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>What is SSA form, and why do compilers need phi instructions?</p>`,
        a: `<p>In static single assignment form, every variable is assigned exactly once, so each use has exactly one definition, which makes analyses such as constant propagation and dead code elimination simple and fast. When control flow merges, a value may come from different definitions depending on the path taken, like <code>y</code> in <code>f</code>, which is either <code>x * 2</code> or 0. A phi instruction at the merge point selects the right one based on the predecessor block. Phis don't exist in hardware; the back end turns them into register moves on the incoming edges or simply assigns both paths the same register.</p>`
      }
    ]
  }
},

{
  id: "comp-opt",
  region: "comp",
  title: "Compiler Optimizations",
  sections: [
    { id: "classic", label: "Classic Optimizations" },
    { id: "loops", label: "Loop Optimizations" },
    { id: "branches", label: "Branches and Calls" },
    { id: "back-end-opts", label: "Back-End Optimizations" },
    { id: "static-sched", label: "Static Scheduling and Compute Kernels" },
    { id: "limits", label: "What Limits the Optimizer" },
    { id: "perf-angle", label: "The Performance Angle" }
  ],
  body: `
<p>The optimizer rewrites the IR into an equivalent program that runs faster or is smaller. "Equivalent" is the key constraint: the program's observable behavior (its output, its writes to memory other code can see, its calls to other functions) must not change. Optimization levels such as <code>-O1</code>, <code>-O2</code>, and <code>-O3</code> select more aggressive sets of passes; <code>-Os</code> optimizes for size.</p>
<h3 id="sec-classic">Classic Optimizations</h3>
<div class="tbl"><table>
<tr><th>Optimization</th><th>Before</th><th>After</th><th>Why it helps</th></tr>
<tr><td>Constant folding</td><td><code>a = 4 * 8;</code></td><td><code>a = 32;</code></td><td>Computed once at compile time instead of every run</td></tr>
<tr><td>Constant propagation</td><td><code>a = 32; b = a + 1;</code></td><td><code>b = 33;</code></td><td>Known values flow forward, enabling more folding</td></tr>
<tr><td>Dead code elimination</td><td><code>t = x * 3;</code> (t never used)</td><td>(removed)</td><td>Fewer instructions</td></tr>
<tr><td>Common subexpression elimination</td><td><code>a = b*c + d; e = b*c - d;</code></td><td><code>t = b*c; a = t + d; e = t - d;</code></td><td>Compute once, reuse</td></tr>
<tr><td>Strength reduction</td><td><code>x * 2</code>, <code>x / 8</code> (unsigned)</td><td><code>x &lt;&lt; 1</code>, <code>x &gt;&gt; 3</code></td><td>Cheaper operations; in <code>f</code>, the multiply became a shift</td></tr>
<tr><td>Copy propagation</td><td><code>b = a; c = b + 1;</code></td><td><code>c = a + 1;</code></td><td>Removes moves, frees registers</td></tr>
</table></div>
<h3 id="sec-loops">Loop Optimizations</h3>
<ul>
<li><strong>Loop-invariant code motion:</strong> a computation whose inputs don't change inside the loop is moved before it, so it runs once instead of every iteration.</li>
<li><strong>Induction variable optimization:</strong> replaces expensive index math such as <code>a[i]</code> recomputing <code>base + i * 4</code> with a pointer that simply advances by 4 each iteration.</li>
<li><strong>Loop unrolling:</strong> repeats the loop body several times per iteration, cutting branch and counter overhead and exposing more independent work to an out-of-order core.</li>
<li><strong>Vectorization:</strong> turns a loop over array elements into SIMD instructions that process 4, 8, or more elements at once.</li>
<li><strong>Breaking dependency chains:</strong> with permission to reorder floating-point math (for example <code>-ffast-math</code>), a sum into one accumulator can be split into several independent accumulators, turning a latency-bound loop into a throughput-bound one (see <a href="#/perf-bottlenecks/latency-throughput">Bottleneck types</a>).</li>
</ul>
<h3 id="sec-branches">Branches and Calls</h3>
<ul>
<li><strong>If-conversion (branchless code):</strong> a short if can become a <em>select</em> with no branch at all, using a conditional move (x86 <code>cmov</code>, Arm <code>csel</code>). For <code>f</code>, <code>y = (x &gt; 10) ? x * 2 : 0</code> could be computed without branching. That removes any chance of a mispredict, at the cost of always computing both sides, so it pays off when the branch is unpredictable and both sides are cheap.</li>
<li><strong>Inlining:</strong> replaces a call with the callee's body, removing call overhead and, more importantly, letting the optimizer see both sides together. Too much inlining bloats code and hurts the instruction cache.</li>
<li><strong>Tail-call optimization:</strong> a call that's the very last thing a function does becomes a jump, reusing the stack frame.</li>
<li><strong>Library-call simplification:</strong> compilers know the standard library's meaning. <code>printf("hello\\n")</code>, with no format arguments, is commonly turned into the cheaper <code>puts("hello")</code>. Our <code>printf("x = %d\\n", x)</code> must stay a printf, because it formats a value; and it can never be removed, since printing is observable behavior.</li>
<li><strong>Code layout:</strong> hot code is placed together and likely branch paths are made fall-through, improving instruction cache, TLB, and fetch behavior.</li>
</ul>
<h3 id="sec-back-end-opts">Back-End Optimizations</h3>
<ul>
<li><strong>Register allocation:</strong> keeping values in registers instead of memory is one of the biggest wins. At <code>-O0</code>, by contrast, every variable lives on the stack: each statement loads its inputs and stores its results, so even <code>y = x * 2</code> becomes a load, a multiply, and a store.</li>
<li><strong>Instruction scheduling:</strong> reorders instructions to hide latency and avoid stalls. Essential for in-order cores; less critical, but still useful, for out-of-order cores.</li>
<li><strong>Software pipelining:</strong> overlaps iterations in the static schedule. Iteration <em>i</em> issues the loads for iteration <em>i</em> + 2 while it computes on data loaded earlier, so no instruction waits on a result produced just before it. A prologue fills the pipeline and an epilogue drains it.</li>
<li><strong>Peephole optimizations:</strong> small local rewrites of instruction sequences, such as <code>xor eax, eax</code> instead of <code>mov eax, 0</code> on x86.</li>
</ul>
<h3 id="sec-static-sched">Static Scheduling and Compute Kernels</h3>
<p>A <strong>compute kernel</strong> is a small, hot loop that does dense arithmetic over arrays, with few branches and regular memory access. Examples are a dot product, the inner loop of a matrix multiply, an FIR filter, a stencil update, and an AES round. Programs often spend most of their time in a few of these, so compilers and hand-tuned libraries (BLAS, FFTW, oneDNN) schedule them carefully.</p>
<p>When a kernel's data sits in L1, every latency is fixed and known at compile time. That's the case where static scheduling does as well as an out-of-order core. Take a dot product on a core with a 4-cycle FMA and 2 FMA pipes (Golden Cove, Zen 4):</p>
<pre><code>// 8 independent accumulators: 2 pipes × 4 cycles of latency
for (i = 0; i &lt; n; i += 8) {
    acc[0] += a[i+0] * b[i+0];
    acc[1] += a[i+1] * b[i+1];
    ...
    acc[7] += a[i+7] * b[i+7];
}</code></pre>
<p>Each <code>acc[k]</code> depends only on its own value from the previous iteration. With 8 chains, 2 FMAs issue per cycle, and <code>acc[0]</code>'s previous result is ready just as the core comes back around to it, 4 cycles later. An in-order core runs this without a single stall, at the port limit of 2 FMAs per cycle. An out-of-order core would find exactly the same schedule, so both hit the same ceiling: execution-port throughput. (In practice each <code>acc[k]</code> is a SIMD register holding 8 or 16 lanes, but the scheduling argument is the same.)</p>
<p>The static schedule stops being enough when any of its assumptions break:</p>
<ul>
<li><strong>Unknown latency:</strong> a load that misses L1 takes 15 to 400+ cycles instead of 5. The compiler can't know which, so an in-order core stalls at the first use while an out-of-order core keeps going (see <a href="#/ooo-tradeoffs">When Out-of-Order Execution Pays Off</a>).</li>
<li><strong>Register count:</strong> the number of accumulators the compiler can unroll to is capped by the architectural registers (16 YMM with AVX2, 32 ZMM with AVX-512). Register renaming lets hardware overlap iterations past that cap.</li>
<li><strong>Tuned for one core:</strong> the schedule bakes in one microarchitecture's latencies and port counts. Run the binary on a core with a longer FMA latency and the in-order core starts stalling.</li>
<li><strong>Aliasing and branches:</strong> if the compiler can't prove that stores don't overlap later loads, or the loop has data-dependent branches, it can't move work freely. Hardware checks these at run time.</li>
</ul>
<h3 id="sec-limits">What Limits the Optimizer</h3>
<ul>
<li><strong>Aliasing:</strong> if two pointers might point to the same memory, the compiler can't reorder or cache accesses through them. C's <code>restrict</code> keyword promises they don't overlap.</li>
<li><strong>Observable behavior:</strong> output, <code>volatile</code> accesses, and synchronization can't be removed or reordered freely (see <a href="#/c11-ordering">C11 memory ordering</a>).</li>
<li><strong>Floating-point rules:</strong> reassociating <code>(a + b) + c</code> changes rounding, so compilers only do it when allowed.</li>
<li><strong>Visibility:</strong> a function in another file is a black box, unless <strong>link-time optimization (LTO)</strong> lets the optimizer see the whole program at link time.</li>
<li><strong>Missing runtime knowledge:</strong> <strong>profile-guided optimization (PGO)</strong> runs the program on sample inputs, records which branches and functions are hot, then recompiles using that profile for better layout, inlining, and branch decisions.</li>
</ul>
<h3 id="sec-perf-angle">The Performance Engineer's Angle</h3>
<ul>
<li><strong>The compiler changes both terms of the iron law you'd like to hold constant:</strong> instruction count and, through scheduling and layout, CPI. When comparing hardware designs, use identical binaries.</li>
<li><strong>Target flags matter:</strong> <code>-march</code> lets the compiler use optional ISA extensions (such as AVX-512 or Arm SVE), changing the instruction mix entirely.</li>
<li><strong>Read the assembly:</strong> when a benchmark behaves strangely, the generated code (via <code>-S</code> or a disassembler) often explains it: a loop that didn't vectorize, a spill inside a hot loop, or a branch that became a conditional move.</li>
</ul>
`,
  practice: {
    guided: [
      {
        q: `<p>Which optimizations apply to this function, and what might the compiler reduce it to?</p><pre><code>int g(int n) {
    int a = 4 * 8;
    int s = 0;
    for (int i = 0; i &lt; n; i++)
        s += a * n;
    return s;
}</code></pre>`,
        a: `<ol><li>Constant folding: <code>a = 32</code>.</li><li>Constant propagation: the loop body becomes <code>s += 32 * n</code>.</li><li>Loop-invariant code motion: <code>32 * n</code> doesn't change inside the loop, so it's computed once; strength reduction makes it <code>n &lt;&lt; 5</code>.</li><li>The loop just adds the same value <code>n</code> times, so a compiler can replace it entirely with a closed form: <code>s = (n &gt; 0) ? 32 * n * n : 0</code>, with no loop at all.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Why can a change in compiler version or flags make a microarchitecture comparison misleading?</p>`,
        a: `<p>The compiler determines the instruction count and strongly affects CPI: instruction selection, vectorization, unrolling, inlining, if-conversion, and code layout all change the instruction mix, branch behavior, and cache footprint. If two hardware designs are measured with different binaries, the difference mixes compiler effects with hardware effects. Fair comparisons use identical binaries, and when the compiler itself is being evaluated, the hardware is held fixed instead.</p>`
      },
      {
        q: `<p>A BLAS kernel was tuned for Haswell (FMA latency 5 cycles, 2 FMA ports) with 10 independent accumulators. A new core raises the FMA latency to 6 cycles to reach a higher clock, still with 2 ports. The code uses AVX2, which has 16 YMM registers. What FMA throughput does the unchanged binary get on an in-order version of the new core, and on an out-of-order version? What's the fix?</p>`,
        a: `<p>Each accumulator is a loop-carried chain, so the kernel can't do better than chains / latency = 10 / 6 ≈ <strong>1.67 FMAs per cycle</strong>, against a peak of 2 (about 83%). That bound holds for <em>both</em> cores. The out-of-order core can overlap independent work, but every FMA here sits on one of the 10 chains, and no window size shortens a chain. The in-order core settles into the same steady state: it issues the 10 FMAs, then waits for the oldest chain.</p><p>The fix is in software: recompile with at least 2 × 6 = 12 accumulators, if the register file allows it. On AVX2's 16 YMM registers that leaves 4 for operands, which is tight but workable. This is a case where out-of-order hardware doesn't save a stale static schedule, because the limit is a true dependence, not a scheduling order.</p>`
      }
    ]
  }
},

{
  id: "comp-asm",
  region: "comp",
  title: "Assembling and Object Files",
  sections: [
    { id: "what-asm", label: "What the Assembler Does" },
    { id: "encode", label: "Encoding an Instruction" },
    { id: "object", label: "What's in an Object File" },
    { id: "symbols", label: "The Symbol Table" },
    { id: "relocations", label: "Relocations" }
  ],
  body: `
<p>The <strong>assembler</strong> turns assembly text into machine code and packages it, with everything the linker will need, into an <strong>object file</strong> (<code>.o</code>).</p>
<h3 id="sec-what-asm">What the Assembler Does</h3>
<ul>
<li><strong>Encodes instructions:</strong> each mnemonic and its operands become the bit pattern the ISA defines.</li>
<li><strong>Expands pseudo-instructions:</strong><ul><li><code>mv a1, s0</code> becomes <code>addi a1, s0, 0</code></li><li><code>li</code> may become one or two instructions depending on the constant's size</li><li><code>call printf</code> becomes an <code>auipc</code> and <code>jalr</code> pair</li></ul></li>
<li><strong>Resolves local labels:</strong> it computes each label's offset (often in two passes, since a branch can refer to a label that appears later), so <code>ble a0, t0, .L2</code> gets its PC-relative offset filled in.</li>
<li><strong>Places data:</strong> directives like <code>.string</code> put bytes into the right section.</li>
<li><strong>Records what it can't finish:</strong> addresses of things outside this file, or whose final location isn't known yet, become <strong>relocations</strong> for the linker.</li>
</ul>
<h3 id="sec-encode">Encoding an Instruction</h3>
<p><code>slli s1, a0, 1</code> from <code>f</code> is an I-type instruction (see <a href="#/isa-encoding">Instruction encoding</a>). s1 is register x9 and a0 is x10:</p>
<div class="tbl"><table>
<tr><th>Field</th><th>immediate (shift amount)</th><th>rs1</th><th>funct3</th><th>rd</th><th>opcode</th></tr>
<tr><td>Bits</td><td>31–20</td><td>19–15</td><td>14–12</td><td>11–7</td><td>6–0</td></tr>
<tr><td>Value</td><td>000000000001 (1)</td><td>01010 (x10, a0)</td><td>001 (shift left)</td><td>01001 (x9, s1)</td><td>0010011 (immediate arithmetic)</td></tr>
</table></div>
<p>Concatenated: 0000 0000 0001 0101 0001 0100 1001 0011 = <strong>0x00151493</strong>. Those four bytes, stored little-endian as 93 14 15 00, are what the processor's fetch stage actually reads.</p>
<h3 id="sec-object">What's in an Object File</h3>
<p>On Linux, object files, executables, and shared libraries all use the <strong>ELF</strong> format (Executable and Linkable Format). An object file contains:</p>
<div class="tbl"><table>
<tr><th>Section</th><th>Contents</th><th>For f</th></tr>
<tr><td><code>.text</code></td><td>Machine code</td><td>The instructions of <code>f</code></td></tr>
<tr><td><code>.rodata</code></td><td>Read-only data</td><td>The format string <code>"x = %d\\n"</code></td></tr>
<tr><td><code>.data</code></td><td>Initialized, writable global variables</td><td>Nothing</td></tr>
<tr><td><code>.bss</code></td><td>Zero-initialized globals; only their size is recorded, no bytes stored</td><td>Nothing</td></tr>
<tr><td><code>.symtab</code></td><td>Symbol table: names this file defines and names it uses</td><td>Defines <code>f</code>; uses <code>printf</code></td></tr>
<tr><td><code>.rela.text</code></td><td>Relocations: places in the code to patch later</td><td>The format string's address and the call to printf</td></tr>
</table></div>
<h3 id="sec-symbols">The Symbol Table</h3>
<p>The symbol table lists every name the file defines or references. Tools such as <code>readelf -s</code> or <code>nm</code> display it. For <code>f.o</code> it would show something like:</p>
<pre><code>Num  Value  Size  Type    Bind    Section  Name
  1  0x0    56    FUNC    GLOBAL  .text    f
  2  0x0    0     NOTYPE  GLOBAL  UND      printf</code></pre>
<p><code>f</code> is <strong>defined</strong> here, at offset 0 of .text. <code>printf</code> is <strong>undefined</strong> (UND): this file uses it, but its code is somewhere else. Matching every undefined symbol to a definition is the linker's job. (Sizes and offsets here are illustrative.)</p>
<h3 id="sec-relocations">Relocations</h3>
<p>The assembler doesn't know where <code>.rodata</code> will end up in memory, or where <code>printf</code> will be, so it leaves placeholder bits and records a relocation for each one: "at this offset in .text, insert this symbol's address, in this format." For <code>f</code>, roughly:</p>
<pre><code>Offset  Type                Symbol
0x1c    R_RISCV_HI20        .LC0      # upper 20 bits for the lui
0x20    R_RISCV_LO12_I      .LC0      # lower 12 bits for the addi
0x28    R_RISCV_CALL_PLT    printf    # the auipc + jalr pair for the call</code></pre>
<p>The relocation type matters because each instruction format stores address bits differently. The linker uses it to know exactly which bits to rewrite. The <code>_PLT</code> in the call's type means the call may go through the <a href="#/comp-plt">procedure linkage table</a> if printf ends up in a shared library.</p>
`,
  practice: {
    guided: [
      {
        q: `<p>Encode <code>addi a0, a0, 5</code> for RISC-V (a0 is x10).</p>`,
        a: `<ol><li>I-type fields: immediate 000000000101, rs1 01010, funct3 000 (addi), rd 01010, opcode 0010011.</li><li>Concatenated: 0000 0000 0101 0101 0000 0101 0001 0011.</li><li>Hex: <strong>0x00550513</strong>.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Why does an object file need relocations? Why can't the assembler just write in the final addresses?</p>`,
        a: `<p>The assembler sees one file at a time. It doesn't know where its sections will end up after the linker merges them with other files, or where symbols defined in other files (like <code>printf</code>) or in shared libraries will be. So it leaves placeholders and records, for each one, where it is, which symbol it refers to, and how the address bits are encoded in that instruction. The linker, which sees the whole program and decides the layout, applies them; anything that still can't be known until run time is left to the dynamic linker.</p>`
      }
    ]
  }
},

{
  id: "comp-link",
  region: "comp",
  title: "Linking",
  sections: [
    { id: "resolution", label: "Symbol Resolution" },
    { id: "relocation", label: "Relocation and Layout" },
    { id: "static-dynamic", label: "Static vs. Dynamic Linking" },
    { id: "lto", label: "Link-Time Optimization" }
  ],
  body: `
<p>The <strong>linker</strong> combines object files and libraries into one executable (or shared library). It has two core jobs: <strong>symbol resolution</strong> and <strong>relocation</strong>.</p>
<h3 id="sec-resolution">Symbol Resolution</h3>
<p>Every undefined symbol must be matched to exactly one definition. Suppose the program is <code>main.c</code>, which calls <code>f</code>, plus <code>f.c</code>:</p>
<ul>
<li><code>main.o</code> defines <code>main</code> and uses <code>f</code>.</li>
<li><code>f.o</code> defines <code>f</code> and uses <code>printf</code>.</li>
<li>The C library defines <code>printf</code>.</li>
</ul>
<p>The two classic link errors follow directly: <strong>"undefined reference"</strong> means a used symbol has no definition anywhere (a missing file or library), and <strong>"multiple definition"</strong> means two files define the same global symbol.</p>
<h3 id="sec-relocation">Relocation and Layout</h3>
<ol>
<li><strong>Merge sections:</strong> all the <code>.text</code> sections are concatenated into one, likewise <code>.rodata</code>, <code>.data</code>, and <code>.bss</code>.</li>
<li><strong>Assign addresses:</strong> the linker decides where each merged section, and therefore every symbol, lives.</li>
<li><strong>Apply relocations:</strong> it walks every relocation entry and patches in the final addresses: <code>%hi(.LC0)</code> and <code>%lo(.LC0)</code> in <code>f</code> now get real bits, and <code>main</code>'s call to <code>f</code> gets the right offset.</li>
<li><strong>Group sections into segments:</strong> sections with the same permissions are grouped into <em>segments</em>, the units the loader maps: code and read-only data in a readable-and-executable or read-only segment, writable data in a readable-and-writable one.</li>
<li><strong>Set the entry point:</strong> execution starts not at <code>main</code> but at <code>_start</code>, startup code from the C library that sets things up and then calls <code>main</code>.</li>
</ol>
<h3 id="sec-static-dynamic">Static vs. Dynamic Linking</h3>
<p>Libraries come in two forms. A <strong>static library</strong> (<code>.a</code>) is an archive of object files; the linker copies in only the members that resolve some undefined symbol. A <strong>shared library</strong> (<code>.so</code> on Linux, <code>.dylib</code> on macOS, <code>.dll</code> on Windows) stays a separate file, loaded at run time.</p>
<div class="tbl"><table>
<tr><th></th><th>Static linking</th><th>Dynamic linking</th></tr>
<tr><td>Where library code goes</td><td>Copied into the executable</td><td>Stays in the shared library, mapped in at load time</td></tr>
<tr><td>Executable size</td><td>Larger</td><td>Smaller</td></tr>
<tr><td>Memory across processes</td><td>Each process has its own copy</td><td>One physical copy of the library's code is shared by every process using it</td></tr>
<tr><td>Library updates</td><td>Require relinking</td><td>Take effect on the next run</td></tr>
<tr><td>Startup and calls</td><td>Fastest: addresses fixed at link time</td><td>Some startup work, and calls go through the <a href="#/comp-plt">PLT and GOT</a></td></tr>
<tr><td>Dependencies</td><td>Self-contained</td><td>The right library versions must be present</td></tr>
</table></div>
<p>With dynamic linking, the static linker can't finish the job: <code>printf</code>'s address isn't known until the C library is loaded, at an address that can differ on every run. The <a href="#/comp-plt">PLT and GOT</a> exist to bridge that gap.</p>
<h3 id="sec-lto">Link-Time Optimization</h3>
<p>With LTO, object files carry compiler IR instead of (or along with) machine code, and the linker runs the optimizer over the whole program at once. That allows inlining and other optimizations across files that a file-by-file compiler can't do.</p>
`,
  practice: {
    guided: [
      {
        q: `<p>A build fails with "undefined reference to f" and, separately, another with "multiple definition of counter." What's the likely cause of each?</p>`,
        a: `<ol><li><strong>Undefined reference:</strong> some object file uses <code>f</code>, but no object file or library given to the linker defines it. Usually a missing file or library on the link command, a misspelled name, or (in C++) a mismatched signature.</li><li><strong>Multiple definition:</strong> two object files each define a global <code>counter</code>. Typically a header that defines a variable (<code>int counter = 0;</code>) instead of declaring it (<code>extern int counter;</code>) is included in several files; the fix is to declare it in the header and define it in exactly one file.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>When would you prefer static linking over dynamic linking?</p>`,
        a: `<p>Static linking makes a self-contained executable: no dependency on library versions on the target machine, no PLT indirection, and slightly faster startup, which suits deployment to minimal environments, containers, embedded systems, and performance measurements where you want to remove variables. Dynamic linking saves disk space and memory (one shared copy of library code), lets libraries be updated, for example with security fixes, without relinking, and is the default on most desktop and server systems.</p>`
      }
    ]
  }
},

{
  id: "comp-plt",
  region: "comp",
  title: "Dynamic Linking: The PLT and GOT",
  sections: [
    { id: "pic", label: "Position-Independent Code" },
    { id: "got", label: "The GOT" },
    { id: "plt", label: "The PLT" },
    { id: "lazy", label: "Lazy Binding, Step by Step" },
    { id: "eager", label: "Eager Binding and RELRO" },
    { id: "plt-perf", label: "Performance and Self-Modifying Code" }
  ],
  body: `
<p>When a program calls a function in a shared library, neither the compiler nor the static linker knows where that function will be: the library is loaded at run time, and with address space layout randomization (ASLR) its address changes on every run. The <strong>GOT</strong> and <strong>PLT</strong> solve this without modifying any code at run time.</p>
<h3 id="sec-pic">Position-Independent Code</h3>
<p>Shared libraries are compiled as <strong>position-independent code (PIC)</strong>: code that works at any address. It reaches its own code and data with PC-relative addressing, so nothing in the code needs patching wherever it's loaded. That's what lets one physical copy of a library's code be shared, read-only, by every process. But addresses of things in <em>other</em> modules still have to come from somewhere, and that somewhere is the GOT.</p>
<h3 id="sec-got">The GOT (Global Offset Table)</h3>
<ul>
<li>A table of addresses in the program's (or library's) <strong>writable data</strong>, one entry per external function or global variable it uses.</li>
<li>Code reaches the GOT with PC-relative addressing, then loads the real address from the entry: an extra level of indirection.</li>
<li>The <strong>dynamic linker</strong> fills in the entries at run time. Because the GOT is data, each process gets its own copy, with addresses correct for that process's layout, while the code stays shared and unmodified.</li>
</ul>
<h3 id="sec-plt">The PLT (Procedure Linkage Table)</h3>
<p>The PLT is a set of small code stubs, one per external function. The program never calls <code>printf</code> directly; it calls <code>printf@plt</code>, whose stub jumps to whatever address the GOT entry holds. A classic x86-64 stub:</p>
<pre><code>printf@plt:
        jmp   QWORD PTR [rip + printf@GOT]   ; jump to the address stored in the GOT entry
        push  3                              ; (first call only) this function's index
        jmp   .plt0                          ; (first call only) go to the dynamic linker</code></pre>
<h3 id="sec-lazy">Lazy Binding, Step by Step</h3>
<div class="tbl"><svg viewBox="0 0 380 340" role="img" aria-label="Call flow through the PLT and GOT. Your code calls printf@plt. The PLT stub jumps to the address in the GOT entry for printf. On the first call, that address leads to the dynamic linker's resolver, which finds printf in libc.so, writes its address into the GOT entry, and jumps to printf. On later calls, the GOT entry already holds printf's address, so the stub jumps straight to printf." style="width:100%;min-width:340px;max-width:380px;display:block;font-family:var(--sans)">
<defs><marker id="pltarrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker></defs>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5">
<rect x="20" y="10" width="220" height="46" rx="4"/><rect x="20" y="96" width="220" height="46" rx="4"/><rect x="20" y="186" width="160" height="56" rx="4"/><rect x="20" y="282" width="220" height="46" rx="4"/>
</g>
<rect x="258" y="96" width="114" height="46" rx="4" style="fill:var(--paper);stroke:var(--pad);stroke-width:1.5"/>
<g style="stroke:var(--muted);stroke-width:1.5;fill:none" marker-end="url(#pltarrow)">
<line x1="130" y1="56" x2="130" y2="94"/><line x1="100" y1="142" x2="100" y2="184"/><line x1="100" y1="242" x2="100" y2="280"/><line x1="212" y1="142" x2="212" y2="280"/>
<line x1="240" y1="119" x2="256" y2="119"/>
<path d="M180,214 C 300,214 315,180 315,144" style="stroke-dasharray:5 4"/>
</g>
<g style="font-size:12.5px;fill:var(--ink)" text-anchor="middle">
<text x="130" y="30" style="font-weight:600">Your code</text><text x="130" y="47" style="font-family:var(--mono);font-size:11.5px">call printf@plt</text>
<text x="130" y="116" style="font-weight:600">PLT stub</text><text x="130" y="133" style="font-family:var(--mono);font-size:11.5px">jmp *GOT[printf]</text>
<text x="100" y="208" style="font-weight:600">Dynamic linker</text><text x="100" y="224" style="font-size:11.5px">finds printf,</text><text x="100" y="238" style="font-size:11.5px">fills the GOT entry</text>
<text x="130" y="302" style="font-weight:600">printf</text><text x="130" y="319" style="font-size:11.5px">in libc.so</text>
<text x="315" y="116" style="font-weight:600">GOT entry</text><text x="315" y="133" style="font-size:11.5px">(writable data)</text>
</g>
<g style="font-size:11px;fill:var(--pad);font-weight:600"><text x="106" y="168">1st call</text><text x="218" y="210">later</text><text x="218" y="224">calls</text><text x="250" y="240">writes</text></g>
</svg></div>
<ol>
<li><strong>First call:</strong> <code>f</code> calls <code>printf@plt</code>. The stub jumps through printf's GOT entry, which initially points back into the stub (to the <code>push</code> after the jump), so control falls through to the dynamic linker's resolver along with printf's index.</li>
<li><strong>Resolution:</strong> the resolver searches the loaded libraries, finds <code>printf</code> in the C library, and <strong>writes its address into the GOT entry</strong>.</li>
<li>The resolver then jumps to <code>printf</code>, so the first call completes normally, just slower.</li>
<li><strong>Every later call:</strong> the stub's first jump reads the GOT entry, which now holds printf's real address, and goes straight there. The cost is one extra indirect jump per call.</li>
</ol>
<p>This deferral is called <strong>lazy binding</strong>: functions the program never calls are never resolved, which speeds up startup for programs that use a small part of large libraries.</p>
<h3 id="sec-eager">Eager Binding and RELRO</h3>
<p>A writable table of function addresses is an attractive target for attackers: overwrite a GOT entry, and the next call goes wherever they choose. Many systems therefore use <strong>eager binding</strong> (resolving every entry at load time, for example with the linker flag <code>-z now</code>) together with <strong>full RELRO</strong> ("read-only after relocation"), which marks the GOT read-only once it's filled. The trade-off is slower startup for a smaller attack surface.</p>
<h3 id="sec-plt-perf">Performance and the Connection to Self-Modifying Code</h3>
<ul>
<li><strong>Cost per call:</strong> an extra jump through the PLT, which is an indirect jump predicted by the BTB (see <a href="#/branch-hazards/btb">The BTB and decode redirects</a>), plus a load from the GOT. Usually cheap, but it adds up in code that makes many small library calls. Options such as <code>-fno-plt</code> call through the GOT directly, skipping the stub, and static linking avoids both.</li>
<li><strong>Accessing global data</strong> from position-independent code also goes through the GOT, adding a load before the real access.</li>
<li><strong>Lazy binding is not self-modifying code.</strong> The resolver writes to the GOT, which is ordinary <em>data</em>; the code pages, including the PLT stubs, never change. That's the point of the design: no instruction cache invalidation or pipeline flush is needed, and the code stays read-only and shareable. Very old systems did patch call instructions directly, which had all the costs of self-modifying code.</li>
</ul>
`,
  practice: {
    guided: [
      {
        q: `<p>Trace the first and second calls to <code>printf</code> through the PLT and GOT with lazy binding.</p>`,
        a: `<ol><li><strong>First call:</strong> the code calls <code>printf@plt</code>. The stub jumps through printf's GOT entry, which still points back into the stub, so control goes to the dynamic linker's resolver with printf's index. The resolver finds <code>printf</code> in the C library, writes its address into the GOT entry, and jumps to it.</li><li><strong>Second call:</strong> the code calls <code>printf@plt</code> again. The stub's jump now reads printf's real address from the GOT and goes straight there. The only overhead is the extra indirect jump.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Is lazy binding a form of self-modifying code? Why or why not?</p>`,
        a: `<p>No. The resolver writes a function address into the GOT, which is ordinary writable data. The code itself, including the PLT stubs, never changes; the stub just reads a different value from the GOT on later calls. That's deliberate: code pages stay read-only and shared between processes, and the processor never has to flush fetched instructions or invalidate the instruction cache, as it would for genuinely self-modifying code. The only hardware effect is that the indirect jump's predicted target in the BTB may change.</p>`
      }
    ]
  }
},

{
  id: "comp-load",
  region: "comp",
  title: "Loading and Running",
  sections: [
    { id: "steps", label: "The Steps" },
    { id: "layout", label: "Memory Layout" },
    { id: "lazy-load", label: "Pages Loaded on Demand" },
    { id: "aslr", label: "ASLR" },
    { id: "functional", label: "In a Functional Model" }
  ],
  body: `
<p><strong>Loading</strong> turns an executable file into a running process. On Linux, it starts when a program calls <code>execve</code>, and it's shared between the operating system kernel and, for dynamically linked programs, the <strong>dynamic linker</strong> (<code>ld.so</code>).</p>
<h3 id="sec-steps">The Steps</h3>
<ol>
<li><strong>The kernel reads the ELF headers.</strong> The program headers list the segments to load, with their file offsets, addresses, sizes, and permissions.</li>
<li><strong>It creates a fresh address space</strong> and <strong>maps each segment</strong> into it with the right permissions: code read-and-execute, read-only data read-only, writable data read-and-write. The <code>.bss</code> area is mapped as zero-filled memory.</li>
<li><strong>It sets up the stack</strong> with the program's arguments (<code>argc</code>, <code>argv</code>), environment variables, and auxiliary information, and points the stack pointer at it.</li>
<li><strong>For a dynamically linked program,</strong> the ELF file names an "interpreter," the dynamic linker. The kernel maps it too and starts it instead of the program.</li>
<li><strong>The dynamic linker</strong> loads each needed shared library (such as the C library), applies their relocations, fills the GOT entries that must be ready (all of them with eager binding), and runs library initialization code.</li>
<li><strong>Control reaches <code>_start</code>,</strong> the program's entry point, which calls the C library's startup routine, which calls <code>main(argc, argv, envp)</code>. When <code>main</code> returns, its return value is passed to <code>exit</code>.</li>
</ol>
<h3 id="sec-layout">The Process's Memory Layout</h3>
<div class="tbl"><svg viewBox="0 0 340 370" role="img" aria-label="Typical process memory layout from high to low addresses: the stack, which grows down; free space; shared libraries and other mapped regions; free space; the heap, which grows up; then .bss, .data, .rodata, and .text at the lowest addresses. Permissions: stack, heap, bss, and data are read-write; rodata is read-only; text is read-execute." style="width:100%;max-width:340px;display:block;margin:0 auto;font-family:var(--sans)">
<g style="stroke:var(--trace);stroke-width:1.5">
<rect x="70" y="20" width="180" height="46" style="fill:var(--trace-soft)"/>
<rect x="70" y="66" width="180" height="30" style="fill:var(--paper);stroke-dasharray:4 3;stroke:var(--muted)"/>
<rect x="70" y="96" width="180" height="46" style="fill:var(--trace-soft)"/>
<rect x="70" y="142" width="180" height="30" style="fill:var(--paper);stroke-dasharray:4 3;stroke:var(--muted)"/>
<rect x="70" y="172" width="180" height="46" style="fill:var(--trace-soft)"/>
<rect x="70" y="218" width="180" height="30" style="fill:var(--trace-soft)"/>
<rect x="70" y="248" width="180" height="30" style="fill:var(--trace-soft)"/>
<rect x="70" y="278" width="180" height="30" style="fill:var(--trace-soft)"/>
<rect x="70" y="308" width="180" height="40" style="fill:var(--trace-soft)"/>
</g>
<g text-anchor="middle" style="font-size:12.5px;fill:var(--ink)">
<text x="160" y="40" style="font-weight:600">Stack</text><text x="160" y="57" style="font-size:11px">grows down ↓</text>
<text x="160" y="85" style="font-size:11px;fill:var(--muted)">free</text>
<text x="160" y="116" style="font-weight:600">Shared libraries</text><text x="160" y="133" style="font-size:11px">and other mappings</text>
<text x="160" y="161" style="font-size:11px;fill:var(--muted)">free</text>
<text x="160" y="192" style="font-weight:600">Heap</text><text x="160" y="209" style="font-size:11px">grows up ↑ (malloc)</text>
<text x="160" y="237">.bss (zeroed globals)</text>
<text x="160" y="267">.data (globals)</text>
<text x="160" y="297">.rodata (constants, strings)</text>
<text x="160" y="333" style="font-weight:600">.text (code)</text>
</g>
<g style="font-size:11px;fill:var(--pad);font-family:var(--mono)">
<text x="258" y="47">rw-</text><text x="258" y="123">r-x / rw-</text><text x="258" y="199">rw-</text><text x="258" y="237">rw-</text><text x="258" y="267">rw-</text><text x="258" y="297">r--</text><text x="258" y="333">r-x</text>
</g>
<g style="font-size:10.5px;fill:var(--muted)"><text x="4" y="30">high</text><text x="4" y="43">addresses</text><text x="4" y="330">low</text><text x="4" y="343">addresses</text></g>
</svg></div>
<p>The format string for <code>f</code> lives in .rodata, <code>f</code>'s code in .text, the C library's code in the shared-library region, and <code>f</code>'s stack frame (the saved ra, s0, s1) on the stack. The permissions come straight from the page table entries the loader sets up (see <a href="#/isa-defines/memory">Memory: endianness, consistency, and protection</a>).</p>
<h3 id="sec-lazy-load">Pages Are Loaded on Demand</h3>
<p>Mapping a segment doesn't copy it into memory. The page table entries are created as "not present," and the first access to each page causes a <strong>page fault</strong>; the OS then reads that page from the file and resumes the program. Programs therefore start quickly and only ever load the pages they use. Pages of shared library code are shared between every process that maps them.</p>
<h3 id="sec-aslr">ASLR and Position Independence</h3>
<p><strong>Address space layout randomization</strong> places the stack, heap, shared libraries, and (for position-independent executables, or PIE) the program itself at random addresses on every run, so attackers can't rely on knowing where code lives. It works because the code is position-independent and reaches external addresses through the <a href="#/comp-plt">GOT</a>.</p>
<h3 id="sec-functional">The Same Steps in a Functional Model</h3>
<p>A simulator's functional model performs a simplified version of this loading: it reads the ELF file, copies the code and data into simulated memory, sets the PC to the entry point, and sets up the stack, then starts its fetch-decode-execute loop (see <a href="#/eda-arch/func-how">How a functional model knows what the program computes</a>).</p>
`,
  practice: {
    guided: [
      {
        q: `<p>List what happens, in order, when a dynamically linked program is started with <code>execve</code>.</p>`,
        a: `<ol><li>The kernel reads the ELF program headers.</li><li>It creates a new address space and maps the segments with their permissions (code read-execute, data read-write, .bss zero-filled).</li><li>It sets up the stack with arguments, environment, and auxiliary information.</li><li>It maps the dynamic linker named in the file and starts it.</li><li>The dynamic linker loads shared libraries, applies relocations, fills the GOT as needed, and runs initializers.</li><li>Control jumps to <code>_start</code>, which calls the C library's startup code, which calls <code>main</code>. Pages are read from the file lazily, on first access, via page faults.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>What is ASLR, and what does it require from the compiled code?</p>`,
        a: `<p>Address space layout randomization loads the stack, heap, shared libraries, and position-independent executables at random addresses on each run, so attackers can't hard-code where code or data lives. It requires position-independent code: code that reaches its own functions and data with PC-relative addressing, and reaches other modules' addresses through the GOT, so the code works unmodified at any address, with only the per-process GOT holding absolute addresses.</p>`
      }
    ]
  }
}
]);
