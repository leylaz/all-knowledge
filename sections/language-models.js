/* Section: How language models work
   One region of the die plus its pages, in display order.
   To add a page, append an object to the list below (region: "llm"). */

section({
  id: "llm",
  name: "How Language Models Work",
  cap: "Text in to text out, step by step, and what the hardware does at each step",
  sections: [{ id: "map", label: "The Whole Journey" }, { id: "phases", label: "Two Phases" }, { id: "example", label: "The Running Example" }, { id: "time", label: "Where the Time Goes" }],
  body: `
<p>This section follows one request from the moment you press enter to the moment text streams back. Every page covers one step twice: what the model does mathematically, and what the hardware does to make it happen.</p>
<h3 id="sec-map">The Whole Journey</h3>
<div class="tbl"><svg viewBox="0 0 680 250" role="img" aria-label="The LLM pipeline. Top row: text in, tokenize into token IDs on the CPU, embed each ID into a vector of 8,192 numbers, then 80 transformer blocks of attention and MLP, which read and write the KV cache in GPU memory. Bottom row, right to left: the LM head and softmax turn the final vector into probabilities, sampling picks the next token, detokenizing turns the ID into text on the CPU, and the text streams out. The new token also loops back into the embedding step to generate the next one." style="width:100%;min-width:600px;max-width:680px;display:block;font-family:var(--sans)">
<defs><marker id="arrLLM" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" style="fill:var(--muted)"/></marker></defs>
<rect x="10" y="30" width="140" height="56" rx="3" style="fill:var(--surface);stroke:var(--trace);stroke-width:1.5"/>
<text x="80" y="54" text-anchor="middle" style="fill:var(--ink);font-size:14px;font-weight:600">Text in</text>
<text x="80" y="72" text-anchor="middle" style="fill:var(--muted);font-size:11px">your prompt</text>
<rect x="180" y="30" width="140" height="56" rx="3" style="fill:var(--surface);stroke:var(--trace);stroke-width:1.5"/>
<text x="250" y="54" text-anchor="middle" style="fill:var(--ink);font-size:14px;font-weight:600">Tokenize</text>
<text x="250" y="72" text-anchor="middle" style="fill:var(--muted);font-size:11px">text → token IDs (CPU)</text>
<rect x="350" y="30" width="140" height="56" rx="3" style="fill:var(--surface);stroke:var(--trace);stroke-width:1.5"/>
<text x="420" y="54" text-anchor="middle" style="fill:var(--ink);font-size:14px;font-weight:600">Embed</text>
<text x="420" y="72" text-anchor="middle" style="fill:var(--muted);font-size:11px">ID → 8,192 numbers</text>
<rect x="520" y="30" width="150" height="56" rx="3" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1.5"/>
<text x="595" y="54" text-anchor="middle" style="fill:var(--ink);font-size:14px;font-weight:600">80 blocks</text>
<text x="595" y="72" text-anchor="middle" style="fill:var(--muted);font-size:11px">attention + MLP (GPU)</text>
<rect x="520" y="170" width="150" height="56" rx="3" style="fill:var(--surface);stroke:var(--trace);stroke-width:1.5"/>
<text x="595" y="194" text-anchor="middle" style="fill:var(--ink);font-size:14px;font-weight:600">LM head + softmax</text>
<text x="595" y="212" text-anchor="middle" style="fill:var(--muted);font-size:11px">vector → probabilities</text>
<rect x="350" y="170" width="140" height="56" rx="3" style="fill:var(--surface);stroke:var(--trace);stroke-width:1.5"/>
<text x="420" y="194" text-anchor="middle" style="fill:var(--ink);font-size:14px;font-weight:600">Sample</text>
<text x="420" y="212" text-anchor="middle" style="fill:var(--muted);font-size:11px">pick the next token</text>
<rect x="180" y="170" width="140" height="56" rx="3" style="fill:var(--surface);stroke:var(--trace);stroke-width:1.5"/>
<text x="250" y="194" text-anchor="middle" style="fill:var(--ink);font-size:14px;font-weight:600">Detokenize</text>
<text x="250" y="212" text-anchor="middle" style="fill:var(--muted);font-size:11px">ID → text (CPU)</text>
<rect x="10" y="170" width="140" height="56" rx="3" style="fill:var(--surface);stroke:var(--trace);stroke-width:1.5"/>
<text x="80" y="194" text-anchor="middle" style="fill:var(--ink);font-size:14px;font-weight:600">Text out</text>
<text x="80" y="212" text-anchor="middle" style="fill:var(--muted);font-size:11px">streamed to you</text>
<line x1="150" y1="58" x2="178" y2="58" style="stroke:var(--muted);stroke-width:1.5" marker-end="url(#arrLLM)"/>
<line x1="320" y1="58" x2="348" y2="58" style="stroke:var(--muted);stroke-width:1.5" marker-end="url(#arrLLM)"/>
<line x1="490" y1="58" x2="518" y2="58" style="stroke:var(--muted);stroke-width:1.5" marker-end="url(#arrLLM)"/>
<line x1="560" y1="86" x2="560" y2="168" style="stroke:var(--muted);stroke-width:1.5" marker-end="url(#arrLLM)"/>
<line x1="520" y1="198" x2="492" y2="198" style="stroke:var(--muted);stroke-width:1.5" marker-end="url(#arrLLM)"/>
<line x1="350" y1="198" x2="322" y2="198" style="stroke:var(--muted);stroke-width:1.5" marker-end="url(#arrLLM)"/>
<line x1="180" y1="198" x2="152" y2="198" style="stroke:var(--muted);stroke-width:1.5" marker-end="url(#arrLLM)"/>
<line x1="420" y1="170" x2="420" y2="88" style="stroke:var(--pad);stroke-width:1.5" marker-end="url(#arrLLM)"/>
<text x="428" y="124" style="fill:var(--ink);font-size:11px">new token</text>
<text x="428" y="138" style="fill:var(--ink);font-size:11px">feeds back in</text>
<rect x="584" y="108" width="86" height="40" rx="3" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.5;stroke-dasharray:4 3"/>
<text x="627" y="125" text-anchor="middle" style="fill:var(--ink);font-size:12px;font-weight:600">KV cache</text>
<text x="627" y="140" text-anchor="middle" style="fill:var(--muted);font-size:10px">in GPU memory</text>
<line x1="627" y1="86" x2="627" y2="108" style="stroke:var(--pad);stroke-width:1.5;stroke-dasharray:4 3"/>
</svg></div>
<ol>
<li><a href="#/llm-tokens">Tokenize</a>: split the text into tokens and map each to an integer ID.</li>
<li><a href="#/llm-embed">Embed</a>: look up a vector for each ID. That vector becomes the token's working memory, the residual stream.</li>
<li><a href="#/llm-attention">Attention</a>: each token gathers information from earlier tokens.</li>
<li><a href="#/llm-block">MLP, norms, and residuals</a>: each token's vector is transformed on its own. Attention plus MLP is one block; the model stacks 80 of them.</li>
<li><a href="#/llm-output">LM head and sampling</a>: turn the last vector into a probability for every token in the vocabulary, pick one, and turn it back into text.</li>
<li><strong>Repeat</strong>: the new token goes back in as input, and the loop runs once per output token. The <a href="#/llm-kvcache">KV cache</a> is what keeps this loop from redoing all earlier work.</li>
</ol>
<p>The weights used in every step were learned in training by maximizing the probability of real text (see <a href="#/gen-generative">Generative models</a>). This section is about <strong>inference</strong>: running a trained model.</p>
<h3 id="sec-phases">Two Phases</h3>
<p>A request runs in two very different phases, covered in <a href="#/llm-phases">Prefill and decode</a>:</p>
<ul>
<li><strong>Prefill:</strong> the whole prompt goes through the model at once. Big matrix multiplies, compute-bound. It ends with the first output token.</li>
<li><strong>Decode:</strong> every later token is generated one at a time, each step depending on the previous one. Small matrix-vector work that must read every weight and the whole KV cache, so it's memory-bandwidth-bound.</li>
</ul>
<h3 id="sec-example">The Running Example</h3>
<p>Every page uses the same model so the numbers connect: a Llama-3-70B-style dense transformer stored in BF16 (2 bytes per number), served on one server with 8 GPUs that each have 80 GB of HBM at 3.35 TB/s and about 990 TFLOP/s of dense BF16 compute (H100-class).</p>
<div class="tbl"><table>
<tr><th>Setting</th><th>Value</th><th>Symbol</th></tr>
<tr><td>Layers (transformer blocks)</td><td>80</td><td>L</td></tr>
<tr><td>Model width (residual stream)</td><td>8,192</td><td>d</td></tr>
<tr><td>Query heads × head size</td><td>64 × 128</td><td>n<sub>q</sub> × d<sub>h</sub></td></tr>
<tr><td>Key/value heads</td><td>8 (grouped-query attention)</td><td>n<sub>kv</sub></td></tr>
<tr><td>MLP width</td><td>28,672</td><td>d<sub>ff</sub></td></tr>
<tr><td>Vocabulary</td><td>128,256 tokens</td><td>V</td></tr>
<tr><td>Parameters</td><td>≈ 70.6 billion</td><td>P</td></tr>
<tr><td>Weights in BF16</td><td>≈ 141 GB</td><td></td></tr>
<tr><td>KV cache per token</td><td>≈ 0.33 MB</td><td></td></tr>
</table></div>
<h3 id="sec-time">Where the Time Goes</h3>
<p>For one decode step at batch size 1 with a short context:</p>
<div class="tbl"><table>
<tr><th>Step</th><th>Runs on</th><th>Limited by</th><th>Share of time</th></tr>
<tr><td>Tokenize / detokenize</td><td>CPU</td><td>Tiny string work</td><td>Negligible</td></tr>
<tr><td>Embedding lookup</td><td>GPU</td><td>One 16 KB row read</td><td>Negligible</td></tr>
<tr><td>80 transformer blocks</td><td>GPU</td><td>Reading 139 GB of weights from HBM</td><td>Nearly all</td></tr>
<tr><td>LM head</td><td>GPU</td><td>Reading 2.1 GB of weights</td><td>About 1.5%</td></tr>
<tr><td>Sampling</td><td>GPU, then a 4-byte copy to CPU</td><td>Synchronization</td><td>Small, but adds up per token</td></tr>
</table></div>
<p>At long contexts and large batches, reading the KV cache joins the weights as a major cost. The page <a href="#/llm-hardware">One token through the hardware</a> puts the whole picture together.</p>
<p class="refs">Further reading:</p><ul class="refs"><li>Vaswani et al., “Attention Is All You Need” (NeurIPS 2017), the original transformer paper</li><li>Jay Alammar, “The Illustrated Transformer” (blog), for visual intuition</li><li>Andrej Karpathy, “Let’s build GPT: from scratch, in code, spelled out” (video) and nanoGPT (code)</li><li>Pope et al., “Efficiently Scaling Transformer Inference” (MLSys 2023), for the hardware view</li><li>Meta, “The Llama 3 Herd of Models” (2024), for the running example’s architecture</li></ul>`,
  practice: {
    guided: [
      {
        q: `<p>Count the parameters of the running example, which has 80 layers. Per layer:</p><ul><li>W<sub>Q</sub> and W<sub>O</sub> are 8,192 × 8,192</li><li>W<sub>K</sub> and W<sub>V</sub> are 8,192 × 1,024</li><li>The MLP has three matrices of 8,192 × 28,672</li></ul><p>The embedding table and the separate LM head are each 128,256 × 8,192. Ignore norms. How many parameters in total, how many GB in BF16, and does it fit on one 80 GB GPU?</p>`,
        a: `<ol><li>Attention per layer: 2 × 67.1M + 2 × 8.4M ≈ 151.0M.</li><li>MLP per layer: 3 × 8,192 × 28,672 ≈ 704.6M.</li><li>Per layer: ≈ 855.6M. Times 80 layers: ≈ 68.45B.</li><li>Embedding + LM head: 2 × 1.05B ≈ 2.10B.</li><li>Total ≈ <strong>70.6B parameters</strong>, × 2 bytes ≈ <strong>141 GB</strong>, which doesn't fit on one 80 GB GPU.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>“Walk me through what happens, end to end, between a user pressing enter on a chat prompt and seeing the first word appear.”</p>`,
        a: `<ol><li>The request reaches a serving system, which wraps it in the chat template and tokenizes it on the CPU.</li><li>A scheduler adds it to the running batch (continuous batching) and allocates KV cache blocks; matching prefix blocks may already be cached.</li><li>Prefill: token IDs go to the GPUs, embeddings are looked up, and all prompt tokens run through the 80 blocks in parallel as large matrix multiplies, writing each layer’s keys and values into the KV cache. Weights are split across GPUs with tensor parallelism, so every layer ends with all-reduces over NVLink.</li><li>The LM head turns the last position’s vector into 128,256 logits; sampling picks a token.</li><li>The token ID is copied to the CPU, detokenized (buffering incomplete UTF-8), and streamed back.</li><li>Time to first token = queueing + prefill (compute-bound, grows with prompt length) + overheads. After that, each token costs one decode step, which is memory-bound.</li></ol>`
      }
    ]
  }
}, [
{
  id: "llm-tokens",
  region: "llm",
  title: "Tokens and Tokenization",
  sections: [
    { id: "what", label: "What a Token Is" },
    { id: "bpe", label: "Byte-Pair Encoding" },
    { id: "chat", label: "Special Tokens and Chat Templates" },
    { id: "consequences", label: "Why Tokens Matter" },
    { id: "tok-hw", label: "The Hardware View" }
  ],
  body: `
<h3 id="sec-what">What a Token Is</h3>
<p>A language model can’t read characters directly. It works with a fixed <strong>vocabulary</strong> of tokens, and each token has an integer ID. Our running example has 128,256 tokens; GPT-2 had 50,257. A token is usually a common word, a piece of a word, a punctuation mark, or a few bytes.</p>
<p>In English, one token averages about 4 characters, or about three-quarters of a word. The sentence “The cat sat on the mat.” might become [“The”, “ cat”, “ sat”, “ on”, “ the”, “ mat”, “.”]: seven tokens. Note that the leading space belongs to the token.</p>
<p>Why not use characters or whole words? Characters make sequences about four times longer, and as later pages show, cost grows with sequence length. Whole words need an enormous vocabulary and still can’t handle new words or typos. Subword tokens sit in between.</p>
<h3 id="sec-bpe">Byte-Pair Encoding</h3>
<p>Most LLM tokenizers use <strong>byte-pair encoding (BPE)</strong> or a close variant. Training the tokenizer (separate from training the model) works like this:</p>
<ol>
<li>Start with the 256 possible bytes as the base vocabulary. Any text can be written in bytes, so nothing is ever “unknown.”</li>
<li>Count every adjacent pair of tokens across a huge training corpus.</li>
<li>Merge the most frequent pair into a new token and record the merge.</li>
<li>Repeat until the vocabulary reaches its target size.</li>
</ol>
<p>Example: in a corpus with “newest” 6 times, “widest” 3 times, and “low” 5 times, the pair e + s appears 9 times, so it merges first into “es.” Then es + t (9 times) becomes “est.” Then l + o and lo + w build “low.” Now the unseen word “lowest” encodes as just two tokens: “low” + “est.”</p>
<p>To encode new text, the tokenizer applies the learned merges in the order they were learned. The output is simply a list of integers, such as [791, 8415, 7731, …] (illustrative IDs).</p>
<h3 id="sec-chat">Special Tokens and Chat Templates</h3>
<p>Vocabularies include <strong>special tokens</strong> that never appear in normal text: begin-of-text, end-of-text, and markers for chat roles. When you send a chat message, the serving system wraps it in a <strong>chat template</strong> before tokenizing, something like: system marker, system prompt, user marker, your message, assistant marker. The model then continues from the assistant marker, and it signals that it’s finished by producing an end-of-turn token.</p>
<h3 id="sec-consequences">Why Tokens Matter</h3>
<ul>
<li><strong>Cost and limits are in tokens.</strong> Pricing, context windows, and rate limits all count tokens, not words.</li>
<li><strong>Odd blind spots.</strong> Spelling, counting letters, and arithmetic on long numbers are hard partly because the model sees chunks, not characters.</li>
<li><strong>Unequal languages.</strong> Text in languages the tokenizer saw less of can take several times more tokens for the same meaning, which makes it slower and more expensive.</li>
</ul>
<h3 id="sec-tok-hw">The Hardware View</h3>
<p>Tokenization runs on the <strong>host CPU</strong>, typically taking microseconds to a few milliseconds. The result, a few kilobytes of 32-bit integer IDs, is copied to the GPU over PCIe. Next to the model itself, this is negligible.</p>
<p>But the token count sets every downstream cost: prefill compute grows with prompt tokens, KV cache memory grows with total tokens, and decode time grows with output tokens. The vocabulary size sets the size of the embedding table and the LM head.</p>
<p class="refs">Further reading:</p><ul class="refs"><li>Sennrich, Haddow, and Birch, “Neural Machine Translation of Rare Words with Subword Units” (ACL 2016), which introduced BPE for neural models</li><li>OpenAI’s tiktoken library, used by many tokenizers including Llama 3’s</li><li>Karpathy, “Let’s build the GPT Tokenizer” (video)</li></ul>`,
  practice: {
    guided: [
      {
        q: `<p>A tokenizer learned these merges, in order: (0) e + s → es, (1) es + t → est, (2) l + o → lo, (3) lo + w → low. Encode “lowest” and “newer.” How many tokens is each?</p>`,
        a: `<ol><li>“lowest” starts as l o w e s t.</li><li>Merge 0: l o w es t. Merge 1: l o w est. Merge 2: lo w est. Merge 3: low est.</li><li>Result: <strong>low + est, 2 tokens</strong>, even though “lowest” never appeared in training.</li><li>“newer” is n e w e r. No learned pair applies, so it stays <strong>5 tokens</strong>. A real tokenizer has tens of thousands of merges, so common words become one token and rare ones split into a few pieces.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Why do LLMs often miscount the letters in a word like “strawberry”?</p>`,
        a: `<p>The model never sees letters. It sees a few token IDs, for example pieces like “str,” “aw,” and “berry,” each an opaque integer mapped to a vector. Counting letters requires knowing the spelling inside each token, which the model only learns indirectly. Asking it to spell the word out first (one letter per token) usually fixes it.</p>`
      },
      {
        q: `<p>A team proposes doubling the vocabulary of a model with d = 8,192 from 64K (65,536) to 128K (128,256) tokens. What are the trade-offs?</p>`,
        a: `<p><strong>Gains:</strong> text compresses into fewer tokens, especially code and non-English text. Fewer tokens means less prefill compute, a smaller KV cache, fewer decode steps, and more text in the same context window.</p><p><strong>Costs:</strong> the embedding table and LM head each grow from 65,536 × 8,192 ≈ 0.54B to 128,256 × 8,192 ≈ 1.05B parameters. The LM head is read every decode step, and softmax and sampling run over twice as many entries. Rare tokens see fewer training examples, so their embeddings are learned less well.</p>`
      }
    ]
  }
},

{
  id: "llm-embed",
  region: "llm",
  title: "Embeddings and the Residual Stream",
  sections: [
    { id: "lookup", label: "The Embedding Lookup" },
    { id: "position", label: "Telling the Model About Order" },
    { id: "residual", label: "The Residual Stream" },
    { id: "norm", label: "Normalization" },
    { id: "emb-hw", label: "The Hardware View" }
  ],
  body: `
<h3 id="sec-lookup">The Embedding Lookup</h3>
<p>The model has an <strong>embedding table</strong>: a matrix with one row per vocabulary entry, V × d = 128,256 × 8,192. Token ID i simply selects row i, a vector of 8,192 numbers. These numbers are learned during training, and tokens used in similar ways end up with similar vectors.</p>
<p>So a prompt of N tokens becomes a matrix of N × 8,192 numbers. From here on, the model never sees text again, only these vectors.</p>
<h3 id="sec-position">Telling the Model About Order</h3>
<p>Attention, on its own, doesn’t know token order. The original transformer added a position-dependent vector to each embedding. Most modern models, including our running example, use <strong>rotary position embeddings (RoPE)</strong> instead, applied inside every attention layer rather than once at the input.</p>
<p>RoPE splits each query and key vector into pairs of numbers and rotates each pair by an angle proportional to the token’s position, with a different speed for each pair. When you take the dot product of a query at position m and a key at position n, the rotations combine so that the result depends on the distance m − n. The model learns relative position (“three tokens back”) rather than absolute position.</p>
<h3 id="sec-residual">The Residual Stream</h3>
<p>Each token’s vector is its <strong>residual stream</strong>: a working memory of width d = 8,192 that flows through all 80 layers. Each sublayer reads a normalized copy of it and adds its result back:</p>
<p class="eq">h = x + Attention(Norm(x)) &nbsp;&nbsp; then &nbsp;&nbsp; x<sub>next</sub> = h + MLP(Norm(h))</p>
<p>An analogy from CPUs: think of the residual stream as a register file every layer reads and writes, where each write is an addition rather than an overwrite. Early layers tend to write information about local syntax; later layers write increasingly abstract information, and the last layers shape the prediction of the next token.</p>
<h3 id="sec-norm">Normalization</h3>
<p>Before each sublayer, the vector is normalized so its scale stays stable across 80 layers. Llama-style models use <strong>RMSNorm</strong>:</p>
<p class="eq">RMSNorm(x) = <span class="frac"><span>x</span><span>√( mean(x<sup>2</sup>) + ε )</span></span> ⊙ g</p>
<p>where g is a learned per-dimension gain and ε is a tiny constant that avoids dividing by zero. Putting the norm before each sublayer (“pre-norm”) rather than after makes deep models much easier to train.</p>
<h3 id="sec-emb-hw">The Hardware View</h3>
<ul>
<li><strong>The embedding lookup is a gather:</strong> read one 16 KB row from a 2.1 GB table in HBM per token. It’s cheap and memory-bound, with no meaningful math.</li>
<li><strong>Activations are small:</strong> one token’s residual vector is 16 KB. The working set that fills memory is weights (141 GB) and, at long contexts, the KV cache.</li>
<li><strong>Norms are elementwise:</strong> a few FLOPs per byte, so memory-bound. Good kernels fuse the norm into the neighboring matrix multiply so the vector doesn’t make an extra trip to HBM.</li>
</ul>
<p class="refs">Further reading:</p><ul class="refs"><li>Su et al., “RoFormer: Enhanced Transformer with Rotary Position Embedding” (2021)</li><li>Zhang and Sennrich, “Root Mean Square Layer Normalization” (NeurIPS 2019)</li><li>Elhage et al., “A Mathematical Framework for Transformer Circuits” (Anthropic, 2021), which develops the residual-stream view</li></ul>`,
  practice: {
    guided: [
      {
        q: `<p>For the running example (V = 128,256, d = 8,192, BF16, 141 GB of weights): how big is the embedding table, how many bytes does one lookup read, and how much memory do the residual-stream vectors take during prefill of a 4,000-token prompt?</p>`,
        a: `<ol><li>Table: 128,256 × 8,192 ≈ 1.05B numbers × 2 bytes ≈ <strong>2.1 GB</strong>.</li><li>One lookup reads one row: 8,192 × 2 bytes = <strong>16 KB</strong>.</li><li>Prefill activations: 4,000 × 16 KB ≈ <strong>66 MB</strong>, tiny next to 141 GB of weights. Activations stay small; weights and the KV cache are what fill memory.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Why does a transformer need explicit positional information? What would go wrong without it?</p>`,
        a: `<p>Attention compares every query with every key using dot products, which don’t depend on where tokens sit. Without positional information, the model sees a bag of tokens: “dog bites man” and “man bites dog” look nearly identical. (The causal mask leaks a little order information, since later tokens see more context, but it’s weak.) RoPE fixes this by rotating queries and keys by position-dependent angles, so the score between two tokens depends on their relative distance.</p>`
      },
      {
        q: `<p>Why do transformers add each sublayer’s output to the residual stream (x = x + f(x)) instead of replacing it (x = f(x))? Answer for an 80-layer model, where each layer has two sublayers (attention and MLP).</p>`,
        a: `<p>With 80 stacked layers, replacement would force every layer to preserve all useful information itself, and gradients would have to pass through 160 nonlinear sublayers during training, which makes deep networks hard to train. The addition gives gradients a direct path from the output back to early layers and lets each layer make a small edit. Layers can read what earlier layers wrote and add their own contribution, like a shared scratchpad.</p>`
      }
    ]
  }
},

{
  id: "llm-attention",
  region: "llm",
  title: "Attention, Step by Step",
  sections: [
    { id: "idea", label: "The Idea" },
    { id: "qkv", label: "Queries, Keys, and Values" },
    { id: "scores", label: "Scores, Mask, Softmax, Mix" },
    { id: "toy", label: "A Worked Example" },
    { id: "heads", label: "Multiple Heads" },
    { id: "gqa", label: "Sharing Keys and Values" },
    { id: "attn-cost", label: "How Much Work It Is" },
    { id: "attn-hw", label: "The Hardware View" }
  ],
  body: `
<h3 id="sec-idea">The Idea</h3>
<p>Attention is how tokens share information. Each token builds an updated version of itself by taking a weighted mix of information from earlier tokens, with weights based on relevance.</p>
<p>In “The trophy didn’t fit in the suitcase because it was too big,” the vector for “it” needs information from “trophy.” Attention lets “it” look back at all earlier tokens, score each one, and pull in mostly what “trophy” has to offer.</p>
<h3 id="sec-qkv">Queries, Keys, and Values</h3>
<p>Each token’s (normalized) residual vector x is multiplied by three learned weight matrices:</p>
<ul>
<li><strong>Query</strong> q = x W<sub>Q</sub>: what this token is looking for.</li>
<li><strong>Key</strong> k = x W<sub>K</sub>: what this token offers, used for matching.</li>
<li><strong>Value</strong> v = x W<sub>V</sub>: the information this token passes along if selected.</li>
</ul>
<p>In the running example, W<sub>Q</sub> is 8,192 × 8,192 (64 query heads × 128), while W<sub>K</sub> and W<sub>V</sub> are 8,192 × 1,024 (8 key/value heads × 128). RoPE then rotates q and k by position.</p>
<h3 id="sec-scores">Scores, Mask, Softmax, Mix</h3>
<p class="eq">Attention(Q, K, V) = softmax( QK<sup>T</sup> / √d<sub>h</sub> + M ) V</p>
<ol>
<li><strong>Score:</strong> dot each query with every key. A high score means a good match.</li>
<li><strong>Scale:</strong> divide by √d<sub>h</sub> (√128 ≈ 11.3). Dot products of long vectors grow with their length; without scaling, softmax would saturate to nearly all-or-nothing weights, which also stalls training.</li>
<li><strong>Mask:</strong> M sets scores for future tokens to −∞, so a token can only attend to itself and earlier tokens. This <strong>causal mask</strong> is what lets the model generate left to right.</li>
<li><strong>Softmax:</strong> turn each row of scores into weights that are positive and sum to 1 (subtracting the row maximum first, to avoid overflow).</li>
<li><strong>Mix:</strong> the output for each token is the weighted sum of the value vectors.</li>
</ol>
<div class="tbl"><svg viewBox="0 0 640 260" role="img" aria-label="Causal attention mask for the tokens The, cat, sat, on, the. Rows are queries and columns are keys. Each row can only see its own column and earlier ones; later columns are masked to minus infinity. The last row is highlighted as the decode step: the newest token's query against all cached keys." style="width:100%;min-width:560px;max-width:640px;display:block;font-family:var(--sans)">
<text x="200" y="22" text-anchor="middle" style="fill:var(--muted);font-size:12px">keys (tokens being looked at)</text>
<text x="14" y="22" style="fill:var(--muted);font-size:12px">queries</text>
<text x="128" y="50" text-anchor="middle" style="fill:var(--ink);font-size:12px">The</text>
<text x="164" y="50" text-anchor="middle" style="fill:var(--ink);font-size:12px">cat</text>
<text x="200" y="50" text-anchor="middle" style="fill:var(--ink);font-size:12px">sat</text>
<text x="236" y="50" text-anchor="middle" style="fill:var(--ink);font-size:12px">on</text>
<text x="272" y="50" text-anchor="middle" style="fill:var(--ink);font-size:12px">the</text>
<text x="100" y="82" text-anchor="end" style="fill:var(--ink);font-size:12px">The</text>
<rect x="110" y="60" width="36" height="36" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1"/>
<rect x="146" y="60" width="36" height="36" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/>
<text x="164" y="83" text-anchor="middle" style="fill:var(--muted);font-size:12px">−∞</text>
<rect x="182" y="60" width="36" height="36" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/>
<text x="200" y="83" text-anchor="middle" style="fill:var(--muted);font-size:12px">−∞</text>
<rect x="218" y="60" width="36" height="36" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/>
<text x="236" y="83" text-anchor="middle" style="fill:var(--muted);font-size:12px">−∞</text>
<rect x="254" y="60" width="36" height="36" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/>
<text x="272" y="83" text-anchor="middle" style="fill:var(--muted);font-size:12px">−∞</text>
<text x="100" y="118" text-anchor="end" style="fill:var(--ink);font-size:12px">cat</text>
<rect x="110" y="96" width="36" height="36" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1"/>
<rect x="146" y="96" width="36" height="36" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1"/>
<rect x="182" y="96" width="36" height="36" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/>
<text x="200" y="119" text-anchor="middle" style="fill:var(--muted);font-size:12px">−∞</text>
<rect x="218" y="96" width="36" height="36" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/>
<text x="236" y="119" text-anchor="middle" style="fill:var(--muted);font-size:12px">−∞</text>
<rect x="254" y="96" width="36" height="36" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/>
<text x="272" y="119" text-anchor="middle" style="fill:var(--muted);font-size:12px">−∞</text>
<text x="100" y="154" text-anchor="end" style="fill:var(--ink);font-size:12px">sat</text>
<rect x="110" y="132" width="36" height="36" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1"/>
<rect x="146" y="132" width="36" height="36" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1"/>
<rect x="182" y="132" width="36" height="36" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1"/>
<rect x="218" y="132" width="36" height="36" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/>
<text x="236" y="155" text-anchor="middle" style="fill:var(--muted);font-size:12px">−∞</text>
<rect x="254" y="132" width="36" height="36" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/>
<text x="272" y="155" text-anchor="middle" style="fill:var(--muted);font-size:12px">−∞</text>
<text x="100" y="190" text-anchor="end" style="fill:var(--ink);font-size:12px">on</text>
<rect x="110" y="168" width="36" height="36" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1"/>
<rect x="146" y="168" width="36" height="36" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1"/>
<rect x="182" y="168" width="36" height="36" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1"/>
<rect x="218" y="168" width="36" height="36" style="fill:var(--trace-soft);stroke:var(--trace);stroke-width:1"/>
<rect x="254" y="168" width="36" height="36" style="fill:var(--surface);stroke:var(--rule);stroke-width:1"/>
<text x="272" y="191" text-anchor="middle" style="fill:var(--muted);font-size:12px">−∞</text>
<text x="100" y="226" text-anchor="end" style="fill:var(--ink);font-size:12px">the</text>
<rect x="110" y="204" width="36" height="36" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.2"/>
<rect x="146" y="204" width="36" height="36" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.2"/>
<rect x="182" y="204" width="36" height="36" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.2"/>
<rect x="218" y="204" width="36" height="36" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.2"/>
<rect x="254" y="204" width="36" height="36" style="fill:var(--pad-soft);stroke:var(--pad);stroke-width:1.2"/>
<text x="330" y="86" style="fill:var(--ink);font-size:13px">Each row is one token’s query.</text>
<text x="330" y="112" style="fill:var(--ink);font-size:13px">Shaded cells: earlier tokens it may attend to.</text>
<text x="330" y="138" style="fill:var(--ink);font-size:13px">−∞: future tokens, masked out before softmax.</text>
<text x="330" y="164" style="fill:var(--ink);font-size:13px">Prefill computes every row at once.</text>
<text x="330" y="190" style="fill:var(--ink);font-size:13px">Decode adds one new row per step (gold):</text>
<text x="330" y="216" style="fill:var(--ink);font-size:13px">the new query against every cached key.</text>
</svg></div>
<h3 id="sec-toy">A Worked Example</h3>
<p>Three tokens, “The cat sat,” with tiny 2-dimensional vectors. We compute the output for “sat.”</p>
<ul>
<li>Query for “sat”: q = [1, 0].</li>
<li>Keys: “The” [0, 1], “cat” [1, 1], “sat” [1, 0].</li>
<li>Values: “The” [1, 0], “cat” [0, 2], “sat” [2, 2].</li>
</ul>
<ol>
<li>Dot products: 0, 1, 1.</li>
<li>Scale by 1/√2 ≈ 0.707: 0, 0.707, 0.707.</li>
<li>Softmax: e<sup>0</sup> = 1, e<sup>0.707</sup> ≈ 2.028, 2.028. Sum ≈ 5.056. Weights ≈ 0.198, 0.401, 0.401.</li>
<li>Mix: 0.198 × [1, 0] + 0.401 × [0, 2] + 0.401 × [2, 2] ≈ <strong>[1.00, 1.60]</strong>.</li>
</ol>
<p>“sat” mostly drew on “cat” and itself. In a real model, the 128-dimensional learned vectors encode far richer matches, such as “find the subject of this verb.”</p>
<h3 id="sec-heads">Multiple Heads</h3>
<p>Instead of one big attention, the model runs 64 smaller ones in parallel, called <strong>heads</strong>, each with its own 128-dimensional slice of Q, K, and V. Different heads learn different relationships: one may track the previous token, another the subject of a sentence, another a matching bracket. The 64 outputs (64 × 128 = 8,192 numbers) are concatenated and multiplied by the output matrix W<sub>O</sub> (8,192 × 8,192), and the result is added to the residual stream.</p>
<h3 id="sec-gqa">Sharing Keys and Values</h3>
<p>Every head’s keys and values must be stored in the <a href="#/llm-kvcache">KV cache</a>, so fewer KV heads means less memory. Variants:</p>
<ul>
<li><strong>Multi-head attention (MHA):</strong> one KV head per query head (64 here). Largest cache.</li>
<li><strong>Grouped-query attention (GQA):</strong> query heads share KV heads in groups. Our example uses 8 KV heads, each serving 8 query heads: an 8× smaller cache with little quality loss.</li>
<li><strong>Multi-query attention (MQA):</strong> a single KV head for all queries. Smallest cache, more quality risk.</li>
<li><strong>Multi-head latent attention (MLA):</strong> used by DeepSeek models, compresses keys and values into a smaller latent vector that’s expanded when needed.</li>
</ul>
<h3 id="sec-attn-cost">How Much Work It Is</h3>
<p>Two parts: the projections (W<sub>Q</sub>, W<sub>K</sub>, W<sub>V</sub>, W<sub>O</sub>), which cost about 2 FLOPs per weight per token like any matrix multiply, and the score-and-mix step, which depends on context length N. For one new token at context N, the score-and-mix step costs about 4 × N × d FLOPs per layer (2Nd for scores, 2Nd for the weighted sum, with d = 8,192 the total query width).</p>
<p>Across 80 layers that’s about 2.6 million × N FLOPs per token, compared with about 141 billion FLOPs for all the matrix multiplies. The two are equal at N ≈ 54,000 tokens: below that, attention’s math is a minor cost; above it, attention dominates. For prefill of N tokens with the causal mask, score-and-mix costs about 2 × N<sup>2</sup> × d per layer, quadratic in prompt length.</p>
<h3 id="sec-attn-hw">The Hardware View</h3>
<ul>
<li><strong>Prefill:</strong> QK<sup>T</sup> is a large matrix multiply (N queries × N keys), so it’s compute-bound and runs on Tensor Cores. The danger is memory: naively, the N × N score matrix is enormous. FlashAttention tiles the computation through on-chip shared memory so it never lands in HBM (see <a href="#/gen-gpus">GPUs for generative AI</a>).</li>
<li><strong>Decode:</strong> one new query per sequence against N cached keys is a matrix-vector product. Each layer must read its entire K and V cache, at about 8 FLOPs per byte with our GQA setup, so it’s firmly memory-bound. Batching doesn’t help, because every sequence has its own cache.</li>
<li><strong>Softmax</strong> needs exponentials, which run on special function units rather than Tensor Cores, and a reduction across each row. Fused kernels hide this inside the attention kernel.</li>
</ul>
<p class="refs">Further reading:</p><ul class="refs"><li>Vaswani et al., “Attention Is All You Need” (NeurIPS 2017)</li><li>Shazeer, “Fast Transformer Decoding: One Write-Head Is All You Need” (2019), which introduced MQA</li><li>Ainslie et al., “GQA: Training Generalized Multi-Query Transformer Models from Multi-Head Checkpoints” (EMNLP 2023)</li><li>Dao et al., “FlashAttention” (NeurIPS 2022)</li><li>DeepSeek-AI, “DeepSeek-V2” (2024), for MLA</li></ul>`,
  practice: {
    guided: [
      {
        q: `<p>Four tokens, numbered 0 to 3. For token 2, the scaled scores against tokens 0–3 are [2, 0, 1, 5]. The value vectors are v<sub>0</sub> = [1, 0], v<sub>1</sub> = [0, 1], v<sub>2</sub> = [1, 1], v<sub>3</sub> = [3, 3]. Apply the causal mask, softmax, and compute the output.</p>`,
        a: `<ol><li>Mask: token 2 can’t see token 3, so its score becomes −∞: [2, 0, 1, −∞].</li><li>Exponentiate: e<sup>2</sup> = 7.389, e<sup>0</sup> = 1, e<sup>1</sup> = 2.718, e<sup>−∞</sup> = 0. Sum = 11.107.</li><li>Weights: [0.665, 0.090, 0.245, 0].</li><li>Output = 0.665 × [1, 0] + 0.090 × [0, 1] + 0.245 × [1, 1] = <strong>[0.910, 0.335]</strong>.</li><li>The large score for token 3 had no effect, which is exactly what the mask is for: no peeking at the future.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Show why decode attention is memory-bound, and how grouped-query attention changes that. Use the running example: head dimension 128, BF16 keys and values, and 8 query heads sharing each KV head. The GPU's ridge point is about 300 FLOPs per byte.</p>`,
        a: `<p>Take one KV head and the 8 query heads that share it, at context length N. Reading its keys and values moves N × 128 × 2 × 2 bytes = 512N bytes. The work: each of 8 query heads does a dot product with N keys (2 × 128 FLOPs each) and a weighted sum of N values (another 2 × 128), so 8 × 4 × 128 × N = 4,096N FLOPs.</p><p>Intensity = 4,096N / 512N = <strong>8 FLOPs per byte</strong>, far below the ridge point of about 300, so it’s memory-bound. With standard multi-head attention (one KV head per query head), intensity drops to 1 FLOP per byte. With grouped-query attention, the group size directly multiplies intensity, while also shrinking the KV cache by the same factor.</p>`
      },
      {
        q: `<p>A naive attention kernel runs prefill on a 32K-token prompt. The layer has 64 attention heads and stores scores in BF16. How much memory does it need for the score matrices of one layer, and how does FlashAttention avoid this?</p>`,
        a: `<p>Each head’s score matrix is 32,768 × 32,768 ≈ 1.07 billion entries × 2 bytes ≈ 2.1 GB. With 64 heads, that’s about <strong>137 GB for one layer</strong>, more than a GPU holds, and writing it to HBM and reading it back would dominate the runtime.</p><p>FlashAttention processes Q, K, and V in tiles that fit in on-chip shared memory and computes softmax incrementally, keeping a running maximum and running sum per row and rescaling partial results as new tiles arrive. The full score matrix never exists in HBM. Same math, a fraction of the memory traffic. It’s cache blocking applied to attention.</p>`
      }
    ]
  }
},

{
  id: "llm-block",
  region: "llm",
  title: "The Rest of the Block: MLP, Norms, and Residuals",
  sections: [
    { id: "layout", label: "One Block" },
    { id: "mlp", label: "The MLP" },
    { id: "params", label: "Where the Parameters Are" },
    { id: "moe", label: "Mixture of Experts" },
    { id: "block-hw", label: "The Hardware View" }
  ],
  body: `
<h3 id="sec-layout">One Block</h3>
<p>A transformer block is attention followed by an MLP, each wrapped in a norm and a residual addition:</p>
<p class="eq">h = x + Attention(RMSNorm(x)) &nbsp;&nbsp;&nbsp; out = h + MLP(RMSNorm(h))</p>
<p>The running example stacks 80 identical blocks, each with its own weights. A useful division of labor: <strong>attention moves information between tokens</strong>; the <strong>MLP transforms each token’s vector on its own</strong>, with no communication between positions.</p>
<h3 id="sec-mlp">The MLP</h3>
<p>Llama-style models use a gated MLP called <strong>SwiGLU</strong>:</p>
<p class="eq">MLP(x) = W<sub>down</sub> ( SiLU(x W<sub>gate</sub>) ⊙ (x W<sub>up</sub>) )</p>
<ol>
<li>Expand: x (8,192 numbers) is multiplied by two matrices, W<sub>gate</sub> and W<sub>up</sub>, each 8,192 × 28,672, giving two vectors of 28,672.</li>
<li>Gate: apply SiLU(z) = z × σ(z) to one vector and multiply it element by element with the other. The gate decides how much of each of the 28,672 features passes through.</li>
<li>Project back: multiply by W<sub>down</sub> (28,672 × 8,192) to get back to width 8,192, and add the result to the residual stream.</li>
</ol>
<p>Interpretability research suggests MLP layers store much of a model’s factual knowledge: individual features respond to specific concepts and write related information into the residual stream.</p>
<h3 id="sec-params">Where the Parameters Are</h3>
<div class="tbl"><table>
<tr><th>Part (per layer)</th><th>Shape</th><th>Parameters</th></tr>
<tr><td>W<sub>Q</sub>, W<sub>O</sub></td><td>8,192 × 8,192 each</td><td>134.2M</td></tr>
<tr><td>W<sub>K</sub>, W<sub>V</sub></td><td>8,192 × 1,024 each</td><td>16.8M</td></tr>
<tr><td>W<sub>gate</sub>, W<sub>up</sub>, W<sub>down</sub></td><td>8,192 × 28,672 each</td><td>704.6M</td></tr>
<tr><td><strong>Layer total</strong></td><td></td><td><strong>855.6M</strong></td></tr>
</table></div>
<p>About 82% of each layer is MLP. Since every weight is used for one multiply-add per token, the model costs about <strong>2 × 70.6B ≈ 141 GFLOPs per token</strong> for its matrix multiplies, plus attention’s score-and-mix work at long context.</p>
<h3 id="sec-moe">Mixture of Experts</h3>
<p>A <strong>mixture-of-experts (MoE)</strong> model replaces each MLP with many smaller MLPs (experts) and a small router that picks a few experts per token, for example the top 2 of 8, or 8 of 256 in recent large models. Total parameters can be huge while the parameters used per token stay small. The trade-off is memory: all experts must be stored, and at serving scale they’re spread across many GPUs.</p>
<h3 id="sec-block-hw">The Hardware View</h3>
<ul>
<li><strong>Decode is weight streaming.</strong> At batch B, each matrix is read from HBM once per step and used B times, so arithmetic intensity is about B FLOPs per byte. Below a batch of about 300, the step time is simply how long it takes to read the weights.</li>
<li><strong>Prefill is compute-bound.</strong> With thousands of prompt tokens, the matrices are reused thousands of times per read, and Tensor Cores become the limit.</li>
<li><strong>Elementwise work is fused.</strong> SiLU, the gating multiply, residual adds, and norms are a few FLOPs per byte; kernels fold them into the surrounding matrix multiplies so intermediate vectors don’t round-trip through HBM.</li>
<li><strong>Tensor parallelism splits each matrix across GPUs.</strong> W<sub>gate</sub> and W<sub>up</sub> are split by columns and W<sub>down</sub> by rows, so each GPU computes a partial result and one all-reduce per MLP combines them.</li>
</ul>
<p class="refs">Further reading:</p><ul class="refs"><li>Shazeer, “GLU Variants Improve Transformer” (2020)</li><li>Shazeer et al., “Outrageously Large Neural Networks: The Sparsely-Gated Mixture-of-Experts Layer” (ICLR 2017)</li><li>Fedus, Zoph, and Shazeer, “Switch Transformers” (JMLR 2022)</li><li>Geva et al., “Transformer Feed-Forward Layers Are Key-Value Memories” (EMNLP 2021)</li><li>Shoeybi et al., “Megatron-LM” (2019), for how tensor parallelism splits these matrices</li></ul>`,
  practice: {
    guided: [
      {
        q: `<p>In decode at batch size B, one MLP matrix multiply is [B × 8,192] × [8,192 × 28,672] in BF16. What is its arithmetic intensity, and at what batch size does it become compute-bound on a GPU with a ridge point of about 300 FLOPs per byte?</p>`,
        a: `<ol><li>FLOPs: 2 × B × 8,192 × 28,672.</li><li>Bytes: dominated by the weight matrix, read once per step: 8,192 × 28,672 × 2 bytes. (The B input and output rows are tiny by comparison.)</li><li>Intensity ≈ 2B / 2 = <strong>B FLOPs per byte</strong>: each weight is used once per sequence in the batch.</li><li>Compute-bound once B exceeds about <strong>300</strong>. Below that, the step time is set by reading weights, and extra sequences in the batch are almost free.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A mixture-of-experts layer has 8 experts and routes each token to 2. Compare the weight bytes read per decode step at batch 1 and batch 256, and the compute per token.</p>`,
        a: `<p><strong>Batch 1:</strong> the token uses 2 experts, so only 2 of 8 experts’ weights are read: a quarter of the layer’s expert weights.</p><p><strong>Batch 256:</strong> if routing is roughly uniform, the chance a given expert is unused by all 256 tokens is (6/8)<sup>256</sup>, effectively zero. Every expert is read every step, so the bytes are the full layer, but they’re shared across 256 tokens.</p><p><strong>Compute per token</strong> is the same in both cases: 2 experts’ worth. MoE gives the quality of a large model at the compute cost of a small one, but you still need memory for all experts, and at large scale experts are spread across GPUs (expert parallelism), which adds all-to-all communication to send tokens to their experts and back.</p>`
      }
    ]
  }
},

{
  id: "llm-output",
  region: "llm",
  title: "From Vector to Next Token",
  sections: [
    { id: "head", label: "The LM Head" },
    { id: "temp", label: "Softmax and Temperature" },
    { id: "strategies", label: "Choosing a Token" },
    { id: "stop", label: "Stopping and Streaming" },
    { id: "out-hw", label: "The Hardware View" }
  ],
  body: `
<h3 id="sec-head">The LM Head</h3>
<p>After the last of the 80 blocks, the final residual vector goes through one more RMSNorm and then the <strong>LM head</strong> (language-model head): a matrix of 8,192 × 128,256. The result is a vector of 128,256 <strong>logits</strong>, one raw score for every token in the vocabulary.</p>
<p>Only the last position’s logits matter for generating the next token, so during prefill, efficient implementations run the LM head on the final position only.</p>
<h3 id="sec-temp">Softmax and Temperature</h3>
<p>Softmax turns logits into probabilities. A <strong>temperature</strong> T divides the logits first:</p>
<p class="eq">p<sub>i</sub> = <span class="frac"><span>e<sup>z<sub>i</sub> / T</sup></span><span>Σ<sub>j</sub> e<sup>z<sub>j</sub> / T</sup></span></span></p>
<p>T &lt; 1 sharpens the distribution toward the top choices (more predictable). T &gt; 1 flattens it (more varied, more mistakes). As T approaches 0, sampling becomes greedy.</p>
<h3 id="sec-strategies">Choosing a Token</h3>
<ul>
<li><strong>Greedy:</strong> always take the most likely token. Deterministic in principle, but tends to repeat itself on open-ended text.</li>
<li><strong>Top-k:</strong> keep only the k most likely tokens, renormalize, and sample.</li>
<li><strong>Top-p (nucleus):</strong> keep the smallest set of tokens whose probabilities add up to p (say 0.9). The set grows when the model is unsure and shrinks when it’s confident.</li>
<li><strong>Min-p:</strong> keep tokens whose probability is at least some fraction of the top token’s.</li>
<li><strong>Penalties and constraints:</strong> repetition penalties lower the logits of recently used tokens; constrained decoding masks out any token that would break a required format, such as valid JSON.</li>
</ul>
<p>The final draw takes a random number u between 0 and 1 and walks the cumulative distribution until it passes u (see <a href="#/gen-stochastic/llm-sampling">LLMs: token sampling</a>).</p>
<h3 id="sec-stop">Stopping and Streaming</h3>
<p>The chosen token ID is appended to the sequence and becomes the input to the next step: the model is <strong>autoregressive</strong>. Generation stops when the model produces an end-of-turn token, a stop string appears, or a maximum length is reached.</p>
<p>Each new ID is detokenized back into text and streamed to the user as it’s generated. One wrinkle: a token can end partway through a multi-byte UTF-8 character (common with emoji and non-Latin scripts), so the detokenizer buffers bytes until a full character is ready.</p>
<h3 id="sec-out-hw">The Hardware View</h3>
<ul>
<li><strong>The LM head is one big matrix multiply:</strong> 1.05B weights, 2.1 GB read every decode step, about 1.5% of all weights. Its output is 128,256 logits per sequence.</li>
<li><strong>Sampling runs on the GPU:</strong> softmax, then top-k or top-p, which needs a partial sort over 128,256 values per sequence. It’s fast, tens of microseconds, but it’s serial work at the end of every step.</li>
<li><strong>Then a tiny copy:</strong> the chosen 4-byte token ID goes back to the CPU for detokenizing and streaming. That synchronization point every step is overhead; serving systems overlap the CPU work for step t with the GPU work for step t + 1 where they can.</li>
</ul>
<p class="refs">Further reading:</p><ul class="refs"><li>Holtzman et al., “The Curious Case of Neural Text Degeneration” (ICLR 2020), which introduced nucleus sampling</li><li>Nguyen et al., “Turning Up the Heat: Min-p Sampling for Creative and Coherent LLM Outputs” (2024)</li><li>Thinking Machines Lab, “Defeating Nondeterminism in LLM Inference” (2025), on why temperature 0 isn’t deterministic in practice</li></ul>`,
  practice: {
    guided: [
      {
        q: `<p>Three candidate tokens have logits [2, 1, 0]. Compute the probabilities at temperature 0.5, then apply top-p = 0.9 and renormalize.</p>`,
        a: `<ol><li>Divide by T: [4, 2, 0].</li><li>Exponentiate: e<sup>4</sup> = 54.598, e<sup>2</sup> = 7.389, e<sup>0</sup> = 1. Sum = 62.987.</li><li>Probabilities: <strong>0.867, 0.117, 0.016</strong>. (At T = 1 they were 0.665, 0.245, 0.090; lower temperature sharpened the distribution.)</li><li>Top-p: sort descending and keep tokens until the cumulative probability reaches 0.9. 0.867 &lt; 0.9, so add the next: 0.984 ≥ 0.9. Keep two.</li><li>Renormalize: 0.867 / 0.984 ≈ <strong>0.881</strong> and 0.117 / 0.984 ≈ <strong>0.119</strong>. The third token can no longer be chosen.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>A user sets temperature to 0 but gets different outputs on different runs of the same prompt. How can that happen on a GPU?</p>`,
        a: `<p>Temperature 0 means greedy: always pick the highest logit. But the logits themselves can differ slightly between runs. Floating-point addition isn’t associative, so summing the same numbers in a different order gives slightly different results. On a serving system, the order depends on batch size and composition (other users’ requests), which change kernel choices, tiling, and reduction order, including the all-reduces across GPUs. When the top two logits are nearly tied, a tiny difference flips the argmax, and from then on the outputs diverge completely because every later token depends on earlier ones. Mixture-of-experts routing can amplify this. Making it fully deterministic requires batch-invariant kernels, which cost some performance.</p>`
      }
    ]
  }
},

{
  id: "llm-kvcache",
  region: "llm",
  title: "The KV Cache",
  sections: [
    { id: "why-cache", label: "Why It Exists" },
    { id: "stored", label: "What It Stores" },
    { id: "size", label: "How Big It Gets" },
    { id: "manage", label: "Managing It" },
    { id: "shrink", label: "Making It Smaller" },
    { id: "kv-hw", label: "The Hardware View" }
  ],
  body: `
<h3 id="sec-why-cache">Why It Exists</h3>
<p>To generate token t, attention in every layer needs the keys and values of all earlier tokens. Without a cache, the model would recompute them by rerunning the whole sequence every step: quadratic work for every token generated.</p>
<p>The key observation: because of the causal mask, earlier tokens never see later ones, so <strong>their keys and values never change</strong>. Compute them once, store them, and each new step only computes the new token’s key and value and appends them. This trades a lot of compute for a lot of memory.</p>
<h3 id="sec-stored">What It Stores</h3>
<p>For every layer, every KV head, and every token so far: one key vector and one value vector of 128 numbers each. Not the queries: a query is only used once, by its own token at its own step, and never needed again.</p>
<h3 id="sec-size">How Big It Gets</h3>
<p class="eq">KV bytes per token = 2 (K and V) × L × n<sub>kv</sub> × d<sub>h</sub> × bytes per number = 2 × 80 × 8 × 128 × 2 ≈ 0.33 MB</p>
<div class="tbl"><table>
<tr><th>Context length</th><th>KV cache for one sequence</th></tr>
<tr><td>4K tokens</td><td>1.3 GB</td></tr>
<tr><td>32K tokens</td><td>10.7 GB</td></tr>
<tr><td>128K tokens</td><td>43 GB</td></tr>
<tr><td>1M tokens</td><td>344 GB</td></tr>
</table></div>
<p>Compare with the weights. Each decode step reads the weights once for the whole batch, but each sequence’s cache separately:</p>
<p class="eq">Bytes per step ≈ 141 GB + B × N × 0.33 MB</p>
<p>The KV term overtakes the weights once B × N passes about 430,000 tokens, for example 32 users at 13K tokens each. In long-context serving, the KV cache, not the model, becomes the dominant memory and bandwidth cost.</p>
<h3 id="sec-manage">Managing It</h3>
<ul>
<li><strong>Paged allocation (PagedAttention):</strong> store the cache in fixed-size blocks with a per-request block table, like virtual memory pages, so there’s no need to reserve memory for each request’s maximum length.</li>
<li><strong>Prefix caching:</strong> requests that start with the same tokens (a shared system prompt, or the earlier turns of a chat) reuse the same cached blocks and skip that part of prefill.</li>
<li><strong>Offloading:</strong> idle conversations’ caches can be moved to CPU memory or SSD and brought back when the user replies, trading transfer time for recomputing.</li>
</ul>
<h3 id="sec-shrink">Making It Smaller</h3>
<ul>
<li><strong>Fewer KV heads:</strong> GQA and MQA (see <a href="#/llm-attention/gqa">Sharing keys and values</a>).</li>
<li><strong>Compression:</strong> MLA stores a compressed latent instead of full keys and values.</li>
<li><strong>Lower precision:</strong> storing the cache in FP8 halves it compared with BF16.</li>
<li><strong>Shorter attention spans:</strong> some layers use sliding-window attention, keeping only the most recent few thousand tokens.</li>
</ul>
<h3 id="sec-kv-hw">The Hardware View</h3>
<ul>
<li><strong>Capacity:</strong> on the 8-GPU server, about 500 GB remains after the weights, enough for roughly 1.5 million tokens of cache across all users combined.</li>
<li><strong>Bandwidth:</strong> every decode step streams every active sequence’s whole cache from HBM, with no reuse within the step. It behaves like the STREAM benchmark: caches don’t help, because the working set is gigabytes and the on-chip L2 is about 50 MB.</li>
<li><strong>Why it’s a hardware target:</strong> work that reads huge data with only a few FLOPs per byte is the ideal case for designs that compute near or inside memory instead of moving the data to the processor.</li>
</ul>
<p class="refs">Further reading:</p><ul class="refs"><li>Kwon et al., “Efficient Memory Management for Large Language Model Serving with PagedAttention” (SOSP 2023), the vLLM paper</li><li>Pope et al., “Efficiently Scaling Transformer Inference” (MLSys 2023)</li><li>Zheng et al., “SGLang: Efficient Execution of Structured Language Model Programs” (2024), for RadixAttention prefix caching</li></ul>`,
  practice: {
    guided: [
      {
        q: `<p>For the running example (80 layers, 8 KV heads of dimension 128, BF16, 141 GB of weights, served on an 8-GPU server with 80 GB per GPU), how much KV cache do 32 users need at 8K (8,192) tokens of context each? How much would it be with standard multi-head attention (64 KV heads instead of 8)?</p>`,
        a: `<ol><li>Per token: 2 × 80 × 8 × 128 × 2 bytes = 327,680 bytes ≈ 0.33 MB.</li><li>Per user: 8,192 × 327,680 ≈ 2.68 GB.</li><li>32 users: ≈ <strong>86 GB</strong>, more than one GPU’s entire memory, on top of 141 GB of weights.</li><li>With 64 KV heads, 8× more: ≈ <strong>687 GB</strong>, more than the whole 8-GPU server. That’s why nearly every modern model uses GQA or something stronger.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>About how many concurrent 32K-token conversations can the 8-GPU server (640 GB of HBM, 3.35 TB/s per GPU) hold for the running example (141 GB of weights, 0.33 MB of KV cache per token)? Reserve about 50 GB for activations and kernel workspace. What limits it besides capacity?</p>`,
        a: `<p>Free memory ≈ 640 − 141 = 499 GB, minus 50 GB of workspace: about 450 GB. Each 32K conversation needs 32,768 × 0.33 MB ≈ 10.7 GB. So roughly 450 / 10.7 ≈ <strong>42 conversations</strong>.</p><p>Bandwidth limits it too: every decode step reads every active sequence’s whole cache. At 42 × 10.7 GB ≈ 450 GB per step plus 141 GB of weights, a step reads about 590 GB; at 8 × 3.35 = 26.8 TB/s that’s at least 22 ms, or under 46 tokens/s per user. To meet a latency target, you may have to admit fewer users than fit in memory.</p>`
      },
      {
        q: `<p>PagedAttention borrows an idea from operating systems. Which one, and what problem does it solve?</p>`,
        a: `<p>Virtual memory paging. Early servers reserved a contiguous KV region for each request’s maximum possible length, wasting most of it (internal fragmentation) and fragmenting the free space between requests. PagedAttention stores the cache in small fixed-size blocks (for example 16 tokens each) and keeps a per-request block table mapping logical token positions to physical blocks, like a page table. Memory is allocated on demand, waste is limited to the last partial block, and blocks can be shared copy-on-write between requests with a common prefix. The attention kernel follows the block table, an extra indirection that costs little.</p>`
      }
    ]
  }
},

{
  id: "llm-phases",
  region: "llm",
  title: "Prefill and Decode",
  sections: [{ id: "prefill", label: "Prefill" }, { id: "decode", label: "Decode" }, { id: "metrics", label: "Latency Metrics" }, { id: "serving", label: "Serving Many Users" }],
  body: `
<p>Every request runs in two phases with opposite hardware behavior. This is the single most important idea for reasoning about LLM inference performance.</p>
<h3 id="sec-prefill">Prefill</h3>
<p>All prompt tokens go through the model <strong>at the same time</strong>: an N-token prompt turns every weight multiply into a matrix-matrix multiply with N rows. Each weight is read once and used N times, so prefill is <strong>compute-bound</strong> for prompts beyond a few hundred tokens. It also writes every layer’s keys and values into the KV cache, and it ends by producing the first output token.</p>
<p class="eq">Prefill time ≈ <span class="frac"><span>2 × P × N (+ attention at long N)</span><span>achieved FLOP/s</span></span></p>
<h3 id="sec-decode">Decode</h3>
<p>After that, tokens come out <strong>one at a time</strong>. Token t + 1 can’t start until token t is chosen, a loop-carried dependency like the ones that limit instruction-level parallelism. Each step processes one token per sequence, so each weight is used only B times (the batch size), and the whole KV cache of every sequence is read. Decode is <strong>memory-bandwidth-bound</strong>:</p>
<p class="eq">Decode step time ≈ <span class="frac"><span>weight bytes + KV bytes for the batch</span><span>memory bandwidth</span></span></p>
<p>CPU analogy: prefill behaves like a dense GEMM, keeping the vector units busy; decode behaves like a STREAM loop with a dependency between iterations.</p>
<h3 id="sec-metrics">Latency Metrics</h3>
<ul>
<li><strong>Time to first token (TTFT):</strong> queueing + prefill. Grows with prompt length.</li>
<li><strong>Time per output token (TPOT), or inter-token latency:</strong> one decode step. Sets how fast text streams.</li>
<li><strong>End-to-end latency</strong> = TTFT + (output tokens − 1) × TPOT.</li>
<li><strong>Throughput:</strong> total tokens per second across all users. <strong>Goodput</strong> counts only requests that met their latency targets.</li>
</ul>
<p>The central trade-off: bigger batches raise throughput (weights are shared across more sequences) but slow each step, raising TPOT for everyone.</p>
<h3 id="sec-serving">Serving Many Users</h3>
<ul>
<li><strong>Continuous batching:</strong> instead of waiting for a whole batch to finish, the scheduler adds and removes requests at every decode step, so finished sequences don’t leave empty slots.</li>
<li><strong>Chunked prefill:</strong> long prompts are split into chunks that run alongside ongoing decode steps, so one big prompt doesn’t freeze everyone else’s stream.</li>
<li><strong>Disaggregated serving:</strong> prefill and decode run on separate GPU pools, with KV caches transferred between them.</li>
</ul>
<p class="refs">Further reading:</p><ul class="refs"><li>Yu et al., “Orca: A Distributed Serving System for Transformer-Based Generative Models” (OSDI 2022), which introduced continuous batching</li><li>Agrawal et al., “Taming Throughput-Latency Tradeoff in LLM Inference with Sarathi-Serve” (OSDI 2024), for chunked prefill</li><li>Zhong et al., “DistServe” (OSDI 2024) and Patel et al., “Splitwise” (ISCA 2024), for disaggregated prefill and decode</li></ul>`,
  practice: {
    guided: [
      {
        q: `<p>The running example has 70.6B parameters (141 GB in BF16) and runs on an 8-GPU server where each GPU has 990 TFLOP/s of dense BF16 compute and 3.35 TB/s of HBM bandwidth. Estimate (a) the prefill time for a 4,000-token prompt at 50% of peak compute, (b) the decode step time at batch size 1 with a short context, and (c) the total time for a 500-token answer.</p>`,
        a: `<ol><li>Prefill FLOPs ≈ 2 × 70.6B × 4,000 ≈ 5.6 × 10<sup>14</sup>. Achieved compute: 8 × 990 TFLOP/s × 0.5 ≈ 4.0 × 10<sup>15</sup> FLOP/s. Time ≈ <strong>0.14 s</strong>. (Attention adds little at 4K tokens.)</li><li>Decode: read 141 GB of weights at 8 × 3.35 = 26.8 TB/s ≈ <strong>5.3 ms</strong> per token, so at most about 190 tokens/s.</li><li>Answer: 0.14 s + 500 × 5.3 ms ≈ <strong>2.8 s</strong>. Decode dominates, even though prefill processed 8× more tokens. Real systems land below these bounds because of communication and overheads.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Why would you run prefill and decode on different groups of GPUs?</p>`,
        a: `<p>They have opposite bottlenecks. Prefill is compute-bound and bursty; decode is memory-bandwidth-bound and steady. When they share GPUs, a long prefill stalls every running decode for its duration, causing visible pauses in other users’ streams, and the hardware can’t be tuned for either. Separating them lets each pool use its own batch sizes, parallelism, and even GPU types, and lets you scale each to meet its own latency target (time to first token for prefill, time per output token for decode). The cost: each request’s KV cache must be transferred from the prefill pool to the decode pool over the network, which needs fast interconnects. Chunked prefill is the lighter-weight alternative on shared GPUs.</p>`
      }
    ]
  }
},

{
  id: "llm-hardware",
  region: "llm",
  title: "One Token Through the Hardware",
  book: `Textbook: Hennessy &amp; Patterson, <em>Computer Architecture: A Quantitative Approach</em> (6th ed.), Chapter 7, Domain-Specific Architectures (the deep neural network example and Google’s TPU); Chapter 4 for the roofline model.`,
  sections: [
    { id: "where", label: "Where Everything Lives" },
    { id: "layer", label: "One Layer, Kernel by Kernel" },
    { id: "multi", label: "Across 8 GPUs" },
    { id: "overheads", label: "Overheads" },
    { id: "energy", label: "Where the Energy Goes" },
    { id: "future", label: "What New Hardware Targets" }
  ],
  body: `
<p>This page follows a single decode step for one user through the running example on the 8-GPU server, from host CPU to Tensor Cores and back.</p>
<h3 id="sec-where">Where Everything Lives</h3>
<div class="tbl"><table>
<tr><th>Place</th><th>Size and speed</th><th>What lives there</th></tr>
<tr><td>Host CPU and DRAM</td><td>Hundreds of GB; connected to GPUs over PCIe</td><td>Tokenizer, request scheduler, detokenizer, network streaming; offloaded KV caches</td></tr>
<tr><td>GPU HBM</td><td>80 GB per GPU at 3.35 TB/s</td><td>Weights (17.6 GB per GPU with 8-way splitting), KV cache, activations</td></tr>
<tr><td>GPU L2 cache</td><td>About 50 MB</td><td>Staging for data in flight; far too small to hold weights or caches</td></tr>
<tr><td>Shared memory and registers</td><td>Up to 228 KB of shared memory and 256 KB of registers per SM, 132 SMs</td><td>Tiles of weights and activations while a kernel works on them</td></tr>
<tr><td>Tensor Cores</td><td>About 990 TFLOP/s of dense BF16 per GPU</td><td>The multiply-accumulate math</td></tr>
</table></div>
<h3 id="sec-layer">One Layer, Kernel by Kernel</h3>
<p>Each of the 80 layers runs roughly this sequence of GPU kernels on every GPU, each GPU holding one-eighth of every weight matrix:</p>
<ol>
<li><strong>RMSNorm</strong> on the 8,192-number residual vector.</li>
<li><strong>QKV projection:</strong> this GPU’s slice of W<sub>Q</sub>, W<sub>K</sub>, W<sub>V</sub>, giving 8 query heads and 1 KV head. Matrix-vector, memory-bound.</li>
<li><strong>RoPE</strong>, then <strong>append</strong> the new key and value to this GPU’s KV cache.</li>
<li><strong>Attention:</strong> the 8 query heads against all cached keys and values of their KV head. Reads that head’s cache.</li>
<li><strong>Output projection</strong> with this GPU’s slice of W<sub>O</sub>, giving a partial sum.</li>
<li><strong>All-reduce</strong> across the 8 GPUs to add the partial sums, then the residual add.</li>
<li><strong>RMSNorm</strong>, then the <strong>gate and up projections</strong> (this GPU’s columns), <strong>SiLU and multiply</strong>, and the <strong>down projection</strong> (this GPU’s rows).</li>
<li><strong>All-reduce</strong> again, then the residual add.</li>
</ol>
<p>That’s about 10–12 kernels per layer, or around a thousand per token, plus the embedding, LM head, and sampling.</p>
<h3 id="sec-multi">Across 8 GPUs</h3>
<p>The model doesn’t fit on one GPU (141 GB versus 80 GB), so it uses <strong>tensor parallelism</strong>: every matrix is split 8 ways, and all 8 GPUs work on every layer at once. The payoff is that each GPU reads only one-eighth of the weights per step, so the step is up to 8× faster. The cost is two all-reduces per layer, 160 per token. At batch 1 each one moves only 16 KB, so they’re limited by latency (a few microseconds each over NVLink), not bandwidth, and they add up to a significant fraction of a 5 ms step.</p>
<p>Models too big for one server add <strong>pipeline parallelism</strong> (different layers on different servers) or, for MoE models, <strong>expert parallelism</strong> (different experts on different GPUs).</p>
<h3 id="sec-overheads">Overheads</h3>
<ul>
<li><strong>Kernel launches:</strong> launching a kernel takes a few microseconds of CPU and driver time. A thousand per token would add milliseconds, so servers record the whole decode step once as a <strong>CUDA Graph</strong> and replay it with a single launch.</li>
<li><strong>Host synchronization:</strong> each step ends with the sampled token going to the CPU. Overlapping the scheduler’s work with GPU execution hides most of it.</li>
<li><strong>Achieved bandwidth:</strong> skinny matrix-vector kernels rarely reach peak HBM bandwidth; 70–80% is good.</li>
</ul>
<h3 id="sec-energy">Where the Energy Goes</h3>
<p>Moving data costs far more energy than computing on it. A rough estimate with two assumptions: the GPU’s ~700 W at ~990 TFLOP/s implies about 0.7 pJ per FLOP for the whole chip, and reading HBM costs very roughly 3–4 pJ per bit.</p>
<ul>
<li><strong>Batch 1:</strong> reading 141 GB of weights ≈ 141 × 10<sup>9</sup> × 8 bits × 3.5 pJ ≈ <strong>4 J per token</strong>. The math, 141 GFLOPs × 0.7 pJ ≈ <strong>0.1 J</strong>. Data movement costs about 40× the arithmetic.</li>
<li><strong>Batch 64:</strong> the weight read is shared, so it drops to about 0.06 J per token, comparable to the math. But each sequence’s KV cache read can’t be shared, so at long contexts data movement dominates again.</li>
</ul>
<p>This is the core reason inference efficiency is measured in tokens per joule or per watt rather than peak FLOP/s.</p>
<h3 id="sec-future">What New Hardware Targets</h3>
<ul>
<li><strong>More bandwidth per FLOP:</strong> faster HBM generations, and chips that keep weights in large on-chip SRAM so decode never touches DRAM.</li>
<li><strong>Fewer bytes per weight:</strong> FP8 and FP4 formats with hardware support.</li>
<li><strong>Compute near or in memory:</strong> perform attention where the KV cache lives, so only small query and output vectors move.</li>
<li><strong>Specialization by phase:</strong> different hardware for compute-bound prefill and bandwidth-bound decode.</li>
<li><strong>Different math:</strong> probabilistic and physics-based designs that treat sampling and noise as primitives (see <a href="#/gen-gpus">GPUs for generative AI</a>).</li>
</ul>
<p class="refs">Further reading:</p><ul class="refs"><li>Horowitz, “Computing’s Energy Problem (and What We Can Do About It)” (ISSCC 2014), the classic energy-per-operation figures</li><li>Pope et al., “Efficiently Scaling Transformer Inference” (MLSys 2023)</li><li>Shoeybi et al., “Megatron-LM” (2019)</li><li>NVIDIA H100 Tensor Core GPU architecture whitepaper (2022)</li></ul>`,
  practice: {
    guided: [
      {
        q: `<p>On the 8-GPU server with tensor parallelism, estimate the decode step time and aggregate tokens/s at (a) batch 1 and (b) batch 64, with every sequence at 8K (8,192) tokens of context. The running example has 141 GB of BF16 weights and 0.33 MB of KV cache per token, both split evenly across the GPUs. Assume perfect use of 3.35 TB/s per GPU.</p>`,
        a: `<ol><li>Weights per GPU: 141 / 8 ≈ 17.6 GB. KV per sequence: 8,192 × 0.33 MB ≈ 2.68 GB, so ≈ 0.34 GB per GPU.</li><li>(a) Batch 1: 17.6 + 0.34 ≈ 17.9 GB per GPU → 17.9 / 3.35 ≈ <strong>5.4 ms</strong> per step → about <strong>185 tokens/s</strong>.</li><li>(b) Batch 64: 17.6 + 64 × 0.34 ≈ 17.6 + 21.5 = 39.1 GB per GPU → ≈ <strong>11.7 ms</strong> per step → 64 / 0.0117 ≈ <strong>5,500 tokens/s</strong>.</li><li>Batching gave about 30× more throughput for about 2× the latency per token. At this context length, the KV cache is already the bigger read at batch 64.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Your measured per-token decode latency for an 80-layer model with tensor parallelism on 8 GPUs is twice the HBM-bandwidth bound. Where could the time be going, and how would you find out?</p>`,
        a: `<ul><li><strong>Achieved bandwidth below peak:</strong> small matrix-vector kernels often reach only 60–80% of peak HBM bandwidth.</li><li><strong>Communication:</strong> 160 all-reduces per token (two per layer), each small and latency-bound.</li><li><strong>Kernel launch overhead:</strong> on the order of a thousand kernels per token; without CUDA Graphs, launch gaps leave the GPU idle.</li><li><strong>CPU-side work:</strong> scheduling, sampling synchronization, Python overhead between steps.</li><li><strong>Load imbalance:</strong> one slow GPU makes all the others wait at every all-reduce.</li></ul><p>To find out: capture a timeline with a profiler such as Nsight Systems and look for idle gaps between kernels, time inside communication calls, and per-kernel achieved bandwidth. Then compare the sum of kernel times with the step time, the same way you’d build a stall breakdown for a CPU.</p>`
      }
    ]
  }
},

{
  id: "llm-faster",
  region: "llm",
  title: "Making Inference Faster",
  sections: [{ id: "table", label: "The Toolbox" }, { id: "quant", label: "Quantization" }, { id: "spec", label: "Speculative Decoding" }, { id: "choose", label: "Choosing Techniques" }],
  body: `
<h3 id="sec-table">The Toolbox</h3>
<div class="tbl"><table>
<tr><th>Technique</th><th>What it attacks</th><th>How</th></tr>
<tr><td>Batching (continuous)</td><td>Weight reads per token</td><td>Share each weight read across many users</td></tr>
<tr><td>Quantization</td><td>Bytes per weight and per KV entry</td><td>FP8, INT4, FP4 instead of BF16</td></tr>
<tr><td>Speculative decoding</td><td>The one-token-per-step limit</td><td>Guess several tokens, verify them in one pass</td></tr>
<tr><td>FlashAttention</td><td>Attention memory traffic</td><td>Tile through on-chip memory</td></tr>
<tr><td>Paged KV and prefix caching</td><td>KV memory waste, repeated prefill</td><td>Block allocation and reuse</td></tr>
<tr><td>GQA, MLA, MoE</td><td>KV size, compute per token</td><td>Architecture choices made at training time</td></tr>
<tr><td>Tensor parallelism</td><td>Per-GPU bytes per step</td><td>Split every matrix across GPUs</td></tr>
<tr><td>CUDA Graphs, kernel fusion</td><td>Launch overhead and extra memory trips</td><td>Fewer, bigger kernels</td></tr>
</table></div>
<h3 id="sec-quant">Quantization</h3>
<p>Since decode time is roughly bytes divided by bandwidth, halving the bytes per weight nearly halves the step time. Storing the running example’s weights in INT4 shrinks them from 141 GB to about 35 GB: a 4× smaller read per step, and the model fits on fewer GPUs. Methods such as GPTQ and AWQ choose the rounding carefully, using a small calibration set, to keep accuracy. FP8 is now common for both weights and the KV cache, with native Tensor Core support.</p>
<h3 id="sec-spec">Speculative Decoding</h3>
<p>Decode wastes the GPU’s compute: it reads every weight to process one token per sequence. Speculative decoding uses that idle compute.</p>
<ol>
<li>A small, fast <strong>draft model</strong> guesses the next k tokens.</li>
<li>The big model runs <strong>one</strong> pass over all k guesses at once. That pass costs about the same as a single decode step, because it’s still dominated by reading the weights.</li>
<li>Accept guesses left to right while they agree with the big model; at the first disagreement, take the big model’s token instead and discard the rest.</li>
</ol>
<p>A clever acceptance rule guarantees that the output follows exactly the same probability distribution as the big model alone, so quality is unchanged. For a CPU architect, this is <strong>branch prediction and speculative execution</strong>: predict ahead, verify in parallel, squash on a mispredict, and the speedup depends on prediction accuracy. Variants skip the separate draft model by adding extra prediction heads (Medusa, EAGLE) or by matching text that already appeared in the context.</p>
<h3 id="sec-choose">Choosing Techniques</h3>
<p>Start by asking which phase and which resource limit the workload, the same way you’d read a CPI stack. Long prompts and short answers point to prefill compute and prefix caching. Short prompts and long answers point to decode bandwidth: quantization, batching, and speculation. Long contexts with many users point to the KV cache: GQA, FP8 caches, paging, and offloading.</p>
<p class="refs">Further reading:</p><ul class="refs"><li>Leviathan, Kalman, and Matias, “Fast Inference from Transformers via Speculative Decoding” (ICML 2023)</li><li>Chen et al., “Accelerating Large Language Model Decoding with Speculative Sampling” (2023)</li><li>Frantar et al., “GPTQ” (ICLR 2023)</li><li>Lin et al., “AWQ” (MLSys 2024)</li><li>Cai et al., “Medusa” (2024)</li><li>Li et al., “EAGLE” (2024)</li></ul>`,
  practice: {
    guided: [
      {
        q: `<p>A draft model proposes k = 4 tokens per round, and the big model accepts each with probability α = 0.8 (independently). How many tokens does each big-model pass produce on average? What if α = 0.5?</p>`,
        a: `<ol><li>Expected tokens per pass = (1 − α<sup>k+1</sup>) / (1 − α). (The big model always contributes at least one token of its own, even if it rejects the first draft.)</li><li>α = 0.8: (1 − 0.8<sup>5</sup>) / 0.2 = (1 − 0.328) / 0.2 ≈ <strong>3.4 tokens</strong>.</li><li>α = 0.5: (1 − 0.5<sup>5</sup>) / 0.5 = 0.969 / 0.5 ≈ <strong>1.9 tokens</strong>.</li><li>Since a verification pass costs about the same as one normal decode step (it’s memory-bound), the speedup approaches these numbers minus the draft model’s cost. Acceptance rate is everything.</li></ol>`
      }
    ],
    interview: [
      {
        q: `<p>Which optimizations would you prioritize for (a) a chat product where users care about streaming speed, and (b) an overnight job summarizing millions of documents?</p>`,
        a: `<p><strong>(a) Latency:</strong> per-user decode speed matters most. Quantize weights (fewer bytes per step), use speculative decoding (more tokens per weight read), CUDA Graphs and fast all-reduce to cut overheads, enough tensor parallelism that each GPU reads less, prefix caching for shared system prompts (lower TTFT), and moderate batch sizes that respect a TPOT target.</p><p><strong>(b) Throughput:</strong> latency doesn’t matter, so maximize batch size to share weight reads, use continuous batching and paged KV memory to pack the GPUs, FP8 weights and KV cache to fit more sequences, and prefix caching for the shared instructions. Speculative decoding helps less at large batch, because the GPU is already busy.</p>`
      }
    ]
  }
}
]);
