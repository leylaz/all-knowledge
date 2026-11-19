/* Section: C++ STL
   One region of the die plus its pages, in display order.
   Moved here from the study guide inside the C++ STL Data Structures Drill
   (cpp-drill/), which links back to these pages. */

section({
  id: "stl",
  name: "C++ STL",
  cap: "Containers, iterators, classes, ownership, templates, and layout for writing a C++ simulator",
  sections: [{ id: "pages", label: "How the Pages Fit Together" }],
  body: `
<p>The C++ needed to write a cycle-level performance model: which container stands in for each hardware structure, how to touch elements without copying them, how classes and ownership work for readers coming from C, and how layout and templates decide simulator speed. Each topic ends with a link to the matching set in the <a href="#/r/cppd">C++ STL Data Structures Drill</a> in the Interview Prep tab.</p>
<h3 id="sec-pages">How the Pages Fit Together</h3>
<ul>
<li><a href="#/stl-containers">Choosing and Declaring Containers</a>: which container models which structure, and how to declare and size it.</li>
<li><a href="#/stl-elements">Elements, Operations, and Iterators</a>: reading, inserting, moving, and erasing elements, bit tricks for select logic, ring buffers, common pitfalls, and iterator invalidation.</li>
<li><a href="#/stl-classes">Classes, Keywords, and Ownership</a>: classes and virtual dispatch, <code>const</code> and its relatives, RAII, smart pointers, and moves.</li>
<li><a href="#/stl-templates">Templates, Lambdas, and Performance</a>: lambdas, comparators, templates, struct layout, and build flags.</li>
<li><a href="#/stl-skeleton">Code Traps and a Simulator Skeleton</a>: snippets that surprise people, a complete ROB and cache model, and habits for C programmers moving to C++.</li>
</ul>
`,
  practice: {
    guided: [
      {
        q: `<p>A model of Zen 5's 448-entry ROB stores it as <code>std::array&lt;RobEntry, 448&gt;</code> with <code>sizeof(RobEntry)</code> = 40 B, and simulates a 16-core chip on one host thread. How much ROB storage is that, and what does shrinking the entry to 24 B buy?</p>`,
        a: `<ol>
<li>Per core: 448 entries × 40 B/entry = 17,920 B = 17.5 KiB.</li>
<li>Chip: 16 cores × 17,920 B/core = 286,720 B = 280 KiB. One host thread walks all 16 ROBs each cycle, so this competes for the host's L2 (1 MiB per core on Zen 5) rather than fitting in its 48 KiB L1D.</li>
<li>At 24 B: 448 entries × 24 B/entry = 10,752 B = 10.5 KiB per core, and 16 cores × 10,752 B/core = 172,032 B = 168 KiB, 40% less.</li>
</ol>`
      }
    ],
    interview: [
      {
        q: `<p>A simulator's 64-entry issue queue kept its ready entries in a <code>uint64_t</code> bit mask and picked with <code>std::countr_zero</code>. After a refactor to <code>std::set&lt;int&gt;</code> of ready slot numbers, the whole simulator runs 3 times slower. Why can one container change cost that much?</p>`,
        a: `<ul>
<li><code>std::set</code> is a red-black tree: each insert allocates a node, and each insert, erase, and <code>begin()</code> chases pointers through about log<sub>2</sub>(64) = 6 levels, with possible host cache misses on each.</li>
<li>The bit mask lives in one register. Wakeup is an OR, select is one <code>tzcnt</code> instruction, and clearing a granted entry is one AND.</li>
<li>Wakeup and select run every simulated cycle for several entries, so this sits on the hottest path. Turning a few single-cycle instructions into allocations and pointer chases there can dominate the total runtime.</li>
<li>Keep the bit mask, and for queues larger than 64 entries, use an array of <code>uint64_t</code> words.</li>
</ul>`
      }
    ]
  }
}, [
{
  id: "stl-containers",
  region: "stl",
  title: "Choosing and Declaring Containers",
  sections: [{ id: "pick", label: "Picking a Container" }, { id: "declare", label: "Declaring and Initializing" }],
  body: `
<h3 id="sec-pick">Picking a Container</h3>
<div class="tbl"><table>
<thead><tr><th>Need</th><th>Use</th><th>Simulator example</th></tr></thead>
<tbody>
<tr><td>Growable, contiguous</td><td><code>std::vector</code></td><td>trace buffer, stat arrays, cache lines</td></tr>
<tr><td>Size fixed at compile time</td><td><code>std::array&lt;T, N&gt;</code></td><td>32 architectural registers, RAT</td></tr>
<tr><td>FIFO</td><td><code>std::queue</code> or a ring buffer</td><td>fetch buffer, decode queue</td></tr>
<tr><td>LIFO</td><td><code>std::stack</code> or array + top index</td><td>return address stack</td></tr>
<tr><td>Cheap at both ends, plus indexing</td><td><code>std::deque</code></td><td>free list, instruction window</td></tr>
<tr><td>Always take the smallest/largest</td><td><code>std::priority_queue</code></td><td>event queue ordered by cycle</td></tr>
<tr><td>Key lookup, order irrelevant</td><td><code>std::unordered_map</code> / <code>unordered_set</code></td><td>ideal PC → target, unique PCs seen</td></tr>
<tr><td>Key lookup + sorted keys / nearest key</td><td><code>std::map</code> / <code>std::set</code></td><td>store queue by seq number, stats printed sorted</td></tr>
<tr><td>O(1) move from anywhere to the front</td><td><code>std::list</code> + map of iterators</td><td>large fully associative LRU</td></tr>
<tr><td>Packed flags</td><td><code>std::bitset&lt;N&gt;</code> or <code>uint64_t</code></td><td>ready bits, global history, PLRU tree</td></tr>
<tr><td>Maybe a value</td><td><code>std::optional&lt;T&gt;</code></td><td>tag lookup: hit way or miss</td></tr>
<tr><td>One of several types</td><td><code>std::variant&lt;A, B, C&gt;</code></td><td>decoded ALU / load / branch records</td></tr>
<tr><td>Huge, sparse address space</td><td><code>unordered_map&lt;page, unique_ptr&lt;array&gt;&gt;</code></td><td>simulated main memory</td></tr>
</tbody>
</table></div>
<p>Three rules that matter more than the table:</p>
<ul>
<li><strong>Dense small-integer keys mean you index an array.</strong> Register numbers, set indices and ROB IDs already are indices. A hash map adds cost and hides the structure the hardware has.</li>
<li><strong>Capacity-limited hardware gets fixed storage and an explicit full check.</strong> A hash map never conflicts and never fills, so a BTB modeled as <code>unordered_map</code> overstates accuracy. Index sets with PC bits and compare tags, as the hardware does.</li>
<li><strong>If you must touch the middle, don't use an adaptor.</strong> <code>queue</code>, <code>stack</code> and <code>priority_queue</code> expose only the ends. A ROB that marks entry #37 complete is a ring buffer.</li>
</ul>
<div class="callout">Hennessy &amp; Patterson (6th ed.) ch. 2 covers caches and replacement, and ch. 3 covers renaming, the ROB and branch prediction. Those are the structures these containers stand in for.</div>
<p class="drill-link"><a href="#/r/cppd/pick">Practice in the drill: Pick the Structure →</a></p>
<h3 id="sec-declare">Declaring and Initializing</h3>
<pre><code>std::vector&lt;int&gt; v;                          <span class="cm">// empty</span>
std::vector&lt;uint8_t&gt; pht(4096, 1);           <span class="cm">// 4096 counters, all 1</span>
std::vector&lt;int&gt; two{4096, 1};               <span class="cm">// braces: 2 elements, 4096 and 1</span>
std::array&lt;uint64_t, 32&gt; regs{};             <span class="cm">// {} zero-fills; without it, garbage</span>
std::vector&lt;std::vector&lt;CacheLine&gt;&gt; sets(num_sets, std::vector&lt;CacheLine&gt;(num_ways));
std::vector&lt;CacheLine&gt; lines(num_sets * num_ways);   <span class="cm">// flat: one allocation, usually faster</span>
std::unordered_map&lt;uint64_t, uint32_t&gt; counts;
std::map&lt;std::string, uint64_t&gt; stats;       <span class="cm">// iterates in sorted key order</span>
std::priority_queue&lt;uint64_t, std::vector&lt;uint64_t&gt;, std::greater&lt;uint64_t&gt;&gt; min_pq;
std::bitset&lt;64&gt; ready;
std::optional&lt;uint32_t&gt; way;                 <span class="cm">// starts empty</span>
using Addr = uint64_t;
template &lt;typename T&gt; using Table = std::vector&lt;std::vector&lt;T&gt;&gt;;</code></pre>
<p><strong>Parentheses vs braces.</strong> <code>(n, x)</code> means count and value. <code>{a, b}</code> is a list of elements. For <code>vector&lt;int&gt;</code>, <code>v(10, 2)</code> is ten 2s and <code>v{10, 2}</code> is two elements.</p>
<p><strong>reserve vs resize.</strong> <code>reserve(n)</code> sets capacity and leaves <code>size()</code> alone. <code>resize(n)</code> creates or destroys elements so <code>size() == n</code>.</p>
<div class="tbl"><table>
<thead><tr><th>What</th><th>Header</th></tr></thead>
<tbody>
<tr><td><code>vector</code>, <code>array</code>, <code>deque</code>, <code>list</code>, <code>forward_list</code></td><td><code>&lt;vector&gt;</code>, <code>&lt;array&gt;</code>, <code>&lt;deque&gt;</code>, <code>&lt;list&gt;</code>, <code>&lt;forward_list&gt;</code></td></tr>
<tr><td><code>queue</code>, <code>priority_queue</code>, <code>stack</code></td><td><code>&lt;queue&gt;</code>, <code>&lt;stack&gt;</code></td></tr>
<tr><td><code>map</code>, <code>multimap</code>, <code>set</code></td><td><code>&lt;map&gt;</code>, <code>&lt;set&gt;</code></td></tr>
<tr><td><code>unordered_map</code>, <code>unordered_set</code></td><td><code>&lt;unordered_map&gt;</code>, <code>&lt;unordered_set&gt;</code></td></tr>
<tr><td><code>bitset</code>, <code>optional</code>, <code>variant</code>, <code>tuple</code>, <code>span</code></td><td><code>&lt;bitset&gt;</code>, <code>&lt;optional&gt;</code>, <code>&lt;variant&gt;</code>, <code>&lt;tuple&gt;</code>, <code>&lt;span&gt;</code></td></tr>
<tr><td><code>pair</code>, <code>move</code>, <code>swap</code>, <code>exchange</code></td><td><code>&lt;utility&gt;</code></td></tr>
<tr><td><code>sort</code>, <code>find_if</code>, <code>rotate</code>, <code>remove_if</code>, <code>count_if</code></td><td><code>&lt;algorithm&gt;</code></td></tr>
<tr><td><code>countr_zero</code>, <code>popcount</code>, <code>bit_width</code></td><td><code>&lt;bit&gt;</code></td></tr>
<tr><td><code>uint64_t</code> and friends</td><td><code>&lt;cstdint&gt;</code></td></tr>
<tr><td><code>unique_ptr</code>, <code>make_unique</code>, <code>shared_ptr</code></td><td><code>&lt;memory&gt;</code></td></tr>
<tr><td><code>std::function</code></td><td><code>&lt;functional&gt;</code></td></tr>
</tbody>
</table></div>
<p class="drill-link"><a href="#/r/cppd/syntax">Practice in the drill: Write the Syntax →</a></p>
`,
  practice: {
    guided: [
      {
        q: `<p>A TAGE predictor's base bimodal table has 16,384 2-bit counters, all reset to weakly taken (2). Declare it as a <code>std::vector</code>, say what the brace form would give instead, and compare its memory with packing four counters per byte.</p>`,
        a: `<ol>
<li>Count and value go in parentheses: <code>std::vector&lt;uint8_t&gt; base(16384, 2);</code></li>
<li>The brace form <code>base{16384, 2}</code> is a list of elements, so it holds 2 counters with values 16,384 (truncated to 0 in a <code>uint8_t</code>, and <code>-Wnarrowing</code> rejects it) and 2.</li>
<li>One counter per byte: 16,384 counters × 1 B/counter = 16,384 B = 16 KiB.</li>
<li>Packed: 16,384 counters × 2 bits/counter / 8 bits/B = 4,096 B = 4 KiB.</li>
<li>Packing saves 12 KiB but costs a shift and mask per access. The 16 KiB form still fits in a 48 KiB host L1D, so it is usually the better choice for a model.</li>
</ol>`
      }
    ],
    interview: [
      {
        q: `<p>Pick a container for each structure and say why a hash map would be wrong or misleading:</p><ul><li>an L1D's 16 MSHRs, looked up by line address</li><li>a DRAM controller's 64-entry read queue, scheduled FR-FCFS</li><li>a 256-entry stride prefetcher table indexed by load PC</li></ul>`,
        a: `<ul>
<li><strong>MSHRs:</strong> <code>std::array&lt;Mshr, 16&gt;</code> with a valid bit per entry, searched by a linear scan (the hardware compares all 16 in parallel). The model must stall when all 16 entries are valid. An <code>unordered_map&lt;Addr, Mshr&gt;</code> never fills, so it hides MSHR-full stalls unless you add a size check by hand.</li>
<li><strong>Read queue:</strong> a fixed array of 64 slots with an arrival sequence number per slot (or a <code>std::vector</code> with a capacity check). FR-FCFS picks the oldest row hit, which can sit anywhere in the queue, so <code>std::queue</code> doesn't work: it only exposes the front.</li>
<li><strong>Stride table:</strong> <code>std::array&lt;Entry, 256&gt;</code> indexed by <code>(pc &gt;&gt; 2) &amp; 255</code>, with a partial tag compare. Two PCs that alias in the real table must alias in the model too. Keyed by the full PC, a hash map gives every load its own entry, which overstates prefetch coverage.</li>
</ul>`
      }
    ]
  }
},
{
  id: "stl-elements",
  region: "stl",
  title: "Elements, Operations, and Iterators",
  sections: [{ id: "access", label: "Accessing and Moving Elements" }, { id: "ops", label: "Operations and Pitfalls" }, { id: "iter", label: "Iterators" }],
  body: `
<h3 id="sec-access">Accessing and Moving Elements</h3>
<h4>Reading and Writing</h4>
<div class="tbl"><table>
<thead><tr><th>Container</th><th>By position</th><th>Ends</th><th>By key / other</th></tr></thead>
<tbody>
<tr><td><code>vector</code>, <code>array</code>, <code>deque</code></td><td><code>v[i]</code>, <code>v.at(i)</code></td><td><code>front()</code>, <code>back()</code></td><td><code>v.data()</code> (vector, array)</td></tr>
<tr><td><code>list</code></td><td>none: <code>std::next(l.begin(), i)</code></td><td><code>front()</code>, <code>back()</code></td><td>none</td></tr>
<tr><td><code>forward_list</code></td><td>none</td><td><code>front()</code></td><td><code>before_begin()</code></td></tr>
<tr><td><code>map</code>, <code>set</code></td><td>none</td><td><code>begin()</code>, <code>rbegin()</code></td><td><code>find</code>, <code>at</code>, <code>contains</code>, <code>lower_bound</code>, <code>m[k]</code> (inserts)</td></tr>
<tr><td><code>unordered_map</code></td><td>none</td><td>none</td><td><code>find</code>, <code>at</code>, <code>contains</code>, <code>count</code>, <code>m[k]</code> (inserts)</td></tr>
<tr><td><code>queue</code></td><td>none</td><td><code>front()</code>, <code>back()</code></td><td>none</td></tr>
<tr><td><code>stack</code></td><td>none</td><td><code>top()</code></td><td>none</td></tr>
<tr><td><code>priority_queue</code></td><td>none</td><td><code>top()</code> (const)</td><td>none</td></tr>
<tr><td><code>bitset</code></td><td><code>b[i]</code>, <code>b.test(i)</code></td><td>none</td><td><code>count()</code>, <code>any()</code>, <code>none()</code></td></tr>
<tr><td><code>pair</code>, <code>tuple</code>, <code>array</code></td><td><code>std::get&lt;I&gt;(t)</code>, <code>.first</code>, <code>.second</code></td><td>none</td><td><code>auto [a, b] = t;</code></td></tr>
<tr><td><code>optional</code></td><td><code>*o</code>, <code>o.value()</code>, <code>o.value_or(x)</code></td><td>none</td><td><code>if (o)</code>, <code>o.has_value()</code></td></tr>
<tr><td><code>variant</code></td><td><code>std::get&lt;T&gt;(v)</code>, <code>std::get_if&lt;T&gt;(&amp;v)</code></td><td>none</td><td><code>std::holds_alternative&lt;T&gt;(v)</code>, <code>std::visit</code></td></tr>
</tbody>
</table></div>
<p><strong>Checked vs unchecked.</strong> <code>[]</code>, <code>front()</code>, <code>back()</code>, <code>top()</code> and <code>*opt</code> on something empty or out of range are undefined behavior. <code>at()</code>, <code>test()</code> and <code>value()</code> throw. Use the checked forms while bringing a model up, or build with <code>-D_GLIBCXX_ASSERTIONS</code> to check <code>[]</code> too.</p>
<p>Members: <code>line.tag</code> on an object or reference, <code>line-&gt;tag</code> through a pointer. Nested: <code>sets[s][w].tag</code>. Flat, set-major: <code>lines[s * num_ways + w]</code>.</p>
<h4>Inserting and Removing at a Position</h4>
<pre><code>v.insert(v.begin() + i, x);               <span class="cm">// O(n - i): the tail shifts right</span>
v.erase(v.begin() + i);                   <span class="cm">// O(n - i): the tail shifts left</span>
v.insert(v.end(), w.begin(), w.end());    <span class="cm">// append a range, one reallocation at most</span>

v[i] = std::move(v.back());               <span class="cm">// O(1) erase when order doesn't matter</span>
v.pop_back();                             <span class="cm">//   ("swap and pop")</span>

d.push_front(x);  d.pop_front();          <span class="cm">// deque: O(1) at both ends</span>
l.erase(it);                              <span class="cm">// list: O(1) given the iterator</span>
l.remove(x);                              <span class="cm">// list: erase every node equal to x</span>
l.sort();                                 <span class="cm">// list: std::sort needs random access</span>
fl.insert_after(it, x);                   <span class="cm">// forward_list: everything is "_after"</span></code></pre>
<p>Swap and pop breaks age order. Never use it where position means age (ROB, LSQ).</p>
<h4>Moving Elements Without Copying</h4>
<p><strong><code>list::splice</code></strong> relinks nodes. Three forms:</p>
<pre><code>dst.splice(pos, src, it);            <span class="cm">// one node</span>
dst.splice(pos, src);                <span class="cm">// all of src</span>
dst.splice(pos, src, first, last);   <span class="cm">// a range</span></code></pre>
<p><code>src</code> can be <code>dst</code> itself. Nothing is allocated or copied, and every iterator stays valid, including the moved node's. That's why storing list iterators in a hash map gives O(1) LRU:</p>
<pre><code>class LruTracker {
public:
    explicit LruTracker(size_t cap) : cap_(cap) {}

    bool access(uint64_t key) {                          <span class="cm">// true on hit</span>
        if (auto it = pos_.find(key); it != pos_.end()) {
            lru_.splice(lru_.begin(), lru_, it-&gt;second); <span class="cm">// move to MRU, O(1)</span>
            return true;
        }
        if (lru_.size() == cap_) {                       <span class="cm">// evict LRU</span>
            uint64_t victim = lru_.back();
            pos_.erase(victim);
            lru_.pop_back();
        }
        lru_.push_front(key);
        pos_[key] = lru_.begin();
        return false;
    }

private:
    size_t cap_;
    std::list&lt;uint64_t&gt; lru_;                                         <span class="cm">// front = MRU</span>
    std::unordered_map&lt;uint64_t, std::list&lt;uint64_t&gt;::iterator&gt; pos_;
};</code></pre>
<p>For a normal set (up to 16 ways), per-way age counters in an array are faster: no pointers, the whole set fits in a host cache line. <a href="#/stl-skeleton/skeleton">The cycle-level skeleton</a> does that.</p>
<p><strong>Vector equivalent: <code>std::rotate</code>.</strong> <code>rotate(first, middle, last)</code> makes <code>*middle</code> the new first element and keeps the rest in order:</p>
<pre><code>std::rotate(v.begin(), v.begin() + i, v.begin() + i + 1);   <span class="cm">// {1,2,3,4,5}, i = 3 -&gt; {4,1,2,3,5}</span></code></pre>
<p><strong>Map node handles (C++17).</strong> Keys in <code>map</code> and <code>set</code> are const, because editing one could break the tree's order. <code>extract</code> unlinks the node, you edit it, <code>insert</code> relinks it:</p>
<pre><code>auto nh = m.extract(oldSeq);   <span class="cm">// node leaves m, nothing freed</span>
nh.key() = newSeq;             <span class="cm">// for a set: nh.value()</span>
m.insert(std::move(nh));

b.insert(a.extract(k));        <span class="cm">// move one node between maps</span>
a.merge(b);                    <span class="cm">// move all nodes; keys already in a stay in b</span></code></pre>
<p><strong>Moving values out.</strong></p>
<pre><code>dst.push_back(std::move(src[i]));   <span class="cm">// src[i] is left valid but unspecified</span>
auto r = std::move(q.front());      <span class="cm">// move first...</span>
q.pop();                            <span class="cm">// ...then pop</span>
auto n = std::exchange(misses, 0);  <span class="cm">// read and reset a stat in one step</span></code></pre>
<p><code>priority_queue::top()</code> returns a const reference, so <code>std::move(pq.top())</code> quietly copies. To move out of a heap, keep a plain vector, use <code>std::pop_heap</code>, then <code>std::move(v.back())</code>.</p>
<p><strong>Lookups that don't insert by accident.</strong></p>
<pre><code>if (auto it = m.find(pc); it != m.end()) it-&gt;second.hits++;   <span class="cm">// C++17 if-init</span>
auto [it, inserted] = m.try_emplace(addr, 0);                  <span class="cm">// insert only if absent</span>
auto [it2, isNew] = m.insert_or_assign(key, val);              <span class="cm">// always overwrite</span>
auto [first, last] = mm.equal_range(addr);                     <span class="cm">// multimap: all entries for a key</span>
auto [tag, hit] = lookup(addr);                                <span class="cm">// unpack a pair or struct</span></code></pre>
<h4>Bit Tricks for Select Logic</h4>
<p>Issue select and free-list search reduce to "find the lowest set bit". C++20 <code>&lt;bit&gt;</code> compiles these to single instructions:</p>
<pre><code>while (ready) {
    int i = std::countr_zero(ready);   <span class="cm">// index of lowest set bit (tzcnt)</span>
    grant(i);
    ready &amp;= ready - 1;                <span class="cm">// clear exactly that bit</span>
}
std::popcount(x);         <span class="cm">// number of set bits</span>
std::bit_width(x);        <span class="cm">// floor(log2(x)) + 1 for x &gt; 0</span>
std::has_single_bit(x);   <span class="cm">// x is a power of two</span></code></pre>
<p>They need an unsigned type. For <code>std::bitset&lt;64&gt;</code>, call <code>b.to_ullong()</code> first.</p>
<h4>Ring Buffer Indexing</h4>
<pre><code>buf[tail] = x;  tail = (tail + 1) % N;  ++count;   <span class="cm">// allocate at tail</span>
head = (head + 1) % N;  --count;                    <span class="cm">// retire from head</span>
buf[(head + k) % N];                                <span class="cm">// k-th oldest</span></code></pre>
<p>When N is a power of two, <code>&amp; (N - 1)</code> replaces <code>%</code>. Golden Cove's 512-entry ROB qualifies, but Zen 4's 320-entry ROB doesn't.</p>
<p class="drill-link"><a href="#/r/cppd/acc">Practice in the drill: Access and Move Elements →</a></p>
<h3 id="sec-ops">Operations and Pitfalls</h3>
<ul>
<li><code>m[key]</code> inserts a default value when the key is missing. Test with <code>contains</code> (C++20), <code>find</code> or <code>count</code>. Use <code>[]</code> only when insert-if-missing is the point, as in <code>++m[pc]</code>.</li>
<li>Every <code>pop</code> returns void. Read <code>front()</code>, <code>top()</code> or <code>back()</code> first.</li>
<li><code>clear()</code> keeps capacity, so a per-cycle scratch vector doesn't reallocate.</li>
<li>A <code>push_back</code> past capacity reallocates, and every pointer, reference and iterator into the vector dangles. Store indices.</li>
<li><code>std::remove_if</code> only moves survivors forward and returns the new end. Finish with <code>erase</code>, or use C++20 <code>std::erase_if(v, pred)</code>.</li>
<li><code>vector&lt;bool&gt;</code> is bit-packed and <code>[]</code> returns a proxy, so <code>bool&amp; b = v[0]</code> fails. Use <code>vector&lt;uint8_t&gt;</code> for real bools.</li>
<li><code>for (auto x : rob)</code> copies every element. Write <code>const auto&amp;</code>.</li>
<li><code>m.erase(it); ++it;</code> is undefined behavior. Write <code>it = m.erase(it);</code>.</li>
<li><code>v.at(i)</code> throws <code>std::out_of_range</code>, but <code>v[i]</code> doesn't check.</li>
</ul>
<div class="tbl"><table>
<thead><tr><th>Container</th><th>Index</th><th>Back</th><th>Front</th><th>Middle (insert/erase)</th><th>Find by key</th></tr></thead>
<tbody>
<tr><td><code>vector</code></td><td>O(1)</td><td>O(1) amortized</td><td>O(n)</td><td>O(n)</td><td>O(n) scan</td></tr>
<tr><td><code>deque</code></td><td>O(1)</td><td>O(1)</td><td>O(1)</td><td>O(n)</td><td>O(n) scan</td></tr>
<tr><td><code>list</code></td><td>O(n)</td><td>O(1)</td><td>O(1)</td><td>O(1) with an iterator</td><td>O(n) scan</td></tr>
<tr><td><code>map</code>, <code>set</code></td><td>none</td><td>none</td><td>none</td><td>O(log n)</td><td>O(log n)</td></tr>
<tr><td><code>unordered_map</code></td><td>none</td><td>none</td><td>none</td><td>O(1) average</td><td>O(1) average</td></tr>
<tr><td><code>priority_queue</code></td><td>none</td><td>push/pop O(log n)</td><td>none</td><td>none</td><td>none</td></tr>
</tbody>
</table></div>
<p class="drill-link"><a href="#/r/cppd/ops">Practice in the drill: Operations and Pitfalls →</a></p>
<h3 id="sec-iter">Iterators</h3>
<p>An iterator is a generalized pointer: <code>*it</code> reads, <code>it-&gt;field</code> reads a member, <code>++it</code> advances. Ranges are half-open, <code>[begin, end)</code>: <code>end()</code> is one past the last element, is never dereferenced, and equals <code>begin()</code> when the range is empty.</p>
<div class="tbl"><table>
<thead><tr><th>Category</th><th>Adds</th><th>Containers</th></tr></thead>
<tbody>
<tr><td>Forward</td><td><code>++it</code></td><td><code>forward_list</code>, <code>unordered_*</code></td></tr>
<tr><td>Bidirectional</td><td><code>--it</code></td><td><code>list</code>, <code>map</code>, <code>set</code></td></tr>
<tr><td>Random access</td><td><code>it + n</code>, <code>it[n]</code>, <code>&lt;</code>, <code>b - a</code></td><td><code>deque</code></td></tr>
<tr><td>Contiguous (C++20)</td><td>elements adjacent in memory</td><td><code>vector</code>, <code>array</code>, <code>span</code></td></tr>
</tbody>
</table></div>
<p>Each category includes everything above it.</p>
<pre><code>for (const auto&amp; inst : rob) { ... }                  <span class="cm">// range-for, no copies</span>
for (const auto&amp; [addr, cnt] : m) { ... }             <span class="cm">// structured bindings</span>
for (auto it = v.rbegin(); it != v.rend(); ++it)      <span class="cm">// youngest-first walk</span>
auto it = std::find_if(rob.begin(), rob.end(),
                       [](const Inst&amp; i) { return !i.done; });
if (it != rob.end()) { ... }                          <span class="cm">// always check before *it</span>

auto lb = sq.lower_bound(seq);     <span class="cm">// first key &gt;= seq   (upper_bound: first key &gt; seq)</span>
if (lb != sq.begin()) {
    auto older = std::prev(lb);    <span class="cm">// youngest store older than the load</span>
}
std::next(it, n);  std::prev(it);  std::advance(it, n);  std::distance(a, b);

for (auto it = m.begin(); it != m.end(); )            <span class="cm">// erase while iterating</span>
    it = it-&gt;second.squashed ? m.erase(it) : std::next(it);</code></pre>
<p>Algorithms take an iterator pair, so one template works for every container: <code>template &lt;typename It&gt; uint64_t sum(It first, It last);</code>. In C++20 ranges, <code>end()</code> may return a different type, called a sentinel.</p>
<h4>Iterator Invalidation</h4>
<div class="tbl"><table>
<thead><tr><th>Container</th><th>After insert</th><th>After erase</th></tr></thead>
<tbody>
<tr><td><code>vector</code></td><td>reallocation: all. Otherwise: at and after the insert point</td><td>at and after the erased element</td></tr>
<tr><td><code>deque</code></td><td>at either end: iterators invalid, references still valid. Middle: all</td><td>at either end: only the erased. Middle: all</td></tr>
<tr><td><code>list</code>, <code>forward_list</code></td><td>none</td><td>only the erased</td></tr>
<tr><td><code>map</code>, <code>set</code></td><td>none</td><td>only the erased</td></tr>
<tr><td><code>unordered_*</code></td><td>rehash: iterators invalid, references still valid</td><td>only the erased</td></tr>
</tbody>
</table></div>
<p>Using an invalidated iterator is undefined behavior. <code>-fsanitize=address</code> and <code>-D_GLIBCXX_DEBUG</code> catch most cases.</p>
<p class="drill-link"><a href="#/r/cppd/iter">Practice in the drill: Iterators →</a></p>
`,
  practice: {
    guided: [
      {
        q: `<p>A model of Zen 5's 448-entry ROB uses the ring buffer from this page. <code>head</code> is 430 and <code>count</code> is 40. Find the slot of the 25th oldest instruction (k = 24, counting from 0) and the current <code>tail</code>. Can the model use a mask instead of <code>%</code>?</p>`,
        a: `<ol>
<li>25th oldest: (430 slots + 24 slots) mod 448 slots = 454 mod 448 = slot 6.</li>
<li>Tail: (430 slots + 40 slots) mod 448 slots = 470 mod 448 = slot 22.</li>
<li>448 = 256 + 192 is not a power of two, so <code>&amp; 447</code> gives wrong slots. Keep <code>%</code>, or use a compare and subtract: <code>if (++i == N) i = 0;</code></li>
</ol>`
      }
    ],
    interview: [
      {
        q: `<p>On a branch mispredict this code removes every ROB entry younger than the branch. The ROB is a <code>std::vector&lt;Inst&gt;</code> ordered oldest first, with 448 entries.</p><pre><code>for (auto it = rob.begin(); it != rob.end(); ++it)
    if (it-&gt;seq &gt; bad_seq) rob.erase(it);</code></pre><p>What is wrong with it, and how would you write it?</p>`,
        a: `<ul>
<li><strong>Undefined behavior:</strong> <code>erase</code> invalidates <code>it</code> and every iterator after it, and the loop then increments it. Even with <code>it = rob.erase(it)</code>, each erase shifts the tail, so squashing k entries costs O(k × n) moves.</li>
<li><strong>Use the order:</strong> the younger entries form a suffix. Find where it starts and drop it in one call: <code>rob.erase(std::partition_point(rob.begin(), rob.end(), [&amp;](const Inst&amp; i) { return i.seq &lt;= bad_seq; }), rob.end());</code> That is O(log n) to find plus O(k) destructors, with no shifting.</li>
<li><strong>Better still:</strong> with a ring buffer ROB, a squash just moves <code>tail</code> back to the slot after the branch and sets <code>count</code>, which is O(1), as in the hardware.</li>
</ul>`
      }
    ]
  }
},
{
  id: "stl-classes",
  region: "stl",
  title: "Classes, Keywords, and Ownership",
  sections: [{ id: "classes", label: "Classes and Structs" }, { id: "keywords", label: "Qualifiers, Deduction, and Aliases" }, { id: "own", label: "Memory and Ownership" }],
  body: `
<h3 id="sec-classes">Classes and Structs</h3>
<p><code>struct</code> and <code>class</code> differ only in default access: public vs private. Convention: <code>struct</code> for plain data (<code>CacheLine</code>), <code>class</code> when it protects invariants (<code>Cache</code>).</p>
<pre><code>class Cache {
public:
    explicit Cache(uint32_t sets, uint32_t ways)    <span class="cm">// explicit: no implicit conversions</span>
        : sets_(sets), ways_(ways),                  <span class="cm">// initializer list constructs directly</span>
          lines_(size_t(sets) * ways) {}
    ~Cache() = default;                              <span class="cm">// destructor: runs at end of scope</span>

    std::optional&lt;uint32_t&gt; lookup(uint64_t addr) const;  <span class="cm">// const: won't modify *this</span>
    uint64_t misses() const { return misses_; }           <span class="cm">// defined in class: implicitly inline</span>

    static inline uint32_t instances = 0;            <span class="cm">// one per program, not per object</span>

protected:                                           <span class="cm">// visible to derived classes only</span>
    uint32_t sets_, ways_;                           <span class="cm">// initialized in DECLARATION order</span>
    std::vector&lt;CacheLine&gt; lines_;
    mutable uint64_t misses_ = 0;                    <span class="cm">// writable even in const methods</span>
};</code></pre>
<p>Members are initialized in the order they're declared, whatever order the initializer list uses. <code>-Wreorder</code> warns when they differ.</p>
<pre><code>struct Component {
    virtual ~Component() = default;   <span class="cm">// needed: delete via Component* must run ~Core</span>
    virtual void tick() = 0;          <span class="cm">// pure virtual: Component is abstract</span>
};
struct Core : Component {
    void tick() override;             <span class="cm">// compile error if it doesn't override anything</span>
};
std::vector&lt;std::unique_ptr&lt;Component&gt;&gt; parts;
for (auto&amp; p : parts) p-&gt;tick();</code></pre>
<p>Virtual calls cost an indirect branch and block inlining. Use them for coarse components ticked once per cycle. For per-instruction dispatch, prefer <code>std::variant</code> + <code>std::visit</code>.</p>
<pre><code>struct Event {
    uint64_t time; int kind;
    bool operator&lt;(const Event&amp; o) const { return time &lt; o.time; }   <span class="cm">// enables sort, set</span>
};
struct Key {
    uint64_t pc; uint32_t hist;
    auto operator&lt;=&gt;(const Key&amp;) const = default;   <span class="cm">// C++20: all six comparisons, memberwise</span>
};</code></pre>
<p class="drill-link"><a href="#/r/cppd/cls">Practice in the drill: Classes and Structs →</a></p>
<h3 id="sec-keywords">Qualifiers, Deduction, and Aliases</h3>
<div class="tbl"><table>
<thead><tr><th>You write</th><th>It means</th></tr></thead>
<tbody>
<tr><td><code>const int n = f();</code></td><td>can't change after init, but the value may come at runtime</td></tr>
<tr><td><code>constexpr size_t kLine = 64;</code></td><td>compile-time constant, usable as an array size or template argument</td></tr>
<tr><td><code>consteval</code> function</td><td>must run at compile time (C++20)</td></tr>
<tr><td><code>const T* p</code></td><td>pointer to const T: can't write through p</td></tr>
<tr><td><code>T* const p</code></td><td>const pointer: can't re-point p</td></tr>
<tr><td><code>const T&amp; r</code></td><td>read-only alias with no copy, which extends a temporary's lifetime</td></tr>
<tr><td><code>auto x = r;</code></td><td>deduces the type, drops reference and top-level const: a copy</td></tr>
<tr><td><code>const auto&amp; x = r;</code></td><td>keeps it a reference</td></tr>
<tr><td><code>decltype(e)</code></td><td>the declared type of e, without evaluating it</td></tr>
<tr><td><code>using Addr = uint64_t;</code></td><td>type alias that works with templates, unlike typedef</td></tr>
<tr><td><code>enum class Op : uint8_t { ... }</code></td><td>scoped names, no implicit int conversion, chosen size</td></tr>
<tr><td><code>static_cast&lt;T&gt;(x)</code></td><td>checked, greppable conversion (<code>reinterpret_cast</code> is for raw bits)</td></tr>
<tr><td><code>alignas(64)</code></td><td>start on a 64-byte boundary</td></tr>
<tr><td><code>mutable</code> member</td><td>writable inside const member functions</td></tr>
</tbody>
</table></div>
<p>Read pointer declarations right to left: <code>uint64_t* const p</code> is "p is a const pointer to uint64_t".</p>
<p class="drill-link"><a href="#/r/cppd/kw">Practice in the drill: Const, Auto, and Using →</a></p>
<h3 id="sec-own">Memory and Ownership</h3>
<p>Coming from C: the rule is <strong>RAII</strong>. An object owns a resource and its destructor releases it on every exit path, including exceptions. You almost never write <code>new</code> or <code>delete</code>.</p>
<pre><code>auto l1 = std::make_unique&lt;Cache&gt;(64, 12);    <span class="cm">// sole owner; freed at end of scope</span>
auto l2 = std::move(l1);                      <span class="cm">// ownership moves; l1 is now nullptr</span>
auto mem = std::make_shared&lt;Memory&gt;();        <span class="cm">// ref-counted; atomic count costs more</span>

void replay(std::span&lt;const uint64_t&gt; addrs); <span class="cm">// view of vector/array/C array: ptr + length</span>
void bump(std::string_view name);             <span class="cm">// view of a string, no allocation</span>

rob.emplace_back(seq, pc);                    <span class="cm">// construct in place from constructor args</span></code></pre>
<ul>
<li>Pass big objects as <code>const T&amp;</code>, and pass small trivially-copyable ones (<code>uint64_t</code>, a 16-byte struct) by value.</li>
<li><code>std::move</code> moves nothing. It casts to an rvalue so the move constructor gets picked. On a const object you silently get a copy.</li>
<li>Mark move constructors <code>noexcept</code>, or <code>vector</code> copies instead of moving when it reallocates.</li>
<li><strong>Rule of zero:</strong> hold resources in members that manage themselves (<code>vector</code>, <code>unique_ptr</code>) and write no special members. <strong>Rule of five:</strong> if you write a destructor, also write copy constructor, copy assignment, move constructor and move assignment.</li>
<li>A pointer into a vector dangles after reallocation. Use indices (they double as ROB IDs), or <code>reserve</code> the hardware capacity up front.</li>
</ul>
<p class="drill-link"><a href="#/r/cppd/own">Practice in the drill: Memory and Ownership →</a></p>
`,
  practice: {
    guided: [
      {
        q: `<p>A model of Zen 4's 72-entry L1 DTLB has this class. What size does <code>entries_</code> get, and how do you fix it?</p><pre><code>class Tlb {
    std::vector&lt;TlbEntry&gt; entries_;
    uint32_t n_;
public:
    explicit Tlb(uint32_t n) : n_(n), entries_(n_) {}
};</code></pre>`,
        a: `<ol>
<li>Members are initialized in declaration order, not initializer-list order. <code>entries_</code> is declared first, so it is constructed first.</li>
<li>At that point <code>n_</code> is uninitialized, so <code>entries_(n_)</code> reads an indeterminate value. That is undefined behavior. In practice it allocates some garbage count of entries, or throws <code>std::bad_alloc</code> when the garbage is around 4 billion entries.</li>
<li><code>-Wall</code> includes <code>-Wreorder</code>, which warns about exactly this.</li>
<li>Fix: build from the parameter, <code>entries_(n)</code>, or declare <code>n_</code> first. Better, drop <code>n_</code> and use <code>entries_.size()</code>, so there is one source of truth for 72 entries.</li>
</ol>`
      }
    ],
    interview: [
      {
        q: `<p>A simulator stores the ROB as <code>std::vector&lt;Inst&gt;</code>, and <code>Inst</code> holds a <code>std::vector&lt;uint16_t&gt;</code> of source registers. Profiling shows that when the vector grows past capacity, it spends its time in <code>malloc</code> and <code>memcpy</code> rather than moving pointers. <code>Inst</code> has a user-written move constructor. What is the likely cause, and what are two fixes?</p>`,
        a: `<ul>
<li><strong>Cause:</strong> the move constructor is not <code>noexcept</code>. On reallocation, <code>vector</code> must keep the strong exception guarantee, so it copies each element unless the move can't throw. Every <code>Inst</code> then deep-copies its source list: one allocation and one copy per element.</li>
<li><strong>Fix 1:</strong> mark the move constructor and move assignment <code>noexcept</code>. Even better, follow the rule of zero: delete the hand-written ones, since the compiler-generated moves are already <code>noexcept</code> when every member's move is.</li>
<li><strong>Fix 2:</strong> <code>reserve</code> the hardware capacity up front (for example 448 entries for Zen 5), so the vector never reallocates and pointers into it stay valid. Replacing the inner vector with a small <code>std::array&lt;uint16_t, N&gt;</code> plus a count, with N the most register sources any µop in the modeled ISA has, also removes the allocation.</li>
</ul>`
      }
    ]
  }
},
{
  id: "stl-templates",
  region: "stl",
  title: "Templates, Lambdas, and Performance",
  sections: [{ id: "tmpl", label: "Templates and Lambdas" }, { id: "perf", label: "Performance and Layout" }],
  body: `
<h3 id="sec-tmpl">Templates and Lambdas</h3>
<pre><code>auto twice = [](int x) { return x * 2; };
<span class="cm">//           [capture] (params) { body }</span>

[&amp;]        capture what's used, by reference (fast; must not outlive them)
[=]        by value; inside a member function, this is still captured as a pointer
[&amp;hits]    only hits, by reference
[x]() mutable { return ++x; }   <span class="cm">// changes the lambda's own copy, not the outer x</span>

std::sort(ev.begin(), ev.end(),
          [](const Event&amp; a, const Event&amp; b) { return a.time &lt; b.time; });
auto loads = std::count_if(rob.begin(), rob.end(),
                           [](const Inst&amp; i) { return i.is_load; });

auto later = [](const Event&amp; a, const Event&amp; b) { return a.time &gt; b.time; };
std::priority_queue&lt;Event, std::vector&lt;Event&gt;, decltype(later)&gt; events(later);</code></pre>
<p>A heap comparator answers "does a have lower priority than b?", so <code>&gt;</code> puts the earliest time on top.</p>
<pre><code>template &lt;typename T, size_t N&gt;              <span class="cm">// N: non-type parameter, fixed at compile time</span>
class RingBuffer { std::array&lt;T, N&gt; buf_; /* ... */ };

template &lt;std::unsigned_integral T&gt;          <span class="cm">// C++20 concept: readable errors</span>
T log2i(T x) { return std::bit_width(x) - 1; }

template &lt;typename T&gt;
void store(T v) {
    if constexpr (sizeof(T) == 8) { /* ... */ }   <span class="cm">// the other branch isn't instantiated</span>
}

std::visit([](auto&amp; op) { op.execute(); }, insts[i]);   <span class="cm">// generic lambda: one copy per type</span>
std::function&lt;void(uint64_t)&gt; on_fill;   <span class="cm">// type-erased: flexible, may allocate, blocks inlining</span></code></pre>
<ul>
<li>Template definitions live in headers: the compiler needs the body to instantiate it for each type.</li>
<li><code>RingBuffer&lt;RobEntry, 512&gt;</code> and <code>RingBuffer&lt;RobEntry, 320&gt;</code> are different types.</li>
<li>In hot paths, take callbacks as a template parameter (<code>template &lt;typename F&gt; void each(F f)</code>) so they inline. That's why <code>std::sort</code> with a lambda beats C's <code>qsort</code>.</li>
</ul>
<p class="drill-link"><a href="#/r/cppd/tmpl">Practice in the drill: Templates and Lambdas →</a></p>
<h3 id="sec-perf">Performance and Layout</h3>
<ul>
<li><strong>vector over list</strong> for scans: contiguous memory streams through the prefetcher, a list misses per node.</li>
<li><strong>Struct of arrays</strong> when a per-cycle loop reads one field across many entries. 4096 valid bits are 512 B, but 4096 32-byte structs are 128 KB.</li>
<li><strong>Padding.</strong> A struct aligns to its strictest member, and each member pads to its own alignment. <code>{char, uint64_t, char}</code> is 24 bytes, but <code>{uint64_t, char, char}</code> is 16. Order members largest to smallest.</li>
<li><strong>Guard hot structs</strong> with <code>static_assert(sizeof(RobEntry) &lt;= 32);</code>.</li>
<li><strong>False sharing:</strong> per-thread counters on one line ping-pong between cores. <code>struct alignas(64) Counter { uint64_t v; };</code></li>
<li><strong><code>unordered_map</code> is node-based:</strong> an allocation per element and a pointer chase per lookup. Prefer direct-indexed arrays for dense keys, or an open-addressing map such as <code>absl::flat_hash_map</code> or <code>boost::unordered_flat_map</code>.</li>
<li><strong>Inlining</strong> unlocks constant propagation. Three ways to get it:
<ul>
<li>Functions defined in the class body are implicitly <code>inline</code>.</li>
<li><code>-flto</code> inlines across .cpp files.</li>
<li><code>[[gnu::always_inline]]</code> forces it (profile first).</li>
</ul>
</li>
<li><code>[[likely]]</code> and <code>[[unlikely]]</code> (C++20) move cold paths out of line.</li>
<li>Cache lines are 64 B on x86 and 128 B on Apple M-series.</li>
</ul>
<div class="tbl"><table>
<thead><tr><th>Purpose</th><th>Flags</th></tr></thead>
<tbody>
<tr><td>Fast build you can still profile</td><td><code>-O2 -g -fno-omit-frame-pointer</code></td></tr>
<tr><td>Inline across .cpp files</td><td><code>-flto</code></td></tr>
<tr><td>Catch memory and UB bugs</td><td><code>-fsanitize=address,undefined -g</code></td></tr>
<tr><td>Checked <code>[]</code> and iterators (libstdc++)</td><td><code>-D_GLIBCXX_ASSERTIONS</code>, <code>-D_GLIBCXX_DEBUG</code></td></tr>
<tr><td>Warnings worth having</td><td><code>-Wall -Wextra -Wconversion</code></td></tr>
<tr><td>Find the hot spots</td><td><code>perf record -g ./sim</code> then <code>perf report</code></td></tr>
</tbody>
</table></div>
<p class="drill-link"><a href="#/r/cppd/perf">Practice in the drill: Performance and Layout →</a></p>
`,
  practice: {
    guided: [
      {
        q: `<p>A model of Golden Cove's 97-entry scheduler uses this entry on x86-64. Find its size, reorder it, and compare how many 64 B host cache lines the per-cycle wakeup scan touches with an array of structs versus a separate bit mask of valid entries.</p><pre><code>struct IqEntry { bool valid; uint64_t seq; uint16_t dst; bool ready; uint32_t pc_lo; };</code></pre>`,
        a: `<ol>
<li>Offsets: <code>valid</code> at 0 B, 7 B of padding, <code>seq</code> at 8 B, <code>dst</code> at 16 B, <code>ready</code> at 18 B, 1 B of padding, <code>pc_lo</code> at 20 B. The struct ends at 24 B, a multiple of its 8 B alignment, so <code>sizeof</code> is 24 B.</li>
<li>Largest to smallest (<code>seq</code>, <code>pc_lo</code>, <code>dst</code>, <code>valid</code>, <code>ready</code>): 8 B + 4 B + 2 B + 1 B + 1 B = 16 B, with no padding.</li>
<li>Array of structs at 24 B: 97 entries × 24 B/entry = 2,328 B, which is 2,328 B / 64 B/line ≈ 36.4, so 37 lines.</li>
<li>At 16 B: 97 entries × 16 B/entry = 1,552 B / 64 B/line ≈ 24.3, so 25 lines.</li>
<li>Bit mask: 97 bits fit in 2 <code>uint64_t</code> words = 16 B, so 1 line. The scan becomes <code>countr_zero</code> on 2 words instead of 97 loads.</li>
</ol>`
      }
    ],
    interview: [
      {
        q: `<p>A discrete-event model uses this event queue. Which event comes out first, and is there a cost to switching the comparator to a <code>std::function&lt;bool(const Event&amp;, const Event&amp;)&gt;</code> so it can be configured at runtime?</p><pre><code>auto cmp = [](const Event&amp; a, const Event&amp; b) { return a.time &lt; b.time; };
std::priority_queue&lt;Event, std::vector&lt;Event&gt;, decltype(cmp)&gt; q(cmp);</code></pre>`,
        a: `<ul>
<li><strong>Order:</strong> the comparator means "a has lower priority than b". With <code>&lt;</code>, the latest time has the highest priority, so <code>top()</code> is the event furthest in the future. The simulation runs backwards in time. Use <code>a.time &gt; b.time</code>. For equal times, add a tie-breaker such as a sequence number, or runs aren't reproducible across library versions.</li>
<li><strong>Cost:</strong> the lambda has its own type, so each comparison inlines to one compare. <code>std::function</code> erases the type: every comparison becomes an indirect call that can't be inlined. A push or pop walks about log<sub>2</sub>(10,000 events) ≈ 13 heap levels with one or two comparisons per level, so 10,000 pending events cost 13 to 26 indirect calls per operation, on the simulator's hottest path.</li>
<li><strong>Runtime choice without that cost:</strong> make the queue a template on the comparator and pick the instantiation once at startup, or branch on a config flag inside one inlined comparator.</li>
</ul>`
      }
    ]
  }
},
{
  id: "stl-skeleton",
  region: "stl",
  title: "Code Traps and a Simulator Skeleton",
  sections: [{ id: "traps", label: "Reading Code: The Classic Traps" }, { id: "skeleton", label: "Putting It Together: A Cycle-Level Skeleton" }, { id: "beyond", label: "Beyond the Drill" }],
  body: `
<h3 id="sec-traps">Reading Code: The Classic Traps</h3>
<div class="tbl"><table>
<thead><tr><th>Snippet</th><th>Result</th><th>Why</th></tr></thead>
<tbody>
<tr><td><code>vector&lt;int&gt; v{10, 2}; v.size()</code></td><td>2</td><td>braces list the elements</td></tr>
<tr><td><code>vector&lt;int&gt; v(3); v[1]</code></td><td>0</td><td>the count constructor value-initializes</td></tr>
<tr><td><code>uint8_t c = 255; c++; int(c)</code></td><td>0</td><td>unsigned wraps mod 256</td></tr>
<tr><td><code>std::cout &lt;&lt; c</code> with <code>uint8_t c</code></td><td>a character</td><td><code>uint8_t</code> is <code>unsigned char</code>, so print <code>int(c)</code></td></tr>
<tr><td><code>(5u - 6) &gt; 0</code></td><td>1</td><td>wraps to 4294967295</td></tr>
<tr><td><code>remove_if(...)</code>, then <code>size()</code></td><td>unchanged</td><td>remove doesn't erase</td></tr>
<tr><td><code>sizeof</code> of <code>{char; uint64_t; char;}</code></td><td>24</td><td>padding</td></tr>
<tr><td><code>[x]() mutable { ++x; }</code>, then outer <code>x</code></td><td>unchanged</td><td>the lambda owns a copy</td></tr>
<tr><td><code>std::cout &lt;&lt; true</code></td><td>1</td><td>add <code>std::boolalpha</code> to print "true"</td></tr>
<tr><td><code>priority_queue&lt;int&gt;</code> after pushing 4, 9, 1: <code>top()</code></td><td>9</td><td>max-heap by default</td></tr>
<tr><td>empty <code>unordered_map m; m[5] == 0;</code> then <code>size()</code></td><td>1</td><td><code>[]</code> inserted key 5</td></tr>
</tbody>
</table></div>
<p class="drill-link"><a href="#/r/cppd/read">Practice in the drill: Read the Code →</a></p>
<h3 id="sec-skeleton">Putting It Together: A Cycle-Level Skeleton</h3>
<p>This compiles with <code>g++ -std=c++20 -Wall -Wextra -O2</code>. It has a ring-buffer ROB, a set-associative cache with flat storage, per-way LRU ages and an optional-returning lookup, all driven by a cycle loop. Sizes follow Golden Cove: 48 KB 12-way L1D with 64 B lines, 512-entry ROB.</p>
<pre><code>#include &lt;array&gt;
#include &lt;bit&gt;
#include &lt;cstdint&gt;
#include &lt;optional&gt;
#include &lt;vector&gt;

using Addr  = uint64_t;
using Cycle = uint64_t;

<span class="cm">// Fixed-capacity FIFO with stable indices (ROB, LSQ, fetch buffer)</span>
template &lt;typename T, size_t N&gt;
class RingBuffer {
public:
    bool   full()  const { return count_ == N; }
    bool   empty() const { return count_ == 0; }
    size_t size()  const { return count_; }

    size_t push(const T&amp; x) {            <span class="cm">// returns the slot index (the "ROB ID")</span>
        size_t id = tail_;
        buf_[tail_] = x;
        tail_ = (tail_ + 1) % N;
        ++count_;
        return id;
    }
    T&amp;   front()                { return buf_[head_]; }
    void pop()                  { head_ = (head_ + 1) % N; --count_; }
    T&amp;   operator[](size_t id)  { return buf_[id]; }               <span class="cm">// by slot</span>
    T&amp;   nth_oldest(size_t k)   { return buf_[(head_ + k) % N]; }  <span class="cm">// by age</span>

private:
    std::array&lt;T, N&gt; buf_{};
    size_t head_ = 0, tail_ = 0, count_ = 0;
};

struct CacheLine {
    Addr     tag   = 0;
    bool     valid = false;
    bool     dirty = false;
    uint32_t age   = 0;                  <span class="cm">// LRU: larger = older</span>
};

class Cache {
public:
    Cache(uint32_t sets, uint32_t ways, uint32_t line_bytes)
        : sets_(sets), ways_(ways),
          offset_bits_(std::countr_zero(line_bytes)),
          index_bits_(std::countr_zero(sets)),
          lines_(size_t(sets) * ways) {}

    std::optional&lt;uint32_t&gt; lookup(Addr a) const {
        uint32_t s = set_of(a);
        for (uint32_t w = 0; w &lt; ways_; ++w) {
            const CacheLine&amp; l = line(s, w);
            if (l.valid &amp;&amp; l.tag == tag_of(a)) return w;
        }
        return std::nullopt;
    }

    bool access(Addr a) {                <span class="cm">// true = hit</span>
        uint32_t s = set_of(a);
        if (auto w = lookup(a)) { touch(s, *w); ++hits_; return true; }
        uint32_t v = victim(s);
        line(s, v) = CacheLine{tag_of(a), true, false, 0};
        touch(s, v);
        ++misses_;
        return false;
    }

    uint64_t hits()   const { return hits_; }
    uint64_t misses() const { return misses_; }

private:
    uint32_t set_of(Addr a) const { return (a &gt;&gt; offset_bits_) &amp; (sets_ - 1); }
    Addr     tag_of(Addr a) const { return a &gt;&gt; (offset_bits_ + index_bits_); }
    CacheLine&amp;       line(uint32_t s, uint32_t w)       { return lines_[s * ways_ + w]; }
    const CacheLine&amp; line(uint32_t s, uint32_t w) const { return lines_[s * ways_ + w]; }

    void touch(uint32_t s, uint32_t w) {
        for (uint32_t i = 0; i &lt; ways_; ++i) ++line(s, i).age;
        line(s, w).age = 0;
    }
    uint32_t victim(uint32_t s) const {
        uint32_t best = 0;
        for (uint32_t w = 0; w &lt; ways_; ++w) {
            if (!line(s, w).valid) return w;          <span class="cm">// free way first</span>
            if (line(s, w).age &gt; line(s, best).age) best = w;
        }
        return best;
    }

    uint32_t sets_, ways_, offset_bits_, index_bits_;
    std::vector&lt;CacheLine&gt; lines_;       <span class="cm">// flat, set-major</span>
    uint64_t hits_ = 0, misses_ = 0;
};

struct RobEntry { uint64_t seq = 0; Addr pc = 0; bool done = false; };
static_assert(sizeof(RobEntry) &lt;= 24);

int main() {
    Cache l1d(64, 12, 64);               <span class="cm">// 64 sets x 12 ways x 64 B = 48 KB</span>
    RingBuffer&lt;RobEntry, 512&gt; rob;
    uint64_t seq = 0;
    for (Cycle c = 0; c &lt; 1000; ++c) {
        if (!rob.full()) rob.push({seq++, 0x400000 + 4 * c, false});
        l1d.access(0x10000 + 64 * (c % 1024));
        if (!rob.empty() &amp;&amp; (c % 2)) rob.front().done = true;
        while (!rob.empty() &amp;&amp; rob.front().done) rob.pop();
    }
    return int(l1d.hits() &gt; l1d.misses());
}</code></pre>
<p>Ways to extend it:</p>
<ul>
<li>Swap the age counters for tree-PLRU: one <code>uint16_t</code> per set, node i's children at 2i+1 and 2i+2.</li>
<li>Add MSHRs as <code>unordered_map&lt;Addr, vector&lt;Request&gt;&gt;</code> and stall when <code>size()</code> reaches the MSHR count.</li>
<li>Drive it from a trace file instead of a synthetic loop (see Reading a Binary Trace below).</li>
<li>Run the same trace through ChampSim and compare MPKI.</li>
</ul>
<h3 id="sec-beyond">Beyond the Drill</h3>
<h4>Coming from C</h4>
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
<h4>Reproducible Runs</h4>
<pre><code>std::mt19937_64 rng(42);                                    <span class="cm">// fixed seed: identical runs</span>
std::uniform_int_distribution&lt;uint32_t&gt; pick(0, ways - 1);
uint32_t victim = pick(rng);                                <span class="cm">// random replacement</span></code></pre>
<p>Seed from the config so a surprising result can be replayed exactly.</p>
<h4>Reading a Binary Trace</h4>
<pre><code>struct TraceRec { uint64_t pc, addr; uint8_t is_load, is_branch, taken, pad[5]; };
static_assert(sizeof(TraceRec) == 24);

std::ifstream in(path, std::ios::binary);
TraceRec r;
while (in.read(reinterpret_cast&lt;char*&gt;(&amp;r), sizeof r)) {
    <span class="cm">// feed r into fetch</span>
}</code></pre>
<h4>Printing Stats</h4>
<pre><code>std::cout &lt;&lt; std::format("{:&lt;20}{:&gt;12}\\n", "l1d.misses", misses);  <span class="cm">// C++20 &lt;format&gt;, GCC 13+</span>
double mpki = 1000.0 * misses / instructions;   <span class="cm">// 1000.0 forces floating-point division</span></code></pre>
<h4>Small Habits</h4>
<ul>
<li><code>[[nodiscard]]</code> on lookup functions, so ignoring a result warns.</li>
<li><code>assert(!rob.empty());</code> documents invariants and compiles out with <code>-DNDEBUG</code>.</li>
<li><code>uint8_t + uint8_t</code> is an <code>int</code>. It bites in <code>std::min(ctr + 1, 3)</code> on a <code>uint8_t ctr</code>.</li>
<li>Mixing signed and unsigned in comparisons: enable <code>-Wsign-compare</code> and use <code>size_t</code> loop counters.</li>
</ul>
<h4>Further Reading</h4>
<ul>
<li>Hennessy &amp; Patterson, Computer Architecture: A Quantitative Approach (6th ed.), ch. 2 and 3, for the structures being modeled.</li>
<li>cppreference.com, for each function's complexity, invalidation rules and C++ version.</li>
<li>Stroustrup, A Tour of C++ (3rd ed.), the whole language in about 300 pages for people who already program.</li>
<li>ChampSim and gem5 source code: real C++ simulators. ChampSim's cache and branch predictor modules are short enough to read in an afternoon.</li>
</ul>
`,
  practice: {
    guided: [
      {
        q: `<p>Configure the skeleton's <code>Cache</code> for Zen 4's L1D: 32 KiB, 8-way, 64 B lines. Find the set count, the offset and index bits, and the set and tag of address <code>0x12345678</code>.</p>`,
        a: `<ol>
<li>Sets: 32,768 B / (8 ways × 64 B/line) = 64 sets, a power of two, so the mask in <code>set_of</code> works.</li>
<li>Offset bits: log<sub>2</sub>(64 B) = 6 bits. Index bits: log<sub>2</sub>(64 sets) = 6 bits.</li>
<li>Set: <code>0x12345678 &gt;&gt; 6</code> = <code>0x48D159</code>, and <code>0x48D159 &amp; 63</code> = <code>0x19</code> = set 25.</li>
<li>Tag: <code>0x12345678 &gt;&gt; (6 + 6)</code> = <code>0x12345</code>.</li>
<li>Constructor call: <code>Cache l1d(64, 8, 64);</code></li>
</ol>`
      }
    ],
    interview: [
      {
        q: `<p>To save memory in a model of Raptor Cove's 2 MiB, 16-way L2, a colleague shrinks the skeleton's <code>CacheLine::age</code> from <code>uint32_t</code> to <code>uint8_t</code>. What goes wrong, after how many accesses, and how would you keep true LRU in 8 bits?</p>`,
        a: `<ul>
<li><strong>What breaks:</strong> <code>touch</code> increments every way's age on each access to the set. A way that isn't touched for 256 accesses to its set wraps from 255 to 0 and looks like the most recently used line. <code>victim</code> then keeps the oldest line and evicts younger ones, so the miss rate is wrong with no error.</li>
<li><strong>When:</strong> whenever a line stays resident while its set sees 256 other accesses, for example a loop whose hot lines keep hitting in the same set. The next miss in that set then evicts a hot line. The L2 has 2,097,152 B / (16 ways × 64 B/line) = 2,048 sets, so with accesses spread evenly that takes about 2,048 sets × 256 accesses/set = 524,288 accesses, a tiny fraction of a 100-million-instruction simulation point.</li>
<li><strong>Fix:</strong> store a rank instead of a count. On a touch, increment only the ways whose rank is lower than the touched way's old rank, then set the touched way to 0. Ranks stay in 0 to 15, which needs log<sub>2</sub>(16) = 4 bits, so <code>uint8_t</code> is more than enough.</li>
</ul>`
      }
    ]
  }
}
]);
