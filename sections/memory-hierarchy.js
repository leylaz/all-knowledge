/* Section: Memory hierarchy
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "mem"). */

section({
  id: "mem",
  name: "Memory Hierarchy",
  cap: "Caches, prefetching, banking, SRAM vs. DRAM, latency tolerance",
  sections: [
    { id: "average-memory-access", label: "Average Memory Access Time" },
    { id: "two-ways-win", label: "Two Ways to Win" }
  ],
  body: `
<p>The memory hierarchy exists because DRAM is hundreds of cycles away. Each level trades capacity for latency, and the core's job is to either avoid misses or overlap them.</p>
<h3 id="sec-average-memory-access">Average Memory Access Time</h3>
<p>AMAT = hit time + miss rate × miss penalty, applied recursively per level. It's a useful first-order tool, but in an out-of-order core what matters is the latency that isn't hidden, which depends on memory-level parallelism.</p>
<div class="calc" data-calc="amat"></div>
<h3 id="sec-two-ways-win">Two Ways to Win</h3>
<ul><li><strong>Avoid misses:</strong> capacity, associativity, replacement, prefetching.</li><li><strong>Tolerate misses:</strong> non-blocking caches, large windows, prefetching, runahead.</li></ul>`,
  practice: {
    guided: [
      {
        q: `<p>L1 hit time 4 cycles, L1 miss rate 10%. L2 hit time 14 cycles, L2 local miss rate 30%. Memory latency 200 cycles. What is the AMAT?</p>`,
        a: `<ol><li>L2 miss penalty seen from L2: 0.3 × 200 = 60.</li><li>L1 miss penalty: 14 + 60 = 74.</li><li>AMAT = 4 + 0.1 × 74 = <strong>11.4 cycles</strong>.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Using the numbers above: doubling the L2 cuts its local miss rate from 30% to 24% but adds 2 cycles of hit latency. Is it worth it?</p>`,
        a: `<p>New AMAT = 4 + 0.1 × (16 + 0.24 × 200) = 4 + 0.1 × 64 = 10.4 cycles, versus 11.4. On paper, yes.</p><p>In an interview, add the caveats: the extra 2 cycles hit every L1 miss, while the saved DRAM misses only help if they were exposed; an OoO core partly hides L2 hits but rarely hides DRAM. Area and power grow too. The real answer comes from running representative workloads and looking at both IPC and energy.</p>`
      }
    ]
  }
}, [
{
  id: "dcache",
  region: "mem",
  title: "Data Cache and Sectored Caches",
  sections: [
    { id: "non-blocking", label: "Non-Blocking Caches" },
    { id: "sectored", label: "Sectored Caches" },
    { id: "way-pred", label: "Way Prediction in the Data Cache" },
    { id: "misses", label: "Classifying Misses" }
  ],
  body: `
<p>A set-associative cache splits an address into tag, index, and offset. Typical L1D choices are write-back, write-allocate, and LRU or pseudo-LRU replacement.</p>
<h3 id="sec-non-blocking">Non-Blocking Caches</h3>
<p>MSHRs track outstanding misses so hits continue; secondary misses to the same line merge into an existing MSHR. MSHR count caps memory-level parallelism.</p>
<h3 id="sec-sectored">Sectored Caches</h3>
<p>One tag covers a large block split into sectors with their own valid (and often dirty) bits. A miss fetches only the missing sector.</p>

<h3 id="sec-way-pred">Way Prediction in the Data Cache</h3>
<p>Way prediction guesses which way of the set will hit, so the cache reads one way instead of all of them (the mechanism, and the difference between way prediction and way selection, are on the <a href="#/stage-if/way-pred">Instruction Fetch</a> page). On the data side the payoff is larger and the problem is harder.</p>
<p><strong>Why it pays more here.</strong></p>
<ul>
<li><strong>Load-to-use latency is in the critical loop.</strong> Almost every dependency chain goes through loads, so a cycle off the L1D hit time is worth more than a cycle almost anywhere else.</li>
<li><strong>L1D caches are highly associative.</strong> They grow by adding ways to stay virtually indexed and physically tagged, so a parallel read touches many ways (12 on Zen 5, see <a href="#/zen5-core/ls">Load/Store Unit and L1D</a>).</li>
</ul>
<p><strong>Where it happens.</strong> In the load pipeline, right after address generation. The set index comes from page-offset bits, so set decode starts as soon as the address is computed, while the DTLB translates the page number in parallel. The way predictor has to answer in that same window, before the physical tag exists, so it can't use the physical address.</p>
<p><strong>Why it's harder than on the fetch side.</strong> Fetch moves sequentially and can store the next way with the fetch block that leads to it. A load's address is only known after the AGU computes it, and consecutive loads jump around. So the predictor has to be indexed with something available early:</p>
<ul>
<li><strong>The load's PC.</strong> Known at issue, before the address. Works for loads that keep hitting the same line, such as a load of a global or a stack slot, but not for a load walking an array. Powell et al. (2001) studied PC-based way prediction for data-cache energy.</li>
<li><strong>An approximate address.</strong> The base register XORed with the offset, available before the add finishes. Usually right, because carries rarely reach the bits used.</li>
<li><strong>A hash of the virtual address.</strong> AMD's L1D caches (since Bulldozer, including every Zen core) store a small <strong>microtag</strong> (utag) with each line: a hash of linear-address bits above the page offset. A load hashes its linear address, compares the hash with the utags of the set's ways, and reads only the matching way. The full physical tag, ready after translation, then confirms the hit.</li>
</ul>
<p>The utag datapath, drawn with 4 ways for space (Zen 5's L1D has 12). The set index and the utag hash both come straight from the linear address, so the way is chosen while the DTLB is still translating. The physical tag check only confirms the hit.</p>
<div class="tbl"><svg viewBox="0 0 680 345" role="img" aria-label="A utag way predictor in an L1 data cache, drawn with 4 ways. The linear address from the AGU splits into a page number, a set index, and an offset. The set index picks the set. The page number is hashed into the load's utag, which is compared with the stored utags of all 4 ways. Utag 3 matches, so only way 3's physical tag and data are read, while ways 0 to 2 are not read. In parallel, the DTLB translates the page number, and its physical tag is compared with way 3's tag as a hit check. Way 3's data goes out to the load." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<defs><marker id="arrDU" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker><marker id="arrDUt" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--trace)"/></marker></defs>
<text x="20" y="16" style="fill:var(--muted);font-size:11px">linear address, from the AGU</text>
<rect x="20" y="24" width="400" height="28" style="fill:var(--code-bg);stroke:var(--muted);stroke-width:1.5"/>
<rect x="420" y="24" width="120" height="28" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/>
<rect x="540" y="24" width="120" height="28" style="fill:var(--surface);stroke:var(--muted);stroke-width:1.5"/>
<g style="fill:var(--ink);font-size:12px" text-anchor="middle">
<text x="220" y="43">page number (bits 47:12)</text><text x="480" y="43">set index (11:6)</text><text x="600" y="43">offset (5:0)</text>
</g>
<rect x="20" y="80" width="130" height="34" rx="4" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5"/>
<text x="85" y="95" text-anchor="middle" style="fill:var(--ink);font-size:12px;font-weight:600">hash</text>
<text x="85" y="108" text-anchor="middle" style="fill:var(--muted);font-size:11px">the load's utag</text>
<rect x="200" y="80" width="130" height="34" rx="4" style="fill:var(--surface);stroke:var(--trace);stroke-width:1.5"/>
<text x="265" y="95" text-anchor="middle" style="fill:var(--ink);font-size:12px;font-weight:600">DTLB</text>
<text x="265" y="108" text-anchor="middle" style="fill:var(--muted);font-size:11px">physical tag</text>
<text x="480" y="86" text-anchor="middle" style="fill:var(--muted);font-size:11px">picks the set</text>
<g style="fill:var(--surface);stroke:var(--muted);stroke-width:1.5">
<rect x="160" y="150" width="90" height="26" rx="3"/><rect x="280" y="150" width="90" height="26" rx="3"/><rect x="400" y="150" width="90" height="26" rx="3"/>
</g>
<g style="fill:var(--surface);stroke:var(--muted);stroke-width:1.5;stroke-dasharray:4 3;opacity:.45">
<rect x="160" y="196" width="90" height="26" rx="3"/><rect x="160" y="232" width="90" height="60" rx="3"/>
<rect x="280" y="196" width="90" height="26" rx="3"/><rect x="280" y="232" width="90" height="60" rx="3"/>
<rect x="400" y="196" width="90" height="26" rx="3"/><rect x="400" y="232" width="90" height="60" rx="3"/>
</g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5">
<rect x="520" y="150" width="90" height="26" rx="3"/><rect x="520" y="196" width="90" height="26" rx="3"/><rect x="520" y="232" width="90" height="60" rx="3"/>
</g>
<g style="fill:var(--ink);font-size:12px" text-anchor="middle">
<text x="205" y="167">utag 0</text><text x="325" y="167">utag 1</text><text x="445" y="167">utag 2</text>
</g>
<g style="fill:var(--muted);font-size:12px;opacity:.7" text-anchor="middle">
<text x="205" y="213">tag 0</text><text x="205" y="266">not read</text>
<text x="325" y="213">tag 1</text><text x="325" y="266">not read</text>
<text x="445" y="213">tag 2</text><text x="445" y="266">not read</text>
</g>
<g style="fill:var(--ink);font-weight:600" text-anchor="middle">
<text x="565" y="167" style="font-size:11px">utag 3: match</text><text x="565" y="213" style="font-size:12px">tag 3</text><text x="565" y="266" style="font-size:12px">data 3</text>
</g>
<g style="fill:var(--muted);font-size:11px">
<text x="10" y="160">utags of all ways,</text><text x="10" y="174">compared with the hash</text>
<text x="10" y="213">physical tags</text>
<text x="10" y="258">data: only the</text><text x="10" y="272">matching way is read</text>
</g>
<circle cx="635" cy="209" r="11" style="fill:var(--surface);stroke:var(--trace);stroke-width:1.5"/>
<text x="635" y="214" text-anchor="middle" style="fill:var(--ink);font-size:13px;font-weight:600">=</text>
<text x="635" y="316" text-anchor="middle" style="fill:var(--muted);font-size:11px">hit check</text>
<text x="565" y="334" text-anchor="middle" style="fill:var(--muted);font-size:11px">data out</text>
<g style="fill:none;stroke:var(--muted);stroke-width:1.5">
<path d="M85,52 V78" marker-end="url(#arrDU)"/>
<path d="M265,52 V78" marker-end="url(#arrDU)"/>
<path d="M480,52 V72" marker-end="url(#arrDU)"/>
<path d="M85,114 V136 H565"/>
<path d="M205,136 V148" marker-end="url(#arrDU)"/>
<path d="M325,136 V148" marker-end="url(#arrDU)"/>
<path d="M445,136 V148" marker-end="url(#arrDU)"/>
<path d="M565,136 V148" marker-end="url(#arrDU)"/>
<path d="M330,97 H635 V196" marker-end="url(#arrDU)"/>
<path d="M610,209 H624"/>
<path d="M635,220 V300" marker-end="url(#arrDU)"/>
</g>
<path d="M565,292 V318" marker-end="url(#arrDUt)" style="fill:none;stroke:var(--trace);stroke-width:2"/>
</svg></div>
<p><strong>What the utag design gives up.</strong></p>
<ul>
<li><strong>A utag mismatch is a miss.</strong> If no utag matches, AMD treats the access as an L1 miss, even if the line is present under a different virtual address. Two virtual aliases of one physical line (shared memory mapped at different addresses, or two processes on SMT siblings) keep evicting each other's utag, and every switch looks like an L1 miss.</li>
<li><strong>Utag collisions.</strong> Two lines in the same set with the same hash can't both be found, so one is evicted.</li>
<li><strong>A side channel.</strong> Lipp et al. ("Take A Way," 2020) reverse-engineered the hash and used collisions and alias misses (attacks they call Collide+Probe and Load+Reload) to leak address information across processes and SMT siblings.</li>
</ul>
<p>How two aliases of one line keep missing. Addresses A and B are different linear addresses mapped to the same physical page, so the line never leaves the cache, yet only one of their utags can be stored:</p>
<div class="tbl"><svg viewBox="0 0 680 260" role="img" aria-label="Utag alias ping-pong in three steps. Step 1: a load through address A finds the stored utag equal to utag of A, so it hits. Step 2: a load through address B computes utag of B, which doesn't match, so it is treated as a miss, the line is refilled from L2, and the stored utag becomes utag of B. Step 3: a load through A again doesn't match and misses again. A and B map to the same physical line, which stays in the cache the whole time." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<defs><marker id="arrDA" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker></defs>
<g style="fill:var(--ink);font-size:12px;font-weight:600" text-anchor="middle">
<text x="115" y="20">step 1: load via A</text><text x="340" y="20">step 2: load via B</text><text x="565" y="20">step 3: load via A again</text>
</g>
<g style="fill:var(--surface);stroke:var(--muted);stroke-width:1.5">
<rect x="55" y="32" width="120" height="28" rx="3"/><rect x="280" y="32" width="120" height="28" rx="3"/><rect x="505" y="32" width="120" height="28" rx="3"/>
</g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5">
<rect x="35" y="92" width="160" height="60" rx="4"/><rect x="260" y="92" width="160" height="60" rx="4"/><rect x="485" y="92" width="160" height="60" rx="4"/>
</g>
<g style="fill:var(--ink);font-size:12px" text-anchor="middle">
<text x="115" y="51">address A</text><text x="340" y="51">address B</text><text x="565" y="51">address A</text>
<text x="115" y="114" style="font-weight:600">physical line P</text><text x="340" y="114" style="font-weight:600">physical line P</text><text x="565" y="114" style="font-weight:600">physical line P</text>
</g>
<g style="fill:var(--muted);font-size:11px">
<text x="123" y="80">utag(A)</text><text x="348" y="80">utag(B)</text><text x="573" y="80">utag(A)</text>
</g>
<g style="fill:var(--ink);font-size:11px" text-anchor="middle">
<text x="115" y="136">stored utag: utag(A)</text><text x="340" y="136">stored utag: utag(A)</text><text x="565" y="136">stored utag: utag(B)</text>
</g>
<g style="font-size:12px;font-weight:600" text-anchor="middle">
<text x="115" y="178" style="fill:var(--accent-green)">match: hit</text>
<text x="340" y="178" style="fill:var(--accent-red)">mismatch: a miss</text>
<text x="565" y="178" style="fill:var(--accent-red)">mismatch again: a miss</text>
</g>
<g style="fill:var(--muted);font-size:11px" text-anchor="middle">
<text x="340" y="195">refill from L2</text><text x="340" y="210">stored utag becomes utag(B)</text>
<text x="565" y="195">refill from L2</text><text x="565" y="210">stored utag becomes utag(A)</text>
</g>
<text x="340" y="245" text-anchor="middle" style="fill:var(--muted);font-size:11px">The data was in the cache all along. Every switch between A and B costs an L2 access.</text>
<g style="fill:none;stroke:var(--muted);stroke-width:1.5">
<path d="M115,60 V90" marker-end="url(#arrDA)"/>
<path d="M340,60 V90" marker-end="url(#arrDA)"/>
<path d="M565,60 V90" marker-end="url(#arrDA)"/>
<path d="M200,122 H255" marker-end="url(#arrDA)"/>
<path d="M425,122 H480" marker-end="url(#arrDA)"/>
</g>
</svg></div>
<p><strong>What a wrong guess costs in an out-of-order core.</strong> The scheduler wakes a load's dependents early, so they arrive exactly when an L1 hit returns (see <a href="#/scheduler">Scheduler Queues</a>). A load that hits in a different way than predicted returns late, so those dependents are cancelled and replayed: the extra cycles plus wasted issue slots. A data-side predictor therefore has to be very accurate, or it must turn a mispredict into a clean miss, as the utag does, so the existing miss-replay path handles it.</p>
<p><strong>Stores don't need it.</strong> A store writes the cache only after it commits, when it's off the critical path. So it can check tags first and then write just the one way that hit, which gets way selection's energy saving for free.</p>

<h3 id="sec-misses">Classifying Misses</h3>
<p>Compulsory, capacity, conflict, and in multicore systems, coherence. <a href="#/cache-misses">Classifying Cache Misses</a> defines each class and shows how a model sorts every miss with a seen set and a shadow cache.</p>
<p class="refs">References: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Chapter 2 (way prediction and way selection) · Powell et al., "Reducing Set-Associative Cache Energy via Way-Prediction and Selective Direct-Mapping," MICRO 2001 · AMD, <em>Software Optimization Guide for AMD Family 17h Processors</em> (the L1D microtag) · Lipp et al., "Take A Way: Exploring the Security Implications of AMD's Cache Way Predictors," AsiaCCS 2020</p>`,
  practice: {
    guided: [
      {
        q: `<p>A 32 KB, 8-way L1D with 64-byte lines and 48-bit physical addresses. How many sets? How many offset, index, and tag bits?</p>`,
        a: `<ol><li>Lines: 32 KB / 64 B = 512. Sets: 512 / 8 = <strong>64</strong>.</li><li>Offset: log2(64) = <strong>6</strong> bits. Index: log2(64) = <strong>6</strong> bits.</li><li>Tag: 48 − 12 = <strong>36</strong> bits.</li><li>Note that index plus offset is 12 bits, exactly a 4 KB page offset. That matters for VIPT caches (next problem).</li></ol>`
      },
      {
        q: `<p>An out-of-order core has a 32 KB, 8-way L1D. Two designs run at the same clock:</p><ul><li>Parallel read of all 8 ways: every L1D hit takes 5 cycles.</li><li>With a way predictor: a hit takes 4 cycles when the predicted way is right, and 3 cycles more when it's wrong. The predictor is right on 96% of hits.</li></ul><p>Loads are 30% of instructions, and 95% of loads hit in the L1D. Profiling shows that 15% of each cycle of L1D hit latency appears in run time, and the rest is hidden by the window. The parallel-read design runs at a CPI of 0.80. Ignoring replay costs and misses, what is the average hit latency with the predictor, and what speedup does it give?</p>`,
        a: `<ol><li>Average hit latency with the predictor: 4 + 0.04 × 3 = <strong>4.12 cycles</strong>.</li><li>Saving per hit: 5 − 4.12 = 0.88 cycles.</li><li>Hits per instruction: 0.30 × 0.95 = 0.285.</li><li>Exposed cycles saved per instruction: 0.285 × 0.88 × 0.15 ≈ 0.0376.</li><li>CPI with the predictor: 0.80 − 0.0376 = 0.7624. Speedup: 0.80 / 0.7624 ≈ <strong>1.049</strong>, about 5%.</li><li>Replays shrink this: the 4% of hits that mispredict also cancel and reissue dependents that were woken for a 4-cycle hit.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Why can't a VIPT L1 with 4 KB pages be larger than 32 KB at 8 ways without aliasing problems? What do designers do about it?</p>`,
        a: `<p>For the index to come entirely from untranslated page-offset bits, cache size / ways ≤ page size, so 4 KB × 8 = 32 KB. Options: more ways (more power per access), larger base pages (16 KB pages allow 128 KB at 8 ways), hardware synonym detection, or a PIPT cache with the TLB in series (more latency).</p>`
      },
      {
        q: `<p>When would you choose a sectored cache, and when would it hurt?</p>`,
        a: `<p>Good: large blocks with streaming or dense access, where one tag per block saves storage and sector-only fills save bandwidth (common in L2/LLC and GPU caches). Bad: sparse access, where a block occupies a whole frame while only one sector is used, lowering effective capacity and raising misses.</p>`
      },
      {
        q: `<p>You're adding a utag-style way predictor to the L1D of an out-of-order core model. Beyond the shorter average hit latency, what must the model capture to get IPC right?</p>`,
        a: `<ul><li><strong>Replays.</strong> Dependents are woken for the predicted-hit latency. A late hit must cancel and reissue them under the model's real replay policy (selective or squash-all), costing issue slots and port bandwidth, not just latency.</li><li><strong>Alias and collision misses.</strong> A utag mismatch is a miss even when the line is present. The model needs per-line utags computed from virtual addresses, so workloads with shared mappings or SMT siblings show the extra L2 traffic.</li><li><strong>Training.</strong> Model when fills, prefetches, and hits in another way update the utags, and whether prefetched lines get a utag at all.</li><li><strong>Port and bank occupancy.</strong> A second access to read the remaining ways occupies a load pipe for another cycle.</li><li><strong>Interaction with store-to-load forwarding.</strong> A load that forwards from the store queue doesn't need the cache's data, so a utag miss on it may not matter.</li><li><strong>Energy.</strong> If the model reports power, count tag and data reads per way, not per access.</li></ul><p>Validate it the same way as any predictor: compare mispredictions and alias misses per thousand loads against hardware counters, and check that IPC moves the way hardware does on alias-heavy microbenchmarks.</p>`
      }
    ]
  }
},

{
  id: "prefetch",
  region: "mem",
  title: "Prefetching",
  sections: [
    { id: "common-designs", label: "Common Designs" },
    { id: "three-metrics", label: "Three Metrics" }
  ],
  body: `
<p>Fetch lines before the demand access asks for them.</p>
<h3 id="sec-common-designs">Common Designs</h3>
<ul><li><strong>Next-line:</strong> on a miss to line X, fetch X+1.</li><li><strong>Stride:</strong> a PC-indexed table holds last address, stride, and confidence.</li><li><strong>Stream:</strong> detect sequential miss streams and run ahead.</li></ul>
<h3 id="sec-three-metrics">Three Metrics</h3>
<ul><li><strong>Accuracy:</strong> useful over issued.</li><li><strong>Coverage:</strong> baseline misses eliminated.</li><li><strong>Timeliness:</strong> whether data arrives before demand.</li></ul>
<p>Inaccurate prefetches pollute the cache and waste bandwidth, so good prefetchers throttle.</p>`,
  practice: {
    guided: [
      {
        q: `<p>A loop iteration takes 20 cycles and touches a new 64-byte line each time. Memory latency is 200 cycles. How far ahead must a stride prefetcher run?</p><p>Separately: 1000 prefetches were issued, 600 were used by demand accesses, baseline misses were 2000, and misses now are 1500. Compute accuracy and coverage.</p>`,
        a: `<ol><li>Distance: 200 / 20 = 10 iterations, so 10 lines = <strong>640 bytes ahead</strong>.</li><li>Accuracy = 600 / 1000 = <strong>60%</strong>.</li><li>Coverage = (2000 − 1500) / 2000 = <strong>25%</strong>.</li><li>600 used but only 500 misses eliminated suggests some prefetches were late (or caused extra misses through pollution).</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A prefetcher raises average IPC 5% but hurts two benchmarks by 8%. What do you investigate and what would you propose?</p>`,
        a: `<p>Check per-benchmark accuracy, lateness, bandwidth use, and pollution (demand misses to lines evicted by prefetches). Likely causes are low-accuracy prefetches thrashing a small cache or saturating bandwidth. Propose feedback-directed throttling: track accuracy, lateness, and pollution per interval and adjust degree and distance. Or train only on specific PCs, or insert prefetched lines at low replacement priority.</p>`
      }
    ]
  }
},

{
  id: "latency-tolerance",
  region: "mem",
  title: "Memory Latency Tolerance",
  sections: [
    { id: "techniques", label: "Techniques" },
    { id: "mlp", label: "What Memory-Level Parallelism Means" },
    { id: "limit", label: "The Limit" }
  ],
  body: `
<p>If misses can't be avoided, overlap them with each other and with useful work.</p>
<h3 id="sec-techniques">Techniques</h3>
<ul>
<li><strong>Non-blocking caches:</strong> MSHRs allow many outstanding misses.</li>
<li><strong>Large instruction windows:</strong> a bigger ROB, IQ, and LSQ reach more independent misses.</li>
<li><strong>Prefetching:</strong> start misses before demand.</li>
<li><strong>Runahead execution:</strong> pre-execute past a blocking miss to generate prefetches.</li>
<li><strong>Critical-word-first and early restart:</strong> return the needed word before the full line.</li>
<li><strong>SMT:</strong> another thread uses the core while one waits.</li>
<li><strong>Value prediction:</strong> speculate on the loaded value so dependents can proceed.</li>
</ul>
<h3 id="sec-mlp">What Memory-Level Parallelism Means</h3>
<p><strong>Memory-level parallelism (MLP)</strong> is having several cache misses in flight at the same time, so their latencies overlap instead of adding up. If four independent loads each miss to DRAM at 200 cycles, handling them one at a time takes 4 × 200 = 800 cycles; overlapping all four takes about 200.</p>
<p>MLP needs several things working together:</p>
<ul>
<li><strong>MSHRs</strong> (miss status holding registers, also called line fill buffers): each tracks one outstanding miss, so their count caps how many misses can be in flight.</li>
<li><strong>A large instruction window</strong> (ROB, load queue) to reach independent misses far enough ahead.</li>
<li><strong>Non-blocking caches</strong> that keep serving hits while misses are pending.</li>
<li><strong>Prefetchers</strong> that start misses early.</li>
<li><strong>Enough DRAM channels and banks</strong> to serve many requests at once.</li>
</ul>
<p>Data cache <em>ports</em> are a different thing: they set how many hits can be served per cycle (bandwidth), not how many misses can overlap.</p>
<p><strong>Why the window matters even without dependents:</strong> instructions retire in order, so the ROB fills up behind a stuck load. A 4-wide core with a 128-entry ROB fills it in about 32 cycles and then stalls, so a 200-cycle DRAM miss is mostly exposed unless the work behind it contains other misses that overlap with it.</p>
<div class="calc" data-calc="little"></div>
<h3 id="sec-limit">The Limit</h3>
<p>Dependent misses (pointer chasing) serialize regardless of window size. Only prediction, prefetching that understands the data structure, or software changes help there.</p>`,
  practice: {
    guided: [
      {
        q: `<p>Four independent loads each miss to DRAM (200 cycles). Ignoring issue time, how long do they take with 1, 2, and 4 MSHRs?</p>`,
        a: `<ol><li>1 MSHR: fully serial, 4 × 200 = <strong>800 cycles</strong>.</li><li>2 MSHRs: two waves, <strong>about 400</strong>.</li><li>4 MSHRs: all overlap, <strong>about 200</strong>.</li><li>Memory-level parallelism, not raw latency, sets the cost, as long as the misses are independent and the window can reach them.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Explain runahead execution. When does it help, and when doesn't it?</p>`,
        a: `<p>When a long-latency miss blocks the ROB head, the core checkpoints state and keeps executing past it in a speculative "runahead" mode, marking results dependent on the miss as invalid. Loads it encounters with valid addresses become prefetches. When the miss returns, it discards runahead results and resumes from the checkpoint.</p><p>Helps: independent misses beyond the ROB window, without paying for a bigger ROB. Doesn't help: dependent pointer chains (addresses depend on the blocked load), and it wastes energy re-executing instructions.</p>`
      }
    ]
  }
},

{
  id: "l2-banks",
  region: "mem",
  title: "L2 and Banking",
  sections: [
    { id: "banks", label: "Banks" },
    { id: "access-per-cycle", label: "Why One Access per Cycle" },
    { id: "address-path", label: "The Address Path" },
    { id: "banks-busy", label: "Banks Busy for Two Cycles" },
    { id: "choosing-bank-bits", label: "Choosing Bank Bits" },
    { id: "dram-banks", label: "DRAM Banks" }
  ],
  body: `
<p>The L2 is larger and slower, usually unified, and inclusive, exclusive, or neither with respect to L1.</p>
<h3 id="sec-banks">Banks</h3>
<p>Banks selected by address bits allow parallel accesses; two same-cycle accesses to one bank conflict and one waits.</p>
<p>A <strong>single-ported bank</strong> is an independent slice of the data array: its own SRAM subarray with its own row decoder, wordlines, bitlines, and sense amps. It serves exactly one read or one write per cycle. H&amp;P (Ch. 2) list this as an advanced cache optimization, <em>multibanked caches to increase bandwidth</em>, usually with <strong>sequential interleaving</strong> (line or word address mod N picks the bank). Banking is the cheap approximation of multi-porting: simple single-ported cells, near-N-way bandwidth when accesses spread evenly. Strided patterns that keep hitting one bank lose the benefit, the same problem as GPU shared-memory bank conflicts.</p>
<h3 id="sec-access-per-cycle">Why One Access per Cycle</h3>
<p>The limit is physical. Each port has:</p>
<ul><li><strong>One address path:</strong> one decoder that raises exactly one wordline per cycle.</li><li><strong>Shared bitlines:</strong> every cell in a column hangs off the same bitline pair. Two wordlines firing in one column would have two cells driving the same bitlines, corrupting the read (and possibly clobbering a cell on a write).</li><li><strong>Precharge/evaluate timing:</strong> bitlines are precharged, discharged by the selected cell, then sensed. That sequence is the access; the next one waits for the next precharge.</li><li><strong>One set of sense amps and column muxes</strong>, which resolve one access’s data per cycle.</li></ul>
<p>A second port means a second wordline per row, a second bitline pair per column, and extra access transistors per cell. Cell area grows roughly quadratically with port count (more wires <em>and</em> transistors), and longer wires make the array slower and hungrier.</p>
<h3 id="sec-address-path">The Address Path</h3>
<p>The circuitry that turns an address into “activate this row (and column) of cells.” For one port:</p>
<ol><li><strong>Address input/latch:</strong> the index bits (after the bank-select bits pick the bank) are captured at the start of the cycle.</li><li><strong>Row decoder:</strong> k index bits become a one-hot signal across 2<sup>k</sup> rows, usually a predecoder plus a final AND stage.</li><li><strong>Wordline driver:</strong> a strong buffer drives the selected wordline across the row, turning on every cell’s access transistors and connecting them to their bitlines.</li><li><strong>Column decoder/mux select:</strong> when a row holds more bits than needed, the remaining address bits route the right columns to the sense amps.</li></ol>
<p>A second port needs a whole second copy of this, which is where multi-porting’s area cost comes from.</p>
<h3 id="sec-banks-busy">Banks Busy for Two Cycles</h3>
<p>A bank is busy for multiple cycles when its <strong>cycle time</strong> (how often it can start a new access) exceeds one processor clock:</p>
<ul><li><strong>Access + recovery doesn’t fit in one clock.</strong> After a read the bitlines must be precharged again. H&amp;P’s <em>access time vs. cycle time</em>: data can come out after the access time, but the bank isn’t free until the full cycle time.</li><li><strong>Fast clocks, big arrays.</strong> Long wordlines and bitlines (more RC delay) can’t finish in one cycle, so designers accept a 2-cycle busy time and add banks. Same idea as interleaved main memory: you need at least as many banks as the bank cycle time in clocks to sustain one access per clock.</li><li><strong>Read-modify-write.</strong> A partial store under ECC (e.g., 1 byte when ECC covers 8) must read, merge, recompute ECC, and write back.</li><li><strong>Wide transfers.</strong> A fill or eviction wider than the bank port takes multiple beats.</li></ul>
<p>Effect: with 2-cycle banks, consecutive-cycle accesses to one bank conflict too, so you need more banks or better hashing for the same bandwidth.</p>
<h3 id="sec-choosing-bank-bits">Choosing Bank Bits</h3>
<p>Low line-address bits spread sequential accesses, but power-of-two strides can hammer one bank. XOR-hashing higher bits spreads them.</p>
<h3 id="sec-dram-banks">DRAM Banks</h3>
<p>DRAM is banked for the same reason, with one difference: a DRAM bank keeps a row open, so the cost of an access depends on which row the bank last opened. See <a href="#/dram-ctrl/timing">Row Hits, Misses, and Conflicts</a>.</p>`,
  practice: {
    guided: [
      {
        q: `<p>An L2 has 4 banks chosen by address bits [7:6]. Do accesses to 0x1000 and 0x1100 in the same cycle conflict? What if the bank is bits[7:6] XOR bits[9:8]?</p>`,
        a: `<ol><li>0x1000: bits [7:6] = 00 → bank 0. 0x1100: 0x100 sets only bit 8, so bits [7:6] = 00 → bank 0. <strong>Conflict.</strong> Any 256-byte stride hits the same bank.</li><li>With XOR: 0x1000 has bits [9:8] = 00 → bank 0. 0x1100 has bits [9:8] = 01 → bank 1. <strong>No conflict.</strong></li></ol>`
      },
      {
        q: `<p>4 banks, each busy for 2 cycles per access. One access arrives per cycle, in the bank order 0, 0, 1, 1. When does each start? What if the order is 0, 1, 0, 1?</p>`,
        a: `<ol><li>Order 0, 0, 1, 1: the first access holds bank 0 for cycles 0–1, so the second (arriving cycle 1) waits until <strong>cycle 2</strong>. The third starts on bank 1 at cycle 2. The fourth arrives at cycle 3 but bank 1 is busy until the end of cycle 3, so it starts at <strong>cycle 4</strong>. Two stall cycles.</li><li>Order 0, 1, 0, 1: each bank gets a request every other cycle, exactly matching its 2-cycle busy time. <strong>No stalls.</strong></li><li>With a 2-cycle bank busy time, even <em>consecutive</em>-cycle accesses to one bank conflict, not just same-cycle ones. Sustaining one access per cycle needs at least 2 banks with perfect spreading, and more in practice.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Inclusive vs. exclusive L2: what are the trade-offs?</p>`,
        a: `<p>Inclusive: the L2 tags double as a snoop filter for L1s, which simplifies coherence, but it wastes capacity on duplicated lines and evicting from L2 forces back-invalidations in L1 that can remove hot lines. Exclusive: total capacity is L1 + L2, but coherence needs separate tracking and lines move between levels on every L1 eviction. Non-inclusive designs sit in between.</p>`
      }
    ]
  }
},

{
  id: "sram-dram",
  region: "mem",
  title: "SRAM vs. DRAM",
  sections: [
    { id: "dram-slower", label: "Why DRAM Is Slower" },
    { id: "sram-faster", label: "Why SRAM Is Faster" },
    { id: "hierarchy-trade-off", label: "The Hierarchy Trade-Off" }
  ],
  body: `
<p>The difference is how a bit is physically stored.</p>
<ul><li><strong>SRAM:</strong> a pair of cross-coupled inverters (a latch) plus two access transistors, <strong>6T per bit</strong>. The latch actively holds its value while powered.</li><li><strong>DRAM:</strong> charge on a <strong>capacitor</strong> with one access transistor (<strong>1T1C</strong>). The charge leaks, so it must be refreshed.</li></ul>
<div class="tbl"><table>
<tr><th></th><th>SRAM</th><th>DRAM</th></tr>
<tr><td>Cell</td><td>6T latch</td><td>1 transistor + 1 capacitor</td></tr>
<tr><td>Density</td><td>Low (big cell)</td><td>~10–20× denser</td></tr>
<tr><td>Speed</td><td>Fast (~1 ns on-chip)</td><td>Tens of ns</td></tr>
<tr><td>Refresh</td><td>None</td><td>Every ~64 ms per row</td></tr>
<tr><td>Reads</td><td>Non-destructive</td><td>Destructive; the row must be written back</td></tr>
<tr><td>Process</td><td>Same logic process as the CPU</td><td>Specialized process, usually a separate chip</td></tr>
<tr><td>Use</td><td>Caches, register files, TLBs</td><td>Main memory</td></tr>
</table></div>
<h3 id="sec-dram-slower">Why DRAM Is Slower</h3>
<p>The capacitor is tiny, so opening a row only nudges the bitline voltage, and sense amps must amplify that small signal. Then the row is restored and the bank precharged before reuse. Hence <strong>row buffers</strong> (open a row, read many columns) and timing parameters like tRCD, tCAS, and tRP. See <a href="#/l2-banks">L2 and banking</a> for row-buffer hits vs. conflicts.</p>
<h3 id="sec-sram-faster">Why SRAM Is Faster</h3>
<p>The latch actively drives the bitline, so the signal develops quickly, reads leave the cell intact, and nothing needs refreshing.</p>
<h3 id="sec-hierarchy-trade-off">The Hierarchy Trade-Off</h3>
<p>H&amp;P Ch. 2: SRAM is fast but expensive per bit; DRAM is dense and cheap but slow. So small SRAM caches sit in front of large DRAM main memory.</p>`,
  practice: {
    guided: [
      {
        q: `<p>Roughly how many transistors are in the data array of a 32 KB SRAM cache built from 6T cells? What would the same capacity be in 1T1C DRAM cells?</p>`,
        a: `<ol><li>Bits: 32 × 1024 × 8 = 262,144.</li><li>SRAM: 262,144 × 6 ≈ <strong>1.57 million transistors</strong>, before tags, decoders, and sense amps.</li><li>DRAM: 262,144 transistors plus 262,144 capacitors. That is 6× fewer transistors per bit, and the capacitor is built above or beside the transistor, so the cell is smaller still. That is why DRAM is much denser.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>DRAM is much denser. Why aren’t on-chip caches built from it?</p>`,
        a: `<p>DRAM needs special process steps for the capacitor that don’t mix cheaply with a fast logic process, its reads are destructive (restore + precharge before reuse), it needs refresh, and its tiny charge makes sensing slow. SRAM sits in the same logic process and is fast and simple. Some designs did use embedded DRAM for large last-level caches (IBM POWER7–POWER9 L3, Intel’s Crystal Well eDRAM L4), trading latency for capacity where density mattered most.</p>`
      }
    ]
  }
},

{
  id: "dram-ctrl",
  region: "mem",
  title: "DRAM Controllers and Scheduling",
  sections: [
    { id: "structure", label: "Channels, Ranks, Banks, Rows" },
    { id: "timing", label: "Row Hits, Misses, and Conflicts" },
    { id: "mapping", label: "Address Mapping" },
    { id: "scheduling", label: "Scheduling: FR-FCFS and Fairness" },
    { id: "writes", label: "Writes and Refresh" },
    { id: "loaded", label: "Loaded Latency" },
    { id: "model", label: "Modeling DRAM" }
  ],
  body: `
<p>Main memory latency isn't one number. It depends on whether the needed row is already open, how many other requests are queued, whether the bus is busy with writes or refresh, and how the controller orders requests. <a href="#/icx-memory">Memory Interfaces</a> introduces DDR5, LPDDR, and HBM; this page goes inside the controller.</p>

<h3 id="sec-structure">Channels, Ranks, Banks, Rows</h3>
<ul>
<li><strong>Channel:</strong> an independent bus with its own controller queue. A DDR5 DIMM has two 32-bit subchannels, each delivering a 64-byte line in one burst of 16 transfers.</li>
<li><strong>Rank:</strong> a set of DRAM chips that respond together; ranks on a channel share its bus.</li>
<li><strong>Bank:</strong> an independent array inside each chip. A 16 Gb DDR5 x8 chip has 32 banks in 8 bank groups. Different banks can work on different requests at the same time: this is bank-level parallelism.</li>
<li><strong>Row:</strong> a bank reads a whole row (a few KB across the rank) into its <strong>row buffer</strong> before any column can be accessed. Reads from the open row are fast; anything else means closing it first.</li>
</ul>

<h3 id="sec-timing">Row Hits, Misses, and Conflicts</h3>
<p>Three timing parameters, given in clock cycles of the DRAM bus, decide the latency of one access:</p>
<ul>
<li><strong>tCL</strong> (CAS latency): column read to first data.</li>
<li><strong>tRCD:</strong> activate a row (open it) to column read.</li>
<li><strong>tRP:</strong> precharge (close the open row).</li>
</ul>
<p>For DDR5-4800B (40-39-39, with a clock period of 1 / 2400 MHz ≈ 0.417 ns):</p>
<div class="tbl"><table>
<tr><th>Case</th><th>Commands</th><th>Device latency</th></tr>
<tr><td>Row hit</td><td>Read</td><td>tCL ≈ 16.7 ns</td></tr>
<tr><td>Row closed (empty)</td><td>Activate, read</td><td>tRCD + tCL ≈ 32.9 ns</td></tr>
<tr><td>Row conflict</td><td>Precharge, activate, read</td><td>tRP + tRCD + tCL ≈ 49.2 ns</td></tr>
</table></div>
<p>The core sees much more: the trip through the cache hierarchy, the on-chip network, and the controller's queues, so idle load-to-use latency on desktop and server chips is typically 70 to 120 ns. The row-buffer outcome is still a large part of the variation.</p>
<p>Other constraints shape throughput: tRAS (minimum time a row stays open), tRC (activate to activate in one bank), tFAW (at most four activates per rank in a rolling window, for power), and tCCD_L versus tCCD_S (back-to-back reads are slower within one bank group than across groups).</p>

<h3 id="sec-mapping">Address Mapping</h3>
<p>The controller decides which physical address bits pick the channel, bank group, bank, row, and column. The goals pull against each other:</p>
<ul>
<li>Consecutive lines in the <em>same</em> row give row hits for streaming access.</li>
<li>Consecutive lines in <em>different</em> channels and banks give parallelism.</li>
</ul>
<p>Typical mappings put a few low line-address bits in the column (a short run of row hits), then channel and bank bits, then the row, and XOR bank bits with row bits so that strided access patterns don't all land in one bank.</p>

<h3 id="sec-scheduling">Scheduling: FR-FCFS and Fairness</h3>
<p>The controller holds dozens of requests and chooses which to issue each cycle, subject to every timing constraint. The baseline policy, <strong>FR-FCFS</strong> (Rixner et al., 2000), is: first ready (row hits first), then first come, first served. Serving row hits first maximizes throughput.</p>
<p>The problem is fairness: a streaming thread with a high row-hit rate can keep a bank's row open indefinitely while a random-access thread's requests to other rows wait. Controllers add age caps (any request older than a threshold goes next) and research schedulers group or rank threads: PAR-BS batches requests so every thread gets served each batch (Mutlu and Moscibroda, 2008), and ATLAS prioritizes threads that have received the least service (Kim et al., 2010).</p>

<h3 id="sec-writes">Writes and Refresh</h3>
<ul>
<li><strong>Write drain:</strong> switching the bus from reads to writes and back costs turnaround time (tWTR, tRTW). Controllers buffer writes and drain them in batches when the write queue passes a high watermark, stopping at a low watermark. During a drain, reads wait, which shows up as latency spikes.</li>
<li><strong>Refresh:</strong> every row must be refreshed within the retention period. In DDR5, a refresh command comes every tREFI = 3.9 µs and blocks for tRFC (about 295 ns for 16 Gb chips) when all banks refresh at once, about 7.6% of the time. DDR5's same-bank refresh lets other banks keep working.</li>
</ul>

<h3 id="sec-loaded">Loaded Latency</h3>
<p>As bandwidth use rises, requests queue behind each other and bank conflicts multiply, so latency rises sharply as utilization approaches the practical peak, usually 70 to 90% of the theoretical bandwidth. The shape is the classic queueing curve: flat at low load, then a steep knee. Tools like Intel's Memory Latency Checker measure it by running a latency probe while other threads generate controlled bandwidth.</p>
<p>The consequence for modeling: a fixed DRAM latency is right for latency-bound code at low load and badly wrong for bandwidth-heavy code, which sees both the bandwidth ceiling and the inflated latency at the same time.</p>

<h3 id="sec-model">Modeling DRAM</h3>
<ul>
<li>Use a DRAM model with banks, row buffers, and timing constraints (DRAMSim3 and Ramulator are common open-source choices) rather than a fixed latency, at least for any study near the bandwidth limit.</li>
<li>Match the address mapping and scheduling policy of the real controller; row-hit rate is very sensitive to both.</li>
<li>Validate the latency versus bandwidth curve against the real system, not just the idle latency.</li>
</ul>
<p class="refs">References: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Chapter 2 (memory technology) · Jacob, Ng, and Wang, <em>Memory Systems: Cache, DRAM, Disk</em> (2007) · Rixner, Dally, Kapasi, Mattson, and Owens, "Memory Access Scheduling," ISCA 2000 · Mutlu and Moscibroda, "Parallelism-Aware Batch Scheduling," ISCA 2008 · Kim, Han, Mutlu, and Harchol-Balter, "ATLAS: A Scalable and High-Performance Scheduling Algorithm for Multiple Memory Controllers," HPCA 2010 · JEDEC JESD79-5 (DDR5 SDRAM)</p>`,
  practice: {
    guided: [
      {
        q: `<p>DDR4-3200AA has timings 22-22-22 (tCL-tRCD-tRP) on a 1600 MHz clock. A workload's accesses are 60% row hits, 10% to closed rows, and 30% row conflicts. The core sees about 80 ns of total load-to-use latency for a DRAM access. What is the average device latency, and how much would removing every row conflict save?</p>`,
        a: `<ol><li>Clock period: 1 / 1600 MHz = 0.625 ns, so each timing is 22 × 0.625 = 13.75 ns.</li><li>Row hit: 13.75 ns. Closed row: 2 × 13.75 = 27.5 ns. Conflict: 3 × 13.75 = 41.25 ns.</li><li>Average: 0.6 × 13.75 + 0.1 × 27.5 + 0.3 × 41.25 = 8.25 + 2.75 + 12.375 ≈ <strong>23.4 ns</strong>.</li><li>Turning every conflict into a hit (by better mapping or scheduling) would save 0.3 × 27.5 ≈ 8.3 ns per access: a large share of the device time, though a small share of the 80 ns or so the core sees.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Two programs share a memory channel: a streaming copy with a 90% row-hit rate and a pointer-chasing graph traversal with almost no row hits. Under FR-FCFS, the graph program slows down 3× while the copy barely notices. Explain, and say how you'd fix it in the controller and how you'd show it in a model.</p>`,
        a: `<p>FR-FCFS serves row hits first. The copy keeps generating hits to the open rows, so in any bank they share, the graph program's request (a conflict) keeps losing to newer hits from the copy; its latency, which it can't hide because each miss depends on the last, stretches far beyond the normal conflict latency. The copy loses little because its requests are almost always hits.</p><p>Fixes:</p><ul><li>Cap how many younger row hits can bypass an older request, or how long any request can wait</li><li>Batch requests (PAR-BS) so each thread's oldest requests are served every batch</li><li>Rank threads by attained service (ATLAS), which favors the light, latency-sensitive graph program</li></ul><p>In a model: run each program alone and together, report per-thread slowdown (shared time divided by alone time) and the maximum slowdown as a fairness metric, and show the latency distribution of the graph program's requests, whose tail is where the problem lives.</p>`
      }
    ]
  }
}
]);
