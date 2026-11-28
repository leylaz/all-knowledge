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
<a href="#/math-harm/area"><span class="nm">Harmonic Number Bounds</span><span class="f">\(\ln(n+1) \le H_n \le 1 + \ln n\)</span></a>
<a href="#/math-harm/gamma"><span class="nm">Harmonic Number Estimate</span><span class="f">\(H_n \approx \ln n + \gamma + \dfrac{1}{2n},\ \gamma \approx 0.5772\)</span></a>
<a href="#/math-harm/collector"><span class="nm">Coupon Collector</span><span class="f">\(E[\text{draws to see all } n] = n\,H_n \approx n \ln n\)</span></a>
<a href="#/math-tele/idea"><span class="nm">Telescoping Sum</span><span class="f">\(\displaystyle\sum_{k=0}^{n-1} (a_{k+1} - a_k) = a_n - a_0\)</span></a>
<a href="#/math-tele/fractions"><span class="nm">Partial Fractions</span><span class="f">\(\dfrac{1}{k(k+1)} = \dfrac{1}{k} - \dfrac{1}{k+1}\)</span></a>
<a href="#/math-tele/powers"><span class="nm">Sum of Squares</span><span class="f">\(\displaystyle\sum_{k=0}^{n} k^2 = \frac{n(n+1)(2n+1)}{6}\)</span></a>
<a href="#/math-tele/products"><span class="nm">Global Miss Rate From Local Rates</span><span class="f">\(m_1 m_2 m_3 = \dfrac{\text{L3 misses}}{\text{L1 accesses}}\)</span></a>
</div>

<h3 id="sec-pages-fit-together">How the Pages Fit Together</h3>
<ul>
<li><a href="#/math-arith">Arithmetic Series</a>: Gauss's pairing argument, the average term, counting pairs, sums of higher powers, and the quadratic costs they explain (age matrices, rename dependency checks, same-bank queues, triangular loops).</li>
<li><a href="#/math-geom">Geometric Series</a>: the finite and infinite sums by shift and subtract, why one term sets the scale, the sum of \(k\,x^k\), expected tries until success, and the retries, backoff, moving averages, and lookahead limits built on them.</li>
<li><a href="#/math-harm">Harmonic Numbers</a>: why \(1 + \tfrac12 + \tfrac13 + \cdots\) diverges, bounds from the area under \(1/x\), the constant \(\gamma\) and the \(1/(2n)\) correction, the coupon collector's \(n\,H_n\), and Zipf hit rates that gain a constant per doubling.</li>
<li><a href="#/math-tele">Telescoping Sums</a>: sums of differences that collapse to their ends, partial fractions, sums of powers and rising products, telescoping products and global miss rates, counter deltas with wraparound, and amortized cost with a potential.</li>
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
<p>Nested loops over a triangle produce sums of squares, and three-deep nests produce sums of cubes. The exact results are polynomials of one degree higher (<a href="#/math-tele/powers">Sums of Powers by Telescoping</a> derives them).</p>
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
},
{
  id: "math-harm",
  region: "mser",
  title: "Harmonic Numbers",
  sections: [
    { id: "def", label: "What the Harmonic Numbers Are" },
    { id: "diverge", label: "Why the Sum Never Stops Growing" },
    { id: "area", label: "Bounds From the Area Under 1/x" },
    { id: "gamma", label: "The Euler-Mascheroni Constant" },
    { id: "collector", label: "Waiting for the Last New Item" },
    { id: "zipf", label: "Zipf Popularity and Hit Rates" },
    { id: "uses", label: "Where It Shows Up" },
    { id: "traps", label: "Common Traps" }
  ],
  body: String.raw`
<p>The harmonic series adds \(1, \tfrac12, \tfrac13, \tfrac14, \ldots\). Its terms shrink toward 0, yet the sum grows without bound, only very slowly: it tracks the natural logarithm, \(H_n \approx \ln n + 0.5772\). That slow, logarithmic growth is exactly the shape of several architecture questions. How long until every set of a cache has been touched? How much hit rate does a bigger cache buy when popularity follows a power law? How often does a running maximum change? Each answer is a harmonic number.</p>

<h3 id="sec-def">What the Harmonic Numbers Are</h3>
<p>The \(n\)-th harmonic number is the sum of the first \(n\) reciprocals. The index starts at 1 here, since \(1/0\) has no value.</p>
<div class="math chain"><span>\(\displaystyle H_n = \sum_{k=1}^{n} \frac{1}{k} \)</span><span>\(\displaystyle = 1 + \frac{1}{2} + \frac{1}{3} + \cdots + \frac{1}{n} \)</span></div>
<p>The first few are \(H_1 = 1\), \(H_2 = 1.5\), \(H_4 \approx 2.083\), and \(H_{10} \approx 2.929\). After that they climb very slowly: \(H_{1000} \approx 7.49\) and \(H_{1{,}000{,}000} \approx 14.39\). Multiplying \(n\) by 1000 adds only about 6.9, which is \(\ln 1000\). The rest of the page explains why.</p>

<h3 id="sec-diverge">Why the Sum Never Stops Growing</h3>
<p>Shrinking terms do not guarantee a finite sum. Group the terms in blocks that end at powers of two (Oresme's argument, from the 1300s). The block from \(1/(2^j + 1)\) to \(1/2^{j+1}\) has \(2^j\) terms, and each is at least the last one, \(1/2^{j+1}\). So each block adds at least \(1/2\).</p>
<div class="math chain"><span>\(\displaystyle H_{2^m} = 1 + \frac12 + \left(\frac13 + \frac14\right) + \left(\frac15 + \cdots + \frac18\right) + \cdots \)</span><span>\(\displaystyle \ge 1 + \frac12 + \frac12 + \frac12 + \cdots \)</span><span>\(\displaystyle = 1 + \frac{m}{2} \)</span></div>
<p>Since \(m\) can be as large as you like, so can \(H_n\). The argument also shows the growth rate: doubling \(n\) adds roughly a constant, and "a constant per doubling" is what a logarithm does. Compare a geometric series, whose terms shrink by a fixed ratio and whose sum stays finite. The harmonic terms shrink, but too slowly.</p>

<h3 id="sec-area">Bounds From the Area Under 1/x</h3>
<p>From <a href="#/math-log/ln">The Natural Log and the Area Under 1/x</a>, \(\ln n = \int_1^n dx/x\). Draw the curve \(1/x\) and a rectangle of height \(1/k\) and width 1 for each term. Placing the rectangles in two ways traps the sum between two areas.</p>
<p><strong>Lower bound.</strong> Put rectangle \(k\) over the interval \([k, k+1]\). There the curve is below \(1/k\), so each rectangle covers the area under the curve on its interval, and the rectangles for \(k = 1\) to \(n\) cover the area from 1 to \(n+1\).</p>
<div class="math chain"><span>\(\displaystyle \frac{1}{k} \ge \int_k^{k+1} \frac{dx}{x} \)</span><span>\(\displaystyle \Rightarrow\ H_n \ge \int_1^{n+1} \frac{dx}{x} = \ln(n+1) \)</span></div>
<p><strong>Upper bound.</strong> Put rectangle \(k\) over \([k-1, k]\) instead. There the curve is above \(1/k\), so for \(k \ge 2\) each rectangle fits under the curve. Term \(k = 1\) is left over.</p>
<div class="math chain"><span>\(\displaystyle \frac{1}{k} \le \int_{k-1}^{k} \frac{dx}{x} \)</span><span>\(\displaystyle \Rightarrow\ H_n \le 1 + \int_1^{n} \frac{dx}{x} = 1 + \ln n \)</span></div>
<div class="math chain"><span>\(\displaystyle \ln(n+1) \le H_n \le 1 + \ln n \)</span></div>
<p>The two bounds differ by less than 1 for every \(n\), so \(H_n\) grows exactly like \(\ln n\), and the base of the log has to be \(e\). This "compare a sum with an integral" move works for any sum of a decreasing function, and it is the most useful single trick for estimating sums.</p>

<h3 id="sec-gamma">The Euler-Mascheroni Constant</h3>
<p>The bounds leave a gap of up to 1. The gap closes because \(H_n - \ln n\) settles on a constant. Call the difference \(d_n\).</p>
<p><strong>It decreases.</strong> Going from \(n\) to \(n + 1\) adds \(1/(n+1)\) to \(H_n\) but adds \(\int_n^{n+1} dx/x\) to \(\ln n\). On that interval \(1/x > 1/(n+1)\), so the log grows by more.</p>
<div class="math chain"><span>\(\displaystyle d_n - d_{n+1} = \int_n^{n+1} \frac{dx}{x} - \frac{1}{n+1} \)</span><span>\(\displaystyle > 0 \)</span></div>
<p><strong>It stays positive.</strong> From the lower bound, \(d_n \ge \ln(n+1) - \ln n > 0\). A decreasing sequence that stays above 0 must converge, and the limit is the <strong>Euler-Mascheroni constant</strong>.</p>
<div class="math chain"><span>\(\displaystyle \gamma = \lim_{n\to\infty} \left(H_n - \ln n\right) \)</span><span>\(\displaystyle = 0.5772156649\ldots \)</span></div>
<p><strong>What \(\gamma\) is, as a picture.</strong> In the lower-bound picture, each rectangle sticks out above the curve by a thin curved sliver. \(\gamma\) is the total area of all the slivers. Each sliver is nearly a right triangle of width 1 and height \(1/k - 1/(k+1)\), and those triangle areas telescope (see <a href="#/math-tele/fractions">Partial Fractions</a>) to \(\tfrac12(1 - \tfrac{1}{n+1}) \to \tfrac12\). The curve bends, so the slivers are a little fatter than triangles, which is why \(\gamma\) is 0.577 rather than 0.5.</p>
<p><strong>The \(1/(2n)\) correction.</strong> The same triangles estimate the slivers that are missing after the first \(n\) terms: they add to about \(\tfrac{1}{2(n+1)}\). So \(H_n \approx \ln(n+1) + \gamma - \tfrac{1}{2(n+1)}\). Using \(\ln(n+1) \approx \ln n + \tfrac1n\) from <a href="#/math-approx/linear">First-Order Approximations</a> turns that into the standard form, whose error shrinks like \(1/(12 n^2)\).</p>
<div class="math chain"><span>\(\displaystyle H_n \approx \ln n + \gamma + \frac{1}{2n} \)</span></div>
<div class="tbl"><table>
<tr><th>\(n\)</th><th>\(H_n\)</th><th>\(\ln n + \gamma\)</th><th>\(\ln n + \gamma + \frac{1}{2n}\)</th></tr>
<tr><td>2</td><td>1.500000</td><td>1.270363</td><td>1.520363</td></tr>
<tr><td>10</td><td>2.928968</td><td>2.879801</td><td>2.929801</td></tr>
<tr><td>100</td><td>5.187378</td><td>5.182386</td><td>5.187386</td></tr>
<tr><td>1000</td><td>7.485471</td><td>7.484971</td><td>7.485471</td></tr>
</table></div>
<p>Without the correction, \(\ln n + \gamma\) is already within 0.1% at \(n = 100\). With it, the estimate is good to about six digits by \(n = 1000\).</p>

<h3 id="sec-collector">Waiting for the Last New Item</h3>
<p>Draw uniformly at random from \(n\) items, with replacement, until every item has appeared at least once. This is the <strong>coupon collector</strong> problem. Split the wait into stages: stage \(i\) starts when \(i\) distinct items have been seen and ends at the next new one. During stage \(i\), each draw is new with probability \((n-i)/n\), and by <a href="#/math-geom/expect">Expected Number of Tries</a> the stage lasts \(n/(n-i)\) draws on average. Add the stages (linearity of expectation) and reverse the order of the terms.</p>
<div class="math chain"><span>\(\displaystyle E[\text{draws}] = \sum_{i=0}^{n-1} \frac{n}{n - i} \)</span><span>\(\displaystyle = n \left(\frac{1}{n} + \frac{1}{n-1} + \cdots + \frac{1}{1}\right) \)</span><span>\(\displaystyle = n\, H_n \approx n \ln n \)</span></div>
<p>For 64 items that is \(64 \times H_{64} \approx 303.6\) draws, almost 5 per item. The cost is all at the end. The first half of the items arrive in about \(n \ln 2 \approx 0.69\,n\) draws, and the very last item alone takes \(n\) draws on average. The probability region adds the spread around this mean.</p>

<h3 id="sec-zipf">Zipf Popularity and Hit Rates</h3>
<p>Many reference streams have a few very popular items and a long tail. A common model is <strong>Zipf's law</strong> with exponent 1: the item of popularity rank \(r\) (rank 1 the most popular) is referenced with probability proportional to \(1/r\). With \(N\) items, the probabilities must add to 1, so the normalizing constant is \(H_N\).</p>
<div class="math chain"><span>\(\displaystyle P(\text{rank } r) = \frac{1/r}{H_N} \)</span></div>
<p>A cache that holds the \(k\) most popular items (the best any policy can do when references are independent) hits on ranks 1 to \(k\).</p>
<div class="math chain"><span>\(\displaystyle \text{hit rate} = \frac{H_k}{H_N} \)</span><span>\(\displaystyle \approx \frac{\ln k + \gamma}{\ln N + \gamma} \)</span></div>
<p>Two consequences follow. First, a small cache does well: holding 1000 of 100,000 objects (1%) gives \(H_{1000}/H_{100{,}000} \approx 7.485/12.090 \approx 62\%\). Second, growth is logarithmic: each doubling of \(k\) adds the same \(\ln 2 / H_N\) to the hit rate, about 5.7 points here, however big the cache already is. That is the familiar "miss rate falls by a constant step per doubling" curve, and it is why the last few points of hit rate are so expensive.</p>

<h3 id="sec-uses">Where It Shows Up</h3>
<ul>
<li><strong>Warm-up and coverage.</strong> When accesses spread randomly over \(n\) sets, banks, or predictor entries, touching all of them takes about \(n \ln n\) accesses, not \(n\). Sampled simulation (SMARTS, SimPoint) has to budget warm-up for this tail, and a "touch every set" test pattern should walk the sets in order rather than pick them at random.</li>
<li><strong>Cache and TLB sizing under skewed popularity.</strong> With Zipf-like reuse, hit rate grows by a constant per doubling of capacity, which shapes LLC, TLB, and key-value cache sizing curves.</li>
<li><strong>Running maxima and minima.</strong> In a stream of \(n\) independent, identically distributed values with no ties, value \(k\) is a new maximum with probability \(1/k\), so the expected number of updates is \(H_n\). A max-latency register in a performance monitor, or "best result so far" in a random design-space search, changes only about \(\ln n\) times.</li>
<li><strong>Sorting and search costs.</strong> Randomized quicksort makes \(2(n+1)H_n - 4n \approx 2n \ln n\) comparisons on average, because elements \(i\) and \(j\) are compared exactly when one of them is the first pivot chosen from the \(|i - j| + 1\) values between them, which happens with probability \(2/(|i - j| + 1)\).</li>
</ul>

<h3 id="sec-traps">Common Traps</h3>
<ul>
<li><strong>Which log.</strong> \(H_n \approx \ln n + \gamma\) uses the natural log. Using \(\log_2 n\) overestimates by a factor of 1.44.</li>
<li><strong>Dropping \(\gamma\).</strong> \(\ln n\) alone is 0.58 low. That is 11% low at \(n = 100\), and the error matters most in ratios such as \(H_k / H_N\) for small \(k\).</li>
<li><strong>Harmonic series and harmonic mean are different things.</strong> The harmonic mean of rates (the right way to average IPC or bandwidth over equal work) is \(n / \sum (1/x_i)\). It shares the reciprocals and nothing else.</li>
<li><strong>Not every reciprocal sum diverges.</strong> \(\sum 1/k^2\) converges, to \(\pi^2/6 \approx 1.645\), and \(\sum 1/k^p\) converges for every \(p > 1\). Zipf with exponent above 1 therefore has a finite total even for infinitely many items, and its hit-rate curve saturates.</li>
<li><strong>Coupon collector needs uniform, independent draws.</strong> Skewed access patterns touch the popular sets quickly and the rare ones very slowly, so the real warm-up can be far longer than \(n \ln n\).</li>
</ul>
`,
  practice: {
    guided: [
      {
        q: String.raw`<p>After a context switch, a new process's accesses spread over the sets of a private L2 cache. How many accesses until every set has received at least one, and how many until half of them have?</p><p>Given:</p><ul><li>L2: 1 MiB, 8-way set associative, 64 B lines</li><li>Each access lands on a set chosen uniformly at random, independently of every other access</li><li>\"Half of them\" means 1024 distinct sets have received at least one access</li><li>\(H_n \approx \ln n + \gamma + \tfrac{1}{2n}\), with \(\gamma \approx 0.5772\)</li><li>\(\ln 2 \approx 0.693147\)</li></ul>`,
        a: String.raw`<ol class="steps"><li><strong>Count the sets.</strong> The capacity divided by the bytes per set (ways times line size) gives the set count.<div class="math chain"><span>\(\displaystyle n = \frac{1{,}048{,}576\ \text{B}}{8\ \text{ways} \times 64\ \text{B/way}} \)</span><span>\(\displaystyle = 2048\ \text{sets} \)</span></div></li><li><strong>Split into stages.</strong> Once \(i\) sets have been touched, each access hits a new set with probability \((2048 - i)/2048\). The stage waits for one success, so by the expected-tries result it takes \(2048/(2048 - i)\) accesses on average.<div class="math chain"><span>\(\displaystyle E[\text{stage } i] = \frac{2048\ \text{sets}}{(2048 - i)\ \text{sets}}\ \text{accesses} \)</span></div></li><li><strong>All sets.</strong> Add stages 0 to 2047. Reversed, the denominators run from 1 to 2048, which gives \(2048\, H_{2048}\). Note \(\ln 2048 = 11 \ln 2\).<div class="math chain"><span>\(\displaystyle H_{2048} \approx 11 \times 0.693147 + 0.5772 + \frac{1}{4096} \)</span><span>\(\displaystyle \approx 8.20206 \)</span></div><div class="math chain"><span>\(\displaystyle E[\text{all}] = 2048\ \text{accesses} \times H_{2048} \)</span><span>\(\displaystyle \approx \mathbf{16{,}798}\ \textbf{accesses} \)</span></div></li><li><strong>Half the sets.</strong> Stages 0 to 1023 have denominators from 2048 down to 1025, so their sum is \(2048\,(H_{2048} - H_{1024})\). In the difference, \(\gamma\) cancels and the logs leave \(\ln 2\).<div class="math chain"><span>\(\displaystyle H_{2048} - H_{1024} \approx 0.693147 + \frac{1}{4096} - \frac{1}{2048} \)</span><span>\(\displaystyle \approx 0.692903 \)</span></div><div class="math chain"><span>\(\displaystyle E[\text{half}] = 2048\ \text{accesses} \times \left(H_{2048} - H_{1024}\right) \)</span><span>\(\displaystyle \approx \mathbf{1419}\ \textbf{accesses} \)</span></div></li><li><strong>Read the result.</strong> Touching half the sets takes about 0.69 accesses per set, and the second half takes about \(16{,}798 - 1419 = 15{,}379\) accesses, more than 10 times as many. The last set alone takes 2048 accesses on average. A simulator that warms the L2 with a fixed budget of "one access per set" leaves most of the cache cold in this model.</li></ol>`
      }
    ],
    interview: [
      {
        q: String.raw`<p>A process's page references follow a Zipf distribution, and its second-level TLB is modeled as always holding the most popular pages. What hit rate does the TLB reach, how many entries would 90% take, and how much does each doubling of entries add?</p><p>Given:</p><ul><li>Footprint: \(2^{20}\) pages of 4 KiB (4 GiB)</li><li>The page of popularity rank \(r\) (\(r = 1\) the most popular) is referenced with probability proportional to \(1/r\)</li><li>References are independent of one another</li><li>Second-level TLB: 3072 entries, always holding the 3072 most popular pages, with every miss in the first-level TLB looked up there</li><li>Count a hit as a reference whose page is in the second-level TLB, ignoring the first-level TLB</li><li>\(H_n \approx \ln n + \gamma + \tfrac{1}{2n}\), with \(\gamma \approx 0.5772\)</li><li>\(\ln 2 \approx 0.693147\) and \(\ln 3 \approx 1.098612\)</li></ul>`,
        a: String.raw`<ol class="steps"><li><strong>Hit rate as a ratio of harmonic numbers.</strong> Each rank's probability is \((1/r)/H_N\), where \(H_N\) makes the probabilities sum to 1. The TLB covers ranks 1 to 3072.<div class="math chain"><span>\(\displaystyle \text{hit rate} = \sum_{r=1}^{3072} \frac{1/r}{H_{2^{20}}} \)</span><span>\(\displaystyle = \frac{H_{3072}}{H_{2^{20}}} \)</span></div></li><li><strong>Evaluate both.</strong> Write \(3072 = 3 \times 2^{10}\), so \(\ln 3072 = \ln 3 + 10 \ln 2\). The \(1/(2n)\) term is about 0.00016 for 3072 and negligible for \(2^{20}\).<div class="math chain"><span>\(\displaystyle \ln 3072 = \ln 3 + 10 \ln 2 \)</span><span>\(\displaystyle \approx 1.098612 + 10 \times 0.693147 \)</span><span>\(\displaystyle \approx 8.030082 \)</span></div><div class="math chain"><span>\(\displaystyle H_{3072} \approx 8.030082 + 0.5772 + \frac{1}{6144} \)</span><span>\(\displaystyle \approx 8.6074 \)</span></div><div class="math chain"><span>\(\displaystyle H_{2^{20}} \approx 20 \times 0.693147 + 0.5772 \)</span><span>\(\displaystyle \approx 14.44014 \)</span></div><div class="math chain"><span>\(\displaystyle \text{hit rate} \approx \frac{8.6074}{14.44014} \)</span><span>\(\displaystyle \approx \mathbf{59.6\%} \)</span></div></li><li><strong>Entries for 90%.</strong> Solve \(H_k = 0.9\, H_{2^{20}}\) for \(k\), dropping the \(1/(2k)\) term because \(k\) will be large.<div class="math chain"><span>\(\displaystyle \ln k + 0.5772 = 0.9 \times H_{2^{20}} \)</span><span>\(\displaystyle \approx 0.9 \times 14.44014 \)</span><span>\(\displaystyle \Rightarrow\ \ln k \approx 12.4189 \)</span><span>\(\displaystyle \Rightarrow\ k \approx e^{12.4189} \)</span><span>\(\displaystyle \approx \mathbf{247{,}000}\ \textbf{entries} \)</span></div>That is about 80 times the 3072 entries, for 30 more points of hit rate, and it would map about 24% of the footprint.</li><li><strong>Gain per doubling.</strong> Doubling \(k\) raises \(\ln k\) by \(\ln 2\) and leaves \(H_{2^{20}}\) unchanged, so every doubling adds the same amount.<div class="math chain"><span>\(\displaystyle \Delta\,\text{hit rate} = \frac{0.693147}{14.44014} \)</span><span>\(\displaystyle \approx \mathbf{4.8}\ \textbf{points per doubling} \)</span></div></li><li><strong>What it means for design.</strong> Going from 3072 to 6144 entries buys only about 4.8 points, at roughly twice the area and a slower lookup. Under this kind of skew the better lever is reach per entry: 2 MiB pages cover 512 times as much memory per entry, and when popular 4 KiB pages sit near one another, one entry captures many ranks at once. The model is optimistic in two ways. Real replacement (LRU) does worse than "always the most popular," and real references are not independent, though locality in time usually helps a TLB more than this model credits.</li></ol>`
      }
    ]
  }
},
{
  id: "math-tele",
  region: "mser",
  title: "Telescoping Sums",
  sections: [
    { id: "idea", label: "What Telescoping Means" },
    { id: "fractions", label: "Partial Fractions" },
    { id: "powers", label: "Sums of Powers by Telescoping" },
    { id: "products", label: "Telescoping Products" },
    { id: "counters", label: "Counter Deltas and Cycle Accounting" },
    { id: "amortized", label: "Amortized Cost With a Potential" },
    { id: "uses", label: "Where It Shows Up" },
    { id: "traps", label: "Common Traps" }
  ],
  body: String.raw`
<p>A telescoping sum is a sum of differences. Each term cancels part of its neighbor, the way the sections of a collapsing telescope slide into one another, and only the two ends survive. The skill is less in the cancellation than in spotting it: rewriting a term as "something at \(k+1\) minus the same thing at \(k\)" turns a sum with no obvious closed form into two values. The same move explains why counter deltas add up to the total, why local miss rates multiply into a global one, and how to prove that an operation is cheap on average.</p>

<h3 id="sec-idea">What Telescoping Means</h3>
<p>If every term is a difference of consecutive values of some sequence \(a_k\), the inner values each appear once with a plus sign and once with a minus sign.</p>
<div class="math chain"><span>\(\displaystyle \sum_{k=0}^{n-1} \left(a_{k+1} - a_k\right) = (a_1 - a_0) + (a_2 - a_1) + \cdots + (a_n - a_{n-1}) \)</span><span>\(\displaystyle = a_n - a_0 \)</span></div>
<p>This is the discrete version of the fundamental theorem of calculus: adding up the changes gives the net change, \(\int_a^b f'(x)\,dx = f(b) - f(a)\). It runs in both directions. Read forward, it evaluates a sum of differences. Read backward, it says that to sum \(t_k\) in closed form, it is enough to find a sequence \(a_k\) whose differences are \(t_k\) (an "antidifference"), the way integration looks for an antiderivative.</p>

<h3 id="sec-fractions">Partial Fractions</h3>
<p>The classic example is \(1/(k(k+1))\). Splitting it into two simpler fractions shows it is a difference of consecutive values of \(1/k\).</p>
<div class="math chain"><span>\(\displaystyle \frac{1}{k(k+1)} = \frac{(k+1) - k}{k(k+1)} \)</span><span>\(\displaystyle = \frac{1}{k} - \frac{1}{k+1} \)</span></div>
<div class="math chain"><span>\(\displaystyle \sum_{k=1}^{n} \frac{1}{k(k+1)} = \left(1 - \frac12\right) + \left(\frac12 - \frac13\right) + \cdots + \left(\frac1n - \frac{1}{n+1}\right) \)</span><span>\(\displaystyle = 1 - \frac{1}{n+1} \)</span></div>
<p>As \(n\) grows the sum tends to 1. The same split gives a quick bound on \(\sum 1/k^2\), a sum with no simple telescoping form. For \(k \ge 2\), \(1/k^2 < 1/(k(k-1))\), and the right side telescopes.</p>
<div class="math chain"><span>\(\displaystyle \sum_{k=1}^{\infty} \frac{1}{k^2} < 1 + \sum_{k=2}^{\infty} \left(\frac{1}{k-1} - \frac{1}{k}\right) \)</span><span>\(\displaystyle = 2 \)</span></div>
<p>The true value is \(\pi^2/6 \approx 1.645\). Bounding a hard sum by a telescoping one is a standard move. A gap of two, as in \(1/(k(k+2)) = \tfrac12\left(1/k - 1/(k+2)\right)\), leaves two terms at each end instead of one. The same triangles that telescope to \(\tfrac12\) here estimate \(\gamma\) on <a href="#/math-harm/gamma">The Euler-Mascheroni Constant</a>.</p>

<h3 id="sec-powers">Sums of Powers by Telescoping</h3>
<p><strong>Sum of the integers.</strong> Expand the difference of consecutive squares, \((k+1)^2 - k^2 = 2k + 1\). Sum both sides for \(k = 0\) to \(n\). The left side telescopes to \((n+1)^2\), and the right side contains the unknown sum.</p>
<div class="math chain"><span>\(\displaystyle (n+1)^2 = 2\sum_{k=0}^{n} k + (n+1) \)</span><span>\(\displaystyle \Rightarrow\ \sum_{k=0}^{n} k = \frac{(n+1)^2 - (n+1)}{2} \)</span><span>\(\displaystyle = \frac{n(n+1)}{2} \)</span></div>
<p>That is Gauss's result from <a href="#/math-arith/pairing">Gauss's Pairing Argument</a>, found without any picture.</p>
<p><strong>Sum of the squares.</strong> One power up, \((k+1)^3 - k^3 = 3k^2 + 3k + 1\). Sum for \(k = 0\) to \(n\) and use the sum of integers just found.</p>
<div class="math chain"><span>\(\displaystyle (n+1)^3 = 3\sum_{k=0}^{n} k^2 + 3\,\frac{n(n+1)}{2} + (n+1) \)</span></div>
<div class="math chain"><span>\(\displaystyle 3\sum_{k=0}^{n} k^2 = (n+1)\left[(n+1)^2 - \frac{3n}{2} - 1\right] \)</span><span>\(\displaystyle = (n+1)\,\frac{2n^2 + n}{2} \)</span><span>\(\displaystyle \Rightarrow\ \sum_{k=0}^{n} k^2 = \frac{n(n+1)(2n+1)}{6} \)</span></div>
<p>Each power needs all the lower ones, so the method climbs a ladder. Check with \(n = 3\): \(0 + 1 + 4 + 9 = 14\), and \(3 \times 4 \times 7 / 6 = 14\).</p>
<p><strong>Rising products: a shortcut.</strong> Products of consecutive integers telescope directly, with no ladder. For \(k(k+1)\), compare the three-term products that start one apart. They share the factors \(k(k+1)\), and the leftover factors differ by 3.</p>
<div class="math chain"><span>\(\displaystyle k(k+1)(k+2) - (k-1)k(k+1) = 3\,k(k+1) \)</span></div>
<div class="math chain"><span>\(\displaystyle \sum_{k=0}^{n-1} k(k+1) = \frac{(n-1)\,n\,(n+1)}{3} \)</span></div>
<p>For \(n = 10\) that is \(9 \times 10 \times 11 / 3 = 330\). This pattern (the sum of a rising product of length \(m\) is the next longer product divided by \(m + 1\)) is the discrete version of \(\int x^m dx = x^{m+1}/(m+1)\), and it is the fast way to count the work of triangular and tetrahedral loop nests.</p>

<h3 id="sec-products">Telescoping Products</h3>
<p>Ratios cancel the same way differences do.</p>
<div class="math chain"><span>\(\displaystyle \prod_{k=0}^{n-1} \frac{a_{k+1}}{a_k} = \frac{a_1}{a_0} \cdot \frac{a_2}{a_1} \cdots \frac{a_n}{a_{n-1}} \)</span><span>\(\displaystyle = \frac{a_n}{a_0} \)</span></div>
<p>Taking logs turns this into a telescoping sum, \(\sum (\ln a_{k+1} - \ln a_k)\), so it is the same idea in multiplicative form. A small example: \(\prod_{k=2}^{n} (1 - 1/k) = \prod_{k=2}^{n} \frac{k-1}{k} = \frac{1}{n}\).</p>
<p><strong>Miss rates through a hierarchy.</strong> The <em>local</em> miss rate of a cache level is its misses over the accesses that reach it, and the accesses that reach a level are the misses of the level above. Multiplying the local rates telescopes: each level's numerator cancels the next level's denominator.</p>
<div class="math chain"><span>\(\displaystyle m_1\, m_2\, m_3 = \frac{\text{L1 misses}}{\text{L1 accesses}} \cdot \frac{\text{L2 misses}}{\text{L1 misses}} \cdot \frac{\text{L3 misses}}{\text{L2 misses}} \)</span><span>\(\displaystyle = \frac{\text{L3 misses}}{\text{L1 accesses}} \)</span></div>
<p>So the <em>global</em> miss rate of the L3 (memory accesses per L1 access) is the product of the local rates. With local rates of 5%, 40%, and 30%, only \(0.05 \times 0.4 \times 0.3 = 0.6\%\) of L1 accesses reach DRAM. The product view also explains a common confusion: the L3's 30% local miss rate looks poor, but the L3 only sees the accesses the L1 and L2 already failed to catch, which are the hardest ones. Hennessy and Patterson make the same point when they warn against judging a second-level cache by its local miss rate.</p>
<p><strong>Average memory access time.</strong> AMAT nests the same way. Expanding the nested form gives a sum where each level's extra latency is weighted by the global rate of the accesses that pay it.</p>
<div class="math chain"><span>\(\displaystyle \text{AMAT} = t_1 + m_1\left(t_2 + m_2\,(t_3 + m_3\, t_{\text{mem}})\right) \)</span><span>\(\displaystyle = t_1 + m_1 t_2 + m_1 m_2\, t_3 + m_1 m_2 m_3\, t_{\text{mem}} \)</span></div>

<h3 id="sec-counters">Counter Deltas and Cycle Accounting</h3>
<p>A performance counter is a running total \(c(t)\). A sampling profiler reads it at times \(t_0, t_1, \ldots, t_n\) and attributes each interval's delta \(c(t_{k+1}) - c(t_k)\) to whatever was running. The deltas telescope, so they always add up to the whole run's count, \(c(t_n) - c(t_0)\), however the intervals are chosen. Nothing is lost or counted twice, which is why interval-based tools can slice one run in many ways and still agree on the total.</p>
<p><strong>Wraparound.</strong> A \(w\)-bit counter stores the total modulo \(2^w\). Computing each delta modulo \(2^w\) (unsigned subtraction in C) still gives the right answer, as long as no single interval lasts longer than one full wrap. The telescoping then holds modulo \(2^w\), and the sum of the deltas is the true total. A 32-bit cycle counter at 4 GHz wraps every \(2^{32} / (4 \times 10^9\ \text{cycles/s}) \approx 1.07\ \text{s}\), so it must be read at least that often. A 48-bit counter at 5 GHz wraps only every 15.6 hours.</p>
<p><strong>Cycle stacks.</strong> Top-down and CPI-stack accounting assign every cycle (or every issue slot) to exactly one category: retiring, front-end bound, bad speculation, back-end bound. The categories add to the total cycles by construction. The same telescoping logic is why a cycle stack built from per-interval stacks matches the stack of the whole run.</p>

<h3 id="sec-amortized">Amortized Cost With a Potential</h3>
<p>Some operations are usually cheap and occasionally expensive, like a push onto a dynamic array that sometimes has to copy everything. To bound the average cost, define a <strong>potential</strong> \(\Phi\), a number computed from the data structure's state, and charge each operation its actual cost plus the change in potential. Summed over a sequence of operations, the potential changes telescope.</p>
<div class="math chain"><span>\(\displaystyle \sum_{i=1}^{n} \left(c_i + \Phi_i - \Phi_{i-1}\right) = \sum_{i=1}^{n} c_i + \Phi_n - \Phi_0 \)</span></div>
<p>If \(\Phi\) starts at 0 and never goes negative, the total actual cost is at most the total charged cost. For a doubling array, take \(\Phi = 2 \times \text{size} - \text{capacity}\), which stays at or above 0 once the array is at least half full (true right after each doubling). A push that does not grow the array costs 1 and raises \(\Phi\) by 2, so it is charged 3. A push into a full array of capacity \(s\) copies \(s\) elements and writes 1, costing \(s + 1\). The capacity doubles to \(2s\), so \(\Phi\) drops from \(2s - s = s\) to \(2(s+1) - 2s = 2\), a change of \(2 - s\). The charge is again \((s + 1) + (2 - s) = 3\). Every push is charged 3, so \(n\) pushes cost at most \(3n\) (plus the small starting potential). The geometric-series argument on <a href="#/math-geom/finite">The Finite Sum</a> gives the same bound, and the potential version extends to structures where no clean series exists.</p>

<h3 id="sec-uses">Where It Shows Up</h3>
<ul>
<li><strong>Miss-rate chains.</strong> Global miss rates are products of local ones, and MPKI at each level is accesses per kilo-instruction times that product. Comparing caches by local miss rate alone is misleading when the level above changes.</li>
<li><strong>Counter sampling.</strong> Interval deltas sum to the total even with wraparound, which is what lets perf, VTune, and simulators report per-phase numbers that add up.</li>
<li><strong>Latency breakdowns.</strong> Timestamps taken at each pipeline or protocol stage give per-stage latencies as differences. They telescope to the end-to-end latency, so a breakdown always adds up (and a breakdown that doesn't add up means a timestamp was missed).</li>
<li><strong>Loop work counts.</strong> Rising products count triangular and tetrahedral loop nests exactly, as in factorization and stencil codes.</li>
<li><strong>Amortized costs in simulators and runtimes.</strong> Resizing queues, rehashing tables, and garbage-collected heaps are all bounded with a potential.</li>
</ul>

<h3 id="sec-traps">Common Traps</h3>
<ul>
<li><strong>Check which ends survive.</strong> A gap of \(g\) between the canceling terms leaves \(g\) terms at each end. Write out the first and last two terms before trusting the closed form.</li>
<li><strong>Infinite telescoping needs the tail to vanish.</strong> \(\sum (a_{k+1} - a_k)\) converges to \(\lim a_n - a_0\) only if \(a_n\) has a limit. \(\sum (\ln(k+1) - \ln k)\) telescopes to \(\ln(n+1)\), which grows forever.</li>
<li><strong>Local and global miss rates.</strong> "The L2 has a 40% miss rate" means nothing until you say per L2 access or per L1 access, and the local rate can rise when the L1 improves even if the L2 is unchanged.</li>
<li><strong>Counter wraparound needs reads within one wrap.</strong> If two reads span more than \(2^w\) events, the modular delta is silently short by a multiple of \(2^w\).</li>
<li><strong>A potential must never go negative</strong> (relative to its start). Otherwise the amortized bound can undercount the real cost.</li>
</ul>
`,
  practice: {
    guided: [
      {
        q: String.raw`<p>How many multiply-adds does the trailing update of a right-looking Cholesky factorization perform, and how long does it take at a core's peak FP32 rate?</p><p>Given:</p><ul><li>Matrix: \(1024 \times 1024\), symmetric, and only the lower triangle is stored and updated</li><li>At step \(k\) (\(k = 0\) to 1023), the trailing lower triangle has \(m = 1023 - k\) rows and \(m(m+1)/2\) entries, diagonal included, and each entry gets one multiply-add</li><li>Count only these trailing-update multiply-adds, not the square roots or the column scaling</li><li>Core: 2 FMA units, each 16 FP32 lanes wide (AVX-512), at 3.0 GHz</li><li>Assume both FMA units stay fully busy, so the time is a lower bound</li></ul>`,
        a: String.raw`<ol class="steps"><li><strong>Write the total as a sum.</strong> As \(k\) runs from 0 to 1023, \(m\) runs from 1023 down to 0, so the total is the sum of \(m(m+1)/2\) over \(m = 0\) to 1023.<div class="math chain"><span>\(\displaystyle \text{FMAs} = \sum_{m=0}^{1023} \frac{m(m+1)}{2} \)</span></div></li><li><strong>Telescope the rising product.</strong> \(m(m+1)\) is the difference of consecutive three-term products divided by 3, so the sum of \(m(m+1)\) from 0 to \(n - 1\) is \((n-1)\,n\,(n+1)/3\). Here \(n = 1024\).<div class="math chain"><span>\(\displaystyle \sum_{m=0}^{1023} m(m+1) = \frac{1023 \times 1024 \times 1025}{3} \)</span></div></li><li><strong>Halve it.</strong><div class="math chain"><span>\(\displaystyle \text{FMAs} = \frac{1023 \times 1024 \times 1025}{6} \)</span><span>\(\displaystyle = \mathbf{178{,}956{,}800}\ \textbf{FMAs} \)</span></div>That is \((n^3 - n)/6\), close to \(n^3/6\). Counting a multiply and an add as 2 flops gives the familiar \(n^3/3\) flops for Cholesky, half of LU's \(2n^3/3\) because only one triangle is updated.</li><li><strong>Peak rate.</strong> Each FMA unit does 16 FP32 multiply-adds per cycle.<div class="math chain"><span>\(\displaystyle \text{per cycle} = 2\ \text{units} \times \frac{16\ \text{FMAs}}{1\ \text{unit-cycle}} \)</span><span>\(\displaystyle = 32\ \frac{\text{FMAs}}{\text{cycle}} \)</span></div><div class="math chain"><span>\(\displaystyle \text{rate} = 32\ \frac{\text{FMAs}}{\text{cycle}} \times 3.0 \times 10^{9}\ \frac{\text{cycles}}{\text{s}} \)</span><span>\(\displaystyle = 96 \times 10^{9}\ \frac{\text{FMAs}}{\text{s}} \)</span></div></li><li><strong>Time.</strong><div class="math chain"><span>\(\displaystyle t = \frac{178{,}956{,}800\ \text{FMAs}}{96 \times 10^{9}\ \text{FMAs/s}} \)</span><span>\(\displaystyle \approx \mathbf{1.86}\ \textbf{ms} \)</span></div>A real blocked Cholesky typically reaches well under this peak at this size, since the late steps work on small trailing triangles that keep the FMA units only partly busy.</li></ol>`
      }
    ],
    interview: [
      {
        q: String.raw`<p>Doubling a core's L1D made the L2's miss rate jump from 30% to 43%. A colleague concludes that the L2 got worse. Is that right, and how did the stall cycles change?</p><p>Given:</p><ul><li>L1D accesses: 400 per 1000 instructions in both configurations</li><li>Before (48 KiB L1D): 30 L1D misses and 9 L2 misses per 1000 instructions</li><li>After (96 KiB L1D): 20 L1D misses and 8.6 L2 misses per 1000 instructions</li><li>The L2 is unchanged, and the quoted miss rates are local (L2 misses over L2 accesses)</li><li>A load that misses the L1D and hits the L2 stalls 14 cycles</li><li>A load that misses the L2 stalls 84 cycles on average in total, counted from the L1D miss and including the L2 lookup (L3 and DRAM blended)</li><li>Treat every L1D access as a load</li><li>The L1D hit latency is unchanged, and stalls do not overlap</li></ul>`,
        a: String.raw`<ol class="steps"><li><strong>Local rates.</strong> The L2 is accessed once per L1D miss, so its local miss rate is L2 misses over L1D misses.<div class="math chain"><span>\(\displaystyle m_{2,\text{before}} = \frac{9\ \text{L2 misses}}{30\ \text{L2 accesses}} = 30\% \)</span></div><div class="math chain"><span>\(\displaystyle m_{2,\text{after}} = \frac{8.6\ \text{L2 misses}}{20\ \text{L2 accesses}} = 43\% \)</span></div></li><li><strong>Global rates by telescoping.</strong> Multiply by the L1D's local rate. The L1D misses cancel, leaving L2 misses per L1D access, which measures what actually leaves the L2.<div class="math chain"><span>\(\displaystyle m_1\, m_2 = \frac{30\ \text{misses}}{400\ \text{accesses}} \times \frac{9\ \text{misses}}{30\ \text{misses}} \)</span><span>\(\displaystyle = \frac{9}{400} = 2.25\% \)</span></div><div class="math chain"><span>\(\displaystyle m_1\, m_2 = \frac{20\ \text{misses}}{400\ \text{accesses}} \times \frac{8.6\ \text{misses}}{20\ \text{misses}} \)</span><span>\(\displaystyle = \frac{8.6}{400} = 2.15\% \)</span></div>Traffic past the L2 went down, not up.</li><li><strong>Why the local rate rose.</strong> The bigger L1D now catches 10 more accesses per 1000 instructions, and nearly all of them (\(30 - 20 = 10\) fewer L1D misses but only \(9 - 8.6 = 0.4\) fewer L2 misses) were accesses the L2 used to hit. The L2 lost its easy hits and kept its hard misses, so its ratio worsened while its absolute misses improved. The colleague is wrong: the L2 is unchanged, and its local miss rate is not a measure of its quality when the level above changes.</li><li><strong>Stall cycles before.</strong> L1D misses that hit the L2 are the L1D misses minus the L2 misses.<div class="math chain"><span>\(\displaystyle \text{L2-hit stalls} = (30 - 9)\ \text{loads} \times 14\ \frac{\text{cycles}}{\text{load}} \)</span><span>\(\displaystyle = 294\ \text{cycles} \)</span></div><div class="math chain"><span>\(\displaystyle \text{L2-miss stalls} = 9\ \text{loads} \times 84\ \frac{\text{cycles}}{\text{load}} \)</span><span>\(\displaystyle = 756\ \text{cycles} \)</span></div><div class="math chain"><span>\(\displaystyle \text{stalls} = 294\ \text{cycles} + 756\ \text{cycles} \)</span><span>\(\displaystyle = 1050\ \text{cycles per 1000 instructions} \)</span></div></li><li><strong>Stall cycles after.</strong><div class="math chain"><span>\(\displaystyle \text{L2-hit stalls} = (20 - 8.6)\ \text{loads} \times 14\ \frac{\text{cycles}}{\text{load}} \)</span><span>\(\displaystyle = 159.6\ \text{cycles} \)</span></div><div class="math chain"><span>\(\displaystyle \text{L2-miss stalls} = 8.6\ \text{loads} \times 84\ \frac{\text{cycles}}{\text{load}} \)</span><span>\(\displaystyle = 722.4\ \text{cycles} \)</span></div><div class="math chain"><span>\(\displaystyle \text{stalls} = 159.6\ \text{cycles} + 722.4\ \text{cycles} \)</span><span>\(\displaystyle = 882\ \text{cycles per 1000 instructions} \)</span></div>The bigger L1D saves <strong>168 cycles per 1000 instructions</strong>, a 16% cut in memory stalls, while the "worse" L2 miss rate rose 13 points.</li><li><strong>A telescoped form of the same cost.</strong> Charge every L1D miss the 14 L2 cycles and every L2 miss the extra \(84 - 14 = 70\) cycles. The before stalls are \(30 \times 14 + 9 \times 70 = 1050\) cycles, and the after stalls are \(20 \times 14 + 8.6 \times 70 = 882\) cycles. Written this way, each level's extra latency is weighted by how many accesses get past the level above it, which is the expanded AMAT formula, and the local rates never appear.</li></ol>`
      }
    ]
  }
}
]);
