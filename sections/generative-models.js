/* Section: Generative models
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "gen"). */

section({
  id: "gen",
  name: "Generative Models",
  cap: "Discriminative vs. generative, stochastic processes, diffusion",
  body: `
<p>This section builds up generative AI from the ground: what separates models that <em>classify</em> from models that <em>create</em>, the randomness underneath both graphics and LLMs, how diffusion models turn noise into images, and why GPUs are the hardware that made all of it practical.</p>
<h3>The Big Picture</h3>
<ul>
<li><strong>Discriminative models</strong> learn p(y | x): given an input, what's the label?</li>
<li><strong>Generative models</strong> learn p(x): what does real data look like, so you can sample new examples?</li>
<li><strong>Stochastic processes</strong> are how sampling actually happens: random walks, Monte Carlo, token-by-token sampling.</li>
<li><strong>Diffusion models</strong> learn to reverse a noising process, one of the most successful generative approaches for images, video, and audio.</li>
<li><strong>GPUs</strong> supply the massively parallel matrix math and memory bandwidth these models need. They're covered with the other shipping chips in <a href="#/r/proc">Real Processors</a>: <a href="#/gen-gpus">GPUs for generative AI</a> and <a href="#/gpu-kernels">kernels and Tensor Cores</a>.</li>
</ul><p>For a step-by-step walk from text in to text out, with the hardware at every step, see <a href="#/r/llm">How language models work</a>.</p><p>New to neural networks? Start with <a href="#/nn-basics">Neural network basics</a>.</p>`,
  practice: {
    guided: [
      {
        q: `<p>Classify each as discriminative or generative: (a) a spam filter using logistic regression, (b) GPT-style language model, (c) Stable Diffusion, (d) an image classifier that labels cats vs. dogs, (e) a GAN.</p>`,
        a: `<ol type="a"><li>Discriminative: models p(spam | email).</li><li>Generative: models p(text) as a product of next-token probabilities, and can sample new text.</li><li>Generative: samples new images (conditioned on text).</li><li>Discriminative: models p(label | image).</li><li>Generative: the generator produces new samples (its discriminator is a discriminative helper used only in training).</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Explain to a hardware team why generative inference workloads stress hardware differently from classifier inference.</p>`,
        a: `<p>A classifier runs one forward pass per input, so it batches well and is mostly compute-bound. Generative models run the network many times per output: an LLM runs once per generated token, and each step depends on the previous one, so small-batch generation reads every weight from memory for every token and becomes memory-bandwidth-bound; a diffusion model runs the network once per denoising step (often 20–50 steps), so latency multiplies by the step count. Sampling also needs random numbers and adds sequential dependencies. Hardware for generative AI is therefore judged on memory bandwidth, latency per step, and energy per sample, not just peak FLOP/s.</p>`
      }
    ]
  }
}, [
{
  id: "gen-discriminative",
  region: "gen",
  title: "Discriminative Models",
  body: `
<p>A <strong>discriminative model</strong> learns to predict a label y from an input x. It models the conditional probability p(y | x), or simply a function that maps x to y, and focuses only on the boundary between classes.</p>
<h3>Examples</h3>
<ul><li>Logistic regression and support vector machines.</li><li>Neural-network image classifiers.</li><li>Text classifiers (sentiment, spam, intent).</li></ul>
<h3>The Math</h3>
<p><strong>Logistic regression</strong> (two classes) passes a weighted sum through the sigmoid:</p>
<p class="eq">p(y = 1 | x) = σ(w · x + b), where σ(z) = <span class="frac"><span>1</span><span>1 + e<sup>−z</sup></span></span></p>
<p>With K classes, a network produces one score (logit) z<sub>k</sub> per class, and <strong>softmax</strong> turns them into probabilities:</p>
<p class="eq">p(y = k | x) = <span class="frac"><span>e<sup>z<sub>k</sub></sup></span><span>Σ<sub>j</sub> e<sup>z<sub>j</sub></sup></span></span></p>
<p><strong>Training</strong> minimizes cross-entropy, the negative log probability of the correct labels, by gradient descent:</p>
<p class="eq">L = −Σ<sub>i</sub> log p(y<sub>i</sub> | x<sub>i</sub>)</p>
<h3>Strengths and Limits</h3>
<ul>
<li><strong>Strengths:</strong> directly optimized for the prediction task; usually the most accurate choice for classification with enough data.</li>
<li><strong>Limits:</strong> can't create new data, and can't say how likely an input is. A classifier confidently labels inputs unlike anything in its training set.</li>
</ul>
<h3>The Hardware View</h3>
<p>Inference is one forward pass per input: mostly matrix multiplies that batch well, so it is usually compute-bound on GPUs. That's the baseline generative models are compared against.</p>`,
  practice: {
    guided: [
      {
        q: `<p>A logistic regression model has weights w = (2, −1) and bias b = 0.5. What probability does it give that x = (1, 3) belongs to class 1? Then convert the logits (2, 1, 0) for a 3-class model into probabilities with softmax.</p>`,
        a: `<ol><li>z = w · x + b = 2(1) − 1(3) + 0.5 = −0.5.</li><li>σ(−0.5) = 1 / (1 + e<sup>0.5</sup>) = 1 / (1 + 1.649) ≈ <strong>0.38</strong>, so the model leans toward class 0.</li><li>Softmax: e<sup>2</sup> = 7.389, e<sup>1</sup> = 2.718, e<sup>0</sup> = 1; sum = 11.107.</li><li>Probabilities: 7.389/11.107 ≈ <strong>0.665</strong>, 2.718/11.107 ≈ <strong>0.245</strong>, 1/11.107 ≈ <strong>0.090</strong>.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>You have only a few hundred labeled emails. Would you expect a generative classifier (naive Bayes) or a discriminative one (logistic regression) to do better? What about with millions?</p>`,
        a: `<p>A classic result (Ng and Jordan, 2001): generative classifiers like naive Bayes approach their best accuracy with fewer examples, because their strong modeling assumptions act like a prior. Discriminative models usually reach a lower final error once data is plentiful, because they model the decision boundary directly without having to model how the inputs are distributed. So with little data, naive Bayes can win; with lots of data, logistic regression (or a neural classifier) usually wins.</p>`
      },
      {
        q: `<p>A cat/dog classifier is shown a picture of a car and says "dog, 97%." Why does a discriminative model do this?</p>`,
        a: `<p>It only learned p(label | image) and a boundary between the two classes; it never learned what cat or dog images look like overall, so it has no notion of "this input is unlike anything I've seen." Softmax always produces probabilities that sum to 1 across the known classes. Detecting out-of-distribution inputs needs something extra: a generative model of p(x), calibration, an "other" class, or uncertainty estimates.</p>`
      }
    ]
  }
},

{
  id: "gen-generative",
  region: "gen",
  title: "Generative Models",
  body: `
<p>A <strong>generative model</strong> learns the distribution of the data itself, p(x), or the joint distribution p(x, y). Because it knows what realistic data looks like, it can <strong>sample</strong> new examples and <strong>score</strong> how likely an input is.</p>
<h3>Connection to Classification</h3>
<p>Bayes' rule turns a generative model into a classifier:</p>
<p class="eq">p(y | x) = <span class="frac"><span>p(x | y) p(y)</span><span>p(x)</span></span></p>
<p>Naive Bayes works this way. The reverse isn't true: a discriminative model can't generate data.</p>
<h3>Families of Generative Models</h3>
<div class="tbl"><table>
<tr><th>Family</th><th>Idea</th><th>Strengths</th><th>Weaknesses</th></tr>
<tr><td>Autoregressive (LLMs)</td><td>p(x) = Π<sub>t</sub> p(x<sub>t</sub> | x<sub>&lt;t</sub>): predict the next token from all previous ones</td><td>Exact likelihood; scales extremely well</td><td>Sequential generation, one token per pass</td></tr>
<tr><td>Variational autoencoders (VAEs)</td><td>Encode x into a latent z, decode z back to x; train on a lower bound of likelihood (the ELBO)</td><td>Fast sampling; useful latent space</td><td>Samples tend to be blurry</td></tr>
<tr><td>GANs</td><td>A generator tries to fool a discriminator that tells real from fake</td><td>Sharp samples in one pass</td><td><ul><li>Unstable training</li><li>Mode collapse</li><li>No likelihood</li></ul></td></tr>
<tr><td>Normalizing flows</td><td>Invertible transforms from simple noise to data; exact likelihood by change of variables</td><td>Exact likelihood and fast sampling</td><td>Architecture must stay invertible</td></tr>
<tr><td>Energy-based models</td><td>p(x) ∝ e<sup>−E(x)</sup>: low energy means likely</td><td>Very flexible</td><td>Sampling needs slow iterative methods (MCMC)</td></tr>
<tr><td>Diffusion models</td><td>Learn to reverse gradual noising, step by step</td><td>Top image/video quality; stable training</td><td>Many network passes per sample</td></tr>
</table></div>
<h3>Training</h3>
<p>Most generative models are trained by <strong>maximum likelihood</strong>: make the real data as probable as possible under the model. That's equivalent to minimizing the cross-entropy (or KL divergence) between the data distribution and the model:</p>
<p class="eq">max<sub>θ</sub> Σ<sub>i</sub> log p<sub>θ</sub>(x<sub>i</sub>)</p>
<p>For an LLM, that is exactly next-token prediction with a cross-entropy loss at every position.</p>
<h3>The Hardware View</h3>
<p>Generating is expensive because the network runs many times per output: once per token for an LLM, once per denoising step for diffusion. See <a href="#/gen-gpus">GPUs for generative AI</a>.</p>`,
  practice: {
    guided: [
      {
        q: `<p>An autoregressive model assigns p("the") = 0.2, p("cat" | "the") = 0.1, and p("sat" | "the cat") = 0.5. What's the probability of the sequence "the cat sat," its log probability, and its per-token perplexity?</p>`,
        a: `<ol><li>Chain rule: 0.2 × 0.1 × 0.5 = <strong>0.01</strong>.</li><li>Natural log: ln 0.01 ≈ <strong>−4.61</strong>.</li><li>Perplexity = exp(−average log probability per token) = exp(4.61 / 3) = e<sup>1.535</sup> ≈ <strong>4.6</strong>: on average, the model was as uncertain as choosing among about 4.6 equally likely tokens.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Why is an LLM's generation latency structured differently from a diffusion model's, and what techniques attack each?</p>`,
        a: `<p>An LLM generates one token per network pass, and each token depends on the previous ones, so latency grows with output length and the passes are sequential. Techniques: speculative decoding (a small model drafts several tokens and the big model verifies them in one pass), batching many users together, and quantization to cut memory traffic.</p><p>A diffusion model updates the whole image in parallel at every step, but needs a fixed number of steps (often 20–50). Techniques: better samplers that need fewer steps, distillation into 1–4 step models, running in a compressed latent space, and batching the conditional and unconditional passes of guidance together.</p>`
      },
      {
        q: `<p>Compare GANs and diffusion models on training stability, sample quality, diversity, and sampling cost.</p>`,
        a: `<p>GANs train a generator against a discriminator in a two-player game, which is notoriously unstable and can collapse to a few modes (low diversity), but sampling takes one network pass. Diffusion models train with a simple regression loss (predict the added noise), which is stable and covers the data distribution well, giving high quality and diversity, but sampling needs many network passes. That trade is why diffusion took over image generation, and why so much work goes into reducing its step count.</p>`
      }
    ]
  }
},

{
  id: "gen-stochastic",
  region: "gen",
  title: "Stochastic Processes for Graphics and LLMs",
  sections: [
    { id: "monte-carlo", label: "Monte Carlo" },
    { id: "graphics", label: "Graphics: Path Tracing" },
    { id: "llm-sampling", label: "LLMs: Token Sampling" },
    { id: "langevin", label: "Random Walks to Diffusion" }
  ],
  body: `
<p>A <strong>stochastic process</strong> is a sequence of random variables evolving over time: X<sub>0</sub>, X<sub>1</sub>, X<sub>2</sub>, …. Generative AI and modern graphics both rely on them, because "generate a realistic sample" usually means "run a random process that ends in the right distribution."</p>
<h3>Key Ideas</h3>
<ul>
<li><strong>Markov property:</strong> the next state depends only on the current one, not the full history.</li>
<li><strong>Random walk:</strong> each step adds an independent random move: X<sub>t+1</sub> = X<sub>t</sub> + noise.</li>
<li><strong>Brownian motion:</strong> the continuous-time limit of a random walk; its variance grows linearly with time.</li>
</ul>
<h3 id="sec-monte-carlo">Monte Carlo Estimation</h3>
<p>To compute an average or integral that's too hard to solve exactly, draw random samples and average them:</p>
<p class="eq">∫ f(x) dx ≈ <span class="frac"><span>1</span><span>N</span></span> Σ<sub>i</sub> <span class="frac"><span>f(X<sub>i</sub>)</span><span>p(X<sub>i</sub>)</span></span></p>
<p>where the X<sub>i</sub> are drawn from a distribution p. The error shrinks as 1/√N: <strong>4× the samples halves the noise</strong>. Choosing p to put more samples where f is large (importance sampling) lowers the noise for the same N.</p>
<h3 id="sec-graphics">Graphics: Path Tracing</h3>
<p>Realistic rendering solves the rendering equation: the light leaving a surface point is an integral of all light arriving from every direction, which itself depends on light bouncing off other surfaces. Path tracing estimates it with Monte Carlo:</p>
<ul>
<li>For each pixel, trace random light paths: a ray hits a surface, picks a random bounce direction, and continues, a random walk through the scene.</li>
<li>The pixel's color is the average over many paths. Few samples look grainy; more converge to the true image.</li>
<li>Modern renderers use fewer samples plus a neural denoiser, and GPUs add dedicated hardware for ray-triangle intersection.</li>
</ul>
<h3 id="sec-llm-sampling">LLMs: Token Sampling</h3>
<p>Text generation is a stochastic process over tokens: each step samples x<sub>t</sub> ~ p(x<sub>t</sub> | x<sub>&lt;t</sub>), then appends it and repeats. The network outputs logits z, and the sampler shapes them:</p>
<p class="eq">p(token k) = <span class="frac"><span>e<sup>z<sub>k</sub>/T</sup></span><span>Σ<sub>j</sub> e<sup>z<sub>j</sub>/T</sup></span></span></p>
<ul>
<li><strong>Temperature T:</strong><ul><li>T &lt; 1 sharpens the distribution (more predictable)</li><li>T &gt; 1 flattens it (more varied)</li><li>T → 0 is greedy decoding (always the top token)</li></ul></li>
<li><strong>Top-k:</strong> sample only from the k most likely tokens.</li>
<li><strong>Top-p (nucleus):</strong> sample from the smallest set of tokens whose probabilities add up to p.</li>
</ul>
<h3 id="sec-langevin">From Random Walks to Diffusion</h3>
<p><strong>Langevin dynamics</strong> is a random walk that drifts toward likely regions. With step size ε and fresh Gaussian noise z at each step:</p>
<p class="eq">x<sub>t+1</sub> = x<sub>t</sub> + ε ∇<sub>x</sub> log p(x<sub>t</sub>) + √(2ε) z</p>
<p>The gradient term (the <strong>score</strong>) pulls samples toward high probability; the noise keeps them exploring. Run long enough, the samples follow p(x). Diffusion models learn this score with a neural network; see <a href="#/gen-diffusion">Diffusion models</a>.</p>
<h3>Randomness in Hardware</h3>
<p>GPUs generate random numbers with counter-based pseudo-random generators (such as Philox), so every thread gets an independent stream without shared state. Each random number still costs instructions and energy. Probabilistic and thermodynamic computing hardware explores using physical circuit noise directly as the source of randomness.</p>`,
  practice: {
    guided: [
      {
        q: `<p>An LLM's logits for three tokens are (2, 1, 0). Find the sampling probabilities at temperature T = 0.5 and T = 2. Separately, a path tracer at 16 samples per pixel is too noisy: how many samples halve the noise, and how many cut it by 10×?</p>`,
        a: `<ol><li>T = 0.5: logits / T = (4, 2, 0). e<sup>4</sup> = 54.6, e<sup>2</sup> = 7.39, e<sup>0</sup> = 1; sum = 63.0. Probabilities ≈ <strong>(0.867, 0.117, 0.016)</strong>: sharper, closer to greedy.</li><li>T = 2: logits / T = (1, 0.5, 0). e<sup>1</sup> = 2.72, e<sup>0.5</sup> = 1.65, 1; sum = 5.37. Probabilities ≈ <strong>(0.506, 0.307, 0.186)</strong>: flatter, more random.</li><li>Monte Carlo noise ∝ 1/√N. Halving it needs 4× the samples: <strong>64</strong>. Cutting it 10× needs 100×: <strong>1,600</strong>.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Path tracing is "embarrassingly parallel," yet naive GPU path tracers often run far below peak. Why?</p>`,
        a: `<p>Each GPU warp runs 32 threads in lockstep (SIMT). Paths start together but quickly diverge: rays hit different materials (needing different shading code), bounce different numbers of times, and terminate at different depths, so many threads in a warp sit idle while others finish (branch divergence). Memory access also becomes incoherent, since neighboring threads read scattered scene data. Fixes: "wavefront" path tracing that regroups rays by what they need next, sorting rays by material or direction, and dedicated ray-tracing hardware for intersection tests.</p>`
      },
      {
        q: `<p>Why does sampling cost energy on conventional hardware, and how do probabilistic or thermodynamic computing approaches try to change that?</p>`,
        a: `<p>CPUs and GPUs are deterministic, so randomness has to be manufactured: pseudo-random number generators (on GPUs, counter-based generators such as Philox) burn instructions and energy for every random number, and iterative samplers like Langevin dynamics run many deterministic steps to imitate a noisy physical process. Probabilistic and thermodynamic computing designs use physical noise in circuits directly as the source of randomness, letting the hardware's natural dynamics perform the random walk instead of simulating it step by step. The claimed benefit is large energy savings for sampling-heavy workloads such as diffusion and Bayesian inference; the open challenges are precision, scaling, and programmability.</p>`
      }
    ]
  }
},

{
  id: "gen-diffusion",
  region: "gen",
  title: "Diffusion Models",
  sections: [{ id: "forward", label: "Forward Process" }, { id: "training", label: "Training" }, { id: "sampling", label: "Sampling" }, { id: "practice-diff", label: "In Practice" }],
  body: `
<p>A <strong>diffusion model</strong> generates data by learning to undo noise. During training, real data is gradually corrupted with Gaussian noise until it's pure static; a neural network learns to reverse one small step of that corruption. To generate, start from pure noise and apply the learned reverse step many times.</p>
<h3 id="sec-forward">The Forward (Noising) Process</h3>
<p>Each step adds a little noise, with a schedule β<sub>1</sub>, …, β<sub>T</sub> of small variances:</p>
<p class="eq">q(x<sub>t</sub> | x<sub>t−1</sub>) = N(√(1 − β<sub>t</sub>) x<sub>t−1</sub>, β<sub>t</sub> I)</p>
<p>Because Gaussians compose, you can jump straight from clean data x<sub>0</sub> to any step t. With α<sub>t</sub> = 1 − β<sub>t</sub> and ᾱ<sub>t</sub> = α<sub>1</sub>α<sub>2</sub>…α<sub>t</sub>, and ε drawn from a standard normal:</p>
<p class="eq">x<sub>t</sub> = √ᾱ<sub>t</sub> x<sub>0</sub> + √(1 − ᾱ<sub>t</sub>) ε</p>
<p>Early on ᾱ<sub>t</sub> ≈ 1 (mostly signal); by the last step ᾱ<sub>T</sub> ≈ 0 (pure noise).</p>
<h3 id="sec-training">Training</h3>
<ol><li>Pick a real example x<sub>0</sub>, a random step t, and random noise ε.</li><li>Make x<sub>t</sub> with the formula above.</li><li>Train the network ε<sub>θ</sub>(x<sub>t</sub>, t) to predict the noise that was added:</li></ol>
<p class="eq">L = ‖ ε − ε<sub>θ</sub>(x<sub>t</sub>, t) ‖<sup>2</sup></p>
<p>This is ordinary regression, which is why diffusion training is stable compared with GANs.</p>
<h3 id="sec-sampling">Sampling (Generating)</h3>
<p>Start from pure noise x<sub>T</sub> ~ N(0, I), then for t = T down to 1, with fresh noise z each step (z = 0 at the last step):</p>
<p class="eq">x<sub>t−1</sub> = <span class="frac"><span>1</span><span>√α<sub>t</sub></span></span> ( x<sub>t</sub> − <span class="frac"><span>β<sub>t</sub></span><span>√(1 − ᾱ<sub>t</sub>)</span></span> ε<sub>θ</sub>(x<sub>t</sub>, t) ) + σ<sub>t</sub> z</p>
<p>Each step removes the predicted noise and adds back a little fresh noise, a guided random walk from static to a clean sample. The noise predictor is a learned version of the score from <a href="#/gen-stochastic/langevin">Langevin dynamics</a>.</p>
<h3 id="sec-practice-diff">In Practice</h3>
<ul>
<li><strong>Fewer steps:</strong> training often uses T = 1000, but improved samplers (DDIM, DPM-Solver) generate in about 20–50 steps, and distilled models in 1–4.</li>
<li><strong>Latent diffusion:</strong> an autoencoder compresses images (for example 512 × 512 × 3 to 64 × 64 × 4), diffusion runs in that small latent space, and a decoder turns the result back into pixels.</li>
<li><strong>Architectures:</strong> U-Nets (convolutional, with attention layers) and diffusion transformers (DiT), which scale like LLMs.</li>
<li><strong>Conditioning:</strong> a text encoder's output steers the network through cross-attention.</li>
<li><strong>Classifier-free guidance:</strong> run the network with and without the prompt and push away from the unconditional prediction, with guidance scale w: ε = ε<sub>uncond</sub> + w (ε<sub>cond</sub> − ε<sub>uncond</sub>). It doubles the evaluations per step.</li>
</ul>
<h3>Cost</h3>
<p class="eq">Compute per sample = steps × network FLOPs × (2 with guidance)</p>
<p>Each step processes the whole latent at once, so steps are large parallel workloads that GPUs handle well, but steps are sequential. Latency scales directly with the step count, which is why reducing steps matters so much.</p>`,
  practice: {
    guided: [
      {
        q: `<p>At step t, ᾱ<sub>t</sub> = 0.36. For a pixel with clean value x<sub>0</sub> = 1.0 and noise draw ε = −0.5, what is x<sub>t</sub>? Separately, how many times fewer values does a latent diffusion model process when it maps a 512 × 512 × 3 image to a 64 × 64 × 4 latent?</p>`,
        a: `<ol><li>x<sub>t</sub> = √ᾱ<sub>t</sub> x<sub>0</sub> + √(1 − ᾱ<sub>t</sub>) ε = 0.6 × 1.0 + 0.8 × (−0.5) = <strong>0.2</strong>.</li><li>Image: 512 × 512 × 3 = 786,432 values. Latent: 64 × 64 × 4 = 16,384 values.</li><li>786,432 / 16,384 = <strong>48× fewer</strong>, which cuts the compute per denoising step dramatically.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>An image model runs 50 denoising steps with classifier-free guidance. Each network evaluation costs 0.8 TFLOP, and the GPU sustains 400 TFLOP/s on it. What's the latency, and how would you cut it?</p>`,
        a: `<ol><li>Guidance needs a conditional and an unconditional evaluation per step: 50 × 2 = 100 evaluations.</li><li>Total: 100 × 0.8 = 80 TFLOP. At 400 TFLOP/s: <strong>0.2 s</strong>.</li><li>Cuts: a better sampler (for example 20 steps → 0.08 s), distillation to 1–4 steps, batching the two guidance passes so the GPU runs them as one larger, more efficient batch, lower precision (FP8), or a smaller latent.</li></ol>`
      },
      {
        q: `<p>Why is predicting the noise ε a good training target, and how does it relate to the score ∇ log p(x)?</p>`,
        a: `<p>Because x<sub>t</sub> = √ᾱ<sub>t</sub> x<sub>0</sub> + √(1 − ᾱ<sub>t</sub>) ε, knowing ε tells you how to move x<sub>t</sub> back toward clean data, and regressing it is a simple, stable mean-squared-error problem with a target of the same scale at every step. It is also the score in disguise: for this Gaussian noising, ∇<sub>x<sub>t</sub></sub> log p(x<sub>t</sub>) ≈ −ε<sub>θ</sub>(x<sub>t</sub>, t) / √(1 − ᾱ<sub>t</sub>). So a noise predictor is a learned score function, and sampling is a guided, Langevin-like random walk from noise to data.</p>`
      }
    ]
  }
}
]);
