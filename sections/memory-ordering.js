/* Section: Memory Ordering
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "mord"). */

section({
  id: "mord",
  name: "Memory Ordering",
  cap: "How loads and stores keep memory order, from the LSQ to store coalescing",
  sections: [
    { id: "pages", label: "Pages in This Region" }
  ],
  body: `
<p>An out-of-order core lets loads and stores execute out of program order, but memory still has to look as if they ran in order. The load queue (LQ) and store queue (SQ) make that work. Stores wait in the SQ until they retire and write L1. Loads search the SQ for bytes that an older store hasn't written to L1 yet. Stores and coherence snoops probe the LQ for loads that ran too early. The examples in this region use a core sized like Intel's Golden Cove (114-entry SQ, 192-entry LQ, 512-entry ROB) with 46-bit physical addresses and scalar loads and stores of up to 8 bytes. Whether a load may run ahead of older stores with unknown addresses is up to the memory dependence predictor, in <a href="#/r/mdep">Memory Dependence Prediction</a>. Background comes from Hennessy and Patterson (chapters 2 and 3).</p>
<h3 id="sec-pages">Pages in This Region</h3>
<ul>
<li><a href="#/lsq">The Store Queue</a>: an SQ entry, how a load searches older stores and forwards from them, and what happens when a store's address or data is missing.</li>
<li><a href="#/lsq-lq">The Load Queue and Ordering Violations</a>: an LQ entry, how a store's probe finds loads that read stale bytes, how coherence snoops keep loads in order, and why the final compare uses physical addresses.</li>
<li><a href="#/lsq-search">LSQ Search Hardware</a>: the priority encoders that pick one match, the search pipeline beside the L1 access, and what a bigger SQ costs.</li>
<li><a href="#/sq-filters">Store Queue Membership Filters</a>: counting Bloom filters that let most loads skip the SQ search, their corner cases, timing, size, cost, and the workloads they suit.</li>
<li><a href="#/store-coalescing">Store Coalescing</a>: merging senior stores before they write L1, which merges the memory model allows, and when a merged store counts as visible.</li>
</ul>`,
  practice: {
    guided: [
      {
        q: `<p>Follow one store from dispatch until its SQ entry is freed. Which queue does it touch at each step, and what does each step protect against?</p><p class="given">Assume a core that splits each store into a store-address µop and a store-data µop, as x86 cores do.</p>`,
        a: `<ol class="steps"><li><strong>Dispatch.</strong> The store gets the next SQ entry, in program order, and records the LQ tail at that moment. Every load at or past that LQ position is younger than the store.</li><li><strong>Store-address µop.</strong> It computes and translates the address and writes it into the SQ entry. Then it probes the LQ: any younger load that already executed, shares a byte, and didn't forward from a store younger than this one read a stale value. The core flushes from the oldest such load. This catches loads that ran ahead of the store while its address was unknown.</li><li><strong>Store-data µop.</strong> It writes the data into the SQ entry and wakes any load that found this store as its youngest match and blocked because the data wasn't there.</li><li><strong>While it waits.</strong> Every younger load that executes searches the SQ. If this store is the youngest older store that writes the load's bytes, it forwards them, so the load never reads the stale copy in L1.</li><li><strong>Retirement.</strong> The store becomes senior: it can no longer be squashed, but its bytes aren't in L1 yet, so the SQ entry stays and loads keep searching it.</li><li><strong>Drain.</strong> The store reaches the SQ head and writes L1, possibly merged with neighboring stores to the same line. Now L1 holds the value, other cores can see it, and the SQ entry is freed.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>The SQ search sits on every load's latency path, but the LQ probe doesn't sit on any instruction's latency path. What does that difference let a designer do with each queue?</p>`,
        a: `<p>The SQ search runs beside the L1 access, and its result is the load's value, so it has to finish in the L1 hit latency. That caps the SQ's size: every extra entry adds compare load, wire length, and data bitline length to a path that sets load-to-use latency. Designs keep the SQ small, filter the search, or let forwarding run slower than an L1 hit.</p><p>The LQ probe answers only "flush or not", and the answer is needed before the load retires, not before its dependents run. So the probe can:</p><ul><li>Take several cycles or be pipelined.</li><li>Run at the rate stores and snoops arrive, which is lower than the load rate.</li><li>Skip any data readout, shift, or merge.</li></ul><p>That is why cores give the LQ more entries than the SQ (192 against 114 on Golden Cove), even though the LQ also needs more entries because loads are about twice as common as stores.</p>`
      }
    ]
  }
}, [

{
  id: "lsq",
  region: "mord",
  title: "The Store Queue",
  sections: [
    { id: "stores", label: "Stores" },
    { id: "missing-fields", label: "Missing Address or Data" }
  ],
  body: `
<p>The LQ and SQ track memory operations in program order so they can execute out of order without breaking memory semantics. Both are allocated at dispatch, in program order, so an entry's position in its queue says how old it is. The examples on this page use a core sized like Intel's Golden Cove (114-entry SQ, 192-entry LQ, 512-entry ROB) with 46-bit physical addresses and scalar loads and stores of up to 8 bytes. This page covers the SQ: what an entry holds, how a load searches it, and what happens when a store's address or data is missing. The LQ side is on <a href="#/lsq-lq">The Load Queue and Ordering Violations</a>, and the circuits behind both searches are on <a href="#/lsq-search">LSQ Search Hardware</a>.</p>
<h3 id="sec-stores">Stores</h3>
<p>A store keeps its SQ entry from dispatch until it writes L1. On x86 cores a store is split into two µops that execute independently: the store-address µop computes and translates the address, and the store-data µop reads the source register. Either can finish first, so the entry has separate valid bits for its address and its data. The store doesn't write the cache until it commits. After retirement it is a <strong>senior</strong> store and drains from the queue into L1 in order. What happens to a retired store while it waits, including losing its line to another core, is on <a href="#/senior-stores">Senior Stores and Coherence</a>.</p>
<p>One entry, zoomed in:</p>
<div class="tbl"><svg viewBox="0 0 680 386" role="img" aria-label="Fields of one store queue entry, SQ entry 4, for an 8-byte store to physical address 0x2B4C1518. The address group, written when the store-address micro-op executes, holds an address valid bit (1), the page offset, bits 11 to 0 (0x518), the physical page number, bits 45 to 12 (0x2B4C1), and an 8-bit byte mask with bytes 0 to 7 of the 8-byte chunk set. The data group, written when the store-data micro-op executes, holds a data valid bit (1) and 64 bits of data, 0x00000007_0000002A. The bookkeeping group holds a valid bit (1), the LQ position at allocation, 9 bits including a wrap bit (37), the ROB index, 9 bits (301), and a senior bit meaning retired but not yet written to L1 (0). The byte mask is size-many ones shifted left by address bits 2 to 0. Every load at or past LQ entry 37 is younger than this store." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<text x="20" y="20" style="fill:var(--muted);font-size:12px;font-weight:600">One SQ entry (SQ 4): mov [rbx], rax, an 8-byte store to physical address 0x2B4C1518</text>
<text x="20" y="48" style="fill:var(--trace);font-size:12px;font-weight:600">Address (written when the store-address µop executes)</text>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"><rect x="20" y="56" width="90" height="62" rx="3"/><rect x="118" y="56" width="130" height="62" rx="3"/><rect x="256" y="56" width="150" height="62" rx="3"/><rect x="414" y="56" width="246" height="62" rx="3"/></g>
<g style="fill:var(--ink);font-size:11px;font-weight:600" text-anchor="middle"><text x="65" y="74">Address valid</text><text x="183" y="74">Page offset</text><text x="331" y="74">Physical page</text><text x="537" y="74">Byte mask</text></g>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle"><text x="65" y="89">1 bit</text><text x="183" y="89">bits 11–0 (12 bits)</text><text x="331" y="89">bits 45–12 (34 bits)</text><text x="537" y="89">8 bits, bytes 0–7 of the 8-byte chunk</text></g>
<g style="fill:var(--trace);font-size:12px;font-family:var(--mono)" text-anchor="middle"><text x="65" y="108">1</text><text x="183" y="108">0x518</text><text x="331" y="108">0x2B4C1</text></g>
<rect x="465" y="96" width="16" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="483" y="96" width="16" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="501" y="96" width="16" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="519" y="96" width="16" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="537" y="96" width="16" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="555" y="96" width="16" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="573" y="96" width="16" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="591" y="96" width="16" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/>
<text x="20" y="146" style="fill:var(--pad);font-size:12px;font-weight:600">Data (written when the store-data µop executes)</text>
<g style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5"><rect x="20" y="154" width="90" height="62" rx="3"/><rect x="118" y="154" width="542" height="62" rx="3"/></g>
<g style="fill:var(--ink);font-size:11px;font-weight:600" text-anchor="middle"><text x="65" y="172">Data valid</text><text x="389" y="172">Data</text></g>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle"><text x="65" y="187">1 bit</text><text x="389" y="187">64 bits</text></g>
<g style="fill:var(--pad);font-size:12px;font-family:var(--mono)" text-anchor="middle"><text x="65" y="206">1</text><text x="389" y="206">0x00000007_0000002A</text></g>
<text x="20" y="244" style="fill:var(--redirect);font-size:12px;font-weight:600">Bookkeeping (age, commit, and recovery)</text>
<g style="fill:var(--surface);stroke:var(--redirect);stroke-width:1.5"><rect x="20" y="252" width="90" height="62" rx="3"/><rect x="118" y="252" width="190" height="62" rx="3"/><rect x="316" y="252" width="150" height="62" rx="3"/><rect x="474" y="252" width="186" height="62" rx="3"/></g>
<g style="fill:var(--ink);font-size:11px;font-weight:600" text-anchor="middle"><text x="65" y="270">Valid</text><text x="213" y="270">LQ position at allocation</text><text x="391" y="270">ROB index</text><text x="567" y="270">Senior</text></g>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle"><text x="65" y="285">1 bit</text><text x="213" y="285">9 bits (8-bit index + wrap bit)</text><text x="391" y="285">9 bits (512 entries)</text><text x="567" y="285">1 bit: retired, not yet in L1</text></g>
<g style="fill:var(--redirect);font-size:12px;font-family:var(--mono)" text-anchor="middle"><text x="65" y="304">1</text><text x="213" y="304">37</text><text x="391" y="304">301</text><text x="567" y="304">0</text></g>
<g style="fill:var(--muted);font-size:11px"><text x="20" y="342">Byte mask: size-many 1s shifted left by address bits 2–0. Here 8 bytes at chunk offset 0 set bytes 0–7.</text><text x="20" y="358">Little-endian data: byte 0 holds 0x2A and bytes 4–7 hold 0x00000007.</text><text x="20" y="374">LQ position: every load at or past LQ entry 37 is younger than this store.</text></g>
</svg></div>
<p>The address is kept in two pieces because they become known at different times:</p>
<ul>
<li><strong>Page offset (bits 11–0).</strong> It is the same in the virtual and the physical address, so it is ready as soon as the address generation unit adds base and displacement.</li>
<li><strong>Physical page (bits 45–12).</strong> It needs the DTLB, which answers a cycle or more later.</li>
<li><strong>Byte mask.</strong> It is derived from the size and address bits 2–0 and records exactly which bytes of the aligned 8-byte chunk the store writes. Vector stores and stores that cross a chunk boundary need wider masks, so real cores keep more bits or split such stores.</li>
</ul>
<p>The LQ position is the LQ tail when the store was allocated. Every load at or past it is younger than the store, which is how the store knows which loads to check when its address resolves (see <a href="#/lsq-lq/loads">The Load Queue and Ordering Violations</a>).</p>

<h4>A Load Searches the Store Queue</h4>
<p>When a load executes, it has to find out whether an older store that hasn't reached L1 yet writes any of its bytes. It searches the SQ as a <a href="#/cam">CAM</a>: every entry compares itself against the load in parallel, which costs one set of comparators per entry per load port. Each entry runs four checks:</p>
<ol>
<li><strong>Age: does this store count?</strong> At allocation, each load records the SQ tail at that moment, i.e., which store was youngest when the load entered. Only the entries from the SQ head up to that recorded position are older than the load. Everything younger is masked out, and so are empty entries. In hardware every entry compares in parallel and its result is ANDed with this age mask, so a younger store's match never counts.</li>
<li><strong>Page offset: same chunk within the page?</strong> The search compares addresses down to an 8-byte chunk (some cores use 16 bytes), so bits 2–0 are left to the byte check. Many cores first compare only the page-offset bits, here bits 11–3, because those are untranslated and ready before translation finishes. With 4 KB pages the offset is bits 11–0. With 16 KB pages, as on Apple silicon, it is bits 13–0, so the early partial compare covers 2 more bits and finds fewer false partial matches.</li>
<li><strong>Physical page: really the same address?</strong> Once the DTLB answers, the match is confirmed with bits 45–12. This final check must use the physical address, not the virtual one (see <a href="#/lsq-lq/physical-addresses">Virtual and Physical Addresses</a>). Matching on the low bits first is what causes Intel's <strong>4K aliasing</strong> stalls: two addresses a multiple of 4 KiB apart match on the low 12 bits and look like a dependence when they aren't, so the load is held and reissued, which costs a few cycles.</li>
<li><strong>Bytes: which of the load's bytes does the store write?</strong> The load's byte mask is ANDed with the store's. If the AND equals the load's mask, the store covers every byte the load reads (full match). If it is nonzero but smaller, the store covers some of them (partial match). If it is zero, the two share a chunk but no bytes (no match).</li>
</ol>
<p>Several older stores can pass all four checks. Only the youngest of them matters, because its bytes are the last ones written before the load in program order. A priority encoder, starting at the load's recorded position and moving toward the head, picks it (see <a href="#/lsq-search/priority-encoders">Priority Encoders</a>). An older store whose address is still unknown can't be compared at all. Whether the load waits for it or goes ahead anyway is the memory dependence predictor's call (see <a href="#/mdp">Why Predict Memory Dependences</a>). A store that has its data but not its address counts the same (see <a href="#/lsq/missing-fields">Missing Address or Data</a>).</p>
<div class="tbl"><svg viewBox="0 0 680 472" role="img" aria-label="A 4-byte load to physical address 0x2B4C151C, page 0x2B4C1, offset 0x51C, bytes 4 to 7 of its 8-byte chunk, searches an 8-entry store queue. The load recorded SQ tail 6 at allocation, so only SQ entries 0 to 5, from the head, can be older. Four checks run on each entry. Check 1, age: is the entry older than the load. Check 2: page-offset bits 11 to 3 match. Check 3: physical page bits 45 to 12 match. Check 4: AND of byte masks. SQ 0: page 0x2B4C1, offset 0x51C, 4 bytes, bytes 4 to 7. Passes all checks with full coverage, but SQ 4 is younger. SQ 1: page 0x1E077, offset 0x51C, 4 bytes. Offset matches, page does not: 4K aliasing. SQ 2: page 0x2B4C1, offset 0x600, 8 bytes. Different 8-byte chunk. SQ 3: address unknown, so nothing can be compared and the memory dependence predictor decides whether the load waits. SQ 4: page 0x2B4C1, offset 0x518, 8 bytes, bytes 0 to 7. Passes all checks with full coverage and is the youngest match, so it forwards bytes 4 to 7. SQ 5: page 0x2B4C1, offset 0x518, 2 bytes, bytes 0 to 1. Same chunk but no shared bytes. SQ 6: same address as the load but younger, masked out by age. SQ 7: empty, the tail. The priority encoder picks SQ 4 and the load gets 0x00000007, as long as SQ 3's address does not overlap." style="width:100%;min-width:600px;max-width:680px;display:block;font-family:var(--sans)">
<defs><marker id="arrSQ" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker></defs>
<text x="20" y="20" style="fill:var(--muted);font-size:12px;font-weight:600">A 4-byte load, mov ecx, [rsi], to physical address 0x2B4C151C, searches an 8-entry SQ</text>
<rect x="60" y="34" width="276" height="28" rx="3" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5"/>
<g style="fill:var(--pad);font-size:11px;font-family:var(--mono)" text-anchor="middle"><text x="84" y="52" style="font-family:var(--sans);font-weight:600">load</text><text x="138" y="52">0x2B4C1</text><text x="192" y="52">51C</text><text x="229" y="52">4 B</text></g>
<rect x="246" y="41" width="9" height="14" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="257" y="41" width="9" height="14" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="268" y="41" width="9" height="14" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="279" y="41" width="9" height="14" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="290" y="41" width="9" height="14" style="fill:var(--pad);stroke:var(--muted);stroke-width:0.75"/><rect x="301" y="41" width="9" height="14" style="fill:var(--pad);stroke:var(--muted);stroke-width:0.75"/><rect x="312" y="41" width="9" height="14" style="fill:var(--pad);stroke:var(--muted);stroke-width:0.75"/><rect x="323" y="41" width="9" height="14" style="fill:var(--pad);stroke:var(--muted);stroke-width:0.75"/>
<g style="fill:var(--muted);font-size:10.5px"><text x="354" y="46">recorded SQ tail at allocation: 6</text><text x="354" y="60">only SQ 0–5 can be older</text></g>
<g style="fill:var(--ink);font-size:11px;font-weight:600" text-anchor="middle"><text x="84" y="92">entry</text><text x="138" y="92">page</text><text x="192" y="92">offset</text><text x="229" y="92">size</text><text x="290" y="92">bytes 0–7</text><text x="356" y="92">①</text><text x="392" y="92">②</text><text x="428" y="92">③</text><text x="464" y="92">④</text></g>
<text x="490" y="92" style="fill:var(--ink);font-size:11px;font-weight:600">outcome</text>
<g style="fill:var(--muted);font-size:9.5px" text-anchor="middle"><text x="138" y="105">bits 45–12</text><text x="192" y="105">bits 11–0</text><text x="356" y="105">older</text><text x="392" y="105">11–3</text><text x="428" y="105">45–12</text><text x="464" y="105">bytes</text><text x="356" y="117">than load</text><text x="392" y="117">offset</text><text x="428" y="117">page</text><text x="464" y="117">AND</text></g>
<text x="490" y="105" style="fill:var(--muted);font-size:9.5px">the youngest older match wins</text>
<rect x="60" y="128" width="616" height="26" rx="2" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/>
<text x="84" y="145" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">SQ 0</text>
<g style="fill:var(--ink);font-size:11px;font-family:var(--mono)" text-anchor="middle"><text x="138" y="145">0x2B4C1</text><text x="192" y="145">51C</text><text x="229" y="145">4 B</text></g>
<rect x="246" y="134" width="9" height="14" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="257" y="134" width="9" height="14" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="268" y="134" width="9" height="14" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="279" y="134" width="9" height="14" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="290" y="134" width="9" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="301" y="134" width="9" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="312" y="134" width="9" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="323" y="134" width="9" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/>
<text x="356" y="145" text-anchor="middle" style="fill:var(--ink);font-weight:600;font-size:12px">✓</text>
<text x="392" y="145" text-anchor="middle" style="fill:var(--ink);font-weight:600;font-size:12px">✓</text>
<text x="428" y="145" text-anchor="middle" style="fill:var(--ink);font-weight:600;font-size:12px">✓</text>
<text x="464" y="145" text-anchor="middle" style="fill:var(--accent-green);font-weight:600;font-size:10px">full</text>
<text x="490" y="145" style="fill:var(--ink);font-size:10.5px">full, but SQ 4 is younger</text>
<rect x="60" y="156" width="616" height="26" rx="2" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/>
<text x="84" y="173" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">SQ 1</text>
<g style="fill:var(--ink);font-size:11px;font-family:var(--mono)" text-anchor="middle"><text x="138" y="173">0x1E077</text><text x="192" y="173">51C</text><text x="229" y="173">4 B</text></g>
<rect x="246" y="162" width="9" height="14" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="257" y="162" width="9" height="14" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="268" y="162" width="9" height="14" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="279" y="162" width="9" height="14" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="290" y="162" width="9" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="301" y="162" width="9" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="312" y="162" width="9" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="323" y="162" width="9" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/>
<text x="356" y="173" text-anchor="middle" style="fill:var(--ink);font-weight:600;font-size:12px">✓</text>
<text x="392" y="173" text-anchor="middle" style="fill:var(--ink);font-weight:600;font-size:12px">✓</text>
<text x="428" y="173" text-anchor="middle" style="fill:var(--accent-red);font-weight:600;font-size:12px">✗</text>
<text x="464" y="173" text-anchor="middle" style="fill:var(--muted);font-size:12px">–</text>
<text x="490" y="173" style="fill:var(--ink);font-size:10.5px">4K alias: offset hits, page misses</text>
<rect x="60" y="184" width="616" height="26" rx="2" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/>
<text x="84" y="201" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">SQ 2</text>
<g style="fill:var(--ink);font-size:11px;font-family:var(--mono)" text-anchor="middle"><text x="138" y="201">0x2B4C1</text><text x="192" y="201">600</text><text x="229" y="201">8 B</text></g>
<rect x="246" y="190" width="9" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="257" y="190" width="9" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="268" y="190" width="9" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="279" y="190" width="9" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="290" y="190" width="9" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="301" y="190" width="9" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="312" y="190" width="9" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="323" y="190" width="9" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/>
<text x="356" y="201" text-anchor="middle" style="fill:var(--ink);font-weight:600;font-size:12px">✓</text>
<text x="392" y="201" text-anchor="middle" style="fill:var(--accent-red);font-weight:600;font-size:12px">✗</text>
<text x="428" y="201" text-anchor="middle" style="fill:var(--muted);font-size:12px">–</text>
<text x="464" y="201" text-anchor="middle" style="fill:var(--muted);font-size:12px">–</text>
<text x="490" y="201" style="fill:var(--ink);font-size:10.5px">different 8-byte chunk</text>
<rect x="60" y="212" width="616" height="26" rx="2" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/>
<text x="84" y="229" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">SQ 3</text>
<g style="fill:var(--ink);font-size:11px;font-family:var(--mono)" text-anchor="middle"><text x="138" y="229">?</text><text x="192" y="229">?</text><text x="229" y="229">8 B</text></g>
<rect x="246" y="218" width="9" height="14" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="257" y="218" width="9" height="14" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="268" y="218" width="9" height="14" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="279" y="218" width="9" height="14" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="290" y="218" width="9" height="14" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="301" y="218" width="9" height="14" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="312" y="218" width="9" height="14" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="323" y="218" width="9" height="14" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><text x="289" y="229" text-anchor="middle" style="fill:var(--muted);font-size:10px">?</text>
<text x="356" y="229" text-anchor="middle" style="fill:var(--ink);font-weight:600;font-size:12px">✓</text>
<text x="392" y="229" text-anchor="middle" style="fill:var(--muted);font-size:12px">?</text>
<text x="428" y="229" text-anchor="middle" style="fill:var(--muted);font-size:12px">?</text>
<text x="464" y="229" text-anchor="middle" style="fill:var(--muted);font-size:12px">?</text>
<text x="490" y="229" style="fill:var(--ink);font-size:10.5px">address unknown: MDP decides</text>
<rect x="60" y="240" width="616" height="26" rx="2" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/>
<text x="84" y="257" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">SQ 4</text>
<g style="fill:var(--ink);font-size:11px;font-family:var(--mono)" text-anchor="middle"><text x="138" y="257">0x2B4C1</text><text x="192" y="257">518</text><text x="229" y="257">8 B</text></g>
<rect x="246" y="246" width="9" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="257" y="246" width="9" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="268" y="246" width="9" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="279" y="246" width="9" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="290" y="246" width="9" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="301" y="246" width="9" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="312" y="246" width="9" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="323" y="246" width="9" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/>
<text x="356" y="257" text-anchor="middle" style="fill:var(--ink);font-weight:600;font-size:12px">✓</text>
<text x="392" y="257" text-anchor="middle" style="fill:var(--ink);font-weight:600;font-size:12px">✓</text>
<text x="428" y="257" text-anchor="middle" style="fill:var(--ink);font-weight:600;font-size:12px">✓</text>
<text x="464" y="257" text-anchor="middle" style="fill:var(--accent-green);font-weight:600;font-size:10px">full</text>
<text x="490" y="257" style="fill:var(--accent-green);font-size:10.5px;font-weight:600">full hit: forward bytes 4–7</text>
<rect x="60" y="268" width="616" height="26" rx="2" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/>
<text x="84" y="285" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">SQ 5</text>
<g style="fill:var(--ink);font-size:11px;font-family:var(--mono)" text-anchor="middle"><text x="138" y="285">0x2B4C1</text><text x="192" y="285">518</text><text x="229" y="285">2 B</text></g>
<rect x="246" y="274" width="9" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="257" y="274" width="9" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="268" y="274" width="9" height="14" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="279" y="274" width="9" height="14" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="290" y="274" width="9" height="14" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="301" y="274" width="9" height="14" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="312" y="274" width="9" height="14" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="323" y="274" width="9" height="14" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/>
<text x="356" y="285" text-anchor="middle" style="fill:var(--ink);font-weight:600;font-size:12px">✓</text>
<text x="392" y="285" text-anchor="middle" style="fill:var(--ink);font-weight:600;font-size:12px">✓</text>
<text x="428" y="285" text-anchor="middle" style="fill:var(--ink);font-weight:600;font-size:12px">✓</text>
<text x="464" y="285" text-anchor="middle" style="fill:var(--muted);font-weight:600;font-size:10px">none</text>
<text x="490" y="285" style="fill:var(--ink);font-size:10.5px">same chunk, no shared bytes</text>
<rect x="60" y="296" width="616" height="26" rx="2" style="fill:var(--rule);stroke:var(--rule);stroke-width:1"/>
<text x="84" y="313" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:600">SQ 6</text>
<g style="fill:var(--muted);font-size:11px;font-family:var(--mono)" text-anchor="middle"><text x="138" y="313">0x2B4C1</text><text x="192" y="313">51C</text><text x="229" y="313">4 B</text></g>
<rect x="246" y="302" width="9" height="14" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="257" y="302" width="9" height="14" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="268" y="302" width="9" height="14" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="279" y="302" width="9" height="14" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="290" y="302" width="9" height="14" style="fill:var(--muted);stroke:var(--muted);stroke-width:0.75"/><rect x="301" y="302" width="9" height="14" style="fill:var(--muted);stroke:var(--muted);stroke-width:0.75"/><rect x="312" y="302" width="9" height="14" style="fill:var(--muted);stroke:var(--muted);stroke-width:0.75"/><rect x="323" y="302" width="9" height="14" style="fill:var(--muted);stroke:var(--muted);stroke-width:0.75"/>
<text x="356" y="313" text-anchor="middle" style="fill:var(--accent-red);font-weight:600;font-size:12px">✗</text>
<text x="392" y="313" text-anchor="middle" style="fill:var(--muted);font-size:12px">–</text>
<text x="428" y="313" text-anchor="middle" style="fill:var(--muted);font-size:12px">–</text>
<text x="464" y="313" text-anchor="middle" style="fill:var(--muted);font-size:12px">–</text>
<text x="490" y="313" style="fill:var(--muted);font-size:10.5px">younger: masked out</text>
<rect x="60" y="324" width="616" height="26" rx="2" style="fill:var(--rule);stroke:var(--rule);stroke-width:1"/>
<text x="84" y="341" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:600">SQ 7</text>
<text x="356" y="341" text-anchor="middle" style="fill:var(--accent-red);font-weight:600;font-size:12px">✗</text>
<text x="490" y="341" style="fill:var(--muted);font-size:10.5px">empty: masked out</text>
<g style="fill:var(--muted);font-size:10px"><text x="20" y="145">head</text><text x="20" y="341">tail</text></g>
<g style="stroke:var(--muted);stroke-width:1.2;fill:none"><path d="M46,141 H58" marker-end="url(#arrSQ)"/><path d="M42,337 H58" marker-end="url(#arrSQ)"/></g>
<path d="M20,295 H676" style="stroke:var(--pad);stroke-width:1.5;stroke-dasharray:5 3;fill:none"/>
<text x="20" y="291" style="fill:var(--pad);font-size:10px;font-weight:600">mark</text>
<g style="fill:var(--muted);font-size:11px"><text x="20" y="372">① masks out SQ 6 and SQ 7: only entries from the head up to the load's mark are older.</text><text x="20" y="388">② compares page-offset bits 11–3, ready from the AGU before the DTLB answers.</text><text x="20" y="404">③ confirms with physical-page bits 45–12 once translation finishes. SQ 1 fails here.</text><text x="20" y="420">④ ANDs byte masks. full = covers all of the load's bytes, none = shares no bytes.</text><text x="20" y="436">SQ 0 and SQ 4 both pass. The priority encoder picks the younger one, SQ 4, and the load</text><text x="20" y="452">gets SQ 4's bytes 4–7 (0x00000007), as long as SQ 3's unknown address doesn't overlap.</text></g>
</svg></div>
<p>What happens next depends on the youngest matching store:</p>
<ul>
<li><strong>Miss.</strong> No older store writes any of the load's bytes. The load reads L1 as usual. If it went past an older store whose address was unknown and that store turns out to overlap, the store's probe of the LQ catches it later (see <a href="#/lsq-lq/loads">The Load Queue and Ordering Violations</a>).</li>
<li><strong>Partial hit.</strong> The youngest matching store writes some of the load's bytes but not all. The rest would have to come from L1 or from other, older stores, and the forwarding path takes one store's data and shifts it into place, nothing more. So most cores block the load until the store commits and writes L1, then replay it to read the merged line. This <strong>store-forwarding stall</strong> lasts until the store drains, much longer than a forward. It happens even when an older store would cover the load fully, because the youngest store's bytes override the older one's. Some cores merge a store's bytes with cache data to avoid the stall, at the cost of a wider data path. Compilers avoid a narrow store followed by a wide load from the same place for this reason.</li>
<li><strong>Full hit.</strong> The youngest matching store writes every byte the load reads. The SQ forwards them: it shifts the store's data by the difference in their offsets and hands the load its bytes at about L1-hit latency, without touching the cache. If the store-data µop hasn't executed yet (data valid is 0), the load waits for the data and then forwards, rather than read a stale value from L1 (see <a href="#/lsq/missing-fields">Missing Address or Data</a>).</li>
</ul>
<p>The byte check for each outcome, on the load from the figure above:</p>
<div class="tbl"><svg viewBox="0 0 680 226" role="img" aria-label="Step 4, the byte check, for a load of bytes 4 to 7 of chunk 0x2B4C1518 against three stores to the same chunk. An 8-byte store at offset 0x518 sets bytes 0 to 7. AND with the load's mask gives bytes 4 to 7, equal to the load's mask: full match, forward. A 2-byte store at offset 0x51C sets bytes 4 and 5. The AND gives bytes 4 and 5, nonzero but smaller than the load's mask: partial match, stall. A 4-byte store at offset 0x518 sets bytes 0 to 3. The AND is zero: no match. Forwarding shifts the store's data right by 4 bytes so its bytes 4 to 7 become the load's bytes 0 to 3." style="width:100%;min-width:600px;max-width:680px;display:block;font-family:var(--sans)">
<text x="20" y="20" style="fill:var(--muted);font-size:12px;font-weight:600">Step ④ for the same load (bytes 4–7) against three stores to its chunk 0x2B4C1518</text>
<g style="fill:var(--ink);font-size:11px;font-weight:600"><text x="20" y="48">store</text><text x="196" y="48">store mask</text><text x="326" y="48">load mask</text><text x="456" y="48">store AND load</text><text x="586" y="48">outcome</text></g>
<g style="fill:var(--muted);font-size:9px"><text x="202" y="64" text-anchor="middle">0</text><text x="216" y="64" text-anchor="middle">1</text><text x="230" y="64" text-anchor="middle">2</text><text x="244" y="64" text-anchor="middle">3</text><text x="258" y="64" text-anchor="middle">4</text><text x="272" y="64" text-anchor="middle">5</text><text x="286" y="64" text-anchor="middle">6</text><text x="300" y="64" text-anchor="middle">7</text><text x="332" y="64" text-anchor="middle">0</text><text x="346" y="64" text-anchor="middle">1</text><text x="360" y="64" text-anchor="middle">2</text><text x="374" y="64" text-anchor="middle">3</text><text x="388" y="64" text-anchor="middle">4</text><text x="402" y="64" text-anchor="middle">5</text><text x="416" y="64" text-anchor="middle">6</text><text x="430" y="64" text-anchor="middle">7</text><text x="462" y="64" text-anchor="middle">0</text><text x="476" y="64" text-anchor="middle">1</text><text x="490" y="64" text-anchor="middle">2</text><text x="504" y="64" text-anchor="middle">3</text><text x="518" y="64" text-anchor="middle">4</text><text x="532" y="64" text-anchor="middle">5</text><text x="546" y="64" text-anchor="middle">6</text><text x="560" y="64" text-anchor="middle">7</text></g>
<text x="20" y="86" style="fill:var(--ink);font-size:11px">8 B at offset 0x518</text>
<rect x="196" y="74" width="12" height="16" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="210" y="74" width="12" height="16" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="224" y="74" width="12" height="16" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="238" y="74" width="12" height="16" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="252" y="74" width="12" height="16" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="266" y="74" width="12" height="16" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="280" y="74" width="12" height="16" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="294" y="74" width="12" height="16" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/>
<rect x="326" y="74" width="12" height="16" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="340" y="74" width="12" height="16" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="354" y="74" width="12" height="16" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="368" y="74" width="12" height="16" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="382" y="74" width="12" height="16" style="fill:var(--pad);stroke:var(--muted);stroke-width:0.75"/><rect x="396" y="74" width="12" height="16" style="fill:var(--pad);stroke:var(--muted);stroke-width:0.75"/><rect x="410" y="74" width="12" height="16" style="fill:var(--pad);stroke:var(--muted);stroke-width:0.75"/><rect x="424" y="74" width="12" height="16" style="fill:var(--pad);stroke:var(--muted);stroke-width:0.75"/>
<rect x="456" y="74" width="12" height="16" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="470" y="74" width="12" height="16" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="484" y="74" width="12" height="16" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="498" y="74" width="12" height="16" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="512" y="74" width="12" height="16" style="fill:var(--ink);stroke:var(--muted);stroke-width:0.75"/><rect x="526" y="74" width="12" height="16" style="fill:var(--ink);stroke:var(--muted);stroke-width:0.75"/><rect x="540" y="74" width="12" height="16" style="fill:var(--ink);stroke:var(--muted);stroke-width:0.75"/><rect x="554" y="74" width="12" height="16" style="fill:var(--ink);stroke:var(--muted);stroke-width:0.75"/>
<text x="586" y="86" style="fill:var(--accent-green);font-size:11px;font-weight:600">full: forward</text>
<text x="20" y="120" style="fill:var(--ink);font-size:11px">2 B at offset 0x51C</text>
<rect x="196" y="108" width="12" height="16" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="210" y="108" width="12" height="16" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="224" y="108" width="12" height="16" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="238" y="108" width="12" height="16" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="252" y="108" width="12" height="16" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="266" y="108" width="12" height="16" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="280" y="108" width="12" height="16" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="294" y="108" width="12" height="16" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/>
<rect x="326" y="108" width="12" height="16" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="340" y="108" width="12" height="16" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="354" y="108" width="12" height="16" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="368" y="108" width="12" height="16" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="382" y="108" width="12" height="16" style="fill:var(--pad);stroke:var(--muted);stroke-width:0.75"/><rect x="396" y="108" width="12" height="16" style="fill:var(--pad);stroke:var(--muted);stroke-width:0.75"/><rect x="410" y="108" width="12" height="16" style="fill:var(--pad);stroke:var(--muted);stroke-width:0.75"/><rect x="424" y="108" width="12" height="16" style="fill:var(--pad);stroke:var(--muted);stroke-width:0.75"/>
<rect x="456" y="108" width="12" height="16" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="470" y="108" width="12" height="16" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="484" y="108" width="12" height="16" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="498" y="108" width="12" height="16" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="512" y="108" width="12" height="16" style="fill:var(--ink);stroke:var(--muted);stroke-width:0.75"/><rect x="526" y="108" width="12" height="16" style="fill:var(--ink);stroke:var(--muted);stroke-width:0.75"/><rect x="540" y="108" width="12" height="16" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="554" y="108" width="12" height="16" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/>
<text x="586" y="120" style="fill:var(--accent-red);font-size:11px;font-weight:600">partial: stall</text>
<text x="20" y="154" style="fill:var(--ink);font-size:11px">4 B at offset 0x518</text>
<rect x="196" y="142" width="12" height="16" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="210" y="142" width="12" height="16" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="224" y="142" width="12" height="16" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="238" y="142" width="12" height="16" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="252" y="142" width="12" height="16" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="266" y="142" width="12" height="16" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="280" y="142" width="12" height="16" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="294" y="142" width="12" height="16" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/>
<rect x="326" y="142" width="12" height="16" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="340" y="142" width="12" height="16" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="354" y="142" width="12" height="16" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="368" y="142" width="12" height="16" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="382" y="142" width="12" height="16" style="fill:var(--pad);stroke:var(--muted);stroke-width:0.75"/><rect x="396" y="142" width="12" height="16" style="fill:var(--pad);stroke:var(--muted);stroke-width:0.75"/><rect x="410" y="142" width="12" height="16" style="fill:var(--pad);stroke:var(--muted);stroke-width:0.75"/><rect x="424" y="142" width="12" height="16" style="fill:var(--pad);stroke:var(--muted);stroke-width:0.75"/>
<rect x="456" y="142" width="12" height="16" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="470" y="142" width="12" height="16" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="484" y="142" width="12" height="16" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="498" y="142" width="12" height="16" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="512" y="142" width="12" height="16" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="526" y="142" width="12" height="16" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="540" y="142" width="12" height="16" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="554" y="142" width="12" height="16" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/>
<text x="586" y="154" style="fill:var(--muted);font-size:11px;font-weight:600">none: no match</text>
<g style="fill:var(--muted);font-size:11px"><text x="20" y="190">full: the AND equals the load's mask. partial: the AND is nonzero but smaller. none: the AND is zero.</text><text x="20" y="206">Forwarding shifts the store's data right by 4 bytes (0x51C − 0x518) so its bytes 4–7 land in the load's bytes 0–3.</text></g>
</svg></div>
<p>The same search as gates. The top half is the logic every SQ entry carries, and the bottom half runs once per load port across all entries. The four checks keep their numbers from the list above:</p>
<div class="tbl"><svg viewBox="0 0 680 712" role="img" aria-label="Gate-level logic of the SQ search. Per SQ entry i, one copy for every entry and every load port: valid i AND older i, from the age mask, gives check 1. Load offset bits 11 to 3 and the entry offset go through a 9-bit XNOR and an AND of all bits, the offset match, check 2. The page bits 45 to 12 go through a 34-bit XNOR and an AND of all bits, the page match, check 3. The load and store byte masks are ANDed bit by bit, check 4. An OR of the 8 result bits says any byte is shared. The 8 result bits are also XNORed with the load mask and ANDed together, giving cover i, set when the store writes every byte the load reads. Match i is the AND of address valid, valid and older, offset match, page match, and any byte shared. Unknown i is valid and older AND NOT address valid. Across all N entries, 114 on Golden Cove, once per load port: the match vector goes into a priority encoder where the youngest older store wins. Its one-hot grant is ANDed with each entry data and ORed over all entries to select 64 bits of store data, which are shifted right by 8 times the difference in byte offsets. A 2 to 1 mux picks the shifted store data or the L1 data. The encoder valid output is the hit signal. Hit AND winner cover AND winner data valid is a full hit and drives the mux select to forward. Hit AND cover AND NOT data valid waits for the store data. Hit AND NOT cover is a partial hit, a store-forwarding stall. In a real CAM the XNOR and AND are one precharged match line per entry." style="width:100%;min-width:600px;max-width:680px;display:block;font-family:var(--sans)">
<text x="20" y="20" style="fill:var(--muted);font-size:12px;font-weight:600">The SQ search as gates: each entry’s match logic, then the pick across entries</text>
<text x="20" y="42" style="fill:var(--trace);font-size:12px;font-weight:600">Per SQ entry i: one copy for every entry and every load port</text>
<text x="148" y="64" text-anchor="end" style="fill:var(--ink);font-size:10.5px">addr valid i</text>
<path d="M152,60 H533" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<circle cx="536" cy="60" r="3" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.3"/>
<circle cx="420" cy="60" r="2.6" style="fill:var(--muted)"/>
<path d="M420,60 V96 H435 A5,5 0 0 1 445,96 H473" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<text x="148" y="108" text-anchor="end" style="fill:var(--ink);font-size:10.5px">valid i</text>
<text x="148" y="124" text-anchor="end" style="fill:var(--ink);font-size:10.5px">older i (age mask)</text>
<path d="M152,104 H190" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<path d="M152,120 H190" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<path d="M190,94 H202 A18,18 0 0 1 202,130 H190 Z" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.3"/>
<path d="M220,112 H473" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<text x="228" y="107" style="fill:var(--muted);font-size:9.5px">① valid and older</text>
<circle cx="440" cy="112" r="2.6" style="fill:var(--muted)"/>
<path d="M440,112 V76 H540" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<path d="M540,52 H552 A18,16 0 0 1 552,84 H540 Z" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.3"/>
<path d="M570,68 H588" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<text x="592" y="66" style="fill:var(--ink);font-size:10.5px;font-weight:600">unknown i</text>
<text x="592" y="79" style="fill:var(--muted);font-size:9.5px">older, no address</text>
<text x="148" y="150" text-anchor="end" style="fill:var(--ink);font-size:10.5px">load offset[11:3]</text>
<text x="148" y="166" text-anchor="end" style="fill:var(--ink);font-size:10.5px">SQ i offset[11:3]</text>
<path d="M152,146 H196" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<path d="M152,162 H196" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<path d="M190,134 Q199,154 190,174" style="fill:none;stroke:var(--ink);stroke-width:1.3"/>
<path d="M195,134 Q215,134 227,154 Q215,174 195,174 Q204,154 195,134 Z" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.3"/>
<circle cx="230" cy="154" r="3" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.3"/>
<path d="M233,154 H262" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<path d="M244,159 L252,149" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<text x="250" y="147" text-anchor="middle" style="fill:var(--muted);font-size:9px">9</text>
<path d="M262,142 H274 A18,12 0 0 1 274,166 H262 Z" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.3"/>
<text x="274" y="139" text-anchor="middle" style="fill:var(--muted);font-size:9px">AND all</text>
<text x="300" y="149" style="fill:var(--muted);font-size:9.5px">② offset match</text>
<path d="M292,154 H473" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<text x="148" y="200" text-anchor="end" style="fill:var(--ink);font-size:10.5px">load page[45:12]</text>
<text x="148" y="216" text-anchor="end" style="fill:var(--ink);font-size:10.5px">SQ i page[45:12]</text>
<path d="M152,196 H196" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<path d="M152,212 H196" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<path d="M190,184 Q199,204 190,224" style="fill:none;stroke:var(--ink);stroke-width:1.3"/>
<path d="M195,184 Q215,184 227,204 Q215,224 195,224 Q204,204 195,184 Z" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.3"/>
<circle cx="230" cy="204" r="3" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.3"/>
<path d="M233,204 H262" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<path d="M244,209 L252,199" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<text x="250" y="197" text-anchor="middle" style="fill:var(--muted);font-size:9px">34</text>
<path d="M262,192 H274 A18,12 0 0 1 274,216 H262 Z" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.3"/>
<text x="274" y="189" text-anchor="middle" style="fill:var(--muted);font-size:9px">AND all</text>
<text x="300" y="199" style="fill:var(--muted);font-size:9.5px">③ page match</text>
<path d="M292,204 H473" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<text x="148" y="250" text-anchor="end" style="fill:var(--ink);font-size:10.5px">load mask[7:0]</text>
<text x="148" y="266" text-anchor="end" style="fill:var(--ink);font-size:10.5px">SQ i mask[7:0]</text>
<path d="M152,246 H190" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<path d="M152,262 H190" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<path d="M190,236 H202 A18,18 0 0 1 202,272 H190 Z" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.3"/>
<path d="M220,254 H266" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<path d="M228,259 L236,249" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<text x="234" y="247" text-anchor="middle" style="fill:var(--muted);font-size:9px">8</text>
<circle cx="244" cy="254" r="2.6" style="fill:var(--muted)"/>
<path d="M262,242 Q282,242 294,254 Q282,266 262,266 Q271,254 262,242 Z" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.3"/>
<text x="278" y="239" text-anchor="middle" style="fill:var(--muted);font-size:9px">OR all</text>
<text x="302" y="249" style="fill:var(--muted);font-size:9.5px">④ any byte shared</text>
<path d="M294,254 H473" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<path d="M244,254 V294 H306" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<text x="148" y="314" text-anchor="end" style="fill:var(--ink);font-size:10.5px">load mask[7:0]</text>
<path d="M152,310 H306" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<path d="M300,282 Q309,302 300,322" style="fill:none;stroke:var(--ink);stroke-width:1.3"/>
<path d="M305,282 Q325,282 337,302 Q325,322 305,322 Q314,302 305,282 Z" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.3"/>
<circle cx="340" cy="302" r="3" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.3"/>
<path d="M343,302 H370" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<path d="M352,307 L360,297" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<text x="358" y="295" text-anchor="middle" style="fill:var(--muted);font-size:9px">8</text>
<path d="M370,290 H382 A18,12 0 0 1 382,314 H370 Z" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.3"/>
<text x="382" y="287" text-anchor="middle" style="fill:var(--muted);font-size:9px">AND all</text>
<path d="M400,302 H588" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<text x="592" y="300" style="fill:var(--ink);font-size:10.5px;font-weight:600">cover i</text>
<text x="592" y="313" style="fill:var(--muted);font-size:9.5px">every load byte</text>
<path d="M470,86 H480 A24,89 0 0 1 480,264 H470 Z" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.3"/>
<path d="M504,175 H588" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<text x="592" y="173" style="fill:var(--ink);font-size:10.5px;font-weight:600">match i</text>
<text x="592" y="186" style="fill:var(--muted);font-size:9.5px">all four pass</text>
<path d="M20,346 H676" style="fill:none;stroke:var(--rule);stroke-width:1"/>
<text x="20" y="368" style="fill:var(--pad);font-size:12px;font-weight:600">Across all N entries (N = 114 on Golden Cove), once per load port</text>
<text x="20" y="412" style="fill:var(--ink);font-size:10.5px">match[N−1:0]</text>
<path d="M90,408 H110" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<path d="M96,413 L104,403" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<text x="102" y="401" text-anchor="middle" style="fill:var(--muted);font-size:9px">N</text>
<rect x="110" y="384" width="120" height="56" rx="3" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.3"/>
<text x="170" y="402" text-anchor="middle" style="fill:var(--ink);font-size:10.5px;font-weight:600">priority encoder</text>
<text x="170" y="416" text-anchor="middle" style="fill:var(--muted);font-size:9.5px">youngest older wins</text>
<text x="170" y="430" text-anchor="middle" style="fill:var(--muted);font-size:9.5px">circular, see below</text>
<path d="M230,398 H303" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<path d="M240,403 L248,393" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<text x="246" y="391" text-anchor="middle" style="fill:var(--muted);font-size:9px">N</text>
<text x="274" y="392" text-anchor="middle" style="fill:var(--muted);font-size:9.5px">grant</text>
<path d="M282,452 V418 H303" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<text x="282" y="464" text-anchor="middle" style="fill:var(--ink);font-size:10.5px">data i</text>
<path d="M300,388 H312 A18,20 0 0 1 312,428 H300 Z" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.3"/>
<text x="315" y="384" text-anchor="middle" style="fill:var(--muted);font-size:9px">×N</text>
<path d="M330,408 H354" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<path d="M333,413 L341,403" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<text x="339" y="401" text-anchor="middle" style="fill:var(--muted);font-size:9px">64</text>
<path d="M350,392 Q370,392 382,408 Q370,424 350,424 Q359,408 350,392 Z" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.3"/>
<text x="366" y="438" text-anchor="middle" style="fill:var(--muted);font-size:9px">OR over N</text>
<path d="M382,408 H404" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<rect x="404" y="388" width="92" height="40" rx="3" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.3"/>
<text x="450" y="405" text-anchor="middle" style="fill:var(--ink);font-size:10.5px;font-weight:600">shift right</text>
<text x="450" y="419" text-anchor="middle" style="fill:var(--muted);font-size:9.5px">8 × (ld − st) off[2:0]</text>
<path d="M496,408 H530" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<path d="M490,444 H530" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<text x="486" y="448" text-anchor="end" style="fill:var(--ink);font-size:10.5px">L1 data[63:0]</text>
<path d="M530,390 L554,400 L554,450 L530,460 Z" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5"/>
<text x="534" y="447.5" style="fill:var(--muted);font-size:9px">0</text>
<text x="534" y="411.5" style="fill:var(--muted);font-size:9px">1</text>
<path d="M554,425 H588" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<text x="592" y="423" style="fill:var(--ink);font-size:10.5px;font-weight:600">load value</text>
<path d="M170,440 V492 H262" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<text x="176" y="466" style="fill:var(--muted);font-size:9.5px">valid out = hit</text>
<text x="148" y="512" text-anchor="end" style="fill:var(--ink);font-size:10.5px">cover (winner)</text>
<path d="M152,508 H276" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<text x="148" y="528" text-anchor="end" style="fill:var(--ink);font-size:10.5px">data valid (winner)</text>
<path d="M152,524 H290" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<path d="M262,492 V600" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<path d="M276,508 V600" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<path d="M290,524 V600" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<circle cx="262" cy="500" r="2.6" style="fill:var(--muted)"/>
<path d="M262,500 H340" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<circle cx="276" cy="510" r="2.6" style="fill:var(--muted)"/>
<path d="M276,510 H340" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<circle cx="290" cy="524" r="2.6" style="fill:var(--muted)"/>
<path d="M290,524 H340" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<path d="M340,492 H352 A18,20 0 0 1 352,532 H340 Z" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.3"/>
<path d="M370,512 H542 V453" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<text x="400" y="507" style="fill:var(--accent-green);font-size:10.5px;font-weight:600">full hit: forward</text>
<circle cx="262" cy="546" r="2.6" style="fill:var(--muted)"/>
<path d="M262,546 H340" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<circle cx="276" cy="556" r="2.6" style="fill:var(--muted)"/>
<path d="M276,556 H340" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<circle cx="290" cy="566" r="2.6" style="fill:var(--muted)"/>
<path d="M290,566 H334" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<circle cx="337" cy="566" r="3" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.3"/>
<path d="M340,538 H352 A18,19 0 0 1 352,576 H340 Z" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.3"/>
<path d="M370,557 H396" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<text x="400" y="561" style="fill:var(--ink);font-size:10.5px">full hit, data not ready: wait for the store data</text>
<circle cx="262" cy="590" r="2.6" style="fill:var(--muted)"/>
<path d="M262,590 H340" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<circle cx="276" cy="600" r="2.6" style="fill:var(--muted)"/>
<path d="M276,600 H334" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<circle cx="337" cy="600" r="3" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.3"/>
<path d="M340,584 H352 A18,12 0 0 1 352,608 H340 Z" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.3"/>
<path d="M370,596 H396" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<text x="400" y="600" style="fill:var(--accent-red);font-size:10.5px;font-weight:600">partial hit: store-forwarding stall</text>
<text x="20" y="636" style="fill:var(--muted);font-size:11px">① to ④ are the four checks. XNOR then AND-all is an equality compare. In a real CAM it is one match line</text>
<text x="20" y="652" style="fill:var(--muted);font-size:11px">per entry, precharged high and pulled low by any bit cell that mismatches. The offset match settles before</text>
<text x="20" y="668" style="fill:var(--muted);font-size:11px">the page match, so a design can start on it early, which is where 4K aliasing comes from. The same AND-OR</text>
<text x="20" y="684" style="fill:var(--muted);font-size:11px">that picks the winner’s data i picks its cover bit and data valid bit. The unknown i bits are ORed across</text>
<text x="20" y="700" style="fill:var(--muted);font-size:11px">entries into one bit saying the load went past a store whose address isn’t known yet.</text>
</svg></div>
<h3 id="sec-missing-fields">Missing Address or Data</h3>
<p>The store-address and store-data µops wait on different registers, so an SQ entry can sit with only one half filled in for many cycles. The two halves play different roles in a load's search. The address decides <em>whether</em> the store matters to the load, and the data is only what the load takes once it does. So which half is missing decides what the load can do:</p>
<div class="tbl"><svg viewBox="0 0 680 296" role="img" aria-label="The four states of an older store entry the load's search reaches, by whether its address valid and data valid bits are set. Address valid and data valid: the checks run and the data is there, so a full hit forwards at about L1 latency and a partial hit is a store-forwarding stall. Address valid, data not valid: the match is known but the value is not, so the load blocks on that SQ index and the store-data write wakes it to reissue. Address not valid, data valid: the data can't be matched to anything, so the entry counts as unknown and the memory dependence predictor decides, and waiting means waiting for the address. Neither valid: also unknown, the predictor decides, and if the load waits and the address then matches it may still block on the data. Only the address decides whether a store matters to the load." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<text x="20" y="20" style="fill:var(--muted);font-size:12px;font-weight:600">What a load can do with an older store's entry, by which halves are filled in</text>
<text x="285" y="54" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">data valid = 1</text>
<text x="545" y="54" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">data valid = 0</text>
<text x="20" y="106" style="fill:var(--ink);font-size:11px;font-weight:600">address</text><text x="20" y="121" style="fill:var(--ink);font-size:11px;font-weight:600">valid = 1</text>
<text x="20" y="212" style="fill:var(--ink);font-size:11px;font-weight:600">address</text><text x="20" y="227" style="fill:var(--ink);font-size:11px;font-weight:600">valid = 0</text>
<rect x="160" y="64" width="250" height="96" rx="3" style="fill:var(--surface);stroke:var(--accent-green);stroke-width:1.5"/>
<text x="172" y="86" style="fill:var(--accent-green);font-size:12px;font-weight:600">Full search</text>
<text x="172" y="108" style="fill:var(--ink);font-size:10.5px">The checks run and the data is there.</text>
<text x="172" y="124" style="fill:var(--ink);font-size:10.5px">Full hit: forward at about L1 latency.</text>
<text x="172" y="140" style="fill:var(--ink);font-size:10.5px">Partial hit: store-forwarding stall.</text>
<rect x="420" y="64" width="250" height="96" rx="3" style="fill:var(--surface);stroke:var(--pad);stroke-width:1.5"/>
<text x="432" y="86" style="fill:var(--pad);font-size:12px;font-weight:600">Block on the data</text>
<text x="432" y="108" style="fill:var(--ink);font-size:10.5px">The match is known, the value isn't.</text>
<text x="432" y="124" style="fill:var(--ink);font-size:10.5px">The load waits on this SQ index.</text>
<text x="432" y="140" style="fill:var(--ink);font-size:10.5px">The data write wakes it to reissue.</text>
<rect x="160" y="170" width="250" height="96" rx="3" style="fill:var(--surface);stroke:var(--trace);stroke-width:1.5"/>
<text x="172" y="192" style="fill:var(--trace);font-size:12px;font-weight:600">Unknown: the MDP decides</text>
<text x="172" y="214" style="fill:var(--ink);font-size:10.5px">The data can't be matched to anything.</text>
<text x="172" y="230" style="fill:var(--ink);font-size:10.5px">It counts as an entry with neither half.</text>
<text x="172" y="246" style="fill:var(--ink);font-size:10.5px">Waiting means waiting for the address.</text>
<rect x="420" y="170" width="250" height="96" rx="3" style="fill:var(--surface);stroke:var(--trace);stroke-width:1.5"/>
<text x="432" y="192" style="fill:var(--trace);font-size:12px;font-weight:600">Unknown: the MDP decides</text>
<text x="432" y="214" style="fill:var(--ink);font-size:10.5px">Nothing to compare yet.</text>
<text x="432" y="230" style="fill:var(--ink);font-size:10.5px">If the load waits and the address then</text>
<text x="432" y="246" style="fill:var(--ink);font-size:10.5px">matches, it may still block on the data.</text>
<text x="20" y="288" style="fill:var(--muted);font-size:11px">Only the address decides whether a store matters to the load. The data matters only once it does.</text>
</svg></div>
<p><strong>Address but no data.</strong> The address checks run normally, so the core knows this store is the youngest one that writes the load's bytes. It also knows the value isn't there yet. Every other source would be wrong:</p>
<ul>
<li>L1 holds the value from before the store, which is exactly the stale value the search exists to catch.</li>
<li>An older store that does have its data can't stand in either. The youngest match wins even when it can't deliver, because its bytes overwrite the older store's in program order.</li>
</ul>
<p>So the load is blocked on that store. It records the matching SQ index, gives up its pipeline slot, and waits. When the store-data µop executes and writes the entry's data, it wakes the loads blocked on that index, and each one reissues, searches again, and forwards. The wait ends when the data is produced, not when the store commits, so it is much shorter than a partial-match stall. Intel's Core 2 counted these blocks apart from unknown-address blocks, as the <code>LOAD_BLOCK.STD</code> and <code>LOAD_BLOCK.STA</code> events. The scheduler has usually woken the load's dependents already, expecting an L1 hit, so a blocked load also cancels them, and they replay when it reissues (see <a href="#/scheduler/speculative-wakeup">Speculative Wakeup</a>). Memory renaming removes even that round trip for pairs the predictor knows: the load is linked straight to the register the store-data µop reads, as if it were a register dependence, so it completes as soon as the data exists (Moshovos and Sohi, MICRO 1997).</p>
<p><strong>Data but no address.</strong> This happens when the data is ready early but the address depends on something slow. In <code>a[idx[i]] = 0</code>, the zero is ready at once, but the address waits for the load of <code>idx[i]</code>. The data doesn't help the search at all. Without an address the entry can't be compared, so to a load it looks exactly like an entry with neither half: something that might overlap. The memory dependence predictor decides whether the load waits or goes ahead, as for SQ 3 in the search figure. If the load waits, it waits for the store-address µop, not the data. Once the address is in, the load's search either rules the store out or finds a match, and with the data already there it forwards at once.</p>
<p>That asymmetry sets what the predictor waits for on a core with split stores. Waiting for the store's address is enough to make the search exact. If the data is still missing at that point, the block-and-wake path above handles it, with no prediction needed.</p>
<p><strong>An unknown store behind a known match.</strong> The two cases combine in the one that the LQ probe's source check exists for. Suppose the youngest store with a known address fully covers the load, but a younger store, still older than the load, has no address yet. If the predictor lets the load go, it forwards from the known store. That is right only if the unknown store turns out not to overlap. If it does overlap, the load took bytes the unknown store overwrites. When that store's address resolves, its probe finds the load executed, overlapping, and forwarded from a store older than itself, so check ⑥ marks the value stale and the core flushes (see <a href="#/lsq-lq/loads">The Load Queue and Ordering Violations</a>). LQ 2 in the store-probe figure there is the opposite case: it forwarded from a store younger than the probing one, so its bytes were right.</p>`,
  practice: {
    guided: [
      {
        q: `<p>Store queue, oldest first: St A (0x100, 8 bytes, data ready), St B (address unknown), St C (0x108, 4 bytes, data ready). A younger 8-byte load L reads 0x100. Walk through what happens.</p>`,
        a: `<ol><li>L searches older stores, youngest first. St C covers 0x108–0x10B: no overlap with 0x100–0x107.</li><li>St B's address is unknown. L must wait, or speculate past it based on the memory dependence predictor.</li><li>If it speculates, St A fully covers L, so A's data is forwarded.</li><li>If B later resolves to 0x104, it overlaps L: ordering violation, flush L and everything younger, re-execute.</li><li>If B resolves to 0x200, the speculation was correct.</li></ol>`
      },
      {
        q: `<p>A load's SQ search finds that the youngest matching store covers all its bytes but doesn't have its data yet. When does the load deliver its value if the core blocks it on the data, and how much sooner is that than blocking it until the store writes L1?</p><p>Given:</p><ul><li>The load issues in cycle 0</li><li>Load-to-use latency: 5 cycles, the same for an L1 hit and a forward</li><li>The youngest matching store fully covers the load's bytes and has data valid = 0</li><li>The store's data comes from an integer divide. The store-data µop writes the data into the SQ entry at the end of cycle 23</li><li>A blocked load is woken in the cycle after the event it waits for, and reissues in that cycle with the same 5-cycle latency</li><li>The alternative policy treats the load like a partial match: it stays blocked until the store writes L1, which happens at the end of cycle 61, and is then woken and reissued the same way</li></ul>`,
        a: `<ol class="steps"><li><strong>Why the load must wait for this store.</strong> L1 still holds the value from before the store, and any older store's bytes are overwritten by this one, so the store's own data is the only correct source. The load records the store's SQ index and gives up its slot.</li><li><strong>Reissue.</strong> The data write at the end of cycle 23 wakes the load, and it reissues the next cycle.<div class="math chain"><span>\\(\\displaystyle t_{\\text{reissue}} = \\text{cycle } 23 + 1\\ \\text{cycle} \\)</span><span>\\(\\displaystyle = \\text{cycle } 24 \\)</span></div></li><li><strong>Value delivered.</strong> The reissued load searches again, finds the data, and forwards with the normal latency.<div class="math chain"><span>\\(\\displaystyle t_{\\text{block on data}} = \\text{cycle } 24 + 5\\ \\text{cycles} \\)</span><span>\\(\\displaystyle = \\textbf{cycle } \\mathbf{29} \\)</span></div>Without the block it would have delivered in cycle 5, so the divide costs this load 24 cycles.</li><li><strong>The alternative.</strong> Waiting for the L1 write means waiting for the store to retire, behind everything older than it, and then drain.<div class="math chain"><span>\\(\\displaystyle t_{\\text{block to L1}} = \\text{cycle } 61 + 1\\ \\text{cycle} + 5\\ \\text{cycles} \\)</span><span>\\(\\displaystyle = \\text{cycle } 67 \\)</span></div></li><li><strong>Difference.</strong> Blocking on the data delivers sooner by<div class="math chain"><span>\\(\\displaystyle \\Delta t = \\text{cycle } 67 - \\text{cycle } 29 \\)</span><span>\\(\\displaystyle = \\mathbf{38}\\ \\textbf{cycles} \\)</span></div>That is why the SQ wakes a load on the data write, rather than reusing the partial-match stall, which has to wait for L1 because the bytes it needs come from two places.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A 4-byte store to 0x100 is followed by an 8-byte load from 0x100. Can the store forward? On this core, a load that can't forward waits about 15 cycles for the store to commit and write the cache.</p>`,
        a: `<p>Not fully: the store covers only half the load. Most designs block the load until the store commits and writes the cache, then read the merged line. This "store-forwarding stall" costs about 15 cycles here. More complex designs merge store bytes with cache data. Compilers try to avoid narrow-store, wide-load patterns.</p>`
      },
      {
        q: `<p>On a core that splits each store into a store-address µop and a store-data µop, the memory dependence predictor says load L depends on store S. Should L wait for S's address µop, its data µop, or both? Say what goes wrong with each choice.</p><p class="given">Assume the SQ blocks a load whose youngest match has no data yet and wakes it when the data is written, as on this page.</p>`,
        a: `<p>L must wait for S's address µop, because that is what makes its search exact. Waiting for the data as well is optional: it saves a wasted search when the data is late, but it over-waits on false dependences. Since the SQ already handles a missing data half without prediction, waiting on the address alone is usually the better choice.</p><ul><li><strong>Address only.</strong> Once S's address is in, L's search either rules S out or finds a match. With S's data there, L forwards. Without it, L blocks on S's SQ index and wakes on the data write. The cost is one wasted issue and search when the data comes late, but the result is always correct and L never waits longer than it has to.</li><li><strong>Data only.</strong> This can wait for nothing. In code like <code>a[idx[i]] = x</code>, S's data is often ready long before its address. L issues, finds S with data but no address, and is back where it started: it must speculate past S or wait again. If it speculates and S overlaps, the violation the predictor was trained to prevent happens anyway.</li><li><strong>Both.</strong> This is always safe and saves the wasted search when the data is late. But L can't overlap its own address generation and TLB lookup with S's data, and it over-waits whenever the address alone would have cleared L. Store-set predictors make false dependences, from aliasing in the tables and from stores that overlap only sometimes. When S's address turns out not to overlap, L has also waited for a data value it never needed. If that data comes from a cache miss or a divide, the wait is long.</li></ul><p>Waiting on the address and letting the SQ handle late data gets the safety of waiting for both, without the over-wait. Intel's split STA and STD design does it that way: its disambiguation predictor decides whether a load may pass stores with unknown addresses, and a load that matches a store without data is blocked until the data arrives.</p>`
      }
    ]
  }
},

{
  id: "lsq-lq",
  region: "mord",
  title: "The Load Queue and Ordering Violations",
  sections: [
    { id: "loads", label: "Loads" },
    { id: "catching-violations", label: "Catching Violations" },
    { id: "physical-addresses", label: "Virtual and Physical Addresses" }
  ],
  body: `
<p>A load can read its value before older stores have their addresses, and before other cores' older writes reach it. The LQ is where the core finds out it went wrong. Stores probe it when their addresses resolve, coherence invalidations and L1 evictions search it, and a match flushes the load and everything younger. The examples use the same core as <a href="#/lsq">The Store Queue</a>: a Golden Cove-sized core with a 114-entry SQ, a 192-entry LQ, 46-bit physical addresses, and 8-byte chunks.</p>
<h3 id="sec-loads">Loads</h3>
<p>A load gets an LQ entry at dispatch and records the SQ tail at that moment, the age mark the SQ search uses. When it executes, it writes its address into the entry, searches the SQ (see <a href="#/lsq/stores">The Store Queue</a>), and reads L1 in parallel. The value goes to the load's destination physical register, not the LQ. The entry stays until the load retires, because until then an older store or another core can still show that the load read the wrong value.</p>
<p>One entry, zoomed in:</p>
<div class="tbl"><svg viewBox="0 0 680 386" role="img" aria-label="Fields of one load queue entry, LQ entry 5, for a 4-byte load from physical address 0x3A07F2C4, after it executed. The address group, written when the load executes, holds an address valid bit (1), the page offset, bits 11 to 0 (0x2C4), the physical page number, bits 45 to 12 (0x3A07F), and an 8-bit byte mask with bytes 4 to 7 set. The value-source group, read by store probes, holds an executed bit (1), a forwarded bit (0, the value came from L1), and a forwarded-from SQ index, 8 bits including a wrap bit, unused here. The bookkeeping group holds a valid bit (1), the SQ position at allocation, 8 bits including a wrap bit (14), the ROB index, 9 bits (318), and a snooped bit, set if another core invalidated the line since the load executed (0). The loaded value itself goes to the load's physical register, not the LQ." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<text x="20" y="20" style="fill:var(--muted);font-size:12px;font-weight:600">One LQ entry (LQ 5): mov eax, [rcx], a 4-byte load from physical address 0x3A07F2C4, after it executed</text>
<text x="20" y="48" style="fill:var(--trace);font-size:12px;font-weight:600">Address (written when the load executes)</text>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"><rect x="20" y="56" width="90" height="62" rx="3"/><rect x="118" y="56" width="130" height="62" rx="3"/><rect x="256" y="56" width="150" height="62" rx="3"/><rect x="414" y="56" width="246" height="62" rx="3"/></g>
<g style="fill:var(--ink);font-size:11px;font-weight:600" text-anchor="middle"><text x="65" y="74">Address valid</text><text x="183" y="74">Page offset</text><text x="331" y="74">Physical page</text><text x="537" y="74">Byte mask</text></g>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle"><text x="65" y="89">1 bit</text><text x="183" y="89">bits 11–0 (12 bits)</text><text x="331" y="89">bits 45–12 (34 bits)</text><text x="537" y="89">8 bits, bytes 0–7 of the 8-byte chunk</text></g>
<g style="fill:var(--trace);font-size:12px;font-family:var(--mono)" text-anchor="middle"><text x="65" y="108">1</text><text x="183" y="108">0x2C4</text><text x="331" y="108">0x3A07F</text></g>
<rect x="465" y="96" width="16" height="14" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="483" y="96" width="16" height="14" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="501" y="96" width="16" height="14" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="519" y="96" width="16" height="14" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="537" y="96" width="16" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="555" y="96" width="16" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="573" y="96" width="16" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="591" y="96" width="16" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/>
<text x="20" y="146" style="fill:var(--pad);font-size:12px;font-weight:600">Where the value came from (read by store probes)</text>
<g style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5"><rect x="20" y="154" width="90" height="62" rx="3"/><rect x="118" y="154" width="130" height="62" rx="3"/><rect x="256" y="154" width="404" height="62" rx="3"/></g>
<g style="fill:var(--ink);font-size:11px;font-weight:600" text-anchor="middle"><text x="65" y="172">Executed</text><text x="183" y="172">Forwarded</text><text x="458" y="172">Forwarded-from SQ index</text></g>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle"><text x="65" y="187">1 bit</text><text x="183" y="187">1 bit</text><text x="458" y="187">8 bits (7-bit index + wrap bit), meaningful only if forwarded</text></g>
<g style="fill:var(--pad);font-size:12px;font-family:var(--mono)" text-anchor="middle"><text x="65" y="206">1</text><text x="183" y="206">0 (read L1)</text><text x="458" y="206">–</text></g>
<text x="20" y="244" style="fill:var(--redirect);font-size:12px;font-weight:600">Bookkeeping (age, ordering, and recovery)</text>
<g style="fill:var(--surface);stroke:var(--redirect);stroke-width:1.5"><rect x="20" y="252" width="90" height="62" rx="3"/><rect x="118" y="252" width="190" height="62" rx="3"/><rect x="316" y="252" width="150" height="62" rx="3"/><rect x="474" y="252" width="186" height="62" rx="3"/></g>
<g style="fill:var(--ink);font-size:11px;font-weight:600" text-anchor="middle"><text x="65" y="270">Valid</text><text x="213" y="270">SQ position at allocation</text><text x="391" y="270">ROB index</text><text x="567" y="270">Snooped</text></g>
<g style="fill:var(--muted);font-size:10px" text-anchor="middle"><text x="65" y="285">1 bit</text><text x="213" y="285">8 bits (7-bit index + wrap bit)</text><text x="391" y="285">9 bits (512 entries)</text><text x="567" y="285">1 bit: invalidated after it ran</text></g>
<g style="fill:var(--redirect);font-size:12px;font-family:var(--mono)" text-anchor="middle"><text x="65" y="304">1</text><text x="213" y="304">14</text><text x="391" y="304">318</text><text x="567" y="304">0</text></g>
<g style="fill:var(--muted);font-size:11px"><text x="20" y="342">Address bits 2–0 are 4 and the size is 4 bytes, so the mask sets bytes 4–7.</text><text x="20" y="358">SQ position: only SQ entries before 14 are older than this load. The loaded value went to its physical register.</text><text x="20" y="374">Executed with no forward: the value came from L1, so an older store that later writes bytes 4–7 makes it stale.</text></g>
</svg></div>
<p>The address fields match the SQ's, so the two queues can compare against each other directly. The rest records what store probes and coherence snoops need to know:</p>
<ul>
<li><strong>Executed.</strong> The load has read its value. It is separate from address valid because a load can have its address and still be waiting, for example blocked behind a partial match in the SQ.</li>
<li><strong>Forwarded and forwarded-from SQ index.</strong> Which store, if any, supplied the value. A probing store uses it to tell a load that got the right bytes from one that got stale ones.</li>
<li><strong>SQ position at allocation.</strong> The age mark: SQ entries before it are older than the load.</li>
<li><strong>Snooped.</strong> Another core invalidated the line after the load read it (see <a href="#/lsq-lq/catching-violations">Catching Violations</a>).</li>
</ul>

<h4>A Store Probes the Load Queue</h4>
<p>A load can execute before an older store whose address is still unknown, either because the memory dependence predictor let it go or because the core always speculates. When that store's address resolves, it probes the LQ for younger loads that already read bytes it writes. Those loads got a stale value, from L1 or from a store older than this one, and must be squashed. The probe is a CAM search like the SQ search, run in the other direction, and each entry runs six checks:</p>
<ol>
<li><strong>Age: is the load younger than the store?</strong> The store's SQ entry recorded the LQ tail at allocation. Only entries from that position to the LQ tail are younger. Older loads are masked out, and so are empty entries. This is the mirror image of the SQ search, where only older entries count.</li>
<li><strong>Executed: has the load read a value yet?</strong> A younger load that hasn't executed is fine. When it does, its own SQ search will find this store.</li>
<li><strong>Page offset: same chunk within the page?</strong> Bits 11–3, as in the SQ search.</li>
<li><strong>Physical page: really the same address?</strong> Bits 45–12. The store has its physical address by now, and the probe isn't on a load's latency path, so both halves can be compared in the same cycle. Designs that compare fewer bits to save area accept occasional false matches, which cost a needless flush but never a wrong result.</li>
<li><strong>Bytes: do they share any byte?</strong> The load's byte mask is ANDed with the store's. Unlike the SQ search, full and partial don't need to be told apart: one shared byte means the load read at least one stale byte.</li>
<li><strong>Source: was the value stale?</strong> If the load forwarded from a store younger than the probing store, it got the right bytes, because that store sits between the two in program order and its bytes are the ones the load should see. The check compares the load's forwarded-from SQ index with the probing store's SQ index. A load that read L1, or forwarded from a store older than the probing one, fails it.</li>
</ol>
<p>Several loads can pass all six checks. The one that matters is the oldest, the one nearest the store: the core flushes from it, and every younger load goes with it anyway. A priority encoder, starting at the store's recorded LQ position and moving toward the tail, finds it (see <a href="#/lsq-search/priority-encoders">Priority Encoders</a>).</p>
<div class="tbl"><svg viewBox="0 0 680 472" role="img" aria-label="An 8-byte store in SQ entry 9 to physical address 0x3A07F2C0, page 0x3A07F, offset 0x2C0, bytes 0 to 7, resolves its address and probes an 8-entry load queue. The store recorded LQ tail 2 at allocation, so only LQ 2 and later can be younger. Six checks run on each entry: 1, younger than the store. 2, executed. 3, page-offset bits 11 to 3 match. 4, physical page bits 45 to 12 match. 5, any byte overlap. 6, stale source, meaning the value came from L1 or from a store older than the probing store. LQ 0, same address, and LQ 1, page 0x0D41A, are older and masked out. LQ 2: page 0x3A07F, offset 0x2C0, 2 bytes, bytes 0 to 1, forwarded from SQ 11. It passes checks 1 to 5 but SQ 11 is younger than the store, so its value is correct: safe. LQ 3: same chunk, 4 bytes at offset 0x2C4, not executed yet, so skipped. LQ 4: page 0x1B3E5, offset 0x2C0, 8 bytes, read L1. Offset matches, page does not. LQ 5: page 0x3A07F, offset 0x2C4, 4 bytes, bytes 4 to 7, read L1. Passes every check: violation, flush from here. LQ 6: page 0x3A07F, offset 0x2C8, a different chunk, but younger than LQ 5 so it is squashed too. LQ 7 is empty, the tail. The core flushes LQ 5 and LQ 6 and refetches from LQ 5's load." style="width:100%;min-width:600px;max-width:680px;display:block;font-family:var(--sans)">
<defs><marker id="arrLQ" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker></defs>
<text x="20" y="20" style="fill:var(--muted);font-size:12px;font-weight:600">An 8-byte store (SQ 9), mov [rdi], rdx, to physical address 0x3A07F2C0, resolves its address and probes the LQ</text>
<rect x="58" y="34" width="252" height="28" rx="3" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5"/>
<g style="fill:var(--pad);font-size:11px;font-family:var(--mono)" text-anchor="middle"><text x="81" y="52" style="font-family:var(--sans);font-weight:600">SQ 9</text><text x="132" y="52">0x3A07F</text><text x="181" y="52">2C0</text><text x="213" y="52">8 B</text></g>
<rect x="228" y="41" width="8" height="14" style="fill:var(--pad);stroke:var(--muted);stroke-width:0.75"/><rect x="238" y="41" width="8" height="14" style="fill:var(--pad);stroke:var(--muted);stroke-width:0.75"/><rect x="248" y="41" width="8" height="14" style="fill:var(--pad);stroke:var(--muted);stroke-width:0.75"/><rect x="258" y="41" width="8" height="14" style="fill:var(--pad);stroke:var(--muted);stroke-width:0.75"/><rect x="268" y="41" width="8" height="14" style="fill:var(--pad);stroke:var(--muted);stroke-width:0.75"/><rect x="278" y="41" width="8" height="14" style="fill:var(--pad);stroke:var(--muted);stroke-width:0.75"/><rect x="288" y="41" width="8" height="14" style="fill:var(--pad);stroke:var(--muted);stroke-width:0.75"/><rect x="298" y="41" width="8" height="14" style="fill:var(--pad);stroke:var(--muted);stroke-width:0.75"/>
<g style="fill:var(--muted);font-size:10.5px"><text x="320" y="46">recorded LQ tail at allocation: 2</text><text x="320" y="60">only LQ 2 and later can be younger</text></g>
<g style="fill:var(--ink);font-size:11px;font-weight:600" text-anchor="middle"><text x="81" y="92">entry</text><text x="132" y="92">page</text><text x="181" y="92">offset</text><text x="213" y="92">size</text><text x="268" y="92">bytes 0–7</text><text x="331" y="92">source</text><text x="369" y="92">①</text><text x="403" y="92">②</text><text x="437" y="92">③</text><text x="471" y="92">④</text><text x="505" y="92">⑤</text><text x="539" y="92">⑥</text></g>
<text x="566" y="92" style="fill:var(--ink);font-size:11px;font-weight:600">outcome</text>
<g style="fill:var(--muted);font-size:9.5px" text-anchor="middle"><text x="132" y="105">bits 45–12</text><text x="181" y="105">11–0</text><text x="331" y="105">of value</text><text x="369" y="105" style="font-size:9px">younger</text><text x="369" y="117" style="font-size:9px"></text><text x="403" y="105" style="font-size:9px">exec-</text><text x="403" y="117" style="font-size:9px">uted</text><text x="437" y="105" style="font-size:9px">11–3</text><text x="437" y="117" style="font-size:9px">offset</text><text x="471" y="105" style="font-size:9px">45–12</text><text x="471" y="117" style="font-size:9px">page</text><text x="505" y="105" style="font-size:9px">byte</text><text x="505" y="117" style="font-size:9px">overlap</text><text x="539" y="105" style="font-size:9px">stale</text><text x="539" y="117" style="font-size:9px">source</text></g>
<text x="566" y="105" style="fill:var(--muted);font-size:9.5px">oldest violator wins</text>
<rect x="58" y="128" width="618" height="26" rx="2" style="fill:var(--rule);stroke:var(--rule);stroke-width:1"/>
<text x="81" y="145" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:600">LQ 0</text>
<g style="fill:var(--muted);font-size:11px;font-family:var(--mono)" text-anchor="middle"><text x="132" y="145">0x3A07F</text><text x="181" y="145">2C0</text><text x="213" y="145">8 B</text><text x="331" y="145">L1</text></g>
<rect x="228" y="134" width="8" height="14" style="fill:var(--muted);stroke:var(--muted);stroke-width:0.75"/><rect x="238" y="134" width="8" height="14" style="fill:var(--muted);stroke:var(--muted);stroke-width:0.75"/><rect x="248" y="134" width="8" height="14" style="fill:var(--muted);stroke:var(--muted);stroke-width:0.75"/><rect x="258" y="134" width="8" height="14" style="fill:var(--muted);stroke:var(--muted);stroke-width:0.75"/><rect x="268" y="134" width="8" height="14" style="fill:var(--muted);stroke:var(--muted);stroke-width:0.75"/><rect x="278" y="134" width="8" height="14" style="fill:var(--muted);stroke:var(--muted);stroke-width:0.75"/><rect x="288" y="134" width="8" height="14" style="fill:var(--muted);stroke:var(--muted);stroke-width:0.75"/><rect x="298" y="134" width="8" height="14" style="fill:var(--muted);stroke:var(--muted);stroke-width:0.75"/>
<text x="369" y="145" text-anchor="middle" style="fill:var(--accent-red);font-weight:600;font-size:12px">✗</text>
<text x="403" y="145" text-anchor="middle" style="fill:var(--muted);font-size:12px">–</text>
<text x="437" y="145" text-anchor="middle" style="fill:var(--muted);font-size:12px">–</text>
<text x="471" y="145" text-anchor="middle" style="fill:var(--muted);font-size:12px">–</text>
<text x="505" y="145" text-anchor="middle" style="fill:var(--muted);font-size:12px">–</text>
<text x="539" y="145" text-anchor="middle" style="fill:var(--muted);font-size:12px">–</text>
<text x="566" y="145" style="fill:var(--muted);font-size:10.5px">older: masked out</text>
<rect x="58" y="156" width="618" height="26" rx="2" style="fill:var(--rule);stroke:var(--rule);stroke-width:1"/>
<text x="81" y="173" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:600">LQ 1</text>
<g style="fill:var(--muted);font-size:11px;font-family:var(--mono)" text-anchor="middle"><text x="132" y="173">0x0D41A</text><text x="181" y="173">088</text><text x="213" y="173">4 B</text><text x="331" y="173">L1</text></g>
<rect x="228" y="162" width="8" height="14" style="fill:var(--muted);stroke:var(--muted);stroke-width:0.75"/><rect x="238" y="162" width="8" height="14" style="fill:var(--muted);stroke:var(--muted);stroke-width:0.75"/><rect x="248" y="162" width="8" height="14" style="fill:var(--muted);stroke:var(--muted);stroke-width:0.75"/><rect x="258" y="162" width="8" height="14" style="fill:var(--muted);stroke:var(--muted);stroke-width:0.75"/><rect x="268" y="162" width="8" height="14" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="278" y="162" width="8" height="14" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="288" y="162" width="8" height="14" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="298" y="162" width="8" height="14" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/>
<text x="369" y="173" text-anchor="middle" style="fill:var(--accent-red);font-weight:600;font-size:12px">✗</text>
<text x="403" y="173" text-anchor="middle" style="fill:var(--muted);font-size:12px">–</text>
<text x="437" y="173" text-anchor="middle" style="fill:var(--muted);font-size:12px">–</text>
<text x="471" y="173" text-anchor="middle" style="fill:var(--muted);font-size:12px">–</text>
<text x="505" y="173" text-anchor="middle" style="fill:var(--muted);font-size:12px">–</text>
<text x="539" y="173" text-anchor="middle" style="fill:var(--muted);font-size:12px">–</text>
<text x="566" y="173" style="fill:var(--muted);font-size:10.5px">older: masked out</text>
<rect x="58" y="184" width="618" height="26" rx="2" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/>
<text x="81" y="201" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">LQ 2</text>
<g style="fill:var(--ink);font-size:11px;font-family:var(--mono)" text-anchor="middle"><text x="132" y="201">0x3A07F</text><text x="181" y="201">2C0</text><text x="213" y="201">2 B</text><text x="331" y="201">SQ 11</text></g>
<rect x="228" y="190" width="8" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="238" y="190" width="8" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="248" y="190" width="8" height="14" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="258" y="190" width="8" height="14" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="268" y="190" width="8" height="14" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="278" y="190" width="8" height="14" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="288" y="190" width="8" height="14" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="298" y="190" width="8" height="14" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/>
<text x="369" y="201" text-anchor="middle" style="fill:var(--ink);font-weight:600;font-size:12px">✓</text>
<text x="403" y="201" text-anchor="middle" style="fill:var(--ink);font-weight:600;font-size:12px">✓</text>
<text x="437" y="201" text-anchor="middle" style="fill:var(--ink);font-weight:600;font-size:12px">✓</text>
<text x="471" y="201" text-anchor="middle" style="fill:var(--ink);font-weight:600;font-size:12px">✓</text>
<text x="505" y="201" text-anchor="middle" style="fill:var(--ink);font-weight:600;font-size:12px">✓</text>
<text x="539" y="201" text-anchor="middle" style="fill:var(--accent-red);font-weight:600;font-size:12px">✗</text>
<text x="566" y="201" style="fill:var(--accent-green);font-size:10.5px">safe: SQ 11 younger</text>
<rect x="58" y="212" width="618" height="26" rx="2" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/>
<text x="81" y="229" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">LQ 3</text>
<g style="fill:var(--ink);font-size:11px;font-family:var(--mono)" text-anchor="middle"><text x="132" y="229">0x3A07F</text><text x="181" y="229">2C4</text><text x="213" y="229">4 B</text><text x="331" y="229">–</text></g>
<rect x="228" y="218" width="8" height="14" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="238" y="218" width="8" height="14" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="248" y="218" width="8" height="14" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="258" y="218" width="8" height="14" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="268" y="218" width="8" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="278" y="218" width="8" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="288" y="218" width="8" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="298" y="218" width="8" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/>
<text x="369" y="229" text-anchor="middle" style="fill:var(--ink);font-weight:600;font-size:12px">✓</text>
<text x="403" y="229" text-anchor="middle" style="fill:var(--accent-red);font-weight:600;font-size:12px">✗</text>
<text x="437" y="229" text-anchor="middle" style="fill:var(--muted);font-size:12px">–</text>
<text x="471" y="229" text-anchor="middle" style="fill:var(--muted);font-size:12px">–</text>
<text x="505" y="229" text-anchor="middle" style="fill:var(--muted);font-size:12px">–</text>
<text x="539" y="229" text-anchor="middle" style="fill:var(--muted);font-size:12px">–</text>
<text x="566" y="229" style="fill:var(--ink);font-size:10.5px">not executed yet</text>
<rect x="58" y="240" width="618" height="26" rx="2" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/>
<text x="81" y="257" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">LQ 4</text>
<g style="fill:var(--ink);font-size:11px;font-family:var(--mono)" text-anchor="middle"><text x="132" y="257">0x1B3E5</text><text x="181" y="257">2C0</text><text x="213" y="257">8 B</text><text x="331" y="257">L1</text></g>
<rect x="228" y="246" width="8" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="238" y="246" width="8" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="248" y="246" width="8" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="258" y="246" width="8" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="268" y="246" width="8" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="278" y="246" width="8" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="288" y="246" width="8" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="298" y="246" width="8" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/>
<text x="369" y="257" text-anchor="middle" style="fill:var(--ink);font-weight:600;font-size:12px">✓</text>
<text x="403" y="257" text-anchor="middle" style="fill:var(--ink);font-weight:600;font-size:12px">✓</text>
<text x="437" y="257" text-anchor="middle" style="fill:var(--ink);font-weight:600;font-size:12px">✓</text>
<text x="471" y="257" text-anchor="middle" style="fill:var(--accent-red);font-weight:600;font-size:12px">✗</text>
<text x="505" y="257" text-anchor="middle" style="fill:var(--muted);font-size:12px">–</text>
<text x="539" y="257" text-anchor="middle" style="fill:var(--muted);font-size:12px">–</text>
<text x="566" y="257" style="fill:var(--ink);font-size:10.5px">4K alias</text>
<rect x="58" y="268" width="618" height="26" rx="2" style="fill:var(--trace-soft);stroke:var(--accent-red);stroke-width:1.5"/>
<text x="81" y="285" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">LQ 5</text>
<g style="fill:var(--ink);font-size:11px;font-family:var(--mono)" text-anchor="middle"><text x="132" y="285">0x3A07F</text><text x="181" y="285">2C4</text><text x="213" y="285">4 B</text><text x="331" y="285">L1</text></g>
<rect x="228" y="274" width="8" height="14" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="238" y="274" width="8" height="14" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="248" y="274" width="8" height="14" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="258" y="274" width="8" height="14" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><rect x="268" y="274" width="8" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="278" y="274" width="8" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="288" y="274" width="8" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="298" y="274" width="8" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/>
<text x="369" y="285" text-anchor="middle" style="fill:var(--ink);font-weight:600;font-size:12px">✓</text>
<text x="403" y="285" text-anchor="middle" style="fill:var(--ink);font-weight:600;font-size:12px">✓</text>
<text x="437" y="285" text-anchor="middle" style="fill:var(--ink);font-weight:600;font-size:12px">✓</text>
<text x="471" y="285" text-anchor="middle" style="fill:var(--ink);font-weight:600;font-size:12px">✓</text>
<text x="505" y="285" text-anchor="middle" style="fill:var(--ink);font-weight:600;font-size:12px">✓</text>
<text x="539" y="285" text-anchor="middle" style="fill:var(--ink);font-weight:600;font-size:12px">✓</text>
<text x="566" y="285" style="fill:var(--accent-red);font-size:10.5px;font-weight:600">violation: flush</text>
<rect x="58" y="296" width="618" height="26" rx="2" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/>
<text x="81" y="313" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">LQ 6</text>
<g style="fill:var(--ink);font-size:11px;font-family:var(--mono)" text-anchor="middle"><text x="132" y="313">0x3A07F</text><text x="181" y="313">2C8</text><text x="213" y="313">8 B</text><text x="331" y="313">L1</text></g>
<rect x="228" y="302" width="8" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="238" y="302" width="8" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="248" y="302" width="8" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="258" y="302" width="8" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="268" y="302" width="8" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="278" y="302" width="8" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="288" y="302" width="8" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><rect x="298" y="302" width="8" height="14" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/>
<text x="369" y="313" text-anchor="middle" style="fill:var(--ink);font-weight:600;font-size:12px">✓</text>
<text x="403" y="313" text-anchor="middle" style="fill:var(--ink);font-weight:600;font-size:12px">✓</text>
<text x="437" y="313" text-anchor="middle" style="fill:var(--accent-red);font-weight:600;font-size:12px">✗</text>
<text x="471" y="313" text-anchor="middle" style="fill:var(--muted);font-size:12px">–</text>
<text x="505" y="313" text-anchor="middle" style="fill:var(--muted);font-size:12px">–</text>
<text x="539" y="313" text-anchor="middle" style="fill:var(--muted);font-size:12px">–</text>
<text x="566" y="313" style="fill:var(--ink);font-size:10.5px">other chunk</text>
<rect x="58" y="324" width="618" height="26" rx="2" style="fill:var(--rule);stroke:var(--rule);stroke-width:1"/>
<text x="81" y="341" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-weight:600">LQ 7</text>
<text x="369" y="341" text-anchor="middle" style="fill:var(--accent-red);font-weight:600;font-size:12px">✗</text>
<text x="566" y="341" style="fill:var(--muted);font-size:10.5px">empty: masked out</text>
<g style="fill:var(--muted);font-size:10px"><text x="20" y="145">head</text><text x="20" y="341">tail</text></g>
<g style="stroke:var(--muted);stroke-width:1.2;fill:none"><path d="M44,141 H56" marker-end="url(#arrLQ)"/><path d="M40,337 H56" marker-end="url(#arrLQ)"/></g>
<path d="M20,183 H676" style="stroke:var(--pad);stroke-width:1.5;stroke-dasharray:5 3;fill:none"/>
<text x="20" y="179" style="fill:var(--pad);font-size:10px;font-weight:600">mark</text>
<path d="M50,270 h-6 V320 h6" style="fill:none;stroke:var(--accent-red);stroke-width:1.5"/>
<g style="fill:var(--accent-red);font-size:9.5px;font-weight:600"><text x="18" y="292">flush</text></g>
<g style="fill:var(--muted);font-size:11px"><text x="20" y="372">① masks out LQ 0, LQ 1, and LQ 7: only entries from the store's mark to the tail are younger.</text><text x="20" y="388">② skips LQ 3: it hasn't read anything yet, and when it does, its SQ search will find SQ 9.</text><text x="20" y="404">③ and ④ compare the chunk address. The store already has its physical address, so both halves go together.</text><text x="20" y="420">⑤ asks for any shared byte, not full coverage: one stale byte is enough to be wrong.</text><text x="20" y="436">⑥ clears LQ 2: it forwarded from SQ 11, which sits between SQ 9 and the load and so supplied the right bytes.</text><text x="20" y="452">LQ 5 passes every check. The core flushes it and everything younger (LQ 6) and refetches from LQ 5's load.</text></g>
</svg></div>
<p>What happens next:</p>
<ul>
<li><strong>No match.</strong> No younger load that executed shares a byte with the store. Nothing happens. This is by far the common case, which is why letting loads run ahead of unknown store addresses pays off.</li>
<li><strong>Match, but safe.</strong> Overlapping loads that haven't executed, or that forwarded from a store younger than the probing one, need nothing.</li>
<li><strong>Violation.</strong> The oldest violating load and everything younger than it are squashed, and fetch restarts at that load. The cost is about a branch mispredict's. The core also trains the memory dependence predictor so that next time this load waits for this store (see <a href="#/mdp-store-sets">Store Sets</a>).</li>
</ul>
<p>The same probe as gates. The top half is the logic every LQ entry carries, and the bottom half runs once per probe across all entries. The six checks keep their numbers from the list above:</p>
<div class="tbl"><svg viewBox="0 0 680 688" role="img" aria-label="Gate-level logic of the LQ probe. Per LQ entry j, one copy for every entry and every store-address port: valid j AND younger j, from the age mask, AND executed j gives checks 1 and 2. Store offset bits 11 to 3 and the entry offset go through a 9-bit XNOR and an AND of all bits, the offset match, check 3. The page bits 45 to 12 go through a 34-bit XNOR and an AND of all bits, the page match, check 4. The byte masks are ANDed bit by bit and the 8 results ORed, any byte shared, check 5. Check 6, stale value: the load forwarded-from SQ index and the store SQ index go into a comparator with less-than and greater-than outputs. The XOR of their wrap bits selects, through a 2 to 1 mux, less-than when the wraps are equal and greater-than when they differ, giving forwarding store older than the probing store. That is ORed with NOT forwarded. Violate j is the AND of all six. Across all N entries, 192 on Golden Cove, once per probe: the violate vector goes into a priority encoder where the oldest younger load, the first past the store mark, wins. Its one-hot grant is ANDed with each entry ROB index and ORed over all entries to give the 9-bit ROB index of the oldest violating load, the flush point. The encoder valid output signals a violation, which flushes and trains the memory dependence predictor." style="width:100%;min-width:600px;max-width:680px;display:block;font-family:var(--sans)">
<text x="20" y="20" style="fill:var(--muted);font-size:12px;font-weight:600">The LQ probe as gates: each entry’s violation logic, then the pick across entries</text>
<text x="20" y="42" style="fill:var(--trace);font-size:12px;font-weight:600">Per LQ entry j: one copy for every entry and every store-address port</text>
<text x="148" y="70" text-anchor="end" style="fill:var(--ink);font-size:10.5px">valid j</text>
<text x="148" y="86" text-anchor="end" style="fill:var(--ink);font-size:10.5px">younger j (age mask)</text>
<text x="148" y="102" text-anchor="end" style="fill:var(--ink);font-size:10.5px">executed j</text>
<path d="M152,66 H190" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<path d="M152,82 H190" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<path d="M152,98 H190" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<path d="M190,56 H200 A24,26 0 0 1 200,108 H190 Z" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.3"/>
<path d="M224,82 H473" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<text x="232" y="77" style="fill:var(--muted);font-size:9.5px">① ② valid, younger, executed</text>
<text x="148" y="132" text-anchor="end" style="fill:var(--ink);font-size:10.5px">store offset[11:3]</text>
<text x="148" y="148" text-anchor="end" style="fill:var(--ink);font-size:10.5px">LQ j offset[11:3]</text>
<path d="M152,128 H196" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<path d="M152,144 H196" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<path d="M190,116 Q199,136 190,156" style="fill:none;stroke:var(--ink);stroke-width:1.3"/>
<path d="M195,116 Q215,116 227,136 Q215,156 195,156 Q204,136 195,116 Z" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.3"/>
<circle cx="230" cy="136" r="3" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.3"/>
<path d="M233,136 H262" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<path d="M244,141 L252,131" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<text x="250" y="129" text-anchor="middle" style="fill:var(--muted);font-size:9px">9</text>
<path d="M262,124 H274 A18,12 0 0 1 274,148 H262 Z" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.3"/>
<text x="274" y="121" text-anchor="middle" style="fill:var(--muted);font-size:9px">AND all</text>
<text x="300" y="131" style="fill:var(--muted);font-size:9.5px">③ offset match</text>
<path d="M292,136 H473" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<text x="148" y="182" text-anchor="end" style="fill:var(--ink);font-size:10.5px">store page[45:12]</text>
<text x="148" y="198" text-anchor="end" style="fill:var(--ink);font-size:10.5px">LQ j page[45:12]</text>
<path d="M152,178 H196" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<path d="M152,194 H196" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<path d="M190,166 Q199,186 190,206" style="fill:none;stroke:var(--ink);stroke-width:1.3"/>
<path d="M195,166 Q215,166 227,186 Q215,206 195,206 Q204,186 195,166 Z" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.3"/>
<circle cx="230" cy="186" r="3" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.3"/>
<path d="M233,186 H262" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<path d="M244,191 L252,181" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<text x="250" y="179" text-anchor="middle" style="fill:var(--muted);font-size:9px">34</text>
<path d="M262,174 H274 A18,12 0 0 1 274,198 H262 Z" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.3"/>
<text x="274" y="171" text-anchor="middle" style="fill:var(--muted);font-size:9px">AND all</text>
<text x="300" y="181" style="fill:var(--muted);font-size:9.5px">④ page match</text>
<path d="M292,186 H473" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<text x="148" y="232" text-anchor="end" style="fill:var(--ink);font-size:10.5px">store mask[7:0]</text>
<text x="148" y="248" text-anchor="end" style="fill:var(--ink);font-size:10.5px">LQ j mask[7:0]</text>
<path d="M152,228 H190" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<path d="M152,244 H190" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<path d="M190,218 H202 A18,18 0 0 1 202,254 H190 Z" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.3"/>
<path d="M220,236 H266" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<path d="M236,241 L244,231" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<text x="242" y="229" text-anchor="middle" style="fill:var(--muted);font-size:9px">8</text>
<path d="M262,224 Q282,224 294,236 Q282,248 262,248 Q271,236 262,224 Z" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.3"/>
<text x="278" y="221" text-anchor="middle" style="fill:var(--muted);font-size:9px">OR all</text>
<text x="302" y="231" style="fill:var(--muted);font-size:9.5px">⑤ any byte shared</text>
<path d="M294,236 H473" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<text x="148" y="288" text-anchor="end" style="fill:var(--ink);font-size:10.5px">LQ j forwarded</text>
<path d="M152,284 H330 V314 H352" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<circle cx="355" cy="314" r="3" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.3"/>
<path d="M358,314 H363" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<text x="148" y="326" text-anchor="end" style="fill:var(--ink);font-size:10.5px">a: LQ j fwd SQ index[6:0]</text>
<path d="M152,322 H190" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<text x="148" y="342" text-anchor="end" style="fill:var(--ink);font-size:10.5px">b: store SQ index[6:0]</text>
<path d="M152,338 H190" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<rect x="190" y="308" width="60" height="44" rx="3" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.3"/>
<text x="220" y="327" text-anchor="middle" style="fill:var(--ink);font-size:10.5px;font-weight:600">compare</text>
<text x="220" y="341" text-anchor="middle" style="fill:var(--muted);font-size:9.5px">a vs b</text>
<text x="254" y="322" style="fill:var(--muted);font-size:9px">a&lt;b</text>
<text x="254" y="338" style="fill:var(--muted);font-size:9px">a&gt;b</text>
<path d="M250,326 H290" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<path d="M250,342 H290" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<text x="148" y="380" text-anchor="end" style="fill:var(--ink);font-size:10.5px">LQ j fwd SQ wrap</text>
<path d="M152,376 H196" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<text x="148" y="396" text-anchor="end" style="fill:var(--ink);font-size:10.5px">store SQ wrap</text>
<path d="M152,392 H196" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<path d="M190,364 Q199,384 190,404" style="fill:none;stroke:var(--ink);stroke-width:1.3"/>
<path d="M195,364 Q215,364 227,384 Q215,404 195,404 Q204,384 195,364 Z" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.3"/>
<path d="M227,384 H302 V355" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<text x="232" y="379" style="fill:var(--muted);font-size:9.5px">wraps differ</text>
<path d="M290,310 L314,320 L314,350 L290,360 Z" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5"/>
<text x="294" y="329.5" style="fill:var(--muted);font-size:9px">0</text>
<text x="294" y="345.5" style="fill:var(--muted);font-size:9px">1</text>
<path d="M314,335 H362" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<text x="318" y="357" style="fill:var(--muted);font-size:9px">fwd store older</text>
<path d="M358,304 Q378,304 390,324 Q378,344 358,344 Q367,324 358,304 Z" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.3"/>
<path d="M390,324 H473" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<text x="398" y="319" style="fill:var(--muted);font-size:9.5px">⑥ stale value</text>
<path d="M470,60 H480 A24,138 0 0 1 480,336 H470 Z" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.3"/>
<path d="M504,198 H588" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<text x="592" y="196" style="fill:var(--ink);font-size:10.5px;font-weight:600">violate j</text>
<text x="592" y="209" style="fill:var(--muted);font-size:9.5px">all six pass</text>
<path d="M20,424 H676" style="fill:none;stroke:var(--rule);stroke-width:1"/>
<text x="20" y="446" style="fill:var(--pad);font-size:12px;font-weight:600">Across all N entries (N = 192 on Golden Cove), once per probe</text>
<text x="20" y="490" style="fill:var(--ink);font-size:10.5px">violate[N−1:0]</text>
<path d="M94,486 H110" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<path d="M98,491 L106,481" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<text x="104" y="479" text-anchor="middle" style="fill:var(--muted);font-size:9px">N</text>
<rect x="110" y="462" width="120" height="56" rx="3" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.3"/>
<text x="170" y="480" text-anchor="middle" style="fill:var(--ink);font-size:10.5px;font-weight:600">priority encoder</text>
<text x="170" y="494" text-anchor="middle" style="fill:var(--muted);font-size:9.5px">oldest younger wins</text>
<text x="170" y="508" text-anchor="middle" style="fill:var(--muted);font-size:9.5px">first past the mark</text>
<path d="M230,476 H303" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<path d="M240,481 L248,471" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<text x="246" y="469" text-anchor="middle" style="fill:var(--muted);font-size:9px">N</text>
<text x="274" y="470" text-anchor="middle" style="fill:var(--muted);font-size:9.5px">grant</text>
<path d="M282,530 V496 H303" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<text x="282" y="542" text-anchor="middle" style="fill:var(--ink);font-size:10.5px">ROB index j</text>
<path d="M300,466 H312 A18,20 0 0 1 312,506 H300 Z" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.3"/>
<text x="315" y="462" text-anchor="middle" style="fill:var(--muted);font-size:9px">×N</text>
<path d="M330,486 H354" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<path d="M333,491 L341,481" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<text x="339" y="479" text-anchor="middle" style="fill:var(--muted);font-size:9px">9</text>
<path d="M350,470 Q370,470 382,486 Q370,502 350,502 Q359,486 350,470 Z" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.3"/>
<text x="366" y="516" text-anchor="middle" style="fill:var(--muted);font-size:9px">OR over N</text>
<path d="M382,486 H588" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<text x="592" y="484" style="fill:var(--ink);font-size:10.5px;font-weight:600">flush point</text>
<text x="592" y="497" style="fill:var(--muted);font-size:9.5px">ROB index</text>
<text x="400" y="481" style="fill:var(--muted);font-size:9.5px">the oldest violating load</text>
<path d="M170,518 V570 H588" style="fill:none;stroke:var(--muted);stroke-width:1.2"/>
<text x="176" y="546" style="fill:var(--muted);font-size:9.5px">valid out</text>
<text x="592" y="568" style="fill:var(--accent-red);font-size:10.5px;font-weight:600">violation</text>
<text x="592" y="581" style="fill:var(--muted);font-size:9.5px">flush, train MDP</text>
<text x="20" y="612" style="fill:var(--muted);font-size:11px">① to ⑥ are the six checks. Every check runs in the same cycle, because the store has its physical address</text>
<text x="20" y="628" style="fill:var(--muted);font-size:11px">and no load is waiting on the probe. Check ⑥ compares indices that carry a wrap bit: with equal wraps the</text>
<text x="20" y="644" style="fill:var(--muted);font-size:11px">smaller index is older, with different wraps the larger one is, so the XOR of the wraps picks a&lt;b or a&gt;b.</text>
<text x="20" y="660" style="fill:var(--muted);font-size:11px">A load that read L1 (forwarded = 0) is stale outright. The 9-bit ROB index reaches the flush logic, which</text>
<text x="20" y="676" style="fill:var(--muted);font-size:11px">squashes that load and everything younger and refetches from it.</text>
</svg></div>
<h3 id="sec-catching-violations">Catching Violations</h3>
<p>A violation is recovered like a mispredicted branch whose redirect points at the load itself: the core flushes the load and everything younger and refetches from the load (see <a href="#/flush-recovery">Pipeline Flush and Recovery</a>). Re-executing only the load and its dependents would be cheaper, but the core would have to track which instructions consumed the stale value, so most cores flush.</p>
<p>Invalidations from other cores also search the LQ, to keep loads in the order the memory model requires. So do evictions from this core's L1: once the line leaves, the core no longer sees invalidations for it, so it has to treat the eviction as if one had arrived. Under TSO, a younger load that read the line before an older load completes may hold a value that is stale relative to the older one, so the core squashes it (see <a href="#/consistency/impl">Speculating Past the Model</a>).</p>
<h4>A Snoop Probes the Load Queue</h4>
<p>The classic case is a flag and its data. Another core writes the data and then sets the flag. This core runs load A (the flag) and then load B (the data). B executes first and reads the old data. Then the other core's write to the data invalidates B's line, and the write to the flag follows. If A now reads the new flag, the pair has seen the flag set but the old data, which TSO forbids. If A had already read its value before the invalidation, both loads saw memory before both writes, and B's value is fine. So the question the snoop has to answer is whether any load older than B still has no value.</p>
<p>That takes two searches, and only the first is a CAM:</p>
<ol>
<li><strong>Address search: which loads read the line?</strong> A CAM search like the store probe, against every LQ entry. Each entry checks its valid bit, its executed bit, and its line address, bits 45–6 for 64-byte lines (the physical page, bits 45–12, and the top of the page offset, bits 11–6). There is no byte-mask check, because the whole line is gone. Each matching entry sets its snooped bit, and the matches form a row of bits M.</li>
<li><strong>Age search: is there an older load without a value?</strong> The older load can have any address. In the example, A reads the flag's line, not the data's line, so it can't be found by comparing addresses, and the snoop's address isn't used at all. Each entry contributes only its valid bit, its executed bit, and its position in the LQ (8-bit index plus wrap bit, for 192 entries). Here "executed" means the value has come back: a load that missed L1 and is still waiting for its data counts as having no value.</li>
</ol>
<p>The age search doesn't need a comparator per entry against a searched value, because it doesn't depend on the snoop. The core keeps a pointer P to the oldest load without a value: a priority encoder over the row of bits valid AND NOT executed, starting at the LQ head and moving toward the tail (see <a href="#/lsq-search/priority-encoders">Priority Encoders</a>). P changes only when a load gets its value, dispatches, or retires, so it can be computed every cycle off the snoop's path. When the snoop arrives, the hardware needs:</p>
<ul>
<li><strong>An age mask.</strong> One bit per entry, set for entries younger than P. It comes from a thermometer decode of P to the tail, or from a 9-bit comparison per entry with the wrap-bit rule from the store probe (equal wraps, the smaller index is older, different wraps, the larger one is).</li>
<li><strong>An AND per entry.</strong> M AND the age mask gives the loads that read the line and have an older load still waiting. Those are the violations.</li>
<li><strong>A priority encoder</strong> from P toward the tail, to pick the oldest violation. The core flushes from it, and every younger load goes with it.</li>
</ul>
<p>If the encoder for P finds no load without a value, every older load has its value and nothing is squashed. A matching load older than P is also safe, for the same reason. For example, with the LQ head at entry 40, entries 40 to 51 executed, and A at entry 52 still waiting on a miss, P = 52. A snoop that matches entries 45 and 57 squashes from entry 57 and leaves entry 45 alone.</p>
<p>A simpler design skips the age search: it only sets snooped bits, and any snooped load that reaches retirement is treated as a violation. That needs only the address CAM, but it flushes loads whose older loads had all finished, so it flushes more often than it has to.</p>
<h3 id="sec-physical-addresses">Virtual and Physical Addresses</h3>
<p>The early compare can use the virtual address's page-offset bits because they are the same in the physical address. The final check has to compare the physical page. Comparing virtual addresses alone goes wrong in two ways:</p>
<ul>
<li><strong>Homonyms: same virtual address, different physical address.</strong> After a context switch, the new process can use a virtual address that matches a store from the old process that has committed but is still draining from the SQ. A virtual-only compare would forward the old process's data. Cores handle this by tagging entries with an address space ID (ASID) or by draining the SQ at the switch.</li>
<li><strong>Synonyms: different virtual addresses, same physical address.</strong> These happen within one process. A mirrored ring buffer is a common case: the OS maps two consecutive virtual regions onto the same physical pages, so a write that runs past the end of the buffer lands at its start without a wrap check. A virtual-only compare misses the dependence in both directions:
<ul>
<li>If the load executes after the store, its SQ search doesn't find the store, so it doesn't forward and reads stale data from L1.</li>
<li>If the store executes after the load, its LQ probe doesn't find the load, so the violation goes uncaught.</li>
</ul></li>
</ul>
<p>The two kinds of error aren't equal. A false match, such as 4K aliasing, only costs performance: a stall or a needless flush. A missed true dependence returns a wrong value, which is a correctness bug. So the early partial compare can be approximate, but the final check must be exact and physical.</p>`,
  practice: {
    guided: [
      {
        q: `<p>A store's address resolves and it probes the LQ. Which loads pass all six checks, and which load does the core flush from?</p><p>Given:</p><ul><li>LQ: 16 entries, LQ 0 to 15, used as a circular buffer, with the head (oldest load) at LQ 10 and the tail at LQ 3, so LQ 10 to 15 and then LQ 0 to 2 hold loads, oldest to youngest</li><li>SQ: head at SQ 4 and no wrap, so a lower SQ index is an older store</li><li>The probing store S: SQ 9, a 4-byte store to physical address 0x5C218E3C, so it writes bytes 0x5C218E3C to 0x5C218E3F</li><li>S recorded LQ 13 as its mark, the LQ tail when S was allocated</li><li>Loads in the LQ:<ul><li>LQ 11: executed, 4 bytes at 0x5C218E3C, read from L1</li><li>LQ 13: not executed yet, 8 bytes at 0x5C218E38</li><li>LQ 14: executed, 2 bytes at 0x5C218E3E, forwarded from SQ 11</li><li>LQ 15: executed, 8 bytes at 0x5C218E40, read from L1</li><li>LQ 0: executed, 4 bytes at 0x1D073E3C, read from L1</li><li>LQ 1: executed, 1 byte at 0x5C218E3D, read from L1</li><li>LQ 2: executed, 8 bytes at 0x5C218E38, forwarded from SQ 6</li></ul></li><li>LQ 10 and LQ 12 hold loads to other pages</li><li>Chunks are 8 bytes and aligned, the probe compares page offset bits 11–3 and physical page bits 45–12, and byte masks cover the 8 bytes of a chunk</li></ul>`,
        a: `<ol class="steps"><li><strong>Age.</strong> Only loads from S's mark, LQ 13, to the tail count, and the LQ has wrapped: LQ 13, 14, 15, 0, 1, and 2, oldest to youngest. LQ 10, 11, and 12 are older than S and are masked out. LQ 11 reads S's bytes, but it comes before S in program order, so the old value is the right one for it.</li><li><strong>Executed.</strong> LQ 13 hasn't read a value yet, so it is safe. When it executes, its own SQ search will find S. That leaves LQ 14, 15, 0, 1, and 2.</li><li><strong>Page offset.</strong> S's chunk starts at offset 0xE38. LQ 14 (0xE3E), LQ 0 (0xE3C), LQ 1 (0xE3D), and LQ 2 (0xE38) are in that chunk. LQ 15 starts at 0xE40, the next chunk, so it drops out.</li><li><strong>Physical page.</strong> S's page is 0x5C218. LQ 0's page is 0x1D073, so it is a 4K alias: it matched the offset but fails here and is safe. LQ 14, 1, and 2 are on page 0x5C218.</li><li><strong>Bytes.</strong> S writes bytes 4 to 7 of the chunk. LQ 14 reads bytes 6 and 7, LQ 1 reads byte 5, and LQ 2 reads bytes 0 to 7, so all three share at least one byte with S.</li><li><strong>Source.</strong> LQ 14 forwarded from SQ 11, which is younger than S (SQ 9), so its bytes are the ones it should have read, and it is safe. LQ 1 read L1, which still holds the bytes from before S, so it is stale. LQ 2 forwarded from SQ 6, older than S, so its bytes 4 to 7 are the ones S overwrites, and it is stale too.</li><li><strong>Pick the oldest.</strong> The violations are LQ 1 and LQ 2. Searching from the mark toward the tail (13, 14, 15, 0, 1, 2), the first one is LQ 1. The core flushes from LQ 1: that load, LQ 2, and every younger instruction are squashed, and fetch restarts at LQ 1's load. LQ 14, 15, and 0 keep their values, even though LQ 14 overlaps S and LQ 0 matched its page offset.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Why does an x86 core check the load queue against coherence invalidations?</p>`,
        a: `<p>TSO requires loads to appear in program order. If a younger load executed early and the line is then invalidated by another core's write before an older load completes, the younger load may hold a value that is stale relative to the older one. The core detects this on the invalidation and squashes the younger load. Weaker models such as ARM allow more load-load reordering, but same-address ordering still must hold.</p>`
      },
      {
        q: `<p>A core skips the snoop's age search. It only sets a snooped bit on every executed load whose line is invalidated or evicted, and it flushes from any snooped load that reaches retirement. Is that ever wrong, and what does it cost?</p>`,
        a: `<p>It is never wrong, only conservative. Every load the full scheme would squash is a snooped load, so this scheme squashes it too, and the extra flushes only cost time.</p><p>The extra flushes come from snooped loads whose older loads had all read their values before the invalidation. Those loads saw memory as it was before the remote write, which TSO allows. With the age search, the pointer to the oldest load without a value points at a younger load, or at none, so they are left alone. Without it, they are flushed and refetched.</p><p>How much that costs depends on how often lines that loads have read get invalidated or evicted while the loads are still in the window:</p><ul><li>Code with heavy true or false sharing between cores sees it often.</li><li>Large windows see it more, because loads stay in the LQ longer and L1 evicts more of the lines they read.</li><li>Single-threaded code with a working set that fits in L1 rarely sees it.</li></ul><p>It also costs in two ways the full scheme doesn't:</p><ul><li><strong>Late detection.</strong> The flush waits until the snooped load reaches retirement, so all the work done since the snoop is thrown away too.</li><li><strong>Forward progress.</strong> Under heavy ping-pong on one line, such as a contended lock or flag, the refetched load can be snooped again before it retires and be flushed again, with no limit. The design needs a guarantee, for example running the load non-speculatively once it is the oldest instruction, so a snoop can't flush it.</li></ul><p>The trade is one address CAM against an address CAM plus a priority encoder for the pointer, an age mask, and a second encoder. The cheap version is reasonable on a small core, and it gets worse as the LQ grows.</p>`
      }
    ]
  }
},

{
  id: "lsq-search",
  region: "mord",
  title: "LSQ Search Hardware",
  sections: [
    { id: "priority-encoders", label: "Priority Encoders" },
    { id: "search-hardware", label: "Search Hardware and Load-to-Use Latency" }
  ],
  body: `
<p>The SQ search on <a href="#/lsq">The Store Queue</a> and the LQ probe on <a href="#/lsq-lq">The Load Queue and Ordering Violations</a> both end with a row of match lines from which one entry has to be picked. This page covers that pick, the priority encoder, and then the whole SQ search as a pipeline beside the L1 access, including what it costs to make the queue bigger. The examples use the same Golden Cove-sized core (114-entry SQ, 192-entry LQ, 46-bit physical addresses).</p>
<h3 id="sec-priority-encoders">Priority Encoders</h3>
<p>Both searches end the same way: a row of match bits, any number of them set, from which one entry has to be picked, the one nearest the searcher in age. A <strong>priority encoder</strong> does that. It takes N request bits in a fixed priority order and reports which set bit has the highest priority, plus a valid bit saying whether any bit was set. The same circuit picks the oldest ready instruction in an age-ordered scheduler (see <a href="#/wakeup/select">Select</a>) and counts leading zeros in an integer unit (see <a href="#/int-units/shift">Shifters and Bit Counting</a>). <a href="#/select-logic">Selection and Arbitration Logic</a> covers priority encoders in general, along with picking several entries per cycle, arbiters, and age tracking.</p>
<p>With four inputs and input 0 first (x means either value):</p>
<div class="tbl"><table>
<tr><th>r<sub>3</sub> r<sub>2</sub> r<sub>1</sub> r<sub>0</sub></th><th>One-hot grant g<sub>3</sub> g<sub>2</sub> g<sub>1</sub> g<sub>0</sub></th><th>Binary index y<sub>1</sub> y<sub>0</sub></th><th>Valid</th></tr>
<tr><td>x x x 1</td><td>0 0 0 1</td><td>0 0</td><td>1</td></tr>
<tr><td>x x 1 0</td><td>0 0 1 0</td><td>0 1</td><td>1</td></tr>
<tr><td>x 1 0 0</td><td>0 1 0 0</td><td>1 0</td><td>1</td></tr>
<tr><td>1 0 0 0</td><td>1 0 0 0</td><td>1 1</td><td>1</td></tr>
<tr><td>0 0 0 0</td><td>0 0 0 0</td><td>x x</td><td>0</td></tr>
</table></div>
<p>The output comes in two forms, and the LSQ uses both:</p>
<ul>
<li><strong>One-hot grant.</strong> Input i wins if it is set and no input before it is: \\(g_i = r_i \\land \\lnot(r_0 \\lor r_1 \\lor \\dots \\lor r_{i-1})\\). The grant can drive the winning entry's data wordline directly, so the SQ reads the forwarding store's data without decoding an index first.</li>
<li><strong>Binary index.</strong> log<sub>2</sub> N bits, each the OR of the grant lines whose index has that bit set: \\(y_0 = g_1 \\lor g_3\\) and \\(y_1 = g_2 \\lor g_3\\). This is what a load writes into its forwarded-from SQ index field.</li>
</ul>
<p>The expensive part is the OR of every input before i, a <strong>prefix OR</strong>. Built as a chain, it ripples through N − 1 gates. Built as a tree, the same parallel prefix as an adder's carry lookahead (see <a href="#/int-units/adders">Adders</a>), it takes log<sub>2</sub> N levels, each ORing a signal with the one 2<sup>k</sup> places before it:</p>
<div class="tbl"><svg viewBox="0 0 680 318" role="img" aria-label="An 8-input prefix OR tree, input 0 highest priority. Inputs r0 to r7 sit along the top. Level 1 ORs each input with the one 1 place before it, level 2 with the signal 2 places before, level 3 with the signal 4 places before. After 3 levels, output P i is the OR of r0 through r i. Inputs with nothing that far before them pass straight down. The grant for input i is r i AND NOT P of i minus 1, and the any-request output is P7. Each level doubles the span covered, so N inputs need log base 2 of N levels, 7 levels for 128 inputs. A chain would need N minus 1 ORs in series. The tree is the same parallel prefix as an adder's carry lookahead." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<text x="20" y="20" style="fill:var(--muted);font-size:12px;font-weight:600">An 8-input prefix OR, input 0 first: Pᵢ is the OR of r₀ through rᵢ after 3 levels</text>
<rect x="90" y="36" width="40" height="22" rx="3" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.2"/>
<text x="110" y="52" text-anchor="middle" style="fill:var(--pad);font-size:11px;font-family:var(--mono)">r0</text>
<rect x="162" y="36" width="40" height="22" rx="3" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.2"/>
<text x="182" y="52" text-anchor="middle" style="fill:var(--pad);font-size:11px;font-family:var(--mono)">r1</text>
<rect x="234" y="36" width="40" height="22" rx="3" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.2"/>
<text x="254" y="52" text-anchor="middle" style="fill:var(--pad);font-size:11px;font-family:var(--mono)">r2</text>
<rect x="306" y="36" width="40" height="22" rx="3" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.2"/>
<text x="326" y="52" text-anchor="middle" style="fill:var(--pad);font-size:11px;font-family:var(--mono)">r3</text>
<rect x="378" y="36" width="40" height="22" rx="3" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.2"/>
<text x="398" y="52" text-anchor="middle" style="fill:var(--pad);font-size:11px;font-family:var(--mono)">r4</text>
<rect x="450" y="36" width="40" height="22" rx="3" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.2"/>
<text x="470" y="52" text-anchor="middle" style="fill:var(--pad);font-size:11px;font-family:var(--mono)">r5</text>
<rect x="522" y="36" width="40" height="22" rx="3" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.2"/>
<text x="542" y="52" text-anchor="middle" style="fill:var(--pad);font-size:11px;font-family:var(--mono)">r6</text>
<rect x="594" y="36" width="40" height="22" rx="3" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.2"/>
<text x="614" y="52" text-anchor="middle" style="fill:var(--pad);font-size:11px;font-family:var(--mono)">r7</text>
<g style="stroke:var(--muted);stroke-width:1.2;fill:none"><path d="M110,60 V112"/><path d="M182,60 V112"/><path d="M110,60 L182,112"/><path d="M254,60 V112"/><path d="M182,60 L254,112"/><path d="M326,60 V112"/><path d="M254,60 L326,112"/><path d="M398,60 V112"/><path d="M326,60 L398,112"/><path d="M470,60 V112"/><path d="M398,60 L470,112"/><path d="M542,60 V112"/><path d="M470,60 L542,112"/><path d="M614,60 V112"/><path d="M542,60 L614,112"/><path d="M110,112 V168"/><path d="M182,112 V168"/><path d="M254,112 V168"/><path d="M110,112 L254,168"/><path d="M326,112 V168"/><path d="M182,112 L326,168"/><path d="M398,112 V168"/><path d="M254,112 L398,168"/><path d="M470,112 V168"/><path d="M326,112 L470,168"/><path d="M542,112 V168"/><path d="M398,112 L542,168"/><path d="M614,112 V168"/><path d="M470,112 L614,168"/><path d="M110,168 V224"/><path d="M182,168 V224"/><path d="M254,168 V224"/><path d="M326,168 V224"/><path d="M398,168 V224"/><path d="M110,168 L398,224"/><path d="M470,168 V224"/><path d="M182,168 L470,224"/><path d="M542,168 V224"/><path d="M254,168 L542,224"/><path d="M614,168 V224"/><path d="M326,168 L614,224"/><path d="M110,224 V250"/><path d="M182,224 V250"/><path d="M254,224 V250"/><path d="M326,224 V250"/><path d="M398,224 V250"/><path d="M470,224 V250"/><path d="M542,224 V250"/><path d="M614,224 V250"/></g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"><circle cx="182" cy="112" r="8"/><circle cx="254" cy="112" r="8"/><circle cx="326" cy="112" r="8"/><circle cx="398" cy="112" r="8"/><circle cx="470" cy="112" r="8"/><circle cx="542" cy="112" r="8"/><circle cx="614" cy="112" r="8"/><circle cx="254" cy="168" r="8"/><circle cx="326" cy="168" r="8"/><circle cx="398" cy="168" r="8"/><circle cx="470" cy="168" r="8"/><circle cx="542" cy="168" r="8"/><circle cx="614" cy="168" r="8"/><circle cx="398" cy="224" r="8"/><circle cx="470" cy="224" r="8"/><circle cx="542" cy="224" r="8"/><circle cx="614" cy="224" r="8"/></g>
<text x="20" y="116" style="fill:var(--trace);font-size:10px;font-weight:600">level 1: 1 back</text>
<text x="20" y="172" style="fill:var(--trace);font-size:10px;font-weight:600">level 2: 2 back</text>
<text x="20" y="228" style="fill:var(--trace);font-size:10px;font-weight:600">level 3: 4 back</text>
<text x="110" y="266" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">P0</text>
<text x="182" y="266" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">P1</text>
<text x="254" y="266" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">P2</text>
<text x="326" y="266" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">P3</text>
<text x="398" y="266" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">P4</text>
<text x="470" y="266" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">P5</text>
<text x="542" y="266" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">P6</text>
<text x="614" y="266" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-family:var(--mono)">P7</text>
<text x="20" y="292" style="fill:var(--muted);font-size:11px">Circles are 2-input ORs. Grant: gᵢ = rᵢ AND NOT Pᵢ₋₁ (g₀ = r₀), and “any” = P7. Each level doubles the span.</text>
<text x="20" y="308" style="fill:var(--muted);font-size:11px">N inputs need log₂ N levels (7 for 128), where a chain needs N − 1 ORs in series.</text>
</svg></div>
<p>So the encoder's delay grows with log N, not N. The 114-entry SQ in this region needs 7 levels, against 3 for an 8-entry queue.</p>
<p><strong>Starting at the age mark.</strong> The SQ is a circular buffer, so its priority order isn't fixed. The load wants the entry just before its mark, then the one before that, and so on back to the head, which may mean wrapping past SQ 0 to the top of the array. Rotating the match bits so that the mark lands at position 0 would put a barrel shifter on the critical path. Cores instead run two fixed-order encoders side by side, each letting the highest index win:</p>
<ol>
<li>Encoder 1 sees only the matches below the mark, ANDed with a mask of 1s at indices below the mark position. Among the older stores, those are always the youngest, so if any is set, encoder 1's winner is the answer.</li>
<li>Encoder 2 sees all the matches. If nothing is set below the mark, every match lies above it, in the part of the queue that wrapped from the head, and the highest index there is the youngest.</li>
</ol>
<div class="tbl"><svg viewBox="0 0 680 428" role="img" aria-label="Circular select on an 8-entry store queue with its head at SQ 5, the load's mark at SQ 2, and the tail at SQ 4. The stores older than the load are SQ 5, 6, 7, 0, and 1, oldest to youngest. SQ 2 and 3 are younger and SQ 4 is empty. The below-mark mask is 1 for SQ 0 and 1. Load A matches SQ 0 and SQ 6. ANDed with the mask, only SQ 0 is left, so encoder 1 is valid and picks SQ 0, which forwards. SQ 6 is older and loses. Load B matches SQ 5 and SQ 7. The masked vector is empty, so encoder 1 is not valid and encoder 2, which sees all matches, picks the highest index, SQ 7, which forwards. In hardware, the match bits go to an AND with the mask and then to encoder 1, and straight to encoder 2. Both encoders let the highest index win. Encoder 1's valid output drives the select of a 2 to 1 mux that picks between the two grants." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<defs><marker id="arrPE" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker></defs>
<text x="20" y="18" style="fill:var(--muted);font-size:12px;font-weight:600">Circular select on an 8-entry SQ: head at SQ 5, the load's mark at SQ 2, tail at SQ 4</text>
<text x="360" y="38" text-anchor="middle" style="fill:var(--pad);font-size:10px;font-weight:600">head</text>
<text x="246" y="38" text-anchor="middle" style="fill:var(--pad);font-size:10px;font-weight:600">mark</text>
<text x="322" y="38" text-anchor="middle" style="fill:var(--pad);font-size:10px;font-weight:600">tail</text>
<text x="170" y="54" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">SQ 0</text>
<text x="208" y="54" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">SQ 1</text>
<text x="246" y="54" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">SQ 2</text>
<text x="284" y="54" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">SQ 3</text>
<text x="322" y="54" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">SQ 4</text>
<text x="360" y="54" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">SQ 5</text>
<text x="398" y="54" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">SQ 6</text>
<text x="436" y="54" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">SQ 7</text>
<text x="20" y="76" style="fill:var(--ink);font-size:11px">older than load</text>
<text x="170" y="76" text-anchor="middle" style="fill:var(--accent-green);font-size:12px;font-weight:600">✓</text>
<text x="208" y="76" text-anchor="middle" style="fill:var(--accent-green);font-size:12px;font-weight:600">✓</text>
<text x="246" y="76" text-anchor="middle" style="fill:var(--accent-red);font-size:12px;font-weight:600">✗</text>
<text x="284" y="76" text-anchor="middle" style="fill:var(--accent-red);font-size:12px;font-weight:600">✗</text>
<text x="322" y="76" text-anchor="middle" style="fill:var(--muted);font-size:12px;font-weight:600">–</text>
<text x="360" y="76" text-anchor="middle" style="fill:var(--accent-green);font-size:12px;font-weight:600">✓</text>
<text x="398" y="76" text-anchor="middle" style="fill:var(--accent-green);font-size:12px;font-weight:600">✓</text>
<text x="436" y="76" text-anchor="middle" style="fill:var(--accent-green);font-size:12px;font-weight:600">✓</text>
<text x="20" y="104" style="fill:var(--ink);font-size:11px">below-mark mask</text>
<rect x="154" y="90" width="32" height="20" rx="2" style="fill:var(--pad);stroke:var(--muted);stroke-width:0.75"/><text x="170" y="104" text-anchor="middle" style="fill:var(--surface);font-size:11px;font-family:var(--mono)">1</text>
<rect x="192" y="90" width="32" height="20" rx="2" style="fill:var(--pad);stroke:var(--muted);stroke-width:0.75"/><text x="208" y="104" text-anchor="middle" style="fill:var(--surface);font-size:11px;font-family:var(--mono)">1</text>
<rect x="230" y="90" width="32" height="20" rx="2" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><text x="246" y="104" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">0</text>
<rect x="268" y="90" width="32" height="20" rx="2" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><text x="284" y="104" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">0</text>
<rect x="306" y="90" width="32" height="20" rx="2" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><text x="322" y="104" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">0</text>
<rect x="344" y="90" width="32" height="20" rx="2" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><text x="360" y="104" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">0</text>
<rect x="382" y="90" width="32" height="20" rx="2" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><text x="398" y="104" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">0</text>
<rect x="420" y="90" width="32" height="20" rx="2" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><text x="436" y="104" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">0</text>
<path d="M20,124 H676" style="stroke:var(--rule);stroke-width:1"/>
<text x="20" y="144" style="fill:var(--ink);font-size:11px;font-weight:600">Load A</text>
<text x="20" y="166" style="fill:var(--ink);font-size:11px">matches</text>
<rect x="154" y="152" width="32" height="20" rx="2" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><text x="170" y="166" text-anchor="middle" style="fill:var(--surface);font-size:11px;font-family:var(--mono)">1</text>
<rect x="192" y="152" width="32" height="20" rx="2" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><text x="208" y="166" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">0</text>
<rect x="230" y="152" width="32" height="20" rx="2" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><text x="246" y="166" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">0</text>
<rect x="268" y="152" width="32" height="20" rx="2" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><text x="284" y="166" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">0</text>
<rect x="306" y="152" width="32" height="20" rx="2" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><text x="322" y="166" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">0</text>
<rect x="344" y="152" width="32" height="20" rx="2" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><text x="360" y="166" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">0</text>
<rect x="382" y="152" width="32" height="20" rx="2" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><text x="398" y="166" text-anchor="middle" style="fill:var(--surface);font-size:11px;font-family:var(--mono)">1</text>
<rect x="420" y="152" width="32" height="20" rx="2" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><text x="436" y="166" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">0</text>
<text x="20" y="194" style="fill:var(--ink);font-size:11px">AND mask</text>
<rect x="154" y="180" width="32" height="20" rx="2" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><text x="170" y="194" text-anchor="middle" style="fill:var(--surface);font-size:11px;font-family:var(--mono)">1</text>
<rect x="192" y="180" width="32" height="20" rx="2" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><text x="208" y="194" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">0</text>
<rect x="230" y="180" width="32" height="20" rx="2" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><text x="246" y="194" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">0</text>
<rect x="268" y="180" width="32" height="20" rx="2" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><text x="284" y="194" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">0</text>
<rect x="306" y="180" width="32" height="20" rx="2" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><text x="322" y="194" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">0</text>
<rect x="344" y="180" width="32" height="20" rx="2" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><text x="360" y="194" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">0</text>
<rect x="382" y="180" width="32" height="20" rx="2" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><text x="398" y="194" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">0</text>
<rect x="420" y="180" width="32" height="20" rx="2" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><text x="436" y="194" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">0</text>
<text x="470" y="166" style="fill:var(--ink);font-size:11px">encoder 1: SQ 0 (valid)</text>
<text x="470" y="182" style="fill:var(--accent-green);font-size:11px;font-weight:600">SQ 0 forwards</text>
<text x="470" y="198" style="fill:var(--muted);font-size:10.5px">SQ 6 is older, so it loses</text>
<path d="M20,212 H676" style="stroke:var(--rule);stroke-width:1"/>
<text x="20" y="232" style="fill:var(--ink);font-size:11px;font-weight:600">Load B</text>
<text x="20" y="254" style="fill:var(--ink);font-size:11px">matches</text>
<rect x="154" y="240" width="32" height="20" rx="2" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><text x="170" y="254" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">0</text>
<rect x="192" y="240" width="32" height="20" rx="2" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><text x="208" y="254" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">0</text>
<rect x="230" y="240" width="32" height="20" rx="2" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><text x="246" y="254" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">0</text>
<rect x="268" y="240" width="32" height="20" rx="2" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><text x="284" y="254" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">0</text>
<rect x="306" y="240" width="32" height="20" rx="2" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><text x="322" y="254" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">0</text>
<rect x="344" y="240" width="32" height="20" rx="2" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><text x="360" y="254" text-anchor="middle" style="fill:var(--surface);font-size:11px;font-family:var(--mono)">1</text>
<rect x="382" y="240" width="32" height="20" rx="2" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><text x="398" y="254" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">0</text>
<rect x="420" y="240" width="32" height="20" rx="2" style="fill:var(--trace);stroke:var(--muted);stroke-width:0.75"/><text x="436" y="254" text-anchor="middle" style="fill:var(--surface);font-size:11px;font-family:var(--mono)">1</text>
<text x="20" y="282" style="fill:var(--ink);font-size:11px">AND mask</text>
<rect x="154" y="268" width="32" height="20" rx="2" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><text x="170" y="282" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">0</text>
<rect x="192" y="268" width="32" height="20" rx="2" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><text x="208" y="282" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">0</text>
<rect x="230" y="268" width="32" height="20" rx="2" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><text x="246" y="282" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">0</text>
<rect x="268" y="268" width="32" height="20" rx="2" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><text x="284" y="282" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">0</text>
<rect x="306" y="268" width="32" height="20" rx="2" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><text x="322" y="282" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">0</text>
<rect x="344" y="268" width="32" height="20" rx="2" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><text x="360" y="282" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">0</text>
<rect x="382" y="268" width="32" height="20" rx="2" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><text x="398" y="282" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">0</text>
<rect x="420" y="268" width="32" height="20" rx="2" style="fill:var(--surface);stroke:var(--muted);stroke-width:0.75"/><text x="436" y="282" text-anchor="middle" style="fill:var(--muted);font-size:11px;font-family:var(--mono)">0</text>
<text x="470" y="254" style="fill:var(--ink);font-size:11px">encoder 1: nothing set</text>
<text x="470" y="270" style="fill:var(--ink);font-size:11px">encoder 2: highest is SQ 7</text>
<text x="470" y="286" style="fill:var(--accent-green);font-size:11px;font-weight:600">SQ 7 forwards</text>
<text x="20" y="310" style="fill:var(--muted);font-size:11px">Older stores, oldest to youngest: SQ 5, 6, 7, 0, 1. Below the mark is always the youngest part.</text>
<rect x="20" y="358" width="120" height="30" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="80" y="377" text-anchor="middle" style="fill:var(--ink);font-size:11px">match bits</text>
<rect x="180" y="332" width="100" height="30" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="230" y="351" text-anchor="middle" style="fill:var(--ink);font-size:11px">AND mask</text>
<rect x="320" y="332" width="140" height="30" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="390" y="351" text-anchor="middle" style="fill:var(--ink);font-size:11px">encoder 1 (high wins)</text>
<rect x="320" y="386" width="140" height="30" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="390" y="405" text-anchor="middle" style="fill:var(--ink);font-size:11px">encoder 2 (high wins)</text>
<path d="M520,327 L560,342 L560,407 L520,422 Z" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5"/>
<text x="540" y="378" text-anchor="middle" style="fill:var(--pad);font-size:11px;font-weight:600">2:1</text>
<g style="stroke:var(--muted);stroke-width:1.2;fill:none"><path d="M140,373 H160 V347 H178" marker-end="url(#arrPE)"/><path d="M160,373 V401 H318" marker-end="url(#arrPE)"/><path d="M280,347 H318" marker-end="url(#arrPE)"/><path d="M460,347 H518" marker-end="url(#arrPE)"/><path d="M460,401 H518" marker-end="url(#arrPE)"/><path d="M560,374 H598" marker-end="url(#arrPE)"/><path d="M390,332 V322 H540 V332" style="stroke-dasharray:4 3" marker-end="url(#arrPE)"/></g>
<text x="548" y="326" style="fill:var(--muted);font-size:10px">valid: select</text>
<text x="604" y="378" style="fill:var(--ink);font-size:11px;font-weight:600">grant</text>
</svg></div>
<p>A 2:1 mux on encoder 1's valid bit picks between them, so the circular select costs a second encoder and one more gate level, not a shifter. Round-robin arbiters use the same trick. The LQ probe is the mirror image: the lowest index wins, and the mask covers indices at or above the store's mark.</p>
<h3 id="sec-search-hardware">Search Hardware and Load-to-Use Latency</h3>
<p>The SQ search runs alongside the L1 access, in the same cycles, so the load's value is ready at the same time whichever one supplies it. A search goes through five steps:</p>
<ol>
<li><strong>Broadcast.</strong> The load's offset bits, page bits, byte mask, and age mark are driven down the whole queue. The wires pass every entry, so their length and load grow with N.</li>
<li><strong>Compare.</strong> Each entry XNORs its stored address bits with the broadcast ones and ANDs the results, with the age and byte checks, into one <strong>match line</strong>. On this page's core that is 9 offset bits (11–3) and 34 page bits. One compare's depth doesn't depend on N, but every load port needs its own comparator in every entry, so the count does.</li>
<li><strong>Select.</strong> The circular priority encoder turns the match lines into one grant, in about log<sub>2</sub> N levels.</li>
<li><strong>Read and align.</strong> The grant drives the winning entry's data row onto bitlines that also run past every entry. The bytes are then shifted into place by the offset difference, as in the byte-check figure on <a href="#/lsq/stores">The Store Queue</a>.</li>
<li><strong>Merge.</strong> A 2:1 mux picks the forwarded bytes or the L1 bytes, and the value goes out on the bypass network to the load's dependents.</li>
</ol>
<div class="tbl"><svg viewBox="0 0 680 300" role="img" aria-label="A load's two paths after address generation. The L1 path: DTLB, then the L1 tags and data of all ways, then way select, then align. The SQ forwarding path: broadcast of the load's address down the queue, then the CAM compare of address, age, and bytes in every entry, then the priority encoder, then the data read and shift. The DTLB's physical page bits feed the CAM's page compare. A 2 to 1 mux picks the forwarded bytes or the L1 bytes and sends them on the bypass to dependents. Four parts of the SQ path grow with the number of entries N: the broadcast wire grows with N, the encoder takes about log base 2 of N levels, and the data bitlines grow with N. The compare's depth stays fixed but its count is N times the number of load ports. The L1 path doesn't grow with N, so past some size the SQ path sets the load's latency. The LQ probe has no load waiting on it, so it is off this path." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<defs><marker id="arrHW" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker></defs>
<text x="20" y="20" style="fill:var(--muted);font-size:12px;font-weight:600">A load's two paths run side by side and meet at one mux</text>
<rect x="20" y="108" width="56" height="36" rx="3" style="fill:var(--surface);stroke:var(--muted);stroke-width:1.5"/><text x="48" y="130" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">AGU</text>
<text x="96" y="44" style="fill:var(--trace);font-size:11px;font-weight:600">L1 path</text>
<text x="96" y="164" style="fill:var(--pad);font-size:11px;font-weight:600">SQ forwarding path</text>
<rect x="96" y="50" width="60" height="34" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/>
<text x="126" y="71" text-anchor="middle" style="fill:var(--ink);font-size:10.5px">DTLB</text>
<rect x="166" y="50" width="144" height="34" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/>
<text x="238" y="71" text-anchor="middle" style="fill:var(--ink);font-size:10.5px">L1 tags + data, all ways</text>
<rect x="320" y="50" width="72" height="34" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/>
<text x="356" y="71" text-anchor="middle" style="fill:var(--ink);font-size:10.5px">way select</text>
<rect x="402" y="50" width="66" height="34" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/>
<text x="435" y="71" text-anchor="middle" style="fill:var(--ink);font-size:10.5px">align</text>
<rect x="96" y="170" width="60" height="34" rx="3" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5"/>
<text x="126" y="191" text-anchor="middle" style="fill:var(--ink);font-size:10.5px">broadcast</text>
<rect x="166" y="170" width="144" height="34" rx="3" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5"/>
<text x="238" y="191" text-anchor="middle" style="fill:var(--ink);font-size:10.5px">CAM: address, age, bytes</text>
<rect x="320" y="170" width="72" height="34" rx="3" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5"/>
<text x="356" y="184" text-anchor="middle" style="fill:var(--ink);font-size:10.5px">priority</text>
<text x="356" y="197" text-anchor="middle" style="fill:var(--ink);font-size:10.5px">encoder</text>
<rect x="402" y="170" width="66" height="34" rx="3" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5"/>
<text x="435" y="184" text-anchor="middle" style="fill:var(--ink);font-size:10.5px">data read</text>
<text x="435" y="197" text-anchor="middle" style="fill:var(--ink);font-size:10.5px">+ shift</text>
<path d="M488,58 L518,72 L518,192 L488,206 Z" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.5"/>
<text x="503" y="136" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">2:1</text>
<rect x="552" y="114" width="116" height="38" rx="3" style="fill:var(--surface);stroke:var(--muted);stroke-width:1.5"/><text x="610" y="130" text-anchor="middle" style="fill:var(--ink);font-size:10.5px">bypass to</text><text x="610" y="144" text-anchor="middle" style="fill:var(--ink);font-size:10.5px">dependents</text>
<g style="stroke:var(--muted);stroke-width:1.2;fill:none"><path d="M76,126 H86 V67 H94" marker-end="url(#arrHW)"/><path d="M86,126 V187 H94" marker-end="url(#arrHW)"/><path d="M156,67 H164" marker-end="url(#arrHW)"/><path d="M310,67 H318" marker-end="url(#arrHW)"/><path d="M392,67 H400" marker-end="url(#arrHW)"/><path d="M468,67 H486" marker-end="url(#arrHW)"/><path d="M156,187 H164" marker-end="url(#arrHW)"/><path d="M310,187 H318" marker-end="url(#arrHW)"/><path d="M392,187 H400" marker-end="url(#arrHW)"/><path d="M468,187 H486" marker-end="url(#arrHW)"/><path d="M518,132 H550" marker-end="url(#arrHW)"/><path d="M126,84 V124 H238 V168" style="stroke-dasharray:4 3" marker-end="url(#arrHW)"/></g>
<text x="140" y="119" style="fill:var(--muted);font-size:10px">page bits 45–12</text>
<text x="126" y="222" text-anchor="middle" style="fill:var(--accent-red);font-size:10px;font-weight:600">wire ∝ N</text>
<text x="238" y="222" text-anchor="middle" style="fill:var(--muted);font-size:10px;font-weight:600">depth fixed, count = N × ports</text>
<text x="356" y="222" text-anchor="middle" style="fill:var(--accent-red);font-size:10px;font-weight:600">≈ log₂ N levels</text>
<text x="435" y="222" text-anchor="middle" style="fill:var(--accent-red);font-size:10px;font-weight:600">bitlines ∝ N</text>
<text x="20" y="252" style="fill:var(--muted);font-size:11px">Red: delay grows with the number of SQ entries N. The compare's depth doesn't, only how many there are.</text>
<text x="20" y="268" style="fill:var(--muted);font-size:11px">Nothing on the L1 path grows with N, so past some size the SQ path sets the load's latency.</text>
<text x="20" y="284" style="fill:var(--muted);font-size:11px">The LQ probe has no load waiting on it, so it isn't on this path at all.</text>
</svg></div>
<p><strong>What a larger SQ costs.</strong> Three of the five steps slow down as the queue grows. The broadcast wires and the data bitlines get longer with N (delay grows linearly once repeaters are added, quadratically without them), and the encoder adds a level each time N doubles. Going from 64 to 128 entries adds one encoder level and doubles the wire both the broadcast and the data read have to drive. Nothing on the L1 path grows with it, so a large enough SQ no longer fits in the L1's cycles, and the designer has three ways out:</p>
<ul>
<li><strong>Add a cycle to every load.</strong> This is the simplest, and the most expensive. Load-to-use latency sits on pointer chasing and most dependence chains, so the cycle costs IPC on every program, not only on those that forward.</li>
<li><strong>Make forwarding slower than an L1 hit.</strong> The scheduler wakes the load's dependents for the L1 latency, assuming no forward. A load that does forward delivers later, and its early-woken dependents are cancelled and replayed. Only loads that forward pay.</li>
<li><strong>Keep the queue small, or search less of it.</strong> See the techniques below.</li>
</ul>
<p>Energy grows faster than delay. Every load drives every entry's comparator whether or not anything matches, so search energy grows with N times the number of load ports, and most searches find nothing. On this page's core, three load ports searching 114 entries make 342 address compares in a cycle when all three ports issue a load.</p>
<p><strong>Why the LQ can be bigger.</strong> Golden Cove has 192 LQ entries but only 114 SQ entries. Loads are about twice as common as stores, so the LQ needs more entries to fill the same window, but the LQ's search is also easier to make big:</p>
<ul>
<li>It is searched by stores when their addresses resolve, and by snoops. No load is waiting on either search. The result only has to arrive before the load retires, so the probe can take several cycles or be pipelined.</li>
<li>It produces only a flush signal and an LQ index, with no data to read out, shift, and merge.</li>
<li>It runs once per store, and stores are the rarer operation, so fewer searches run per cycle.</li>
</ul>
<p><strong>Making big queues fast.</strong> Research and products attack the search from several sides:</p>
<ul>
<li><strong>Filter before searching.</strong> A small table of counters indexed by an address hash, a counting Bloom filter, says whether any in-flight store could touch this address, and most loads skip the full search. Sethumadhavan and colleagues showed such filters remove most LQ and SQ searches (MICRO 2003). See <a href="#/sq-filters">Store Queue Membership Filters</a>.</li>
<li><strong>Two-level store queue.</strong> A small, fast first-level SQ holds the youngest stores, which are the ones loads usually forward from. Older stores move to a larger, slower second level behind a filter. Akkary, Rajwar, and Srinivasan proposed it for windows of thousands of instructions (MICRO 2003).</li>
<li><strong>Predict instead of search.</strong> The memory dependence predictor already knows which store a load usually depends on. Store queue index prediction reads just that one entry, like a RAM (Sha, Martin, and Roth, MICRO 2005). NoSQ drops the forwarding search altogether and checks loads by re-executing them before commit (Sha, Martin, and Roth, MICRO 2006).</li>
<li><strong>Drop the LQ's CAM.</strong> Value-based replay re-executes loads in order before they retire and compares the values, instead of having stores search the LQ (Cain and Lipasti, ISCA 2004). The re-execution costs L1 bandwidth, so it is filtered down to loads that could have been wrong.</li>
</ul>`,
  practice: {
    guided: [
      {
        q: `<p>A 16-entry SQ picks the forwarding store with two encoders, as on this page. Which entry does each of two loads forward from, and how many gate levels does the select path take at 16 entries and at 64?</p><p>Given:</p><ul><li>SQ entries 0 to 15, used as a circular buffer, with the head (oldest store) at SQ 11</li><li>Two loads allocated back to back, so both recorded SQ 4 as their mark: the older stores are SQ 11 to 15 and then SQ 0 to 3, oldest to youngest</li><li>Entries that pass all the checks (age, address, and bytes):<ul><li>Load A: SQ 1 and SQ 14</li><li>Load B: SQ 12 and SQ 14</li></ul></li><li>Both encoders let the highest index win, and encoder 1 sees only the matches below the mark</li><li>Gate levels: count each 2-input gate as 1 level, inverters as free, and the final 2:1 mux as 1 level. Each encoder's OR of the inputs above i (higher index wins) is a tree of 2-input ORs, and its grant is \\(g_i = r_i \\land \\lnot S_{i+1}\\), where \\(S_{i+1}\\) is the OR of every input above i</li><li>The below-mark mask is decoded from the mark when the load is allocated, so it is ready early, but ANDing it with the match bits is 1 level</li><li>The select path ends at the one-hot grant that drives the data row, not at a binary index</li></ul>`,
        a: `<ol class="steps"><li><strong>The mask.</strong> The mark is SQ 4, so the mask has 1s at SQ 0 to 3. The queue has wrapped, so those four entries are the youngest of the older stores.</li><li><strong>Load A.</strong> ANDed with the mask, only SQ 1 is left. Encoder 1 is valid and its winner is SQ 1, so <strong>SQ 1 forwards</strong>. That is right: in age order SQ 14 comes before SQ 0, so SQ 1 is younger.</li><li><strong>Load B.</strong> Neither SQ 12 nor SQ 14 is below the mark, so encoder 1 finds nothing and the mux takes encoder 2, which sees both and picks the higher index, so <strong>SQ 14 forwards</strong>. Both matches are in the wrapped part, where a higher index is younger, so that is right too.</li><li><strong>Prefix levels.</strong> Each level doubles the span a prefix covers, so N entries need log<sub>2</sub> N levels.<div class="math chain"><span>\\(\\displaystyle L_{16} = \\log_2 16\\ \\text{levels} \\)</span><span>\\(\\displaystyle = 4\\ \\text{levels} \\)</span></div><div class="math chain"><span>\\(\\displaystyle L_{64} = \\log_2 64\\ \\text{levels} \\)</span><span>\\(\\displaystyle = 6\\ \\text{levels} \\)</span></div></li><li><strong>The whole select path.</strong> The longest path runs through encoder 1: the mask AND, the OR tree, the grant AND, and then the mux. Encoder 2 skips the mask, so it finishes a level earlier and isn't critical. Encoder 1's valid bit is the OR of all its inputs, which the tree produces at its last level, so the mux select is ready a level before the grant it selects.<div class="math chain"><span>\\(\\displaystyle D_{16} = 1\\ \\text{level} + 4\\ \\text{levels} + 1\\ \\text{level} + 1\\ \\text{level} \\)</span><span>\\(\\displaystyle = \\mathbf{7}\\ \\textbf{levels} \\)</span></div><div class="math chain"><span>\\(\\displaystyle D_{64} = 1\\ \\text{level} + 6\\ \\text{levels} + 1\\ \\text{level} + 1\\ \\text{level} \\)</span><span>\\(\\displaystyle = \\mathbf{9}\\ \\textbf{levels} \\)</span></div>Four times the entries cost two more levels. The longer wires to drive 64 entries cost more than that, which is why the encoder is rarely what limits SQ size.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A team can grow a core's SQ from 64 to 96 entries, but then the forwarding search no longer fits in the 4-cycle L1 hit. Should they add a cycle to every load, make forwarding slower instead, or keep the 64-entry SQ?</p><p>Given:</p><ul><li>Workload: store-heavy, with a CPI of 0.5 cycles/instruction on the 64-entry design</li><li>SQ-full dispatch stalls: 60 cycles/kilo-instruction at 64 entries, 12 cycles/kilo-instruction at 96 entries</li><li>Loads: 300 loads/kilo-instruction, of which 5% forward from the SQ</li><li>Forwarding takes 4 cycles today, the same as an L1 hit</li><li>Option A: every load's latency, forwarded or not, goes from 4 cycles to 5</li><li>Option B: L1 hits stay at 4 cycles, forwarded loads take 7 cycles, and each forwarded load also cancels and replays its dependents, costing 1 more exposed cycle</li><li>Exposure: 25% of any latency added to an ordinary load shows up as execution time, and the rest overlaps with other work. Forwarded loads sit on dependence chains more often, so 50% of their added latency shows up</li><li>These effects add, and nothing else changes</li><li>Also say what changes for a workload with no SQ-full stalls</li></ul>`,
        a: `<ol class="steps"><li><strong>What the bigger SQ saves.</strong> The difference in SQ-full stalls, per 1000 instructions:<div class="math chain"><span>\\(\\displaystyle S = \\frac{60\\ \\text{cycles} - 12\\ \\text{cycles}}{1000\\ \\text{instructions}} \\)</span><span>\\(\\displaystyle = \\frac{48\\ \\text{cycles}}{1000\\ \\text{instructions}} \\)</span></div></li><li><strong>Option A's cost.</strong> Every load gets 1 more cycle. A quarter of it is exposed on the 95% of loads that don't forward, and half on the 5% that do.<div class="math chain"><span>\\(\\displaystyle C_A = \\frac{300\\ \\text{loads}}{1000\\ \\text{instructions}} \\times \\frac{(5 - 4)\\ \\text{cycles}}{1\\ \\text{load}} \\times (0.95 \\times 0.25 + 0.05 \\times 0.5) \\)</span><span>\\(\\displaystyle = \\frac{78.75\\ \\text{cycles}}{1000\\ \\text{instructions}} \\)</span></div>That is more than the 48 cycles saved, so option A loses 30.75 cycles per 1000 instructions, a net slowdown.</li><li><strong>Option B's cost.</strong> Only forwarded loads pay: 3 cycles of extra latency, half exposed, plus the replay cycle.<div class="math chain"><span>\\(\\displaystyle C_B = \\frac{300\\ \\text{loads}}{1000\\ \\text{instructions}} \\times 0.05 \\times \\left(\\frac{(7 - 4)\\ \\text{cycles}}{1\\ \\text{load}} \\times 0.5 + \\frac{1\\ \\text{cycle}}{1\\ \\text{load}}\\right) \\)</span><span>\\(\\displaystyle = \\frac{15\\ \\text{loads}}{1000\\ \\text{instructions}} \\times \\frac{2.5\\ \\text{cycles}}{1\\ \\text{load}} \\)</span><span>\\(\\displaystyle = \\frac{37.5\\ \\text{cycles}}{1000\\ \\text{instructions}} \\)</span></div></li><li><strong>Option B's net gain.</strong> Compare it with the 500 cycles that 1000 instructions take at a CPI of 0.5.<div class="math chain"><span>\\(\\displaystyle G_B = \\frac{48\\ \\text{cycles} - 37.5\\ \\text{cycles}}{1000\\ \\text{instructions} \\times \\frac{0.5\\ \\text{cycles}}{1\\ \\text{instruction}}} \\)</span><span>\\(\\displaystyle = \\frac{10.5\\ \\text{cycles}}{500\\ \\text{cycles}} \\)</span><span>\\(\\displaystyle = \\mathbf{2.1\\%}\\ \\textbf{faster} \\)</span></div></li><li><strong>A workload with no SQ-full stalls.</strong> The bigger SQ saves nothing there, and option B still costs every forwarded load.<div class="math chain"><span>\\(\\displaystyle L_B = \\frac{37.5\\ \\text{cycles}}{1000\\ \\text{instructions} \\times \\frac{0.5\\ \\text{cycles}}{1\\ \\text{instruction}}} \\)</span><span>\\(\\displaystyle = \\mathbf{7.5\\%}\\ \\textbf{slower} \\)</span></div>This assumes the same CPI and forwarding rate as the store-heavy workload, which a real suite would measure for each program.</li><li><strong>Recommendation.</strong> Option A is out: it charges every load to help the few programs that fill the SQ. Option B helps the store-heavy workload by about 2% but costs about 7.5% on code that forwards and doesn't fill the SQ, so the choice depends on the suite's mix. Unless most of the suite is SQ-bound, keep 64 entries, or get the capacity another way, such as a two-level SQ that keeps the first level small enough to fit in 4 cycles.</li></ol>`
      }
    ]
  }
},

{
  id: "sq-filters",
  region: "mord",
  title: "Store Queue Membership Filters",
  sections: [
    { id: "why", label: "Why Filter the Search" },
    { id: "how", label: "How a Counting Bloom Filter Works" },
    { id: "corners", label: "Corner Cases" },
    { id: "timing", label: "Timing" },
    { id: "size", label: "Size and Accuracy" },
    { id: "cost", label: "Power and Area Cost" },
    { id: "workloads", label: "Which Workloads Benefit" },
    { id: "related", label: "Related Uses and Other Notes" }
  ],
  body: `
<p>A membership filter is a small table that answers one question before a load searches the store queue: could any store in the SQ touch this address? When the answer is no, the load skips the search. This page expands the "filter before searching" idea from <a href="#/lsq-search/search-hardware">Search Hardware and Load-to-Use Latency</a> and uses the same Golden Cove-sized core: 114 SQ entries, 3 load ports, and 2 stores per cycle written to L1. The main source is Sethumadhavan, Desikan, Burger, Moore, and Keckler (MICRO 2003), who used Bloom filters to avoid up to 98% of associative LSQ searches. The counting Bloom filter itself comes from Fan, Cao, Almeida, and Broder's summary cache work (IEEE/ACM Transactions on Networking, 2000).</p>
<h3 id="sec-why">Why Filter the Search</h3>
<p>The <a href="#/lsq-search/search-hardware">search hardware</a> section showed that every load drives every SQ entry's comparator. Three load ports searching 114 entries make 342 address compares in a cycle, and most of those searches find nothing, because most loads don't read an address that an in-flight store is writing. The CAM still spends the energy, and its broadcast wires, encoder, and data bitlines still set how big the SQ can get before it no longer fits in the L1's cycles.</p>
<p>A filter turns the common case into a RAM read. It can be wrong in only one direction:</p>
<ul>
<li><strong>False positive:</strong> the filter says a store might match, but none does. The load does the full search it would have done without a filter, so the only loss is the energy and latency the filter failed to save.</li>
<li><strong>False negative:</strong> the filter says no store matches, but one does. The load skips the search, reads stale data from L1, and nothing downstream may catch it. A correct filter never does this.</li>
</ul>
<p>Every design rule on this page follows from that asymmetry: when in doubt, a counter must err high.</p>
<h3 id="sec-how">How a Counting Bloom Filter Works</h3>
<p>The filter is an array of M small counters. A hash of the store's address picks one counter, and the counter holds how many SQ stores with known addresses currently hash there.</p>
<ul>
<li><strong>Insert.</strong> When a store-address µop executes and writes its SQ entry, it increments the counter its address hashes to.</li>
<li><strong>Remove.</strong> When the store writes L1 and frees its SQ entry, it decrements the same counter. A store that has retired but hasn't drained still forwards to younger loads, so it stays counted until it leaves the SQ.</li>
<li><strong>Look up.</strong> A load hashes its address the same way and reads the counter. Zero means no store with a known address can match, so the load skips the CAM. Anything else means it searches.</li>
</ul>
<p><strong>Why counters and not bits.</strong> A plain Bloom filter sets a bit on insert, but it can't clear that bit on remove, because another store may have hashed to the same bit. Without a way to remove, the bits only fill up, and within a few thousand stores every bit is set. A counter can go back down to exactly zero when the last store that hashed there drains.</p>
<p><strong>One hash, not k.</strong> A textbook Bloom filter uses k hash functions per element to cut false positives. Here each hash is another counter read on every load and another counter update on every store, so the port count multiplies by k. LSQ filters use a single hash, usually just address bits.</p>
<p><strong>Granularity.</strong> The hash ignores the low address bits, so the counter covers an aligned granule: 8 bytes for word granularity, 64 bytes for line granularity. Coarser granules let a counter cover stores that don't overlap the load at all, which shows up as false positives. Finer granules cost more counters for the same accuracy.</p>
<div class="tbl"><svg viewBox="0 0 680 330" role="img" aria-label="A store queue membership filter beside the SQ search. A load's address from the load AGU indexes a counter array by bits 11 to 3. If the counter is 0, the load skips the SQ search and uses the L1 value. If it is 1 or more, the load does the full SQ search with its CAM, encoder, and forwarding. On the store side, a store-address micro-op adds 1 to its counter when its address resolves, a store that drains to L1 subtracts 1, and squashed stores subtract 1 each, or the array is flash cleared when the SQ empties. A counter never reads 0 while a matching store with a known address is in the SQ, so skipping is safe. A nonzero counter from another store with the same index is a false positive, which costs only the search the load would have done anyway." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<defs><marker id="arrMF" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker></defs>
<text x="20" y="20" style="fill:var(--muted);font-size:12px;font-weight:600">The filter answers "could any known store match?" before the load searches</text>
<rect x="20" y="50" width="90" height="36" rx="3" style="fill:var(--surface);stroke:var(--muted);stroke-width:1.5"/><text x="65" y="72" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">load AGU</text>
<rect x="170" y="40" width="150" height="120" rx="3" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.5"/>
<text x="245" y="60" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">counter array</text>
<text x="245" y="75" text-anchor="middle" style="fill:var(--muted);font-size:10px">512 counters × 7 bits</text>
<g style="font-size:10px">
<rect x="181" y="92" width="16" height="20" style="fill:var(--surface);stroke:var(--muted)"/><text x="189" y="106" text-anchor="middle" style="fill:var(--ink)">0</text>
<rect x="197" y="92" width="16" height="20" style="fill:var(--surface);stroke:var(--muted)"/><text x="205" y="106" text-anchor="middle" style="fill:var(--ink)">2</text>
<rect x="213" y="92" width="16" height="20" style="fill:var(--surface);stroke:var(--muted)"/><text x="221" y="106" text-anchor="middle" style="fill:var(--ink)">0</text>
<rect x="229" y="92" width="16" height="20" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="237" y="106" text-anchor="middle" style="fill:var(--ink);font-weight:600">0</text>
<rect x="245" y="92" width="16" height="20" style="fill:var(--surface);stroke:var(--muted)"/><text x="253" y="106" text-anchor="middle" style="fill:var(--ink)">1</text>
<rect x="261" y="92" width="16" height="20" style="fill:var(--surface);stroke:var(--muted)"/><text x="269" y="106" text-anchor="middle" style="fill:var(--ink)">0</text>
<rect x="277" y="92" width="16" height="20" style="fill:var(--surface);stroke:var(--muted)"/><text x="285" y="106" text-anchor="middle" style="fill:var(--ink)">3</text>
<rect x="293" y="92" width="16" height="20" style="fill:var(--surface);stroke:var(--muted)"/><text x="301" y="106" text-anchor="middle" style="fill:var(--ink)">0</text>
</g>
<text x="245" y="132" text-anchor="middle" style="fill:var(--muted);font-size:10px">count of known-address stores</text>
<text x="245" y="145" text-anchor="middle" style="fill:var(--muted);font-size:10px">per index</text>
<rect x="380" y="50" width="110" height="36" rx="3" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.5"/><text x="435" y="72" text-anchor="middle" style="fill:var(--ink);font-size:11px;font-weight:600">counter = 0?</text>
<rect x="540" y="40" width="130" height="44" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/><text x="605" y="58" text-anchor="middle" style="fill:var(--ink);font-size:10.5px;font-weight:600">skip the SQ search</text><text x="605" y="74" text-anchor="middle" style="fill:var(--ink);font-size:10.5px">L1 value only</text>
<rect x="540" y="110" width="130" height="44" rx="3" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5"/><text x="605" y="128" text-anchor="middle" style="fill:var(--ink);font-size:10.5px;font-weight:600">full SQ search</text><text x="605" y="144" text-anchor="middle" style="fill:var(--ink);font-size:10.5px">CAM, encoder, forward</text>
<rect x="20" y="186" width="120" height="36" rx="3" style="fill:var(--surface);stroke:var(--muted);stroke-width:1.5"/><text x="80" y="208" text-anchor="middle" style="fill:var(--ink);font-size:10.5px">store-address µop</text>
<rect x="20" y="236" width="120" height="36" rx="3" style="fill:var(--surface);stroke:var(--muted);stroke-width:1.5"/><text x="80" y="258" text-anchor="middle" style="fill:var(--ink);font-size:10.5px">store drains to L1</text>
<rect x="380" y="200" width="150" height="36" rx="3" style="fill:var(--surface);stroke:var(--muted);stroke-width:1.5"/><text x="455" y="222" text-anchor="middle" style="fill:var(--ink);font-size:10.5px">younger stores squashed</text>
<g style="stroke:var(--muted);stroke-width:1.2;fill:none">
<path d="M110,68 H168" marker-end="url(#arrMF)"/>
<path d="M320,68 H378" marker-end="url(#arrMF)"/>
<path d="M490,62 H538" marker-end="url(#arrMF)"/>
<path d="M435,86 V132 H538" marker-end="url(#arrMF)"/>
<path d="M140,204 H205 V162" marker-end="url(#arrMF)"/>
<path d="M140,254 H260 V162" marker-end="url(#arrMF)"/>
<path d="M380,218 H300 V162" marker-end="url(#arrMF)"/>
</g>
<text x="114" y="60" style="fill:var(--muted);font-size:10px">bits 11–3</text>
<text x="508" y="56" style="fill:var(--trace);font-size:10px;font-weight:600">0</text>
<text x="442" y="124" style="fill:var(--pad);font-size:10px;font-weight:600">≥ 1</text>
<text x="150" y="198" style="fill:var(--ink);font-size:10px;font-weight:600">+1</text>
<text x="150" y="248" style="fill:var(--ink);font-size:10px;font-weight:600">−1</text>
<text x="330" y="212" style="fill:var(--ink);font-size:10px;font-weight:600">−1 each</text>
<text x="380" y="254" style="fill:var(--muted);font-size:10px">or flash clear when the SQ empties</text>
<text x="20" y="298" style="fill:var(--muted);font-size:11px">A counter never reads 0 while a matching store with a known address is in the SQ, so skipping is safe.</text>
<text x="20" y="314" style="fill:var(--muted);font-size:11px">A nonzero count from a store with the same index is a false positive: the load just searches as usual.</text>
</svg></div>
<h3 id="sec-corners">Corner Cases</h3>
<p>Each of these is a way to get a false negative, or to lose the filter's benefit, and each has a standard answer.</p>
<ul>
<li><strong>The filter has no age.</strong> A counter also counts stores younger than the load, which can't forward to it. Those count as false positives. That is safe, and it is the price of keeping the filter a plain RAM instead of a CAM.</li>
<li><strong>Stores with unknown addresses.</strong> A store whose address µop hasn't executed isn't in the filter, so a zero counter says nothing about it. That case belongs to the <a href="#/mdp">memory dependence predictor</a>, exactly as it would without a filter. When that store's address resolves, its LQ probe catches any younger load that already read the wrong value.</li>
<li><strong>Same-cycle insert and lookup.</strong> If a store's address resolves in the cycle a younger load reads the counter, the load may see the old zero. This is the same as the store resolving just after the load, so the store's LQ probe catches it and the core flushes. It is a performance hit, not a correctness bug, but it is cheap to avoid by comparing the few counter indices being written that cycle with the ones being read.</li>
<li><strong>Accesses that cross a granule.</strong> An unaligned load that spans two granules has to read both counters and search if either is nonzero. Stores that span two granules increment and later decrement both.</li>
<li><strong>Squashed stores.</strong> A branch mispredict or memory-order flush removes younger stores from the SQ without draining them. If their counts stay, the filter errs high, which is safe but slowly fills it with stale counts. Three ways out:
<ul>
<li>Walk the squashed SQ entries and decrement each one's counter. This is exact, but it takes several cycles and the counter write ports.</li>
<li>Leave the stale counts and flash-clear the whole array whenever the SQ becomes empty. This is cheap but relies on the SQ draining fully now and then.</li>
<li>Keep a second copy of the array that only drained stores update, and copy it over on a flush. This is fast but doubles the storage.</li>
</ul></li>
<li><strong>Counter overflow.</strong> If every SQ store hashes to one counter, it has to count to N. A loop that stores to the same stack slot or the same accumulator on every iteration does exactly that. A counter that wraps back to zero is a false negative. The safe choices are ⌈log<sub>2</sub>(N+1)⌉ bits, 7 bits for 114 entries, or a narrower counter that sticks once it saturates and is reset only by a flash clear. Fan and colleagues found 4-bit counters almost never overflow, but they assumed elements hash at random, and SQ stores repeat the same address far more often than that.</li>
<li><strong>The wrong decrement point.</strong> Decrementing at retire instead of drain is the classic filter bug. A retired store that is still in the SQ must forward, but its counter already reads zero, so a younger load reads stale L1 data. The store's LQ probe ran long ago, so nothing catches it.</li>
</ul>
<h3 id="sec-timing">Timing</h3>
<p>The lookup is one read of a small RAM, so it fits in a cycle easily. What matters is when its index is ready. On a core with 4 KiB pages, bits 11–0 are the same in the virtual and physical address, so a filter indexed only by those bits can start as soon as the AGU produces the address, in parallel with the DTLB, the same trick a VIPT L1 uses. On this region's core, bits 11–3 give 512 counters at 8-byte granularity.</p>
<p>Indexing by page offset has a known downside: two addresses exactly a multiple of 4 KiB apart always share a counter. Intel's optimization manual documents a related effect it calls <strong>4K aliasing</strong>: a load is delayed when an older store matches it in bits 11–0, even though the full addresses differ. That tells us Intel's first SQ check looks only at the untranslated bits, for the same timing reason.</p>
<p>A designer can use the filter's answer in two ways:</p>
<ul>
<li><strong>Energy only.</strong> The filter runs a cycle ahead of the CAM, or alongside it, and gates the CAM's broadcast and match lines off when the counter is zero. Load latency doesn't change. Most of the search energy goes away.</li>
<li><strong>Latency too.</strong> This is the "make forwarding slower" option from the <a href="#/lsq-search/search-hardware">search hardware</a> section, with a guard. Loads the filter clears go on the L1-latency path, and loads it doesn't clear take a slower search. The SQ can then grow past what fits in the L1's cycles without every load paying. The cost is a scheduler that must know which latency to expect before the filter answers, so it wakes dependents for the fast case and replays them when the filter says search.</li>
</ul>
<h3 id="sec-size">Size and Accuracy</h3>
<p>For a load that no in-flight store touches, the filter is wrong when some other store happened to land on the load's counter. Assume S stores in the filter, each to a distinct granule, and a hash that spreads them uniformly over M counters. Each store misses the load's counter with probability 1 − 1/M, so the false-positive rate is</p>
<div class="math chain"><span>\\(\\displaystyle P_{\\text{FP}} = 1 - \\left(1 - \\frac{1}{M}\\right)^{S} \\)</span><span>\\(\\displaystyle \\approx 1 - e^{-S/M} \\)</span></div>
<p>It depends on the stores per counter, S/M. With a full 114-entry SQ:</p>
<div class="tbl"><table>
<tr><th>Counters M</th><th>Stores per counter S/M</th><th>False-positive rate</th><th>Storage at 7 bits/counter</th></tr>
<tr><td>512</td><td>0.22</td><td>20.0%</td><td>3,584 bits</td></tr>
<tr><td>1,024</td><td>0.11</td><td>10.5%</td><td>7,168 bits</td></tr>
<tr><td>2,048</td><td>0.056</td><td>5.4%</td><td>14,336 bits</td></tr>
<tr><td>4,096</td><td>0.028</td><td>2.7%</td><td>28,672 bits</td></tr>
</table></div>
<p>Each halving of the false-positive rate doubles the array, so sizes from a few hundred to a couple of thousand counters are the practical range. The table is a pessimistic bound in two ways and an optimistic one in a third:</p>
<ul>
<li>The SQ is rarely full of stores with known addresses.</li>
<li>Real stores cluster, on the same stack slots and the same lines, so there are fewer distinct granules than stores.</li>
<li>Real addresses aren't uniform. With page-offset indexing, strided and 4 KiB-aligned accesses all land on the same few counters, and the rate can be far worse than the table.</li>
</ul>
<p>The filter's size should grow in step with the SQ. Doubling the SQ at a fixed M doubles S/M and nearly doubles the false-positive rate.</p>
<h3 id="sec-cost">Power and Area Cost</h3>
<p><strong>Area.</strong> A 512-counter, 7-bit filter is 3,584 bits. The SQ's address CAM on this core is 114 entries × 43 address bits (9 offset bits and 34 page bits), 4,902 bits, and each of those bits has a comparator for each of 3 load ports. So the filter stores a similar number of bits, but in plain RAM cells with no per-port compare logic and no match lines. The real area cost is ports, not bits:</p>
<ul>
<li>3 reads per cycle, one per load port.</li>
<li>Up to 2 increments per cycle from store-address µops.</li>
<li>Up to 2 decrements per cycle from stores draining to L1.</li>
</ul>
<p>Each increment and decrement is a read-modify-write. A 7-port array is expensive, so designs bank the counters by index bits and accept rare conflicts, or keep one copy per load port so each copy needs only 1 read port beside the write ports.</p>
<p><strong>Energy.</strong> A filtered load costs one counter read instead of a CAM search across every entry. A store costs two counter updates, one when its address resolves and one when it drains. With a search energy of E<sub>search</sub> per load, a lookup energy of E<sub>read</sub>, an update energy of E<sub>update</sub>, and a share f of loads filtered, the filter saves energy when</p>
<div class="math chain"><span>\\(\\displaystyle f \\cdot L \\cdot E_{\\text{search}} > L \\cdot E_{\\text{read}} + 2 \\cdot S \\cdot E_{\\text{update}} \\)</span></div>
<p>where L and S are loads and stores per instruction. Because a CAM search over 114 entries costs far more than a single counter access, f only needs to be a modest share for the filter to win. Sethumadhavan and colleagues reported avoiding up to 98% of LSQ searches. Loads that still search pay the filter's read on top of the search, so a program the filter can't help costs slightly more energy than with no filter at all.</p>
<h3 id="sec-workloads">Which Workloads Benefit</h3>
<p>The filter wins when loads mostly read addresses that no in-flight store is writing, and loses when stores and loads crowd the same granules.</p>
<ul>
<li><strong>Works well:</strong>
<ul>
<li>Read-heavy code with few stores in flight, such as pointer chasing, hash and table lookups, and search.</li>
<li>Streaming kernels that read several arrays and write one, where the written array is a different stream from the ones being read.</li>
<li>Code whose stores are spread across many lines, so each counter stays near zero.</li>
</ul></li>
<li><strong>Works badly:</strong>
<ul>
<li>Stack-heavy code: spills and reloads, pushes and pops around calls, and small functions that store arguments and read them back. Many loads really do forward, so the filter correctly says search, and the stores nearby push up false positives on top.</li>
<li>Copy loops whose source and destination are a multiple of 4 KiB apart, with page-offset indexing. Every load shares a counter with a recent store even though nothing overlaps.</li>
<li>Read-modify-write loops such as histograms and in-place updates, where many loads read a line a store just wrote.</li>
</ul></li>
<li><strong>Window size.</strong> A bigger window holds more stores with known addresses, which raises S/M. The cores that most need a filter, because their SQ is too big to search quickly, are also the ones where the filter fills up fastest. So the filter has to grow along with the SQ.</li>
</ul>
<h3 id="sec-related">Related Uses and Other Notes</h3>
<ul>
<li><strong>Filtering the LQ.</strong> The same structure, counting loads that have executed, lets a store skip its LQ probe when no executed younger load could overlap it. Snoop and invalidation probes of the LQ can be filtered the same way. Sethumadhavan and colleagues filtered both queues. Since the LQ probe isn't on any load's latency path, there the gain is energy alone.</li>
<li><strong>Two-level store queues.</strong> In the hierarchical SQ of Akkary, Rajwar, and Srinivasan (MICRO 2003), a membership test of this kind decides whether a load also has to search the large, slow second level.</li>
<li><strong>Re-execution filtering.</strong> Roth's store vulnerability window (ISCA 2005) uses a small address-indexed table of store sequence numbers, a close cousin of this filter, to decide which loads must re-execute before commit.</li>
<li><strong>A filter is not a predictor.</strong> A store-load pair predictor, such as the one Park, Ooi, and Vijaykumar used to cut SQ searches (MICRO 2003), guesses from PC history and needs a recovery path when it guesses wrong. A filter is conservative by construction, so it needs none, but it can never skip a search that a matching store makes necessary.</li>
<li><strong>Products.</strong> Vendors don't publish whether their cores use SQ filters or how big they are. Intel's documented 4K aliasing shows that its first SQ check uses only untranslated bits, but not what structure does it.</li>
<li><strong>Modeling it.</strong> In a performance model, count for each load whether the filter cleared it, whether a store actually matched, and whether a false positive came from page-offset aliasing or from hashing. Report the share of searches avoided and the false-positive rate per benchmark, check that no false negatives ever happen (an assertion against the full search, which the model can afford), and feed the counts into the energy model as CAM searches avoided and counter reads and writes added.</li>
</ul>`,
  practice: {
    guided: [
      {
        q: `<p>Size a store queue filter for a core whose SQ is the size of AMD Zen 4's. How many counters, and how many bits of storage, does it need to keep false positives at or below 5%?</p><p>Given:</p><ul><li>SQ: 64 entries</li><li>Worst case to design for: all 64 entries hold stores with known addresses, each to a distinct granule</li><li>One hash function that spreads granules uniformly over the counters</li><li>The number of counters M must be a power of two</li><li>Counters must never overflow, even if all 64 stores hash to one counter</li><li>Target: a false-positive rate of at most 5% for a load that no in-flight store touches</li></ul>`,
        a: `<ol class="steps"><li><strong>The false-positive rate.</strong> Each of the 64 stores misses the load's counter with probability 1 − 1/M, so the load sees a zero only if all of them miss.<div class="math chain"><span>\\(\\displaystyle P_{\\text{FP}}(M) = 1 - \\left(1 - \\frac{1}{M}\\right)^{64\\ \\text{stores}} \\)</span></div></li><li><strong>Try 1,024 counters.</strong><div class="math chain"><span>\\(\\displaystyle P_{\\text{FP}}(1024) = 1 - \\left(\\frac{1023}{1024}\\right)^{64} \\)</span><span>\\(\\displaystyle \\approx 1 - 0.9394 \\)</span><span>\\(\\displaystyle \\approx 6.06\\% \\)</span></div>That is above the 5% target.</li><li><strong>Try 2,048 counters.</strong><div class="math chain"><span>\\(\\displaystyle P_{\\text{FP}}(2048) = 1 - \\left(\\frac{2047}{2048}\\right)^{64} \\)</span><span>\\(\\displaystyle \\approx 1 - 0.9692 \\)</span><span>\\(\\displaystyle \\approx 3.08\\% \\)</span></div>That meets the target, so the filter needs <strong>2,048 counters</strong>.</li><li><strong>Counter width.</strong> A counter must hold every value from 0 to 64 stores, which is 65 values.<div class="math chain"><span>\\(\\displaystyle w = \\lceil \\log_2 65 \\rceil\\ \\text{bits} \\)</span><span>\\(\\displaystyle = 7\\ \\text{bits} \\)</span></div></li><li><strong>Storage.</strong><div class="math chain"><span>\\(\\displaystyle B = 2048\\ \\text{counters} \\times \\frac{7\\ \\text{bits}}{1\\ \\text{counter}} \\)</span><span>\\(\\displaystyle = \\mathbf{14{,}336}\\ \\textbf{bits} \\)</span></div>That is 1,792 bytes. Going from about 6% to about 3% costs twice the storage, because the rate depends on stores per counter. Because real stores cluster on fewer granules than this worst case assumes, a 1,024-counter filter would likely meet the target in practice.</li></ol>`
      },
      {
        q: `<p>A filter is added in energy-only mode. How much SQ search energy does it save per 1000 instructions, and what share of loads must it clear just to break even?</p><p>Given:</p><ul><li>Loads: 280 loads/1000 instructions</li><li>Stores: 110 stores/1000 instructions</li><li>Without the filter, every load does a full SQ search costing 4.0 pJ</li><li>With the filter, every load reads its counter for 0.3 pJ, and only loads with a nonzero counter also do the full search</li><li>Each store updates the filter twice, once when its address resolves and once when it drains, at 0.3 pJ per update</li><li>The filter clears 85% of loads on this workload</li><li>The energy figures come from a circuit model of the SQ and filter, and nothing else changes</li></ul>`,
        a: `<ol class="steps"><li><strong>Baseline search energy.</strong> Every load searches.<div class="math chain"><span>\\(\\displaystyle E_0 = \\frac{280\\ \\text{loads}}{1000\\ \\text{instructions}} \\times \\frac{4.0\\ \\text{pJ}}{1\\ \\text{load}} \\)</span><span>\\(\\displaystyle = \\frac{1120\\ \\text{pJ}}{1000\\ \\text{instructions}} \\)</span></div></li><li><strong>Searches avoided.</strong> The 85% of loads the filter clears skip their search.<div class="math chain"><span>\\(\\displaystyle E_{\\text{saved}} = \\frac{280\\ \\text{loads}}{1000\\ \\text{instructions}} \\times 0.85 \\times \\frac{4.0\\ \\text{pJ}}{1\\ \\text{load}} \\)</span><span>\\(\\displaystyle = \\frac{952\\ \\text{pJ}}{1000\\ \\text{instructions}} \\)</span></div></li><li><strong>What the filter costs.</strong> Every load reads it, and every store updates it twice.<div class="math chain"><span>\\(\\displaystyle E_{\\text{read}} = \\frac{280\\ \\text{loads}}{1000\\ \\text{instructions}} \\times \\frac{0.3\\ \\text{pJ}}{1\\ \\text{load}} \\)</span><span>\\(\\displaystyle = \\frac{84\\ \\text{pJ}}{1000\\ \\text{instructions}} \\)</span></div><div class="math chain"><span>\\(\\displaystyle E_{\\text{update}} = \\frac{110\\ \\text{stores}}{1000\\ \\text{instructions}} \\times \\frac{2\\ \\text{updates}}{1\\ \\text{store}} \\times \\frac{0.3\\ \\text{pJ}}{1\\ \\text{update}} \\)</span><span>\\(\\displaystyle = \\frac{66\\ \\text{pJ}}{1000\\ \\text{instructions}} \\)</span></div><div class="math chain"><span>\\(\\displaystyle E_{\\text{filter}} = \\frac{84\\ \\text{pJ} + 66\\ \\text{pJ}}{1000\\ \\text{instructions}} \\)</span><span>\\(\\displaystyle = \\frac{150\\ \\text{pJ}}{1000\\ \\text{instructions}} \\)</span></div></li><li><strong>Net saving.</strong><div class="math chain"><span>\\(\\displaystyle \\Delta E = \\frac{952\\ \\text{pJ} - 150\\ \\text{pJ}}{1000\\ \\text{instructions}} \\)</span><span>\\(\\displaystyle = \\frac{\\mathbf{802}\\ \\textbf{pJ}}{\\textbf{1000 instructions}} \\)</span></div>As a share of the baseline:<div class="math chain"><span>\\(\\displaystyle \\frac{\\Delta E}{E_0} = \\frac{802\\ \\text{pJ}}{1120\\ \\text{pJ}} \\)</span><span>\\(\\displaystyle \\approx \\mathbf{71.6\\%} \\)</span></div></li><li><strong>Break-even.</strong> The filter pays for itself when the searches it avoids cost as much as it does. Its own cost doesn't depend on how many loads it clears.<div class="math chain"><span>\\(\\displaystyle f_{\\text{even}} = \\frac{150\\ \\text{pJ}}{1120\\ \\text{pJ}} \\)</span><span>\\(\\displaystyle = \\frac{15}{112} \\)</span><span>\\(\\displaystyle \\approx \\mathbf{13.4\\%} \\)</span></div>So the filter saves energy unless it clears fewer than about 1 load in 7. A stack-heavy or 4K-aliased workload can drop that low, and then the filter costs energy.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A colleague's filter decrements a store's counter when the store retires, to free counts sooner. It passes every test that has no back-to-back store and load to the same address. What breaks, and why doesn't the LQ probe catch it?</p>`,
        a: `<p>A store that has retired but not yet written L1 is still in the SQ, and it is still the only correct source for a younger load to its bytes. With the retire-time decrement, that store's counter can read zero while it waits to drain.</p><ul><li>A younger load to the same address reads the counter, sees zero, skips the SQ search, and reads L1, which still holds the old value. The load returns stale data.</li><li>The LQ probe can't catch it. The store probed the LQ when its address resolved, long before this load executed, and no store probes the LQ again at retire or drain. As far as the hardware is concerned, the load did nothing wrong.</li><li>The window is short, from retire to drain, which is why tests miss it. Stores that drain slowly, behind an L1 miss or under heavy store traffic, widen the window, as does code that stores and reloads a value right away, such as a spill and reload across a call.</li></ul><p>The fix is to decrement when the SQ entry is freed, which is when the store writes L1. The counts must follow exactly the set of SQ entries that can forward.</p>`
      },
      {
        q: `<p>Your filter has to recover from squashes. Compare walking the squashed SQ entries to decrement their counters with leaving stale counts and flash-clearing the array whenever the SQ empties. Which would you choose for a server core running database code, and which for a core running tight FP loops?</p>`,
        a: `<p>Both are safe, because both only ever leave counts too high. They differ in how long the extra counts last and what they cost.</p><ul><li><strong>Walk and decrement.</strong> The counts stay exact, so false positives never build up. But the walk needs the counter write ports for several cycles after each flush, just as the refetched path starts issuing stores of its own, and the hardware has to read each squashed entry's address to find its counter.</li><li><strong>Flash clear when the SQ empties.</strong> This is nearly free, a reset on the whole array. But stale counts pile up across flushes until the SQ drains completely, and in the meantime more and more loads search for no reason.</li></ul><p>The choice depends on how often the SQ empties and how often flushes happen:</p><ul><li><strong>Database code</strong> mispredicts often and keeps the SQ busy, with many stores and frequent cache misses that hold the SQ full. Stale counts would build up for a long time between empty SQs, so walking pays for itself.</li><li><strong>Tight FP loops</strong> rarely mispredict, so there are few stale counts to begin with. Loop exits and long-latency stalls drain the SQ often enough for flash clears to keep the filter clean, so the cheaper option is enough.</li></ul><p>A hybrid also works: flash-clear on empty, and walk only when a counter of stale entries passes a threshold.</p>`
      },
      {
        q: `<p>A core uses its SQ filter in latency mode. How much faster does it run on two workloads, and should the team hash virtual address bits above the page offset to fix the slow one?</p><p>Given:</p><ul><li>Without the filter, every load takes 5 cycles, because the SQ search doesn't fit in the 4-cycle L1 hit</li><li>With the filter, a load whose counter is 0 takes 4 cycles, and any other load takes 5 cycles</li><li>The filter is indexed by page-offset bits 11–3, so it starts with no wait for the DTLB</li><li>Loads: 350 loads/1000 instructions on both workloads</li><li>Baseline CPI without the filter: 0.8 cycles/instruction on both workloads</li><li>20% of a cycle saved on a load shows up as execution time saved, and the rest overlaps with other work</li><li>Workload A, integer pointer-heavy code: 25% of loads see a nonzero counter</li><li>Workload B, a copy loop whose source and destination are 64 KiB apart: 97% of loads see a nonzero counter, almost all of them false positives</li><li>These effects add, and nothing else changes</li></ul>`,
        a: `<ol class="steps"><li><strong>Workload A's saving.</strong> The 75% of loads the filter clears each save 1 cycle, and a fifth of that shows up.<div class="math chain"><span>\\(\\displaystyle \\Delta C_A = \\frac{350\\ \\text{loads}}{1000\\ \\text{instructions}} \\times (1 - 0.25) \\times \\frac{1\\ \\text{cycle}}{1\\ \\text{load}} \\times 0.2 \\)</span><span>\\(\\displaystyle = \\frac{52.5\\ \\text{cycles}}{1000\\ \\text{instructions}} \\)</span></div></li><li><strong>Workload A's speedup.</strong> 1000 instructions take 800 cycles at a CPI of 0.8.<div class="math chain"><span>\\(\\displaystyle \\frac{\\Delta C_A}{C_0} = \\frac{52.5\\ \\text{cycles}}{1000\\ \\text{instructions} \\times 0.8\\ \\text{cycles/instruction}} \\)</span><span>\\(\\displaystyle = \\frac{52.5\\ \\text{cycles}}{800\\ \\text{cycles}} \\)</span><span>\\(\\displaystyle \\approx \\mathbf{6.6\\%}\\ \\textbf{fewer cycles} \\)</span></div></li><li><strong>Workload B.</strong> 64 KiB is a multiple of 4 KiB, so the source and destination have the same bits 11–0. Every load lands on the counter of the store the loop just made to the matching destination address.<div class="math chain"><span>\\(\\displaystyle \\Delta C_B = \\frac{350\\ \\text{loads}}{1000\\ \\text{instructions}} \\times (1 - 0.97) \\times \\frac{1\\ \\text{cycle}}{1\\ \\text{load}} \\times 0.2 \\)</span><span>\\(\\displaystyle = \\frac{2.1\\ \\text{cycles}}{1000\\ \\text{instructions}} \\)</span></div><div class="math chain"><span>\\(\\displaystyle \\frac{\\Delta C_B}{C_0} = \\frac{2.1\\ \\text{cycles}}{800\\ \\text{cycles}} \\)</span><span>\\(\\displaystyle \\approx \\mathbf{0.26\\%}\\ \\textbf{fewer cycles} \\)</span></div>The filter does almost nothing for B, and its false positives come entirely from the index, not from real overlap.</li><li><strong>Hashing virtual bits above 11.</strong> Adding virtual page bits to the hash would separate the source from the destination, and the virtual address is ready as soon as the AGU finishes, so timing doesn't change. But it breaks the rule that the filter can never say no when a store matches. Two different virtual addresses can map to the same physical address, a synonym, as in a shared-memory buffer mapped twice or a ring buffer mapped twice in a row. A store through one mapping and a load through the other would hash to different counters, and the load would skip a search that should have forwarded. The store's LQ probe doesn't help if the store's address resolved before the load executed.</li><li><strong>Recommendation.</strong> Don't hash virtual bits unless something else rules out synonyms, for example an OS guarantee, or a check that marks pages with more than one mapping and sends their loads to the full search. A safe fix is to hash physical page bits, which means waiting for the DTLB. That is too late to choose the 4-cycle path, so it helps energy-only mode but not latency mode. For latency mode, keep page-offset indexing and accept that 4K-aliased code such as workload B gets no benefit, as on cores that document a 4K aliasing penalty.</li></ol>`
      }
    ]
  }
},

{
  id: "store-coalescing",
  region: "mord",
  title: "Store Coalescing",
  sections: [
    { id: "saves", label: "What Coalescing Saves" },
    { id: "where", label: "Where Stores Merge" },
    { id: "order", label: "What the Memory Model Allows" },
    { id: "visible", label: "When a Merged Store Counts as Visible" }
  ],
  body: `
<p>Once a store retires it is a senior store: it can no longer be squashed, and all that is left is to write its bytes into L1. The SQ drains senior stores from its head, normally one L1 write each. Store coalescing merges several of them into one write. This page covers what that saves, where in the core the merging happens, which merges the memory model allows, and what changes when merged stores sit outside the SQ. The core is the same as on <a href="#/lsq">The Store Queue</a>, and the coherence side of draining is on <a href="#/senior-stores">Retired but Not Performed</a>.</p>
<h3 id="sec-saves">What Coalescing Saves</h3>
<p>Each senior store needs an L1 write for a cycle, and the L1 data arrays are shared with loads and with fills from L2. If the SQ drains more slowly than stores retire, it fills up, and then dispatch stalls on the next store even though the ROB has room. Merging helps in three ways:</p>
<ul>
<li><strong>Write bandwidth.</strong> Stores to the same line go out in one write, so a run of small stores drains at the rate L1 accepts line writes, not the rate it accepts stores. Code that writes memory a word at a time produces such runs: memset and memcpy loops, structure initialization, and register spills to the stack.</li>
<li><strong>Energy.</strong> One tag check and one data array write replace several.</li>
<li><strong>Fewer partial writes.</strong> A cache that keeps ECC per 8- or 16-byte granule must read the granule, merge the new bytes, and recompute the check bits on any store narrower than the granule. If the merged stores cover the whole granule, the read isn't needed.</li>
</ul>
<p>Hennessy and Patterson describe the same idea one level down, as the merging write buffer (chapter 2). In a write-through cache, writes to sequential addresses merge into one buffer entry that holds a whole block instead of taking one entry each. The buffer fills more slowly, and each transfer to the next level carries a full block.</p>
<h3 id="sec-where">Where Stores Merge</h3>
<ul>
<li><strong>At the SQ head.</strong> The drain logic looks at the oldest few senior stores, and if the next ones are in the same line as the oldest, they go out in the same L1 write. That takes a line-address compare between neighboring entries and a byte merge in the write path, but no extra storage. Ice Lake (Sunny Cove) has two store ports, but its L1 takes one line write per cycle, so it commits two stores in one cycle only when two consecutive stores fall in the same line (Travis Downs's measurements).</li>
<li><strong>In a merge buffer.</strong> A few line-sized entries between the SQ and L1. A senior store leaves the SQ as soon as it writes its bytes into the buffer, which frees SQ entries early, and the buffer writes L1 a line at a time. A merge buffer can merge stores to the same line that aren't consecutive, when the memory model allows it (next section).</li>
<li><strong>In write-combining buffers.</strong> On x86, stores to memory typed write-combining (WC), such as a frame buffer, and non-temporal stores (<code>MOVNTI</code>, <code>MOVNTDQ</code>) skip the cache. They collect in write-combining buffers, one 64-byte line each, and a full buffer goes out to memory as one burst instead of eight 8-byte writes. Intel cores use their L1 fill buffers for this. WC stores are weakly ordered by definition, so the buffers merge them in any order, and software issues <code>SFENCE</code> where the order matters.</li>
</ul>
<h3 id="sec-order">What the Memory Model Allows</h3>
<p>Merging stores makes them visible at the same instant. That is always safe for stores next to each other in program order: no other thread can tell whether they became visible one cycle apart or together. The danger is a merge that jumps over another store. Take three senior stores at the SQ head, oldest first:</p>
<ol>
<li>St A writes line X.</li>
<li>St B writes line Y.</li>
<li>St C writes line X.</li>
</ol>
<p>Merging A and C into one write of line X makes C visible before B.</p>
<ul>
<li><strong>Under TSO (x86, SPARC), that is forbidden.</strong> Stores must become visible in program order. Another core could read C's new value and then read B's address and get the old value, a store-store reordering TSO doesn't allow. A TSO core can merge only a run of consecutive stores to the same line, here A alone, then B, then C.</li>
<li><strong>Under a weak model (Arm, RISC-V's RVWMO), it is allowed.</strong> Stores to different addresses may become visible out of order, so C can merge into A's write past B. A barrier between them (<code>DMB</code> on Arm, <code>FENCE</code> on RISC-V) means no store after it may become visible before a store ahead of it. So a younger store can't merge back into an earlier write, but older stores can still be held back and merged into a younger store's write, since then they become visible together with it, not after it. Arm also lets the page tables forbid merging: Device memory marked nG (non-Gathering), such as Device-nGnRnE for memory-mapped I/O registers, must see every access separately, because writing a device register can have side effects.</li>
</ul>
<p>Inside one merge, byte order follows program order. Where two merged stores write the same byte, the younger store's byte wins, the same rule the SQ search uses when it picks the youngest matching store for forwarding.</p>
<h3 id="sec-visible">When a Merged Store Counts as Visible</h3>
<p>A store becomes visible to other cores when it is written into a coherent structure, normally an L1 line in M state (see <a href="#/senior-stores/visible">Where a Store Becomes Visible</a>). A merge buffer between the SQ and L1 forces a choice:</p>
<ul>
<li><strong>The buffer is outside coherence.</strong> Stores in it aren't visible yet, and snoops from other cores don't look at it. In memory-model terms the buffer is just the tail end of the SQ. Under TSO, no younger store to another line can write L1 while an older store still waits in the buffer, which limits how much the buffer can reorder.</li>
<li><strong>The buffer counts as visible.</strong> Then it is part of the cache. Each entry must hold M permission for its line before stores merge into it, and a snoop to that line has to find the entry and answer from it like a cache would. Stores can then drain into it as fast as it accepts them, since each merge is already a visible write.</li>
</ul>
<p>Either way, this core's loads have to find every byte they might need. A load searches the SQ, and it also has to search the merge buffer, or read an L1 that already holds the merged bytes. A merge buffer that loads don't search returns stale data, the same bug as a store that leaves the SQ before L1 has its bytes.</p>`,
  practice: {
    guided: [
      {
        q: `<p>A loop's stores drain from the SQ head with same-line pairing. How fast do they drain in three versions of the loop, and how many cycles until the SQ fills in any version that drains too slowly?</p><p>Given:</p><ul><li>An Ice Lake-like core with a 72-entry SQ</li><li>L1 takes 1 line write/cycle, and up to 2 consecutive senior stores at the SQ head commit in the same cycle when they fall in the same 64-byte line</li><li>All stores are 8 bytes, aligned, and hit L1</li><li>Arrays a and b both start on 64-byte line boundaries</li><li>The loop dispatches and retires 2 stores/cycle, and nothing else limits it</li><li>The SQ starts empty, an entry is freed when its store commits to L1, and the few cycles between dispatch and retirement can be ignored</li><li>Version 1 writes one array in order: a[0], a[1], a[2], and so on</li><li>Version 2 writes two arrays, alternating: a[0], b[0], a[1], b[1], and so on</li><li>Version 3 writes the two arrays in pairs: a[0], a[1], b[0], b[1], a[2], a[3], b[2], b[3], and so on</li></ul>`,
        a: `<ol class="steps"><li><strong>Version 1.</strong> A line holds 8 stores, and the SQ head pairs them in order, so every pair is in one line.<div class="math chain"><span>\\(\\displaystyle \\text{stores per line} = \\frac{64\\ \\text{bytes/line}}{8\\ \\text{bytes/store}} \\)</span><span>\\(\\displaystyle = 8\\ \\text{stores/line} \\)</span></div>The pairs are a[0] and a[1], a[2] and a[3], and so on, and none of them crosses a line. So 2 stores commit every cycle, the same rate they arrive, and the SQ never fills.</li><li><strong>Version 2.</strong> Each pair at the head is one store to a and one to b, which are in different lines, so they can't commit together. The SQ drains at 1 store/cycle.</li><li><strong>Version 2's fill time.</strong> The SQ grows by the difference between the arrival and drain rates.<div class="math chain"><span>\\(\\displaystyle t_{\\text{full}} = \\frac{72\\ \\text{entries}}{2\\ \\text{stores/cycle} - 1\\ \\text{store/cycle}} \\)</span><span>\\(\\displaystyle = 72\\ \\text{cycles} \\)</span></div>After 72 cycles, dispatch can only send a store when one drains, so the loop runs at 1 store/cycle, half its speed.</li><li><strong>Version 3.</strong> The head pairs a[0] with a[1], then b[0] with b[1], and so on. For an even i, a[i] starts 8 bytes × i into the array, a multiple of 16 bytes, so a[i] and a[i + 1] sit in one aligned 16-byte block and never straddle a line. The same holds for b. Every pair commits in one cycle, so the SQ drains at 2 stores/cycle and never fills. Reordering the stores in the source, not changing the hardware, recovers the full rate.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Four senior stores sit at the SQ head, oldest first: St A to line X, St B to line X, St C to line Y, St D to line X. How many L1 writes does a TSO core need to drain them, how many does an Arm core need, and how many does the Arm core need if a <code>DMB ST</code> sits between C and D?</p><p class="given">Assume each core merges any number of stores into one line write when its memory model allows it, and all four stores are to Normal memory.</p>`,
        a: `<ul><li><strong>TSO: 3 writes.</strong> A and B are consecutive and in the same line, so they merge. C goes alone. D can't merge back into the A and B write, because that would make D visible before C. So the writes are A with B, then C, then D.</li><li><strong>Arm, no barrier: 2 writes.</strong> Stores to different addresses may become visible in any order, so D merges with A and B past C. The writes are A, B, and D to line X, and C to line Y, in either order.</li><li><strong>Arm, <code>DMB ST</code> between C and D: still 2 writes.</strong> The barrier requires A, B, and C to be visible no later than D. The core writes C first, then A, B, and D together as one write of line X. No observer can see D without A and B, since they land in the same instant, and C is already visible. What the barrier rules out is the order the TSO core also can't use: writing A and B first and then merging D into that earlier write ahead of C. If the core instead drains A and B as soon as they reach the head, as many designs do to free SQ entries, the barrier forces a third write for D.</li></ul>`
      },
      {
        q: `<p>A team adds a 4-entry merge buffer between the SQ and L1 and wants it to count as visible, so stores can leave the SQ as soon as they write it. What does the buffer need for that to be correct, and what does it buy over merging only at the SQ head?</p>`,
        a: `<p>What it needs:</p><ul><li><strong>M permission before a merge.</strong> An entry may take a store only while it owns its line in M state, so the write is visible the instant it lands, exactly as an L1 write would be. If the line isn't owned, the store waits in the SQ for the RFO.</li><li><strong>Snoop handling.</strong> Every snoop that checks L1 must also check the buffer's line addresses. An invalidation or a read from another core is answered from the entry, by writing it into L1 or sending its data, just as a dirty L1 line would be.</li><li><strong>Load forwarding.</strong> This core's loads must search the buffer as well as the SQ, or read L1 only after the buffer's bytes are merged in. Otherwise a load can read a stale L1 byte that a visible store has already overwritten.</li><li><strong>Order between entries.</strong> Under TSO the entries are visible as soon as they're written, so a store may only enter the buffer in program order, after every older store is visible.</li></ul><p>What it buys:</p><ul><li>Stores to the same line merge even when they arrive several cycles apart, not only when they sit next to each other at the SQ head.</li><li>SQ entries are freed when a store reaches the buffer, not when its line is written to the L1 arrays, so a burst of stores holds fewer SQ entries.</li><li>The L1 arrays see one write per line, which leaves more cycles for loads and fills.</li></ul><p>The cost is a small fully associative structure in the coherence and load paths, which is why many designs merge only at the SQ head.</p>`
      }
    ]
  }
}
]);
