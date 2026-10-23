/* Section: Coherence
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "coh"). */

section({
  id: "coh",
  name: "Coherence",
  cap: "Keeping copies of a line consistent",
  body: `
<p>With private caches, several copies of a line can exist. Coherence protocols keep them consistent so software sees one value per location.</p>
<h3>Snooping vs. Directory</h3>
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
  body: `
<p>Coherence keeps every copy of a single location consistent: single writer or multiple readers, and reads return the last write.</p>
<h3>MESI States</h3>
<ul><li><strong>Modified:</strong> only copy, dirty.</li><li><strong>Exclusive:</strong> only copy, clean; can become M silently.</li><li><strong>Shared:</strong> possibly other copies, read only.</li><li><strong>Invalid.</strong></li></ul>
<h3>Snooping</h3>
<p>A read miss broadcasts a read; an owner in M supplies data and drops to S. A write broadcasts ownership requests that invalidate other copies. MOESI adds Owned, letting dirty lines be shared without writeback.</p>
<h3>Coherence vs. Consistency</h3>
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
        q: `<p>Two threads each increment their own counter one million times, but the counters share a cache line. Describe the coherence traffic and its cost.</p>`,
        a: `<p>Each write needs the line in M. When the threads interleave, every increment can require an ownership request that invalidates the other core's copy, so the line ping-pongs. Each transfer costs tens to over a hundred cycles, against about one cycle for a local increment, so this can be 10–100× slower. Padding each counter to its own line fixes it.</p>`
      },
      {
        q: `<p>Why does the E state exist?</p>`,
        a: `<p>Private data is often read and then written. Without E, the read leaves the line in S and the write needs an upgrade message. With E, the core knows it has the only copy and can move to M silently.</p>`
      }
    ]
  }
},

{
  id: "directory",
  region: "coh",
  title: "Directory-Based Coherence",
  body: `
<p>A directory at each line's home node tracks state and sharers so requests go point to point.</p>
<h3>Flows</h3>
<p><strong>Read miss:</strong> the home forwards to an owner in M, which sends data and downgrades. <strong>Write miss:</strong> the home invalidates sharers and tells the requester how many acks to expect.</p>
<h3>Sharer Tracking</h3>
<p>Full bit vectors cost a bit per core per line; limited pointers and coarse vectors trade precision for space; sparse directories evict entries and force invalidations.</p>
<h3>The Hard Part</h3>
<p>Transient states: messages race, so real protocols need many intermediate states.</p>`,
  practice: {
    guided: [
      {
        q: `<p>16 cores with a full bit-vector directory. Core 0 has a write miss to a line shared by cores 2, 5, and 9. Trace the messages.</p>`,
        a: `<ol><li>Core 0 → home: GetM (1 message).</li><li>Home → cores 2, 5, 9: Invalidate (3).</li><li>Home → core 0: data plus "expect 3 acks" (1).</li><li>Cores 2, 5, 9 → core 0: InvAck (3).</li><li>Core 0 completes after all 3 acks: <strong>8 messages</strong>. The home updates its entry to owner = core 0, state M.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>64 cores, a 32 MB LLC with 64-byte lines, and a full bit-vector directory entry per line. What's the storage overhead, and how would you reduce it?</p>`,
        a: `<p>Lines: 32 MB / 64 B = 512K. Each needs 64 sharer bits: 512K × 64 bits = 4 MB, or <strong>12.5%</strong> of the data array (plus state bits). Reduce it with limited-pointer entries (track a few sharers, broadcast on overflow), coarse vectors (one bit per core cluster), or a sparse directory that tracks only lines actually cached in private caches.</p>`
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
<p>CHI also adds partial states for lines with only some bytes valid. See <a href="#/icx-coherent">Coherent Interconnects</a> for how CHI transactions flow.</p>

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
        a: `<ol start="0"><li>C0 writes: C0 = M. Memory writes: 0.</li><li>C1 reads: C0 supplies the data and goes M → <strong>O</strong>; C1 = S. No writeback.</li><li>C2 reads: C0 (the owner) supplies again; C0 = O, C1 = S, C2 = S.</li><li>C0 writes: it invalidates C1 and C2 and goes O → M. Still no memory writes: <strong>0</strong> so far (the line is written back only when C0 eventually evicts it).</li><li>MESI: at step 1, C0 goes M → S and the dirty line is written back: <strong>1 memory write</strong>, and it would repeat every time the line is written and then shared again.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A 60-core server chip has a 2 MB private L2 per core and a non-inclusive L3 with a snoop filter. How many lines must the filter be able to track, and what happens if it is built at half that size?</p>`,
        a: `<p>Private capacity: 60 × 2 MB = 120 MB. In 64-byte lines: 120 MB / 64 B ≈ 1.97 million lines, and in practice more, because set-associativity conflicts mean the filter can't be 100% full. If it is built at half that size, then whenever cores' working sets fill their L2s, the filter must evict entries, and each eviction back-invalidates a line in some L2 that may be in active use. Those lines then miss in L2, refill from L3 or memory, and re-enter the filter, evicting something else. In a model, it shows up as L2 misses that a private-cache simulation can't explain; on silicon, as L2 miss rates that rise with core count even for per-core-private data. That's why filters are sized to cover all private capacity with associativity to spare.</p>`
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
<ol start="0">
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
        a: `<ol start="0"><li>Both issue GetM: C0 and C1 move S → SM<sup>AD</sup>.</li><li>The directory handles C1's GetM: it sends C1 data with "expect 1 ack" and sends Inv to C0. Directory: M, owner C1.</li><li>C0, in SM<sup>AD</sup>, receives the Inv: it lost the race. It sends Inv-Ack to C1 and moves to <strong>IM<sup>AD</sup></strong>.</li><li>C1 receives data (1 ack expected) → SM<sup>A</sup>, then C0's Inv-Ack → <strong>M</strong>; its store completes.</li><li>The directory handles C0's GetM: the line is owned by C1, so it forwards Fwd-GetM to C1 and records owner C0.</li><li>C1 sends the data to C0 and goes M → I. (Had the Fwd-GetM arrived while C1 was still in SM<sup>A</sup>, C1 would stall it until its own store finished.)</li><li>C0 receives the data with 0 acks expected → <strong>M</strong>; its store completes. Final: C0 = M, C1 = I.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Should a cycle-level performance model implement every transient state of the coherence protocol? Argue both sides and say what you'd do.</p>`,
        a: `<p>Against: transient states mostly matter for correctness, which the RTL and protocol verification cover; implementing them makes the model slower and introduces its own protocol bugs, and most workloads rarely race on the same line.</p><p>For: performance under contention depends on them. Lock handoffs, contended atomics, and producer-consumer queues are races by design, and their latency includes stalled forwarded requests, retried requests, and extra hops that an "atomic transaction" model never charges. Those patterns dominate scaling of many multithreaded programs.</p><p>A practical middle: model transactions as message sequences with real latencies and a per-line busy state at the directory and the cache (so a second request for a busy line waits), which captures most contention cost without the full state table. Then validate with microbenchmarks that hammer one line from many cores against RTL or silicon, and add detail only where they disagree.</p>`
      }
    ]
  }
}
]);
