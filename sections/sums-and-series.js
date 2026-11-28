/* Section: Sums and series
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "mser").
   Bodies and practice use String.raw, so TeX takes single backslashes. */

section({
  id: "mser",
  name: "Sums and Series",
  cap: "Arithmetic and geometric series, harmonic numbers, telescoping sums",
  sections: [
    { id: "cheat", label: "Cheat Sheet" },
    { id: "pages-fit-together", label: "How the Pages Fit Together" }
  ],
  body: String.raw`
<p>Almost every cost model in architecture is a sum: cycles summed over instructions, latencies summed over requests, bits summed over table entries, work summed over loop iterations. Four shapes of sum cover nearly all of them. An <strong>arithmetic</strong> series adds a fixed step each term (request \(i\) waits \(i\) slots longer than request 0). A <strong>geometric</strong> series multiplies by a fixed ratio each term (each retry happens with the same probability, each table doubles in size). The <strong>harmonic</strong> series adds \(1/k\) (the chance that item \(k\) is new, or popular, or a record), and grows like a logarithm. A <strong>telescoping</strong> sum is any sum of differences, which collapses to the last value minus the first. Recognizing which shape a sum has turns a loop of terms into a closed form, and a closed form shows how the cost scales.</p>

<h3 id="sec-cheat">Cheat Sheet</h3>
<p>The results worth knowing cold. Each card links to where it is derived.</p>
<div class="cheat">
<a href="#/math-arith/pairing"><span class="nm">Sum of the First n Integers</span><span class="f">\(\displaystyle\sum_{k=0}^{n} k = \frac{n(n+1)}{2}\)</span></a>
<a href="#/math-arith/pairing"><span class="nm">Any Arithmetic Series</span><span class="f">\(S = (\text{count}) \times \dfrac{\text{first} + \text{last}}{2}\)</span></a>
<a href="#/math-arith/pairs"><span class="nm">Unordered Pairs of n Things</span><span class="f">\(\dbinom{n}{2} = \dfrac{n(n-1)}{2}\)</span></a>
<a href="#/math-arith/powers"><span class="nm">Sums of Powers, Leading Term</span><span class="f">\(\displaystyle\sum_{k=0}^{n} k^p \approx \frac{n^{p+1}}{p+1}\)</span></a>
<a href="#/math-geom/finite"><span class="nm">Finite Geometric Series</span><span class="f">\(\displaystyle\sum_{k=0}^{n-1} a r^k = a\,\frac{1 - r^n}{1 - r}\)</span></a>
<a href="#/math-geom/infinite"><span class="nm">Infinite Geometric Series</span><span class="f">\(\displaystyle\sum_{k=0}^{\infty} a r^k = \frac{a}{1 - r},\ |r| < 1\)</span></a>
<a href="#/math-geom/kxk"><span class="nm">Sum of k Times x to the k</span><span class="f">\(\displaystyle\sum_{k=0}^{\infty} k\,x^k = \frac{x}{(1 - x)^2}\)</span></a>
<a href="#/math-geom/expect"><span class="nm">Expected Tries Until Success</span><span class="f">\(E[\text{tries}] = \dfrac{1}{p}\)</span></a>
</div>

<h3 id="sec-pages-fit-together">How the Pages Fit Together</h3>
<ul>
<li><a href="#/math-arith">Arithmetic Series</a>: Gauss's pairing argument, the average term, counting pairs, sums of higher powers, and the quadratic costs they explain (age matrices, rename dependency checks, same-bank queues, triangular loops).</li>
<li><a href="#/math-geom">Geometric Series</a>: the finite and infinite sums by shift and subtract, why one term sets the scale, the sum of \(k\,x^k\), expected tries until success, and the retries, backoff, moving averages, and lookahead limits built on them.</li>
</ul>
`,
  practice: {
    guided: [
      {
        q: String.raw`<p>A TAGE-style branch predictor spaces the history lengths of its tagged tables geometrically. What is the common ratio, what history length does each table use, and how many history bits do the index hashes fold in total?</p><p>Given:</p><ul><li>Tagged tables: 12, named T0 to T11</li><li>Shortest history (T0): 4 branches</li><li>Longest history (T11): 640 branches</li><li>Geometric spacing: \(L_i = L_0\, \alpha^{i}\), rounded to the nearest whole branch when the predictor is built</li><li>Each table's index hash folds in its full history, 1 bit per branch, so the total is the sum of the lengths</li><li>\(\ln 160 \approx 5.0752\)</li></ul>`,
        a: String.raw`<ol class="steps"><li><strong>Find the ratio.</strong> T11 is T0 grown by the ratio 11 times, so the ratio is the 11th root of the length ratio. Take the root through a logarithm.<div class="math chain"><span>\(\displaystyle \alpha^{11} = \frac{640\ \text{branches}}{4\ \text{branches}} = 160 \)</span><span>\(\displaystyle \Rightarrow\ \alpha = e^{\ln 160 / 11} \)</span><span>\(\displaystyle = e^{5.0752/11} \)</span><span>\(\displaystyle \approx \mathbf{1.5863} \)</span></div></li><li><strong>List the lengths.</strong> Multiply by \(\alpha\) at each step and round. Before rounding the lengths are 4, 6.35, 10.06, 15.97, 25.33, 40.17, 63.72, 101.08, 160.35, 254.35, 403.46, and 640 branches. Rounded, T0 to T11 use <strong>4, 6, 10, 16, 25, 40, 64, 101, 160, 254, 403, and 640 branches</strong>. The lengths double about every 1.5 tables, since \(\ln 2 / \ln \alpha = 0.6931 / 0.4614 \approx 1.50\).</li><li><strong>Sum with the closed form.</strong> The unrounded lengths are a finite geometric series with first term 4 branches, ratio \(\alpha\), and 12 terms. Using \(\alpha^{12} = \alpha \times \alpha^{11} = 160\,\alpha\) keeps the given numbers in the formula.<div class="math chain"><span>\(\displaystyle \sum_{i=0}^{11} L_i = 4\ \text{branches} \times \frac{\alpha^{12} - 1}{\alpha - 1} \)</span><span>\(\displaystyle = \frac{640\ \text{branches} \times \alpha - 4\ \text{branches}}{\alpha - 1} \)</span><span>\(\displaystyle \approx \frac{1015.2\ \text{branches} - 4\ \text{branches}}{0.5863} \)</span><span>\(\displaystyle \approx \mathbf{1725}\ \textbf{bits} \)</span></div>Adding the 12 rounded lengths directly gives 1723 bits, so rounding moves the total by about 2 bits.</li><li><strong>Read the shape.</strong> Dropping the "−4 branches" leaves \(640 \times \alpha/(\alpha-1) \approx 640 \times 2.71\). The total is a fixed multiple of the longest history, however many short tables are added, and T9 to T11 alone hold \((254 + 403 + 640)/1723 \approx 75\%\) of the bits. That is the point of geometric spacing: each extra table extends the reach by a constant factor, and the short tables are nearly free.</li></ol>`
      }
    ],
    interview: [
      {
        q: String.raw`<p>A design-space exploration script simulates randomly drawn core configurations and logs each time the best IPC so far improves. How many improvements should it expect over the whole run, and how many in the second half of the run?</p><p>Given:</p><ul><li>Configurations simulated: 500, numbered 0 to 499 in the order they run</li><li>Each configuration is drawn independently from the same distribution</li><li>No two configurations give exactly the same IPC</li><li>Configuration 0 always counts as an improvement, since it sets the first best</li><li>The second half of the run is configurations 250 to 499</li><li>\(H_n = \sum_{k=1}^{n} 1/k \approx \ln n + \gamma + \tfrac{1}{2n}\), with \(\gamma \approx 0.5772\)</li><li>\(\ln 500 \approx 6.2146\) and \(\ln 2 \approx 0.6931\)</li></ul>`,
        a: String.raw`<ol class="steps"><li><strong>Chance that one configuration is an improvement.</strong> Configuration \(k\) improves the best exactly when it has the highest IPC among configurations 0 to \(k\). Those \(k + 1\) draws are independent and identically distributed with no ties, so each of them is equally likely to be the highest.<div class="math chain"><span>\(\displaystyle P(\text{configuration } k \text{ improves}) = \frac{1}{k+1} \)</span></div></li><li><strong>Expected count by linearity.</strong> The number of improvements is a sum of one indicator per configuration. The expectation of a sum is the sum of the expectations, whether or not the indicators are independent, so the answer is a harmonic number.<div class="math chain"><span>\(\displaystyle E[\text{improvements}] = \sum_{k=0}^{499} \frac{1}{k+1} \)</span><span>\(\displaystyle = H_{500} \)</span></div></li><li><strong>Approximate the harmonic number.</strong><div class="math chain"><span>\(\displaystyle H_{500} \approx \ln 500 + 0.5772 + \frac{1}{2 \times 500} \)</span><span>\(\displaystyle \approx 6.2146 + 0.5772 + 0.001 \)</span><span>\(\displaystyle \approx \mathbf{6.79}\ \textbf{improvements} \)</span></div></li><li><strong>The second half.</strong> Configurations 250 to 499 contribute the terms \(1/251\) to \(1/500\), which is \(H_{500} - H_{250}\). In the difference, \(\gamma\) cancels and the logs combine into \(\ln 2\).<div class="math chain"><span>\(\displaystyle H_{500} - H_{250} \approx \ln\frac{500}{250} + \frac{1}{1000} - \frac{1}{500} \)</span><span>\(\displaystyle \approx 0.6931 - 0.001 \)</span><span>\(\displaystyle \approx \mathbf{0.69}\ \textbf{improvements} \)</span></div></li><li><strong>What it means.</strong> Doubling the budget from 250 to 500 configurations buys less than one expected improvement, and the overall best lies in the first half with probability \(250/500 = 1/2\). Random search finds a new best at a rate of about \(1/k\), so its improvements grow only like \(\ln n\). That is the argument for guided search (Bayesian optimization or hill climbing) once a few hundred random points have been tried.</li></ol>`
      }
    ]
  }
}, [
{
  id: "math-arith",
  region: "mser",
  title: "Arithmetic Series",
  sections: [
    { id: "def", label: "What an Arithmetic Series Is" },
    { id: "pairing", label: "Gauss's Pairing Argument" },
    { id: "mean", label: "The Average Term" },
    { id: "pairs", label: "Counting Pairs" },
    { id: "powers", label: "Sums of Higher Powers" },
    { id: "uses", label: "Where It Shows Up" },
    { id: "traps", label: "Common Traps" }
  ],
  body: String.raw`
<p>An arithmetic series is what you get when each term is a fixed step larger than the one before. It is the sum behind every "the \(i\)-th one waits \(i\) slots" situation: requests queued at a single bank, µops checked against every older µop in the same group, rows of a triangular loop. Its closed form is quadratic in the number of terms, and that quadratic is why so many structures in a core get expensive as they get wider.</p>

<h3 id="sec-def">What an Arithmetic Series Is</h3>
<p>An <strong>arithmetic sequence</strong> starts at \(a\) and adds a common difference \(d\) each time. Counting the terms from 0, term \(k\) is \(a\) plus \(k\) steps.</p>
<div class="math chain"><span>\(\displaystyle a_k = a + k\,d, \quad k = 0, 1, \ldots, n-1 \)</span></div>
<p>The <strong>series</strong> is the sum of the first \(n\) terms. Splitting it into the constant part and the stepping part shows that everything reduces to one sum, \(0 + 1 + \cdots + (n-1)\).</p>
<div class="math chain"><span>\(\displaystyle S_n = \sum_{k=0}^{n-1} (a + k\,d) \)</span><span>\(\displaystyle = n\,a + d \sum_{k=0}^{n-1} k \)</span></div>
<p>The test for "arithmetic" is that consecutive differences are constant. The latencies 32, 80, 128, 176 ns are arithmetic (step 48 ns). The sizes 4, 8, 16, 32 KiB are not, since their ratio is constant instead, which makes them <a href=\"#/math-geom\">geometric</a>.</p>

<h3 id="sec-pairing">Gauss's Pairing Argument</h3>
<p>Write the sum \(0 + 1 + \cdots + n\) forward, and again backward underneath it. Each column then adds to \(n\), and there are \(n + 1\) columns. That counts the sum twice, so halve it.</p>
<div class="math chain"><span>\(\displaystyle 2\sum_{k=0}^{n} k = \sum_{k=0}^{n} \bigl(k + (n - k)\bigr) \)</span><span>\(\displaystyle = (n+1)\, n \)</span><span>\(\displaystyle \Rightarrow\ \sum_{k=0}^{n} k = \frac{n(n+1)}{2} \)</span></div>
<p>For \(n = 100\) that is \(100 \times 101 / 2 = 5050\). The picture is a staircase of unit squares, with column \(k\) of height \(k\). Two copies of the staircase fit together into an \(n\) by \(n+1\) rectangle, so one staircase is half of it. Stopping one term earlier, at \(n - 1\), gives the version that counts from 0 to \(n - 1\).</p>
<div class="math chain"><span>\(\displaystyle \sum_{k=0}^{n-1} k = \frac{(n-1)\,n}{2} \)</span></div>
<p>The same pairing works for any arithmetic series. Pair the first term with the last, the second with the second-to-last, and so on. Every pair has the same total, \(a_0 + a_{n-1}\), because one term goes up by \(d\) exactly as the other goes down by \(d\). With \(n\) terms there are \(n/2\) pairs (an odd count leaves a middle term equal to half a pair, so the formula still holds).</p>
<div class="math chain"><span>\(\displaystyle S_n = \frac{n}{2}\,\bigl(a_0 + a_{n-1}\bigr) \)</span><span>\(\displaystyle = n\,a + d\,\frac{n(n-1)}{2} \)</span></div>
<p>The first form needs only the count, the first term, and the last term. The second form comes from substituting \(a_{n-1} = a + (n-1)d\), and it separates the base cost \(n\,a\) from the growing part, which is quadratic in \(n\).</p>

<h3 id="sec-mean">The Average Term</h3>
<p>Divide the sum by the count. The average of an arithmetic sequence is the average of its first and last terms.</p>
<div class="math chain"><span>\(\displaystyle \bar a = \frac{S_n}{n} = \frac{a_0 + a_{n-1}}{2} \)</span><span>\(\displaystyle = a + \frac{(n-1)\,d}{2} \)</span></div>
<p>This is the fastest way to get the mean of anything that ramps linearly, with no need to add up the terms. If \(n\) requests reach a resource that serves one every \(d\) cycles, the \(k\)-th waits \(k\,d\) cycles. The average wait is \((n-1)\,d/2\), half the wait of the unlucky last one. Average latency grows linearly with the burst size, and total latency (the sum) grows quadratically.</p>
<p><strong>Average distance on a ring.</strong> Take a bidirectional ring with an even number of stops \(N\), where a message takes the shorter way around. From one stop, the distances to the \(N\) stops (itself included) are \(0, 1, \ldots, N/2 - 1\) one way, \(N/2\) to the opposite stop, and \(1, \ldots, N/2 - 1\) the other way. Two copies of an arithmetic series plus the middle term give the total.</p>
<div class="math chain"><span>\(\displaystyle \sum \text{distances} = 2 \cdot \frac{\left(\frac{N}{2} - 1\right)\frac{N}{2}}{2} + \frac{N}{2} \)</span><span>\(\displaystyle = \frac{N^2}{4} \)</span><span>\(\displaystyle \Rightarrow\ \text{average} = \frac{N}{4}\ \text{hops} \)</span></div>
<p>A 10-stop ring (say 8 core and cache slices plus 2 agents) averages 2.5 hops over uniformly chosen destinations, against 4.5 for a ring that only runs one way (\(\frac{1}{N}\sum_{k=0}^{N-1} k = (N-1)/2 = 4.5\) hops, counting the stop itself). The linear growth in \(N\) is why rings stop scaling past a dozen or so stops and meshes take over, where the average distance grows like \(\sqrt{N}\).</p>

<h3 id="sec-pairs">Counting Pairs</h3>
<p>How many unordered pairs can be formed from \(n\) things? Line them up. Item 0 pairs with no earlier item, item 1 with 1, item \(k\) with \(k\). Summing over items is the arithmetic series from 0 to \(n-1\).</p>
<div class="math chain"><span>\(\displaystyle \binom{n}{2} = \sum_{k=0}^{n-1} k \)</span><span>\(\displaystyle = \frac{n(n-1)}{2} \)</span></div>
<p>The other way to count gives the same answer: choose the first item in \(n\) ways and the second in \(n-1\) ways, then divide by 2 because each pair was counted in both orders. Any hardware that compares "every entry against every other entry" pays this count, and it grows as \(n^2/2\).</p>
<ul>
<li><strong>Age matrix.</strong> A scheduler that must find the oldest ready entry keeps one bit per pair of entries, saying which of the two is older. A 64-entry queue needs \(64 \times 63 / 2 = 2016\) bits (some designs store the full \(64 \times 64\) array for wiring regularity). Doubling the entries quadruples the bits.</li>
<li><strong>Rename dependency checks.</strong> In a rename group of width \(w\), µop \(k\) must compare each source register against the destinations of the \(k\) older µops in the same group, because those mappings are not in the table yet. One source needs \(0 + 1 + \cdots + (w-1) = w(w-1)/2\) comparators. An 8-wide rename with 2 sources per µop needs \(2 \times 28 = 56\) comparators and a priority chain to pick the youngest match. A 4-wide rename needs only \(2 \times 6 = 12\). That quadratic, plus the serial priority logic, is a main reason rename width grows slowly.</li>
<li><strong>Store-to-load ordering.</strong> A load checks all older stores in the store queue, and the memory disambiguation logic must order every load against every older store. In a window of loads and stores, the number of potential load-store orderings grows with the product of their counts, which is why real designs predict dependences (store sets) instead of checking them all.</li>
</ul>

<h3 id="sec-powers">Sums of Higher Powers</h3>
<p>Nested loops over a triangle produce sums of squares, and three-deep nests produce sums of cubes. The exact results are polynomials of one degree higher (the Telescoping Sums page derives them).</p>
<div class="math chain"><span>\(\displaystyle \sum_{k=0}^{n} k^2 = \frac{n(n+1)(2n+1)}{6} \)</span></div>
<div class="math chain"><span>\(\displaystyle \sum_{k=0}^{n} k^3 = \left(\frac{n(n+1)}{2}\right)^2 \)</span></div>
<p>For estimates, only the leading term matters, and it comes from comparing the sum with an area. The sum \(\sum k^p\) is a staircase of columns of height \(k^p\) and width 1. The staircase hugs the curve \(x^p\), so it is close to the area under that curve.</p>
<div class="math chain"><span>\(\displaystyle \sum_{k=0}^{n} k^p \approx \int_0^n x^p\, dx \)</span><span>\(\displaystyle = \frac{n^{p+1}}{p+1} \)</span></div>
<p>The error is of order \(n^p\), smaller by a factor of \(n\). For \(p = 1\) this gives \(n^2/2\), matching \(n(n+1)/2\) to leading order. For \(p = 2\) it gives \(n^3/3\). That is where the classic flop counts come from. LU factorization of an \(n \times n\) matrix updates an \((n-k-1) \times (n-k-1)\) trailing block at step \(k\), so its multiply-adds are \(\sum (n-k-1)^2 \approx n^3/3\), and with a multiply and an add each, \(\tfrac{2}{3}n^3\) flops. Without the integral it is easy to guess \(n^3\) and be off by a factor of 3.</p>

<h3 id="sec-uses">Where It Shows Up</h3>
<ul>
<li><strong>Bank and port conflicts.</strong> When a burst of \(n\) requests lands on one resource with a fixed service interval, latencies form an arithmetic sequence. The average is first plus last over two, so the conflict penalty grows linearly with the burst. This is how same-bank DRAM requests (one activate per \(t_{RC}\)) and same-bank L1 accesses (one per cycle per bank) behave.</li>
<li><strong>Quadratic structures.</strong> Age matrices, rename and wakeup comparators, and all-to-all crossbars cost \(\approx n^2/2\) in the number of entries or ports. Wakeup is the same shape: each of \(w\) result tags is broadcast to every scheduler entry's source comparators, so cost goes as entries times width.</li>
<li><strong>Network distance.</strong> The average hop count of a ring is an arithmetic mean, \(N/4\) for a bidirectional ring, so average latency grows linearly with the stop count.</li>
<li><strong>Triangular work.</strong> Symmetric matrices, pairwise distances, all-pairs comparisons, and LU or Cholesky factorizations do \(\sum k\) or \(\sum k^2\) work. Splitting the rows evenly across threads does not split the work evenly. The last quarter of the rows of a triangle holds \(7/16\) of the area.</li>
<li><strong>Pipelined ramps.</strong> Anything that adds one more active unit per cycle (a systolic array filling with a diagonal wavefront) accumulates idle unit-cycles as a triangular number, about \(n^2/2\) for an \(n\)-cycle ramp.</li>
</ul>

<h3 id="sec-traps">Common Traps</h3>
<ul>
<li><strong>Fenceposts.</strong> The values from \(a\) to \(b\) in steps of \(d\) number \((b - a)/d + 1\), not \((b - a)/d\). From 0 to \(n - 1\) there are \(n\) terms.</li>
<li>\(\sum_{k=0}^{n} k = n(n+1)/2\) but \(\sum_{k=0}^{n-1} k = n(n-1)/2\). Check a tiny case (\(n = 2\): \(0 + 1 + 2 = 3\) against \(0 + 1 = 1\)).</li>
<li><strong>Ordered or unordered.</strong> \(n(n-1)/2\) counts unordered pairs. Ordered pairs (a comparison in each direction, a link in each direction) are \(n(n-1)\). Including an item paired with itself adds \(n\) more.</li>
<li><strong>"Half the work" is not "half the rows."</strong> In triangular work, the first half of the rows does a quarter of the work.</li>
<li>The leading-term estimate \(n^{p+1}/(p+1)\) is poor for small \(n\). For \(n = 4\), \(\sum k^2 = 30\) while \(4^3/3 \approx 21\).</li>
</ul>
`,
  practice: {
    guided: [
      {
        q: String.raw`<p>Eight reads to different rows of the same DDR5 bank arrive together. What is their average latency, and how does it compare with spreading them over eight banks?</p><p>Given:</p><ul><li>Requests: 8 reads to one bank, each to a different row, so each needs its own activate</li><li>The bank can activate a new row only every \(t_{RC} = 48\ \text{ns}\), so read \(i\) (\(i = 0\) to 7) activates \(i \times 48\ \text{ns}\) after the reads arrive</li><li>Each read's data returns 32 ns after its activate (\(t_{RCD} + \text{CL}\))</li><li>Spread case: the 8 reads go to 8 idle banks and all activate at once</li><li>Ignore the activate spacing limits between banks (\(t_{RRD}\) and \(t_{FAW}\)), refresh, and data-bus contention</li></ul>`,
        a: String.raw`<ol class="steps"><li><strong>Latency of each read.</strong> Read \(i\) waits \(i\) activate slots and then the access time, so the latencies form an arithmetic sequence with first term 32 ns and step 48 ns.<div class="math chain"><span>\(\displaystyle L_i = 32\ \text{ns} + i \times 48\ \text{ns} \)</span></div></li><li><strong>The last read.</strong> Read 7 is the last of the 8.<div class="math chain"><span>\(\displaystyle L_7 = 32\ \text{ns} + 7 \times 48\ \text{ns} \)</span><span>\(\displaystyle = 368\ \text{ns} \)</span></div></li><li><strong>Average from first and last.</strong> The mean of an arithmetic sequence is the mean of its first and last terms.<div class="math chain"><span>\(\displaystyle \bar L = \frac{32\ \text{ns} + 368\ \text{ns}}{2} \)</span><span>\(\displaystyle = \mathbf{200}\ \textbf{ns} \)</span></div></li><li><strong>Check with the sum.</strong> Add the base latency of all 8 reads and the waiting part, \(48\ \text{ns} \times (0 + 1 + \cdots + 7)\), then divide by 8.<div class="math chain"><span>\(\displaystyle \bar L = \frac{8 \times 32\ \text{ns} + 48\ \text{ns} \times \frac{7 \times 8}{2}}{8} \)</span><span>\(\displaystyle = \frac{256\ \text{ns} + 1344\ \text{ns}}{8} \)</span><span>\(\displaystyle = 200\ \text{ns} \)</span></div></li><li><strong>Compare with 8 banks.</strong> Spread over idle banks, every read sees only the access time, 32 ns. The conflict makes the average \(200\ \text{ns} / 32\ \text{ns} = 6.25\) times worse, and the last read 11.5 times worse. In general the average is \(32\ \text{ns} + 48\ \text{ns} \times (n-1)/2\), linear in the number of conflicting reads, which is why memory controllers hash addresses across banks and reorder requests to open rows.</li></ol>`
      }
    ],
    interview: [
      {
        q: String.raw`<p>A pairwise-distance kernel fills the lower triangle of a symmetric matrix, diagonal included, and splits the rows across 4 threads by giving each a contiguous quarter. What speedup does that give, and how should the rows be divided instead?</p><p>Given:</p><ul><li>Points: \(n = 4096\), so the rows are \(i = 0\) to 4095</li><li>Row \(i\) computes entries \(j = 0\) to \(i\), which is \(i + 1\) distances</li><li>4 threads on 4 equally fast cores, and every distance takes the same time</li><li>Static split: thread \(t\) (\(t = 0\) to 3) gets rows \(1024\,t\) to \(1024\,t + 1023\)</li><li>Speedup is measured against 1 thread doing every row</li><li>Ignore memory effects and thread start-up</li></ul>`,
        a: String.raw`<ol class="steps"><li><strong>Total work.</strong> Row \(i\) does \(i + 1\) distances, so the total is \(1 + 2 + \cdots + 4096\).<div class="math chain"><span>\(\displaystyle W = \sum_{i=0}^{4095} (i + 1) \)</span><span>\(\displaystyle = \frac{4096 \times 4097}{2}\ \text{distances} \)</span><span>\(\displaystyle = 8{,}390{,}656\ \text{distances} \)</span></div></li><li><strong>Work of a block of rows.</strong> Rows \(a\) to \(b - 1\) do the distances of the first \(b\) rows minus those of the first \(a\) rows, a difference of two triangular numbers.<div class="math chain"><span>\(\displaystyle W(a, b) = \sum_{i=a}^{b-1} (i+1) \)</span><span>\(\displaystyle = \frac{b(b+1) - a(a+1)}{2} \)</span></div></li><li><strong>The slowest thread.</strong> Thread 3 has the longest rows, 3072 to 4095.<div class="math chain"><span>\(\displaystyle W(3072, 4096) = W(0, 4096) - W(0, 3072) \)</span><span>\(\displaystyle = \frac{4096 \times 4097}{2} - \frac{3072 \times 3073}{2} \)</span><span>\(\displaystyle = 8{,}390{,}656\ \text{distances} - 4{,}720{,}128\ \text{distances} \)</span><span>\(\displaystyle = 3{,}670{,}528\ \text{distances} \)</span></div>That is about 43.7% of the total. Thread 0 does only \(1024 \times 1025 / 2 = 524{,}800\) distances (6.25%). The four shares are close to 1 : 3 : 5 : 7 out of 16, because the area of a triangle grows as the square of its height and consecutive squares differ by odd numbers.</li><li><strong>Speedup.</strong> The run ends when the slowest thread does, so the speedup is the total work over thread 3's work.<div class="math chain"><span>\(\displaystyle \text{speedup} = \frac{8{,}390{,}656\ \text{distances}}{3{,}670{,}528\ \text{distances}} \)</span><span>\(\displaystyle \approx \mathbf{2.29} \)</span></div></li><li><strong>Fix 1: balanced boundaries.</strong> Choose boundary \(b_t\) so the first \(b_t\) rows hold \(t/4\) of the work. Solve \(b(b+1)/2 = t\,W/4\) with the quadratic formula and round.<div class="math chain"><span>\(\displaystyle b_t = \frac{-1 + \sqrt{1 + 8 \times t \times 8{,}390{,}656 / 4}}{2} \)</span><span>\(\displaystyle \approx 2047.8,\ 2896.2,\ 3547.2 \)</span></div>Rows 0 to 2047, 2048 to 2895, 2896 to 3546, and 3547 to 4095 hold 2,098,176, 2,096,680, 2,097,522, and 2,098,278 distances. The speedup becomes \(8{,}390{,}656 / 2{,}098{,}278 \approx \mathbf{4.00}\). The boundaries sit near \(4096 \times \sqrt{t/4}\), so the first thread gets half the rows.</li><li><strong>Fix 2: Gauss's pairing.</strong> Pair row \(i\) with row \(4095 - i\). Each pair does \((i + 1) + (4096 - i) = 4097\) distances, the same for every pair. Give each thread 512 pairs and every thread does exactly \(512 \times 4097 = 2{,}097{,}664\) distances, with no square roots. Interleaving rows round-robin (thread \(t\) takes rows \(t, t+4, t+8, \ldots\)) also comes close: thread 3 does \(3 	imes 1024 = 3072\) more distances than thread 0, about 0.15% of a thread's share. It is often preferred because each thread's rows are spread across the matrix, which evens out cache behavior as well.</li></ol>`
      }
    ]
  }
},
{
  id: "math-geom",
  region: "mser",
  title: "Geometric Series",
  sections: [
    { id: "def", label: "What a Geometric Series Is" },
    { id: "finite", label: "The Finite Sum" },
    { id: "infinite", label: "The Infinite Sum" },
    { id: "kxk", label: "The Sum of k Times x to the k" },
    { id: "expect", label: "Expected Number of Tries" },
    { id: "uses", label: "Where It Shows Up" },
    { id: "traps", label: "Common Traps" }
  ],
  body: String.raw`
<p>A geometric series multiplies by a fixed ratio from one term to the next. It is the sum behind anything that doubles (table sizes, backoff delays, history lengths) and anything that keeps a fixed share at each step (the chance that a retry fails again, the weight an average gives to older samples). When the ratio is below 1 the terms shrink so fast that the whole infinite sum is a small multiple of the first term. When it is above 1 the last term dominates. Either way, one term sets the scale, and that is what makes geometric sums so easy to estimate.</p>

<h3 id="sec-def">What a Geometric Series Is</h3>
<p>A <strong>geometric sequence</strong> starts at \(a\) and multiplies by a common ratio \(r\) each time, so term \(k\) is \(a\) times \(r\) to the \(k\).</p>
<div class="math chain"><span>\(\displaystyle a_k = a\, r^{k}, \quad k = 0, 1, 2, \ldots \)</span></div>
<p>The test is that consecutive <em>ratios</em> are constant, where an arithmetic sequence has constant differences. Cache sizes 32, 64, 128 KiB have ratio 2. Survival probabilities 1, 0.9, 0.81, 0.729 have ratio 0.9. A quantity that grows by a fixed percentage per step is geometric, which is why compounding (<a href="#/math-exp/compounding">Where e Comes From</a>) and geometric series are two views of the same thing: \(r^k = e^{k \ln r}\).</p>

<h3 id="sec-finite">The Finite Sum</h3>
<p><strong>Shift and subtract.</strong> Write the sum of the first \(n\) terms, multiply it by \(r\), and subtract. Multiplying by \(r\) shifts every term one place along, so all but the first and last cancel.</p>
<div class="math chain"><span>\(\displaystyle S_n = a + a r + a r^2 + \cdots + a r^{n-1} \)</span></div>
<div class="math chain"><span>\(\displaystyle r\,S_n = a r + a r^2 + \cdots + a r^{n-1} + a r^{n} \)</span></div>
<div class="math chain"><span>\(\displaystyle S_n - r\,S_n = a - a r^{n} \)</span><span>\(\displaystyle \Rightarrow\ S_n = a\,\frac{1 - r^{n}}{1 - r} \quad (r \ne 1) \)</span></div>
<p>For \(r > 1\) it reads more naturally as \(a\,(r^n - 1)/(r - 1)\). At \(r = 1\) every term equals \(a\) and the sum is simply \(n\,a\).</p>
<p><strong>Powers of two.</strong> With \(a = 1\) and \(r = 2\), the sum is one less than the next power.</p>
<div class="math chain"><span>\(\displaystyle \sum_{k=0}^{n-1} 2^k = \frac{2^{n} - 1}{2 - 1} \)</span><span>\(\displaystyle = 2^{n} - 1 \)</span></div>
<p>In binary this is obvious: \(n\) ones in a row are one less than a 1 followed by \(n\) zeros. It also says that each power of two is larger than all the smaller ones combined, which is the fact behind several hardware results.</p>
<ul>
<li>A complete binary tree with levels 0 to \(d\) has \(2^{d+1} - 1\) nodes, so the leaves (\(2^d\)) are just over half of them. A tree-PLRU over \(W\) ways has \(W - 1\) internal bits for the same reason.</li>
<li>A dynamic array that doubles its capacity copies \(2^k\) elements when it grows from capacity \(2^k\). By the time it holds \(n\) elements, the last copy moved fewer than \(n\) elements, and all the earlier copies together moved fewer than that again. The total is under \(2n\) copies, a constant per insert.</li>
</ul>
<p><strong>Large ratios: the last term dominates.</strong> For \(r > 1\), divide the sum by its last term \(a r^{n-1}\). What is left is a geometric series in \(1/r\), so the whole sum is less than \(r/(r-1)\) times the last term.</p>
<div class="math chain"><span>\(\displaystyle \frac{S_n}{a\,r^{n-1}} = 1 + \frac{1}{r} + \cdots + \frac{1}{r^{n-1}} \)</span><span>\(\displaystyle < \frac{r}{r - 1} \)</span></div>
<p>A radix tree with fan-out 512 (an x86-64 page table) shows how strong this is. To map \(N\) pages, the leaf level needs \(N/512\) tables, the next level \(N/512^2\), and so on. Ignoring that each level needs at least one table, the total is less than \(512/511\) times the leaf tables, so for a large mapping the upper levels add only about 0.2%. For a small one the minimum of one table per level shows: mapping 1 GiB with 4 KiB pages needs 262,144 entries in 512 leaf tables plus 3 upper tables (one per level), 515 in all.</p>

<h3 id="sec-infinite">The Infinite Sum</h3>
<p>If \(|r| < 1\), the term \(r^n\) in the finite sum shrinks to 0 as \(n\) grows, so the partial sums settle on a limit.</p>
<div class="math chain"><span>\(\displaystyle \sum_{k=0}^{\infty} a\, r^{k} = \lim_{n\to\infty} a\,\frac{1 - r^{n}}{1 - r} \)</span><span>\(\displaystyle = \frac{a}{1 - r} \quad (|r| < 1) \)</span></div>
<p>If \(|r| \ge 1\) the terms do not shrink and the sum has no finite value. The <strong>tail</strong> after the first \(n\) terms is the same series started at \(a r^n\), so it equals \(a r^n/(1-r)\). That gives the error of stopping early, and it says the first term sets the scale: with \(r = 1/2\), the first term is already half the total, and every further term closes half the remaining gap.</p>
<div class="math chain"><span>\(\displaystyle \sum_{k=n}^{\infty} a\, r^{k} = \frac{a\, r^{n}}{1 - r} \)</span></div>
<p><strong>Why the formula is believable.</strong> Read \(1/(1-r)\) as "a unit of work that creates \(r\) more units of work, each of which creates \(r\) more." The total multiplies the first unit by \(1/(1-r)\). That is the shape of every feedback loop with gain below 1: a request that is retried with probability \(r\), a miss whose handling causes another miss with probability \(r\), an interrupt handler that re-interrupts. Gain 0.5 doubles the base load, and gain 0.9 multiplies it by 10. As the gain approaches 1 the total blows up, which is the series' version of instability.</p>
<p><strong>Branch prediction and the window.</strong> If each branch is mispredicted independently with probability \(m\), the chance that fetch is still on the correct path \(k\) branches past the oldest one is \((1-m)^k\). The expected number of correct-path branches among the \(K\) a window holds is a finite geometric sum. With \(m = 3\%\) and a 40-branch window, it is \((1 - 0.97^{40})/0.03 \approx 23.5\) branches, and no window size can push it past \(1/m \approx 33\). This is the limit on lookahead that Hennessy and Patterson's ILP limit studies keep running into: a bigger window helps only as far as the predictor lets fetch stay on the right path.</p>
<div class="math chain"><span>\(\displaystyle \sum_{k=0}^{K-1} (1-m)^{k} = \frac{1 - (1-m)^{K}}{m} \)</span><span>\(\displaystyle < \frac{1}{m} \)</span></div>

<h3 id="sec-kxk">The Sum of k Times x to the k</h3>
<p>Weighting each term by its position gives the sum that every expected count needs. Shift and subtract works again. Subtracting \(x\,S\) from \(S\) lines up terms with the same power, and each pair differs by exactly one copy of \(x^k\).</p>
<div class="math chain"><span>\(\displaystyle S = 0 + x + 2x^2 + 3x^3 + \cdots \)</span></div>
<div class="math chain"><span>\(\displaystyle x\,S = x^2 + 2x^3 + 3x^4 + \cdots \)</span></div>
<div class="math chain"><span>\(\displaystyle S - x\,S = x + x^2 + x^3 + \cdots \)</span><span>\(\displaystyle = \frac{x}{1 - x} \)</span><span>\(\displaystyle \Rightarrow\ \sum_{k=0}^{\infty} k\,x^{k} = \frac{x}{(1 - x)^2} \quad (|x| < 1) \)</span></div>
<p><strong>Second derivation: differentiate.</strong> A power series can be differentiated term by term inside the region where it converges. Differentiating \(\sum x^k = 1/(1-x)\) brings down each exponent, and multiplying by \(x\) restores the powers.</p>
<div class="math chain"><span>\(\displaystyle \frac{d}{dx}\sum_{k=0}^{\infty} x^{k} = \sum_{k=0}^{\infty} k\, x^{k-1} \)</span><span>\(\displaystyle = \frac{1}{(1-x)^2} \)</span></div>
<p>Applying the same trick again gives the sum needed for variances: \(\sum k^2 x^k = x(1+x)/(1-x)^3\). The finite version, useful when a retry count is capped at \(n\), comes from shift-and-subtract on the finite sums.</p>
<div class="math chain"><span>\(\displaystyle \sum_{k=0}^{n} k\, x^{k} = \frac{x - (n+1)\,x^{n+1} + n\,x^{n+2}}{(1-x)^2} \)</span></div>

<h3 id="sec-expect">Expected Number of Tries</h3>
<p>Repeat an attempt that succeeds with probability \(p\), independently each time, until it succeeds. Let \(F\) be the number of failures before the success. Failing exactly \(k\) times means \(k\) failures and then one success.</p>
<div class="math chain"><span>\(\displaystyle P(F = k) = (1-p)^{k}\, p, \quad k = 0, 1, 2, \ldots \)</span></div>
<p>The expected number of failures is the \(k\,x^k\) sum with \(x = 1 - p\). The total number of tries is one more than that.</p>
<div class="math chain"><span>\(\displaystyle E[F] = p \sum_{k=0}^{\infty} k\,(1-p)^{k} \)</span><span>\(\displaystyle = p\,\frac{1-p}{p^{2}} \)</span><span>\(\displaystyle = \frac{1-p}{p} \)</span></div>
<div class="math chain"><span>\(\displaystyle E[\text{tries}] = 1 + \frac{1-p}{p} \)</span><span>\(\displaystyle = \frac{1}{p} \)</span></div>
<p>The answer \(1/p\) is the intuitive one: an event with a 1-in-20 chance takes 20 tries on average. A second derivation avoids the \(k\,x^k\) sum. A count that takes values 0, 1, 2, ... has an expectation equal to the sum of the chances that it exceeds each value. "More than \(k\) tries" means the first \(k\) all failed, which gives a plain geometric series.</p>
<div class="math chain"><span>\(\displaystyle E[\text{tries}] = \sum_{k=0}^{\infty} P(\text{tries} > k) \)</span><span>\(\displaystyle = \sum_{k=0}^{\infty} (1-p)^{k} \)</span><span>\(\displaystyle = \frac{1}{p} \)</span></div>
<p>This is the geometric distribution, and the probability region develops it fully (its memorylessness, its variance \((1-p)/p^2\), and its continuous cousin, the exponential distribution).</p>

<h3 id="sec-uses">Where It Shows Up</h3>
<ul>
<li><strong>Retries and replays.</strong> Transactional memory aborts, load replays after a mis-speculated wakeup, NoC retries, and ECC re-reads all repeat until they succeed. Expected attempts are \(1/p\), and expected wasted work is the failure cost times \((1-p)/p\).</li>
<li><strong>Exponential backoff.</strong> Spinning threads double their wait after each failed attempt to take a lock. The expected total wait is a geometric series whose ratio is 2 times the failure probability, so it is finite only when attempts fail less than half the time. Real schemes cap the wait for exactly this reason (the interview problem below works it out).</li>
<li><strong>Geometric history lengths.</strong> TAGE predictors space their history lengths by a constant ratio, so a dozen tables cover histories from a few branches to hundreds, and the total history bits are a fixed multiple of the longest one.</li>
<li><strong>Moving averages.</strong> An exponentially weighted moving average, \(y \leftarrow (1-\alpha)\,y + \alpha\,x\), gives the sample \(k\) steps old the weight \(\alpha(1-\alpha)^k\). The weights sum to \(\alpha/(1 - (1-\alpha)) = 1\), and the mean age of the data is \(\sum k\,\alpha(1-\alpha)^k = (1-\alpha)/\alpha\) samples. Hardware likes \(\alpha = 1/16\) because the update is a shift and a subtract. That filter's data is 15 samples old on average, and the newest \(\ln 2 / \ln(16/15) \approx 10.7\) samples carry half the weight. Power controllers, bandwidth monitors, and adaptive prefetch throttles use filters like this.</li>
<li><strong>Doubling structures.</strong> Dynamic arrays, hash tables that resize, and radix trees all lean on "the last term dominates." Total work or storage is a constant multiple of the largest level.</li>
<li><strong>Lookahead limits.</strong> The expected correct-path depth of a window is a capped geometric sum, bounded by \(1/m\) for misprediction rate \(m\).</li>
</ul>

<h3 id="sec-traps">Common Traps</h3>
<ul>
<li>\(a/(1-r)\) needs \(|r| < 1\). At \(r = 1\) the finite sum is \(n\,a\), and for \(|r| \ge 1\) the infinite sum diverges. Check the ratio before using the formula.</li>
<li><strong>Count the terms.</strong> \(\sum_{k=0}^{n-1} r^k\) has \(n\) terms and the numerator is \(1 - r^n\). Starting at \(k = 1\) multiplies the sum by \(r\).</li>
<li><strong>Tries or failures.</strong> \(1/p\) counts tries including the success. Failures before the success are \((1-p)/p\). Mixing them up is off by exactly 1.</li>
<li>\(\sum k\,x^k = x/(1-x)^2\), while \(\sum k\,x^{k-1} = 1/(1-x)^2\). They differ by a factor of \(x\), which matters when \(x\) is not close to 1.</li>
<li><strong>Independence.</strong> \(1/p\) assumes each try succeeds with the same \(p\) regardless of history. A transaction that aborts because of a conflicting thread will often abort again for the same reason, so the real tail is heavier.</li>
<li>A finite mean is not a small tail. Even with a finite expected wait, rare streaks can be long, which is why designs cap retries and fall back to a slow but sure path.</li>
</ul>
`,
  practice: {
    guided: [
      {
        q: String.raw`<p>A transactional region (Intel RTM) is retried until it commits. What are the expected number of attempts, the expected cycles per commit, and the chance that it needs more than 3 attempts?</p><p>Given:</p><ul><li>Each attempt aborts with probability 0.15, independently of earlier attempts</li><li>A committed attempt takes 1200 cycles</li><li>An aborted attempt wastes 600 cycles on average before the abort is detected and rolled back</li><li>The code retries until it commits, with no fallback lock</li></ul>`,
        a: String.raw`<ol class="steps"><li><strong>Model the aborts.</strong> Let \(A\) be the number of aborts before the commit. Exactly \(k\) aborts means \(k\) aborted attempts followed by one that commits, so \(A\) has a geometric distribution.<div class="math chain"><span>\(\displaystyle P(A = k) = 0.15^{k} \times (1 - 0.15) \)</span></div></li><li><strong>Expected aborts.</strong> The expectation is the \(k\,x^k\) sum with \(x = 0.15\), times the commit probability.<div class="math chain"><span>\(\displaystyle E[A] = (1 - 0.15) \sum_{k=0}^{\infty} k \times 0.15^{k} \)</span><span>\(\displaystyle = (1 - 0.15) \times \frac{0.15}{(1 - 0.15)^2} \)</span><span>\(\displaystyle = \frac{0.15}{0.85}\ \text{aborts} \)</span><span>\(\displaystyle \approx 0.176\ \text{aborts} \)</span></div></li><li><strong>Expected attempts.</strong> Every run has the aborted attempts plus the one that commits.<div class="math chain"><span>\(\displaystyle E[\text{attempts}] = 1 + \frac{0.15}{0.85} \)</span><span>\(\displaystyle = \frac{1}{0.85} \)</span><span>\(\displaystyle \approx \mathbf{1.18}\ \textbf{attempts} \)</span></div></li><li><strong>Expected cycles per commit.</strong> The committing attempt always costs 1200 cycles, and each abort adds 600 cycles on average. By linearity, the wasted cycles are the expected abort count times the cost per abort.<div class="math chain"><span>\(\displaystyle E[\text{wasted}] = \frac{600\ \text{cycles}}{1\ \text{abort}} \times \frac{0.15}{0.85}\ \text{aborts} \)</span></div><div class="math chain"><span>\(\displaystyle E[\text{cycles}] = 1200\ \text{cycles} + E[\text{wasted}] \)</span><span>\(\displaystyle = 1200\ \text{cycles} + \frac{600 \times 0.15}{0.85}\ \text{cycles} \)</span><span>\(\displaystyle \approx \mathbf{1306}\ \textbf{cycles} \)</span></div>Aborts add about 8.8% to the cost of the region.</li><li><strong>More than 3 attempts.</strong> That happens exactly when the first 3 attempts all abort.<div class="math chain"><span>\(\displaystyle P(\text{attempts} > 3) = 0.15^{3} \)</span><span>\(\displaystyle = \mathbf{0.003375} \)</span></div>About 1 commit in 296 needs a fourth try. Real RTM code usually falls back to a lock after a few aborts, because aborts caused by conflicts or capacity are not independent: a region that overflowed the L1D once will overflow again.</li></ol>`
      }
    ],
    interview: [
      {
        q: String.raw`<p>Threads contending for a lock use capped exponential backoff between attempts. What is the expected total backoff time before a thread gets the lock, and what would happen without the cap?</p><p>Given:</p><ul><li>Each attempt (an atomic exchange on the lock's cache line) succeeds with probability 0.4, independently of other attempts</li><li>Failures are numbered \(j = 0, 1, 2, \ldots\) in order, and after failure \(j\) the thread waits \(64 \times 2^{j}\) cycles before its next attempt</li><li>The wait is capped at 4096 cycles, which is first reached after failure 6</li><li>Count only the backoff waits, not the time spent in the attempts themselves</li></ul>`,
        a: String.raw`<ol class="steps"><li><strong>When does each wait happen?</strong> The wait after failure \(j\) happens only if the first \(j + 1\) attempts all fail, which has probability \(0.6^{j+1}\) with failure probability \(1 - 0.4 = 0.6\). By linearity, the expected total wait is the sum of each wait times the chance it happens.<div class="math chain"><span>\(\displaystyle E[\text{wait}] = \sum_{j=0}^{\infty} 0.6^{j+1} \times w_j \)</span></div></li><li><strong>The doubling part, failures 0 to 6.</strong> Here \(w_j = 64 \times 2^j\) cycles. The factors combine into a geometric series with ratio \(2 \times 0.6 = 1.2\) and 7 terms.<div class="math chain"><span>\(\displaystyle W_{\text{double}} = \sum_{j=0}^{6} 0.6^{j+1} \times 64 \times 2^{j}\ \text{cycles} \)</span><span>\(\displaystyle = 64\ \text{cycles} \times 0.6 \times \sum_{j=0}^{6} 1.2^{j} \)</span><span>\(\displaystyle = 38.4\ \text{cycles} \times \frac{1.2^{7} - 1}{1.2 - 1} \)</span><span>\(\displaystyle \approx 38.4\ \text{cycles} \times 12.916 \)</span><span>\(\displaystyle \approx 496.0\ \text{cycles} \)</span></div></li><li><strong>The capped part, failures 7 and up.</strong> Here every wait is 4096 cycles, and the probabilities form an infinite geometric series with ratio 0.6 that starts at \(0.6^{8}\).<div class="math chain"><span>\(\displaystyle W_{\text{cap}} = \sum_{j=7}^{\infty} 0.6^{j+1} \times 4096\ \text{cycles} \)</span><span>\(\displaystyle = 4096\ \text{cycles} \times \frac{0.6^{8}}{1 - 0.6} \)</span><span>\(\displaystyle \approx 172.0\ \text{cycles} \)</span></div></li><li><strong>Total.</strong><div class="math chain"><span>\(\displaystyle E[\text{wait}] = W_{\text{double}} + W_{\text{cap}} \)</span><span>\(\displaystyle \approx 496.0\ \text{cycles} + 172.0\ \text{cycles} \)</span><span>\(\displaystyle \approx \mathbf{668}\ \textbf{cycles} \)</span></div>The expected number of attempts is \(1/0.4 = 2.5\), so a thread also sends about 2.5 requests for ownership of the lock line per acquisition.</li><li><strong>Without the cap.</strong> Every term would be \(38.4\ \text{cycles} \times 1.2^{j}\), a geometric series with ratio 1.2. The terms grow, so the sum diverges and the <strong>expected wait is infinite</strong>, even though the expected number of attempts is still only 2.5. Long failure streaks are rare, but each extra failure doubles the wait while making the streak only 0.6 times as likely, so the rare streaks dominate. Doubling backoff has a finite mean only when the failure probability is below 1/2 (ratio \(2 \times (1-p) < 1\)). Under heavy contention failures are common, so the cap is what keeps the mean finite and bounds the worst-case delay. The cost is that a capped thread may notice a released lock up to 4096 cycles late.</li></ol>`
      }
    ]
  }
}
]);
