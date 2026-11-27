/* Section: Memory Dependence Prediction
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "mdep"). */

section({
  id: "mdep",
  name: "Memory Dependence Prediction",
  cap: "Which loads may pass older stores, from wait bits to store sets",
  sections: [
    { id: "pages", label: "Pages in This Region" }
  ],
  body: `
<p>An out-of-order core lets loads run ahead of older stores, and the load and store queues catch the cases where that broke memory order (see <a href="#/r/mord">Memory Ordering</a>). A memory dependence predictor decides which loads may run ahead of older stores whose addresses aren't known yet. Get it wrong one way and a load reads stale data, so the core flushes it and everything younger. Get it wrong the other way and a load waits for stores it has nothing to do with. This region follows Chrysos and Emer's store sets paper (ISCA 1998) section by section, one page per step of the argument. Window-size data comes from Moshovos, Breach, Vijaykumar, and Sohi (ISCA 1997), real hardware from the Alpha 21264 hardware reference manual, and background from Hennessy and Patterson (chapter 3). The cheaper recovery the paper chose not to use is on <a href="#/replay">Selective Replay</a>.</p>
<h3 id="sec-pages">Pages in This Region</h3>
<ul>
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
        q: `<p>A store and a load in a hot loop write and read the same address on every iteration, and the load's address is usually ready first. Follow a store set predictor from the first time the pair runs to the second.</p><div class="given"><p>Given:</p><ul><li>Both instructions start with invalid SSIT entries</li><li>The predictor clears its SSIT every 1,000,000 cycles, as in the paper</li></ul></div>`,
        a: `<ol class="steps"><li><strong>First run.</strong> The load's store set is empty, so it issues as soon as its address is ready and reads the cache.</li><li><strong>The violation.</strong> The store then issues, searches the load queue, and finds a younger load to the same bytes that already executed. That's a memory-order violation, so the load and every younger instruction are squashed and refetched.</li><li><strong>Training.</strong> The SSIT entries for the load's PC and the store's PC get the same store set ID.</li><li><strong>Second run, the store.</strong> The store is fetched first, reads its SSID, and records itself in the LFST as the last fetched store of that set.</li><li><strong>Second run, the load.</strong> The load is fetched, reads the same SSID, finds the store in the LFST, and takes a dependence on it. It issues only after the store issues and gets the value by store-to-load forwarding. One violation was the whole cost of learning the pair, until the next cyclic clear of the SSIT, every 1,000,000 cycles. After that, the pair costs one more violation to relearn, and aliasing in the untagged SSIT can also disturb it (see <a href="#/mdp-ssit/feedback">Clearing Stale Entries</a>).</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Explain memory dependence prediction to someone who knows branch prediction well. What carries over, and what is different?</p>`,
        a: `<p>What carries over:</p><ul><li>Both are tables indexed by PC that learn from history, and both bet that past behavior of a static instruction predicts its next instance.</li><li>Both recover from a bad bet by flushing the wrong-path or stale work and refetching.</li><li>Both suffer from aliasing in untagged tables and from capacity misses as code footprints grow.</li></ul><p>What is different:</p><ul><li><strong>The two errors cost very different amounts.</strong> A false dependence delays the load until the store issues. That delay can be tens to hundreds of cycles if the store's address or data waits on an L2 or DRAM miss, and it only costs run time when the load is on the critical path. A violation costs a flush. A branch predictor's two errors cost the same.</li><li><strong>It predicts a relation, not a bit.</strong> A good predictor names <em>which</em> store to wait for. A single "wait" bit makes the load wait for every older store.</li><li><strong>Training is one-sided.</strong> Violations are detected by the load queue search the core already needs for correctness. But nothing reports a needless wait unless extra comparators check the addresses. So tables only ever learn to wait, and need periodic clearing to forget.</li><li><strong>The penalty grows with the window,</strong> since a bigger window holds more older stores with unknown addresses and more younger work to squash.</li></ul>`
      }
    ]
  }
}, [
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
<li><strong>Memory dependences:</strong> a store writes a location and a later load reads it. These can't be found at decode, because the addresses don't exist yet. A store's address is known only after its address operands are ready and its address-generation µop has run, which can be many cycles after decode. The final address match also has to use physical addresses, for reasons on <a href="#/lsq-lq/physical-addresses">The Load Queue and Ordering Violations</a>.</li>
</ul>
<p>Only one kind of memory dependence needs any of this. For registers, renaming removes WAR and WAW hazards and leaves only RAW. For memory, the store queue plays that role (see <a href="#/lsq">The Store Queue</a>):</p>
<ul>
<li><strong>WAW:</strong> stores commit and drain to the cache in program order, so two stores to the same bytes can't land out of order.</li>
<li><strong>WAR:</strong> a store writes its SQ entry, not L1, until it commits, and a load searches only older stores. A younger store can't change the value an older load reads.</li>
<li><strong>RAW:</strong> a load reading bytes an older store writes is the only case left, and it is the one that needs disambiguation or prediction.</li>
</ul>
<p>So when a load's own address is ready, the scheduler often sees older stores with unknown addresses. It has two simple choices, and both are bad:</p>
<ul>
<li><strong>Make the load wait for every older store.</strong> This can never break memory order. But most loads don't read anything those stores write, so most of them end up <strong>falsely dependent</strong>: they wait for stores they have nothing to do with, and the wait lands on the critical path whenever later work needs the load's value. A better variant waits only for the older store-address µops, not the whole store. The Interview Level problem below shows how much that recovers and where it still loses.</li>
<li><strong>Let the load go.</strong> This is usually right. When an older store turns out to write bytes the load read, the load got a stale value. That's a <strong>memory-order violation</strong>, and the load plus every younger instruction must be squashed and re-executed (see <a href="#/flush-recovery">Pipeline Flush and Recovery</a>).</li>
</ul>
<p>Chrysos and Emer give a memory dependence predictor two goals:</p>
<ol>
<li>Predict which loads would cause a violation if they executed early.</li>
<li>Delay those loads only as long as needed to avoid the violation, and no longer.</li>
</ol>
<p>A wrong prediction fails one of these goals. Missing goal 1 causes a violation. Missing goal 2 causes a false dependence. Goal 2 can be missed even on a true dependence: if the load waits until the right store has fully executed, or until it commits, when all it needed was the store's data ready to forward, the extra cycles are over-delay too. Their predictor uses <strong>store sets</strong>: a load's store set is every store it has ever depended on. The core finds a load's store set by starting with naive speculation (every load goes early) and adding a store to the set each time that store catches the load in a violation. After that, the load waits only for in-flight stores in its set. The paper's question is whether this simple history-based rule can get close to perfect dependence knowledge in an 8-wide, 128-entry-queue core, and whether it can be built cheaply.</p>
<p class="refs">References: Chrysos and Emer, "Memory Dependence Prediction using Store Sets," ISCA 1998 · Hennessy and Patterson, Computer Architecture: A Quantitative Approach, chapter 3</p>`,
  practice: {
    guided: [
      {
        q: `<p>This loop scatters values into <code>a</code> and sums <code>b</code>:</p><pre><code>for (i = 0; i &lt; n; i++) {
  a[idx[i]] = v[i];
  s += b[i];
}</code></pre><p>In iteration 5, the load of <code>b[5]</code> has its address ready. The stores to <code>a[idx[3]]</code>, <code>a[idx[4]]</code>, and <code>a[idx[5]]</code> are all older than that load, and all three are still waiting for their <code>idx</code> loads, which missed in the cache. List the dependences decode can see and the ones it can't, then say what each simple policy does with <code>b[5]</code>, including the case where <code>&amp;a[idx[4]]</code> equals <code>&amp;b[5]</code>.</p>`,
        a: `<ol class="steps"><li><strong>Register dependences decode can see.</strong> <code>s += b[i]</code> reads the <code>s</code> written by the previous iteration, and each store's address register comes from that iteration's <code>idx[i]</code> load. Both are visible from register names.</li><li><strong>Memory dependences decode can't see.</strong> Whether <code>a[idx[3]]</code>, <code>a[idx[4]]</code>, or <code>a[idx[5]]</code> is the same location as <code>b[5]</code> depends on the run-time values of <code>idx</code>, and the compiler can't rule it out either unless it knows <code>a</code> and <code>b</code> don't overlap.</li><li><strong>Wait for every older store.</strong> <code>b[5]</code> waits until all three stores issue, which is after the <code>idx</code> misses return. In nearly every run the stores write elsewhere, so this is a false dependence, and the add chain on <code>s</code> stalls behind cache misses it never needed.</li><li><strong>Let it go.</strong> <code>b[5]</code> reads the cache right away. Usually that's correct. If <code>&amp;a[idx[4]]</code> equals <code>&amp;b[5]</code>, the store writes those bytes after the load read them, so the load holds a stale value. The store's load queue search finds this, and the load and every younger instruction are squashed and refetched.</li><li><strong>A predictor.</strong> It sits between the two: it lets <code>b[5]</code> run freely unless this load has collided with one of these three stores before.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Intel cores since the P6 split each store into a store-address µop and a store-data µop. Suppose a core lets a load issue once every older store's <em>address</em> is known, without waiting for store data. Does that remove the need for memory dependence prediction? Where does it still lose?</p>`,
        a: `<p>It removes one source of false dependences: a load no longer waits for a store whose address is known and different but whose data is late. Once all older addresses are known, the core can also tell exactly which store, if any, to forward from. A load whose address matches a store whose data is late is a different case. That is a true dependence, not a violation, and the load should wait for the data and take it by forwarding.</p><p>It doesn't remove the problem, because store addresses can be late too:</p><ul><li><strong>Address from a slow load:</strong> a store through a pointer, such as <code>p-&gt;next-&gt;val = x</code>, can't compute its address until a pointer load returns. An indirect store such as <code>a[idx[i]] = v[i]</code>, from the guided problem, waits on its <code>idx[i]</code> load the same way. Both are common in hash-table inserts, tree updates, and graph algorithms. Assume a DRAM miss takes roughly 100 ns, several hundred cycles at about 4 GHz. A modern window holds several hundred entries (Apple's big cores have a ROB that third parties estimate at around 600+ entries, not an Apple figure), and every younger load in it waits behind the one unresolved store address.</li><li><strong>Many stores in flight:</strong> in a large window, the chance that at least one older store has an unknown address is high, so most loads still wait for something.</li><li><strong>Critical-path cost:</strong> the waiting load is often the one feeding a long chain, so even short waits show up in IPC.</li></ul><p>So the policy is "no speculation" with a smaller penalty. A predictor still wins by letting the loads that never conflict run ahead of unknown store addresses, and by holding back only the few that do.</p>`
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
<p>The core detects violations with a table of the addresses of all loads that executed speculatively, which each store checks when it executes (the load queue search on <a href="#/lsq-lq/loads">The Load Queue and Ordering Violations</a>). It recovers by <strong>trapping</strong>: it squashes the offending load and every younger instruction, whether or not they depend on the load, and refetches starting at the load, beginning the cycle after detection. The workload is SPEC95, compiled with full optimization, run for 100 million instructions after skipping initialization and warming the caches.</p>

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
<p><strong>Turning counts into cycles.</strong> As with branch mispredictions, the cost of violations is a rate times a penalty:</p>
<div class="math chain"><span>\\(\\displaystyle \\text{CPI penalty} = \\frac{\\text{violations}}{\\text{instruction}} \\times \\frac{\\text{cycles}}{\\text{violation}} \\)</span></div>
<p>The product of the two naive-speculation columns shows why violations can't be ignored. wave5 loses about 24 violations per 1,000 instructions × 21 cycles per violation ≈ 504 cycles per 1,000 instructions of fetch time. At this machine's IPC of a few instructions per cycle, 1,000 instructions take only a few hundred cycles, so 504 cycles would be more than the program's whole run time. That shows the product can't simply be added to run time. Violations overlap with each other and with useful work, and not every cycle of a violation's fetch gap is lost, as the timeline below shows. What the product does show is that violations are far too frequent to ignore.</p>
<p>The cycles per violation come from this timeline:</p>
<ol>
<li>The load issues at cycle T and reads a stale value.</li>
<li>The conflicting store's address resolves at T + d. d can be hundreds of cycles if that address depends on a load that missed in L2 or went to DRAM.</li>
<li>The store's load queue search finds the violation, the core flushes the load and everything younger, and the front end refills.</li>
</ol>
<p>Measured against perfect prediction, a violation doesn't cost d plus the refill. With perfect prediction the load would have waited for the store, so it couldn't have finished before T + d either. The real loss is the refill plus redoing the independent younger work that ran during d and was squashed. Part of that work survives the flush, as with wrong-path execution after a branch mispredict: misses it already sent act as prefetches, and the branch predictor and I-cache stay warm.</p>
<p>No speculation has no such event to count. Each false dependence delays a load by however long the unrelated stores take, and that delay costs time only where it lies on the critical path. That's why the paper measures its cost as IPC(perfect) − IPC(no speculation) rather than from the false dependence counts in the table.</p>
<p><strong>Why not replay only the dependents?</strong> Tyson and Austin proposed re-executing just the violating load and the instructions that depend on it, instead of squashing everything younger. Replay is not refetch. A squash throws away the load and every younger instruction, and fetch restarts at the load's PC, so even instructions that never touched the load's value go back through fetch, decode, rename, and issue. A replay leaves every instruction in the window. The load's correct value is broadcast again, and only the instructions that consumed the wrong one issue again, straight from the issue queue, with no trip through the front end. That would cut the trap penalty, but the tracking is harder than it looks. Dependences also run through memory, since a dependent store may already have forwarded the stale value to a younger load, and a dependent branch that resolved with the stale value may have redirected fetch, which needs a flush anyway. Replay also has a cost the paper cares about: an instruction that might be replayed has to stay in the issue queue until it retires. The 21264 instead frees issue queue entries as soon as instructions issue, so newer instructions can compete for issue slots sooner. A smaller queue then finds as much ILP as a larger one would, which helps cycle time. Chrysos and Emer choose to keep early deallocation and make violations so rare that their penalty doesn't matter. The full replay mechanism and its costs are on <a href="#/replay">Selective Replay</a>.</p>

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
<li><strong>More static pairs appear too.</strong> In gcc, the number of distinct store-load pairs behind 99.9% of these dependences grows from 255 at a window of 8 instructions to 8,001 at 512 (their Table 4, explained below this list). A predictor indexed by PC therefore needs more entries for a larger window.</li>
<li><strong>But the pairs have temporal locality.</strong> A small cache of recent conflicting pairs captures most events. With a 512-instruction window, a 512-entry cache misses less than 4% of the time for every program (their Table 5). This is the premise store sets also rely on: a few static pairs, repeated many times.</li>
</ul>
<p><strong>Events and static pairs.</strong> An <em>event</em> is one dynamic store-to-load dependence that the window table counts: a load at run time reads a value written by an older store fewer than n instructions back. A <em>static pair</em> is one (store PC, load PC) combination in the program's code, such as:</p>
<pre><code>p-&gt;count = x;   // store at PC 0x4a10
...
y = p-&gt;count;   // load at PC 0x4a1c</code></pre>
<p>Every time this code runs with the two instructions close enough together, it produces another event, even though the predictor has already seen the pair. A loop that runs 1,000,000 times can produce 1,000,000 events from this single pair. The pair counts are measured over the whole gcc run, not inside one window, which holds only a store or two and a load at a time:</p>
<ol>
<li>Collect every event, every dynamic dependence with a store-to-load distance under n instructions.</li>
<li>Group the events by their (store PC, load PC) pair.</li>
<li>Sort the pairs from most to fewest events.</li>
<li>Take pairs from the top until they cover 99.9% of all events, and count them.</li>
</ol>
<p>That count goes from 255 pairs at a window of 8 instructions to 8,001 pairs at 512 instructions. gcc is large, and at a window of 8 instructions its close-range dependences come from 255 code locations, such as register spills and reloads or a struct field written and read back. At a window of 512 instructions, pairs farther apart also count, such as a store in a caller and a load in a callee, or a store in one loop iteration and a load several iterations later.</p>
<p>On a real out-of-order model (a Multiscalar processor with 4 or 8 processing units, which form 4 or 8 sequential tasks in flight), blind speculation's violations per committed load rise with the larger configuration in every program. For example, compress goes from 0.073 to 0.136 violations per committed load and sc goes from 0.021 to 0.039 (their Table 9). Their own predictor cuts compress to 0.00083 violations per committed load with 4 units and 0.00205 with 8 units.</p>
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
        q: `<p>A 6-wide core runs one workload under three memory dependence policies. What is each policy's CPI, and how much slower is each than perfect prediction?</p><p>Given:</p><ul><li>ROB: 352 entries</li><li>CPI with perfect memory dependence prediction: 0.40 cycles/instruction</li><li>Naive speculation: 2.6 violations/1,000 instructions, each costing 26 cycles from the load's first fetch to its refetch</li><li>No speculation: 140 false dependences/1,000 instructions<ul><li>30% of them are on the critical path</li><li>each of those delays it by 9 cycles on average</li></ul></li><li>Store sets:<ul><li>0.05 violations/1,000 instructions at 26 cycles each</li><li>4 false dependences/1,000 instructions, with the same 30% critical fraction and 9-cycle delay</li></ul></li><li>The penalties add to the perfect CPI with no overlap</li></ul>`,
        a: `<ol class="steps"><li><strong>Naive speculation.</strong> Its only penalty is violations, so add the violation rate times the cost of one violation to the perfect CPI.<div class="math chain"><span>\\(\\displaystyle \\Delta_{\\text{naive}} = \\frac{2.6\\ \\text{violations}}{1000\\ \\text{instructions}} \\times \\frac{26\\ \\text{cycles}}{1\\ \\text{violation}} \\)</span><span>\\(\\displaystyle = \\frac{67.6\\ \\text{cycles}}{1000\\ \\text{instructions}} \\)</span></div><div class="math chain"><span>\\(\\displaystyle \\text{CPI}_{\\text{naive}} = \\frac{0.40\\ \\text{cycles}}{1\\ \\text{instruction}} + \\frac{67.6\\ \\text{cycles}}{1000\\ \\text{instructions}} \\)</span><span>\\(\\displaystyle = \\frac{\\mathbf{0.4676}\\ \\textbf{cycles}}{\\mathbf{1}\\ \\textbf{instruction}} \\)</span></div>The instruction count and clock don't change, so the slowdown is the ratio of CPIs.<div class="math chain"><span>\\(\\displaystyle \\frac{\\text{CPI}_{\\text{naive}}}{\\text{CPI}_{\\text{perfect}}} = \\frac{0.4676\\ \\text{cycles}}{0.40\\ \\text{cycles}} \\)</span><span>\\(\\displaystyle = 1.169 \\)</span><span>\\(\\displaystyle \\Rightarrow \\mathbf{16.9\\%}\\ \\textbf{slower} \\)</span></div></li><li><strong>No speculation.</strong> Its only penalty is false dependences, and only the 30% on the critical path cost time.<div class="math chain"><span>\\(\\displaystyle \\Delta_{\\text{none}} = \\frac{140\\ \\text{false deps}}{1000\\ \\text{instructions}} \\times 0.30 \\times \\frac{9\\ \\text{cycles}}{1\\ \\text{false dep}} \\)</span><span>\\(\\displaystyle = \\frac{378\\ \\text{cycles}}{1000\\ \\text{instructions}} \\)</span></div><div class="math chain"><span>\\(\\displaystyle \\text{CPI}_{\\text{none}} = \\frac{0.40\\ \\text{cycles}}{1\\ \\text{instruction}} + \\frac{378\\ \\text{cycles}}{1000\\ \\text{instructions}} \\)</span><span>\\(\\displaystyle = \\frac{\\mathbf{0.778}\\ \\textbf{cycles}}{\\mathbf{1}\\ \\textbf{instruction}} \\)</span></div><div class="math chain"><span>\\(\\displaystyle \\frac{\\text{CPI}_{\\text{none}}}{\\text{CPI}_{\\text{perfect}}} = \\frac{0.778\\ \\text{cycles}}{0.40\\ \\text{cycles}} \\)</span><span>\\(\\displaystyle = 1.945 \\)</span><span>\\(\\displaystyle \\Rightarrow \\mathbf{94.5\\%}\\ \\textbf{slower} \\)</span></div></li><li><strong>Store sets.</strong> It pays a little of both, so add both penalty terms.<div class="math chain"><span>\\(\\displaystyle \\Delta_{\\text{viol}} = \\frac{0.05\\ \\text{violations}}{1000\\ \\text{instructions}} \\times \\frac{26\\ \\text{cycles}}{1\\ \\text{violation}} \\)</span><span>\\(\\displaystyle = \\frac{1.3\\ \\text{cycles}}{1000\\ \\text{instructions}} \\)</span></div><div class="math chain"><span>\\(\\displaystyle \\Delta_{\\text{false}} = \\frac{4\\ \\text{false deps}}{1000\\ \\text{instructions}} \\times 0.30 \\times \\frac{9\\ \\text{cycles}}{1\\ \\text{false dep}} \\)</span><span>\\(\\displaystyle = \\frac{10.8\\ \\text{cycles}}{1000\\ \\text{instructions}} \\)</span></div><div class="math chain"><span>\\(\\displaystyle \\text{CPI}_{\\text{sets}} = \\frac{0.40\\ \\text{cycles}}{1\\ \\text{instruction}} + \\frac{1.3\\ \\text{cycles} + 10.8\\ \\text{cycles}}{1000\\ \\text{instructions}} \\)</span><span>\\(\\displaystyle = \\frac{0.40\\ \\text{cycles}}{1\\ \\text{instruction}} + \\frac{12.1\\ \\text{cycles}}{1000\\ \\text{instructions}} \\)</span><span>\\(\\displaystyle = \\frac{\\mathbf{0.4121}\\ \\textbf{cycles}}{\\mathbf{1}\\ \\textbf{instruction}} \\)</span></div><div class="math chain"><span>\\(\\displaystyle \\frac{\\text{CPI}_{\\text{sets}}}{\\text{CPI}_{\\text{perfect}}} = \\frac{0.4121\\ \\text{cycles}}{0.40\\ \\text{cycles}} \\)</span><span>\\(\\displaystyle = 1.03025 \\)</span><span>\\(\\displaystyle \\Rightarrow \\mathbf{3.0\\%}\\ \\textbf{slower} \\)</span></div></li><li><strong>What it shows.</strong> The pattern matches the paper. No speculation is the worst, naive speculation leaves a noticeable gap, and a predictor gets most of the way to perfect by trading a large drop in violations for a few false dependences.</li></ol>`
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
        q: `<p>When does a load L issue for the last time under naive speculation, under a wait bit that is set, and under store sets?</p><p>Given:</p><ul><li>L is ready to issue at cycle 0</li><li>Older stores still unissued at cycle 0: 30</li><li>L truly depends on only one of them, store S, which issues at cycle 3</li><li>The last of the 30 stores to issue waits for data from an L3 hit and issues at cycle 46</li><li>A load that waits for a store issues the cycle after that store issues</li><li>A violation is detected when the conflicting store issues, and the refetched load reaches issue again 20 cycles later</li><li>Under store sets, S is the last fetched store of L's set</li></ul>`,
        a: `<ol class="steps"><li><strong>Naive speculation.</strong> L issues at cycle 0 and reads stale data. S issues at cycle 3 and detects the violation. L and everything younger are squashed, and the refetched L reaches issue 20 cycles later.<div class="math chain"><span>\\(\\displaystyle t_{\\text{naive}} = \\text{cycle } 3 + 20\\ \\text{cycles} \\)</span><span>\\(\\displaystyle = \\textbf{cycle } \\mathbf{23} \\)</span></div></li><li><strong>Wait bit.</strong> L waits for every older store, so it waits for the last one, which issues at cycle 46, and issues the cycle after.<div class="math chain"><span>\\(\\displaystyle t_{\\text{wait}} = \\text{cycle } 46 + 1\\ \\text{cycle} \\)</span><span>\\(\\displaystyle = \\textbf{cycle } \\mathbf{47} \\)</span></div></li><li><strong>Store sets.</strong> L waits only for S, the last fetched store of its set, and issues the cycle after S.<div class="math chain"><span>\\(\\displaystyle t_{\\text{sets}} = \\text{cycle } 3 + 1\\ \\text{cycle} \\)</span><span>\\(\\displaystyle = \\textbf{cycle } \\mathbf{4} \\)</span></div></li><li><strong>Comparison.</strong> The wait bit issues L later than even the violation does.<div class="math chain"><span>\\(\\displaystyle t_{\\text{wait}} - t_{\\text{naive}} = \\text{cycle } 47 - \\text{cycle } 23 \\)</span><span>\\(\\displaystyle = 24\\ \\text{cycles} \\)</span></div>That's Moshovos's finding that WAIT can lose to blind speculation when unrelated stores are slow. (Naive speculation also wastes the squashed younger work, so the comparison isn't free for it either.) Naming the store gets the best of both.</li></ol>`
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
<p>Every static load gets a <strong>store set</strong>: the store PCs it has ever depended on. Stores and loads are identified by PC. At program start every set is empty, so every load speculates. When a load and a store execute in the wrong order and cause a violation, the store's PC is added to the load's set. The next time that load is fetched, the core finds every in-flight instance of every store PC in its set that hasn't issued yet, and makes the load depend on all of them, not just one. Loads that never violate have empty sets and run as early as possible. And if a store in set A causes a violation with a different load, it joins that load's set too.</p>
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
<li><strong>Stores on different paths:</strong> <code>if (expr) x = a; else x = b; ... c = x;</code> The load of x depends on whichever store ran. For this to show up in compiled code, a few conditions must hold, listed after the three-path example below.</li>
<li><strong>Packed fields:</strong> separate stores write the red, green, and blue fields of a color word, and one load reads the whole word.</li>
<li><strong>Write-after-write chains:</strong> if repeated stores to one location are treated as dependences, a load depends on a series of stores, for example several spills to the same stack slot.</li>
</ul>
<p>A predictor that can name only one store per load fails toward violations, not false dependences. A named store that isn't in flight imposes no wait, so the load runs early and misses the store that did run. Take three paths that write the same location, then a load of it:</p>
<pre><code>if (a)      x = 1;   /* store S1 */
else if (b) x = 2;   /* store S2 */
else        x = 3;   /* store S3 */
...
y = x;               /* load L */</code></pre>
<p>Each violation overwrites the single slot with the store that just caught the load. If the paths are random and equally likely, the load traps whenever this instance's path differs from the one it last trained on, about 2 in 3 instances. A strict rotation through the three paths traps every time.</p>
<p>Code shaped like this produces these violations only if three things hold:</p>
<ul>
<li><strong>x lives in memory,</strong> such as a global or a field reached through a pointer. A local x stays in a register, and there are no stores or loads at all.</li>
<li><strong>The compiler keeps the stores separate.</strong> Compilers often sink stores to the same location from every arm of an if/else into one store after the branch. That leaves one store PC, and nothing to predict. Separate stores are more common when they sit in different functions or among other code.</li>
<li><strong>Each store issues after the load is ready,</strong> for example because its address or value comes from a load that missed. Here the stores write constants to a fixed address, so the older store issues first, and the load can't pass it.</li>
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
<p>Either limit costs a lot of performance on some programs, and preventing loads from sharing a store hurts more. One writer with several readers is the common case, and each time the store moves between two loads' sets, the move is paid for with a flush. With two readers alternating, each load traps on its turn and the store never settles. <a href="#/mdp-ssit/assignment">Store Sets in Hardware</a> calls this oscillation and fixes it with merging. In a side experiment, the second configuration was allowed 2, 4, or 8 stores per load. Eight stores per load (an 8-way associative set) lost nothing, and 4 was nearly as good, with only perl (primes) losing much. Section 6 of the paper keeps both kinds of flexibility while using direct-mapped tables.</p>

<h3 id="sec-ideal">How Well Ideal Store Sets Do</h3>
<p>Using the infinite configuration, the paper classifies each dynamic load (its Figure 5.2). Violations almost vanish in every program. The cost shows up as false dependences in a few programs: applu and xlisp have the most (roughly 25 to 30 per 1,000 instructions), and vortex, gcc, go, and swim have a few.</p>
<p>The cause is that a store set only grows. Once a store PC is in a load's set, every later instance of the load waits for every in-flight instance of that store for the rest of the run. If the pair touches the same address only occasionally, the core pays many false dependences to avoid a few violations. Typical sources are indexed accesses such as <code>a[i]</code> against <code>a[j]</code>, histogram bins (<code>h[k]++</code> collides only when nearby keys land in one bin), and pointers that sometimes alias. That suggests tracking a <strong>working</strong> store set: the stores the load has depended on <em>recently</em>.</p>
<p>A set that never forgets can turn one alias into a cache miss on every iteration:</p>
<pre><code>for (int i = 0; i &lt; n; i++) {
    a[tbl[key[i]]] = v[i];   /* store S: tbl is large, so tbl[key[i]] often misses L1D */
    sum += a[i];             /* load L: reads S's bytes only if tbl[key[i]] == i */
}
/* tbl[key[i]] == i on exactly one iteration. */</code></pre>
<p>L's address <code>&amp;a[i]</code> is ready almost at once, and S's address waits for the <code>tbl</code> load. On the one iteration where <code>tbl[key[i]]</code> equals <code>i</code>, L runs ahead of S and violates, so S's PC joins L's set and stays there. On every later iteration, L waits for that iteration's S, and S can't issue until <code>tbl[key[i]]</code> arrives, often from L2 or memory. Loads that used to take an L1 hit now each carry a miss latency, and the add chain on <code>sum</code> waits behind them. The loop runs only as fast as the window can overlap those misses, for a dependence that happened once. A working store set (2-bit counters, below) or periodic clearing (on <a href="#/mdp-ssit/feedback">Store Sets in Hardware</a>) is meant to forget this pattern.</p>
<p>The paper uses a fix borrowed from branch prediction: a 2-bit saturating counter on each store in a set.</p>
<ul>
<li>On a violation, the counter is set to its maximum, 3.</li>
<li>After a load has been forced to wait for a store in its set, the two addresses are compared. If they really overlapped, the counter goes up by 1. If they didn't, it goes down by 1.</li>
<li>The load waits for the store only while the counter's high bit is set.</li>
</ul>
<p>The decrement needs a signal plain store sets never get: whether a wait was needed. A plain store set learns only from the positive signal, the violation the store's load queue search finds. A cheap source for the negative signal is the load's own store queue search after it issues. The load holds the inum of the store it waited on, so "overlap" means the search matched that entry. In hardware the counter lives in the store's SSIT entry (see <a href="#/mdp-ssit/feedback">Clearing Stale Entries</a>), so the update must carry the store's SSIT index or PC. The inum names the store only while it is in flight.</p>
<p>One corner case: between the store issuing and the waiting load searching the store queue, the store can retire and drain to the cache, for example when the load is also waiting on a slow address register. The search then misses, the overlap bit reads 0, and the counter decrements on a true dependence. There's no correctness problem. The load reads the committed value from the cache, and if the counter later drops below the high bit, the load runs early, the load queue catches the violation, and the counter resets to 3. The cost is extra violations in steady state. Two fixes:</p>
<ul>
<li><strong>Skip the update</strong> when the waited-on store has already left the queue. "Unknown" is not "no".</li>
<li><strong>Latch the store's address</strong> when it broadcasts its inum, and compare the load's address against that.</li>
</ul>
<p>A reused store queue entry doesn't cause a false match. If the waited-on store's entry now holds a store younger than the load, the age compare (inum with its wrap bit) masks it out. A bare index without the wrap bit couldn't tell the new store from the old one.</p>
<p>This lowers false dependences, at the risk of letting violations come back for patterns that a 2-bit counter can't follow. In practice, violations stayed rare (Figure 5.3), and applu was the only program left with many false dependences.</p>
<p>Results (Figure 5.4): infinite store sets come close to perfect on every program. The worst is applu, at 10 to 14% below perfect, which is the program with the most false dependences. The counters help xlisp and applu slightly, but not by enough to clearly justify them. In a few programs, "perfect" was slightly <em>slower</em> than store sets. That's a modeling artifact: the perfect configuration also stops wrong-path execution after a branch mispredict, and wrong-path loads have both a prefetching benefit and a cache-thrashing cost, worth about ±2%. The conclusion: if hardware can approximate infinite store sets, it gets nearly perfect performance.</p>
<p>The modeling lesson: an oracle configuration should change only the thing it is an oracle for, and this one also stopped wrong-path execution, which removed both the prefetching benefit and the cache pollution of wrong-path loads, so the "upper bound" could land below a real design.</p>
<p class="refs">References: Chrysos and Emer, "Memory Dependence Prediction using Store Sets," ISCA 1998</p>`,
  practice: {
    guided: [
      {
        q: `<p>Two stores and two loads run in a loop: S1 at PC 0x7f08, S2 at PC 0x7f1c, L1 at PC 0x7f40, and L2 at PC 0x7f58. These violations happen in order:</p><ol><li>L1 with S1</li><li>L2 with S1</li><li>L1 with S2</li></ol><p>Give each load's store set after these violations under the infinite configuration, under configuration 1 (each store in only one set), and under configuration 2 (each set holds one store). Assume every pair conflicts every time it runs. What happens on later iterations in each case?</p><p class="given">In configuration 1, a store that causes a violation moves to the set of the load it conflicted with last. In configuration 2, a new violation replaces the store in the load's set.</p>`,
        a: `<ol class="steps"><li><strong>Infinite.</strong> L1 = {S1, S2}, L2 = {S1}. Both loads wait for every store they conflict with, so no further violations occur.</li><li><strong>Configuration 1.</strong> After violation 1, S1 is in L1's set. Violation 2 moves S1 to L2's set, leaving L1's set empty. Violation 3 adds S2 to L1's set. Result: L1 = {S2}, L2 = {S1}.</li><li><strong>Later iterations, configuration 1.</strong> L1 no longer waits for S1, so it violates with it, and S1 moves back to L1's set. Now L2 doesn't wait for S1 and violates, and S1 moves again. S1 ping-pongs between the two loads, costing a violation on every move.</li><li><strong>Configuration 2.</strong> Violation 1 sets L1 = {S1}, violation 2 sets L2 = {S1}, and violation 3 replaces S1 with S2, so L1 = {S2}, L2 = {S1}.</li><li><strong>Later iterations, configuration 2.</strong> L1 waits only for S2, so it violates with S1, which replaces S2. Then it violates with S2 again. L1 alternates between its two stores, and L2 is fine.</li><li><strong>The point.</strong> S1 has two readers and L1 has two writers, and each limited configuration breaks one of those cases.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>What is a load's steady-state cost per 4 instances with 2-bit counters, with store sets but no counters, and with naive speculation?</p><p>Given:</p><ul><li>An infinite store set predictor, optionally with a 2-bit counter on each store in a set</li><li>The load and a store in its set overlap on every 4th instance, in a fixed pattern: overlap, no, no, no, then repeat</li><li>A violation sets the counter to 3</li><li>The counter changes only when the load was made to wait: +1 on overlap (saturating at 3), −1 on no overlap</li><li>The load waits while the counter is 2 or 3</li><li>Violation cost: 18 cycles</li><li>False dependence cost: 5 cycles on the critical path</li><li>A wait on an overlapping instance is a true dependence and costs nothing extra</li></ul>`,
        a: `<ol class="steps"><li><strong>Start of the pattern.</strong> Start right after the violation on an overlap instance, with the counter at 3.</li><li><strong>First "no".</strong> The counter is 3, so the load waits needlessly, a false dependence. The counter drops to 2.</li><li><strong>Second "no".</strong> The counter is 2, so the load waits needlessly again. The counter drops to 1.</li><li><strong>Third "no".</strong> The counter is 1, so the load doesn't wait, and there's no overlap. This one is correct, and the counter stays at 1.</li><li><strong>"Overlap".</strong> The counter is 1, so the load doesn't wait. It violates, and the counter goes back to 3.</li><li><strong>Cost with counters.</strong> Each 4 instances hold 1 violation and 2 false dependences.<div class="math chain"><span>\\(\\displaystyle C_{\\text{viol}} = 1\\ \\text{violation} \\times \\frac{18\\ \\text{cycles}}{1\\ \\text{violation}} \\)</span><span>\\(\\displaystyle = 18\\ \\text{cycles} \\)</span></div><div class="math chain"><span>\\(\\displaystyle C_{\\text{false}} = 2\\ \\text{false deps} \\times \\frac{5\\ \\text{cycles}}{1\\ \\text{false dep}} \\)</span><span>\\(\\displaystyle = 10\\ \\text{cycles} \\)</span></div><div class="math chain"><span>\\(\\displaystyle C_{\\text{counters}} = 18\\ \\text{cycles} + 10\\ \\text{cycles} \\)</span><span>\\(\\displaystyle = \\mathbf{28}\\ \\textbf{cycles per 4 instances} \\)</span></div></li><li><strong>Cost without counters.</strong> The load always waits, so the 3 "no" instances are false dependences and there are no violations.<div class="math chain"><span>\\(\\displaystyle C_{\\text{sets}} = 3\\ \\text{false deps} \\times \\frac{5\\ \\text{cycles}}{1\\ \\text{false dep}} \\)</span><span>\\(\\displaystyle = \\mathbf{15}\\ \\textbf{cycles per 4 instances} \\)</span></div></li><li><strong>Cost with naive speculation.</strong> The load never waits, so only the overlap instance costs anything.<div class="math chain"><span>\\(\\displaystyle C_{\\text{naive}} = 1\\ \\text{violation} \\times \\frac{18\\ \\text{cycles}}{1\\ \\text{violation}} \\)</span><span>\\(\\displaystyle = \\mathbf{18}\\ \\textbf{cycles per 4 instances} \\)</span></div></li><li><strong>What it shows.</strong> The counters are the worst of the three here. Their hysteresis is two wrong waits, shorter than the pattern's run of three "no" instances, so they give up waiting just before the overlap. That's the risk the paper names: counters cut false dependences but can bring violations back for patterns a 2-bit counter can't follow.</li></ol>`
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
<p>Infinite store sets need two kinds of flexibility that are expensive in hardware: a load waiting on several stores, and a store in several sets. Unlike the ideal version, the implementation gives up both and adds aliasing on top. Each restriction below says what replaces the lost flexibility:</p>
<ul>
<li><strong>Finite, direct-mapped, untagged tables.</strong> Unrelated loads may share a set by aliasing, which can add false dependences.</li>
<li><strong>A store is in at most one store set at a time</strong> (like configuration 1 on <a href="#/mdp-store-sets/store-sets">Store Sets</a>). Merging (next section) lets two loads that depend on the same store share one set.</li>
<li><strong>Stores in one set execute in program order.</strong> A load in a set with several stores would need to wait for all of them, but hardware doesn't know which will finish last, and a load with several dependence tags makes the scheduler more complex. Instead, each store depends on the previous fetched store in its set, and each load depends on the last fetched store in its set. The stores form an in-order chain, and the load waits on the end of the chain, so it waits for all of them with one dependence.</li>
</ul>
<p>So the hardware gives up one load waiting on several store tags and one store in several sets, and its finite, direct-mapped, untagged tables alias. The chain recovers "wait for all in-flight stores in the set" with one tag. The stores issue in program order, so the last fetched store issues no earlier than any other store of the set, and a load waiting on it waits for all of them.</p>
<p>The in-order chain has a second benefit. If two stores in a set both write address X and a load of X follows, the load really depends only on the second store. Because the two stores execute in order, the core doesn't need any write-after-write detection to work this out.</p>
<p><strong>Does the chain delay loads?</strong> <a href="#/mdp/why">Goal 2</a> says a load should be delayed no longer than needed. Take a set {S1, S2}, in program order. The load really reads only S1's address. S1 is ready early, and S2's data comes from a load that missed in L2.</p>
<ol>
<li><strong>Ideal store sets:</strong> the load still waits for S2, because S2 is an in-flight member of its set.</li>
<li><strong>Hardware:</strong> S2 waits for S1, and the load waits for S2, so the load issues at the same time as in the ideal version.</li>
</ol>
<p>Here goal 2 is missed by set membership at PC granularity, not by the chain. The set decides how long a load waits. The chain only decides how the hardware expresses that wait with one tag. The chain's own cost falls on stores: when S1 is late, S2's issue is pushed back too. Extra load delay in hardware beyond the ideal comes from sets larger than the true dependences, made larger by merging and by SSIT and LFST aliasing.</p>
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
<li><strong>LFST invalidation:</strong> "After a store instruction issues, it accesses the LFST and invalidates the entry if it still refers to itself." A load fetched after this sees no valid store and doesn't wait. If a newer store of set X had already overwritten the entry, the entry stays, so later loads wait for that newer store. What goes wrong if a store always invalidates the entry, or never does, is the first Interview Level problem below.</li>
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
<p>Rule 4 needs an arbitration that always picks the same winner between the same two sets. The paper picks the set with the smaller SSID. The winner must be fixed. If the load's set always won, the store would always be the one that moves, which is the same as no merging, and the two loads would keep taking store J from each other. With a fixed winner, membership only ever moves toward the smaller SSID. With this rule, oscillation becomes <strong>merging</strong>. Walking through the example again with set 1 as the winner:</p>
<ol>
<li>Load PC 1 violates with store J (in set 2). Rule 4: set 1 wins, so store J moves to set 1.</li>
<li>Load PC 2 violates with store J (now in set 1). Rule 4 again: set 1 wins again, so this time load PC 2 moves to set 1.</li>
<li>Load PC 2 later violates with store K, which is still alone in set 2 (no load points to it). Set 1 wins, so K moves to set 1.</li>
<li>Now both loads and all of their stores are in set 1, and no more violations happen.</li>
</ol>
<p>Each violation between two sets either moves one instruction toward the winner or changes nothing, so the sets converge after a bounded number of traps. Merging can add false dependences, since load PC 1 now also waits for stores J and K. The paper found no measurable cost from this. Merged loads and stores usually sit in different code regions, so they're rarely in flight together. Even when they are, the extra wait matters only if the store issues later than the load's own operands would have let it.</p>
<p>Merging can still hurt. In this loop, one rare alias joins two hot sets:</p>
<pre><code>for (int i = 0; i &lt; n; i++) {
    a[tbl[key[i]]] = v[i];   /* S1: tbl is large, so tbl[key[i]] often misses L1D */
    x += a[p[i]];            /* L1: sometimes reads S1's bytes, set 1 = {S1, L1} */

    a[q[k[i]]] = w[i];       /* S2: q is small, so q[k[i]] is an L1D hit */
    y += a[r[i]];            /* L2: sometimes reads S2's bytes, set 2 = {S2, L2} */
}
/* On exactly one iteration, L2 reads S1's bytes and S2 writes elsewhere. */</code></pre>
<p>Each load's address comes from a sequential array and is ready early. S1's address waits for an L1D miss and S2's for an L1D hit, so each store is late compared with its load. That's how sets 1 and 2 were learned.</p>
<ol>
<li><strong>The alias.</strong> On the aliasing iteration, S1 is the last writer of the bytes L2 reads, and S1's address arrives long after L2's, so L2 violates with S1. Both have sets, so by rule 4 set 1 wins and L2 moves to set 1. S2 stays in set 2.</li>
<li><strong>The coupling.</strong> L2 now reads LFST[1], not LFST[2], and the last fetched store of set 1 is S1. So on every iteration L2 waits for S1, which can't issue until <code>tbl[key[i]]</code> arrives. L2 and the add chain on <code>y</code> inherit S1's cache misses, even though L2 almost never reads S1's bytes. L2 has also stopped waiting for S2, its true dependence, but S1 is usually later than S2, so L2 still issues after S2.</li>
<li><strong>The cascade.</strong> On an iteration where <code>tbl[key[i]]</code> hits L1D, S1 can issue before S2, so L2 can pass S2, and if it reads S2's bytes it violates. Rule 4 pulls S2 into set 1. From then on S2 chains behind S1 and L2 waits for S2, the same coupling as before. The next iteration's S1 also chains behind this iteration's S2, so every store in the loop now issues in program order.</li>
<li><strong>The end.</strong> The coupling lasts until the next cyclic clear, about every million cycles, after which the sets relearn.</li>
</ol>
<p>Merging has no cost while the merged sets are in flight at different times, and it becomes a slowdown when one rare alias joins two hot sets and the chain makes one set's stalls stall the other.</p>
<p><strong>A set joined through SSIT aliasing.</strong> The SSIT has no tags, so an instruction whose PC indexes an entry that another instruction trained uses that entry's SSID as its own. It joins the set without ever violating. Keep S1 and L1 from the loop above, drop S2 and L2, and have the loop call a logging function:</p>
<pre><code>void record(int v) {
    log_buf[slot[v &amp; 0xffff]] = v;   /* SR: slot is 256 KiB, so slot[...] often misses L1D */
}

for (long i = 0; i &lt; n; i++) {
    a[tbl[key[i]]] = v[i];             /* S1 */
    record(v[i]);
    x += a[p[i]];                      /* L1 */
}</code></pre>
<p>SR writes only <code>log_buf</code>, so it never writes a byte that L1 reads. Compiled for AArch64, with 4-byte instructions, and with <code>record</code> linked 16 KiB after the loop:</p>
<pre><code>loop:                                   // x19 = i, x20 = a, x21 = tbl, x22 = key, x23 = v, x24 = p, x25 = n, w26 = x
0x401a20  ldr  w8, [x22, x19, lsl #2]   // key[i]
0x401a24  ldr  w8, [x21, w8, sxtw #2]   // tbl[key[i]], often misses L1D
0x401a28  ldr  w0, [x23, x19, lsl #2]   // v[i]
0x401a2c  str  w0, [x20, w8, sxtw #2]   // S1: a[tbl[key[i]]] = v[i]
0x401a30  bl   record                   // record(v[i])
0x401a34  ldr  w8, [x24, x19, lsl #2]   // p[i]
0x401a38  ldr  w8, [x20, w8, sxtw #2]   // L1: a[p[i]]
0x401a3c  add  w26, w26, w8             // x += a[p[i]]
0x401a40  add  x19, x19, #1
0x401a44  cmp  x19, x25
0x401a48  b.lt 0x401a20

record:                                 // w0 = v
0x405a20  adrp x9, slot
0x405a24  add  x9, x9, :lo12:slot
0x405a28  adrp x11, log_buf
0x405a2c  add  x11, x11, :lo12:log_buf
0x405a30  and  w10, w0, #0xffff         // v &amp; 0xffff
0x405a34  ldr  w10, [x9, w10, uxtw #2]  // slot[v &amp; 0xffff], often misses L1D
0x405a38  str  w0, [x11, w10, sxtw #2]  // SR: log_buf[slot[v &amp; 0xffff]] = v
0x405a3c  ret</code></pre>
<p>Take a 4K-entry SSIT, the size the <a href="#/mdp-ssit/table-sizes">table size</a> results find costs nothing. With 4-byte instructions, PC bits 1 and 0 are always 0, so the index is PC bits 13 to 2:</p>
<ul>
<li>S1 at 0x401a2c indexes entry 0x68b</li>
<li>L1 at 0x401a38 indexes entry 0x68e</li>
<li>SR at 0x405a38 also indexes entry 0x68e, since its PC differs from L1's only in bit 14, which the index drops</li>
</ul>
<div class="tbl"><svg viewBox="0 0 680 350" role="img" aria-label="SSIT aliasing between L1 and SR. The loop body holds S1 at PC 0x401a2c, a store to a of tbl of key of i, and L1 at PC 0x401a38, a load of a of p of i. The record function, 16 KiB later, holds SR at PC 0x405a38, a store to log_buf. The 4K-entry SSIT is indexed by PC bits 13 to 2 with no tag. S1 indexes entry 0x68b, which holds SSID 1. L1 and SR both index entry 0x68e, which holds SSID 1, so SR is in set 1 without ever violating. Both entries lead to LFST entry 1. Below, in fetch order each iteration, S1 of iteration i misses on tbl, SR of iteration i waits for S1 and misses on slot, L1 of iteration i waits for SR, and S1 of iteration i plus 1 waits for SR of iteration i.">
<defs><marker id="arrMD4" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker></defs>
<text x="10" y="18" style="fill:var(--muted);font-size:12px;font-weight:600">4K-entry SSIT, indexed by PC bits 13 to 2, no tag</text>
<g style="stroke-width:1.5">
<rect x="10" y="30" width="300" height="96" rx="3" style="fill:var(--surface);stroke:var(--muted)"/>
<rect x="10" y="146" width="300" height="56" rx="3" style="fill:var(--surface);stroke:var(--muted)"/>
<rect x="400" y="40" width="140" height="144" rx="3" style="fill:var(--surface);stroke:var(--muted)"/>
<rect x="400" y="64" width="140" height="24" style="fill:var(--trace-soft);stroke:var(--trace)"/>
<rect x="400" y="136" width="140" height="24" style="fill:var(--pad-soft);stroke:var(--pad)"/>
<rect x="580" y="88" width="90" height="48" rx="3" style="fill:var(--surface);stroke:var(--muted)"/>
</g>
<g style="fill:none;stroke:var(--rule);stroke-width:1">
<path d="M400,64 H540"/><path d="M400,88 H540"/><path d="M400,112 H540"/><path d="M400,136 H540"/><path d="M400,160 H540"/>
</g>
<g style="fill:var(--ink);font-size:12px;font-weight:600">
<text x="18" y="48">Loop body</text>
<text x="18" y="164">record(), 16 KiB later</text>
</g>
<g style="fill:var(--ink);font-family:var(--mono);font-size:11px">
<text x="18" y="70">0x401a2c  str  S1  a[tbl[key[i]]]</text>
<text x="18" y="88" style="fill:var(--muted)">0x401a30  bl   record</text>
<text x="18" y="108">0x401a38  ldr  L1  a[p[i]]</text>
<text x="18" y="188">0x405a38  str  SR  log_buf[...]</text>
<text x="408" y="56" style="fill:var(--muted)">0x68a</text><text x="408" y="80">0x68b</text><text x="408" y="104" style="fill:var(--muted)">0x68c</text>
<text x="408" y="128" style="fill:var(--muted)">0x68d</text><text x="408" y="152">0x68e</text><text x="408" y="176" style="fill:var(--muted)">0x68f</text>
</g>
<g style="fill:var(--ink);font-size:12px" text-anchor="middle">
<text x="470" y="32" style="font-weight:600">SSIT</text>
<text x="500" y="56" style="fill:var(--muted)">invalid</text><text x="500" y="80">SSID 1</text><text x="500" y="104" style="fill:var(--muted)">invalid</text>
<text x="500" y="128" style="fill:var(--muted)">invalid</text><text x="500" y="152" style="font-weight:600">SSID 1</text><text x="500" y="176" style="fill:var(--muted)">invalid</text>
<text x="625" y="108" style="font-weight:600">LFST[1]</text><text x="625" y="124">last store</text>
</g>
<g style="fill:none;stroke:var(--muted);stroke-width:1.5">
<path d="M300,66 H350 V76 H398" marker-end="url(#arrMD4)"/>
<path d="M300,104 H360 V144 H398" marker-end="url(#arrMD4)"/>
<path d="M300,184 H370 V152 H398" marker-end="url(#arrMD4)"/>
<path d="M540,76 H560 V104 H578" marker-end="url(#arrMD4)"/>
<path d="M540,148 H560 V120 H578" marker-end="url(#arrMD4)"/>
</g>
<text x="400" y="200" style="fill:var(--muted);font-size:11px">L1 and SR share entry 0x68e</text>
<text x="10" y="236" style="fill:var(--muted);font-size:12px;font-weight:600">Each iteration, in fetch order (arrows point from a store to what waits for it)</text>
<g style="stroke-width:1.5">
<rect x="10" y="248" width="130" height="44" rx="3" style="fill:var(--trace-soft);stroke:var(--trace)"/>
<rect x="190" y="248" width="130" height="44" rx="3" style="fill:var(--pad-soft);stroke:var(--pad)"/>
<rect x="370" y="248" width="130" height="44" rx="3" style="fill:var(--trace-soft);stroke:var(--trace)"/>
<rect x="540" y="248" width="130" height="44" rx="3" style="fill:var(--trace-soft);stroke:var(--trace)"/>
</g>
<g style="fill:var(--ink);font-size:12px" text-anchor="middle">
<text x="75" y="266" style="font-weight:600">S1 (i)</text><text x="75" y="283">tbl[...] miss</text>
<text x="255" y="266" style="font-weight:600">SR (i)</text><text x="255" y="283">slot[...] miss</text>
<text x="435" y="266" style="font-weight:600">L1 (i)</text><text x="435" y="283">waits for SR (i)</text>
<text x="605" y="266" style="font-weight:600">S1 (i + 1)</text><text x="605" y="283">waits for SR (i)</text>
</g>
<g style="fill:none;stroke:var(--muted);stroke-width:1.5">
<path d="M140,270 H188" marker-end="url(#arrMD4)"/>
<path d="M320,270 H368" marker-end="url(#arrMD4)"/>
<path d="M255,292 V318 H605 V294" marker-end="url(#arrMD4)"/>
</g>
<text x="340" y="336" style="fill:var(--muted);font-size:11px" text-anchor="middle">SR is the last fetched store of set 1 when L1 and the next S1 read LFST[1]</text>
</svg></div>
<ol>
<li><strong>Training.</strong> L1 violates with S1. Neither has a set, so rule 1 allocates set 1 and writes SSID 1 into SSIT entries 0x68b and 0x68e.</li>
<li><strong>The alias.</strong> SR is fetched and reads entry 0x68e. The entry is valid and holds SSID 1, and with no tag nothing can tell that L1 trained it, so SR is now a store of set 1. It reads LFST[1], finds S1, and chains behind it. Then it writes its own inum into LFST[1], so it's the last fetched store of set 1.</li>
<li><strong>The coupling.</strong> L1 reads LFST[1] and gets SR, not S1. It still waits for S1 through the chain, so its true dependence holds, but it also waits for SR, and SR waits for its <code>slot[...]</code> miss. On an iteration where <code>tbl[key[i]]</code> hits and <code>slot[...]</code> misses, L1 used to issue right after S1 and now waits about a full miss, and the add chain on <code>x</code> waits with it. The next iteration's S1 chains behind this iteration's SR, so S1 and SR issue in program order across the whole loop.</li>
<li><strong>No way out.</strong> SR never writes a byte L1 reads, so the false dependence never causes a violation, and nothing ever retrains entry 0x68e. A cyclic clear invalidates it, but the next violation between L1 and S1 writes SSID 1 back, and SR rejoins on its next fetch. The coupling lasts as long as the code layout. A larger SSIT, or an index that hashes in higher PC bits, moves collisions to other PC pairs, but some pairs still collide.</li>
</ol>
<p>Aliasing also changes what merging moves. Say SR had trained its own set 5 with a load L5 that reads <code>log_buf</code>. Entry 0x68e holds one SSID, so whichever pair trained last owns it. If it holds 5, L1 reads set 5, stops waiting for S1, and violates with it again. Both have sets, so by rule 4 set 1 wins and L1 moves to set 1 by a write to entry 0x68e. That one write moves SR too. L5 is still in set 5 and no longer waits for SR, so it violates with SR, and rule 4 pulls L5 into set 1. Two pairs that share no data now form one set, {S1, L1, SR, L5}, and it rebuilds the same way after every clear.</p>
<p><strong>The same cascade with the paper's set shapes.</strong> The paper's example has three stores in set 1 and two in set 2. Written as stores on different paths, it looks like this:</p>
<pre><code>for (int i = 0; i &lt; n; i++) {
    /* region 1: set 1 = {store x, store y, store z}, load 1 */
    if (cond1)      arr[idx1[i]] = 1;   /* store x */
    else if (cond2) arr[idx1[i]] = 2;   /* store y */
    else            arr[idx1[i]] = 3;   /* store z */
    var1 = arr[idx1[i]];                /* load 1 */

    /* region 2: set 2 = {store j, store k}, load 2 */
    if (cond1)      arr[idx2[i]] = 1;   /* store j */
    else if (cond2) arr[idx2[i]] = 2;   /* store k */
    var2 = arr[idx2[i]];                /* load 2 */
}
/* idx1[i] == idx2[i] on exactly one iteration, with cond1 and cond2 false. */</code></pre>
<p>On the aliasing iteration no region 2 store runs, so store z is the last writer of the bytes load 2 reads. Load 2 violates with z and moves to set 1. Later violations with j and with k, on iterations where they issue late, pull each of them into set 1 too. That's the same cascade with one more store. Taken literally, though, this code wouldn't train any of these sets:</p>
<ul>
<li><strong>The loads get removed.</strong> Load 1 reads the address its region's store just wrote, with no other store in between, so the compiler forwards the stored value in a register and emits no load. Load 2 is removed the same way on the paths where j or k ran, and survives only on the path where neither did.</li>
<li><strong>The stores get merged.</strong> Compilers often sink stores to the same address from every arm of an if/else into one store after the branch, so x, y, and z become one store PC, and so do j and k.</li>
<li><strong>The loads can't pass their stores.</strong> Each store and its load take their address from the same <code>idx1[i]</code> or <code>idx2[i]</code>, and the store data is a constant. The store is ready no later than the load, and as the older instruction it issues first, so there's no violation to learn from.</li>
</ul>
<p>The shape is still realistic for code where the stores sit on different paths and reach the location through slower addresses than the load does. The loop with S1 and S2 keeps one store per set so the mechanism is easier to follow.</p>
<p>Without merging (each store simply takes the SSID of the latest load it violated with), IPC drops by an average of 12%. Examples from the paper's Figure 6.2, read from the chart:</p>
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
<p>A 4K-entry SSIT costs nothing, and 1K entries are still acceptable. The program most sensitive to SSIT size is fpppp (Figure 6.5). Its false dependences go from almost none at 4K entries to about 28 per 1,000 instructions at 512 and about 215 per 1,000 instructions at 128. Its IPC falls to about 0.46 of the large table's, approaching the no-speculation level (about 0.35 of perfect) in <a href="#/mdp-metrics/bounds">Never, Always, and Perfect</a>. The cause is aliasing: in a small untagged SSIT, loads and stores that need no ordering share entries with ones that do. Tags would let the SSIT shrink, at the cost of a tag array and comparators.</p>
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
        a: `<ol class="steps"><li><strong>Training.</strong> After the violation, the SSIT assigns both PCs the same set. Assume it is set 5.</li><li><strong>S is fetched.</strong> It looks up set 5 and records itself in LFST[5] as the latest store of the set.</li><li><strong>L is fetched.</strong> It looks up set 5, reads LFST[5], and takes a dependence on S.</li><li><strong>Issue.</strong> L issues only after S issues. When S issues, LFST[5] is cleared if it still points to S.</li></ol>`
      },
      {
        q: `<p>A store set predictor uses the paper's assignment rules, with the smaller SSID winning rule 4. Two loads and three stores have these SSIT entries:</p><ul><li>Load L1 (PC 0x4a0) and store S1 (PC 0x400) have SSID 3</li><li>Load L2 (PC 0x4c8) and store S2 (PC 0x410) have SSID 9</li><li>Store S3 (PC 0x430) has SSID 9 too (it once conflicted with L2)</li></ul><p>Then these violations happen in order:</p><ol><li>L1 violates with S2</li><li>L2 violates with S2</li><li>L2 violates with S3</li></ol><p>Give the SSIDs after each violation. Then show what would happen if, instead, a store always took the SSID of the load it just violated with.</p>`,
        a: `<ol class="steps"><li><strong>Violation 1.</strong> L1 (SSID 3) violates with S2 (SSID 9). Both have sets, so rule 4 applies: SSID 3 wins over SSID 9. The instruction in the losing set, S2, moves to SSID 3. Now L1, S1, and S2 have SSID 3. L2 and S3 still have SSID 9.</li><li><strong>Violation 2.</strong> L2 (SSID 9) violates with S2 (SSID 3). Rule 4 again picks SSID 3, so this time L2 moves to SSID 3. Now L1, L2, S1, and S2 have SSID 3, and S3 is the only instruction left with SSID 9.</li><li><strong>Violation 3.</strong> L2 (SSID 3) violates with S3 (SSID 9). SSID 3 wins, so S3 moves to SSID 3. All five instructions are in one set, and both loads now wait for the last fetched of S1, S2, and S3. No further violations occur among them.</li><li><strong>Without the rules.</strong> If the store takes the load's SSID instead, then after violation 1, S2 has SSID 3. Violation 2 moves S2 back to SSID 9. The next instance of L1 no longer waits for S2, so it violates again and S2 returns to SSID 3, and so on. L1 and L2 take turns trapping on S2 forever. That's the oscillation the rules prevent.</li></ol>`
      },
      {
        q: `<p>Which SSIT entries do three instructions use, and what does a load that never conflicts pick up from a shared entry?</p><p>Given:</p><ul><li>SSIT: 2,048 entries, untagged, indexed by PC bits [12:2]</li><li>Instructions: 4 bytes each</li><li>Load L at PC 0x401a3c and store S at PC 0x4019f0 once conflicted, so both have SSID 17</li><li>Load U at PC 0x403a3c, in another function, never conflicts with anything</li></ul><ol type="a"><li>Compute the SSIT index of each instruction.</li><li>What happens each time U is fetched while an instance of S is in flight?</li><li>Does cyclic clearing fix it? What does?</li></ol>`,
        a: `<ol class="steps"><li><strong>(a) Index rule.</strong> Bits [12:2] are the low 11 bits of the PC after dropping the 2 byte-offset bits, so the index is the PC shifted right by 2, modulo 2,048 entries (0x800).<div class="math chain"><span>\\(\\displaystyle i_L = (\\texttt{0x401a3c} \\gg 2) \\bmod \\texttt{0x800} \\)</span><span>\\(\\displaystyle = \\texttt{0x10068f} \\bmod \\texttt{0x800} \\)</span><span>\\(\\displaystyle = \\mathbf{\\texttt{0x68f}} \\)</span></div><div class="math chain"><span>\\(\\displaystyle i_S = (\\texttt{0x4019f0} \\gg 2) \\bmod \\texttt{0x800} \\)</span><span>\\(\\displaystyle = \\texttt{0x10067c} \\bmod \\texttt{0x800} \\)</span><span>\\(\\displaystyle = \\mathbf{\\texttt{0x67c}} \\)</span></div><div class="math chain"><span>\\(\\displaystyle i_U = (\\texttt{0x403a3c} \\gg 2) \\bmod \\texttt{0x800} \\)</span><span>\\(\\displaystyle = \\texttt{0x100e8f} \\bmod \\texttt{0x800} \\)</span><span>\\(\\displaystyle = \\mathbf{\\texttt{0x68f}} \\)</span></div></li><li><strong>(a) Why L and U collide.</strong> Their PCs differ by exactly the span of the table, so they wrap onto the same entry.<div class="math chain"><span>\\(\\displaystyle \\texttt{0x403a3c} - \\texttt{0x401a3c} = \\texttt{0x2000}\\ \\text{bytes} \\)</span><span>\\(\\displaystyle = 8{,}192\\ \\text{bytes} \\)</span><span>\\(\\displaystyle = 2{,}048\\ \\text{entries} \\times \\frac{4\\ \\text{bytes}}{1\\ \\text{entry}} \\)</span></div></li><li><strong>(b) What U picks up.</strong> The SSIT has no tags, so U reads entry 0x68f, finds a valid SSID 17, reads LFST[17], finds S's inum, and waits for S to issue. Every such wait is a false dependence, and it costs time whenever U is on the critical path.</li><li><strong>(c) Clearing.</strong> Clearing removes it only for a while. After the clear, U runs freely, but as soon as L and S conflict again, entry 0x68f becomes valid with an SSID and U picks it up again.</li><li><strong>(c) Real fixes.</strong> They keep L and U apart. A 4,096-entry SSIT (0x1000) indexes with bits [13:2], and partial tags let U see that the entry isn't its own.<div class="math chain"><span>\\(\\displaystyle i'_L = \\texttt{0x10068f} \\bmod \\texttt{0x1000} \\)</span><span>\\(\\displaystyle = \\texttt{0x68f} \\)</span></div><div class="math chain"><span>\\(\\displaystyle i'_U = \\texttt{0x100e8f} \\bmod \\texttt{0x1000} \\)</span><span>\\(\\displaystyle = \\texttt{0xe8f} \\)</span></div></li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>When a store issues, the LFST entry for its set is invalidated only if it still holds that store's inum. What goes wrong if the store always invalidates its LFST entry, and what goes wrong if stores never invalidate it?</p>`,
        a: `<p><strong>Always invalidate:</strong> a later store of the same set may have been fetched in the meantime and written its own inum into the entry. The older store's issue then erases the newer store from the LFST. A load fetched after that finds no in-flight store for its set and runs freely, so if it depends on the newer store it violates. The bug only shows up when two stores of one set are in flight together, which is exactly the merged-set case store sets are built for.</p><p><strong>Never invalidate:</strong> the entry keeps pointing at a store that has already issued. A load renamed after that reads the store's inum, but the store's wakeup broadcast has already gone out, so the load hangs. Once the inum is reused, the new instruction is younger than the load. If it depends on the load, the core deadlocks. If it's an unrelated store, it wakes the load at an unrelated time. If it isn't a store, nothing ever wakes the load except a hang watchdog or a flush. A tag must mean "not issued yet" at the moment it is read, the same reason physical registers have ready bits. The check also matters on a flush: squashed stores must be removed from the LFST so a refetched load doesn't wait on an instruction that no longer exists.</p>`
      },
      {
        q: `<p>How many bytes do a store set predictor's SSIT and LFST need, how does that compare with a wait table, and what happens if you cut the SSIT to 256 entries to save area?</p><p>Given:</p><ul><li>ROB: 256 entries, and an inum is the 8-bit ROB index</li><li>SSIT: 2,048 entries, untagged</li><li>LFST: 64 entries</li><li>Each entry in both tables has a valid bit</li><li>Wait table for comparison: 2,048 entries of 1 bit</li></ul>`,
        a: `<ol class="steps"><li><strong>SSID width.</strong> An SSID must name one of the 64 LFST entries.<div class="math chain"><span>\\(\\displaystyle w_{\\text{SSID}} = \\log_2 64 \\)</span><span>\\(\\displaystyle = 6\\ \\text{bits} \\)</span></div></li><li><strong>SSIT.</strong> Each entry holds an SSID and a valid bit.<div class="math chain"><span>\\(\\displaystyle S_{\\text{SSIT}} = 2{,}048\\ \\text{entries} \\times \\frac{6\\ \\text{bits} + 1\\ \\text{bit}}{1\\ \\text{entry}} \\)</span><span>\\(\\displaystyle = 14{,}336\\ \\text{bits} \\times \\frac{1\\ \\text{byte}}{8\\ \\text{bits}} \\)</span><span>\\(\\displaystyle = \\mathbf{1{,}792}\\ \\textbf{bytes} \\)</span></div></li><li><strong>LFST.</strong> Each entry holds an 8-bit inum and a valid bit.<div class="math chain"><span>\\(\\displaystyle S_{\\text{LFST}} = 64\\ \\text{entries} \\times \\frac{8\\ \\text{bits} + 1\\ \\text{bit}}{1\\ \\text{entry}} \\)</span><span>\\(\\displaystyle = 576\\ \\text{bits} \\times \\frac{1\\ \\text{byte}}{8\\ \\text{bits}} \\)</span><span>\\(\\displaystyle = \\mathbf{72}\\ \\textbf{bytes} \\)</span></div></li><li><strong>Total and comparison.</strong> Add the two tables, then size the wait table the same way.<div class="math chain"><span>\\(\\displaystyle S_{\\text{sets}} = 1{,}792\\ \\text{bytes} + 72\\ \\text{bytes} \\)</span><span>\\(\\displaystyle = \\mathbf{1{,}864}\\ \\textbf{bytes} \\)</span></div><div class="math chain"><span>\\(\\displaystyle S_{\\text{wait}} = 2{,}048\\ \\text{entries} \\times \\frac{1\\ \\text{bit}}{1\\ \\text{entry}} \\times \\frac{1\\ \\text{byte}}{8\\ \\text{bits}} \\)</span><span>\\(\\displaystyle = \\mathbf{256}\\ \\textbf{bytes} \\)</span></div><div class="math chain"><span>\\(\\displaystyle \\frac{S_{\\text{sets}}}{S_{\\text{wait}}} = \\frac{1{,}864\\ \\text{bytes}}{256\\ \\text{bytes}} \\)</span><span>\\(\\displaystyle \\approx \\mathbf{7.3\\times} \\)</span></div>The store set predictor also needs an LFST read on fetch and an invalidate path on store issue.</li><li><strong>A 256-entry SSIT.</strong> It saves area, but the table is untagged. Many unrelated loads and stores then share entries and inherit SSIDs they don't need, so false dependences rise sharply. In the store sets paper, fpppp lost more than 40% of its IPC at 256 entries. If area must shrink, add partial tags or shrink the LFST first, since the LFST tolerates sharing much better.<div class="math chain"><span>\\(\\displaystyle S'_{\\text{SSIT}} = 256\\ \\text{entries} \\times \\frac{6\\ \\text{bits} + 1\\ \\text{bit}}{1\\ \\text{entry}} \\)</span><span>\\(\\displaystyle = 1{,}792\\ \\text{bits} \\times \\frac{1\\ \\text{byte}}{8\\ \\text{bits}} \\)</span><span>\\(\\displaystyle = \\mathbf{224}\\ \\textbf{bytes} \\)</span></div></li></ol>`
      },
      {
        q: `<p>What fraction of run time does relearning after each SSIT clear cost at two clearing intervals, and what limits how long the interval can be?</p><p>Given:</p><ul><li>The SSIT valid bits are cleared every T cycles</li><li>After each clear, 350 active store-load pairs must each cause one violation to relearn</li><li>Violation cost: 24 cycles</li><li>Intervals to compare: T = 2,000,000 cycles and T = 50,000 cycles</li><li>The relearning violations don't overlap</li></ul>`,
        a: `<ol class="steps"><li><strong>Cost per clear.</strong> Every active pair pays one violation to relearn.<div class="math chain"><span>\\(\\displaystyle C = 350\\ \\text{pairs} \\times \\frac{1\\ \\text{violation}}{1\\ \\text{pair}} \\times \\frac{24\\ \\text{cycles}}{1\\ \\text{violation}} \\)</span><span>\\(\\displaystyle = 8{,}400\\ \\text{cycles} \\)</span></div></li><li><strong>Long interval.</strong> The overhead is the cost per clear over the cycles between clears.<div class="math chain"><span>\\(\\displaystyle f_{2\\text{M}} = \\frac{8{,}400\\ \\text{cycles}}{2{,}000{,}000\\ \\text{cycles}} \\)</span><span>\\(\\displaystyle = \\mathbf{0.42\\%} \\)</span></div></li><li><strong>Short interval.</strong> The same cost over a much shorter interval is far too high.<div class="math chain"><span>\\(\\displaystyle f_{50\\text{K}} = \\frac{8{,}400\\ \\text{cycles}}{50{,}000\\ \\text{cycles}} \\)</span><span>\\(\\displaystyle = \\mathbf{16.8\\%} \\)</span></div></li><li><strong>The upper limit.</strong> T can't grow without limit, because clearing is the only way stale entries leave the untagged SSIT. Between clears, pairs that stopped conflicting (a phase change, or a store that conflicts only rarely) and aliased entries keep adding false dependences. The best T balances that growing false-dependence cost against the relearning cost, which falls as 1/T. The paper's 1,000,000-cycle interval sits in that range for SPEC95.</li></ol>`
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
<p>applu shows the limit of the approach. Under <a href="#/mdp-store-sets/ideal">infinite store sets</a> it had many false dependences, and even with 2-bit counters it kept some false dependences plus about 1.75 violations per 1,000 instructions. That's a small rate, but each trap is expensive. Nearly all of these events came from a few loads with a <em>recurring pattern</em> of dependence. The loop comes from applu's routines blts and buts. In C, with the indices kept 1-based as in the original so they match the table below:</p>
<pre><code>for (int ip = 1; ip &lt;= 4; ip++) {
    double tmp1 = 1.0 / tmat[ip][ip];
    for (int m = ip + 1; m &lt;= 5; m++) {
        double tmp = tmp1 * tmat[m][ip];
        for (int l = ip + 1; l &lt;= 5; l++) {
            /* load A: tmat[ip][l], store B: tmat[m][l] */
            tmat[m][l] = tmat[m][l] - tmp * tmat[ip][l];
        }
    }
}</code></pre>
<p>The Fortran original, whose tmat(i,j) notation the table uses:</p>
<pre><code>do ip = 1, 4
  tmp1 = 1.0d+00 / tmat(ip,ip)
  do m = ip+1, 5
    tmp = tmp1 * tmat(m,ip)
    do l = ip+1, 5
      ! load A: tmat(ip,l), store B: tmat(m,l)
      tmat(m,l) = tmat(m,l) - tmp * tmat(ip,l)
    end do
  end do
end do</code></pre>
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
        q: `<p>What throughput does a histogram loop get with store sets, and what does it get after splitting the histogram four ways?</p><pre><code>/* original */
for (i = 0; i &lt; n; i++)
    hist[key[i]]++;

/* rewrite: 4 histograms, one per position in a 4-way unrolled loop */
for (i = 0; i + 3 &lt; n; i += 4) {
    h0[key[i]]++;
    h1[key[i + 1]]++;
    h2[key[i + 2]]++;
    h3[key[i + 3]]++;
}
for (b = 0; b &lt; 256; b++)
    hist[b] = h0[b] + h1[b] + h2[b] + h3[b];</code></pre><p>Given:</p><ul><li>Keys: random, spread evenly over 256 bins</li><li>Each update loads a bin, adds 1, and stores it</li><li>The first time a bin repeats in back-to-back updates of the same table, it causes a violation, and from then on that load and store share a store set</li><li>Load-to-use latency: 4 cycles</li><li>Add latency: 1 cycle</li><li>A store issues as soon as its data is ready, and a load that waits for a store issues the next cycle</li><li>Without memory waits, other limits allow 1 iteration/cycle (one key per iteration)</li><li>n is large</li></ul>`,
        a: `<ol class="steps"><li><strong>What store sets do to the original loop.</strong> Every instance of the load waits for the most recent in-flight instance of the store, which is the previous iteration's store, even though that store writes the same bin only about 1 time in 256.</li><li><strong>The chain per iteration.</strong> The load issues at cycle t, its value arrives 4 cycles later, the add finishes 1 cycle after that, the store issues as soon as the add finishes, and the next load issues 1 cycle after the store.<div class="math chain"><span>\\(\\displaystyle T_{\\text{iter}} = 4\\ \\text{cycles} + 1\\ \\text{cycle} + 1\\ \\text{cycle} \\)</span><span>\\(\\displaystyle = 6\\ \\text{cycles} \\)</span></div><div class="math chain"><span>\\(\\displaystyle X_{\\text{sets}} = \\frac{1\\ \\text{iteration}}{6\\ \\text{cycles}} \\)</span><span>\\(\\displaystyle \\approx \\frac{\\mathbf{0.167}\\ \\textbf{iterations}}{\\mathbf{1}\\ \\textbf{cycle}} \\)</span></div>With perfect prediction the loads wouldn't wait, so the loop would run at the 1 iteration/cycle limit.</li><li><strong>The rewrite.</strong> Each unrolled copy has its own load PC and store PC, and copy k only ever conflicts with copy k's store from one unrolled iteration (4 keys) earlier. Each copy's set holds only its own store, so there are 4 independent chains of 6 cycles each.<div class="math chain"><span>\\(\\displaystyle X_{4} = 4\\ \\text{chains} \\times \\frac{1\\ \\text{iteration}}{6\\ \\text{cycles}} \\)</span><span>\\(\\displaystyle \\approx \\frac{\\mathbf{0.667}\\ \\textbf{iterations}}{\\mathbf{1}\\ \\textbf{cycle}} \\)</span></div>That's 4× better, and still under the 1 iteration/cycle limit.</li><li><strong>The final sum.</strong> Summing the tables costs a fixed number of loads, small next to a large input.<div class="math chain"><span>\\(\\displaystyle N_{\\text{sum}} = 4\\ \\text{histograms} \\times \\frac{256\\ \\text{loads}}{1\\ \\text{histogram}} \\)</span><span>\\(\\displaystyle = 1{,}024\\ \\text{loads} \\)</span></div></li><li><strong>In practice.</strong> This is the compiler fix from the applu loop in software form, and production code uses it. zstd's histogram counting keeps 4 count tables for this reason.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>What steady-state throughput does this loop get on a core with a store set predictor, and what would perfect prediction give?</p><pre><code>for (i = 3; i &lt; n; i++)
    a[i] = a[i - 3] * k;</code></pre><p>Given:</p><ul><li>The store has already joined the load's store set</li><li>From a load's issue to the issue of a load waiting on the store it feeds: 9 cycles (load-to-use, multiply, and the store-to-load wakeup)</li><li>No other limit applies</li></ul>`,
        a: `<ol class="steps"><li><strong>True dependences.</strong> The load in iteration i reads a[i − 3], written by the store in iteration i − 3. So there are 3 independent chains: i ≡ 0, 1, 2 (mod 3).</li><li><strong>Perfect prediction.</strong> Each load waits only for the store 3 iterations back. The 3 chains overlap, each finishing one iteration every 9 cycles.<div class="math chain"><span>\\(\\displaystyle X_{\\text{perfect}} = 3\\ \\text{chains} \\times \\frac{1\\ \\text{iteration}}{9\\ \\text{cycles}} \\)</span><span>\\(\\displaystyle \\approx \\frac{\\mathbf{0.333}\\ \\textbf{iterations}}{\\mathbf{1}\\ \\textbf{cycle}} \\)</span></div></li><li><strong>Store sets.</strong> The load and store have one SSID, and a load waits for the <em>last fetched</em> store of its set, which is the store from iteration i − 1, not i − 3. Every iteration now waits for the previous one: load i waits for store i − 1, which waits for load i − 1's value. That's one chain.<div class="math chain"><span>\\(\\displaystyle X_{\\text{sets}} = \\frac{1\\ \\text{iteration}}{9\\ \\text{cycles}} \\)</span><span>\\(\\displaystyle \\approx \\frac{\\mathbf{0.111}\\ \\textbf{iterations}}{\\mathbf{1}\\ \\textbf{cycle}} \\)</span></div>That's 3× slower than perfect.</li><li><strong>What it shows.</strong> This is the applu failure: the predictor knows which PCs conflict but not which instances. Fixes are unrolling by 3 (each copy gets its own PCs and its own set) or a predictor that records dependence distance.</li></ol>`
      },
      {
        q: `<p>A colleague proposes adding a distance field to each store set: at a violation, record how many instances of the store PC lie between the conflicting store and the load, and later make the load wait only for the store instance that many back. For each loop below, does this fix the serialization store sets cause?</p><ol><li><code>for (i = 2; i &lt; n; i++) a[i] = a[i-2] + b[i];</code></li><li>A histogram over random keys: <code>hist[key[i]]++</code></li><li>applu's <code>tmat</code> loop</li></ol>`,
        a: `<ol><li><strong>Yes.</strong> The load in iteration i always reads the store from iteration i − 2, a fixed distance of 2 store instances. The predictor learns 2 at the first violation, and the two independent chains (even and odd i) overlap as with perfect prediction.</li><li><strong>No.</strong> The dependence depends on the key values, not on a distance. Whatever distance was recorded is usually wrong for the next repeat, so the actual repeats come at unpredictable distances and still violate, and each violation records a new distance. The waits aren't free either. A load that waits for the store d instances back splits the loop into d serialized chains. A short recorded distance (1 is a common one) throttles the loop the same way plain store sets do, until the next violation records a different one. Only a long distance makes the waits nearly free.</li><li><strong>Partly.</strong> The pattern is regular, but the distance between the conflicting instances changes with <code>ip</code> and <code>m</code>, since the inner loops shrink as <code>ip</code> grows. One distance per set fits one part of the nest and mispredicts the rest. A fix needs either several distances per pair or the compiler's full unroll, which gives each conflicting pair its own PCs.</li></ol><p>The general lesson: PC-only prediction fails on instance-specific dependences, and distance helps only when the distance is constant.</p>`
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
        q: `<p>A loop body holds three loads:</p><ul><li>L1 never reads anything an older in-flight store writes.</li><li>L2 reads the value that store S2, a few instructions earlier, writes on every iteration.</li><li>L3 reads a variable written by store S3a or store S3b, depending on a branch, a few instructions earlier.</li></ul><p>Walk through what each load does in steady state under no speculation, naive speculation, a wait bit per load, and store sets.</p><p class="given">Assume each load's address is ready before the address and data of the stores it reads from, and that the predictor clears its tables periodically.</p>`,
        a: `<ol class="steps"><li><strong>No speculation.</strong> All three loads wait for every older store. L2 and L3 wait correctly but also behind unrelated stores, and L1's waits are all false dependences.</li><li><strong>Naive speculation.</strong> All three loads issue as soon as their addresses are ready. L1 is always right. L2 and L3 violate on nearly every iteration, each time flushing the load and everything younger.</li><li><strong>Wait bit.</strong> L1's bit stays clear, so it runs freely. L2's and L3's bits get set after their first violations, so they stop violating but wait for every older store, the WAIT policy, which costs more as the window grows. Periodic clearing makes each relearn with one violation.</li><li><strong>Store sets.</strong> L1's set stays empty. L2's set is {S2}, so it waits only for S2. L3's set grows to {S3a, S3b} after one violation with each, and since the two stores share the set, L3 waits for whichever was fetched last, which is the one on the path actually taken.</li><li><strong>Summary.</strong> Store sets match perfect prediction on all three, using one violation per store-load pair to learn. Its remaining weakness is the one this loop doesn't have: a load that conflicts with only some instances of a store.</li></ol>`
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
