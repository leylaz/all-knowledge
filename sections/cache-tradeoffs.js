/* Section: Cache trade-offs
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "ctr"). */

section({
  id: "ctr",
  name: "Cache Trade-Offs",
  cap: "Size, associativity, line size, replacement, banking, write policy, by workload",
  body: `
<p>The first two pages set up the vocabulary: <a href="#/cache-misses">Classifying Cache Misses</a> sorts misses into compulsory, capacity, conflict, and coherence, and <a href="#/cache-patterns">Workload Access Patterns</a> describes the access patterns programs are built from. Each later page takes one cache parameter and splits it into options. Every option covers its motivation, how it works, an example, its implementation, and the access patterns and workloads it helps and hurts. The page then ends with the math, its power, performance, and area (PPA) cost, and how it plays out for every workload type below.</p>
<h3>The Workload Types Used Throughout</h3>
<div class="tbl"><table>
<tr><th>Workload</th><th>Examples</th><th>Memory signature</th></tr>
<tr><td>Compute-bound</td><td>548.exchange2, 508.namd, crypto</td><td>Small working set, few misses</td></tr>
<tr><td>Pointer chasing</td><td>505.mcf, graphs, trees, linked lists</td><td><ul><li>Dependent, irregular misses</li><li>Low MLP</li></ul></td></tr>
<tr><td>Streaming</td><td>519.lbm, STREAM, memcpy</td><td><ul><li>Sequential, little reuse</li><li>Bandwidth-bound</li></ul></td></tr>
<tr><td>Large code footprint</td><td>Servers, browsers, 502.gcc</td><td>Instruction misses dominate</td></tr>
<tr><td>Branch-heavy integer</td><td>531.deepsjeng, 557.xz</td><td><ul><li>Moderate working set</li><li>Mispredicts dominate</li></ul></td></tr>
<tr><td>Blocked numerics</td><td>GEMM, stencils, convolutions</td><td>High reuse inside tiles</td></tr>
<tr><td>ML inference</td><td>Transformer and CNN inference on CPU</td><td><ul><li>Large weights streamed</li><li>Activations reused</li></ul></td></tr>
<tr><td>Multithreaded shared data</td><td>Databases, web servers, key-value stores</td><td>Shared LLC pressure, coherence traffic</td></tr>
</table></div>`,
  practice: {
    guided: [
      {
        q: `<p>A workload's L1 miss rate barely changes when you double L1 size, double associativity, or change replacement policy, but nearly halves when you double line size. What kind of workload is it?</p>`,
        a: `<ol><li>Insensitive to size, associativity, and replacement means there is little reuse to capture.</li><li>Sensitive to line size means each miss brings in data that is used soon after: strong spatial locality.</li><li>That is a <strong>streaming</strong> workload. A good prefetcher would give the same benefit without changing the line size.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>You can spend a fixed area budget on either a larger L2 or a smarter replacement policy plus a prefetcher. How do you decide?</p>`,
        a: `<p>Classify the target workloads first. Capacity helps when working sets sit just above the current size (cliff behavior). Replacement policy helps when the cache thrashes with scans or cyclic patterns larger than capacity. Prefetching helps streaming and strided access regardless of size. Measure miss-rate curves versus size per workload, the share of misses from scans, and stride coverage, then compare predicted IPC per mm² and per watt. A larger cache also adds latency and leakage, while the policy changes add little of either.</p>`
      }
    ]
  }
}, [
{
  id: "cache-misses",
  region: "ctr",
  title: "Classifying Cache Misses",
  sections: [
    { id: "four-cs", label: "The Four Kinds of Misses" },
    { id: "seen-set", label: "Seen-Set Tracking" },
    { id: "shadow", label: "Shadow Caches" },
    { id: "classify", label: "Classifying Every Miss" },
    { id: "coherence", label: "Detecting Coherence Misses" },
    { id: "example", label: "Worked Example" },
    { id: "pitfalls", label: "Pitfalls" },
    { id: "fixes", label: "What Each Class Points To" }
  ],
  body: `
<p>Before changing a cache parameter, find out why the cache misses. Each kind of miss has a different fix, and a parameter that removes one kind does nothing for the others. A performance model sorts every miss into one of four classes by running two pieces of bookkeeping next to the real cache: a seen set and a shadow cache.</p>

<h3 id="sec-four-cs">The Four Kinds of Misses</h3>
<p>Mark Hill's "three Cs" (1987), as presented in Hennessy and Patterson, plus the coherence miss that multicore systems add:</p>
<ul>
<li><strong>Compulsory (cold):</strong> the first access to a line. No cache, however large, could hold a line it has never seen. These misses happen even in an infinite cache.</li>
<li><strong>Capacity:</strong> the line was seen before but was evicted because the program touched more distinct lines since then than the cache holds. A fully associative cache of the same size would also miss.</li>
<li><strong>Conflict:</strong> the line was evicted because too many lines mapped to its set, even though the cache as a whole had room. A fully associative cache of the same size would have hit.</li>
<li><strong>Coherence:</strong> the line was in the cache but another core's write invalidated it. Without that write the access would have hit. It is <em>true sharing</em> when the two cores touch the same bytes and <em>false sharing</em> when they touch different bytes that happen to share a line.</li>
</ul>
<p>The definitions are relative: capacity and conflict are defined by comparison with a reference cache, and compulsory by the line size. The reference cache is the standard convention, not a law of nature, and the <a href="#/cache-misses/pitfalls">pitfalls</a> below come from that.</p>

<h3 id="sec-seen-set">Seen-Set Tracking</h3>
<p><strong>What it is.</strong> A set of every line address the cache has ever been asked for. An access is compulsory if its line is not yet in the set. Classification inserts the line on every access, so each line produces exactly one compulsory miss per run.</p>
<p><strong>How it's keyed.</strong> By line address, which is the byte address shifted right by log<sub>2</sub>(line size): address &gt;&gt; 6 for 64-byte lines. Two loads to different bytes of one line are one entry. The seen set belongs to one cache, so each private L1 has its own. A line that core 0 has already used is still compulsory for core 1's L1, because core 1's cache never held it.</p>
<p><strong>Implementation in a simulator.</strong></p>
<ul>
<li><strong>Hash set:</strong> simplest, but costs tens of bytes per entry with pointer-based tables.</li>
<li><strong>Two-level bitmap:</strong> one bit per line, allocated one page at a time as pages are first touched. A page table of bitmaps costs footprint / 512 bytes for 64-byte lines: an 8 GB footprint is 128 M lines, so 16 MB of bits.</li>
<li><strong>Bloom filter:</strong> fixed memory, but a false positive calls a compulsory miss "seen" and pushes it into the capacity or conflict count. Use it only when the footprint is too large for a bitmap and report the false-positive rate.</li>
</ul>

<h3 id="sec-shadow">Shadow Caches</h3>
<p><strong>What it is.</strong> A second cache model that sees the same access stream as the real cache but never affects timing or data. For miss classification the shadow is <em>fully associative with LRU replacement</em> and holds the same number of lines as the real cache: a 48 KB cache with 64-byte lines gets a 768-line shadow. A miss that this shadow also takes is a capacity miss. A miss the shadow would have hit is a conflict miss, because only the mapping to sets stopped the real cache.</p>
<p><strong>Implementation in a simulator.</strong> A hash map from line address to a node in a doubly linked list. The list is the LRU stack: a hit unlinks the node and moves it to the head, a miss inserts at the head and, when full, removes the tail. Both are O(1). A 32 MB LLC shadow has 524,288 nodes, about 20 MB of host memory at roughly 40 bytes per node.</p>
<p><strong>Every size at once.</strong> Mattson's stack algorithm (1970) records each access's <em>stack distance</em>: the number of distinct lines touched since the last access to the same line. A fully associative LRU cache of C lines hits exactly when that distance is below C, so one pass yields capacity-miss counts for every cache size. A balanced tree over last-access times makes each step O(log n).</p>
<p><strong>In hardware.</strong> Shadow tags also appear on real chips, without data and only on a sample of sets. Utility-based cache partitioning (Qureshi and Patt, MICRO 2006) keeps an auxiliary tag directory per core on 32 sampled sets and counts hits by LRU stack position, which tells it how many ways each core would use well.</p>

<h3 id="sec-classify">Classifying Every Miss</h3>
<p>Update all the bookkeeping on every access, whether the real cache hits or not, then classify in this order:</p>
<pre><code>/* L = address &gt;&gt; log2(line size), for one access by core c */
bool real_hit   = cache_access(&amp;real[c], L);
bool shadow_hit = fa_lru_access(&amp;shadow[c], L);  /* always updated */
bool first      = seen_insert(&amp;seen[c], L);      /* true if L is new */
bool inval      = inval_take(&amp;inval[c], L);      /* clears the mark */

if (real_hit)              return HIT;
if (inval &amp;&amp; shadow_hit)   return COHERENCE;
if (first)                 return COMPULSORY;
if (!shadow_hit)           return CAPACITY;
return CONFLICT;</code></pre>
<p>Coherence comes first because an invalidated line has been seen before and the shadow, which never sees invalidations, would otherwise call it a conflict. Compulsory comes before capacity because the shadow also misses on a line's first access.</p>

<h3 id="sec-coherence">Detecting Coherence Misses</h3>
<ul>
<li><strong>Mark invalidations.</strong> When the protocol invalidates line L in core c's cache because another core wrote it, add L to an invalidated set for core c. A refill of L takes the mark away.</li>
<li><strong>Check that it would have hit.</strong> Count a coherence miss only if the shadow still holds L. If the shadow has also evicted it, the line would have left anyway, and the miss is capacity.</li>
<li><strong>Split true from false sharing.</strong> Record, per line, a byte mask of what the remote writer changed. If the missing access reads none of those bytes, the miss is false sharing (the definition of Dubois and colleagues, 1993). Report it by line and load PC so the layout fix is obvious.</li>
<li><strong>Downgrades count too.</strong> A write to a line that another core's read downgraded from Modified or Exclusive to Shared needs an upgrade request. Count these separately as coherence upgrades: the data is present, so they are not misses in the data sense, but they cost a round trip.</li>
</ul>

<h3 id="sec-example">Worked Example</h3>
<p>A direct-mapped cache with 4 one-line sets (set = line mod 4) and its 4-line fully associative LRU shadow. Core 0 makes 10 accesses, and core 1 writes line 2 between accesses 5 and 6:</p>
<div class="tbl"><table>
<tr><th>Access</th><th>Line</th><th>Set</th><th>Real cache</th><th>Shadow (MRU → LRU)</th><th>Seen before?</th><th>Class</th></tr>
<tr><td>0</td><td>0</td><td>0</td><td>miss</td><td>0</td><td>no</td><td>compulsory</td></tr>
<tr><td>1</td><td>4</td><td>0</td><td>miss, evicts 0</td><td>4 0</td><td>no</td><td>compulsory</td></tr>
<tr><td>2</td><td>0</td><td>0</td><td>miss, evicts 4</td><td>0 4 (hit)</td><td>yes</td><td><strong>conflict</strong></td></tr>
<tr><td>3</td><td>1</td><td>1</td><td>miss</td><td>1 0 4</td><td>no</td><td>compulsory</td></tr>
<tr><td>4</td><td>2</td><td>2</td><td>miss</td><td>2 1 0 4</td><td>no</td><td>compulsory</td></tr>
<tr><td>5</td><td>3</td><td>3</td><td>miss</td><td>3 2 1 0 (evicts 4)</td><td>no</td><td>compulsory</td></tr>
<tr><td colspan="7">Core 1 writes line 2, invalidating it in core 0's cache. The shadow keeps it.</td></tr>
<tr><td>6</td><td>2</td><td>2</td><td>miss</td><td>2 3 1 0 (hit)</td><td>yes, invalidated</td><td><strong>coherence</strong></td></tr>
<tr><td>7</td><td>3</td><td>3</td><td>hit</td><td>3 2 1 0 (hit)</td><td>yes</td><td>hit</td></tr>
<tr><td>8</td><td>5</td><td>1</td><td>miss, evicts 1</td><td>5 3 2 1 (evicts 0)</td><td>no</td><td>compulsory</td></tr>
<tr><td>9</td><td>4</td><td>0</td><td>miss, evicts 0</td><td>4 5 3 2 (miss)</td><td>yes</td><td><strong>capacity</strong></td></tr>
</table></div>
<p>Result: 9 misses, made up of 6 compulsory, 1 conflict, 1 coherence, and 1 capacity. Access 2 shows the conflict case: lines 0 and 4 share set 0 while sets 1 to 3 are empty. Access 9 shows capacity: lines 1, 2, 3, 5, and 0 were touched after line 4's last use, five distinct lines for a four-line cache.</p>

<h3 id="sec-pitfalls">Pitfalls</h3>
<ul>
<li><strong>Negative conflict counts.</strong> The real cache can hit where the fully associative LRU shadow misses. A loop over C + 1 lines gets zero hits in a C-line LRU shadow, but a set-associative cache whose sets each see fewer lines, or one with a smarter policy, hits some of them. Subtracting totals (real misses − shadow misses) then gives a negative conflict count. Classifying each miss avoids negative numbers, but also count the "real hit, shadow miss" accesses, since they show the shadow is not a lower bound.</li>
<li><strong>Policy dependence.</strong> With an OPT shadow instead of LRU, many capacity misses become "policy misses" that a better replacement policy could remove. Some studies report capacity, conflict, and policy misses separately for this reason.</li>
<li><strong>Prefetching.</strong> A prefetched line's first demand access is a hit, so prefetching hides compulsory misses. Feed prefetch fills into the seen set and shadow too and tag each miss by whether a prefetch was in flight, or classify a no-prefetch run as the baseline.</li>
<li><strong>Multi-level caches.</strong> Classify each level against its own input stream. The L2 sees L1 misses and L1 writebacks, not the program's loads, so an L2 conflict miss says nothing about the L1.</li>
<li><strong>Line size changes the answer.</strong> Doubling the line size halves the seen set and moves some compulsory misses into hits. Compare classifications only between runs with the same line size.</li>
</ul>

<h3 id="sec-fixes">What Each Class Points To</h3>
<div class="tbl"><table>
<tr><th>Class</th><th>What fixes it</th><th>Where to read more</th></tr>
<tr><td>Compulsory</td><td><ul><li>Prefetching</li><li>Larger lines or sectored lines with adjacent-line fetch</li></ul></td><td><a href="#/cache-line">Cache-Line Size</a>, <a href="#/cache-patterns/stream">Sequential Streaming</a></td></tr>
<tr><td>Capacity</td><td><ul><li>A larger cache</li><li>Software blocking</li><li>A thrash-resistant policy that keeps part of the working set</li></ul></td><td><a href="#/cache-size">Cache Size</a>, <a href="#/cache-replacement">Replacement Policies</a>, <a href="#/cache-patterns/tiled">Blocked and Tiled Loops</a></td></tr>
<tr><td>Conflict</td><td><ul><li>More ways</li><li>Index hashing or skewing</li><li>Padding arrays and rows</li></ul></td><td><a href="#/cache-assoc">Associativity</a>, <a href="#/cache-patterns/strided">Strided Access</a></td></tr>
<tr><td>Coherence</td><td><ul><li>Padding per-thread data to separate lines (false sharing)</li><li>Fewer shared writes, batching, or per-core copies (true sharing)</li></ul></td><td><a href="#/cache-patterns/shared">Shared and Producer-Consumer Data</a>, <a href="#/cache-write">Write Policies</a></td></tr>
</table></div>
<p class="refs">References: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Appendix B (the three Cs) · Hill, "Aspects of Cache Memory and Instruction Buffer Performance," PhD thesis, UC Berkeley, 1987 · Mattson et al., "Evaluation Techniques for Storage Hierarchies," IBM Systems Journal, 1970 · Dubois et al., "The Detection and Elimination of Useless Misses in Multiprocessors," ISCA 1993 · Qureshi and Patt, "Utility-Based Cache Partitioning," MICRO 2006</p>`,
  practice: {
    guided: [
      {
        q: `<p>A 2-set, 2-way LRU cache (set = line mod 2) and its 4-line fully associative LRU shadow see core 0's accesses to lines 0, 2, 4, 0, 1, 6, 2, then core 1 writes line 1, then core 0 accesses 1, 4, 8, 0. Classify every access.</p>`,
        a: `<ol><li>Lines 0, 2, 4: first uses, all <strong>compulsory</strong>. They all map to set 0, so 4 evicts 0 (the LRU line of the set).</li><li>0: seen, real miss, but the shadow still holds it (shadow 4 2 0). <strong>Conflict.</strong> It evicts 2 from set 0.</li><li>1 and 6: first uses, <strong>compulsory</strong>. 6 evicts 4 from set 0, and the shadow evicts 2.</li><li>2: seen, real miss, and the shadow evicted it at the previous step. <strong>Capacity.</strong></li><li>Core 1's write invalidates line 1 in core 0's cache and marks it.</li><li>1: marked and still in the shadow (2 6 1 0). <strong>Coherence.</strong></li><li>4: seen, shadow evicted it when 2 came back. <strong>Capacity.</strong> 8: first use, <strong>compulsory</strong>. 0: the shadow evicted it when 4 came back. <strong>Capacity.</strong></li><li>Totals: 11 misses: 6 compulsory, 1 conflict, 3 capacity, 1 coherence.</li></ol>`
      },
      {
        q: `<p>A model of a Golden Cove core's 48 KB, 12-way L1D with 64 B lines runs 200 M loads and stores and takes 6.0 M misses. The seen set ends with 0.9 M lines. The 768-line fully associative LRU shadow misses 4.4 M times, and every shadow miss is also a real miss. 0.3 M real misses are to invalidated lines that the shadow still holds. Classify the misses and say what to try first.</p>`,
        a: `<ol><li>Compulsory = lines in the seen set = <strong>0.9 M</strong>. The footprint is 0.9 M × 64 B ≈ 58 MB.</li><li>The shadow misses on every compulsory access too, so capacity = 4.4 − 0.9 = <strong>3.5 M</strong>.</li><li>Coherence = <strong>0.3 M</strong> (the shadow hits on these, so they are not in the 4.4 M).</li><li>Conflict = 6.0 − 0.9 − 3.5 − 0.3 = <strong>1.3 M</strong>, about 22% of misses.</li><li>Capacity dominates (58%), so the working set is well beyond 48 KB: blocking, or relying on the L2, matters most. The 22% conflict share is high for 12 ways and suggests power-of-two strides or aligned arrays. Look at the per-PC conflict counts for a stride before adding ways.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Your simulator subtracts total shadow-cache misses from total real-cache misses to get conflict misses, and one benchmark reports a negative number. Is the simulator broken? What would you report instead?</p>`,
        a: `<p>Not necessarily. The fully associative LRU shadow is not a lower bound: on a cyclic loop slightly larger than the cache it misses every time, while a set-associative cache, whose sets each see a different subset of lines, or a thrash-resistant policy can hit on part of the loop. Classify each miss individually (real miss and shadow hit means conflict, both miss means capacity) so no class goes negative, and also count "real hit, shadow miss" accesses as a separate column. If that column is large, compare against an OPT shadow as well, which splits out the misses a better policy could remove.</p>`
      },
      {
        q: `<p>Two threads increment their own counters in an array of 8-byte counters, and your model reports many coherence misses. How do you prove they are false sharing rather than true sharing, and what does the fix cost?</p>`,
        a: `<p>Record a byte mask per line of what each remote write changed, and on each coherence miss check whether the missing access touches any of those bytes. If the masks never overlap, every such miss is false sharing. Here thread 0 writes bytes 0 to 7 and thread 1 bytes 8 to 15 of the same line. Fix: align each counter to its own line (64 B, or 128 B on Intel parts whose L2 spatial prefetcher fetches line pairs). That costs 56 or 120 bytes of padding per counter, which is trivial for per-thread counters but can matter for large arrays of per-object locks.</p>`
      }
    ]
  }
},

{
  id: "cache-patterns",
  region: "ctr",
  title: "Workload Access Patterns",
  sections: [
    { id: "stream", label: "Sequential Streaming" },
    { id: "strided", label: "Strided Access" },
    { id: "hot", label: "Small Hot Working Sets" },
    { id: "tiled", label: "Blocked and Tiled Loops" },
    { id: "pointer", label: "Pointer Chasing" },
    { id: "random", label: "Random Hash Lookups" },
    { id: "ifetch", label: "Instruction Fetch" },
    { id: "thrash", label: "Cyclic Loops Larger Than the Cache" },
    { id: "scan", label: "Hot Data Plus Scans" },
    { id: "shared", label: "Shared and Producer-Consumer Data" }
  ],
  body: `
<p>The section's <a href="#/r/ctr">workload types</a> describe whole programs. Programs are built from a handful of access patterns, and the cache sees the patterns. A database mixes pointer chasing through index trees with sequential table scans. GEMM is a blocked loop whose inner kernel streams. Each pattern below lists real workloads that are dominated by it, its locality, the miss class it mostly produces (see <a href="#/cache-misses">Classifying Cache Misses</a>), and the cache configuration that suits it best.</p>
<div class="tbl"><table>
<tr><th>Workload type</th><th>Main patterns</th></tr>
<tr><td>Compute-bound</td><td>Small hot working sets</td></tr>
<tr><td>Pointer chasing</td><td><ul><li>Pointer chasing</li><li>Cyclic loops larger than the cache</li></ul></td></tr>
<tr><td>Streaming</td><td><ul><li>Sequential streaming</li><li>Strided access</li></ul></td></tr>
<tr><td>Large code footprint</td><td>Instruction fetch</td></tr>
<tr><td>Branch-heavy integer</td><td><ul><li>Random hash lookups</li><li>Small hot working sets</li></ul></td></tr>
<tr><td>Blocked numerics</td><td><ul><li>Blocked and tiled loops</li><li>Strided access</li></ul></td></tr>
<tr><td>ML inference</td><td><ul><li>Hot data plus scans (weights scan, activations stay hot)</li><li>Random hash lookups (embedding tables)</li></ul></td></tr>
<tr><td>Multithreaded shared data</td><td><ul><li>Shared and producer-consumer data</li><li>Hot data plus scans</li></ul></td></tr>
</table></div>

<h3 id="sec-stream">Sequential Streaming</h3>
<p>Each element is touched once per pass, in address order. The STREAM triad is the canonical form:</p>
<pre><code>for (i = 0; i &lt; n; i++)
    a[i] = b[i] + s * c[i];</code></pre>
<ul>
<li><strong>Workload examples:</strong>
<ul><li><code>memcpy</code>, <code>memset</code>, checksums, and array sums</li><li>STREAM and other bandwidth benchmarks</li><li>519.lbm_r (lattice Boltzmann, sweeps a large grid each time step)</li><li>503.bwaves_r and 554.roms_r (structured-grid solvers)</li><li>Video encode and decode frame passes, such as parts of 525.x264_r</li></ul></li>
<li><strong>Locality:</strong> strong spatial (every byte of each line is used), no temporal (a line comes back only on the next pass, long after it's evicted).</li>
<li><strong>Dominant miss type:</strong> compulsory on a single pass, capacity on repeated passes over arrays larger than the cache. Neither can be fixed by capacity.</li>
<li><strong>Best cache size:</strong> irrelevant past the lines in flight. A core moving 20 GB/s with 80 ns of memory latency has 20 × 80 = 1600 bytes, 25 lines, in flight. That lives in fill buffers and MSHRs, not capacity.</li>
<li><strong>Best line size:</strong> larger. 128 B lines, or 64 B lines with adjacent-line prefetch, halve the misses per byte.</li>
<li><strong>Best associativity:</strong> low is fine. Enough ways to hold one line per concurrent stream, so that streams with aligned bases don't evict each other: 3 for the triad.</li>
<li><strong>Best replacement policy:</strong> the stream gets no hits under any policy. Choose one that keeps the stream from flushing other data: BRRIP, SHiP, or non-temporal hints that insert at the LRU position.</li>
<li><strong>Beyond the cache:</strong> a stream prefetcher hides the latency, and non-temporal stores avoid reading output lines before overwriting them.</li>
</ul>

<h3 id="sec-strided">Strided Access</h3>
<p>Each access is a fixed distance, the stride, past the previous one. Walking down a column of a row-major matrix is the classic case: in a <code>float m[1024][1024]</code>, each row is 4096 bytes, so the column walk has a 4096-byte stride:</p>
<pre><code>for (j = 0; j &lt; 1024; j++)
    for (i = 0; i &lt; 1024; i++)
        sum += m[i][j];</code></pre>
<ul>
<li><strong>Workload examples:</strong>
<ul><li>Naive matrix transpose and column sums of row-major data</li><li>Radix-2 FFT stages, whose strides are powers of two</li><li>Updating one field across an array of structs (stride = struct size)</li><li>Vertical passes of 2D image filters, as in 538.imagick_r</li><li>Stencils that read the rows above and below, as in 507.cactuBSSN_r</li></ul></li>
<li><strong>Locality:</strong> spatial only when the stride is smaller than a line. At a stride of 64 bytes or more, each line delivers one element (4 of 64 bytes, 6.25%, for floats). Temporal locality appears only if the walk comes back, as when the next column reuses the same lines.</li>
<li><strong>Dominant miss type:</strong> conflict, when the stride is a multiple of a large power of two. Otherwise capacity, with most of each line's bandwidth wasted.</li>
</ul>
<p><strong>Why a power-of-two stride uses so little of the cache.</strong> The set index is (address / line size) mod sets. On a 48 KB, 12-way L1D with 64-byte lines there are 64 sets, and one set's worth of lines spans 64 × 64 = 4096 bytes. A 4096-byte stride advances the address by exactly that much, so every access lands in the same set. The walk can keep only 12 lines no matter how empty the rest of the cache is:</p>
<div class="tbl"><svg viewBox="0 0 680 492" role="img" aria-label="Which sets of a 48 KB, 12-way L1D with 64-byte lines and 64 sets a strided walk can use. With a 4096-byte stride every address maps to set 0, so only 12 of 768 lines hold the walk. With a 1024-byte stride the walk uses sets 0, 16, 32, and 48, 48 lines. Padding each row by one line, a 4160-byte stride, spreads the walk over all 64 sets." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<text x="0" y="14" style="fill:var(--ink);font-size:13px;font-weight:600">48 KB, 12-way L1D, 64 B lines: 64 sets, set = (address / 64) mod 64</text>
<text x="0" y="46" style="fill:var(--ink);font-size:12px;font-weight:600">Stride 4096 B: every access maps to set 0</text>
<g style="fill:var(--surface);stroke:var(--rule);stroke-width:0.6"><rect x="87" y="56" width="8" height="95"/><rect x="96" y="56" width="8" height="95"/><rect x="105" y="56" width="8" height="95"/><rect x="114" y="56" width="8" height="95"/><rect x="123" y="56" width="8" height="95"/><rect x="132" y="56" width="8" height="95"/><rect x="141" y="56" width="8" height="95"/><rect x="150" y="56" width="8" height="95"/><rect x="159" y="56" width="8" height="95"/><rect x="168" y="56" width="8" height="95"/><rect x="177" y="56" width="8" height="95"/><rect x="186" y="56" width="8" height="95"/><rect x="195" y="56" width="8" height="95"/><rect x="204" y="56" width="8" height="95"/><rect x="213" y="56" width="8" height="95"/><rect x="222" y="56" width="8" height="95"/><rect x="231" y="56" width="8" height="95"/><rect x="240" y="56" width="8" height="95"/><rect x="249" y="56" width="8" height="95"/><rect x="258" y="56" width="8" height="95"/><rect x="267" y="56" width="8" height="95"/><rect x="276" y="56" width="8" height="95"/><rect x="285" y="56" width="8" height="95"/><rect x="294" y="56" width="8" height="95"/><rect x="303" y="56" width="8" height="95"/><rect x="312" y="56" width="8" height="95"/><rect x="321" y="56" width="8" height="95"/><rect x="330" y="56" width="8" height="95"/><rect x="339" y="56" width="8" height="95"/><rect x="348" y="56" width="8" height="95"/><rect x="357" y="56" width="8" height="95"/><rect x="366" y="56" width="8" height="95"/><rect x="375" y="56" width="8" height="95"/><rect x="384" y="56" width="8" height="95"/><rect x="393" y="56" width="8" height="95"/><rect x="402" y="56" width="8" height="95"/><rect x="411" y="56" width="8" height="95"/><rect x="420" y="56" width="8" height="95"/><rect x="429" y="56" width="8" height="95"/><rect x="438" y="56" width="8" height="95"/><rect x="447" y="56" width="8" height="95"/><rect x="456" y="56" width="8" height="95"/><rect x="465" y="56" width="8" height="95"/><rect x="474" y="56" width="8" height="95"/><rect x="483" y="56" width="8" height="95"/><rect x="492" y="56" width="8" height="95"/><rect x="501" y="56" width="8" height="95"/><rect x="510" y="56" width="8" height="95"/><rect x="519" y="56" width="8" height="95"/><rect x="528" y="56" width="8" height="95"/><rect x="537" y="56" width="8" height="95"/><rect x="546" y="56" width="8" height="95"/><rect x="555" y="56" width="8" height="95"/><rect x="564" y="56" width="8" height="95"/><rect x="573" y="56" width="8" height="95"/><rect x="582" y="56" width="8" height="95"/><rect x="591" y="56" width="8" height="95"/><rect x="600" y="56" width="8" height="95"/><rect x="609" y="56" width="8" height="95"/><rect x="618" y="56" width="8" height="95"/><rect x="627" y="56" width="8" height="95"/><rect x="636" y="56" width="8" height="95"/><rect x="645" y="56" width="8" height="95"/></g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:0.8"><rect x="78" y="56" width="8" height="95"/></g>
<path d="M78,63.5H653M78,71.5H653M78,79.5H653M78,87.5H653M78,95.5H653M78,103.5H653M78,111.5H653M78,119.5H653M78,127.5H653M78,135.5H653M78,143.5H653" style="fill:none;stroke:var(--rule);stroke-width:0.6"/>
<g style="fill:var(--muted);font-size:10px"><text x="0" y="63">way 0</text><text x="0" y="151">way 11</text><text x="78" y="163">set 0</text><text x="653" y="163" text-anchor="end">set 63</text></g>
<text x="366" y="163" text-anchor="middle" style="fill:var(--muted);font-size:11px">12 of 768 lines usable (1.6%). The 13th line evicts the 1st while 756 lines sit unused.</text>
<text x="0" y="194" style="fill:var(--ink);font-size:12px;font-weight:600">Stride 1024 B: accesses map to sets 0, 16, 32, and 48</text>
<g style="fill:var(--surface);stroke:var(--rule);stroke-width:0.6"><rect x="87" y="204" width="8" height="95"/><rect x="96" y="204" width="8" height="95"/><rect x="105" y="204" width="8" height="95"/><rect x="114" y="204" width="8" height="95"/><rect x="123" y="204" width="8" height="95"/><rect x="132" y="204" width="8" height="95"/><rect x="141" y="204" width="8" height="95"/><rect x="150" y="204" width="8" height="95"/><rect x="159" y="204" width="8" height="95"/><rect x="168" y="204" width="8" height="95"/><rect x="177" y="204" width="8" height="95"/><rect x="186" y="204" width="8" height="95"/><rect x="195" y="204" width="8" height="95"/><rect x="204" y="204" width="8" height="95"/><rect x="213" y="204" width="8" height="95"/><rect x="231" y="204" width="8" height="95"/><rect x="240" y="204" width="8" height="95"/><rect x="249" y="204" width="8" height="95"/><rect x="258" y="204" width="8" height="95"/><rect x="267" y="204" width="8" height="95"/><rect x="276" y="204" width="8" height="95"/><rect x="285" y="204" width="8" height="95"/><rect x="294" y="204" width="8" height="95"/><rect x="303" y="204" width="8" height="95"/><rect x="312" y="204" width="8" height="95"/><rect x="321" y="204" width="8" height="95"/><rect x="330" y="204" width="8" height="95"/><rect x="339" y="204" width="8" height="95"/><rect x="348" y="204" width="8" height="95"/><rect x="357" y="204" width="8" height="95"/><rect x="375" y="204" width="8" height="95"/><rect x="384" y="204" width="8" height="95"/><rect x="393" y="204" width="8" height="95"/><rect x="402" y="204" width="8" height="95"/><rect x="411" y="204" width="8" height="95"/><rect x="420" y="204" width="8" height="95"/><rect x="429" y="204" width="8" height="95"/><rect x="438" y="204" width="8" height="95"/><rect x="447" y="204" width="8" height="95"/><rect x="456" y="204" width="8" height="95"/><rect x="465" y="204" width="8" height="95"/><rect x="474" y="204" width="8" height="95"/><rect x="483" y="204" width="8" height="95"/><rect x="492" y="204" width="8" height="95"/><rect x="501" y="204" width="8" height="95"/><rect x="519" y="204" width="8" height="95"/><rect x="528" y="204" width="8" height="95"/><rect x="537" y="204" width="8" height="95"/><rect x="546" y="204" width="8" height="95"/><rect x="555" y="204" width="8" height="95"/><rect x="564" y="204" width="8" height="95"/><rect x="573" y="204" width="8" height="95"/><rect x="582" y="204" width="8" height="95"/><rect x="591" y="204" width="8" height="95"/><rect x="600" y="204" width="8" height="95"/><rect x="609" y="204" width="8" height="95"/><rect x="618" y="204" width="8" height="95"/><rect x="627" y="204" width="8" height="95"/><rect x="636" y="204" width="8" height="95"/><rect x="645" y="204" width="8" height="95"/></g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:0.8"><rect x="78" y="204" width="8" height="95"/><rect x="222" y="204" width="8" height="95"/><rect x="366" y="204" width="8" height="95"/><rect x="510" y="204" width="8" height="95"/></g>
<path d="M78,211.5H653M78,219.5H653M78,227.5H653M78,235.5H653M78,243.5H653M78,251.5H653M78,259.5H653M78,267.5H653M78,275.5H653M78,283.5H653M78,291.5H653" style="fill:none;stroke:var(--rule);stroke-width:0.6"/>
<g style="fill:var(--muted);font-size:10px"><text x="0" y="211">way 0</text><text x="0" y="299">way 11</text><text x="78" y="311">set 0</text><text x="653" y="311" text-anchor="end">set 63</text></g>
<text x="366" y="311" text-anchor="middle" style="fill:var(--muted);font-size:11px">48 of 768 lines usable (6.25%).</text>
<text x="0" y="342" style="fill:var(--ink);font-size:12px;font-weight:600">Stride 4160 B (each row padded by one 64 B line): the walk covers all 64 sets</text>
<g style="fill:var(--surface);stroke:var(--rule);stroke-width:0.6"></g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:0.8"><rect x="78" y="352" width="8" height="95"/><rect x="87" y="352" width="8" height="95"/><rect x="96" y="352" width="8" height="95"/><rect x="105" y="352" width="8" height="95"/><rect x="114" y="352" width="8" height="95"/><rect x="123" y="352" width="8" height="95"/><rect x="132" y="352" width="8" height="95"/><rect x="141" y="352" width="8" height="95"/><rect x="150" y="352" width="8" height="95"/><rect x="159" y="352" width="8" height="95"/><rect x="168" y="352" width="8" height="95"/><rect x="177" y="352" width="8" height="95"/><rect x="186" y="352" width="8" height="95"/><rect x="195" y="352" width="8" height="95"/><rect x="204" y="352" width="8" height="95"/><rect x="213" y="352" width="8" height="95"/><rect x="222" y="352" width="8" height="95"/><rect x="231" y="352" width="8" height="95"/><rect x="240" y="352" width="8" height="95"/><rect x="249" y="352" width="8" height="95"/><rect x="258" y="352" width="8" height="95"/><rect x="267" y="352" width="8" height="95"/><rect x="276" y="352" width="8" height="95"/><rect x="285" y="352" width="8" height="95"/><rect x="294" y="352" width="8" height="95"/><rect x="303" y="352" width="8" height="95"/><rect x="312" y="352" width="8" height="95"/><rect x="321" y="352" width="8" height="95"/><rect x="330" y="352" width="8" height="95"/><rect x="339" y="352" width="8" height="95"/><rect x="348" y="352" width="8" height="95"/><rect x="357" y="352" width="8" height="95"/><rect x="366" y="352" width="8" height="95"/><rect x="375" y="352" width="8" height="95"/><rect x="384" y="352" width="8" height="95"/><rect x="393" y="352" width="8" height="95"/><rect x="402" y="352" width="8" height="95"/><rect x="411" y="352" width="8" height="95"/><rect x="420" y="352" width="8" height="95"/><rect x="429" y="352" width="8" height="95"/><rect x="438" y="352" width="8" height="95"/><rect x="447" y="352" width="8" height="95"/><rect x="456" y="352" width="8" height="95"/><rect x="465" y="352" width="8" height="95"/><rect x="474" y="352" width="8" height="95"/><rect x="483" y="352" width="8" height="95"/><rect x="492" y="352" width="8" height="95"/><rect x="501" y="352" width="8" height="95"/><rect x="510" y="352" width="8" height="95"/><rect x="519" y="352" width="8" height="95"/><rect x="528" y="352" width="8" height="95"/><rect x="537" y="352" width="8" height="95"/><rect x="546" y="352" width="8" height="95"/><rect x="555" y="352" width="8" height="95"/><rect x="564" y="352" width="8" height="95"/><rect x="573" y="352" width="8" height="95"/><rect x="582" y="352" width="8" height="95"/><rect x="591" y="352" width="8" height="95"/><rect x="600" y="352" width="8" height="95"/><rect x="609" y="352" width="8" height="95"/><rect x="618" y="352" width="8" height="95"/><rect x="627" y="352" width="8" height="95"/><rect x="636" y="352" width="8" height="95"/><rect x="645" y="352" width="8" height="95"/></g>
<path d="M78,359.5H653M78,367.5H653M78,375.5H653M78,383.5H653M78,391.5H653M78,399.5H653M78,407.5H653M78,415.5H653M78,423.5H653M78,431.5H653M78,439.5H653" style="fill:none;stroke:var(--rule);stroke-width:0.6"/>
<g style="fill:var(--muted);font-size:10px"><text x="0" y="359">way 0</text><text x="0" y="447">way 11</text><text x="78" y="459">set 0</text><text x="653" y="459" text-anchor="end">set 63</text></g>
<text x="366" y="459" text-anchor="middle" style="fill:var(--muted);font-size:11px">All 768 lines usable.</text>
<g style="fill:var(--muted);font-size:11px"><rect x="0" y="474" width="16" height="12" rx="2" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="22" y="484">sets the walk can use</text><rect x="170" y="474" width="16" height="12" rx="2" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="192" y="484">sets the walk never touches</text></g>
</svg></div>
<p>The rule: a stride of S bytes advances the set index by S / 64 sets per access, and the walk visits 64 / gcd(S / 64, 64) distinct sets. Padding each row by one line makes S / 64 odd, so the walk visits every set. Padding fixes the conflict misses but not capacity: the 1024-row column still needs 1024 lines, more than the 768 the L1D holds, so the next column misses in L1D and now hits in L2. Interchanging the loops, or blocking 16 columns at a time so each line's 16 floats are all used, fixes it fully.</p>
<ul>
<li><strong>Best cache size:</strong> doesn't fix conflicts. A larger cache with the same set-to-way ratio has the same pathology at a larger stride.</li>
<li><strong>Best line size:</strong> smaller lines waste less bandwidth when the stride exceeds the line. Larger lines win only if neighboring columns are used before eviction.</li>
<li><strong>Best associativity:</strong> more ways raise the number of lines one set can keep. Index hashing (XOR-folding upper address bits into the index) or skewed associativity removes the pathology outright.</li>
<li><strong>Best replacement policy:</strong> LRU or PLRU, once the conflicts are gone. No policy helps when 1024 lines compete for 12 ways.</li>
<li><strong>Beyond the cache:</strong> an IP-stride prefetcher covers the latency, and padding or loop interchange in software is the cheapest fix.</li>
</ul>

<h3 id="sec-hot">Small Hot Working Sets</h3>
<p>A few KB of data is reused constantly. AES with T-tables is a typical case: four 1 KB tables indexed by state bytes every round:</p>
<pre><code>t0 = T0[s0 &gt;&gt; 24] ^ T1[(s1 &gt;&gt; 16) &amp; 0xff] ^ T2[(s2 &gt;&gt; 8) &amp; 0xff] ^ T3[s3 &amp; 0xff] ^ rk[4];</code></pre>
<ul>
<li><strong>Workload examples:</strong>
<ul><li>548.exchange2_r (Sudoku-style puzzle generator, tiny working set)</li><li>508.namd_r inner force kernels</li><li>Table-driven crypto, CRC, and Huffman decoding</li><li>Interpreter dispatch tables, stack frames, and small lookup tables</li></ul></li>
<li><strong>Locality:</strong> strong temporal, usually strong spatial too.</li>
<li><strong>Dominant miss type:</strong> compulsory during warm-up, then almost none. Occasional conflict misses if hot lines happen to share a set.</li>
<li><strong>Best cache size:</strong> just larger than the hot set. Extra capacity only adds latency, so a small, fast L1 is ideal.</li>
<li><strong>Best line size:</strong> 64 B. Line size barely matters once everything fits.</li>
<li><strong>Best associativity:</strong> moderate (4 to 8 ways), enough to avoid unlucky collisions between hot lines.</li>
<li><strong>Best replacement policy:</strong> LRU or tree PLRU. Every policy does well when nothing needs evicting, so choose the cheapest.</li>
</ul>

<h3 id="sec-tiled">Blocked and Tiled Loops</h3>
<p>Blocking (tiling) is a software technique that turns a capacity-bound loop nest into a cache-friendly one. Instead of sweeping whole rows and columns, the loops work on T × T tiles small enough to stay in the cache, and finish all the work that reuses a tile before moving on:</p>
<pre><code>for (ii = 0; ii &lt; n; ii += T)
  for (kk = 0; kk &lt; n; kk += T)
    for (jj = 0; jj &lt; n; jj += T)
      for (i = ii; i &lt; ii + T; i++)
        for (k = kk; k &lt; kk + T; k++)
          for (j = jj; j &lt; jj + T; j++)
            C[i][j] += A[i][k] * B[k][j];</code></pre>
<p><strong>Choosing T.</strong> Three tiles of doubles must fit: 3 × T² × 8 bytes ≤ cache size. For a 48 KB L1D, T² ≤ 2048, so T ≤ 45. Production code picks T = 32 to leave room for other data and to keep tile rows a whole number of lines. Each element of A and B is then loaded from memory about n / T times instead of n times, cutting their traffic by a factor of about T. High-performance BLAS libraries go further and copy ("pack") each tile into a contiguous buffer, which removes conflict misses between tile rows.</p>
<ul>
<li><strong>Workload examples:</strong>
<ul><li>GEMM in OpenBLAS, Intel MKL, and BLIS</li><li>HPL (LINPACK) and LU factorization</li><li>Convolutions in oneDNN and other ML kernels</li><li>Time-skewed stencil codes</li></ul></li>
<li><strong>Locality:</strong> very high temporal reuse inside a tile, strong spatial along tile rows.</li>
<li><strong>Dominant miss type:</strong> compulsory per tile when tuned. Capacity if T is too large for the cache, conflict if the leading dimension is a power of two (tile rows then collide, as in <a href="#/cache-patterns/strided">strided access</a>).</li>
<li><strong>Best cache size:</strong> the software adapts. A larger cache allows a larger T, and memory traffic falls as 1 / T, which is about 1 / √(cache size).</li>
<li><strong>Best line size:</strong> 64 B. Tile rows are contiguous, so whole lines are used.</li>
<li><strong>Best associativity:</strong> high, or packed tiles. Unpacked tiles with a power-of-two leading dimension need at least T ways or padding.</li>
<li><strong>Best replacement policy:</strong> LRU. Reuse within a tile is short-range recency, which is exactly what LRU captures.</li>
</ul>

<h3 id="sec-pointer">Pointer Chasing</h3>
<p>Each load's address comes from the data the previous load returned, so the misses are serialized:</p>
<pre><code>while (p) {
    sum += p-&gt;val;
    p = p-&gt;next;
}</code></pre>
<ul>
<li><strong>Workload examples:</strong>
<ul><li>505.mcf_r (network simplex over linked arc and node structures)</li><li>520.omnetpp_r (discrete-event simulation with a heap-allocated event queue)</li><li>523.xalancbmk_r (XSLT over DOM trees)</li><li>B-tree and skip-list index lookups in databases</li><li>Garbage-collector marking in the JVM and other managed runtimes</li></ul></li>
<li><strong>Locality:</strong> weak spatial (nodes are often 16 to 48 bytes and scattered across the heap). Temporal locality depends on the structure: the top levels of a tree are hot, the leaves are not.</li>
<li><strong>Dominant miss type:</strong> capacity, plus compulsory on the first traversal. Memory-level parallelism (MLP) is near 1, so each miss costs its full latency.</li>
<li><strong>Best cache size:</strong> large, if the structure or its hot part crosses into "fits." Each avoided miss saves a full memory round trip, so pointer chasers gain more per hit than any other pattern.</li>
<li><strong>Best line size:</strong> 64 B or smaller. Larger lines bring in neighbors that are rarely the next node.</li>
<li><strong>Best associativity:</strong> moderate (8 to 16 ways). Heap addresses are spread evenly, so conflicts are average rather than pathological.</li>
<li><strong>Best replacement policy:</strong> one that keeps the hot levels: SHiP or Hawkeye, which learn which load PCs fetch reused nodes. For repeated traversals of a structure larger than the cache, BRRIP or random beats LRU.</li>
<li><strong>Beyond the cache:</strong> content-directed or pointer prefetchers, runahead execution, and software that lays out nodes in traversal order.</li>
</ul>

<h3 id="sec-random">Random Hash Lookups</h3>
<p>Addresses come from hashing independent keys, so they are spread uniformly over a large table. Unlike pointer chasing, the next address doesn't depend on the last load, so many misses can overlap:</p>
<pre><code>for (i = 0; i &lt; n; i++)
    count[hash(key[i]) &amp; mask]++;</code></pre>
<ul>
<li><strong>Workload examples:</strong>
<ul><li>HPCC RandomAccess (GUPS)</li><li>Hash joins and hash aggregation in databases</li><li>Redis and memcached lookups</li><li>531.deepsjeng_r's transposition table and 557.xz_r's match-finder hash chains</li><li>Embedding-table lookups in recommendation models such as DLRM</li></ul></li>
<li><strong>Locality:</strong> almost no spatial (one 8-byte word of a 64-byte line, 12.5%). Temporal only through skew: with Zipf-distributed keys, a few hot keys get most lookups.</li>
<li><strong>Dominant miss type:</strong> capacity. With uniform keys, hit rate ≈ cache size / table size.</li>
<li><strong>Best cache size:</strong> with uniform keys, hit rate grows only linearly with size. With skewed keys, a cache that holds the hot keys gets most of the benefit and more capacity adds little.</li>
<li><strong>Best line size:</strong> small. 32 B lines or 32 B sectors halve the wasted bandwidth, and adjacent-line prefetch hurts.</li>
<li><strong>Best associativity:</strong> moderate. Hashed addresses already spread over the sets.</li>
<li><strong>Best replacement policy:</strong> with uniform keys every policy gets about the same hit rate. With skew, frequency-aware policies (LFU-style counters, or SRRIP with frequency priority) keep the hot keys. PC-based predictors such as SHiP and Hawkeye gain nothing: every probe comes from the same few lookup PCs, so the reuse depends on the key, not the instruction.</li>
<li><strong>Beyond the cache:</strong> large pages to cut TLB misses, and software prefetching or batched lookups to raise MLP.</li>
</ul>

<h3 id="sec-ifetch">Instruction Fetch</h3>
<p>The front end fetches sequentially until a taken branch, then jumps. Server software has megabytes of hot code spread over thousands of functions, with no single hot loop.</p>
<ul>
<li><strong>Workload examples:</strong>
<ul><li>Database servers such as MySQL and PostgreSQL</li><li>JavaScript engines and browsers (V8 in Node.js and Chrome)</li><li>502.gcc_r and 500.perlbench_r</li><li>The Linux kernel's network and file-system paths</li><li>Verilator-compiled RTL simulators, whose generated code can be tens of MB of straight-line code</li></ul></li>
<li><strong>Locality:</strong> strong spatial within basic blocks, temporal through hot functions. In large footprints, reuse distances exceed the L1I.</li>
<li><strong>Dominant miss type:</strong> capacity in the L1I (footprints of MBs against 32 to 64 KB), some conflict for aligned functions, and compulsory for cold paths.</li>
<li><strong>Best cache size:</strong> L1I is held at 32 to 64 KB by latency, so the L2 must hold the hot code: 1 to 2 MB private L2s help servers a lot.</li>
<li><strong>Best line size:</strong> 64 B, with next-line prefetch. Fetch is sequential between branches.</li>
<li><strong>Best associativity:</strong> 8 ways in the L1I. Code layout can collide, and the VIPT size limit applies here too.</li>
<li><strong>Best replacement policy:</strong> LRU or PLRU in the L1I. In the L2 and LLC, policies that protect code from data scans: EMISSARY (ISCA 2023) favors lines whose misses starved the decoder.</li>
<li><strong>Beyond the cache:</strong> fetch-directed instruction prefetching (FDIP) and profile-guided layout with BOLT or Propeller.</li>
</ul>

<h3 id="sec-thrash">Cyclic Loops Larger Than the Cache</h3>
<p>The same set of lines is swept over and over, and the set is a little larger than the cache. Under LRU each line is evicted just before it is needed again, so the hit rate is zero even though most of the data would fit.</p>
<pre><code>for (it = 0; it &lt; iters; it++)        /* x[] is 1.5 times the LLC */
    for (i = 0; i &lt; n; i++)
        x[i] = update(x[i], y[col[i]]);</code></pre>
<ul>
<li><strong>Workload examples:</strong>
<ul><li>Iterative solvers and k-means over a dataset 1 to 2 times the LLC</li><li>PageRank iterations when the vertex data is just above the LLC</li><li>429.mcf (SPEC CPU2006), one of the benchmarks where the DIP and RRIP papers show large gains over LRU</li></ul></li>
<li><strong>Locality:</strong> temporal reuse at a fixed distance, slightly larger than the cache.</li>
<li><strong>Dominant miss type:</strong> capacity. The classification says "add capacity," but a policy change recovers most of it.</li>
<li><strong>Best cache size:</strong> large enough to hold the loop removes the problem. Short of that, the policy matters more than size.</li>
<li><strong>Best line size:</strong> 64 B. Usually sequential within the sweep.</li>
<li><strong>Best associativity:</strong> any. A fully associative LRU cache thrashes too.</li>
<li><strong>Best replacement policy:</strong> thrash-resistant ones that keep a fixed part of the loop: LIP, BIP, BRRIP, or DRRIP and DIP, which pick them automatically. Random also beats LRU here.</li>
</ul>

<h3 id="sec-scan">Hot Data Plus Scans</h3>
<p>A reused working set that fits, interrupted by long scans of data used once. Under LRU each scan line enters at MRU and pushes the hot data out.</p>
<ul>
<li><strong>Workload examples:</strong>
<ul><li>A database running index lookups (hot inner B-tree nodes) while a query scans a table</li><li>CPU inference that streams each layer's weights while activations stay hot</li><li>An application thread with a hot heap next to a garbage collector's sweep</li><li>Multi-programmed servers where one tenant streams</li></ul></li>
<li><strong>Locality:</strong> strong temporal on the hot set, none on the scan.</li>
<li><strong>Dominant miss type:</strong> capacity (the hot set is evicted by scan lines), plus compulsory on the scan itself.</li>
<li><strong>Best cache size:</strong> hot set plus a little. Capacity beyond that is spent on the scan.</li>
<li><strong>Best line size:</strong> 64 B. Large lines help the scan and hurt only if the hot set is sparse.</li>
<li><strong>Best associativity:</strong> moderate to high, so the hot lines and a few scan lines can share a set.</li>
<li><strong>Best replacement policy:</strong> scan-resistant ones: SRRIP (a new line must be reused before it outranks the hot set), SHiP (learns that the scanning PC's lines are dead), and Hawkeye.</li>
</ul>

<h3 id="sec-shared">Shared and Producer-Consumer Data</h3>
<p>Several cores read and write the same lines. With true sharing they touch the same bytes (a lock, a queue head). With false sharing, independent data lands in one line:</p>
<pre><code>long hits[NTHREADS];   /* 8 counters in one 64 B line: false sharing */

struct { _Alignas(64) long n; } hits_padded[NTHREADS];   /* one line each */</code></pre>
<ul>
<li><strong>Workload examples:</strong>
<ul><li>Spinlocks, reference counts, and shared statistics counters in the Linux kernel and databases</li><li>Work queues and pipeline stages, such as PARSEC's dedup and ferret</li><li>Phoenix's linear_regression, a known false-sharing case</li><li>Lock managers and buffer-pool metadata in PostgreSQL and MySQL</li></ul></li>
<li><strong>Locality:</strong> temporal, but split across cores, so it shows up as coherence traffic rather than hits.</li>
<li><strong>Dominant miss type:</strong> coherence, both true and false sharing.</li>
<li><strong>Best cache size:</strong> irrelevant for the shared lines. Coherence misses happen regardless of capacity.</li>
<li><strong>Best line size:</strong> smaller lines reduce false sharing. Adjacent-line prefetch effectively doubles the sharing unit to 128 B.</li>
<li><strong>Best associativity:</strong> irrelevant for the shared lines.</li>
<li><strong>Best replacement policy:</strong> irrelevant for the shared lines. The protocol matters instead: direct cache-to-cache forwarding (the O state in MOESI, the F state in MESIF) and the latency to the directory or snoop filter.</li>
</ul>
<p class="refs">References: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Chapter 2 and Appendix B · McCalpin, "STREAM: Sustainable Memory Bandwidth in High Performance Computers" · Lam, Rothberg, and Wolf, "The Cache Performance and Optimizations of Blocked Algorithms," ASPLOS 1991 · Goto and van de Geijn, "Anatomy of High-Performance Matrix Multiplication," ACM TOMS 2008 · Nagendra et al., "EMISSARY: Enhanced Miss Awareness Replacement Policy for L2 Instruction Caching," ISCA 2023</p>`,
  practice: {
    guided: [
      {
        q: `<p>A Raptor Cove core has a 2 MB, 16-way L2 with 64 B lines. A loop walks down one column of a row-major <code>double m[2048][2048]</code>. How many L2 sets does the walk use, and how many lines can it keep? What padding fixes it, and does the next column then hit in L2?</p>`,
        a: `<ol><li>Lines: 2 MB / 64 B = 32,768. Sets: 32,768 / 16 = 2048.</li><li>Row size: 2048 × 8 B = 16,384 B, so the stride is 16,384 / 64 = 256 lines.</li><li>Sets visited: 2048 / gcd(256, 2048) = 2048 / 256 = <strong>8 sets</strong>, holding 8 × 16 = <strong>128 lines</strong> of 32,768 (0.4%).</li><li>The column has 2048 elements on 2048 different lines, so every access misses and the next column, which reuses the same lines, misses too.</li><li>Pad each row by one line (16,448 B): the stride becomes 257 lines, gcd(257, 2048) = 1, so the walk visits all 2048 sets.</li><li>The column now needs 2048 lines = 128 KB, well under 2 MB, so the next 7 columns (the rest of each line's 8 doubles) <strong>hit in L2</strong>.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>You have per-PC traces of L2 misses from a workload you have never seen. How would you tell pointer chasing apart from random hash lookups, and why does the distinction matter for the cache and prefetcher you would propose?</p>`,
        a: `<p>Both show no stride and little spatial reuse. The difference is dependence: in pointer chasing, a load's address comes from the value a previous missing load returned, so misses are serialized and MLP stays near 1. In hash lookups, addresses come from independent keys, so many misses can be outstanding. Measure the number of outstanding L2 misses per PC, and check whether the address register of each missing load was written by an earlier missing load. For pointer chasing, every avoided miss saves full latency, so capacity for the hot part of the structure, a policy like SHiP that keeps hot nodes, and pointer or content-directed prefetching pay off. For hash lookups, more MSHRs, software prefetching or batching, smaller lines or sectors, and large pages pay off, while extra capacity helps only in proportion to size / table size unless the keys are skewed.</p>`
      }
    ]
  }
},

{
  id: "cache-size",
  region: "ctr",
  title: "Cache Size",
  sections: [
    { id: "small", label: "Small, Fast L1 Caches" },
    { id: "mid", label: "Private Mid-Level Caches" },
    { id: "llc", label: "Large Shared Last-Level Caches" },
    { id: "stacked", label: "Stacked Last-Level Caches" }
  ],
  body: `
<h3>What It Changes</h3>
<p>Capacity sets which working sets fit. Below the working set, misses are capacity misses. Once the working set fits, the miss rate drops sharply (a "cliff"). Each level of the hierarchy picks a different point on the size-versus-latency curve, so the options below are organized by level.</p>

<h3 id="sec-small">Small, Fast L1 Caches</h3>
<p><strong>Motivation.</strong> The L1D sits in the load-to-use loop: every dependent instruction waits for it, so each extra cycle of hit latency costs IPC on every workload. The L1 is therefore as large as it can be while still meeting a 4- or 5-cycle target at full clock.</p>
<p><strong>How it works.</strong> The L1 is indexed with virtual address bits while the TLB translates in parallel (virtually indexed, physically tagged, VIPT). To avoid aliasing, the index and offset bits must lie inside the page offset, which caps the size at page size × ways. With 4 KB pages, growing the L1 means adding ways.</p>
<p><strong>Example.</strong> Intel went from Skylake's 32 KB, 8-way, 4-cycle L1D to Sunny Cove's 48 KB, 12-way, 5-cycle L1D: 4 KB × 8 to 4 KB × 12, and one more cycle. AMD's Zen 4 kept 32 KB, 8 ways, and 4 cycles. Apple's Firestorm cores use 16 KB pages, so 8 ways allow a 128 KB L1D.</p>
<p><strong>Implementation.</strong> The array is split into small sub-arrays so wordlines and bitlines stay short. All ways' tags and data are read in parallel with the TLB lookup, and the hit way's data is selected at the end. Size beyond what the cycle allows forces either another pipeline stage or a lower clock.</p>
<h4>Where Small L1 Caches Help</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li><a href="#/cache-patterns/hot">Small hot working sets</a> that fit in 32 to 48 KB</li><li><a href="#/cache-patterns/tiled">Tiled loops</a> whose inner tiles are sized for the L1</li><li>Stack pushes and pops with short reuse distances</li></ul></td><td><ul><li>548.exchange2_r</li><li>508.namd_r inner kernels</li><li>BLIS and OpenBLAS GEMM micro-kernels</li><li>AES and CRC table lookups</li></ul></td></tr></table></div>
<h4>Where Small L1 Caches Hurt</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>Working sets between the L1 size and a few MB, which pay L2 latency on every miss</li><li><a href="#/cache-patterns/ifetch">Large instruction footprints</a> that overflow the L1I</li><li><a href="#/cache-patterns/pointer">Pointer chasing</a> over structures far larger than the L1</li></ul></td><td><ul><li>505.mcf_r</li><li>520.omnetpp_r</li><li>MySQL and PostgreSQL (L1I misses)</li><li>502.gcc_r</li></ul></td></tr></table></div>

<h3 id="sec-mid">Private Mid-Level Caches</h3>
<p><strong>Motivation.</strong> An L1 miss that goes straight to a shared LLC pays 40 to 70 cycles across the on-chip network. A private L2 of 1 to 2 MB catches most L1 misses in about 15 cycles, holds the code footprint of server software, and isn't contested by other cores.</p>
<p><strong>How it works.</strong> The L2 is private to one core, physically indexed, and holds L1 victims plus most hardware-prefetched lines (Intel's L2 streamer prefetches into it). It is usually non-inclusive of the L1s. Because it is accessed far less often than the L1, it can use more ways and serial tag-then-data access.</p>
<p><strong>Example.</strong> Skylake-SP grew the server L2 from 256 KB to 1 MB and shrank the shared L3 from 2.5 to 1.375 MB per core. Zen 4 doubled Zen 3's 512 KB L2 to 1 MB at about 14 cycles. Raptor Cove and Sapphire Rapids cores have 2 MB, 16-way L2s.</p>
<p><strong>Implementation.</strong> Tags are read first, then only the hit way's data array, which saves most of the energy of reading every way. The array is split into a few banks so a fill and a lookup can proceed together, and the fill path to the L1 is typically 64 bytes per cycle.</p>
<h4>Where Mid-Level Caches Help</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li><a href="#/cache-patterns/ifetch">Instruction footprints</a> of 0.5 to 2 MB</li><li>Data working sets just above the L1 size</li><li><a href="#/cache-patterns/tiled">Blocked loops</a> with an L2-sized blocking level</li></ul></td><td><ul><li>502.gcc_r and 500.perlbench_r</li><li>OLTP database code (MySQL, PostgreSQL)</li><li>GotoBLAS-style GEMM, which keeps a packed block of A in L2</li><li>531.deepsjeng_r's search state</li></ul></td></tr></table></div>
<h4>Where Mid-Level Caches Hurt</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li><a href="#/cache-patterns/stream">Sequential streams</a> with no reuse</li><li><a href="#/cache-patterns/random">Random lookups</a> over tables of GBs</li><li><a href="#/cache-patterns/shared">Shared data</a>, which is duplicated in every private L2 and moves by coherence</li></ul></td><td><ul><li>519.lbm_r</li><li>STREAM</li><li>HPCC RandomAccess (GUPS)</li><li>Lock-heavy server code with contended counters</li></ul></td></tr></table></div>

<h3 id="sec-llc">Large Shared Last-Level Caches</h3>
<p><strong>Motivation.</strong> The LLC is the last stop before DRAM, which costs 80 to 100 ns, or 300 to 500 cycles at 4 to 5 GHz. It also lets cores share capacity: one core with a large working set can use more than an even share.</p>
<p><strong>How it works.</strong> The LLC is split into slices, usually one beside each core, and a hash of the physical address picks the slice. Latency depends on how far the slice is from the requesting core (non-uniform cache access, NUCA). The LLC is inclusive, exclusive, or non-inclusive of the private levels, and non-inclusive designs add a snoop filter or directory to track private copies.</p>
<p><strong>Example.</strong> Sapphire Rapids has 1.875 MB of L3 per core, 105 MB on a 56-core part. A Zen 4 core complex shares 32 MB of 16-way L3 at about 50 cycles.</p>
<p><strong>Implementation.</strong> Each slice has its own tag and data arrays plus a controller that also acts as the home agent for coherence. Slices are reached over a ring or mesh. Accesses are tag-then-data, and the slice hash is chosen to spread consecutive lines and common strides evenly.</p>
<h4>Where Large LLCs Help</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>Working sets of 2 to 30 MB</li><li><a href="#/cache-patterns/pointer">Pointer structures</a> whose hot part newly fits</li><li>Read-mostly data shared by many threads</li></ul></td><td><ul><li>520.omnetpp_r</li><li>523.xalancbmk_r</li><li>Database buffer-pool hot pages and index upper levels</li><li>Graph analytics on graphs of a few million edges</li></ul></td></tr></table></div>
<h4>Where Large LLCs Hurt</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li><a href="#/cache-patterns/stream">Streams</a> far larger than the LLC</li><li><a href="#/cache-patterns/random">Uniform random lookups</a> over GB-scale tables</li><li>Working sets that fit in L2, which only see the LLC's extra latency and leakage</li></ul></td><td><ul><li>519.lbm_r</li><li>HPCC RandomAccess (GUPS)</li><li>Graph analytics on billion-edge graphs, such as the GAP suite's Twitter input</li><li>548.exchange2_r</li></ul></td></tr></table></div>

<h3 id="sec-stacked">Stacked Last-Level Caches</h3>
<p><strong>Motivation.</strong> A planar LLC can only grow by growing the die, and its wires get longer. Stacking a second SRAM die on top adds capacity at almost the same footprint and only a few cycles of latency.</p>
<p><strong>How it works.</strong> An SRAM die is bonded face to face on top of the compute die's L3 region, with through-silicon vias and direct copper-to-copper hybrid bonds connecting it to the L3 controller below. The added arrays extend the existing L3, so software sees one larger cache. The stack insulates the cores thermally, so clocks and voltage limits are lower.</p>
<p><strong>Example.</strong> AMD's Ryzen 7 5800X3D stacks 64 MB on a 32 MB L3 for 96 MB, at about 4 more cycles of L3 latency and a 4.5 GHz boost clock instead of the 5800X's 4.7 GHz. AMD's Milan-X server parts reach 768 MB of L3 per socket, and AMD reported RTL simulation with Synopsys VCS running 66% faster than on the same-core-count Milan part.</p>
<p><strong>Implementation.</strong> Hybrid bonding gives a pitch of about 9 µm, so thousands of signals cross between dies. The L3 controller on the base die manages both dies' arrays, so the stacked die holds SRAM and little else.</p>
<h4>Where Stacked LLCs Help</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>Working sets of 32 to 100 MB that miss a planar LLC</li><li><a href="#/cache-patterns/ifetch">Very large instruction footprints</a> with irregular data</li><li><a href="#/cache-patterns/pointer">Pointer structures</a> that fit only in the larger cache</li></ul></td><td><ul><li>RTL simulation (Synopsys VCS, Verilator)</li><li>Games with large world state</li><li>CFD and finite-element solvers on mid-sized meshes</li></ul></td></tr></table></div>
<h4>Where Stacked LLCs Hurt</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>Compute-bound code with <a href="#/cache-patterns/hot">small working sets</a>, which only feels the lower clock</li><li><a href="#/cache-patterns/stream">Streams</a> far larger than even the stacked cache</li></ul></td><td><ul><li>548.exchange2_r</li><li>Cinebench-style rendering</li><li>519.lbm_r and STREAM</li></ul></td></tr></table></div>

<h3>The Math</h3>
<ul>
<li><strong>√2 rule of thumb:</strong> miss rate ∝ size<sup>−0.5</sup>, so doubling size divides miss rate by about 1.41. It is an empirical average, and real curves have cliffs.</li>
<li><strong>AMAT</strong> = hit time + miss rate × miss penalty. A bigger cache lowers miss rate but often raises hit time.</li>
<li><strong>Access time</strong> grows with size because wires get longer, roughly with the square root of capacity when wire-dominated.</li>
</ul>
<h3>Power, Performance, Area</h3>
<ul><li><strong>Performance:</strong> fewer capacity misses, but possibly a slower hit.</li><li><strong>Power:</strong> leakage ∝ capacity, and dynamic energy per access rises with array size.</li><li><strong>Area:</strong> roughly linear in capacity plus tags. SRAM is often the largest share of core-plus-cache area.</li></ul>
<h3>By Workload</h3>
<div class="tbl"><table><tr><th>Workload</th><th>Effect</th></tr>
<tr><td>Compute-bound</td><td>No gain once the small working set fits, and a slower hit can hurt.</td></tr>
<tr><td>Pointer chasing</td><td>Big gain if the structure crosses into "fits," none if it's far larger (huge graphs). Since misses are dependent, each avoided miss saves its full latency.</td></tr>
<tr><td>Streaming</td><td>Almost no gain: data is used once. Larger caches only add latency and leakage.</td></tr>
<tr><td>Large code footprint</td><td>L1I and L2 capacity matter a lot, because instruction misses stall the whole frontend.</td></tr>
<tr><td>Branch-heavy integer</td><td>Moderate gain. Working sets are often mid-sized hash tables or search trees.</td></tr>
<tr><td>Blocked numerics</td><td>Gain only if the tile size can grow. Well-tuned code already tiles to fit, so software adapts.</td></tr>
<tr><td>ML inference</td><td>Weights larger than the cache stream through with no reuse. A bigger LLC helps if a layer's weights or activations newly fit.</td></tr>
<tr><td>Multithreaded shared data</td><td>Shared LLC capacity is critical: threads compete, and capacity per thread falls with core count.</td></tr>
</table></div>`,
  practice: {
    guided: [
      {
        q: `<p>A 32 KB L1D has a 4% miss rate and a 4-cycle hit, and L1 misses cost 14 cycles. Doubling it to 64 KB adds 1 cycle of hit latency. Using the √2 rule, is it worth it?</p>`,
        a: `<ol><li>√2 rule: new miss rate ≈ 4% / √2 ≈ 2.83%.</li><li>Old AMAT = 4 + 0.04 × 14 = 4.56 cycles.</li><li>New AMAT = 5 + 0.0283 × 14 ≈ 5.40 cycles.</li><li><strong>Worse.</strong> The extra cycle on every hit outweighs the saved misses. This is why L1 sizes have stayed small while L2 and LLC grew.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Why have L1 caches stayed around 32–128 KB for years while last-level caches have grown to tens or hundreds of MB?</p>`,
        a: `<p>L1 latency is in the load-to-use loop that every dependent instruction waits on, so each extra cycle costs IPC across all workloads. Larger arrays have longer wires and need more cycles. For VIPT L1s, size is also capped at page size × ways without alias handling, and energy per access grows with size, which matters for the most frequently accessed array. LLC latency is already tens of cycles and is hit far less often, so capacity is worth more there than a few extra cycles.</p>`
      }
    ]
  }
},

{
  id: "cache-assoc",
  region: "ctr",
  title: "Associativity",
  sections: [
    { id: "dm", label: "Direct-Mapped" },
    { id: "low", label: "2 to 4 Ways" },
    { id: "high", label: "8 to 16 Ways" },
    { id: "fa", label: "Fully Associative" },
    { id: "hash", label: "Hashed Indexing and Skewed Associativity" }
  ],
  body: `
<h3>What It Changes</h3>
<p>Associativity is how many places a line can live within its set. Higher associativity reduces conflict misses: lines that would fit by capacity but collide on the same index.</p>

<h3 id="sec-dm">Direct-Mapped</h3>
<p><strong>Motivation.</strong> The fastest and cheapest hit. Each line has exactly one place to go, so there is no way to choose, no replacement state, and the data can be forwarded before the tag check finishes.</p>
<p><strong>How it works.</strong> The index selects one line. Its tag is compared with the address tag, and on a mismatch the old line is replaced. Two lines whose addresses differ by a multiple of the cache size always evict each other.</p>
<p><strong>Example.</strong> The DEC Alpha 21164 used 8 KB direct-mapped L1 caches to hit in 2 cycles at 300 MHz and relied on a 96 KB, 3-way on-chip L2 to absorb the conflicts. Two arrays exactly 8 KB apart, read together in <code>a[i] + b[i]</code>, would map every pair to the same line and miss on every access, where a 2-way cache of the same size hits on 7 of every 8 reads of 8-byte elements with 64-byte lines.</p>
<p><strong>Implementation.</strong> One tag comparator and no output multiplexer between ways. The data read can start with the index alone and be used speculatively, then cancelled if the tag mismatches, which takes the tag compare off the critical path.</p>
<h4>Where Direct-Mapped Caches Help</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li><a href="#/cache-patterns/hot">Small hot working sets</a> spread over many addresses</li><li><a href="#/cache-patterns/stream">Single streams</a>, which get no reuse anyway</li><li>Tight loops whose few hot lines map to distinct sets, where a cycle of hit latency matters more than a rare miss</li></ul></td><td><ul><li>548.exchange2_r</li><li><code>memcpy</code> of one buffer</li><li>Instruction buffers and small loop caches</li></ul></td></tr></table></div>
<h4>Where Direct-Mapped Caches Hurt</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>Several arrays with aligned bases read in the same loop</li><li><a href="#/cache-patterns/strided">Power-of-two strides</a></li><li>Interleaved accesses from several threads or processes sharing the cache</li></ul></td><td><ul><li>STREAM triad with arrays allocated at aligned addresses</li><li>Radix-2 FFT stages</li><li>Unpadded DGEMM with a 1024-element leading dimension</li></ul></td></tr></table></div>

<h3 id="sec-low">2 to 4 Ways</h3>
<p><strong>Motivation.</strong> Two or four candidate places remove most conflict misses for very little cost. The 2:1 rule of thumb says a 2-way cache of size N/2 misses about as often as a direct-mapped cache of size N.</p>
<p><strong>How it works.</strong> The index selects a set of 2 or 4 lines. All tags are compared at once, the matching way's data is selected, and on a miss the replacement policy picks the victim: one bit per set for 2-way LRU, 3 bits for 4-way tree PLRU.</p>
<p><strong>Example.</strong> Arm's Cortex-A53 and Cortex-A55 use 4-way L1 data caches. A loop reading three arrays with the same alignment, <code>a[i] = b[i] + c[i]</code>, needs three lines in the same set at once, so a 2-way cache misses on every access to one of them and a 4-way cache holds all three.</p>
<p><strong>Implementation.</strong> 2 or 4 tag comparators and a 2:1 or 4:1 data multiplexer after the compare. Parallel lookup reads every way's data, so energy per access is about 2 to 4 times that of a direct-mapped cache.</p>
<h4>Where 2- to 4-Way Caches Help</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>Loops with 2 to 4 concurrent streams or arrays</li><li><a href="#/cache-patterns/hot">Small hot working sets</a></li></ul></td><td><ul><li>STREAM copy, scale, add, and triad</li><li>Mobile app code on Arm little cores</li><li>508.namd_r</li></ul></td></tr></table></div>
<h4>Where 2- to 4-Way Caches Hurt</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>Loops touching 5 or more aligned arrays at once</li><li><a href="#/cache-patterns/strided">Power-of-two strides</a> and unpadded tiles</li><li>Interleaved accesses from many threads sharing the cache</li></ul></td><td><ul><li>Weather and CFD codes such as 521.wrf_r that read many same-sized field arrays per grid point</li><li>Naive matrix transpose</li><li>Multi-programmed server workloads</li></ul></td></tr></table></div>

<h3 id="sec-high">8 to 16 Ways</h3>
<p><strong>Motivation.</strong> Enough ways that conflict misses are rare for almost any single program, and enough for a shared LLC to hold several threads' data in each set. For L1 caches, more ways is also the only way to grow under the VIPT limit.</p>
<p><strong>How it works.</strong> L1 caches still read all ways in parallel and select at the end. L2 and LLC caches read the tags first and then only the hit way's data, so the extra ways cost tag comparisons rather than data energy.</p>
<p><strong>Example.</strong> Golden Cove's L1D is 12-way, Zen 4's L2 is 8-way, and its L3 is 16-way. Intel's Cache Allocation Technology partitions the LLC by ways, so a 16-way LLC can be split, for example, 12 ways for a latency-critical service and 4 for batch jobs.</p>
<p><strong>Implementation.</strong> More comparators and a wider multiplexer, plus wider replacement state (7 bits per set for 8-way tree PLRU, 15 for 16-way). L1s often add way prediction to read only one way's data. Each doubling of ways moves one bit from the index to the tag.</p>
<h4>Where 8- to 16-Way Caches Help</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>Many concurrent streams</li><li>Interleaved accesses from many threads or programs sharing an LLC</li><li><a href="#/cache-patterns/tiled">Tiled loops</a> with power-of-two leading dimensions</li></ul></td><td><ul><li>519.lbm_r</li><li>Cloud servers co-locating several tenants</li><li>Unpacked DGEMM on 1024 × 1024 matrices</li></ul></td></tr></table></div>
<h4>Where 8- to 16-Way Caches Hurt</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>Accesses already spread evenly over the sets, which pay the extra energy for nothing</li><li><a href="#/cache-patterns/strided">Strides</a> that map more lines to one set than any realistic number of ways</li><li><a href="#/cache-patterns/thrash">Cyclic loops larger than the cache</a>, where more ways don't help</li></ul></td><td><ul><li>548.exchange2_r</li><li>Naive transpose of a 1024 × 1024 matrix of doubles</li><li>Iterative solvers over data 1.5 times the LLC</li></ul></td></tr></table></div>

<h3 id="sec-fa">Fully Associative</h3>
<p><strong>Motivation.</strong> No conflict misses at all. Any line can go anywhere, so only capacity and the replacement policy matter. It is the reference cache for <a href="#/cache-misses/shadow">classifying misses</a>.</p>
<p><strong>How it works.</strong> Every entry compares its tag with the address at once, and the one that matches drives the output. There is no index, so the whole address above the offset is the tag.</p>
<p><strong>Example.</strong> Jouppi's victim cache (ISCA 1990) put 4 fully associative entries behind a 4 KB direct-mapped cache and removed 20% to 95% of its conflict misses, depending on the benchmark. L1 TLBs are often fully associative: Zen 4's L1 DTLB has 72 entries.</p>
<p><strong>Implementation.</strong> A content-addressable memory (CAM): each entry has its own comparator, and every lookup charges every match line, so energy and delay grow with the entry count. That limits it to tens or a few hundred entries.</p>
<h4>Where Fully Associative Structures Help</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>Lines evicted by conflicts in a direct-mapped cache and reused soon after, which a small fully associative victim cache catches</li><li>Working sets of a few dozen pages or lines with arbitrary addresses</li></ul></td><td><ul><li>TLB lookups in 505.mcf_r and other sparse heap workloads</li><li>Radix-2 FFT stages behind a direct-mapped L1 with a victim cache</li></ul></td></tr></table></div>
<h4>Where Fully Associative Structures Hurt</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>Working sets of KBs or more: a CAM large enough to hold them costs too much energy and latency</li><li><a href="#/cache-patterns/thrash">Cyclic loops larger than the cache</a> under LRU, which still get zero hits</li></ul></td><td><ul><li>The L1D traffic of any program, which needs 32 KB or more</li><li>Iterative solvers over data just above capacity</li></ul></td></tr></table></div>

<h3 id="sec-hash">Hashed Indexing and Skewed Associativity</h3>
<p><strong>Motivation.</strong> Power-of-two strides and aligned arrays defeat any fixed number of ways. Hashing the index spreads them over the sets without adding ways.</p>
<p><strong>How it works.</strong> Instead of taking the index straight from address bits, the cache XORs higher address bits into it, so addresses a multiple of the set span apart land in different sets. A skewed-associative cache (Seznec, ISCA 1993) uses a different hash for each way, so two lines that collide in one way probably don't collide in the others.</p>
<p><strong>Example.</strong> With 64 sets, a 4096-byte stride always hits set 0 under plain indexing. XORing address bits 12 to 17 into the 6-bit index makes the k-th access land in set k mod 64, so the walk uses every set. Intel's LLC slice selection is a hash of many physical address bits, reverse-engineered by Maurice and colleagues (RAID 2015).</p>
<p><strong>Implementation.</strong> A level of XOR gates on the index path, which adds a little latency. A VIPT L1 can hash only bits inside the page offset unless it waits for translation, so hashing is most common in L2s, LLCs, and slice selection.</p>
<h4>Where Hashed Indexing Helps</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li><a href="#/cache-patterns/strided">Power-of-two strides</a></li><li>Several arrays with aligned bases</li><li>Many threads whose stacks or heaps start at aligned addresses</li></ul></td><td><ul><li>FFTW radix-2 transforms</li><li>Unpadded matrix transpose</li><li>Multithreaded servers with page-aligned per-thread buffers</li></ul></td></tr></table></div>
<h4>Where Hashed Indexing Hurts</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>Addresses already spread uniformly over the sets, which gain nothing and pay the extra index latency</li><li>Accesses that software places for a known set mapping, such as page coloring or cache-aware tile placement</li></ul></td><td><ul><li><a href="#/cache-patterns/random">Random hash lookups</a> such as GUPS</li><li>Real-time systems that partition the cache by page color</li></ul></td></tr></table></div>

<h3>The Math</h3>
<ul>
<li><strong>Sets</strong> = size / (line size × ways). Index bits = log<sub>2</sub>(sets).</li>
<li><strong>2:1 rule of thumb:</strong> a direct-mapped cache of size N misses about as often as a 2-way cache of size N/2.</li>
<li><strong>Diminishing returns:</strong> most conflict misses are gone by 8 ways, and fully associative removes them entirely.</li>
<li><strong>Power-of-two strides</strong> map to few sets: if the stride is S bytes and S / line size divides the set count, the access pattern touches only sets ÷ (S / line size) distinct sets.</li>
</ul>
<h3>Power, Performance, Area</h3>
<ul>
<li><strong>Performance:</strong> fewer conflict misses, but a wider tag compare and output mux can lengthen hit time.</li>
<li><strong>Power:</strong> a parallel-lookup cache reads every way's tag and data each access, so energy ∝ ways. Way prediction or serial tag-then-data lookup trades latency for energy.</li>
<li><strong>Area:</strong> more comparators and wider replacement state. Tags grow by log<sub>2</sub>(ways) bits each since index bits shrink.</li>
</ul>
<h3>By Workload</h3>
<div class="tbl"><table><tr><th>Workload</th><th>Effect</th></tr>
<tr><td>Compute-bound</td><td>No effect.</td></tr>
<tr><td>Pointer chasing</td><td>Modest gain. Heap addresses are fairly random, so conflicts are average rather than pathological.</td></tr>
<tr><td>Streaming</td><td>No gain from reuse. It can help when several streams with aligned bases collide in the same sets.</td></tr>
<tr><td>Large code footprint</td><td>Moderate gain. Hot functions at aligned addresses can collide.</td></tr>
<tr><td>Branch-heavy integer</td><td>Small gain.</td></tr>
<tr><td>Blocked numerics</td><td>Large gain when leading dimensions are powers of two (rows of a tile collide). Padding fixes it more cheaply.</td></tr>
<tr><td>ML inference</td><td>Tensors with power-of-two shapes can collide. Layout and padding matter as much as ways.</td></tr>
<tr><td>Multithreaded shared data</td><td>High LLC associativity reduces inter-thread conflicts and enables partitioning between tenants.</td></tr>
</table></div>`,
  practice: {
    guided: [
      {
        q: `<p>A 32 KB cache with 64-byte lines walks down each column in turn of a float matrix with 1024 rows of 4096 bytes. How many sets does the walk use with a direct-mapped cache? With 8 ways? What fixes it?</p>`,
        a: `<ol><li>Direct-mapped: 512 sets. Each step moves 4096 / 64 = 64 lines, so set index advances by 64. Only 512 / 64 = <strong>8 sets</strong> are ever used, holding 8 lines.</li><li>8-way: 64 sets, and 4096 bytes is exactly 64 sets × 64 bytes, so every access maps to the <strong>same set</strong>, holding 8 lines. Still only 8 lines of reach.</li><li>With 1024 rows, the next column's reuse of each line comes after 1024 other lines: all misses either way.</li><li>Fix in software: pad each row by one line (4096 + 64 bytes) so successive rows land in different sets, or interchange loops to walk rows.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Why do last-level caches often use 16 ways or more, while L1s use 8–12?</p>`,
        a: `<p>The LLC is shared by many threads and processes whose data collide in sets. More ways reduce inter-thread conflicts and enable way partitioning. LLCs usually look up tags first and then read only the matching data way, so extra ways cost mostly tag comparisons, not data energy. L1s read all ways in parallel for speed, so each way adds energy on every access and widens the output mux on the critical path.</p>`
      }
    ]
  }
},

{
  id: "cache-line",
  region: "ctr",
  title: "Cache-Line Size",
  sections: [
    { id: "b32", label: "32-Byte Lines" },
    { id: "b64", label: "64-Byte Lines" },
    { id: "b128", label: "128-Byte Lines" },
    { id: "sector", label: "Sectored Lines" }
  ],
  body: `
<h3>What It Changes</h3>
<p>Line size is the unit of allocation and transfer. Larger lines exploit spatial locality and cut tag overhead. Smaller lines waste less bandwidth and capacity on unused bytes.</p>

<h3 id="sec-b32">32-Byte Lines</h3>
<p><strong>Motivation.</strong> When code uses only a few bytes per line, a smaller line wastes less of the cache and less bandwidth, and two cores' independent data are less likely to share a line.</p>
<p><strong>How it works.</strong> Each miss fetches 32 bytes. For a given capacity there are twice as many lines as with 64-byte lines, so more distinct scattered items fit, at the cost of twice as many misses for dense sequential data.</p>
<p><strong>Example.</strong> The Pentium III and Arm Cortex-A9 used 32-byte lines. For random 8-byte reads, a 32-byte line puts 25% of each fill to use against 12.5% for 64 bytes. NVIDIA GPUs keep 128-byte lines but fill them in 32-byte sectors for exactly this reason.</p>
<p><strong>Implementation.</strong> Twice the tags of a 64-byte-line cache: a 32 KB cache needs 1024 tags instead of 512. DDR4 and DDR5 deliver 64 bytes per burst, so a 32-byte fill uses half a burst (or a burst chop that takes the same time) and saves cache capacity more than DRAM time.</p>
<h4>Where 32-Byte Lines Help</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li><a href="#/cache-patterns/random">Random lookups</a> that use one word per line</li><li><a href="#/cache-patterns/pointer">Pointer chasing</a> over small nodes</li><li><a href="#/cache-patterns/shared">Fine-grained shared data</a> prone to false sharing</li></ul></td><td><ul><li>HPCC RandomAccess (GUPS)</li><li>Hash joins in databases</li><li>Sparse gathers on GPUs</li></ul></td></tr></table></div>
<h4>Where 32-Byte Lines Hurt</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li><a href="#/cache-patterns/stream">Sequential streams</a>, which take twice the misses</li><li><a href="#/cache-patterns/ifetch">Instruction fetch</a>, which is sequential between branches</li><li><a href="#/cache-patterns/tiled">Dense tiled loops</a></li></ul></td><td><ul><li>STREAM and <code>memcpy</code></li><li>519.lbm_r</li><li>502.gcc_r instruction fetch</li></ul></td></tr></table></div>

<h3 id="sec-b64">64-Byte Lines</h3>
<p><strong>Motivation.</strong> A 64-byte line matches one DRAM burst and balances spatial locality against waste and false sharing. It is the standard for x86 and most Arm cores.</p>
<p><strong>How it works.</strong> Each miss fetches 64 bytes, usually delivering the requested word first (critical word first) so the load can complete before the rest arrives.</p>
<p><strong>Example.</strong> A DDR4 channel is 64 bits wide with a burst length of 8: 8 × 8 = 64 bytes per access. A DDR5 subchannel is 32 bits wide with a burst length of 16: also 64 bytes.</p>
<p><strong>Implementation.</strong> A 48 KB L1D has 768 lines and 768 tags. The L2-to-L1 fill path is typically 64 bytes per cycle on recent cores, so a fill takes one cycle once the data arrives.</p>
<h4>Where 64-Byte Lines Help</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>General-purpose mixes of dense and sparse access</li><li><a href="#/cache-patterns/tiled">Tiled loops</a> with contiguous tile rows</li><li><a href="#/cache-patterns/ifetch">Instruction fetch</a> with next-line prefetch</li></ul></td><td><ul><li>Most of SPEC CPU2017, including 500.perlbench_r and 525.x264_r</li><li>DGEMM in MKL and OpenBLAS</li><li>Web and database servers</li></ul></td></tr></table></div>
<h4>Where 64-Byte Lines Hurt</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li><a href="#/cache-patterns/random">Random 8-byte lookups</a>, which waste 87.5% of each line</li><li>Densely packed per-thread counters, which false-share</li><li><a href="#/cache-patterns/stream">Pure streams</a> without a prefetcher, which would prefer longer lines</li></ul></td><td><ul><li>GUPS</li><li>Phoenix linear_regression</li><li>STREAM with prefetchers disabled</li></ul></td></tr></table></div>

<h3 id="sec-b128">128-Byte Lines</h3>
<p><strong>Motivation.</strong> For dense data, a 128-byte line halves the misses per byte and halves the tag storage. Designs with wide memory interfaces and large caches use it.</p>
<p><strong>How it works.</strong> Each miss fetches 128 bytes, two 64-byte DRAM bursts or one access on a wider interface. Capacity holds half as many lines as with 64-byte lines.</p>
<p><strong>Example.</strong> IBM's POWER processors and Apple's M-series cores use 128-byte lines. A 32 MB cache needs 262,144 tags at 128 bytes instead of 524,288 at 64 bytes.</p>
<p><strong>Implementation.</strong> Fewer, larger lines: fewer tags and less tag energy, but longer fills, and each coherence transfer moves 128 bytes. False sharing now happens between any two variables within 128 bytes.</p>
<h4>Where 128-Byte Lines Help</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li><a href="#/cache-patterns/stream">Sequential streams</a></li><li>Unit-stride sweeps over dense floating-point arrays</li><li><a href="#/cache-patterns/ifetch">Instruction fetch</a> of long straight-line code</li></ul></td><td><ul><li>519.lbm_r</li><li>503.bwaves_r</li><li>STREAM</li><li>Verilator-generated RTL models</li></ul></td></tr></table></div>
<h4>Where 128-Byte Lines Hurt</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li><a href="#/cache-patterns/random">Random lookups</a>, which use 8 of 128 bytes</li><li><a href="#/cache-patterns/pointer">Pointer chasing</a> over small nodes</li><li><a href="#/cache-patterns/shared">Shared per-thread data</a> packed closer than 128 bytes</li></ul></td><td><ul><li>GUPS and hash joins</li><li>505.mcf_r</li><li>Lock arrays and per-core counters in kernels and databases</li></ul></td></tr></table></div>

<h3 id="sec-sector">Sectored Lines</h3>
<p><strong>Motivation.</strong> Get the low tag cost of large lines and the low bandwidth cost of small ones. One tag covers a large block, but only the sectors actually needed are fetched.</p>
<p><strong>How it works.</strong> Each block (for example 128 bytes) has one tag and a valid and dirty bit per sector (for example two 64-byte or four 32-byte sectors). A miss to a missing sector of a present block fetches only that sector. A miss to an absent block allocates the whole frame and fetches the needed sector, optionally plus its neighbors.</p>
<p><strong>Example.</strong> NVIDIA GPU caches use 128-byte lines with 32-byte sectors: a warp that gathers one 4-byte value per thread from scattered addresses moves 32 bytes per access instead of 128. Intel's L2 spatial prefetcher gets a similar effect from the other side: it completes the 128-byte-aligned pair of each 64-byte line it fetches.</p>
<p><strong>Implementation.</strong> Per-sector valid and dirty bits next to each tag, and a fill path that can write one sector. A block that uses only one sector still occupies the whole frame, so sparse data lowers the effective capacity.</p>
<h4>Where Sectored Lines Help</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>Mixes of dense and sparse access in one cache</li><li>Partly coalesced accesses that touch only some sectors of each line</li></ul></td><td><ul><li>GPU SpMV and graph kernels</li><li>LLCs serving both streaming and pointer-heavy tenants</li></ul></td></tr></table></div>
<h4>Where Sectored Lines Hurt</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li><a href="#/cache-patterns/random">Sparse access</a> where each block holds one used sector, wasting the rest of the frame</li><li><a href="#/cache-patterns/stream">Pure streams</a>, which pay per-sector fill overhead with no savings</li></ul></td><td><ul><li>GUPS</li><li>Hash-table probes in Redis</li><li>STREAM</li></ul></td></tr></table></div>

<h3>The Math</h3>
<ul>
<li><strong>Miss penalty</strong> = latency + line size / bandwidth (critical-word-first hides most of the second term).</li>
<li><strong>Lines in cache</strong> = size / line size. Doubling line size halves the line count, which can raise conflict and capacity misses for sparse data.</li>
<li><strong>Tag overhead:</strong> one tag per line, so tag storage roughly halves when line size doubles.</li>
<li><strong>Useful fraction</strong> = bytes used before eviction / line size.</li>
</ul>
<h3>Power, Performance, Area</h3>
<ul><li><strong>Performance:</strong> fewer compulsory misses with spatial locality, but longer fills and more false sharing.</li><li><strong>Power:</strong> moving unused bytes costs DRAM and interconnect energy, which is often larger than the SRAM energy.</li><li><strong>Area:</strong> less tag area with larger lines.</li></ul>
<h3>By Workload</h3>
<div class="tbl"><table><tr><th>Workload</th><th>Effect</th></tr>
<tr><td>Compute-bound</td><td>Neutral.</td></tr>
<tr><td>Pointer chasing</td><td>Larger lines hurt: nodes are often smaller than a line, so bandwidth and capacity go to unused neighbors.</td></tr>
<tr><td>Streaming</td><td>Larger lines help: fewer misses per byte. A prefetcher gets the same effect without the downsides elsewhere.</td></tr>
<tr><td>Large code footprint</td><td>Larger lines help: code is mostly sequential between branches.</td></tr>
<tr><td>Branch-heavy integer</td><td>Mixed. It depends on how compact the data structures are.</td></tr>
<tr><td>Blocked numerics</td><td>Help: contiguous tile rows use whole lines.</td></tr>
<tr><td>ML inference</td><td>Help for dense weights, hurt for sparse or gather-heavy access (embedding lookups).</td></tr>
<tr><td>Multithreaded shared data</td><td>Larger lines raise false sharing and move more bytes per coherence transfer.</td></tr>
</table></div>`,
  practice: {
    guided: [
      {
        q: `<p>Memory latency is 100 cycles and the bus moves 16 bytes per cycle. Compute the miss penalty for 64-, 128-, and 256-byte lines. Then compute bandwidth efficiency for random 8-byte reads.</p>`,
        a: `<ol><li>Penalty = latency + line / bandwidth: 64 B → 104 cycles, 128 B → 108, 256 B → 116 (or less with critical-word-first).</li><li>Random 8-byte reads use 8 of each line's bytes: 8 / 64 = <strong>12.5%</strong>, 8 / 128 = 6.25%, 8 / 256 = 3.1%.</li><li>Streaming reads use every byte, so efficiency is 100% at any size, and larger lines halve the miss count.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Why is 64 bytes such a common line size?</p>`,
        a: `<p>It matches the DRAM burst: a DDR4 channel is 64 bits wide with a burst length of 8, delivering 64 bytes per access, and a DDR5 subchannel is 32 bits with burst length 16, also 64 bytes. It balances spatial locality against wasted bandwidth and false sharing, and keeps tag overhead small. Some designs use 128-byte lines (Apple's cores among them) or sector larger lines into 64-byte pieces to get both benefits.</p>`
      }
    ]
  }
},

{
  id: "cache-replacement",
  region: "ctr",
  title: "Replacement Policies",
  sections: [
    { id: "opt", label: "Belady's Optimal Policy (OPT)" },
    { id: "lru", label: "Least Recently Used (LRU)" },
    { id: "plru", label: "Tree Pseudo-LRU (PLRU)" },
    { id: "nru", label: "Not Recently Used (NRU)" },
    { id: "fifo", label: "First In, First Out (FIFO)" },
    { id: "random", label: "Random" },
    { id: "lfu", label: "Least Frequently Used (LFU)" },
    { id: "lip", label: "LRU Insertion Policy (LIP)" },
    { id: "bip", label: "Bimodal Insertion Policy (BIP)" },
    { id: "dip", label: "Dynamic Insertion Policy (DIP)" },
    { id: "srrip", label: "Static Re-Reference Interval Prediction (SRRIP)" },
    { id: "brrip", label: "Bimodal RRIP (BRRIP)" },
    { id: "drrip", label: "Dynamic RRIP (DRRIP)" },
    { id: "ship", label: "Signature-Based Hit Prediction (SHiP)" },
    { id: "hawkeye", label: "Hawkeye" }
  ],
  body: `
<h3>What It Changes</h3>
<p>The replacement policy picks a victim in a full set. It decides whether a working set slightly larger than the cache gets partial hits or none, and whether a scan wipes out useful data.</p>
<p>Every policy answers three questions:</p>
<ul>
<li><strong>Insertion:</strong> how much protection does a newly filled line get?</li>
<li><strong>Promotion:</strong> what does a hit change?</li>
<li><strong>Eviction:</strong> which line leaves when a miss needs room?</li>
</ul>
<p>Each example below traces one 4-way set. Letters name lines that map to that set, every column is one access, and every row is one way. Several examples reuse the same access sequence so the policies can be compared directly.</p>

<h3 id="sec-opt">Belady's Optimal Policy (OPT)</h3>
<p><strong>Motivation.</strong> OPT is the yardstick. It gives the fewest misses any policy can get on a trace, so the gap between a real policy and OPT shows how much is left to gain. Performance models run it offline in trace-driven cache simulators. Hardware can't run it, because it needs the future, but Hawkeye (below) runs it on past accesses to train a predictor.</p>
<p><strong>How it works.</strong> On a miss in a full set, evict the line whose next use is furthest in the future. A line that is never used again is the ideal victim. Belady proved in 1966 that this minimizes misses. A variant that may also bypass, leaving the incoming line uncached, does at least as well.</p>
<p><strong>Example.</strong> The loop A B C D E F is six lines in a four-line set. At cycle 4 the next uses are A at 6, B at 7, C at 8, and D at 9, so OPT evicts D. At cycle 5 it evicts E, whose next use (10) is the furthest. A, B, and C then hit. LRU on the same accesses evicts exactly the line needed next, every time:</p>
<div class="tbl"><svg viewBox="0 0 680 497" role="img" aria-label="Two traces of a 4-way set on the access sequence A B C D E F A B C D E F. Belady's OPT, which evicts the line used furthest in the future, gets 4 hits. At cycle 4 it evicts D, at cycle 5 it evicts E, then A, B, and C hit, D and E miss, and F hits. LRU on the same sequence evicts each line just before it is needed again and gets 0 hits." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<text x="0" y="13" style="fill:var(--ink);font-size:13px;font-weight:600">Belady's OPT: 4 of 12 hits</text>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle">
<text x="0" y="34" text-anchor="start">cycle</text>
<text x="123.5" y="34">0</text>
<text x="170.5" y="34">1</text>
<text x="217.5" y="34">2</text>
<text x="264.5" y="34">3</text>
<text x="311.5" y="34">4</text>
<text x="358.5" y="34">5</text>
<text x="405.5" y="34">6</text>
<text x="452.5" y="34">7</text>
<text x="499.5" y="34">8</text>
<text x="546.5" y="34">9</text>
<text x="593.5" y="34">10</text>
<text x="640.5" y="34">11</text>
</g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle">
<text x="0" y="51" text-anchor="start" style="font-weight:400;font-size:11px;fill:var(--muted)">access</text>
<text x="123.5" y="51">A</text>
<text x="170.5" y="51">B</text>
<text x="217.5" y="51">C</text>
<text x="264.5" y="51">D</text>
<text x="311.5" y="51">E</text>
<text x="358.5" y="51">F</text>
<text x="405.5" y="51">A</text>
<text x="452.5" y="51">B</text>
<text x="499.5" y="51">C</text>
<text x="546.5" y="51">D</text>
<text x="593.5" y="51">E</text>
<text x="640.5" y="51">F</text>
</g>
<text x="0" y="79" style="fill:var(--muted);font-size:11px">way 0</text>
<text x="0" y="109" style="fill:var(--muted);font-size:11px">way 1</text>
<text x="0" y="139" style="fill:var(--muted);font-size:11px">way 2</text>
<text x="0" y="169" style="fill:var(--muted);font-size:11px">way 3</text>
<g style="fill:none;stroke:var(--rule);stroke-width:1;stroke-dasharray:3 3"><rect x="102" y="92" width="43" height="26" rx="3"/><rect x="102" y="122" width="43" height="26" rx="3"/><rect x="149" y="122" width="43" height="26" rx="3"/><rect x="102" y="152" width="43" height="26" rx="3"/><rect x="149" y="152" width="43" height="26" rx="3"/><rect x="196" y="152" width="43" height="26" rx="3"/></g>
<g style="fill:var(--surface);stroke:var(--rule);stroke-width:1"><rect x="149" y="62" width="43" height="26" rx="3"/><rect x="196" y="62" width="43" height="26" rx="3"/><rect x="243" y="62" width="43" height="26" rx="3"/><rect x="290" y="62" width="43" height="26" rx="3"/><rect x="337" y="62" width="43" height="26" rx="3"/><rect x="431" y="62" width="43" height="26" rx="3"/><rect x="478" y="62" width="43" height="26" rx="3"/><rect x="619" y="62" width="43" height="26" rx="3"/><rect x="196" y="92" width="43" height="26" rx="3"/><rect x="243" y="92" width="43" height="26" rx="3"/><rect x="290" y="92" width="43" height="26" rx="3"/><rect x="337" y="92" width="43" height="26" rx="3"/><rect x="384" y="92" width="43" height="26" rx="3"/><rect x="478" y="92" width="43" height="26" rx="3"/><rect x="525" y="92" width="43" height="26" rx="3"/><rect x="572" y="92" width="43" height="26" rx="3"/><rect x="619" y="92" width="43" height="26" rx="3"/><rect x="243" y="122" width="43" height="26" rx="3"/><rect x="290" y="122" width="43" height="26" rx="3"/><rect x="337" y="122" width="43" height="26" rx="3"/><rect x="384" y="122" width="43" height="26" rx="3"/><rect x="431" y="122" width="43" height="26" rx="3"/><rect x="525" y="122" width="43" height="26" rx="3"/><rect x="572" y="122" width="43" height="26" rx="3"/><rect x="619" y="122" width="43" height="26" rx="3"/><rect x="384" y="152" width="43" height="26" rx="3"/><rect x="431" y="152" width="43" height="26" rx="3"/><rect x="478" y="152" width="43" height="26" rx="3"/><rect x="525" y="152" width="43" height="26" rx="3"/><rect x="572" y="152" width="43" height="26" rx="3"/></g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"><rect x="102" y="62" width="43" height="26" rx="3"/><rect x="525" y="62" width="43" height="26" rx="3"/><rect x="572" y="62" width="43" height="26" rx="3"/><rect x="149" y="92" width="43" height="26" rx="3"/><rect x="196" y="122" width="43" height="26" rx="3"/><rect x="243" y="152" width="43" height="26" rx="3"/><rect x="290" y="152" width="43" height="26" rx="3"/><rect x="337" y="152" width="43" height="26" rx="3"/></g>
<g style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2.5"><rect x="384" y="62" width="43" height="26" rx="3"/><rect x="431" y="92" width="43" height="26" rx="3"/><rect x="478" y="122" width="43" height="26" rx="3"/><rect x="619" y="152" width="43" height="26" rx="3"/></g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle"><text x="117.48" y="79">A</text><text x="164.48" y="79">A</text><text x="211.48" y="79">A</text><text x="258.48" y="79">A</text><text x="305.48" y="79">A</text><text x="352.48" y="79">A</text><text x="399.48" y="79">A</text><text x="446.48" y="79">A</text><text x="493.48" y="79">A</text><text x="540.48" y="79">D</text><text x="587.48" y="79">E</text><text x="634.48" y="79">E</text><text x="164.48" y="109">B</text><text x="211.48" y="109">B</text><text x="258.48" y="109">B</text><text x="305.48" y="109">B</text><text x="352.48" y="109">B</text><text x="399.48" y="109">B</text><text x="446.48" y="109">B</text><text x="493.48" y="109">B</text><text x="540.48" y="109">B</text><text x="587.48" y="109">B</text><text x="634.48" y="109">B</text><text x="211.48" y="139">C</text><text x="258.48" y="139">C</text><text x="305.48" y="139">C</text><text x="352.48" y="139">C</text><text x="399.48" y="139">C</text><text x="446.48" y="139">C</text><text x="493.48" y="139">C</text><text x="540.48" y="139">C</text><text x="587.48" y="139">C</text><text x="634.48" y="139">C</text><text x="258.48" y="169">D</text><text x="305.48" y="169">E</text><text x="352.48" y="169">F</text><text x="399.48" y="169">F</text><text x="446.48" y="169">F</text><text x="493.48" y="169">F</text><text x="540.48" y="169">F</text><text x="587.48" y="169">F</text><text x="634.48" y="169">F</text></g>
<g style="fill:var(--muted);font-size:10px;font-family:var(--mono)" text-anchor="end"><text x="141" y="80">6</text><text x="188" y="80">6</text><text x="235" y="80">6</text><text x="282" y="80">6</text><text x="329" y="80">6</text><text x="376" y="80">6</text><text x="423" y="80">–</text><text x="470" y="80">–</text><text x="517" y="80">–</text><text x="564" y="80">–</text><text x="611" y="80">–</text><text x="658" y="80">–</text><text x="188" y="110">7</text><text x="235" y="110">7</text><text x="282" y="110">7</text><text x="329" y="110">7</text><text x="376" y="110">7</text><text x="423" y="110">7</text><text x="470" y="110">–</text><text x="517" y="110">–</text><text x="564" y="110">–</text><text x="611" y="110">–</text><text x="658" y="110">–</text><text x="235" y="140">8</text><text x="282" y="140">8</text><text x="329" y="140">8</text><text x="376" y="140">8</text><text x="423" y="140">8</text><text x="470" y="140">8</text><text x="517" y="140">–</text><text x="564" y="140">–</text><text x="611" y="140">–</text><text x="658" y="140">–</text><text x="282" y="170">9</text><text x="329" y="170">10</text><text x="376" y="170">11</text><text x="423" y="170">11</text><text x="470" y="170">11</text><text x="517" y="170">11</text><text x="564" y="170">11</text><text x="611" y="170">11</text><text x="658" y="170">–</text></g>
<g style="font-size:11px;font-weight:600" text-anchor="middle">
<text x="0" y="196" text-anchor="start" style="font-weight:400;fill:var(--muted)">result</text>
<text x="123.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="170.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="217.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="264.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="311.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="358.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="405.5" y="196" style="fill:var(--accent-green)">hit</text>
<text x="452.5" y="196" style="fill:var(--accent-green)">hit</text>
<text x="499.5" y="196" style="fill:var(--accent-green)">hit</text>
<text x="546.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="593.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="640.5" y="196" style="fill:var(--accent-green)">hit</text>
</g>
<g style="fill:var(--muted);font-size:11px" text-anchor="middle">
<text x="0" y="213" text-anchor="start">evicts</text>
<text x="311.5" y="213">D</text>
<text x="358.5" y="213">E</text>
<text x="546.5" y="213">A</text>
<text x="593.5" y="213">D</text>
</g>
<text x="0" y="247" style="fill:var(--ink);font-size:13px;font-weight:600">LRU on the same accesses: 0 of 12 hits</text>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle">
<text x="0" y="268" text-anchor="start">cycle</text>
<text x="123.5" y="268">0</text>
<text x="170.5" y="268">1</text>
<text x="217.5" y="268">2</text>
<text x="264.5" y="268">3</text>
<text x="311.5" y="268">4</text>
<text x="358.5" y="268">5</text>
<text x="405.5" y="268">6</text>
<text x="452.5" y="268">7</text>
<text x="499.5" y="268">8</text>
<text x="546.5" y="268">9</text>
<text x="593.5" y="268">10</text>
<text x="640.5" y="268">11</text>
</g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle">
<text x="0" y="285" text-anchor="start" style="font-weight:400;font-size:11px;fill:var(--muted)">access</text>
<text x="123.5" y="285">A</text>
<text x="170.5" y="285">B</text>
<text x="217.5" y="285">C</text>
<text x="264.5" y="285">D</text>
<text x="311.5" y="285">E</text>
<text x="358.5" y="285">F</text>
<text x="405.5" y="285">A</text>
<text x="452.5" y="285">B</text>
<text x="499.5" y="285">C</text>
<text x="546.5" y="285">D</text>
<text x="593.5" y="285">E</text>
<text x="640.5" y="285">F</text>
</g>
<text x="0" y="313" style="fill:var(--muted);font-size:11px">way 0</text>
<text x="0" y="343" style="fill:var(--muted);font-size:11px">way 1</text>
<text x="0" y="373" style="fill:var(--muted);font-size:11px">way 2</text>
<text x="0" y="403" style="fill:var(--muted);font-size:11px">way 3</text>
<g style="fill:none;stroke:var(--rule);stroke-width:1;stroke-dasharray:3 3"><rect x="102" y="326" width="43" height="26" rx="3"/><rect x="102" y="356" width="43" height="26" rx="3"/><rect x="149" y="356" width="43" height="26" rx="3"/><rect x="102" y="386" width="43" height="26" rx="3"/><rect x="149" y="386" width="43" height="26" rx="3"/><rect x="196" y="386" width="43" height="26" rx="3"/></g>
<g style="fill:var(--surface);stroke:var(--rule);stroke-width:1"><rect x="149" y="296" width="43" height="26" rx="3"/><rect x="196" y="296" width="43" height="26" rx="3"/><rect x="243" y="296" width="43" height="26" rx="3"/><rect x="337" y="296" width="43" height="26" rx="3"/><rect x="384" y="296" width="43" height="26" rx="3"/><rect x="431" y="296" width="43" height="26" rx="3"/><rect x="525" y="296" width="43" height="26" rx="3"/><rect x="572" y="296" width="43" height="26" rx="3"/><rect x="619" y="296" width="43" height="26" rx="3"/><rect x="196" y="326" width="43" height="26" rx="3"/><rect x="243" y="326" width="43" height="26" rx="3"/><rect x="290" y="326" width="43" height="26" rx="3"/><rect x="384" y="326" width="43" height="26" rx="3"/><rect x="431" y="326" width="43" height="26" rx="3"/><rect x="478" y="326" width="43" height="26" rx="3"/><rect x="572" y="326" width="43" height="26" rx="3"/><rect x="619" y="326" width="43" height="26" rx="3"/><rect x="243" y="356" width="43" height="26" rx="3"/><rect x="290" y="356" width="43" height="26" rx="3"/><rect x="337" y="356" width="43" height="26" rx="3"/><rect x="431" y="356" width="43" height="26" rx="3"/><rect x="478" y="356" width="43" height="26" rx="3"/><rect x="525" y="356" width="43" height="26" rx="3"/><rect x="619" y="356" width="43" height="26" rx="3"/><rect x="290" y="386" width="43" height="26" rx="3"/><rect x="337" y="386" width="43" height="26" rx="3"/><rect x="384" y="386" width="43" height="26" rx="3"/><rect x="478" y="386" width="43" height="26" rx="3"/><rect x="525" y="386" width="43" height="26" rx="3"/><rect x="572" y="386" width="43" height="26" rx="3"/></g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"><rect x="102" y="296" width="43" height="26" rx="3"/><rect x="290" y="296" width="43" height="26" rx="3"/><rect x="478" y="296" width="43" height="26" rx="3"/><rect x="149" y="326" width="43" height="26" rx="3"/><rect x="337" y="326" width="43" height="26" rx="3"/><rect x="525" y="326" width="43" height="26" rx="3"/><rect x="196" y="356" width="43" height="26" rx="3"/><rect x="384" y="356" width="43" height="26" rx="3"/><rect x="572" y="356" width="43" height="26" rx="3"/><rect x="243" y="386" width="43" height="26" rx="3"/><rect x="431" y="386" width="43" height="26" rx="3"/><rect x="619" y="386" width="43" height="26" rx="3"/></g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle"><text x="123.5" y="313">A</text><text x="170.5" y="313">A</text><text x="217.5" y="313">A</text><text x="264.5" y="313">A</text><text x="311.5" y="313">E</text><text x="358.5" y="313">E</text><text x="405.5" y="313">E</text><text x="452.5" y="313">E</text><text x="499.5" y="313">C</text><text x="546.5" y="313">C</text><text x="593.5" y="313">C</text><text x="640.5" y="313">C</text><text x="170.5" y="343">B</text><text x="217.5" y="343">B</text><text x="264.5" y="343">B</text><text x="311.5" y="343">B</text><text x="358.5" y="343">F</text><text x="405.5" y="343">F</text><text x="452.5" y="343">F</text><text x="499.5" y="343">F</text><text x="546.5" y="343">D</text><text x="593.5" y="343">D</text><text x="640.5" y="343">D</text><text x="217.5" y="373">C</text><text x="264.5" y="373">C</text><text x="311.5" y="373">C</text><text x="358.5" y="373">C</text><text x="405.5" y="373">A</text><text x="452.5" y="373">A</text><text x="499.5" y="373">A</text><text x="546.5" y="373">A</text><text x="593.5" y="373">E</text><text x="640.5" y="373">E</text><text x="264.5" y="403">D</text><text x="311.5" y="403">D</text><text x="358.5" y="403">D</text><text x="405.5" y="403">D</text><text x="452.5" y="403">B</text><text x="499.5" y="403">B</text><text x="546.5" y="403">B</text><text x="593.5" y="403">B</text><text x="640.5" y="403">F</text></g>
<g style="font-size:11px;font-weight:600" text-anchor="middle">
<text x="0" y="430" text-anchor="start" style="font-weight:400;fill:var(--muted)">result</text>
<text x="123.5" y="430" style="fill:var(--accent-red)">miss</text>
<text x="170.5" y="430" style="fill:var(--accent-red)">miss</text>
<text x="217.5" y="430" style="fill:var(--accent-red)">miss</text>
<text x="264.5" y="430" style="fill:var(--accent-red)">miss</text>
<text x="311.5" y="430" style="fill:var(--accent-red)">miss</text>
<text x="358.5" y="430" style="fill:var(--accent-red)">miss</text>
<text x="405.5" y="430" style="fill:var(--accent-red)">miss</text>
<text x="452.5" y="430" style="fill:var(--accent-red)">miss</text>
<text x="499.5" y="430" style="fill:var(--accent-red)">miss</text>
<text x="546.5" y="430" style="fill:var(--accent-red)">miss</text>
<text x="593.5" y="430" style="fill:var(--accent-red)">miss</text>
<text x="640.5" y="430" style="fill:var(--accent-red)">miss</text>
</g>
<g style="fill:var(--muted);font-size:11px" text-anchor="middle">
<text x="0" y="447" text-anchor="start">evicts</text>
<text x="311.5" y="447">A</text>
<text x="358.5" y="447">B</text>
<text x="405.5" y="447">C</text>
<text x="452.5" y="447">D</text>
<text x="499.5" y="447">E</text>
<text x="546.5" y="447">F</text>
<text x="593.5" y="447">A</text>
<text x="640.5" y="447">B</text>
</g>
<g style="fill:var(--ink);font-size:10px;font-family:var(--mono)" text-anchor="middle">
<text x="0" y="464" text-anchor="start" style="font-family:var(--sans);font-size:11px;fill:var(--muted)">MRU → LRU</text>
<text x="123.5" y="464">A</text>
<text x="170.5" y="464">BA</text>
<text x="217.5" y="464">CBA</text>
<text x="264.5" y="464">DCBA</text>
<text x="311.5" y="464">EDCB</text>
<text x="358.5" y="464">FEDC</text>
<text x="405.5" y="464">AFED</text>
<text x="452.5" y="464">BAFE</text>
<text x="499.5" y="464">CBAF</text>
<text x="546.5" y="464">DCBA</text>
<text x="593.5" y="464">EDCB</text>
<text x="640.5" y="464">FEDC</text>
</g>
<g style="fill:var(--muted);font-size:11px">
<rect x="0" y="479" width="16" height="12" rx="2" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="22" y="489">filled on a miss</text>
<rect x="136" y="479" width="16" height="12" rx="2" style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2.5"/><text x="158" y="489">hit</text>
<text x="194" y="489">small number = cycle of next use (– = none)</text>
</g>
</svg></div>
<p>OPT keeps three lines of the loop and sacrifices the rest. That "keep part of the working set" behavior is what LIP, BRRIP, and the learned policies try to recover.</p>

<p><strong>Implementation.</strong> OPT runs only in simulators, in two passes over a recorded trace:</p>
<ol>
<li><strong>Next-use pass:</strong> walk the trace backward with a hash map from line address to the index of its most recent (later in time) access. For each access, store the index of the next access to the same line, or infinity if there is none. The array costs 4 to 8 bytes per access, so a 1-billion-access trace needs 4 to 8 GB.</li>
<li><strong>Simulation pass:</strong> walk forward with each cached line tagged by its next-use index. On a miss in a full set, evict the line with the largest next use: a linear scan of N ways, or a max-heap per set for highly associative caches. The bypass variant compares the incoming line's next use with the victim's and leaves the incoming line uncached if it is needed later.</li>
</ol>
<p>OPT minimizes misses, not cycles. It treats every miss as equal, ignores whether an eviction is dirty, and with several cache levels is optimal only for the level it runs on.</p>
<h4>Where OPT Helps</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>Any access pattern in an offline study: it sets the miss floor for that trace</li><li>Traces whose reuse is far from recency order, which show the largest gap between LRU and OPT and so the most room for a better policy</li></ul></td><td><ul><li>The ChampSim traces of SPEC CPU2017 used in replacement-policy research</li><li>505.mcf_r and 520.omnetpp_r, where the LRU-to-OPT gap at the LLC is large</li></ul></td></tr></table></div>
<h4>Where OPT Hurts</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>Any access pattern in real hardware: it needs the future</li><li>Mixes of isolated and overlapping misses or of clean and dirty lines: OPT only counts misses, but an isolated miss costs more than one that overlaps with others, and a dirty eviction costs a writeback</li><li>Prefetch-heavy traces: plain OPT values a prefetched line's first use like any other hit (Harmony, ISCA 2018, extends OPT for prefetching)</li></ul></td><td><ul><li>505.mcf_r, where isolated pointer-chasing misses cost far more than overlapped ones (MLP-aware replacement, ISCA 2006)</li><li>519.lbm_r with aggressive stream prefetching</li></ul></td></tr></table></div>

<h3 id="sec-lru">Least Recently Used (LRU)</h3>
<p><strong>Motivation.</strong> Temporal locality: a line used recently is likely to be used again soon. For most programs at L1 and L2, recency is the best cheap predictor of reuse, so LRU's miss rate is close to OPT's when the working set fits. With 2 ways it costs a single bit per set.</p>
<p><strong>How it works.</strong> The lines of a set are kept in order from most recently used (MRU) to least recently used (LRU). A fill or a hit moves the line to the MRU end, and the victim is the line at the LRU end.</p>
<p><strong>Example.</strong> A is reused at cycles 4, 8, and 11, and each access puts it back at the MRU end, so it is never the victim. The bottom row shows the order from MRU to LRU after each access:</p>
<div class="tbl"><svg viewBox="0 0 680 263" role="img" aria-label="LRU on a 4-way set with the sequence A B C D A E B F A C G A. A hits at cycles 4, 8, and 11 because each access moves it back to the MRU end. Misses at cycles 5, 6, 7, 9, and 10 evict the line at the LRU end: B, C, D, E, and B. 3 of 12 hits." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<text x="0" y="13" style="fill:var(--ink);font-size:13px;font-weight:600">LRU: 3 of 12 hits</text>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle">
<text x="0" y="34" text-anchor="start">cycle</text>
<text x="123.5" y="34">0</text>
<text x="170.5" y="34">1</text>
<text x="217.5" y="34">2</text>
<text x="264.5" y="34">3</text>
<text x="311.5" y="34">4</text>
<text x="358.5" y="34">5</text>
<text x="405.5" y="34">6</text>
<text x="452.5" y="34">7</text>
<text x="499.5" y="34">8</text>
<text x="546.5" y="34">9</text>
<text x="593.5" y="34">10</text>
<text x="640.5" y="34">11</text>
</g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle">
<text x="0" y="51" text-anchor="start" style="font-weight:400;font-size:11px;fill:var(--muted)">access</text>
<text x="123.5" y="51">A</text>
<text x="170.5" y="51">B</text>
<text x="217.5" y="51">C</text>
<text x="264.5" y="51">D</text>
<text x="311.5" y="51">A</text>
<text x="358.5" y="51">E</text>
<text x="405.5" y="51">B</text>
<text x="452.5" y="51">F</text>
<text x="499.5" y="51">A</text>
<text x="546.5" y="51">C</text>
<text x="593.5" y="51">G</text>
<text x="640.5" y="51">A</text>
</g>
<text x="0" y="79" style="fill:var(--muted);font-size:11px">way 0</text>
<text x="0" y="109" style="fill:var(--muted);font-size:11px">way 1</text>
<text x="0" y="139" style="fill:var(--muted);font-size:11px">way 2</text>
<text x="0" y="169" style="fill:var(--muted);font-size:11px">way 3</text>
<g style="fill:none;stroke:var(--rule);stroke-width:1;stroke-dasharray:3 3"><rect x="102" y="92" width="43" height="26" rx="3"/><rect x="102" y="122" width="43" height="26" rx="3"/><rect x="149" y="122" width="43" height="26" rx="3"/><rect x="102" y="152" width="43" height="26" rx="3"/><rect x="149" y="152" width="43" height="26" rx="3"/><rect x="196" y="152" width="43" height="26" rx="3"/></g>
<g style="fill:var(--surface);stroke:var(--rule);stroke-width:1"><rect x="149" y="62" width="43" height="26" rx="3"/><rect x="196" y="62" width="43" height="26" rx="3"/><rect x="243" y="62" width="43" height="26" rx="3"/><rect x="337" y="62" width="43" height="26" rx="3"/><rect x="384" y="62" width="43" height="26" rx="3"/><rect x="431" y="62" width="43" height="26" rx="3"/><rect x="525" y="62" width="43" height="26" rx="3"/><rect x="572" y="62" width="43" height="26" rx="3"/><rect x="196" y="92" width="43" height="26" rx="3"/><rect x="243" y="92" width="43" height="26" rx="3"/><rect x="290" y="92" width="43" height="26" rx="3"/><rect x="384" y="92" width="43" height="26" rx="3"/><rect x="431" y="92" width="43" height="26" rx="3"/><rect x="478" y="92" width="43" height="26" rx="3"/><rect x="572" y="92" width="43" height="26" rx="3"/><rect x="619" y="92" width="43" height="26" rx="3"/><rect x="243" y="122" width="43" height="26" rx="3"/><rect x="290" y="122" width="43" height="26" rx="3"/><rect x="337" y="122" width="43" height="26" rx="3"/><rect x="431" y="122" width="43" height="26" rx="3"/><rect x="478" y="122" width="43" height="26" rx="3"/><rect x="525" y="122" width="43" height="26" rx="3"/><rect x="619" y="122" width="43" height="26" rx="3"/><rect x="290" y="152" width="43" height="26" rx="3"/><rect x="337" y="152" width="43" height="26" rx="3"/><rect x="384" y="152" width="43" height="26" rx="3"/><rect x="478" y="152" width="43" height="26" rx="3"/><rect x="525" y="152" width="43" height="26" rx="3"/><rect x="572" y="152" width="43" height="26" rx="3"/><rect x="619" y="152" width="43" height="26" rx="3"/></g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"><rect x="102" y="62" width="43" height="26" rx="3"/><rect x="149" y="92" width="43" height="26" rx="3"/><rect x="337" y="92" width="43" height="26" rx="3"/><rect x="525" y="92" width="43" height="26" rx="3"/><rect x="196" y="122" width="43" height="26" rx="3"/><rect x="384" y="122" width="43" height="26" rx="3"/><rect x="572" y="122" width="43" height="26" rx="3"/><rect x="243" y="152" width="43" height="26" rx="3"/><rect x="431" y="152" width="43" height="26" rx="3"/></g>
<g style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2.5"><rect x="290" y="62" width="43" height="26" rx="3"/><rect x="478" y="62" width="43" height="26" rx="3"/><rect x="619" y="62" width="43" height="26" rx="3"/></g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle"><text x="123.5" y="79">A</text><text x="170.5" y="79">A</text><text x="217.5" y="79">A</text><text x="264.5" y="79">A</text><text x="311.5" y="79">A</text><text x="358.5" y="79">A</text><text x="405.5" y="79">A</text><text x="452.5" y="79">A</text><text x="499.5" y="79">A</text><text x="546.5" y="79">A</text><text x="593.5" y="79">A</text><text x="640.5" y="79">A</text><text x="170.5" y="109">B</text><text x="217.5" y="109">B</text><text x="264.5" y="109">B</text><text x="311.5" y="109">B</text><text x="358.5" y="109">E</text><text x="405.5" y="109">E</text><text x="452.5" y="109">E</text><text x="499.5" y="109">E</text><text x="546.5" y="109">C</text><text x="593.5" y="109">C</text><text x="640.5" y="109">C</text><text x="217.5" y="139">C</text><text x="264.5" y="139">C</text><text x="311.5" y="139">C</text><text x="358.5" y="139">C</text><text x="405.5" y="139">B</text><text x="452.5" y="139">B</text><text x="499.5" y="139">B</text><text x="546.5" y="139">B</text><text x="593.5" y="139">G</text><text x="640.5" y="139">G</text><text x="264.5" y="169">D</text><text x="311.5" y="169">D</text><text x="358.5" y="169">D</text><text x="405.5" y="169">D</text><text x="452.5" y="169">F</text><text x="499.5" y="169">F</text><text x="546.5" y="169">F</text><text x="593.5" y="169">F</text><text x="640.5" y="169">F</text></g>
<g style="font-size:11px;font-weight:600" text-anchor="middle">
<text x="0" y="196" text-anchor="start" style="font-weight:400;fill:var(--muted)">result</text>
<text x="123.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="170.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="217.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="264.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="311.5" y="196" style="fill:var(--accent-green)">hit</text>
<text x="358.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="405.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="452.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="499.5" y="196" style="fill:var(--accent-green)">hit</text>
<text x="546.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="593.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="640.5" y="196" style="fill:var(--accent-green)">hit</text>
</g>
<g style="fill:var(--muted);font-size:11px" text-anchor="middle">
<text x="0" y="213" text-anchor="start">evicts</text>
<text x="358.5" y="213">B</text>
<text x="405.5" y="213">C</text>
<text x="452.5" y="213">D</text>
<text x="546.5" y="213">E</text>
<text x="593.5" y="213">B</text>
</g>
<g style="fill:var(--ink);font-size:10px;font-family:var(--mono)" text-anchor="middle">
<text x="0" y="230" text-anchor="start" style="font-family:var(--sans);font-size:11px;fill:var(--muted)">MRU → LRU</text>
<text x="123.5" y="230">A</text>
<text x="170.5" y="230">BA</text>
<text x="217.5" y="230">CBA</text>
<text x="264.5" y="230">DCBA</text>
<text x="311.5" y="230">ADCB</text>
<text x="358.5" y="230">EADC</text>
<text x="405.5" y="230">BEAD</text>
<text x="452.5" y="230">FBEA</text>
<text x="499.5" y="230">AFBE</text>
<text x="546.5" y="230">CAFB</text>
<text x="593.5" y="230">GCAF</text>
<text x="640.5" y="230">AGCF</text>
</g>
<g style="fill:var(--muted);font-size:11px">
<rect x="0" y="245" width="16" height="12" rx="2" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="22" y="255">filled on a miss</text>
<rect x="136" y="245" width="16" height="12" rx="2" style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2.5"/><text x="158" y="255">hit</text>
</g>
</svg></div>

<p><strong>Implementation.</strong> The hardware must remember the recency order of the N lines in each set and rewrite it on every access. There are three ways to store the order, from fewest bits to simplest logic.</p>
<p><strong>The minimum: log<sub>2</sub>(N!) bits.</strong> N lines can be ordered in N! ways: N choices for the MRU position, N − 1 for the next, and so on down to 1. Telling N! states apart takes at least log<sub>2</sub>(N!) bits, rounded up. Since the log of a product is the sum of the logs, log<sub>2</sub>(N!) = log<sub>2</sub>1 + log<sub>2</sub>2 + … + log<sub>2</sub>N:</p>
<ul>
<li><strong>4 ways:</strong> 4! = 24 orders, log<sub>2</sub>24 ≈ 4.58, so <strong>5 bits</strong>.</li>
<li><strong>8 ways:</strong> 8! = 40,320 orders, 0 + 1 + 1.58 + 2 + 2.32 + 2.58 + 2.81 + 3 ≈ 15.3, so <strong>16 bits</strong>.</li>
<li><strong>16 ways:</strong> 16! ≈ 2.09 × 10<sup>13</sup> orders, log<sub>2</sub> ≈ 44.25, so <strong>45 bits</strong>.</li>
</ul>
<p>This is a lower bound, not a circuit. Turning a permutation number into "which way is LRU" and back after every access takes a large table or multi-step arithmetic, so no cache stores the order this way.</p>
<p><strong>Age counters: N × log<sub>2</sub>(N) bits.</strong> Each line keeps its position as a log<sub>2</sub>(N)-bit age: 0 for MRU, N − 1 for LRU. On an access to a line with age a, every line with an age below a adds 1, and the accessed line becomes 0. The victim is the line with age N − 1. For 8 ways that is 8 × 3 = 24 bits per set, plus a comparator per line on every access.</p>
<p><strong>The N × N matrix: N(N − 1)/2 bits.</strong> Keep one bit for every pair of ways recording which of the two was used more recently. Picture an N × N bit matrix M where M[i][j] = 1 means way i was used more recently than way j:</p>
<ul>
<li><strong>On an access to way i:</strong> set row i to all 1s (i is now newer than every other way), then clear column i (no way is newer than i). That also leaves M[i][i] = 0.</li>
<li><strong>Finding the victim:</strong> the LRU way is the one whose row is all 0s: it is newer than nobody. The number of 1s in a row is that way's recency rank, N − 1 for the MRU way and 0 for the LRU way.</li>
</ul>
<p>Why N(N − 1)/2 bits and not N²: the N diagonal bits M[i][i] say nothing, and for i ≠ j exactly one of M[i][j] and M[j][i] is 1, so M[j][i] is always the complement of M[i][j]. Only the bits above the diagonal are stored: (N² − N) / 2 = N(N − 1)/2. That is one bit per pair of ways, the number of ways to choose 2 of N. For 8 ways: (64 − 8) / 2 = <strong>28 bits</strong>. For 4 ways: 6. For 16 ways: 120.</p>
<p>The grid below shows this for 4 ways. Each pair of ways has two cells, one on each side of the diagonal, holding the same fact:</p>
<div class="tri-fig"><div class="tri" role="img" aria-label="4 by 4 LRU matrix: diagonal cells are always 0, the 6 cells above the diagonal are stored bits, and each cell below the diagonal is the complement of its mirror above"><span class="h"></span><span class="h">0</span><span class="h">1</span><span class="h">2</span><span class="h">3</span><span class="h">0</span><span class="d">0</span><span class="s">m<sub>01</sub></span><span class="s">m<sub>02</sub></span><span class="s">m<sub>03</sub></span><span class="h">1</span><span class="c"><i>m<sub>01</sub></i></span><span class="d">0</span><span class="s">m<sub>12</sub></span><span class="s">m<sub>13</sub></span><span class="h">2</span><span class="c"><i>m<sub>02</sub></i></span><span class="c"><i>m<sub>12</sub></i></span><span class="d">0</span><span class="s">m<sub>23</sub></span><span class="h">3</span><span class="c"><i>m<sub>03</sub></i></span><span class="c"><i>m<sub>13</sub></i></span><span class="c"><i>m<sub>23</sub></i></span><span class="d">0</span></div><ul class="tri-key">
<li><span class="sw s"></span><strong>6 stored bits</strong> above the diagonal, one per pair of ways: N(N − 1)/2</li>
<li><span class="sw c"></span><strong>6 derived bits</strong> below it, each the complement (the overline) of its mirror, so an inverter replaces a storage cell</li>
<li><span class="sw d"></span><strong>4 diagonal bits</strong>, always 0 since a way is never newer than itself, so nothing is stored</li>
<li>16 cells − 4 diagonal = 12, and half of those are copies: 12 / 2 = 6</li>
</ul></div>
<p><strong>Example.</strong> The accesses A, B, C in an empty 4-way set. Rows are ways labeled with the line they hold, columns are the ways compared against, and the 1s column is the recency rank. Bold bits are the ones the access wrote. Empty ways fill first, in way order.</p>
<div class="mx-steps">
<p><strong>Cycle 0: A</strong> misses and fills empty way 0. Row 0 becomes 1s and column 0 0s. Order, MRU first: A.</p>
<div class="math">\\[ \\begin{array}{c|cccc|c} & 0 & 1 & 2 & 3 & \\text{1s} \\\\ \\hline \\text{0 (A)} & \\cdot & \\mathbf{1} & \\mathbf{1} & \\mathbf{1} & 3 \\\\ \\text{1 (–)} & \\mathbf{0} & \\cdot & 0 & 0 & 0 \\\\ \\text{2 (–)} & \\mathbf{0} & 0 & \\cdot & 0 & 0 \\\\ \\text{3 (–)} & \\mathbf{0} & 0 & 0 & \\cdot & 0 \\end{array} \\]</div>
<p><strong>Cycle 1: B</strong> misses and fills empty way 1. Row 1 becomes 1s and column 1 0s. Order, MRU first: B A.</p>
<div class="math">\\[ \\begin{array}{c|cccc|c} & 0 & 1 & 2 & 3 & \\text{1s} \\\\ \\hline \\text{0 (A)} & \\cdot & \\mathbf{0} & 1 & 1 & 2 \\\\ \\text{1 (B)} & \\mathbf{1} & \\cdot & \\mathbf{1} & \\mathbf{1} & 3 \\\\ \\text{2 (–)} & 0 & \\mathbf{0} & \\cdot & 0 & 0 \\\\ \\text{3 (–)} & 0 & \\mathbf{0} & 0 & \\cdot & 0 \\end{array} \\]</div>
<p><strong>Cycle 2: C</strong> misses and fills empty way 2. Row 2 becomes 1s and column 2 0s. Order, MRU first: C B A.</p>
<div class="math">\\[ \\begin{array}{c|cccc|c} & 0 & 1 & 2 & 3 & \\text{1s} \\\\ \\hline \\text{0 (A)} & \\cdot & 0 & \\mathbf{0} & 1 & 1 \\\\ \\text{1 (B)} & 1 & \\cdot & \\mathbf{0} & 1 & 2 \\\\ \\text{2 (C)} & \\mathbf{1} & \\mathbf{1} & \\cdot & \\mathbf{1} & 3 \\\\ \\text{3 (–)} & 0 & 0 & \\mathbf{0} & \\cdot & 0 \\end{array} \\]</div>
</div>
<p>After cycle 2, way 3 is still empty and its row is all 0s, so the next miss fills it. Among the valid lines, A has the fewest 1s, so it is the LRU line and would be the victim once the set is full. The NOR over each row finds the all-0 row in one step, without sorting anything.</p>
<p>The 6 stored bits at that point are the upper triangle: M[0][1], M[0][2], M[0][3], M[1][2], M[1][3], M[2][3] = 0, 0, 1, 0, 1, 1. In hardware, victim selection is one (N − 1)-input NOR per way over its row (reading the complement of the stored bit for entries below the diagonal), and an update writes the N − 1 bits that involve the accessed way. Both take one cycle. What limits it is the quadratic growth, 120 bits per set at 16 ways against 15 for tree PLRU, and the read-modify-write of the set's state on every hit, which needs its own port so it doesn't block the next lookup. That cost is why true LRU is rare above 4 to 8 ways.</p>
<h4>Where True LRU Helps</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>Code with strong temporal locality: a line is reused soon after its last use, with fewer than N other lines touched in its set in between</li><li>Working sets that fit in the cache</li><li>Tiled loops, whose reuse is short-range</li></ul></td><td><ul><li>548.exchange2_r</li><li>508.namd_r</li><li>DGEMM with cache-sized tiles</li><li>525.x264_r's motion search over a reference window</li></ul></td></tr></table></div>
<h4>Where True LRU Hurts</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>Cyclic access over k + 1 lines in a k-way set: each line is evicted just before its reuse, so every access misses (the LRU trace under OPT above)</li><li>Scans of single-use lines: each enters at MRU and must travel all N positions, evicting N useful lines on the way</li><li>A streaming thread sharing an LLC with a reuse-heavy one</li></ul></td><td><ul><li>429.mcf (SPEC CPU2006) at the LLC, where the DIP and RRIP papers report large miss reductions over LRU</li><li>519.lbm_r sharing an LLC with 520.omnetpp_r</li><li>Database table scans that flush hot index pages</li></ul></td></tr></table></div>

<h3 id="sec-plru">Tree Pseudo-LRU (PLRU)</h3>
<p><strong>Motivation.</strong> It gets most of LRU's benefit with N − 1 bits per set (7 for 8 ways, 15 for 16 ways), and a hit updates only the log<sub>2</sub>(N) bits on one path. It is the usual choice for 4- to 16-way L1 and L2 caches. The PowerPC 7450's L1 caches use it, and reverse-engineering studies report it in Intel core caches.</p>
<p><strong>How it works.</strong> A binary tree sits over the ways. Each internal bit points toward the half that should be evicted from next: 0 for the left half, 1 for the right. On any access, every bit on the path to that way is set to point away from it. To find a victim, start at the root and follow the bits down.</p>
<p><strong>Example.</strong> On the same accesses as the LRU trace, just before cycle 5, the last accesses were A (way 0, at cycle 4), D (way 3), C (way 2), and B (way 1). True LRU would evict B. The tree only records that the right pair is older than the left pair, and that D is newer than C within it, so it picks C:</p>
<div class="tbl"><svg viewBox="0 0 680 256" role="img" aria-label="A tree pseudo-LRU for 4 ways, with 3 bits. The root bit b0 is 1, pointing to the right half, ways 2 and 3. Bit b1, over ways 0 and 1, is 1. Bit b2, over ways 2 and 3, is 0, pointing to way 2. Following the bits from the root reaches way 2, holding C, so C is the victim. True LRU would evict B in way 1, because the recency order from MRU to LRU is A, D, C, B." style="width:100%;min-width:520px;max-width:680px;display:block;font-family:var(--sans)">
<path d="M340,58 L200,90" style="fill:none;stroke:var(--rule);stroke-width:1.5"/><text x="260" y="70" style="fill:var(--muted);font-size:11px" text-anchor="middle">0</text>
<path d="M340,58 L480,90" style="fill:none;stroke:var(--trace);stroke-width:3"/><text x="420" y="70" style="fill:var(--muted);font-size:11px" text-anchor="middle">1</text>
<path d="M200,126 L130,166" style="fill:none;stroke:var(--rule);stroke-width:1.5"/><text x="155" y="142" style="fill:var(--muted);font-size:11px" text-anchor="middle">0</text>
<path d="M200,126 L270,166" style="fill:none;stroke:var(--rule);stroke-width:1.5"/><text x="245" y="142" style="fill:var(--muted);font-size:11px" text-anchor="middle">1</text>
<path d="M480,126 L410,166" style="fill:none;stroke:var(--trace);stroke-width:3"/><text x="435" y="142" style="fill:var(--muted);font-size:11px" text-anchor="middle">0</text>
<path d="M480,126 L550,166" style="fill:none;stroke:var(--rule);stroke-width:1.5"/><text x="525" y="142" style="fill:var(--muted);font-size:11px" text-anchor="middle">1</text>
<circle cx="340" cy="40" r="18" style="fill:var(--surface);stroke:var(--muted);stroke-width:1.5"/><text x="340" y="44" text-anchor="middle" style="fill:var(--ink);font-size:12px;font-weight:600">b0=1</text>
<circle cx="200" cy="108" r="18" style="fill:var(--surface);stroke:var(--muted);stroke-width:1.5"/><text x="200" y="112" text-anchor="middle" style="fill:var(--ink);font-size:12px;font-weight:600">b1=1</text>
<circle cx="480" cy="108" r="18" style="fill:var(--surface);stroke:var(--muted);stroke-width:1.5"/><text x="480" y="112" text-anchor="middle" style="fill:var(--ink);font-size:12px;font-weight:600">b2=0</text>
<rect x="96" y="166" width="68" height="34" rx="4" style="fill:var(--surface);stroke:var(--muted);stroke-width:1.5"/>
<text x="130" y="181" text-anchor="middle" style="fill:var(--ink);font-size:13px;font-weight:600">A</text><text x="130" y="195" text-anchor="middle" style="fill:var(--muted);font-size:10px">way 0</text>
<rect x="236" y="166" width="68" height="34" rx="4" style="fill:var(--surface);stroke:var(--muted);stroke-width:1.5"/>
<text x="270" y="181" text-anchor="middle" style="fill:var(--ink);font-size:13px;font-weight:600">B</text><text x="270" y="195" text-anchor="middle" style="fill:var(--muted);font-size:10px">way 1</text>
<rect x="376" y="166" width="68" height="34" rx="4" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/>
<text x="410" y="181" text-anchor="middle" style="fill:var(--ink);font-size:13px;font-weight:600">C</text><text x="410" y="195" text-anchor="middle" style="fill:var(--muted);font-size:10px">way 2</text>
<rect x="516" y="166" width="68" height="34" rx="4" style="fill:var(--surface);stroke:var(--muted);stroke-width:1.5"/>
<text x="550" y="181" text-anchor="middle" style="fill:var(--ink);font-size:13px;font-weight:600">D</text><text x="550" y="195" text-anchor="middle" style="fill:var(--muted);font-size:10px">way 3</text>
<text x="410" y="220" text-anchor="middle" style="fill:var(--trace);font-size:11px;font-weight:600">PLRU victim</text>
<text x="270" y="220" text-anchor="middle" style="fill:var(--muted);font-size:11px">true LRU victim</text>
<text x="0" y="16" style="fill:var(--ink);font-size:13px;font-weight:600">Bits just before cycle 5 of the trace below</text>
<text x="340" y="244" text-anchor="middle" style="fill:var(--muted);font-size:11px">Each bit points toward the half to evict from. True recency, MRU to LRU, is A D C B.</text>
</svg></div>
<div class="tbl"><svg viewBox="0 0 680 263" role="img" aria-label="Tree pseudo-LRU on the same sequence A B C D A E B F A C G A. At cycle 5, E evicts C in way 2 while true LRU would have evicted B. B then hits at cycle 6. 4 of 12 hits, one more than true LRU on this sequence." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<text x="0" y="13" style="fill:var(--ink);font-size:13px;font-weight:600">Tree PLRU: 4 of 12 hits</text>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle">
<text x="0" y="34" text-anchor="start">cycle</text>
<text x="123.5" y="34">0</text>
<text x="170.5" y="34">1</text>
<text x="217.5" y="34">2</text>
<text x="264.5" y="34">3</text>
<text x="311.5" y="34">4</text>
<text x="358.5" y="34">5</text>
<text x="405.5" y="34">6</text>
<text x="452.5" y="34">7</text>
<text x="499.5" y="34">8</text>
<text x="546.5" y="34">9</text>
<text x="593.5" y="34">10</text>
<text x="640.5" y="34">11</text>
</g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle">
<text x="0" y="51" text-anchor="start" style="font-weight:400;font-size:11px;fill:var(--muted)">access</text>
<text x="123.5" y="51">A</text>
<text x="170.5" y="51">B</text>
<text x="217.5" y="51">C</text>
<text x="264.5" y="51">D</text>
<text x="311.5" y="51">A</text>
<text x="358.5" y="51">E</text>
<text x="405.5" y="51">B</text>
<text x="452.5" y="51">F</text>
<text x="499.5" y="51">A</text>
<text x="546.5" y="51">C</text>
<text x="593.5" y="51">G</text>
<text x="640.5" y="51">A</text>
</g>
<text x="0" y="79" style="fill:var(--muted);font-size:11px">way 0</text>
<text x="0" y="109" style="fill:var(--muted);font-size:11px">way 1</text>
<text x="0" y="139" style="fill:var(--muted);font-size:11px">way 2</text>
<text x="0" y="169" style="fill:var(--muted);font-size:11px">way 3</text>
<g style="fill:none;stroke:var(--rule);stroke-width:1;stroke-dasharray:3 3"><rect x="102" y="92" width="43" height="26" rx="3"/><rect x="102" y="122" width="43" height="26" rx="3"/><rect x="149" y="122" width="43" height="26" rx="3"/><rect x="102" y="152" width="43" height="26" rx="3"/><rect x="149" y="152" width="43" height="26" rx="3"/><rect x="196" y="152" width="43" height="26" rx="3"/></g>
<g style="fill:var(--surface);stroke:var(--rule);stroke-width:1"><rect x="149" y="62" width="43" height="26" rx="3"/><rect x="196" y="62" width="43" height="26" rx="3"/><rect x="243" y="62" width="43" height="26" rx="3"/><rect x="337" y="62" width="43" height="26" rx="3"/><rect x="384" y="62" width="43" height="26" rx="3"/><rect x="431" y="62" width="43" height="26" rx="3"/><rect x="525" y="62" width="43" height="26" rx="3"/><rect x="572" y="62" width="43" height="26" rx="3"/><rect x="196" y="92" width="43" height="26" rx="3"/><rect x="243" y="92" width="43" height="26" rx="3"/><rect x="290" y="92" width="43" height="26" rx="3"/><rect x="337" y="92" width="43" height="26" rx="3"/><rect x="431" y="92" width="43" height="26" rx="3"/><rect x="478" y="92" width="43" height="26" rx="3"/><rect x="525" y="92" width="43" height="26" rx="3"/><rect x="619" y="92" width="43" height="26" rx="3"/><rect x="243" y="122" width="43" height="26" rx="3"/><rect x="290" y="122" width="43" height="26" rx="3"/><rect x="384" y="122" width="43" height="26" rx="3"/><rect x="431" y="122" width="43" height="26" rx="3"/><rect x="478" y="122" width="43" height="26" rx="3"/><rect x="572" y="122" width="43" height="26" rx="3"/><rect x="619" y="122" width="43" height="26" rx="3"/><rect x="290" y="152" width="43" height="26" rx="3"/><rect x="337" y="152" width="43" height="26" rx="3"/><rect x="384" y="152" width="43" height="26" rx="3"/><rect x="478" y="152" width="43" height="26" rx="3"/><rect x="525" y="152" width="43" height="26" rx="3"/><rect x="572" y="152" width="43" height="26" rx="3"/><rect x="619" y="152" width="43" height="26" rx="3"/></g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"><rect x="102" y="62" width="43" height="26" rx="3"/><rect x="149" y="92" width="43" height="26" rx="3"/><rect x="572" y="92" width="43" height="26" rx="3"/><rect x="196" y="122" width="43" height="26" rx="3"/><rect x="337" y="122" width="43" height="26" rx="3"/><rect x="525" y="122" width="43" height="26" rx="3"/><rect x="243" y="152" width="43" height="26" rx="3"/><rect x="431" y="152" width="43" height="26" rx="3"/></g>
<g style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2.5"><rect x="290" y="62" width="43" height="26" rx="3"/><rect x="478" y="62" width="43" height="26" rx="3"/><rect x="619" y="62" width="43" height="26" rx="3"/><rect x="384" y="92" width="43" height="26" rx="3"/></g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle"><text x="123.5" y="79">A</text><text x="170.5" y="79">A</text><text x="217.5" y="79">A</text><text x="264.5" y="79">A</text><text x="311.5" y="79">A</text><text x="358.5" y="79">A</text><text x="405.5" y="79">A</text><text x="452.5" y="79">A</text><text x="499.5" y="79">A</text><text x="546.5" y="79">A</text><text x="593.5" y="79">A</text><text x="640.5" y="79">A</text><text x="170.5" y="109">B</text><text x="217.5" y="109">B</text><text x="264.5" y="109">B</text><text x="311.5" y="109">B</text><text x="358.5" y="109">B</text><text x="405.5" y="109">B</text><text x="452.5" y="109">B</text><text x="499.5" y="109">B</text><text x="546.5" y="109">B</text><text x="593.5" y="109">G</text><text x="640.5" y="109">G</text><text x="217.5" y="139">C</text><text x="264.5" y="139">C</text><text x="311.5" y="139">C</text><text x="358.5" y="139">E</text><text x="405.5" y="139">E</text><text x="452.5" y="139">E</text><text x="499.5" y="139">E</text><text x="546.5" y="139">C</text><text x="593.5" y="139">C</text><text x="640.5" y="139">C</text><text x="264.5" y="169">D</text><text x="311.5" y="169">D</text><text x="358.5" y="169">D</text><text x="405.5" y="169">D</text><text x="452.5" y="169">F</text><text x="499.5" y="169">F</text><text x="546.5" y="169">F</text><text x="593.5" y="169">F</text><text x="640.5" y="169">F</text></g>
<g style="font-size:11px;font-weight:600" text-anchor="middle">
<text x="0" y="196" text-anchor="start" style="font-weight:400;fill:var(--muted)">result</text>
<text x="123.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="170.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="217.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="264.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="311.5" y="196" style="fill:var(--accent-green)">hit</text>
<text x="358.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="405.5" y="196" style="fill:var(--accent-green)">hit</text>
<text x="452.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="499.5" y="196" style="fill:var(--accent-green)">hit</text>
<text x="546.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="593.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="640.5" y="196" style="fill:var(--accent-green)">hit</text>
</g>
<g style="fill:var(--muted);font-size:11px" text-anchor="middle">
<text x="0" y="213" text-anchor="start">evicts</text>
<text x="358.5" y="213">C</text>
<text x="452.5" y="213">D</text>
<text x="546.5" y="213">E</text>
<text x="593.5" y="213">B</text>
</g>
<g style="fill:var(--ink);font-size:10px;font-family:var(--mono)" text-anchor="middle">
<text x="0" y="230" text-anchor="start" style="font-family:var(--sans);font-size:11px;fill:var(--muted)">bits b0 b1 b2</text>
<text x="123.5" y="230">110</text>
<text x="170.5" y="230">100</text>
<text x="217.5" y="230">001</text>
<text x="264.5" y="230">000</text>
<text x="311.5" y="230">110</text>
<text x="358.5" y="230">011</text>
<text x="405.5" y="230">101</text>
<text x="452.5" y="230">000</text>
<text x="499.5" y="230">110</text>
<text x="546.5" y="230">011</text>
<text x="593.5" y="230">101</text>
<text x="640.5" y="230">111</text>
</g>
<g style="fill:var(--muted);font-size:11px">
<rect x="0" y="245" width="16" height="12" rx="2" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="22" y="255">filled on a miss</text>
<rect x="136" y="245" width="16" height="12" rx="2" style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2.5"/><text x="158" y="255">hit</text>
</g>
</svg></div>
<p>Here the approximation happens to help: B is used at cycle 6 and hits, so PLRU gets 4 hits to LRU's 3. Over full benchmarks the two are usually within a few percent of each other in miss rate.</p>

<p><strong>Implementation.</strong> The N − 1 tree bits are stored in heap order: b0 is the root, and node k's children are nodes 2k + 1 and 2k + 2. For 8 ways, write the way number in binary as w2 w1 w0:</p>
<ul>
<li><strong>Update on an access to way w:</strong> b0 ← NOT w2, then b[1 + w2] ← NOT w1, then b[3 + 2·w2 + w1] ← NOT w0. Each bit on the path now points away from w. An access to way 5 (binary 101) writes b0 = 0, b2 = 1, and b5 = 0.</li>
<li><strong>Victim:</strong> read the path the same way: v2 = b0, v1 = b[1 + v2], v0 = b[3 + 2·v2 + v1]. The victim is way v2 v1 v0, a chain of three 2:1 multiplexers.</li>
</ul>
<p>An update writes only the log<sub>2</sub>(N) bits on one path, done as a masked write of the whole N − 1-bit vector. The MRU line is never chosen, because every bit on its path points away from it, but the victim can be fairly recent, as the example above shows.</p>
<h4>Where Tree PLRU Helps</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>The same temporal locality LRU suits, in 4- to 16-way L1 and L2 caches</li><li>Hit-heavy traffic, where every hit updates the tree and the update must be cheap and fast</li></ul></td><td><ul><li>Most SPEC CPU2017 integer benchmarks at L1 and L2, such as 502.gcc_r and 523.xalancbmk_r</li><li>548.exchange2_r</li><li>Intel and PowerPC L1 caches running general code</li></ul></td></tr></table></div>
<h4>Where Tree PLRU Hurts</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>Everything that defeats LRU: cyclic loops larger than the set and scans</li><li>Access orders where the coarse tree history points at a recently used line</li></ul></td><td><ul><li>429.mcf (SPEC CPU2006) at the LLC</li><li>519.lbm_r streaming through a shared LLC</li><li>Iterative solvers over data 1.5 times the cache</li></ul></td></tr></table></div>

<h3 id="sec-nru">Not Recently Used (NRU)</h3>
<p><strong>Motivation.</strong> It is even cheaper than tree PLRU: one bit per line, and a hit sets only its own line's bit, with no shared tree to update. Sun's UltraSPARC T2 used it in its L2. It is also the one-bit special case of RRIP (below).</p>
<p><strong>How it works.</strong> Each line has a used bit U, set to 1 on a fill or a hit. The victim is the first line, searching from way 0, with U = 0. If every bit is 1, clear them all and search again, which picks way 0.</p>
<p><strong>Example.</strong> At cycle 5 every line has U = 1, so all bits are cleared and way 0 is evicted. That is A, which was used one access earlier. After a clear, NRU can't tell old lines from new ones:</p>
<div class="tbl"><svg viewBox="0 0 680 246" role="img" aria-label="NRU on the sequence A B C D A E B F A C G A. Each line's used bit is set on access. At cycle 5 every bit is 1, so all are cleared and the first way, holding A, is evicted even though A was just used. 3 of 12 hits." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<text x="0" y="13" style="fill:var(--ink);font-size:13px;font-weight:600">NRU: 3 of 12 hits</text>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle">
<text x="0" y="34" text-anchor="start">cycle</text>
<text x="123.5" y="34">0</text>
<text x="170.5" y="34">1</text>
<text x="217.5" y="34">2</text>
<text x="264.5" y="34">3</text>
<text x="311.5" y="34">4</text>
<text x="358.5" y="34">5</text>
<text x="405.5" y="34">6</text>
<text x="452.5" y="34">7</text>
<text x="499.5" y="34">8</text>
<text x="546.5" y="34">9</text>
<text x="593.5" y="34">10</text>
<text x="640.5" y="34">11</text>
</g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle">
<text x="0" y="51" text-anchor="start" style="font-weight:400;font-size:11px;fill:var(--muted)">access</text>
<text x="123.5" y="51">A</text>
<text x="170.5" y="51">B</text>
<text x="217.5" y="51">C</text>
<text x="264.5" y="51">D</text>
<text x="311.5" y="51">A</text>
<text x="358.5" y="51">E</text>
<text x="405.5" y="51">B</text>
<text x="452.5" y="51">F</text>
<text x="499.5" y="51">A</text>
<text x="546.5" y="51">C</text>
<text x="593.5" y="51">G</text>
<text x="640.5" y="51">A</text>
</g>
<text x="0" y="79" style="fill:var(--muted);font-size:11px">way 0</text>
<text x="0" y="109" style="fill:var(--muted);font-size:11px">way 1</text>
<text x="0" y="139" style="fill:var(--muted);font-size:11px">way 2</text>
<text x="0" y="169" style="fill:var(--muted);font-size:11px">way 3</text>
<g style="fill:none;stroke:var(--rule);stroke-width:1;stroke-dasharray:3 3"><rect x="102" y="92" width="43" height="26" rx="3"/><rect x="102" y="122" width="43" height="26" rx="3"/><rect x="149" y="122" width="43" height="26" rx="3"/><rect x="102" y="152" width="43" height="26" rx="3"/><rect x="149" y="152" width="43" height="26" rx="3"/><rect x="196" y="152" width="43" height="26" rx="3"/></g>
<g style="fill:var(--surface);stroke:var(--rule);stroke-width:1"><rect x="149" y="62" width="43" height="26" rx="3"/><rect x="196" y="62" width="43" height="26" rx="3"/><rect x="243" y="62" width="43" height="26" rx="3"/><rect x="384" y="62" width="43" height="26" rx="3"/><rect x="431" y="62" width="43" height="26" rx="3"/><rect x="478" y="62" width="43" height="26" rx="3"/><rect x="572" y="62" width="43" height="26" rx="3"/><rect x="619" y="62" width="43" height="26" rx="3"/><rect x="196" y="92" width="43" height="26" rx="3"/><rect x="243" y="92" width="43" height="26" rx="3"/><rect x="290" y="92" width="43" height="26" rx="3"/><rect x="337" y="92" width="43" height="26" rx="3"/><rect x="431" y="92" width="43" height="26" rx="3"/><rect x="478" y="92" width="43" height="26" rx="3"/><rect x="525" y="92" width="43" height="26" rx="3"/><rect x="619" y="92" width="43" height="26" rx="3"/><rect x="243" y="122" width="43" height="26" rx="3"/><rect x="290" y="122" width="43" height="26" rx="3"/><rect x="337" y="122" width="43" height="26" rx="3"/><rect x="384" y="122" width="43" height="26" rx="3"/><rect x="478" y="122" width="43" height="26" rx="3"/><rect x="525" y="122" width="43" height="26" rx="3"/><rect x="572" y="122" width="43" height="26" rx="3"/><rect x="619" y="122" width="43" height="26" rx="3"/><rect x="290" y="152" width="43" height="26" rx="3"/><rect x="337" y="152" width="43" height="26" rx="3"/><rect x="384" y="152" width="43" height="26" rx="3"/><rect x="431" y="152" width="43" height="26" rx="3"/><rect x="525" y="152" width="43" height="26" rx="3"/><rect x="572" y="152" width="43" height="26" rx="3"/></g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"><rect x="102" y="62" width="43" height="26" rx="3"/><rect x="337" y="62" width="43" height="26" rx="3"/><rect x="525" y="62" width="43" height="26" rx="3"/><rect x="149" y="92" width="43" height="26" rx="3"/><rect x="572" y="92" width="43" height="26" rx="3"/><rect x="196" y="122" width="43" height="26" rx="3"/><rect x="431" y="122" width="43" height="26" rx="3"/><rect x="243" y="152" width="43" height="26" rx="3"/><rect x="478" y="152" width="43" height="26" rx="3"/></g>
<g style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2.5"><rect x="290" y="62" width="43" height="26" rx="3"/><rect x="384" y="92" width="43" height="26" rx="3"/><rect x="619" y="152" width="43" height="26" rx="3"/></g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle"><text x="117.48" y="79">A</text><text x="164.48" y="79">A</text><text x="211.48" y="79">A</text><text x="258.48" y="79">A</text><text x="305.48" y="79">A</text><text x="352.48" y="79">E</text><text x="399.48" y="79">E</text><text x="446.48" y="79">E</text><text x="493.48" y="79">E</text><text x="540.48" y="79">C</text><text x="587.48" y="79">C</text><text x="634.48" y="79">C</text><text x="164.48" y="109">B</text><text x="211.48" y="109">B</text><text x="258.48" y="109">B</text><text x="305.48" y="109">B</text><text x="352.48" y="109">B</text><text x="399.48" y="109">B</text><text x="446.48" y="109">B</text><text x="493.48" y="109">B</text><text x="540.48" y="109">B</text><text x="587.48" y="109">G</text><text x="634.48" y="109">G</text><text x="211.48" y="139">C</text><text x="258.48" y="139">C</text><text x="305.48" y="139">C</text><text x="352.48" y="139">C</text><text x="399.48" y="139">C</text><text x="446.48" y="139">F</text><text x="493.48" y="139">F</text><text x="540.48" y="139">F</text><text x="587.48" y="139">F</text><text x="634.48" y="139">F</text><text x="258.48" y="169">D</text><text x="305.48" y="169">D</text><text x="352.48" y="169">D</text><text x="399.48" y="169">D</text><text x="446.48" y="169">D</text><text x="493.48" y="169">A</text><text x="540.48" y="169">A</text><text x="587.48" y="169">A</text><text x="634.48" y="169">A</text></g>
<g style="fill:var(--muted);font-size:10px;font-family:var(--mono)" text-anchor="end"><text x="141" y="80">1</text><text x="188" y="80">1</text><text x="235" y="80">1</text><text x="282" y="80">1</text><text x="329" y="80">1</text><text x="376" y="80">1</text><text x="423" y="80">1</text><text x="470" y="80">1</text><text x="517" y="80">1</text><text x="564" y="80">1</text><text x="611" y="80">1</text><text x="658" y="80">1</text><text x="188" y="110">1</text><text x="235" y="110">1</text><text x="282" y="110">1</text><text x="329" y="110">1</text><text x="376" y="110">0</text><text x="423" y="110">1</text><text x="470" y="110">1</text><text x="517" y="110">1</text><text x="564" y="110">0</text><text x="611" y="110">1</text><text x="658" y="110">1</text><text x="235" y="140">1</text><text x="282" y="140">1</text><text x="329" y="140">1</text><text x="376" y="140">0</text><text x="423" y="140">0</text><text x="470" y="140">1</text><text x="517" y="140">1</text><text x="564" y="140">0</text><text x="611" y="140">0</text><text x="658" y="140">0</text><text x="282" y="170">1</text><text x="329" y="170">1</text><text x="376" y="170">0</text><text x="423" y="170">0</text><text x="470" y="170">0</text><text x="517" y="170">1</text><text x="564" y="170">0</text><text x="611" y="170">0</text><text x="658" y="170">1</text></g>
<g style="font-size:11px;font-weight:600" text-anchor="middle">
<text x="0" y="196" text-anchor="start" style="font-weight:400;fill:var(--muted)">result</text>
<text x="123.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="170.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="217.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="264.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="311.5" y="196" style="fill:var(--accent-green)">hit</text>
<text x="358.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="405.5" y="196" style="fill:var(--accent-green)">hit</text>
<text x="452.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="499.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="546.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="593.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="640.5" y="196" style="fill:var(--accent-green)">hit</text>
</g>
<g style="fill:var(--muted);font-size:11px" text-anchor="middle">
<text x="0" y="213" text-anchor="start">evicts</text>
<text x="358.5" y="213">A</text>
<text x="452.5" y="213">C</text>
<text x="499.5" y="213">D</text>
<text x="546.5" y="213">E</text>
<text x="593.5" y="213">B</text>
</g>
<g style="fill:var(--muted);font-size:11px">
<rect x="0" y="228" width="16" height="12" rx="2" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="22" y="238">filled on a miss</text>
<rect x="136" y="228" width="16" height="12" rx="2" style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2.5"/><text x="158" y="238">hit</text>
<text x="194" y="238">small number = used bit U</text>
</g>
</svg></div>

<p><strong>Implementation.</strong> One U bit per line, often stored in the tag entry. A hit sets only its own bit. The victim is found by a priority encoder over the inverted U bits (first 0 from way 0). An N-input AND detects "all ones," and the clear happens in the same cycle. Some variants keep the just-accessed line's bit set when clearing, so it is not the next victim. N bits per set: 8 for 8 ways. NRU is RRIP with a 1-bit RRPV: U = 1 is RRPV 0, U = 0 is RRPV 1.</p>
<h4>Where NRU Helps</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>Coarse reuse in the filtered traffic of large, highly associative L2s and LLCs, where a recent-or-not split is enough</li><li>Interleaved accesses from many threads on throughput cores, where every hit's update must be a single bit</li></ul></td><td><ul><li>Throughput server workloads on Sun's UltraSPARC T2 L2</li><li>LLC traffic of web and application servers</li></ul></td></tr></table></div>
<h4>Where NRU Hurts</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>Hot lines in a small set that are all reused between misses: after a clear, a just-used line becomes the victim</li><li>Scans, which get no protection</li></ul></td><td><ul><li>Embedded control code on small 4-way L1 caches</li><li>PostgreSQL sequential scans next to index lookups</li></ul></td></tr></table></div>

<h3 id="sec-fifo">First In, First Out (FIFO)</h3>
<p><strong>Motivation.</strong> Hits change nothing, so there is no state to update on the most common event. Each set needs only a log<sub>2</sub>(N)-bit pointer. That suits highly associative structures and designs where hit-path power matters, and ARM calls it round-robin and offers it as a cache option on several Cortex cores.</p>
<p><strong>How it works.</strong> A pointer names the next victim. Each fill replaces the line at the pointer and advances the pointer by one way, wrapping around. The victim is the line filled longest ago, however often it has been used since. FIFO can also show Belady's anomaly: adding ways can increase misses on some traces.</p>
<p><strong>Example.</strong> A hits at cycle 4, but it was the first line in, so at cycle 5 E evicts it anyway. LRU would have kept A and evicted B:</p>
<div class="tbl"><svg viewBox="0 0 680 263" role="img" aria-label="FIFO on the sequence A B C D A E B F A C G A. The hit on A at cycle 4 changes nothing, so at cycle 5 E evicts A, the oldest line, even though it was just used. B hits at cycle 6 and A at cycle 11. 3 of 12 hits." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<text x="0" y="13" style="fill:var(--ink);font-size:13px;font-weight:600">FIFO: 3 of 12 hits</text>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle">
<text x="0" y="34" text-anchor="start">cycle</text>
<text x="123.5" y="34">0</text>
<text x="170.5" y="34">1</text>
<text x="217.5" y="34">2</text>
<text x="264.5" y="34">3</text>
<text x="311.5" y="34">4</text>
<text x="358.5" y="34">5</text>
<text x="405.5" y="34">6</text>
<text x="452.5" y="34">7</text>
<text x="499.5" y="34">8</text>
<text x="546.5" y="34">9</text>
<text x="593.5" y="34">10</text>
<text x="640.5" y="34">11</text>
</g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle">
<text x="0" y="51" text-anchor="start" style="font-weight:400;font-size:11px;fill:var(--muted)">access</text>
<text x="123.5" y="51">A</text>
<text x="170.5" y="51">B</text>
<text x="217.5" y="51">C</text>
<text x="264.5" y="51">D</text>
<text x="311.5" y="51">A</text>
<text x="358.5" y="51">E</text>
<text x="405.5" y="51">B</text>
<text x="452.5" y="51">F</text>
<text x="499.5" y="51">A</text>
<text x="546.5" y="51">C</text>
<text x="593.5" y="51">G</text>
<text x="640.5" y="51">A</text>
</g>
<text x="0" y="79" style="fill:var(--muted);font-size:11px">way 0</text>
<text x="0" y="109" style="fill:var(--muted);font-size:11px">way 1</text>
<text x="0" y="139" style="fill:var(--muted);font-size:11px">way 2</text>
<text x="0" y="169" style="fill:var(--muted);font-size:11px">way 3</text>
<g style="fill:none;stroke:var(--rule);stroke-width:1;stroke-dasharray:3 3"><rect x="102" y="92" width="43" height="26" rx="3"/><rect x="102" y="122" width="43" height="26" rx="3"/><rect x="149" y="122" width="43" height="26" rx="3"/><rect x="102" y="152" width="43" height="26" rx="3"/><rect x="149" y="152" width="43" height="26" rx="3"/><rect x="196" y="152" width="43" height="26" rx="3"/></g>
<g style="fill:var(--surface);stroke:var(--rule);stroke-width:1"><rect x="149" y="62" width="43" height="26" rx="3"/><rect x="196" y="62" width="43" height="26" rx="3"/><rect x="243" y="62" width="43" height="26" rx="3"/><rect x="384" y="62" width="43" height="26" rx="3"/><rect x="431" y="62" width="43" height="26" rx="3"/><rect x="478" y="62" width="43" height="26" rx="3"/><rect x="525" y="62" width="43" height="26" rx="3"/><rect x="619" y="62" width="43" height="26" rx="3"/><rect x="196" y="92" width="43" height="26" rx="3"/><rect x="243" y="92" width="43" height="26" rx="3"/><rect x="290" y="92" width="43" height="26" rx="3"/><rect x="337" y="92" width="43" height="26" rx="3"/><rect x="478" y="92" width="43" height="26" rx="3"/><rect x="525" y="92" width="43" height="26" rx="3"/><rect x="572" y="92" width="43" height="26" rx="3"/><rect x="619" y="92" width="43" height="26" rx="3"/><rect x="243" y="122" width="43" height="26" rx="3"/><rect x="290" y="122" width="43" height="26" rx="3"/><rect x="337" y="122" width="43" height="26" rx="3"/><rect x="384" y="122" width="43" height="26" rx="3"/><rect x="431" y="122" width="43" height="26" rx="3"/><rect x="525" y="122" width="43" height="26" rx="3"/><rect x="572" y="122" width="43" height="26" rx="3"/><rect x="290" y="152" width="43" height="26" rx="3"/><rect x="337" y="152" width="43" height="26" rx="3"/><rect x="384" y="152" width="43" height="26" rx="3"/><rect x="431" y="152" width="43" height="26" rx="3"/><rect x="478" y="152" width="43" height="26" rx="3"/><rect x="572" y="152" width="43" height="26" rx="3"/><rect x="619" y="152" width="43" height="26" rx="3"/></g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"><rect x="102" y="62" width="43" height="26" rx="3"/><rect x="337" y="62" width="43" height="26" rx="3"/><rect x="572" y="62" width="43" height="26" rx="3"/><rect x="149" y="92" width="43" height="26" rx="3"/><rect x="431" y="92" width="43" height="26" rx="3"/><rect x="196" y="122" width="43" height="26" rx="3"/><rect x="478" y="122" width="43" height="26" rx="3"/><rect x="243" y="152" width="43" height="26" rx="3"/><rect x="525" y="152" width="43" height="26" rx="3"/></g>
<g style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2.5"><rect x="290" y="62" width="43" height="26" rx="3"/><rect x="384" y="92" width="43" height="26" rx="3"/><rect x="619" y="122" width="43" height="26" rx="3"/></g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle"><text x="123.5" y="79">A</text><text x="170.5" y="79">A</text><text x="217.5" y="79">A</text><text x="264.5" y="79">A</text><text x="311.5" y="79">A</text><text x="358.5" y="79">E</text><text x="405.5" y="79">E</text><text x="452.5" y="79">E</text><text x="499.5" y="79">E</text><text x="546.5" y="79">E</text><text x="593.5" y="79">G</text><text x="640.5" y="79">G</text><text x="170.5" y="109">B</text><text x="217.5" y="109">B</text><text x="264.5" y="109">B</text><text x="311.5" y="109">B</text><text x="358.5" y="109">B</text><text x="405.5" y="109">B</text><text x="452.5" y="109">F</text><text x="499.5" y="109">F</text><text x="546.5" y="109">F</text><text x="593.5" y="109">F</text><text x="640.5" y="109">F</text><text x="217.5" y="139">C</text><text x="264.5" y="139">C</text><text x="311.5" y="139">C</text><text x="358.5" y="139">C</text><text x="405.5" y="139">C</text><text x="452.5" y="139">C</text><text x="499.5" y="139">A</text><text x="546.5" y="139">A</text><text x="593.5" y="139">A</text><text x="640.5" y="139">A</text><text x="264.5" y="169">D</text><text x="311.5" y="169">D</text><text x="358.5" y="169">D</text><text x="405.5" y="169">D</text><text x="452.5" y="169">D</text><text x="499.5" y="169">D</text><text x="546.5" y="169">C</text><text x="593.5" y="169">C</text><text x="640.5" y="169">C</text></g>
<g style="font-size:11px;font-weight:600" text-anchor="middle">
<text x="0" y="196" text-anchor="start" style="font-weight:400;fill:var(--muted)">result</text>
<text x="123.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="170.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="217.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="264.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="311.5" y="196" style="fill:var(--accent-green)">hit</text>
<text x="358.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="405.5" y="196" style="fill:var(--accent-green)">hit</text>
<text x="452.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="499.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="546.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="593.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="640.5" y="196" style="fill:var(--accent-green)">hit</text>
</g>
<g style="fill:var(--muted);font-size:11px" text-anchor="middle">
<text x="0" y="213" text-anchor="start">evicts</text>
<text x="358.5" y="213">A</text>
<text x="452.5" y="213">B</text>
<text x="499.5" y="213">C</text>
<text x="546.5" y="213">D</text>
<text x="593.5" y="213">E</text>
</g>
<g style="fill:var(--ink);font-size:10px;font-family:var(--mono)" text-anchor="middle">
<text x="0" y="230" text-anchor="start" style="font-family:var(--sans);font-size:11px;fill:var(--muted)">next victim</text>
<text x="123.5" y="230">way 1</text>
<text x="170.5" y="230">way 2</text>
<text x="217.5" y="230">way 3</text>
<text x="264.5" y="230">way 0</text>
<text x="311.5" y="230">way 0</text>
<text x="358.5" y="230">way 1</text>
<text x="405.5" y="230">way 1</text>
<text x="452.5" y="230">way 2</text>
<text x="499.5" y="230">way 3</text>
<text x="546.5" y="230">way 0</text>
<text x="593.5" y="230">way 1</text>
<text x="640.5" y="230">way 1</text>
</g>
<g style="fill:var(--muted);font-size:11px">
<rect x="0" y="245" width="16" height="12" rx="2" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="22" y="255">filled on a miss</text>
<rect x="136" y="245" width="16" height="12" rx="2" style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2.5"/><text x="158" y="255">hit</text>
</g>
</svg></div>

<p><strong>Implementation.</strong> A log<sub>2</sub>(N)-bit pointer per set: 3 bits for 8 ways. A fill writes the line at the pointer and increments it modulo N. Hits never touch it, so the pointer is written only on misses, together with the tag, and needs no separate port. The cheapest variant shares one round-robin counter among all sets.</p>
<h4>Where FIFO Helps</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>Data with no reuse to exploit, where any policy does equally well</li><li>Hit-heavy traffic in highly associative structures, where skipping the per-hit update saves more power than a few extra misses cost</li></ul></td><td><ul><li><code>memcpy</code> and STREAM</li><li>519.lbm_r</li><li>Small embedded caches on Arm Cortex-R cores</li></ul></td></tr></table></div>
<h4>Where FIFO Hurts</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>Hot lines that stay in use for a long time: the hottest line is evicted every N fills regardless of how often it hits</li><li>Some traces where adding ways adds misses (Belady's anomaly)</li></ul></td><td><ul><li>AES with T-tables encrypting a large buffer: the streaming input evicts the tables every N fills</li><li>Interpreters with a hot dispatch table next to streaming data</li></ul></td></tr></table></div>

<h3 id="sec-random">Random</h3>
<p><strong>Motivation.</strong> It needs one LFSR for the whole cache, nothing per set, and nothing on a hit. It also has no pathological pattern: a loop slightly larger than the cache gets some hits instead of LRU's none. Hennessy and Patterson show its miss rate approaching LRU's as caches grow, since the victim matters less when there are many candidates. ARM's Cortex-A8 and Cortex-A9 L1 caches use pseudo-random replacement.</p>
<p><strong>How it works.</strong> On a miss in a full set, a pseudo-random generator (usually an LFSR) picks the way. Empty ways are filled first.</p>
<p><strong>Example.</strong> The same six-line loop that gave LRU zero hits, with the LFSR producing ways 2, 0, 3, 1, 2, 0, and 1 on the seven evictions. B happens to survive long enough to hit:</p>
<div class="tbl"><svg viewBox="0 0 680 246" role="img" aria-label="Random replacement on the cyclic sequence A B C D E F A B C D E F, with the LFSR choosing ways 2, 0, 3, 1, 2, 0, and 1 on the seven misses that need a victim. B survives long enough to hit at cycle 7. 1 of 12 hits, where LRU gets 0." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<text x="0" y="13" style="fill:var(--ink);font-size:13px;font-weight:600">Random: 1 of 12 hits</text>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle">
<text x="0" y="34" text-anchor="start">cycle</text>
<text x="123.5" y="34">0</text>
<text x="170.5" y="34">1</text>
<text x="217.5" y="34">2</text>
<text x="264.5" y="34">3</text>
<text x="311.5" y="34">4</text>
<text x="358.5" y="34">5</text>
<text x="405.5" y="34">6</text>
<text x="452.5" y="34">7</text>
<text x="499.5" y="34">8</text>
<text x="546.5" y="34">9</text>
<text x="593.5" y="34">10</text>
<text x="640.5" y="34">11</text>
</g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle">
<text x="0" y="51" text-anchor="start" style="font-weight:400;font-size:11px;fill:var(--muted)">access</text>
<text x="123.5" y="51">A</text>
<text x="170.5" y="51">B</text>
<text x="217.5" y="51">C</text>
<text x="264.5" y="51">D</text>
<text x="311.5" y="51">E</text>
<text x="358.5" y="51">F</text>
<text x="405.5" y="51">A</text>
<text x="452.5" y="51">B</text>
<text x="499.5" y="51">C</text>
<text x="546.5" y="51">D</text>
<text x="593.5" y="51">E</text>
<text x="640.5" y="51">F</text>
</g>
<text x="0" y="79" style="fill:var(--muted);font-size:11px">way 0</text>
<text x="0" y="109" style="fill:var(--muted);font-size:11px">way 1</text>
<text x="0" y="139" style="fill:var(--muted);font-size:11px">way 2</text>
<text x="0" y="169" style="fill:var(--muted);font-size:11px">way 3</text>
<g style="fill:none;stroke:var(--rule);stroke-width:1;stroke-dasharray:3 3"><rect x="102" y="92" width="43" height="26" rx="3"/><rect x="102" y="122" width="43" height="26" rx="3"/><rect x="149" y="122" width="43" height="26" rx="3"/><rect x="102" y="152" width="43" height="26" rx="3"/><rect x="149" y="152" width="43" height="26" rx="3"/><rect x="196" y="152" width="43" height="26" rx="3"/></g>
<g style="fill:var(--surface);stroke:var(--rule);stroke-width:1"><rect x="149" y="62" width="43" height="26" rx="3"/><rect x="196" y="62" width="43" height="26" rx="3"/><rect x="243" y="62" width="43" height="26" rx="3"/><rect x="290" y="62" width="43" height="26" rx="3"/><rect x="384" y="62" width="43" height="26" rx="3"/><rect x="431" y="62" width="43" height="26" rx="3"/><rect x="478" y="62" width="43" height="26" rx="3"/><rect x="525" y="62" width="43" height="26" rx="3"/><rect x="619" y="62" width="43" height="26" rx="3"/><rect x="196" y="92" width="43" height="26" rx="3"/><rect x="243" y="92" width="43" height="26" rx="3"/><rect x="290" y="92" width="43" height="26" rx="3"/><rect x="337" y="92" width="43" height="26" rx="3"/><rect x="384" y="92" width="43" height="26" rx="3"/><rect x="525" y="92" width="43" height="26" rx="3"/><rect x="572" y="92" width="43" height="26" rx="3"/><rect x="243" y="122" width="43" height="26" rx="3"/><rect x="337" y="122" width="43" height="26" rx="3"/><rect x="384" y="122" width="43" height="26" rx="3"/><rect x="431" y="122" width="43" height="26" rx="3"/><rect x="478" y="122" width="43" height="26" rx="3"/><rect x="572" y="122" width="43" height="26" rx="3"/><rect x="619" y="122" width="43" height="26" rx="3"/><rect x="290" y="152" width="43" height="26" rx="3"/><rect x="337" y="152" width="43" height="26" rx="3"/><rect x="431" y="152" width="43" height="26" rx="3"/><rect x="478" y="152" width="43" height="26" rx="3"/><rect x="525" y="152" width="43" height="26" rx="3"/><rect x="572" y="152" width="43" height="26" rx="3"/><rect x="619" y="152" width="43" height="26" rx="3"/></g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"><rect x="102" y="62" width="43" height="26" rx="3"/><rect x="337" y="62" width="43" height="26" rx="3"/><rect x="572" y="62" width="43" height="26" rx="3"/><rect x="149" y="92" width="43" height="26" rx="3"/><rect x="478" y="92" width="43" height="26" rx="3"/><rect x="619" y="92" width="43" height="26" rx="3"/><rect x="196" y="122" width="43" height="26" rx="3"/><rect x="290" y="122" width="43" height="26" rx="3"/><rect x="525" y="122" width="43" height="26" rx="3"/><rect x="243" y="152" width="43" height="26" rx="3"/><rect x="384" y="152" width="43" height="26" rx="3"/></g>
<g style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2.5"><rect x="431" y="92" width="43" height="26" rx="3"/></g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle"><text x="123.5" y="79">A</text><text x="170.5" y="79">A</text><text x="217.5" y="79">A</text><text x="264.5" y="79">A</text><text x="311.5" y="79">A</text><text x="358.5" y="79">F</text><text x="405.5" y="79">F</text><text x="452.5" y="79">F</text><text x="499.5" y="79">F</text><text x="546.5" y="79">F</text><text x="593.5" y="79">E</text><text x="640.5" y="79">E</text><text x="170.5" y="109">B</text><text x="217.5" y="109">B</text><text x="264.5" y="109">B</text><text x="311.5" y="109">B</text><text x="358.5" y="109">B</text><text x="405.5" y="109">B</text><text x="452.5" y="109">B</text><text x="499.5" y="109">C</text><text x="546.5" y="109">C</text><text x="593.5" y="109">C</text><text x="640.5" y="109">F</text><text x="217.5" y="139">C</text><text x="264.5" y="139">C</text><text x="311.5" y="139">E</text><text x="358.5" y="139">E</text><text x="405.5" y="139">E</text><text x="452.5" y="139">E</text><text x="499.5" y="139">E</text><text x="546.5" y="139">D</text><text x="593.5" y="139">D</text><text x="640.5" y="139">D</text><text x="264.5" y="169">D</text><text x="311.5" y="169">D</text><text x="358.5" y="169">D</text><text x="405.5" y="169">A</text><text x="452.5" y="169">A</text><text x="499.5" y="169">A</text><text x="546.5" y="169">A</text><text x="593.5" y="169">A</text><text x="640.5" y="169">A</text></g>
<g style="font-size:11px;font-weight:600" text-anchor="middle">
<text x="0" y="196" text-anchor="start" style="font-weight:400;fill:var(--muted)">result</text>
<text x="123.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="170.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="217.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="264.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="311.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="358.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="405.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="452.5" y="196" style="fill:var(--accent-green)">hit</text>
<text x="499.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="546.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="593.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="640.5" y="196" style="fill:var(--accent-red)">miss</text>
</g>
<g style="fill:var(--muted);font-size:11px" text-anchor="middle">
<text x="0" y="213" text-anchor="start">evicts</text>
<text x="311.5" y="213">C</text>
<text x="358.5" y="213">A</text>
<text x="405.5" y="213">D</text>
<text x="499.5" y="213">B</text>
<text x="546.5" y="213">E</text>
<text x="593.5" y="213">F</text>
<text x="640.5" y="213">C</text>
</g>
<g style="fill:var(--muted);font-size:11px">
<rect x="0" y="228" width="16" height="12" rx="2" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="22" y="238">filled on a miss</text>
<rect x="136" y="228" width="16" height="12" rx="2" style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2.5"/><text x="158" y="238">hit</text>
</g>
</svg></div>

<p><strong>Implementation.</strong> One linear-feedback shift register (LFSR) for the whole cache. A 16-bit maximal-length LFSR with the polynomial x<sup>16</sup> + x<sup>14</sup> + x<sup>13</sup> + x<sup>11</sup> + 1 steps through all 65,535 non-zero states. The low log<sub>2</sub>(N) bits name the victim, and each value of those bits appears almost equally often (for 3 bits, seven values 8,192 times per period and one 8,191 times). The register advances on every miss or every cycle. Invalid ways are filled first, chosen by a priority encoder over the valid bits. In a simulator, seed the generator so runs are reproducible.</p>
<h4>Where Random Helps</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>Cyclic loops a little larger than the cache, where it keeps some lines by chance</li><li>Reuse spread over many ways, where the choice of victim matters less</li></ul></td><td><ul><li>Iterative solvers and k-means over data just above the cache size</li><li>Phone and tablet code on Arm Cortex-A8 and Cortex-A9 L1 caches</li></ul></td></tr></table></div>
<h4>Where Random Hurts</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>Small hot sets in low-associativity caches, where it can evict the hottest line</li><li>Timing-sensitive code that needs the same hits and misses on every run</li></ul></td><td><ul><li>AES T-table lookups sharing a 4-way cache with streaming input</li><li>Timing-sensitive control loops on embedded cores</li></ul></td></tr></table></div>

<h3 id="sec-lfu">Least Frequently Used (LFU)</h3>
<p><strong>Motivation.</strong> Frequency separates a line used many times from one used once, which recency alone can't do. A single-use scan line can never displace a line with a high count. Pure LFU is rare in CPU caches, but it is common in software caches, and frequency-style reuse counters appear inside hardware policies such as SHiP.</p>
<p><strong>How it works.</strong> Each line has a saturating counter, set to 1 on a fill and incremented on every hit. The victim is the line with the lowest count, with ties broken toward the lowest way. Counts must also age, for example by halving every count periodically. Otherwise a line that was hot in an old phase keeps its high count and occupies the cache forever.</p>
<p><strong>Example.</strong> A reaches a count of 4 and is never in danger. New lines all start at 1, so they keep replacing one another in way 1. B is evicted at cycle 5 and misses at cycle 6, because to LFU a line used once is a line used once:</p>
<div class="tbl"><svg viewBox="0 0 680 246" role="img" aria-label="LFU on the sequence A B C D A E B F A C G A. A's use count climbs to 4, so it is never the victim. New lines start at count 1 and keep replacing each other in way 1. 4 of 12 hits." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<text x="0" y="13" style="fill:var(--ink);font-size:13px;font-weight:600">LFU: 4 of 12 hits</text>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle">
<text x="0" y="34" text-anchor="start">cycle</text>
<text x="123.5" y="34">0</text>
<text x="170.5" y="34">1</text>
<text x="217.5" y="34">2</text>
<text x="264.5" y="34">3</text>
<text x="311.5" y="34">4</text>
<text x="358.5" y="34">5</text>
<text x="405.5" y="34">6</text>
<text x="452.5" y="34">7</text>
<text x="499.5" y="34">8</text>
<text x="546.5" y="34">9</text>
<text x="593.5" y="34">10</text>
<text x="640.5" y="34">11</text>
</g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle">
<text x="0" y="51" text-anchor="start" style="font-weight:400;font-size:11px;fill:var(--muted)">access</text>
<text x="123.5" y="51">A</text>
<text x="170.5" y="51">B</text>
<text x="217.5" y="51">C</text>
<text x="264.5" y="51">D</text>
<text x="311.5" y="51">A</text>
<text x="358.5" y="51">E</text>
<text x="405.5" y="51">B</text>
<text x="452.5" y="51">F</text>
<text x="499.5" y="51">A</text>
<text x="546.5" y="51">C</text>
<text x="593.5" y="51">G</text>
<text x="640.5" y="51">A</text>
</g>
<text x="0" y="79" style="fill:var(--muted);font-size:11px">way 0</text>
<text x="0" y="109" style="fill:var(--muted);font-size:11px">way 1</text>
<text x="0" y="139" style="fill:var(--muted);font-size:11px">way 2</text>
<text x="0" y="169" style="fill:var(--muted);font-size:11px">way 3</text>
<g style="fill:none;stroke:var(--rule);stroke-width:1;stroke-dasharray:3 3"><rect x="102" y="92" width="43" height="26" rx="3"/><rect x="102" y="122" width="43" height="26" rx="3"/><rect x="149" y="122" width="43" height="26" rx="3"/><rect x="102" y="152" width="43" height="26" rx="3"/><rect x="149" y="152" width="43" height="26" rx="3"/><rect x="196" y="152" width="43" height="26" rx="3"/></g>
<g style="fill:var(--surface);stroke:var(--rule);stroke-width:1"><rect x="149" y="62" width="43" height="26" rx="3"/><rect x="196" y="62" width="43" height="26" rx="3"/><rect x="243" y="62" width="43" height="26" rx="3"/><rect x="337" y="62" width="43" height="26" rx="3"/><rect x="384" y="62" width="43" height="26" rx="3"/><rect x="431" y="62" width="43" height="26" rx="3"/><rect x="525" y="62" width="43" height="26" rx="3"/><rect x="572" y="62" width="43" height="26" rx="3"/><rect x="196" y="92" width="43" height="26" rx="3"/><rect x="243" y="92" width="43" height="26" rx="3"/><rect x="290" y="92" width="43" height="26" rx="3"/><rect x="478" y="92" width="43" height="26" rx="3"/><rect x="525" y="92" width="43" height="26" rx="3"/><rect x="619" y="92" width="43" height="26" rx="3"/><rect x="243" y="122" width="43" height="26" rx="3"/><rect x="290" y="122" width="43" height="26" rx="3"/><rect x="337" y="122" width="43" height="26" rx="3"/><rect x="384" y="122" width="43" height="26" rx="3"/><rect x="431" y="122" width="43" height="26" rx="3"/><rect x="478" y="122" width="43" height="26" rx="3"/><rect x="572" y="122" width="43" height="26" rx="3"/><rect x="619" y="122" width="43" height="26" rx="3"/><rect x="290" y="152" width="43" height="26" rx="3"/><rect x="337" y="152" width="43" height="26" rx="3"/><rect x="384" y="152" width="43" height="26" rx="3"/><rect x="431" y="152" width="43" height="26" rx="3"/><rect x="478" y="152" width="43" height="26" rx="3"/><rect x="525" y="152" width="43" height="26" rx="3"/><rect x="572" y="152" width="43" height="26" rx="3"/><rect x="619" y="152" width="43" height="26" rx="3"/></g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"><rect x="102" y="62" width="43" height="26" rx="3"/><rect x="149" y="92" width="43" height="26" rx="3"/><rect x="337" y="92" width="43" height="26" rx="3"/><rect x="384" y="92" width="43" height="26" rx="3"/><rect x="431" y="92" width="43" height="26" rx="3"/><rect x="572" y="92" width="43" height="26" rx="3"/><rect x="196" y="122" width="43" height="26" rx="3"/><rect x="243" y="152" width="43" height="26" rx="3"/></g>
<g style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2.5"><rect x="290" y="62" width="43" height="26" rx="3"/><rect x="478" y="62" width="43" height="26" rx="3"/><rect x="619" y="62" width="43" height="26" rx="3"/><rect x="525" y="122" width="43" height="26" rx="3"/></g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle"><text x="117.48" y="79">A</text><text x="164.48" y="79">A</text><text x="211.48" y="79">A</text><text x="258.48" y="79">A</text><text x="305.48" y="79">A</text><text x="352.48" y="79">A</text><text x="399.48" y="79">A</text><text x="446.48" y="79">A</text><text x="493.48" y="79">A</text><text x="540.48" y="79">A</text><text x="587.48" y="79">A</text><text x="634.48" y="79">A</text><text x="164.48" y="109">B</text><text x="211.48" y="109">B</text><text x="258.48" y="109">B</text><text x="305.48" y="109">B</text><text x="352.48" y="109">E</text><text x="399.48" y="109">B</text><text x="446.48" y="109">F</text><text x="493.48" y="109">F</text><text x="540.48" y="109">F</text><text x="587.48" y="109">G</text><text x="634.48" y="109">G</text><text x="211.48" y="139">C</text><text x="258.48" y="139">C</text><text x="305.48" y="139">C</text><text x="352.48" y="139">C</text><text x="399.48" y="139">C</text><text x="446.48" y="139">C</text><text x="493.48" y="139">C</text><text x="540.48" y="139">C</text><text x="587.48" y="139">C</text><text x="634.48" y="139">C</text><text x="258.48" y="169">D</text><text x="305.48" y="169">D</text><text x="352.48" y="169">D</text><text x="399.48" y="169">D</text><text x="446.48" y="169">D</text><text x="493.48" y="169">D</text><text x="540.48" y="169">D</text><text x="587.48" y="169">D</text><text x="634.48" y="169">D</text></g>
<g style="fill:var(--muted);font-size:10px;font-family:var(--mono)" text-anchor="end"><text x="141" y="80">1</text><text x="188" y="80">1</text><text x="235" y="80">1</text><text x="282" y="80">1</text><text x="329" y="80">2</text><text x="376" y="80">2</text><text x="423" y="80">2</text><text x="470" y="80">2</text><text x="517" y="80">3</text><text x="564" y="80">3</text><text x="611" y="80">3</text><text x="658" y="80">4</text><text x="188" y="110">1</text><text x="235" y="110">1</text><text x="282" y="110">1</text><text x="329" y="110">1</text><text x="376" y="110">1</text><text x="423" y="110">1</text><text x="470" y="110">1</text><text x="517" y="110">1</text><text x="564" y="110">1</text><text x="611" y="110">1</text><text x="658" y="110">1</text><text x="235" y="140">1</text><text x="282" y="140">1</text><text x="329" y="140">1</text><text x="376" y="140">1</text><text x="423" y="140">1</text><text x="470" y="140">1</text><text x="517" y="140">1</text><text x="564" y="140">2</text><text x="611" y="140">2</text><text x="658" y="140">2</text><text x="282" y="170">1</text><text x="329" y="170">1</text><text x="376" y="170">1</text><text x="423" y="170">1</text><text x="470" y="170">1</text><text x="517" y="170">1</text><text x="564" y="170">1</text><text x="611" y="170">1</text><text x="658" y="170">1</text></g>
<g style="font-size:11px;font-weight:600" text-anchor="middle">
<text x="0" y="196" text-anchor="start" style="font-weight:400;fill:var(--muted)">result</text>
<text x="123.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="170.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="217.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="264.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="311.5" y="196" style="fill:var(--accent-green)">hit</text>
<text x="358.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="405.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="452.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="499.5" y="196" style="fill:var(--accent-green)">hit</text>
<text x="546.5" y="196" style="fill:var(--accent-green)">hit</text>
<text x="593.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="640.5" y="196" style="fill:var(--accent-green)">hit</text>
</g>
<g style="fill:var(--muted);font-size:11px" text-anchor="middle">
<text x="0" y="213" text-anchor="start">evicts</text>
<text x="358.5" y="213">B</text>
<text x="405.5" y="213">E</text>
<text x="452.5" y="213">B</text>
<text x="593.5" y="213">F</text>
</g>
<g style="fill:var(--muted);font-size:11px">
<rect x="0" y="228" width="16" height="12" rx="2" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="22" y="238">filled on a miss</text>
<rect x="136" y="228" width="16" height="12" rx="2" style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2.5"/><text x="158" y="238">hit</text>
<text x="194" y="238">small number = use count</text>
</g>
</svg></div>

<p><strong>Implementation.</strong> A k-bit saturating counter per line, with k between 2 and 4: 24 bits per set for 8 ways at 3 bits. Finding the minimum takes a comparator tree of N − 1 comparators in log<sub>2</sub>(N) levels, with ties going to the lower way. For aging, when any counter in a set saturates, every counter in that set shifts right by one bit, halving the counts while keeping their order.</p>
<h4>Where LFU Helps</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>Skewed (Zipf-like) popularity, where a few lines get most of the accesses</li><li>Hot data that must survive long scans of single-use data</li></ul></td><td><ul><li>Redis and memcached under Zipfian key distributions (YCSB)</li><li>Embedding-table lookups in DLRM-style recommendation models</li><li>Software caches in CDNs and databases</li></ul></td></tr></table></div>
<h4>Where LFU Hurts</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>Phase changes: lines that were hot in an old phase keep high counts and stay too long</li><li>Newly hot data, which starts at 1 and needs time to outrank stale lines</li></ul></td><td><ul><li>502.gcc_r moving from one compiler pass to the next</li><li>Servers whose popular content shifts during the day</li></ul></td></tr></table></div>

<h3 id="sec-lip">LRU Insertion Policy (LIP)</h3>
<p><strong>Motivation.</strong> In last-level caches, many lines are never reused after they're filled. Under LRU each of them is inserted at MRU and must work its way down the whole stack, pushing out N other lines first. LIP (Qureshi, Jaleel, Patt, Steely, and Emer, ISCA 2007) makes a new line earn its place: it must hit before it gets any protection. It needs no state beyond LRU's.</p>
<p><strong>How it works.</strong> It is LRU with one change: a filled line is placed at the LRU end instead of the MRU end. A hit still moves a line to MRU. Lines that are never reused then replace one another in the LRU position, and the rest of the set is untouched.</p>
<p><strong>Example.</strong> The six-line loop again. E and F go in at the LRU end and evict each other in way 3, while A, B, and C stay and hit. LRU gets 0 of 12 on this sequence:</p>
<div class="tbl"><svg viewBox="0 0 680 263" role="img" aria-label="LRU insertion policy on the cyclic sequence A B C D E F A B C D E F. E and F are inserted at the LRU position and evict each other in way 3, so A, B, and C stay and hit at cycles 6, 7, and 8. 3 of 12 hits, where LRU gets 0." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<text x="0" y="13" style="fill:var(--ink);font-size:13px;font-weight:600">LIP: 3 of 12 hits</text>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle">
<text x="0" y="34" text-anchor="start">cycle</text>
<text x="123.5" y="34">0</text>
<text x="170.5" y="34">1</text>
<text x="217.5" y="34">2</text>
<text x="264.5" y="34">3</text>
<text x="311.5" y="34">4</text>
<text x="358.5" y="34">5</text>
<text x="405.5" y="34">6</text>
<text x="452.5" y="34">7</text>
<text x="499.5" y="34">8</text>
<text x="546.5" y="34">9</text>
<text x="593.5" y="34">10</text>
<text x="640.5" y="34">11</text>
</g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle">
<text x="0" y="51" text-anchor="start" style="font-weight:400;font-size:11px;fill:var(--muted)">access</text>
<text x="123.5" y="51">A</text>
<text x="170.5" y="51">B</text>
<text x="217.5" y="51">C</text>
<text x="264.5" y="51">D</text>
<text x="311.5" y="51">E</text>
<text x="358.5" y="51">F</text>
<text x="405.5" y="51">A</text>
<text x="452.5" y="51">B</text>
<text x="499.5" y="51">C</text>
<text x="546.5" y="51">D</text>
<text x="593.5" y="51">E</text>
<text x="640.5" y="51">F</text>
</g>
<text x="0" y="79" style="fill:var(--muted);font-size:11px">way 0</text>
<text x="0" y="109" style="fill:var(--muted);font-size:11px">way 1</text>
<text x="0" y="139" style="fill:var(--muted);font-size:11px">way 2</text>
<text x="0" y="169" style="fill:var(--muted);font-size:11px">way 3</text>
<g style="fill:none;stroke:var(--rule);stroke-width:1;stroke-dasharray:3 3"><rect x="102" y="92" width="43" height="26" rx="3"/><rect x="102" y="122" width="43" height="26" rx="3"/><rect x="149" y="122" width="43" height="26" rx="3"/><rect x="102" y="152" width="43" height="26" rx="3"/><rect x="149" y="152" width="43" height="26" rx="3"/><rect x="196" y="152" width="43" height="26" rx="3"/></g>
<g style="fill:var(--surface);stroke:var(--rule);stroke-width:1"><rect x="149" y="62" width="43" height="26" rx="3"/><rect x="196" y="62" width="43" height="26" rx="3"/><rect x="243" y="62" width="43" height="26" rx="3"/><rect x="290" y="62" width="43" height="26" rx="3"/><rect x="337" y="62" width="43" height="26" rx="3"/><rect x="431" y="62" width="43" height="26" rx="3"/><rect x="478" y="62" width="43" height="26" rx="3"/><rect x="525" y="62" width="43" height="26" rx="3"/><rect x="572" y="62" width="43" height="26" rx="3"/><rect x="619" y="62" width="43" height="26" rx="3"/><rect x="196" y="92" width="43" height="26" rx="3"/><rect x="243" y="92" width="43" height="26" rx="3"/><rect x="290" y="92" width="43" height="26" rx="3"/><rect x="337" y="92" width="43" height="26" rx="3"/><rect x="384" y="92" width="43" height="26" rx="3"/><rect x="478" y="92" width="43" height="26" rx="3"/><rect x="525" y="92" width="43" height="26" rx="3"/><rect x="572" y="92" width="43" height="26" rx="3"/><rect x="619" y="92" width="43" height="26" rx="3"/><rect x="243" y="122" width="43" height="26" rx="3"/><rect x="290" y="122" width="43" height="26" rx="3"/><rect x="337" y="122" width="43" height="26" rx="3"/><rect x="384" y="122" width="43" height="26" rx="3"/><rect x="431" y="122" width="43" height="26" rx="3"/><rect x="525" y="122" width="43" height="26" rx="3"/><rect x="572" y="122" width="43" height="26" rx="3"/><rect x="619" y="122" width="43" height="26" rx="3"/><rect x="384" y="152" width="43" height="26" rx="3"/><rect x="431" y="152" width="43" height="26" rx="3"/><rect x="478" y="152" width="43" height="26" rx="3"/></g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"><rect x="102" y="62" width="43" height="26" rx="3"/><rect x="149" y="92" width="43" height="26" rx="3"/><rect x="196" y="122" width="43" height="26" rx="3"/><rect x="243" y="152" width="43" height="26" rx="3"/><rect x="290" y="152" width="43" height="26" rx="3"/><rect x="337" y="152" width="43" height="26" rx="3"/><rect x="525" y="152" width="43" height="26" rx="3"/><rect x="572" y="152" width="43" height="26" rx="3"/><rect x="619" y="152" width="43" height="26" rx="3"/></g>
<g style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2.5"><rect x="384" y="62" width="43" height="26" rx="3"/><rect x="431" y="92" width="43" height="26" rx="3"/><rect x="478" y="122" width="43" height="26" rx="3"/></g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle"><text x="123.5" y="79">A</text><text x="170.5" y="79">A</text><text x="217.5" y="79">A</text><text x="264.5" y="79">A</text><text x="311.5" y="79">A</text><text x="358.5" y="79">A</text><text x="405.5" y="79">A</text><text x="452.5" y="79">A</text><text x="499.5" y="79">A</text><text x="546.5" y="79">A</text><text x="593.5" y="79">A</text><text x="640.5" y="79">A</text><text x="170.5" y="109">B</text><text x="217.5" y="109">B</text><text x="264.5" y="109">B</text><text x="311.5" y="109">B</text><text x="358.5" y="109">B</text><text x="405.5" y="109">B</text><text x="452.5" y="109">B</text><text x="499.5" y="109">B</text><text x="546.5" y="109">B</text><text x="593.5" y="109">B</text><text x="640.5" y="109">B</text><text x="217.5" y="139">C</text><text x="264.5" y="139">C</text><text x="311.5" y="139">C</text><text x="358.5" y="139">C</text><text x="405.5" y="139">C</text><text x="452.5" y="139">C</text><text x="499.5" y="139">C</text><text x="546.5" y="139">C</text><text x="593.5" y="139">C</text><text x="640.5" y="139">C</text><text x="264.5" y="169">D</text><text x="311.5" y="169">E</text><text x="358.5" y="169">F</text><text x="405.5" y="169">F</text><text x="452.5" y="169">F</text><text x="499.5" y="169">F</text><text x="546.5" y="169">D</text><text x="593.5" y="169">E</text><text x="640.5" y="169">F</text></g>
<g style="font-size:11px;font-weight:600" text-anchor="middle">
<text x="0" y="196" text-anchor="start" style="font-weight:400;fill:var(--muted)">result</text>
<text x="123.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="170.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="217.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="264.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="311.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="358.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="405.5" y="196" style="fill:var(--accent-green)">hit</text>
<text x="452.5" y="196" style="fill:var(--accent-green)">hit</text>
<text x="499.5" y="196" style="fill:var(--accent-green)">hit</text>
<text x="546.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="593.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="640.5" y="196" style="fill:var(--accent-red)">miss</text>
</g>
<g style="fill:var(--muted);font-size:11px" text-anchor="middle">
<text x="0" y="213" text-anchor="start">evicts</text>
<text x="311.5" y="213">D</text>
<text x="358.5" y="213">E</text>
<text x="546.5" y="213">F</text>
<text x="593.5" y="213">D</text>
<text x="640.5" y="213">E</text>
</g>
<g style="fill:var(--ink);font-size:10px;font-family:var(--mono)" text-anchor="middle">
<text x="0" y="230" text-anchor="start" style="font-family:var(--sans);font-size:11px;fill:var(--muted)">MRU → LRU</text>
<text x="123.5" y="230">A</text>
<text x="170.5" y="230">AB</text>
<text x="217.5" y="230">ABC</text>
<text x="264.5" y="230">ABCD</text>
<text x="311.5" y="230">ABCE</text>
<text x="358.5" y="230">ABCF</text>
<text x="405.5" y="230">ABCF</text>
<text x="452.5" y="230">BACF</text>
<text x="499.5" y="230">CBAF</text>
<text x="546.5" y="230">CBAD</text>
<text x="593.5" y="230">CBAE</text>
<text x="640.5" y="230">CBAF</text>
</g>
<g style="fill:var(--muted);font-size:11px">
<rect x="0" y="245" width="16" height="12" rx="2" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="22" y="255">filled on a miss</text>
<rect x="136" y="245" width="16" height="12" rx="2" style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2.5"/><text x="158" y="255">hit</text>
</g>
</svg></div>

<p><strong>Implementation.</strong> No state beyond LRU's, only a different fill rule. With the matrix, a fill of way i clears row i and sets column i, making i older than everything, instead of the reverse. A tree-PLRU version leaves the path bits pointing at the newly filled way, so it is the next victim unless it hits first.</p>
<h4>Where LIP Helps</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>Cyclic loops larger than the cache: one way churns and the rest keep part of the loop</li><li>Streams of single-use lines next to reused data</li></ul></td><td><ul><li>Iterative solvers and PageRank over data 1 to 2 times the LLC</li><li>429.mcf (SPEC CPU2006) at the LLC</li></ul></td></tr></table></div>
<h4>Where LIP Hurts</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>Phase changes: old lines keep their MRU positions and never age out</li><li>Recency-friendly code whose new lines are reused only after a few other misses to their set</li></ul></td><td><ul><li>Multi-phase programs such as 502.gcc_r moving between passes</li><li>Network stacks that reuse packet buffers shortly after writing them</li></ul></td></tr></table></div>

<h3 id="sec-bip">Bimodal Insertion Policy (BIP)</h3>
<p><strong>Motivation.</strong> LIP never ages its lines. When a program moves to a new working set, the old lines keep their MRU positions and the new lines fight over the single LRU slot, even if the new working set would fit. BIP adds a small chance of a normal MRU insertion, so the cache slowly turns over to the new working set while still resisting thrashing.</p>
<p><strong>How it works.</strong> On a fill, insert at MRU with a small probability ε (1/32 in the paper, from a counter or an LFSR), otherwise at the LRU end. Hits move the line to MRU as in LRU.</p>
<p><strong>Example.</strong> The set starts full of W, X, Y, and Z, which the program no longer uses. It now loops over A, B, and C, which would fit in three ways. Under LIP every new line lands in way 0 at the LRU end and is evicted by the next one, so the loop never hits. Under BIP, the coin picks MRU for B at cycle 1. That pushes stale X down to the LRU end, where the next miss evicts it, and B then hits on every trip around the loop. Later lucky insertions bring in A and C the same way:</p>
<div class="tbl"><svg viewBox="0 0 680 514" role="img" aria-label="A phase change. The set starts full of W, X, Y, and Z, which are no longer used, and the program now loops over A, B, and C, which would fit. Under LIP every new line goes into the LRU slot, way 0, and is evicted by the next new line, so the loop never hits. Under BIP, B is inserted at MRU on cycle 1 and hits at cycles 4 and 7. 0 of 9 hits for LIP, 2 of 9 for BIP." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<text x="0" y="13" style="fill:var(--ink);font-size:13px;font-weight:600">LIP: 0 of 9 hits</text>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle">
<text x="0" y="34" text-anchor="start">cycle</text>
<text x="124" y="34">start</text>
<text x="172" y="34">0</text>
<text x="220" y="34">1</text>
<text x="268" y="34">2</text>
<text x="316" y="34">3</text>
<text x="364" y="34">4</text>
<text x="412" y="34">5</text>
<text x="460" y="34">6</text>
<text x="508" y="34">7</text>
<text x="556" y="34">8</text>
</g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle">
<text x="0" y="51" text-anchor="start" style="font-weight:400;font-size:11px;fill:var(--muted)">access</text>
<text x="172" y="51">A</text>
<text x="220" y="51">B</text>
<text x="268" y="51">C</text>
<text x="316" y="51">A</text>
<text x="364" y="51">B</text>
<text x="412" y="51">C</text>
<text x="460" y="51">A</text>
<text x="508" y="51">B</text>
<text x="556" y="51">C</text>
</g>
<text x="0" y="79" style="fill:var(--muted);font-size:11px">way 0</text>
<text x="0" y="109" style="fill:var(--muted);font-size:11px">way 1</text>
<text x="0" y="139" style="fill:var(--muted);font-size:11px">way 2</text>
<text x="0" y="169" style="fill:var(--muted);font-size:11px">way 3</text>
<g style="fill:var(--surface);stroke:var(--rule);stroke-width:1"><rect x="102" y="62" width="44" height="26" rx="3"/><rect x="102" y="92" width="44" height="26" rx="3"/><rect x="150" y="92" width="44" height="26" rx="3"/><rect x="198" y="92" width="44" height="26" rx="3"/><rect x="246" y="92" width="44" height="26" rx="3"/><rect x="294" y="92" width="44" height="26" rx="3"/><rect x="342" y="92" width="44" height="26" rx="3"/><rect x="390" y="92" width="44" height="26" rx="3"/><rect x="438" y="92" width="44" height="26" rx="3"/><rect x="486" y="92" width="44" height="26" rx="3"/><rect x="534" y="92" width="44" height="26" rx="3"/><rect x="102" y="122" width="44" height="26" rx="3"/><rect x="150" y="122" width="44" height="26" rx="3"/><rect x="198" y="122" width="44" height="26" rx="3"/><rect x="246" y="122" width="44" height="26" rx="3"/><rect x="294" y="122" width="44" height="26" rx="3"/><rect x="342" y="122" width="44" height="26" rx="3"/><rect x="390" y="122" width="44" height="26" rx="3"/><rect x="438" y="122" width="44" height="26" rx="3"/><rect x="486" y="122" width="44" height="26" rx="3"/><rect x="534" y="122" width="44" height="26" rx="3"/><rect x="102" y="152" width="44" height="26" rx="3"/><rect x="150" y="152" width="44" height="26" rx="3"/><rect x="198" y="152" width="44" height="26" rx="3"/><rect x="246" y="152" width="44" height="26" rx="3"/><rect x="294" y="152" width="44" height="26" rx="3"/><rect x="342" y="152" width="44" height="26" rx="3"/><rect x="390" y="152" width="44" height="26" rx="3"/><rect x="438" y="152" width="44" height="26" rx="3"/><rect x="486" y="152" width="44" height="26" rx="3"/><rect x="534" y="152" width="44" height="26" rx="3"/></g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"><rect x="150" y="62" width="44" height="26" rx="3"/><rect x="198" y="62" width="44" height="26" rx="3"/><rect x="246" y="62" width="44" height="26" rx="3"/><rect x="294" y="62" width="44" height="26" rx="3"/><rect x="342" y="62" width="44" height="26" rx="3"/><rect x="390" y="62" width="44" height="26" rx="3"/><rect x="438" y="62" width="44" height="26" rx="3"/><rect x="486" y="62" width="44" height="26" rx="3"/><rect x="534" y="62" width="44" height="26" rx="3"/></g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle"><text x="124" y="79">W</text><text x="172" y="79">A</text><text x="220" y="79">B</text><text x="268" y="79">C</text><text x="316" y="79">A</text><text x="364" y="79">B</text><text x="412" y="79">C</text><text x="460" y="79">A</text><text x="508" y="79">B</text><text x="556" y="79">C</text><text x="124" y="109">X</text><text x="172" y="109">X</text><text x="220" y="109">X</text><text x="268" y="109">X</text><text x="316" y="109">X</text><text x="364" y="109">X</text><text x="412" y="109">X</text><text x="460" y="109">X</text><text x="508" y="109">X</text><text x="556" y="109">X</text><text x="124" y="139">Y</text><text x="172" y="139">Y</text><text x="220" y="139">Y</text><text x="268" y="139">Y</text><text x="316" y="139">Y</text><text x="364" y="139">Y</text><text x="412" y="139">Y</text><text x="460" y="139">Y</text><text x="508" y="139">Y</text><text x="556" y="139">Y</text><text x="124" y="169">Z</text><text x="172" y="169">Z</text><text x="220" y="169">Z</text><text x="268" y="169">Z</text><text x="316" y="169">Z</text><text x="364" y="169">Z</text><text x="412" y="169">Z</text><text x="460" y="169">Z</text><text x="508" y="169">Z</text><text x="556" y="169">Z</text></g>
<g style="font-size:11px;font-weight:600" text-anchor="middle">
<text x="0" y="196" text-anchor="start" style="font-weight:400;fill:var(--muted)">result</text>
<text x="172" y="196" style="fill:var(--accent-red)">miss</text>
<text x="220" y="196" style="fill:var(--accent-red)">miss</text>
<text x="268" y="196" style="fill:var(--accent-red)">miss</text>
<text x="316" y="196" style="fill:var(--accent-red)">miss</text>
<text x="364" y="196" style="fill:var(--accent-red)">miss</text>
<text x="412" y="196" style="fill:var(--accent-red)">miss</text>
<text x="460" y="196" style="fill:var(--accent-red)">miss</text>
<text x="508" y="196" style="fill:var(--accent-red)">miss</text>
<text x="556" y="196" style="fill:var(--accent-red)">miss</text>
</g>
<g style="fill:var(--muted);font-size:11px" text-anchor="middle">
<text x="0" y="213" text-anchor="start">evicts</text>
<text x="172" y="213">W</text>
<text x="220" y="213">A</text>
<text x="268" y="213">B</text>
<text x="316" y="213">C</text>
<text x="364" y="213">A</text>
<text x="412" y="213">B</text>
<text x="460" y="213">C</text>
<text x="508" y="213">A</text>
<text x="556" y="213">B</text>
</g>
<g style="fill:var(--ink);font-size:10px;font-family:var(--mono)" text-anchor="middle">
<text x="0" y="230" text-anchor="start" style="font-family:var(--sans);font-size:11px;fill:var(--muted)">MRU → LRU</text>
<text x="124" y="230">ZYXW</text>
<text x="172" y="230">ZYXA</text>
<text x="220" y="230">ZYXB</text>
<text x="268" y="230">ZYXC</text>
<text x="316" y="230">ZYXA</text>
<text x="364" y="230">ZYXB</text>
<text x="412" y="230">ZYXC</text>
<text x="460" y="230">ZYXA</text>
<text x="508" y="230">ZYXB</text>
<text x="556" y="230">ZYXC</text>
</g>
<text x="0" y="264" style="fill:var(--ink);font-size:13px;font-weight:600">BIP, with the 1-in-32 MRU insertion landing on cycle 1: 2 of 9 hits</text>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle">
<text x="0" y="285" text-anchor="start">cycle</text>
<text x="124" y="285">start</text>
<text x="172" y="285">0</text>
<text x="220" y="285">1</text>
<text x="268" y="285">2</text>
<text x="316" y="285">3</text>
<text x="364" y="285">4</text>
<text x="412" y="285">5</text>
<text x="460" y="285">6</text>
<text x="508" y="285">7</text>
<text x="556" y="285">8</text>
</g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle">
<text x="0" y="302" text-anchor="start" style="font-weight:400;font-size:11px;fill:var(--muted)">access</text>
<text x="172" y="302">A</text>
<text x="220" y="302">B</text>
<text x="268" y="302">C</text>
<text x="316" y="302">A</text>
<text x="364" y="302">B</text>
<text x="412" y="302">C</text>
<text x="460" y="302">A</text>
<text x="508" y="302">B</text>
<text x="556" y="302">C</text>
</g>
<text x="0" y="330" style="fill:var(--muted);font-size:11px">way 0</text>
<text x="0" y="360" style="fill:var(--muted);font-size:11px">way 1</text>
<text x="0" y="390" style="fill:var(--muted);font-size:11px">way 2</text>
<text x="0" y="420" style="fill:var(--muted);font-size:11px">way 3</text>
<g style="fill:var(--surface);stroke:var(--rule);stroke-width:1"><rect x="102" y="313" width="44" height="26" rx="3"/><rect x="246" y="313" width="44" height="26" rx="3"/><rect x="294" y="313" width="44" height="26" rx="3"/><rect x="390" y="313" width="44" height="26" rx="3"/><rect x="438" y="313" width="44" height="26" rx="3"/><rect x="534" y="313" width="44" height="26" rx="3"/><rect x="102" y="343" width="44" height="26" rx="3"/><rect x="150" y="343" width="44" height="26" rx="3"/><rect x="198" y="343" width="44" height="26" rx="3"/><rect x="342" y="343" width="44" height="26" rx="3"/><rect x="486" y="343" width="44" height="26" rx="3"/><rect x="102" y="373" width="44" height="26" rx="3"/><rect x="150" y="373" width="44" height="26" rx="3"/><rect x="198" y="373" width="44" height="26" rx="3"/><rect x="246" y="373" width="44" height="26" rx="3"/><rect x="294" y="373" width="44" height="26" rx="3"/><rect x="342" y="373" width="44" height="26" rx="3"/><rect x="390" y="373" width="44" height="26" rx="3"/><rect x="438" y="373" width="44" height="26" rx="3"/><rect x="486" y="373" width="44" height="26" rx="3"/><rect x="534" y="373" width="44" height="26" rx="3"/><rect x="102" y="403" width="44" height="26" rx="3"/><rect x="150" y="403" width="44" height="26" rx="3"/><rect x="198" y="403" width="44" height="26" rx="3"/><rect x="246" y="403" width="44" height="26" rx="3"/><rect x="294" y="403" width="44" height="26" rx="3"/><rect x="342" y="403" width="44" height="26" rx="3"/><rect x="390" y="403" width="44" height="26" rx="3"/><rect x="438" y="403" width="44" height="26" rx="3"/><rect x="486" y="403" width="44" height="26" rx="3"/><rect x="534" y="403" width="44" height="26" rx="3"/></g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"><rect x="150" y="313" width="44" height="26" rx="3"/><rect x="198" y="313" width="44" height="26" rx="3"/><rect x="246" y="343" width="44" height="26" rx="3"/><rect x="294" y="343" width="44" height="26" rx="3"/><rect x="390" y="343" width="44" height="26" rx="3"/><rect x="438" y="343" width="44" height="26" rx="3"/><rect x="534" y="343" width="44" height="26" rx="3"/></g>
<g style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2.5"><rect x="342" y="313" width="44" height="26" rx="3"/><rect x="486" y="313" width="44" height="26" rx="3"/></g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle"><text x="124" y="330">W</text><text x="172" y="330">A</text><text x="220" y="330">B</text><text x="268" y="330">B</text><text x="316" y="330">B</text><text x="364" y="330">B</text><text x="412" y="330">B</text><text x="460" y="330">B</text><text x="508" y="330">B</text><text x="556" y="330">B</text><text x="124" y="360">X</text><text x="172" y="360">X</text><text x="220" y="360">X</text><text x="268" y="360">C</text><text x="316" y="360">A</text><text x="364" y="360">A</text><text x="412" y="360">C</text><text x="460" y="360">A</text><text x="508" y="360">A</text><text x="556" y="360">C</text><text x="124" y="390">Y</text><text x="172" y="390">Y</text><text x="220" y="390">Y</text><text x="268" y="390">Y</text><text x="316" y="390">Y</text><text x="364" y="390">Y</text><text x="412" y="390">Y</text><text x="460" y="390">Y</text><text x="508" y="390">Y</text><text x="556" y="390">Y</text><text x="124" y="420">Z</text><text x="172" y="420">Z</text><text x="220" y="420">Z</text><text x="268" y="420">Z</text><text x="316" y="420">Z</text><text x="364" y="420">Z</text><text x="412" y="420">Z</text><text x="460" y="420">Z</text><text x="508" y="420">Z</text><text x="556" y="420">Z</text></g>
<g style="font-size:11px;font-weight:600" text-anchor="middle">
<text x="0" y="447" text-anchor="start" style="font-weight:400;fill:var(--muted)">result</text>
<text x="172" y="447" style="fill:var(--accent-red)">miss</text>
<text x="220" y="447" style="fill:var(--accent-red)">miss</text>
<text x="268" y="447" style="fill:var(--accent-red)">miss</text>
<text x="316" y="447" style="fill:var(--accent-red)">miss</text>
<text x="364" y="447" style="fill:var(--accent-green)">hit</text>
<text x="412" y="447" style="fill:var(--accent-red)">miss</text>
<text x="460" y="447" style="fill:var(--accent-red)">miss</text>
<text x="508" y="447" style="fill:var(--accent-green)">hit</text>
<text x="556" y="447" style="fill:var(--accent-red)">miss</text>
</g>
<g style="fill:var(--muted);font-size:11px" text-anchor="middle">
<text x="0" y="464" text-anchor="start">evicts</text>
<text x="172" y="464">W</text>
<text x="220" y="464">A</text>
<text x="268" y="464">X</text>
<text x="316" y="464">C</text>
<text x="412" y="464">A</text>
<text x="460" y="464">C</text>
<text x="556" y="464">A</text>
</g>
<g style="fill:var(--ink);font-size:10px;font-family:var(--mono)" text-anchor="middle">
<text x="0" y="481" text-anchor="start" style="font-family:var(--sans);font-size:11px;fill:var(--muted)">MRU → LRU</text>
<text x="124" y="481">ZYXW</text>
<text x="172" y="481">ZYXA</text>
<text x="220" y="481">BZYX</text>
<text x="268" y="481">BZYC</text>
<text x="316" y="481">BZYA</text>
<text x="364" y="481">BZYA</text>
<text x="412" y="481">BZYC</text>
<text x="460" y="481">BZYA</text>
<text x="508" y="481">BZYA</text>
<text x="556" y="481">BZYC</text>
</g>
<g style="fill:var(--muted);font-size:11px">
<rect x="0" y="496" width="16" height="12" rx="2" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="22" y="506">filled on a miss</text>
<rect x="136" y="496" width="16" height="12" rx="2" style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2.5"/><text x="158" y="506">hit</text>
</g>
</svg></div>

<p><strong>Implementation.</strong> LIP plus a source for the 1-in-32 choice: a free-running 5-bit counter that selects MRU insertion when it wraps to 0, or 5 bits of an LFSR compared with 0. That is 5 bits for the whole cache.</p>
<h4>Where BIP Helps</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>Cyclic loops larger than the cache</li><li>Programs that move between thrashing working sets, where the 1-in-32 MRU insertions let a new working set in</li></ul></td><td><ul><li>Iterative solvers whose dataset changes between solves</li><li>429.mcf (SPEC CPU2006)</li></ul></td></tr></table></div>
<h4>Where BIP Hurts</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>LRU-friendly code: new lines start unprotected, so some that LRU would have kept are evicted before their reuse</li><li>Small working sets that fit, where it only adds risk</li></ul></td><td><ul><li>Request-driven servers whose per-request data is reused within the request</li><li>548.exchange2_r-style hot loops in a cache under pressure from other cores</li></ul></td></tr></table></div>

<h3 id="sec-dip">Dynamic Insertion Policy (DIP)</h3>
<p><strong>Motivation.</strong> BIP loses to LRU when the working set fits, because new lines that would have been reused start out unprotected. Neither policy wins on every program, or even across the phases of one program. DIP picks between them at run time, and set dueling lets it do that with one counter instead of a second set of tags per policy.</p>
<p><strong>How it works.</strong> A few sets are leaders that always use LRU, a few always use BIP, and the rest are followers. The paper uses 32 leaders per policy and a 10-bit saturating counter, PSEL:</p>
<ul>
<li>A miss in an LRU leader increments PSEL.</li>
<li>A miss in a BIP leader decrements PSEL.</li>
<li>When a follower set fills a line, it uses BIP if PSEL's most significant bit is 1 (the LRU leaders have been missing more), and LRU otherwise.</li>
</ul>
<p>The leaders are picked by a fixed function of the set index bits, so finding them costs a little logic and no storage.</p>
<div class="tbl"><svg viewBox="0 0 680 282" role="img" aria-label="Set dueling in DIP. A 2 MB, 16-way LLC with 64-byte lines has 2048 sets. 32 sets always use LRU and 32 always use BIP, and the other 1984 are followers. A miss in an LRU leader increments a 10-bit PSEL counter and a miss in a BIP leader decrements it. Follower sets insert with BIP when the counter's most significant bit is 1, meaning the LRU leaders have been missing more, and with LRU otherwise." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<text x="0" y="16" style="fill:var(--ink);font-size:13px;font-weight:600">A 2 MB, 16-way LLC with 64 B lines: 2048 sets, drawn as 32</text>
<rect x="68" y="30" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="83" y="45" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:400"></text>
<rect x="102" y="30" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2"/><text x="117" y="45" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">L</text>
<rect x="136" y="30" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="151" y="45" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:400"></text>
<rect x="170" y="30" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="185" y="45" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:400"></text>
<rect x="204" y="30" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="219" y="45" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:400"></text>
<rect x="238" y="30" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="253" y="45" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:400"></text>
<rect x="272" y="30" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="287" y="45" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:400"></text>
<rect x="306" y="30" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="321" y="45" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:400"></text>
<rect x="340" y="30" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="355" y="45" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:400"></text>
<rect x="374" y="30" width="30" height="22" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="389" y="45" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">B</text>
<rect x="408" y="30" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="423" y="45" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:400"></text>
<rect x="442" y="30" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="457" y="45" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:400"></text>
<rect x="476" y="30" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="491" y="45" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:400"></text>
<rect x="510" y="30" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="525" y="45" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:400"></text>
<rect x="544" y="30" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="559" y="45" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:400"></text>
<rect x="578" y="30" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="593" y="45" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:400"></text>
<rect x="68" y="58" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="83" y="73" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:400"></text>
<rect x="102" y="58" width="30" height="22" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="117" y="73" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">B</text>
<rect x="136" y="58" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="151" y="73" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:400"></text>
<rect x="170" y="58" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="185" y="73" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:400"></text>
<rect x="204" y="58" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="219" y="73" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:400"></text>
<rect x="238" y="58" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="253" y="73" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:400"></text>
<rect x="272" y="58" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="287" y="73" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:400"></text>
<rect x="306" y="58" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="321" y="73" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:400"></text>
<rect x="340" y="58" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="355" y="73" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:400"></text>
<rect x="374" y="58" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2"/><text x="389" y="73" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">L</text>
<rect x="408" y="58" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="423" y="73" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:400"></text>
<rect x="442" y="58" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="457" y="73" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:400"></text>
<rect x="476" y="58" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="491" y="73" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:400"></text>
<rect x="510" y="58" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="525" y="73" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:400"></text>
<rect x="544" y="58" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="559" y="73" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:400"></text>
<rect x="578" y="58" width="30" height="22" rx="3" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="593" y="73" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:400"></text>
<g style="fill:var(--muted);font-size:11px"><text x="0" y="45">sets</text></g>
<g style="font-size:11px"><rect x="68" y="96" width="16" height="12" rx="2" style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2"/><text x="90" y="106" style="fill:var(--muted)">L: 32 LRU leaders</text>
<rect x="230" y="96" width="16" height="12" rx="2" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="252" y="106" style="fill:var(--muted)">B: 32 BIP leaders</text>
<rect x="392" y="96" width="16" height="12" rx="2" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/><text x="414" y="106" style="fill:var(--muted)">1984 followers</text></g>
<rect x="250" y="148" width="180" height="44" rx="4" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.5"/>
<text x="340" y="166" text-anchor="middle" style="fill:var(--ink);font-size:12px;font-weight:600">PSEL: 10-bit counter</text><text x="340" y="182" text-anchor="middle" style="fill:var(--muted);font-size:11px">0 to 1023, MSB = bit 9</text>
<defs><marker id="arrDuel" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker></defs>
<g style="fill:none;stroke:var(--muted);stroke-width:1.5"><path d="M118,116 V170 H246" marker-end="url(#arrDuel)"/><path d="M562,116 V170 H434" marker-end="url(#arrDuel)"/><path d="M340,192 V226" marker-end="url(#arrDuel)"/></g>
<text x="0" y="140" style="fill:var(--ink);font-size:11px">LRU leader miss:</text><text x="0" y="155" style="fill:var(--ink);font-size:11px">PSEL + 1</text>
<text x="680" y="140" text-anchor="end" style="fill:var(--ink);font-size:11px">BIP leader miss:</text><text x="680" y="155" text-anchor="end" style="fill:var(--ink);font-size:11px">PSEL − 1</text>
<rect x="170" y="230" width="340" height="44" rx="4" style="fill:var(--surface);stroke:var(--muted);stroke-width:1.5"/>
<text x="340" y="248" text-anchor="middle" style="fill:var(--ink);font-size:12px;font-weight:600">followers read the MSB on each fill</text><text x="340" y="264" text-anchor="middle" style="fill:var(--muted);font-size:11px">MSB 1 (LRU leaders miss more): insert with BIP, MSB 0: LRU</text>
</svg></div>
<p><strong>Example.</strong> PSEL starts at 512. Over a stretch of a streaming phase, the LRU leaders miss 2,400 times and the BIP leaders 1,900 times. PSEL climbs by the net 500 to 1012, below the 1023 ceiling, so its MSB is 1 and all 1984 followers insert with BIP. When the program returns to a loop that fits, the BIP leaders start missing more, PSEL falls back below 512, and the followers switch to LRU.</p>

<p><strong>Implementation.</strong> Choosing leaders takes a few gates. The paper's "complement-select" scheme compares two fields of the set index. For 2048 sets (index bits 10 to 0):</p>
<ul>
<li><strong>LRU leader:</strong> index[10:6] = index[4:0] and index[5] = 0.</li>
<li><strong>BIP leader:</strong> index[10:6] = NOT index[4:0] and index[5] = 0.</li>
</ul>
<p>Each rule matches exactly one set in each group of 64 consecutive sets, 32 sets in all, and no set matches both. PSEL is one 10-bit saturating up/down counter for the cache. In a shared LLC, thread-aware DIP (TADIP) keeps one PSEL per thread, so one thrashing program doesn't switch every core's followers to BIP.</p>
<h4>Where DIP Helps</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>Programs that alternate between LRU-friendly and thrashing phases</li><li>Code whose best policy isn't known at design time</li></ul></td><td><ul><li>art and mcf from SPEC CPU2000, the DIP paper's largest gains</li><li>Iterative solvers that alternate between a fitting setup phase and an oversized sweep</li></ul></td></tr></table></div>
<h4>Where DIP Hurts</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>Programs with opposite behavior interleaved in a shared LLC, where a single PSEL lets one program set everyone's policy</li><li>Programs whose sets behave differently, so the leader sets misrepresent the followers</li></ul></td><td><ul><li>519.lbm_r sharing an LLC with 520.omnetpp_r under one PSEL</li><li>Workloads with a few hot sets, such as lock-heavy server code</li></ul></td></tr></table></div>

<h3 id="sec-srrip">Static Re-Reference Interval Prediction (SRRIP)</h3>
<p><strong>Motivation.</strong> An LRU position is really a prediction of when a line will be used again: MRU means "soon" and LRU means "far off." LRU predicts "soon" for every new line, which is wrong for scans. RRIP (Jaleel, Theobald, Steely, and Emer, ISCA 2010) stores the prediction directly in a small counter per line and gives new lines a "long" prediction, between soon and far off. A new line must be reused to become safe, so a scan can't flush lines that have shown reuse. It costs 2 bits per line.</p>
<p><strong>How it works.</strong> Each line has a 2-bit re-reference prediction value (RRPV): 0 means near-immediate reuse, 3 means distant.</p>
<ul>
<li><strong>Insertion:</strong> RRPV 2.</li>
<li><strong>Hit:</strong> RRPV 0.</li>
<li><strong>Eviction:</strong> the first line from way 0 with RRPV 3. If there is none, add 1 to every RRPV in the set and search again.</li>
</ul>
<p><strong>Example.</strong> A and B are hot, then a four-line scan passes through. At cycle 6 no line has RRPV 3, so every RRPV goes up by one: A and B to 1, C and D to 3, and C is evicted. The scan lines keep evicting each other, and A and B survive:</p>
<div class="tbl"><svg viewBox="0 0 680 497" role="img" aria-label="A scan. Hot lines A and B are used twice, then the scan C D E F passes through, then A and B are used again. LRU lets the scan evict A and B, so they miss at cycles 8 and 9: 2 of 10 hits. SRRIP inserts the scan lines at RRPV 2 while A and B sit at 0, so the scan lines evict each other and A and B hit at the end: 4 of 10 hits." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<text x="0" y="13" style="fill:var(--ink);font-size:13px;font-weight:600">LRU: 2 of 10 hits</text>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle">
<text x="0" y="34" text-anchor="start">cycle</text>
<text x="124" y="34">0</text>
<text x="172" y="34">1</text>
<text x="220" y="34">2</text>
<text x="268" y="34">3</text>
<text x="316" y="34">4</text>
<text x="364" y="34">5</text>
<text x="412" y="34">6</text>
<text x="460" y="34">7</text>
<text x="508" y="34">8</text>
<text x="556" y="34">9</text>
</g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle">
<text x="0" y="51" text-anchor="start" style="font-weight:400;font-size:11px;fill:var(--muted)">access</text>
<text x="124" y="51">A</text>
<text x="172" y="51">B</text>
<text x="220" y="51">A</text>
<text x="268" y="51">B</text>
<text x="316" y="51">C</text>
<text x="364" y="51">D</text>
<text x="412" y="51">E</text>
<text x="460" y="51">F</text>
<text x="508" y="51">A</text>
<text x="556" y="51">B</text>
</g>
<text x="0" y="79" style="fill:var(--muted);font-size:11px">way 0</text>
<text x="0" y="109" style="fill:var(--muted);font-size:11px">way 1</text>
<text x="0" y="139" style="fill:var(--muted);font-size:11px">way 2</text>
<text x="0" y="169" style="fill:var(--muted);font-size:11px">way 3</text>
<g style="fill:none;stroke:var(--rule);stroke-width:1;stroke-dasharray:3 3"><rect x="102" y="92" width="44" height="26" rx="3"/><rect x="102" y="122" width="44" height="26" rx="3"/><rect x="150" y="122" width="44" height="26" rx="3"/><rect x="198" y="122" width="44" height="26" rx="3"/><rect x="246" y="122" width="44" height="26" rx="3"/><rect x="102" y="152" width="44" height="26" rx="3"/><rect x="150" y="152" width="44" height="26" rx="3"/><rect x="198" y="152" width="44" height="26" rx="3"/><rect x="246" y="152" width="44" height="26" rx="3"/><rect x="294" y="152" width="44" height="26" rx="3"/></g>
<g style="fill:var(--surface);stroke:var(--rule);stroke-width:1"><rect x="150" y="62" width="44" height="26" rx="3"/><rect x="246" y="62" width="44" height="26" rx="3"/><rect x="294" y="62" width="44" height="26" rx="3"/><rect x="342" y="62" width="44" height="26" rx="3"/><rect x="438" y="62" width="44" height="26" rx="3"/><rect x="486" y="62" width="44" height="26" rx="3"/><rect x="534" y="62" width="44" height="26" rx="3"/><rect x="198" y="92" width="44" height="26" rx="3"/><rect x="294" y="92" width="44" height="26" rx="3"/><rect x="342" y="92" width="44" height="26" rx="3"/><rect x="390" y="92" width="44" height="26" rx="3"/><rect x="486" y="92" width="44" height="26" rx="3"/><rect x="534" y="92" width="44" height="26" rx="3"/><rect x="342" y="122" width="44" height="26" rx="3"/><rect x="390" y="122" width="44" height="26" rx="3"/><rect x="438" y="122" width="44" height="26" rx="3"/><rect x="534" y="122" width="44" height="26" rx="3"/><rect x="390" y="152" width="44" height="26" rx="3"/><rect x="438" y="152" width="44" height="26" rx="3"/><rect x="486" y="152" width="44" height="26" rx="3"/></g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"><rect x="102" y="62" width="44" height="26" rx="3"/><rect x="390" y="62" width="44" height="26" rx="3"/><rect x="150" y="92" width="44" height="26" rx="3"/><rect x="438" y="92" width="44" height="26" rx="3"/><rect x="294" y="122" width="44" height="26" rx="3"/><rect x="486" y="122" width="44" height="26" rx="3"/><rect x="342" y="152" width="44" height="26" rx="3"/><rect x="534" y="152" width="44" height="26" rx="3"/></g>
<g style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2.5"><rect x="198" y="62" width="44" height="26" rx="3"/><rect x="246" y="92" width="44" height="26" rx="3"/></g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle"><text x="124" y="79">A</text><text x="172" y="79">A</text><text x="220" y="79">A</text><text x="268" y="79">A</text><text x="316" y="79">A</text><text x="364" y="79">A</text><text x="412" y="79">E</text><text x="460" y="79">E</text><text x="508" y="79">E</text><text x="556" y="79">E</text><text x="172" y="109">B</text><text x="220" y="109">B</text><text x="268" y="109">B</text><text x="316" y="109">B</text><text x="364" y="109">B</text><text x="412" y="109">B</text><text x="460" y="109">F</text><text x="508" y="109">F</text><text x="556" y="109">F</text><text x="316" y="139">C</text><text x="364" y="139">C</text><text x="412" y="139">C</text><text x="460" y="139">C</text><text x="508" y="139">A</text><text x="556" y="139">A</text><text x="364" y="169">D</text><text x="412" y="169">D</text><text x="460" y="169">D</text><text x="508" y="169">D</text><text x="556" y="169">B</text></g>
<g style="font-size:11px;font-weight:600" text-anchor="middle">
<text x="0" y="196" text-anchor="start" style="font-weight:400;fill:var(--muted)">result</text>
<text x="124" y="196" style="fill:var(--accent-red)">miss</text>
<text x="172" y="196" style="fill:var(--accent-red)">miss</text>
<text x="220" y="196" style="fill:var(--accent-green)">hit</text>
<text x="268" y="196" style="fill:var(--accent-green)">hit</text>
<text x="316" y="196" style="fill:var(--accent-red)">miss</text>
<text x="364" y="196" style="fill:var(--accent-red)">miss</text>
<text x="412" y="196" style="fill:var(--accent-red)">miss</text>
<text x="460" y="196" style="fill:var(--accent-red)">miss</text>
<text x="508" y="196" style="fill:var(--accent-red)">miss</text>
<text x="556" y="196" style="fill:var(--accent-red)">miss</text>
</g>
<g style="fill:var(--muted);font-size:11px" text-anchor="middle">
<text x="0" y="213" text-anchor="start">evicts</text>
<text x="412" y="213">A</text>
<text x="460" y="213">B</text>
<text x="508" y="213">C</text>
<text x="556" y="213">D</text>
</g>
<g style="fill:var(--ink);font-size:10px;font-family:var(--mono)" text-anchor="middle">
<text x="0" y="230" text-anchor="start" style="font-family:var(--sans);font-size:11px;fill:var(--muted)">MRU → LRU</text>
<text x="124" y="230">A</text>
<text x="172" y="230">BA</text>
<text x="220" y="230">AB</text>
<text x="268" y="230">BA</text>
<text x="316" y="230">CBA</text>
<text x="364" y="230">DCBA</text>
<text x="412" y="230">EDCB</text>
<text x="460" y="230">FEDC</text>
<text x="508" y="230">AFED</text>
<text x="556" y="230">BAFE</text>
</g>
<text x="0" y="264" style="fill:var(--ink);font-size:13px;font-weight:600">SRRIP: 4 of 10 hits</text>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle">
<text x="0" y="285" text-anchor="start">cycle</text>
<text x="124" y="285">0</text>
<text x="172" y="285">1</text>
<text x="220" y="285">2</text>
<text x="268" y="285">3</text>
<text x="316" y="285">4</text>
<text x="364" y="285">5</text>
<text x="412" y="285">6</text>
<text x="460" y="285">7</text>
<text x="508" y="285">8</text>
<text x="556" y="285">9</text>
</g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle">
<text x="0" y="302" text-anchor="start" style="font-weight:400;font-size:11px;fill:var(--muted)">access</text>
<text x="124" y="302">A</text>
<text x="172" y="302">B</text>
<text x="220" y="302">A</text>
<text x="268" y="302">B</text>
<text x="316" y="302">C</text>
<text x="364" y="302">D</text>
<text x="412" y="302">E</text>
<text x="460" y="302">F</text>
<text x="508" y="302">A</text>
<text x="556" y="302">B</text>
</g>
<text x="0" y="330" style="fill:var(--muted);font-size:11px">way 0</text>
<text x="0" y="360" style="fill:var(--muted);font-size:11px">way 1</text>
<text x="0" y="390" style="fill:var(--muted);font-size:11px">way 2</text>
<text x="0" y="420" style="fill:var(--muted);font-size:11px">way 3</text>
<g style="fill:none;stroke:var(--rule);stroke-width:1;stroke-dasharray:3 3"><rect x="102" y="343" width="44" height="26" rx="3"/><rect x="102" y="373" width="44" height="26" rx="3"/><rect x="150" y="373" width="44" height="26" rx="3"/><rect x="198" y="373" width="44" height="26" rx="3"/><rect x="246" y="373" width="44" height="26" rx="3"/><rect x="102" y="403" width="44" height="26" rx="3"/><rect x="150" y="403" width="44" height="26" rx="3"/><rect x="198" y="403" width="44" height="26" rx="3"/><rect x="246" y="403" width="44" height="26" rx="3"/><rect x="294" y="403" width="44" height="26" rx="3"/></g>
<g style="fill:var(--surface);stroke:var(--rule);stroke-width:1"><rect x="150" y="313" width="44" height="26" rx="3"/><rect x="246" y="313" width="44" height="26" rx="3"/><rect x="294" y="313" width="44" height="26" rx="3"/><rect x="342" y="313" width="44" height="26" rx="3"/><rect x="390" y="313" width="44" height="26" rx="3"/><rect x="438" y="313" width="44" height="26" rx="3"/><rect x="534" y="313" width="44" height="26" rx="3"/><rect x="198" y="343" width="44" height="26" rx="3"/><rect x="294" y="343" width="44" height="26" rx="3"/><rect x="342" y="343" width="44" height="26" rx="3"/><rect x="390" y="343" width="44" height="26" rx="3"/><rect x="438" y="343" width="44" height="26" rx="3"/><rect x="486" y="343" width="44" height="26" rx="3"/><rect x="342" y="373" width="44" height="26" rx="3"/><rect x="438" y="373" width="44" height="26" rx="3"/><rect x="486" y="373" width="44" height="26" rx="3"/><rect x="534" y="373" width="44" height="26" rx="3"/><rect x="390" y="403" width="44" height="26" rx="3"/><rect x="486" y="403" width="44" height="26" rx="3"/><rect x="534" y="403" width="44" height="26" rx="3"/></g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"><rect x="102" y="313" width="44" height="26" rx="3"/><rect x="150" y="343" width="44" height="26" rx="3"/><rect x="294" y="373" width="44" height="26" rx="3"/><rect x="390" y="373" width="44" height="26" rx="3"/><rect x="342" y="403" width="44" height="26" rx="3"/><rect x="438" y="403" width="44" height="26" rx="3"/></g>
<g style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2.5"><rect x="198" y="313" width="44" height="26" rx="3"/><rect x="486" y="313" width="44" height="26" rx="3"/><rect x="246" y="343" width="44" height="26" rx="3"/><rect x="534" y="343" width="44" height="26" rx="3"/></g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle"><text x="117.84" y="330">A</text><text x="165.84" y="330">A</text><text x="213.84" y="330">A</text><text x="261.84" y="330">A</text><text x="309.84" y="330">A</text><text x="357.84" y="330">A</text><text x="405.84" y="330">A</text><text x="453.84" y="330">A</text><text x="501.84" y="330">A</text><text x="549.84" y="330">A</text><text x="165.84" y="360">B</text><text x="213.84" y="360">B</text><text x="261.84" y="360">B</text><text x="309.84" y="360">B</text><text x="357.84" y="360">B</text><text x="405.84" y="360">B</text><text x="453.84" y="360">B</text><text x="501.84" y="360">B</text><text x="549.84" y="360">B</text><text x="309.84" y="390">C</text><text x="357.84" y="390">C</text><text x="405.84" y="390">E</text><text x="453.84" y="390">E</text><text x="501.84" y="390">E</text><text x="549.84" y="390">E</text><text x="357.84" y="420">D</text><text x="405.84" y="420">D</text><text x="453.84" y="420">F</text><text x="501.84" y="420">F</text><text x="549.84" y="420">F</text></g>
<g style="fill:var(--muted);font-size:10px;font-family:var(--mono)" text-anchor="end"><text x="142" y="331">2</text><text x="190" y="331">2</text><text x="238" y="331">0</text><text x="286" y="331">0</text><text x="334" y="331">0</text><text x="382" y="331">0</text><text x="430" y="331">1</text><text x="478" y="331">1</text><text x="526" y="331">0</text><text x="574" y="331">0</text><text x="190" y="361">2</text><text x="238" y="361">2</text><text x="286" y="361">0</text><text x="334" y="361">0</text><text x="382" y="361">0</text><text x="430" y="361">1</text><text x="478" y="361">1</text><text x="526" y="361">1</text><text x="574" y="361">0</text><text x="334" y="391">2</text><text x="382" y="391">2</text><text x="430" y="391">2</text><text x="478" y="391">2</text><text x="526" y="391">2</text><text x="574" y="391">2</text><text x="382" y="421">2</text><text x="430" y="421">3</text><text x="478" y="421">2</text><text x="526" y="421">2</text><text x="574" y="421">2</text></g>
<g style="font-size:11px;font-weight:600" text-anchor="middle">
<text x="0" y="447" text-anchor="start" style="font-weight:400;fill:var(--muted)">result</text>
<text x="124" y="447" style="fill:var(--accent-red)">miss</text>
<text x="172" y="447" style="fill:var(--accent-red)">miss</text>
<text x="220" y="447" style="fill:var(--accent-green)">hit</text>
<text x="268" y="447" style="fill:var(--accent-green)">hit</text>
<text x="316" y="447" style="fill:var(--accent-red)">miss</text>
<text x="364" y="447" style="fill:var(--accent-red)">miss</text>
<text x="412" y="447" style="fill:var(--accent-red)">miss</text>
<text x="460" y="447" style="fill:var(--accent-red)">miss</text>
<text x="508" y="447" style="fill:var(--accent-green)">hit</text>
<text x="556" y="447" style="fill:var(--accent-green)">hit</text>
</g>
<g style="fill:var(--muted);font-size:11px" text-anchor="middle">
<text x="0" y="464" text-anchor="start">evicts</text>
<text x="412" y="464">C</text>
<text x="460" y="464">D</text>
</g>
<g style="fill:var(--muted);font-size:11px">
<rect x="0" y="479" width="16" height="12" rx="2" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="22" y="489">filled on a miss</text>
<rect x="136" y="479" width="16" height="12" rx="2" style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2.5"/><text x="158" y="489">hit</text>
<text x="194" y="489">small number = RRPV</text>
</g>
</svg></div>

<p><strong>Implementation.</strong> A 2-bit RRPV per line, 2N bits per set: 16 for 8 ways. The victim search is a priority encoder over N "RRPV = 3" signals, each the AND of a line's two bits. The loop "add 1 to every RRPV and search again" never actually loops: the hardware finds the largest RRPV m in the set and adds 3 − m to every line at once, which leaves at least one line at 3. This is exactly the textbook loop (Jaleel et al., ISCA 2010): starting from a largest RRPV m, the loop runs 3 − m times, and no line saturates early because every line is at or below m, so one add of 3 − m gives the same RRPVs. The add happens before the victim is chosen, and only when no line is already at 3. A hit writes 0 (hit priority) or, in the frequency-priority variant, subtracts 1.</p>
<h4>Hit Priority vs. Frequency Priority</h4>
<p>The two variants differ only in how much protection one hit buys. A line at RRPV r survives 3 − r aging steps, so a new line (RRPV 2) survives one. Under hit priority (HP), any hit writes 0, so one hit buys three aging steps. Under frequency priority (FP), each hit subtracts 1, so after k hits the RRPV is max(2 − k, 0): one hit buys two steps and only a second hit buys full protection. HP treats reuse as recency-friendly, like LRU's move to MRU. FP turns the RRPV into a use counter that aging decays, an LFU with aging in 2 bits.</p>
<div class="tbl"><table class="halves"><tr><th>Hit Priority</th><th>Frequency Priority</th></tr><tr><td><ul><li>Newly hot data is protected after one hit, so it adapts quickly after a phase change</li><li>The hit writes a constant 00, independent of the old value</li><li>Wins on average in Jaleel et al.'s evaluation, and is the variant DRRIP uses</li><li>Fits the LLC well: the L1 and L2 absorb short-range reuse, so a hit that reaches the LLC is strong evidence of more</li></ul></td><td><ul><li>A line reused once and then dead gets two aging steps instead of three, so it leaves sooner</li><li>Separates hot from lukewarm lines under stable, skewed popularity (Zipfian key-value lookups), where HP puts a line hit once and a line hit a hundred times both at 0</li><li>A newly hot line needs two hits before it is fully protected, and can age out in between</li><li>Needs a 2-bit saturating decrement on the hit path</li></ul></td></tr></table></div>
<p>Set dueling in DRRIP chooses the insertion policy (SRRIP or BRRIP), not the promotion rule, which is fixed at design time.</p>
<h4>Where SRRIP Helps</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>Hot data plus scans: a new line must be reused before it outranks the hot set</li><li>Mixes of reused and single-use data in the same sets</li></ul></td><td><ul><li>Databases mixing index lookups with table scans</li><li>CPU inference that streams weights past hot activations</li><li>520.omnetpp_r sharing an LLC with a streaming 519.lbm_r</li></ul></td></tr></table></div>
<h4>Where SRRIP Hurts</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>Cyclic loops larger than the cache: every line enters at the same RRPV and none is reused in time, so it behaves like FIFO and gets zero hits</li><li>Working sets far larger than the cache with uniform reuse</li></ul></td><td><ul><li>Iterative solvers over data 1.5 times the LLC</li><li>429.mcf (SPEC CPU2006) at the LLC</li></ul></td></tr></table></div>

<h3 id="sec-brrip">Bimodal RRIP (BRRIP)</h3>
<p><strong>Motivation.</strong> SRRIP still thrashes on a loop larger than the cache. Every line goes in at the same RRPV and none is reused in time, so SRRIP behaves like FIFO. BRRIP is RRIP's version of BIP: it makes almost every new line the first to go, so the lines already in the set stay long enough to hit.</p>
<p><strong>How it works.</strong> Insert at RRPV 3 (distant) most of the time, and at RRPV 2 with a small probability (1/32). Hits and eviction work as in SRRIP. The occasional RRPV 2 insertion lets a new working set get in after a phase change.</p>
<p><strong>Example.</strong> The six-line loop under both. The 1-in-32 insertion at RRPV 2 doesn't occur in these 12 accesses. Under BRRIP, E, F, and A take turns in way 0, while B, C, and D stay and hit:</p>
<div class="tbl"><svg viewBox="0 0 680 480" role="img" aria-label="Thrashing on the cyclic sequence A B C D E F A B C D E F. SRRIP inserts every line at RRPV 2, behaves like FIFO here, and gets 0 hits. BRRIP inserts at RRPV 3, so E, F, and A take turns in way 0 while B, C, and D stay and hit at cycles 7, 8, and 9: 3 of 12 hits." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<text x="0" y="13" style="fill:var(--ink);font-size:13px;font-weight:600">SRRIP: 0 of 12 hits</text>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle">
<text x="0" y="34" text-anchor="start">cycle</text>
<text x="123.5" y="34">0</text>
<text x="170.5" y="34">1</text>
<text x="217.5" y="34">2</text>
<text x="264.5" y="34">3</text>
<text x="311.5" y="34">4</text>
<text x="358.5" y="34">5</text>
<text x="405.5" y="34">6</text>
<text x="452.5" y="34">7</text>
<text x="499.5" y="34">8</text>
<text x="546.5" y="34">9</text>
<text x="593.5" y="34">10</text>
<text x="640.5" y="34">11</text>
</g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle">
<text x="0" y="51" text-anchor="start" style="font-weight:400;font-size:11px;fill:var(--muted)">access</text>
<text x="123.5" y="51">A</text>
<text x="170.5" y="51">B</text>
<text x="217.5" y="51">C</text>
<text x="264.5" y="51">D</text>
<text x="311.5" y="51">E</text>
<text x="358.5" y="51">F</text>
<text x="405.5" y="51">A</text>
<text x="452.5" y="51">B</text>
<text x="499.5" y="51">C</text>
<text x="546.5" y="51">D</text>
<text x="593.5" y="51">E</text>
<text x="640.5" y="51">F</text>
</g>
<text x="0" y="79" style="fill:var(--muted);font-size:11px">way 0</text>
<text x="0" y="109" style="fill:var(--muted);font-size:11px">way 1</text>
<text x="0" y="139" style="fill:var(--muted);font-size:11px">way 2</text>
<text x="0" y="169" style="fill:var(--muted);font-size:11px">way 3</text>
<g style="fill:none;stroke:var(--rule);stroke-width:1;stroke-dasharray:3 3"><rect x="102" y="92" width="43" height="26" rx="3"/><rect x="102" y="122" width="43" height="26" rx="3"/><rect x="149" y="122" width="43" height="26" rx="3"/><rect x="102" y="152" width="43" height="26" rx="3"/><rect x="149" y="152" width="43" height="26" rx="3"/><rect x="196" y="152" width="43" height="26" rx="3"/></g>
<g style="fill:var(--surface);stroke:var(--rule);stroke-width:1"><rect x="149" y="62" width="43" height="26" rx="3"/><rect x="196" y="62" width="43" height="26" rx="3"/><rect x="243" y="62" width="43" height="26" rx="3"/><rect x="337" y="62" width="43" height="26" rx="3"/><rect x="384" y="62" width="43" height="26" rx="3"/><rect x="431" y="62" width="43" height="26" rx="3"/><rect x="525" y="62" width="43" height="26" rx="3"/><rect x="572" y="62" width="43" height="26" rx="3"/><rect x="619" y="62" width="43" height="26" rx="3"/><rect x="196" y="92" width="43" height="26" rx="3"/><rect x="243" y="92" width="43" height="26" rx="3"/><rect x="290" y="92" width="43" height="26" rx="3"/><rect x="384" y="92" width="43" height="26" rx="3"/><rect x="431" y="92" width="43" height="26" rx="3"/><rect x="478" y="92" width="43" height="26" rx="3"/><rect x="572" y="92" width="43" height="26" rx="3"/><rect x="619" y="92" width="43" height="26" rx="3"/><rect x="243" y="122" width="43" height="26" rx="3"/><rect x="290" y="122" width="43" height="26" rx="3"/><rect x="337" y="122" width="43" height="26" rx="3"/><rect x="431" y="122" width="43" height="26" rx="3"/><rect x="478" y="122" width="43" height="26" rx="3"/><rect x="525" y="122" width="43" height="26" rx="3"/><rect x="619" y="122" width="43" height="26" rx="3"/><rect x="290" y="152" width="43" height="26" rx="3"/><rect x="337" y="152" width="43" height="26" rx="3"/><rect x="384" y="152" width="43" height="26" rx="3"/><rect x="478" y="152" width="43" height="26" rx="3"/><rect x="525" y="152" width="43" height="26" rx="3"/><rect x="572" y="152" width="43" height="26" rx="3"/></g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"><rect x="102" y="62" width="43" height="26" rx="3"/><rect x="290" y="62" width="43" height="26" rx="3"/><rect x="478" y="62" width="43" height="26" rx="3"/><rect x="149" y="92" width="43" height="26" rx="3"/><rect x="337" y="92" width="43" height="26" rx="3"/><rect x="525" y="92" width="43" height="26" rx="3"/><rect x="196" y="122" width="43" height="26" rx="3"/><rect x="384" y="122" width="43" height="26" rx="3"/><rect x="572" y="122" width="43" height="26" rx="3"/><rect x="243" y="152" width="43" height="26" rx="3"/><rect x="431" y="152" width="43" height="26" rx="3"/><rect x="619" y="152" width="43" height="26" rx="3"/></g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle"><text x="117.48" y="79">A</text><text x="164.48" y="79">A</text><text x="211.48" y="79">A</text><text x="258.48" y="79">A</text><text x="305.48" y="79">E</text><text x="352.48" y="79">E</text><text x="399.48" y="79">E</text><text x="446.48" y="79">E</text><text x="493.48" y="79">C</text><text x="540.48" y="79">C</text><text x="587.48" y="79">C</text><text x="634.48" y="79">C</text><text x="164.48" y="109">B</text><text x="211.48" y="109">B</text><text x="258.48" y="109">B</text><text x="305.48" y="109">B</text><text x="352.48" y="109">F</text><text x="399.48" y="109">F</text><text x="446.48" y="109">F</text><text x="493.48" y="109">F</text><text x="540.48" y="109">D</text><text x="587.48" y="109">D</text><text x="634.48" y="109">D</text><text x="211.48" y="139">C</text><text x="258.48" y="139">C</text><text x="305.48" y="139">C</text><text x="352.48" y="139">C</text><text x="399.48" y="139">A</text><text x="446.48" y="139">A</text><text x="493.48" y="139">A</text><text x="540.48" y="139">A</text><text x="587.48" y="139">E</text><text x="634.48" y="139">E</text><text x="258.48" y="169">D</text><text x="305.48" y="169">D</text><text x="352.48" y="169">D</text><text x="399.48" y="169">D</text><text x="446.48" y="169">B</text><text x="493.48" y="169">B</text><text x="540.48" y="169">B</text><text x="587.48" y="169">B</text><text x="634.48" y="169">F</text></g>
<g style="fill:var(--muted);font-size:10px;font-family:var(--mono)" text-anchor="end"><text x="141" y="80">2</text><text x="188" y="80">2</text><text x="235" y="80">2</text><text x="282" y="80">2</text><text x="329" y="80">2</text><text x="376" y="80">2</text><text x="423" y="80">2</text><text x="470" y="80">2</text><text x="517" y="80">2</text><text x="564" y="80">2</text><text x="611" y="80">2</text><text x="658" y="80">2</text><text x="188" y="110">2</text><text x="235" y="110">2</text><text x="282" y="110">2</text><text x="329" y="110">3</text><text x="376" y="110">2</text><text x="423" y="110">2</text><text x="470" y="110">2</text><text x="517" y="110">3</text><text x="564" y="110">2</text><text x="611" y="110">2</text><text x="658" y="110">2</text><text x="235" y="140">2</text><text x="282" y="140">2</text><text x="329" y="140">3</text><text x="376" y="140">3</text><text x="423" y="140">2</text><text x="470" y="140">2</text><text x="517" y="140">3</text><text x="564" y="140">3</text><text x="611" y="140">2</text><text x="658" y="140">2</text><text x="282" y="170">2</text><text x="329" y="170">3</text><text x="376" y="170">3</text><text x="423" y="170">3</text><text x="470" y="170">2</text><text x="517" y="170">3</text><text x="564" y="170">3</text><text x="611" y="170">3</text><text x="658" y="170">2</text></g>
<g style="font-size:11px;font-weight:600" text-anchor="middle">
<text x="0" y="196" text-anchor="start" style="font-weight:400;fill:var(--muted)">result</text>
<text x="123.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="170.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="217.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="264.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="311.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="358.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="405.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="452.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="499.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="546.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="593.5" y="196" style="fill:var(--accent-red)">miss</text>
<text x="640.5" y="196" style="fill:var(--accent-red)">miss</text>
</g>
<g style="fill:var(--muted);font-size:11px" text-anchor="middle">
<text x="0" y="213" text-anchor="start">evicts</text>
<text x="311.5" y="213">A</text>
<text x="358.5" y="213">B</text>
<text x="405.5" y="213">C</text>
<text x="452.5" y="213">D</text>
<text x="499.5" y="213">E</text>
<text x="546.5" y="213">F</text>
<text x="593.5" y="213">A</text>
<text x="640.5" y="213">B</text>
</g>
<text x="0" y="247" style="fill:var(--ink);font-size:13px;font-weight:600">BRRIP: 3 of 12 hits</text>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle">
<text x="0" y="268" text-anchor="start">cycle</text>
<text x="123.5" y="268">0</text>
<text x="170.5" y="268">1</text>
<text x="217.5" y="268">2</text>
<text x="264.5" y="268">3</text>
<text x="311.5" y="268">4</text>
<text x="358.5" y="268">5</text>
<text x="405.5" y="268">6</text>
<text x="452.5" y="268">7</text>
<text x="499.5" y="268">8</text>
<text x="546.5" y="268">9</text>
<text x="593.5" y="268">10</text>
<text x="640.5" y="268">11</text>
</g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle">
<text x="0" y="285" text-anchor="start" style="font-weight:400;font-size:11px;fill:var(--muted)">access</text>
<text x="123.5" y="285">A</text>
<text x="170.5" y="285">B</text>
<text x="217.5" y="285">C</text>
<text x="264.5" y="285">D</text>
<text x="311.5" y="285">E</text>
<text x="358.5" y="285">F</text>
<text x="405.5" y="285">A</text>
<text x="452.5" y="285">B</text>
<text x="499.5" y="285">C</text>
<text x="546.5" y="285">D</text>
<text x="593.5" y="285">E</text>
<text x="640.5" y="285">F</text>
</g>
<text x="0" y="313" style="fill:var(--muted);font-size:11px">way 0</text>
<text x="0" y="343" style="fill:var(--muted);font-size:11px">way 1</text>
<text x="0" y="373" style="fill:var(--muted);font-size:11px">way 2</text>
<text x="0" y="403" style="fill:var(--muted);font-size:11px">way 3</text>
<g style="fill:none;stroke:var(--rule);stroke-width:1;stroke-dasharray:3 3"><rect x="102" y="326" width="43" height="26" rx="3"/><rect x="102" y="356" width="43" height="26" rx="3"/><rect x="149" y="356" width="43" height="26" rx="3"/><rect x="102" y="386" width="43" height="26" rx="3"/><rect x="149" y="386" width="43" height="26" rx="3"/><rect x="196" y="386" width="43" height="26" rx="3"/></g>
<g style="fill:var(--surface);stroke:var(--rule);stroke-width:1"><rect x="149" y="296" width="43" height="26" rx="3"/><rect x="196" y="296" width="43" height="26" rx="3"/><rect x="243" y="296" width="43" height="26" rx="3"/><rect x="431" y="296" width="43" height="26" rx="3"/><rect x="478" y="296" width="43" height="26" rx="3"/><rect x="525" y="296" width="43" height="26" rx="3"/><rect x="196" y="326" width="43" height="26" rx="3"/><rect x="243" y="326" width="43" height="26" rx="3"/><rect x="290" y="326" width="43" height="26" rx="3"/><rect x="337" y="326" width="43" height="26" rx="3"/><rect x="384" y="326" width="43" height="26" rx="3"/><rect x="478" y="326" width="43" height="26" rx="3"/><rect x="525" y="326" width="43" height="26" rx="3"/><rect x="572" y="326" width="43" height="26" rx="3"/><rect x="619" y="326" width="43" height="26" rx="3"/><rect x="243" y="356" width="43" height="26" rx="3"/><rect x="290" y="356" width="43" height="26" rx="3"/><rect x="337" y="356" width="43" height="26" rx="3"/><rect x="384" y="356" width="43" height="26" rx="3"/><rect x="431" y="356" width="43" height="26" rx="3"/><rect x="525" y="356" width="43" height="26" rx="3"/><rect x="572" y="356" width="43" height="26" rx="3"/><rect x="619" y="356" width="43" height="26" rx="3"/><rect x="290" y="386" width="43" height="26" rx="3"/><rect x="337" y="386" width="43" height="26" rx="3"/><rect x="384" y="386" width="43" height="26" rx="3"/><rect x="431" y="386" width="43" height="26" rx="3"/><rect x="478" y="386" width="43" height="26" rx="3"/><rect x="572" y="386" width="43" height="26" rx="3"/><rect x="619" y="386" width="43" height="26" rx="3"/></g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"><rect x="102" y="296" width="43" height="26" rx="3"/><rect x="290" y="296" width="43" height="26" rx="3"/><rect x="337" y="296" width="43" height="26" rx="3"/><rect x="384" y="296" width="43" height="26" rx="3"/><rect x="572" y="296" width="43" height="26" rx="3"/><rect x="619" y="296" width="43" height="26" rx="3"/><rect x="149" y="326" width="43" height="26" rx="3"/><rect x="196" y="356" width="43" height="26" rx="3"/><rect x="243" y="386" width="43" height="26" rx="3"/></g>
<g style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2.5"><rect x="431" y="326" width="43" height="26" rx="3"/><rect x="478" y="356" width="43" height="26" rx="3"/><rect x="525" y="386" width="43" height="26" rx="3"/></g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle"><text x="117.48" y="313">A</text><text x="164.48" y="313">A</text><text x="211.48" y="313">A</text><text x="258.48" y="313">A</text><text x="305.48" y="313">E</text><text x="352.48" y="313">F</text><text x="399.48" y="313">A</text><text x="446.48" y="313">A</text><text x="493.48" y="313">A</text><text x="540.48" y="313">A</text><text x="587.48" y="313">E</text><text x="634.48" y="313">F</text><text x="164.48" y="343">B</text><text x="211.48" y="343">B</text><text x="258.48" y="343">B</text><text x="305.48" y="343">B</text><text x="352.48" y="343">B</text><text x="399.48" y="343">B</text><text x="446.48" y="343">B</text><text x="493.48" y="343">B</text><text x="540.48" y="343">B</text><text x="587.48" y="343">B</text><text x="634.48" y="343">B</text><text x="211.48" y="373">C</text><text x="258.48" y="373">C</text><text x="305.48" y="373">C</text><text x="352.48" y="373">C</text><text x="399.48" y="373">C</text><text x="446.48" y="373">C</text><text x="493.48" y="373">C</text><text x="540.48" y="373">C</text><text x="587.48" y="373">C</text><text x="634.48" y="373">C</text><text x="258.48" y="403">D</text><text x="305.48" y="403">D</text><text x="352.48" y="403">D</text><text x="399.48" y="403">D</text><text x="446.48" y="403">D</text><text x="493.48" y="403">D</text><text x="540.48" y="403">D</text><text x="587.48" y="403">D</text><text x="634.48" y="403">D</text></g>
<g style="fill:var(--muted);font-size:10px;font-family:var(--mono)" text-anchor="end"><text x="141" y="314">3</text><text x="188" y="314">3</text><text x="235" y="314">3</text><text x="282" y="314">3</text><text x="329" y="314">3</text><text x="376" y="314">3</text><text x="423" y="314">3</text><text x="470" y="314">3</text><text x="517" y="314">3</text><text x="564" y="314">3</text><text x="611" y="314">3</text><text x="658" y="314">3</text><text x="188" y="344">3</text><text x="235" y="344">3</text><text x="282" y="344">3</text><text x="329" y="344">3</text><text x="376" y="344">3</text><text x="423" y="344">3</text><text x="470" y="344">0</text><text x="517" y="344">0</text><text x="564" y="344">0</text><text x="611" y="344">0</text><text x="658" y="344">0</text><text x="235" y="374">3</text><text x="282" y="374">3</text><text x="329" y="374">3</text><text x="376" y="374">3</text><text x="423" y="374">3</text><text x="470" y="374">3</text><text x="517" y="374">0</text><text x="564" y="374">0</text><text x="611" y="374">0</text><text x="658" y="374">0</text><text x="282" y="404">3</text><text x="329" y="404">3</text><text x="376" y="404">3</text><text x="423" y="404">3</text><text x="470" y="404">3</text><text x="517" y="404">3</text><text x="564" y="404">0</text><text x="611" y="404">0</text><text x="658" y="404">0</text></g>
<g style="font-size:11px;font-weight:600" text-anchor="middle">
<text x="0" y="430" text-anchor="start" style="font-weight:400;fill:var(--muted)">result</text>
<text x="123.5" y="430" style="fill:var(--accent-red)">miss</text>
<text x="170.5" y="430" style="fill:var(--accent-red)">miss</text>
<text x="217.5" y="430" style="fill:var(--accent-red)">miss</text>
<text x="264.5" y="430" style="fill:var(--accent-red)">miss</text>
<text x="311.5" y="430" style="fill:var(--accent-red)">miss</text>
<text x="358.5" y="430" style="fill:var(--accent-red)">miss</text>
<text x="405.5" y="430" style="fill:var(--accent-red)">miss</text>
<text x="452.5" y="430" style="fill:var(--accent-green)">hit</text>
<text x="499.5" y="430" style="fill:var(--accent-green)">hit</text>
<text x="546.5" y="430" style="fill:var(--accent-green)">hit</text>
<text x="593.5" y="430" style="fill:var(--accent-red)">miss</text>
<text x="640.5" y="430" style="fill:var(--accent-red)">miss</text>
</g>
<g style="fill:var(--muted);font-size:11px" text-anchor="middle">
<text x="0" y="447" text-anchor="start">evicts</text>
<text x="311.5" y="447">A</text>
<text x="358.5" y="447">E</text>
<text x="405.5" y="447">F</text>
<text x="593.5" y="447">A</text>
<text x="640.5" y="447">E</text>
</g>
<g style="fill:var(--muted);font-size:11px">
<rect x="0" y="462" width="16" height="12" rx="2" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="22" y="472">filled on a miss</text>
<rect x="136" y="462" width="16" height="12" rx="2" style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2.5"/><text x="158" y="472">hit</text>
<text x="194" y="472">small number = RRPV</text>
</g>
</svg></div>

<p><strong>Implementation.</strong> SRRIP's 2 bits per line plus a 5-bit counter or LFSR field that picks RRPV 2 on one fill in 32. Victim search and aging are the same as SRRIP.</p>
<h4>Where BRRIP Helps</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>Cyclic loops larger than the cache: nearly every new line is the next victim, so the lines already present stay and hit</li><li>Scans, whose lines are evicted first</li></ul></td><td><ul><li>Iterative solvers and PageRank over data just above the LLC size</li><li>429.mcf (SPEC CPU2006)</li></ul></td></tr></table></div>
<h4>Where BRRIP Hurts</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>Recency-friendly code whose new lines are reused soon: inserted at RRPV 3, they are often evicted before their first reuse</li><li>Frequent phase changes, which it adopts only slowly through the 1-in-32 insertions</li></ul></td><td><ul><li>Request-driven servers whose per-request data is reused within the request</li><li>502.gcc_r moving between compiler passes</li></ul></td></tr></table></div>

<h3 id="sec-drrip">Dynamic RRIP (DRRIP)</h3>
<p><strong>Motivation.</strong> SRRIP handles scans and BRRIP handles thrashing, and real programs move between the two. DRRIP chooses with set dueling, as DIP does, for 2 bits per line plus one counter. Reverse engineering of Intel's L3 from Ivy Bridge onward found adaptive replacement with set dueling between two policies, the same structure as DRRIP.</p>
<p><strong>How it works.</strong> 32 leader sets use SRRIP and 32 use BRRIP. A miss in an SRRIP leader increments the 10-bit PSEL, and a miss in a BRRIP leader decrements it. Follower sets insert with BRRIP when PSEL's MSB is 1 and with SRRIP otherwise.</p>
<p><strong>Example.</strong> A program alternates between a hot working set with scans and a loop larger than the LLC. In the first phase the BRRIP leaders miss more, because they insert reused lines at RRPV 3, so PSEL falls and followers use SRRIP. In the loop phase the SRRIP leaders thrash, PSEL climbs past 512, and followers switch to BRRIP:</p>
<div class="tbl"><svg viewBox="0 0 680 250" role="img" aria-label="An illustrative trace of DRRIP's PSEL counter over 10 million LLC accesses. In phase 1, a hot working set plus scans, the BRRIP leader sets miss more, so PSEL falls toward 0 and followers use SRRIP. In phase 2, a loop larger than the LLC, the SRRIP leader sets thrash, so PSEL climbs above 512 and followers switch to BRRIP. When phase 1 returns, PSEL falls back below 512 and followers return to SRRIP." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<text x="0" y="16" style="fill:var(--ink);font-size:13px;font-weight:600">PSEL over one run (illustrative)</text>
<rect x="70" y="40" width="224" height="160" style="fill:var(--pad-soft);stroke:none"/><text x="182" y="34" text-anchor="middle" style="fill:var(--ink);font-size:11px">phase 1: hot set plus scans</text>
<rect x="294" y="40" width="224" height="160" style="fill:var(--trace-soft);stroke:none"/><text x="406" y="34" text-anchor="middle" style="fill:var(--ink);font-size:11px">phase 2: loop larger than the LLC</text>
<rect x="518" y="40" width="112" height="160" style="fill:var(--pad-soft);stroke:none"/><text x="574" y="34" text-anchor="middle" style="fill:var(--ink);font-size:11px">phase 1 again</text>
<path d="M70,119.92179863147605 H630" style="fill:none;stroke:var(--muted);stroke-width:1;stroke-dasharray:4 3"/>
<path d="M70,200 H630 M70,200 V40" style="fill:none;stroke:var(--muted);stroke-width:1"/>
<polyline points="70.0,119.9 103.6,153.1 148.4,179.7 182.0,185.9 226.8,189.1 266.0,187.5 294.0,185.9 316.4,153.1 344.4,106.2 378.0,63.9 434.0,49.9 490.0,46.7 518.0,48.3 540.4,90.5 568.4,134.3 596.4,165.6 630.0,178.1" style="fill:none;stroke:var(--ink);stroke-width:2"/>
<g style="fill:var(--muted);font-size:10px" text-anchor="end"><text x="64" y="204">0</text><text x="64" y="123.92179863147605">512</text><text x="64" y="44">1023</text></g>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle"><text x="70" y="214">0</text><text x="182" y="214">2</text><text x="294" y="214">4</text><text x="406" y="214">6</text><text x="518" y="214">8</text><text x="630" y="214">10</text></g>
<text x="350" y="230" text-anchor="middle" style="fill:var(--muted);font-size:11px">LLC accesses (millions)</text>
<text x="182" y="141.92179863147607" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">followers use SRRIP</text>
<text x="406" y="159.92179863147607" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">followers use BRRIP</text>
<text x="634" y="123.92179863147605" style="fill:var(--muted);font-size:10px">MSB flips</text>
</svg></div>

<p><strong>Implementation.</strong> SRRIP's 2 bits per line, the same leader selection as DIP (32 SRRIP leaders and 32 BRRIP leaders by complement-select), and one 10-bit PSEL. Followers check PSEL's most significant bit at fill time to choose the insertion RRPV. Like DIP, a shared LLC can keep one PSEL per thread.</p>
<h4>Where DRRIP Helps</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>Programs that move between scan-heavy and thrashing phases</li><li>Unknown mixes of programs interleaved in a shared LLC</li></ul></td><td><ul><li>General-purpose server LLCs</li><li>Multi-programmed mixes of SPEC CPU2017, such as 520.omnetpp_r with 519.lbm_r</li><li>Intel L3 caches from Ivy Bridge onward, which use a similar dueling scheme</li></ul></td></tr></table></div>
<h4>Where DRRIP Hurts</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>Lines in the same sets whose reuse depends on which instruction loaded them: DRRIP gives them all the same insertion</li><li>Programs that change phase faster than PSEL can follow</li></ul></td><td><ul><li>CPU inference loops that stream weights and reuse activations in the same sets</li><li>Interpreters such as 500.perlbench_r, whose mix of hot and cold data shifts with the script</li></ul></td></tr></table></div>

<h3 id="sec-ship">Signature-Based Hit Prediction (SHiP)</h3>
<p><strong>Motivation.</strong> RRIP gives every new line the same prediction, but whether a line is reused depends heavily on the instruction that brought it in. A streaming loop's load never sees reuse, and a lookup into a small hot table almost always does. SHiP (Wu, Jaleel, Hasenplaugh, Martonosi, Steely, and Emer, MICRO 2011) learns reuse per signature, usually a hash of the load's PC, and uses it to set the insertion RRPV.</p>
<p><strong>How it works.</strong> It runs on top of SRRIP.</p>
<ul>
<li><strong>Per line:</strong> the 14-bit signature that filled it and an outcome bit, cleared on fill.</li>
<li><strong>Signature History Counter Table (SHCT):</strong> 16K 3-bit saturating counters, indexed by signature.</li>
<li><strong>Hit:</strong> set the line's outcome bit and increment SHCT[signature].</li>
<li><strong>Eviction of a line whose outcome bit is still 0:</strong> decrement SHCT[signature].</li>
<li><strong>Fill:</strong> if SHCT[signature] is 0, insert at RRPV 3, otherwise at RRPV 2.</li>
</ul>
<p><strong>Example.</strong> PC P1 loads the hot lines A and B. PC P2 runs a seven-line scan. For brevity, both counters start at 1. Under SRRIP the scan is long enough to age A and B to RRPV 3, and they're evicted at cycles 10 and 11. Under SHiP, C is evicted at cycle 6 without being reused, which drops P2's counter to 0. Every later P2 line goes in at RRPV 3 and is replaced in way 2, so A and B are never threatened:</p>
<div class="tbl"><svg viewBox="0 0 680 544" role="img" aria-label="SHiP against SRRIP. PC P1 loads hot lines A and B, which are reused. PC P2 runs a 7-line scan, C through I. Under SRRIP the scan ages A and B to RRPV 3 and evicts them at cycles 10 and 11, so A and B miss at the end: 2 of 13 hits. Under SHiP, C is evicted without reuse at cycle 6, which drops P2's counter to 0. Every later P2 line is inserted at RRPV 3 and replaced in way 2, so A and B hit at the end: 4 of 13 hits." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<text x="0" y="13" style="fill:var(--ink);font-size:13px;font-weight:600">SRRIP: 2 of 13 hits</text>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle">
<text x="0" y="34" text-anchor="start">cycle</text>
<text x="122" y="34">0</text>
<text x="166" y="34">1</text>
<text x="210" y="34">2</text>
<text x="254" y="34">3</text>
<text x="298" y="34">4</text>
<text x="342" y="34">5</text>
<text x="386" y="34">6</text>
<text x="430" y="34">7</text>
<text x="474" y="34">8</text>
<text x="518" y="34">9</text>
<text x="562" y="34">10</text>
<text x="606" y="34">11</text>
<text x="650" y="34">12</text>
</g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle">
<text x="0" y="51" text-anchor="start" style="font-weight:400;font-size:11px;fill:var(--muted)">access</text>
<text x="122" y="51">A</text>
<text x="166" y="51">B</text>
<text x="210" y="51">A</text>
<text x="254" y="51">B</text>
<text x="298" y="51">C</text>
<text x="342" y="51">D</text>
<text x="386" y="51">E</text>
<text x="430" y="51">F</text>
<text x="474" y="51">G</text>
<text x="518" y="51">H</text>
<text x="562" y="51">I</text>
<text x="606" y="51">A</text>
<text x="650" y="51">B</text>
</g>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle">
<text x="0" y="66" text-anchor="start">load PC</text>
<text x="122" y="66">P1</text>
<text x="166" y="66">P1</text>
<text x="210" y="66">P1</text>
<text x="254" y="66">P1</text>
<text x="298" y="66">P2</text>
<text x="342" y="66">P2</text>
<text x="386" y="66">P2</text>
<text x="430" y="66">P2</text>
<text x="474" y="66">P2</text>
<text x="518" y="66">P2</text>
<text x="562" y="66">P2</text>
<text x="606" y="66">P1</text>
<text x="650" y="66">P1</text>
</g>
<text x="0" y="94" style="fill:var(--muted);font-size:11px">way 0</text>
<text x="0" y="124" style="fill:var(--muted);font-size:11px">way 1</text>
<text x="0" y="154" style="fill:var(--muted);font-size:11px">way 2</text>
<text x="0" y="184" style="fill:var(--muted);font-size:11px">way 3</text>
<g style="fill:none;stroke:var(--rule);stroke-width:1;stroke-dasharray:3 3"><rect x="102" y="107" width="40" height="26" rx="3"/><rect x="102" y="137" width="40" height="26" rx="3"/><rect x="146" y="137" width="40" height="26" rx="3"/><rect x="190" y="137" width="40" height="26" rx="3"/><rect x="234" y="137" width="40" height="26" rx="3"/><rect x="102" y="167" width="40" height="26" rx="3"/><rect x="146" y="167" width="40" height="26" rx="3"/><rect x="190" y="167" width="40" height="26" rx="3"/><rect x="234" y="167" width="40" height="26" rx="3"/><rect x="278" y="167" width="40" height="26" rx="3"/></g>
<g style="fill:var(--surface);stroke:var(--rule);stroke-width:1"><rect x="146" y="77" width="40" height="26" rx="3"/><rect x="234" y="77" width="40" height="26" rx="3"/><rect x="278" y="77" width="40" height="26" rx="3"/><rect x="322" y="77" width="40" height="26" rx="3"/><rect x="366" y="77" width="40" height="26" rx="3"/><rect x="410" y="77" width="40" height="26" rx="3"/><rect x="454" y="77" width="40" height="26" rx="3"/><rect x="498" y="77" width="40" height="26" rx="3"/><rect x="586" y="77" width="40" height="26" rx="3"/><rect x="630" y="77" width="40" height="26" rx="3"/><rect x="190" y="107" width="40" height="26" rx="3"/><rect x="278" y="107" width="40" height="26" rx="3"/><rect x="322" y="107" width="40" height="26" rx="3"/><rect x="366" y="107" width="40" height="26" rx="3"/><rect x="410" y="107" width="40" height="26" rx="3"/><rect x="454" y="107" width="40" height="26" rx="3"/><rect x="498" y="107" width="40" height="26" rx="3"/><rect x="542" y="107" width="40" height="26" rx="3"/><rect x="630" y="107" width="40" height="26" rx="3"/><rect x="322" y="137" width="40" height="26" rx="3"/><rect x="410" y="137" width="40" height="26" rx="3"/><rect x="498" y="137" width="40" height="26" rx="3"/><rect x="542" y="137" width="40" height="26" rx="3"/><rect x="586" y="137" width="40" height="26" rx="3"/><rect x="366" y="167" width="40" height="26" rx="3"/><rect x="454" y="167" width="40" height="26" rx="3"/><rect x="542" y="167" width="40" height="26" rx="3"/><rect x="586" y="167" width="40" height="26" rx="3"/><rect x="630" y="167" width="40" height="26" rx="3"/></g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"><rect x="102" y="77" width="40" height="26" rx="3"/><rect x="542" y="77" width="40" height="26" rx="3"/><rect x="146" y="107" width="40" height="26" rx="3"/><rect x="586" y="107" width="40" height="26" rx="3"/><rect x="278" y="137" width="40" height="26" rx="3"/><rect x="366" y="137" width="40" height="26" rx="3"/><rect x="454" y="137" width="40" height="26" rx="3"/><rect x="630" y="137" width="40" height="26" rx="3"/><rect x="322" y="167" width="40" height="26" rx="3"/><rect x="410" y="167" width="40" height="26" rx="3"/><rect x="498" y="167" width="40" height="26" rx="3"/></g>
<g style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2.5"><rect x="190" y="77" width="40" height="26" rx="3"/><rect x="234" y="107" width="40" height="26" rx="3"/></g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle"><text x="116.4" y="94">A</text><text x="160.4" y="94">A</text><text x="204.4" y="94">A</text><text x="248.4" y="94">A</text><text x="292.4" y="94">A</text><text x="336.4" y="94">A</text><text x="380.4" y="94">A</text><text x="424.4" y="94">A</text><text x="468.4" y="94">A</text><text x="512.4" y="94">A</text><text x="556.4" y="94">I</text><text x="600.4" y="94">I</text><text x="644.4" y="94">I</text><text x="160.4" y="124">B</text><text x="204.4" y="124">B</text><text x="248.4" y="124">B</text><text x="292.4" y="124">B</text><text x="336.4" y="124">B</text><text x="380.4" y="124">B</text><text x="424.4" y="124">B</text><text x="468.4" y="124">B</text><text x="512.4" y="124">B</text><text x="556.4" y="124">B</text><text x="600.4" y="124">A</text><text x="644.4" y="124">A</text><text x="292.4" y="154">C</text><text x="336.4" y="154">C</text><text x="380.4" y="154">E</text><text x="424.4" y="154">E</text><text x="468.4" y="154">G</text><text x="512.4" y="154">G</text><text x="556.4" y="154">G</text><text x="600.4" y="154">G</text><text x="644.4" y="154">B</text><text x="336.4" y="184">D</text><text x="380.4" y="184">D</text><text x="424.4" y="184">F</text><text x="468.4" y="184">F</text><text x="512.4" y="184">H</text><text x="556.4" y="184">H</text><text x="600.4" y="184">H</text><text x="644.4" y="184">H</text></g>
<g style="fill:var(--muted);font-size:10px;font-family:var(--mono)" text-anchor="end"><text x="138" y="95">2</text><text x="182" y="95">2</text><text x="226" y="95">0</text><text x="270" y="95">0</text><text x="314" y="95">0</text><text x="358" y="95">0</text><text x="402" y="95">1</text><text x="446" y="95">1</text><text x="490" y="95">2</text><text x="534" y="95">2</text><text x="578" y="95">2</text><text x="622" y="95">2</text><text x="666" y="95">2</text><text x="182" y="125">2</text><text x="226" y="125">2</text><text x="270" y="125">0</text><text x="314" y="125">0</text><text x="358" y="125">0</text><text x="402" y="125">1</text><text x="446" y="125">1</text><text x="490" y="125">2</text><text x="534" y="125">2</text><text x="578" y="125">3</text><text x="622" y="125">2</text><text x="666" y="125">2</text><text x="314" y="155">2</text><text x="358" y="155">2</text><text x="402" y="155">2</text><text x="446" y="155">2</text><text x="490" y="155">2</text><text x="534" y="155">2</text><text x="578" y="155">3</text><text x="622" y="155">3</text><text x="666" y="155">2</text><text x="358" y="185">2</text><text x="402" y="185">3</text><text x="446" y="185">2</text><text x="490" y="185">3</text><text x="534" y="185">2</text><text x="578" y="185">3</text><text x="622" y="185">3</text><text x="666" y="185">3</text></g>
<g style="font-size:11px;font-weight:600" text-anchor="middle">
<text x="0" y="211" text-anchor="start" style="font-weight:400;fill:var(--muted)">result</text>
<text x="122" y="211" style="fill:var(--accent-red)">miss</text>
<text x="166" y="211" style="fill:var(--accent-red)">miss</text>
<text x="210" y="211" style="fill:var(--accent-green)">hit</text>
<text x="254" y="211" style="fill:var(--accent-green)">hit</text>
<text x="298" y="211" style="fill:var(--accent-red)">miss</text>
<text x="342" y="211" style="fill:var(--accent-red)">miss</text>
<text x="386" y="211" style="fill:var(--accent-red)">miss</text>
<text x="430" y="211" style="fill:var(--accent-red)">miss</text>
<text x="474" y="211" style="fill:var(--accent-red)">miss</text>
<text x="518" y="211" style="fill:var(--accent-red)">miss</text>
<text x="562" y="211" style="fill:var(--accent-red)">miss</text>
<text x="606" y="211" style="fill:var(--accent-red)">miss</text>
<text x="650" y="211" style="fill:var(--accent-red)">miss</text>
</g>
<g style="fill:var(--muted);font-size:11px" text-anchor="middle">
<text x="0" y="228" text-anchor="start">evicts</text>
<text x="386" y="228">C</text>
<text x="430" y="228">D</text>
<text x="474" y="228">E</text>
<text x="518" y="228">F</text>
<text x="562" y="228">A</text>
<text x="606" y="228">B</text>
<text x="650" y="228">G</text>
</g>
<text x="0" y="262" style="fill:var(--ink);font-size:13px;font-weight:600">SHiP: 4 of 13 hits</text>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle">
<text x="0" y="283" text-anchor="start">cycle</text>
<text x="122" y="283">0</text>
<text x="166" y="283">1</text>
<text x="210" y="283">2</text>
<text x="254" y="283">3</text>
<text x="298" y="283">4</text>
<text x="342" y="283">5</text>
<text x="386" y="283">6</text>
<text x="430" y="283">7</text>
<text x="474" y="283">8</text>
<text x="518" y="283">9</text>
<text x="562" y="283">10</text>
<text x="606" y="283">11</text>
<text x="650" y="283">12</text>
</g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle">
<text x="0" y="300" text-anchor="start" style="font-weight:400;font-size:11px;fill:var(--muted)">access</text>
<text x="122" y="300">A</text>
<text x="166" y="300">B</text>
<text x="210" y="300">A</text>
<text x="254" y="300">B</text>
<text x="298" y="300">C</text>
<text x="342" y="300">D</text>
<text x="386" y="300">E</text>
<text x="430" y="300">F</text>
<text x="474" y="300">G</text>
<text x="518" y="300">H</text>
<text x="562" y="300">I</text>
<text x="606" y="300">A</text>
<text x="650" y="300">B</text>
</g>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle">
<text x="0" y="315" text-anchor="start">load PC</text>
<text x="122" y="315">P1</text>
<text x="166" y="315">P1</text>
<text x="210" y="315">P1</text>
<text x="254" y="315">P1</text>
<text x="298" y="315">P2</text>
<text x="342" y="315">P2</text>
<text x="386" y="315">P2</text>
<text x="430" y="315">P2</text>
<text x="474" y="315">P2</text>
<text x="518" y="315">P2</text>
<text x="562" y="315">P2</text>
<text x="606" y="315">P1</text>
<text x="650" y="315">P1</text>
</g>
<text x="0" y="343" style="fill:var(--muted);font-size:11px">way 0</text>
<text x="0" y="373" style="fill:var(--muted);font-size:11px">way 1</text>
<text x="0" y="403" style="fill:var(--muted);font-size:11px">way 2</text>
<text x="0" y="433" style="fill:var(--muted);font-size:11px">way 3</text>
<g style="fill:none;stroke:var(--rule);stroke-width:1;stroke-dasharray:3 3"><rect x="102" y="356" width="40" height="26" rx="3"/><rect x="102" y="386" width="40" height="26" rx="3"/><rect x="146" y="386" width="40" height="26" rx="3"/><rect x="190" y="386" width="40" height="26" rx="3"/><rect x="234" y="386" width="40" height="26" rx="3"/><rect x="102" y="416" width="40" height="26" rx="3"/><rect x="146" y="416" width="40" height="26" rx="3"/><rect x="190" y="416" width="40" height="26" rx="3"/><rect x="234" y="416" width="40" height="26" rx="3"/><rect x="278" y="416" width="40" height="26" rx="3"/></g>
<g style="fill:var(--surface);stroke:var(--rule);stroke-width:1"><rect x="146" y="326" width="40" height="26" rx="3"/><rect x="234" y="326" width="40" height="26" rx="3"/><rect x="278" y="326" width="40" height="26" rx="3"/><rect x="322" y="326" width="40" height="26" rx="3"/><rect x="366" y="326" width="40" height="26" rx="3"/><rect x="410" y="326" width="40" height="26" rx="3"/><rect x="454" y="326" width="40" height="26" rx="3"/><rect x="498" y="326" width="40" height="26" rx="3"/><rect x="542" y="326" width="40" height="26" rx="3"/><rect x="630" y="326" width="40" height="26" rx="3"/><rect x="190" y="356" width="40" height="26" rx="3"/><rect x="278" y="356" width="40" height="26" rx="3"/><rect x="322" y="356" width="40" height="26" rx="3"/><rect x="366" y="356" width="40" height="26" rx="3"/><rect x="410" y="356" width="40" height="26" rx="3"/><rect x="454" y="356" width="40" height="26" rx="3"/><rect x="498" y="356" width="40" height="26" rx="3"/><rect x="542" y="356" width="40" height="26" rx="3"/><rect x="586" y="356" width="40" height="26" rx="3"/><rect x="322" y="386" width="40" height="26" rx="3"/><rect x="586" y="386" width="40" height="26" rx="3"/><rect x="630" y="386" width="40" height="26" rx="3"/><rect x="366" y="416" width="40" height="26" rx="3"/><rect x="410" y="416" width="40" height="26" rx="3"/><rect x="454" y="416" width="40" height="26" rx="3"/><rect x="498" y="416" width="40" height="26" rx="3"/><rect x="542" y="416" width="40" height="26" rx="3"/><rect x="586" y="416" width="40" height="26" rx="3"/><rect x="630" y="416" width="40" height="26" rx="3"/></g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"><rect x="102" y="326" width="40" height="26" rx="3"/><rect x="146" y="356" width="40" height="26" rx="3"/><rect x="278" y="386" width="40" height="26" rx="3"/><rect x="366" y="386" width="40" height="26" rx="3"/><rect x="410" y="386" width="40" height="26" rx="3"/><rect x="454" y="386" width="40" height="26" rx="3"/><rect x="498" y="386" width="40" height="26" rx="3"/><rect x="542" y="386" width="40" height="26" rx="3"/><rect x="322" y="416" width="40" height="26" rx="3"/></g>
<g style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2.5"><rect x="190" y="326" width="40" height="26" rx="3"/><rect x="586" y="326" width="40" height="26" rx="3"/><rect x="234" y="356" width="40" height="26" rx="3"/><rect x="630" y="356" width="40" height="26" rx="3"/></g>
<g style="fill:var(--ink);font-size:13px;font-weight:600" text-anchor="middle"><text x="116.4" y="343">A</text><text x="160.4" y="343">A</text><text x="204.4" y="343">A</text><text x="248.4" y="343">A</text><text x="292.4" y="343">A</text><text x="336.4" y="343">A</text><text x="380.4" y="343">A</text><text x="424.4" y="343">A</text><text x="468.4" y="343">A</text><text x="512.4" y="343">A</text><text x="556.4" y="343">A</text><text x="600.4" y="343">A</text><text x="644.4" y="343">A</text><text x="160.4" y="373">B</text><text x="204.4" y="373">B</text><text x="248.4" y="373">B</text><text x="292.4" y="373">B</text><text x="336.4" y="373">B</text><text x="380.4" y="373">B</text><text x="424.4" y="373">B</text><text x="468.4" y="373">B</text><text x="512.4" y="373">B</text><text x="556.4" y="373">B</text><text x="600.4" y="373">B</text><text x="644.4" y="373">B</text><text x="292.4" y="403">C</text><text x="336.4" y="403">C</text><text x="380.4" y="403">E</text><text x="424.4" y="403">F</text><text x="468.4" y="403">G</text><text x="512.4" y="403">H</text><text x="556.4" y="403">I</text><text x="600.4" y="403">I</text><text x="644.4" y="403">I</text><text x="336.4" y="433">D</text><text x="380.4" y="433">D</text><text x="424.4" y="433">D</text><text x="468.4" y="433">D</text><text x="512.4" y="433">D</text><text x="556.4" y="433">D</text><text x="600.4" y="433">D</text><text x="644.4" y="433">D</text></g>
<g style="fill:var(--muted);font-size:10px;font-family:var(--mono)" text-anchor="end"><text x="138" y="344">2</text><text x="182" y="344">2</text><text x="226" y="344">0</text><text x="270" y="344">0</text><text x="314" y="344">0</text><text x="358" y="344">0</text><text x="402" y="344">1</text><text x="446" y="344">1</text><text x="490" y="344">1</text><text x="534" y="344">1</text><text x="578" y="344">1</text><text x="622" y="344">0</text><text x="666" y="344">0</text><text x="182" y="374">2</text><text x="226" y="374">2</text><text x="270" y="374">0</text><text x="314" y="374">0</text><text x="358" y="374">0</text><text x="402" y="374">1</text><text x="446" y="374">1</text><text x="490" y="374">1</text><text x="534" y="374">1</text><text x="578" y="374">1</text><text x="622" y="374">1</text><text x="666" y="374">0</text><text x="314" y="404">2</text><text x="358" y="404">2</text><text x="402" y="404">3</text><text x="446" y="404">3</text><text x="490" y="404">3</text><text x="534" y="404">3</text><text x="578" y="404">3</text><text x="622" y="404">3</text><text x="666" y="404">3</text><text x="358" y="434">2</text><text x="402" y="434">3</text><text x="446" y="434">3</text><text x="490" y="434">3</text><text x="534" y="434">3</text><text x="578" y="434">3</text><text x="622" y="434">3</text><text x="666" y="434">3</text></g>
<g style="font-size:11px;font-weight:600" text-anchor="middle">
<text x="0" y="460" text-anchor="start" style="font-weight:400;fill:var(--muted)">result</text>
<text x="122" y="460" style="fill:var(--accent-red)">miss</text>
<text x="166" y="460" style="fill:var(--accent-red)">miss</text>
<text x="210" y="460" style="fill:var(--accent-green)">hit</text>
<text x="254" y="460" style="fill:var(--accent-green)">hit</text>
<text x="298" y="460" style="fill:var(--accent-red)">miss</text>
<text x="342" y="460" style="fill:var(--accent-red)">miss</text>
<text x="386" y="460" style="fill:var(--accent-red)">miss</text>
<text x="430" y="460" style="fill:var(--accent-red)">miss</text>
<text x="474" y="460" style="fill:var(--accent-red)">miss</text>
<text x="518" y="460" style="fill:var(--accent-red)">miss</text>
<text x="562" y="460" style="fill:var(--accent-red)">miss</text>
<text x="606" y="460" style="fill:var(--accent-green)">hit</text>
<text x="650" y="460" style="fill:var(--accent-green)">hit</text>
</g>
<g style="fill:var(--muted);font-size:11px" text-anchor="middle">
<text x="0" y="477" text-anchor="start">evicts</text>
<text x="386" y="477">C</text>
<text x="430" y="477">E</text>
<text x="474" y="477">F</text>
<text x="518" y="477">G</text>
<text x="562" y="477">H</text>
</g>
<g style="fill:var(--ink);font-size:10px;font-family:var(--mono)" text-anchor="middle">
<text x="0" y="494" text-anchor="start" style="font-family:var(--sans);font-size:11px;fill:var(--muted)">SHCT[P1]</text>
<text x="122" y="494">1</text>
<text x="166" y="494">1</text>
<text x="210" y="494">2</text>
<text x="254" y="494">3</text>
<text x="298" y="494">3</text>
<text x="342" y="494">3</text>
<text x="386" y="494">3</text>
<text x="430" y="494">3</text>
<text x="474" y="494">3</text>
<text x="518" y="494">3</text>
<text x="562" y="494">3</text>
<text x="606" y="494">4</text>
<text x="650" y="494">5</text>
</g>
<g style="fill:var(--ink);font-size:10px;font-family:var(--mono)" text-anchor="middle">
<text x="0" y="511" text-anchor="start" style="font-family:var(--sans);font-size:11px;fill:var(--muted)">SHCT[P2]</text>
<text x="122" y="511">1</text>
<text x="166" y="511">1</text>
<text x="210" y="511">1</text>
<text x="254" y="511">1</text>
<text x="298" y="511">1</text>
<text x="342" y="511">1</text>
<text x="386" y="511">0</text>
<text x="430" y="511">0</text>
<text x="474" y="511">0</text>
<text x="518" y="511">0</text>
<text x="562" y="511">0</text>
<text x="606" y="511">0</text>
<text x="650" y="511">0</text>
</g>
<g style="fill:var(--muted);font-size:11px">
<rect x="0" y="526" width="16" height="12" rx="2" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="22" y="536">filled on a miss</text>
<rect x="136" y="526" width="16" height="12" rx="2" style="fill:var(--surface);stroke:var(--accent-green);stroke-width:2.5"/><text x="158" y="536">hit</text>
<text x="194" y="536">small number = RRPV</text>
</g>
</svg></div>

<p><strong>Implementation.</strong> The load's PC hash must travel with the request to the LLC, which adds bits to every request message. Storage for a 2 MB, 16-way LLC with 64 B lines:</p>
<ul>
<li><strong>Per line:</strong> 32,768 lines × (14-bit signature + 1 outcome bit) = 491,520 bits = 60 KB.</li>
<li><strong>SHCT:</strong> 16K × 3 bits = 6 KB.</li>
<li><strong>Sampled version (SHiP-S):</strong> keep signatures and outcome bits only in 64 sampled sets: 64 × 16 × 15 bits = 15,360 bits, about 1.9 KB. The SHCT trained there sets the insertion RRPV for every set.</li>
</ul>
<p>The signature can also be a memory-region hash (SHiP-Mem) or a hash of the recent instruction sequence (SHiP-ISeq). Training happens on hits and evictions, off the hit path.</p>
<h4>Where SHiP Helps</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>Programs where reuse depends on the instruction: a streaming loop's load never sees reuse, a lookup into a hot table always does</li><li>Hot data plus scans issued from different code</li></ul></td><td><ul><li>CPU inference: the weight-streaming loads and the activation loads have different PCs</li><li>Databases: scan operators and index lookups are different code</li><li>520.omnetpp_r and 523.xalancbmk_r, where objects from some allocation sites are reused and others are not</li></ul></td></tr></table></div>
<h4>Where SHiP Hurts</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>One PC that loads both reused and single-use data, so its counter averages them</li><li>Prefetch-filled lines, which have no demand PC</li><li>More hot PCs than the SHCT can hold without aliasing</li></ul></td><td><ul><li>500.perlbench_r, whose interpreter loads all of the script's data from a few dispatch PCs</li><li>Library routines like <code>memcpy</code> called on both hot and cold buffers</li></ul></td></tr></table></div>

<h3 id="sec-hawkeye">Hawkeye</h3>
<p><strong>Motivation.</strong> The other policies guess what makes a line worth keeping. Hawkeye (Jain and Lin, ISCA 2016) asks what OPT would have done on recent accesses and learns which load PCs bring in lines that OPT keeps. It's the basis for later learned policies: Glider (MICRO 2019) adds a better offline-trained predictor, and Mockingjay (HPCA 2022) predicts reuse distances to mimic OPT's eviction order directly.</p>
<p><strong>How it works.</strong></p>
<ol>
<li><strong>OPTgen:</strong> for a small sample of sets, keep a history of past accesses about 8 times as long as the associativity. An occupancy vector holds one count per past time slot: how many lines OPT keeps cached across that slot. When a line is reused, look at the interval since its last access. If every slot is below capacity, OPT would have kept it, so OPT hits and every slot in the interval goes up by 1. If any slot is already full, OPT would have missed.</li>
<li><strong>Predictor:</strong> 3-bit counters indexed by a hash of the PC that last accessed the line. An OPT hit trains that PC up, and an OPT miss trains it down.</li>
<li><strong>Cache:</strong> on a fill or a hit, the predictor classifies the PC. Lines from cache-friendly PCs get RRPV 0, and the other friendly lines in the set age by 1. Lines from cache-averse PCs get RRPV 7, the 3-bit maximum. The victim is a line at RRPV 7 if there is one. Otherwise it's the oldest friendly line, and its PC is trained down, because the prediction was wrong.</li>
</ol>
<p><strong>Example.</strong> OPTgen on one sampled set, with a capacity of 2 lines to keep the vector short. A and B come from P1, C and D from P2. At slot 6, C's interval from slot 2 crosses slot 2, where OPT is already keeping two lines (A and B), so OPT would not have kept C and P2 is trained down:</p>
<div class="tbl"><svg viewBox="0 0 680 296" role="img" aria-label="OPTgen on one sampled set with a capacity of 2 lines and the accesses A B C A D B C A at time slots 0 to 7. A and B come from PC P1, C and D from PC P2. Each slot of the occupancy vector counts how many lines OPT keeps cached across that slot. At slot 3, A's interval from slot 0 has every slot below 2, so OPT hits and slots 0 to 2 go up by 1, training P1 up. At slot 5, B's interval from slot 1 fits, so OPT hits and P1 trains up again. At slot 6, C's interval from slot 2 includes a slot already at 2, so OPT misses and P2 trains down. At slot 7, A's interval from slot 3 fits, so OPT hits and P1 trains up." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<text x="0" y="16" style="fill:var(--ink);font-size:13px;font-weight:600">OPTgen on one sampled set, capacity 2 lines</text>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle"><text x="0" y="34" text-anchor="start">time slot</text><text x="139" y="34">0</text><text x="177" y="34">1</text><text x="215" y="34">2</text><text x="253" y="34">3</text><text x="291" y="34">4</text><text x="329" y="34">5</text><text x="367" y="34">6</text><text x="405" y="34">7</text></g>
<g style="fill:var(--ink);font-size:12px;font-weight:600" text-anchor="middle"><text x="0" y="48" text-anchor="start" style="font-weight:400;font-size:11px;fill:var(--muted)">access, PC</text><text x="139" y="48">A<tspan style="font-weight:400;font-size:9px;fill:var(--muted)"> P1</tspan></text><text x="177" y="48">B<tspan style="font-weight:400;font-size:9px;fill:var(--muted)"> P1</tspan></text><text x="215" y="48">C<tspan style="font-weight:400;font-size:9px;fill:var(--muted)"> P2</tspan></text><text x="253" y="48">A<tspan style="font-weight:400;font-size:9px;fill:var(--muted)"> P1</tspan></text><text x="291" y="48">D<tspan style="font-weight:400;font-size:9px;fill:var(--muted)"> P2</tspan></text><text x="329" y="48">B<tspan style="font-weight:400;font-size:9px;fill:var(--muted)"> P1</tspan></text><text x="367" y="48">C<tspan style="font-weight:400;font-size:9px;fill:var(--muted)"> P2</tspan></text><text x="405" y="48">A<tspan style="font-weight:400;font-size:9px;fill:var(--muted)"> P1</tspan></text></g>
<text x="0" y="74" style="fill:var(--muted);font-size:11px">after A at 0</text>
<g style="fill:var(--ink);font-size:12px;font-family:var(--mono)" text-anchor="middle"><text x="139" y="74">0</text></g>
<text x="436" y="74" style="fill:var(--muted);font-size:11px;font-weight:400">first use</text>
<text x="0" y="98" style="fill:var(--muted);font-size:11px">after B at 1</text>
<g style="fill:var(--ink);font-size:12px;font-family:var(--mono)" text-anchor="middle"><text x="139" y="98">0</text><text x="177" y="98">0</text></g>
<text x="436" y="98" style="fill:var(--muted);font-size:11px;font-weight:400">first use</text>
<text x="0" y="122" style="fill:var(--muted);font-size:11px">after C at 2</text>
<g style="fill:var(--ink);font-size:12px;font-family:var(--mono)" text-anchor="middle"><text x="139" y="122">0</text><text x="177" y="122">0</text><text x="215" y="122">0</text></g>
<text x="436" y="122" style="fill:var(--muted);font-size:11px;font-weight:400">first use</text>
<text x="0" y="146" style="fill:var(--muted);font-size:11px">after A at 3</text>
<rect x="121" y="131" width="112" height="22" rx="3" style="fill:none;stroke:var(--accent-green);stroke-width:2"/>
<g style="fill:var(--ink);font-size:12px;font-family:var(--mono)" text-anchor="middle"><text x="139" y="146">1</text><text x="177" y="146">1</text><text x="215" y="146">1</text><text x="253" y="146">0</text></g>
<text x="436" y="146" style="fill:var(--accent-green);font-size:11px;font-weight:600">OPT hit: P1 + 1</text>
<text x="0" y="170" style="fill:var(--muted);font-size:11px">after D at 4</text>
<g style="fill:var(--ink);font-size:12px;font-family:var(--mono)" text-anchor="middle"><text x="139" y="170">1</text><text x="177" y="170">1</text><text x="215" y="170">1</text><text x="253" y="170">0</text><text x="291" y="170">0</text></g>
<text x="436" y="170" style="fill:var(--muted);font-size:11px;font-weight:400">first use</text>
<text x="0" y="194" style="fill:var(--muted);font-size:11px">after B at 5</text>
<rect x="159" y="179" width="150" height="22" rx="3" style="fill:none;stroke:var(--accent-green);stroke-width:2"/>
<g style="fill:var(--ink);font-size:12px;font-family:var(--mono)" text-anchor="middle"><text x="139" y="194">1</text><text x="177" y="194">2</text><text x="215" y="194">2</text><text x="253" y="194">1</text><text x="291" y="194">1</text><text x="329" y="194">0</text></g>
<text x="436" y="194" style="fill:var(--accent-green);font-size:11px;font-weight:600">OPT hit: P1 + 1</text>
<text x="0" y="218" style="fill:var(--muted);font-size:11px">after C at 6</text>
<rect x="197" y="203" width="150" height="22" rx="3" style="fill:none;stroke:var(--accent-red);stroke-width:2"/>
<g style="fill:var(--ink);font-size:12px;font-family:var(--mono)" text-anchor="middle"><text x="139" y="218">1</text><text x="177" y="218">2</text><text x="215" y="218">2</text><text x="253" y="218">1</text><text x="291" y="218">1</text><text x="329" y="218">0</text><text x="367" y="218">0</text></g>
<text x="436" y="218" style="fill:var(--accent-red);font-size:11px;font-weight:600">OPT miss: P2 − 1</text>
<text x="0" y="242" style="fill:var(--muted);font-size:11px">after A at 7</text>
<rect x="235" y="227" width="150" height="22" rx="3" style="fill:none;stroke:var(--accent-green);stroke-width:2"/>
<g style="fill:var(--ink);font-size:12px;font-family:var(--mono)" text-anchor="middle"><text x="139" y="242">1</text><text x="177" y="242">2</text><text x="215" y="242">2</text><text x="253" y="242">2</text><text x="291" y="242">2</text><text x="329" y="242">1</text><text x="367" y="242">1</text><text x="405" y="242">0</text></g>
<text x="436" y="242" style="fill:var(--accent-green);font-size:11px;font-weight:600">OPT hit: P1 + 1</text>
<g style="fill:var(--muted);font-size:11px"><rect x="0" y="260" width="16" height="12" rx="2" style="fill:none;stroke:var(--accent-green);stroke-width:2"/><text x="22" y="270">interval fits (every slot below 2): OPT keeps the line, add 1 across it</text>
<rect x="0" y="278" width="16" height="12" rx="2" style="fill:none;stroke:var(--accent-red);stroke-width:2"/><text x="22" y="288">some slot already at 2: OPT would not have kept the line</text></g>
</svg></div>
<p>After this short history P1's counter has gone up three times and P2's down once, so lines loaded by P1 would be inserted as cache-friendly and lines from P2 as cache-averse.</p>

<p><strong>Implementation.</strong> Three structures, all off the hit path:</p>
<ul>
<li><strong>Sampler:</strong> a few dozen sampled sets (64 in the paper), each with a history of 8 × N past accesses holding a partial tag, a PC hash, and a timestamp.</li>
<li><strong>OPTgen:</strong> an occupancy vector of 8 × N small counters per sampled set, 128 entries for a 16-way cache, updated as shown above.</li>
<li><strong>Predictor:</strong> a table of 3-bit counters indexed by a PC hash.</li>
</ul>
<p>The cache itself keeps a 3-bit RRPV per line. As with SHiP, the PC must accompany each request to the LLC, and the tables total tens of KB for a 2 MB LLC.</p>
<h4>Where Hawkeye Helps</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>Complex reuse that correlates with the load PC but follows no simple recency or frequency rule</li><li>Mixes of scans, thrashing loops, and hot data in one program</li></ul></td><td><ul><li>505.mcf_r and 520.omnetpp_r, where learned policies close much of the gap between LRU and OPT</li><li>Database and graph-analytics LLC traffic</li></ul></td></tr></table></div>
<h4>Where Hawkeye Hurts</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>Heavy prefetching: OPT ignores prefetch timeliness (Harmony, ISCA 2018, fixes this)</li><li>PCs that load both reused and single-use data</li><li>Phases shorter than the sampler's training time</li></ul></td><td><ul><li>519.lbm_r with aggressive stream prefetching</li><li>500.perlbench_r's interpreter loads</li></ul></td></tr></table></div>

<h3>The Math</h3>
<ul>
<li><strong>True LRU state:</strong> log<sub>2</sub>(N!) bits per set at minimum: 8 ways → 16 bits, 16 ways → 45 bits. Practical implementations use more.</li>
<li><strong>Tree PLRU:</strong> N − 1 bits: 7 bits for 8 ways.</li>
<li><strong>RRIP:</strong> 2 bits per line: 16 bits for 8 ways.</li>
<li><strong>NRU:</strong> 1 bit per line: 8 bits for 8 ways.</li>
<li><strong>FIFO:</strong> a log<sub>2</sub>(N)-bit pointer per set: 3 bits for 8 ways.</li>
<li><strong>SHiP:</strong> RRIP's 2 bits plus a 14-bit signature and an outcome bit per line, and a 16K × 3-bit SHCT (6 KB).</li>
</ul>
<h3>Power, Performance, Area</h3>
<ul><li><strong>Performance:</strong> can be worth as much as a sizeable capacity increase for thrashing or scanning workloads, and zero for workloads that fit.</li><li><strong>Power:</strong> state updates on every hit, small next to data access.</li><li><strong>Area:</strong> a few bits per line or set, plus predictor tables for learned policies. Usually off the hit critical path.</li></ul>
<h3>By Access Pattern</h3>
<p>The patterns are the ones on <a href="#/cache-patterns">Workload Access Patterns</a>. Each entry agrees with the "Where It Helps" and "Where It Hurts" tables above.</p>
<div class="tbl"><table><tr><th>Access Pattern</th><th>Best Policies</th><th>Worst Policies</th></tr>
<tr><td><a href="#/cache-patterns/stream">Sequential streaming</a></td><td>The stream gets no hits under any policy, so choose one that keeps it from flushing other data: BRRIP, SHiP, or non-temporal hints that insert at the LRU position.</td><td>LRU, tree PLRU, and NRU: every stream line enters fully protected and pushes useful lines out.</td></tr>
<tr><td><a href="#/cache-patterns/strided">Strided access</a></td><td>LRU or tree PLRU, once padding or hashed indexing has removed the conflicts.</td><td>None stands out: when far more lines map to a set than it has ways, no policy helps. Fix the mapping instead.</td></tr>
<tr><td><a href="#/cache-patterns/hot">Small hot working sets</a></td><td>LRU or tree PLRU. Nothing needs evicting, so the cheapest policy wins.</td><td><ul><li>Random and FIFO in low-associativity caches, which can evict the hottest line</li><li>BIP, which only adds risk when everything fits</li></ul></td></tr>
<tr><td><a href="#/cache-patterns/tiled">Blocked and tiled loops</a></td><td>LRU or tree PLRU. Reuse within a tile is short-range recency.</td><td>LIP, BIP, and BRRIP: new lines start unprotected, so some are evicted before their reuse in the tile.</td></tr>
<tr><td><a href="#/cache-patterns/pointer">Pointer chasing</a></td><td><ul><li>SHiP and Hawkeye, which learn which load PCs fetch reused nodes</li><li>BRRIP or Random for repeated traversals of a structure larger than the cache</li></ul></td><td>LRU and tree PLRU on repeated traversals larger than the cache, which behave as cyclic loops.</td></tr>
<tr><td><a href="#/cache-patterns/random">Random hash lookups</a></td><td><ul><li>Uniform keys: all policies get about the same hit rate, so choose the cheapest</li><li>Skewed keys: LFU-style counters, or SRRIP with frequency priority</li></ul></td><td>PC-based predictors (SHiP, Hawkeye) gain nothing: every probe comes from the same few lookup PCs, so the reuse depends on the key, not the instruction.</td></tr>
<tr><td><a href="#/cache-patterns/ifetch">Instruction fetch</a></td><td><ul><li>L1I: LRU or tree PLRU</li><li>L2 and LLC: policies that protect code from data scans, such as EMISSARY</li></ul></td><td>LRU-like policies in a shared L2 or LLC, where data scans flush hot code.</td></tr>
<tr><td><a href="#/cache-patterns/thrash">Cyclic loops larger than the cache</a></td><td>LIP, BIP, and BRRIP, which keep a fixed part of the loop, or DIP and DRRIP, which choose them automatically. Random also beats LRU.</td><td>LRU, tree PLRU, FIFO, and SRRIP: each line is evicted just before its reuse, so they get no hits.</td></tr>
<tr><td><a href="#/cache-patterns/scan">Hot data plus scans</a></td><td>SRRIP (a new line must be reused before it outranks the hot set), BRRIP, SHiP, Hawkeye, and LFU.</td><td>LRU, tree PLRU, and NRU, which give scans no protection, and FIFO, which evicts the hottest line every N fills.</td></tr>
<tr><td><a href="#/cache-patterns/shared">Shared and producer-consumer data</a></td><td>No policy decides the shared lines' misses. The coherence protocol does, through cache-to-cache forwarding and directory latency.</td><td>In an inclusive LLC, policies that age unused lines fast (BRRIP) can evict the cores' private hot data, which never hits in the LLC, and back-invalidate it.</td></tr>
</table></div>
<h3>By Workload</h3>
<div class="tbl"><table><tr><th>Workload</th><th>Effect</th></tr>
<tr><td>Compute-bound</td><td>No effect, since everything fits.</td></tr>
<tr><td>Large code footprint</td><td>Matters in L2/LLC. Code competes with data, and protecting hot code helps the frontend.</td></tr>
<tr><td>Branch-heavy integer</td><td>Small to moderate gains.</td></tr>
<tr><td>Blocked numerics</td><td>LRU works well when tiles fit, so there is little to gain.</td></tr>
<tr><td>ML inference</td><td>Streaming weights pollute LRU caches. Insertion-at-LRU keeps activations resident.</td></tr>
<tr><td>Multithreaded shared data</td><td>One streaming thread can evict everyone's data in a shared LLC. RRIP or partitioning protects the others.</td></tr>
</table></div>`,
  practice: {
    guided: [
      {
        q: `<p>A 4-entry fully associative cache sees the repeating pattern A B C D E A B C D E. What's the hit rate with LRU? With LRU insertion (new lines inserted at the LRU position, promoted to MRU on a hit)?</p>`,
        a: `<ol><li>LRU: each access evicts the line needed four accesses later, the next one in the cycle. <strong>0% hits.</strong></li><li>LRU insertion: after A B C D fill, E evicts D and is inserted at LRU. A, B, C then hit and move to MRU. D misses and evicts E (still at LRU), and E misses and evicts D.</li><li>Steady state: A, B, and C hit, and D and E miss. <strong>3 / 5 = 60% hits.</strong> Keeping part of a too-large working set beats losing all of it.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>What is Belady's optimal policy, why can't hardware implement it, and how do modern policies approximate it?</p>`,
        a: `<p>Belady's OPT evicts the line whose next use is furthest in the future. It gives the minimum possible misses but needs future knowledge. Approximations: RRIP predicts re-reference distance with a small counter per line and inserts new lines as "distant" for scan resistance. Hawkeye replays recent history to compute what OPT would have done and trains a PC-based predictor to classify loads as cache-friendly or cache-averse.</p>`
      }
    ]
  }
},

{
  id: "cache-write",
  region: "ctr",
  title: "Write Policies",
  sections: [
    { id: "wb", label: "Write-Back" },
    { id: "wt", label: "Write-Through" },
    { id: "wa", label: "Write-Allocate" },
    { id: "nwa", label: "No-Write-Allocate and Non-Temporal Stores" },
    { id: "wc", label: "Write-Combining Buffers" }
  ],
  body: `
<h3>What It Changes</h3>
<ul>
<li><strong>Write-back vs. write-through:</strong> whether a store updates only the cache (written back on eviction) or also the next level immediately.</li>
<li><strong>Write-allocate vs. no-write-allocate:</strong> whether a store miss brings the line into the cache.</li>
<li><strong>Write-combining buffers</strong> merge stores to the same line before sending them out.</li>
</ul>

<h3 id="sec-wb">Write-Back</h3>
<p><strong>Motivation.</strong> Stores to the same line are absorbed by the cache and reach the next level once, at eviction. That saves bandwidth and energy for every line written more than once.</p>
<p><strong>How it works.</strong> A store updates the cached line and sets its dirty bit. When a dirty line is evicted, it is written to the next level. A clean line is simply dropped.</p>
<p><strong>Example.</strong> A loop that adds 1,000 values into one 8-byte accumulator in memory makes 1,000 stores. Write-back sends one 64-byte line to L2 when the line is eventually evicted. Write-through would send 1,000 8-byte writes.</p>
<p><strong>Implementation.</strong> A dirty bit per line (or per sector), a writeback buffer that holds victims while the new line fills, and ECC rather than parity, since a dirty line is the only copy of its data. The coherence protocol must be able to fetch dirty data from the owning cache.</p>
<h4>Where Write-Back Helps</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>Repeated stores to the same lines: accumulators, stack frames, hot objects</li><li><a href="#/cache-patterns/tiled">Tiled loops</a> whose output tile stays in cache while it accumulates</li></ul></td><td><ul><li>DGEMM's C tile</li><li>531.deepsjeng_r's search-state updates</li><li>500.perlbench_r's stack and heap updates</li></ul></td></tr></table></div>
<h4>Where Write-Back Hurts</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li><a href="#/cache-patterns/shared">Producer-consumer data</a>, where the dirty line must be fetched from the producer's cache by every consumer</li><li>Bulk output written once, which is evicted dirty after a pointless stay</li></ul></td><td><ul><li>PARSEC dedup's pipeline queues</li><li>Large <code>memset</code> calls</li></ul></td></tr></table></div>

<h3 id="sec-wt">Write-Through</h3>
<p><strong>Motivation.</strong> The next level always has current data. The cache never holds the only copy, so it needs only parity, and coherence is simpler because remote requests never need data from it.</p>
<p><strong>How it works.</strong> Every store updates the cache (if the line is present) and is also sent to the next level, usually through a store-merging buffer that combines stores to the same line first.</p>
<p><strong>Example.</strong> AMD's Bulldozer made its L1D write-through to the L2, with a 4 KB write-coalescing cache between them to absorb repeated stores. IBM's POWER cores also use store-through L1 data caches. GPU L1 caches are usually write-through for global memory.</p>
<p><strong>Implementation.</strong> Parity per line, no dirty bits, a store-merging buffer, and an L2 (or coalescing cache) that can absorb the store bandwidth of the core.</p>
<h4>Where Write-Through Helps</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>Read-mostly access with few stores</li><li><a href="#/cache-patterns/shared">Shared data</a> read by other cores soon after it is written</li></ul></td><td><ul><li>505.mcf_r</li><li>GPU kernels that write results once</li><li>Producer-consumer queues between cores</li></ul></td></tr></table></div>
<h4>Where Write-Through Hurts</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>Repeated stores that rewrite the same lines</li><li>Stack-heavy code with many spills and reloads</li></ul></td><td><ul><li>500.perlbench_r</li><li>Histogram and counter updates</li><li>Accumulating GEMM output tiles</li></ul></td></tr></table></div>

<h3 id="sec-wa">Write-Allocate</h3>
<p><strong>Motivation.</strong> A store to a line is often followed by more loads and stores to the same line. Bringing the line in on a store miss makes those hits.</p>
<p><strong>How it works.</strong> A store miss fetches the line with a read-for-ownership (RFO) request, which also invalidates other cores' copies. The store then merges into the line in the cache.</p>
<p><strong>Example.</strong> A <code>memset</code> of 256 MB with ordinary stores reads 256 MB from memory through RFOs and later writes 256 MB back: 512 MB of traffic to write 256 MB.</p>
<p><strong>Implementation.</strong> The store waits in the store buffer while the RFO completes, then writes into the filled line. Some designs detect stores that will overwrite a whole line and skip the read: Intel's fast-string <code>rep stosb</code> and <code>rep movsb</code> can use full-line writes that request ownership without data.</p>
<h4>Where Write-Allocate Helps</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>Read-modify-write updates</li><li>Partial-line stores followed by loads to the same line</li><li>Small working sets where the written lines are reused</li></ul></td><td><ul><li>Hash-table inserts and updates</li><li>Histograms</li><li>525.x264_r's reconstructed-frame updates</li></ul></td></tr></table></div>
<h4>Where Write-Allocate Hurts</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li><a href="#/cache-patterns/stream">Streaming writes</a> of full lines that are never read back soon: the RFO doubles the traffic</li><li>Output buffers larger than the cache, which also evict useful data</li></ul></td><td><ul><li>Large <code>memset</code> and <code>memcpy</code> destinations</li><li>519.lbm_r writing its destination grid each time step</li><li>STREAM copy and triad outputs</li></ul></td></tr></table></div>

<h3 id="sec-nwa">No-Write-Allocate and Non-Temporal Stores</h3>
<p><strong>Motivation.</strong> Data written once and not read soon shouldn't cost a read or occupy the cache. Sending it straight to memory halves the traffic of a streaming write and leaves the cache to useful data.</p>
<p><strong>How it works.</strong> A store miss doesn't allocate: the data goes to the next level, usually through write-combining buffers. On x86, non-temporal stores (<code>movntdq</code>, <code>vmovntps</code>) request this per instruction, and also evict the line from the caches if it is present. They are weakly ordered, so code needs an <code>sfence</code> before publishing the data to other threads.</p>
<p><strong>Example.</strong> The 256 MB <code>memset</code> above, done with non-temporal stores: 256 MB of writes and no reads, half the traffic. STREAM results are reported with and without them for this reason.</p>
<p><strong>Implementation.</strong> Stores bypass allocation and gather in write-combining buffers. Full lines go out as single writes. A partial line must be written with byte enables, and memory with ECC then needs a read-modify-write.</p>
<h4>Where Non-Temporal Stores Help</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li><a href="#/cache-patterns/stream">Large output buffers</a> written once, in full lines</li><li>Writes from one stage that the next stage won't read for a long time</li></ul></td><td><ul><li><code>memset</code> and <code>memcpy</code> larger than the LLC</li><li>519.lbm_r's destination grid</li><li>Video frames written for display or encoding</li></ul></td></tr></table></div>
<h4>Where Non-Temporal Stores Hurt</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>Data read back soon, which must now come from DRAM</li><li>Partial-line or scattered writes, which flush half-filled buffers</li><li>Output buffers that fit in the cache</li></ul></td><td><ul><li>A 64 KB <code>memcpy</code> whose destination is used right away</li><li>Scatter updates in sparse codes</li><li>Small message buffers in RPC frameworks</li></ul></td></tr></table></div>

<h3 id="sec-wc">Write-Combining Buffers</h3>
<p><strong>Motivation.</strong> Sending each store separately wastes bandwidth on headers and partial transfers. Gathering stores to the same line and sending one full line uses the bus efficiently.</p>
<p><strong>How it works.</strong> Each buffer holds one line's data and a byte mask. Stores to that line merge into it. When the line is complete, or the buffer is needed for another line, or a fence arrives, the buffer is written out: as one full-line write if every byte is valid, otherwise as partial writes.</p>
<p><strong>Example.</strong> Intel cores use the L1D fill buffers as write-combining buffers for non-temporal stores and for memory mapped as write-combining, such as a GPU frame buffer. Sandy Bridge had 10 of them, so a loop writing 12 output arrays with non-temporal stores keeps evicting partly filled buffers.</p>
<p><strong>Implementation.</strong> A small fully associative array of line-sized buffers with byte masks, an address compare per buffer for each store, and logic to evict on full, on fence, or on pressure. It is shared with miss handling, so heavy non-temporal store traffic competes with load misses.</p>
<h4>Where Write-Combining Helps</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>Sequential stores that fill whole lines</li><li>Writes to device memory mapped as write-combining</li><li>A few output streams at a time</li></ul></td><td><ul><li>Non-temporal <code>memcpy</code></li><li>Graphics drivers filling GPU command and vertex buffers</li><li>STREAM with non-temporal stores</li></ul></td></tr></table></div>
<h4>Where Write-Combining Hurts</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>More concurrent output streams than buffers</li><li>Scattered stores to many different lines</li><li>Stores interleaved with frequent fences, which flush buffers before they fill</li></ul></td><td><ul><li>Stencil codes writing 12 or more output arrays with non-temporal stores</li><li>Scatter phases of radix sort</li><li>Lock-heavy server code that fences on every release</li></ul></td></tr></table></div>
<h3>The Math</h3>
<p>For write-through, traffic ∝ number of stores. For write-back, traffic ∝ dirty evictions. With write-allocate, a store miss to a line that is fully overwritten still costs a read: a full-line write is 2× the traffic unless the hardware detects it.</p>
<h3>Power, Performance, Area</h3>
<ul><li><strong>Write-back:</strong> least traffic and energy, but needs dirty bits and more careful coherence and error correction.</li><li><strong>Write-through:</strong> simpler, but bandwidth and energy grow with store count.</li><li><strong>Write-combining:</strong> a small buffer area that saves a lot of bandwidth.</li></ul>
<h3>By Workload</h3>
<div class="tbl"><table><tr><th>Workload</th><th>Effect</th></tr>
<tr><td>Compute-bound</td><td>Little effect.</td></tr>
<tr><td>Pointer chasing</td><td>Mostly reads, so little effect.</td></tr>
<tr><td>Streaming</td><td>Large effect: output arrays written once should bypass allocation (non-temporal stores).</td></tr>
<tr><td>Large code footprint</td><td>No effect on instruction fetch.</td></tr>
<tr><td>Branch-heavy integer</td><td>Write-back absorbs repeated updates to hot data.</td></tr>
<tr><td>Blocked numerics</td><td>Write-back keeps the output tile in cache while it accumulates.</td></tr>
<tr><td>ML inference</td><td>Activation outputs are rewritten repeatedly, so write-back is essential.</td></tr>
<tr><td>Multithreaded shared data</td><td>Dirty lines must be supplied by their owner on a remote read. Write-through to a shared level can simplify sharing at a bandwidth cost.</td></tr>
</table></div>`,
  practice: {
    guided: [
      {
        q: `<p>A loop stores 1 GB once and never reads it back. Compare memory traffic with write-allocate versus no-write-allocate (or non-temporal stores).</p>`,
        a: `<ol><li>Write-allocate: each line is first read from memory (1 GB read), then written back when evicted (1 GB written): <strong>2 GB</strong> of traffic.</li><li>No-write-allocate or non-temporal stores: writes go straight out through write-combining buffers: <strong>1 GB</strong>.</li><li>Half the traffic, and the cache isn't polluted with lines nobody reads.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Why are L1 data caches almost always write-back, while some designs make L1 write-through to an L2?</p>`,
        a: `<p>Write-back absorbs repeated stores to the same line, saving bandwidth and energy. Write-through to L2 simplifies coherence and error handling: L1 lines are never dirty, so the L2 always has current data and L1 can use simple parity. It works only if the L2 can absorb the store bandwidth, usually with a store-merging buffer between them.</p>`
      }
    ]
  }
},

{
  id: "cache-banking",
  region: "ctr",
  title: "Banking and Bank Size",
  sections: [
    { id: "few", label: "Few, Large Banks" },
    { id: "many", label: "Many, Small Banks" },
    { id: "slices", label: "Distributed LLC Slices" },
    { id: "ports", label: "Multiporting and Replication" }
  ],
  body: `
<h3>What It Changes</h3>
<p>A banked cache splits its array into independent pieces, letting several accesses proceed at once. Bank size trades access speed against overhead.</p>

<h3 id="sec-few">Few, Large Banks</h3>
<p><strong>Motivation.</strong> The densest, cheapest array. Every bank needs its own decoders, sense amplifiers, and drivers, so fewer banks put more of the area into storage.</p>
<p><strong>How it works.</strong> One or two address bits pick the bank. Accesses to different banks in the same cycle proceed together, and two to the same bank serialize.</p>
<p><strong>Example.</strong> With 2 banks and 2 random accesses per cycle, the chance of a conflict is 1/2: half the cycles lose one access. With 1 access per cycle there is never a conflict, which is why caches serving one request per cycle, like most L1Is and L2s, can use few banks.</p>
<p><strong>Implementation.</strong> Long wordlines and bitlines in each bank, so access time and energy per access are higher than for small banks. The crossbar between banks and ports is small.</p>
<h4>Where Few Large Banks Help</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>Code issuing at most one access per cycle to the cache</li><li><a href="#/cache-patterns/pointer">Pointer chasing</a>, whose dependent loads rarely issue together</li><li><a href="#/cache-patterns/ifetch">Instruction fetch</a> through a single fetch port</li></ul></td><td><ul><li>505.mcf_r</li><li>B-tree index lookups in databases</li><li>L1I traffic of any program</li></ul></td></tr></table></div>
<h4>Where Few Large Banks Hurt</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>Loops issuing 2 or more loads per cycle</li><li>Vector code with gathers</li></ul></td><td><ul><li>STREAM triad at 2 loads per cycle</li><li>508.namd_r and 538.imagick_r vectorized kernels</li></ul></td></tr></table></div>

<h3 id="sec-many">Many, Small Banks</h3>
<p><strong>Motivation.</strong> Wide out-of-order cores issue 2 or 3 loads per cycle. Many banks make conflicts rare without the area of true multiporting, and small banks are faster and use less energy per access.</p>
<p><strong>How it works.</strong> Low-order address bits (within or just above the line offset) pick the bank, so consecutive words or lines spread across banks. A conflict delays one access by a cycle, or replays it.</p>
<p><strong>Example.</strong> Sandy Bridge's L1D was split into banks by address bits within the line, and two loads to the same bank in different lines conflicted (Agner Fog's microarchitecture guide). Haswell removed these conflicts. With 16 random banks, 2 accesses conflict 1/16 = 6.25% of the time, and 3 accesses 1 − (16 × 15 × 14) / 16<sup>3</sup> ≈ 18%.</p>
<p><strong>Implementation.</strong> A bank-select decoder per port, conflict detection that compares the bank bits of all accesses issued in a cycle, and a crossbar from banks to load ports. The scheduler must replay or delay the losing access, which complicates load-latency speculation.</p>
<h4>Where Many Small Banks Help</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>High load bandwidth: 2 to 3 loads per cycle</li><li><a href="#/cache-patterns/stream">Streams</a> whose consecutive accesses fall in different banks</li><li><a href="#/cache-patterns/tiled">Tiled numerics</a> with padded leading dimensions</li></ul></td><td><ul><li>DGEMM and convolution kernels</li><li>STREAM</li><li>525.x264_r's SIMD loops</li></ul></td></tr></table></div>
<h4>Where Many Small Banks Hurt</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>Several arrays with the same alignment, so every access in a cycle picks the same bank</li><li><a href="#/cache-patterns/strided">Strides</a> that are multiples of the bank interleave</li></ul></td><td><ul><li>Unpadded DGEMM with a 1024-element leading dimension</li><li>Unpadded matrix transpose</li></ul></td></tr></table></div>

<h3 id="sec-slices">Distributed LLC Slices</h3>
<p><strong>Motivation.</strong> One central LLC can't supply bandwidth to dozens of cores. Splitting it into slices, one near each core, scales bandwidth with the core count and spreads the traffic over the on-chip network.</p>
<p><strong>How it works.</strong> A hash of many physical address bits picks the slice, so consecutive lines and common strides spread evenly. Each slice has its own tags, data, and controller, which also acts as the coherence home for its lines. Latency depends on the distance from the core to the slice.</p>
<p><strong>Example.</strong> Skylake-SP has a 1.375 MB L3 slice next to each core on a mesh, and Sapphire Rapids 1.875 MB. A lock word lives on exactly one slice, so every core contending for it sends its requests to that one slice.</p>
<p><strong>Implementation.</strong> A slice hash in each core's request path (undocumented by Intel, reverse-engineered by Maurice and colleagues, RAID 2015), mesh or ring stops at each slice, and a per-slice snoop filter or directory.</p>
<h4>Where Sliced LLCs Help</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>Many cores each streaming or missing independently</li><li>Data spread over many lines, which the hash spreads over slices</li></ul></td><td><ul><li>SPECrate runs of 519.lbm_r on every core</li><li>Multi-tenant cloud servers</li><li>Parallel graph analytics</li></ul></td></tr></table></div>
<h4>Where Sliced LLCs Hurt</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>A few <a href="#/cache-patterns/shared">hot shared lines</a> (locks, counters), which all land on one slice</li><li>Dependent misses from one thread to lines that hash to far slices</li></ul></td><td><ul><li>A global spinlock in a database or the kernel</li><li>Shared reference counts in multithreaded allocators</li></ul></td></tr></table></div>

<h3 id="sec-ports">Multiporting and Replication</h3>
<p><strong>Motivation.</strong> The alternatives to banking when conflicts are unacceptable: give every cell more ports, run the array twice per cycle, or keep two copies.</p>
<p><strong>How it works.</strong></p>
<ul>
<li><strong>Multiported cells:</strong> each SRAM cell gets extra wordlines and bitlines (an 8-transistor cell adds a separate read port), so any two addresses can be read at once.</li>
<li><strong>Double pumping:</strong> the array runs at twice the core clock and serves one access per half cycle.</li>
<li><strong>Replication:</strong> two identical copies each serve one read. A store writes both.</li>
</ul>
<p><strong>Example.</strong> The Alpha 21264 double-pumped its 64 KB L1D to serve two loads per cycle. A true dual-ported array costs roughly 1.5 to 2 times the area of a single-ported one, and replication costs 2 times.</p>
<p><strong>Implementation.</strong> Multiporting grows each cell and slows every access. Double pumping needs an array fast enough for half a cycle, which limits it as clocks rise. Replication needs every store to update both copies in the same cycle.</p>
<h4>Where Multiporting and Replication Help</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>Read-heavy code that issues 2 or more loads per cycle with unpredictable addresses</li><li>Small hot working sets, which fit in a structure small enough to replicate</li></ul></td><td><ul><li>Gathers in vectorized 508.namd_r</li><li>AES and CRC table lookups</li></ul></td></tr></table></div>
<h4>Where Multiporting and Replication Hurt</h4>
<div class="tbl"><table class="halves"><tr><th>Access Patterns</th><th>Workloads</th></tr><tr><td><ul><li>Store-heavy access, which must write every copy</li><li>Large working sets, which need a structure too big to multiport or replicate</li></ul></td><td><ul><li><code>memset</code> and other bulk stores</li><li>Server workloads with multi-MB working sets</li></ul></td></tr></table></div>

<h3>The Math</h3>
<ul>
<li><strong>Conflict probability</strong> with k random accesses over B banks: 1 − B! / ((B − k)! × B<sup>k</sup>).</li>
<li><strong>Bank selection:</strong> bank = some address bits (low line bits for spreading sequential accesses), often XOR-hashed with higher bits.</li>
<li><strong>Bank size</strong> = cache size / banks. Smaller banks have shorter wordlines and bitlines, so they are faster and use less energy per access.</li>
</ul>
<h3>Power, Performance, Area</h3>
<ul>
<li><strong>More, smaller banks:</strong> more parallelism, faster and lower-energy access per bank, but each bank needs its own decoders, sense amplifiers, and drivers, and a wider crossbar connects banks to ports. Overhead area and routing rise.</li>
<li><strong>Fewer, larger banks:</strong><ul><li>Denser, with less overhead</li><li>Slower, with more conflicts</li></ul></li>
<li><strong>Versus multiporting:</strong> banking gives most of the bandwidth at far lower area than adding ports to every cell.</li>
</ul>
<h3>By Workload</h3>
<div class="tbl"><table><tr><th>Workload</th><th>Effect</th></tr>
<tr><td>Compute-bound</td><td>Little effect: few memory ops per cycle.</td></tr>
<tr><td>Pointer chasing</td><td>Little effect: dependent loads rarely issue in the same cycle.</td></tr>
<tr><td>Streaming</td><td>Sequential lines spread across banks well, but several arrays with identically aligned bases can hit the same bank every cycle.</td></tr>
<tr><td>Large code footprint</td><td>I-caches usually serve one fetch per cycle, so banking matters less.</td></tr>
<tr><td>Branch-heavy integer</td><td>Little effect.</td></tr>
<tr><td>Blocked numerics</td><td>Power-of-two leading dimensions cause repeated conflicts. Padding fixes it.</td></tr>
<tr><td>ML inference</td><td>High load bandwidth per cycle makes bank conflicts visible, so layout matters.</td></tr>
<tr><td>Multithreaded shared data</td><td>At the LLC, "banks" are slices across the chip. Hashing spreads load, but a single hot line (a lock) still serializes on one slice.</td></tr>
</table></div>`,
  practice: {
    guided: [
      {
        q: `<p>An L1 has 8 banks. Assuming random bank selection, what is the chance that 2 accesses in the same cycle conflict? 4 accesses?</p>`,
        a: `<ol><li>P(no conflict) = B! / ((B − k)! × B<sup>k</sup>).</li><li>k = 2: 1 − (8 × 7) / 64 = <strong>12.5%</strong> conflict.</li><li>k = 4: 1 − (8 × 7 × 6 × 5) / 4096 ≈ <strong>59%</strong> conflict.</li><li>Random banking works for 2 accesses per cycle, but supporting 3–4 loads per cycle needs more banks, smarter mapping, or replication.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>To support two loads per cycle, compare a true dual-ported L1, a banked L1, and a replicated L1.</p>`,
        a: `<p><strong>Dual-ported:</strong> no conflicts, but each SRAM cell needs extra ports, raising area roughly 1.5–2× and slowing access. <strong>Banked:</strong> nearly single-port area and energy, but same-bank pairs conflict and one load waits. It works well when address bits spread accesses. <strong>Replicated:</strong> two copies serve reads with no conflicts, but stores must write both and area doubles. Banking is the common choice for L1D, and replication suits read-heavy, small structures.</p>`
      }
    ]
  }
}
]);
