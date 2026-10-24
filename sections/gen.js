/* Section: Generative models
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "gen"). */

section({
  id: "gen",
  name: "Generative Models",
  cap: "Discriminative vs. generative, stochastic processes, diffusion, GPUs, kernels",
  body: `
<p>This section builds up generative AI from the ground: what separates models that <em>classify</em> from models that <em>create</em>, the randomness underneath both graphics and LLMs, how diffusion models turn noise into images, and why GPUs are the hardware that made all of it practical.</p>
<h3>The Big Picture</h3>
<ul>
<li><strong>Discriminative models</strong> learn p(y | x): given an input, what's the label?</li>
<li><strong>Generative models</strong> learn p(x): what does real data look like, so you can sample new examples?</li>
<li><strong>Stochastic processes</strong> are how sampling actually happens: random walks, Monte Carlo, token-by-token sampling.</li>
<li><strong>Diffusion models</strong> learn to reverse a noising process, one of the most successful generative approaches for images, video, and audio.</li>
<li><strong>GPUs</strong> supply the massively parallel matrix math and memory bandwidth these models need, through <a href="#/gpu-kernels">kernels and Tensor Cores</a>.</li>
</ul><p>For a step-by-step walk from text in to text out, with the hardware at every step, see <a href="#/r/llm">How language models work</a>.</p><p>New to neural networks? Start with <a href="#/nn-basics">Neural network basics</a>.</p>`,
  practice: {
    guided: [
      {
        q: `<p>Classify each as discriminative or generative: (1) a spam filter using logistic regression, (2) GPT-style language model, (3) Stable Diffusion, (4) an image classifier that labels cats vs. dogs, (5) a GAN.</p>`,
        a: `<ol><li>Discriminative: models p(spam | email).</li><li>Generative: models p(text) as a product of next-token probabilities, and can sample new text.</li><li>Generative: samples new images (conditioned on text).</li><li>Discriminative: models p(label | image).</li><li>Generative: the generator produces new samples (its discriminator is a discriminative helper used only in training).</li></ol>`
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
<p>Generating is expensive because the network runs many times per output: once per token for an LLM, once per denoising step for diffusion. See <a href="#/gen-gpus">How GPUs make this possible</a>.</p>`,
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
},

{
  id: "gen-gpus",
  region: "gen",
  title: "How GPUs Make This Possible",
  sections: [{ id: "gpu-arch", label: "GPU Architecture" }, { id: "roofline", label: "Roofline" }, { id: "llm-bound", label: "LLM Inference" }, { id: "diff-gpu", label: "Diffusion on GPUs" }],
  body: `
<p>Generative models are huge piles of matrix math repeated many times. GPUs became the standard platform because they deliver enormous parallel arithmetic and memory bandwidth, and their software stack makes that usable.</p>
<h3 id="sec-gpu-arch">GPU Architecture in Brief</h3>
<ul>
<li><strong>Streaming multiprocessors (SMs):</strong> a GPU has on the order of 100 of them, each running many threads at once.</li>
<li><strong>SIMT warps:</strong> threads execute in groups of 32 in lockstep. Divergent branches inside a warp serialize, so uniform work runs best.</li>
<li><strong>Latency hiding by parallelism:</strong> instead of big caches and out-of-order execution, a GPU keeps thousands of threads in flight and switches to ready warps while others wait on memory.</li>
<li><strong>Tensor Cores:</strong> units that perform small matrix multiply-accumulates in one operation at low precision (FP16, BF16, FP8), providing most of the FLOP/s for AI. See <a href="#/gpu-kernels/tensor-cores">Tensor Cores</a>.</li>
<li><strong>High-bandwidth memory (HBM):</strong> stacked DRAM next to the GPU, delivering several TB/s.</li>
<li><strong>On-chip memory:</strong> large register files and shared memory let kernels reuse data without going to HBM.</li>
</ul>
<h3 id="sec-roofline">The Roofline Model</h3>
<p>Whether a kernel is limited by arithmetic or by memory depends on its <strong>arithmetic intensity</strong>, the FLOPs done per byte moved from memory:</p>
<p class="eq">Attainable FLOP/s = min( peak FLOP/s, memory bandwidth × arithmetic intensity )</p>
<p>The <strong>ridge point</strong> is peak FLOP/s ÷ bandwidth. Kernels below it are memory-bound; above it, compute-bound. For a GPU with about 1,000 TFLOP/s of FP16 and 3.35 TB/s, the ridge is about 300 FLOP/byte.</p>
<ul><li><strong>Large matrix multiply (N × N × N):</strong> intensity ≈ N/3 FLOP/byte in FP16, so big GEMMs are compute-bound.</li><li><strong>Elementwise operations</strong> (activations, normalization): a few FLOPs per byte, so memory-bound. Fusing them into the matrix-multiply kernel avoids extra memory trips.</li></ul>
<h3 id="sec-llm-bound">LLM Inference: Prefill vs. Decode</h3>
<ul>
<li><strong>Prefill</strong> (processing the prompt): all prompt tokens go through the network at once, giving big matrix multiplies that are compute-bound.</li>
<li><strong>Decode</strong> (generating tokens one at a time): every weight is read from memory for each new token, at about 1 FLOP per byte in FP16, so it's memory-bound:</li>
</ul>
<p class="eq">Tokens/s per sequence ≤ <span class="frac"><span>memory bandwidth</span><span>model size in bytes</span></span></p>
<ul>
<li><strong>Batching</strong> serves many users with one weight read per step, raising intensity and throughput.</li>
<li><strong>The KV cache</strong> stores each layer's keys and values for past tokens so they aren't recomputed; it grows with context length and batch size and adds its own memory traffic.</li>
<li><strong>Quantization</strong> (FP8, INT4 weights) shrinks bytes per parameter, directly raising decode speed.</li>
</ul>
<h3 id="sec-diff-gpu">Diffusion on GPUs</h3>
<p>Each denoising step runs a convolution- or attention-heavy network over the entire latent at once: large, regular, parallel work that keeps Tensor Cores busy (compute-bound). The cost is the sequential chain of steps, so latency = steps × time per step. Random noise for each step comes from fast parallel generators, a small cost next to the network itself.</p>
<h3>Scaling Past One GPU</h3>
<p>Big models are split across GPUs with tensor parallelism (each layer's matrices divided among GPUs) and pipeline parallelism (different layers on different GPUs), connected by high-bandwidth links. Communication between GPUs then becomes another bottleneck to model.</p>
<h3>The Energy Question</h3>
<p>Moving data costs far more energy than computing on it, and GPUs spend energy enforcing exact, deterministic arithmetic even for workloads like sampling that are inherently random. That's the motivation for alternative hardware: more on-chip memory, lower precision, specialized accelerators, and probabilistic or thermodynamic designs that compute with physical noise.</p>
<h3>Connecting to Performance Modeling</h3>
<p>The same questions from CPU work apply: what's the bottleneck (compute, memory bandwidth, latency, communication), what's the arithmetic intensity, how well are the units utilized (occupancy, warp divergence, memory coalescing), and how does a design change move the workload on the roofline?</p>`,
  practice: {
    guided: [
      {
        q: `<p>A 70-billion-parameter LLM stored in FP16 runs on a GPU with 3.35 TB/s of memory bandwidth. Estimate the maximum tokens per second at batch size 1, and the aggregate rate at batch size 32 (ignore the KV cache).</p>`,
        a: `<ol><li>Weights: 70 × 10<sup>9</sup> × 2 bytes = 140 GB, all read once per generated token.</li><li>Time per token ≥ 140 GB / 3.35 TB/s ≈ 42 ms, so at most <strong>about 24 tokens/s</strong>.</li><li>At batch 32, the same weight read serves 32 sequences per step, so the step still takes about 42 ms while it stays memory-bound: about 32 × 24 ≈ <strong>760 tokens/s</strong> in aggregate.</li><li>Real numbers are lower (KV cache traffic, imperfect bandwidth use), and a 140 GB model needs more than one GPU's memory anyway.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A GPU offers about 1,000 TFLOP/s (FP16) and 3.35 TB/s. Is a 4096 × 4096 × 4096 FP16 matrix multiply compute-bound or memory-bound? What about LLM decode at batch 1?</p>`,
        a: `<p>Ridge point = 1,000 × 10<sup>12</sup> / 3.35 × 10<sup>12</sup> ≈ <strong>300 FLOP/byte</strong>.</p><p>GEMM: 2N<sup>3</sup> FLOPs over about 3N<sup>2</sup> × 2 bytes moved gives an intensity of N/3 ≈ 1,365 FLOP/byte, well above the ridge, so it's <strong>compute-bound</strong>. Decode at batch 1: about 2 FLOPs per parameter per token and 2 bytes per parameter, so about 1 FLOP/byte, far below the ridge, so it's <strong>memory-bound</strong>, using well under 1% of peak FLOP/s.</p>`
      },
      {
        q: `<p>Why does FlashAttention speed up attention without changing the math?</p>`,
        a: `<p>Standard attention writes the full N × N score matrix to GPU memory (HBM), reads it back for softmax, and reads it again to multiply by V: huge memory traffic for long sequences. FlashAttention splits Q, K, and V into tiles that fit in on-chip shared memory, computes softmax incrementally (tracking running maximums and sums), and never writes the full N × N matrix to HBM. Same results, far fewer bytes moved, so higher arithmetic intensity. It's a memory-hierarchy optimization, the same idea as cache blocking in CPU code.</p>`
      }
    ]
  }
},

{
  id: "gpu-kernels",
  region: "gen",
  title: "GPU Kernels and Tensor Cores",
  sections: [{ id: "kernels", label: "What a Kernel Is" }, { id: "memory", label: "Where the Data Lives" }, { id: "gemm", label: "How a GEMM Kernel Works" }, { id: "epilogue", label: "Epilogues and Fusion" }, { id: "tensor-cores", label: "Tensor Cores" }, { id: "stack", label: "Who Writes These Kernels" }],
  body: `
<p>The hardware views across these notes keep saying that some piece of work is done “by a kernel” or “on Tensor Cores.” This page covers both: what a GPU kernel is, how a matrix-multiply kernel is organized, what an epilogue is, and what Tensor Cores actually compute. For GPU basics (SMs, warps, HBM) and the roofline model, see <a href="#/gen-gpus">How GPUs make this possible</a>.</p>

<h3 id="sec-kernels">What a Kernel Is</h3>
<p>A <strong>kernel</strong> is a function that runs on the GPU. The CPU launches it, and thousands of GPU threads run it at once. Every thread runs the same code; each uses its own index to pick the data it's responsible for.</p>
<ul>
<li><strong>Grid, blocks, warps, threads.</strong> A launch creates a <em>grid</em> of thread <em>blocks</em>. Each block runs on one SM, and its threads can cooperate through that SM's fast shared memory. The SM executes a block's threads in <em>warps</em> of 32.</li>
<li><strong>A model is a sequence of kernels.</strong> A forward pass is a chain of launches: a matrix multiply, then a normalization, then an activation, and so on. Each launch costs a few microseconds of overhead, and every kernel that writes its result to HBM forces the next kernel to read it back.</li>
</ul>
<p>Here's a minimal CUDA kernel: the bias + ReLU step from <a href="#/nn-basics/nn-hw">Neural network basics</a>, run as its own kernel.</p>
<pre><code><span class="cm">// y[i] = max(0, x[i] + b[i % n]) over a batch of rows of length n</span>
__global__ void bias_relu(const float *x, const float *b, float *y, int n, int total) {
  int i = blockIdx.x * blockDim.x + threadIdx.x;   <span class="cm">// this thread's element</span>
  if (i &lt; total) y[i] = fmaxf(0.0f, x[i] + b[i % n]);
}

<span class="cm">// launch enough 256-thread blocks to cover every element</span>
bias_relu&lt;&lt;&lt;(total + 255) / 256, 256&gt;&gt;&gt;(x, b, y, n, total);</code></pre>
<p>Each element costs 2 FLOPs (an add and a max) but moves 8 bytes (read <code>x</code>, write <code>y</code>; <code>b</code> stays in cache):</p>
<div class="math">\\[ \\text{AI} = \\frac{2 \\text{ FLOPs}}{8 \\text{ B}} = 0.25 \\ \\text{FLOP/B} \\]</div>
<p>That's far below the ridge point of any GPU, so on its own this kernel is purely memory-bound. That's why it's usually folded into the matrix multiply before it (see <a href="#/gpu-kernels/epilogue">Epilogues and Fusion</a>).</p>

<h3 id="sec-memory">Where the Data Lives</h3>
<p>Fast kernels are mostly about moving data down this hierarchy once and reusing it many times. Rough numbers for an NVIDIA H100 (SXM):</p>
<div class="tbl"><table>
<tr><th>Level</th><th>Shared by</th><th>Size</th><th>Notes</th></tr>
<tr><td>Registers</td><td>One thread</td><td>256 KB per SM</td><td>Where GEMM accumulators live</td></tr>
<tr><td>Shared memory / L1</td><td>One block</td><td>Up to 228 KB per SM</td><td>Software-managed; holds the tiles being multiplied</td></tr>
<tr><td>L2 cache</td><td>Whole GPU</td><td>50 MB</td><td>Catches reuse between neighboring blocks</td></tr>
<tr><td>HBM</td><td>Whole GPU</td><td>80 GB</td><td>About 3.35 TB/s; the bottleneck for memory-bound kernels</td></tr>
</table></div>
<p>Two rules follow from this:</p>
<ul>
<li><strong>Coalesce:</strong> the 32 threads of a warp should touch consecutive addresses, so one wide memory transaction serves the whole warp instead of 32 separate ones.</li>
<li><strong>Reuse:</strong> load a tile into shared memory or registers once and use each value many times before discarding it. This is cache blocking from CPU code, managed by hand.</li>
</ul>

<h3 id="sec-gemm">How a GEMM Kernel Works</h3>
<p>A matrix multiply (GEMM) of an \\(M \\times K\\) matrix by a \\(K \\times N\\) matrix is the kernel everything else is built around. A naive kernel gives each thread one element of \\(C\\) and loops over \\(K\\), reading \\(A\\) and \\(B\\) from HBM every time: about 2 FLOPs per 4 bytes in FP16, far below the ridge. Real GEMM kernels use <strong>tiling</strong>:</p>
<ol>
<li><strong>Block tile:</strong> each thread block owns one \\(B_M \\times B_N\\) tile of \\(C\\), for example 128 × 128.</li>
<li><strong>K loop:</strong> the block walks along \\(K\\) in steps of \\(B_K\\). At each step it copies a \\(B_M \\times B_K\\) slice of \\(A\\) and a \\(B_K \\times B_N\\) slice of \\(B\\) from HBM into shared memory.</li>
<li><strong>Warp tiles:</strong> each warp multiplies its part of those slices on Tensor Cores.</li>
<li><strong>Accumulators stay in registers</strong> for the whole K loop. \\(C\\) is written to HBM only once, at the end, in the <em>epilogue</em>.</li>
</ol>
<div class="tbl"><svg viewBox="0 0 680 340" role="img" aria-label="Tiling a matrix multiply. Matrix A is M by K on the left, B is K by N on top, and C is M by N at the bottom right. One block tile of C, B_M by B_N, is highlighted. Its row panel of A and column panel of B are shaded, and within them the current B_K slices are highlighted: at each K step the block copies one slice of A and one slice of B into shared memory and accumulates their product." style="width:100%;min-width:560px;max-width:680px;display:block;font-family:var(--sans)">
<g style="fill:var(--surface);stroke:var(--muted);stroke-width:1.2"><rect x="100" y="160" width="120" height="140"/><rect x="250" y="20" width="300" height="120"/><rect x="250" y="160" width="300" height="140"/></g>
<g style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1"><rect x="100" y="200" width="120" height="40"/><rect x="340" y="20" width="60" height="120"/></g>
<g style="fill:var(--pad);fill-opacity:.45;stroke:var(--pad);stroke-width:1.5"><rect x="140" y="200" width="30" height="40"/><rect x="340" y="60" width="60" height="30"/></g>
<rect x="340" y="200" width="60" height="40" style="fill:var(--pad);stroke:var(--pad);stroke-width:1.5"/>
<g text-anchor="middle" style="font-size:13px;font-weight:600;fill:var(--ink)"><text x="160" y="318">A (M × K)</text><text x="400" y="14">B (K × N)</text><text x="400" y="318">C (M × N)</text></g>
<g style="font-size:11px;fill:var(--muted)">
<text x="92" y="224" text-anchor="end">row panel</text>
<text x="408" y="40" text-anchor="start">column panel</text>
<text x="155" y="194" text-anchor="middle">B<tspan baseline-shift="sub" style="font-size:8px">M</tspan> × B<tspan baseline-shift="sub" style="font-size:8px">K</tspan> slice</text>
<text x="408" y="79" text-anchor="start">B<tspan baseline-shift="sub" style="font-size:8px">K</tspan> × B<tspan baseline-shift="sub" style="font-size:8px">N</tspan> slice</text>
<text x="408" y="224" text-anchor="start">block tile B<tspan baseline-shift="sub" style="font-size:8px">M</tspan> × B<tspan baseline-shift="sub" style="font-size:8px">N</tspan></text>
<text x="408" y="238" text-anchor="start">(accumulates in registers)</text>
</g>
<g style="stroke:var(--pad);stroke-width:1.2;stroke-dasharray:4 3;fill:none"><path d="M170,220 L340,220"/><path d="M370,90 L370,200"/></g>
<text x="565" y="170" style="font-size:11px;fill:var(--muted)" text-anchor="start">Each K step: copy</text>
<text x="565" y="184" style="font-size:11px;fill:var(--muted)" text-anchor="start">both gold slices to</text>
<text x="565" y="198" style="font-size:11px;fill:var(--muted)" text-anchor="start">shared memory,</text>
<text x="565" y="212" style="font-size:11px;fill:var(--muted)" text-anchor="start">multiply on Tensor</text>
<text x="565" y="226" style="font-size:11px;fill:var(--muted)" text-anchor="start">Cores, add into the</text>
<text x="565" y="240" style="font-size:11px;fill:var(--muted)" text-anchor="start">tile. Then slide</text>
<text x="565" y="254" style="font-size:11px;fill:var(--muted)" text-anchor="start">both slices along K.</text>
</svg></div>
<p>Per K step, the block does \\(2 B_M B_N B_K\\) FLOPs and loads \\((B_M + B_N) B_K\\) FP16 values at 2 bytes each, so the arithmetic intensity of its HBM traffic is:</p>
<div class="math">\\[ \\text{AI} = \\frac{2\\,B_M B_N B_K}{2\\,(B_M + B_N)\\,B_K} = \\frac{B_M B_N}{B_M + B_N} \\ \\text{FLOP/B} \\]</div>
<p>A 128 × 128 tile gives 64 FLOP/byte. Neighboring blocks load the same slices of \\(A\\) and \\(B\\), so L2 hits raise the effective intensity above that. Bigger tiles mean more reuse, limited by how much shared memory and how many registers each SM has. Fast kernels also <strong>pipeline</strong> the K loop: while the Tensor Cores work on one slice, the next one is already being copied in (on Hopper, by the Tensor Memory Accelerator, TMA).</p>

<h3 id="sec-epilogue">Epilogues and Fusion</h3>
<p>When the K loop finishes, the block's results are still sitting in registers. Anything elementwise that comes next can be applied right there, before \\(C\\) is written to HBM. That final stage is the <strong>epilogue</strong>. BLAS bakes the simplest one into the GEMM definition:</p>
<div class="math">\\[ C \\leftarrow \\alpha AB + \\beta C \\]</div>
<ul>
<li><strong>Bias for free:</strong> preload \\(C\\) with the bias and set \\(\\beta = 1\\), and the bias add rides along with the GEMM.</li>
<li><strong>Fused epilogues:</strong> cuBLASLt and CUTLASS can also apply ReLU or GELU, add a residual, or rescale to FP8 in the epilogue.</li>
<li><strong>What fusion saves:</strong> a whole kernel launch and an HBM round trip for every fused operation. The bias + ReLU kernel above disappears entirely, along with its 8 bytes per element.</li>
<li><strong>The extreme case:</strong> fusing an entire attention computation into one kernel, so the large score matrix never touches HBM. That's FlashAttention (see the practice problems in <a href="#/gen-gpus">How GPUs make this possible</a>).</li>
</ul>

<h3 id="sec-tensor-cores">Tensor Cores</h3>
<p>A <strong>Tensor Core</strong> is a unit inside each SM that performs a small matrix multiply-accumulate (MMA) as a single operation:</p>
<div class="math">\\[ D = A \\cdot B + C \\]</div>
<p>\\(A\\) and \\(B\\) are small low-precision tiles (FP16, BF16, FP8); \\(C\\) and \\(D\\) are usually FP32 accumulators. A whole warp issues the instruction together. For example, the PTX instruction <code>mma.sync.m16n8k16</code> (available since Ampere) multiplies a 16 × 16 tile of \\(A\\) by a 16 × 8 tile of \\(B\\) and adds the result to a 16 × 8 tile of \\(C\\):</p>
<div class="math">\\[ m \\times n \\times k = 16 \\times 8 \\times 16 = 2{,}048 \\text{ FMAs} = 4{,}096 \\text{ FLOPs per warp instruction} \\]</div>
<p>A regular FP32 FMA instruction does 32 FMAs per warp, one per thread. One Tensor Core instruction does 64 times that work with a single fetch, decode, and issue. Peak dense throughput on an H100 (SXM):</p>
<div class="tbl"><table>
<tr><th>Math</th><th>Runs on</th><th>Peak dense TFLOP/s</th></tr>
<tr><td>FP32</td><td>Regular CUDA cores</td><td>67</td></tr>
<tr><td>TF32</td><td>Tensor Cores</td><td>495</td></tr>
<tr><td>FP16 / BF16</td><td>Tensor Cores</td><td>989</td></tr>
<tr><td>FP8</td><td>Tensor Cores</td><td>1,979</td></tr>
</table></div>
<h4>How They've Evolved</h4>
<ul>
<li><strong>Volta (V100, 2017):</strong> the first Tensor Cores; FP16 inputs with FP32 accumulation.</li>
<li><strong>Ampere (A100):</strong> added BF16, TF32, and 2:4 structured sparsity.</li>
<li><strong>Hopper (H100):</strong> added FP8, and warpgroup MMA (<code>wgmma</code>), where four warps (128 threads) issue one larger MMA that reads its inputs straight from shared memory. The TMA copies tiles in asynchronously.</li>
<li><strong>Blackwell (B200):</strong> added FP6 and FP4, and <code>tcgen05</code> MMA instructions whose accumulators live in a dedicated tensor memory instead of the register file.</li>
</ul>
<h4>Why They're So Much Faster</h4>
<ul>
<li><strong>Amortized control:</strong> one instruction launches thousands of FMAs, so the energy of fetching, decoding, and scheduling instructions is spread thin.</li>
<li><strong>Reuse inside the unit:</strong> in an \\(m \\times n \\times k\\) MMA, each value of \\(A\\) is used \\(n\\) times and each value of \\(B\\) is used \\(m\\) times without another register-file read. Reading operands costs more energy than the multiply itself.</li>
<li><strong>Low precision:</strong> a multiplier's area grows roughly with the square of its mantissa width, so FP16 and FP8 multipliers are much smaller than FP32 ones, and many more fit in the same area.</li>
<li><strong>FP32 accumulation</strong> keeps long sums accurate even when the inputs are low precision.</li>
</ul>
<p>The catch: Tensor Cores only speed up matrix multiplies of reasonable size. Elementwise work, reductions, and softmax still run on the regular CUDA cores. And if tiles can't be delivered fast enough, the Tensor Cores sit idle. Tiling, the TMA, and fusion exist to keep them fed.</p>

<h3 id="sec-stack">Who Writes These Kernels</h3>
<ul>
<li><strong>Vendor libraries:</strong> cuBLAS and cuBLASLt for GEMMs, cuDNN for convolutions and attention. Most frameworks call these underneath.</li>
<li><strong>Templates:</strong> CUTLASS, NVIDIA's C++ templates for building custom GEMMs and epilogues.</li>
<li><strong>Kernel languages:</strong> Triton lets you write block-level kernels in Python while its compiler handles warps, shared memory, and Tensor Cores. PyTorch's <code>torch.compile</code> generates Triton kernels.</li>
<li><strong>Profiling:</strong> Nsight Compute reports a kernel's achieved FLOP/s, memory throughput, and where it sits on the roofline: the GPU version of the counter-based analysis in <a href="#/perf-stats">Performance statistics</a>.</li>
</ul>
<p class="refs">Textbook connection: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em> (6th ed.), Chapter 4, Data-Level Parallelism in Vector, SIMD, and GPU Architectures (the GPU programming and memory model), and Chapter 7, Domain-Specific Architectures (matrix units like the TPU's). H100 figures are from NVIDIA's H100 specifications; the <code>mma</code> shapes are from NVIDIA's PTX ISA documentation.</p>
`,
  practice: {
    guided: [
      {
        q: `<p>A CUTLASS-style GEMM kernel uses 256 × 128 block tiles with \\(B_K = 64\\) in FP16. Per K step, how many FLOPs does a block do, how many bytes does it load, and what's the arithmetic intensity? What changes with 128 × 64 tiles? Compare both with an A100's ridge point (312 TFLOP/s FP16, 2.04 TB/s).</p>`,
        a: `<ol><li>FLOPs: \\(2 \\times 256 \\times 128 \\times 64 = 4{,}194{,}304\\).</li><li>Bytes: \\((256 + 128) \\times 64\\) values \\(\\times\\) 2 B \\(= 49{,}152\\) B.</li><li>Intensity: \\(4{,}194{,}304 / 49{,}152 \\approx\\) <strong>85 FLOP/byte</strong>, matching \\(B_M B_N / (B_M + B_N) = 256 \\cdot 128 / 384\\).</li><li>With 128 × 64 tiles: \\(128 \\cdot 64 / 192 \\approx\\) <strong>43 FLOP/byte</strong>. Smaller tiles, less reuse.</li><li>A100 ridge: \\(312 / 2.04 \\approx\\) <strong>153 FLOP/byte</strong>. Neither tile reaches it from HBM alone; L2 hits between neighboring blocks make up the difference, which is why tile scheduling order (rasterization) matters.</li></ol>`
      },
      {
        q: `<p>During prefill, Llama 3 8B's MLP up-projection multiplies 2,048 tokens × 4,096 hidden by a 4,096 × 14,336 weight matrix. How many <code>mma.sync.m16n8k16</code> instructions is that, and how long would it take at an A100's FP16 peak of 312 TFLOP/s?</p>`,
        a: `<ol><li>Shape: \\(M = 2{,}048\\), \\(N = 14{,}336\\), \\(K = 4{,}096\\). FMAs: \\(MNK \\approx 1.20 \\times 10^{11}\\).</li><li>Each instruction does 2,048 FMAs, so \\(MNK / 2{,}048 = 14{,}336 \\times 4{,}096 \\approx\\) <strong>58.7 million</strong> warp-level MMA instructions.</li><li>FLOPs: \\(2MNK \\approx 2.41 \\times 10^{11}\\). At 312 TFLOP/s: about <strong>770 µs</strong>. Real kernels reach roughly 70–80% of peak, so closer to 1 ms.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>In BERT-large, the feed-forward up-projection produces a 4,096-wide output per token, followed by a bias add and GELU. For a batch of 32 sequences × 512 tokens in FP16 on an A100 (2.04 TB/s, 312 TFLOP/s), estimate what fusing the bias and GELU into the GEMM's epilogue saves.</p>`,
        a: `<ol><li>Tokens: \\(32 \\times 512 = 16{,}384\\). Output: \\(16{,}384 \\times 4{,}096 \\times 2\\) B ≈ <strong>134 MB</strong>.</li><li>Unfused: the bias kernel reads and writes it (268 MB), and the GELU kernel does the same (268 MB): about <strong>537 MB</strong> of extra HBM traffic, plus two extra launches.</li><li>At 2.04 TB/s that's about <strong>263 µs</strong>.</li><li>The GEMM itself (\\(2 \\times 16{,}384 \\times 1{,}024 \\times 4{,}096\\) FLOPs, since BERT-large's hidden size is 1,024) takes about 440 µs at peak. So the unfused elementwise kernels add roughly 60% on top, and fusion removes nearly all of it.</li></ol>`
      },
      {
        q: `<p>A large FP16 GEMM runs about 16× faster on an A100's Tensor Cores (312 TFLOP/s) than the same math in FP32 on CUDA cores (19.5 TFLOP/s). Why? And why does a 256 × 256 × 64 GEMM (one attention head's \\(QK^\\top\\) for a 256-token sequence with head dimension 64) see almost none of that speedup?</p>`,
        a: `<p>The big GEMM is compute-bound, so its speed tracks peak throughput: \\(312 / 19.5 = 16\\times\\). That gap comes from amortizing instruction overhead over thousands of FMAs, reusing operands inside the unit, and smaller low-precision multipliers.</p><p>The small GEMM is \\(2 \\times 256 \\times 256 \\times 64 \\approx 8.4\\) MFLOP: about 27 ns of work at peak. With 128 × 128 tiles it's only 4 blocks, so 4 of the A100's 108 SMs have anything to do, and a kernel launch alone costs a few microseconds. Fixes: batch all heads and sequences into one launch (batched GEMM), or fuse the whole attention computation into one kernel, as FlashAttention does.</p>`
      }
    ]
  }
}
]);
