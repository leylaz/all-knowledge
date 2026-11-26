/* Section: Memory Ordering
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "mdep"). */

section({
  id: "mdep",
  name: "Memory Ordering",
  cap: "Which loads may pass older stores, from the LSQ to store sets",
  sections: [
    { id: "pages", label: "Pages in This Region" }
  ],
  body: `
<p>An out-of-order core lets loads run ahead of older stores, and the load and store queues catch the cases where that broke memory order. A memory dependence predictor decides which loads may run ahead of older stores whose addresses aren't known yet. Get it wrong one way and a load reads stale data, so the core flushes it and everything younger. Get it wrong the other way and a load waits for stores it has nothing to do with. After the queues, this region follows Chrysos and Emer's store sets paper (ISCA 1998) section by section, one page per step of the argument. Window-size data comes from Moshovos, Breach, Vijaykumar, and Sohi (ISCA 1997), real hardware from the Alpha 21264 hardware reference manual, and background from Hennessy and Patterson (chapter 3). The cheaper recovery the paper chose not to use is on <a href="#/replay">Selective Replay</a>.</p>
<h3 id="sec-pages">Pages in This Region</h3>
<ul>
<li><a href="#/lsq">Load and Store Queues</a>: how stores wait to commit, how loads search older stores, how violations are caught, and store coalescing.</li>
<li><a href="#/sq-filters">Store Queue Membership Filters</a>: counting Bloom filters that let most loads skip the SQ search, their corner cases, timing, size, cost, and the workloads they suit.</li>
<li><a href="#/mdp">Why Predict Memory Dependences</a>: register vs memory dependences, the two bad default choices, and the two goals of a predictor.</li>
<li><a href="#/mdp-metrics">Metrics, Bounds, and Window Size</a>: how predictors are scored, what no speculation, naive speculation, and perfect prediction are worth, and why all of it grows with the window.</li>
<li><a href="#/mdp-early">Early Predictors</a>: the Alpha 21264's wait bits and the earlier schemes store sets built on.</li>
<li><a href="#/mdp-store-sets">Store Sets</a>: a per-load set of stores, why a load must be able to wait on several stores and a store must serve several loads, and how close ideal store sets get to perfect.</li>
<li><a href="#/mdp-ssit">Store Sets in Hardware</a>: the SSIT and LFST, assigning and merging sets, clearing stale entries, and table sizes.</li>
<li><a href="#/mdp-limits">Where Store Sets Fall Short</a>: dependences between specific loop iterations, which PC-indexed sets serialize.</li>
<li><a href="#/mdp-takeaways">Takeaways</a>: the region in six points.</li>
</ul>`,
  practice: {
    guided: [
      {
        q: `<p>A store and a load in a hot loop write and read the same address on every iteration, and the load's address is usually ready first. Follow a store set predictor from the first time the pair runs to the second.</p>`,
        a: `<ol><li>First time: the load's store set is empty, so it issues as soon as its address is ready and reads the cache.</li><li>The store then issues, searches the load queue, and finds a younger load to the same bytes that already executed. That's a memory-order violation, so the load and every younger instruction are squashed and refetched.</li><li>Training: the SSIT entries for the load's PC and the store's PC get the same store set ID.</li><li>Second time: the store is fetched first, reads its SSID, and records itself in the LFST as the last fetched store of that set.</li><li>The load is fetched, reads the same SSID, finds the store in the LFST, and takes a dependence on it. It issues only after the store issues and gets the value by store-to-load forwarding. One violation was the whole cost of learning the pair.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Explain memory dependence prediction to someone who knows branch prediction well. What carries over, and what is different?</p>`,
        a: `<p>What carries over:</p><ul><li>Both are tables indexed by PC that learn from history, and both bet that past behavior of a static instruction predicts its next instance.</li><li>Both recover from a bad bet by flushing the wrong-path or stale work and refetching.</li><li>Both suffer from aliasing in untagged tables and from capacity misses as code footprints grow.</li></ul><p>What is different:</p><ul><li><strong>The two errors cost very different amounts.</strong> A false dependence costs a few cycles and only if the load is on the critical path. A violation costs a flush. A branch predictor's two errors cost the same.</li><li><strong>It predicts a relation, not a bit.</strong> A good predictor names <em>which</em> store to wait for. A single "wait" bit makes the load wait for every older store.</li><li><strong>Training is one-sided.</strong> Violations are detected for free by the load queue search, but nothing reports a needless wait unless extra comparators check the addresses. So tables only ever learn to wait, and need periodic clearing to forget.</li><li><strong>The penalty grows with the window,</strong> since a bigger window holds more older stores with unknown addresses and more younger work to squash.</li></ul>`
      }
    ]
  }
}, [
{
  id: "lsq",
  region: "mdep",
  title: "Load and Store Queues",
  sections: [
    { id: "stores", label: "Stores" },
    { id: "missing-fields", label: "Missing Address or Data" },
    { id: "loads", label: "Loads" },
    { id: "catching-violations", label: "Catching Violations" },
    { id: "priority-encoders", label: "Priority Encoders" },
    { id: "search-hardware", label: "Search Hardware and Load-to-Use Latency" },
    { id: "store-coalescing", label: "Store Coalescing" }
  ],
  body: `
<p>The LQ and SQ track memory operations in program order so they can execute out of order without breaking memory semantics. Both are allocated at dispatch, in program order, so an entry's position in its queue says how old it is. The examples on this page use a core sized like Intel's Golden Cove (114-entry SQ, 192-entry LQ, 512-entry ROB) with 46-bit physical addresses and scalar loads and stores of up to 8 bytes.</p>
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
<p>The LQ position is the LQ tail when the store was allocated. Every load at or past it is younger than the store, which is how the store knows which loads to check when its address resolves (see <a href="#/lsq/loads">Loads</a>).</p>

<h4>A Load Searches the Store Queue</h4>
<p>When a load executes, it has to find out whether an older store that hasn't reached L1 yet writes any of its bytes. It searches the SQ as a <a href="#/cam">CAM</a>: every entry compares itself against the load in parallel, which costs one set of comparators per entry per load port. Each entry runs four checks:</p>
<ol>
<li><strong>Age: does this store count?</strong> At allocation, each load records the SQ tail at that moment, i.e., which store was youngest when the load entered. Only the entries from the SQ head up to that recorded position are older than the load. Everything younger is masked out, and so are empty entries. In hardware every entry compares in parallel and its result is ANDed with this age mask, so a younger store's match never counts.</li>
<li><strong>Page offset: same chunk within the page?</strong> The search compares addresses down to an 8-byte chunk (some cores use 16 bytes), so bits 2–0 are left to the byte check. Many cores first compare only the page-offset bits, here bits 11–3, because those are ready before translation finishes.</li>
<li><strong>Physical page: really the same address?</strong> Once the DTLB answers, the match is confirmed with bits 45–12. Matching on the low bits first is what causes Intel's <strong>4K aliasing</strong> stalls: two addresses a multiple of 4 KiB apart match on the low 12 bits and look like a dependence when they aren't, so the load is held and reissued, which costs a few cycles.</li>
<li><strong>Bytes: which of the load's bytes does the store write?</strong> The load's byte mask is ANDed with the store's. If the AND equals the load's mask, the store covers every byte the load reads (full match). If it is nonzero but smaller, the store covers some of them (partial match). If it is zero, the two share a chunk but no bytes (no match).</li>
</ol>
<p>Several older stores can pass all four checks. Only the youngest of them matters, because its bytes are the last ones written before the load in program order. A priority encoder, starting at the load's recorded position and moving toward the head, picks it (see <a href="#/lsq/priority-encoders">Priority Encoders</a>). An older store whose address is still unknown can't be compared at all. Whether the load waits for it or goes ahead anyway is the memory dependence predictor's call (see <a href="#/mdp">Why Predict Memory Dependences</a>). A store that has its data but not its address counts the same (see <a href="#/lsq/missing-fields">Missing Address or Data</a>).</p>
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
<li><strong>Miss.</strong> No older store writes any of the load's bytes. The load reads L1 as usual. If it went past an older store whose address was unknown and that store turns out to overlap, the store's probe of the LQ catches it later (see <a href="#/lsq/loads">Loads</a>).</li>
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
<p><strong>An unknown store behind a known match.</strong> The two cases combine in the one that the LQ probe's source check exists for. Suppose the youngest store with a known address fully covers the load, but a younger store, still older than the load, has no address yet. If the predictor lets the load go, it forwards from the known store. That is right only if the unknown store turns out not to overlap. If it does overlap, the load took bytes the unknown store overwrites. When that store's address resolves, its probe finds the load executed, overlapping, and forwarded from a store older than itself, so check ⑥ marks the value stale and the core flushes (see <a href="#/lsq/loads">Loads</a>). LQ 2 in that figure is the opposite case: it forwarded from a store younger than the probing one, so its bytes were right.</p>
<h3 id="sec-loads">Loads</h3>
<p>A load gets an LQ entry at dispatch and records the SQ tail at that moment, the age mark the SQ search uses. When it executes, it writes its address into the entry, searches the SQ (see <a href="#/lsq/stores">Stores</a>), and reads L1 in parallel. The value goes to the load's destination physical register, not the LQ. The entry stays until the load retires, because until then an older store or another core can still show that the load read the wrong value.</p>
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
<li><strong>Snooped.</strong> Another core invalidated the line after the load read it (see <a href="#/lsq/catching-violations">Catching Violations</a>).</li>
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
<p>Several loads can pass all six checks. The one that matters is the oldest, the one nearest the store: the core flushes from it, and every younger load goes with it anyway. A priority encoder, starting at the store's recorded LQ position and moving toward the tail, finds it (see <a href="#/lsq/priority-encoders">Priority Encoders</a>).</p>
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
<p>The age search doesn't need a comparator per entry against a searched value, because it doesn't depend on the snoop. The core keeps a pointer P to the oldest load without a value: a priority encoder over the row of bits valid AND NOT executed, starting at the LQ head and moving toward the tail (see <a href="#/lsq/priority-encoders">Priority Encoders</a>). P changes only when a load gets its value, dispatches, or retires, so it can be computed every cycle off the snoop's path. When the snoop arrives, the hardware needs:</p>
<ul>
<li><strong>An age mask.</strong> One bit per entry, set for entries younger than P. It comes from a thermometer decode of P to the tail, or from a 9-bit comparison per entry with the wrap-bit rule from the store probe (equal wraps, the smaller index is older, different wraps, the larger one is).</li>
<li><strong>An AND per entry.</strong> M AND the age mask gives the loads that read the line and have an older load still waiting. Those are the violations.</li>
<li><strong>A priority encoder</strong> from P toward the tail, to pick the oldest violation. The core flushes from it, and every younger load goes with it.</li>
</ul>
<p>If the encoder for P finds no load without a value, every older load has its value and nothing is squashed. A matching load older than P is also safe, for the same reason. For example, with the LQ head at entry 40, entries 40 to 51 executed, and A at entry 52 still waiting on a miss, P = 52. A snoop that matches entries 45 and 57 squashes from entry 57 and leaves entry 45 alone.</p>
<p>A simpler design skips the age search: it only sets snooped bits, and any snooped load that reaches retirement is treated as a violation. That needs only the address CAM, but it flushes loads whose older loads had all finished, so it flushes more often than it has to.</p>
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
<p>So the encoder's delay grows with log N, not N. The 114-entry SQ on this page needs 7 levels, against 3 for an 8-entry queue.</p>
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
<li><strong>Read and align.</strong> The grant drives the winning entry's data row onto bitlines that also run past every entry. The bytes are then shifted into place by the offset difference, as in the byte-check figure.</li>
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
</ul>
<h3 id="sec-store-coalescing">Store Coalescing</h3>
<p>Merging retired stores to the same line saves L1 write bandwidth, but must not make stores visible in an order the memory model forbids.</p>`,
  practice: {
    guided: [
      {
        q: `<p>Store queue, oldest first: St A (0x100, 8 bytes, data ready), St B (address unknown), St C (0x108, 4 bytes, data ready). A younger 8-byte load L reads 0x100. Walk through what happens.</p>`,
        a: `<ol><li>L searches older stores, youngest first. St C covers 0x108–0x10B: no overlap with 0x100–0x107.</li><li>St B's address is unknown. L must wait, or speculate past it based on the memory dependence predictor.</li><li>If it speculates, St A fully covers L, so A's data is forwarded.</li><li>If B later resolves to 0x104, it overlaps L: ordering violation, flush L and everything younger, re-execute.</li><li>If B resolves to 0x200, the speculation was correct.</li></ol>`
      },
      {
        q: `<p>A load's SQ search finds that the youngest matching store covers all its bytes but doesn't have its data yet. When does the load deliver its value if the core blocks it on the data, and how much sooner is that than blocking it until the store writes L1?</p><p>Given:</p><ul><li>The load issues in cycle 0</li><li>Load-to-use latency: 5 cycles, the same for an L1 hit and a forward</li><li>The youngest matching store fully covers the load's bytes and has data valid = 0</li><li>The store's data comes from an integer divide. The store-data µop writes the data into the SQ entry at the end of cycle 23</li><li>A blocked load is woken in the cycle after the event it waits for, and reissues in that cycle with the same 5-cycle latency</li><li>The alternative policy treats the load like a partial match: it stays blocked until the store writes L1, which happens at the end of cycle 61, and is then woken and reissued the same way</li></ul>`,
        a: `<ol class="steps"><li><strong>Why the load must wait for this store.</strong> L1 still holds the value from before the store, and any older store's bytes are overwritten by this one, so the store's own data is the only correct source. The load records the store's SQ index and gives up its slot.</li><li><strong>Reissue.</strong> The data write at the end of cycle 23 wakes the load, and it reissues the next cycle.<div class="math chain"><span>\\(\\displaystyle t_{\\text{reissue}} = \\text{cycle } 23 + 1\\ \\text{cycle} \\)</span><span>\\(\\displaystyle = \\text{cycle } 24 \\)</span></div></li><li><strong>Value delivered.</strong> The reissued load searches again, finds the data, and forwards with the normal latency.<div class="math chain"><span>\\(\\displaystyle t_{\\text{block on data}} = \\text{cycle } 24 + 5\\ \\text{cycles} \\)</span><span>\\(\\displaystyle = \\textbf{cycle } \\mathbf{29} \\)</span></div>Without the block it would have delivered in cycle 5, so the divide costs this load 24 cycles.</li><li><strong>The alternative.</strong> Waiting for the L1 write means waiting for the store to retire, behind everything older than it, and then drain.<div class="math chain"><span>\\(\\displaystyle t_{\\text{block to L1}} = \\text{cycle } 61 + 1\\ \\text{cycle} + 5\\ \\text{cycles} \\)</span><span>\\(\\displaystyle = \\text{cycle } 67 \\)</span></div></li><li><strong>Difference.</strong> Blocking on the data delivers sooner by<div class="math chain"><span>\\(\\displaystyle \\Delta t = \\text{cycle } 67 - \\text{cycle } 29 \\)</span><span>\\(\\displaystyle = \\mathbf{38}\\ \\textbf{cycles} \\)</span></div>That is why the SQ wakes a load on the data write, rather than reusing the partial-match stall, which has to wait for L1 because the bytes it needs come from two places.</li></ol>`
      },
      {
        q: `<p>A 16-entry SQ picks the forwarding store with two encoders, as on this page. Which entry does each of two loads forward from, and how many gate levels does the select path take at 16 entries and at 64?</p><p>Given:</p><ul><li>SQ entries 0 to 15, used as a circular buffer, with the head (oldest store) at SQ 11</li><li>Two loads allocated back to back, so both recorded SQ 4 as their mark: the older stores are SQ 11 to 15 and then SQ 0 to 3, oldest to youngest</li><li>Entries that pass all the checks (age, address, and bytes):<ul><li>Load A: SQ 1 and SQ 14</li><li>Load B: SQ 12 and SQ 14</li></ul></li><li>Both encoders let the highest index win, and encoder 1 sees only the matches below the mark</li><li>Gate levels: count each 2-input gate as 1 level, inverters as free, and the final 2:1 mux as 1 level. Each encoder's OR of the inputs above i (higher index wins) is a tree of 2-input ORs, and its grant is \\(g_i = r_i \\land \\lnot S_{i+1}\\), where \\(S_{i+1}\\) is the OR of every input above i</li><li>The below-mark mask is decoded from the mark when the load is allocated, so it is ready early, but ANDing it with the match bits is 1 level</li><li>The select path ends at the one-hot grant that drives the data row, not at a binary index</li></ul>`,
        a: `<ol class="steps"><li><strong>The mask.</strong> The mark is SQ 4, so the mask has 1s at SQ 0 to 3. The queue has wrapped, so those four entries are the youngest of the older stores.</li><li><strong>Load A.</strong> ANDed with the mask, only SQ 1 is left. Encoder 1 is valid and its winner is SQ 1, so <strong>SQ 1 forwards</strong>. That is right: in age order SQ 14 comes before SQ 0, so SQ 1 is younger.</li><li><strong>Load B.</strong> Neither SQ 12 nor SQ 14 is below the mark, so encoder 1 finds nothing and the mux takes encoder 2, which sees both and picks the higher index, so <strong>SQ 14 forwards</strong>. Both matches are in the wrapped part, where a higher index is younger, so that is right too.</li><li><strong>Prefix levels.</strong> Each level doubles the span a prefix covers, so N entries need log<sub>2</sub> N levels.<div class="math chain"><span>\\(\\displaystyle L_{16} = \\log_2 16\\ \\text{levels} \\)</span><span>\\(\\displaystyle = 4\\ \\text{levels} \\)</span></div><div class="math chain"><span>\\(\\displaystyle L_{64} = \\log_2 64\\ \\text{levels} \\)</span><span>\\(\\displaystyle = 6\\ \\text{levels} \\)</span></div></li><li><strong>The whole select path.</strong> The longest path runs through encoder 1: the mask AND, the OR tree, the grant AND, and then the mux. Encoder 2 skips the mask, so it finishes a level earlier and isn't critical. Encoder 1's valid bit is the OR of all its inputs, which the tree produces at its last level, so the mux select is ready a level before the grant it selects.<div class="math chain"><span>\\(\\displaystyle D_{16} = 1\\ \\text{level} + 4\\ \\text{levels} + 1\\ \\text{level} + 1\\ \\text{level} \\)</span><span>\\(\\displaystyle = \\mathbf{7}\\ \\textbf{levels} \\)</span></div><div class="math chain"><span>\\(\\displaystyle D_{64} = 1\\ \\text{level} + 6\\ \\text{levels} + 1\\ \\text{level} + 1\\ \\text{level} \\)</span><span>\\(\\displaystyle = \\mathbf{9}\\ \\textbf{levels} \\)</span></div>Four times the entries cost two more levels. The longer wires to drive 64 entries cost more than that, which is why the encoder is rarely what limits SQ size.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A 4-byte store to 0x100 is followed by an 8-byte load from 0x100. Can the store forward? On this core, a load that can't forward waits about 15 cycles for the store to commit and write the cache.</p>`,
        a: `<p>Not fully: the store covers only half the load. Most designs block the load until the store commits and writes the cache, then read the merged line. This "store-forwarding stall" costs about 15 cycles here. More complex designs merge store bytes with cache data. Compilers try to avoid narrow-store, wide-load patterns.</p>`
      },
      {
        q: `<p>Why does an x86 core check the load queue against coherence invalidations?</p>`,
        a: `<p>TSO requires loads to appear in program order. If a younger load executed early and the line is then invalidated by another core's write before an older load completes, the younger load may hold a value that is stale relative to the older one. The core detects this on the invalidation and squashes the younger load. Weaker models such as ARM allow more load-load reordering, but same-address ordering still must hold.</p>`
      },
      {
        q: `<p>A team can grow a core's SQ from 64 to 96 entries, but then the forwarding search no longer fits in the 4-cycle L1 hit. Should they add a cycle to every load, make forwarding slower instead, or keep the 64-entry SQ?</p><p>Given:</p><ul><li>Workload: store-heavy, with a CPI of 0.5 cycles/instruction on the 64-entry design</li><li>SQ-full dispatch stalls: 60 cycles/kilo-instruction at 64 entries, 12 cycles/kilo-instruction at 96 entries</li><li>Loads: 300 loads/kilo-instruction, of which 5% forward from the SQ</li><li>Forwarding takes 4 cycles today, the same as an L1 hit</li><li>Option A: every load's latency, forwarded or not, goes from 4 cycles to 5</li><li>Option B: L1 hits stay at 4 cycles, forwarded loads take 7 cycles, and each forwarded load also cancels and replays its dependents, costing 1 more exposed cycle</li><li>Exposure: 25% of any latency added to an ordinary load shows up as execution time, and the rest overlaps with other work. Forwarded loads sit on dependence chains more often, so 50% of their added latency shows up</li><li>These effects add, and nothing else changes</li><li>Also say what changes for a workload with no SQ-full stalls</li></ul>`,
        a: `<ol class="steps"><li><strong>What the bigger SQ saves.</strong> The difference in SQ-full stalls, per 1000 instructions:<div class="math chain"><span>\\(\\displaystyle S = \\frac{60\\ \\text{cycles} - 12\\ \\text{cycles}}{1000\\ \\text{instructions}} \\)</span><span>\\(\\displaystyle = \\frac{48\\ \\text{cycles}}{1000\\ \\text{instructions}} \\)</span></div></li><li><strong>Option A's cost.</strong> Every load gets 1 more cycle. A quarter of it is exposed on the 95% of loads that don't forward, and half on the 5% that do.<div class="math chain"><span>\\(\\displaystyle C_A = \\frac{300\\ \\text{loads}}{1000\\ \\text{instructions}} \\times \\frac{(5 - 4)\\ \\text{cycles}}{1\\ \\text{load}} \\times (0.95 \\times 0.25 + 0.05 \\times 0.5) \\)</span><span>\\(\\displaystyle = \\frac{78.75\\ \\text{cycles}}{1000\\ \\text{instructions}} \\)</span></div>That is more than the 48 cycles saved, so option A loses 30.75 cycles per 1000 instructions, a net slowdown.</li><li><strong>Option B's cost.</strong> Only forwarded loads pay: 3 cycles of extra latency, half exposed, plus the replay cycle.<div class="math chain"><span>\\(\\displaystyle C_B = \\frac{300\\ \\text{loads}}{1000\\ \\text{instructions}} \\times 0.05 \\times \\left(\\frac{(7 - 4)\\ \\text{cycles}}{1\\ \\text{load}} \\times 0.5 + \\frac{1\\ \\text{cycle}}{1\\ \\text{load}}\\right) \\)</span><span>\\(\\displaystyle = \\frac{15\\ \\text{loads}}{1000\\ \\text{instructions}} \\times \\frac{2.5\\ \\text{cycles}}{1\\ \\text{load}} \\)</span><span>\\(\\displaystyle = \\frac{37.5\\ \\text{cycles}}{1000\\ \\text{instructions}} \\)</span></div></li><li><strong>Option B's net gain.</strong> Compare it with the 500 cycles that 1000 instructions take at a CPI of 0.5.<div class="math chain"><span>\\(\\displaystyle G_B = \\frac{48\\ \\text{cycles} - 37.5\\ \\text{cycles}}{1000\\ \\text{instructions} \\times \\frac{0.5\\ \\text{cycles}}{1\\ \\text{instruction}}} \\)</span><span>\\(\\displaystyle = \\frac{10.5\\ \\text{cycles}}{500\\ \\text{cycles}} \\)</span><span>\\(\\displaystyle = \\mathbf{2.1\\%}\\ \\textbf{faster} \\)</span></div></li><li><strong>A workload with no SQ-full stalls.</strong> The bigger SQ saves nothing there, and option B still costs every forwarded load.<div class="math chain"><span>\\(\\displaystyle L_B = \\frac{37.5\\ \\text{cycles}}{1000\\ \\text{instructions} \\times \\frac{0.5\\ \\text{cycles}}{1\\ \\text{instruction}}} \\)</span><span>\\(\\displaystyle = \\mathbf{7.5\\%}\\ \\textbf{slower} \\)</span></div>This assumes the same CPI and forwarding rate as the store-heavy workload, which a real suite would measure for each program.</li><li><strong>Recommendation.</strong> Option A is out: it charges every load to help the few programs that fill the SQ. Option B helps the store-heavy workload by about 2% but costs about 7.5% on code that forwards and doesn't fill the SQ, so the choice depends on the suite's mix. Unless most of the suite is SQ-bound, keep 64 entries, or get the capacity another way, such as a two-level SQ that keeps the first level small enough to fit in 4 cycles.</li></ol>`
      },
      {
        q: `<p>On a core that splits each store into a store-address µop and a store-data µop, the memory dependence predictor says load L depends on store S. Should L wait for S's address µop, its data µop, or both? Say what goes wrong with each choice.</p><p class="given">Assume the SQ blocks a load whose youngest match has no data yet and wakes it when the data is written, as on this page.</p>`,
        a: `<p>L must wait for S's address µop, because that is what makes its search exact. Waiting for the data as well is optional: it saves a wasted search when the data is late, but it over-waits on false dependences. Since the SQ already handles a missing data half without prediction, waiting on the address alone is usually the better choice.</p><ul><li><strong>Address only.</strong> Once S's address is in, L's search either rules S out or finds a match. With S's data there, L forwards. Without it, L blocks on S's SQ index and wakes on the data write. The cost is one wasted issue and search when the data comes late, but the result is always correct and L never waits longer than it has to.</li><li><strong>Data only.</strong> This can wait for nothing. In code like <code>a[idx[i]] = x</code>, S's data is often ready long before its address. L issues, finds S with data but no address, and is back where it started: it must speculate past S or wait again. If it speculates and S overlaps, the violation the predictor was trained to prevent happens anyway.</li><li><strong>Both.</strong> This is always safe and saves the wasted search when the data is late. But L can't overlap its own address generation and TLB lookup with S's data, and it over-waits whenever the address alone would have cleared L. Store-set predictors make false dependences, from aliasing in the tables and from stores that overlap only sometimes. When S's address turns out not to overlap, L has also waited for a data value it never needed. If that data comes from a cache miss or a divide, the wait is long.</li></ul><p>Waiting on the address and letting the SQ handle late data gets the safety of waiting for both, without the over-wait. Intel's split STA and STD design does it that way: its disambiguation predictor decides whether a load may pass stores with unknown addresses, and a load that matches a store without data is blocked until the data arrives.</p>`
      }
    ]
  }
},

{
  id: "sq-filters",
  region: "mdep",
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
<p>A membership filter is a small table that answers one question before a load searches the store queue: could any store in the SQ touch this address? When the answer is no, the load skips the search. This page expands the "filter before searching" idea from <a href="#/lsq/search-hardware">Search Hardware and Load-to-Use Latency</a> and uses the same Golden Cove-sized core: 114 SQ entries, 3 load ports, and 2 stores per cycle written to L1. The main source is Sethumadhavan, Desikan, Burger, Moore, and Keckler (MICRO 2003), who used Bloom filters to avoid up to 98% of associative LSQ searches. The counting Bloom filter itself comes from Fan, Cao, Almeida, and Broder's summary cache work (IEEE/ACM Transactions on Networking, 2000).</p>
<h3 id="sec-why">Why Filter the Search</h3>
<p>The <a href="#/lsq/search-hardware">search hardware</a> section showed that every load drives every SQ entry's comparator. Three load ports searching 114 entries make 342 address compares in a cycle, and most of those searches find nothing, because most loads don't read an address that an in-flight store is writing. The CAM still spends the energy, and its broadcast wires, encoder, and data bitlines still set how big the SQ can get before it no longer fits in the L1's cycles.</p>
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
<p>The lookup is one read of a small RAM, so it fits in a cycle easily. What matters is when its index is ready. On a core with 4 KiB pages, bits 11–0 are the same in the virtual and physical address, so a filter indexed only by those bits can start as soon as the AGU produces the address, in parallel with the DTLB, the same trick a VIPT L1 uses. On this page's core, bits 11–3 give 512 counters at 8-byte granularity.</p>
<p>Indexing by page offset has a known downside: two addresses exactly a multiple of 4 KiB apart always share a counter. Intel's optimization manual documents a related effect it calls <strong>4K aliasing</strong>: a load is delayed when an older store matches it in bits 11–0, even though the full addresses differ. That tells us Intel's first SQ check looks only at the untranslated bits, for the same timing reason.</p>
<p>A designer can use the filter's answer in two ways:</p>
<ul>
<li><strong>Energy only.</strong> The filter runs a cycle ahead of the CAM, or alongside it, and gates the CAM's broadcast and match lines off when the counter is zero. Load latency doesn't change. Most of the search energy goes away.</li>
<li><strong>Latency too.</strong> This is the "make forwarding slower" option from the <a href="#/lsq/search-hardware">search hardware</a> section, with a guard. Loads the filter clears go on the L1-latency path, and loads it doesn't clear take a slower search. The SQ can then grow past what fits in the L1's cycles without every load paying. The cost is a scheduler that must know which latency to expect before the filter answers, so it wakes dependents for the fast case and replays them when the filter says search.</li>
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
  id: "mdp",
  region: "mdep",
  title: "Why Predict Memory Dependences",
  sections: [
    { id: "why", label: "Why Predict Memory Dependences" }
  ],
  body: `
<p>Most loads never touch the bytes an older in-flight store is about to write, so letting them run ahead is almost always the right call. The rare exception is costly: a load that reads too early returns stale data, and the core must squash it along with every younger instruction. A memory dependence predictor learns which loads are the exceptions. It remembers the stores each load has collided with in the past and holds that load back only until those stores have issued, while every other load runs freely.</p>

<h3 id="sec-why">Why Predict Memory Dependences</h3>
<p>An out-of-order core must respect two kinds of data dependence:</p>
<ul>
<li><strong>Register dependences:</strong> one instruction writes a register and a later one reads it. Decode finds these by comparing register fields, and renaming turns them into tags the scheduler can wait on.</li>
<li><strong>Memory dependences:</strong> a store writes a location and a later load reads it. These can't be found at decode, because the addresses don't exist yet. A store's address is known only after its address operands are ready and its address-generation µop has run, which can be many cycles after decode.</li>
</ul>
<p>So when a load's own address is ready, the scheduler often sees older stores with unknown addresses. It has two simple choices, and both are bad:</p>
<ul>
<li><strong>Make the load wait for every older store.</strong> This can never break memory order. But most loads don't read anything those stores write, so most of them end up <strong>falsely dependent</strong>: they wait for stores they have nothing to do with, and the wait lands on the critical path whenever later work needs the load's value.</li>
<li><strong>Let the load go.</strong> This is usually right. When an older store turns out to write bytes the load read, the load got a stale value. That's a <strong>memory-order violation</strong>, and the load plus every younger instruction must be squashed and re-executed (see <a href="#/flush-recovery">Pipeline Flush and Recovery</a>).</li>
</ul>
<p>Chrysos and Emer give a memory dependence predictor two goals:</p>
<ol>
<li>Predict which loads would cause a violation if they executed early.</li>
<li>Delay those loads only as long as needed to avoid the violation, and no longer.</li>
</ol>
<p>A wrong prediction fails one of these goals. Missing goal 1 causes a violation. Missing goal 2 causes a false dependence. Their predictor uses <strong>store sets</strong>: a load's store set is every store it has ever depended on. The core finds a load's store set by starting with naive speculation (every load goes early) and adding a store to the set each time that store catches the load in a violation. After that, the load waits only for in-flight stores in its set. The paper's question is whether this simple history-based rule can get close to perfect dependence knowledge in an 8-wide, 128-entry-queue core, and whether it can be built cheaply.</p>
<p class="refs">References: Chrysos and Emer, "Memory Dependence Prediction using Store Sets," ISCA 1998 · Hennessy and Patterson, Computer Architecture: A Quantitative Approach, chapter 3</p>`,
  practice: {
    guided: [
      {
        q: `<p>This loop scatters values into <code>a</code> and sums <code>b</code>:</p><pre><code>for (i = 0; i &lt; n; i++) {
  a[idx[i]] = v[i];
  s += b[i];
}</code></pre><p>In iteration 5, the load of <code>b[5]</code> has its address ready. The stores to <code>a[idx[3]]</code> and <code>a[idx[4]]</code> are still waiting for their <code>idx</code> loads, which missed in the cache. List the dependences decode can see and the ones it can't, then say what each simple policy does with <code>b[5]</code>, including the case where <code>&amp;a[idx[4]]</code> equals <code>&amp;b[5]</code>.</p>`,
        a: `<ol><li>Register dependences decode can see: <code>s += b[i]</code> reads the <code>s</code> written by the previous iteration, and each store's address register comes from that iteration's <code>idx[i]</code> load. Both are visible from register names.</li><li>Memory dependences decode can't see: whether <code>a[idx[3]]</code> or <code>a[idx[4]]</code> is the same location as <code>b[5]</code> depends on the run-time values of <code>idx</code>, and the compiler can't rule it out either unless it knows <code>a</code> and <code>b</code> don't overlap.</li><li>Wait for every older store: <code>b[5]</code> waits until both stores issue, which is after the <code>idx</code> misses return. In nearly every run the stores write elsewhere, so this is a false dependence, and the add chain on <code>s</code> stalls behind cache misses it never needed.</li><li>Let it go: <code>b[5]</code> reads the cache right away. Usually that's correct. If <code>&amp;a[idx[4]]</code> equals <code>&amp;b[5]</code>, the store writes those bytes after the load read them, so the load holds a stale value. The store's load queue search finds this, and the load and every younger instruction are squashed and refetched.</li><li>A predictor sits between the two: it lets <code>b[5]</code> run freely unless this load has collided with one of these stores before.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Intel cores since the P6 split each store into a store-address µop and a store-data µop. Suppose a core lets a load issue once every older store's <em>address</em> is known, without waiting for store data. Does that remove the need for memory dependence prediction? Where does it still lose?</p>`,
        a: `<p>It removes one source of false dependences: a load no longer waits for a store whose address is known and different but whose data is late. Once all older addresses are known, the core can also tell exactly which store, if any, to forward from.</p><p>It doesn't remove the problem, because store addresses can be late too:</p><ul><li><strong>Address from a slow load:</strong> a store through a pointer, such as <code>p-&gt;next-&gt;val = x</code>, can't compute its address until a pointer load returns. If that load misses to DRAM, every younger load waits hundreds of cycles behind an unrelated store.</li><li><strong>Many stores in flight:</strong> in a large window, the chance that at least one older store has an unknown address is high, so most loads still wait for something.</li><li><strong>Critical-path cost:</strong> the waiting load is often the one feeding a long chain, so even short waits show up in IPC.</li></ul><p>So the policy is "no speculation" with a smaller penalty. A predictor still wins by letting the loads that never conflict run ahead of unknown store addresses, and by holding back only the few that do.</p>`
      }
    ]
  }
},

{
  id: "mdp-metrics",
  region: "mdep",
  title: "Metrics, Bounds, and Window Size",
  sections: [
    { id: "metrics", label: "Metrics" },
    { id: "bounds", label: "Never, Always, and Perfect" },
    { id: "window", label: "Why Window Size Matters" }
  ],
  body: `
<p>A predictor trades violations for false dependences, so comparing designs needs a way to count both and a sense of how much is at stake. This page sets up the scoring, measures the two cheap policies against an oracle, and shows why the stakes rise with the size of the instruction window.</p>

<h3 id="sec-metrics">Metrics</h3>
<p>The two failure modes give the two counts used throughout the paper and this page:</p>
<ul>
<li><strong>Memory-order violations</strong> per 1,000 instructions (or per committed load). Like branch mispredictions per 1,000 instructions, the count matters only together with the penalty per event.</li>
<li><strong>False dependences</strong> per 1,000 instructions: the number of times a load was made to wait for a store whose address turned out not to overlap.</li>
<li><strong>IPC compared with a perfect predictor:</strong> the only measure that combines both. A false dependence off the critical path costs nothing, and one on it costs its full delay, so counts alone can mislead.</li>
</ul>
<p>The paper also sorts every dynamic load into one of four bins: not predicted (empty store set, ran freely), predicted correctly, falsely dependent, or caused a violation.</p>

<h3 id="sec-bounds">Never, Always, and Perfect</h3>
<p>Before building a predictor, the paper measures what is at stake. It runs two policies that cost almost no hardware and compares them with an oracle. The two policies bound the problem from both sides:</p>
<ul>
<li><strong>No speculation</strong> isolates the cost of false dependences, because it has no violations.</li>
<li><strong>Naive speculation</strong> isolates the cost of violations, because it has no false dependences.</li>
<li><strong>Perfect prediction</strong> has neither, so the gap between it and each policy is what that failure mode costs.</li>
</ul>

<p><strong>The simulated machine.</strong> The model is roughly twice an Alpha 21264 (caches and issue width) and runs the Alpha instruction set:</p>
<ul>
<li>128-entry instruction queue, sized by doubling it until performance stopped improving</li>
<li>Up to 8 instructions issued per cycle</li>
<li>4 data cache ports, usable by any mix of loads and stores</li>
<li>128 KB 2-way instruction cache and 128 KB 2-way write-back data cache</li>
<li>8 MB direct-mapped write-back unified L2</li>
<li>Aggressive fetch that fetches several basic blocks per cycle, steered by a McFarling-style choosing branch predictor</li>
</ul>
<p>The core detects violations with a table of the addresses of all loads that executed speculatively, which each store checks when it executes (the load queue search on <a href="#/lsq/catching-violations">Load and Store Queues</a>). It recovers by <strong>trapping</strong>: it squashes the offending load and every younger instruction, whether or not they depend on the load, and refetches starting at the load, beginning the cycle after detection. The workload is SPEC95, compiled with full optimization, run for 100 million instructions after skipping initialization and warming the caches.</p>

<p><strong>No speculation.</strong> Every load waits until all older stores have issued. Since a store must wait for both its address and its data registers before it issues, a load can also end up waiting on a store's data even when the address is known and different. (A footnote suggests splitting stores into an address operation and a data operation to shorten this wait, but the paper doesn't model it.) The rightmost column of the table below counts false dependences: times a load waited for nothing. At 129 to 275 per 1,000 instructions, and with only about 170 to 310 loads per 1,000 instructions in these programs, false dependences are about as common as loads themselves. Some benchmarks run more than 2× slower than with perfect prediction.</p>

<p><strong>Naive speculation.</strong> Loads issue as soon as their register operands are ready, with no predictor. Violations range from 0 to 24 per 1,000 instructions, which is 0 to 7% of dynamic loads. To turn counts into cost, the paper defines the <strong>memory trap penalty</strong>: the cycles between the first fetch of the violating load and its refetch after the violation is detected. That is roughly the number of cycles in which the front end fetched no useful instructions. It varies from load to load, because it depends on how long the conflicting store takes to execute and expose the violation.</p>
<div class="tbl"><table>
<tr><th rowspan="2">SPEC95 program</th><th colspan="2">Naive speculation</th><th>No speculation</th></tr>
<tr><th>Violations per 1,000 instructions</th><th>Memory trap penalty (cycles)</th><th>False dependences per 1,000 instructions</th></tr>
<tr><td>go</td><td>6</td><td>13</td><td>157</td></tr>
<tr><td>m88ksim</td><td>20</td><td>12</td><td>168</td></tr>
<tr><td>gcc</td><td>5</td><td>15</td><td>187</td></tr>
<tr><td>compress</td><td>11</td><td>15</td><td>129</td></tr>
<tr><td>xlisp</td><td>11</td><td>14</td><td>179</td></tr>
<tr><td>ijpeg</td><td>23</td><td>15</td><td>150</td></tr>
<tr><td>perl (primes)</td><td>20</td><td>15</td><td>215</td></tr>
<tr><td>perl (scrabble)</td><td>10</td><td>15</td><td>185</td></tr>
<tr><td>vortex</td><td>7</td><td>19</td><td>215</td></tr>
<tr><td>tomcatv</td><td>4</td><td>22</td><td>264</td></tr>
<tr><td>swim</td><td>2</td><td>36</td><td>224</td></tr>
<tr><td>mgrid</td><td>0</td><td>18</td><td>262</td></tr>
<tr><td>applu</td><td>18</td><td>22</td><td>212</td></tr>
<tr><td>apsi</td><td>7</td><td>35</td><td>247</td></tr>
<tr><td>fpppp</td><td>10</td><td>17</td><td>275</td></tr>
<tr><td>wave5</td><td>24</td><td>21</td><td>188</td></tr>
<tr><td>turb3d</td><td>6</td><td>16</td><td>213</td></tr>
</table></div>
<p>A rough product of the two naive-speculation columns shows why violations can't be ignored. wave5 loses about 24 violations per 1,000 instructions × 21 cycles per violation ≈ 504 cycles per 1,000 instructions of fetch time. At this machine's IPC of a few instructions per cycle, 1,000 instructions take only a few hundred cycles, so the lost fetch time is comparable to the program's whole run time.</p>
<p><strong>Why not replay only the dependents?</strong> Tyson and Austin proposed re-executing just the violating load and the instructions that depend on it, instead of squashing everything younger. Replay is not refetch. A squash throws away the load and every younger instruction, and fetch restarts at the load's PC, so even instructions that never touched the load's value go back through fetch, decode, rename, and issue. A replay leaves every instruction in the window. The load's correct value is broadcast again, and only the instructions that consumed the wrong one issue again, straight from the issue queue, with no trip through the front end. That would cut the trap penalty, but it has a cost the paper cares about: an instruction that might be replayed has to stay in the issue queue until it retires. The 21264 instead frees issue queue entries as soon as instructions issue, so newer instructions can compete for issue slots sooner. A smaller queue then finds as much ILP as a larger one would, which helps cycle time. Chrysos and Emer choose to keep early deallocation and make violations so rare that their penalty doesn't matter. The full replay mechanism and its costs are on <a href="#/replay">Selective Replay</a>.</p>

<p><strong>Perfect prediction.</strong> An oracle makes each load wait for exactly the store it depends on, and for nothing else. The paper's Figure 3.1 compares the three policies. Approximate IPC values read from that bar chart:</p>
<div class="tbl"><table>
<tr><th>Program</th><th>No speculation (IPC)</th><th>Naive speculation (IPC)</th><th>Perfect (IPC)</th></tr>
<tr><td>fpppp</td><td>≈ 2.0</td><td>≈ 3.3</td><td>≈ 5.7</td></tr>
<tr><td>turb3d</td><td>≈ 2.5</td><td>≈ 4.2</td><td>≈ 6.1</td></tr>
<tr><td>ijpeg</td><td>≈ 1.8</td><td>≈ 2.0</td><td>≈ 4.6</td></tr>
<tr><td>perl (primes)</td><td>≈ 2.1</td><td>≈ 2.2</td><td>≈ 5.1</td></tr>
<tr><td>vortex</td><td>≈ 2.8</td><td>≈ 3.5</td><td>≈ 5.1</td></tr>
<tr><td>swim</td><td>≈ 2.1</td><td>≈ 3.7</td><td>≈ 3.9</td></tr>
<tr><td>mgrid</td><td>≈ 3.3</td><td>≈ 5.2</td><td>≈ 5.2</td></tr>
</table></div>
<p>The conclusions:</p>
<ul>
<li>Naive speculation usually beats no speculation, so loads should be allowed to pass stores.</li>
<li>Most programs still run far below perfect under naive speculation. ijpeg and perl (primes), with 20 or more violations per 1,000 instructions, barely improve on no speculation and run at less than half of perfect.</li>
<li>Programs with almost no violations (mgrid at 0, swim at 2 per 1,000 instructions) are already near perfect with naive speculation. For them, the only job of a predictor is to do no harm.</li>
<li>So the opportunity is the whole gap between naive speculation and perfect, and a predictor must close it without adding false dependences.</li>
</ul>

<h3 id="sec-window">Why Window Size Matters</h3>
<p>Chrysos and Emer state that dependence prediction matters more for wider cores with larger windows, but they measure only one machine. Four effects all grow with the window:</p>
<ol>
<li><strong>Exposure:</strong> a store and a later load can conflict only if both are in flight at once, so only dependences whose distance in dynamic instructions is shorter than the window matter. A larger window exposes more store-load pairs.</li>
<li><strong>Unknown older stores:</strong> the more instructions in flight, the more older stores a ready load sees with unresolved addresses, so the chance that at least one of them aliases goes up.</li>
<li><strong>Cost per violation:</strong> a violation squashes the load and everything younger. A larger window holds more younger work to throw away and takes longer to refill.</li>
<li><strong>Cost of waiting conservatively:</strong> a load that waits for all older stores waits for more unrelated stores, so both no speculation and simple wait bits get worse.</li>
</ol>
<p>Moshovos et al. measured the first effect directly. Their "unrealistic out-of-order" model holds a perfect continuous window of n instructions and counts every true store-to-load dependence closer than n instructions as a misspeculation. That's a worst case, the number of violations blind speculation could cause. The table converts their counts (Table 3, divided by the committed instruction counts in their Table 1) to violations per 1,000 instructions for SPECint92:</p>
<div class="tbl"><table>
<tr><th>Window (instructions)</th><th>compress</th><th>espresso</th><th>gcc</th><th>sc</th><th>xlisp</th></tr>
<tr><td>8</td><td>0.00045</td><td>0.08</td><td>3.78</td><td>6.80</td><td>8.22</td></tr>
<tr><td>32</td><td>33.7</td><td>2.37</td><td>21.5</td><td>25.9</td><td>35.1</td></tr>
<tr><td>128</td><td>59.0</td><td>18.2</td><td>45.6</td><td>61.2</td><td>80.1</td></tr>
<tr><td>512</td><td>82.9</td><td>28.8</td><td>68.8</td><td>80.9</td><td>107.9</td></tr>
</table></div>
<p>What the data shows:</p>
<ul>
<li><strong>Most dependences span more than a few instructions.</strong> compress has almost no dependences within 8 instructions but about 34 per 1,000 instructions within 32, and those 24 extra instructions of window can hold many unrelated stores. A 1990s core with a window of a few tens of instructions saw few violations, which is why blind speculation was good enough then.</li>
<li><strong>The rate keeps climbing into hundreds of instructions.</strong> From 128 to 512 instructions, every program gains another 10 to 28 dependences per 1,000 instructions.</li>
<li><strong>More static pairs appear too.</strong> An <em>event</em> is one dynamic store-to-load dependence that the table above counts: a load at run time reads a value written by an older store fewer than n instructions back. A <em>static pair</em> is one (store PC, load PC) combination in the program's code, such as:
<pre><code>p-&gt;count = x;   // store at PC 0x4a10
...
y = p-&gt;count;   // load at PC 0x4a1c</code></pre>
<p>Every time this code runs with the two instructions close enough together, it produces another event, even though the predictor has already seen the pair. A loop that runs 1,000,000 times can produce 1,000,000 events from this single pair. The pair counts below are measured over the whole gcc run, not inside one window, which holds only a store or two and a load at a time:</p>
<ol>
<li>Collect every event, every dynamic dependence with a store-to-load distance under n instructions.</li>
<li>Group the events by their (store PC, load PC) pair.</li>
<li>Sort the pairs from most to fewest events.</li>
<li>Take pairs from the top until they cover 99.9% of all events, and count them.</li>
</ol>
<p>That count goes from 255 pairs at a window of 8 instructions to 8,001 pairs at 512 instructions (their Table 4). gcc is large, and at a window of 8 instructions its close-range dependences come from 255 code locations, such as register spills and reloads or a struct field written and read back. At a window of 512 instructions, pairs farther apart also count, such as a store in a caller and a load in a callee, or a store in one loop iteration and a load several iterations later. A predictor indexed by PC therefore needs more entries for a larger window.</p></li>
<li><strong>But the pairs have temporal locality.</strong> A small cache of recent conflicting pairs captures most events. With a 512-instruction window, a 512-entry cache misses less than 4% of the time for every program (their Table 5). This is the premise store sets also rely on: a few static pairs, repeated many times.</li>
</ul>
<p>On a real out-of-order model (a Multiscalar processor with 4 or 8 processing units, which form 4 or 8 sequential tasks in flight), blind speculation's violations per committed load rise with the larger configuration in every program. For example, compress goes from 0.073 to 0.136 violations per committed load and sc goes from 0.021 to 0.039 (their Table 9). Their own predictor cuts these to 0.00083 and 0.00205 for compress.</p>
<p>They also compared four policies, using perfect knowledge of which loads have dependences:</p>
<ul>
<li><strong>NEVER:</strong> no speculation</li>
<li><strong>ALWAYS:</strong> blind speculation</li>
<li><strong>WAIT:</strong> loads that have a true dependence wait until every older store address is known, and other loads go early</li>
<li><strong>PSYNC:</strong> loads that have a true dependence wait for exactly the right store, and other loads go early</li>
</ul>
<p>The gap between PSYNC and ALWAYS grows from the 4-unit to the 8-unit machine. And WAIT, which is what a wait bit does, loses to plain blind speculation on compress and sc: when the producing store is far back with many unrelated stores in between, waiting for all of them takes longer than an occasional violation. That's the motivation for a predictor that names <em>which</em> store to wait for, and store sets do exactly that. In 145.fpppp the window grew to a few thousand instructions (one loop iteration of about 1,000 instructions per task), and the dependence working set overflowed their prediction tables.</p>
<p><strong>For scale:</strong> the 21264 has at most 80 instructions in flight, and the store sets machine has a 128-entry queue. Current cores are much larger: Intel's Golden Cove has a 512-entry ROB with 192 load buffer and 114 store buffer entries, so a load near the young end can have around a hundred older stores in flight. Hennessy and Patterson's ILP limit study makes the same point from the other side: in an ideal machine, weakening alias analysis (so loads must wait for stores that might alias) is one of the largest limits on ILP once the window is large.</p>
<p class="refs">References: Chrysos and Emer, "Memory Dependence Prediction using Store Sets," ISCA 1998 · Moshovos, Breach, Vijaykumar, and Sohi, "Dynamic Speculation and Synchronization of Data Dependences," ISCA 1997 · Tyson and Austin, "Improving the Accuracy and Performance of Memory Communication Through Renaming," MICRO 1997 · Hennessy and Patterson, Computer Architecture: A Quantitative Approach, chapter 3</p>`,
  practice: {
    guided: [
      {
        q: `<p>A 6-wide core with a 352-entry ROB runs a workload. With perfect memory dependence prediction, its CPI is 0.40 cycles/instruction. Three alternatives were measured:</p><ul><li><strong>Naive speculation:</strong> 2.6 violations per 1,000 instructions, each costing 26 cycles from the load's first fetch to its refetch</li><li><strong>No speculation:</strong> 140 false dependences per 1,000 instructions. 30% of them are on the critical path, and each of those delays it by 9 cycles on average</li><li><strong>Store sets:</strong> 0.05 violations per 1,000 instructions at 26 cycles each, plus 4 false dependences per 1,000 instructions with the same 30% critical fraction and 9-cycle delay</li></ul><p>Assume the penalties add to the perfect CPI with no overlap. Find the CPI of each policy and its slowdown relative to perfect.</p>`,
        a: `<ol><li>Naive speculation: CPI = 0.40 cycles/instruction + (2.6 violations / 1,000 instructions) × 26 cycles/violation = 0.40 cycles/instruction + 0.0676 cycles/instruction = <strong>0.4676 cycles/instruction</strong>, which is 0.4676 / 0.40 = 1.169, so <strong>16.9% slower</strong>.</li><li>No speculation: CPI = 0.40 cycles/instruction + (140 false dependences / 1,000 instructions) × 0.30 × 9 cycles/false dependence = 0.40 cycles/instruction + 0.378 cycles/instruction = <strong>0.778 cycles/instruction</strong>, which is 0.778 / 0.40 = 1.945, so <strong>94.5% slower</strong>.</li><li>Store sets: CPI = 0.40 cycles/instruction + (0.05 violations / 1,000 instructions) × 26 cycles/violation + (4 false dependences / 1,000 instructions) × 0.30 × 9 cycles/false dependence = 0.40 cycles/instruction + 0.0013 cycles/instruction + 0.0108 cycles/instruction = <strong>0.4121 cycles/instruction</strong>, which is 0.4121 / 0.40 = 1.030, so <strong>3.0% slower</strong>.</li><li>The pattern matches the paper. No speculation is the worst, naive speculation leaves a noticeable gap, and a predictor gets most of the way to perfect by trading a large drop in violations for a few false dependences.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A memory dependence predictor gets within 1% of perfect IPC in a simulator whose instruction window holds 64 instructions. Your team wants to ship it unchanged in a core with a 320-entry ROB, like AMD Zen 4. Which conclusions would you not trust, and what would you rerun?</p>`,
        a: `<p>Every cost the predictor manages grows with the window, so the 1% result may only mean little was at stake at 64 instructions:</p><ul><li><strong>Exposure:</strong> store-load pairs farther apart than 64 instructions never conflicted in the simulator. At 320 entries they do, so violation counts rise even for naive speculation.</li><li><strong>Table capacity:</strong> more distinct static pairs are in play (caller-callee pairs, dependences several loop iterations apart), so a PC-indexed table sized for the small window will alias more.</li><li><strong>Penalty per violation:</strong> each flush throws away more younger work and takes longer to refill.</li><li><strong>Cost of waiting:</strong> if the predictor's remedy is "wait for all older stores", a flagged load now waits behind many more unrelated stores.</li></ul><p>What to rerun:</p><ul><li>Simulate at the target window, with naive speculation and an oracle as bounds, to see how large the gap now is.</li><li>Report violations per 1,000 instructions, false dependences, and IPC relative to the oracle, not counts alone.</li><li>Sweep table sizes, and include workloads with long-distance dependences.</li></ul>`
      }
    ]
  }
},

{
  id: "mdp-early",
  region: "mdep",
  title: "Early Predictors",
  sections: [
    { id: "simple-wait-bits", label: "Simple: Wait Bits" },
    { id: "earlier", label: "Other Early Predictors" }
  ],
  body: `
<p><a href="#/mdp-metrics/bounds">Never, Always, and Perfect</a> showed that naive speculation leaves a large gap to perfect, caused by a small number of loads that keep violating. The first predictors simply remembered those loads. This page covers the one that shipped in the Alpha 21264 and the earlier proposals store sets grew out of.</p>

<h3 id="sec-simple-wait-bits">Simple: Wait Bits</h3>
<p>The Alpha 21264 shipped the simplest useful predictor, the <strong>store-wait (stWait) table</strong>:</p>
<ul>
<li>1,024 entries of 1 bit, indexed by the load's PC</li>
<li>When a load causes a store-load order trap, its bit is set as the load is refetched</li>
<li>The issue queue won't issue a load whose bit is set while any older store in the queue is still unissued</li>
<li>Every bit is cleared unconditionally every 16,384 cycles (or every 65,536 cycles if a control bit is set), so loads whose behavior changed get to speculate again</li>
</ul>
<p>A load with its bit set behaves like the no speculation policy: it waits for <em>every</em> older store, which is Moshovos's WAIT policy from <a href="#/mdp-metrics/window">Why Window Size Matters</a>. In an 80-instruction window, with few older stores in flight, that's cheap. In a larger window, it forces a flagged load to wait behind many unrelated stores, and a single conflict is enough to flag the load until the next clear.</p>

<h3 id="sec-earlier">Other Early Predictors</h3>
<p>Store sets built on several earlier ideas, which the paper surveys:</p>
<ul>
<li><strong>Memory reference tagging (Steely, Sager, and Fite, DEC patent):</strong> a general framework that gives loads and stores that caused violations the same tag and orders memory operations that share a tag. Store sets' SSID is a "common tag" of this kind.</li>
<li><strong>Store barrier cache (Hesson et al., IBM patent):</strong> a store that caused a violation sets a bit in the store barrier cache. When a store with that bit set is fetched, all later loads wait until the store executes. The store becomes a barrier, which is conservative for loads that never touch its address.</li>
<li><strong>Dependence prediction and synchronization (Moshovos et al., ISCA 1997):</strong> the first published work to show that memory dependences are a problem for out-of-order machines. They pointed out that a dependent load should wait only as long as necessary and that false dependences must be avoided. Their design keeps two fully associative tables: one holds the store-load pairs that caused violations, and the other synchronizes later instances of those pairs.</li>
<li><strong>Using prediction for communication:</strong> Moshovos and Sohi (MICRO 1997) used dependence prediction to forward store data straight to dependent loads. Tyson and Austin (MICRO 1997) combined dependence prediction with value prediction to get values to a load's consumers early. These goals are different from scheduling, but they could use the same predictor.</li>
</ul>
<p>Store sets started from a remark in the Moshovos and Sohi forwarding paper. The idea is to replace a list of (load, store) pairs with a set per load, built from direct-mapped tables.</p>
<p class="refs">References: Chrysos and Emer, "Memory Dependence Prediction using Store Sets," ISCA 1998 · Compaq, Alpha 21264/EV67 Microprocessor Hardware Reference Manual (stWait table) · Moshovos, Breach, Vijaykumar, and Sohi, "Dynamic Speculation and Synchronization of Data Dependences," ISCA 1997 · Moshovos and Sohi, "Streamlining Inter-operation Memory Communication via Data Dependence Prediction," MICRO 1997 · Tyson and Austin, "Improving the Accuracy and Performance of Memory Communication Through Renaming," MICRO 1997</p>`,
  practice: {
    guided: [
      {
        q: `<p>A load L is ready to issue at cycle 0. Thirty older stores are still unissued. L truly depends on only one of them, store S, which issues at cycle 3. The last of the thirty waits for data from an L3 hit and issues at cycle 46. Assume:</p><ul><li>A load that waits for a store issues the cycle after that store issues.</li><li>A violation is detected when the conflicting store issues, and the refetched load reaches issue again 20 cycles later.</li><li>Under store sets, S is the last fetched store of L's set.</li></ul><p>When does L issue for the last time under naive speculation, under a wait bit that is set, and under store sets?</p>`,
        a: `<ol><li>Naive speculation: L issues at cycle 0 and reads stale data. S issues at cycle 3 and detects the violation. L and everything younger are squashed, and L issues again at cycle 3 + 20 cycles = <strong>cycle 23</strong>.</li><li>Wait bit: L waits for every older store, so it waits for the one at cycle 46 and issues at <strong>cycle 47</strong>.</li><li>Store sets: L waits only for S and issues at <strong>cycle 4</strong>.</li><li>The wait bit is 24 cycles later than even the violation, which is Moshovos's finding that WAIT can lose to blind speculation when unrelated stores are slow. (Naive speculation also wastes the squashed younger work, so the comparison isn't free for it either.) Naming the store gets the best of both.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A store barrier cache marks stores, and a wait table marks loads. Give a code pattern where the store barrier cache does much worse than a wait table, and one where it does better.</p>`,
        a: `<p><strong>Worse:</strong> a store that conflicts with one load but is followed by many unrelated ones. A typical case is a register spill to the stack, reloaded once a few instructions later, inside a function that then does a long run of array loads. One violation marks the spill store as a barrier, and from then on every later load waits for it, including the array loads that never touch the stack. A wait table would flag only the reload.</p><p><strong>Better:</strong> one store read by many different loads, such as a store to a shared counter or a struct field that several functions read soon after. The barrier cache learns it after a single violation, since all the readers wait for that one store. A wait table needs one violation per load PC to flag each reader, and each one then waits for every older store instead of just this one.</p><p>Store sets cover both, since they record pairs: the spill store joins only the reload's set, and the counter store joins one set shared by all its readers.</p>`
      },
      {
        q: `<p>A core uses a 2,048-entry, 1-bit wait table indexed by load PC and cleared every 32,768 cycles. A flagged load waits for all older stores. The next generation grows the ROB from 224 to 512 entries and the store queue from 72 to 114 entries. Simulation shows memory-order violations rising from 0.3 to 1.1 per 1,000 instructions, and the IPC gain is well below what the larger window should give. Explain both effects and propose a change.</p>`,
        a: `<p>Violations rise because a larger window exposes store-load pairs that are farther apart. A pair can conflict only if both are in flight together, and Moshovos et al. found the count of such dependences keeps rising as the window grows into the hundreds of instructions. Each violation also costs more, since more younger work is squashed and refilling a 512-entry window takes longer.</p><p>The IPC shortfall has a second cause: the wait table's remedy also gets worse. A flagged load waits for every older store, and with up to 114 stores in flight it often waits behind dozens of unrelated ones. That's Moshovos's WAIT policy, which can lose even to blind speculation when the producing store is far away. A 32,768-cycle clear also means a single conflict flags the load for a long time.</p><p>The fix is a predictor that names the store: store sets (SSIT plus LFST) or a store-distance predictor, so a flagged load waits only for the latest in-flight store of its set. Size the SSIT for the larger number of static pairs a bigger window exposes. Then measure false dependences on the critical path, not just violation counts.</p>`
      }
    ]
  }
},

{
  id: "mdp-store-sets",
  region: "mdep",
  title: "Store Sets",
  sections: [
    { id: "store-sets", label: "Store Sets: The Concept" },
    { id: "ideal", label: "How Well Ideal Store Sets Do" }
  ],
  body: `
<p>Wait bits know <em>that</em> a load conflicts but not <em>with which store</em>, so a flagged load waits for every older store. Store sets record the stores themselves. This page builds the idea with unlimited hardware and measures how close it gets to perfect, before <a href="#/mdp-ssit">Store Sets in Hardware</a> fits it into small tables.</p>

<h3 id="sec-store-sets">Store Sets: The Concept</h3>
<p>Store sets rest on two premises:</p>
<ol>
<li>The history of memory-order violations predicts future memory dependences well.</li>
<li>A predictor must handle both a load that depends on several stores and several loads that depend on the same store.</li>
</ol>
<p>Every static load gets a <strong>store set</strong>: the store PCs it has ever depended on. Stores and loads are identified by PC. At program start every set is empty, so every load speculates. When a load and a store execute in the wrong order and cause a violation, the store's PC is added to the load's set. The next time that load is fetched, the core checks which stores in its set were recently fetched but haven't issued, and makes the load depend on them. Loads that never violate have empty sets and run as early as possible. And if a store in set A causes a violation with a different load, it joins that load's set too.</p>
<p>The paper's example, with PCs in bytes:</p>
<div class="tbl"><table>
<tr><th>PC</th><th>Instruction</th><th>Store set</th></tr>
<tr><td>0</td><td>store C</td><td></td></tr>
<tr><td>4</td><td>store A</td><td></td></tr>
<tr><td>8</td><td>store B</td><td></td></tr>
<tr><td>12</td><td>store C</td><td></td></tr>
<tr><td>28</td><td>load B</td><td>{PC 8}</td></tr>
<tr><td>32</td><td>load D</td><td>{ } (empty)</td></tr>
<tr><td>36</td><td>load C</td><td>{PC 0, PC 12}</td></tr>
<tr><td>40</td><td>load B</td><td>{PC 8}</td></tr>
</table></div>
<p>The load at PC 36 depends on two stores, and the loads at PC 28 and PC 40 both depend on the store at PC 8. The second case (many loads, one store) is common: it's one writer and several readers of a value. The first case (one load, many stores) is less common but real:</p>
<ul>
<li><strong>Stores on different paths:</strong> <code>if (expr) x = a; else x = b; ... c = x;</code> The load of x depends on whichever store ran.</li>
<li><strong>Packed fields:</strong> separate stores write the red, green, and blue fields of a color word, and one load reads the whole word.</li>
<li><strong>Write-after-write chains:</strong> if repeated stores to one location are treated as dependences, a load depends on a series of stores, for example several spills to the same stack slot.</li>
</ul>
<p>To test whether both kinds of flexibility matter, the paper ran three idealized configurations:</p>
<ol>
<li><strong>Each store in only one set, each set unbounded:</strong> a store that causes a violation moves to the set of the load it conflicted with last. Two loads can't share a store.</li>
<li><strong>Each set holds one store, and a store can be in any number of sets:</strong> a new violation replaces the store in the load's set. A load can't depend on two stores.</li>
<li><strong>"Infinite":</strong> no limits on set size or on how many sets a store is in.</li>
</ol>
<p>Run time relative to the infinite configuration (the paper's Figure 5.1, read from the chart):</p>
<div class="tbl"><table>
<tr><th>Program</th><th>Only one load per store</th><th>At most one store per load</th></tr>
<tr><td>perl (primes)</td><td>≈ 1.47×</td><td>≈ 1.30×</td></tr>
<tr><td>wave5</td><td>≈ 1.43×</td><td>≈ 1.08×</td></tr>
<tr><td>m88ksim</td><td>≈ 1.30×</td><td>≈ 1.15×</td></tr>
<tr><td>vortex</td><td>≈ 1.24×</td><td>≈ 1.00×</td></tr>
<tr><td>xlisp</td><td>≈ 1.24×</td><td>≈ 1.02×</td></tr>
</table></div>
<p>Either limit costs a lot of performance on some programs, and preventing loads from sharing a store hurts more. In a side experiment, the second configuration was allowed 2, 4, or 8 stores per load. Eight stores per load (an 8-way associative set) lost nothing, and 4 was nearly as good, with only perl (primes) losing much. Section 6 of the paper keeps both kinds of flexibility while using direct-mapped tables.</p>

<h3 id="sec-ideal">How Well Ideal Store Sets Do</h3>
<p>Using the infinite configuration, the paper classifies each dynamic load (its Figure 5.2). Violations almost vanish in every program. The cost shows up as false dependences in a few programs: applu and xlisp have the most (roughly 25 to 30 per 1,000 instructions), and vortex, gcc, go, and swim have a few.</p>
<p>The cause is that a store set only grows. Once a store PC is in a load's set, every later instance of the load waits for every in-flight instance of that store for the rest of the run. If the pair touches the same address only occasionally, the core pays many false dependences to avoid a few violations. That suggests tracking a <strong>working</strong> store set: the stores the load has depended on <em>recently</em>.</p>
<p>The paper uses a fix borrowed from branch prediction: a 2-bit saturating counter on each store in a set.</p>
<ul>
<li>On a violation, the counter is set to its maximum, 3.</li>
<li>After a load has been forced to wait for a store in its set, the two addresses are compared. If they really overlapped, the counter goes up by 1. If they didn't, it goes down by 1.</li>
<li>The load waits for the store only while the counter's high bit is set.</li>
</ul>
<p>This lowers false dependences, at the risk of letting violations come back for patterns that a 2-bit counter can't follow. In practice, violations stayed rare (Figure 5.3), and applu was the only program left with many false dependences.</p>
<p>Results (Figure 5.4): infinite store sets come close to perfect on every program. The worst is applu, at 10 to 14% below perfect, which is the program with the most false dependences. The counters help xlisp and applu slightly, but not by enough to clearly justify them. In a few programs, "perfect" was slightly <em>slower</em> than store sets. That's a modeling artifact: the perfect configuration also stops wrong-path execution after a branch mispredict, and wrong-path loads have both a prefetching benefit and a cache-thrashing cost, worth about ±2%. The conclusion: if hardware can approximate infinite store sets, it gets nearly perfect performance.</p>
<p class="refs">References: Chrysos and Emer, "Memory Dependence Prediction using Store Sets," ISCA 1998</p>`,
  practice: {
    guided: [
      {
        q: `<p>Two stores and two loads run in a loop: S1 at PC 0x7f08, S2 at PC 0x7f1c, L1 at PC 0x7f40, and L2 at PC 0x7f58. These violations happen in order:</p><ol><li>L1 with S1</li><li>L2 with S1</li><li>L1 with S2</li></ol><p>Give each load's store set after these violations under the infinite configuration, under configuration 1 (each store in only one set), and under configuration 2 (each set holds one store). Assume every pair conflicts every time it runs. What happens on later iterations in each case?</p>`,
        a: `<ol><li>Infinite: L1 = {S1, S2}, L2 = {S1}. Both loads wait for every store they conflict with, so no further violations occur.</li><li>Configuration 1: after violation 1, S1 is in L1's set. Violation 2 moves S1 to L2's set, leaving L1's set empty. Violation 3 adds S2 to L1's set. Result: L1 = {S2}, L2 = {S1}.</li><li>Later iterations under configuration 1: L1 no longer waits for S1, so it violates with it, and S1 moves back to L1's set. Now L2 doesn't wait for S1 and violates, and S1 moves again. S1 ping-pongs between the two loads, costing a violation on every move.</li><li>Configuration 2: violation 1 sets L1 = {S1}, violation 2 sets L2 = {S1}, and violation 3 replaces S1 with S2, so L1 = {S2}, L2 = {S1}.</li><li>Later iterations under configuration 2: L1 waits only for S2, so it violates with S1, which replaces S2. Then it violates with S2 again. L1 alternates between its two stores, and L2 is fine.</li><li>This is the paper's point: S1 has two readers and L1 has two writers, and each limited configuration breaks one of those cases.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>An infinite store set predictor uses 2-bit counters. A load and a store in its set overlap on every 4th instance in a fixed pattern: overlap, no, no, no, then repeat. A violation sets the counter to 3, and the counter changes only when the load was made to wait (+1 on overlap, −1 on no overlap). The load waits while the counter is 2 or 3. A violation costs 18 cycles, and each false dependence costs 5 cycles on the critical path. Find the steady-state cost per 4 instances with counters, with store sets but no counters, and with naive speculation.</p>`,
        a: `<ol><li>With counters, start right after the violation on an overlap instance, counter = 3.</li><li>Instance "no": counter 3, so the load waits needlessly (false dependence), counter 3 − 1 = 2.</li><li>Instance "no": counter 2, waits needlessly again, counter 2 − 1 = 1.</li><li>Instance "no": counter 1, the load doesn't wait and there's no overlap, so this one is correct and the counter stays 1.</li><li>Instance "overlap": counter 1, the load doesn't wait, so it violates and the counter goes back to 3.</li><li>Cost with counters: 1 violation × 18 cycles/violation + 2 false dependences × 5 cycles/false dependence = <strong>28 cycles per 4 instances</strong>.</li><li>No counters: the load always waits, so 3 false dependences × 5 cycles/false dependence = <strong>15 cycles per 4 instances</strong>, with no violations.</li><li>Naive speculation: 1 violation × 18 cycles/violation = <strong>18 cycles per 4 instances</strong>.</li><li>The counters are the worst of the three here. Their hysteresis is two wrong waits, shorter than the pattern's run of three "no" instances, so they give up waiting just before the overlap. That's the risk the paper names: counters cut false dependences but can bring violations back for patterns a 2-bit counter can't follow.</li></ol>`
      }
    ]
  }
},

{
  id: "mdp-ssit",
  region: "mdep",
  title: "Store Sets in Hardware",
  sections: [
    { id: "impl", label: "The SSIT and LFST" },
    { id: "assignment", label: "Store Set Assignment and Merging" },
    { id: "feedback", label: "Clearing Stale Entries" },
    { id: "table-sizes", label: "Table Sizes" }
  ],
  body: `
<p>Ideal store sets come close to perfect, but they assume a load can wait on any number of stores and a store can belong to any number of sets. This page follows the paper's hardware version: two direct-mapped tables, rules for assigning and merging sets, a way to forget stale entries, and the table sizes that keep it within a few percent of perfect.</p>

<h3 id="sec-impl">The SSIT and LFST</h3>
<p>Infinite store sets need two kinds of flexibility that are expensive in hardware: a load waiting on several stores, and a store in several sets. The implementation adds three restrictions and recovers most of what they lose:</p>
<ul>
<li><strong>Finite, direct-mapped, untagged tables.</strong> Unrelated loads may share a set by aliasing, which can add false dependences.</li>
<li><strong>A store is in at most one store set at a time</strong> (like configuration 1 on <a href="#/mdp-store-sets/store-sets">Store Sets</a>). Merging (next section) lets two loads that depend on the same store share one set.</li>
<li><strong>Stores in one set execute in program order.</strong> A load in a set with several stores would need to wait for all of them, but hardware doesn't know which will finish last, and a load with several dependence tags makes the scheduler more complex. Instead, each store depends on the previous fetched store in its set, and each load depends on the last fetched store in its set. The stores form an in-order chain, and the load waits on the end of the chain, so it waits for all of them with one dependence.</li>
</ul>
<p>The in-order chain has a second benefit. If two stores in a set both write address X and a load of X follows, the load really depends only on the second store. Because the two stores execute in order, the core doesn't need any write-after-write detection to work this out.</p>
<p>The hardware is two tables:</p>
<div class="tbl"><table>
<tr><th>Table</th><th>Indexed by</th><th>Entry holds</th><th>Purpose</th></tr>
<tr><td>Store Set Identifier Table (SSIT)</td><td>Load or store PC (low bits, no tag)</td><td>A valid bit and a store set identifier (SSID)</td><td>Gives a load and the stores in its set a common tag</td></tr>
<tr><td>Last Fetched Store Table (LFST)</td><td>SSID</td><td>A valid bit and the inum of the most recently fetched store in that set</td><td>Says which in-flight store the next load or store of the set must wait for</td></tr>
</table></div>
<p>An <strong>inum</strong> is a hardware tag that uniquely names one in-flight instruction instance, such as its ROB index. Both tables are read in the front end, so the dependence is known by the time the instruction enters the scheduler:</p>
<ul>
<li><strong>A load is fetched:</strong> it reads SSIT[load PC]. If the SSID is valid, it reads LFST[SSID]. If that entry is valid, the load becomes dependent on that store's inum, the same way it would wait on a register tag.</li>
<li><strong>A store is fetched:</strong> it reads SSIT[store PC]. If the SSID is valid, it reads LFST[SSID] and, if that entry is valid, becomes dependent on that earlier store (the in-order chain). Then it writes its own inum into LFST[SSID], since it is now the last fetched store of the set.</li>
<li><strong>A store issues:</strong> it checks LFST[SSID] and invalidates the entry if it still holds this store's inum. Later loads and stores then won't wait for a store that has already issued.</li>
</ul>
<p>Stores on different control paths fit naturally. Only the store that is actually fetched updates the LFST, so the load always waits for the store on the path taken, and the two stores never wait for each other because they're never both fetched.</p>
<p><strong>Recovery.</strong> After a branch mispredict, jump mispredict, or violation, the SSIT doesn't change, because it holds learned history, not in-flight state. The LFST may point to squashed stores. A load that waits for a store that will never issue would hang (see <a href="#/flush-recovery">Pipeline Flush and Recovery</a>). Ideally each LFST entry would roll back to the last surviving store that wrote it. The paper modeled that but argues that simply invalidating entries that name aborted stores is enough.</p>
<p><strong>A full example.</strong></p>
<ol>
<li>At program start every SSIT entry is invalid, so loads and stores get no dependence information and every load speculates.</li>
<li>A load causes a violation with a store. The core allocates SSID X (the paper derives it by XOR-hashing the load PC) and writes X into two SSIT entries: one indexed by the load PC and one indexed by the store PC.</li>
<li>Next time the store is fetched, it finds SSID X, reads LFST[X], and finds no in-flight store, so it doesn't wait. It writes its inum into LFST[X].</li>
<li>The load is fetched, finds SSID X, reads LFST[X], and gets the store's inum. The scheduler makes the load wait for that store.</li>
<li>Later the same load violates with a second store. X is copied into the second store's SSIT entry, so three SSIT entries now point at X. From then on, when both stores and the load are fetched, the second store waits for the first and the load waits for the second.</li>
</ol>
<p>Why only one SSID per store? Letting an SSIT entry hold two SSIDs would need extra LFST read ports, and a load could then depend on two stores, which makes the scheduler larger. The cost is a new problem, covered next.</p>
<p><strong>Two loads waiting on one store, step by step.</strong> Suppose load0 and store0 already share SSID X, and then load1 violates with store0. Store0 has a set and load1 doesn't, so load1 joins store0's set (rule 3 in the next section). Now SSIT[load0 PC], SSIT[load1 PC], and SSIT[store0 PC] all hold X. The paper gives the table operations. Where it is silent about the hardware, the steps below say so and give the usual design. The example core renames 4 instructions per cycle and uses ROB indices as inums. Its LFST has 128 entries, the size in the DEC patent's preferred embodiment, so an SSID is 7 bits.</p>
<ol>
<li><strong>Store0 is fetched and renamed.</strong> The paper says only that "recently fetched" loads and stores access the SSIT. It names no pipeline stage, and the related DEC patent (US 6,108,770) places the assignment of instruction identifiers in a stage after decode and before the instruction queue, which is rename and allocate in a modern core. The paper calls the SSIT "a PC indexed table" without saying virtual or physical. In practice it's the virtual fetch PC, which the front end already has, and an untagged predictor costs only performance when it indexes wrong.
<ul>
<li><strong>SSIT read:</strong> it needs only the PC, so it can start at fetch or decode. Store0 gets SSID X.</li>
<li><strong>LFST read:</strong> LFST[X] is invalid, so store0 depends on no earlier store.</li>
<li><strong>LFST write:</strong> store0 writes its inum into LFST[X]. The paper defines an inum as "a hardware pointer that uniquely identifies the instance of each instruction in flight", and a ROB index fits. The write doesn't happen at fetch, before store0 has an inum. It happens in the stage that assigns inums, in program order. A ROB index is known at allocation, because the ROB fills in order: the slots of a rename group get tail, tail + 1, and so on.</li>
</ul>
<p><strong>A load in the same rename group.</strong> If store0 and load0 are renamed in the same cycle, load0 can't read store0's inum from the LFST, because store0 is writing it in that same cycle. The paper doesn't cover this. Rename needs a check inside the group, built the same way as the check that finds register dependences between instructions renamed together. For each load or store in slot j, the logic:</p>
<ol>
<li>Compares slot j's SSID with the SSID of every older slot in the group that holds a store. A 4-wide group has 6 pairs of slots, so it needs 6 comparators of 7 bits each.</li>
<li>Picks the youngest matching older slot with a priority encoder. That store is the last fetched store of the set as slot j sees it.</li>
<li>Chooses the dependence with a mux: the matching slot's inum (tail + its slot number) if there is a match, and otherwise the value read from LFST[SSID].</li>
<li>Writes the LFST once per set. If two stores of one set are in the group, only the younger one writes its inum, the same way only the youngest writer of an architectural register updates the RAT.</li>
</ol>
<p>Stores use the same logic to find the older store they chain behind. The figure shows the check for load0 in slot 2, with the ROB tail at entry 40:</p>
<div class="tbl"><svg viewBox="0 0 680 340" role="img" aria-label="Same-group check for load0. A rename group holds store0 in slot 0 with SSID X and inum 40, an add in slot 1 with no SSID and inum 41, load0 in slot 2 with SSID X and inum 42, and load9 in slot 3 with SSID Y and inum 43. Load0's SSID is compared with slot 0 and slot 1. Slot 0 is a store with SSID X, so it matches. Slot 1 does not. A priority select picks slot 0, the youngest older match. The LFST read for X returns invalid. A mux picks the bypassed inum 40 over the LFST value, so load0 depends on inum 40. Separately, store0 writes inum 40 into LFST X, and if two stores of one set are in a group only the younger writes.">
<defs><marker id="arrMD1" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker></defs>
<text x="10" y="18" style="fill:var(--muted);font-size:12px;font-weight:600">Rename group, ROB tail = 40 (each slot's inum is tail + slot number)</text>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5">
<rect x="10" y="28" width="159" height="64" rx="3"/><rect x="177" y="28" width="159" height="64" rx="3" style="fill:var(--surface);stroke:var(--muted)"/>
<rect x="344" y="28" width="159" height="64" rx="3"/><rect x="511" y="28" width="159" height="64" rx="3" style="fill:var(--surface);stroke:var(--muted)"/>
</g>
<g style="fill:var(--ink);font-size:12px" text-anchor="middle">
<text x="89" y="48" style="font-weight:600">Slot 0: store0</text><text x="89" y="65">SSID X</text><text x="89" y="82">inum 40</text>
<text x="256" y="48" style="font-weight:600">Slot 1: add</text><text x="256" y="65">no SSID</text><text x="256" y="82">inum 41</text>
<text x="423" y="48" style="font-weight:600">Slot 2: load0</text><text x="423" y="65">SSID X</text><text x="423" y="82">inum 42</text>
<text x="590" y="48" style="font-weight:600">Slot 3: load9</text><text x="590" y="65">SSID Y</text><text x="590" y="82">inum 43</text>
</g>
<g style="fill:none;stroke:var(--muted);stroke-width:1.5">
<path d="M60,92 V124" marker-end="url(#arrMD1)"/><path d="M230,92 V124" marker-end="url(#arrMD1)"/>
<path d="M400,92 V110 H120 V124" marker-end="url(#arrMD1)"/><path d="M300,110 V124" marker-end="url(#arrMD1)"/>
<path d="M470,92 V124" marker-end="url(#arrMD1)"/>
<path d="M90,168 V198" marker-end="url(#arrMD1)"/><path d="M270,168 V198" marker-end="url(#arrMD1)"/>
<path d="M520,168 V260" marker-end="url(#arrMD1)"/>
<path d="M350,218 H460 V260" marker-end="url(#arrMD1)"/>
<path d="M490,296 V314" marker-end="url(#arrMD1)"/>
</g>
<text x="310" y="105" style="fill:var(--muted);font-size:11px">load0's SSID X</text>
<g style="stroke-width:1.5">
<rect x="10" y="126" width="160" height="42" rx="3" style="fill:var(--surface);stroke:var(--accent-green)"/>
<rect x="190" y="126" width="160" height="42" rx="3" style="fill:var(--surface);stroke:var(--muted)"/>
<rect x="400" y="126" width="160" height="42" rx="3" style="fill:var(--pad-soft);stroke:var(--pad)"/>
<rect x="10" y="200" width="340" height="36" rx="3" style="fill:var(--surface);stroke:var(--muted)"/>
<rect x="10" y="262" width="340" height="56" rx="3" style="fill:var(--pad-soft);stroke:var(--pad)"/>
<path d="M420,262 H560 L540,296 H440 Z" style="fill:var(--surface);stroke:var(--muted)"/>
</g>
<g style="fill:var(--ink);font-size:12px" text-anchor="middle">
<text x="90" y="143">Slot 0 a store with</text><text x="90" y="159">SSID X? Yes</text>
<text x="270" y="143">Slot 1 a store with</text><text x="270" y="159">SSID X? No</text>
<text x="480" y="143">LFST[X] read</text><text x="480" y="159">invalid</text>
<text x="180" y="223">Priority select: youngest older match is slot 0</text>
<text x="490" y="284">mux</text>
<text x="180" y="280">LFST write: LFST[X] gets inum 40 (store0)</text>
<text x="180" y="296">With two stores of one set in a group,</text>
<text x="180" y="311">only the younger one writes</text>
<text x="490" y="332" style="font-weight:600">load0 depends on inum 40</text>
</g>
<text x="358" y="212" style="fill:var(--muted);font-size:11px">match, inum 40</text>
</svg></div>
</li>
<li><strong>Load0 is renamed and dispatched.</strong> It reads SSIT[load0 PC] and gets X, then reads LFST[X] (or the bypass) and gets store0's inum, 40. The paper says only that the scheduler imposes the dependence "in a similar manner to the way it imposes register dependence constraints", and that each load specifies exactly one dependence. That one-dependence rule keeps the hardware cheap. The usual design gives each issue queue entry one extra source field for a store inum, with a valid bit and a ready bit, next to the two register source tags. The figure shows the queue just after load0 is dispatched. Store0 is still waiting for its data register p17, so load0's mem ready bit is 0.
<div class="tbl"><svg viewBox="0 0 680 400" role="img" aria-label="The issue queue and its neighbors. Rename and allocate, which holds the RAT, SSIT, and LFST, allocates ROB entry 42 for load0 and dispatches entries into the issue queue. Each entry has fields v, op, dest, src1 with ready bit r, src2 with ready bit r, mem, mv, mr, and inum. Store0, inum 40, has src1 p12 ready, src2 p17 not ready, and no mem dependence. An add, inum 41, has dest p20, src1 p5 ready, src2 p6 not ready. Load0, inum 42, has dest p21, src1 p12 ready, mem 40 with mv 1 and mr 0. Ready entries send requests to select logic, which grants them. Granted entries go to payload RAM and register file read, then execute in ALUs and AGUs, then loads and stores enter the load and store queues. Select drives the wakeup buses, carrying destination tags and store inums, back to every issue queue entry.">
<defs><marker id="arrMD2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker></defs>
<g style="fill:none;stroke:var(--muted);stroke-width:1.5">
<path d="M610,40 V24 H350 V38" marker-end="url(#arrMD2)"/>
<path d="M80,110 V148" marker-end="url(#arrMD2)"/>
<path d="M150,75 H168" marker-end="url(#arrMD2)"/>
<path d="M530,56 H548" marker-end="url(#arrMD2)"/><path d="M550,74 H532" marker-end="url(#arrMD2)"/>
<path d="M610,84 V102" marker-end="url(#arrMD2)"/><path d="M610,148 V166" marker-end="url(#arrMD2)"/><path d="M610,212 V230" marker-end="url(#arrMD2)"/>
</g>
<text x="360" y="18" style="fill:var(--muted);font-size:11px">wakeup buses: destination tags and store inums</text>
<g style="stroke-width:1.5">
<rect x="10" y="40" width="140" height="70" rx="3" style="fill:var(--trace-soft);stroke:var(--trace)"/>
<rect x="10" y="150" width="140" height="56" rx="3" style="fill:var(--surface);stroke:var(--muted)"/>
<rect x="170" y="40" width="360" height="170" rx="3" style="fill:var(--surface);stroke:var(--pad)"/>
<rect x="550" y="40" width="120" height="44" rx="3" style="fill:var(--trace-soft);stroke:var(--trace)"/>
<rect x="550" y="104" width="120" height="44" rx="3" style="fill:var(--trace-soft);stroke:var(--trace)"/>
<rect x="550" y="168" width="120" height="44" rx="3" style="fill:var(--trace-soft);stroke:var(--trace)"/>
<rect x="550" y="232" width="120" height="44" rx="3" style="fill:var(--trace-soft);stroke:var(--trace)"/>
</g>
<rect x="392" y="66" width="84" height="116" style="fill:var(--pad-soft);stroke:none"/>
<g style="fill:none;stroke:var(--rule);stroke-width:1">
<path d="M178,86 H514 M178,110 H514 M178,134 H514 M178,158 H514"/>
<path d="M196,66 V182 M240,66 V182 M276,66 V182 M316,66 V182 M334,66 V182 M374,66 V182 M392,66 V182 M432,66 V182 M454,66 V182 M476,66 V182"/>
</g>
<g style="fill:var(--ink);font-size:12px" text-anchor="middle">
<text x="80" y="62" style="font-weight:600">Rename and</text><text x="80" y="78" style="font-weight:600">allocate</text><text x="80" y="98">RAT, SSIT, LFST</text>
<text x="80" y="173" style="font-weight:600">ROB</text><text x="80" y="192">entry 42: load0</text>
<text x="610" y="66" style="font-weight:600">Select logic</text>
<text x="610" y="122">Payload RAM,</text><text x="610" y="138">register read</text>
<text x="610" y="186" style="font-weight:600">Execute</text><text x="610" y="202">ALUs, AGUs</text>
<text x="610" y="250">Load and</text><text x="610" y="266">store queues</text>
</g>
<text x="178" y="58" style="fill:var(--pad);font-size:12px;font-weight:600">Issue queue</text>
<g style="fill:var(--muted);font-size:10px;font-weight:600" text-anchor="middle">
<text x="187" y="80">v</text><text x="218" y="80">op</text><text x="258" y="80">dest</text><text x="296" y="80">src1</text><text x="325" y="80">r</text><text x="354" y="80">src2</text><text x="383" y="80">r</text><text x="412" y="80">mem</text><text x="443" y="80">mv</text><text x="465" y="80">mr</text><text x="495" y="80">inum</text>
</g>
<g style="fill:var(--ink);font-size:11px;font-family:var(--mono)" text-anchor="middle">
<text x="187" y="102">1</text><text x="218" y="102">st</text><text x="258" y="102">-</text><text x="296" y="102">p12</text><text x="325" y="102">1</text><text x="354" y="102">p17</text><text x="383" y="102">0</text><text x="412" y="102">-</text><text x="443" y="102">0</text><text x="465" y="102">-</text><text x="495" y="102">40</text>
<text x="187" y="126">1</text><text x="218" y="126">add</text><text x="258" y="126">p20</text><text x="296" y="126">p5</text><text x="325" y="126">1</text><text x="354" y="126">p6</text><text x="383" y="126">0</text><text x="412" y="126">-</text><text x="443" y="126">0</text><text x="465" y="126">-</text><text x="495" y="126">41</text>
<text x="187" y="150">1</text><text x="218" y="150">ld</text><text x="258" y="150">p21</text><text x="296" y="150">p12</text><text x="325" y="150">1</text><text x="354" y="150">-</text><text x="383" y="150">-</text><text x="412" y="150">40</text><text x="443" y="150">1</text><text x="465" y="150">0</text><text x="495" y="150">42</text>
<text x="346" y="176">...</text>
</g>
<text x="178" y="200" style="fill:var(--muted);font-size:11px">store0's data p17 isn't ready, so load0 waits (mr = 0)</text>
<g style="fill:var(--ink);font-size:11px">
<text x="10" y="300">v: entry valid</text>
<text x="10" y="318">op: operation</text>
<text x="10" y="336">dest: destination physical register</text>
<text x="10" y="354">src1, src2: source physical register tags</text>
<text x="10" y="372">r: that source's ready bit</text>
<text x="300" y="300">mem: inum of the store to wait for (from the LFST)</text>
<text x="300" y="318">mv: mem valid (a store dependence was predicted)</text>
<text x="300" y="336">mr: mem ready (that store has issued)</text>
<text x="300" y="354">inum: this entry's own ROB index</text>
<text x="300" y="372">Requests select when both r = 1 and (mv = 0 or mr = 1)</text>
</g>
</svg></div>
<p>Around the queue, rename allocates the ROB entry (whose index is the inum) and a load or store queue entry, then dispatches the instruction into a free queue entry. Every cycle, entries whose operands are all ready send requests to select, and select grants the oldest few. Granted entries read their operands from the payload RAM and register file, execute, and loads and stores then work in the load and store queues. Select also drives the wakeup buses back to every entry, which is how waiting entries learn that their producers have issued.</p>
</li>
<li><strong>Load1 is fetched and renamed, later.</strong> It reads SSIT[load1 PC], gets X, reads LFST[X], and gets the same inum, 40. Its entry looks like load0's, with mem = 40, mv = 1, and mr = 0. Loads only read the LFST and never write it, so any number of loads can wait on one store, each holding its own copy of the tag. This is why merging works with such simple tables.</li>
<li><strong>Store0 issues.</strong> The loads wait for the store to <em>issue</em>, not to complete or commit. In the paper's model, a store issues once its address and data registers are both ready. Here that happens when p17 arrives. Three things follow.
<ul>
<li><strong>Broadcast:</strong> the paper doesn't describe it beyond the comparison with register dependences. In the usual design, select places store0's inum on a tag bus, just as it places an ALU instruction's destination tag. The bus wires run past every entry in the queue, because in a unified queue any entry can hold a load or store. Each entry compares the bus tag with its mem field and ANDs the result with mv and the bus valid bit, so only entries with a predicted store dependence can set mr. Every other entry, including all non-memory instructions, ignores the bus. Cores with a separate scheduler for memory operations put these comparators only in that scheduler.</li>
<li><strong>Which wires:</strong> either a separate memory tag bus, with one extra comparator per entry, or the existing register tag buses. A store writes no register, so its slot on the register bus is free, and a type bit tells the entries whether the tag is a physical register or an inum. A scheduler built as a dependence matrix instead raises the store's column wire, and no comparator is needed.</li>
<li><strong>Dependents of the loads:</strong> an instruction that uses load0's result doesn't get a memory bit. It waits on load0's destination tag, p21, through ordinary register wakeup when load0 is scheduled. The memory dependence links only the store and the loads that predicted it.</li>
</ul>
<p>The figure shows the broadcast reaching four entries:</p>
<div class="tbl"><svg viewBox="0 0 680 320" role="img" aria-label="Store0's inum broadcast. Select logic grants store0 and drives inum 40 onto a memory tag bus that runs past four issue queue entries. Load0, inum 42, holds mem 40 and mv 1, so its comparator matches, the AND with mv passes, and mr is set to 1, making load0 ready. Load1, inum 47, holds mem 40 and mv 1, so mr is set to 1, but it still waits for its address register p30. An add, inum 44, has mv 0, so the comparator result is ignored and it waits only on registers. Store8, inum 45, from another set, holds mem 38 and mv 1, so its comparator does not match and mr stays 0.">
<defs><marker id="arrMD3" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker></defs>
<g style="fill:none;stroke:var(--rule);stroke-width:1;stroke-dasharray:4 3"><rect x="130" y="2" width="120" height="292" rx="4"/><rect x="260" y="2" width="120" height="292" rx="4"/><rect x="390" y="2" width="120" height="292" rx="4"/><rect x="520" y="2" width="120" height="292" rx="4"/></g>
<rect x="10" y="50" width="110" height="44" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/>
<g style="fill:var(--ink);font-size:12px" text-anchor="middle"><text x="65" y="68" style="font-weight:600">Select logic</text><text x="65" y="84">grants store0</text></g>
<path d="M120,72 H660" style="fill:none;stroke:var(--trace);stroke-width:3"/>
<text x="130" y="64" style="fill:var(--trace);font-size:11px;font-weight:600">memory tag bus: inum 40, valid</text>
<g style="fill:none;stroke:var(--muted);stroke-width:1.5">
<path d="M142,72 V140 H158" marker-end="url(#arrMD3)"/><path d="M272,72 V140 H288" marker-end="url(#arrMD3)"/><path d="M402,72 V140 H418" marker-end="url(#arrMD3)"/><path d="M532,72 V140 H548" marker-end="url(#arrMD3)"/>
<path d="M171,112 V125" marker-end="url(#arrMD3)"/><path d="M301,112 V125" marker-end="url(#arrMD3)"/><path d="M431,112 V125" marker-end="url(#arrMD3)"/><path d="M561,112 V125" marker-end="url(#arrMD3)"/>
<path d="M171,153 V166" marker-end="url(#arrMD3)"/><path d="M301,153 V166" marker-end="url(#arrMD3)"/><path d="M431,153 V166" marker-end="url(#arrMD3)"/><path d="M561,153 V166" marker-end="url(#arrMD3)"/>
<path d="M217,112 V166" marker-end="url(#arrMD3)"/><path d="M347,112 V166" marker-end="url(#arrMD3)"/><path d="M477,112 V166" marker-end="url(#arrMD3)"/><path d="M607,112 V166" marker-end="url(#arrMD3)"/>
<path d="M190,192 V208" marker-end="url(#arrMD3)"/><path d="M320,192 V208" marker-end="url(#arrMD3)"/><path d="M450,192 V208" marker-end="url(#arrMD3)"/><path d="M580,192 V208" marker-end="url(#arrMD3)"/>
<path d="M190,236 V252" marker-end="url(#arrMD3)"/><path d="M320,236 V252" marker-end="url(#arrMD3)"/><path d="M450,236 V252" marker-end="url(#arrMD3)"/><path d="M580,236 V252" marker-end="url(#arrMD3)"/>
</g>
<g style="stroke-width:1.5">
<rect x="135" y="8" width="110" height="34" rx="3" style="fill:var(--surface);stroke:var(--accent-green)"/>
<rect x="265" y="8" width="110" height="34" rx="3" style="fill:var(--surface);stroke:var(--accent-green)"/>
<rect x="395" y="8" width="110" height="34" rx="3" style="fill:var(--surface);stroke:var(--muted)"/>
<rect x="525" y="8" width="110" height="34" rx="3" style="fill:var(--surface);stroke:var(--muted)"/>
</g>
<g style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1">
<rect x="150" y="86" width="44" height="26" rx="2"/><rect x="200" y="86" width="34" height="26" rx="2"/>
<rect x="280" y="86" width="44" height="26" rx="2"/><rect x="330" y="86" width="34" height="26" rx="2"/>
<rect x="410" y="86" width="44" height="26" rx="2"/><rect x="460" y="86" width="34" height="26" rx="2"/>
<rect x="540" y="86" width="44" height="26" rx="2"/><rect x="590" y="86" width="34" height="26" rx="2"/>
</g>
<g style="fill:var(--surface);stroke:var(--muted);stroke-width:1.5">
<circle cx="171" cy="140" r="13"/><circle cx="301" cy="140" r="13"/><circle cx="431" cy="140" r="13"/><circle cx="561" cy="140" r="13"/>
<rect x="150" y="168" width="84" height="24" rx="3"/><rect x="280" y="168" width="84" height="24" rx="3"/><rect x="410" y="168" width="84" height="24" rx="3"/><rect x="540" y="168" width="84" height="24" rx="3"/>
</g>
<g style="stroke-width:1.5">
<rect x="140" y="210" width="100" height="26" rx="3" style="fill:var(--surface);stroke:var(--accent-green)"/>
<rect x="270" y="210" width="100" height="26" rx="3" style="fill:var(--surface);stroke:var(--accent-green)"/>
<rect x="400" y="210" width="100" height="26" rx="3" style="fill:var(--surface);stroke:var(--muted)"/>
<rect x="530" y="210" width="100" height="26" rx="3" style="fill:var(--surface);stroke:var(--muted)"/>
</g>
<g style="fill:var(--ink);font-size:12px" text-anchor="middle">
<text x="190" y="30" style="font-weight:600">load0, inum 42</text><text x="320" y="30" style="font-weight:600">load1, inum 47</text><text x="450" y="30" style="font-weight:600">add, inum 44</text><text x="580" y="30" style="font-weight:600">store8, inum 45</text>
<g style="font-family:var(--mono);font-size:11px"><text x="172" y="103">40</text><text x="217" y="103">1</text><text x="302" y="103">40</text><text x="347" y="103">1</text><text x="432" y="103">-</text><text x="477" y="103">0</text><text x="562" y="103">38</text><text x="607" y="103">1</text></g>
<text x="171" y="144">=</text><text x="301" y="144">=</text><text x="431" y="144">=</text><text x="561" y="144">=</text>
<g style="font-size:11px"><text x="192" y="184">AND mv</text><text x="322" y="184">AND mv</text><text x="452" y="184">AND mv</text><text x="582" y="184">AND mv</text></g>
<text x="190" y="228">mr = 1</text><text x="320" y="228">mr = 1</text><text x="450" y="228">unused</text><text x="580" y="228">mr stays 0</text>
</g>
<g style="fill:var(--ink);font-size:11px" text-anchor="middle">
<text x="190" y="268">ready: requests</text><text x="190" y="283">select next cycle</text>
<text x="320" y="268">still waits for</text><text x="320" y="283">address reg p30</text>
<text x="450" y="268">waits only on</text><text x="450" y="283">its registers</text>
<text x="580" y="268">waits for</text><text x="580" y="283">store inum 38</text>
</g>
<text x="10" y="312" style="fill:var(--muted);font-size:11px">In each entry: mem (left box) and mv (right box). This comparator sits beside the entry's 2 register-tag comparators.</text>
</svg></div>
<ul>
<li><strong>LFST invalidation:</strong> "After a store instruction issues, it accesses the LFST and invalidates the entry if it still refers to itself." A load fetched after this sees no valid store and doesn't wait. If a newer store of set X had already overwritten the entry, the entry stays, so later loads wait for that newer store.</li>
</ul>
<p><strong>Split stores.</strong> Many cores, Intel's since the P6, split a store into a store-address µop (STA) and a store-data µop (STD) that issue independently. The paper's footnote says it doesn't model this. A load that predicted a dependence almost always reads the bytes the store writes, so it needs both halves: the address to match the store in the store queue, and the data to forward. Waiting on both separately would take two mem fields and two comparators per entry, the extra scheduler cost the one-dependence rule avoids. Two designs keep one tag per load:</p>
<ul>
<li><strong>Wake on the later half:</strong> the store queue entry has an address-valid bit and a data-valid bit. When the second of the two is set, the store queue broadcasts the store's inum. The load still has one mem field and one comparator, and it issues only once forwarding can succeed.</li>
<li><strong>Wake on the STA, then block:</strong> the load waits only for the store address. Once it issues, the store queue search tells it whether it really aliases. If it doesn't, it reads the cache and is done, so false dependences cost less. If it does and the data isn't ready, the load can't forward. It is blocked in the load queue until the STD writes the data, then reissues. The cost is that reissue for loads that truly alias.</li>
</ul>
</li>
</ol>

<h3 id="sec-assignment">Store Set Assignment and Merging</h3>
<p>When a violation hits a store that already has a valid SSID, what should happen? If the store simply takes the load's SSID, overwriting its old one, it leaves its old set. Two loads that depend on the same store can then fight over it, much like two addresses thrashing in one cache set. The paper's example:</p>
<ul>
<li>Load PC 1's set is {store PC X, store PC Y, store PC Z}</li>
<li>Load PC 2's set is {store PC J, store PC K}</li>
</ul>
<p>Now load PC 1 violates with store PC J. Store J moves into set 1, which removes it from set 2. The next time load PC 2 runs, nothing makes it wait for store J, so it violates with J and pulls J back into set 2. Then load PC 1 violates again, and so on. The two loads take turns trapping forever, and the predictor never stabilizes. This is <strong>oscillation</strong>.</p>
<p>The fix is a set of <strong>store set assignment rules</strong>, applied when a store-load pair causes a violation:</p>
<ol>
<li>If neither the load nor the store has a store set, allocate one and assign it to both.</li>
<li>If the load has a store set and the store doesn't, the store joins the load's set.</li>
<li>If the store has a store set and the load doesn't, the load joins the store's set.</li>
<li>If both have store sets, declare one set the "winner." Whichever of the two instructions belongs to the loser's set is moved into the winner's set.</li>
</ol>
<p>Rule 4 needs an arbitration that always picks the same winner between the same two sets. The paper picks the set with the smaller SSID. With this rule, oscillation becomes <strong>merging</strong>. Walking through the example again with set 1 as the winner:</p>
<ol>
<li>Load PC 1 violates with store J (in set 2). Rule 4: set 1 wins, so store J moves to set 1.</li>
<li>Load PC 2 violates with store J (now in set 1). Rule 4 again: set 1 wins again, so this time load PC 2 moves to set 1.</li>
<li>Load PC 2 later violates with store K, which is still alone in set 2 (no load points to it). Set 1 wins, so K moves to set 1.</li>
<li>Now both loads and all of their stores are in set 1, and no more violations happen.</li>
</ol>
<p>The sets converge after a fixed number of traps. Merging can add false dependences, since load PC 1 now also waits for stores J and K. The paper found no measurable cost from this. Without merging (each store simply takes the SSID of the latest load it violated with), IPC drops by an average of 12%. Examples from the paper's Figure 6.2, read from the chart:</p>
<ul>
<li>perl (primes): about 3.5 IPC without merging vs. 5.1 with it</li>
<li>wave5: about 2.6 IPC vs. 3.7</li>
<li>xlisp: about 2.9 IPC vs. 3.4</li>
</ul>

<h3 id="sec-feedback">Clearing Stale Entries</h3>
<p>The SSIT only ever gains valid entries. Since it has no tags, every load and store that indexes an entry uses whatever it finds there. That causes two problems:</p>
<ul>
<li><strong>Aliasing:</strong> a load that needs a store set and one that doesn't can map to the same entry, so the second one picks up false dependences.</li>
<li><strong>Staleness:</strong> with nothing to invalidate entries, the whole SSIT eventually fills with valid SSIDs, and those impose essentially random ordering on whatever program runs later.</li>
</ul>
<p>As with the infinite predictor, the answer is to track a working set. The paper tried two methods:</p>
<ol>
<li><strong>Cyclic clearing:</strong> every so often (every 1,000,000 cycles in the experiments), clear all SSIT valid bits, and the table retrains from scratch. Each real dependence then costs one violation to relearn, which is cheap at this interval.</li>
<li><strong>2-bit counters:</strong> one per SSIT entry, used only by store entries as in the infinite predictor. A store's counter starts at its maximum when it first gets an SSIT entry, and dependences are enforced while the high bit is set. When the scheduler enforces a predicted dependence, the store and load addresses are compared: no overlap decrements the counter, overlap increments it.</li>
</ol>
<p>With large tables (16K SSIT entries and 512 LFST entries), the counters reduced applu's false dependences, but xlisp got worse instead of better. This is destructive aliasing: a load that doesn't need a set decrements the counter in an SSIT entry that another load relies on, so that load's real dependence stops being enforced and its violations come back. xlisp loses about as much as applu gains, and the counters need extra storage plus address comparators, so the paper uses cyclic clearing. That needs only two counters: one that times the clearing interval and one that sweeps through the SSIT, invalidating entries.</p>

<h3 id="sec-table-sizes">Table Sizes</h3>
<p>All size experiments use cyclic clearing. Performance is relative to the large configuration of 16K SSIT entries and 512 LFST entries. Values below are read from the paper's charts.</p>
<p><strong>SSIT size</strong> (LFST kept large), Figure 6.4:</p>
<div class="tbl"><table>
<tr><th>SSIT entries</th><th>8K</th><th>4K</th><th>2K</th><th>1K</th><th>512</th><th>256</th><th>128</th></tr>
<tr><td>Integer average</td><td>1.00</td><td>1.00</td><td>≈ 0.99</td><td>≈ 0.99</td><td>≈ 0.97</td><td>≈ 0.94</td><td>≈ 0.82</td></tr>
<tr><td>Floating-point average</td><td>1.00</td><td>1.00</td><td>≈ 0.99</td><td>≈ 0.99</td><td>≈ 0.97</td><td>≈ 0.88</td><td>≈ 0.77</td></tr>
<tr><td>Worst program</td><td>1.00</td><td>1.00</td><td>≈ 0.96</td><td>≈ 0.95</td><td>≈ 0.87</td><td>≈ 0.59</td><td>≈ 0.46</td></tr>
</table></div>
<p>A 4K-entry SSIT costs nothing, and 1K entries are still acceptable. The program most sensitive to SSIT size is fpppp (Figure 6.5). Its false dependences go from almost none at 4K entries to about 28 per 1,000 instructions at 512 and about 215 per 1,000 instructions at 128. Its IPC falls to about 0.46 of the large table's, close to the no-speculation level in <a href="#/mdp-metrics/bounds">Never, Always, and Perfect</a>. The cause is aliasing: in a small untagged SSIT, loads and stores that need no ordering share entries with ones that do. Tags would let the SSIT shrink, at the cost of a tag array and comparators.</p>
<p><strong>LFST size</strong> (SSIT kept large), Figure 6.6:</p>
<div class="tbl"><table>
<tr><th>LFST entries</th><th>128</th><th>64</th><th>32</th><th>16</th><th>8</th><th>4</th><th>2</th></tr>
<tr><td>Integer average</td><td>1.00</td><td>≈ 0.99</td><td>≈ 0.99</td><td>≈ 0.98</td><td>≈ 0.96</td><td>≈ 0.95</td><td>≈ 0.90</td></tr>
<tr><td>Worst program</td><td>1.00</td><td>≈ 0.96</td><td>≈ 0.96</td><td>≈ 0.91</td><td>≈ 0.85</td><td>≈ 0.82</td><td>≈ 0.70</td></tr>
</table></div>
<p>The LFST can be much smaller than the SSIT. Fewer LFST entries means fewer distinct store sets, so unrelated loads and stores share sets. But two loads that share an SSID only collide if their stores are in flight at the same time, and often they aren't. 128 entries give full performance, which also makes each SSID only 7 bits (128 sets = 2<sup>7</sup>), so the SSIT shrinks too.</p>
<p><strong>The final design:</strong> a 4K-entry SSIT, a 128-entry LFST, and clearing the SSIT every 1,000,000 cycles. Each SSIT entry holds a 7-bit SSID plus a valid bit, so the SSIT holds 4,096 entries × (7 bits + 1 bit) = 32,768 bits = 4 KB (my arithmetic, the paper gives entry counts only). Compared with perfect prediction (Figure 6.7), every program is close except applu, which loses 14% because the design has no 2-bit counters. Compared with a 32K-entry store barrier cache (one entry per possible store in a 128 KB instruction cache), store sets are 34% faster on average and up to 100% faster. Approximate IPC from the chart:</p>
<div class="tbl"><table>
<tr><th>Program</th><th>Store barrier cache (IPC)</th><th>Store sets (IPC)</th><th>Perfect (IPC)</th></tr>
<tr><td>fpppp</td><td>≈ 3.5</td><td>≈ 5.6</td><td>≈ 5.7</td></tr>
<tr><td>ijpeg</td><td>≈ 2.2</td><td>≈ 4.3</td><td>≈ 4.6</td></tr>
<tr><td>wave5</td><td>≈ 2.2</td><td>≈ 3.7</td><td>≈ 3.7</td></tr>
<tr><td>applu</td><td>≈ 1.8</td><td>≈ 2.8</td><td>≈ 3.3</td></tr>
</table></div>
<p class="refs">References: Chrysos and Emer, "Memory Dependence Prediction using Store Sets," ISCA 1998</p>`,
  practice: {
    guided: [
      {
        q: `<p>With store sets, load L (PC 0x40) causes a violation with store S (PC 0x80). Trace what happens the next time both are fetched.</p>`,
        a: `<ol><li>After the violation, the SSIT assigns both PCs the same set, say set 5.</li><li>S is fetched: it looks up set 5 and records itself in LFST[5] as the latest store of the set.</li><li>L is fetched: it looks up set 5, reads LFST[5], and takes a dependence on S.</li><li>L issues only after S issues. When S issues, LFST[5] is cleared if it still points to S.</li></ol>`
      },
      {
        q: `<p>A store set predictor uses the paper's assignment rules, with the smaller SSID winning rule 4. Two loads and three stores have these SSIT entries:</p><ul><li>Load L1 (PC 0x4a0) and store S1 (PC 0x400) have SSID 3</li><li>Load L2 (PC 0x4c8) and store S2 (PC 0x410) have SSID 9</li><li>Store S3 (PC 0x430) has SSID 9 too (it once conflicted with L2)</li></ul><p>Then these violations happen in order:</p><ol><li>L1 violates with S2</li><li>L2 violates with S2</li><li>L2 violates with S3</li></ol><p>Give the SSIDs after each violation. Then show what would happen if, instead, a store always took the SSID of the load it just violated with.</p>`,
        a: `<ol><li>L1 (SSID 3) violates with S2 (SSID 9). Both have sets, so rule 4 applies: SSID 3 wins over SSID 9. The instruction in the losing set, S2, moves to SSID 3. Now L1, S1, and S2 have SSID 3. L2 and S3 still have SSID 9.</li><li>L2 (SSID 9) violates with S2 (SSID 3). Rule 4 again picks SSID 3, so this time L2 moves to SSID 3. Now L1, L2, S1, and S2 have SSID 3, and S3 is the only instruction left with SSID 9.</li><li>L2 (SSID 3) violates with S3 (SSID 9). SSID 3 wins, so S3 moves to SSID 3. All five instructions are in one set, and both loads now wait for the last fetched of S1, S2, and S3. No further violations occur among them.</li><li>With "the store takes the load's SSID" instead: after violation 1, S2 has SSID 3. Violation 2 moves S2 back to SSID 9. The next instance of L1 no longer waits for S2, so it violates again and S2 returns to SSID 3, and so on. L1 and L2 take turns trapping on S2 forever. That's the oscillation the rules prevent.</li></ol>`
      },
      {
        q: `<p>An SSIT has 2,048 entries, indexed by PC bits [12:2] (4-byte instructions). Load L at PC 0x401a3c and store S at PC 0x4019f0 once conflicted, so both have SSID 17. Load U at PC 0x403a3c, in another function, never conflicts with anything.</p><ol><li>Compute the SSIT index of each instruction.</li><li>What happens each time U is fetched while an instance of S is in flight?</li><li>Does cyclic clearing fix it? What does?</li></ol>`,
        a: `<ol><li>Index = (PC &gt;&gt; 2) mod 2,048 entries, the low 11 bits after dropping the 2 offset bits:<ul><li>L: 0x401a3c &gt;&gt; 2 = 0x10068f, index <strong>0x68f</strong></li><li>S: 0x4019f0 &gt;&gt; 2 = 0x10067c, index <strong>0x67c</strong></li><li>U: 0x403a3c &gt;&gt; 2 = 0x100e8f, index <strong>0x68f</strong></li></ul>L and U share an entry because their PCs differ by 0x2000 bytes = 8,192 bytes = 2,048 entries × 4 bytes/instruction.</li><li>The SSIT has no tags, so U reads entry 0x68f, finds a valid SSID 17, reads LFST[17], finds S's inum, and waits for S to issue. Every such wait is a false dependence, and it costs time whenever U is on the critical path.</li><li>Clearing removes it only for a while. After the clear, U runs freely, but as soon as L and S conflict again, entry 0x68f becomes valid with an SSID and U picks it up again. Real fixes keep L and U apart: a 4,096-entry SSIT indexes with bits [13:2] and puts them at 0x68f and 0xe8f, and partial tags let U see that the entry isn't its own.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>When a store issues, the LFST entry for its set is invalidated only if it still holds that store's inum. What goes wrong if the store always invalidates its LFST entry, and what goes wrong if stores never invalidate it?</p>`,
        a: `<p><strong>Always invalidate:</strong> a later store of the same set may have been fetched in the meantime and written its own inum into the entry. The older store's issue then erases the newer store from the LFST. A load fetched after that finds no in-flight store for its set and runs freely, so if it depends on the newer store it violates. The bug only shows up when two stores of one set are in flight together, which is exactly the merged-set case store sets are built for.</p><p><strong>Never invalidate:</strong> the entry keeps pointing at a store that has already issued or retired. A later load either waits for nothing, or, once that inum is reused by an unrelated instruction, takes a dependence on the wrong instruction. Either way loads wait when they shouldn't, which shows up as false dependences and lost IPC. The check also matters on a flush: squashed stores must be removed from the LFST so a refetched load doesn't wait on an instruction that no longer exists.</p>`
      },
      {
        q: `<p>Size a store set predictor for a core with a 256-entry ROB, where an inum is the 8-bit ROB index. The SSIT has 2,048 entries and the LFST has 64 entries. Each entry in both tables has a valid bit. How many bytes do the SSIT and LFST need? Compare that with a 2,048-entry, 1-bit wait table, and explain what happens if you cut the SSIT to 256 entries to save area.</p>`,
        a: `<ol><li>The SSID must name one of 64 LFST entries: log<sub>2</sub>(64 entries) = 6 bits.</li><li>SSIT: 2,048 entries × (6 bits + 1 valid bit) = 14,336 bits = 14,336 bits / 8 bits/byte = <strong>1,792 bytes</strong>.</li><li>LFST: 64 entries × (8 bits + 1 valid bit) = 576 bits = 576 bits / 8 bits/byte = <strong>72 bytes</strong>.</li><li>Total: 1,792 bytes + 72 bytes = <strong>1,864 bytes</strong>. The wait table is 2,048 entries × 1 bit = 2,048 bits = 2,048 bits / 8 bits/byte = <strong>256 bytes</strong>. So the store set predictor is about 7.3× larger, and it also needs an LFST read on fetch and an invalidate path on store issue.</li><li>Cutting the SSIT to 256 entries saves area, 256 entries × (6 bits + 1 valid bit) = 1,792 bits = 224 bytes, but the table is untagged. Many unrelated loads and stores then share entries and inherit SSIDs they don't need, so false dependences rise sharply. In the store sets paper, fpppp lost more than 40% of its IPC at 256 entries. If area must shrink, add partial tags or shrink the LFST first, since the LFST tolerates sharing much better.</li></ol>`
      },
      {
        q: `<p>A store set predictor clears its SSIT valid bits every T cycles. After each clear, 350 active store-load pairs must each cause one violation to relearn, at 24 cycles per violation. Find the overhead as a fraction of run time for T = 2,000,000 cycles and T = 50,000 cycles. What limits how large T can be?</p>`,
        a: `<ol><li>Relearning cost per clear: 350 pairs × 1 violation/pair × 24 cycles/violation = 8,400 cycles.</li><li>T = 2,000,000 cycles: 8,400 cycles / 2,000,000 cycles = <strong>0.42%</strong>.</li><li>T = 50,000 cycles: 8,400 cycles / 50,000 cycles = <strong>16.8%</strong>, far too high.</li><li>T can't grow without limit, because clearing is the only way stale entries leave the untagged SSIT. Between clears, pairs that stopped conflicting (a phase change, or a store that conflicts only rarely) and aliased entries keep adding false dependences. The best T balances that growing false-dependence cost against the relearning cost, which falls as 1/T. The paper's 1,000,000-cycle interval sits in that range for SPEC95.</li></ol>`
      }
    ]
  }
},

{
  id: "mdp-limits",
  region: "mdep",
  title: "Where Store Sets Fall Short",
  sections: [
    { id: "applu", label: "Where Store Sets Fall Short" }
  ],
  body: `
<p>The hardware design gets within a few percent of perfect on almost every program. The one exception shows what a predictor indexed by PC can't express: which <em>instances</em> of a load and store conflict.</p>

<h3 id="sec-applu">Where Store Sets Fall Short</h3>
<p>applu shows the limit of the approach. Under <a href="#/mdp-store-sets/ideal">infinite store sets</a> it had many false dependences, and even with 2-bit counters it kept some false dependences plus about 1.75 violations per 1,000 instructions. That's a small rate, but each trap is expensive. Nearly all of these events came from a few loads with a <em>recurring pattern</em> of dependence. The loop, from applu's routines blts and buts:</p>
<pre><code>do ip = 1, 4
  tmp1 = 1.0d+00 / tmat(ip,ip)
  do m = ip+1, 5
    tmp = tmp1 * tmat(m,ip)
    do l = ip+1, 5
      tmat(m,l) = tmat(m,l) - tmp * tmat(ip,l)</code></pre>
<p>In the innermost statement, the store to <code>tmat(m,l)</code> (PC B) and the load of <code>tmat(ip,l)</code> (PC A) sometimes touch the same element. With ip = 3, the inner loops produce this order of dynamic instances:</p>
<div class="tbl"><table>
<tr><th>PC</th><th>Access</th><th>Iteration</th></tr>
<tr><td>A</td><td>load tmat(3,4)</td><td>ip = 3, m = 4, l = 4 (V)</td></tr>
<tr><td>B</td><td>store tmat(4,4)</td><td>V</td></tr>
<tr><td>A</td><td>load tmat(3,5)</td><td>ip = 3, m = 4, l = 5 (W)</td></tr>
<tr><td>B</td><td>store tmat(4,5)</td><td>W</td></tr>
<tr><td>A</td><td>load tmat(3,4)</td><td>ip = 3, m = 5, l = 4 (X)</td></tr>
<tr><td>B</td><td>store tmat(5,4)</td><td>X</td></tr>
<tr><td>A</td><td>load tmat(3,5)</td><td>ip = 3, m = 5, l = 5 (Y)</td></tr>
<tr><td>B</td><td>store tmat(5,5)</td><td>Y</td></tr>
<tr><td>A</td><td>load tmat(4,5)</td><td>ip = 4, m = 5, l = 5 (Z)</td></tr>
<tr><td>B</td><td>store tmat(5,5)</td><td>Z</td></tr>
</table></div>
<p>The load in iteration Z reads tmat(4,5), which the store in iteration W wrote. Many iterations are in flight at once, so if those two run out of order, there's a violation, and store PC B joins load PC A's store set. From then on, every instance of load A waits for the most recent in-flight instance of store B, even though only a few specific iterations actually depend on each other. Store sets know only PCs, not which dynamic instance or iteration distance matters. The loop gets serialized and runs about 2× slower than with perfect prediction.</p>
<p>The paper offers two ways out:</p>
<ul>
<li><strong>Compiler:</strong> fully unroll the triply nested loop. Each load and store in each iteration then has its own PC, so a load's set holds exactly the store it conflicts with. After manual unrolling, applu matched perfect prediction.</li>
<li><strong>Hardware (future work):</strong> a predictor that learns patterns of which instances conflict. Moshovos et al.'s scheme already moves in this direction: it names a dependence by its store-load pair plus the dynamic distance between instances, instead of by PC alone.</li>
</ul>
<p class="refs">References: Chrysos and Emer, "Memory Dependence Prediction using Store Sets," ISCA 1998 · Moshovos, Breach, Vijaykumar, and Sohi, "Dynamic Speculation and Synchronization of Data Dependences," ISCA 1997</p>`,
  practice: {
    guided: [
      {
        q: `<p>A histogram loop runs over random keys spread across 256 bins:</p><pre><code>for (i = 0; i &lt; n; i++) hist[key[i]]++;</code></pre><p>Each iteration loads <code>hist[k]</code>, adds 1, and stores it, so two consecutive iterations touch the same bin only about 1 time in 256. After the first repeat causes a violation, the load and store share a store set. Assume:</p><ul><li>Load-to-use latency is 4 cycles, and the add takes 1 cycle.</li><li>A store issues as soon as its data is ready, and a load that waits for a store issues the next cycle.</li><li>Without memory waits, other limits allow 1 iteration/cycle.</li></ul><p>Find the throughput with store sets. Then find it after rewriting the loop to update 4 separate histograms, one per position in a 4-way unrolled loop, and summing them at the end.</p>`,
        a: `<ol><li>With store sets, every instance of the load waits for the most recent in-flight instance of the store, which is the previous iteration's store, even though that store almost never writes the same bin.</li><li>Chain per iteration: the load issues at cycle t, its value arrives at t + 4 cycles, the add finishes at t + 5 cycles, the store issues at t + 5 cycles, and the next load issues at t + 6 cycles. That's 6 cycles/iteration, so throughput = 1 iteration / 6 cycles = <strong>0.167 iterations/cycle</strong>, against 1 iteration/cycle with perfect prediction.</li><li>With 4 histograms, each unrolled copy has its own load PC and store PC, and copy k only ever conflicts with copy k's store from 4 iterations earlier. Each copy's set holds only its own store, so there are 4 independent chains.</li><li>Throughput = 4 chains × 1 iteration / 6 cycles = <strong>0.667 iterations/cycle</strong>, 4× better. The final sum costs 4 histograms × 256 bins = 1,024 loads, which is small next to a large input.</li><li>This is the compiler fix from the applu loop in software form, and production code uses it. zstd's histogram counting keeps 4 count tables for this reason.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A loop runs <code>for (i = 3; i &lt; n; i++) a[i] = a[i-3] * k;</code> on a core with a store set predictor. Each iteration's load-to-store chain takes 9 cycles (load-to-use plus multiply). Once the store has joined the load's store set, what is the steady-state throughput in iterations per cycle, and what would perfect prediction give? Assume no other limit applies.</p>`,
        a: `<ol><li>True dependences: the load in iteration i reads a[i-3], written by the store in iteration i-3. So there are 3 independent chains: i ≡ 0, 1, 2 (mod 3).</li><li>Perfect prediction: each load waits only for the store 3 iterations back. The 3 chains overlap, each finishing one iteration every 9 cycles, so throughput = 3 chains × 1 iteration / 9 cycles = <strong>0.333 iterations/cycle</strong>.</li><li>Store sets: the load and store have one SSID, and a load waits for the <em>last fetched</em> store of its set, which is the store from iteration i-1, not i-3. Every iteration now waits for the previous one: load i waits for store i-1, which waits for load i-1's value. That's one chain, so throughput = 1 iteration / 9 cycles = <strong>0.111 iterations/cycle</strong>, 3× slower.</li><li>This is the applu failure: the predictor knows which PCs conflict but not which instances. Fixes are unrolling by 3 (each copy gets its own PCs and its own set) or a predictor that records dependence distance.</li></ol>`
      },
      {
        q: `<p>A colleague proposes adding a distance field to each store set: at a violation, record how many instances of the store PC lie between the conflicting store and the load, and later make the load wait only for the store instance that many back. For each loop below, does this fix the serialization store sets cause?</p><ol><li><code>for (i = 2; i &lt; n; i++) a[i] = a[i-2] + b[i];</code></li><li>A histogram over random keys: <code>hist[key[i]]++</code></li><li>applu's <code>tmat</code> loop</li></ol>`,
        a: `<ol><li><strong>Yes.</strong> The load in iteration i always reads the store from iteration i − 2, a fixed distance of 2 store instances. The predictor learns 2 at the first violation, and the two independent chains (even and odd i) overlap as with perfect prediction.</li><li><strong>No.</strong> The dependence depends on the key values, not on a distance. Whatever distance was recorded is usually wrong for the next repeat. Waiting for a store that writes a different bin is a cheap false dependence, but the actual repeats come at unpredictable distances and violate. The predictor ends up roughly as good as naive speculation, which is fine here because repeats are rare.</li><li><strong>Partly.</strong> The pattern is regular, but the distance between the conflicting instances changes with <code>ip</code> and <code>m</code>, since the inner loops shrink as <code>ip</code> grows. One distance per set fits one part of the nest and mispredicts the rest. A fix needs either several distances per pair or the compiler's full unroll, which gives each conflicting pair its own PCs.</li></ol><p>The general lesson: PC-only prediction fails on instance-specific dependences, and distance helps only when the distance is constant.</p>`
      }
    ]
  }
},

{
  id: "mdp-takeaways",
  region: "mdep",
  title: "Takeaways",
  sections: [
    { id: "takeaways", label: "Takeaways" }
  ],
  body: `
<p>The whole region in six points.</p>

<h3 id="sec-takeaways">Takeaways</h3>
<ul>
<li>Not speculating costs up to more than 2× in run time from false dependences, and naive speculation leaves much of the gap open because of violation traps. The cost of both grows with window size.</li>
<li>Memory dependences come from a few static store-load pairs that repeat, so learning from past violations works.</li>
<li>A good predictor must let one load wait for several stores and several loads share one store. Dropping either costs up to about 45% run time on some programs.</li>
<li>The SSIT and LFST get both with direct-mapped tables. The tricks are one SSID per store, an in-order chain of stores within a set, and merging sets by the smaller SSID.</li>
<li>Untagged tables need a way to forget. Periodic clearing is cheap and works as well as per-entry confidence counters, which suffer from aliasing.</li>
<li>4K SSIT entries and 128 LFST entries got within a few percent of perfect on a 128-entry-window, 8-wide machine. The failure mode that's left is iteration-specific dependences, which PC-indexed sets serialize.</li>
</ul>
<p class="refs">References: Chrysos and Emer, "Memory Dependence Prediction using Store Sets," ISCA 1998 · Moshovos, Breach, Vijaykumar, and Sohi, "Dynamic Speculation and Synchronization of Data Dependences," ISCA 1997 · Moshovos and Sohi, "Streamlining Inter-operation Memory Communication via Data Dependence Prediction," MICRO 1997 · Tyson and Austin, "Improving the Accuracy and Performance of Memory Communication Through Renaming," MICRO 1997 · Compaq, Alpha 21264/EV67 Microprocessor Hardware Reference Manual (stWait table) · Hennessy and Patterson, Computer Architecture: A Quantitative Approach, chapter 3</p>`,
  practice: {
    guided: [
      {
        q: `<p>A loop body holds three loads:</p><ul><li>L1 never reads anything an older in-flight store writes.</li><li>L2 reads the value that store S2, a few instructions earlier, writes on every iteration.</li><li>L3 reads a variable written by store S3a or store S3b, depending on a branch, a few instructions earlier.</li></ul><p>Walk through what each load does in steady state under no speculation, naive speculation, a wait bit per load, and store sets.</p>`,
        a: `<ol><li>No speculation: all three loads wait for every older store. L2 and L3 wait correctly but also behind unrelated stores, and L1's waits are all false dependences.</li><li>Naive speculation: all three loads issue as soon as their addresses are ready. L1 is always right. L2 violates on nearly every iteration, and L3 violates whenever the store it reads from resolves after it, each time flushing it and everything younger.</li><li>Wait bit: L1's bit stays clear, so it runs freely. L2's and L3's bits get set after their first violations, so they stop violating but wait for every older store, the WAIT policy, which costs more as the window grows. Periodic clearing makes each relearn with one violation.</li><li>Store sets: L1's set stays empty. L2's set is {S2}, so it waits only for S2. L3's set grows to {S3a, S3b} after one violation with each, and since the two stores share the set, L3 waits for whichever was fetched last, which is the one on the path actually taken.</li><li>So store sets match perfect prediction on all three, using one violation per store-load pair to learn. Its remaining weakness is the one this loop doesn't have: a load that conflicts with only some instances of a store.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Your new predictor cuts ordering violations by 80% but IPC drops 1%. What happened?</p>`,
        a: `<p>Probably false dependences: loads waiting for stores they never alias with. Measure loads delayed by the predictor whose store didn't actually overlap. Likely causes are PC aliasing in the tables, store sets merging into large sets, or no periodic clearing, so old conflicts keep loads conservative forever.</p>`
      }
    ]
  }
}
]);
