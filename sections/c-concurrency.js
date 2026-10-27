/* Section: Concurrency in C
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "conc"). */

section({
  id: "conc",
  name: "Concurrency in C",
  cap: "Atomics, barriers, and cache-line layout",
  body: `
<p>Multithreaded performance depends on how threads communicate: synchronization cost, how much data actually moves between cores, and how much work runs in parallel.</p>
<h3>Amdahl's Law</h3>
<p>Speedup = 1 / ((1 − p) + p / n), where p is the parallel fraction and n the thread count. The serial part dominates quickly.</p>`,
  practice: {
    guided: [
      {
        q: `<p>A program is 90% parallel. What's the speedup on 8 cores, and what's the ceiling with infinite cores?</p>`,
        a: `<ol start="0"><li>8 cores: 1 / (0.1 + 0.9 / 8) = 1 / 0.2125 ≈ <strong>4.7×</strong>.</li><li>Infinite cores: 1 / 0.1 = <strong>10×</strong>.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Your multithreaded work scheduler scales well to 4 threads, then flattens. List hypotheses and how you'd test each.</p>`,
        a: `<ul><li><strong>Serialization in critical sections:</strong> measure time spent waiting for locks per thread.</li><li><strong>Barrier cost:</strong> time from the first arrival to the last; centralized barriers get slower with thread count.</li><li><strong>False or true sharing:</strong> <code>perf c2c</code> for heavily contended lines.</li><li><strong>Load imbalance:</strong> per-thread busy time per cycle of work.</li><li><strong>Memory bandwidth:</strong> bandwidth counters near the platform peak.</li><li><strong>Topology:</strong> threads 5+ landing on SMT siblings or another cluster with a slower interconnect.</li></ul>`
      }
    ]
  }
}, [
{
  id: "c11-ordering",
  region: "conc",
  title: "C11 Memory Ordering",
  body: `
<p>Each atomic access takes an ordering that says what can move around it.</p>
<ul><li><code>relaxed</code>: atomic, no ordering.</li><li><code>acquire</code> (loads): later accesses can't move before it.</li><li><code>release</code> (stores): earlier accesses can't move after it.</li><li><code>acq_rel</code> (read-modify-write): both.</li><li><code>seq_cst</code>: plus one total order over all seq_cst operations.</li></ul>
<h3>Synchronizes-with</h3>
<p>When an acquire load reads from a release store, everything before the store happens-before everything after the load.</p>
<pre><code>// producer
data = 42;
atomic_store_explicit(&amp;ready, 1, memory_order_release);

// consumer
while (!atomic_load_explicit(&amp;ready, memory_order_acquire)) ;
assert(data == 42);  // guaranteed</code></pre>
<h3>Program Order vs. Visibility</h3>
<p>On ARM and POWER, a core's stores can reach other cores out of order. x86 (TSO) only lets a load pass an earlier store to a different address.</p>`,
  practice: {
    guided: [
      {
        q: `<p>The producer writes <code>data = 42</code> and then sets <code>ready = 1</code> with relaxed ordering. The consumer spins until <code>ready</code> is 1 (relaxed), then reads <code>data</code>. What can go wrong, and how do you fix it?</p>`,
        a: `<ol start="0"><li>Relaxed gives atomicity but no ordering. The data store may become visible after the ready store, or the consumer's data read may be satisfied early.</li><li>The consumer can see ready = 1 and data = 0.</li><li>Fix: make the ready store <code>release</code> and the spin load <code>acquire</code>. The acquire that reads the release value synchronizes-with it, so data = 42 is guaranteed.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<pre><code>// x = y = 0
T1: x = 1; r1 = y;
T2: y = 1; r2 = x;</code></pre><p>Can r1 = r2 = 0 with release stores and acquire loads? With seq_cst? What happens on x86?</p>`,
        a: `<p>With acquire/release: <strong>yes</strong>. Release doesn't stop a later load from moving ahead of an earlier store. With seq_cst: <strong>no</strong>; a single total order means one store is first, so at least one load sees 1.</p><p>On x86 with plain movs, the store buffer allows the outcome. Compilers implement seq_cst stores as <code>xchg</code> or <code>mov</code> plus <code>mfence</code> to drain the buffer.</p>`
      },
      {
        q: `<p>Is a relaxed <code>fetch_add</code> fine for a statistics counter that the main thread reads after joining the workers?</p>`,
        a: `<p>Yes. The increments only need atomicity; thread join establishes happens-before, so the final read sees every increment.</p>`
      }
    ]
  }
},

{
  id: "barrier",
  region: "conc",
  title: "Sense-Reversing Barriers",
  body: `
<p>A centralized barrier with a counter and a shared sense flag:</p><ul><li>Each thread flips a private sense every episode</li><li>The last arriver resets the counter and flips the shared sense</li><li>Others spin until it matches theirs</li></ul>
<h3>Why the Sense Flips</h3>
<p>It makes the barrier reusable without reinitialization: a fast thread racing into the next episode waits on the opposite value.</p>
<pre><code>typedef struct { atomic_int count; atomic_int sense; int n; } barrier_t;

void barrier_wait(barrier_t *b, int *local_sense) {
  int s = !*local_sense;
  *local_sense = s;
  if (atomic_fetch_sub_explicit(&amp;b-&gt;count, 1,
        memory_order_acq_rel) == 1) {
    atomic_store_explicit(&amp;b-&gt;count, b-&gt;n, memory_order_relaxed);
    atomic_store_explicit(&amp;b-&gt;sense, s, memory_order_release);
  } else {
    while (atomic_load_explicit(&amp;b-&gt;sense,
             memory_order_acquire) != s) ;
  }
}</code></pre>
<h3>Ordering, Piece by Piece</h3>
<ul><li>The fetch_sub is <code>acq_rel</code>: release publishes this thread's writes; acquire lets the last arriver see everyone's.</li><li>The sense store is <code>release</code> and spinners <code>acquire</code> it, so everyone leaves having seen all pre-barrier writes.</li><li>The counter reset can be <code>relaxed</code>: it precedes the release store, and threads only touch the counter again after acquiring the new sense.</li></ul>`,
  practice: {
    guided: [
      {
        q: `<p>Trace two episodes of the <code>barrier_wait</code> code on this page with n = 2, count = 2, sense = 0, and both local senses 0. T0 arrives first each time.</p>`,
        a: `<ol start="0"><li>Episode 0: both flip their local sense to 1. T0's fetch_sub returns 2, so it spins until sense == 1.</li><li>T1's fetch_sub returns 1, so it is last: it resets count to 2 and stores sense = 1. T0 sees 1 and leaves.</li><li>Episode 1: both flip local sense to 0. T0 decrements (returns 2) and spins until sense == 0.</li><li>T1 is last: count = 2, sense = 0. Both leave. No reinitialization was needed.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A naive barrier:</p><ul><li>The last thread sets <code>flag = 1</code></li><li>Waiters spin on <code>flag == 1</code></li><li>On entry, each thread sets <code>flag = 0</code></li></ul><p>What breaks?</p>`,
        a: `<p>A fast thread leaves, re-enters the next barrier, and resets flag to 0 before a slow thread has observed flag = 1. The slow thread spins forever on the previous episode: deadlock. Sense reversal fixes it because consecutive episodes wait on opposite values, so the next episode can never overwrite the value the current one is waiting for.</p>`
      },
      {
        q: `<p>How does this barrier scale to 64 threads, and what would you use instead?</p>`,
        a: `<p>All threads do RMWs on one counter line, so arrivals serialize as the line bounces (O(n) transfers), and the release invalidates every spinner's copy at once. Alternatives: combining-tree barriers (each node is a small counter), dissemination or tournament barriers (log n rounds, threads spin on their own lines), and padding each spin flag to its own line.</p>`
      }
    ]
  }
},

{
  id: "false-sharing",
  region: "conc",
  title: "False Sharing and Cache-Line Isolation",
  body: `
<p>Coherence works on whole lines. Two threads writing different variables in one line make it bounce between caches.</p>
<h3>Fixing It</h3>
<pre><code>#define LINE 64
typedef struct {
  _Alignas(LINE) long counter;
  char pad[LINE - sizeof(long)];
} per_thread_t;

_Static_assert(sizeof(per_thread_t) % LINE == 0, "not line-sized");
_Static_assert(_Alignof(per_thread_t) == LINE, "not line-aligned");</code></pre>
<h3>Choosing the Size</h3>
<p>64 bytes is common, but some cores use 128-byte lines, and adjacent-line prefetching can pair 64-byte lines. Padding hot structures to 128 is a cheap hedge.</p>
<h3>Finding It</h3>
<p><code>perf c2c</code> reports lines with heavy cross-core modified-hit traffic.</p>`,
  practice: {
    guided: [
      {
        q: `<p>Eight threads each update their own 8-byte counter in <code>long counters[8]</code>. What's wrong, and how big is the fixed array with 64-byte lines?</p>`,
        a: `<ol start="0"><li>All 8 counters (64 bytes) fit in one line, so every update invalidates the other seven cores' copies.</li><li>Fix: give each counter its own line with a padded, 64-byte-aligned struct.</li><li>Size: 8 × 64 = <strong>512 bytes</strong> (1024 if you pad to 128).</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p><code>perf c2c</code> shows heavy modified-line hits on a line holding a lock and the data it protects. Is that false sharing?</p>`,
        a: `<p>Partly true sharing: whoever takes the lock needs both. But if read-mostly fields share the line with the lock word, every lock acquire invalidates readers who only wanted those fields. Separate frequently written fields (lock, counters) from read-mostly ones, and consider reducing contention itself (finer-grained locks, per-thread batching).</p>`
      }
    ]
  }
}
]);
