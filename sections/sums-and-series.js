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
</div>

<h3 id="sec-pages-fit-together">How the Pages Fit Together</h3>
<ul>
<li><a href="#/math-arith">Arithmetic Series</a>: Gauss's pairing argument, the average term, counting pairs, sums of higher powers, and the quadratic costs they explain (age matrices, rename dependency checks, same-bank queues, triangular loops).</li>
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
<p>The test for "arithmetic" is that consecutive differences are constant. The latencies 32, 80, 128, 176 ns are arithmetic (step 48 ns). The sizes 4, 8, 16, 32 KiB are not, since their ratio is constant instead, which makes them geometric.</p>

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
}
]);
