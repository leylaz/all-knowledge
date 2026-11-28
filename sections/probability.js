/* Section: Probability
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "mprob").
   Bodies and practice use String.raw, so TeX takes single backslashes. */

section({
  id: "mprob",
  name: "Probability",
  cap: "Conditional probability, Bayes, expectation and variance, distributions, birthday and coupon collector",
  sections: [
    { id: "cheat", label: "Cheat Sheet" },
    { id: "pages-fit-together", label: "How the Pages Fit Together" }
  ],
  body: String.raw`
<p>A processor is deterministic, but the things a performance model has to reason about rarely look that way. Which way the next branch goes, which set a new address maps to, whether a bit cell flips before the next scrub, when the next request reaches the memory controller: none of these can be tracked one by one across billions of events, so models treat them as random and ask for chances, averages, and spreads. Probability is the bookkeeping for that. It says how to update a chance when something is learned (conditioning and Bayes), how to average a count without tracking dependences (linearity of expectation), how much a count wanders around its average (variance), which few distributions keep reappearing (binomial, geometric, Poisson), and why collisions in a hashed table show up far sooner than intuition says (the birthday bound).</p>

<h3 id="sec-cheat">Cheat Sheet</h3>
<p>The results worth knowing cold. Each card links to where it is derived.</p>
<div class="cheat">
<a href="#/math-cond/space"><span class="nm">Union of Two Events</span><span class="f">\(P(A \cup B) = P(A) + P(B) - P(A \cap B)\)</span></a>
<a href="#/math-cond/cond"><span class="nm">Conditional Probability</span><span class="f">\(P(A \mid B) = \dfrac{P(A \cap B)}{P(B)}\)</span></a>
<a href="#/math-cond/indep"><span class="nm">Independence</span><span class="f">\(P(A \cap B) = P(A)\,P(B)\)</span></a>
<a href="#/math-cond/total"><span class="nm">Law of Total Probability</span><span class="f">\(P(A) = \displaystyle\sum_i P(A \mid B_i)\,P(B_i)\)</span></a>
<a href="#/math-cond/bayes"><span class="nm">Bayes' Rule</span><span class="f">\(P(B \mid A) = \dfrac{P(A \mid B)\,P(B)}{P(A)}\)</span></a>
<a href="#/math-cond/bayes"><span class="nm">Bayes in Odds Form</span><span class="f">\(\dfrac{P(B \mid A)}{P(\bar B \mid A)} = \dfrac{P(A \mid B)}{P(A \mid \bar B)} \cdot \dfrac{P(B)}{P(\bar B)}\)</span></a>
<a href="#/math-rv/def"><span class="nm">Expectation</span><span class="f">\(E[X] = \displaystyle\sum_x x\,P(X = x)\)</span></a>
<a href="#/math-rv/linear"><span class="nm">Linearity of Expectation</span><span class="f">\(E[X + Y] = E[X] + E[Y]\), always</span></a>
<a href="#/math-rv/indicators"><span class="nm">Indicator Variable</span><span class="f">\(E[I_A] = P(A)\)</span></a>
<a href="#/math-rv/variance"><span class="nm">Variance Shortcut</span><span class="f">\(\mathrm{Var}(X) = E[X^2] - E[X]^2\)</span></a>
<a href="#/math-rv/cov"><span class="nm">Covariance</span><span class="f">\(\mathrm{Cov}(X, Y) = E[XY] - E[X]\,E[Y]\)</span></a>
<a href="#/math-rv/sum"><span class="nm">Variance of a Sum</span><span class="f">\(\sigma^2_{X+Y} = \sigma^2_X + \sigma^2_Y + 2\,\mathrm{Cov}(X, Y)\)</span></a>
<a href="#/math-dist/binom"><span class="nm">Binomial</span><span class="f">\(P(K = k) = \dbinom{n}{k} p^k (1-p)^{n-k}\)</span></a>
<a href="#/math-dist/binom"><span class="nm">Binomial Mean and Variance</span><span class="f">\(E[K] = np,\ \ \mathrm{Var}(K) = np(1-p)\)</span></a>
<a href="#/math-dist/geom"><span class="nm">Geometric Mean and Variance</span><span class="f">\(E[X] = \dfrac{1}{p},\ \ \mathrm{Var}(X) = \dfrac{1-p}{p^2}\)</span></a>
<a href="#/math-dist/poisson"><span class="nm">Poisson</span><span class="f">\(P(N = k) = e^{-\lambda} \dfrac{\lambda^k}{k!},\ \ E = \mathrm{Var} = \lambda\)</span></a>
<a href="#/math-dist/process"><span class="nm">Gap Between Poisson Arrivals</span><span class="f">\(P(\text{gap} > t) = e^{-\lambda t}\)</span></a>
</div>

<h3 id="sec-pages-fit-together">How the Pages Fit Together</h3>
<ul>
<li><a href="#/math-cond">Events and Conditional Probability</a>: sample spaces and the three axioms, conditioning as shrinking the sample space, independence and how it differs from disjointness, the law of total probability, and Bayes' rule with branch confidence estimation and memory dependence prediction as the running examples.</li>
<li><a href="#/math-rv">Random Variables, Expectation, and Variance</a>: expectation as a weighted average, linearity of expectation with no independence needed, counting with indicator variables, variance and why rare long events dominate it, covariance, and the variance of a sum, from the \(\sqrt{n}\) law to how correlation inflates it.</li>
<li><a href="#/math-dist">Common Distributions</a>: Bernoulli, binomial, and geometric with each mean and variance derived, the Poisson as the limit of the binomial, Poisson arrivals and exponential gaps, and their uses in ECC bit errors, low-voltage SRAM, soft-error rates, and memory controller traffic.</li>
</ul>
`,
  practice: {
    guided: [
      {
        q: String.raw`<p>A data TLB with random replacement serves a few hot pages among many cold ones. What is the chance that a hot page's entry is still resident when the page is used again, and how many of the hot pages should be expected to hit?</p><p>Given:</p><ul><li>TLB: 64 entries, fully associative</li><li>Replacement: every TLB miss evicts one of the 64 entries, chosen uniformly at random and independently of every other miss</li><li>Hot pages: 8, each of which is resident just after its own use</li><li>Between two consecutive uses of a given hot page, the TLB takes 20 misses</li><li>Count a hot page as hitting when its entry survives all 20 of those misses</li><li>\(\ln(63/64) \approx -0.015748\)</li></ul>`,
        a: String.raw`<ol class="steps"><li><strong>One miss.</strong> A miss picks one of the 64 entries uniformly, so it spares a given entry with probability 63 in 64.<div class="math chain"><span>\(\displaystyle P(\text{spared by one miss}) = \frac{63\ \text{entries}}{64\ \text{entries}} \)</span></div></li><li><strong>All 20 misses.</strong> The picks are independent, so the chance of being spared by all of them is the product of 20 equal factors.<div class="math chain"><span>\(\displaystyle P(\text{survive}) = \left(\frac{63}{64}\right)^{20} \)</span><span>\(\displaystyle = e^{20 \ln(63/64)} \)</span><span>\(\displaystyle \approx e^{20 \times (-0.015748)} \)</span><span>\(\displaystyle \approx \mathbf{0.730} \)</span></div></li><li><strong>The small-chance shortcut.</strong> Each miss evicts the entry with the small probability \(1/64\), so \((1 - p)^n \approx e^{-np}\) gives nearly the same answer without a logarithm table.<div class="math chain"><span>\(\displaystyle P(\text{survive}) \approx e^{-20/64} \)</span><span>\(\displaystyle \approx 0.732 \)</span></div>The shortcut is off only in the third decimal place, because the exponent's error is about \(n p^2 / 2 = 20 / (2 \times 64^2) \approx 0.0024\).</li><li><strong>Expected hot hits.</strong> Let \(I_j\) be 1 when hot page \(j\) hits and 0 otherwise. The hot hits are \(I_0 + \cdots + I_7\), and the expectation of a sum is the sum of the expectations, so multiply the survival chance by 8.<div class="math chain"><span>\(\displaystyle E[\text{hot hits}] = 8\ \text{pages} \times \left(\frac{63}{64}\right)^{20} \)</span><span>\(\displaystyle \approx \mathbf{5.84}\ \textbf{pages} \)</span></div>About 2.16 of the 8 hot pages miss on each round.</li><li><strong>Why dependence doesn't matter.</strong> The \(I_j\) are not independent. A miss that evicts hot page 0 cannot also evict hot page 1 on the same miss, so their survivals are slightly negatively correlated. Linearity of expectation holds anyway, which is what makes counting by indicators so useful. With LRU replacement instead, a hot page used every 20 misses would always survive in a 64-entry TLB, which is the hit rate that random replacement gives up for its simpler hardware.</li></ol>`
      }
    ],
    interview: [
      {
        q: String.raw`<p>A fleet's error monitor sees a DIMM log exactly 2 corrected memory errors in one day. How likely is it that the DIMM has a faulty DRAM device, as opposed to a healthy DIMM that took random soft errors, and what does a day with no errors say?</p><p>Given:</p><ul><li>Prior: 1% of DIMMs in the fleet have a faulty device, and the other 99% are healthy</li><li>A faulty DIMM logs corrected errors as a Poisson process with mean 5 errors/day</li><li>A healthy DIMM logs corrected errors as a Poisson process with mean 0.02 errors/day</li><li>Poisson probabilities: \(P(N = k) = e^{-\lambda}\lambda^k / k!\) for mean \(\lambda\)</li><li>The two classes are the only possibilities, and the day's count depends only on the class</li></ul>`,
        a: String.raw`<ol class="steps"><li><strong>Likelihood of 2 errors if faulty.</strong> With mean 5 errors in the day, the Poisson formula at \(k = 2\) gives the chance of exactly 2.<div class="math chain"><span>\(\displaystyle P(2 \mid \text{faulty}) = e^{-5}\,\frac{5^2}{2!} \)</span><span>\(\displaystyle \approx 0.0842 \)</span></div></li><li><strong>Likelihood of 2 errors if healthy.</strong> The same formula with mean 0.02.<div class="math chain"><span>\(\displaystyle P(2 \mid \text{healthy}) = e^{-0.02}\,\frac{0.02^2}{2!} \)</span><span>\(\displaystyle \approx 1.960 \times 10^{-4} \)</span></div></li><li><strong>Combine with the prior in odds form.</strong> Posterior odds are the likelihood ratio times the prior odds. The day's 2 errors are about 430 times likelier from a faulty DIMM, while the prior odds favor a healthy one 99 to 1.<div class="math chain"><span>\(\displaystyle \frac{P(\text{faulty} \mid 2)}{P(\text{healthy} \mid 2)} = \frac{e^{-5} \times 5^2 / 2}{e^{-0.02} \times 0.02^2 / 2} \times \frac{0.01}{0.99} \)</span><span>\(\displaystyle \approx 429.6 \times 0.010101 \)</span><span>\(\displaystyle \approx 4.340 \)</span></div></li><li><strong>Convert odds to a probability.</strong><div class="math chain"><span>\(\displaystyle P(\text{faulty} \mid 2) = \frac{4.340}{1 + 4.340} \)</span><span>\(\displaystyle \approx \mathbf{0.81} \)</span></div>Two errors in a day move the DIMM from 1% to about 81%. That is strong evidence but not proof: about 1 in 5 DIMMs flagged on this evidence would be healthy.</li><li><strong>A day with no errors.</strong> The likelihoods are \(e^{-5} \approx 0.00674\) for a faulty DIMM and \(e^{-0.02} \approx 0.980\) for a healthy one.<div class="math chain"><span>\(\displaystyle \frac{P(\text{faulty} \mid 0)}{P(\text{healthy} \mid 0)} = \frac{e^{-5}}{e^{-0.02}} \times \frac{0.01}{0.99} \)</span><span>\(\displaystyle \approx 6.94 \times 10^{-5} \)</span></div>So \(P(\text{faulty} \mid 0) \approx \mathbf{6.9 \times 10^{-5}}\). A quiet day is strong evidence of health, because a faulty DIMM stays quiet for a whole day only 0.67% of the time.</li><li><strong>What it means for policy.</strong> Field studies of server DRAM (Schroeder, Pinheiro, and Weber, SIGMETRICS 2009) find corrected errors highly concentrated on a small share of DIMMs, which is the two-class picture used here. A replacement rule should be a threshold on the posterior, which here is a threshold on the count. A single error is weak evidence: its likelihood ratio is only \(e^{-5} \times 5 / (e^{-0.02} \times 0.02) \approx 1.72\), since a faulty DIMM usually logs more than 1, and the posterior stays near 1.7%. The second error is what carries the weight. Counts from separate days multiply their likelihood ratios when days are independent given the class, so 2 errors on each of 2 days give a posterior above 0.999.</li></ol>`
      }
    ]
  }
}, [
{
  id: "math-cond",
  region: "mprob",
  title: "Events and Conditional Probability",
  sections: [
    { id: "space", label: "Sample Spaces and Events" },
    { id: "cond", label: "Conditional Probability" },
    { id: "indep", label: "Independence" },
    { id: "total", label: "The Law of Total Probability" },
    { id: "bayes", label: "Bayes' Rule" },
    { id: "uses", label: "Where It Shows Up" },
    { id: "traps", label: "Common Traps" }
  ],
  body: String.raw`
<p>Conditional probability is how a chance changes when something is learned. Knowing that a load missed the L1D changes the chance that it also misses the L2. Knowing that a branch's confidence counter is low changes the chance that its prediction is wrong. Two rules do nearly all the work. The <strong>law of total probability</strong> builds an overall rate from the rates of the cases that make it up, and <strong>Bayes' rule</strong> turns "how often does the evidence appear when the cause is present" into "how often is the cause present when the evidence appears". Both follow in one line from the definition, and confusing the two directions of a conditional is the most common mistake in reading any detector, predictor, or filter.</p>

<h3 id="sec-space">Sample Spaces and Events</h3>
<p>A <strong>sample space</strong> \(\Omega\) is the set of everything that could happen in one run of an experiment, one <strong>outcome</strong> per possible result. An <strong>event</strong> is a set of outcomes, and it "happens" when the outcome lands in it. For two loads issued in the same cycle to an L1D with 8 banks, where each load's bank is uniform and independent of the other's, an outcome is the pair (bank of load 0, bank of load 1). There are \(8 \times 8 = 64\) outcomes, and the event "bank conflict" is the 8 pairs whose banks match.</p>
<p>A <strong>probability</strong> assigns each event a number and obeys three axioms (Kolmogorov's).</p>
<ul>
<li>\(P(A) \ge 0\) for every event \(A\).</li>
<li>\(P(\Omega) = 1\).</li>
<li>If \(A\) and \(B\) are disjoint (they share no outcome), then \(P(A \cup B) = P(A) + P(B)\), and the same holds for any countable list of pairwise disjoint events.</li>
</ul>
<p>When every outcome is equally likely, these reduce to counting: \(P(A) = |A| / |\Omega|\). The conflict chance for the two loads is \(8/64 = 1/8\). Everything else is derived from the axioms. The <strong>complement</strong> \(\bar A\) (outcomes not in \(A\)) is disjoint from \(A\) and together they make \(\Omega\), so \(P(\bar A) = 1 - P(A)\). For two events that overlap, split \(A \cup B\) into the disjoint pieces \(A\) and \(B \setminus A\), and split \(B\) into \(B \setminus A\) and \(A \cap B\).</p>
<div class="math chain"><span>\(\displaystyle P(A \cup B) = P(A) + P(B \setminus A) \)</span><span>\(\displaystyle = P(A) + P(B) - P(A \cap B) \)</span></div>
<p>This is <strong>inclusion-exclusion</strong> for two events: adding \(P(A)\) and \(P(B)\) counts the overlap twice, so subtract it once. Dropping the overlap term gives the <strong>union bound</strong>, \(P(A \cup B) \le P(A) + P(B)\), and by induction \(P(A_1 \cup \cdots \cup A_n) \le \sum P(A_i)\). The union bound needs no independence at all, which makes it the standard first estimate of "the chance that anything goes wrong" across many components.</p>

<h3 id="sec-cond">Conditional Probability</h3>
<p>Learning that \(B\) happened rules out every outcome outside \(B\). What is left is a smaller sample space, \(B\) itself, and the chances inside it have to be rescaled so they add to 1 again. The chance of \(A\) given \(B\) is the share of \(B\)'s probability that also lies in \(A\).</p>
<div class="math chain"><span>\(\displaystyle P(A \mid B) = \frac{P(A \cap B)}{P(B)}, \quad P(B) > 0 \)</span></div>
<p>Multiplying through gives the <strong>multiplication rule</strong>, which is how joint chances are usually built: first the chance of \(B\), then the chance of \(A\) once \(B\) is known.</p>
<div class="math chain"><span>\(\displaystyle P(A \cap B) = P(A \mid B)\,P(B) \)</span><span>\(\displaystyle = P(B \mid A)\,P(A) \)</span></div>
<p>Applied repeatedly, it becomes the <strong>chain rule</strong>: the chance that a sequence of events all happen is the first one's chance times each later one's chance given all the earlier ones. For three events it reads as follows, and longer lists add one factor per event.</p>
<div class="math chain"><span>\(\displaystyle P(A_1 \cap A_2 \cap A_3) \)</span><span>\(\displaystyle = P(A_1)\,P(A_2 \mid A_1)\,P(A_3 \mid A_1 \cap A_2) \)</span></div>
<p><strong>Three loads, 16 banks.</strong> Suppose 3 loads issue together to an L1D with 16 banks, each bank uniform and independent. "No conflict" means load 1 avoids load 0's bank and load 2 avoids both earlier banks. Given that the earlier loads used distinct banks, load 1 has 15 safe banks out of 16 and load 2 has 14.</p>
<div class="math chain"><span>\(\displaystyle P(\text{no conflict}) = \frac{16}{16} \times \frac{15}{16} \times \frac{14}{16} \)</span><span>\(\displaystyle = \frac{105}{128} \)</span><span>\(\displaystyle \approx 0.820 \)</span></div>
<p>So about 18% of such cycles see a conflict. The union bound over the 3 pairs of loads gives \(3 \times 1/16 = 18.75\%\), a little high because it counts a cycle where all three loads share a bank three times. The product form is the birthday problem, and the probability region's last page works out how it scales with the bank count.</p>
<p><strong>Local and global miss rates.</strong> A cache's <em>local</em> miss rate is a conditional probability. The L2's local miss rate is \(P(\text{L2 miss} \mid \text{L1 miss})\), because the L2 only sees the accesses that missed in the L1. The global rate, misses that reach memory per access, is a joint probability, and the multiplication rule connects them. With an L1D miss rate of 0.04 per access and an L2 local miss rate of 0.3, the share of accesses that miss both is \(0.04 \times 0.3 = 0.012\). The same product over every level is the telescoping product on <a href="#/math-tele/products">Telescoping Products</a>.</p>

<h3 id="sec-indep">Independence</h3>
<p>Events \(A\) and \(B\) are <strong>independent</strong> when learning one says nothing about the other: \(P(A \mid B) = P(A)\). Substituting the definition of the conditional gives the symmetric form, which also covers \(P(B) = 0\).</p>
<div class="math chain"><span>\(\displaystyle \frac{P(A \cap B)}{P(B)} = P(A) \)</span><span>\(\displaystyle \Leftrightarrow\ P(A \cap B) = P(A)\,P(B) \)</span></div>
<p>A list of events is <strong>mutually independent</strong> when the product rule holds for every sub-collection, not just every pair. Pairwise independence is weaker. Take two independent fair bits \(x\) and \(y\) and the parity \(z = x \oplus y\). Any two of the three are independent (knowing \(x\) says nothing about \(z\)), but all three together are not, since any two determine the third: \(P(x = 1, y = 1, z = 1) = 0\), not \(1/8\). Parity and hash bits built from XORs are exactly where this distinction matters.</p>
<p><strong>Independent is not disjoint.</strong> Disjoint events with positive chances are as dependent as events can be: if one happens, the other cannot, so \(P(A \mid B) = 0 \ne P(A)\). "A load hits in the L1D" and "the same load misses in the L1D" are disjoint, and learning either one settles the other.</p>
<p><strong>Where independence is assumed, and where it fails.</strong> Error-correcting code math assumes independent bit flips, and that is reasonable for particle strikes on cells far apart, but not for a single strike that upsets neighboring cells (which is why physical bit interleaving spreads one word's bits apart). Branch outcomes are the classic failure: branches are strongly dependent on recent branches, and that dependence is exactly what history-based predictors exploit. Assuming independent mispredictions underestimates how often they cluster, since a hard-to-predict region produces several in a row.</p>

<h3 id="sec-total">The Law of Total Probability</h3>
<p>Split the sample space into cases \(B_1, \ldots, B_n\) that are disjoint and cover everything (a <strong>partition</strong>). Then \(A\) splits into the disjoint pieces \(A \cap B_i\), additivity adds them, and the multiplication rule rewrites each piece.</p>
<div class="math chain"><span>\(\displaystyle P(A) = \sum_{i=1}^{n} P(A \cap B_i) \)</span><span>\(\displaystyle = \sum_{i=1}^{n} P(A \mid B_i)\,P(B_i) \)</span></div>
<p>It says that an overall rate is the weighted average of the per-case rates, weighted by how common each case is. That is how a misprediction rate, a miss rate, or an average latency is assembled from classes, and it shows at once which class dominates.</p>
<p><strong>Misprediction by branch class.</strong> Suppose the dynamic branches of a workload fall into three classes.</p>
<table>
<tr><th>Class</th><th>Share of branches</th><th>Misprediction rate</th><th>Contribution</th></tr>
<tr><td>Loop and strongly biased</td><td>0.7</td><td>0.005</td><td>0.0035</td></tr>
<tr><td>Correlated with history</td><td>0.2</td><td>0.04</td><td>0.008</td></tr>
<tr><td>Data-dependent</td><td>0.1</td><td>0.2</td><td>0.02</td></tr>
</table>
<p>The overall rate is the sum of the contributions.</p>
<div class="math chain"><span>\(\displaystyle P(\text{mispredict}) = 0.7 \times 0.005 + 0.2 \times 0.04 + 0.1 \times 0.2 \)</span><span>\(\displaystyle = 0.0315 \)</span></div>
<p>The data-dependent tenth of the branches causes \(0.02 / 0.0315 \approx 63\%\) of the mispredictions. Halving the misprediction rate of the easy 70% would cut the total by only 0.00175, about 6%. The law of total probability turns "where should predictor storage go" into arithmetic.</p>
<p>The same decomposition works for averages (the law of total expectation): an average load latency is the hit latency of each level weighted by the share of loads served there, which is the usual average memory access time.</p>

<h3 id="sec-bayes">Bayes' Rule</h3>
<p>The multiplication rule writes \(P(A \cap B)\) two ways. Setting them equal and dividing by \(P(A)\) reverses the conditional.</p>
<div class="math chain"><span>\(\displaystyle P(B \mid A)\,P(A) = P(A \cap B) \)</span><span>\(\displaystyle = P(A \mid B)\,P(B) \)</span><span>\(\displaystyle \Rightarrow\ P(B \mid A) = \frac{P(A \mid B)\,P(B)}{P(A)} \)</span></div>
<p>Read \(B\) as a hidden cause and \(A\) as the evidence. \(P(B)\) is the <strong>prior</strong>, the chance of the cause before looking. \(P(A \mid B)\) is the <strong>likelihood</strong>, how often the evidence shows up when the cause is there. \(P(B \mid A)\) is the <strong>posterior</strong>. The denominator usually comes from the law of total probability over "cause" and "no cause".</p>
<div class="math chain"><span>\(\displaystyle P(B \mid A) = \frac{P(A \mid B)\,P(B)}{P(A \mid B)\,P(B) + P(A \mid \bar B)\,P(\bar B)} \)</span></div>
<p><strong>Odds form.</strong> Write Bayes' rule for \(B\) and for \(\bar B\) and divide. The shared denominator \(P(A)\) cancels, leaving posterior odds equal to the likelihood ratio times the prior odds.</p>
<div class="math chain"><span>\(\displaystyle \frac{P(B \mid A)}{P(\bar B \mid A)} = \frac{P(A \mid B)}{P(A \mid \bar B)} \cdot \frac{P(B)}{P(\bar B)} \)</span></div>
<p>The odds form is the one to reach for in your head. A detector whose alarm is 5 times likelier under the cause than without it multiplies the odds by 5, whatever the prior. Independent pieces of evidence (independent given the cause) multiply their likelihood ratios.</p>
<p><strong>Branch confidence estimation.</strong> A confidence estimator (Jacobsen, Rotenberg, and Smith, MICRO 1996) attaches a "high" or "low" label to each branch prediction, usually from a resetting counter that tracks how many recent predictions of that branch were correct. Low-confidence branches can gate fetch to save energy on the wrong path (pipeline gating, Manne, Klauser, and Grunwald, ISCA 1998), pick which SMT thread to fetch from, or trigger fetching both paths. Suppose the predictor is wrong 4% of the time, the estimator labels 75% of the wrong predictions low, and it also labels 15% of the correct ones low. What fraction of low-confidence predictions are actually wrong?</p>
<div class="math chain"><span>\(\displaystyle P(\text{wrong} \mid \text{low}) = \frac{0.75 \times 0.04}{0.75 \times 0.04 + 0.15 \times 0.96} \)</span><span>\(\displaystyle = \frac{0.03}{0.174} \)</span><span>\(\displaystyle \approx 0.172 \)</span></div>
<p>The estimator catches three quarters of the mispredictions, yet only about 1 low-confidence label in 6 is a real misprediction, because correct predictions outnumber wrong ones 24 to 1 and even a 15% false-label rate on them swamps the true labels. In odds form: the likelihood ratio is \(0.75 / 0.15 = 5\), the prior odds are \(0.04 / 0.96 = 1/24\), and the posterior odds are \(5/24\), which is a probability of \(5/29 \approx 0.172\). Grunwald, Klauser, Manne, and Pleszkun (ISCA 1998) call this the predictive value of a negative (PVN), and the share of mispredictions caught is the estimator's specificity (SPEC). This is why pipeline gating waits until more than one low-confidence branch is in flight before it stalls fetch. Gating on a single one would stall a correct path 5 times in 6.</p>
<p>The other direction is reassuring. Here \(P(\text{high}) = 0.85 \times 0.96 + 0.25 \times 0.04 = 0.826\), and the chance a high-confidence prediction is correct is \(0.816 / 0.826 \approx 0.988\), so the high label is trustworthy even though the low label is not. In the same paper's terms, this example has a sensitivity (SENS) of 0.85 and a predictive value of a positive (PVP) of 0.988.</p>

<h3 id="sec-uses">Where It Shows Up</h3>
<ul>
<li><strong>Hierarchy miss rates.</strong> Local miss rates are conditional on reaching a level, global miss rates are joint, and the multiplication rule converts between them. MPKI per level is a global count, so a level with a high local miss rate can still produce few misses if little reaches it.</li>
<li><strong>Prefetch accuracy and coverage.</strong> Accuracy is \(P(\text{used} \mid \text{prefetched})\) and coverage is \(P(\text{prefetched} \mid \text{would have missed})\). They are the two directions of one conditional, linked by Bayes' rule through the counts of prefetches and of misses, which is why an aggressive prefetcher can raise coverage while its accuracy falls.</li>
<li><strong>Confidence and filtering.</strong> Branch confidence estimators, memory dependence predictors, dead-block predictors, and hit/miss predictors all label events with an imperfect signal. Their usefulness depends on the posterior, and the posterior depends on the base rate as much as on the signal quality.</li>
<li><strong>Alarms and monitors.</strong> Error-rate monitors, thermal and voltage-droop detectors, and counter-based security monitors raise alarms on rare causes. A low per-check false-alarm rate times many checks per second can still mean most alarms are false.</li>
<li><strong>Bank and set conflicts.</strong> Uniform-and-independent address models turn conflict questions into counting, through the chain rule.</li>
<li><strong>Breaking down a rate.</strong> Any overall rate (mispredictions, misses, stall cycles) built from classes is the law of total probability, and the per-class contributions say where to spend effort.</li>
</ul>

<h3 id="sec-traps">Common Traps</h3>
<ul>
<li><strong>Reversing the conditional.</strong> \(P(A \mid B)\) and \(P(B \mid A)\) can be wildly different. "The estimator flags 75% of mispredictions" is not "75% of flags are mispredictions". Bayes' rule is the only way to convert, and it needs the base rate.</li>
<li><strong>Ignoring the base rate.</strong> When the cause is rare, the false-positive rate on the common case decides the posterior. A rare cause needs a likelihood ratio far above 1 before an alarm means much.</li>
<li><strong>The wrong denominator.</strong> Per-access, per-miss, and per-instruction rates are conditionals on different events. Multiplying a per-miss rate by an access count, or adding local miss rates across levels, mixes denominators.</li>
<li><strong>Independent is not disjoint.</strong> Disjoint events with positive chances are dependent. Independent events overlap, with \(P(A \cap B) = P(A)\,P(B)\).</li>
<li><strong>Pairwise is not mutual.</strong> Checking every pair does not show that three or more events are independent, as the parity example shows.</li>
<li><strong>Assuming independence by default.</strong> Branch outcomes, cache misses, and multi-bit upsets cluster. Independence makes the math easy, and the answer is only as good as that assumption.</li>
</ul>
`,
  practice: {
    guided: [
      {
        q: String.raw`<p>A memory dependence predictor decides which loads must wait for older stores. How often are its "wait" predictions right, how many loads per 1000 wait without needing to, and how many cause ordering violations?</p><p>Given:</p><ul><li>2% of loads truly depend on an older in-flight store</li><li>The predictor marks 95% of the truly dependent loads "wait"</li><li>It also marks 3% of the independent loads "wait"</li><li>A load marked "wait" stalls until the older stores resolve</li><li>A dependent load not marked "wait" issues early and causes an ordering violation (a pipeline flush)</li></ul>`,
        a: String.raw`<ol class="steps"><li><strong>Share of loads marked "wait".</strong> Split the loads into dependent and independent and apply the law of total probability.<div class="math chain"><span>\(\displaystyle P(\text{wait}) = 0.95 \times 0.02 + 0.03 \times (1 - 0.02) \)</span><span>\(\displaystyle = 0.019 + 0.0294 \)</span><span>\(\displaystyle = 0.0484 \)</span></div></li><li><strong>How often a "wait" is right.</strong> Bayes' rule: the dependent loads marked "wait" over all loads marked "wait".<div class="math chain"><span>\(\displaystyle P(\text{dependent} \mid \text{wait}) = \frac{0.95 \times 0.02}{0.0484} \)</span><span>\(\displaystyle = \frac{0.019}{0.0484} \)</span><span>\(\displaystyle \approx \mathbf{0.393} \)</span></div>Only about 39% of the stalls are needed, even though the predictor catches 95% of the dependences and falsely flags only 3% of the rest. Independent loads outnumber dependent ones 49 to 1, so their small false-flag rate produces more flags than the real dependences do.</li><li><strong>Unneeded waits per 1000 loads.</strong> These are the independent loads marked "wait".<div class="math chain"><span>\(\displaystyle \text{waits} = 0.03 \times (1 - 0.02) \times 1000\ \text{loads} \)</span><span>\(\displaystyle = \mathbf{29.4}\ \textbf{per 1000 loads} \)</span></div></li><li><strong>Violations per 1000 loads.</strong> These are the dependent loads not marked "wait", 5% of the 2%.<div class="math chain"><span>\(\displaystyle \text{violations} = (1 - 0.95) \times 0.02 \times 1000\ \text{loads} \)</span><span>\(\displaystyle = \mathbf{1}\ \textbf{per 1000 loads} \)</span></div></li><li><strong>Reading the trade-off.</strong> A violation costs a flush of roughly a branch misprediction's size, and an unneeded wait costs only the time until the older stores' addresses resolve. That is why real predictors (store sets, Chrysos and Emer, ISCA 1998) lean toward waiting and periodically clear their tables so that stale "wait" marks do not pile up. A load issued early is very safe here: \(P(\text{dependent} \mid \text{no wait}) = 0.001 / 0.9516 \approx 0.0011\).</li></ol>`
      }
    ],
    interview: [
      {
        q: String.raw`<p>A counter-based monitor checks every time window for signs of a cache side-channel attack. When it raises an alarm, how likely is an attack to be running, how many false alarms per hour does it produce, and what changes if a second detector must agree?</p><p>Given:</p><ul><li>Window length: 10 ms, checked back to back, so 360,000 windows/hour</li><li>An attack is running in 1 window in 10,000</li><li>Detector A alarms in 99% of attack windows and in 0.5% of clean windows</li><li>Detector B, built on different counters, has the same two rates</li><li>Given whether a window holds an attack, A's and B's alarms are independent</li><li>The combined rule alarms only when both A and B alarm in the same window</li></ul>`,
        a: String.raw`<ol class="steps"><li><strong>Chance of an alarm.</strong> The law of total probability over attack and clean windows.<div class="math chain"><span>\(\displaystyle P(\text{A}) = 0.99 \times 10^{-4} + 0.005 \times (1 - 10^{-4}) \)</span><span>\(\displaystyle = 5.0985 \times 10^{-3} \)</span></div></li><li><strong>Posterior for one detector.</strong> Bayes' rule: the attack windows that alarm over all windows that alarm.<div class="math chain"><span>\(\displaystyle P(\text{attack} \mid \text{A}) = \frac{0.99 \times 10^{-4}}{5.0985 \times 10^{-3}} \)</span><span>\(\displaystyle \approx \mathbf{0.0194} \)</span></div>Fewer than 2 alarms in 100 are real, although detector A sounds excellent on paper.</li><li><strong>False alarms per hour.</strong> Clean windows times the false-alarm rate.<div class="math chain"><span>\(\displaystyle \frac{360{,}000\ \text{windows}}{1\ \text{hour}} \times (1 - 10^{-4}) \times 0.005 \)</span><span>\(\displaystyle \approx \mathbf{\frac{1800\ \textbf{false alarms}}{1\ \textbf{hour}}} \)</span></div>That is one every 2 seconds, against \(360{,}000 \times 0.99 \times 10^{-4} \approx 35.6\) attack windows flagged per hour.</li><li><strong>Two detectors in odds form.</strong> Because the alarms are independent given the window's state, the likelihood ratios multiply. Each detector's ratio is \(0.99 / 0.005 = 198\).<div class="math chain"><span>\(\displaystyle \frac{P(\text{attack} \mid \text{A}, \text{B})}{P(\text{clean} \mid \text{A}, \text{B})} = \left(\frac{0.99}{0.005}\right)^{2} \times \frac{10^{-4}}{1 - 10^{-4}} \)</span><span>\(\displaystyle = 39{,}204 \times 1.0001 \times 10^{-4} \)</span><span>\(\displaystyle \approx 3.921 \)</span></div></li><li><strong>Back to a probability.</strong><div class="math chain"><span>\(\displaystyle P(\text{attack} \mid \text{A}, \text{B}) = \frac{3.921}{1 + 3.921} \)</span><span>\(\displaystyle \approx \mathbf{0.797} \)</span></div></li><li><strong>Cost of requiring both.</strong> False alarms fall by another factor of 200, and detection falls only from 99% to \(0.99^2 \approx 98\%\) of attack windows.<div class="math chain"><span>\(\displaystyle \frac{360{,}000\ \text{windows}}{1\ \text{hour}} \times (1 - 10^{-4}) \times 0.005^{2} \)</span><span>\(\displaystyle \approx \mathbf{\frac{9\ \textbf{false alarms}}{1\ \textbf{hour}}} \)</span></div></li><li><strong>The assumption that carries it.</strong> Everything in steps 3 to 5 depends on conditional independence. If both detectors watch counters that react to the same benign event (a co-running streaming job thrashing the LLC), their false alarms coincide, the product rule fails, and the combined rate could stay near 1800 per hour. The real check is to measure \(P(\text{B} \mid \text{A}, \text{clean})\) directly. An attack also spans many consecutive windows, so a rule such as "alarm in 3 of 5 windows" buys a similar gain from time instead of from a second detector, with the same caveat that false alarms from one benign phase are correlated in time.</li></ol>`
      }
    ]
  }
},
{
  id: "math-rv",
  region: "mprob",
  title: "Random Variables, Expectation, and Variance",
  sections: [
    { id: "def", label: "Random Variables and Expectation" },
    { id: "linear", label: "Linearity of Expectation" },
    { id: "indicators", label: "Counting With Indicator Variables" },
    { id: "variance", label: "Variance and Standard Deviation" },
    { id: "cov", label: "Covariance and Correlation" },
    { id: "sum", label: "The Variance of a Sum" },
    { id: "uses", label: "Where It Shows Up" },
    { id: "traps", label: "Common Traps" }
  ],
  body: String.raw`
<p>Most quantities in a performance model are numbers that come out of a random process: the latency of a load, the number of mispredictions in an interval, the cycles an interval takes. A random variable is such a number, and two summaries of it carry most of the weight. The <strong>expectation</strong> is its long-run average, and it adds across a sum with no conditions at all, which turns hard counting problems into sums of simple probabilities. The <strong>variance</strong> measures how far it wanders from that average, and it adds across a sum only when the parts are uncorrelated. Correlated parts, such as mispredictions that cluster, make totals noisier than independent arithmetic predicts.</p>

<h3 id="sec-def">Random Variables and Expectation</h3>
<p>A <strong>random variable</strong> \(X\) is a rule that assigns a number to every outcome. Its <strong>distribution</strong> lists the values it can take and their chances, \(P(X = x)\), which is called the probability mass function when the values are discrete. The <strong>expectation</strong> (mean) is the average of the values weighted by their chances.</p>
<div class="math chain"><span>\(\displaystyle E[X] = \sum_x x\, P(X = x) \)</span></div>
<p>It is the number the running average of many independent copies settles on. For a function of \(X\), weight the function's values by the same chances, \(E[g(X)] = \sum_x g(x)\,P(X = x)\), with no need to find the distribution of \(g(X)\) first.</p>
<p><strong>Load latency as a random variable.</strong> Let \(X\) be the latency of a load picked at random from a program's loads.</p>
<table>
<tr><th>Served by</th><th>Latency</th><th>Chance</th><th>Latency times chance</th></tr>
<tr><td>L1D</td><td>4 cycles</td><td>0.95</td><td>3.8 cycles</td></tr>
<tr><td>L2</td><td>14 cycles</td><td>0.035</td><td>0.49 cycles</td></tr>
<tr><td>L3</td><td>50 cycles</td><td>0.012</td><td>0.6 cycles</td></tr>
<tr><td>DRAM</td><td>300 cycles</td><td>0.003</td><td>0.9 cycles</td></tr>
</table>
<p>Adding the last column gives the mean.</p>
<div class="math chain"><span>\(\displaystyle E[X] = 3.8 + 0.49 + 0.6 + 0.9\ \text{cycles} \)</span><span>\(\displaystyle = 5.79\ \text{cycles} \)</span></div>
<p>This is the average memory access time, and the table shows the expectation is the law of total probability applied to averages. The 0.3% of loads served by DRAM add 0.9 cycles, more than the 3.5% served by the L2.</p>

<h3 id="sec-linear">Linearity of Expectation</h3>
<p>For any two random variables on the same sample space, the expectation of the sum is the sum of the expectations. The proof only regroups a double sum over the joint distribution, written \(p(x, y) = P(X = x, Y = y)\). Summing the joint chances over \(y\) leaves \(P(X = x)\), and summing over \(x\) leaves \(P(Y = y)\).</p>
<div class="math chain"><span>\(\displaystyle E[X + Y] = \sum_{x, y} (x + y)\, p(x, y) \)</span><span>\(\displaystyle = \sum_{x} x \sum_{y} p(x, y) + \sum_{y} y \sum_{x} p(x, y) \)</span><span>\(\displaystyle = \sum_{x} x\, P(X = x) + \sum_{y} y\, P(Y = y) \)</span><span>\(\displaystyle = E[X] + E[Y] \)</span></div>
<p>Nothing in the proof asks whether \(X\) and \(Y\) are independent. The joint distribution can be anything, because it is summed away. With constants pulled out the same way, \(E[aX + b] = a\,E[X] + b\), and by induction the result covers any finite sum.</p>
<div class="math chain"><span>\(\displaystyle E\Bigl[\sum_{i} a_i X_i\Bigr] = \sum_{i} a_i\, E[X_i] \)</span></div>
<p><strong>CPI stacks are linearity.</strong> The cycles per instruction of a run are a base cost plus, for each kind of event, the events per instruction times the cycles each one exposes. Each term is the expectation of a different random count, and the counts are far from independent (a misprediction can trigger wrong-path misses), yet the expected total is still the sum of the terms. With a base CPI of 0.3, 0.008 mispredictions per instruction at 15 cycles each, and 0.002 LLC misses per instruction at 200 cycles each with half the latency hidden by overlap, the CPI is \(0.3 + 0.008 \times 15 + 0.002 \times 200 \times 0.5 = 0.62\). What linearity does not give is the right exposed cost per event. Overlap between events is where real CPI stacks need care.</p>
<p><strong>Products are not linear.</strong> \(E[XY] = E[X]\,E[Y]\) needs the variables to be uncorrelated (independence is enough). And \(E[g(X)] \ne g(E[X])\) for a curved \(g\). For the load latency above, \(E[1/X] \approx 0.240\) per cycle while \(1/E[X] \approx 0.173\) per cycle. Averaging rates and averaging times give different answers, which is the root of the arithmetic versus harmonic mean question in measurement.</p>

<h3 id="sec-indicators">Counting With Indicator Variables</h3>
<p>The <strong>indicator</strong> of an event \(A\) is the random variable \(I_A\) that is 1 when \(A\) happens and 0 otherwise. Its expectation is the event's probability.</p>
<div class="math chain"><span>\(\displaystyle E[I_A] = 1 \cdot P(A) + 0 \cdot P(\bar A) \)</span><span>\(\displaystyle = P(A) \)</span></div>
<p>Any count is a sum of indicators, one per thing that might be counted, so its expectation is a sum of probabilities.</p>
<div class="math chain"><span>\(\displaystyle E[\text{count}] = \sum_{i} P(A_i) \)</span></div>
<p>This is the most useful trick in the region. It never needs the distribution of the count, and the events can depend on each other in any way.</p>
<ul>
<li><strong>Expected misses.</strong> If access \(i\) misses with probability \(m_i\), the expected miss count is \(\sum m_i\), whether misses cluster or not. An analytical cache model only has to estimate each access's miss chance (from reuse distance, for example) and add.</li>
<li><strong>Conflicting pairs.</strong> For 3 loads to 16 uniform banks, give each of the 3 pairs an indicator for "same bank", each with chance \(1/16\). The expected number of conflicting pairs is \(3/16 = 0.1875\), exactly, even though the pairs share loads. The chance of at least one conflict is \(1 - 105/128 \approx 0.180\), a little lower, because a count's chance of being at least 1 can never exceed its mean when the count takes whole values (Markov's inequality, \(P(N \ge 1) \le E[N]\)).</li>
<li><strong>Distinct banks touched.</strong> Bank \(b\) is untouched by all 3 loads with probability \((15/16)^3\). Summing the "touched" indicators over the 16 banks gives \(16\,(1 - (15/16)^3) \approx 2.816\) distinct banks on average.</li>
<li><strong>Records.</strong> Item \(k\) of a random sequence (counting from 1) is a new maximum with chance \(1/k\), so the expected number of records is the harmonic number \(H_n\) (<a href="#/math-harm/collector">Waiting for the Last New Item</a> uses the same move for the coupon collector).</li>
</ul>

<h3 id="sec-variance">Variance and Standard Deviation</h3>
<p>The <strong>variance</strong> is the expected squared distance from the mean, written with \(\mu = E[X]\). Its square root, the <strong>standard deviation</strong> \(\sigma\), is in the same units as \(X\).</p>
<div class="math chain"><span>\(\displaystyle \mathrm{Var}(X) = E\bigl[(X - \mu)^2\bigr] \)</span></div>
<p>Expanding the square and using linearity gives the shortcut used for almost every calculation: the mean of the square minus the square of the mean.</p>
<div class="math chain"><span>\(\displaystyle \mathrm{Var}(X) = E[X^2] - 2\mu\,E[X] + \mu^2 \)</span><span>\(\displaystyle = E[X^2] - \mu^2 \)</span></div>
<p>Shifting \(X\) by a constant does not change its spread, and scaling it scales the spread: \(\mathrm{Var}(aX + b) = a^2\,\mathrm{Var}(X)\). An indicator has \(E[I^2] = E[I] = p\), so its variance is \(p - p^2 = p(1-p)\), largest at \(p = 1/2\).</p>
<p><strong>The load latency again.</strong> The mean of the square weights each squared latency by its chance: \(4^2 \times 0.95 = 15.2\), \(14^2 \times 0.035 = 6.86\), \(50^2 \times 0.012 = 30\), and \(300^2 \times 0.003 = 270\), all in cycles squared.</p>
<div class="math chain"><span>\(\displaystyle E[X^2] = 15.2 + 6.86 + 30 + 270\ \text{cycles}^2 \)</span><span>\(\displaystyle = 322.06\ \text{cycles}^2 \)</span></div>
<div class="math chain"><span>\(\displaystyle \mathrm{Var}(X) = 322.06\ \text{cycles}^2 - (5.79\ \text{cycles})^2 \)</span><span>\(\displaystyle = 288.5359\ \text{cycles}^2 \)</span><span>\(\displaystyle \Rightarrow\ \sigma \approx 16.99\ \text{cycles} \)</span></div>
<p>The standard deviation is three times the mean, and 84% of \(E[X^2]\) comes from the 0.3% of loads that reach DRAM. Rare, long events dominate variance far more than they dominate the mean, because their size enters squared. This is why tail latency and run-to-run noise are driven by the memory system even when the average looks like an L1 hit.</p>

<h3 id="sec-cov">Covariance and Correlation</h3>
<p>The <strong>covariance</strong> measures whether two variables tend to sit above their means together. Expanding it the same way as the variance gives the shortcut.</p>
<div class="math chain"><span>\(\displaystyle \mathrm{Cov}(X, Y) = E\bigl[(X - \mu_X)(Y - \mu_Y)\bigr] \)</span><span>\(\displaystyle = E[XY] - \mu_X\,\mu_Y \)</span></div>
<p>The variance is the covariance of a variable with itself. If \(X\) and \(Y\) are independent, the joint chances factor, so \(E[XY] = E[X]\,E[Y]\) and the covariance is 0. The converse fails: take \(X\) equal to \(-1\), 0, or 1 with chance \(1/3\) each and \(Y = X^2\). Then \(E[XY] = E[X^3] = 0\) and \(E[X] = 0\), so the covariance is 0, yet \(Y\) is a function of \(X\). Covariance detects only linear association.</p>
<p>Dividing by both standard deviations gives the <strong>correlation coefficient</strong>, which has no units and always lies between \(-1\) and 1 (by the Cauchy-Schwarz inequality), reaching the ends only when one variable is an exact linear function of the other.</p>
<div class="math chain"><span>\(\displaystyle \rho_{XY} = \frac{\mathrm{Cov}(X, Y)}{\sigma_X\,\sigma_Y} \)</span></div>
<p>For two indicators, the covariance has a direct reading: \(\mathrm{Cov}(I_A, I_B) = P(A \cap B) - P(A)\,P(B)\), which is positive exactly when \(A\) makes \(B\) more likely.</p>

<h3 id="sec-sum">The Variance of a Sum</h3>
<p>Expand the square of the centered sum. The squared terms give the variances, and the cross terms give every covariance twice.</p>
<div class="math chain"><span>\(\displaystyle \mathrm{Var}\Bigl(\sum_{i} X_i\Bigr) = E\Bigl[\Bigl(\sum_{i} (X_i - \mu_i)\Bigr)^2\Bigr] \)</span><span>\(\displaystyle = \sum_{i} \mathrm{Var}(X_i) + 2\sum_{i < j} \mathrm{Cov}(X_i, X_j) \)</span></div>
<p>If the variables are uncorrelated (in particular, if they are independent), the covariances vanish and the variances simply add. That has a consequence worth memorizing. For \(n\) independent copies of a variable with mean \(\mu\) and standard deviation \(\sigma\), the sum has mean \(n\mu\) but standard deviation only \(\sigma\sqrt{n}\), so the relative spread shrinks like \(1/\sqrt{n}\).</p>
<div class="math chain"><span>\(\displaystyle \frac{\sigma_{\text{sum}}}{\mu_{\text{sum}}} = \frac{\sigma\sqrt{n}}{n\mu} \)</span><span>\(\displaystyle = \frac{\sigma}{\mu\sqrt{n}} \)</span></div>
<p>Over 1,000,000 branches that each mispredict independently with chance 0.02, the count has mean 20,000 and standard deviation \(\sqrt{10^6 \times 0.02 \times 0.98} = 140\), a relative spread of 0.7%. This \(\sqrt{n}\) law is what makes sampled simulation work: averaging many short samples converges on the true mean.</p>
<p><strong>Correlation undoes it.</strong> If \(n\) variables each have variance \(\sigma^2\) and every pair has correlation \(\rho\), there are \(n(n-1)/2\) pairs, and the sum's variance becomes the following.</p>
<div class="math chain"><span>\(\displaystyle \mathrm{Var}\Bigl(\sum_{i=1}^{n} X_i\Bigr) = n\sigma^2 + n(n-1)\,\rho\,\sigma^2 \)</span><span>\(\displaystyle = n\sigma^2\,\bigl(1 + (n-1)\rho\bigr) \)</span></div>
<p>With \(n = 10^4\) and a correlation of only \(\rho = 0.01\), the factor \(1 + (n-1)\rho\) is about 101, so the standard deviation is about 10 times what independence predicts. Programs have phases, so per-interval measurements are positively correlated, and a naive \(\sigma/\sqrt{n}\) error bar is far too optimistic unless the samples are spread out enough to decorrelate them. Negative correlation works the other way, which is why balancing loads across banks or interleaving antithetic samples reduces variance.</p>

<h3 id="sec-uses">Where It Shows Up</h3>
<ul>
<li><strong>Average memory access time and CPI stacks.</strong> Both are expectations built by linearity from per-event rates and per-event costs.</li>
<li><strong>Analytical cache and predictor models.</strong> Expected misses, conflicts, or aliasing events are sums of per-access or per-pair probabilities, with indicators doing the counting.</li>
<li><strong>Tail latency.</strong> Variance and the squared contributions of rare events explain why a small DRAM share sets the spread of load latency and of request latency in a server.</li>
<li><strong>Sampled simulation.</strong> SMARTS-style sampling relies on the \(1/\sqrt{n}\) shrinking of the relative error, and on the samples being far enough apart to be nearly uncorrelated.</li>
<li><strong>Run-to-run noise.</strong> A benchmark's time is a sum of phase times. Shared state (frequency, temperature, a noisy neighbor) correlates the phases and inflates the variance of the total.</li>
<li><strong>Bursty events.</strong> Correlated mispredictions or misses keep the same mean count but widen its spread, which matters for queue sizing and for how many samples a measurement needs.</li>
</ul>

<h3 id="sec-traps">Common Traps</h3>
<ul>
<li><strong>Linearity needs no independence, variance does.</strong> \(E[X + Y] = E[X] + E[Y]\) always. \(\mathrm{Var}(X + Y) = \mathrm{Var}(X) + \mathrm{Var}(Y)\) only when the covariance is 0.</li>
<li><strong>Differences add variance.</strong> \(\mathrm{Var}(X - Y) = \mathrm{Var}(X) + \mathrm{Var}(Y) - 2\,\mathrm{Cov}(X, Y)\). For independent runs the variances add, so the difference of two noisy measurements is noisier than either one. Pairing runs on the same inputs makes the covariance positive and shrinks the noise of the difference.</li>
<li><strong>The mean of a function is not the function of the mean.</strong> \(E[1/X] \ne 1/E[X]\), so averaging IPCs and inverting is not averaging CPIs.</li>
<li><strong>Zero covariance is not independence.</strong> \(Y = X^2\) with \(X\) symmetric about 0 has zero covariance with \(X\).</li>
<li><strong>Standard deviation does not add.</strong> For independent parts, add the variances and then take the square root. Adding standard deviations overstates the spread.</li>
<li><strong>Units of variance.</strong> Variance is in squared units (cycles squared). Compare standard deviations with means, never variances.</li>
</ul>
`,
  practice: {
    guided: [
      {
        q: String.raw`<p>A hash join probes a hash table at random. How many distinct 4 KiB pages of the table should the probes be expected to touch, and how many probes land on a page that an earlier probe already touched?</p><p>Given:</p><ul><li>Hash table: 2 MiB, laid out as 512 pages of 4 KiB</li><li>Probes: 1000, each to a page chosen uniformly at random and independently</li><li>\(\ln(511/512) \approx -0.0019550\)</li></ul>`,
        a: String.raw`<ol class="steps"><li><strong>Set up indicators.</strong> For each page \(j\) (\(j = 0\) to 511), let \(I_j\) be 1 when at least one probe touches page \(j\). The number of distinct pages is \(\sum I_j\), so its expectation is 512 times the chance that a given page is touched.</li><li><strong>Chance that a page is never touched.</strong> Each probe misses page \(j\) with chance \(511/512\), and the 1000 probes are independent.<div class="math chain"><span>\(\displaystyle P(\text{page untouched}) = \left(\frac{511}{512}\right)^{1000} \)</span><span>\(\displaystyle = e^{1000 \times \ln(511/512)} \)</span><span>\(\displaystyle \approx e^{-1.9550} \)</span><span>\(\displaystyle \approx 0.14156 \)</span></div></li><li><strong>Expected distinct pages.</strong> By linearity, add the 512 equal chances of being touched.<div class="math chain"><span>\(\displaystyle E[\text{distinct}] = 512\ \text{pages} \times P(\text{touched}) \)</span><span>\(\displaystyle = 512\ \text{pages} \times \bigl(1 - (511/512)^{1000}\bigr) \)</span><span>\(\displaystyle \approx 512\ \text{pages} \times 0.85844 \)</span><span>\(\displaystyle \approx \mathbf{439.5}\ \textbf{pages} \)</span></div></li><li><strong>Probes that land on an already touched page.</strong> Every probe either touches a page for the first time or repeats one, so the repeats are the probes minus the distinct pages.<div class="math chain"><span>\(\displaystyle E[\text{repeats}] = 1000\ \text{probes} - 439.5\ \text{probes} \)</span><span>\(\displaystyle \approx \mathbf{560.5}\ \textbf{probes} \)</span></div></li><li><strong>What it means.</strong> The 1000 probes need about 440 page translations. They fit in a 2048-entry L2 TLB but not in a 64-entry L1 DTLB, so most probes miss the L1 DTLB and pay an L2 TLB lookup. Mapping the table with one 2 MiB page instead needs a single translation. The indicator argument never needed the distribution of the distinct-page count, and \(e^{-1000/512} \approx 0.1418\) would have given almost the same untouched share.</li></ol>`
      }
    ],
    interview: [
      {
        q: String.raw`<p>Mispredictions in a trace come in correlated pairs. Over a window of branches, what are the mean and standard deviation of the misprediction count, and how do they compare with the independent model?</p><p>Given:</p><ul><li>Window: 10,000 consecutive dynamic branches, numbered 0 to 9999</li><li>Each branch mispredicts with probability 0.03</li><li>Two adjacent branches (\(i\) and \(i + 1\)) both mispredict with probability 0.006 (a joint probability, not a conditional one)</li><li>The window does not wrap around, so it holds 9999 adjacent pairs</li><li>Mispredictions of branches 2 or more apart are independent</li><li>Independent model for comparison: every pair of branches independent, same 0.03 rate</li></ul>`,
        a: String.raw`<ol class="steps"><li><strong>Mean.</strong> Let \(X_i\) be the indicator that branch \(i\) mispredicts. By linearity the mean count is the sum of 10,000 equal chances, and correlation plays no part.<div class="math chain"><span>\(\displaystyle E\Bigl[\sum_{i=0}^{9999} X_i\Bigr] = 10{,}000\ \text{branches} \times 0.03 \)</span><span>\(\displaystyle = \mathbf{300}\ \textbf{mispredictions} \)</span></div></li><li><strong>Variance of one indicator.</strong><div class="math chain"><span>\(\displaystyle \mathrm{Var}(X_i) = 0.03 \times (1 - 0.03) \)</span><span>\(\displaystyle = 0.0291 \)</span></div></li><li><strong>Covariance of neighbors.</strong> For indicators, the covariance is the joint chance minus the product of the single chances. Pairs 2 or more apart have covariance 0.<div class="math chain"><span>\(\displaystyle \mathrm{Cov}(X_i, X_{i+1}) = 0.006 - 0.03^2 \)</span><span>\(\displaystyle = 0.0051 \)</span></div>The correlation coefficient is \(0.0051 / 0.0291 \approx 0.175\). Put another way, a misprediction raises the chance that the next branch also mispredicts from 0.03 to \(0.006 / 0.03 = 0.2\).</li><li><strong>Variance of the count.</strong> There are 9999 adjacent pairs, and each covariance appears twice in the variance of a sum.<div class="math chain"><span>\(\displaystyle \mathrm{Var} = 10{,}000 \times 0.0291 + 2 \times 9999 \times 0.0051 \)</span><span>\(\displaystyle = 291 + 101.9898 \)</span><span>\(\displaystyle = 392.9898\ \text{mispredictions}^2 \)</span></div><div class="math chain"><span>\(\displaystyle \sigma = \sqrt{392.9898}\ \text{mispredictions} \)</span><span>\(\displaystyle \approx \mathbf{19.8}\ \textbf{mispredictions} \)</span></div></li><li><strong>Compare with independence.</strong> Without the covariance terms, the variance is 291 and the standard deviation \(\sqrt{291} \approx 17.1\) mispredictions. The mean is the same 300, but the correlated count's standard deviation is about 16% larger (\(\sqrt{392.9898 / 291} \approx 1.162\)).</li><li><strong>Why it matters.</strong> Error bars built on the independent model are too narrow, and the gap grows with longer-range correlation. If every pair of branches up to 19 apart had the same 0.0051 covariance, there would be 189,810 correlated pairs instead of 9999, the variance would be \(291 + 2 \times 189{,}810 \times 0.0051 \approx 2227\), and the standard deviation about 47.2 mispredictions, 2.8 times the independent value. Clustering also matters beyond the count. Two mispredictions close together often overlap in the pipeline, so the cycles lost are fewer than twice one misprediction's penalty, which a model that multiplies the mean count by a fixed penalty misses.</li></ol>`
      }
    ]
  }
},
{
  id: "math-dist",
  region: "mprob",
  title: "Common Distributions",
  sections: [
    { id: "bern", label: "Bernoulli: One Yes-or-No Trial" },
    { id: "binom", label: "Binomial: Successes in n Trials" },
    { id: "geom", label: "Geometric: Trials Until the First Success" },
    { id: "limit", label: "Poisson as the Limit of the Binomial" },
    { id: "poisson", label: "The Poisson Distribution" },
    { id: "process", label: "Poisson Arrivals in Time" },
    { id: "uses", label: "Where It Shows Up" },
    { id: "traps", label: "Common Traps" }
  ],
  body: String.raw`
<p>Four distributions cover most of the random counts in architecture, and they all grow from one building block: a trial that succeeds with probability \(p\). Count the successes in a fixed number of independent trials and you get the <strong>binomial</strong> (failed bits in a codeword, mispredictions in a window). Count the trials until the first success and you get the <strong>geometric</strong> (retries until a compare-and-swap succeeds). Let the number of trials grow huge while each chance shrinks, keeping the expected count fixed, and the binomial becomes the <strong>Poisson</strong>, the distribution of rare events in a fixed span: particle strikes on an SRAM array in a year, requests at a memory controller in a few nanoseconds. Each one's mean and variance follows from the previous page's tools in a few lines.</p>

<h3 id="sec-bern">Bernoulli: One Yes-or-No Trial</h3>
<p>A <strong>Bernoulli</strong> random variable is 1 with probability \(p\) and 0 with probability \(1 - p\). It is an indicator, so its mean and variance come straight from <a href="#/math-rv/variance">Variance and Standard Deviation</a>.</p>
<div class="math chain"><span>\(\displaystyle E[X] = p \)</span></div>
<div class="math chain"><span>\(\displaystyle \mathrm{Var}(X) = E[X^2] - p^2 \)</span><span>\(\displaystyle = p - p^2 \)</span><span>\(\displaystyle = p(1-p) \)</span></div>
<p>The variance is largest at \(p = 1/2\) (a coin flip is the most uncertain trial) and shrinks to 0 at either end. A branch that is taken 99% of the time contributes variance \(0.99 \times 0.01 \approx 0.01\), a hard 50/50 branch 0.25.</p>

<h3 id="sec-binom">Binomial: Successes in n Trials</h3>
<p>Run \(n\) independent Bernoulli trials with the same \(p\) and count the successes, \(K\). A particular sequence with \(k\) successes and \(n - k\) failures has chance \(p^k (1-p)^{n-k}\), because the trials are independent. Every sequence with the same \(k\) has the same chance, and there are \(\binom{n}{k}\) of them (choose which \(k\) positions succeed).</p>
<div class="math chain"><span>\(\displaystyle P(K = k) = \binom{n}{k}\, p^{k}\,(1-p)^{n-k}, \quad k = 0, 1, \ldots, n \)</span></div>
<p>The chances add to 1 by the binomial theorem, \(\sum_k \binom{n}{k} p^k (1-p)^{n-k} = (p + (1-p))^n = 1\). The mean and variance need no sums at all. \(K\) is the sum of \(n\) indicators with mean \(p\), so linearity gives the mean, and because the indicators are independent their variances add.</p>
<div class="math chain"><span>\(\displaystyle E[K] = \sum_{i=0}^{n-1} p \)</span><span>\(\displaystyle = np \)</span></div>
<div class="math chain"><span>\(\displaystyle \mathrm{Var}(K) = \sum_{i=0}^{n-1} p(1-p) \)</span><span>\(\displaystyle = np(1-p) \)</span></div>
<p><strong>Bit errors in an ECC word.</strong> DDR5 devices protect each 128-bit chunk with on-die ECC, 8 check bits that correct any single-bit error in the 136-bit codeword. Suppose each stored bit is wrong at read time with probability \(p = 10^{-6}\), independently. The codeword is fine with 0 errors, corrected with 1, and not correctable with 2 or more.</p>
<div class="math chain"><span>\(\displaystyle P(0) = (1 - 10^{-6})^{136} \)</span><span>\(\displaystyle \approx 0.99986401 \)</span></div>
<div class="math chain"><span>\(\displaystyle P(1) = 136 \times 10^{-6} \times (1 - 10^{-6})^{135} \)</span><span>\(\displaystyle \approx 1.3598 \times 10^{-4} \)</span></div>
<div class="math chain"><span>\(\displaystyle P(\ge 2) = 1 - P(0) - P(1) \)</span><span>\(\displaystyle \approx \binom{136}{2} \times (10^{-6})^2 \)</span><span>\(\displaystyle \approx 9.18 \times 10^{-9} \)</span></div>
<p>When \(np\) is small, the first term left over is the whole story: the chance of more than \(t\) errors is about \(\binom{n}{t+1} p^{t+1}\). So a code that corrects \(t\) errors turns a raw error rate \(p\) into an uncorrectable rate proportional to \(p^{t+1}\). For single-error correction, doubling the raw bit error rate quadruples the uncorrectable rate, and making the codeword twice as long roughly quadruples the uncorrectable rate per codeword too (\(\binom{n}{2}\) grows as \(n^2\)). That is the tradeoff between ECC overhead (8 check bits per 128 data bits is 6.25%, per 64 is 12.5%) and protection.</p>

<h3 id="sec-geom">Geometric: Trials Until the First Success</h3>
<p>Repeat independent trials with success chance \(p\) and let \(X\) be the number of trials up to and including the first success. Taking exactly \(k\) trials means \(k - 1\) failures and then a success.</p>
<div class="math chain"><span>\(\displaystyle P(X = k) = (1-p)^{k-1}\,p, \quad k = 1, 2, \ldots \)</span></div>
<p>The mean is \(1/p\), derived on <a href="#/math-geom/expect">Expected Number of Tries</a> from the sum of \(k\,x^k\). For the variance, the easiest route is \(E[X(X-1)]\), which uses the second derivative of the geometric series, \(\sum_k k(k-1)\,x^{k-2} = 2/(1-x)^3\) (differentiating term by term as on <a href="#/math-geom/kxk">The Sum of k Times x to the k</a>). Write \(q = 1 - p\).</p>
<div class="math chain"><span>\(\displaystyle E[X(X-1)] = \sum_{k=1}^{\infty} k(k-1)\, q^{k-1}\, p \)</span><span>\(\displaystyle = p\,q \sum_{k=2}^{\infty} k(k-1)\, q^{k-2} \)</span><span>\(\displaystyle = p\,q\,\frac{2}{(1-q)^3} \)</span><span>\(\displaystyle = \frac{2q}{p^2} \)</span></div>
<div class="math chain"><span>\(\displaystyle \mathrm{Var}(X) = E[X(X-1)] + E[X] - E[X]^2 \)</span><span>\(\displaystyle = \frac{2q}{p^2} + \frac{1}{p} - \frac{1}{p^2} \)</span><span>\(\displaystyle = \frac{1-p}{p^2} \)</span></div>
<p>For rare successes the standard deviation \(\sqrt{1-p}/p\) is nearly as large as the mean \(1/p\), so waits until a rare event are very spread out. The tail is simple: more than \(k\) trials means the first \(k\) all failed, so \(P(X > k) = (1-p)^k\).</p>
<p><strong>Memorylessness.</strong> Given that the first \(s\) trials failed, the chance of needing more than \(t\) further trials is the same as at the start.</p>
<div class="math chain"><span>\(\displaystyle P(X > s + t \mid X > s) = \frac{(1-p)^{s+t}}{(1-p)^{s}} \)</span><span>\(\displaystyle = (1-p)^{t} \)</span><span>\(\displaystyle = P(X > t) \)</span></div>
<p>The geometric is the only distribution on 1, 2, 3, ... with this property. A compare-and-swap loop that succeeds 70% of the time takes \(1/0.7 \approx 1.43\) attempts on average with standard deviation \(\sqrt{0.3}/0.7 \approx 0.78\), and needs more than 3 attempts with chance \(0.3^3 = 0.027\). A thread that has already failed 5 times is no closer to success, if the attempts really are independent. When they are not (a hot lock stays hot), the failures cluster and the tail is heavier than geometric.</p>

<h3 id="sec-limit">Poisson as the Limit of the Binomial</h3>
<p>Many events are rare per opportunity but have a huge number of opportunities: each of millions of bit cells might be struck in an hour, each of thousands of cycles might bring a request from some core. Hold the expected count fixed at \(\lambda = np\) and let \(n\) grow, so \(p = \lambda/n\) shrinks. Rearrange the binomial chance into factors whose limits are easy.</p>
<div class="math chain"><span>\(\displaystyle P(K = k) = \frac{n!}{k!\,(n-k)!} \left(\frac{\lambda}{n}\right)^{k} \left(1 - \frac{\lambda}{n}\right)^{n-k} \)</span><span>\(\displaystyle = \frac{\lambda^{k}}{k!} \cdot \frac{n(n-1)\cdots(n-k+1)}{n^{k}} \cdot \frac{(1 - \lambda/n)^{n}}{(1 - \lambda/n)^{k}} \)</span></div>
<p>Take each factor as \(n \to \infty\) with \(k\) fixed.</p>
<ul>
<li>\(n(n-1)\cdots(n-k+1)/n^k\) is a product of \(k\) factors \((n-i)/n\), each tending to 1.</li>
<li>\((1 - \lambda/n)^n \to e^{-\lambda}\). This is the compounding limit from <a href="#/math-exp/compounding">Where e Comes From</a>, and the same \((1-p)^n \approx e^{-np}\) as <a href="#/math-approx/small-p">Small Chances Over Many Tries</a>.</li>
<li>\((1 - \lambda/n)^{-k} \to 1\), since \(k\) is fixed while the base tends to 1.</li>
</ul>
<div class="math chain"><span>\(\displaystyle \lim_{n\to\infty} P(K = k) = e^{-\lambda}\,\frac{\lambda^{k}}{k!} \)</span></div>
<p>How good is it at realistic sizes? Compare 1000 trials with \(p = 0.003\) against a Poisson with \(\lambda = 3\).</p>
<table>
<tr><th>\(k\)</th><th>Binomial, \(n = 1000\), \(p = 0.003\)</th><th>Poisson, \(\lambda = 3\)</th></tr>
<tr><td>0</td><td>0.04956</td><td>0.04979</td></tr>
<tr><td>1</td><td>0.14914</td><td>0.14936</td></tr>
<tr><td>2</td><td>0.22415</td><td>0.22404</td></tr>
<tr><td>3</td><td>0.22438</td><td>0.22404</td></tr>
<tr><td>4</td><td>0.16828</td><td>0.16803</td></tr>
<tr><td>5</td><td>0.10087</td><td>0.10082</td></tr>
</table>
<p>They agree to about 0.5%. The error is of order \(p\) (here 0.003), so the Poisson is safe whenever each opportunity is individually unlikely, however many there are. It needs only \(\lambda\), not \(n\) and \(p\) separately, which is why it fits counts whose opportunities nobody could enumerate.</p>

<h3 id="sec-poisson">The Poisson Distribution</h3>
<p>A count \(N\) is <strong>Poisson</strong> with mean \(\lambda\) when its chances are the limit above.</p>
<div class="math chain"><span>\(\displaystyle P(N = k) = e^{-\lambda}\,\frac{\lambda^{k}}{k!}, \quad k = 0, 1, 2, \ldots \)</span></div>
<p>The chances add to 1 because \(\sum_k \lambda^k/k!\) is the series for \(e^{\lambda}\) (<a href="#/math-exp/series">The Series for e to the x</a>). The mean comes from the same series after cancelling \(k\) against \(k!\) and shifting the index.</p>
<div class="math chain"><span>\(\displaystyle E[N] = \sum_{k=1}^{\infty} k\, e^{-\lambda}\,\frac{\lambda^{k}}{k!} \)</span><span>\(\displaystyle = \lambda\, e^{-\lambda} \sum_{k=1}^{\infty} \frac{\lambda^{k-1}}{(k-1)!} \)</span><span>\(\displaystyle = \lambda\, e^{-\lambda}\, e^{\lambda} \)</span><span>\(\displaystyle = \lambda \)</span></div>
<p>Cancelling two factors the same way gives \(E[N(N-1)] = \lambda^2\), so the variance equals the mean.</p>
<div class="math chain"><span>\(\displaystyle \mathrm{Var}(N) = E[N(N-1)] + E[N] - E[N]^2 \)</span><span>\(\displaystyle = \lambda^2 + \lambda - \lambda^2 \)</span><span>\(\displaystyle = \lambda \)</span></div>
<p>The same answer comes from the binomial's \(np(1-p)\) with \(p \to 0\). Mean equals variance is a quick test of whether a measured count is Poisson. If the variance across windows is several times the mean, the events are bursty (overdispersed), and a Poisson model will underestimate how often big counts occur.</p>
<p><strong>Soft errors in an L3.</strong> Particle strike rates are quoted in FIT, failures per \(10^9\) device-hours. Take a 32 MiB L3, which is \(32 \times 2^{20} \times 8 / 10^6 \approx 268.4\) Mbit, at 500 FIT/Mbit. That is about 134,218 FIT, or \(134{,}218 \times 10^{-9} \times 8766 \approx 1.18\) upsets per chip-year. Each cell is struck with a minuscule chance, so the count per year is Poisson with \(\lambda \approx 1.18\). A given chip goes a whole year without an upset with chance \(e^{-1.18} \approx 0.31\), and a fleet of 10,000 chips sees about 11,800 upsets a year, which is why the L3 has ECC and why the count per chip, not just the rate, decides how often a single machine is hit.</p>
<p>Two properties make the Poisson easy to work with. The sum of independent Poisson counts is Poisson with the summed mean (<strong>superposition</strong>), and keeping each event independently with chance \(r\) leaves a Poisson count with mean \(r\lambda\) (<strong>thinning</strong>).</p>

<h3 id="sec-process">Poisson Arrivals in Time</h3>
<p>A <strong>Poisson process</strong> with rate \(\lambda\) per unit time has independent counts in disjoint intervals, and the count in any interval of length \(t\) is Poisson with mean \(\lambda t\). It is the binomial limit again: cut time into tiny slots, each with a tiny chance of one arrival, independent across slots.</p>
<p>The gap until the next arrival follows from the count. No arrival within time \(t\) means the count in \([0, t]\) is 0.</p>
<div class="math chain"><span>\(\displaystyle P(\text{gap} > t) = P(N(t) = 0) \)</span><span>\(\displaystyle = e^{-\lambda t} \)</span></div>
<p>This is the <strong>exponential distribution</strong>, with mean gap \(1/\lambda\). It is the continuous version of the geometric and inherits memorylessness: having waited a while for the next request says nothing about how much longer the wait will be.</p>
<p><strong>Requests at a memory controller.</strong> A DDR5-4800 channel moves at most \(4800 \times 10^6\) transfers/s \(\times\) 8 B = 38.4 GB/s, or 0.6 64-byte lines per ns. At 50% utilization, requests arrive at 0.3 per ns. If they form a Poisson process, a 20 ns window holds 6 requests on average, sees none with chance \(e^{-6} \approx 0.0025\), and sees 12 or more (twice the average, and as many lines as the channel can move in 20 ns) with chance about 0.020. The mean gap between requests is \(1/0.3 \approx 3.33\) ns, but gaps are exponential, so short gaps are the most common and requests bunch up. That bunching is why queues form well below 100% utilization, which the queueing region develops.</p>
<p>Why should the merged miss stream of many cores look Poisson, when each core's misses are bursty? Superposing many independent, individually sparse streams tends toward a Poisson process (the Palm-Khintchine theorem), the same way the binomial tends toward the Poisson. The approximation is good for many cores with unrelated work and poor when the cores run the same phase in lockstep, or when one core's misses dominate.</p>

<h3 id="sec-uses">Where It Shows Up</h3>
<ul>
<li><strong>ECC design.</strong> Binomial tails set the uncorrectable rate of a code. Correcting \(t\) errors turns a raw rate \(p\) into roughly \(\binom{n}{t+1} p^{t+1}\), which sets codeword length and check-bit overhead for DRAM, SRAM, HBM, and flash.</li>
<li><strong>Low-voltage caches.</strong> At reduced supply voltage, individual SRAM cells fail persistently, and binomial counts per word or line decide how much capacity ECC or line disabling preserves.</li>
<li><strong>Retries and replays.</strong> Lock acquisition, compare-and-swap loops, transactional aborts, and NoC retries are geometric when attempts are independent, with mean \(1/p\) and a standard deviation almost as large when \(p\) is small.</li>
<li><strong>Arrivals and queues.</strong> Memory controllers, interconnect routers, and server request streams are modeled as Poisson processes as the starting point for queueing analysis.</li>
<li><strong>Reliability budgets.</strong> FIT rates add across components (superposition), and the Poisson gives the chance of zero, one, or several events per device-year.</li>
<li><strong>Counts in sampled windows.</strong> Mispredictions or misses per sampling interval are binomial, close to Poisson when rare, and comparing the measured variance with the mean flags bursty behavior.</li>
</ul>

<h3 id="sec-traps">Common Traps</h3>
<ul>
<li><strong>Trials or failures.</strong> The geometric can count trials including the success (mean \(1/p\)) or failures before it (mean \((1-p)/p\)). Both have variance \((1-p)/p^2\). Check which one a formula uses.</li>
<li><strong>The binomial needs independence and a fixed \(p\).</strong> Multi-bit upsets from one particle strike adjacent cells together, so bits in a physically contiguous word are not independent. Interleaving a word's bits across the array restores the binomial picture.</li>
<li><strong>Poisson needs rare events, not small counts.</strong> The approximation is about \(p\) being small per opportunity. \(\lambda\) can be large.</li>
<li><strong>Mean equal to variance is a symptom, not a proof.</strong> Every Poisson count has it, but so can other counts, so it supports a Poisson model without proving one. A variance well above the mean does rule the model out: the counts are bursty, and Poisson tails will be too thin for them.</li>
<li><strong>Utilization is not a cap per window.</strong> A channel at 50% average load still sees windows with more requests than it can serve, because Poisson counts fluctuate by about \(\sqrt{\lambda}\).</li>
<li><strong>Rates need a time base.</strong> FIT is per \(10^9\) device-hours, so convert to the window of interest before using it as \(\lambda\).</li>
</ul>
`,
  practice: {
    guided: [
      {
        q: String.raw`<p>An L2 cache runs at a low supply voltage where some SRAM cells fail. What share of lines are unusable without ECC and with SECDED per 64-bit word, and how many lines does each lose?</p><p>Given:</p><ul><li>L2: 2 MiB with 64-byte lines, so 32,768 lines</li><li>Each cell fails with probability \(10^{-3}\), independently of every other cell (persistent failures at low voltage)</li><li>Without ECC: a line stores 512 data bits and is unusable if any of them fails</li><li>With SECDED: each line holds 8 words of 72 stored bits (64 data bits and 8 check bits), and a word is unusable if 2 or more of its 72 cells fail</li><li>With SECDED a line is unusable if any of its 8 words is unusable</li><li>Ignore failures in the tag array</li></ul>`,
        a: String.raw`<ol class="steps"><li><strong>Line failure without ECC.</strong> The line survives only if all 512 cells work.<div class="math chain"><span>\(\displaystyle P(\text{line fails}) = 1 - (1 - 10^{-3})^{512} \)</span><span>\(\displaystyle \approx 1 - e^{-0.51226} \)</span><span>\(\displaystyle \approx \mathbf{0.401} \)</span></div></li><li><strong>Lines lost without ECC.</strong> By linearity, the expected count is the line count times the chance per line.<div class="math chain"><span>\(\displaystyle E[\text{lost}] = 32{,}768\ \text{lines} \times 0.40086 \)</span><span>\(\displaystyle \approx \mathbf{13{,}135}\ \textbf{lines} \)</span></div>About 40% of the cache is gone.</li><li><strong>Word failure with SECDED.</strong> The failed cells in a word are binomial with 72 trials. The word survives with 0 or 1 failures.<div class="math chain"><span>\(\displaystyle P(0) = (1 - 10^{-3})^{72} \)</span><span>\(\displaystyle \approx 0.930497 \)</span></div><div class="math chain"><span>\(\displaystyle P(1) = 72 \times 10^{-3} \times (1 - 10^{-3})^{71} \)</span><span>\(\displaystyle \approx 0.067063 \)</span></div><div class="math chain"><span>\(\displaystyle P(\text{word fails}) = 1 - P(0) - P(1) \)</span><span>\(\displaystyle \approx 0.0024398 \)</span></div>The leading-term estimate \(\binom{72}{2} \times (10^{-3})^2 = 0.002556\) is about 5% high, because \(np = 0.072\) is small but not tiny.</li><li><strong>Line failure with SECDED.</strong> The 8 words fail independently, since they use different cells.<div class="math chain"><span>\(\displaystyle P(\text{line fails}) = 1 - (1 - 0.0024398)^{8} \)</span><span>\(\displaystyle \approx \mathbf{0.0194} \)</span></div></li><li><strong>Lines lost with SECDED.</strong><div class="math chain"><span>\(\displaystyle E[\text{lost}] = 32{,}768\ \text{lines} \times 0.019352 \)</span><span>\(\displaystyle \approx \mathbf{634}\ \textbf{lines} \)</span></div></li><li><strong>What it means.</strong> SECDED cuts the lost capacity from about 40% to about 2%, a factor of 20, at the cost of 12.5% more cells. Disabling the 634 bad lines leaves a usable cache. This is the low-voltage SRAM problem studied by Wilkerson et al. (ISCA 2008), where cell failure rates near \(10^{-3}\) at about 500 mV made plain caches unusable. Using SECDED for persistent faults spends its correction on a known bad cell, so a later soft error in that word is no longer correctable, which is why such designs often add a second layer of protection or disable words with a known fault.</li></ol>`
      }
    ],
    interview: [
      {
        q: String.raw`<p>A 16-core chip sends its LLC misses to two DDR5 channels. Treating each channel's requests as a Poisson process, what are its arrival rate and utilization, how often does a 10 ns window bring more requests than the channel can transfer in 10 ns, and how often does a channel sit idle for more than 5 ns between requests?</p><p>Given:</p><ul><li>Each core retires 1.5 instructions/cycle at 3 GHz and has 10 LLC misses per 1000 instructions</li><li>Each core's misses form a Poisson process, independent of the other cores</li><li>Each miss goes to channel 0 or channel 1 with probability 1/2 each, independently</li><li>Each miss moves one 64-byte line</li><li>Each channel: DDR5-4800, 64 bits wide, so at most \(4800 \times 10^{6}\ \text{transfers/s} \times 8\ \text{B} = 38.4\ \text{GB/s}\)</li><li>Ignore writebacks, refresh, and row-buffer effects</li><li>A 10 ns window counts as overloaded when its request count is strictly greater than the number of lines the channel can transfer in 10 ns. Look at each window on its own, ignoring backlog from earlier windows</li><li>An idle gap is the time between two consecutive request arrivals at a channel. Give the share of gaps longer than 5 ns</li></ul>`,
        a: String.raw`<ol class="steps"><li><strong>One core's miss rate.</strong> Misses per instruction times instructions per cycle times cycles per ns.<div class="math chain"><span>\(\displaystyle \lambda_{\text{core}} = \frac{10\ \text{misses}}{1000\ \text{instr}} \times \frac{1.5\ \text{instr}}{1\ \text{cycle}} \times \frac{3\ \text{cycles}}{1\ \text{ns}} \)</span><span>\(\displaystyle = \frac{0.045\ \text{misses}}{1\ \text{ns}} \)</span></div></li><li><strong>Merge, then split.</strong> The 16 independent Poisson streams superpose into one Poisson stream with the summed rate. Sending each miss to a channel at random thins it, so each channel sees a Poisson stream with half the rate.<div class="math chain"><span>\(\displaystyle \lambda_{\text{ch}} = 16 \times \frac{0.045\ \text{misses}}{1\ \text{ns}} \times \frac{1}{2} \)</span><span>\(\displaystyle = \mathbf{\frac{0.36\ \textbf{requests}}{1\ \textbf{ns}}} \)</span></div></li><li><strong>Utilization.</strong> The channel's peak in lines per ns is its bandwidth over the line size.<div class="math chain"><span>\(\displaystyle \mu = \frac{38.4\ \text{B}}{1\ \text{ns}} \times \frac{1\ \text{line}}{64\ \text{B}} \)</span><span>\(\displaystyle = \frac{0.6\ \text{lines}}{1\ \text{ns}} \)</span></div><div class="math chain"><span>\(\displaystyle \rho = \frac{0.36\ \text{requests/ns}}{0.6\ \text{lines/ns}} \)</span><span>\(\displaystyle = \mathbf{0.6} \)</span></div></li><li><strong>Overload in a 10 ns window.</strong> The channel can move \(0.6 \times 10 = 6\) lines in 10 ns. The count in the window is Poisson with mean \(0.36 \times 10 = 3.6\) requests, and "more than 6" is 1 minus the chances of 0 to 6.<div class="math chain"><span>\(\displaystyle P(N > 6) = 1 - \sum_{k=0}^{6} e^{-3.6}\,\frac{3.6^{k}}{k!} \)</span><span>\(\displaystyle \approx 1 - 0.92673 \)</span><span>\(\displaystyle \approx \mathbf{0.073} \)</span></div>The terms for \(k = 0\) to 6 are 0.02732, 0.09837, 0.17706, 0.21247, 0.19122, 0.13768, and 0.08261. About 1 window in 14 brings more work than 10 ns of transfer time, even at 60% average load, so requests queue.</li><li><strong>Idle gaps over 5 ns.</strong> Gaps in a Poisson process are exponential.<div class="math chain"><span>\(\displaystyle P(\text{gap} > 5\ \text{ns}) = e^{-0.36 \times 5} \)</span><span>\(\displaystyle = e^{-1.8} \)</span><span>\(\displaystyle \approx \mathbf{0.165} \)</span></div>The mean gap is \(1/0.36 \approx 2.78\) ns, yet about 1 gap in 6 is longer than 5 ns. Bursts and idle stretches both come from the same randomness, and the idle time cannot be banked for the bursts, which is where queueing delay comes from.</li><li><strong>Where the model breaks.</strong> Real miss streams are burstier than Poisson (one core's misses cluster in phases, and prefetchers issue runs), so the overload chance here is a lower estimate. Address interleaving is not random either: a stream that strides across channels evenly is smoother than Poisson, and one that hits a single channel is worse. Measuring the variance-to-mean ratio of per-window counts on the real system says which way the model errs.</li></ol>`
      }
    ]
  }
}
]);
