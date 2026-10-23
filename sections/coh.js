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
}
]);
