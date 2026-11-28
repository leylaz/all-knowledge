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
<a href="#/math-exp/rules"><span class="nm">Product and Power of Powers</span><span class="f">\(a^m a^n = a^{m+n}\)</span><span class="f">\((a^m)^n = a^{mn}\)</span></a>
<a href="#/math-exp/rules"><span class="nm">Zero, Negative, Fractional Exponents</span><span class="f">\(a^0 = 1\)</span><span class="f">\(a^{-n} = \dfrac{1}{a^n}\)</span><span class="f">\(a^{1/n} = \sqrt[n]{a}\)</span></a>
<a href="#/math-exp/compounding"><span class="nm">The Number e</span><span class="f">\(e = \displaystyle\lim_{n\to\infty}\left(1+\frac{1}{n}\right)^{n} \approx 2.71828\)</span></a>
<a href="#/math-exp/rate"><span class="nm">Growth Proportional to Amount</span><span class="f">\(\dfrac{dy}{dt} = ky \;\Rightarrow\; y = y_0\, e^{kt}\)</span></a>
<a href="#/math-exp/series"><span class="nm">Series for e to the x</span><span class="f">\(e^x = \displaystyle\sum_{n=0}^{\infty} \frac{x^n}{n!}\)</span></a>
<a href="#/math-log/def"><span class="nm">Definition of a Logarithm</span><span class="f">\(\log_b x = y \iff b^y = x\)</span></a>
<a href="#/math-log/rules"><span class="nm">Product and Power Rules</span><span class="f">\(\log(xy) = \log x + \log y\)</span><span class="f">\(\log x^k = k\log x\)</span></a>
<a href="#/math-log/rules"><span class="nm">Change of Base</span><span class="f">\(\log_b x = \dfrac{\ln x}{\ln b}\)</span><span class="f">\(b^x = e^{x\ln b}\)</span></a>
<a href="#/math-log/ln"><span class="nm">Slope of ln</span><span class="f">\(\dfrac{d}{dx}\ln x = \dfrac{1}{x}\)</span><span class="f">\(\ln x = \displaystyle\int_1^x \frac{dt}{t}\)</span></a>
<a href="#/math-log/bits"><span class="nm">Bits to Name N Things</span><span class="f">\(k = \lceil \log_2 N \rceil\)</span></a>
<a href="#/math-log/scales"><span class="nm">Power-Law Exponent From Two Points</span><span class="f">\(k = \dfrac{\ln(y_2/y_1)}{\ln(x_2/x_1)}\)</span></a>
<a href="#/math-approx/linear"><span class="nm">First-Order Approximations</span><span class="f">\(e^x \approx 1 + x\)</span><span class="f">\(\ln(1+x) \approx x\)</span></a>
<a href="#/math-approx/small-p"><span class="nm">Small Chances Over Many Tries</span><span class="f">\((1-p)^n \approx e^{-np}\)</span></a>
<a href="#/math-approx/doubling"><span class="nm">Doubling Time</span><span class="f">\(t_2 = \dfrac{\ln 2}{\ln(1+r)} \approx \dfrac{0.693}{r}\)</span></a>
<a href="#/math-approx/stirling"><span class="nm">Stirling's Approximation</span><span class="f">\(\ln n! \approx n\ln n - n + \tfrac12 \ln(2\pi n)\)</span></a>
</div>

<h3 id="sec-pages-fit-together">How the Pages Fit Together</h3>
<ul>
<li><a href="#/math-exp">Exponents and Euler's Number</a>: what an exponent means, why the rules for zero, negative, and fractional exponents are forced, where \(e\) comes from, and why it is the natural base.</li>
<li><a href="#/math-log">Logarithms and Their Rules</a>: the log as the inverse of the exponential, every log rule derived from an exponent rule, change of base, the natural log as the area under \(1/x\), counting bits and tree levels, and reading power laws on log-log axes.</li>
<li><a href="#/math-approx">Approximations and Growth Rates</a>: the first-order approximations with their errors, small chances over many tries, doubling times and the rule of 72, compounding percentages, how growth rates rank, and Stirling's approximation.</li>
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
},

{
  id: "math-log",
  region: "mexp",
  title: "Logarithms and Their Rules",
  sections: [
    { id: "def", label: "What a Logarithm Is" },
    { id: "notation", label: "ln, log, and log2" },
    { id: "rules", label: "Rules Derived From Exponents" },
    { id: "ln", label: "The Natural Log and the Area Under 1/x" },
    { id: "bits", label: "Counting Bits and Levels" },
    { id: "scales", label: "Log Scales and Power Laws" },
    { id: "traps", label: "Common Traps" }
  ],
  body: String.raw`
<p>A logarithm undoes an exponential. Where \(b^y\) asks "what do I get after \(y\) factors of \(b\)?", \(\log_b x\) asks "how many factors of \(b\) does it take to make \(x\)?" Every log rule is an exponent rule from <a href="#/math-exp/rules">What an Exponent Means</a> read backwards, so none of them needs memorizing once that link is clear.</p>

<h3 id="sec-def">What a Logarithm Is</h3>
<p>For a base \(b > 0\) with \(b \ne 1\) and a positive \(x\), \(\log_b x\) is the exponent that turns \(b\) into \(x\).</p>
<div class="math chain"><span>\(\displaystyle \log_b x = y \)</span><span>\(\displaystyle \iff b^y = x \)</span></div>
<p>Three readings of the same number are useful:</p>
<ul>
<li><strong>Count of multiplications.</strong> \(\log_2 1024 = 10\) because ten doublings take 1 to 1024.</li>
<li><strong>Count of divisions.</strong> Read the other way, \(\log_2 N\) is how many times \(N\) can be halved before reaching 1. That is the depth of a binary search, a balanced binary tree, or a tree of 2-input gates.</li>
<li><strong>Number of digits.</strong> \(\log_{10} x\) is roughly the number of decimal digits of \(x\) (exactly \(\lfloor \log_{10} x \rfloor + 1\) for \(x \ge 1\)), and \(\log_2 x\) is roughly the number of bits.</li>
</ul>
<p>Because \(b^y\) is always positive, the log of zero or a negative number is undefined. As \(x \to 0^{+}\), \(\log_b x \to -\infty\) for \(b > 1\). Logs of numbers between 0 and 1 are negative: \(\log_2 0.25 = -2\), because two halvings take 1 to 0.25.</p>
<p>Two identities say that the exponential and the log undo each other.</p>
<div class="math chain"><span>\(\displaystyle b^{\log_b x} = x, \quad \log_b\left(b^{y}\right) = y \)</span></div>

<h3 id="sec-notation">ln, log, and log2</h3>
<ul>
<li>\(\ln x = \log_e x\), the <strong>natural log</strong>. It is the inverse of \(e^x\), the one used in calculus and probability.</li>
<li>\(\log x\) depends on the field. Engineers and calculators mean \(\log_{10}\). Mathematicians, and most programming languages, mean \(\ln\). In C, <code>log()</code> is the natural log, with <code>log2()</code> and <code>log10()</code> for the others. In complexity analysis, \(O(\log n)\) leaves the base out because changing the base only multiplies by a constant (see the change-of-base rule below).</li>
<li>\(\log_2 x\), sometimes written \(\lg x\), counts bits and levels.</li>
</ul>
<p>A few values carry most mental math:</p>
<div class="tbl"><table>
<tr><th>Value</th><th>Approximately</th><th>Use</th></tr>
<tr><td>\(\ln 2\)</td><td>0.6931</td><td>Doubling and halving times, half-life</td></tr>
<tr><td>\(\ln 10\)</td><td>2.3026</td><td>Converting \(\ln\) to \(\log_{10}\)</td></tr>
<tr><td>\(\log_{10} 2\)</td><td>0.30103</td><td>\(2^{10} \approx 10^{3}\), since \(10 \times 0.30103 \approx 3\)</td></tr>
<tr><td>\(\log_2 10\)</td><td>3.3219</td><td>Bits per decimal digit</td></tr>
<tr><td>\(\log_2 e = 1/\ln 2\)</td><td>1.4427</td><td>Converting \(\ln\) to bits</td></tr>
</table></div>

<h3 id="sec-rules">Rules Derived From Exponents</h3>
<p>Each rule comes from writing the inputs as powers of the base, applying an exponent rule, and reading the exponent back off. Let \(u = \log_b x\) and \(v = \log_b y\), so \(x = b^u\) and \(y = b^v\).</p>
<p><strong>Product rule.</strong> Multiplying powers adds exponents, so the log of a product is the sum of the logs. This is why logs turn multiplication into addition, which is how slide rules and log tables worked, and why a chain of speedup factors averages naturally in log space.</p>
<div class="math chain"><span>\(\displaystyle \log_b(xy) = \log_b\left(b^u b^v\right) \)</span><span>\(\displaystyle = \log_b\left(b^{u+v}\right) \)</span><span>\(\displaystyle = \log_b x + \log_b y \)</span></div>
<p><strong>Quotient rule.</strong> Dividing powers subtracts exponents.</p>
<div class="math chain"><span>\(\displaystyle \log_b\frac{x}{y} = \log_b\left(b^{u-v}\right) \)</span><span>\(\displaystyle = \log_b x - \log_b y \)</span></div>
<p><strong>Power rule.</strong> A power of a power multiplies exponents, so an exponent inside a log comes out as a factor. This is the rule that solves equations with the unknown in an exponent.</p>
<div class="math chain"><span>\(\displaystyle \log_b\left(x^k\right) = \log_b\left(b^{uk}\right) \)</span><span>\(\displaystyle = k \log_b x \)</span></div>
<p><strong>Special values.</strong> \(\log_b 1 = 0\) because \(b^0 = 1\), and \(\log_b b = 1\). With the quotient rule, \(\log_b(1/x) = -\log_b x\).</p>
<p><strong>Change of base.</strong> Start from \(x = b^{\log_b x}\) and take the log in another base \(a\) of both sides. The power rule brings the exponent down.</p>
<div class="math chain"><span>\(\displaystyle \log_a x = \log_a\left(b^{\log_b x}\right) \)</span><span>\(\displaystyle = \log_b x \cdot \log_a b \)</span><span>\(\displaystyle \Rightarrow\ \log_b x = \frac{\log_a x}{\log_a b} \)</span></div>
<p>So logs in different bases differ only by a constant factor. For example, \(\log_2 x = \ln x / \ln 2 \approx 1.4427 \ln x\). A calculator with only \(\ln\) can compute any base, and \(O(\log_2 n)\) and \(O(\ln n)\) are the same complexity class.</p>
<p><strong>Any exponential in base e.</strong> Apply \(b = e^{\ln b}\) and the power-of-a-power rule.</p>
<div class="math chain"><span>\(\displaystyle b^x = \left(e^{\ln b}\right)^x \)</span><span>\(\displaystyle = e^{x \ln b} \)</span></div>

<h3 id="sec-ln">The Natural Log and the Area Under 1/x</h3>
<p><strong>Slope of ln.</strong> Let \(y = \ln x\), so \(x = e^y\). Differentiate both sides with respect to \(x\). The left side gives 1, and the right side gives \(e^y\, dy/dx\) by the chain rule, since \(e^y\) is its own derivative.</p>
<div class="math chain"><span>\(\displaystyle 1 = e^{y}\frac{dy}{dx} \)</span><span>\(\displaystyle \Rightarrow\ \frac{d}{dx}\ln x = \frac{1}{e^{y}} = \frac{1}{x} \)</span></div>
<p>Read backwards, \(\ln x\) is the area under the curve \(1/t\) from \(t = 1\) to \(t = x\).</p>
<div class="math chain"><span>\(\displaystyle \ln x = \int_{1}^{x} \frac{dt}{t} \)</span></div>
<p>This picture explains several facts. The area grows without bound, but slowly, because \(1/t\) keeps shrinking: going from 1 to 10 adds 2.30, and so does going from 10 to 100. Every factor of 10 adds the same area, which is the product rule seen geometrically. It is also why the harmonic sum \(1 + \tfrac12 + \tfrac13 + \cdots + \tfrac1n\), a staircase under the same curve, grows like \(\ln n\). The sums and series region derives that.</p>
<p><strong>Closing the loop on e.</strong> <a href="#/math-exp/rate">The Function That Is Its Own Rate</a> found that \(\frac{d}{dx} a^x = c_a a^x\). Writing \(a^x = e^{x\ln a}\) and differentiating gives \(c_a = \ln a\). So \(c_2 = \ln 2 \approx 0.693\), and the base with \(c = 1\) is the one whose natural log is 1, which is \(e\).</p>
<div class="math chain"><span>\(\displaystyle \frac{d}{dx} a^x = \frac{d}{dx} e^{x \ln a} \)</span><span>\(\displaystyle = \ln a \cdot e^{x\ln a} \)</span><span>\(\displaystyle = \ln a \cdot a^x \)</span></div>

<h3 id="sec-bits">Counting Bits and Levels</h3>
<p>\(k\) bits name \(2^k\) values, so naming \(N\) things takes the smallest \(k\) with \(2^k \ge N\).</p>
<div class="math chain"><span>\(\displaystyle k = \left\lceil \log_2 N \right\rceil \)</span></div>
<p>When \(N\) is a power of two, the ceiling does nothing: 512 sets need exactly 9 index bits. When it isn't, the ceiling matters, and some codes go unused: 12 ways need 4 bits to name a way, and 4 of the 16 codes are never used.</p>
<p><strong>Splitting an address.</strong> A cache with line size \(L\) bytes and \(S\) sets splits a physical address of \(A\) bits into three fields:</p>
<ul>
<li>Offset: \(\log_2 L\) bits (6 bits for 64 B lines)</li>
<li>Index: \(\log_2 S\) bits, where \(S = \text{capacity} / (L \times \text{ways})\)</li>
<li>Tag: \(A - \log_2 L - \log_2 S\) bits</li>
</ul>
<p>Doubling capacity at fixed ways and line size doubles \(S\), so it moves one bit from tag to index. That is the product rule: \(\log_2(2S) = 1 + \log_2 S\).</p>
<p><strong>Depth of trees.</strong> A tree with fan-in \(f\) needs \(\lceil \log_f N \rceil\) levels to combine \(N\) inputs. Examples:</p>
<ul>
<li>Tree-PLRU over 8 ways is 3 levels deep, and an update touches 3 bits.</li>
<li>A 64-bit carry-lookahead or parallel-prefix adder has \(\log_2 64 = 6\) prefix levels. That is why adders scale as \(O(\log n)\) rather than \(O(n)\) like a ripple-carry adder.</li>
<li>Selecting the oldest ready instruction among 64 with 4-input pick cells takes \(\log_4 64 = 3\) levels.</li>
</ul>
<p>Changing fan-in only changes the constant, by change of base: \(\log_4 N = \log_2 N / 2\).</p>

<h3 id="sec-scales">Log Scales and Power Laws</h3>
<p>A <strong>power law</strong> is \(y = a\, x^{k}\). Take logs of both sides, using the product and power rules.</p>
<div class="math chain"><span>\(\displaystyle \log y = \log\left(a\, x^{k}\right) \)</span><span>\(\displaystyle = \log a + k \log x \)</span></div>
<p>So on log-log axes a power law is a straight line, and its slope is the exponent \(k\). Two measured points determine the line. The ratio of the \(y\) values is the ratio of the \(x\) values raised to the power \(k\), so the exponent is the ratio of the logs. Any base works, since the base cancels in the ratio.</p>
<div class="math chain"><span>\(\displaystyle \frac{y_2}{y_1} = \left(\frac{x_2}{x_1}\right)^{k} \)</span><span>\(\displaystyle \Rightarrow\ k = \frac{\ln\left(y_2/y_1\right)}{\ln\left(x_2/x_1\right)} \)</span></div>
<p>The classic architecture example is the empirical <strong>square-root rule</strong> for caches: miss rate scales roughly as capacity to the power \(-0.5\), so doubling a cache cuts misses by a factor of about \(\sqrt 2\). The exponent varies by workload, and fitting it from two cache sizes is a routine first step before extrapolating. The roofline plot is drawn on log-log axes for the same reason: performance against arithmetic intensity is a line of slope 1 (the bandwidth roof) until it hits a flat line (the compute roof).</p>
<p>An exponential \(y = a\, e^{kx}\) is a straight line on <strong>semi-log</strong> axes (only \(y\) on a log scale), because \(\ln y = \ln a + kx\). That is how to tell the two apart in data: plot both ways and see which one comes out straight.</p>

<h3 id="sec-traps">Common Traps</h3>
<ul>
<li>\(\log(x + y) \ne \log x + \log y\). The product rule is for products.</li>
<li>\(\log(xy) \ne \log x \cdot \log y\), and \(\log x / \log y\) is not \(\log(x/y)\). The ratio \(\log x / \log y\) is \(\log_y x\), a change of base.</li>
<li>\((\log x)^2\) is not \(\log(x^2) = 2\log x\).</li>
<li>Calling C's <code>log()</code> when \(\log_{10}\) or \(\log_2\) was meant. It returns \(\ln\).</li>
<li>Forgetting the ceiling when \(N\) isn't a power of two. 10 ways need 4 bits, not 3.32.</li>
<li>Taking logs of a sum of measurements to "average" them. Log averages (the geometric mean) apply to ratios such as speedups, not to raw times. The statistics region covers when each mean is right.</li>
</ul>
`,
  practice: {
    guided: [
      {
        q: String.raw`<p>An L2 cache with a non-power-of-two number of ways splits its physical address into offset, index, and tag. How many bits does each field take, how many bits name a way, and how much storage do the tags take in total?</p><p>Given:</p><ul><li>Capacity: 1.25 MiB, where 1 MiB = \(2^{20}\) bytes</li><li>Associativity: 10 ways</li><li>Line size: 64 B</li><li>Physical address width: 46 bits</li><li>Each line stores one full tag (ignore valid, state, and ECC bits)</li></ul>`,
        a: String.raw`<ol class="steps"><li><strong>Number of sets.</strong> Capacity is sets times ways times line size, so divide the capacity by the bytes in one set.<div class="math chain"><span>\(\displaystyle S = \frac{1.25 \times 2^{20}\ \text{B}}{10\ \text{ways/set} \times 64\ \text{B/way}} \)</span><span>\(\displaystyle = 2048\ \text{sets} \)</span></div>The 1.25 and the 10 cancel into a power of two, so the set count is a power of two even though neither the capacity nor the way count is.</li><li><strong>Offset bits.</strong> The offset names a byte within the line, so it takes \(\log_2\) of the line size.<div class="math chain"><span>\(\displaystyle b_{\text{off}} = \log_2 64 \)</span><span>\(\displaystyle = \mathbf{6}\ \textbf{bits} \)</span></div></li><li><strong>Index bits.</strong> The index names a set.<div class="math chain"><span>\(\displaystyle b_{\text{idx}} = \log_2 2048 \)</span><span>\(\displaystyle = \mathbf{11}\ \textbf{bits} \)</span></div></li><li><strong>Tag bits.</strong> The tag is whatever is left of the address.<div class="math chain"><span>\(\displaystyle b_{\text{tag}} = 46\ \text{bits} - 6\ \text{bits} - 11\ \text{bits} \)</span><span>\(\displaystyle = \mathbf{29}\ \textbf{bits} \)</span></div></li><li><strong>Bits to name a way.</strong> 10 is not a power of two, so round up. Six of the 16 codes go unused.<div class="math chain"><span>\(\displaystyle b_{\text{way}} = \left\lceil \log_2 10 \right\rceil \)</span><span>\(\displaystyle = \lceil 3.32 \rceil \)</span><span>\(\displaystyle = \mathbf{4}\ \textbf{bits} \)</span></div></li><li><strong>Total tag storage.</strong> Every line in every set holds one tag.<div class="math chain"><span>\(\displaystyle T = 2048\ \text{sets} \times \frac{10\ \text{lines}}{1\ \text{set}} \times \frac{29\ \text{bits}}{1\ \text{line}} \)</span><span>\(\displaystyle = 593{,}920\ \text{bits} \)</span><span>\(\displaystyle = \mathbf{72.5}\ \textbf{KiB} \)</span></div>That is about 5.7% of the 1.25 MiB of data, before any state or ECC bits.</li></ol>`
      }
    ],
    interview: [
      {
        q: String.raw`<p>A workload's L2 miss rate was measured at two cache sizes. Fit a power law, predict the miss rate at a size you didn't measure, and say how much capacity it would take to halve the misses again.</p><p>Given:</p><ul><li>At 512 KiB: 12.0 misses/kilo-instruction</li><li>At 2 MiB (2048 KiB): 6.3 misses/kilo-instruction</li><li>Assume the miss rate follows \(m = a\, C^{k}\) for capacity \(C\) across the range of interest, with the same line size and associativity at every size</li><li>Size to predict: 3 MiB (3072 KiB)</li><li>"Halve again" means going from 6.3 misses/kilo-instruction at 2 MiB to 3.15 misses/kilo-instruction</li></ul>`,
        a: String.raw`<ol class="steps"><li><strong>Why a straight line on log-log axes.</strong> Taking logs of \(m = a C^{k}\) gives \(\ln m = \ln a + k \ln C\). That is a line in \(\ln C\) with slope \(k\), so two points determine it, and \(a\) cancels when comparing them.</li><li><strong>Fit the exponent.</strong> Divide the two measurements so that \(a\) cancels, then take logs to bring \(k\) down.<div class="math chain"><span>\(\displaystyle k = \frac{\ln\left(\dfrac{6.3\ \text{misses}/1000\ \text{instr}}{12.0\ \text{misses}/1000\ \text{instr}}\right)}{\ln\left(\dfrac{2048\ \text{KiB}}{512\ \text{KiB}}\right)} \)</span><span>\(\displaystyle = \frac{\ln 0.525}{\ln 4} \)</span><span>\(\displaystyle \approx -0.4648 \)</span></div>That is close to the square-root rule's \(-0.5\), a bit flatter. Under the square-root rule, 4× capacity would have given 12.0 / 2 = 6.0 misses/kilo-instruction instead of 6.3.</li><li><strong>Predict at 3 MiB.</strong> Scale from the nearer measurement by the capacity ratio raised to \(k\). First the scaling factor, then the miss rate.<div class="math chain"><span>\(\displaystyle f = \left(\frac{3072\ \text{KiB}}{2048\ \text{KiB}}\right)^{-0.4648} \)</span><span>\(\displaystyle \approx 0.8282 \)</span></div><div class="math chain"><span>\(\displaystyle m_{3\,\text{MiB}} = \frac{6.3\ \text{misses}}{1000\ \text{instructions}} \times f \)</span><span>\(\displaystyle \approx \mathbf{5.22}\ \textbf{misses/kilo-instruction} \)</span></div></li><li><strong>Capacity to halve the misses.</strong> Halving means the capacity ratio \(r\) must satisfy \(r^{k} = 1/2\). Take logs and solve for \(\log_2 r\), the number of doublings.<div class="math chain"><span>\(\displaystyle k \log_2 r = \log_2 \frac{1}{2} = -1 \)</span><span>\(\displaystyle \Rightarrow\ \log_2 r = \frac{-1}{-0.4648} \)</span><span>\(\displaystyle \approx 2.151\ \text{doublings} \)</span></div><div class="math chain"><span>\(\displaystyle C = 2048\ \text{KiB} \times 2^{2.151} \)</span><span>\(\displaystyle \approx 2048\ \text{KiB} \times 4.443 \)</span><span>\(\displaystyle \approx \mathbf{9099}\ \textbf{KiB} \approx \mathbf{8.9}\ \textbf{MiB} \)</span></div>About 4.4× the capacity for half the misses. That is the core economics of cache sizing: each halving of misses costs a constant factor in area, so returns diminish fast.</li><li><strong>What could break the fit.</strong> A power law fitted from two points assumes the curve stays straight. Real miss curves have knees where a working set starts to fit. If the workload's hot set is, say, 6 MiB, the miss rate drops sharply near that size and the prediction for 8.9 MiB is pessimistic. Below 2 MiB nothing changes. In the other direction, compulsory misses put a floor under the curve that a power law ignores, which makes a far extrapolation optimistic. So the extrapolation is a first estimate to be checked against a third measured size.</li></ol>`
      }
    ]
  }
},

{
  id: "math-approx",
  region: "mexp",
  title: "Approximations and Growth Rates",
  sections: [
    { id: "linear", label: "First-Order Approximations" },
    { id: "small-p", label: "Small Chances Over Many Tries" },
    { id: "doubling", label: "Doubling Times and the Rule of 72" },
    { id: "compound", label: "Compounding Percentages" },
    { id: "growth", label: "Comparing Growth Rates" },
    { id: "stirling", label: "Stirling's Approximation" },
    { id: "traps", label: "Common Traps" }
  ],
  body: String.raw`
<p>Most back-of-the-envelope estimates in architecture rest on a handful of approximations: \(e^x \approx 1 + x\), \(\ln(1+x) \approx x\), \((1-p)^n \approx e^{-np}\), and their relatives. Each comes from the first terms of a series, and each has a known error, so it is possible to say not just "about" but "about, and off by roughly this much." This page derives them, shows when they break, and then compares how fast common functions grow.</p>

<h3 id="sec-linear">First-Order Approximations</h3>
<p>Near a point, a smooth curve looks like its tangent line. Keeping only the first one or two terms of a series is exactly that, and the first dropped term tells how big the error is.</p>
<p><strong>Exponential.</strong> From <a href="#/math-exp/series">The Series for e to the x</a>, keep the first two terms. The error is about the next term, \(x^2/2\).</p>
<div class="math chain"><span>\(\displaystyle e^x = 1 + x + \frac{x^2}{2} + \cdots \)</span><span>\(\displaystyle \approx 1 + x \)</span></div>
<p><strong>Natural log.</strong> \(\ln(1+x)\) is the area under \(1/(1+t)\) from 0 to \(x\). For \(|t| < 1\), \(1/(1+t)\) is a geometric series, so integrate it term by term.</p>
<div class="math chain"><span>\(\displaystyle \ln(1+x) = \int_0^x \left(1 - t + t^2 - \cdots\right) dt \)</span><span>\(\displaystyle = x - \frac{x^2}{2} + \frac{x^3}{3} - \cdots \)</span><span>\(\displaystyle \approx x \)</span></div>
<p><strong>Powers near 1.</strong> Write the power in base \(e\), approximate the log, then the exponential. This is the binomial approximation, and it needs \(nx\) small, not just \(x\).</p>
<div class="math chain"><span>\(\displaystyle (1+x)^n = e^{n\ln(1+x)} \)</span><span>\(\displaystyle \approx e^{nx} \)</span><span>\(\displaystyle \approx 1 + nx \)</span></div>
<p>How good is "small"? The relative error of \(1 + x\) for \(e^x\) is about \(x^2/2\), so it stays under 1% for \(|x|\) up to about 0.14.</p>
<div class="tbl"><table>
<tr><th>\(x\)</th><th>\(e^x\)</th><th>\(1 + x\)</th><th>\(1 + x + x^2/2\)</th><th>\(\ln(1+x)\)</th></tr>
<tr><td>0.01</td><td>1.010050</td><td>1.01</td><td>1.010050</td><td>0.009950</td></tr>
<tr><td>0.1</td><td>1.105171</td><td>1.1</td><td>1.105</td><td>0.095310</td></tr>
<tr><td>0.5</td><td>1.648721</td><td>1.5</td><td>1.625</td><td>0.405465</td></tr>
</table></div>

<h3 id="sec-small-p">Small Chances Over Many Tries</h3>
<p>Many architecture questions take the form "each of \(n\) independent tries fails with a small probability \(p\). What is the chance that none fail?" Examples: bit flips across a cache, a rare event across sampled intervals, a hash collision across insertions. The exact answer is \((1-p)^n\). Rewrite it in base \(e\) and use \(\ln(1-p) \approx -p\).</p>
<div class="math chain"><span>\(\displaystyle (1-p)^n = e^{n \ln(1-p)} \)</span><span>\(\displaystyle \approx e^{-np} \)</span></div>
<p>The approximation needs only \(p\) small, not \(np\) small. The log's next term is \(-p^2/2\), so the exponent is off by about \(np^2/2\). With \(n\) large and \(p\) small that is usually tiny, even when \(np\) is 5 or 50. So the chance of at least one failure is \(1 - e^{-np}\), and only when \(np \ll 1\) does it shrink further to \(np\).</p>
<div class="math chain"><span>\(\displaystyle P(\text{at least one}) = 1 - (1-p)^n \)</span><span>\(\displaystyle \approx 1 - e^{-np} \)</span><span>\(\displaystyle \approx np \quad (np \ll 1) \)</span></div>
<p>For \(p = 10^{-3}\) and \(n = 100\), the exact chance of at least one is 0.09521, \(1 - e^{-np}\) gives 0.09516, and \(np\) gives 0.1. The last step, \(np\), is also an upper bound (the union bound). It overcounts the cases with two or more failures, and it becomes nonsense once \(np\) nears 1.</p>
<p>The same exponent solves the reverse question: how many tries \(n\) make the chance of seeing at least one event reach a target \(q\)? Set \((1-p)^n = 1 - q\) and use the power rule.</p>
<div class="math chain"><span>\(\displaystyle n = \frac{\ln(1-q)}{\ln(1-p)} \)</span><span>\(\displaystyle \approx \frac{1}{p}\ln\frac{1}{1-q} \)</span></div>

<h3 id="sec-doubling">Doubling Times and the Rule of 72</h3>
<p>A quantity that grows by a share \(r\) per period has grown by \((1+r)^t\) after \(t\) periods. It doubles when that factor reaches 2. Take logs and solve for \(t\).</p>
<div class="math chain"><span>\(\displaystyle (1+r)^{t} = 2 \)</span><span>\(\displaystyle \Rightarrow\ t_{2} = \frac{\ln 2}{\ln(1+r)} \)</span><span>\(\displaystyle \approx \frac{0.693}{r} \)</span></div>
<p>The last step uses \(\ln(1+r) \approx r\), which slightly overstates the denominator, so \(0.693/r\) comes out a little short. Keeping the next term, \(\ln(1+r) \approx r(1 - r/2)\), shows that the correction factor is about \(1 + r/2\). At \(r = 8\%\) that makes the numerator about \(0.693 \times 1.04 \approx 0.72\). That is the rule of 72: the doubling time in periods is about 72 divided by the percent growth per period, and it is most accurate near 8% (exactly 9.006 periods against the rule's 9). Below about 4% the rule of 69 or 70 is closer, and at large \(r\) both fall apart, because the series for \(\ln(1+r)\) converges slowly.</p>
<p>Other factors work the same way. The time to grow 10× is \(\ln 10 / \ln(1+r) \approx 2.303/r\). Run in reverse, a fixed doubling time fixes the yearly rate. Transistor counts doubling every 2 years means \(2^{1/2} - 1 \approx 41.4\%\) per year, and 10× takes about 6.6 years.</p>

<h3 id="sec-compound">Compounding Percentages</h3>
<p>Successive relative changes multiply, they don't add.</p>
<div class="math chain"><span>\(\displaystyle (1+a)(1+b) = 1 + a + b + ab \)</span></div>
<p>Adding the percentages drops the cross term \(ab\), which is fine for a few small changes and wrong for many or large ones. Ten 5% improvements give \(1.05^{10} \approx 1.629\times\), not 1.5×. Gains and losses are asymmetric: +20% then −20% gives \(1.2 \times 0.8 = 0.96\), a net loss. To combine relative changes exactly, add their logs: \(\ln\) of the total factor is the sum of the \(\ln\)s of the parts. That is why averages of ratios (speedups, IPC ratios across a benchmark suite) are taken in log space as a geometric mean. The statistics region covers this in full.</p>

<h3 id="sec-growth">Comparing Growth Rates</h3>
<p>For large \(n\), common functions rank as follows. Each one eventually dwarfs everything to its left, whatever the constant factors.</p>
<div class="math chain"><span>\(\displaystyle \log n \ll n^{\varepsilon} \ll n \ll n\log n \ll n^{2} \ll 2^{n} \ll n! \)</span></div>
<p>Logs make the comparisons easy, because comparing \(f\) and \(g\) is the same as comparing \(\ln f\) and \(\ln g\). For example, \(n^{k}\) has log \(k \ln n\), and \(e^{n}\) has log \(n\). Since \(\ln n\) grows slower than any fixed multiple of \(n\), every exponential eventually beats every polynomial. Similarly, \(\ln n\) against \(n^{\varepsilon}\) becomes \(\ln \ln n\) against \(\varepsilon \ln n\), so any small power beats a log.</p>
<p>In hardware this ranking is the scaling argument behind many structures:</p>
<ul>
<li><strong>\(O(\log n)\) delay:</strong> select trees, prefix adders, and tree-PLRU updates. These are why wide structures stay feasible.</li>
<li><strong>\(O(n)\):</strong> comparators in a fully associative lookup, one per entry.</li>
<li><strong>\(O(n^2)\):</strong> matrix LRU state (\(n(n-1)/2\) bits), all-to-all bypass networks, and dependency matrices. These are why such designs stop at modest \(n\).</li>
<li><strong>\(O(n \cdot m)\):</strong> wakeup in an \(n\)-entry scheduler with \(m\) result tags broadcast per cycle. This is why issue width and scheduler size can't both grow freely.</li>
</ul>

<h3 id="sec-stirling">Stirling's Approximation</h3>
<p>\(n!\) shows up whenever orderings are counted (recency orders, permutations of instructions, sorting). Its log is a sum, and a sum of a slowly varying function is close to its integral.</p>
<div class="math chain"><span>\(\displaystyle \ln n! = \sum_{k=1}^{n} \ln k \)</span><span>\(\displaystyle \approx \int_{1}^{n} \ln x\, dx \)</span><span>\(\displaystyle = n\ln n - n + 1 \)</span></div>
<p>The integral uses \(\int \ln x\,dx = x\ln x - x\), which can be checked by differentiating. A finer analysis of the gap between the sum and the integral gives Stirling's approximation, whose error shrinks like \(1/(12n)\).</p>
<div class="math chain"><span>\(\displaystyle \ln n! \approx n\ln n - n + \tfrac{1}{2}\ln(2\pi n) \)</span><span>\(\displaystyle \Leftrightarrow\ n! \approx \sqrt{2\pi n}\left(\frac{n}{e}\right)^{n} \)</span></div>
<p>For \(n = 10\), the exact value of \(\ln 10!\) is 15.1044. Stirling gives 15.0961, and the crude integral gives 14.0259. Converted to bits, \(\log_2 n! \approx n\log_2 n - n\log_2 e\), or about \(n\log_2 n - 1.443\,n\). That is the information-theoretic lower bound for comparison sorting, and the minimum state needed to store a full order of \(n\) items.</p>

<h3 id="sec-traps">Common Traps</h3>
<ul>
<li>Using \(np\) as a probability when \(np\) is not small. Use \(1 - e^{-np}\) instead. \(np\) is always an upper bound, and it can exceed 1.</li>
<li>Using \(1 + nx\) for \((1+x)^n\) when \(x\) is small but \(nx\) is not. Use \(e^{nx}\), or the exact power.</li>
<li>Adding percentage changes over many steps. Multiply the factors, or add their logs.</li>
<li>Applying the rule of 72 to large growth rates. At 50% per period it is off by about 15%.</li>
<li>Confusing percent with percentage points. A miss rate going from 2% to 3% is a rise of 1 percentage point, but 50%.</li>
<li>Comparing growth rates by plugging in small \(n\). \(n^3\) beats \(2^n\) until \(n = 10\), then loses forever.</li>
</ul>
`,
  practice: {
    guided: [
      {
        q: String.raw`<p>Hennessy and Patterson report how fast single-processor performance grew in two eras. How long did performance take to double in each era, and how well does the rule of 72 do?</p><p>Given:</p><ul><li>1986 to 2003: performance grew 52% per year</li><li>2015 to 2018: performance grew 3.5% per year</li><li>Treat each era's growth as compounding once per year at a constant rate</li><li>Rule of 72: doubling time in years ≈ 72 / (percent growth per year)</li></ul>`,
        a: String.raw`<ol class="steps"><li><strong>Exact doubling time.</strong> After \(t\) years the factor is \((1+r)^t\). Set it to 2 and take logs, so the power rule brings \(t\) down.<div class="math chain"><span>\(\displaystyle (1+r)^{t_2} = 2 \)</span><span>\(\displaystyle \Rightarrow\ t_2 = \frac{\ln 2}{\ln(1+r)} \)</span></div></li><li><strong>The 52% era, exact.</strong> Substitute the rate.<div class="math chain"><span>\(\displaystyle t_2 = \frac{\ln 2}{\ln 1.52} \)</span><span>\(\displaystyle = \frac{0.6931}{0.4187}\ \text{years} \)</span><span>\(\displaystyle \approx \mathbf{1.66}\ \textbf{years} \)</span></div></li><li><strong>The 52% era, rule of 72.</strong> Divide 72 by the percent rate.<div class="math chain"><span>\(\displaystyle t_2 \approx \frac{72\ \text{\%·years}}{52\ \text{\%}} \)</span><span>\(\displaystyle \approx \mathbf{1.38}\ \textbf{years} \)</span></div>The rule is about 16% short. It replaces \(\ln(1.52) \approx 0.419\) with something close to 0.52, and \(\ln(1+r) \approx r\) is poor when \(r\) is as large as 0.52.</li><li><strong>The 3.5% era, exact.</strong> Same formula.<div class="math chain"><span>\(\displaystyle t_2 = \frac{\ln 2}{\ln 1.035} \)</span><span>\(\displaystyle = \frac{0.6931}{0.03440}\ \text{years} \)</span><span>\(\displaystyle \approx \mathbf{20.1}\ \textbf{years} \)</span></div></li><li><strong>The 3.5% era, rule of 72.</strong><div class="math chain"><span>\(\displaystyle t_2 \approx \frac{72\ \text{\%·years}}{3.5\ \text{\%}} \)</span><span>\(\displaystyle \approx \mathbf{20.6}\ \textbf{years} \)</span></div>Now the rule is about 2% long. At small rates \(\ln(1+r) \approx r\) is very good, and the 72 in the numerator is slightly too big (the rule of 69, \(69.3/3.5 \approx 19.8\) years, is about as close from the other side). The rule of 72 is tuned for rates near 8%.</li><li><strong>What the contrast means.</strong> Performance that doubled every year and a half for 17 years now takes about two decades to double. That is the end of Dennard scaling and the limits of ILP, as Hennessy and Patterson describe, and why gains now come from parallelism and domain-specific hardware rather than from single cores.</li></ol>`
      }
    ],
    interview: [
      {
        q: String.raw`<p>A sampled simulation measures short, randomly placed intervals instead of the whole run. What is the chance it never samples a rare program phase, and how many samples would make that chance 1%?</p><p>Given:</p><ul><li>Number of sampled intervals: 10,000 samples</li><li>The rare phase covers 0.02% of the run's instructions</li><li>Each sample lands on an instruction chosen uniformly at random from the run, independently of the others (unlike systematic sampling, which spaces samples evenly)</li><li>A sample "sees" the phase if it lands inside it, and ignore samples that straddle the phase's edge</li><li>Target: at most a 1% chance of never seeing the phase</li></ul>`,
        a: String.raw`<ol class="steps"><li><strong>Chance of missing it entirely.</strong> Each sample misses the phase with probability \(1 - p\), where \(p = 0.0002\). The samples are independent, so these multiply.<div class="math chain"><span>\(\displaystyle P_{\text{miss}} = (1 - 0.0002)^{10{,}000} \)</span></div></li><li><strong>Approximate it.</strong> Rewrite in base \(e\). \(p\) is small, so \(\ln(1-p) \approx -p\), even though \(np\) is not small.<div class="math chain"><span>\(\displaystyle P_{\text{miss}} = e^{10{,}000\, \ln(1 - 0.0002)} \)</span><span>\(\displaystyle \approx e^{-10{,}000 \times 0.0002} \)</span><span>\(\displaystyle = e^{-2} \)</span><span>\(\displaystyle \approx \mathbf{0.135} \)</span></div>So about a 13.5% chance that the phase is missed entirely, even with 10,000 samples. The exact power is 0.135308 and \(e^{-2}\) is 0.135335.</li><li><strong>Why the approximation is this good.</strong> The dropped term of \(\ln(1-p)\) is \(-p^2/2\), so the exponent is off by \(np^2/2\).<div class="math chain"><span>\(\displaystyle \Delta = \frac{10{,}000 \times 0.0002^2}{2} \)</span><span>\(\displaystyle = 0.0002 \)</span></div>An exponent off by 0.0002 changes the result by about 0.02%. The linear shortcut \(1 - np\) would give \(1 - 2 = -1\), which is impossible. That shortcut needs \(np \ll 1\), and here \(np = 2\).</li><li><strong>Samples for a 1% miss chance.</strong> Set \((1-p)^n = 0.01\) and take logs. The power rule brings \(n\) down.<div class="math chain"><span>\(\displaystyle n = \frac{\ln 0.01}{\ln(1 - 0.0002)} \)</span><span>\(\displaystyle \approx 23{,}023.5 \)</span><span>\(\displaystyle \Rightarrow\ n = \mathbf{23{,}024}\ \textbf{samples} \)</span></div>Round up, since a fraction of a sample can't be taken. The approximation \(\ln(100)/p \approx 23{,}026\) samples lands within 2 samples.</li><li><strong>What it means for a sampling methodology.</strong> Random sampling covers common behavior well, but a phase at 0.02% of instructions needs more than twice as many samples to be seen reliably. Either it doesn't matter (0.02% of instructions rarely moves total CPI much unless each one is extremely slow), or it does, and then systematic sampling (evenly spaced, which can't miss a contiguous phase longer than the spacing) or phase-based selection like SimPoint, which picks a representative interval from each phase, is the better tool.</li></ol>`
      }
    ]
  }
}
]);
