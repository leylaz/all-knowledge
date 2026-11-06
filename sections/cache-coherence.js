/* Section: Coherence
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "coh"). */

section({
  id: "coh",
  name: "Coherence",
  cap: "Keeping copies of a line consistent",
  sections: [
    { id: "snooping-directory", label: "Snooping vs. Directory" }
  ],
  body: `
<p>With private caches, several copies of a line can exist. Coherence protocols keep them consistent so software sees one value per location.</p>
<h3 id="sec-snooping-directory">Snooping vs. Directory</h3>
<p>Snooping broadcasts every miss to all caches: simple and fast at small core counts, but bandwidth grows with cores. Directories send point-to-point messages to only the caches involved, which scales but adds indirection through the home node.</p>`,
  practice: {
    guided: [
      {
        q: `<p>Classify each as a coherence or a consistency question: (a) Can two cores see different final values for X? (b) Can core 1 see the write to Y before the earlier write to X from core 0?</p>`,
        a: `<p>(a) Coherence: it concerns a single location. (b) Consistency: it concerns the order of accesses to different locations.</p>`
      }
    ],
    interview: [
      {
        q: `<p>You're designing an 8-core client chip and a 128-core server chip. Which coherence approach for each, and why?</p>`,
        a: `<p>8 cores: snooping (or a snoop filter on a shared LLC) is reasonable; broadcast traffic is modest and latency is low. 128 cores: a directory, typically co-located with distributed LLC slices, because broadcasting to 128 caches wastes bandwidth and energy. Many real designs blend the two: an inclusive LLC or snoop filter acts as a directory so only true sharers get probed.</p>`
      }
    ]
  }
}, [
{
  id: "mesi",
  region: "coh",
  title: "Cache Coherence and MESI",
  sections: [
    { id: "mesi-states", label: "MESI States" },
    { id: "snooping", label: "Snooping" },
    { id: "coherence-consistency", label: "Coherence vs. Consistency" }
  ],
  body: `
<p>Coherence keeps every copy of a single location consistent: single writer or multiple readers, and reads return the last write.</p>
<h3 id="sec-mesi-states">MESI States</h3>
<ul><li><strong>Modified:</strong> only copy, dirty.</li><li><strong>Exclusive:</strong> only copy, clean; can become M silently.</li><li><strong>Shared:</strong> possibly other copies, read only.</li><li><strong>Invalid.</strong></li></ul>
<h3 id="sec-snooping">Snooping</h3>
<p>A read miss broadcasts a read; an owner in M supplies data and drops to S. A write broadcasts ownership requests that invalidate other copies. MOESI adds Owned, letting dirty lines be shared without writeback.</p>
<h3 id="sec-coherence-consistency">Coherence vs. Consistency</h3>
<p>Coherence covers one address; consistency covers the order across addresses.</p>`,
  practice: {
    guided: [
      {
        q: `<p>Two cores, line X starts Invalid in both. Trace MESI states for: C0 reads, C1 reads, C1 writes, C0 reads.</p>`,
        a: `<ol><li>C0 reads: no other copies, so C0 = <strong>E</strong>.</li><li>C1 reads: C0 E→S, C1 = S.</li><li>C1 writes: upgrade invalidates C0. C1 = <strong>M</strong>, C0 = I.</li><li>C0 reads: C1 supplies the data and drops M→S, writing back (in MOESI it could go to O instead). C0 = S, C1 = S.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Two threads each increment their own counter one million times, but the counters share a cache line. On this chip a core-to-core line transfer takes about 100 cycles, and an increment of a counter that stays in the local L1 takes about 5 cycles (a load, an add, and a store forwarded to the next load). Describe the coherence traffic and bound its cost.</p>`,
        a: `<p>Each write needs the line in M. When the threads interleave, every increment can require an ownership request that invalidates the other core's copy, so the line ping-pongs. In the worst case each increment waits for a 100-cycle transfer instead of a 5-cycle local update: up to 100 / 5 = 20× slower, about 2 × 10<sup>6</sup> × 100 = 2 × 10<sup>8</sup> cycles of transfers. In practice it is somewhat less, because a core often does several increments while it holds the line. Padding each counter to its own line fixes it.</p>`
      },
      {
        q: `<p>Why does the E state exist?</p>`,
        a: `<p>Private data is often read and then written. Without E, the read leaves the line in S and the write needs an upgrade message. With E, the core knows it has the only copy and can move to M silently.</p>`
      }
    ]
  }
},

{
  id: "moesi",
  region: "coh",
  title: "MOESI, MESIF, and Snoop Filters",
  sections: [
    { id: "owned", label: "MOESI: The Owned State" },
    { id: "forward", label: "MESIF: The Forward State" },
    { id: "chi", label: "The Same States in CHI" },
    { id: "filters", label: "Snoop Filters and Inclusion" },
    { id: "model", label: "What to Model" }
  ],
  body: `
<p><a href="#/mesi">MESI</a> leaves two inefficiencies: a dirty line must be written back to memory before it can be shared, and when several caches share a clean line, it isn't clear which one should supply it. Two extensions each add one state to fix one of these. Separately, every protocol needs a way to avoid asking every cache about every miss, which is the job of snoop filters.</p>

<h3 id="sec-owned">MOESI: The Owned State</h3>
<p>In MESI, when another core reads a Modified line, the owner supplies the data, drops to Shared, and the line must also be written back, because Shared means "memory is up to date." MOESI adds <strong>Owned</strong>: dirty and possibly shared. The previous owner keeps the line in O, supplies data to readers, and stays responsible for the eventual writeback; the readers hold it in S.</p>
<ul>
<li><strong>Saves:</strong> a memory write each time a dirty line is first shared, which matters for producer-consumer patterns where one core writes and others read repeatedly.</li>
<li><strong>Costs:</strong> one more state, and the owner must answer reads instead of memory, so its cache sees the traffic.</li>
</ul>
<p>AMD's processors have used MOESI since the Opteron.</p>

<h3 id="sec-forward">MESIF: The Forward State</h3>
<p>With a clean line shared by several caches, a new reader could get the data from memory (slow) or from a sharer (fast), but if every sharer answers, the replies are redundant. MESIF, used by Intel since the QuickPath Interconnect, designates one sharer as <strong>Forward</strong>: it alone answers requests for the line, while the others stay in S and stay silent. The newest requester usually receives the F state, since it is the least likely to evict the line soon.</p>

<h3 id="sec-chi">The Same States in CHI</h3>
<p>Arm's AMBA CHI names states by two properties, uniqueness and dirtiness, which maps neatly onto MOESI:</p>
<div class="tbl"><table>
<tr><th>CHI state</th><th>MOESI equivalent</th></tr>
<tr><td>UniqueDirty (UD)</td><td>Modified</td></tr>
<tr><td>UniqueClean (UC)</td><td>Exclusive</td></tr>
<tr><td>SharedDirty (SD)</td><td>Owned</td></tr>
<tr><td>SharedClean (SC)</td><td>Shared</td></tr>
<tr><td>Invalid (I)</td><td>Invalid</td></tr>
</table></div>
<p>CHI also adds partial states for lines with only some bytes valid. See <a href="#/icx-coherent/chi-flow">A CHI Read, Step by Step</a> for how CHI transactions flow.</p>

<h3 id="sec-filters">Snoop Filters and Inclusion</h3>
<p>Broadcasting every miss to every core doesn't scale. A <strong>snoop filter</strong> tracks which private caches might hold each line, so a request probes only those caches, or none.</p>
<ul>
<li><strong>Inclusive LLC as the filter:</strong> if the last-level cache holds a copy of every line in the private caches, a tag in the LLC plus a few "core valid" bits is the filter. The cost: LLC capacity spent on duplicates, and evicting an LLC line must invalidate the private copies (back-invalidation), even if a core is actively using it.</li>
<li><strong>Separate snoop filter with a non-inclusive LLC:</strong> Intel's Skylake server cores moved to this, along with a larger private L2. The filter holds only tags and presence bits, so it is cheaper per tracked line than duplicating the data. AMD's Zen L3 keeps shadow tags of the L2s it serves for the same purpose.</li>
<li><strong>Coverage:</strong> the filter must track at least as many lines as the private caches hold. If it is undersized or poorly associative, its evictions back-invalidate lines that cores are still using, which shows up as unexplained L2 misses.</li>
</ul>

<h3 id="sec-model">What to Model</h3>
<ul>
<li>Which agent supplies data for each request type (memory, owner, forwarder) and the latency of each path.</li>
<li>Writebacks caused by sharing in MESI versus their absence in MOESI, for producer-consumer workloads.</li>
<li>Snoop filter capacity, associativity, and back-invalidations; a model with an ideal filter hides a real source of misses.</li>
</ul>
<p class="refs">References: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Chapter 5 (extensions to the basic coherence protocol) · Sorin, Hill, and Wood, <em>A Primer on Memory Consistency and Cache Coherence</em>, 2nd ed. (2020), Chapters 7 and 8 · Arm, <em>AMBA CHI Architecture Specification</em></p>`,
  practice: {
    guided: [
      {
        q: `<p>Three cores and MOESI; line X starts Invalid everywhere and clean in memory. Trace the states and count memory writes for: C0 writes, C1 reads, C2 reads, C0 writes. How many memory writes would MESI need for the same sequence?</p>`,
        a: `<ol><li>C0 writes: C0 = M. Memory writes: 0.</li><li>C1 reads: C0 supplies the data and goes M → <strong>O</strong>; C1 = S. No writeback.</li><li>C2 reads: C0 (the owner) supplies again; C0 = O, C1 = S, C2 = S.</li><li>C0 writes: it invalidates C1 and C2 and goes O → M. Still no memory writes: <strong>0</strong> so far (the line is written back only when C0 eventually evicts it).</li><li>MESI: at step 2, C0 goes M → S and the dirty line is written back: <strong>1 memory write</strong>, and it would repeat every time the line is written and then shared again.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A 60-core server chip has a 2 MB private L2 per core, 64-byte lines, and a non-inclusive L3 with a snoop filter. How many lines must the filter be able to track, and what happens if it is built at half that size?</p>`,
        a: `<p>Private capacity: 60 × 2 MB = 120 MB. In 64-byte lines: 120 MB / 64 B ≈ 1.97 million lines, and in practice more, because set-associativity conflicts mean the filter can't be 100% full. If it is built at half that size, then whenever cores' working sets fill their L2s, the filter must evict entries, and each eviction back-invalidates a line in some L2 that may be in active use. Those lines then miss in L2, refill from L3 or memory, and re-enter the filter, evicting something else. In a model, it shows up as L2 misses that a private-cache simulation can't explain; on silicon, as L2 miss rates that rise with core count even for per-core-private data. That's why filters are sized to cover all private capacity with associativity to spare.</p>`
      }
    ]
  }
},

{
  id: "directory",
  region: "coh",
  title: "Directory-Based Coherence",
  sections: [
    { id: "why", label: "Why Snooping Stops Scaling" },
    { id: "nodes", label: "Home, Local, and Remote Nodes" },
    { id: "states", label: "Directory States" },
    { id: "messages", label: "The Protocol Messages" },
    { id: "machines", label: "The Two State Machines" },
    { id: "flows", label: "Flows: 4-Hop and 3-Hop" },
    { id: "sharer-tracking", label: "Sharer Tracking" },
    { id: "on-chip", label: "Directories on One Chip" },
    { id: "hard-part", label: "Making It Work on a Real Network" },
    { id: "model", label: "What to Model" }
  ],
  body: `
<p>A directory keeps, for every memory block, a record of which caches hold it and in what state. A miss goes to that record instead of to every cache, so coherence becomes a set of point-to-point messages. The structure of this page follows Hennessy &amp; Patterson's Chapter 5 (distributed shared memory and directory-based coherence), with the implementation details from their Appendix I and from Sorin, Hill, and Wood's primer.</p>

<h3 id="sec-why">Why Snooping Stops Scaling</h3>
<p>A snooping protocol needs every miss to reach every cache, and in a fixed order. That costs in three ways as core count grows:</p>
<ul>
<li><strong>Bandwidth:</strong> each miss becomes N probes, so probe traffic grows as N × (miss rate per core) × N, roughly with the square of the core count.</li>
<li><strong>Tag bandwidth:</strong> every cache must look up every probe, even though almost all of them miss. The lookups compete with the core's own accesses.</li>
<li><strong>Ordering:</strong> a bus or ring orders broadcasts for free. A mesh doesn't, and building a global order on one costs latency.</li>
</ul>
<p>Once memory is distributed across nodes (each with its own controller and DRAM), a broadcast medium is no longer natural anyway. Hennessy &amp; Patterson call this <strong>distributed shared memory (DSM)</strong>: one address space, physically split across nodes, with nonuniform access times. The directory is distributed the same way as the memory.</p>

<h3 id="sec-nodes">Home, Local, and Remote Nodes</h3>
<p>Every block has a fixed <strong>home node</strong>, chosen from its physical address, that holds both its memory and its directory entry. Hennessy &amp; Patterson name three roles for a transaction:</p>
<ul>
<li><strong>Local node:</strong> where the request starts (the core that missed).</li>
<li><strong>Home node:</strong> where the block's memory and directory entry live.</li>
<li><strong>Remote node:</strong> a node that holds a copy of the block, shared or exclusive.</li>
</ul>
<p>One node can play more than one role: when the local node is also the home, the request to the directory never leaves the node. The home serializes all requests to its blocks, which is what gives the protocol a single order of writes per location without a broadcast.</p>

<h3 id="sec-states">Directory States</h3>
<p>The directory entry tracks the block's global state plus the set of caches that hold it:</p>
<ul>
<li><strong>Uncached:</strong> no cache has a copy. Memory is up to date.</li>
<li><strong>Shared:</strong> one or more caches have read-only copies. Memory is up to date.</li>
<li><strong>Modified (exclusive):</strong> exactly one cache has the block and may have written it. Memory may be stale, and that cache is the <strong>owner</strong>.</li>
</ul>
<p>The <strong>sharers</strong> set is typically a bit vector with one bit per node. In Modified, it names the owner. The directory's states describe the whole system, while each cache keeps its own MSI (or MESI) state for its own copy. The two views agree only when no transaction is in flight.</p>

<h3 id="sec-messages">The Protocol Messages</h3>
<p>Hennessy &amp; Patterson's basic protocol uses these messages (P is the requesting node, A the address, D the data):</p>
<div class="tbl"><table>
<tr><th>Message</th><th>From</th><th>To</th><th>Contents</th><th>Meaning</th></tr>
<tr><td>Read miss</td><td>Local cache</td><td>Home directory</td><td>P, A</td><td>P missed on a read of A. Send the data and add P as a sharer.</td></tr>
<tr><td>Write miss</td><td>Local cache</td><td>Home directory</td><td>P, A</td><td>P missed on a write to A. Send the data and make P the exclusive owner.</td></tr>
<tr><td>Invalidate</td><td>Local cache</td><td>Home directory</td><td>A</td><td>P holds A shared and wants to write it. Invalidate all other copies.</td></tr>
<tr><td>Invalidate</td><td>Home directory</td><td>Remote cache</td><td>A</td><td>Invalidate the shared copy of A.</td></tr>
<tr><td>Fetch</td><td>Home directory</td><td>Remote cache</td><td>A</td><td>Send block A back to the home and drop to Shared.</td></tr>
<tr><td>Fetch/invalidate</td><td>Home directory</td><td>Remote cache</td><td>A</td><td>Send block A back to the home and invalidate it.</td></tr>
<tr><td>Data value reply</td><td>Home directory</td><td>Local cache</td><td>D</td><td>The data, from the home's memory.</td></tr>
<tr><td>Data write-back</td><td>Remote cache</td><td>Home directory</td><td>A, D</td><td>The block's data, sent on a fetch or on eviction of a dirty block.</td></tr>
</table></div>
<p>Messages fall into classes. The first three are <strong>requests</strong> from a cache to the home. Invalidate, fetch, and fetch/invalidate are <strong>forwarded requests</strong> from the home to other caches. The data value reply and the data write-back are <strong>replies</strong> that carry data. Real protocols add acknowledgments (invalidation acks, write-back acks) and negative acknowledgments, and they put each class on its own virtual network (see <a href="#/icx-noc/protocol-deadlock">Protocol Deadlock and Virtual Networks</a>).</p>

<h3 id="sec-machines">The Two State Machines</h3>
<p>Each cache runs the usual MSI machine, but its bus actions become messages to the home:</p>
<ul>
<li><strong>Invalid:</strong> a read sends a read miss and goes to Shared. A write sends a write miss and goes to Modified.</li>
<li><strong>Shared:</strong> a read hits. A write sends an invalidate (or a write miss) to the home and goes to Modified. An invalidate from the home sends the copy to Invalid.</li>
<li><strong>Modified:</strong> reads and writes hit. A fetch sends a data write-back and drops to Shared. A fetch/invalidate sends a data write-back and goes to Invalid. Evicting the block sends a data write-back.</li>
</ul>
<p>The directory runs a second machine per block, driven by messages:</p>
<div class="tbl"><table>
<tr><th>Directory state</th><th>Read miss from P</th><th>Write miss from P</th><th>Data write-back from the owner</th></tr>
<tr><td>Uncached</td><td><ul><li>Data value reply</li><li>Sharers = {P}</li><li>→ Shared</li></ul></td><td><ul><li>Data value reply</li><li>Sharers = {P}</li><li>→ Modified</li></ul></td><td>Can't happen</td></tr>
<tr><td>Shared</td><td><ul><li>Data value reply</li><li>Sharers += {P}</li></ul></td><td><ul><li>Invalidate every sharer</li><li>Data value reply</li><li>Sharers = {P}</li><li>→ Modified</li></ul></td><td>Can't happen</td></tr>
<tr><td>Modified</td><td><ul><li>Fetch to the owner</li><li>Owner's write-back updates memory</li><li>Data value reply to P</li><li>Sharers = {owner, P}</li><li>→ Shared</li></ul></td><td><ul><li>Fetch/invalidate to the owner</li><li>Data value reply to P</li><li>Sharers = {P}</li><li>Stays Modified</li></ul></td><td><ul><li>Memory updated</li><li>Sharers = {}</li><li>→ Uncached</li></ul></td></tr>
</table></div>
<p>Hennessy &amp; Patterson simplify on purpose: they treat each transaction as atomic (the home finishes one before starting the next for that block) and leave out acknowledgments. The full directory-side table, with acknowledgments, explicit evictions, and its transient state, is on <a href="#/coh-dir-ctrl">Inside the Directory Controller</a>. The last two sections of this page cover what that hides.</p>

<h3 id="sec-flows">Flows: 4-Hop and 3-Hop</h3>
<p>The number of serial network traversals on a miss sets most of its latency:</p>
<ul>
<li><strong>2 hops (clean miss):</strong> local → home, home → local with data from memory or a home-side cache slice.</li>
<li><strong>4 hops (dirty miss, basic protocol):</strong> local → home (read miss), home → owner (fetch), owner → home (data write-back), home → local (data value reply). Memory is updated on the way through.</li>
<li><strong>3 hops (dirty miss with forwarding):</strong> local → home, home → owner (forwarded request), owner → local (data, directly). The owner also tells the home it's done, off the critical path. Almost every modern protocol does this. It's CHI's direct cache transfer (see <a href="#/icx-coherent/chi-flow">A CHI Read, Step by Step</a>).</li>
<li><strong>Write miss to a shared block:</strong> the home sends invalidations to every sharer and, in protocols with acks, tells the requester how many acks to expect. The sharers ack the requester directly, and the write completes at the last ack.</li>
</ul>
<div class="tbl"><svg viewBox="0 0 680 470" role="img" aria-label="A 4 by 4 mesh of tiles. The requester, core 12, sits at the bottom left, the home slice 3 at the top right, and the owner, core 10, at row 2, column 2. Message 1, the request, goes 3 hops east and 3 hops north to the home. Message 2, the forwarded request, goes 1 hop west and 2 hops south to the owner. Message 3, the data, goes 2 hops west and 1 hop south straight to the requester. A dashed message from the owner back to the home updates the directory off the critical path. The critical path is 6 + 3 + 3 = 12 hops, against 6 + 3 + 3 + 6 = 18 hops if the data went back through the home." style="width:100%;min-width:520px;max-width:680px;display:block;font-family:var(--sans)">
<text x="0" y="16" style="fill:var(--ink);font-size:13px;font-weight:600">A 3-hop read miss on a 4 × 4 mesh with XY routing</text>
<rect x="40" y="40" width="70" height="70" rx="4" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<text x="44" y="52" style="fill:var(--muted);font-size:9px">tile 0</text>
<rect x="140" y="40" width="70" height="70" rx="4" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<text x="144" y="52" style="fill:var(--muted);font-size:9px">tile 1</text>
<rect x="240" y="40" width="70" height="70" rx="4" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<text x="244" y="52" style="fill:var(--muted);font-size:9px">tile 2</text>
<rect x="340" y="40" width="70" height="70" rx="4" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.2"/>
<text x="344" y="52" style="fill:var(--muted);font-size:9px">tile 3</text>
<text x="375.0" y="81.0" text-anchor="middle" style="fill:var(--ink);font-size:16px;font-weight:700">H</text>
<rect x="40" y="140" width="70" height="70" rx="4" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<text x="44" y="152" style="fill:var(--muted);font-size:9px">tile 4</text>
<rect x="140" y="140" width="70" height="70" rx="4" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<text x="144" y="152" style="fill:var(--muted);font-size:9px">tile 5</text>
<rect x="240" y="140" width="70" height="70" rx="4" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<text x="244" y="152" style="fill:var(--muted);font-size:9px">tile 6</text>
<rect x="340" y="140" width="70" height="70" rx="4" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<text x="344" y="152" style="fill:var(--muted);font-size:9px">tile 7</text>
<rect x="40" y="240" width="70" height="70" rx="4" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<text x="44" y="252" style="fill:var(--muted);font-size:9px">tile 8</text>
<rect x="140" y="240" width="70" height="70" rx="4" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<text x="144" y="252" style="fill:var(--muted);font-size:9px">tile 9</text>
<rect x="240" y="240" width="70" height="70" rx="4" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.2"/>
<text x="244" y="252" style="fill:var(--muted);font-size:9px">tile 10</text>
<text x="275.0" y="281.0" text-anchor="middle" style="fill:var(--ink);font-size:16px;font-weight:700">O</text>
<rect x="340" y="240" width="70" height="70" rx="4" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<text x="344" y="252" style="fill:var(--muted);font-size:9px">tile 11</text>
<rect x="40" y="340" width="70" height="70" rx="4" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.2"/>
<text x="44" y="352" style="fill:var(--muted);font-size:9px">tile 12</text>
<text x="75.0" y="381.0" text-anchor="middle" style="fill:var(--ink);font-size:16px;font-weight:700">R</text>
<rect x="140" y="340" width="70" height="70" rx="4" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<text x="144" y="352" style="fill:var(--muted);font-size:9px">tile 13</text>
<rect x="240" y="340" width="70" height="70" rx="4" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<text x="244" y="352" style="fill:var(--muted);font-size:9px">tile 14</text>
<rect x="340" y="340" width="70" height="70" rx="4" style="fill:var(--surface);stroke:var(--rule);stroke-width:0.8"/>
<text x="344" y="352" style="fill:var(--muted);font-size:9px">tile 15</text>
<line x1="110" y1="75.0" x2="140" y2="75.0" style="stroke:var(--rule);stroke-width:2"/>
<line x1="210" y1="75.0" x2="240" y2="75.0" style="stroke:var(--rule);stroke-width:2"/>
<line x1="310" y1="75.0" x2="340" y2="75.0" style="stroke:var(--rule);stroke-width:2"/>
<line x1="110" y1="175.0" x2="140" y2="175.0" style="stroke:var(--rule);stroke-width:2"/>
<line x1="210" y1="175.0" x2="240" y2="175.0" style="stroke:var(--rule);stroke-width:2"/>
<line x1="310" y1="175.0" x2="340" y2="175.0" style="stroke:var(--rule);stroke-width:2"/>
<line x1="110" y1="275.0" x2="140" y2="275.0" style="stroke:var(--rule);stroke-width:2"/>
<line x1="210" y1="275.0" x2="240" y2="275.0" style="stroke:var(--rule);stroke-width:2"/>
<line x1="310" y1="275.0" x2="340" y2="275.0" style="stroke:var(--rule);stroke-width:2"/>
<line x1="110" y1="375.0" x2="140" y2="375.0" style="stroke:var(--rule);stroke-width:2"/>
<line x1="210" y1="375.0" x2="240" y2="375.0" style="stroke:var(--rule);stroke-width:2"/>
<line x1="310" y1="375.0" x2="340" y2="375.0" style="stroke:var(--rule);stroke-width:2"/>
<line x1="75.0" y1="110" x2="75.0" y2="140" style="stroke:var(--rule);stroke-width:2"/>
<line x1="75.0" y1="210" x2="75.0" y2="240" style="stroke:var(--rule);stroke-width:2"/>
<line x1="75.0" y1="310" x2="75.0" y2="340" style="stroke:var(--rule);stroke-width:2"/>
<line x1="175.0" y1="110" x2="175.0" y2="140" style="stroke:var(--rule);stroke-width:2"/>
<line x1="175.0" y1="210" x2="175.0" y2="240" style="stroke:var(--rule);stroke-width:2"/>
<line x1="175.0" y1="310" x2="175.0" y2="340" style="stroke:var(--rule);stroke-width:2"/>
<line x1="275.0" y1="110" x2="275.0" y2="140" style="stroke:var(--rule);stroke-width:2"/>
<line x1="275.0" y1="210" x2="275.0" y2="240" style="stroke:var(--rule);stroke-width:2"/>
<line x1="275.0" y1="310" x2="275.0" y2="340" style="stroke:var(--rule);stroke-width:2"/>
<line x1="375.0" y1="110" x2="375.0" y2="140" style="stroke:var(--rule);stroke-width:2"/>
<line x1="375.0" y1="210" x2="375.0" y2="240" style="stroke:var(--rule);stroke-width:2"/>
<line x1="375.0" y1="310" x2="375.0" y2="340" style="stroke:var(--rule);stroke-width:2"/>
<defs><marker id="arrMesh3hop" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--redirect)"/></marker></defs>
<path d="M63.0,363.0 L363.0,363.0 L363.0,63.0" marker-end="url(#arrMesh3hop)" style="fill:none;stroke:var(--redirect);stroke-width:2.2"/>
<circle cx="175" cy="343" r="10" style="fill:var(--redirect)"/><text x="175" y="347" text-anchor="middle" style="fill:var(--paper);font-size:11px;font-weight:700">1</text>
<path d="M385.0,85.0 L285.0,85.0 L285.0,285.0" marker-end="url(#arrMesh3hop)" style="fill:none;stroke:var(--redirect);stroke-width:2.2"/>
<circle cx="290" cy="85" r="10" style="fill:var(--redirect)"/><text x="290" y="89" text-anchor="middle" style="fill:var(--paper);font-size:11px;font-weight:700">2</text>
<path d="M275.0,275.0 L75.0,275.0 L75.0,375.0" marker-end="url(#arrMesh3hop)" style="fill:none;stroke:var(--redirect);stroke-width:2.2"/>
<circle cx="175" cy="275" r="10" style="fill:var(--redirect)"/><text x="175" y="279" text-anchor="middle" style="fill:var(--paper);font-size:11px;font-weight:700">3</text>
<path d="M297.0,297.0 L397.0,297.0 L397.0,97.0" marker-end="url(#arrMesh3hop)" style="fill:none;stroke:var(--redirect);stroke-width:2.2;stroke-dasharray:5 4"/>
<g style="fill:var(--ink);font-size:11px">
<circle cx="460" cy="66" r="8" style="fill:var(--redirect)"/><text x="460" y="70" text-anchor="middle" style="fill:var(--paper);font-size:10px;font-weight:700">1</text>
<text x="474" y="70">Request R → H: 3 + 3 = 6 hops</text>
<circle cx="460" cy="92" r="8" style="fill:var(--redirect)"/><text x="460" y="96" text-anchor="middle" style="fill:var(--paper);font-size:10px;font-weight:700">2</text>
<text x="474" y="96">Forward H → O: 1 + 2 = 3 hops</text>
<circle cx="460" cy="118" r="8" style="fill:var(--redirect)"/><text x="460" y="122" text-anchor="middle" style="fill:var(--paper);font-size:10px;font-weight:700">3</text>
<text x="474" y="122">Data O → R: 2 + 1 = 3 hops</text>
<text x="474" y="148">Dashed: O notifies H, off the critical path</text>
</g>
<g style="fill:var(--ink);font-size:11px"><text x="460" y="200">Critical path: 6 + 3 + 3 = 12 hops</text><text x="460" y="218">Through the home (4-hop):</text><text x="460" y="234">6 + 3 + 3 + 6 = 18 hops</text></g>
<g style="fill:var(--muted);font-size:11px"><text x="460" y="270">R = Requester (core 12)</text><text x="460" y="288">H = Home (LLC slice 3)</text><text x="460" y="306">O = Owner (core 10)</text></g>
</svg></div>
<p>Three-hop flows save latency but create races, because the requester can now get messages about the block from two different senders. That's the subject of <a href="#/coh-transient">Transient States and Protocol Races</a>.</p>

<h3 id="sec-sharer-tracking">Sharer Tracking</h3>
<p>A full bit vector costs one bit per node per block, which grows linearly with node count for every block in memory. The alternatives trade precision for space:</p>
<ul>
<li><strong>Limited pointers (Dir<sub>i</sub>):</strong> store i node IDs of log<sub>2</sub>N bits each. Most blocks have few sharers, so a handful of pointers covers almost all of them. On overflow, broadcast (Dir<sub>i</sub>B), refuse a new sharer by invalidating one (Dir<sub>i</sub>NB), or fall back to a coarse vector.</li>
<li><strong>Coarse vectors:</strong> one bit per group of nodes. An invalidation goes to the whole group, so some messages reach caches that don't hold the block.</li>
<li><strong>Sparse directories:</strong> only blocks that are actually cached need an entry, so the directory becomes a set-associative cache of entries, sized to the total private-cache capacity rather than to memory. Evicting an entry forces invalidations of every copy it tracked.</li>
<li><strong>Directory in memory plus a directory cache:</strong> multi-socket servers keep a few state bits per line in DRAM (Intel stores them in spare ECC bits) and cache the hot entries on chip, so most lookups don't need a DRAM read.</li>
</ul>

<h3 id="sec-on-chip">Directories on One Chip</h3>
<p>Inside one multicore, the "node" is a tile: a core with its private caches, plus a slice of the shared last-level cache. Hennessy &amp; Patterson's Section 5.2 notes that a banked, shared L3 can hold the directory for its bank, and that's how real chips work:</p>
<ul>
<li><strong>Address-sliced home:</strong> a hash of the physical address picks the LLC slice, and that slice's controller is the block's home and directory. Intel calls it the caching and home agent (CHA) on its mesh server chips. Arm's CMN mesh calls it the fully coherent home node (HN-F).</li>
<li><strong>Inclusive LLC as the directory:</strong> per-core valid bits on each LLC tag are a full bit vector, free of extra tag storage. Intel's ring-based client chips do this.</li>
<li><strong>Snoop filter beside a non-inclusive LLC:</strong> a sparse directory that tracks only the private caches' contents (see <a href="#/moesi/filters">Snoop Filters and Inclusion</a>).</li>
<li><strong>Two levels:</strong> AMD's chiplet processors keep shadow tags in each CCX's L3 for the cores it serves, plus a probe filter at the memory side for coherence between chiplets and sockets.</li>
</ul>
<p>Hennessy &amp; Patterson's Section 5.8 compares commercial multicores along these lines: how cores, LLC slices, and the coherence point are connected (ring, mesh, or crossbar), and how the cost of a miss to a remote slice or socket grows with distance.</p>

<h3 id="sec-hard-part">Making It Work on a Real Network</h3>
<p>Hennessy &amp; Patterson's Appendix I lists what the atomic-transaction model hides once messages travel over a real network with finite buffers:</p>
<ul>
<li><strong>Transactions aren't atomic.</strong> While the home waits for an owner's write-back, more requests for the same block arrive. The home must mark the entry busy and either queue them or send a negative acknowledgment (NAK) so the requester retries. Queuing is fair but needs buffer space. NAKs need none but can starve a requester and waste bandwidth under contention. Arm's CHI uses a variant: a retry response plus a credit that guarantees the retry a slot.</li>
<li><strong>Messages race.</strong> A requester can see an invalidation for a block whose data hasn't arrived yet, or an owner can receive a forwarded request for a block it's evicting. Each case needs a transient state (see <a href="#/coh-transient/races">Races</a>).</li>
<li><strong>Writes need acknowledgments.</strong> To give sequential consistency (or even TSO), a write can't be considered done until every invalidation has been acknowledged.</li>
<li><strong>Buffers can deadlock.</strong> If requests fill the buffers that replies also need, a node waiting for a reply can never receive it. The fix is to give requests and replies separate networks (physical or virtual), and to guarantee that replies are always accepted, since a reply never generates a new message that could block.</li>
</ul>

<h3 id="sec-model">What to Model</h3>
<ul>
<li>The home slice for each address (the hash), and the hop distance from requester to home to owner on the actual topology.</li>
<li>2-hop, 3-hop, and 4-hop flows with their own latencies, not a single "remote hit" number.</li>
<li>A busy state per directory entry, so concurrent requests to one block queue or retry.</li>
<li>Directory capacity, if sparse, and the invalidations its evictions cause.</li>
<li>Invalidation fan-out: a write to a widely shared block waits for the slowest ack.</li>
</ul>
<p class="refs">References: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, 6th ed., Sections 5.2, 5.4, and 5.8, and Appendix I · Sorin, Hill, and Wood, <em>A Primer on Memory Consistency and Cache Coherence</em>, 2nd ed. (2020), Chapter 8 · Agarwal, Simoni, Hennessy, and Horowitz, "An Evaluation of Directory Schemes for Cache Coherence," ISCA 1988 · Laudon and Lenoski, "The SGI Origin: A ccNUMA Highly Scalable Server," ISCA 1997</p>`,
  practice: {
    guided: [
      {
        q: `<p>16 cores with a full bit-vector directory. Core 0 has a write miss to a line shared by cores 2, 5, and 9. Trace the messages.</p>`,
        a: `<ol><li>Core 0 → home: GetM (1 message).</li><li>Home → cores 2, 5, 9: Invalidate (3).</li><li>Home → core 0: data plus "expect 3 acks" (1).</li><li>Cores 2, 5, 9 → core 0: InvAck (3).</li><li>Core 0 completes after all 3 acks: <strong>8 messages</strong>. The home updates its entry to owner = core 0, state M.</li></ol>`
      },
      {
        q: `<p>On a mesh server chip, core 3 has a read miss on a block whose home is the LLC slice on tile 10, and core 21 holds the block in Modified. Each one-way message between these tiles takes 6 ns. The home's directory lookup takes 4 ns, the owner's L2 read takes 4 ns, and in the basic protocol the home takes 2 ns to turn the owner's write-back into the data value reply. Compute the miss latency with the basic 4-hop protocol and with 3-hop forwarding, and count the messages in each.</p>`,
        a: `<ol><li><strong>4-hop:</strong> read miss to the home (6 ns) + lookup (4 ns) + fetch to core 21 (6 ns) + L2 read (4 ns) + data write-back to the home (6 ns) + home handling (2 ns) + data value reply to core 3 (6 ns) = <strong>34 ns</strong>. Messages: read miss, fetch, data write-back, data value reply = 4 messages, all on the critical path.</li><li><strong>3-hop:</strong> request to the home (6 ns) + lookup (4 ns) + forwarded request to core 21 (6 ns) + L2 read (4 ns) + data straight to core 3 (6 ns) = <strong>26 ns</strong>.</li><li>Messages in the 3-hop flow: request, forwarded request, data to core 3, and a data copy to the home (core 21 drops to Shared, so the home's copy must be updated) = 4 messages, but only 3 on the critical path.</li><li>Saving: 34 ns − 26 ns = 8 ns, or 8 ns / 34 ns ≈ <strong>24%</strong> of the miss, with the same number of messages.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>64 cores, a 32 MB LLC with 64-byte lines, and a full bit-vector directory entry per line. What's the storage overhead, and how would you reduce it?</p>`,
        a: `<p>Lines: 32 MB / 64 B = 512K. Each needs 64 sharer bits: 512K × 64 bits = 4 MB, or <strong>12.5%</strong> of the data array (plus state bits). Reduce it with limited-pointer entries (track a few sharers, broadcast on overflow), coarse vectors (one bit per core cluster), or a sparse directory that tracks only lines actually cached in private caches.</p>`
      },
      {
        q: `<p>A request reaches a block's home while the directory entry is busy, waiting for the owner's write-back from an earlier request. Compare two policies: NAK the new request so the requester retries, or queue it at the home. Discuss correctness, buffer cost, and behavior under heavy contention, and say what a performance model must include for each.</p><p class="given">Assume a 48-core chip in which each core can have up to 16 outstanding misses, requests and replies travel on separate virtual networks, and replies are always accepted.</p>`,
        a: `<p>Both are correct as long as replies can't be blocked by requests, which the separate virtual networks guarantee. They differ in cost and fairness.</p><ul><li><strong>NAK and retry:</strong> the home needs no buffer for waiting requests, because a NAK is a reply and always drains. Under contention, though, retries burn request and reply bandwidth, and a requester can lose the race every time and starve. Real designs add backoff, or (like CHI) a credit that reserves a slot for the retry.</li><li><strong>Queue at the home:</strong> requests are served in arrival order with no extra traffic, so it's fair. The worst case needs a slot for every request that could be outstanding: 48 cores × 16 misses/core = 768 requests, at one home, if they all hit the same hot block. Designs size the queue for the common case and back-pressure the request network when it fills, which is safe only because replies have their own network.</li></ul><p>A model of NAKs needs the retry delay, the backoff policy, and the extra messages counted against network bandwidth. A model of queuing needs the per-entry busy state, the queue depth, and the back-pressure into the network once it fills. Either way, a model that treats every transaction as atomic charges a hot block's requests the uncontended latency and misses the serialization at the home, which is the dominant cost for contended locks.</p>`
      }
    ]
  }
},

{
  id: "coh-transient",
  region: "coh",
  title: "Transient States and Protocol Races",
  sections: [
    { id: "why", label: "Why Stable States Aren't Enough" },
    { id: "naming", label: "Naming Transient States" },
    { id: "flows", label: "The Basic Flows" },
    { id: "races", label: "Races" },
    { id: "deadlock", label: "Deadlock and Virtual Networks" },
    { id: "verify", label: "Verifying a Protocol" }
  ],
  body: `
<p>MESI and its relatives are described as a handful of stable states, as if every transition happened instantly. In a real system, a transition is a conversation of several messages over a network that delivers them with variable delay, and other requests for the same line arrive in the middle. The states a line passes through during that conversation, the <strong>transient states</strong>, are where most of a protocol's complexity, and most of its bugs, live. The examples here follow the MSI directory protocol in Sorin, Hill, and Wood's primer.</p>

<h3 id="sec-why">Why Stable States Aren't Enough</h3>
<p>When a cache in I issues a GetM to the directory, it can't be in M yet: it has no data, and other caches may still hold copies. It also can't stay in I, because if another request for the line arrives, the cache must know it has one outstanding. It needs a state meaning "on my way from I to M."</p>

<h3 id="sec-naming">Naming Transient States</h3>
<p>The primer's convention: <strong>XY<sup>Z</sup></strong> means "was in X, going to Y, waiting for Z," where Z is D (data), A (acknowledgments), or both:</p>
<ul>
<li><strong>IS<sup>D</sup>:</strong> sent GetS, waiting for data.</li>
<li><strong>IM<sup>AD</sup>:</strong> sent GetM, waiting for data and invalidation acks.</li>
<li><strong>IM<sup>A</sup>:</strong> has the data, still waiting for acks.</li>
<li><strong>SM<sup>AD</sup>:</strong> had a shared copy, sent GetM to upgrade.</li>
<li><strong>MI<sup>A</sup>:</strong> evicting a dirty line, sent PutM with the data, waiting for the directory's ack.</li>
</ul>

<h3 id="sec-flows">The Basic Flows</h3>
<ol>
<li><strong>Load miss:</strong> I → IS<sup>D</sup> (send GetS) → S when data arrives.</li>
<li><strong>Store miss:</strong> I → IM<sup>AD</sup> (send GetM). The directory sends data with the number of sharers to wait for, and invalidates the sharers, which ack directly to the requester. Data with zero acks expected → M; otherwise → IM<sup>A</sup> → M at the last ack.</li>
<li><strong>Upgrade:</strong> S → SM<sup>AD</sup> → SM<sup>A</sup> → M, the same way, keeping the old data readable meanwhile.</li>
<li><strong>Dirty eviction:</strong> M → MI<sup>A</sup> (send PutM with data) → I on the Put-Ack.</li>
</ol>

<h3 id="sec-races">Races</h3>
<p>Races happen because the directory orders requests, but caches see the consequences in a different order:</p>
<ul>
<li><strong>Upgrade loses the race:</strong> a cache in SM<sup>AD</sup> receives an Inv, because another core's GetM reached the directory first. Its shared copy is gone, so it acks the invalidation and moves to IM<sup>AD</sup>: it now needs data, not just permission.</li>
<li><strong>Invalidated before the data arrives:</strong> a cache in IS<sup>D</sup> receives an Inv for a newer writer before its own data arrives (the directory handled its GetS first, but the messages took different paths). It must still use the data once, for the load that missed, then drop to I: the primer's IS<sup>D</sup>I state.</li>
<li><strong>Forwarded request to an evicting owner:</strong> a cache in MI<sup>A</sup> receives Fwd-GetS or Fwd-GetM, because the directory still thinks it owns the line. It sends the data to the requester, moves to SI<sup>A</sup> or II<sup>A</sup>, and finishes when the Put-Ack arrives.</li>
<li><strong>Request to a line not yet owned:</strong> a cache in IM<sup>A</sup> receives a Fwd-GetM for a later writer. It can't answer until its own store completes, so it stalls the forwarded message (or buffers it) until it reaches M, performs its store, and then hands the line on.</li>
</ul>

<h3 id="sec-deadlock">Deadlock and Virtual Networks</h3>
<p>If a stalled forwarded request blocks a queue that the acks it is waiting for also travel through, the system deadlocks. Protocols prevent this by putting each message class on its own <strong>virtual network</strong> (separate buffers): requests, forwarded requests, and responses. Responses always sink (they never generate further messages that could block), so the response network always drains, and everything waiting on it eventually proceeds.</p>

<h3 id="sec-verify">Verifying a Protocol</h3>
<ul>
<li><strong>Protocol tables:</strong> every (state, event) pair has an entry: an action, a stall, or "impossible." Writing out the full table, rather than describing flows, is how missing races are found.</li>
<li><strong>Model checking:</strong> tools such as Murphi or TLA+ explore every interleaving for a small configuration (2 or 3 caches, one or two addresses) and check the invariants: single writer or multiple readers, data values, and no deadlock.</li>
<li><strong>RTL stress testing:</strong> random traffic concentrated on a few lines with many cores, to make races frequent, with coherence checkers in the testbench (see <a href="#/verif-testbench/interfaces">Checking Interfaces</a>).</li>
</ul>
<p class="refs">References: Sorin, Hill, and Wood, <em>A Primer on Memory Consistency and Cache Coherence</em>, 2nd ed. (2020), Chapters 6 to 8 · Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Chapter 5 · Dill, "The Murphi Verification System," CAV 1996</p>`,
  practice: {
    guided: [
      {
        q: `<p>Cores C0 and C1 both hold line X in S. Both store to it at nearly the same time, and C1's GetM reaches the directory first. Trace each cache's states and the messages until both stores complete.</p>`,
        a: `<ol><li>Both issue GetM: C0 and C1 move S → SM<sup>AD</sup>.</li><li>The directory handles C1's GetM: it sends C1 data with "expect 1 ack" and sends Inv to C0. Directory: M, owner C1.</li><li>C0, in SM<sup>AD</sup>, receives the Inv: it lost the race. It sends Inv-Ack to C1 and moves to <strong>IM<sup>AD</sup></strong>.</li><li>C1 receives data (1 ack expected) → SM<sup>A</sup>, then C0's Inv-Ack → <strong>M</strong>; its store completes.</li><li>The directory handles C0's GetM: the line is owned by C1, so it forwards Fwd-GetM to C1 and records owner C0.</li><li>C1 sends the data to C0 and goes M → I. (Had the Fwd-GetM arrived while C1 was still in SM<sup>A</sup>, C1 would stall it until its own store finished.)</li><li>C0 receives the data with 0 acks expected → <strong>M</strong>; its store completes. Final: C0 = M, C1 = I.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Should a cycle-level performance model implement every transient state of the coherence protocol? Argue both sides and say what you'd do.</p>`,
        a: `<p>Against: transient states mostly matter for correctness, which the RTL and protocol verification cover; implementing them makes the model slower and introduces its own protocol bugs, and most workloads rarely race on the same line.</p><p>For: performance under contention depends on them. Lock handoffs, contended atomics, and producer-consumer queues are races by design, and their latency includes stalled forwarded requests, retried requests, and extra hops that an "atomic transaction" model never charges. Those patterns dominate scaling of many multithreaded programs.</p><p>A practical middle: model transactions as message sequences with real latencies and a per-line busy state at the directory and the cache (so a second request for a busy line waits), which captures most contention cost without the full state table. Then validate with microbenchmarks that hammer one line from many cores against RTL or silicon, and add detail only where they disagree.</p>`
      }
    ]
  }
},

{
  id: "coh-dir-ctrl",
  region: "coh",
  title: "Inside the Directory Controller",
  sections: [
    { id: "events", label: "What the Directory Sees" },
    { id: "table", label: "The Directory's Protocol Table" },
    { id: "sd", label: "Why the Directory Waits for Data" },
    { id: "puts", label: "Explicit Evictions: PutS and PutM" },
    { id: "stalls", label: "Stalling vs. Non-Stalling Directories" },
    { id: "states", label: "Adding E and O" },
    { id: "model", label: "What to Model" }
  ],
  body: `
<p><a href="#/coh-transient">Transient States and Protocol Races</a> follows the cache side of a directory protocol. This page covers the other half: the directory controller at the home, which has its own stable and transient states and its own table of events and actions. It follows the baseline MSI directory protocol in Chapter 8 of Sorin, Hill, and Wood's primer, which is more complete than Hennessy &amp; Patterson's version (see <a href="#/directory/machines">The Two State Machines</a>) because it includes acknowledgments, explicit evictions, and races.</p>

<h3 id="sec-events">What the Directory Sees</h3>
<p>The protocol uses three virtual networks: requests from caches to the directory, forwarded requests from the directory to caches, and responses (see <a href="#/icx-noc/protocol-deadlock">Protocol Deadlock and Virtual Networks</a>). The directory receives:</p>
<ul>
<li><strong>GetS and GetM:</strong> read and write requests.</li>
<li><strong>PutS:</strong> a sharer is evicting its copy. The directory distinguishes <strong>PutS-NotLast</strong> from <strong>PutS-Last</strong>, depending on whether the requester is the last sharer.</li>
<li><strong>PutM:</strong> an owner is evicting a dirty block, with the data. It is either <strong>from the owner</strong> or <strong>from a non-owner</strong>, which happens when ownership moved while the PutM was in flight.</li>
<li><strong>Data:</strong> a copy of the block from an owner that was asked to share it.</li>
</ul>
<p>It sends data and Put-Acks to requesters, and forwarded requests (Fwd-GetS, Fwd-GetM, Inv) to caches. In this protocol, Put-Acks travel on the forwarded-request network, so they stay ordered with the directory's other messages to the same cache.</p>

<h3 id="sec-table">The Directory's Protocol Table</h3>
<p>Each cell is an action, then the next state if it changes. "Req" is the requester.</p>
<div class="tbl"><table>
<tr><th>State</th><th>GetS</th><th>GetM</th><th>PutS-NotLast</th><th>PutS-Last</th><th>PutM from owner</th><th>PutM from non-owner</th><th>Data</th></tr>
<tr><td>I</td><td><ul><li>Send data to Req</li><li>Add Req to sharers</li><li>→ S</li></ul></td><td><ul><li>Send data to Req</li><li>Owner = Req</li><li>→ M</li></ul></td><td>Send Put-Ack</td><td>Send Put-Ack</td><td>Can't happen</td><td>Send Put-Ack</td><td>Can't happen</td></tr>
<tr><td>S</td><td><ul><li>Send data to Req</li><li>Add Req to sharers</li></ul></td><td><ul><li>Send data to Req with the ack count</li><li>Send Inv to sharers</li><li>Clear sharers</li><li>Owner = Req</li><li>→ M</li></ul></td><td><ul><li>Remove Req from sharers</li><li>Send Put-Ack</li></ul></td><td><ul><li>Remove Req from sharers</li><li>Send Put-Ack</li><li>→ I</li></ul></td><td>Can't happen</td><td><ul><li>Remove Req from sharers</li><li>Send Put-Ack</li></ul></td><td>Can't happen</td></tr>
<tr><td>M</td><td><ul><li>Send Fwd-GetS to owner</li><li>Add Req and owner to sharers</li><li>Clear owner</li><li>→ S<sup>D</sup></li></ul></td><td><ul><li>Send Fwd-GetM to owner</li><li>Owner = Req</li></ul></td><td>Send Put-Ack</td><td>Send Put-Ack</td><td><ul><li>Copy data to memory</li><li>Clear owner</li><li>Send Put-Ack</li><li>→ I</li></ul></td><td>Send Put-Ack</td><td>Can't happen</td></tr>
<tr><td>S<sup>D</sup></td><td>Stall</td><td>Stall</td><td><ul><li>Remove Req from sharers</li><li>Send Put-Ack</li></ul></td><td><ul><li>Remove Req from sharers</li><li>Send Put-Ack</li></ul></td><td>Can't happen</td><td><ul><li>Remove Req from sharers</li><li>Send Put-Ack</li></ul></td><td><ul><li>Copy data to memory</li><li>→ S</li></ul></td></tr>
</table></div>
<p>Two details carry most of the protocol's correctness:</p>
<ul>
<li><strong>The ack count:</strong> on a GetM in S, the data tells the requester how many Inv-Acks to wait for (the sharers, minus the requester if it is one). The sharers ack the requester directly, so the directory moves to M at once and never collects acks itself.</li>
<li><strong>Ownership moves at once:</strong> on a GetM in M, the directory records the new owner as soon as it sends the Fwd-GetM. The old owner hands the data straight to the new one.</li>
</ul>

<h3 id="sec-sd">Why the Directory Waits for Data</h3>
<p>On a GetS in M, the owner must give up exclusive ownership and memory must get a fresh copy, because S means memory is up to date. The directory sends Fwd-GetS, and the owner sends data both to the requester and to the directory. Until that data reaches the directory, memory is stale. If another GetS arrived in that window and the directory answered from memory, it would send stale data. So the directory waits in S<sup>D</sup> ("going to S, waiting for data") and stalls GetS and GetM until the data arrives. Puts don't need memory's data, so they're handled even in S<sup>D</sup>.</p>
<p>That's the directory's only transient state in this protocol. It stays small because the requester collects its own acks, and because forwarded requests make the owner, not the directory, responsible for supplying data.</p>

<h3 id="sec-puts">Explicit Evictions: PutS and PutM</h3>
<p>Hennessy &amp; Patterson's protocol evicts shared blocks silently. Sorin, Hill, and Wood's baseline sends a PutS and waits for a Put-Ack instead:</p>
<ul>
<li><strong>Silent PutS:</strong> no traffic on eviction, but the sharer list goes stale. A later write sends invalidations to caches that no longer hold the block, and a sparse directory can't free entries for blocks no one caches.</li>
<li><strong>Explicit PutS:</strong> two messages per clean eviction, but the sharer list is exact, so later invalidations go only to real sharers, and a sparse directory frees the entry when the last sharer leaves (PutS-Last).</li>
<li><strong>PutM from a non-owner:</strong> the cache sent PutM, but before it arrived the directory handled another core's GetM and forwarded it to this cache, which sent the data to the new owner. The PutM is now stale: the directory acks it and changes nothing, and the evicting cache, in II<sup>A</sup>, goes to I.</li>
</ul>

<h3 id="sec-stalls">Stalling vs. Non-Stalling Directories</h3>
<p>Stalling in S<sup>D</sup> is simple, but a stalled request at the head of the directory's request queue blocks every request behind it, including ones for other blocks. Ways around it:</p>
<ul>
<li><strong>Per-block queues or a side buffer:</strong> move the stalled request aside so others proceed. Costs buffer space and bookkeeping.</li>
<li><strong>NAK and retry:</strong> reject the request and let the requester retry later. No buffering, but retries waste bandwidth and can starve a requester.</li>
<li><strong>Non-stalling states:</strong> Sorin, Hill, and Wood also show a directory that processes the second request immediately and adds more transient states to track both. More states, less blocking.</li>
</ul>
<p>The primer also shows how to drop the assumption that the forwarded-request network keeps messages in order between each pair of nodes, which adaptive routing would break. The cost, again, is more transient states at the caches.</p>

<h3 id="sec-states">Adding E and O</h3>
<ul>
<li><strong>E (MESI):</strong> a GetS to a block in I can grant E. The directory must record an owner, as for M, because the E holder can write silently, and the directory can't tell E from M. A later request is forwarded to the holder, which answers with data whether it is clean or dirty. Evicting an E block needs a PutE (without data) so the directory knows the owner is gone.</li>
<li><strong>O (MOSI or MOESI):</strong> a GetS to a block in M forwards to the owner, which keeps the block in O and keeps supplying data. Memory isn't updated, so S<sup>D</sup> isn't needed for that transition. The directory now tracks an owner and sharers at the same time, and a GetM must collect acks from the sharers and data from the owner.</li>
</ul>

<h3 id="sec-model">What to Model</h3>
<ul>
<li>The directory's busy states, such as S<sup>D</sup>, and what happens to requests that arrive during them: stall in queue order, side buffer, or NAK.</li>
<li>Head-of-line blocking at the directory's request queue, which a per-line model misses.</li>
<li>PutS traffic, or the stale sharers and extra invalidations without it.</li>
<li>Whether the requester or the directory collects invalidation acks. It changes which node is on the critical path.</li>
</ul>
<p class="refs">References: Sorin, Hill, and Wood, <em>A Primer on Memory Consistency and Cache Coherence</em>, 2nd ed. (2020), Chapter 8 · Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, 6th ed., Section 5.4 and Appendix I</p>`,
  practice: {
    guided: [
      {
        q: `<p>Using the table on this page, the directory holds block B in M with owner C1. C2 sends GetS, and immediately afterward C3 sends GetM, which reaches the directory while it's in S<sup>D</sup>. Trace the directory's states and every message until both requests complete, and count the messages.</p>`,
        a: `<ol><li>C2's GetS arrives in M: the directory sends Fwd-GetS to C1, records sharers {C1, C2}, clears the owner, and goes to S<sup>D</sup>.</li><li>C3's GetM arrives in S<sup>D</sup>: <strong>stall</strong>. It waits at the head of the request queue.</li><li>C1, in M, receives Fwd-GetS: it sends data to C2 and to the directory, and goes to S.</li><li>C2, in IS<sup>D</sup>, receives the data and goes to S. Its load completes.</li><li>The directory receives the data: it copies it to memory and goes to S.</li><li>Now it handles C3's GetM in S: it sends data to C3 with an ack count of 2 (sharers C1 and C2), sends Inv to C1 and C2, clears the sharers, records owner C3, and goes to M.</li><li>C1 and C2 receive Inv, go to I, and each send an Inv-Ack to C3.</li><li>C3, in IM<sup>AD</sup>, receives the data (2 acks expected) and then both acks, and goes to M.</li><li>Messages: GetS (1) + Fwd-GetS (1) + data to C2 and to the directory (2) + GetM (1) + data to C3 (1) + Inv (2) + Inv-Ack (2) = <strong>10 messages</strong>.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A 32-core chip with a sparse directory is choosing between silent and explicit (PutS) evictions of clean shared blocks. Each core evicts 4 million S blocks per second. Writes that hit a shared block occur 1.5 million times per second chip-wide, and with silent evictions, each such write finds 2 stale sharers on average in addition to the real ones. Compare the message traffic of the two policies, and say what else should decide the choice.</p><p class="given">Assume an explicit PutS costs 2 messages (PutS and Put-Ack), each invalidation of a stale sharer costs 2 messages (Inv and Inv-Ack), and with explicit PutS there are no stale sharers.</p>`,
        a: `<ol><li>Explicit: 32 cores × 4 × 10<sup>6</sup> evictions/s × 2 messages = <strong>256 million messages/s</strong>.</li><li>Silent: 1.5 × 10<sup>6</sup> writes/s × 2 stale sharers × 2 messages = <strong>6 million messages/s</strong>.</li><li>On traffic alone, silent eviction wins by about 256 / 6 ≈ 43×.</li></ol><p>But traffic isn't the only cost:</p><ul><li><strong>Directory capacity:</strong> with silent evictions, a sparse directory keeps entries for blocks that no cache holds any more. They take space from live blocks, and evicting them sends useless invalidations. If the directory is tight, those evictions back-invalidate live lines, which costs misses.</li><li><strong>Write latency:</strong> a write waits for the slowest ack, and stale sharers add acks from caches that may be far away.</li><li><strong>Middle ground:</strong> some designs send a notification only when the evicted block is the last copy in a cluster, or only from caches that are inclusive of their cores, to keep the directory accurate at a fraction of the traffic.</li></ul><p>Measure directory occupancy and the rate of back-invalidations in a model with each policy before deciding. The traffic numbers favor silent eviction, but an undersized directory can reverse that.</p>`
      }
    ]
  }
},


{
  id: "consistency",
  region: "coh",
  title: "Memory Consistency Models in Hardware",
  sections: [
    { id: "sc", label: "Sequential Consistency" },
    { id: "litmus", label: "Litmus Tests" },
    { id: "tso", label: "TSO and the Store Buffer" },
    { id: "weak", label: "Weak Models: Arm and RISC-V" },
    { id: "impl", label: "Speculating Past the Model" },
    { id: "cost", label: "What Fences Cost" }
  ],
  body: `
<p>Coherence says every core agrees on the order of writes to <em>one</em> address. The consistency model says what orders a program can observe across <em>different</em> addresses. It is part of the ISA, and it decides which hardware optimizations are visible to software. The C11 view of the same problem is on <a href="#/c11-ordering">C11 Memory Ordering</a>; this page covers what the hardware guarantees and how it keeps those guarantees while executing out of order.</p>

<h3 id="sec-sc">Sequential Consistency</h3>
<p>Lamport's <strong>sequential consistency (SC)</strong>: the result is as if all cores' memory operations ran in some single interleaving that respects each core's program order. It is the model programmers assume by default. No major ISA requires it, because enforcing it naively forbids the most valuable optimization a core has: letting a load complete while an older store waits in the store buffer.</p>

<h3 id="sec-litmus">Litmus Tests</h3>
<p>Models are compared with small two- or four-thread programs and the outcomes they allow. All locations start at 0:</p>
<div class="tbl"><table>
<tr><th>Test</th><th>Threads</th><th>Outcome in question</th><th>SC</th><th>x86 (TSO)</th><th>Arm, RISC-V</th></tr>
<tr><td>Store buffering (SB)</td><td>T0: x = 1; r0 = y<br>T1: y = 1; r1 = x</td><td>r0 = 0 and r1 = 0</td><td>Forbidden</td><td><strong>Allowed</strong></td><td>Allowed</td></tr>
<tr><td>Message passing (MP)</td><td>T0: x = 1; y = 1<br>T1: r0 = y; r1 = x</td><td>r0 = 1 and r1 = 0</td><td>Forbidden</td><td>Forbidden</td><td><strong>Allowed</strong> without barriers</td></tr>
<tr><td>Load buffering (LB)</td><td>T0: r0 = x; y = 1<br>T1: r1 = y; x = 1</td><td>r0 = 1 and r1 = 1</td><td>Forbidden</td><td>Forbidden</td><td>Allowed by the model (rare in practice)</td></tr>
<tr><td>IRIW</td><td>T0: x = 1. T1: y = 1.<br>T2: r0 = x; r1 = y. T3: r2 = y; r3 = x</td><td>T2 sees x before y, T3 sees y before x</td><td>Forbidden</td><td>Forbidden</td><td>Forbidden with ordered loads (Arm and RISC-V are multi-copy atomic); allowed on POWER</td></tr>
</table></div>

<h3 id="sec-tso">TSO and the Store Buffer</h3>
<p><strong>Total store order</strong> (x86, SPARC) is exactly SC plus a FIFO store buffer per core: a store retires into the buffer and becomes visible to other cores later, in program order, while the core's own later loads may complete first (forwarding from the buffer if they match). That one relaxation is what allows the SB outcome. To forbid it, the program needs a fence (<code>mfence</code>) or a locked instruction between the store and the load; both wait for the store buffer to drain.</p>

<h3 id="sec-weak">Weak Models: Arm and RISC-V</h3>
<p>Arm (Armv8 onward) and RISC-V (RVWMO) allow almost any reordering of independent memory operations, then give software tools to restore order where it matters:</p>
<ul>
<li><strong>Barriers:</strong> <code>dmb</code> on Arm, <code>fence</code> on RISC-V, with variants that order only loads, only stores, or both.</li>
<li><strong>Acquire and release accesses:</strong> Arm's <code>ldar</code> and <code>stlr</code>, RISC-V's <code>.aq</code> and <code>.rl</code> annotations on atomics. They order only what they need to, which is cheaper than a full barrier.</li>
<li><strong>Dependencies:</strong> a load whose address depends on an earlier load's value is ordered after it, at no cost.</li>
</ul>
<p>Both models are <strong>multi-copy atomic</strong>: a store becomes visible to all other cores at the same time. That forbids IRIW once each reader's loads are ordered, and it greatly simplifies reasoning. IBM POWER is not multi-copy atomic, and is harder to program for that reason.</p>

<h3 id="sec-impl">Speculating Past the Model</h3>
<p>An out-of-order x86 core executes loads early and out of order, which looks like it would break TSO's load-to-load ordering. It doesn't, because the core checks after the fact (Gharachorloo, Gupta, and Hennessy, 1991):</p>
<ol>
<li>A load executes speculatively as soon as its address is ready, possibly before older loads.</li>
<li>The load queue keeps its address until it retires.</li>
<li>If the line is invalidated (another core wrote it) or evicted before the load retires, the core can't prove that no one saw the reordering, so it squashes the load and everything after it and re-executes (a memory-ordering machine clear).</li>
</ol>
<p>The same technique can make SC nearly as fast as TSO or weaker models (Gniady, Falsafi, and Vijaykumar, 1999): what costs performance is not ordering itself, but waiting for it instead of speculating and checking.</p>

<h3 id="sec-cost">What Fences Cost</h3>
<ul>
<li>A full fence waits for the store buffer to drain. If the buffer holds stores that miss in the cache, that can take hundreds of cycles.</li>
<li>Even with a near-empty buffer, a full fence costs tens of cycles on recent x86 cores, which is why locks use locked read-modify-write instructions and why lock-free code prefers acquire/release orderings.</li>
<li>Machine clears from memory-ordering violations show up in counters (Intel's <code>MACHINE_CLEARS.MEMORY_ORDERING</code>) and are a sign of true sharing on hot lines.</li>
</ul>
<p class="refs">References: Sorin, Hill, and Wood, <em>A Primer on Memory Consistency and Cache Coherence</em>, 2nd ed. (2020), Chapters 3 to 5 · Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em>, Chapter 5 (models of memory consistency) · Lamport, "How to Make a Multiprocessor Computer That Correctly Executes Multiprocess Programs," IEEE Trans. Computers, 1979 · Gharachorloo, Gupta, and Hennessy, "Two Techniques to Enhance the Performance of Memory Consistency Models," ICPP 1991 · Gniady, Falsafi, and Vijaykumar, "Is SC + ILP = RC?," ISCA 1999 · Alglave, Maranget, and Tautschnig, "Herding Cats," TOPLAS 2014</p>`,
  practice: {
    guided: [
      {
        q: `<p>In the store-buffering test (T0: x = 1; r0 = y. T1: y = 1; r1 = x), list every outcome (r0, r1) that SC allows, then show how a store buffer produces the one SC forbids.</p>`,
        a: `<ol><li>Under SC, some store goes first in the single interleaving. If x = 1 is first, T1's later load of x returns 1, so r1 = 1; symmetrically, if y = 1 is first, r0 = 1.</li><li>SC allows <strong>(0, 1), (1, 0), and (1, 1)</strong>, but not (0, 0).</li><li>With store buffers: T0 puts x = 1 in its buffer and loads y from the cache (still 0); T1 puts y = 1 in its buffer and loads x (still 0). Both buffers drain afterward.</li><li>Result: <strong>(0, 0)</strong>, allowed by TSO. An <code>mfence</code> after each store forces the buffer to drain before the load, restoring SC for this test.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Profiling shows a high rate of memory-ordering machine clears on an x86 server running a work-stealing scheduler. What's happening, and how would you reduce it?</p>`,
        a: `<p>Loads in a core's window executed early, then another core wrote one of those lines before they retired. To preserve TSO, the core squashed and re-executed them. In a work-stealing scheduler, the likely lines are the deque's top and bottom indices and nearby task slots: thieves and the owner read and write them constantly. Each clear throws away the whole window, so the cost scales with ROB size. Reductions:</p><ul><li>Separate frequently written fields onto their own cache lines (the owner's bottom index away from the thieves' top index)</li><li>Have thieves back off after a failed steal instead of spinning on the shared index</li><li>Spin with <code>pause</code>, which also limits how many speculative loads are in flight</li><li>Avoid polling shared lines with plain loads in tight loops</li></ul><p>Confirm by attributing the clears to PCs (precise sampling) and checking that they fall on the deque's code.</p>`
      }
    ]
  }
}
]);
