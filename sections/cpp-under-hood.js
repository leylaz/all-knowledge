/* Section: C++ Under the Hood
   One region of the die plus its pages, in display order.
   What the compiler and runtime turn C++ into, told for a C programmer:
   the C or assembly each feature becomes and what it costs. Usage rules
   live in the next region, Using C++ and the STL (sections/cpp-stl.js).
   Sizes and layouts are for GCC and libstdc++ on x86-64 Linux unless a
   page says otherwise. */

section({
  id: "cpph",
  name: "C++ Under the Hood",
  cap: "What the compiler and runtime turn C++ into, for a C programmer",
  sections: [{ id: "from-c", label: "Coming from C" }, { id: "pages", label: "How the Pages Fit Together" }],
  body: `
<p>Almost every C++ feature compiles to something you could have written in C: a struct, a function with an extra pointer argument, a table of function pointers, a call the compiler inserts for you. These pages show that translation for each feature, so the usage rules in <a href="#/r/stl">Using C++ and the STL</a> stop being rules to memorize. Sizes and layouts are for GCC and libstdc++ on x86-64 Linux, which follow the Itanium C++ ABI (Clang on Linux and macOS follows it too, MSVC does not).</p>
<p>The fastest way to check any of it is to compile a few lines with <code>g++ -O2 -S</code>, or paste them into Compiler Explorer (godbolt.org), and read the assembly.</p>
<h3 id="sec-from-c">Coming from C</h3>
<div class="tbl"><table>
<thead><tr><th>C habit</th><th>C++ replacement</th></tr></thead>
<tbody>
<tr><td><code>malloc</code> / <code>free</code></td><td><code>std::vector</code>, <code>std::make_unique</code></td></tr>
<tr><td><code>#define LINE 64</code></td><td><code>constexpr size_t kLine = 64;</code></td></tr>
<tr><td>function-like macros</td><td><code>constexpr</code> or <code>inline</code> functions, templates</td></tr>
<tr><td>function pointer + <code>void*</code> context</td><td>lambda, template parameter, <code>std::function</code></td></tr>
<tr><td><code>typedef struct { ... } X;</code></td><td><code>struct X { ... };</code> (the name is already a type)</td></tr>
<tr><td>out-parameters for extra results</td><td>return a <code>std::pair</code>, a struct or <code>std::optional</code></td></tr>
<tr><td><code>-1</code> as "not found"</td><td><code>std::optional</code></td></tr>
<tr><td><code>qsort</code></td><td><code>std::sort</code> (the comparator inlines)</td></tr>
<tr><td>pointer for "may modify"</td><td>reference <code>T&amp;</code> (never null, never re-bound)</td></tr>
<tr><td>variable-length arrays</td><td>not standard C++: use <code>std::vector</code></td></tr>
</tbody>
</table></div>
<h3 id="sec-pages">How the Pages Fit Together</h3>
<ul>
<li><a href="#/cpp-objects">Objects and Calls</a>: member functions and <code>this</code>, name mangling, references, where constructors and destructors run, how objects are returned, and what a move really copies.</li>
<li><a href="#/cpp-dispatch">Dispatch and Generics</a>: vtables, template instantiation and the linker, lambdas as structs, <code>std::function</code>, and <code>std::variant</code>.</li>
<li><a href="#/cpp-runtime">Runtime Machinery</a>: <code>new</code> and <code>delete</code>, exceptions and unwinding, static initialization, RTTI, the rules that differ from C, and atomics.</li>
<li><a href="#/cpp-containers">Containers in Memory</a>: the size of each container's handle, where its elements live, vector growth, short strings, nodes, smart pointers, heaps, and deques.</li>
</ul>
`,
  practice: {
    guided: [
      {
        q: `<p>A model of Arm Neoverse N1's 1,280-entry, 5-way L2 TLB uses this class on x86-64 Linux. <code>sizeof(std::vector&lt;uint64_t&gt;)</code> is 24 B with 8 B alignment, and a pointer is 8 B. Find <code>sizeof(Tlb)</code>, say which members and functions add nothing to it, and find the size of the heap block <code>tags_</code> points to after <code>tags_.resize(1280)</code>.</p><pre><code>class Tlb {
public:
    virtual ~Tlb();
    bool lookup(uint64_t va) const;
    static inline uint64_t created = 0;
private:
    uint32_t entries_;
    uint8_t  ways_;
    std::vector&lt;uint64_t&gt; tags_;
};</code></pre>`,
        a: `<ol>
<li>The virtual destructor gives every object a vptr: 8 B at offset 0 B.</li>
<li><code>entries_</code>: 4 B at offset 8 B. <code>ways_</code>: 1 B at offset 12 B. <code>tags_</code> needs 8 B alignment, so 3 B of padding follow and it sits at offset 16 B, ending at 16 B + 24 B = 40 B.</li>
<li>40 B is a multiple of the 8 B alignment, so <code>sizeof(Tlb)</code> = 40 B.</li>
<li><code>lookup</code> is an ordinary function with a hidden <code>this</code> argument, and <code>created</code> is one global shared by all objects. Neither adds a byte.</li>
<li>Heap block: 1,280 entries × 8 B/entry = 10,240 B, allocated separately from the 40 B object.</li>
</ol>`
      }
    ],
    interview: [
      {
        q: `<p>A colleague ports a C cycle-level model to C++ and says "C++ abstractions are zero-cost, so the port can't be slower." For each feature the port uses in its per-cycle loop, say whether it costs instructions compared with the C version, and why:</p><ul><li>non-virtual member functions</li><li>references instead of pointers</li><li>templates instead of macros</li><li>destructors of local objects (RAII)</li><li>exceptions that are never thrown</li><li>a virtual <code>tick()</code> per component</li><li><code>std::function</code> callbacks</li><li>passing <code>std::shared_ptr</code> by value</li></ul>`,
        a: `<ul>
<li><strong>Free:</strong> member functions are functions with <code>this</code> as the first argument, references are pointers in the ABI, and templates generate the same code a macro would (with type checks). Destructors run exactly the cleanup the C version wrote by hand, and a type with a trivial destructor gets no call at all.</li>
<li><strong>Nearly free:</strong> never-thrown exceptions add no instructions on the normal path, only tables and cold landing pads. They can still block some optimizations around calls that might throw, and they make the binary bigger.</li>
<li><strong>Costs:</strong> a virtual call is two dependent loads plus an indirect branch, and it blocks inlining unless the compiler can devirtualize. <code>std::function</code> adds an indirect call through its invoker and may heap-allocate the callable. A <code>shared_ptr</code> passed by value does an atomic increment and decrement per call, and as a type with a non-trivial destructor it is passed in memory, not in a register.</li>
<li>So the claim holds only for the first group. "Zero-cost" means "no worse than the hand-written C equivalent", and the C equivalent of a vtable or a refcount has the same cost. Assume the C version used direct calls throughout: then the last three features are real additions, and they matter only when they sit on the per-cycle path.</li>
</ul>`
      }
    ]
  }
}, [
{
  id: "cpp-objects",
  region: "cpph",
  title: "Objects and Calls",
  sections: [{ id: "this", label: "Member Functions Take a Hidden Pointer" }, { id: "mangle", label: "Names: Mangling and Overloading" }, { id: "refs", label: "References Are Pointers" }, { id: "life", label: "Where Constructors and Destructors Run" }, { id: "rvo", label: "Returning Objects" }, { id: "moves", label: "What a Move Copies" }],
  body: `
<h3 id="sec-this">Member Functions Take a Hidden Pointer</h3>
<p>A class with no virtual functions is a C struct. Its member functions are ordinary functions whose first argument is a pointer to the object, named <code>this</code>.</p>
<pre><code><span class="cm">// C++</span>
struct Counter {
    uint64_t hits, misses;
    void hit() { ++hits; }
};
c.hit();

<span class="cm">// What the compiler makes of it, written as C</span>
struct Counter { uint64_t hits, misses; };
void Counter_hit(struct Counter* this) { ++this-&gt;hits; }
Counter_hit(&amp;c);

<span class="cm">// x86-64, GCC -O2 (Intel syntax): this arrives in rdi like any first argument</span>
Counter::hit():
    add QWORD PTR [rdi], 1
    ret</code></pre>
<ul>
<li><code>sizeof(Counter)</code> is 16 B, the same as the C struct. Member functions and <code>static</code> members add no bytes, and only virtual functions add a hidden pointer (on <a href="#/cpp-dispatch/vtable">Dispatch and Generics</a>).</li>
<li>A <code>const</code> member function receives <code>const Counter* this</code>. A <code>static</code> member function receives no <code>this</code> at all.</li>
<li>A class with no virtual functions and the same access level for all data members is <em>standard-layout</em>: its layout matches the C struct, so it can be passed to C code.</li>
<li>An empty class has <code>sizeof</code> 1 B, so two objects never share an address. <code>[[no_unique_address]]</code> (C++20) lets an empty member take 0 B, which is how containers store a stateless comparator or allocator for free.</li>
</ul>
<h3 id="sec-mangle">Names: Mangling and Overloading</h3>
<p>The linker only knows flat symbol names, so the compiler encodes the namespace, class, and parameter types into each name:</p>
<pre><code>namespace sim {
    uint64_t lookup(uint64_t addr);             <span class="cm">// symbol _ZN3sim6lookupEm</span>
    uint64_t lookup(uint64_t addr, int way);    <span class="cm">// symbol _ZN3sim6lookupEmi</span>
}

$ c++filt _ZN3sim6lookupEmi
sim::lookup(unsigned long, int)</code></pre>
<ul>
<li>Overloading is resolved at compile time. The two <code>lookup</code>s are two unrelated functions with different symbols. <code>m</code> is <code>unsigned long</code> (what <code>uint64_t</code> is on Linux) and <code>i</code> is <code>int</code>.</li>
<li><code>nm -C</code> and <code>objdump -C</code> demangle for you. An "undefined reference" linker error shows the demangled signature, so a mismatch in one parameter type is visible there.</li>
<li><code>extern "C"</code> turns mangling off, so C code can call the function and C++ can call C. The price is one function per name, with no overloads. Headers shared with C wrap their declarations in <code>#ifdef __cplusplus extern "C" { #endif</code>.</li>
<li>MSVC mangles with a different scheme and lays out classes differently, so C++ object files from MSVC and GCC don't link together. A C interface is the portable boundary.</li>
</ul>
<h3 id="sec-refs">References Are Pointers</h3>
<pre><code>void bump(uint64_t&amp; x) { ++x; }      <span class="cm">// identical code to</span>
void bump(uint64_t* x) { ++*x; }     <span class="cm">// this: the caller passes &amp;x in rdi</span></code></pre>
<ul>
<li>In the ABI a reference is a pointer. The differences are compile-time rules: a reference must be bound when it is created, can't be re-pointed, and can't legally be null (binding one to <code>*nullptr</code> is undefined behavior).</li>
<li>Binding <code>const T&amp;</code> to a temporary makes the compiler create the temporary in the caller's stack frame and pass its address.</li>
<li>That is why small values go by value: <code>const uint64_t&amp;</code> forces the caller to store the value to memory and the callee to load it back, while <code>uint64_t</code> stays in a register. The compiler also has to assume a reference may alias other memory, which can block optimizations.</li>
</ul>
<h3 id="sec-life">Where Constructors and Destructors Run</h3>
<p>RAII is not a runtime mechanism. The compiler inserts the constructor call where the object is defined and a destructor call on every path out of its scope:</p>
<pre><code>void step() {
    Cache l1(1024, 8);       <span class="cm">// Cache::Cache(&amp;l1, 1024, 8)</span>
    if (stall()) return;     <span class="cm">// Cache::~Cache(&amp;l1) inserted before this return</span>
    tick(l1);                <span class="cm">// and on the cleanup path if tick throws</span>
}                            <span class="cm">// and here</span></code></pre>
<ul>
<li><strong>Construction order:</strong> base classes, then members in declaration order, then the constructor body. Destruction runs the destructor body, then members in reverse declaration order, then bases.</li>
<li><strong>Temporaries</strong> die at the end of the full expression, the semicolon. <code>const char* p = name().c_str();</code> leaves <code>p</code> pointing into a string that was already freed. Binding a temporary directly to a local <code>const T&amp;</code> or <code>T&amp;&amp;</code> extends its life to the reference's scope.</li>
<li><strong>Trivial types cost nothing.</strong> A struct whose members are all scalars or arrays of scalars, with no user-written constructor or destructor, gets no calls inserted, exactly as in C. <code>std::is_trivially_destructible_v&lt;T&gt;</code> tells you which case you're in.</li>
<li><strong>Storage and lifetime are separate.</strong> A local's stack slot exists for the whole function frame, but the object's lifetime runs only from its constructor to its destructor.</li>
</ul>
<h3 id="sec-rvo">Returning Objects</h3>
<p>The x86-64 System V ABI returns a trivially copyable struct of up to 16 B in <code>rax</code> and <code>rdx</code>. Anything larger, or any type with a non-trivial copy constructor, move constructor or destructor, is returned through a hidden pointer: the caller reserves the space and passes its address as an extra first argument.</p>
<pre><code>std::vector&lt;Inst&gt; decode(const Block&amp; b) {   <span class="cm">// really: void decode(std::vector&lt;Inst&gt;* ret, const Block* b)</span>
    std::vector&lt;Inst&gt; out;                    <span class="cm">// built directly in *ret</span>
    for (...) out.push_back(...);
    return out;                               <span class="cm">// nothing to copy or move</span>
}
auto v = decode(blk);                         <span class="cm">// &amp;v is passed as ret</span></code></pre>
<ul>
<li><strong>Guaranteed elision (C++17):</strong> returning a temporary (<code>return Inst{...};</code>) always constructs it straight into the caller's slot. It works even for types that can't be copied or moved.</li>
<li><strong>Named return value optimization (NRVO):</strong> returning a named local, as above, is elided when every return statement returns the same object. It's allowed but not guaranteed, and GCC and Clang do it in that case. If it isn't elided, the return is a move.</li>
<li><code>return std::move(out);</code> turns NRVO off and forces a move. GCC's <code>-Wpessimizing-move</code> (in <code>-Wall</code>) warns about it.</li>
</ul>
<h3 id="sec-moves">What a Move Copies</h3>
<pre><code>std::vector&lt;uint64_t&gt; a(2'000'000);
auto b = a;              <span class="cm">// copy: malloc 16,000,000 B, then copy every element</span>
auto c = std::move(a);   <span class="cm">// move: copy 3 pointers, then null out a's 3 pointers</span>

<span class="cm">// vector's move constructor, written as C</span>
c.begin = a.begin;  c.end = a.end;  c.cap = a.cap;
a.begin = a.end = a.cap = NULL;</code></pre>
<ul>
<li><strong>Value categories decide which overload runs.</strong> An <em>lvalue</em> has a name and an address (<code>a</code>, <code>v[i]</code>). A <em>prvalue</em> is a temporary being created (<code>f()</code>, <code>x + 1</code>). An <em>xvalue</em> is an object about to expire, which is what <code>std::move(a)</code> produces. Rvalues (prvalues and xvalues) bind to a <code>T&amp;&amp;</code> overload, such as the move constructor. Lvalues bind to <code>const T&amp;</code>, such as the copy constructor.</li>
<li><code>std::move</code> is <code>static_cast&lt;T&amp;&amp;&gt;</code>: zero instructions. All the work is in the move constructor it selects.</li>
<li>A move is cheaper than a copy only when the object owns something through a pointer. Moving an <code>int</code>, a plain struct, or a <code>std::array&lt;uint64_t, 1024&gt;</code> copies all its bytes (8,192 B for the array), the same as a copy.</li>
<li>The moved-from object is "valid but unspecified". It must still be destructible and assignable. In practice a moved-from <code>vector</code> or <code>string</code> is empty.</li>
<li>A named <code>T&amp;&amp;</code> parameter is itself an lvalue, so passing it on requires <code>std::move</code> again, or <code>std::forward</code> in a template.</li>
</ul>
`,
  practice: {
    guided: [
      {
        q: `<p>A trace-driven model of Zen 5 holds 100,000,000 trace records in a <code>std::vector&lt;TraceRec&gt;</code> with <code>sizeof(TraceRec)</code> = 32 B. A <code>vector</code> object is 3 pointers of 8 B each. <code>load_trace</code> builds one local vector named <code>out</code> and every return statement returns <code>out</code>. Count the element bytes copied and the large allocations in this code, then fix it.</p><pre><code>class Sim {
    std::vector&lt;TraceRec&gt; trace_;
public:
    explicit Sim(std::vector&lt;TraceRec&gt; trace) : trace_(trace) {}
};
auto t = load_trace(path);
Sim sim(t);</code></pre>`,
        a: `<ol>
<li><code>auto t = load_trace(path);</code>: every return returns the same named local, so NRVO builds <code>out</code> directly in <code>t</code>. 0 B copied.</li>
<li><code>Sim sim(t);</code>: <code>t</code> is an lvalue, so the by-value parameter <code>trace</code> is copy-constructed: one allocation of 100,000,000 records × 32 B/record = 3,200,000,000 B, and the same number of bytes copied.</li>
<li><code>trace_(trace)</code>: a named parameter is an lvalue too, so <code>trace_</code> is copy-constructed again: a second 3,200,000,000 B allocation and copy.</li>
<li>Total: 2 allocations and 2 × 3,200,000,000 B = 6,400,000,000 B copied. Until the constructor returns and <code>trace</code> is destroyed, three copies exist at once: 3 × 3,200,000,000 B = 9,600,000,000 B.</li>
<li>Fix: <code>Sim sim(std::move(t));</code> and <code>trace_(std::move(trace))</code>. Each step now copies 3 pointers × 8 B/pointer = 24 B and allocates nothing. If the caller still needs <code>t</code>, take <code>const std::vector&lt;TraceRec&gt;&amp;</code> and store a pointer or a <code>std::span</code> instead of a copy.</li>
</ol>`
      }
    ],
    interview: [
      {
        q: `<p>On x86-64 Linux with GCC, a memory model's hot path calls <code>void enqueue(std::unique_ptr&lt;Req&gt; r)</code> millions of times per second. A colleague notes that <code>sizeof(std::unique_ptr&lt;Req&gt;)</code> is 8 B, the same as <code>Req*</code>, and concludes that the call costs the same as <code>void enqueue(Req* r)</code>. Is that right? What does the call compile to, and when is each signature the right one?</p>`,
        a: `<ul>
<li><strong>It is not the same.</strong> <code>unique_ptr</code> has a non-trivial destructor, and the Itanium ABI passes such types in memory, never in a register. The caller materializes the <code>unique_ptr</code> in its own stack frame, passes its address in <code>rdi</code>, and the callee loads the pointer from there.</li>
<li><strong>The caller also destroys it.</strong> In the Itanium ABI the caller runs the parameter's destructor after the call returns: a load, a null check, and a call to <code>delete</code> if <code>enqueue</code> didn't move from it. That code is on the normal path, plus a landing pad for the exception path.</li>
<li><strong>The raw pointer</strong> is passed in <code>rdi</code> with no store, no load, and no cleanup. Assuming <code>enqueue</code> isn't inlined, that is a few instructions and a stack round trip saved per call, and more when the call is inlined into code the compiler could otherwise keep in registers.</li>
<li><strong>When to use which:</strong> pass <code>unique_ptr</code> by value only when the function takes ownership, which is exactly what the signature documents. When it only uses the object, pass <code>Req&amp;</code> or <code>Req*</code>. In a simulator's hot path, an index into a preallocated request pool avoids both the ownership traffic and the per-request allocation.</li>
</ul>`
      }
    ]
  }
},
{
  id: "cpp-dispatch",
  region: "cpph",
  title: "Dispatch and Generics",
  sections: [{ id: "vtable", label: "Virtual Functions: The vptr and the Vtable" }, { id: "templates", label: "Templates: One Copy per Type" }, { id: "lambdas", label: "Lambdas Are Structs" }, { id: "function", label: "std::function: Type Erasure" }, { id: "variant", label: "std::variant: A Tagged Union" }],
  body: `
<h3 id="sec-vtable">Virtual Functions: The vptr and the Vtable</h3>
<pre><code>struct Component {
    virtual ~Component();
    virtual void tick() = 0;
    uint64_t cycles;
};
struct Core : Component { void tick() override; };

<span class="cm">// Written as C</span>
struct Component_vtbl {
    void (*dtor_complete)(void* self);   <span class="cm">// destroy only</span>
    void (*dtor_deleting)(void* self);   <span class="cm">// destroy, then operator delete</span>
    void (*tick)(void* self);
};
struct Component { const struct Component_vtbl* vptr; uint64_t cycles; };
p-&gt;vptr-&gt;tick(p);

<span class="cm">// p-&gt;tick() at -O2, p in rdi</span>
mov rax, QWORD PTR [rdi]         <span class="cm">// load the vptr</span>
call QWORD PTR [rax+16]          <span class="cm">// load slot 2 and call through it</span></code></pre>
<div class="tbl"><svg viewBox="0 0 520 215" role="img" aria-label="A Core object of 16 bytes holds a vptr at offset 0 and cycles at offset 8. The vptr points into Core's vtable in read-only data, past two header entries, offset-to-top and the typeinfo pointer. From there the slots are the complete destructor at rax, the deleting destructor at rax plus 8, and Core::tick at rax plus 16." style="max-width:520px">
<defs><marker id="vtarrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker></defs>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5">
<rect x="20" y="90" width="120" height="30"/><rect x="20" y="120" width="120" height="30"/>
</g>
<g style="fill:var(--paper);stroke:var(--muted);stroke-width:1.2">
<rect x="230" y="30" width="190" height="30" style="stroke-dasharray:4 3"/><rect x="230" y="60" width="190" height="30" style="stroke-dasharray:4 3"/>
<rect x="230" y="90" width="190" height="30"/><rect x="230" y="120" width="190" height="30"/><rect x="230" y="150" width="190" height="30"/>
</g>
<line x1="140" y1="105" x2="228" y2="105" style="stroke:var(--muted);stroke-width:1.5" marker-end="url(#vtarrow)"/>
<g style="fill:var(--ink);font-size:12px;text-anchor:middle">
<text x="80" y="80" style="font-weight:600">Core object, 16 B</text>
<text x="80" y="110">vptr</text><text x="80" y="140">cycles</text>
<text x="325" y="20" style="font-weight:600">Core's vtable (.rodata)</text>
<text x="325" y="50">offset-to-top = 0</text><text x="325" y="80">&amp;typeinfo for Core</text>
<text x="325" y="110">&amp;Core::~Core (complete)</text><text x="325" y="140">&amp;Core::~Core (deleting)</text><text x="325" y="170">&amp;Core::tick</text>
</g>
<g style="fill:var(--muted);font-size:11px">
<text x="428" y="110">[rax]</text><text x="428" y="140">[rax+8]</text><text x="428" y="170">[rax+16]</text>
<text x="20" y="205">One vtable per class, shared by all its objects. One vptr per object.</text>
</g>
</svg></div>
<ul>
<li><strong>One vtable per class</strong>, in read-only data, with one slot per virtual function in declaration order. Each object pays one 8 B vptr at offset 0. The two entries before the address point serve <code>dynamic_cast</code> and <code>typeid</code> (on <a href="#/cpp-runtime/rtti">Runtime Machinery</a>).</li>
<li><strong>The constructor writes the vptr.</strong> While <code>Component</code>'s constructor runs, the vptr points to <code>Component</code>'s vtable, and <code>Core</code>'s constructor then overwrites it. That's why a virtual call inside a base constructor runs the base version.</li>
<li><strong>The cost</strong> is two dependent loads and an indirect branch. If the branch target predictor gets it right, that's a few cycles. The larger cost is that the compiler can't inline through the call, so constant propagation, vectorization and dead-code removal stop at it.</li>
<li><strong>Devirtualization</strong> recovers the direct call when the compiler knows the dynamic type: a local object, a class or function marked <code>final</code>, or, with <code>-flto</code>, a class nobody derives from. GCC at <code>-O2</code> also devirtualizes speculatively: it compares the loaded slot with the likely target and calls that target directly, inlined, when they match.</li>
<li><strong>Multiple inheritance</strong> gives an object one vptr per base with virtual functions, and calls through the second base go through a small <em>thunk</em> that adjusts <code>this</code> before jumping to the real function.</li>
</ul>
<h3 id="sec-templates">Templates: One Copy per Type</h3>
<p>A template is not code. The compiler generates code from it for each distinct set of template arguments that is used, a process called instantiation:</p>
<pre><code>template &lt;typename T&gt;
T max_of(const T* v, size_t n) { T m = v[0]; for (size_t i = 1; i &lt; n; ++i) m = v[i] &gt; m ? v[i] : m; return m; }

max_of&lt;uint32_t&gt;(ages, 16);     <span class="cm">// generates one function</span>
max_of&lt;uint64_t&gt;(tags, 16);     <span class="cm">// generates a second, separate function</span>
RingBuffer&lt;Inst, 224&gt; rob_skl;  <span class="cm">// and these are two unrelated classes,</span>
RingBuffer&lt;Inst, 352&gt; rob_icl;  <span class="cm">// each with its own copy of every member function used</span></code></pre>
<ul>
<li><strong>Like a macro, but typed.</strong> Each instantiation is compiled with its types and constants known, so it optimizes as well as hand-written code. The price is code size and compile time.</li>
<li><strong>Why templates live in headers:</strong> to instantiate <code>max_of&lt;uint32_t&gt;</code>, the compiler needs the body in that translation unit (.cpp file plus its headers).</li>
<li><strong>Duplicate copies are merged at link time.</strong> Every .cpp file that uses <code>max_of&lt;uint32_t&gt;</code> emits its own copy as a <em>weak</em> symbol in a COMDAT section, and the linker keeps one and discards the rest.</li>
<li><strong><code>inline</code> means the same thing for ordinary functions:</strong> "this definition may appear in several translation units, keep one". Whether a call actually gets inlined is a separate decision the optimizer makes.</li>
<li><strong>The One Definition Rule (ODR)</strong> requires all those copies to be identical. If two .cpp files see different bodies (different <code>-D</code> flags, different header versions), the linker silently keeps one, with no error.</li>
<li><strong>Only what's used is generated.</strong> A member function of a class template that is never called is never compiled, so errors in it don't show until something calls it. <code>extern template class RingBuffer&lt;Inst, 224&gt;;</code> in a header, plus one explicit instantiation in one .cpp file, stops every file from instantiating it again.</li>
</ul>
<h3 id="sec-lambdas">Lambdas Are Structs</h3>
<pre><code>uint64_t limit = 400;
auto late = [limit, &amp;stats](const Req&amp; r) { stats.n++; return r.lat &gt; limit; };

<span class="cm">// What the compiler generates</span>
struct __lambda_7 {
    uint64_t limit;                 <span class="cm">// captured by value: copied in</span>
    Stats&amp;   stats;                 <span class="cm">// captured by reference: stored as a pointer</span>
    bool operator()(const Req&amp; r) const { stats.n++; return r.lat &gt; limit; }
};
auto late = __lambda_7{limit, stats};</code></pre>
<ul>
<li><code>sizeof(late)</code> is 16 B: one 8 B copy and one 8 B pointer. A lambda that captures nothing is an empty struct, and it converts to a plain function pointer, which is how you pass one to a C API such as <code>qsort</code>.</li>
<li><strong>Every lambda expression has its own type.</strong> Passed to a template such as <code>std::sort</code>, it causes an instantiation for that type with the call to <code>operator()</code> known at compile time, so the comparison inlines. <code>qsort</code> calls through a function pointer on every comparison.</li>
<li><code>operator()</code> is <code>const</code> by default, which is why changing a by-value capture needs <code>mutable</code>.</li>
<li>Inside a member function, <code>[&amp;]</code> and <code>[=]</code> both capture <code>this</code> as a pointer. A lambda stored as a callback that outlives its object dangles either way.</li>
</ul>
<h3 id="sec-function">std::function: Type Erasure</h3>
<p><code>std::function&lt;R(Args...)&gt;</code> holds any callable with a matching signature, so its type can't depend on the callable's type. In libstdc++ it is 32 B, and it is the C pattern of a function pointer plus a <code>void*</code> context, automated:</p>
<pre><code><span class="cm">// std::function&lt;bool(const Req&amp;)&gt; in libstdc++, written as C</span>
struct function {
    union { void* heap_obj; char local[16]; } storage;            <span class="cm">// the callable, or a pointer to it</span>
    void (*manager)(void* dst, const void* src, int op);          <span class="cm">// copy, move, destroy</span>
    bool (*invoker)(const void* storage, const struct Req* r);    <span class="cm">// calls the callable</span>
};</code></pre>
<ul>
<li><strong>Storage:</strong> a callable that is trivially copyable and fits in 16 B lives inside the object. Anything else (a lambda that captures three pointers, or one that captures a <code>std::string</code>) is heap-allocated with <code>new</code>, and copying the <code>std::function</code> copies that allocation too.</li>
<li><strong>Calling</strong> is an indirect call to the invoker, which then runs the callable. The call site can't inline it, because the target isn't known until run time.</li>
<li>In hot code, take the callable as a template parameter instead (<code>template &lt;typename F&gt; void for_each_ready(F f)</code>). Keep <code>std::function</code> for callbacks registered once and called rarely.</li>
</ul>
<h3 id="sec-variant">std::variant: A Tagged Union</h3>
<pre><code>std::variant&lt;AluOp, LoadOp, BranchOp&gt; op;

<span class="cm">// Written as C</span>
struct Op {
    union { struct AluOp alu; struct LoadOp load; struct BranchOp br; } u;
    uint8_t index;                  <span class="cm">// which member is alive: 0, 1 or 2</span>
};</code></pre>
<ul>
<li><code>sizeof</code> is the largest alternative plus the index, rounded up to the strictest alignment. No heap, no vptr per object, and a <code>vector</code> of variants is one contiguous array.</li>
<li><code>std::visit</code> dispatches on the index, through a switch or a table of function pointers depending on the library and the number of alternatives. When it becomes a switch, the handlers can inline.</li>
<li>Compared with virtual functions, a variant fixes the set of types at compile time but stores objects inline. Virtual dispatch over a <code>vector&lt;unique_ptr&lt;Base&gt;&gt;</code> needs one heap allocation per object and a pointer chase per element.</li>
</ul>
`,
  practice: {
    guided: [
      {
        q: `<p>A model of Zen 4's 320-entry ROB holds in-flight instructions in one of two ways. In both, the data members are 8 B aligned: <code>AluInst</code> has 24 B of data, <code>LoadInst</code> 48 B, and <code>BranchInst</code> 32 B. The ROB currently holds 160 ALU, 96 load, and 64 branch instructions.</p><ul><li><strong>Polymorphic:</strong> each class derives from <code>Inst</code>, which has virtual functions, and the ROB is <code>std::vector&lt;std::unique_ptr&lt;Inst&gt;&gt;</code> (8 B per pointer). Each object is a separate <code>new</code>. glibc's <code>malloc</code> adds an 8 B header to each request and rounds the total up to a multiple of 16 B.</li><li><strong>Variant:</strong> <code>std::vector&lt;std::variant&lt;AluInst, LoadInst, BranchInst&gt;&gt;</code> with a 1 B index.</li></ul><p>Find the bytes and heap allocations for each.</p>`,
        a: `<ol>
<li>Polymorphic object sizes, with an 8 B vptr in front of the data: ALU 8 B + 24 B = 32 B, load 8 B + 48 B = 56 B, branch 8 B + 32 B = 40 B.</li>
<li>Heap chunks: ALU 32 B + 8 B = 40 B, rounded up to 48 B. Load 56 B + 8 B = 64 B, already a multiple of 16 B. Branch 40 B + 8 B = 48 B.</li>
<li>Objects: 160 instructions × 48 B + 96 instructions × 64 B + 64 instructions × 48 B = 7,680 B + 6,144 B + 3,072 B = 16,896 B.</li>
<li>Pointer array: 320 entries × 8 B/entry = 2,560 B. Polymorphic total: 16,896 B + 2,560 B = 19,456 B in 320 + 1 = 321 allocations.</li>
<li>Variant entry: largest alternative 48 B + 1 B index = 49 B, rounded up to the 8 B alignment = 56 B. Total: 320 entries × 56 B/entry = 17,920 B in 1 allocation.</li>
<li>The variant ROB is about 8% smaller (17,920 B vs 19,456 B), but the bigger win is layout: a walk over it reads one contiguous array, while the polymorphic walk follows 320 pointers to objects scattered over the heap and makes an indirect call for each.</li>
</ol>`
      }
    ],
    interview: [
      {
        q: `<p>Two files in a simulator include <code>config.h</code>, which defines <code>inline int rob_size() { return ROB_SIZE; }</code>. The build compiles <code>core.cpp</code> with <code>-DROB_SIZE=512</code> (Golden Cove) and, by mistake, <code>stats.cpp</code> with <code>-DROB_SIZE=256</code> (Zen 3). The program links with no errors or warnings. What value does each file see from <code>rob_size()</code>, why does the linker not complain, and how would you prevent this class of bug?</p>`,
        a: `<ul>
<li><strong>Why it links:</strong> an <code>inline</code> function may be defined in every translation unit that uses it. Each object file carries its own copy as a weak COMDAT symbol, and the linker keeps one without comparing them. Two different bodies violate the One Definition Rule, which is undefined behavior with no diagnostic required.</li>
<li><strong>What each file sees depends on inlining.</strong> At <code>-O2</code> the call is almost certainly inlined, so <code>core.cpp</code> uses 512 entries and <code>stats.cpp</code> uses 256 entries, each from its own copy. Any call that isn't inlined (at <code>-O0</code>, or where the function's address is taken) goes to the one copy the linker kept, usually the one from the first object file on the link line. The answer can change with the optimization level or the link order.</li>
<li><strong>Symptoms:</strong> the stats code reports occupancy against a 256-entry ROB while the core fills 512 entries, so utilization looks like 200%, or a stats array indexed by ROB ID overflows.</li>
<li><strong>Prevention:</strong> don't let macros change a header's meaning per file. Put the size in one place: a <code>constexpr</code> in a single config header that every file sees identically, or a runtime value in a config object passed to both. Build with <code>-flto -Wodr</code>, which catches some ODR violations, such as mismatched type definitions, and keep per-file <code>-D</code> flags out of the build system.</li>
</ul>`
      }
    ]
  }
},
{
  id: "cpp-runtime",
  region: "cpph",
  title: "Runtime Machinery",
  sections: [{ id: "new", label: "new and delete" }, { id: "eh", label: "Exceptions and Unwinding" }, { id: "static", label: "Static Initialization" }, { id: "rtti", label: "RTTI and dynamic_cast" }, { id: "vs-c", label: "Rules That Differ from C" }, { id: "atomic", label: "Atomics" }],
  body: `
<h3 id="sec-new">new and delete</h3>
<pre><code>Cache* c = new Cache(1024, 8);
<span class="cm">// void* mem = operator new(sizeof(Cache));   calls malloc, throws std::bad_alloc on NULL</span>
<span class="cm">// Cache::Cache((Cache*)mem, 1024, 8);         if this throws, operator delete(mem) runs</span>

delete c;
<span class="cm">// Cache::~Cache(c);</span>
<span class="cm">// operator delete(c, sizeof(Cache));          calls free</span></code></pre>
<ul>
<li><code>new</code> is allocation plus construction, and the two halves can be used separately. <em>Placement new</em>, <code>new (buf) T(args)</code>, constructs in memory you already have, with no allocation. That's how <code>vector</code> builds elements in its spare capacity and how a pool allocator works.</li>
<li><code>new T[n]</code> for a type with a non-trivial destructor stores n in a <em>cookie</em> (8 B on x86-64) just before the array, so <code>delete[]</code> knows how many destructors to run. Mixing <code>delete</code> and <code>delete[]</code> reads the wrong address, which is undefined behavior.</li>
<li><code>vector</code>, <code>make_unique</code>, <code>string</code> and every node container end in <code>operator new</code>. Replacing the global <code>operator new</code> with one that counts calls is a quick way to find the allocations in a simulator's per-cycle loop.</li>
</ul>
<h3 id="sec-eh">Exceptions and Unwinding</h3>
<p>GCC and Clang use the "zero-cost" table-based model: the path that doesn't throw runs no extra instructions. The work moves into tables and into the throw itself.</p>
<ul>
<li><strong>Tables:</strong> <code>.eh_frame</code> describes how to restore each function's caller frame from any instruction. <code>.gcc_except_table</code> lists, for each call site, the <em>landing pad</em> to jump to if that call throws: code that runs destructors for the live locals, or a <code>catch</code> block.</li>
<li><strong>A throw</strong> calls <code>__cxa_allocate_exception</code> (a heap allocation) and <code>__cxa_throw</code>. The unwinder then walks the stack twice: phase 1 searches up the frames for a matching <code>catch</code> without changing anything, and phase 2 walks back down, running each frame's landing pad. The cost is thousands of cycles or more, growing with stack depth.</li>
<li><strong>What the normal path still pays:</strong> landing pads make the binary bigger (GCC moves them to a cold section). The compiler also has to assume any call not marked <code>noexcept</code> might throw and keep the state each landing pad needs, which limits some optimizations.</li>
<li><strong><code>noexcept</code></strong> lets the compiler drop the cleanup around calls to that function. If a <code>noexcept</code> function throws anyway, <code>std::terminate</code> runs.</li>
<li><strong>Where to use them:</strong> configuration errors and bad trace files at startup, not per-cycle control flow. Many simulators and game engines build with <code>-fno-exceptions</code>, where a failed <code>new</code> aborts.</li>
</ul>
<h3 id="sec-static">Static Initialization</h3>
<p>A function-local <code>static</code> is constructed the first time control reaches it, and C++11 guarantees that's thread-safe. GCC implements it with a guard variable:</p>
<pre><code>Stats&amp; stats() {
    static Stats s;            <span class="cm">// constructed on the first call</span>
    return s;
}

<span class="cm">// What GCC generates, written as C</span>
static uint64_t guard;         <span class="cm">// first byte: 1 once s is constructed</span>
if (!__atomic_load_n((char*)&amp;guard, __ATOMIC_ACQUIRE)) {   <span class="cm">// fast path: a load and a branch</span>
    if (__cxa_guard_acquire(&amp;guard)) {                     <span class="cm">// takes a lock, checks again</span>
        Stats_ctor(&amp;s);
        __cxa_guard_release(&amp;guard);
        __cxa_atexit(Stats_dtor, &amp;s, &amp;__dso_handle);       <span class="cm">// destructor runs at exit</span>
    }
}
return s;</code></pre>
<ul>
<li><strong>Globals</strong> with a constructor or a non-constant initializer run before <code>main</code>, from the <code>.init_array</code> section. Within one .cpp file they run in definition order. Across files the order is unspecified, so a global that reads another file's global during its construction may see it still zero. That's the <em>static initialization order fiasco</em>.</li>
<li>Two fixes: a function-local static, as above, which is constructed on first use, or <code>constinit</code> / <code>constexpr</code> (C++20), which forces initialization at compile time into <code>.data</code> with no code at all.</li>
<li>Static destructors run after <code>main</code> returns, in reverse order of construction.</li>
</ul>
<h3 id="sec-rtti">RTTI and dynamic_cast</h3>
<ul>
<li><code>typeid(*p)</code> reads the <code>type_info</code> pointer stored in the vtable just before the first function slot, so it works only on classes with virtual functions.</li>
<li><code>dynamic_cast&lt;Core*&gt;(p)</code> calls the runtime function <code>__dynamic_cast</code>, which walks the class-hierarchy description that <code>type_info</code> points to. That's a function call plus a search, far more than a pointer compare.</li>
<li>In hot code, store a kind enum in the base class or call a virtual function instead. <code>-fno-rtti</code> removes the type information and forbids <code>dynamic_cast</code> and <code>typeid</code>.</li>
</ul>
<h3 id="sec-vs-c">Rules That Differ from C</h3>
<div class="tbl"><table>
<thead><tr><th>Code</th><th>C</th><th>C++</th></tr></thead>
<tbody>
<tr><td>Read a <code>union</code> member other than the one last written</td><td>allowed: reinterprets the bytes</td><td>undefined behavior. Use <code>std::bit_cast</code> (C++20) or <code>memcpy</code>, which compile to the same single move</td></tr>
<tr><td><code>int* p = malloc(n);</code></td><td>compiles</td><td>error: <code>void*</code> doesn't convert implicitly</td></tr>
<tr><td><code>sizeof('a')</code></td><td>4 B: the literal is an <code>int</code></td><td>1 B: the literal is a <code>char</code></td></tr>
<tr><td><code>const int kWays = 8;</code> at file scope</td><td>external linkage</td><td>internal linkage: each .cpp file gets its own copy, so it's safe in a header</td></tr>
<tr><td><code>void f();</code></td><td>unspecified parameters (before C23)</td><td>no parameters</td></tr>
<tr><td><code>restrict</code>, variable-length arrays</td><td>standard</td><td>not standard. Use <code>__restrict</code> and <code>std::vector</code></td></tr>
<tr><td>Designated initializers</td><td>any order, nested, arrays</td><td>C++20, in declaration order only, no array designators</td></tr>
</tbody>
</table></div>
<h3 id="sec-atomic">Atomics</h3>
<p><code>std::atomic&lt;T&gt;</code> and the memory orders are the same model as C11's <code>_Atomic</code> (on <a href="#/c11-ordering">C11 Memory Ordering</a>). What they compile to:</p>
<div class="tbl"><table>
<thead><tr><th>Operation</th><th>x86-64</th><th>AArch64</th></tr></thead>
<tbody>
<tr><td><code>load(relaxed)</code>, <code>load(acquire)</code></td><td><code>mov</code></td><td><code>ldr</code>, <code>ldar</code></td></tr>
<tr><td><code>load(seq_cst)</code></td><td><code>mov</code></td><td><code>ldar</code></td></tr>
<tr><td><code>store(relaxed)</code>, <code>store(release)</code></td><td><code>mov</code></td><td><code>str</code>, <code>stlr</code></td></tr>
<tr><td><code>store(seq_cst)</code></td><td><code>xchg</code>, or <code>mov</code> + <code>mfence</code>, depending on the compiler</td><td><code>stlr</code></td></tr>
<tr><td><code>fetch_add</code></td><td><code>lock xadd</code></td><td><code>ldadd</code> family (Armv8.1 LSE), or an <code>ldxr</code> / <code>stxr</code> retry loop</td></tr>
</tbody>
</table></div>
<p>x86's ordering is strong enough that only the <code>seq_cst</code> store needs a different instruction. On Arm the order you pick changes the instructions, so code that is correct on x86 by accident can break there.</p>
`,
  practice: {
    guided: [
      {
        q: `<p>A memory-system model does <code>Req* r = new Req{...};</code> for every L1D access and <code>delete r;</code> when it completes. <code>sizeof(Req)</code> is 56 B. A run simulates 2,000,000,000 accesses, and on the host one <code>malloc</code> plus <code>free</code> pair costs 20 ns. glibc adds an 8 B header to each request and rounds the total up to a multiple of 16 B. At most 64 requests are in flight at once, the L1D's MSHR count. Find the time spent in the allocator and the heap chunk per request, then replace the allocations.</p>`,
        a: `<ol>
<li><code>new</code> calls <code>operator new</code>, which calls <code>malloc</code>, and <code>delete</code> ends in <code>free</code>, so each access costs one pair: 2,000,000,000 accesses × 20 ns/access = 40,000,000,000 ns = 40 s of allocator time.</li>
<li>Chunk per request: 56 B + 8 B = 64 B, already a multiple of 16 B, so 64 B.</li>
<li>Replace it with a fixed pool: <code>std::array&lt;Req, 64&gt; pool;</code> plus a free list of slot indices (a 64-bit mask with <code>countr_zero</code> works). Allocating is taking a free index, and freeing is setting its bit.</li>
<li>The pool is 64 requests × 56 B/request = 3,584 B, allocated once, with 0 allocator calls per access. It also models the hardware: when the free mask is empty, the L1D is out of MSHRs and must stall.</li>
</ol>`
      }
    ],
    interview: [
      {
        q: `<p>A simulator has <code>Config g_config = load_defaults();</code> in <code>config.cpp</code>, where <code>load_defaults()</code> returns a config with <code>rob_entries</code> = 576 (Lion Cove). <code>core.cpp</code> has <code>Core g_core(g_config.rob_entries);</code> at file scope. On one machine the model runs correctly, and on a colleague's machine, built from the same source with a different build system, it runs with a 0-entry ROB. Explain, and fix it.</p>`,
        a: `<ul>
<li><strong>Both globals need code to initialize them,</strong> because each calls a function at run time. That code runs before <code>main</code>, and the order between different .cpp files is unspecified.</li>
<li><strong>Before any of it runs,</strong> all static storage is zero-initialized. If <code>core.cpp</code>'s initializer runs first, it reads <code>g_config.rob_entries</code> while it is still 0 and builds a 0-entry ROB. In practice the order follows the order of object files on the link line, which is what differs between the two build systems.</li>
<li><strong>Fix 1:</strong> replace the global with a function-local static, <code>Config&amp; config() { static Config c = load_defaults(); return c; }</code>, so the config is built the first time anyone asks for it.</li>
<li><strong>Fix 2:</strong> if the defaults are compile-time constants, make <code>load_defaults</code> <code>constexpr</code> and declare <code>constinit Config g_config = load_defaults();</code>. It's then initialized at compile time and can't be seen uninitialized.</li>
<li><strong>Best for a simulator:</strong> no globals at all. <code>main</code> parses the config and constructs the <code>Core</code> from it, so the order is visible in the code.</li>
</ul>`
      }
    ]
  }
},
{
  id: "cpp-containers",
  region: "cpph",
  title: "Containers in Memory",
  sections: [{ id: "sizes", label: "The Handle and the Heap" }, { id: "growth", label: "Vector Growth" }, { id: "sso", label: "Short Strings" }, { id: "nodes", label: "Node-Based Containers" }, { id: "smart", label: "Smart Pointers" }, { id: "pq", label: "Priority Queue: A Heap in a Vector" }, { id: "deque", label: "Deque: A Map of Chunks" }],
  body: `
<h3 id="sec-sizes">The Handle and the Heap</h3>
<p>Every container is a small fixed-size <em>handle</em> (what <code>sizeof</code> measures) plus memory it owns on the heap. In libstdc++ on x86-64:</p>
<div class="tbl"><table>
<thead><tr><th>Type</th><th><code>sizeof</code></th><th>Handle holds</th><th>Elements live in</th></tr></thead>
<tbody>
<tr><td><code>vector&lt;T&gt;</code></td><td>24 B</td><td>begin, end, end of capacity</td><td>one heap block</td></tr>
<tr><td><code>array&lt;T, N&gt;</code></td><td>N × sizeof(T)</td><td>the elements themselves</td><td>inside the object, no heap</td></tr>
<tr><td><code>string</code></td><td>32 B</td><td>pointer, length, 16 B for capacity or short text</td><td>inside the object up to 15 chars, else the heap</td></tr>
<tr><td><code>string_view</code>, <code>span&lt;T&gt;</code></td><td>16 B</td><td>pointer, length</td><td>someone else's memory</td></tr>
<tr><td><code>deque&lt;T&gt;</code></td><td>80 B</td><td>map pointer, map size, two iterators</td><td>512 B chunks</td></tr>
<tr><td><code>list&lt;T&gt;</code></td><td>24 B</td><td>sentinel node (prev, next), size</td><td>one node per element: 16 B of links + T</td></tr>
<tr><td><code>map&lt;K, V&gt;</code>, <code>set&lt;K&gt;</code></td><td>48 B</td><td>header node, count</td><td>one tree node per element: 32 B header + element</td></tr>
<tr><td><code>unordered_map&lt;K, V&gt;</code></td><td>56 B</td><td>bucket array pointer, bucket count, list head, count, rehash policy</td><td>one node per element + an array of 8 B bucket pointers</td></tr>
<tr><td><code>optional&lt;T&gt;</code></td><td>sizeof(T) + 1 B, rounded up to T's alignment</td><td>the value and a flag</td><td>inside the object</td></tr>
<tr><td><code>unique_ptr&lt;T&gt;</code></td><td>8 B</td><td>a pointer</td><td>the object it owns</td></tr>
<tr><td><code>shared_ptr&lt;T&gt;</code></td><td>16 B</td><td>object pointer, control block pointer</td><td>the object and a control block</td></tr>
<tr><td><code>function&lt;Sig&gt;</code></td><td>32 B</td><td>16 B buffer, manager, invoker</td><td>the buffer, or the heap if the callable doesn't fit</td></tr>
</tbody>
</table></div>
<p>A <code>vector</code> written as C is <code>struct { T* begin; T* end; T* cap; }</code>. <code>size()</code> is <code>end - begin</code>, a subtraction and a division by <code>sizeof(T)</code>, which is a shift when the size is a power of two.</p>
<h3 id="sec-growth">Vector Growth</h3>
<p>When <code>push_back</code> finds <code>size() == capacity()</code>, the vector reallocates:</p>
<ol>
<li>Allocate a new block of twice the capacity (libstdc++ and libc++, 1.5 times in MSVC).</li>
<li>Move each element into it if T's move constructor is <code>noexcept</code>, otherwise copy each one.</li>
<li>Destroy the old elements and free the old block.</li>
</ol>
<ul>
<li>Growing from empty one element at a time gives capacities 1, 2, 4, 8, and so on. Reaching n elements moves fewer than 2n elements in total, so <code>push_back</code> is amortized O(1), even though a single call can move everything.</li>
<li>During a reallocation the old and new blocks both exist, so the peak is 3 times the old size with doubling. For a vector of several gigabytes, that peak is what runs the host out of memory.</li>
<li><code>reserve(n)</code> does one allocation up front. <code>clear()</code> keeps the capacity, and <code>shrink_to_fit()</code> is only a request.</li>
</ul>
<h3 id="sec-sso">Short Strings</h3>
<pre><code>std::string a = "l1d.misses";                  <span class="cm">// 10 chars: stored inside the 32 B object, no malloc</span>
std::string b = "core0.l2.prefetch.useful";    <span class="cm">// 24 chars: heap allocation</span></code></pre>
<ul>
<li>The <em>small-string optimization</em> (SSO) reuses the capacity field's bytes as a text buffer. libstdc++ fits 15 chars plus the terminating NUL in 32 B, libc++ fits 22 chars in a 24 B string, and MSVC fits 15 chars in 32 B.</li>
<li>Moving a short string copies its bytes, since there's no heap pointer to steal.</li>
<li>Stats keyed by long names pay a heap allocation every time a <code>std::string</code> is built from a literal, plus hashing and comparing every character. Turn names into integer IDs or references once, at setup.</li>
</ul>
<h3 id="sec-nodes">Node-Based Containers</h3>
<p><code>list</code>, <code>map</code>, <code>set</code> and the <code>unordered_</code> containers allocate one node per element. That's what keeps their iterators valid when other elements are inserted, and it's also why they're slow to walk.</p>
<pre><code><span class="cm">// std::map&lt;uint64_t, uint64_t&gt; node: a red-black tree node</span>
struct map_node {
    int color;  struct map_node *parent, *left, *right;   <span class="cm">// 32 B with padding</span>
    uint64_t key, value;                                  <span class="cm">// 16 B</span>
};

<span class="cm">// std::unordered_map&lt;uint64_t, uint64_t&gt; node</span>
struct hash_node {
    struct hash_node* next;     <span class="cm">// all nodes form one singly linked list</span>
    uint64_t key, value;        <span class="cm">// (the hash is cached here too for slow-to-hash keys like strings)</span>
};</code></pre>
<ul>
<li><strong><code>map</code> lookup</strong> follows one pointer per tree level: about log<sub>2</sub>(n) dependent loads, each to a node allocated at some unrelated time and place.</li>
<li><strong><code>unordered_map</code> lookup</strong> computes the hash, takes it modulo the bucket count (libstdc++ uses prime bucket counts, so that's a 64-bit division), loads the bucket's pointer, which points to the node <em>before</em> the bucket's first node, and then follows <code>next</code>. That's at least three dependent loads to scattered addresses.</li>
<li><strong>Open-addressing tables</strong> (<code>absl::flat_hash_map</code>, <code>boost::unordered_flat_map</code>) store elements in one array, with no nodes and no per-element allocation. The trade-off is that a rehash moves elements, so references into the table don't survive one.</li>
</ul>
<h3 id="sec-smart">Smart Pointers</h3>
<ul>
<li><strong><code>unique_ptr&lt;T&gt;</code></strong> is a <code>T*</code> whose destructor is <code>if (p) delete p;</code>. A stateless custom deleter takes no space. A function-pointer deleter adds 8 B.</li>
<li><strong><code>shared_ptr&lt;T&gt;</code></strong> holds two pointers. The control block holds a vptr, a 4 B use count and a 4 B weak count, plus the deleter. Copying increments the use count atomically (<code>lock add</code> on x86), and destroying decrements it. When many threads copy the same pointer, its control block's cache line bounces between cores.</li>
<li><strong><code>make_shared</code></strong> puts the control block and the object in one allocation. <code>shared_ptr&lt;T&gt;(new T)</code> makes two. With <code>make_shared</code>, the object's memory is only freed when the last <code>weak_ptr</code> is gone too.</li>
</ul>
<h3 id="sec-pq">Priority Queue: A Heap in a Vector</h3>
<p><code>std::priority_queue&lt;T&gt;</code> is an adaptor over a <code>std::vector&lt;T&gt;</code> that keeps a binary heap in it. The tree is never stored as nodes and pointers. It is implied by the indices:</p>
<ul>
<li>The root is v[0], and <code>top()</code> just reads it.</li>
<li>The children of v[i] are v[2i + 1] and v[2i + 2], and its parent is v[(i − 1) / 2].</li>
<li><code>push(x)</code> is <code>push_back(x)</code> followed by <code>std::push_heap</code>: the new leaf swaps with its parent until the parent wins the compare. That is at most one compare per level, so O(log n).</li>
<li><code>pop()</code> moves the last element to the root and sifts it down, also O(log n).</li>
</ul>
<p>The comparator answers "does a have lower priority than b?". The default <code>std::less</code> makes a max-heap, and <code>std::greater</code> makes a min-heap, which is what a simulator's event queue ordered by cycle needs.</p>
<div class="anim" data-anim="stl-heap"></div>
<p>Only the path from the root to each leaf is sorted. Siblings and cousins are in no particular order, which is why a heap can't be iterated in priority order and why <code>priority_queue</code> hides everything but <code>top()</code>.</p>
<h3 id="sec-deque">Deque: A Map of Chunks</h3>
<p>A <code>std::deque</code> is not one contiguous block. In libstdc++ (GCC) it is two levels:</p>
<ul>
<li><strong>Chunks</strong> of 512 B each, so 512 B / sizeof(T) elements per chunk (one element per chunk when T is larger than 512 B). Each chunk is its own heap allocation, so chunks land wherever the allocator puts them.</li>
<li><strong>The map</strong>, an array of pointers to chunks, kept with spare slots on both sides so either end can grow. It starts with 8 slots.</li>
<li>Two iterators, <code>start</code> and <code>finish</code>, each hold the current element, the bounds of its chunk, and a pointer to its map slot.</li>
</ul>
<p>Other libraries pick different chunk sizes: libc++ (Clang) uses 4,096 B blocks, and MSVC uses only 16 B blocks, so a deque of 64 B elements there allocates every element separately.</p>
<p>Why split the elements across chunks instead of one block? The C++ standard ([deque.modifiers]) promises two things that no single contiguous block can keep:</p>
<ul>
<li><strong>Inserting at either end always takes constant time and calls T's constructor exactly once.</strong> A <code>vector</code> has no room in front of element 0, so <code>push_front</code> would shift every element. A ring buffer (one block with head and tail wrapping around) fixes the front, but when it fills it must copy or move every element into a bigger block. That makes growth amortized O(1), not O(1), and costs n extra constructor calls.</li>
<li><strong>Inserting at either end leaves references to existing elements valid.</strong> Any growth of a single block moves the elements to a new address, so every pointer and reference into it dangles.</li>
</ul>
<p>Chunks keep both promises because elements never move. A new element goes into the end chunk, or into a freshly allocated chunk whose pointer is written into a spare map slot. When the map itself runs out of slots, only the pointers are copied. For 1,000,000 elements of 8 B (64 elements/chunk), that is 1,000,000 elements / 64 elements/chunk = 15,625 pointers × 8 B/pointer = 125,000 B, instead of the 8,000,000 B a <code>vector</code> copies when it reallocates. Two side benefits follow:</p>
<ul>
<li>A deque can hold types that can be neither copied nor moved (built in place with <code>emplace_back</code> or <code>emplace_front</code>), since growth never relocates an element.</li>
<li>A large deque never needs one huge contiguous allocation, and popping from an end frees whole chunks as they empty.</li>
</ul>
<p>The price is the two-level lookup and broken contiguity described below.</p>
<div class="anim" data-anim="stl-deque"></div>
<p>What the layout means for a model:</p>
<ul>
<li><strong>Ends are cheap and stable.</strong> Pushing at either end writes into a chunk or allocates a new one. Existing elements never move, so references to them stay valid even when the map is reallocated. Iterators don't, because they point into the map.</li>
<li><strong>Indexing costs two dependent loads.</strong> <code>d[i]</code> reads the map slot, then the element. A <code>vector</code> computes the address directly.</li>
<li><strong>Scans are contiguous only within a chunk.</strong> Every 512 B the walk jumps to an unrelated address, and iterator increments check for the chunk boundary, so a tight loop over a deque is slower than over a vector.</li>
<li><strong>A fixed-capacity queue is better as a ring buffer.</strong> A 192-entry load queue in a model never needs to grow, so an array with head and tail indices beats a deque's allocations and two-level lookups.</li>
</ul>
`,
  practice: {
    guided: [
      {
        q: `<p>A reuse-distance study counts accesses per cache line in a <code>std::unordered_map&lt;uint64_t, uint64_t&gt;</code> and ends up with 3,000,000 distinct lines. In libstdc++ each node is an 8 B <code>next</code> pointer plus the 16 B key-value pair, and glibc adds an 8 B header to each allocation and rounds the total up to a multiple of 16 B. Assume the bucket count equals the element count, with 8 B per bucket. Compare the memory with <code>absl::flat_hash_map</code>, whose capacity is 2<sup>k</sup> − 1 slots for the smallest k with capacity × 7/8 ≥ the element count, and which stores each 16 B pair in its slot plus 1 B of control data per slot.</p>`,
        a: `<ol>
<li>Node chunk: 8 B + 16 B + 8 B header = 32 B, already a multiple of 16 B.</li>
<li>Nodes: 3,000,000 nodes × 32 B/node = 96,000,000 B. Buckets: 3,000,000 buckets × 8 B/bucket = 24,000,000 B.</li>
<li><code>unordered_map</code> total: 96,000,000 B + 24,000,000 B = 120,000,000 B ≈ 114.4 MiB, in 3,000,000 separate allocations.</li>
<li>Flat map capacity: k = 21 gives (2<sup>21</sup> − 1) slots × 7/8 = 2,097,151 slots × 7/8 ≈ 1,835,007 slots, which is less than 3,000,000. k = 22 gives 4,194,303 slots × 7/8 ≈ 3,670,015 slots, which is enough, so the capacity is 4,194,303 slots.</li>
<li>Flat map total: 4,194,303 slots × (16 B + 1 B)/slot = 71,303,151 B ≈ 68.0 MiB, in one allocation.</li>
<li>The node-based map uses 120,000,000 B / 71,303,151 B ≈ 1.68 times the memory, and each lookup chases at least three dependent pointers instead of reading one control group and one slot.</li>
</ol>`
      }
    ],
    interview: [
      {
        q: `<p>A model keeps its statistics in <code>std::unordered_map&lt;std::string, uint64_t&gt; stats</code> and bumps a counter with <code>stats["core3.l2.prefetch.late"]++;</code> about 4 times per simulated instruction. Profiling shows the run spending a large share of its time in <code>malloc</code>, <code>free</code>, the string hash and <code>memcmp</code>. Built with Clang and libc++ instead of GCC and libstdc++, the same run is noticeably faster. libstdc++ stores up to 15 chars inside a <code>std::string</code> and libc++ up to 22. Explain both observations, and fix the code.</p>`,
        a: `<ul>
<li><strong>Each bump builds a temporary <code>std::string</code></strong> from the literal, because <code>operator[]</code> takes a key. The name is 22 chars long. That's more than 15, so with libstdc++ every bump does a <code>malloc</code> and a <code>free</code>.</li>
<li><strong>Then the lookup itself:</strong> hash all 22 B, take the hash modulo a prime bucket count (a 64-bit division), load the bucket pointer, follow the node chain, and <code>memcmp</code> the stored key against the 22 chars. All of that runs 4 times per instruction for what should be one increment.</li>
<li><strong>Why libc++ is faster:</strong> 22 chars fit exactly in libc++'s short-string buffer, so the temporary needs no heap allocation. The hash, division and pointer chases remain, which is why it is faster but still slow.</li>
<li><strong>Fix:</strong> look each counter up once at setup and keep a reference: <code>uint64_t&amp; late = stats["core3.l2.prefetch.late"];</code>. References to <code>unordered_map</code> elements stay valid across rehashes, because the nodes never move. The hot path becomes <code>++late</code>, one add. Better still, give each counter an integer ID into a <code>std::vector&lt;uint64_t&gt;</code> and keep the names only for printing.</li>
</ul>`
      }
    ]
  }
}
]);
