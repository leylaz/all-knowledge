/* Section: Exponentials and logarithms
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "mexp").
   Bodies and practice use String.raw, so TeX takes single backslashes. */

section({
  id: "mexp",
  name: "Exponentials and Logarithms",
  cap: "Exponent rules, the number e, logarithm rules and bit counts, approximations and growth rates",
  sections: [
    { id: "cheat", label: "Cheat Sheet" },
    { id: "pages-fit-together", label: "How the Pages Fit Together" }
  ],
  body: String.raw`
<p>Exponentials and logarithms are two views of one idea. An exponential answers "what do I get after growing by a factor \(b\), \(y\) times?" A logarithm answers the reverse question: "how many times must I grow by \(b\) to reach \(x\)?" In architecture the first question shows up whenever something compounds or decays (charge leaking from a DRAM cell, survival of a part with a constant failure rate, the chance that no event happens in \(n\) tries). The second shows up whenever something is counted in bits or levels (index bits, tree depth, the number of halvings in a binary search), and whenever a curve is read on a log scale.</p>

<h3 id="sec-cheat">Cheat Sheet</h3>
<p>The rules worth knowing cold. Each card links to where it is derived.</p>
<div class="cheat">
<a href="#/math-exp/rules"><span class="nm">Product and Power of Powers</span>\(a^m a^n = a^{m+n}, \quad (a^m)^n = a^{mn}\)</a>
<a href="#/math-exp/rules"><span class="nm">Zero, Negative, Fractional Exponents</span>\(a^0 = 1, \quad a^{-n} = \dfrac{1}{a^n}, \quad a^{1/n} = \sqrt[n]{a}\)</a>
<a href="#/math-exp/compounding"><span class="nm">The Number e</span>\(e = \displaystyle\lim_{n\to\infty}\left(1+\frac{1}{n}\right)^{n} \approx 2.71828\)</a>
<a href="#/math-exp/rate"><span class="nm">Growth Proportional to Amount</span>\(\dfrac{dy}{dt} = ky \;\Rightarrow\; y = y_0\, e^{kt}\)</a>
<a href="#/math-exp/series"><span class="nm">Series for e to the x</span>\(e^x = \displaystyle\sum_{n=0}^{\infty} \frac{x^n}{n!}\)</a>
</div>

<h3 id="sec-pages-fit-together">How the Pages Fit Together</h3>
<ul>
<li><a href="#/math-exp">Exponents and Euler's Number</a>: what an exponent means, why the rules for zero, negative, and fractional exponents are forced, where \(e\) comes from, and why it is the natural base.</li>
</ul>
`,
  practice: {
    guided: [
      {
        q: String.raw`<p>A DRAM cell's stored voltage leaks away exponentially. What is the longest refresh interval each cell tolerates, and does it fit DDR5's refresh window at normal and at high temperature?</p><p>Given:</p><ul><li>Cell voltage after a refresh: \(V(t) = V_0\, e^{-t/\tau}\), where \(V_0\) is the fully written voltage</li><li>The sense amplifier reads the cell correctly while \(V(t) \ge 0.6\, V_0\)</li><li>Worst-case cell time constant up to 85 °C: \(\tau = 80\ \text{ms}\)</li><li>Above 85 °C the time constant halves: \(\tau = 40\ \text{ms}\)</li><li>DDR5 refresh window: 32 ms up to 85 °C, and 16 ms above 85 °C (twice the refresh rate)</li><li>Ignore every other loss of charge (reads, row hammer, variable retention)</li></ul>`,
        a: String.raw`<ol class="steps"><li><strong>Set up the condition.</strong> The cell is safe until its voltage falls to the sense threshold, so the longest interval is the time at which \(V(t)\) equals \(0.6\, V_0\). Divide both sides by \(V_0\), since the threshold is a share of the written voltage.<div class="math chain"><span>\(\displaystyle V_0\, e^{-t_{\max}/\tau} = 0.6\, V_0 \)</span><span>\(\displaystyle \Rightarrow\ e^{-t_{\max}/\tau} = 0.6 \)</span></div></li><li><strong>Undo the exponential with a logarithm.</strong> The natural log undoes \(e^{(\cdot)}\), so take \(\ln\) of both sides, then flip the sign with \(-\ln 0.6 = \ln(1/0.6)\).<div class="math chain"><span>\(\displaystyle -\frac{t_{\max}}{\tau} = \ln 0.6 \)</span><span>\(\displaystyle \Rightarrow\ t_{\max} = \tau \ln\frac{1}{0.6} \)</span></div></li><li><strong>Up to 85 °C.</strong> Use the 80 ms time constant and compare with the 32 ms window.<div class="math chain"><span>\(\displaystyle t_{\max} = 80\ \text{ms} \times \ln\frac{1}{0.6} \)</span><span>\(\displaystyle = 80\ \text{ms} \times 0.5108 \)</span><span>\(\displaystyle \approx \mathbf{40.9}\ \textbf{ms} \)</span></div>That is longer than the 32 ms window, so normal refresh is safe with about 8.9 ms of margin.</li><li><strong>Above 85 °C.</strong> Halving \(\tau\) halves \(t_{\max}\), because \(t_{\max}\) is proportional to \(\tau\).<div class="math chain"><span>\(\displaystyle t_{\max} = 40\ \text{ms} \times \ln\frac{1}{0.6} \)</span><span>\(\displaystyle \approx \mathbf{20.4}\ \textbf{ms} \)</span></div>That no longer fits the 32 ms window, so the cell would fail at the normal rate. It does fit the 16 ms window, which is why DDR5 doubles the refresh rate above 85 °C.</li></ol>`
      }
    ],
    interview: [
      {
        q: String.raw`<p>A 16-way set-associative cache wants true LRU replacement. What is the fewest bits per set that can store the full recency order, and why do real designs use 120 bits or 15 bits instead?</p><p>Given:</p><ul><li>Associativity: 16 ways</li><li>True LRU must distinguish every possible recency order of the 16 ways</li><li>The matrix scheme stores one bit per pair of ways: \(\tfrac{16 \times 15}{2} = 120\) bits/set</li><li>Tree-PLRU stores one bit per internal node of a binary tree over the ways: 15 bits/set</li><li>Stirling's approximation: \(\ln n! \approx n \ln n - n + \tfrac{1}{2}\ln(2\pi n)\)</li><li>\(\ln 2 \approx 0.6931\), and estimate without computing \(16!\) directly</li></ul>`,
        a: String.raw`<ol class="steps"><li><strong>Count the states.</strong> A recency order is a ranking of the 16 ways from most to least recently used. There are 16 choices for the most recent, 15 for the next, and so on, so the number of orders is \(16!\).</li><li><strong>Turn states into bits.</strong> \(k\) bits name \(2^k\) states, so the fewest bits that can name all of them is the smallest \(k\) with \(2^k \ge 16!\). That is \(\lceil \log_2 16! \rceil\).<div class="math chain"><span>\(\displaystyle k = \left\lceil \log_2 16! \right\rceil \)</span><span>\(\displaystyle = \left\lceil \frac{\ln 16!}{\ln 2} \right\rceil \)</span></div></li><li><strong>Estimate ln 16! with Stirling.</strong> Substitute \(n = 16\) and keep the terms as given until the end.<div class="math chain"><span>\(\displaystyle \ln 16! \approx 16 \ln 16 - 16 + \tfrac{1}{2}\ln(2\pi \times 16) \)</span><span>\(\displaystyle \approx 44.361 - 16 + 2.305 \)</span><span>\(\displaystyle \approx 30.667 \)</span></div></li><li><strong>Convert to bits.</strong> Divide by \(\ln 2\) to change base, then round up, because a fraction of a bit can't be stored.<div class="math chain"><span>\(\displaystyle \log_2 16! \approx \frac{30.667}{0.6931} \)</span><span>\(\displaystyle \approx 44.24 \)</span><span>\(\displaystyle \Rightarrow\ k = \mathbf{45}\ \textbf{bits/set} \)</span></div>As a check, \(16! = 20{,}922{,}789{,}888{,}000\) and \(\log_2\) of it is about 44.25, so the estimate is off by only about 0.01 bits.</li><li><strong>Why nobody stores 45 bits.</strong> A 45-bit code is the rank of the permutation. Every hit changes the order, so the cache would decode the rank, move one way to the front, and re-encode it on every access. That is wide, slow arithmetic in a path that runs every cycle. The 120-bit matrix spends 75 extra bits to make the update trivial: set the row of the touched way and clear its column. Tree-PLRU goes the other way. Its \(2^{15} = 32{,}768\) states are far fewer than \(16!\), so it cannot represent every order. It gives up exact LRU in exchange for 15 bits and an update that only flips the bits on one root-to-leaf path.</li></ol>`
      }
    ]
  }
}, [
{
  id: "math-exp",
  region: "mexp",
  title: "Exponents and Euler's Number",
  sections: [
    { id: "rules", label: "What an Exponent Means" },
    { id: "compounding", label: "Where e Comes From" },
    { id: "rate", label: "The Function That Is Its Own Rate" },
    { id: "series", label: "The Series for e to the x" },
    { id: "uses", label: "Where It Shows Up" },
    { id: "traps", label: "Common Traps" }
  ],
  body: String.raw`
<p>Every exponent rule comes from one definition and one demand. The definition: for a positive whole number \(n\), \(a^n\) is \(n\) copies of \(a\) multiplied together. The demand: when exponents are extended to zero, negatives, and fractions, the rules that already hold for whole numbers must keep holding. The number \(e\) then falls out of a question about growth: what happens when compounding is split into ever finer steps?</p>

<h3 id="sec-rules">What an Exponent Means</h3>
<p><strong>Product rule.</strong> \(a^m\) is \(m\) copies of \(a\), and \(a^n\) is \(n\) more. Multiplying them strings all the copies together.</p>
<div class="math chain"><span>\(\displaystyle a^m a^n = \underbrace{a \cdots a}_{m}\;\underbrace{a \cdots a}_{n} \)</span><span>\(\displaystyle = a^{m+n} \)</span></div>
<p><strong>Power of a power.</strong> \((a^m)^n\) is \(n\) groups, each of \(m\) copies.</p>
<div class="math chain"><span>\(\displaystyle (a^m)^n = \underbrace{a^m \cdots a^m}_{n} \)</span><span>\(\displaystyle = a^{m + m + \cdots + m} \)</span><span>\(\displaystyle = a^{mn} \)</span></div>
<p><strong>Quotient rule.</strong> When \(m > n\), dividing cancels \(n\) of the \(m\) copies.</p>
<div class="math chain"><span>\(\displaystyle \frac{a^m}{a^n} = a^{m-n} \)</span></div>
<p><strong>Zero exponent.</strong> Nothing so far says what \(a^0\) means. Demand that the quotient rule still hold when \(m = n\). The left side is a number divided by itself, which is 1, so \(a^0\) must be 1 (for \(a \ne 0\)).</p>
<div class="math chain"><span>\(\displaystyle 1 = \frac{a^m}{a^m} = a^{m-m} \)</span><span>\(\displaystyle = a^0 \)</span></div>
<p><strong>Negative exponents.</strong> Demand the product rule for \(a^{-n} a^n\). The exponents add to zero, so the product is 1, and \(a^{-n}\) must be the reciprocal of \(a^n\).</p>
<div class="math chain"><span>\(\displaystyle a^{-n} a^{n} = a^{0} = 1 \)</span><span>\(\displaystyle \Rightarrow\ a^{-n} = \frac{1}{a^n} \)</span></div>
<p><strong>Fractional exponents.</strong> Demand the power-of-a-power rule for \((a^{1/n})^n\). The result is \(a^1 = a\), so \(a^{1/n}\) is the number whose \(n\)-th power is \(a\): the \(n\)-th root. Then \(a^{m/n}\) is that root raised to the \(m\)-th power.</p>
<div class="math chain"><span>\(\displaystyle \left(a^{1/n}\right)^n = a^{n/n} = a \)</span><span>\(\displaystyle \Rightarrow\ a^{1/n} = \sqrt[n]{a}, \quad a^{m/n} = \left(\sqrt[n]{a}\right)^m \)</span></div>
<p>Irrational exponents such as \(2^{\sqrt 2}\) are defined as the limit of \(2^{r}\) over rational \(r\) approaching \(\sqrt 2\). In practice they are computed as \(e^{x \ln a}\), which <a href="#/math-exp/rate">The Function That Is Its Own Rate</a> sets up.</p>
<p><strong>Product of bases.</strong> \((ab)^n\) is \(n\) copies of \(ab\). Multiplication can be reordered, so they regroup as \(n\) copies of \(a\) times \(n\) copies of \(b\), giving \((ab)^n = a^n b^n\). Nothing like this holds for a sum: \((a+b)^n \ne a^n + b^n\).</p>
<p><strong>In hardware: powers of two.</strong> Sizes are powers of two, so these rules do most of the arithmetic. A 48-bit virtual address space holds \(2^{48}\) bytes. Splitting the exponent with the product rule gives \(2^{8} \times 2^{40}\) bytes, which is 256 TiB, since \(2^{40}\) B is 1 TiB. With 4 KiB (\(2^{12}\) B) pages, the quotient rule gives \(2^{48} / 2^{12} = 2^{36}\) pages, about 68.7 billion. The handy anchor is \(2^{10} = 1024 \approx 10^3\). It is 2.4% high, and the error compounds with the exponent: \(2^{40}\) is about 10% more than \(10^{12}\).</p>

<h3 id="sec-compounding">Where e Comes From</h3>
<p>Take a quantity that grows by 100% over one unit of time. Applied once at the end, the growth doubles it. Now split the unit into \(n\) equal steps, each adding \(1/n\) of the current amount. Each step builds on the growth of earlier steps, so the result is bigger than 2. It is \((1 + 1/n)^n\).</p>
<div class="tbl"><table>
<tr><th>Steps \(n\)</th><th>Growth factor \((1+1/n)^n\)</th></tr>
<tr><td>1 (once)</td><td>2</td></tr>
<tr><td>2 (halves)</td><td>2.25</td></tr>
<tr><td>12 (monthly)</td><td>2.613035</td></tr>
<tr><td>365 (daily)</td><td>2.714567</td></tr>
<tr><td>8,760 (hourly)</td><td>2.718127</td></tr>
<tr><td>1,000,000</td><td>2.718280</td></tr>
</table></div>
<p>The factor grows, but more and more slowly, because each finer split only adds growth-on-growth from smaller and smaller pieces. It converges to a definite number, and that limit is \(e\).</p>
<div class="math chain"><span>\(\displaystyle e = \lim_{n\to\infty}\left(1 + \frac{1}{n}\right)^{n} \)</span><span>\(\displaystyle = 2.718281828\ldots \)</span></div>
<p>So \(e\) is the growth factor of <strong>continuous compounding</strong>: 100% growth applied in infinitely many infinitely small steps. The same limit at any rate \(x\) gives \(e^x\). Substitute \(n = mx\), so that \(x/n = 1/m\), and use the power-of-a-power rule. As \(n \to \infty\) so does \(m\) (for \(x > 0\), and the same result holds for \(x < 0\)).</p>
<div class="math chain"><span>\(\displaystyle \left(1 + \frac{x}{n}\right)^{n} = \left(1 + \frac{1}{m}\right)^{mx} \)</span><span>\(\displaystyle = \left[\left(1 + \frac{1}{m}\right)^{m}\right]^{x} \)</span><span>\(\displaystyle \to e^{x} \)</span></div>
<p>Shrinking works the same way. A negative rate \(x = -1\) means "lose \(1/n\) of what is left, \(n\) times," and what is left tends to \(e^{-1} \approx 0.368\). That limit appears in <a href="#/math-exp/uses">Where It Shows Up</a>.</p>

<h3 id="sec-rate">The Function That Is Its Own Rate</h3>
<p>The deeper reason \(e\) matters is calculus. Take the slope of \(a^x\) using the product rule \(a^{x+h} = a^x a^h\).</p>
<div class="math chain"><span>\(\displaystyle \frac{d}{dx} a^x = \lim_{h\to 0}\frac{a^{x+h} - a^x}{h} \)</span><span>\(\displaystyle = a^x \lim_{h\to 0}\frac{a^h - 1}{h} \)</span><span>\(\displaystyle = c_a\, a^x \)</span></div>
<p>So the slope of any exponential is proportional to its own value, and the constant \(c_a\) depends only on the base. Numerically \(c_2 \approx 0.693\) and \(c_3 \approx 1.099\). There is exactly one base between them with \(c = 1\), and it is \(e\). That is the definition that makes \(e\) natural: <strong>\(e^x\) is the function whose rate of change equals its own value.</strong></p>
<div class="math chain"><span>\(\displaystyle \frac{d}{dx} e^x = e^x \)</span></div>
<p>(The next page shows that \(c_a = \ln a\), so \(c_2 = \ln 2\).) The two pictures of \(e\) agree. Compounding in tiny steps means each step adds a small fixed share of the current amount, which is the same as saying the amount grows at a rate proportional to itself.</p>
<p><strong>Why this matters: growth proportional to amount.</strong> Many physical and statistical processes change at a rate proportional to how much there is: charge leaking through a resistance, a population of surviving parts, compound interest. Write that as \(dy/dt = ky\). The solution is an exponential in \(e\), which can be checked by differentiating it.</p>
<div class="math chain"><span>\(\displaystyle \frac{dy}{dt} = k y \)</span><span>\(\displaystyle \Rightarrow\ y(t) = y_0\, e^{kt} \)</span></div>
<div class="math chain"><span>\(\displaystyle \frac{d}{dt}\left(y_0\, e^{kt}\right) = y_0\, k\, e^{kt} \)</span><span>\(\displaystyle = k\, y(t) \)</span></div>
<p>Here \(k\) is read directly as a rate: \(k > 0\) grows, \(k < 0\) decays, and \(1/|k|\) is the time constant (time to change by a factor of \(e\)). Any other base can be rewritten in base \(e\) as \(a^x = e^{x \ln a}\), so base \(e\) loses nothing and keeps the rate visible. That is why physics, probability, and circuit models write everything with \(e\).</p>

<h3 id="sec-series">The Series for e to the x</h3>
<p>Suppose \(e^x\) can be written as a power series \(c_0 + c_1 x + c_2 x^2 + \cdots\). Two facts pin down every coefficient. First, \(e^0 = 1\), so \(c_0 = 1\). Second, the derivative must equal the function itself. Differentiate term by term and match coefficients of \(x^{n-1}\).</p>
<div class="math chain"><span>\(\displaystyle \frac{d}{dx}\sum_{n\ge0} c_n x^n = \sum_{n\ge1} n\, c_n x^{n-1} \)</span><span>\(\displaystyle \Rightarrow\ n\, c_n = c_{n-1} \)</span><span>\(\displaystyle \Rightarrow\ c_n = \frac{1}{n!} \)</span></div>
<div class="math chain"><span>\(\displaystyle e^x = \sum_{n=0}^{\infty} \frac{x^n}{n!} \)</span><span>\(\displaystyle = 1 + x + \frac{x^2}{2} + \frac{x^3}{6} + \cdots \)</span></div>
<p>At \(x = 1\) this gives \(e = 1 + 1 + \tfrac12 + \tfrac16 + \tfrac1{24} + \cdots\), and the factorials make the terms shrink so fast that the first eight terms already give 2.71825. For small \(x\) the first two or three terms are enough. For \(x = 0.1\), \(1 + 0.1 + 0.005 = 1.105\) against the true 1.10517. That is the basis of the approximations on the approximations page.</p>

<h3 id="sec-uses">Where It Shows Up</h3>
<ul>
<li><strong>RC delay and DRAM retention.</strong> A capacitor discharging through a resistance obeys \(dV/dt = -V/(RC)\), so \(V(t) = V_0 e^{-t/RC}\). Wire delay models (Elmore delay) and DRAM retention both come from this. The time to fall to half is \(RC \ln 2 \approx 0.69\, RC\), which is where the 0.69 in delay formulas comes from.</li>
<li><strong>Reliability.</strong> A part that fails at a constant rate \(\lambda\) survives to time \(t\) with probability \(R(t) = e^{-\lambda t}\). Rates are quoted in FIT, failures per \(10^9\) device-hours. For independent parts, survival probabilities multiply. By the product rule the exponents add, \(e^{-\lambda_1 t} e^{-\lambda_2 t} = e^{-(\lambda_1+\lambda_2)t}\), which is why a system's FIT is the sum of its parts' FITs.</li>
<li><strong>Random placement.</strong> Hash \(n\) items uniformly into \(n\) slots (a hashed predictor table, random replacement, a hash table). Each item misses a given slot with probability \(1 - 1/n\), so the slot stays empty with probability \((1 - 1/n)^n\). That is the compounding limit at rate \(-1\), so about \(e^{-1} \approx 36.8\%\) of slots stay empty and only about 63.2% are used. The rest of the items collided.</li>
<li><strong>Waiting times.</strong> The chance that no event happens in time \(t\), when events arrive independently at rate \(\lambda\), is also \(e^{-\lambda t}\). The probability region builds the Poisson and exponential distributions from this.</li>
</ul>

<h3 id="sec-traps">Common Traps</h3>
<ul>
<li>\((a + b)^n \ne a^n + b^n\). For example, \((1 + 1)^2 = 4\), not 2.</li>
<li>\(a^{m^n}\) means \(a^{(m^n)}\), not \((a^m)^n\). For example, \(2^{3^2} = 2^9 = 512\), while \((2^3)^2 = 64\).</li>
<li>\(e^{x+y} = e^x e^y\), but \(e^{xy}\) is \((e^x)^y\), not \(e^x e^y\).</li>
<li>\(-2^2 = -4\), because the exponent binds tighter than the minus sign. \((-2)^2 = 4\).</li>
<li>\(2^{10}\) is 1024, not 1000. KiB, MiB, and GiB are powers of two, while KB, MB, and GB are powers of ten. The gap grows from 2.4% at kilo to 10% at tera.</li>
<li>Fractional powers of negative numbers (such as \((-8)^{1/2}\)) are not real numbers. \((-8)^{1/3} = -2\) works only because the root is odd.</li>
</ul>
`,
  practice: {
    guided: [
      {
        q: String.raw`<p>A hashed prefetcher table is filled by distinct load PCs. What share of its entries end up holding no PC, and how close is the \(e\)-based estimate to the exact value?</p><p>Given:</p><ul><li>Table size: 2048 entries</li><li>Distinct load PCs inserted: 1536 PCs</li><li>The hash sends each PC to one entry, uniformly at random and independently of every other PC</li><li>Count an entry as empty if no PC hashes to it</li></ul>`,
        a: String.raw`<ol class="steps"><li><strong>One PC and one entry.</strong> Fix one entry. A single PC lands somewhere else unless it hashes to exactly this entry.<div class="math chain"><span>\(\displaystyle P(\text{one PC misses it}) = 1 - \frac{1\ \text{entry}}{2048\ \text{entries}} \)</span></div></li><li><strong>All the PCs miss it.</strong> The hashes are independent, so the chance that every PC misses the entry is the product of 1536 equal factors.<div class="math chain"><span>\(\displaystyle P(\text{empty}) = \left(1 - \frac{1}{2048}\right)^{1536} \)</span></div></li><li><strong>Recognize the limit.</strong> Write the exponent as a multiple of the table size, so the power becomes the compounding limit raised to that multiple. The inner power \((1 - 1/2048)^{2048}\) is \((1 + x/n)^n\) with \(x = -1\), which is close to \(e^{-1}\) for \(n\) this large.<div class="math chain"><span>\(\displaystyle P(\text{empty}) = \left[\left(1 - \frac{1}{2048}\right)^{2048}\right]^{1536/2048} \)</span><span>\(\displaystyle \approx e^{-1536/2048} \)</span><span>\(\displaystyle \approx 0.47237 \)</span></div></li><li><strong>Exact value.</strong> Computing the power directly gives a slightly smaller number, since for \(x = -1\) a finite \(n\) sits a little below the limit.<div class="math chain"><span>\(\displaystyle \left(\frac{2047}{2048}\right)^{1536} \approx \mathbf{0.47228} \)</span></div>The approximation is off by about 0.00009, roughly 0.02% of the value.</li><li><strong>Expected empty entries.</strong> Each entry is empty with this probability. By linearity of expectation, the expected count is the entry count times the probability.<div class="math chain"><span>\(\displaystyle E[\text{empty}] = 2048\ \text{entries} \times 0.47228 \)</span><span>\(\displaystyle \approx \mathbf{967.2}\ \textbf{entries} \)</span></div>So about 1080.8 entries hold the 1536 PCs, and about 455.2 PCs land in an entry that another PC already uses. A table with a third more entries than PCs still loses almost 30% of its PCs to collisions.</li></ol>`
      }
    ],
    interview: [
      {
        q: String.raw`<p>A server's DRAM chips fail at a constant rate. Derive the probability that the server goes its whole service life with no DRAM chip failure, and explain why adding the chips' FIT rates is exact rather than an approximation.</p><p>Given:</p><ul><li>DIMMs per server: 32 DIMMs</li><li>DRAM chips per DIMM: 18 chips</li><li>Failure rate per chip: 50 FIT, where 1 FIT is 1 failure per \(10^9\) device-hours</li><li>Each chip's failure rate is constant over time (no wear-out or infant mortality)</li><li>Chips fail independently of each other</li><li>Service life: 5 years, with 1 year = 8760 hours</li></ul>`,
        a: String.raw`<ol class="steps"><li><strong>Survival of one chip.</strong> A constant failure rate \(\lambda\) means that a chip alive at time \(t\) fails in the next short interval \(dt\) with probability \(\lambda\, dt\). So the survival probability \(R(t)\) loses a share \(\lambda\, dt\) of itself in each interval. That is growth proportional to amount with rate \(-\lambda\), and \(R(0) = 1\).<div class="math chain"><span>\(\displaystyle \frac{dR}{dt} = -\lambda R \)</span><span>\(\displaystyle \Rightarrow\ R(t) = e^{-\lambda t} \)</span></div></li><li><strong>Why the rates add.</strong> The server survives only if every chip survives. The chips are independent, so the survival probabilities multiply. Multiplying exponentials adds their exponents, so the server behaves exactly like one part whose rate is the sum. No approximation is involved.<div class="math chain"><span>\(\displaystyle R_{\text{server}}(t) = \prod_{i} e^{-\lambda_i t} \)</span><span>\(\displaystyle = e^{-\left(\sum_i \lambda_i\right) t} \)</span></div></li><li><strong>Total rate.</strong> Count the chips, then multiply by the per-chip rate.<div class="math chain"><span>\(\displaystyle N = 32\ \text{DIMMs} \times \frac{18\ \text{chips}}{1\ \text{DIMM}} \)</span><span>\(\displaystyle = 576\ \text{chips} \)</span></div><div class="math chain"><span>\(\displaystyle \Lambda = 576\ \text{chips} \times \frac{50\ \text{failures}}{10^9\ \text{chip-hours}} \)</span><span>\(\displaystyle = \frac{28{,}800\ \text{failures}}{10^9\ \text{hours}} \)</span></div></li><li><strong>Exponent over the service life.</strong> The exponent is the rate times the time. It is also the expected number of failures if failed chips were replaced as they fail.<div class="math chain"><span>\(\displaystyle t = 5\ \text{years} \times \frac{8760\ \text{hours}}{1\ \text{year}} \)</span><span>\(\displaystyle = 43{,}800\ \text{hours} \)</span></div><div class="math chain"><span>\(\displaystyle \Lambda t = \frac{28{,}800\ \text{failures}}{10^9\ \text{hours}} \times 43{,}800\ \text{hours} \)</span><span>\(\displaystyle = 1.26144\ \text{failures} \)</span></div></li><li><strong>Survival probability.</strong> Raise \(e\) to the negative exponent.<div class="math chain"><span>\(\displaystyle R_{\text{server}} = e^{-1.26144} \)</span><span>\(\displaystyle \approx \mathbf{0.283} \)</span></div>So only about 28% of servers finish the 5 years with no DRAM chip failure. The linear shortcut "probability of failure is about rate times time" would give 1.26, which is impossible for a probability. That shortcut only works when \(\Lambda t \ll 1\), where \(e^{-\Lambda t} \approx 1 - \Lambda t\). Here the exponent is above 1, so the full exponential is needed. That is also why servers rely on ECC (Chipkill or SDDC) to survive a chip failure rather than hoping none occurs.</li></ol>`
      }
    ]
  }
}
]);
